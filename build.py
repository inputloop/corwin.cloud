#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Build corwin.cloud into public/.

    TOPOLOGY_DIR=../topology python3 build.py [--out DIR]

Python 3.8+, standard library only. The words are in catalog.py; the page shapes, the stylesheet
and the one script are in src/. topology (public since 2026-11-01) is not carried here: the build stages it. The build
asks a local checkout of topology to stage its own www (sh bin/stage-www.sh DEST) into
<out>/topology/ and, if there is no checkout, writes a clear placeholder and says so.
"""
import argparse
import json
import base64
import hashlib
import html
import os
import re
import shutil
import subprocess
import sys
import time

import catalog as C
import demos as D
import drawings as G
import vendor as V
import share as SH
import navindex as NV

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
JS_FILES = ("ui.js", "site.js", "stage.js", "badges.js", "float.js", "nav.js", "free.js")
YEAR_LINE = "Copyright 2026 INPUTLOOP"
AUTHOR_LINE = "Corwin and Bryant (%s)" % C.MAIL
LICENCE_LINE = "Code GPL-3.0-or-later OR LGPL-3.0-or-later; prose CC-BY-SA-4.0."

e = html.escape
SHARED = {"staged": False, "markup": "", "ci": "", "taxonomy": False}   # set by main() from share.stage(): about-corwin's palette and CI strip


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

def head(title, desc, here, extra=""):
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
<script src="js/ui.js"></script>
<script src="js/site.js" defer></script>
<script src="js/badges.js" defer></script>
%s%s</head>
<body data-page="%s">
<a class="skip" href="#main">Skip to the content</a>
%s""" % (e(title), e(desc), shared_head(), extra, here, (SHARED["markup"] + "\n") if SHARED["staged"] else "")


def shared_head():
    if not SHARED["staged"]:
        return ""
    return '<link rel="stylesheet" href="css/shared.css">\n<script src="js/customize.js" defer></script>\n'


def ci_strip():
    """about-corwin's CI strip, as its own build renders it, when the checkout was there."""
    if not (SHARED["staged"] and SHARED["ci"]):
        return ""
    return '<div class="side shared-ci">%s</div>' % SHARED["ci"]


def nav(here):
    items = [("home", "Home", "index.html"), ("directory", "Directory", "directory.html"),
             ("demos", "Demos", "demo/index.html"), ("packages", "Packages", "packages.html")]
    lis = []
    for key, label, href in items:
        cur = ' aria-current="page"' if key == here else ""
        lis.append('<li><a href="%s"%s>%s</a></li>' % (href, cur, label))
    lis.append('<li><a href="%s" rel="me">About</a></li>' % C.ABOUT_URL)
    return ('<header class="top"><a class="brand" href="index.html">corwin.cloud</a>'
            '<nav aria-label="Main"><ul>%s</ul></nav></header>\n' % "".join(lis))


def everywhere():
    pages = [("Home", "index.html"), ("Directory", "directory.html"), ("Demos", "demo/index.html"),
             ("Packages", "packages.html"), ("JavaScript licences", "jslicense.html")]
    li = ['<li><a href="%s">%s</a></li>' % (h, l) for l, h in pages]
    li += ['<li><a href="index.html#tab-%s">Tab: %s</a></li>' % (x["id"], e(x["name"])) for x in C.APPS]
    li += ['<li><a href="demo/%s/">Demo: %s</a></li>' % (d["id"], e(d["name"])) for d in C.DEMOS]
    li.append('<li><a href="%s">About (aboutcorwin.com)</a></li>' % C.ABOUT_URL)
    return "".join(li)


def foot(buf):
    return """<div class="modeline" id="modeline">
  <a class="ml-link" href="#minibuffer" aria-label="corwin.cloud mode line: go to the prompt and the list of everywhere">
    <span class="ml-buf">%s</span>
    <span class="ml-pos" aria-hidden="true"></span>
    <span class="ml-sec" aria-hidden="true"></span>
    <span class="ml-modes" aria-hidden="true">go anywhere &#8595;</span>
  </a>
</div>
<footer class="minibuffer-wrap" id="minibuffer">
  <form class="minibuffer js-only-flex" id="mb-form" role="search" autocomplete="off">
    <label for="prompt" class="mb-prompt">Go to:</label>
    <input id="prompt" name="q" type="search" spellcheck="false" aria-describedby="echo" aria-controls="goto" placeholder="a page, or a project's tab">
  </form>
  <nav aria-label="Everywhere on this site"><ul class="goto" id="goto">%s</ul></nav>
  <p id="echo" class="echo" role="status">End of buffer. <span class="js-only-inline">Press Alt+x anywhere to come here.</span></p>
  <p class="colophon">%s. %s By %s. <a href="jslicense.html" rel="jslicense">JavaScript licences</a>.</p>
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
    dm = demo_of(app["repo"])
    if dm:
        links.append("<li>%s</li>" % a("demo/%s/" % dm["id"], "Demo page" if dm["runs"] != "elsewhere" else "How to run it", "demo"))
    links.append("<li>%s</li>" % a("index.html?drawing=%s#top" % app["repo"], "Its page in the drawing"))
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
            '<p class="hint">One tab per project. <span class="js-only-inline">Arrow keys move between tabs.</span></p>'
            '<div class="tablist" role="tablist" aria-label="Projects">%s</div>\n%s</section>' % ("".join(tabs), panels))


# ---- pages -----------------------------------------------------------------------------------

def topology_area(have, index, navx=None):
    """The front door is TopoForge itself, full width, opened on the shop's drawings: one page per
    project, its page tabs in the app's overview box. js/stage.js picks the address: the shop's drawings on a
    first visit (TopoForge's own ?load=), the person's working copy when TopoForge has kept one."""
    if not have:
        return ('<section class="stage placeholder" id="top" aria-labelledby="stage-h"><h1 id="stage-h">topology</h1>'
                '<p class="lede">topology is drawn here when this site is built with a checkout of it. This build had none, so this is a placeholder.</p>'
                '<p>topology is public (branch corwin) on the inputloop GitHub. See <a href="#tab-topology">its tab</a> for what it is.</p></section>')
    pages = {pid: index["pages"][v["page"]]["name"] for pid, v in index["projects"].items()}
    if index.get("gitcha_bryant"):
        pages["gitcha-bryant"] = index["pages"][index["gitcha_bryant"]["page"]]["name"]
    for pid, v in index.get("processes", {}).items():
        pages["process-" + pid] = v["name"]
    if navx:
        pages.update(navx["keys"])
    first = "topology/topoforge/index.html?load=/" + index["file"]
    # the app's own switches (topology forge 1.8, spec/EMBED-v1.md), one set per page layout (docs/NAV.md,
    # revision 4): free asks for bare (every bar and panel hidden) and the messages; classic for the
    # messages only, so the app keeps its own chrome. js/stage.js appends the set for the layout in force.
    # "Full size" (the legend) opens the app on its own, with none of them.
    frame = ('<iframe id="topology" class="topology" title="topology forge (formerly TopoForge), opened on the shop\'s drawings" data-first="%s" '
             'data-resume="%s" data-embed-free="%s" data-embed-classic="%s" data-doc="%s" data-pages="%s"></iframe>'
             % (e(first + "&embed=", quote=True), e("topology/topoforge/index.html?embed=", quote=True),
                TF_EMBED_FREE, TF_EMBED_CLASSIC, e(G.DOC_NAME, quote=True), e(json.dumps(pages), quote=True)))
    body = '<div class="stage-grid" id="stage-grid">%s<div class="stage-drawing">%s</div>%s</div>' % (
        NV.render(navx) if navx else "", frame, legend(index, first))
    return ('<section class="stage" id="top" aria-labelledby="stage-h">'
            '<h1 id="stage-h" class="stage-h">The shop, drawn</h1>'
            + body.replace("%", "%%") +
            '<noscript><p class="stage-off">The drawing app needs JavaScript. Without it: <a href="directory.html">the directory</a>, '
            '<a href="#projects">the projects in words</a> below, and <a href="%s" download>the drawings as a file</a>.</p></noscript>'
            + processes_note(index) +
            '</section>') % (e(index["file"], quote=True),)


# TopoForge's maker, his public page (about-corwin: content/involvements/inputloop.txt and
# content/personae/bryant.txt), and its licence as TopoForge's own README.org ("Licences") states it.
BRYANT_URL = "https://github.com/takushieternal"
TF_NAME = "topology forge (formerly TopoForge)"   # the app's name since 2026-11-01 (Corwin); Bryant made it
TF_EMBED_FREE = "bare,select,ready"
TF_EMBED_CLASSIC = "select,ready"
TF_SRC_APP = C.ORG + "/topology/tree/corwin/www/topoforge"
TF_SRC_PROJECT = C.ORG + "/topology/tree/corwin/topoforge"


def site_revision():
    """The site's revision and the day it was built, for the legend's sheet cell."""
    try:
        r = subprocess.run(["git", "describe", "--always", "--dirty"], cwd=ROOT, capture_output=True, text=True, timeout=10)
        rev = r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else "unknown"
    except (OSError, subprocess.SubprocessError):
        rev = "unknown"
    return rev, time.strftime("%Y-%m-%d", time.gmtime())


def legend(index, first):
    """The legend under the drawing (docs/NAV.md, revision 5): one line of hairline compartments, in the
    manner of an architect's title block, with no sentences and no machine-formatted licence strings
    (Corwin, 2026-11-02: "GPLv3+ would fit into a small hair-line separated compartment"). The whole
    words follow it (credits): shown with scripts off; with scripts, the free frame's Help, Credits and
    licence shows them, and classic unfolds them under the line."""
    rev, day = site_revision()
    gh = '<a href="%s">Bryant Frankford</a>' % BRYANT_URL
    lic_words = ("GNU General Public License, version 3 or any later version, or GNU Lesser General Public License, "
                 "version 3 or any later version, as you choose")
    # a title block (docs/NAV.md, revision 6): each compartment a field name (Subtler) and its value (Subtle)
    def comp(cls, k, v):
        return '<span class="lg-c %s"><span class="lg-k">%s</span><span class="lg-v">%s</span></span>' % (cls, k, v)
    comps = [
        comp("lg-c-app", "app", "topology forge"),
        comp("lg-c-by", "by", gh),
        comp("lg-c-lic", "licence", '<abbr title="%s">GPLv3+ or LGPLv3+</abbr>' % lic_words),
        comp("lg-c-prose", "prose", '<abbr title="Creative Commons Attribution-ShareAlike 4.0 International">CC BY-SA 4.0</abbr>'),
        comp("lg-c-src", "source", '<a href="%s">topology</a>' % TF_SRC_PROJECT),
        comp("lg-c-rev", "rev", '<code>%s</code>' % e(rev)),
        comp("lg-c-date", "date", day),
    ]
    line = ('<p class="lg-line">%s<button type="button" class="lg-c lg-more js-only-inline" aria-expanded="false" aria-controls="lg-grid">credits</button></p>'
            % "".join(comps))
    cells = [
        ("lg-app", "Drawing app", TF_NAME + ', made by %s for Corwin Brust, with Corwin and contributors. Bryant is listed first on it.' % gh),
        ("lg-lic", "Its licence", 'Its code may be used under the <a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU General Public License, version 3</a> '
         'or any later version, or the <a href="https://www.gnu.org/licenses/lgpl-3.0.html">GNU Lesser General Public License, version 3</a> '
         'or any later version, as you choose. Its prose is under <a href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons '
         'Attribution-ShareAlike 4.0 International</a>. As its README.org says. There is no warranty, to the extent the law allows.'),
        ("lg-src", "Its source", 'topology, branch corwin: <a href="%s">www/topoforge/</a>, the app served here; '
         '<a href="%s">topoforge/</a>, its README, AUTHORS and licences.' % (TF_SRC_APP, TF_SRC_PROJECT)),
        ("lg-you", "Your drawing", '<span class="lg-keep">Stays in this browser until you save it (File, Export). </span>'
         '<a href="%s" id="stage-full">The app full size</a> · <a href="%s" download id="stage-file">the shop\'s drawings as a file</a> · '
         '<a href="topology/" id="stage-door">topology\'s own front door</a> · '
         '<button type="button" class="js-only-inline linkish" id="stage-fresh">Start again from the shop\'s drawings</button>'
         % (e(first, quote=True), e(index["file"], quote=True))),
        ("lg-sheet", "Sheet", 'The shop, drawn: a page per project. corwin.cloud revision <code>%s</code>, built %s. '
         'Lettered in osifont, an ISO 3098 face by Zefram Cochrane and contributors (GNU General Public License, version 3, with the font exception), '
         'and IBM Plex Sans Condensed by IBM (SIL Open Font License 1.1), both served from this site.' % (e(rev), day)),
    ]
    grid = "".join('<div class="lg-cell %s"><dt>%s</dt><dd>%s</dd></div>' % (c, e(h), d) for c, h, d in cells)
    # the notice says why the shop's drawings are not showing (js/stage.js fills it); it heads the legend
    notice = ('<p class="stage-notice" id="stage-notice" hidden><span id="stage-notice-t"></span> '
              '<button type="button" class="linkish" id="stage-notice-b">Open the shop\'s drawings</button></p>')
    return ('<aside class="legend" id="legend" aria-labelledby="legend-h"><h2 id="legend-h" class="lg-h">Legend</h2>%s%s'
            '<dl class="lg-grid" id="lg-grid">%s</dl><p class="lg-msg" id="stage-msg" role="status"></p></aside>' % (notice, line, grid))


def processes_note(index):
    """The processes, each a page in the drawing (BPMN) and a file in each notation offered: the
    person picks the notation; the drawing's data says how each element reads in every one."""
    procs = index.get("processes") or {}
    if not procs:
        return ""
    names = {"bpmn": "BPMN", "bpmnplus": "BPMN+", "flowchart": "flowchart"}
    items = []
    for pid, v in procs.items():
        files = " · ".join(a(f, names.get(n, n), "") .replace("<a ", '<a download ', 1) for n, f in v["files"].items())
        items.append('<li>%s: %s; as a file (File, Open): %s</li>'
                     % (e(v["name"].replace("Process: ", "")), a("index.html?drawing=process-%s#top" % pid, "its page in the drawing (BPMN)"), files))
    return ('<div class="processes"><h2 class="stage-note proc-h">Processes</h2><ul class="stage-note">%s</ul></div>' % "".join(items))


NAV_SCRIPTS = '<script src="js/taxonomy.js" defer></script>\n'


def page_index(have, index, navx=None):
    return (head("corwin.cloud: the shop, drawn",
                 "topology forge (formerly TopoForge), opened on a drawing of everything inputloop makes: one page per project, with live demos beside it.", "home",
                 '<script src="js/stage.js" defer></script>\n<script src="js/float.js" defer></script>\n'
                 + ((NAV_SCRIPTS if SHARED.get("taxonomy") else "") + '<script src="js/nav.js" defer></script>\n<script src="js/free.js" defer></script>\n' if navx else ""))
            + nav("home") + '<main id="main">\n' + topology_area(have, index, navx) + ('<div class="wrap shared-wrap">%s</div>' % ci_strip() if ci_strip() else "") + render_tabs() + "</main>\n" + foot("corwin.cloud"))


def demo_of(repo_id):
    return next((d for d in C.DEMOS if d["repo"] == repo_id), None)


def card(r):
    t = []
    if r.get("tab"):
        t.append(a("index.html#tab-" + next(x for x in C.APPS if x["id"] == r["tab"])["id"], "Design tab", "act primary"))
    if r.get("home"):
        t.append(a(r["home"], "Home", "act"))
    if r["public"]:
        t.append(a(r["url"], "Repository", "act"))
    else:
        t.append('<span class="act off">Repository: not public yet</span>')
    t.append(a("index.html?drawing=%s#top" % r["id"], "Drawing", "act"))
    dm = demo_of(r["id"])
    if dm:
        t.append(a("demo/%s/" % dm["id"], "Demo" if dm["runs"] != "elsewhere" else "How to run it", "act"))
    ch = ""
    if r.get("channel"):
        ch = ('<p class="channel" data-channel="%s" hidden>Release channel %s: <span class="ch-words"></span></p>'
              % (e(r["channel"], quote=True), e(r["channel"])))
    return ('<li data-kind="%s"><article class="card" aria-labelledby="c-%s"><h3 id="c-%s">%s</h3>'
            '<p class="kind">%s · %s</p><p>%s</p><p class="credit">Made by: %s</p>%s<p class="acts">%s</p></article></li>'
            % (r["kind"], re.sub(r"\W", "-", r["id"]), re.sub(r"\W", "-", r["id"]), e(r["name"]),
               dict(C.KINDS)[r["kind"]], "public" if r["public"] else "not public yet", e(r["one"]), e(r["credit"]),
               ch, "".join(t)))


def page_directory():
    radios = ['<input type="radio" name="kind" id="f-all" class="f" checked><label for="f-all">All (%d)</label>' % len(C.REPOS)]
    for k, label in C.KINDS:
        n = sum(1 for r in C.REPOS if r["kind"] == k)
        radios.append('<input type="radio" name="kind" id="f-%s" class="f"><label for="f-%s">%s (%d)</label>' % (k, k, e(label), n))
    pub = sum(1 for r in C.REPOS if r["public"])
    return (head("Directory: everything inputloop makes", "Every repository we can name, what it does, and where to find its design, its code and its demo.", "directory")
            + nav("directory") + """<main id="main" class="wrap">
<h1>Directory</h1>
<p class="lede">Every repository we can name: %d of them, %d public. Each card opens its page in the drawing on the home page, its code if the code is public, its demo or how to run it, and its design tab where it has one. Private repositories are named so you can see what exists; they have no link.</p>
<fieldset class="filter"><legend>Show only</legend>%s
<ul class="grid">%s</ul></fieldset>
<p class="hint">Counted from this site's catalog, 2026-11-01.</p>
%s
</main>
""" % (len(C.REPOS), pub, "".join(radios), "".join(card(r) for r in C.REPOS), ci_strip()) + foot("directory"))


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


LIC_LINKS = {"GPL-3.0-or-later": ("GNU-GPL-3.0-or-later", "https://www.gnu.org/licenses/gpl-3.0.html"),
             "AGPL-3.0-or-later": ("GNU-AGPL-3.0-or-later", "https://www.gnu.org/licenses/agpl-3.0.html"),
             V.EXPAT[0]: V.EXPAT[:2], V.BSD3[0]: V.BSD3[:2]}
SOURCE_LABELS = {C.P5_SOURCE: "p5.js 1.9.0"}


def page_jslicense(staged):
    lab = '<a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU-GPL-3.0-or-later</a>'
    rows = []
    for f in JS_FILES + (("customize.js",) if SHARED["staged"] else ()) + (("taxonomy.js",) if SHARED.get("taxonomy") else ()):
        rows.append('<tr><td><a href="js/%s">%s</a></td><td>%s</td><td><a href="js/%s">%s</a></td></tr>' % (f, f, lab, f, f))
    for did, res in sorted(staged.items()):
        for path, lic, source in res.get("scripts", []):
            url = "demo/%s/app/%s" % (did, path)
            local = source and not re.match(r"^https?:", source)
            src = ("demo/%s/app/%s" % (did, source)) if local else source
            if lic in LIC_LINKS:
                lic_cell = a(LIC_LINKS[lic][1], LIC_LINKS[lic][0])
            else:
                lic_cell = e(lic)
            if source:
                lic_cell += " (minified; its full source: %s)" % a(src, "the unminified file, served here" if local else SOURCE_LABELS.get(source, "upstream"))
            rows.append('<tr><td><a href="%s">%s</a></td><td>%s</td><td><a href="%s">%s</a></td></tr>'
                        % (url, e(url), lic_cell, url if not source else src, "this file" if not source else ("unminified source" if local else "upstream source")))
    return (head("JavaScript licence information", "The licence of every script on this site, in the form GNU LibreJS reads.", "jslicense")
            + nav("") + """<main id="main" class="wrap">
<h1>JavaScript licence information</h1>
<p>Every script on corwin.cloud is free software and is served from this site. This table is in the form <a href="https://www.gnu.org/software/librejs/">GNU LibreJS</a> reads, and lists the demos' scripts too. This site's own scripts are not minified. Two demos carry libraries minified: Quantum 3D5 carries p5.js as its repository ships it (for speed), and NextTime's demo runs with pinned copies of Vue, Vue Router and MapLibre from the npm registry; each such row links the full source, which for the pinned libraries is served from this site too. The pages work with scripts off, except the drawing app and the demos, which are programs.</p>
<table id="jslicense-labels1"><thead><tr><th scope="col">Script</th><th scope="col">Licence</th><th scope="col">Source</th></tr></thead><tbody>%s</tbody></table>
<p>topology, staged under /topology/ from its own checkout, carries its own scripts and its own licence notices. customize.js (the Customize control) and taxonomy.js (the word matching of the navigator beside the drawing) are about-corwin's, staged from its checkout when this site was built, unchanged.</p>
</main>
""" % "".join(rows) + foot("jslicense"))


# ---- demos -----------------------------------------------------------------------------------

def rebase(text, root):
    """Make a page written for the site's top folder work from a sub-folder: prefix every relative
    href and src (not #, not /, not a scheme) with root."""
    return re.sub(r'(\b(?:href|src)=")(?![#/]|\./|[a-z]+:)', r"\1" + root, text)


def vendor_table(d):
    """The libraries a demo runs with, pinned: version, licence, where they come from, their sha256."""
    rows = []
    for name in d["vendor"]:
        p = V.by_name(name)
        lic = [f for f in p["files"] if f.startswith("LICENSE")][0]
        files = " · ".join(a("./app/%s/%s" % (V.folder(p), f), e(f)) for f in p["files"] if f.endswith((".js", ".css")))
        rows.append('<tr><th scope="row">%s %s</th><td>%s (%s)</td><td>%s</td><td>%s; <code>%s</code></td><td><code class="hash">%s</code></td><td>%s</td></tr>'
                    % (e(p["name"]), e(p["version"]), a("./app/%s/%s" % (V.folder(p), lic), e(p["spdx"])), e(p["by"]), a(p["home"], "its source"),
                      e(V.REGISTRY.replace("https://", "")), e(os.path.basename(V.tarball_url(p))), e(p["sha256"]), files))
    return ('<div class="table-scroll"><table class="pairs vendor"><caption>The libraries this demo runs with, served from this site: each is the npm registry\'s tarball at the version named, '
            'checked against the sha256 below when the site was built. Minified files sit beside their unminified twins.</caption>'
            '<thead><tr><th scope="col">Library</th><th scope="col">Licence</th><th scope="col">Source</th><th scope="col">From</th>'
            '<th scope="col">sha256 of the tarball</th><th scope="col">Files</th></tr></thead><tbody>%s</tbody></table></div>' % "".join(rows))


def demo_page(d, res, idir):
    staged = bool(res and res.get("staged"))
    acts, extra, body = [], "", []
    if d["runs"] == "here" and staged and not d.get("derived"):
        acts.append(a("./app/index.html", "Start the demo", "act primary"))
        body.append("<p>It opens as a page of its own, from this site, in your browser. This site loads nothing from other hosts, so neither does the demo.</p>")
    elif d["runs"] == "here" and not staged:
        body.append('<p class="private">This build had no checkout of its repository, so the demo is not here today: %s.</p>' % e(res["why"] if res else "not staged"))
    elif d["runs"] == "drawing":
        target = "gitcha-bryant" if d["id"] == "gitcha" else d["repo"]
        label = "Open Bryant's drawing of how it works" if d["id"] == "gitcha" else "Open it: the home page"
        acts.append(a("index.html?drawing=%s#top" % target, label, "act primary"))
    if d.get("why"):
        body.append("<p><strong>Why it is not hosted here:</strong> %s</p>" % e(d["why"]))
    if staged:
        body.extend("<p>%s</p>" % e(n) for n in d.get("notes", []))
    if d.get("vendor") and staged:
        body.append(vendor_table(d))
    if d.get("derived") == "egad" and staged:
        extra = '<link rel="stylesheet" href="./app/egad-pairs.css">\n'
        floors = {"text": 7.0, "text-aa": 4.5, "ui": 3.0}
        rows = []
        for theme, fgn, bgn, fg, bg, ratio, floor, why in res["pairs"]:
            ok = ratio >= floors.get(floor, 0)
            rows.append('<tr><td>%s</td><td><span class="swatch bg-%s fg-%s">Aa %s on %s</span></td><td>%s</td><td>%.2f:1</td><td>%s (%g:1): %s</td></tr>'
                        % (e(theme), bg[1:], fg[1:], e(fgn), e(bgn), e(why), ratio, e(floor), floors.get(floor, 0), "met" if ok else "<strong>not met</strong>"))
        body.append('<table class="pairs"><caption>Every pair egad promises, measured by this site\'s build (WCAG 2.1 contrast; floors: text 7:1, text-aa 4.5:1, ui 3:1)</caption>'
                    '<thead><tr><th scope="col">Theme</th><th scope="col">Sample</th><th scope="col">Used for</th><th scope="col">Contrast</th><th scope="col">Floor</th></tr></thead><tbody>%s</tbody></table>' % "".join(rows))
    shots = []
    for rel, cap in d.get("shots", []):
        src = os.path.join(idir or "", d["repo"], rel)
        if os.path.isfile(src):
            shots.append((os.path.basename(rel), cap))
    if shots:
        body.append('<div class="shots">%s</div>' % "".join(
            '<figure><a href="./shots/%s"><img src="./shots/%s" alt="%s" loading="lazy" width="1200" height="760"></a><figcaption>%s</figcaption></figure>'
            % (n, n, e(c), e(c)) for n, c in shots))
    src_line = ""
    if res and res.get("commit"):
        src_line = '<div><dt>Staged from</dt><dd>%s at commit %s, when this site was built.</dd></div>' % (e(d["repo"]), e(res["commit"]))
    links = "".join("<li>%s</li>" % a(u, e(l)) for l, u in d.get("links", []))
    html_ = (head("%s: demo" % d["name"], d["what"], "demos", extra) + nav("demos") + """<main id="main" class="wrap">
<p class="crumbs"><a href="demo/index.html">Demos</a></p>
<h1>%s</h1>
<p class="lede">%s</p>
<p class="acts">%s</p>
%s
<dl class="facts">
  <div><dt>Made by</dt><dd>%s</dd></div>
  <div><dt>Licence</dt><dd>%s</dd></div>
  <div><dt>Run it yourself</dt><dd>%s</dd></div>
  %s
</dl>
<ul class="links" aria-label="Links">%s<li><a href="index.html?drawing=%s#top">Its page in the drawing</a></li></ul>
</main>
""" % (e(d["name"]), e(d["what"]), "".join(acts), "\n".join(body), e(d["credit"]), e(d["licence"]), e(d["run"]),
       src_line, links, e(d["repo"])) + foot("demo/" + d["id"]))
    return rebase(html_, "../../")


def page_demos(staged):
    items = []
    words = {"here": "runs here", "drawing": "a drawing you can open", "elsewhere": "runs elsewhere: what it needs"}
    for d in C.DEMOS:
        res = staged.get(d["id"])
        state = words[d["runs"]] if d["runs"] != "here" or (res and res.get("staged")) else "not in this build"
        items.append('<li><article class="card" aria-labelledby="d-%s"><h2 id="d-%s"><a href="demo/%s/">%s</a></h2>'
                     '<p class="kind">%s</p><p>%s</p><p class="credit">Made by: %s</p></article></li>'
                     % (G.slug(d["id"]), G.slug(d["id"]), d["id"], e(d["name"]), e(state), e(d["what"]), e(d["credit"])))
    html_ = (head("Demos: try what inputloop makes", "Every inputloop app that runs in a browser, running here; for the rest, what it needs and how to run it.", "demos")
             + nav("demos") + """<main id="main" class="wrap">
<h1>Demos</h1>
<p class="lede">What runs in a browser runs here, from this site, staged from its public repository when the site was built. For the rest, a page says what it needs and how to run it yourself. Nothing here asks you for an account or sends anything anywhere.</p>
<ul class="grid">%s</ul>
</main>
""" % "".join(items) + foot("demos"))
    return rebase(html_, "../")


def stage_shots(out, idir):
    for d in C.DEMOS:
        for rel, _ in d.get("shots", []):
            src = os.path.join(idir or "", d["repo"], rel)
            if os.path.isfile(src):
                dst = os.path.join(out, "demo", d["id"], "shots", os.path.basename(rel))
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copyfile(src, dst)


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


DEMO_POLICY = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
               "font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; "
               "form-action 'none'; frame-ancestors 'self'")


def write_demo_csp(staged=None):
    """The policy for /demo/*/app/: scripts only from this site (the build moved every inline script
    into a file), styles inline allowed (the apps set style attributes from their scripts, as
    topology's pages do). Written to generated/demo-csp.conf for whoever keeps deploy/ to include.
    A demo whose catalog entry gives an eval_reason gets its own location, for its app folder alone,
    whose script-src adds 'unsafe-eval' and nothing else; the reason is written beside it."""
    os.makedirs(os.path.join(ROOT, "generated"), exist_ok=True)
    out = ["# generated by build.py: the policy for /demo/*/app/ (no inline script; every script is a file here)",
           "add_header Content-Security-Policy \"%s\" always;" % DEMO_POLICY]
    for d in C.DEMOS:
        if d.get("eval_reason") and (staged or {}).get(d["id"], {}).get("staged"):
            pol = DEMO_POLICY.replace("script-src 'self';", "script-src 'self' 'unsafe-eval';")
            out += ["# %s: %s; 'unsafe-eval' for this folder only" % (d["id"], d["eval_reason"]),
                    "location ^~ /demo/%s/app/ {" % d["id"],
                    "    add_header Content-Security-Policy \"%s\" always;" % pol,
                    "    add_header X-Content-Type-Options \"nosniff\" always;",
                    "    add_header Referrer-Policy \"no-referrer\" always;",
                    "    try_files $uri $uri/ =404;",
                    "}"]
            print("build: WARN demo %s gets 'unsafe-eval' in its own folder's policy: %s" % (d["id"], d["eval_reason"]), file=sys.stderr)
    with open(os.path.join(ROOT, "generated", "demo-csp.conf"), "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


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
    ap.add_argument("--inputloop", default=os.environ.get("INPUTLOOP_DIR", os.path.join(ROOT, "..", "inputloop")),
                    help="a folder of checkouts of public inputloop repositories, for the demos and Bryant's drawing")
    ap.add_argument("--about", default=os.environ.get("ABOUT_DIR", os.path.join(ROOT, "..", "about-corwin")),
                    help="a checkout of about-corwin, for its Customize palette and CI strip")
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for sub in ("css", "js", "fonts"):
        shutil.copytree(os.path.join(SRC, sub), os.path.join(out, sub))
    for f in ("favicon.svg", "robots.txt"):
        shutil.copy(os.path.join(SRC, f), os.path.join(out, f))
    have = stage_topology(out, args.topology)
    SHARED.update(SH.stage(out, args.about))
    if not SHARED["staged"]:
        print("build: about-corwin's Customize palette and CI strip are left out: %s" % SHARED["why"], file=sys.stderr)
    index = G.make(out, args.topology, args.inputloop)
    navx = NV.make(out, args.topology, index) if have else None
    staged = D.stage_all(out, args.inputloop)
    stage_shots(out, args.inputloop)
    for did, res in staged.items():
        if not res["staged"]:
            print("build: demo %s not staged: %s" % (did, res["why"]), file=sys.stderr)
        if any(src for _, _, src in res.get("scripts", [])):
            print("build: WARN demo %s serves a minified script (its full source is linked in jslicense.html)" % did, file=sys.stderr)
    write_demo_csp(staged)
    write(out, "index.html", page_index(have, index, navx))
    write(out, "demo/index.html", page_demos(staged))
    for d in C.DEMOS:
        write(out, "demo/%s/index.html" % d["id"], demo_page(d, staged.get(d["id"]), args.inputloop))
    write(out, "directory.html", page_directory())
    write(out, "packages.html", page_packages())
    write(out, "jslicense.html", page_jslicense(staged))
    write(out, "404.html", page_404())
    print("build: wrote %s (topology %s; about-corwin's palette %s; %d drawing pages; demos staged: %s)" % (
        out, "staged" if have else "PLACEHOLDER", "staged" if SHARED["staged"] else "left out", len(index["pages"]), ", ".join(k for k, v in staged.items() if v["staged"]) or "none"))


if __name__ == "__main__":
    main()
