# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Stage the demos that run in a page, from checkouts of their public repositories.

build.py calls stage_all(out, inputloop_dir). For each demo in catalog.DEMOS with runs="here", the
files its `stage` map names are copied from <inputloop_dir>/<repo>/ into <out>/demo/<id>/app/; this
repository never carries them. Two changes are made to the staged copy, and only to the copy:

  - every inline <script> is moved, unchanged, into its own file beside the page (inline-N.js) and
    loaded from there, in the same place, so the site's policy (script-src 'self') can run it with
    no hash and no 'unsafe-inline' for scripts;
  - a <link rel="jslicense"> to this site's licence table is added to the head, for GNU LibreJS.

egad's demo is derived: a page of its colour pairs, measured, built from its tokens file.
Returns {id: {"staged": bool, "scripts": [(path, licence, source)], "commit": str or None, "why": str}}.
Standard library only.
"""
import json
import os
import re
import shutil
import subprocess

import catalog as C

SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", re.S | re.I)


def commit_of(repo_dir):
    try:
        r = subprocess.run(["git", "-C", repo_dir, "rev-parse", "--short=12", "HEAD"], capture_output=True, text=True)
        return r.stdout.strip() or None
    except OSError:
        return None


def externalize(html_path, licence):
    """Move each inline script of one page into inline-N.js beside it. Returns the new script paths."""
    with open(html_path, encoding="utf-8") as f:
        t = f.read()
    made, here = [], os.path.dirname(html_path)
    stem = os.path.splitext(os.path.basename(html_path))[0]

    def repl(m):
        name = "%s-inline-%d.js" % (stem, len(made) + 1)
        body = m.group(2)
        with open(os.path.join(here, name), "w", encoding="utf-8") as g:
            if "@license" not in body:
                g.write("// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt %s\n" % licence)
                g.write("// Moved here from an inline script in %s by corwin.cloud's build; the code is unchanged.\n" % os.path.basename(html_path))
                g.write(body.strip("\n") + "\n// @license-end\n")
            else:
                g.write("// Moved here from an inline script in %s by corwin.cloud's build; the code is unchanged.\n" % os.path.basename(html_path))
                g.write(body.strip("\n") + "\n")
        made.append(name)
        attrs = re.sub(r"\btype=[\"']?text/javascript[\"']?", "", m.group(1))
        return '<script%s src="%s"></script>' % (attrs, name)

    t = SCRIPT.sub(repl, t)
    if 'rel="jslicense"' not in t:
        t = re.sub(r"(<head[^>]*>)", r'\1\n<link rel="jslicense" href="/jslicense.html">', t, count=1, flags=re.I)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(t)
    return made


def stage_one(d, out, idir):
    src = os.path.join(idir or "", d["repo"])
    res = {"staged": False, "scripts": [], "commit": None, "why": ""}
    if not os.path.isdir(src):
        res["why"] = "no checkout of %s at build time" % d["repo"]
        return res
    res["commit"] = commit_of(src)
    app = os.path.join(out, "demo", d["id"], "app")
    shutil.rmtree(app, ignore_errors=True)
    os.makedirs(app)
    if d.get("derived") == "egad":
        return stage_egad(d, src, out, res)
    for pub, rel in d["stage"].items():
        s = os.path.join(src, rel)
        t = os.path.join(app, pub)
        if os.path.isdir(s):
            shutil.copytree(s, t, symlinks=False, ignore=shutil.ignore_patterns(".git", "node_modules"))
        elif os.path.isfile(s):
            os.makedirs(os.path.dirname(t), exist_ok=True)
            shutil.copyfile(s, t)
        else:
            res["why"] = "%s has no %s" % (d["repo"], rel)
            shutil.rmtree(app, ignore_errors=True)
            return res
    lic = d["licence"].split(";")[0].split(".")[0].replace("Code ", "").strip()
    lic = "GPL-3.0-or-later" if "GPL-3.0-or-later" in lic else lic
    scripts = list(d.get("scripts", []))
    for dp, _, fs in os.walk(app):
        for f in fs:
            if f.endswith((".html", ".htm")):
                for n in externalize(os.path.join(dp, f), lic):
                    scripts.append((os.path.relpath(os.path.join(dp, n), app), lic, None))
    res.update(staged=True, scripts=scripts)
    return res


# ---- egad: the colour pairs, measured ------------------------------------------------------------

def _lum(h):
    h = h.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def egad_pairs(tokens):
    """[(theme name, fg name, bg name, fg hex, bg hex, ratio, floor, why)] from egad-tokens.json."""
    col = tokens["color"]
    by = {t["name"]: t for t in col["tokens"]}

    def val(name, theme, depth=0):
        t = by[name]
        v = t.get("value")
        if isinstance(v, dict):
            v = v.get(theme)
        if isinstance(v, str) and v.startswith("#"):
            return v
        ref = t.get("alias") or t.get("ref") or v
        if isinstance(ref, dict):
            ref = ref.get(theme)
        if depth > 5 or not isinstance(ref, str):
            raise ValueError("egad token %s has no colour for %s" % (name, theme))
        return val(ref.strip("{}"), theme, depth + 1)

    out = []
    for th in col["themes"]:
        for p in tokens["meta"]["pairs"]:
            fg, bg = val(p["fg"], th["id"]), val(p["bg"], th["id"])
            out.append((th["name"], p["fg"], p["bg"], fg, bg, contrast(fg, bg), p.get("floor", ""), p.get("why", "")))
    return out


def stage_egad(d, src, out, res):
    with open(os.path.join(src, "tokens", "egad-tokens.json"), encoding="utf-8") as f:
        tokens = json.load(f)
    pairs = egad_pairs(tokens)
    res.update(staged=True, pairs=pairs, scripts=[])
    # one class per colour, in a stylesheet (the site's policy allows no style attribute)
    colours = sorted({p[3] for p in pairs} | {p[4] for p in pairs})
    css = ["/* generated by corwin.cloud's build from egad's tokens/egad-tokens.json */"]
    for c in colours:
        css.append(".fg-%s{color:%s}.bg-%s{background:%s}" % (c[1:], c, c[1:], c))
    app = os.path.join(out, "demo", d["id"], "app")
    with open(os.path.join(app, "egad-pairs.css"), "w", encoding="utf-8") as f:
        f.write("\n".join(css) + "\n")
    return res


def stage_all(out, idir):
    return {d["id"]: stage_one(d, out, idir) for d in C.DEMOS if d["runs"] == "here"}
