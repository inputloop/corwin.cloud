#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Checks on the built site (SITE_OUT, default public/). Standard library only.

The key guard is the external-link allow-list: this repository is public, so a link to a private
repository anywhere in the output must fail the build.
"""
import os
import re
import sys
import unittest
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import catalog  # noqa: E402

OUT = os.environ.get("SITE_OUT", os.path.join(ROOT, "public"))
PAGES = ["index.html", "directory.html", "packages.html", "jslicense.html", "404.html", "demo/index.html"] + \
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

    def test_external_links_are_only_public_ones(self):
        allowed = set(catalog.PUBLIC_URLS)
        for rel in PAGES:
            for tag, attr, v in refs(parse(rel)):
                if re.match(r"^(https?:|mailto:)", v):
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
        d = d[d.index('<ul class="grid">'):d.index('</fieldset>')]
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
            self.assertIn("js/" + f, table, f + " is not in jslicense.html")
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
            self.assertIn("Code GPL-3.0-or-later OR LGPL-3.0-or-later; prose CC-BY-SA-4.0.", h)
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
            self.assertIn('data-first="topology/topoforge/index.html?load=/drawings/inputloop.json"', h)
            self.assertIn('data-resume="topology/topoforge/index.html"', h)
            self.assertNotIn("topology/app.html", h, "the home page frames TopoForge itself, not a host page around it")
            self.assertTrue(os.path.isfile(os.path.join(OUT, "topology", "topoforge", "index.html")))
            self.assertIn("Bryant Frankford", h)
        else:
            self.assertIn("placeholder", h)

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
                self.assertNotIn(f, ("quantum3d5.js", "p5.min.js", "hello-taxgnomes.html", "egad-tokens.json", "how-gitcha-works.json"), os.path.join(dp, f))


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


if __name__ == "__main__":
    unittest.main(verbosity=1)
