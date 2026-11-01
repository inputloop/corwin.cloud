#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Build corwin.cloud into public/.

    TOPOLOGY_DIR=../topology python3 build.py [--out DIR]

Python 3.8+, standard library only. The words are in catalog.py; the page shapes, the stylesheet
and the one script are in src/. topology is private: this repository never carries it. The build
asks a local checkout of topology to stage its own www (sh bin/stage-www.sh DEST) into
<out>/topology/ and, if there is no checkout, writes a clear placeholder and says so.
"""
import argparse
import base64
import hashlib
import html
import os
import re
import shutil
import subprocess
import sys

import catalog as C

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
JS_FILES = ("site.js",)
YEAR_LINE = "Copyright 2026 INPUTLOOP"
AUTHOR_LINE = "Corwin and Bryant (%s)" % C.MAIL
LICENCE_LINE = "Code GPL-3.0-or-later OR LGPL-3.0-or-later; prose CC-BY-SA-4.0."

e = html.escape


def a(href, text, cls=""):
    c = ' class="%s"' % cls if cls else ""
    return '<a%s href="%s">%s</a>' % (c, e(href, quote=True), text)


# ---- diagrams: inline SVG, drawn here, no external image -------------------------------------

def flow_svg(steps, title, ident):
    """A vertical step diagram. Boxes joined by arrows; the text is real text, so it scales,
    reflows for the reader's zoom and is read by assistive technology as one labelled image."""
    w, bh, gap, pad = 340, 54, 26, 6
    h = pad * 2 + len(steps) * bh + (len(steps) - 1) * gap
    desc = "; ".join("%d. %s, %s" % (i + 1, s, t) for i, (s, t) in enumerate(steps))
    out = ['<svg class="diagram" viewBox="0 0 %d %d" role="img" aria-labelledby="%s-t %s-d" focusable="false">'
           % (w + 2 * pad, h, ident, ident),
           '<title id="%s-t">%s</title><desc id="%s-d">%s</desc>' % (ident, e(title), ident, e(desc)),
           '<defs><marker id="%s-m" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
           '<path d="M0 0L10 5L0 10z" class="d-arrow-head"/></marker></defs>' % ident]
    for i, (s, t) in enumerate(steps):
        y = pad + i * (bh + gap)
        out.append('<g class="d-step"><rect x="%d" y="%d" width="%d" height="%d" class="d-box"/>'
                   '<text x="%d" y="%d" class="d-num">%d</text>'
                   '<text x="%d" y="%d" class="d-head">%s</text><text x="%d" y="%d" class="d-sub">%s</text></g>'
                   % (pad, y, w, bh, pad + 14, y + bh // 2 + 5, i + 1,
                      pad + 40, y + 23, e(s), pad + 40, y + 42, e(t)))
        if i < len(steps) - 1:
            out.append('<line x1="%d" y1="%d" x2="%d" y2="%d" class="d-arrow" marker-end="url(#%s-m)"/>'
                       % (pad + 20, y + bh, pad + 20, y + bh + gap - 2, ident))
    out.append("</svg>")
    return "".join(out)


def scenes_svg():
    """The hand-made screen map: four rectangles, one hidden, with two captures bound two ways.
    Display names and ids are invented for the picture."""
    d = C.OBS_SCENES["displays"]
    unit, ox, oy = 30, 10, 34
    w = 12 * unit + 2 * ox
    out = ['<svg class="diagram wide" viewBox="0 0 %d 250" role="img" aria-labelledby="sc-t sc-d" focusable="false">' % w,
           '<title id="sc-t">A screen map scene, drawn with invented display names</title>'
           '<desc id="sc-d">Four display rectangles side by side named Left, Centre, Right and Spare. Spare is '
           'dashed: that display is unplugged, so its item is hidden and kept, not deleted. Below, two captures: '
           'one bound by monitor number, which can drift, and one bound by stable id, which follows the display.</desc>',
           '<text x="%d" y="20" class="d-sub">Scene: Screenmap (the canvas, 12 by 2 squares)</text>' % ox]
    for i, (name, x, y, ww, hh) in enumerate(d):
        gone = name == "Spare"
        out.append('<rect x="%d" y="%d" width="%d" height="%d" class="d-box%s"/>'
                   % (ox + x * unit, oy + y * unit, ww * unit - 4, hh * unit, " d-gone" if gone else ""))
        out.append('<text x="%d" y="%d" class="d-head">%s</text>'
                   % (ox + x * unit + 8, oy + 26, e(name)))
        out.append('<text x="%d" y="%d" class="d-sub">%s</text>'
                   % (ox + x * unit + 8, oy + 46, "monitor %d" % i if not gone else "hidden"))
    out.append('<text x="%d" y="122" class="d-sub">Two captures of the Left display:</text>' % ox)
    rows = [("Left Head", "monitor 0", "by number: after a re-plug, 0 may be another screen", False),
            ("Left Head", "id left-01, monitor 0 kept", "by stable id: follows the display", True)]
    for i, (n, b, note, ok) in enumerate(rows):
        y = 134 + i * 54
        out.append('<rect x="%d" y="%d" width="%d" height="44" class="d-box%s"/>' % (ox, y, w - 2 * ox, " d-good" if ok else " d-warn"))
        out.append('<text x="%d" y="%d" class="d-head">%s  [%s]</text>' % (ox + 10, y + 19, e(n), e(b)))
        out.append('<text x="%d" y="%d" class="d-sub">%s</text>' % (ox + 10, y + 36, e(note)))
    out.append("</svg>")
    return "".join(out)


# ---- shared furniture ------------------------------------------------------------------------

def head(title, desc, here):
    return """<!doctype html>
<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
Built by build.py from catalog.py and src/. Edit those, not this file.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%s</title>
<meta name="description" content="%s">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/site.css">
<script src="js/site.js" defer></script>
</head>
<body data-page="%s">
<a class="skip" href="#main">Skip to the content</a>
""" % (e(title), e(desc), here)


def nav(here):
    items = [("home", "Home", "index.html"), ("directory", "Directory", "directory.html"),
             ("packages", "Packages", "packages.html")]
    lis = []
    for key, label, href in items:
        cur = ' aria-current="page"' if key == here else ""
        lis.append('<li><a href="%s"%s>%s</a></li>' % (href, cur, label))
    lis.append('<li><a href="%s" rel="me">About</a></li>' % C.ABOUT_URL)
    return ('<header class="top"><a class="brand" href="index.html">corwin.cloud</a>'
            '<nav aria-label="Main"><ul>%s</ul></nav></header>\n' % "".join(lis))


def everywhere():
    pages = [("Home", "index.html"), ("Directory", "directory.html"), ("Packages", "packages.html"),
             ("JavaScript licences", "jslicense.html")]
    li = ['<li><a href="%s">%s</a></li>' % (h, l) for l, h in pages]
    li += ['<li><a href="index.html#tab-%s">Tab: %s</a></li>' % (x["id"], e(x["name"])) for x in C.APPS]
    li.append('<li><a href="%s">About (aboutcorwin.com)</a></li>' % C.ABOUT_URL)
    return "".join(li)


def foot(buf):
    return """<div class="modeline" id="modeline">
  <a class="ml-link" href="#minibuffer" aria-label="corwin.cloud mode line: go to the prompt and the list of everywhere">
    <span class="ml-flags" aria-hidden="true">-:%%%%-</span>
    <span class="ml-buf">%s</span>
    <span class="ml-pos" aria-hidden="true"></span>
    <span class="ml-sec" aria-hidden="true"></span>
    <span class="ml-modes" aria-hidden="true">(HTML LibreJS)</span>
  </a>
</div>
<footer class="minibuffer-wrap" id="minibuffer">
  <form class="minibuffer js-only-flex" id="mb-form" role="search" autocomplete="off">
    <label for="prompt" class="mb-prompt">Go to:</label>
    <input id="prompt" name="q" type="search" spellcheck="false" aria-describedby="echo" aria-controls="goto" placeholder="a page, or a project's tab">
  </form>
  <nav aria-label="Everywhere on this site"><ul class="goto" id="goto">%s</ul></nav>
  <p id="echo" class="echo" role="status">End of buffer. <span class="js-only-inline">Press Alt+x anywhere to come here.</span></p>
  <p class="colophon">%s. %s Words and diagrams CC-BY-SA-4.0; code GPL-3.0-or-later OR LGPL-3.0-or-later. By %s. <a href="jslicense.html" rel="jslicense">JavaScript licences</a>.</p>
</footer>
</body>
</html>
""" % (e(buf), everywhere(), YEAR_LINE, LICENCE_LINE, e(AUTHOR_LINE))


# ---- the tabs --------------------------------------------------------------------------------

def repo_by_id(rid):
    return next(r for r in C.REPOS if r["id"] == rid)


def render_obs_extra():
    wf = []
    for w in C.OBS_WORKFLOWS:
        wf.append('<figure class="flow"><figcaption><h4>%s</h4><p>%s</p></figcaption>%s</figure>'
                  % (e(w["title"]), e(w["intro"]), flow_svg(w["steps"], w["title"], "obs-" + w["id"])))
    pts = "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (e(t), e(b)) for t, b in C.OBS_SCENES["points"])
    return ('<section class="sub" aria-labelledby="obs-wf-h"><h3 id="obs-wf-h">Workflows</h3>'
            '<p>Three things you do with obsmage, each as the steps it takes.</p>'
            '<div class="flows">%s</div></section>'
            '<section class="sub" aria-labelledby="obs-sc-h"><h3 id="obs-sc-h">Scenes</h3>'
            '<p>%s</p><figure>%s<figcaption>The names and numbers here are made up for the picture.</figcaption></figure>'
            '<dl class="points">%s</dl></section>'
            % ("".join(wf), e(C.OBS_SCENES["intro"]), scenes_svg(), pts))


def render_panel(app):
    r = repo_by_id(app["repo"])
    links = []
    for label, url in app["links"]:
        links.append("<li>%s</li>" % a(url, e(label)))
    if app.get("demo"):
        links.append("<li>%s</li>" % a(app["demo"], "Demo", "demo"))
    private = ""
    if not r["public"]:
        private = '<p class="private">Repository: <strong>not public yet</strong>.</p>'
    does = "".join("<li>%s</li>" % e(x) for x in app["does"])
    fid = "p-" + app["id"]
    return """<section class="panel" role="tabpanel" id="panel-%(id)s" aria-labelledby="tab-%(id)s" tabindex="0">
  <header class="panel-head"><h2>%(name)s</h2><p class="tagline">%(tag)s</p>
  <p class="badges"><span class="badge st-%(state)s">%(state)s</span> <span class="badge">%(pub)s</span></p></header>
  <p class="lede">%(what)s</p>
  <dl class="facts">
    <div><dt>Status</dt><dd>%(status)s</dd></div>
    <div><dt>Licence</dt><dd>%(lic)s</dd></div>
    <div><dt>Made by</dt><dd>%(credit)s</dd></div>
    <div><dt>You need</dt><dd>%(needs)s</dd></div>
  </dl>
  <div class="cols">
    <div><h3 id="%(fid)s-does">What it does</h3><ul aria-labelledby="%(fid)s-does">%(does)s</ul>
    %(private)s<ul class="links" aria-label="Links">%(links)s</ul></div>
    <figure class="flow"><figcaption><h3>How it works</h3><p>%(how_title)s.</p></figcaption>%(svg)s<p class="how">%(how)s</p></figure>
  </div>
  %(extra)s
</section>
""" % dict(id=app["id"], name=e(app["name"]), tag=e(app["tagline"]), state=app["state"],
           pub="public" if r["public"] else "not public yet", what=e(app["what"]),
           status=e(app["status"]), lic=e(app["licence"]), credit=e(app["credit"]), needs=e(app["needs"]),
           fid=fid, does=does, private=private, links="".join(links),
           how_title=e(app["how_title"]), svg=flow_svg(app["flow"], app["how_title"], "f-" + app["id"]),
           how=e(app["how"]), extra=render_obs_extra() if app.get("extra") == "obsmage" else "")


def render_tabs():
    tabs = []
    for i, app in enumerate(C.APPS):
        tabs.append('<a role="tab" id="tab-%s" href="#panel-%s" aria-controls="panel-%s" aria-selected="%s">%s</a>'
                    % (app["id"], app["id"], app["id"], "true" if i == 0 else "false", e(app["name"])))
    panels = "\n".join(render_panel(x) for x in C.APPS)
    return ('<section class="tabs" id="projects" aria-labelledby="projects-h">'
            '<h2 id="projects-h" class="tabs-h">The projects</h2>'
            '<p class="hint">One tab each, with the design in full. <span class="js-only-inline">Arrow keys move between tabs; Home and End jump to the first and last.</span></p>'
            '<div class="tablist" role="tablist" aria-label="Projects">%s</div>\n%s</section>' % ("".join(tabs), panels))


# ---- pages -----------------------------------------------------------------------------------

def topology_area(have):
    if have:
        return ('<section class="stage" id="top" aria-labelledby="stage-h"><h1 id="stage-h" class="visually-hidden">topology</h1>'
                '<iframe id="topology" class="topology" src="topology/app.html" title="topology: draw what you have, from the files that describe it"></iframe>'
                '<p class="stage-note"><a href="topology/app.html">Open topology full size</a> · <a href="topology/index.html">its own front door</a>. '
                'Everything you draw stays in your browser. TopoForge, the drawing app inside, is Bryant Frankford\'s.</p>'
                '</section>')
    return ('<section class="stage placeholder" id="top" aria-labelledby="stage-h"><h1 id="stage-h">topology</h1>'
            '<p class="lede">topology is drawn here when this site is built with a checkout of it. This build had none, so this is a placeholder.</p>'
            '<p>topology is not public yet. See <a href="#tab-topology">its tab</a> for what it is.</p></section>')


def page_index(have):
    return (head("corwin.cloud: topology, and the projects around it",
                 "topology, the drawing app, with a tab of full design detail for each of inputloop's public apps and obsmage.", "home")
            + nav("home") + '<main id="main">\n' + topology_area(have) + render_tabs() + "</main>\n" + foot("corwin.cloud"))


def card(r):
    t = []
    if r.get("tab"):
        t.append(a("index.html#tab-" + next(x for x in C.APPS if x["id"] == r["tab"])["id"], "Design tab", "act primary"))
    if r["public"]:
        t.append(a(r["url"], "Repository", "act"))
    else:
        t.append('<span class="act off">Repository: not public yet</span>')
    if r.get("demo"):
        t.append(a(r["demo"], "Demo", "act"))
    return ('<li data-kind="%s"><article class="card" aria-labelledby="c-%s"><h3 id="c-%s">%s</h3>'
            '<p class="kind">%s · %s</p><p>%s</p><p class="credit">Made by: %s</p><p class="acts">%s</p></article></li>'
            % (r["kind"], re.sub(r"\W", "-", r["id"]), re.sub(r"\W", "-", r["id"]), e(r["name"]),
               dict(C.KINDS)[r["kind"]], "public" if r["public"] else "not public yet", e(r["one"]), e(r["credit"]),
               "".join(t)))


def page_directory():
    radios = ['<input type="radio" name="kind" id="f-all" class="f" checked><label for="f-all">All (%d)</label>' % len(C.REPOS)]
    for k, label in C.KINDS:
        n = sum(1 for r in C.REPOS if r["kind"] == k)
        radios.append('<input type="radio" name="kind" id="f-%s" class="f"><label for="f-%s">%s (%d)</label>' % (k, k, e(label), n))
    pub = sum(1 for r in C.REPOS if r["public"])
    return (head("Directory: everything inputloop makes", "Every repository we can name, what it does, and where to find its design, its code and its demo.", "directory")
            + nav("directory") + """<main id="main" class="wrap">
<h1>Directory</h1>
<p class="lede">Every repository we can name: %d of them, %d public. Each card goes to its design tab, its code if the code is public, and its demo if there is one. Private repositories are named so you can see what exists; they have no link.</p>
<fieldset class="filter"><legend>Show only</legend>%s
<ul class="grid">%s</ul></fieldset>
<p class="hint">Counted from this site's catalog, 2026-11-01.</p>
</main>
""" % (len(C.REPOS), pub, "".join(radios), "".join(card(r) for r in C.REPOS)) + foot("directory"))


def package(p):
    tab = a("index.html#tab-" + p["tab"], "Design tab", "act primary") if p.get("tab") else ""
    repo = a(p["url"], "Repository", "act") if p.get("url") else '<span class="act off">Not public yet</span>'
    steps = ["designed", "built", "today"]
    meter = "".join('<li class="%s">%s</li>' % ("on" if steps.index(p["state"]) >= i else "", s) for i, s in enumerate(steps))
    return ('<li><article class="card pkg" aria-labelledby="k-%s"><h3 id="k-%s">%s</h3><p class="kind">%s</p>'
            '<ol class="meter" aria-label="%s">%s</ol><p>%s</p><p class="credit">%s</p><p class="acts">%s%s</p></article></li>'
            % (re.sub(r"\W", "-", p["name"]), re.sub(r"\W", "-", p["name"]), e(p["name"]), e(p["kind"]),
               e(C.STATE_WORDS[p["state"]]), meter, e(p["what"]), e(p["where"]), tab, repo))


def page_packages():
    return (head("Packages: what we curate", "The packages that exist today, built, or designed, and how honest we can be about each.", "packages")
            + nav("packages") + """<main id="main" class="wrap">
<h1>Packages</h1>
<p class="lede">The packages we curate, and where each one stands. Three words only: <strong>today</strong> (installable now), <strong>built</strong> (packages exist, not published for others), <strong>designed</strong> (written down, not built). There are no version numbers here because none has been released.</p>
<ul class="grid">%s</ul>
<p class="hint">A Debian package, a Claude plugin and an Emacs package are three different kinds of thing; the card says which.</p>
</main>
""" % "".join(package(p) for p in C.PACKAGES) + foot("packages"))


def page_404():
    return (head("Not found", "Nothing at this address.", "404").replace('href="css/', 'href="/css/').replace('src="js/', 'src="/js/').replace('href="favicon', 'href="/favicon')
            + '<main id="main" class="wrap"><h1>Not found</h1><p class="lede">There is nothing at this address. <a href="/">Home</a>, <a href="/directory.html">the directory</a> or <a href="/packages.html">the packages</a> may have what you were after.</p></main>\n'
            '<div class="modeline"><span class="ml-link"><span class="ml-buf">corwin.cloud</span> <span>[No match]</span></span></div>\n</body>\n</html>\n')


def page_jslicense():
    rows = []
    for f in JS_FILES:
        rows.append('<tr><td><a href="js/%s">%s</a></td><td><a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU-GPL-3.0-or-later</a></td><td><a href="js/%s">%s</a></td></tr>' % (f, f, f, f))
    return (head("JavaScript licence information", "The licence of every script on this site, in the form GNU LibreJS reads.", "jslicense")
            + nav("") + """<main id="main" class="wrap">
<h1>JavaScript licence information</h1>
<p>Every script on corwin.cloud is free software and is served from this site; nothing is minified. This table is in the form <a href="https://www.gnu.org/software/librejs/">GNU LibreJS</a> reads. The page works with scripts off.</p>
<table id="jslicense-labels1"><thead><tr><th scope="col">Script</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead><tbody>%s</tbody></table>
<p>topology, staged under /topology/ from its own checkout, carries its own scripts and its own licence notices.</p>
</main>
""" % "".join(rows) + foot("jslicense"))


# ---- topology staging ------------------------------------------------------------------------

def stage_topology(out, tdir):
    """Ask topology to stage its own www. Returns True when staged. Never copies its sources here."""
    if not tdir or not os.path.isfile(os.path.join(tdir, "bin", "stage-www.sh")):
        print("build: TOPOLOGY_DIR %r has no bin/stage-www.sh: the home page gets a placeholder" % tdir, file=sys.stderr)
        return False
    dest = os.path.join(out, "topology")
    r = subprocess.run(["sh", "bin/stage-www.sh", dest], cwd=tdir, capture_output=True, text=True)
    if r.returncode != 0:
        print("build: stage-www.sh failed (%s): placeholder" % r.stderr.strip(), file=sys.stderr)
        return False
    # The staged tree includes the branch's working context (starting requests, transcript reviews).
    # That is for its own host, not for a public site: leave it out unless asked.
    if os.environ.get("TOPOLOGY_KEEP_CONTEXT") != "1":
        shutil.rmtree(os.path.join(dest, "context"), ignore_errors=True)
    scrub_private(dest)
    write_topology_csp(dest)
    return True


def scrub_private(dest):
    """topology's recipe names its own (private) repository in a Vcs-Git line. This site is public,
    so the staged copy says "private repository" there instead of carrying the address."""
    pat = re.compile(r"https://github\.com/[\w.-]+/(?:%s)(?:\.git)?\b" % "|".join(re.escape(n) for n in C.PRIVATE_NAMES))
    for dp, _, fs in os.walk(dest):
        for f in fs:
            p = os.path.join(dp, f)
            try:
                with open(p, encoding="utf-8") as fh:
                    t = fh.read()
            except (UnicodeDecodeError, OSError):
                continue
            n = pat.sub("(private repository, not public yet)", t)
            if n != t:
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(n)


def write_topology_csp(dest):
    """The staged pages carry inline scripts, which the strict policy of this site forbids. The
    policy for /topology/ only lists each inline script by its hash, so nothing else can run."""
    hashes = []
    for dp, _, fs in os.walk(dest):
        for f in fs:
            if not f.endswith(".html"):
                continue
            with open(os.path.join(dp, f), encoding="utf-8") as fh:
                t = fh.read()
            for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", t, re.S):
                h = "'sha256-%s'" % base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode()
                if h not in hashes:
                    hashes.append(h)
    policy = ("default-src 'self'; script-src 'self' %s; style-src 'self' 'unsafe-inline'; "
              "img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https: http:; "
              "frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'" % " ".join(hashes))
    os.makedirs(os.path.join(ROOT, "deploy"), exist_ok=True)
    with open(os.path.join(ROOT, "deploy", "topology-csp.conf"), "w", encoding="utf-8") as f:
        f.write("# generated by build.py: the policy for /topology/ (inline scripts by hash)\n"
                "add_header Content-Security-Policy \"%s\" always;\n" % policy)


# ---- main ------------------------------------------------------------------------------------

def write(out, name, text):
    p = os.path.join(out, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "public"))
    ap.add_argument("--topology", default=os.environ.get("TOPOLOGY_DIR", os.path.join(ROOT, "..", "topology")))
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for sub in ("css", "js"):
        shutil.copytree(os.path.join(SRC, sub), os.path.join(out, sub))
    for f in ("favicon.svg", "robots.txt"):
        shutil.copy(os.path.join(SRC, f), os.path.join(out, f))
    have = stage_topology(out, args.topology)
    write(out, "index.html", page_index(have))
    write(out, "directory.html", page_directory())
    write(out, "packages.html", page_packages())
    write(out, "jslicense.html", page_jslicense())
    write(out, "404.html", page_404())
    print("build: wrote %s (topology %s)" % (out, "staged" if have else "PLACEHOLDER"))


if __name__ == "__main__":
    main()
