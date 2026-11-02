# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Share about-corwin's Customize palette and its Emacs CI strip, staged from a checkout at build time.

aboutcorwin.com has a floating Customize control (text size, line length, spacing, colour theme;
kept in the browser) and a strip of recent Emacs builds. corwin.cloud shares them the way it shares
topology: the build reads them from a local checkout of about-corwin (ABOUT_DIR, default
../about-corwin) into public/, and this repository never carries a copy. What is taken, and from where:

    src/js/customize.js            -> public/js/customize.js, unchanged
    src/index.html                 the <div class="custom" id="custom"> block, unchanged, into every page
    src/css/site.css               the "reading settings" and "Customize" sections and the side-card
                                   rules, unchanged, into public/css/shared.css (with where they came from)
    build.py load_snapshots() and render_ci()   the CI strip, rendered by about-corwin's own code from
                                   its content/ci/builds.json (the snapshot its scripts/fetch-ci saves)
    src/js/taxonomy.js             -> public/js/taxonomy.js, unchanged: the left nav (js/nav.js) matches
                                   the prompt's words with its tokenize() and similarity() (docs/NAV.md)

Without a checkout the pages build without them and the build says so. Standard library only.
"""
import importlib.util
import os
import re
import subprocess
import sys

LABEL = "// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later"
SIDE_RULES = (".side {", ".side-card {", ".side-card h3 {", ".side ul {", ".side .what {", ".side .when {", ".side .src {", ".builds li, .posts li {")
SECTIONS = ("reading settings (Customize)", "Customize: the floating control")


def commit_of(d):
    try:
        r = subprocess.run(["git", "-C", d, "rev-parse", "--short=12", "HEAD"], capture_output=True, text=True)
        return r.stdout.strip() or None
    except OSError:
        return None


def css_section(css, title):
    """One '/* ---- title ...' section of a stylesheet, up to the next '/* ----' heading."""
    i = css.find("/* ---- " + title)
    if i < 0:
        raise ValueError("about-corwin's site.css has no section %r" % title)
    j = css.find("\n/* ---- ", i + 1)
    return css[i:j if j > 0 else len(css)].rstrip() + "\n"


def stage(out, adir):
    """Returns {"staged": bool, "why", "commit", "markup", "ci"} and writes js/customize.js and css/shared.css."""
    res = {"staged": False, "why": "", "commit": None, "markup": "", "ci": "", "taxonomy": False}
    src = os.path.join(adir or "", "src")
    try:
        with open(os.path.join(src, "js", "customize.js"), encoding="utf-8") as f:
            js = f.read()
        with open(os.path.join(src, "index.html"), encoding="utf-8") as f:
            page = f.read()
        with open(os.path.join(src, "css", "site.css"), encoding="utf-8") as f:
            css = f.read()
    except OSError as ex:
        res["why"] = "no about-corwin checkout at %s (%s)" % (adir, ex.strerror)
        return res
    if not js.startswith(LABEL) or "// @license-end" not in js:
        res["why"] = "about-corwin's customize.js lost its LibreJS label: not shared"
        return res
    m = re.search(r'\n(<div class="custom" id="custom">\n.*?\n</div>)\n', page, re.S)
    if not m or 'id="custom-panel"' not in m.group(1) or "<script" in m.group(1) or "style=" in m.group(1):
        res["why"] = "about-corwin's index.html has no Customize block this site can take"
        return res
    try:
        parts = [css_section(css, t) for t in SECTIONS]
    except ValueError as ex:
        res["why"] = str(ex)
        return res
    side = [ln for ln in css.splitlines() if ln.startswith(SIDE_RULES)]
    res["commit"] = commit_of(adir)
    head = ("/* Staged by corwin.cloud's build from about-corwin's src/css/site.css%s; edit it there.\n"
            "   SPDX-FileCopyrightText: 2026 Corwin Brust <corwin@bru.st> and Contributors\n"
            "   SPDX-License-Identifier: GPL-3.0-or-later */\n" % (" at commit " + res["commit"] if res["commit"] else ""))
    with open(os.path.join(out, "css", "shared.css"), "w", encoding="utf-8") as f:
        f.write(head + "\n".join(parts) + "\n/* ---- the side cards (the CI strip) */\n" + "\n".join(side) + "\n")
    with open(os.path.join(out, "js", "customize.js"), "w", encoding="utf-8") as f:
        f.write(js)
    res["taxonomy"] = stage_taxonomy(out, src)
    # about-corwin's page is a template now: {{TONE_ROWS}} in the Customize block (2026-11-01). Its own
    # build fills a placeholder with nothing when the tone pads are off; they are not on this site, so
    # every placeholder is filled the same way (it had leaked onto the page as text).
    res["markup"] = re.sub(r"\{\{[A-Z_]+\}\}", "", m.group(1))
    res["ci"] = ci_strip(adir, res)
    res["staged"] = True
    return res


def ci_strip(adir, res):
    """about-corwin's own render_ci(), from its own snapshot. An empty string (and a reason) if it fails."""
    path = os.path.join(adir, "build.py")
    # about-corwin's build.py imports modules that sit beside it (build_tone, 2026-11-01), so its folder
    # is on the import path while it loads, and taken off again after.
    sys.path.insert(0, os.path.abspath(adir))
    try:
        spec = importlib.util.spec_from_file_location("about_corwin_build", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.render_ci(mod.load_snapshots())
    except Exception as ex:  # noqa: BLE001  any failure here only leaves the strip out
        print("share: the CI strip is left out: %s" % ex, file=sys.stderr)
        res["ci_why"] = str(ex)
        return ""
    finally:
        try:
            sys.path.remove(os.path.abspath(adir))
        except ValueError:
            pass


def stage_taxonomy(out, src):
    """about-corwin's taxonomy.js, unchanged, for the left nav's word matching. False if it is missing
    or lost its labels; the nav then matches words by its own plain rule and says so."""
    try:
        with open(os.path.join(src, "js", "taxonomy.js"), encoding="utf-8") as f:
            t = f.read()
    except OSError:
        return False
    if not t.startswith(LABEL) or "// @license-end" not in t:
        return False
    with open(os.path.join(out, "js", "taxonomy.js"), "w", encoding="utf-8") as f:
        f.write(t)
    return True
