#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later
"""Checks on the built site (SITE_OUT, default public/). Standard library only.

The key guard is the external-link allow-list: this repository is public, so a link to a private
repository anywhere in the output must fail the build.
"""
import hashlib
import html
import json
import os
import re
import sys
import unittest
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import catalog  # noqa: E402

OUT = os.environ.get("SITE_OUT", os.path.join(ROOT, "public"))
PAGES = ["index.html", "directory.html", "packages.html", "jslicense.html", "privacy.html", "404.html", "demo/index.html"] + \
    ["demo/%s/index.html" % d["id"] for d in catalog.DEMOS]
# Written in pieces so that this file does not itself contain what it forbids.
FORBIDDEN = re.compile(r"F" r":\\|/ho" r"me/|clau" r"de\.ai|anthro" r"pic\.com|Co-Auth" r"ored")
PRIVATE_URL = re.compile(r"github\.com/[\w.-]+/(%s)\b" % "|".join(re.escape(n) for n in catalog.PRIVATE_NAMES))


def read(rel):
    with open(os.path.join(OUT, rel), encoding="utf-8") as f:
        return f.read()


def _slurp(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []   # (tag, attrs dict)
        self.ids = set()
        self.text = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.tags.append((tag, d))
        if "id" in d:
            self.ids.add(d["id"])

    def handle_data(self, data):
        self.text.append(data)


def parse(rel):
    p = Page()
    p.feed(read(rel))
    return p


def refs(p):
    """Every address a page uses: (tag, attribute, value)."""
    out = []
    for tag, d in p.tags:
        for attr in ("href", "src", "action"):
            if attr in d:
                out.append((tag, attr, d[attr]))
    return out


class SiteChecks(unittest.TestCase):
    def test_pages_exist_and_have_the_basics(self):
        for rel in PAGES:
            p = parse(rel)
            names = [t for t, _ in p.tags]
            self.assertIn("main", names, rel + " has no main landmark")
            self.assertEqual(names.count("h1"), 1 if rel != "index.html" else names.count("h1"), rel)
            html = [d for t, d in p.tags if t == "html"][0]
            self.assertTrue(html.get("lang"), rel + " has no lang")
            self.assertIn("title", names, rel)
        self.assertTrue(os.path.exists(os.path.join(OUT, "favicon.svg")))
        self.assertIn("Allow", read("robots.txt"))

    def test_every_internal_link_resolves(self):
        for rel in PAGES:
            here = os.path.dirname(rel)
            for tag, attr, v in refs(parse(rel)):
                if re.match(r"^(https?:|mailto:|data:)", v):
                    continue
                path, _, frag = v.partition("#")
                path = path.partition("?")[0]
                if not path:
                    target = rel
                elif path.startswith("/"):
                    target = path.lstrip("/")
                else:
                    target = os.path.normpath(os.path.join(here, path))
                if target.endswith("/") or os.path.isdir(os.path.join(OUT, target)) or target in ("", "."):
                    target = os.path.join(target, "index.html")
                full = os.path.join(OUT, target)
                self.assertTrue(os.path.isfile(full), "%s: %s -> %s does not exist" % (rel, v, target))
                if frag and target.endswith(".html"):
                    self.assertIn(frag, parse(target).ids, "%s: %s has no #%s" % (rel, v, frag))

    def test_pubs_is_in_the_directory_and_on_the_allow_list(self):
        self.assertIn("https://github.com/inputloop/pubs", catalog.PUBLIC_URLS)
        with open(os.path.join(OUT, "directory.html"), encoding="utf-8") as f:
            page = f.read()
        self.assertIn('href="https://github.com/inputloop/pubs"', page)
        self.assertIn("The reading room", page)

    def test_obsmage_is_public_and_linked(self):
        # Corwin made both public on 2026-11-02 (17:44); GitHub is their only address (no code.bru.st remote)
        for name in ("obsmage", "obsmage-corwin"):
            url = "https://github.com/inputloop/" + name
            self.assertIn(url, catalog.PUBLIC_URLS)
            self.assertNotIn(name, catalog.PRIVATE_NAMES)
            self.assertIn('href="%s"' % url, read("directory.html"), "the directory does not link " + name)
        page = read("index.html")
        start = page.index('id="panel-obsmage"')
        panel = page[start:page.index("</section>", start)]
        self.assertIn('href="https://github.com/inputloop/obsmage"', panel, "the obsmage tab does not link its repository")
        self.assertNotIn("not public yet", panel, "the obsmage tab still says it is not public")
        # its home, once it answered 200 over https: on the allow-list, first on the tab and on its card
        self.assertIn("https://obsmage.com/", catalog.PUBLIC_URLS)
        self.assertLess(panel.index('href="https://obsmage.com/"'), panel.index('href="https://github.com/inputloop/obsmage"'), "obsmage.com is not the obsmage tab's first link")
        d = read("directory.html")
        c = d[d.index('id="c-obsmage"'):]
        c = c[:c.index("</article>")]
        self.assertIn('href="https://obsmage.com/"', c, "the obsmage card does not link its home")

    def test_external_links_are_only_public_ones(self):
        allowed = set(catalog.PUBLIC_URLS)
        for rel in PAGES:
            for tag, attr, v in refs(parse(rel)):
                if re.match(r"^(https?:|mailto:)", v):
                    if any(re.match(pat, v) for pat in getattr(catalog, "PUBLIC_URL_PATTERNS", [])):
                        continue
                    self.assertIn(v, allowed, "%s links %s, which is not on the public allow-list" % (rel, v))
        # and no private repository's address appears anywhere in the output, topology's files included
        for dp, _, fs in os.walk(OUT):
            for f in fs:
                try:
                    with open(os.path.join(dp, f), encoding="utf-8") as fh:
                        t = fh.read()
                except (UnicodeDecodeError, OSError):
                    continue
                m = PRIVATE_URL.search(t)
                self.assertIsNone(m, "%s names a private repository address: %s" % (os.path.join(dp, f), m and m.group(0)))

    def test_private_cards_have_no_repository_link(self):
        d = read("directory.html")
        for r in catalog.REPOS:
            if not r["public"]:
                self.assertNotIn("inputloop/" + r["name"], d)
        self.assertGreaterEqual(d.count("not public yet"), len([r for r in catalog.REPOS if not r["public"]]))

    def test_every_tab_is_reachable_from_a_directory_card(self):
        # the cards only: the footer's list of everywhere also links every tab
        d = read("directory.html")
        start = d.index('<ul class="grid">')
        d = d[start:d.index('</fieldset>', start)]
        for app in catalog.APPS:
            self.assertIn('href="index.html#tab-%s"' % app["id"], d, "no directory card reaches tab %s" % app["id"])

    def test_directory_covers_every_repo_and_filters_every_kind(self):
        d = read("directory.html")
        for r in catalog.REPOS:
            self.assertIn(">%s</h3>" % r["name"], d)
        css = read("css/site.css")
        for k, _ in catalog.KINDS:
            self.assertIn("#f-%s:checked" % k, css)
            self.assertIn('id="f-%s"' % k, d)

    def test_aria_tab_pattern(self):
        p = parse("index.html")
        lists = [d for t, d in p.tags if d.get("role") == "tablist"]
        self.assertEqual(len(lists), 1, "need exactly one tablist")
        self.assertTrue(lists[0].get("aria-label"))
        tabs = [d for t, d in p.tags if d.get("role") == "tab"]
        panels = {d["id"]: d for t, d in p.tags if d.get("role") == "tabpanel"}
        self.assertEqual(len(tabs), len(catalog.APPS))
        self.assertEqual(len(panels), len(tabs))
        self.assertEqual(sum(1 for t in tabs if t.get("aria-selected") == "true"), 1)
        for t in tabs:
            self.assertTrue(t["id"].startswith("tab-"))
            panel = panels.get(t.get("aria-controls"))
            self.assertIsNotNone(panel, t["id"] + " controls nothing")
            self.assertEqual(panel.get("aria-labelledby"), t["id"])

    def test_diagrams_are_inline_svg_with_names(self):
        p = parse("index.html")
        svgs = [d for t, d in p.tags if t == "svg"]
        self.assertGreaterEqual(len(svgs), len(catalog.APPS) + len(catalog.OBS_WORKFLOWS) + 1)
        for d in svgs:
            self.assertEqual(d.get("role"), "img")
            self.assertTrue(d.get("aria-labelledby"))
        self.assertNotIn("<img", read("index.html"))

    def test_obsmage_tab_shows_workflows_and_scenes(self):
        h = read("index.html")
        for w in catalog.OBS_WORKFLOWS:
            self.assertIn(">%s</h4>" % w["title"], h)
        self.assertIn(">Scenes</h3>", h)
        self.assertIn(">Workflows</h3>", h)
        self.assertNotRegex(h, r"DISPLAY#|\\\\\?\\\\")  # no real device ids

    def test_no_inline_script_or_style(self):
        for rel in PAGES:
            p = parse(rel)
            for tag, d in p.tags:
                self.assertNotEqual(tag, "style", rel + " has a style element")
                self.assertNotIn("style", d, rel + " has a style attribute")
                self.assertFalse([k for k in d if k.startswith("on")], rel + " has an inline handler")
                if tag == "script":
                    self.assertIn("src", d, rel + " has an inline script")
                    self.assertFalse(re.match(r"^(https?:)?//", d["src"]), rel + " loads a script from another host")
                if tag == "link":
                    self.assertFalse(d.get("href", "").startswith("http"), rel + " loads a stylesheet from another host")
            self.assertNotRegex(read(rel), r"<script(?![^>]*\bsrc=)")

    def test_librejs_labels_and_table(self):
        js = [f for f in os.listdir(os.path.join(OUT, "js"))]
        self.assertTrue(js)
        table = read("jslicense.html")
        self.assertIn('id="jslicense-labels1"', table)
        for f in js:
            t = read("js/" + f)
            self.assertIn("@license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later", t.splitlines()[0], f + " lacks its first-line label")
            self.assertIn("// @license-end", t, f)
            rows = table[table.index('id="jslicense-labels1"'):]   # the table itself, not the page's own script tags
            self.assertIn('href="js/%s"' % f, rows, f + " is not in jslicense.html")
        for rel in ["index.html", "directory.html", "packages.html"]:
            self.assertIn('rel="jslicense"', read(rel))
        # the demos: every script file in a staged app has a row, and every staged page points at the table
        for d in catalog.DEMOS:
            app = os.path.join(OUT, "demo", d["id"], "app")
            for dp, _, fs in os.walk(app):
                for f in fs:
                    p = os.path.relpath(os.path.join(dp, f), OUT).replace(os.sep, "/")
                    if f.endswith(".js"):
                        self.assertIn('href="%s"' % p, table, p + " is not in jslicense.html")
                    if f.endswith(".html"):
                        t = read(p)
                        self.assertIn('rel="jslicense"', t, p)
                        self.assertNotRegex(t, r"<script(?![^>]*\bsrc=)", p + " has an inline script")

    def test_no_forbidden_strings_anywhere_in_output(self):
        for dp, _, fs in os.walk(OUT):
            if "/app/vendor/" in dp.replace(os.sep, "/") + "/":
                continue   # pinned libraries, byte for byte the npm tarball's (test_nexttime_runs_here_on_pinned_libraries)
            for f in fs:
                try:
                    with open(os.path.join(dp, f), encoding="utf-8") as fh:
                        t = fh.read()
                except (UnicodeDecodeError, OSError):
                    continue
                m = FORBIDDEN.search(t)
                self.assertIsNone(m, "%s contains %r" % (os.path.join(dp, f), m and m.group(0)))

    def test_footer_licence_line_and_modeline(self):
        for rel in ["index.html", "directory.html", "packages.html"]:
            h = read(rel)
            self.assertIn("Copyright 2026 INPUTLOOP", h)
            self.assertIn("Code GPL-3.0-or-later; prose CC-BY-SA-4.0.", h)
            self.assertIn("Corwin and Bryant (BryantAndCorwin@inputloop.com)", h)
            self.assertIn('class="modeline"', h)

    def test_nav_has_about_and_pages(self):
        h = read("index.html")
        for needle in ('href="index.html"', 'href="directory.html"', 'href="packages.html"', 'href="https://aboutcorwin.com"'):
            self.assertIn(needle, h)

    def test_packages_say_their_state_and_invent_no_versions(self):
        h = read("packages.html")
        for p in catalog.PACKAGES:
            self.assertIn(p["name"], h)
        text = re.sub(r"<[^>]+>", " ", h).replace("Perl 5.44.0", "Perl")  # perl's own version is not ours
        self.assertNotRegex(text, r"\bv?\d+\.\d+\.\d+\b")

    def test_home_has_topology_or_says_it_does_not(self):
        h = read("index.html")
        if os.path.isdir(os.path.join(OUT, "topology")):
            self.assertIn('data-first="topology/topoforge/index.html?load=/drawings/inputloop.json&amp;embed=', h)
            self.assertIn('data-resume="topology/topoforge/index.html?embed=', h)
            self.assertNotIn("topology/app.html", h, "the home page frames TopoForge itself, not a host page around it")
            self.assertTrue(os.path.isfile(os.path.join(OUT, "topology", "topoforge", "index.html")))
            self.assertIn("Bryant Frankford", h)
        else:
            self.assertIn("placeholder", h)

    def test_the_frame_asks_for_the_apps_switches_and_full_size_for_none(self):
        """draw 1.8's switches (topology's topoforge/spec/EMBED-v1.md), one set per page layout
        (docs/NAV.md, revision 4): free asks for bare (every bar and panel hidden) with the selection and
        ready messages; classic for the messages only, so the app keeps its own chrome. js/stage.js adds
        the set to the address; "Full size" opens the app on its own, with no switch."""
        h = read("index.html")
        if not os.path.isdir(os.path.join(OUT, "topology")):
            return
        m = re.search(r'<iframe id="topology"[^>]*>', h)
        self.assertTrue(m)
        attr = lambda a: re.search(a + r'="([^"]*)"', m.group(0)).group(1).replace("&amp;", "&")
        self.assertEqual(attr("data-embed-free"), "bare,select,ready", "free does not ask for bare and the messages")
        # revision 8 stage 2: classic also asks for reset (the app's Reset layout in its View menu), never
        # for the pad (classic keeps its menus)
        self.assertEqual(attr("data-embed-classic"), "select,ready,reset", "classic asks for other than the messages and reset")
        self.assertNotIn("mappad", attr("data-embed-classic"), "classic asks for the map's pad")
        for a in ("data-first", "data-resume"):
            self.assertTrue(attr(a).endswith("embed="), a + " is not ready for stage.js to add the switches")
        st = read("js/stage.js")
        self.assertIn("f.getAttribute('data-embed-' + ui)", st, "stage.js does not add the layout's switches")
        full = re.search(r'<a href="([^"]*)" id="stage-full">', h).group(1)
        self.assertNotIn("embed=", full, '"Full size" asks for switches: it should show the app as it is on its own')
        spec = os.path.join(TOPO, "topoforge", "spec", "EMBED-v1.md")
        if os.path.isfile(spec):   # every word asked for is one the app's spec defines
            with open(spec, encoding="utf-8") as f:
                s = f.read()
            for w in ("bare,select,ready," + "select,ready").split(","):
                self.assertIn("`%s`" % w, s, "the app's spec has no switch " + w)

    def test_free_names_every_switch_it_relies_on(self):
        """docs/NAV.md, revision 9: free's call to TopoForge.embed() at ready (js/free.js) names every switch
        the page relies on, draw 1.12's bigcard and cardpad among them. In 1.12 cardpad turns
        bigcard, mappad, preview and map on by itself, but an older app ignores a word it does not know, so
        each is named rather than left to another's implication. Classic asks for neither 1.12 word: its
        map keeps 1.10's card (it asks for no preview at all) and its pad stays off. Revision 10: free names
        draw 1.13's peek too (Shift over a placed shape shows its card); classic does not ask for it."""
        js = read("js/free.js")
        m = re.search(r"\bt\.embed\(\{([^}]*)\}\)", js)
        self.assertTrue(m, "free.js has no call to TopoForge.embed({...}) at ready")
        said = dict(re.findall(r"([A-Za-z-]+): (true|false)", m.group(1)))
        for w in ("keys", "context", "pagelist", "peek", "view", "map", "preview", "mapwheel", "mappad", "reset", "bigcard", "cardpad"):
            self.assertEqual(said.get(w), "true", "free does not ask the app for %s by name (it asks: %s)" % (w, m.group(1).strip()))
        h = read("index.html")
        f = re.search(r'<iframe id="topology"[^>]*>', h)
        if f:
            for a in ("data-embed-free", "data-embed-classic"):
                v = re.search(a + r'="([^"]*)"', f.group(0)).group(1)
                for w in ("bigcard", "cardpad", "peek"):
                    self.assertNotIn(w, v.split(","), "%s asks for %s in the address" % (a, w))
        spec = os.path.join(TOPO, "topoforge", "spec", "EMBED-v1.md")
        if os.path.isfile(spec):
            with open(spec, encoding="utf-8") as fh:
                s = fh.read()
            for w in said:
                self.assertIn("`%s`" % w, s, "the app's spec has no switch " + w)

    def test_the_layout_is_set_before_the_page_is_drawn(self):
        """docs/NAV.md, revision 4: js/ui.js runs in the head without defer, on every page, before the
        stylesheet's rules can draw the wrong layout; it keeps one key, inside try."""
        for rel in PAGES:
            h = read(rel)
            if "<head>" not in h:
                continue
            head = h.split("</head>")[0]
            self.assertRegex(head, r'<script src="(/|(\.\./)*)js/ui\.js"></script>', rel + " does not load ui.js in the head without defer")
        u = read("js/ui.js")
        self.assertIn("KEY = 'corwin.cloud.ui.v1'", u)
        for ln in u.splitlines():
            if "localStorage" in ln:
                self.assertRegex(ln, r"try \{.*localStorage\.(get|set)Item\(KEY", "ui.js touches storage outside try: " + ln.strip())
        self.assertIn("'free'", u.split("var ui =")[1].split(";")[0], "free is not the default")

    def test_no_long_explanatory_text_is_built_on_the_home_page(self):
        """Corwin, 2026-11-01 21:41: classic "can keep the emacs esque footer line and loose all of the self
        congratulatory extemporizing". The heading is two words; no paragraph outside the project
        panels, the legend's cells and the colophon runs past 160 characters."""
        h = read("index.html")
        self.assertRegex(h, r'<h1 id="stage-h" class="stage-h">The shop, drawn</h1>')
        body = re.sub(r'<section class="panel".*?</section>\n', "", h, flags=re.S)
        body = re.sub(r'<aside class="legend".*?</aside>', "", body, flags=re.S)
        body = re.sub(r'<div class="side shared-ci">.*?</div>\s*</div>', "", body, flags=re.S)
        for m in re.finditer(r"<(p|li|h1|h2)\b(?![^>]*class=\"colophon\")[^>]*>(.*?)</\1>", body, re.S):
            text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
            self.assertLessEqual(len(text), 160, "long text on the home page: " + text[:80])

    def test_the_app_is_named_draw_with_bryant_first(self):
        """Corwin, 2026-11-01: Bryant first; 2026-11-11: the app is "draw" in our text (topology, and TopoForge before it, renamed)."""
        h = read("index.html")
        if not os.path.isdir(os.path.join(OUT, "topology")):
            return
        lg = re.search(r'<aside class="legend" id="legend".*?</aside>', h, re.S).group(0)
        app = re.sub(r"<[^>]+>", "", re.search(r'<div class="lg-cell lg-app">(.*?)</div>', lg, re.S).group(1))
        self.assertIn("draw", app)
        self.assertNotIn("TopoForge", app, "the legend still names TopoForge")
        self.assertLess(app.index("Bryant Frankford"), app.index("Corwin"), "Bryant is not named first")
        line = re.sub(r"<[^>]+>", "", re.search(r'<p class="lg-line">(.*?)</p>', lg, re.S).group(1))
        self.assertTrue(re.match(r"app\s*draw\s*by\s*Bryant Frankford", line), "the legend's line does not start with the app and Bryant: " + line[:60])

    def test_the_legend_is_one_line_in_words(self):
        """Corwin, 2026-11-02: "lets try one line" in hairline compartments; "Why would we use a machine
        formatted explainer of the license"? The legend's line holds GPLv3+ and no SPDX-style string; its
        whole words, and no SPDX string, are in the credits under it."""
        h = read("index.html")
        if not os.path.isdir(os.path.join(OUT, "topology")):
            return
        lg = re.search(r'<aside class="legend" id="legend".*?</aside>', h, re.S).group(0)
        line = re.search(r'<p class="lg-line">(.*?)</p>', lg, re.S)
        self.assertTrue(line, "no one-line legend")
        words = re.sub(r"<[^>]+>", " ", lg)
        for bad in ("-or-later", "-only", "CC-BY-SA-", "SPDX"):
            self.assertNotIn(bad, words, "a machine-formatted licence string in the legend: " + bad)
        self.assertIn("GPLv3+", line.group(1))
        self.assertGreaterEqual(line.group(1).count('class="lg-c '), 5, "the line has fewer than five compartments")
        self.assertNotIn(". ", re.sub(r"<[^>]+>", "", line.group(1)), "a sentence in the legend's line")

    def test_the_legend_fonts_are_served_here_with_their_licences(self):
        """Revision 6: the legend is lettered in two fonts served from this site; each font file has a
        REUSE annotation whose licence text is in LICENSES/, a line in src/fonts/README with its sha256, and
        Credits (the legend's Sheet cell) names both fonts and their licences."""
        import hashlib
        fonts = os.path.join(OUT, "fonts")
        files = sorted(f for f in os.listdir(fonts) if f.endswith((".woff", ".woff2"))) if os.path.isdir(fonts) else []
        self.assertEqual(files, ["osifont.woff", "plex-sans-condensed-300.woff2", "plex-sans-condensed-400.woff2"])
        with open(os.path.join(ROOT, "REUSE.toml"), encoding="utf-8") as fh:
            reuse = fh.read()
        with open(os.path.join(ROOT, "src", "fonts", "README"), encoding="utf-8") as fh:
            readme = fh.read()
        for f in files:
            m = re.search(r'path = \[[^\]]*"src/fonts/%s"[^\]]*\]\s*SPDX-FileCopyrightText = "[^"]+"\s*SPDX-License-Identifier = "([^"]+)"' % re.escape(f), reuse)
            self.assertTrue(m, f + " has no REUSE annotation")
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "LICENSES", m.group(1) + ".txt")), f + ": no LICENSES/" + m.group(1) + ".txt")
            with open(os.path.join(fonts, f), "rb") as fh:
                self.assertIn(hashlib.sha256(fh.read()).hexdigest(), readme, f + "'s sha256 is not in src/fonts/README")
        css = read("css/site.css")
        for f in files:
            self.assertIn("../fonts/" + f, css, f + " is not used by the stylesheet")
        self.assertNotRegex(css, r"@font-face[^}]*url\(\s*['\"]?https?:", "a font from another host")
        h = read("index.html")
        if os.path.isdir(os.path.join(OUT, "topology")):
            sheet = re.sub(r"<[^>]+>", "", re.search(r'<div class="lg-cell lg-sheet">(.*?)</div>', h, re.S).group(1))
            for w in ("osifont", "ISO 3098", "GNU General Public License, version 3, with the font exception", "IBM Plex Sans Condensed", "SIL Open Font License 1.1"):
                self.assertIn(w, sheet, "Credits does not name: " + w)

    def test_the_name_is_never_misspelled(self):
        """Corwin, 2026-11-01 20:51: "topology is the correct name." The misspelling appears in none of the
        site's sources, documents or built pages."""
        bad = []
        for dp, ds, fs in os.walk(ROOT):
            ds[:] = [d for d in ds if d not in (".git", "public", "node_modules", "__pycache__", "vendor")]
            for f in fs:
                if f.endswith((".py", ".js", ".css", ".md", ".html", ".cjs", ".mjs", ".sh", ".conf")):
                    p = os.path.join(dp, f)
                    if p == os.path.abspath(__file__):
                        continue
                    with open(p, encoding="utf-8", errors="replace") as fh:
                        if "topograph" + "y" in fh.read().lower():
                            bad.append(os.path.relpath(p, ROOT))
        for page in ("index.html", "directory.html"):
            if "topograph" + "y" in read(page).lower():
                bad.append("built " + page)
        self.assertEqual(bad, [], "misspelled name in: " + ", ".join(bad))

    def test_legend_credits_bryant_and_states_topoforges_licence(self):
        """The legend under the drawing (docs/NAV.md, revision 2): Bryant named with his public link,
        TopoForge's licence as its own README.org states it, its source in topology, and more room for
        TopoForge than for the site's own cell."""
        h = read("index.html")
        if not os.path.isdir(os.path.join(OUT, "topology")):
            return
        m = re.search(r'<aside class="legend" id="legend".*?</aside>', h, re.S)
        self.assertTrue(m, "no legend on the home page")
        lg = m.group(0)
        bryant = "https://github.com/takushieternal"
        self.assertIn('href="%s">Bryant Frankford</a>' % bryant, lg)
        self.assertEqual(lg.count('href="%s"' % bryant), 2, "Bryant is linked in the legend's line and in its credits")
        if os.path.isdir(ABOUT):   # the link is the one about-corwin publishes for him
            with open(os.path.join(ABOUT, "content", "personae", "bryant.txt"), encoding="utf-8") as f:
                self.assertIn("takushieternal", f.read())
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", lg))
        # the licence in words (docs/NAV.md, revision 5), the same licence TopoForge's README states in SPDX
        for s in ("GNU General Public License, version 3 or any later version, or the GNU Lesser General Public License, version 3 or any later version, as you choose",
                  "Creative Commons Attribution-ShareAlike 4.0 International", "There is no warranty"):
            self.assertIn(s, text)
        readme = os.path.join(TOPO, "topoforge", "README.org")
        if os.path.isfile(readme):   # and it is what TopoForge's own README says
            with open(readme, encoding="utf-8") as f:
                r = re.sub(r"\s+", " ", f.read())
            self.assertIn("GPL-3.0-or-later OR LGPL-3.0-or-later, your choice", r)
            self.assertIn("CC-BY-SA-4.0", r)
        for u in ("https://github.com/inputloop/draw/tree/corwin/www/topoforge", "https://github.com/inputloop/draw/tree/corwin/topoforge"):
            self.assertIn('href="%s"' % u, lg)
        cells = dict(re.findall(r'<div class="lg-cell (lg-[a-z]+)">(.*?)</div>', lg, re.S))
        his = sum(len(re.sub(r"<[^>]+>", "", cells[k])) for k in ("lg-app", "lg-lic", "lg-src"))
        ours = len(re.sub(r"<[^>]+>", "", cells["lg-sheet"]))
        self.assertGreaterEqual(his, ours, "TopoForge gets less room in the legend than the site does")

    def test_topology_sources_are_not_in_the_repository(self):
        # The repository carries the shell only. Walk it (not the build output) for topology's files.
        for dp, ds, fs in os.walk(ROOT):
            ds[:] = [d for d in ds if d not in (".git", "public", "node_modules", "__pycache__")]
            for f in fs:
                self.assertNotIn(f, ("topoforge.html", "topology-core.js", "app.html", "RECIPE.org"), os.path.join(dp, f))
        self.assertFalse(os.path.exists(os.path.join(ROOT, "www")))


class DemoChecks(unittest.TestCase):
    def test_every_demo_page_says_who_made_it_its_licence_and_how_to_run_it(self):
        for d in catalog.DEMOS:
            h = read("demo/%s/index.html" % d["id"])
            for word in ("Made by", "Licence", "Run it yourself"):
                self.assertIn("<dt>%s</dt>" % word, h, d["id"])
            self.assertIn(html_escape(d["credit"]), h, d["id"] + ": credit not as the catalog gives it")
            self.assertIn(html_escape(d["licence"]), h, d["id"])

    def test_each_app_that_runs_here_is_staged_or_says_why_not(self):
        for d in catalog.DEMOS:
            if d["runs"] != "here":
                continue
            h = read("demo/%s/index.html" % d["id"])
            staged = os.path.isdir(os.path.join(OUT, "demo", d["id"], "app"))
            self.assertTrue(staged or "not here today" in h, d["id"])
            if staged and not d.get("derived"):
                self.assertTrue(os.path.isfile(os.path.join(OUT, "demo", d["id"], "app", "index.html")), d["id"])
                self.assertIn('href="./app/index.html"', h, d["id"])

    def test_every_directory_card_opens_its_drawing(self):
        dr = read("directory.html")
        for r in catalog.REPOS:
            self.assertIn('href="index.html?drawing=%s#top"' % html_escape(r["id"]), dr, r["id"])

    def test_demo_sources_are_not_in_the_repository(self):
        for dp, ds, fs in os.walk(ROOT):
            ds[:] = [d for d in ds if d not in (".git", "public", "node_modules", "__pycache__", "generated")]
            for f in fs:
                self.assertNotIn(f, ("quantum3d5.js", "p5.min.js", "hello-taxgnomes.html", "egad-tokens.json", "how-gitcha-works.json",
                                     "customize.js", "vue.global.prod.js", "maplibre-gl-csp.js"), os.path.join(dp, f))


TOPO = os.environ.get("DRAW_DIR") or os.environ.get("TOPOLOGY_DIR") or os.path.join(ROOT, "..", "draw")
ILOOP = os.environ.get("INPUTLOOP_DIR", os.path.join(ROOT, "..", "inputloop"))
ABOUT = os.environ.get("ABOUT_DIR", os.path.join(ROOT, "..", "about-corwin"))


class NextPassChecks(unittest.TestCase):
    """The 2026-11-01 next pass: TOPOLOGY.md for every project, processes as data, NextTime's demo on
    pinned libraries, about-corwin's palette and CI strip shared by staging, channel badges."""

    def index(self):
        import json
        with open(os.path.join(OUT, "drawings", "index.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_every_directory_project_is_drawn_from_its_own_topology_md(self):
        if not os.path.isdir(os.path.join(TOPO, "examples", "inputloop")):
            self.skipTest("no topology checkout")
        ix = self.index()
        bare = sorted(k for k, v in ix["projects"].items() if v["from"] == "catalog.py")
        self.assertEqual(bare, [], "drawn from the catalog alone, with no TOPOLOGY.md: %s" % bare)

    def test_each_process_is_a_page_and_a_file_in_every_notation(self):
        import processes
        ix = self.index()
        for proc in processes.PROCESSES:
            v = ix["processes"].get(proc["id"])
            self.assertIsNotNone(v, proc["id"] + " is not in the default set")
            self.assertEqual(ix["pages"][v["page"]]["name"], proc["name"])
            for n in processes.CHOICES:
                self.assertTrue(os.path.isfile(os.path.join(OUT, v["files"][n])), "%s has no %s file" % (proc["id"], n))
                self.assertIn('href="%s"' % v["files"][n], read("index.html"), "the home page does not offer %s in %s" % (proc["id"], n))
            self.assertIn('href="index.html?drawing=process-%s#top"' % proc["id"], read("index.html"))

    def test_nexttime_runs_here_on_pinned_libraries(self):
        if not os.path.isdir(os.path.join(ILOOP, "NextTime-Dev")):
            self.skipTest("no NextTime-Dev checkout")
        import vendor
        app = os.path.join(OUT, "demo", "NextTime-Dev", "app")
        self.assertTrue(os.path.isfile(os.path.join(app, "index.html")), "NextTime's demo was not staged: %s" % read("demo/NextTime-Dev/index.html")[-600:])
        page = open(os.path.join(app, "index.html"), encoding="utf-8").read()
        self.assertNotRegex(page, r"unpkg\.com|demotiles\.maplibre\.org")
        self.assertNotRegex(page, r"<(script|link)[^>]+(src|href)=\"?https?://")
        for js in [f for f in os.listdir(app) if f.endswith(".js")]:
            self.assertNotIn("demotiles.maplibre.org", open(os.path.join(app, js), encoding="utf-8").read(), js)
        import io, tarfile
        table, demo = read("jslicense.html"), read("demo/NextTime-Dev/index.html")
        for name in catalog_demo("NextTime-Dev")["vendor"]:
            p = vendor.by_name(name)
            raw = vendor.fetch(p, offline=True)        # checked against the pin again, here
            with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tf:
                for pub, inner in p["files"].items():
                    with open(os.path.join(app, vendor.folder(p), pub), "rb") as f:
                        self.assertEqual(f.read(), tf.extractfile(inner).read(), "%s/%s is not the pinned tarball's file" % (name, pub))
            for mini, full in p["min"].items():
                row = re.search(r'<tr><td><a href="demo/NextTime-Dev/app/%s/%s">.*?</tr>' % (re.escape(vendor.folder(p)), re.escape(mini)), table)
                self.assertIsNotNone(row, "%s's %s has no row in jslicense.html" % (name, mini))
                self.assertIn('href="demo/NextTime-Dev/app/%s/%s"' % (vendor.folder(p), full), row.group(0), "%s's %s: its row does not link the unminified source" % (name, mini))
            self.assertIn(p["sha256"], demo, name + ": the demo page does not show the sha256")
            self.assertIn(p["spdx"], demo, name + ": the demo page does not show the licence")
        # NextTime is definitelynotaspren's work, credited by her GitHub handle, everywhere it is credited
        self.assertRegex(demo, r"<dt>Made by</dt><dd>definitelynotaspren&#x27;s work\.</dd>")
        self.assertRegex(read("directory.html"), r'<h3 id="c-NextTime-Dev">NextTime-Dev</h3>.*?<p class="credit">Made by: definitelynotaspren</p>')
        self.assertRegex(read("index.html"), r"<dt>Made by</dt><dd>definitelynotaspren&#x27;s work\.")

    def test_the_palette_and_ci_strip_are_staged_from_about_corwin_unchanged(self):
        if not os.path.isfile(os.path.join(ABOUT, "src", "js", "customize.js")):
            self.skipTest("no about-corwin checkout")
        with open(os.path.join(ABOUT, "src", "js", "customize.js"), "rb") as a, open(os.path.join(OUT, "js", "customize.js"), "rb") as b:
            self.assertEqual(a.read(), b.read(), "js/customize.js is not about-corwin's, byte for byte")
        src = open(os.path.join(ABOUT, "src", "index.html"), encoding="utf-8").read()
        block = re.search(r'\n(<div class="custom" id="custom">\n.*?\n</div>)\n', src, re.S).group(1)
        # its page is a template since 2026-11-01: a placeholder is filled with nothing, as about-corwin's
        # own build does with the tone pads off; nothing else differs, and no placeholder reaches a page
        block = re.sub(r"\{\{[A-Z_]+\}\}", "", block)
        for rel in PAGES:
            self.assertIn(block, read(rel), rel + " lacks about-corwin's Customize block")
            self.assertNotRegex(read(rel), r"\{\{[A-Z_]+\}\}", rel + " shows a template placeholder as text")
            self.assertIn("css/shared.css", read(rel), rel)
        css = read("css/shared.css")
        for title in ("reading settings (Customize)", "Customize: the floating control"):
            self.assertIn(title, css)
        self.assertIn('id="ci-h"', read("index.html"), "the home page has no CI strip")
        self.assertIn('href="js/customize.js"', read("jslicense.html"))

    def test_a_project_with_a_channel_gets_a_hidden_status_line(self):
        d = read("directory.html")
        for r in catalog.REPOS:
            if r.get("channel"):
                self.assertIn('data-channel="%s" hidden' % r["channel"], d, r["id"])


class NavChecks(unittest.TestCase):
    """The left nav (docs/NAV.md): its index, the example from Corwin's words, the plain list."""

    def setUp(self):
        p = os.path.join(OUT, "nav", "index.json")
        if not os.path.isfile(p):
            self.skipTest("no nav index: this build had no topology checkout")
        sys.path.insert(0, os.path.join(ROOT, "tests"))
        import nav_expect
        self.NE = nav_expect
        self.ix = nav_expect.load(OUT)

    def test_every_thing_drawn_is_an_item_in_one_of_seven_sections(self):
        ids = {i["id"] for i in self.ix["items"]}
        for r in catalog.REPOS:
            self.assertIn("project-" + r["id"], ids)
        for d in catalog.DEMOS:
            self.assertIn("demo-" + d["id"], ids)
        import processes
        for pr in processes.PROCESSES:
            self.assertIn("process-" + pr["id"], ids)
        with open(os.path.join(OUT, "drawings", "index.json"), encoding="utf-8") as f:
            pages = [p["name"] for p in json.load(f)["pages"]]
        reached = {i.get("page") for i in self.ix["items"]}
        for name in pages:
            self.assertIn(name, reached, "no item opens the drawing page " + name)
        secs = [s["id"] for s in self.ix["facets"]["show"]]
        self.assertEqual(secs, ["projects", "processes", "hosts", "people", "paths", "pages", "demos"])
        for i in self.ix["items"]:
            self.assertIn(i["section"], secs, i["id"])

    def test_every_category_says_why(self):
        for i in self.ix["items"]:
            for f, vals in i["facets"].items():
                known = [v["id"] for v in self.ix["facets"][f]]
                for v in vals:
                    self.assertIn(v, known, i["id"])
                    self.assertTrue(i["why"].get("%s:%s" % (f, v), "").strip(), "%s is in %s:%s with no reason" % (i["id"], f, v))

    def test_the_example_from_his_words_is_computed_from_the_data(self):
        """Projects + BPMN + "topology": the index's answer, and the same answer read from the sources."""
        got = self.NE.expect(self.ix, [{"show": ["projects"], "f": {"notation": ["bpmn"]}, "q": "topology"}])
        import drawings as G
        import processes as PR
        recs = G.load_examples(TOPO)
        table, src = PR.read_notations(TOPO)
        kinds = dict(catalog.KINDS)

        def rec_text(name):
            r = recs.get(name)
            return " ".join([r["name"], r["body"]] + [v for k, v in r["front"].items() if k not in ("repo", "private")]) if r else ""

        ptexts = [" ".join([p["name"], p["title"], p["source"], p["credit"]] + [n for _, n in p["lanes"]] + [e["text"] for e in p["elements"]]).lower()
                  for p in PR.PROCESSES]
        expected = []
        for r in catalog.REPOS:
            app = next((x for x in catalog.APPS if x["repo"] == r["id"]), None)
            own = [r["name"], r["one"], r["credit"], kinds.get(r["kind"], "")]
            if app:
                own += [app["tagline"], app["what"], " ".join(app["does"]), app["how_title"], " ".join(" ".join(s) for s in app["flow"]),
                        app["how"], app["status"], app["needs"], app["credit"]]
            own.append(rec_text(r["name"]))
            own += [rec_text(c) for c, _ in G.contained(r["name"], recs)]
            own += [n for n, _ in G.related(r["name"], recs)]
            text = " ".join(own).lower()
            name = re.escape(r["name"].lower())
            named = any(re.search(r"(?<![a-z0-9'+.-])" + name + r"(?![a-z0-9'+-])(?!\.[a-z0-9])", t) for t in ptexts)
            bpmn = "bpmn" in text or named or src.startswith(r["name"] + "'s ")
            says_topology = re.search(r"(?<![a-z0-9'+.-])topology", text) is not None
            if bpmn and says_topology:
                expected.append("project-" + r["id"])
        self.assertEqual(got, expected, "the index and the sources disagree on Projects + BPMN + topology")
        self.assertIn("project-topology", got)
        print("\n  Projects + BPMN + \"topology\" -> %s" % ", ".join(x.replace("project-", "") for x in got), file=sys.stderr)

    def test_the_nav_is_a_plain_list_of_links_without_scripts(self):
        home = read("index.html")
        m = re.search(r'<aside class="navframe" id="nav".*?</aside>', home, re.S)
        self.assertTrue(m, "the home page has no navigator")
        links = re.findall(r'<a href="([^"]+)" data-item="([^"]+)"', m.group(0))
        self.assertEqual(sorted(i for _, i in links), sorted(i["id"] for i in self.ix["items"]))
        pages = json.loads(html_unescape(re.search(r'data-pages="([^"]+)"', home).group(1)))
        for href, iid in links:
            href = html_unescape(href)
            q = re.match(r"^index\.html\?drawing=([^#]+)#top$", href)
            if q:
                self.assertIn(q.group(1), pages, "%s opens ?drawing=%s, which names no page" % (iid, q.group(1)))
            else:
                self.assertTrue(os.path.isfile(os.path.join(OUT, href, "index.html")), iid + " links nowhere: " + href)

    def test_no_private_part_or_name_in_the_index(self):
        raw = read("nav/index.json")
        self.assertFalse(PRIVATE_URL.search(raw), "a private repository's address is in the nav index")
        self.assertFalse(FORBIDDEN.search(raw))
        import drawings as G
        for r in G.load_examples(TOPO).values():
            f = r["front"]
            if f.get("pillar") == "place" and f.get("kind") in ("server", "desktop", "laptop") and not re.match(catalog.PUBLIC_HOSTS_RE, r["name"]):
                self.assertNotRegex(raw, r"\b%s\b" % re.escape(r["name"]), r["name"] + " is named in the nav index")

    def test_taxonomy_js_is_about_corwins_byte_for_byte_and_licensed(self):
        src = os.path.join(ABOUT, "src", "js", "taxonomy.js")
        if not os.path.isfile(src):
            self.skipTest("no about-corwin checkout")
        with open(src, "rb") as a, open(os.path.join(OUT, "js", "taxonomy.js"), "rb") as b:
            self.assertEqual(a.read(), b.read(), "js/taxonomy.js is not about-corwin's, byte for byte")
        lic = read("jslicense.html")
        for f in ("nav.js", "taxonomy.js"):
            self.assertIn('href="js/%s"' % f, lic)
        home = read("index.html")
        self.assertLess(home.index('src="js/taxonomy.js"'), home.index('src="js/nav.js"'), "taxonomy.js must load before nav.js")


# ---- what the site keeps in the browser (docs/NAV.md, revision 11) ----------------------------------
# Every write into the browser's storage in the code this site serves, read from the code itself: each
# X.setItem(name, ...) in a served .js, .mjs or .html file, its name read as written ('a' is the name a,
# 'a' + b the names starting a, NAME the string NAME is set to in that file, or exported from another).
# A write whose name is a variable the reading cannot follow is named here by hand, with what makes it true.
WRAPPERS = {   # file (relative to the site) -> (the wrapper's own setItem argument, the wrapper's calls)
    "topology/board/index.html": ("k", r"\bLS\.set\("),
}


def _never_vue_router(t, out):
    # the router's devtools plugin is set up without enableEarlyProxy, so the ApiProxy that keeps its
    # settings is never made (setupDevtoolsPlugin reads the flag; nothing sets it)
    return t.count("enableEarlyProxy") == 1


def _never_maplibre_dev(t, out):
    # the unminified twins of the files the demo loads: storageAvailable is defined there and never called
    app = os.path.join(out, "demo", "NextTime-Dev", "app", "index.html")
    loads_dev = os.path.isfile(app) and "-dev.js" in _slurp(app)
    return t.count("storageAvailable(") == 1 and not loads_dev


def _never_p5_storeitem(t, out):
    # p5's storeItem, which no script of the demo calls
    app = os.path.join(out, "demo", "quantum3d5", "app")
    for dp, _, fs in os.walk(app):
        for f in fs:
            if f.endswith((".js", ".html")) and not f.startswith("p5"):
                if "storeItem(" in _slurp(os.path.join(dp, f)):
                    return False
    return True


NEVER = [   # (file pattern, argument as written, why it never runs here, the check that it does not)
    (r"/vue-router\.global\.js$", "localSettingsSaveId", "Vue devtools' settings: the proxy that writes them is never made", _never_vue_router),
    (r"/maplibre-gl-csp(-worker)?-dev\.js$", "'_mapbox_test_'", "a storage test in the map library's unminified twin, never called", _never_maplibre_dev),
    (r"/p5(\.min)?\.js$", "e", "p5's storeItem, which the demo never calls", _never_p5_storeitem),
]
SET_ITEM = re.compile(r"([\w$.]*)\.setItem\(")


def _argument(t, i):
    """The first argument of a call whose '(' ends at i: up to the comma at depth 0, quotes respected."""
    depth, j, q = 0, i, None
    while j < len(t):
        c = t[j]
        if q:
            if c == "\\":
                j += 2
                continue
            if c == q:
                q = None
        elif c in "'\"`":
            q = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            if depth == 0:
                return t[i:j].strip()
            depth -= 1
        elif c == "," and depth == 0:
            return t[i:j].strip()
        j += 1
    return t[i:].strip()


def _top_plus(a):
    parts, depth, q, cur = [], 0, None, ""
    for c in a:
        if q:
            cur += c
            if c == q:
                q = None
            continue
        if c in "'\"`":
            q = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        if c == "+" and depth == 0:
            parts.append(cur.strip())
            cur = ""
            continue
        cur += c
    parts.append(cur.strip())
    return parts


def _name_of(arg, t, out):
    """(name, "key" or "prefix") for a storage write's first argument, or None if it cannot be read."""
    m = re.fullmatch(r"(['\"])([^'\"]*)\1", arg)
    if m:
        return m.group(2), "key"
    m = re.fullmatch(r"`([^`$]*)\$\{.*`", arg, re.S)
    if m:
        return m.group(1), "prefix"
    parts = _top_plus(arg)
    if len(parts) == 2:
        a = _name_of(parts[0], t, out)
        if not a or a[1] != "key":
            return None
        b = re.fullmatch(r"(['\"])([^'\"]*)\1", parts[1])
        return (a[0] + b.group(2), "key") if b else (a[0], "prefix")
    m = re.fullmatch(r"(?:[\w$]+\.)?([A-Za-z_$][\w$]*)", arg)
    if not m:
        return None
    vals = {v for _, v in re.findall(r"\b%s\s*=\s*(['\"])([^'\"]*)\1" % re.escape(m.group(1)), t)}
    if not vals:   # exported from a module beside it (topology's front door: T.STORAGE_KEY)
        for dp, _, fs in os.walk(out):
            for f in fs:
                if f.endswith((".js", ".mjs")):
                    vals |= {v for _, v in re.findall(r"export\s+const\s+%s\s*=\s*(['\"])([^'\"]*)\1" % re.escape(m.group(1)), _slurp(os.path.join(dp, f)))}
    return (vals.pop(), "key") if len(vals) == 1 else None


def kept_by_code(out):
    """{(name, kind, store)} every served script writes, and [problems] the reading could not settle."""
    got, bad = set(), []
    for dp, _, fs in os.walk(out):
        for f in fs:
            if not f.endswith((".js", ".mjs", ".html")):
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, out).replace(os.sep, "/")
            try:
                t = _slurp(p)
            except (UnicodeDecodeError, OSError):
                continue
            for m in SET_ITEM.finditer(t):
                recv, arg = m.group(1), _argument(t, m.end())
                store = "session" if recv.endswith("sessionStorage") else "local" if recv.endswith("localStorage") else None
                if rel in WRAPPERS and arg == WRAPPERS[rel][0]:
                    for w in re.finditer(WRAPPERS[rel][1], t):
                        n = _name_of(_argument(t, w.end()), t, out)
                        if n:
                            got.add(n + ("local",))
                        else:
                            bad.append("%s: a write through its wrapper whose name cannot be read: %s" % (rel, _argument(t, w.end())))
                    continue
                never = [x for x in NEVER if re.search(x[0], "/" + rel) and x[1] == arg]
                if never:
                    if not never[0][3](t, out):
                        bad.append("%s: %s no longer holds" % (rel, never[0][2]))
                    continue
                n = _name_of(arg, t, out) if store else None
                if n:
                    got.add(n + (store,))
                else:
                    bad.append("%s: a storage write this check cannot read: %s.setItem(%s" % (rel, recv, arg[:60]))
    return got, bad


def kept_by_note(out):
    p = Page()
    p.feed(_slurp(os.path.join(out, "privacy.html")))
    return {(d["data-key"], d.get("data-kind", "key"), d.get("data-store", "local")) for t, d in p.tags if "data-key" in d}


class PrivacyChecks(unittest.TestCase):
    """privacy.html (docs/NAV.md, revision 11; Corwin, 2026-11-04: "Keep it, disclose it"): it lists exactly
    the names the served code keeps in the browser, every page links it, and what it names links back."""

    def test_the_note_lists_exactly_the_names_the_code_keeps(self):
        code, bad = kept_by_code(OUT)
        self.assertEqual(bad, [], "storage writes the check cannot settle:\n  " + "\n  ".join(bad))
        note = kept_by_note(OUT)
        self.assertTrue(code, "no storage write found in the served code: the reading is broken")
        self.assertEqual(sorted(code - note), [], "the code keeps names privacy.html does not list")
        self.assertEqual(sorted(note - code), [], "privacy.html lists names no served code keeps")
        for k in ("corwin.cloud.ui.v1", "corwin.cloud.blink"):   # the reading reaches this site's own two stores
            self.assertTrue([x for x in code if x[0] == k], k)
        self.assertIn(("corwin.cloud.blink", "key", "session"), code)

    def test_every_page_links_the_note(self):
        for rel in PAGES:
            here = os.path.dirname(rel)
            links = [d.get("href", "") for t, d in parse(rel).tags if t == "a" and "privacy-policy" in d.get("rel", "").split()]
            self.assertTrue(links, rel + " does not link the note on what the site keeps")
            for h in links:
                target = h.lstrip("/") if h.startswith("/") else os.path.normpath(os.path.join(here, h.split("#")[0]))
                self.assertEqual(target, "privacy.html", "%s links the note as %s" % (rel, h))
            # about-corwin's Customize block links #privacy ("What this site remembers") on the page it is on:
            # here that is the note's link (on the note itself, its heading)
            tgt = [(t, d) for t, d in parse(rel).tags if d.get("id") == "privacy"]
            self.assertEqual(len(tgt), 1, rel + " has no single #privacy for Customize's link")
            self.assertTrue(tgt[0][0] == "h1" if rel == "privacy.html" else "privacy-policy" in tgt[0][1].get("rel", ""), rel + ": #privacy is not the note")
        self.assertIn('href="privacy.html"', read("index.html").split('id="goto"')[1].split("</ul>")[0], "the list of everywhere lacks the note")

    def test_the_request_log_sentence_is_the_registers_and_lives_in_one_place(self):
        """The web server's request log is said in one sentence, rendered by lo1re from the logreq register's
        corwin.cloud rows into privacy-log.txt (A+agent, live on gw33 since run 20261104T225156Z). Its first
        line is a stamp naming the sentence's sha256; the page carries the sentence; build.py types none."""
        with open(os.path.join(ROOT, "privacy-log.txt"), encoding="utf-8") as fh:
            stamp, sentence = fh.read().split("\n")[:2]
        m = re.search(r"sha256 ([0-9a-f]{64})\s*$", stamp)
        self.assertTrue(m, "privacy-log.txt: the first line is not lo1re's stamp")
        self.assertEqual(hashlib.sha256(sentence.encode("utf-8")).hexdigest(), m.group(1),
                         "privacy-log.txt: the sentence is not the one its stamp names; render it again from the "
                         "register (lo1re render ... corwin.cloud notefile), never edit it by hand")
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", read("privacy.html"))))
        self.assertIn(sentence, text, "privacy.html does not carry privacy-log.txt's sentence")
        with open(os.path.join(ROOT, "build.py"), encoding="utf-8") as fh:
            self.assertNotIn("The web server", fh.read(),
                             "build.py carries a request-log sentence of its own; the words live in privacy-log.txt")

    def test_what_the_note_names_links_back_to_it(self):
        note = parse("privacy.html")
        secs = {d["id"] for t, d in note.tags if t == "section" and "id" in d}
        if os.path.isdir(os.path.join(OUT, "topology")):
            self.assertIn("drawing", secs)
            self.assertRegex(read("index.html"), r'<a href="privacy\.html#drawing" id="stage-kept">', "the legend's Your drawing does not link the note")
            self.assertRegex(read("demo/topology/index.html"), r'href="\.\./\.\./privacy\.html#topology"', "topology's demo page does not link the note")
        if os.path.isdir(os.path.join(OUT, "demo", "quantum3d5", "app")):
            self.assertIn("demos", secs)
            self.assertRegex(read("demo/quantum3d5/index.html"), r'href="\.\./\.\./privacy\.html#demos"', "Quantum 3D5's demo page does not link the note")
        b = [d for t, d in note.tags if d.get("id") == "forget"]
        self.assertTrue(b and b[0].get("data-doc") and b[0].get("data-drawing"), "the note has no Forget button that knows the shop's drawing")
        self.assertIn('src="js/privacy.js"', read("privacy.html"))
        for rel in PAGES:
            if rel != "privacy.html":
                self.assertNotIn('src="js/privacy.js"', read(rel), rel + " loads privacy.js; only the note does")


def html_unescape(t):
    import html
    return html.unescape(t)


def catalog_demo(did):
    return next(d for d in catalog.DEMOS if d["id"] == did)


def html_escape(t):
    import html
    return html.escape(t)


class PlaceholderBuild(unittest.TestCase):
    def test_build_without_topology_says_so(self):
        import subprocess
        import tempfile
        with tempfile.TemporaryDirectory() as t:
            r = subprocess.run([sys.executable, os.path.join(ROOT, "build.py"), "--out", t, "--topology", os.path.join(t, "nope")],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("placeholder", r.stderr.lower())
            self.assertIn("placeholder", open(os.path.join(t, "index.html"), encoding="utf-8").read())  # noqa
            self.assertFalse(os.path.exists(os.path.join(t, "topology")))
            # revision 11: the note lists what this build's code keeps, and no more (no drawing app here)
            code, bad = kept_by_code(t)
            self.assertEqual((bad, sorted(code ^ kept_by_note(t))), ([], []), "the placeholder build's note and code differ")
            self.assertFalse([k for k in code if k[0].startswith("topoforge.")])


if __name__ == "__main__":
    unittest.main(verbosity=1)
