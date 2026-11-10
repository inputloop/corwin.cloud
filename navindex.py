# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later
"""The left nav's index: every thing the drawing draws, in layered categories, made at build time.

    build.py calls make(out, tdir, drawing_index) -> index; render(index) -> the plain-list HTML.

Reads the sources the drawing reads (catalog.py, the TOPOLOGY.md files, processes.py and topology's
notation table) and the drawing itself (drawings/inputloop.json), and writes nav/index.json: the
sections, the facets and, per item, its categories with the reason for each, and the words it says.
js/nav.js reads that file from this site; docs/NAV.md says what the categories mean and the rule
that decides what shows. Private parts of a TOPOLOGY.md never get here (drawings.read_topology_md drops
them), and a host that is not a public ghostwheel name is "a workstation", as in the drawing.

tokenize() is the same as tokenize() in about-corwin's src/js/taxonomy.js, so the words the browser
matches are the words this file wrote. Standard library only.
"""
import html
import json
import os
import re
import unicodedata

import catalog as C
import drawings as G
import processes as PR

SECTIONS = [("projects", "Projects", "rounded"), ("processes", "Processes", "zone"), ("hosts", "Hosts", "server"),
            ("people", "People", "user"), ("paths", "Paths", "parallelogram"), ("pages", "Pages", "document"),
            ("demos", "Demos", "rect")]
PILLARS = [("place", "place", "server"), ("part", "part", "rounded"), ("path", "path", "parallelogram"), ("person", "person", "user")]
NOTATION_GLYPH = {"bpmn": "task", "bpmnplus": "propose", "flowchart": "decision"}   # which element's shape stands for the notation
STOP = set("a an and are as at be by for from in is it of on or the to with".split())
# A glyph is a class name the stylesheet draws; anything else is drawn as a rounded box.
GLYPHS = {"rounded", "rect", "ellipse", "diamond", "parallelogram", "user", "server", "hexagon", "triangle", "zone", "document"}
e = html.escape
HIDDEN = set()   # set by make(): the names of machines the drawing calls "a workstation"


def tokenize(text):
    """about-corwin's taxonomy.js tokenize(), in Python: words, keeping inner - ' + and ."""
    t = unicodedata.normalize("NFKD", str(text or "").lower())
    t = re.sub("[̀-ͯ]", "", t).replace("‘", "'").replace("’", "'")
    out = []
    for w in re.split(r"[^a-z0-9'+.-]+", t):
        w = re.sub(r"^[-'.]+|[-'.]+$", "", w)
        if w:
            out.append(w)
    return out


def says(word, words):
    """The nav's word rule (docs/NAV.md): the same word, a plural, or the start of one (3 letters or
    more). It is taxonomy.js similarity() at 0.8 or more."""
    for t in words:
        if word == t or word + "s" == t or t + "s" == word:
            return True
        if len(word) >= 3 and t.startswith(word):
            return True
    return False


def query_words(q):
    return [w for w in tokenize(q) if w not in STOP]


def passes(item, ctx):
    """One context: {show: [...], f: {facet: [...]}, q: text}. Sections are the caller's (see visible)."""
    for f, pressed in (ctx.get("f") or {}).items():
        if pressed and not set(pressed) & set(item["facets"].get(f, [])):
            return False
    return all(says(w, item["words"]) for w in query_words(ctx.get("q", "")))


def visible(index, ctxs):
    """The ids that show, section by section, when every context holds (no pins)."""
    shown = []
    for it in index["items"]:
        if all((not c.get("show")) or it["section"] in c["show"] for c in ctxs) and all(passes(it, c) for c in ctxs):
            shown.append(it["id"])
    return shown


# ---- reading the sources ----------------------------------------------------------------------

def glyph(kind):
    k = {"server": "server", "user": "user", "users": "user", "parallelogram": "parallelogram", "site": "zone",
         "zone": "zone", "database": "server", "container": "rounded"}.get(kind, kind)
    return k if k in GLYPHS else "rounded"


def rec_words(rec):
    if not rec:
        return []
    vals = [rec["name"], rec["body"]] + [v for k, v in rec["front"].items() if k not in ("repo", "private")]
    return tokenize(" ".join(vals))


class Item:
    def __init__(self, iid, section, name, tip, glyph_, href, page=None):
        self.d = {"id": iid, "section": section, "name": name, "tip": tip, "glyph": glyph_, "href": href, "page": page,
                  "facets": {"notation": [], "pillar": [], "says": []}, "why": {}, "words": []}
        self.words = []

    def add(self, facet, value, why):
        if value not in self.d["facets"][facet]:
            self.d["facets"][facet].append(value)
            self.d["why"]["%s:%s" % (facet, value)] = why

    def say(self, *texts):
        for t in texts:
            if isinstance(t, (list, tuple)):
                self.say(*t)
            elif t:
                self.words += tokenize(t)

    def done(self):
        # A name the drawing does not show (a workstation's) is not a word the nav may say either.
        self.d["words"] = sorted(w for w in set(self.words) if not any(w == h or w.startswith(h + "'") for h in HIDDEN))
        return self.d


def process_text(p):
    return " ".join([p["name"], p["title"], p["source"], p["credit"]] + [n for _, n in p["lanes"]] + [el["text"] for el in p["elements"]])


def names_in(words, name):
    """Is a thing's name said in these words? The name's words, one after another."""
    nw = tokenize(name)
    if not nw:
        return False
    for i in range(len(words) - len(nw) + 1):
        if words[i:i + len(nw)] == nw:
            return True
    return False


def notation_owner(src):
    """The project the notation table is read from: the name before "'s" in where it came from."""
    m = re.match(r"^(\S+?)'s ", src or "")
    return m.group(1) if m and not src.startswith("corwin.cloud's copy") else None


def make(out, tdir, dindex):
    recs = G.load_examples(tdir)
    HIDDEN.clear()
    HIDDEN.update(n.lower() for n, r in recs.items() if r["front"].get("pillar") == "place"
                  and r["front"].get("kind") in ("server", "desktop", "laptop") and G.host_label(n) != n)
    table, src = PR.read_notations(tdir)
    owner = notation_owner(src)
    repo_names = {r["name"] for r in C.REPOS}
    with open(os.path.join(out, "drawings", "inputloop.json"), encoding="utf-8") as f:
        drawing = json.load(f)
    page_names = [p["name"] for p in drawing["pages"]]
    procs = [(p, tokenize(process_text(p))) for p in PR.PROCESSES]
    keys = {}   # ?drawing= key -> page name, for the things that have no project key
    items = []

    def pillar_of(name):
        r = recs.get(name)
        return r["front"].get("pillar") if r else None

    # where a host, a person or a path is drawn: the first project page that draws it
    drawn_on = {}
    for repo in C.REPOS:
        for n, _ in G.related(repo["name"], recs):
            drawn_on.setdefault(n, repo["id"])

    def bpmn_from_processes(it, name):
        for p, words in procs:
            if names_in(words, name):
                short = p["name"].replace("Process: ", "")
                it.add("notation", "bpmn", "a process drawn here names it: %s" % short)
                if any(el.get("act") for el in p["elements"]):
                    it.add("notation", "bpmnplus", "it takes part in %s, whose steps carry BPMN+ acts" % short)
                it.add("notation", "flowchart", "it takes part in %s, offered as a flowchart file too" % short)
                it.add("pillar", "path", "it takes part in a process: %s" % short)

    def says_notations(it, words):
        if any(w.startswith("bpmn") for w in words):
            it.add("notation", "bpmn", "it says BPMN itself")
        if "bpmn+" in words or "bpmnplus" in words:
            it.add("notation", "bpmnplus", "it says BPMN+ itself")
        if any(w.startswith("flowchart") for w in words):
            it.add("notation", "flowchart", "it says flowchart itself")

    # ---- projects
    kinds = dict(C.KINDS)
    for repo in C.REPOS:
        rec = recs.get(repo["name"])
        app = G.app_for(repo["id"])
        pj = dindex["projects"][repo["id"]]
        it = Item("project-" + repo["id"], "projects", repo["name"], repo["one"], "rounded",
                  "index.html?drawing=%s#top" % repo["id"], pj["name"])
        it.say(repo["name"], repo["one"], repo["credit"], kinds.get(repo["kind"], ""))
        if app:
            it.say(app["tagline"], app["what"], app["does"], app["how_title"], [" ".join(s) for s in app["flow"]], app["how"],
                   app["status"], app["needs"], app["credit"])
        it.say(rec_words(rec) and " ".join(rec_words(rec)))
        for c, _ in G.contained(repo["name"], recs):
            it.say(" ".join(rec_words(recs.get(c))))
        rel = G.related(repo["name"], recs)
        it.say([n for n, _ in rel])
        own = (rec and rec["front"].get("pillar")) or "part"
        it.add("pillar", own, "its own pillar is %s (%s)" % (own, rec["rel"] if rec else "catalog.py"))
        it.add("pillar", "part", "it is a project: something made")
        for c, _ in G.contained(repo["name"], recs):
            p = pillar_of(c)
            if p:
                it.add("pillar", p, "its page draws %s, a %s" % (c, p))
        for n, _ in rel:
            p = pillar_of(n)
            if p:
                it.add("pillar", p, "its page draws %s, a %s" % (G.host_label(n) if p == "place" else n, p))
        it.add("says", repo["kind"], "the catalog files it under %s" % kinds.get(repo["kind"], repo["kind"]))
        words = sorted(set(it.words))
        says_notations(it, words)
        bpmn_from_processes(it, repo["name"])
        if owner and owner == repo["name"]:
            why = "it defines the notation: the table the processes are drawn with is read from its source (%s)" % src
            for n in PR.CHOICES:
                it.add("notation", n, why)
        if app:
            it.add("notation", "flowchart", "its page draws how it works as a flowchart")
        items.append(it.done())

    # ---- processes
    for p, words in procs:
        v = dindex["processes"][p["id"]]
        it = Item("process-" + p["id"], "processes", p["name"].replace("Process: ", ""), p["title"], "zone",
                  "index.html?drawing=process-%s#top" % p["id"], v["name"])
        it.say(process_text(p))
        it.add("notation", "bpmn", "its page in the drawing is BPMN")
        if any(el.get("act") for el in p["elements"]):
            it.add("notation", "bpmnplus", "its steps carry BPMN+ acts (describe, propose, effect, go)")
        it.add("notation", "flowchart", "it is offered as a flowchart file")
        it.add("pillar", "path", "a process is how work moves")
        for r in recs.values():
            pl = r["front"].get("pillar")
            if pl in ("place", "person") and r["name"] != "inputloop" and names_in(words, r["name"]):
                it.add("pillar", pl, "it names %s, a %s" % (G.host_label(r["name"]) if pl == "place" else r["name"], pl))
        for repo in C.REPOS:
            if names_in(words, repo["name"]):
                it.add("pillar", "part", "it names %s, a project" % repo["name"])
        items.append(it.done())

    # ---- hosts, people, paths (as the shop's page groups them)
    shop = page_names[0]
    keys["shop"] = shop
    n_ws = 0
    for r in recs.values():
        pl, name = r["front"].get("pillar"), r["name"]
        if pl not in ("place", "person", "path") or name == "inputloop" or name in repo_names:
            continue
        sec = {"place": "hosts", "person": "people", "path": "paths"}[pl]
        public = pl != "place" or G.host_label(name) == name
        if not public:
            n_ws += 1
        on = drawn_on.get(name)
        # two workstations would read the same; the project whose page draws each tells them apart
        label = name if public else ("a workstation (%s)" % on if on else "a workstation")
        iid = "%s-%s" % (sec[:-1] if sec != "people" else "person", G.slug(name) if public else "workstation-%d" % n_ws)
        href = "index.html?drawing=%s#top" % (on or "shop")
        page = dindex["projects"][on]["name"] if on else shop
        tip = G.summary(r["body"], 200) if public else "A place the drawing does not name on a public site."
        it = Item(iid, sec, label, tip, glyph(r["front"].get("kind", "")), href, page)
        if public:
            it.say(rec_words(r))
            it.say(listv_words(r["front"].get("connects")))
            says_notations(it, sorted(set(it.words)))
            bpmn_from_processes(it, name)
        else:
            it.say("a workstation")
        it.add("pillar", pl, "its own pillar is %s" % pl)
        for c in G.listv(r["front"].get("connects")):
            cp = pillar_of(c) or ("part" if c in repo_names else None)
            if cp and public:
                it.add("pillar", cp, "it connects to %s, a %s" % (G.host_label(c) if cp == "place" else c, cp))
        items.append(it.done())

    # ---- pages that are not a project's or a process's own
    owned = {v["name"] for v in dindex["projects"].values()} | {v["name"] for v in dindex.get("processes", {}).values()}
    bryant = 0
    for i, p in enumerate(drawing["pages"]):
        if p["name"] in owned:
            continue
        if p["name"].startswith(G.GITCHA_PREFIX):
            bryant += 1
            key = "gitcha-bryant-%d" % bryant
        elif i == 0:
            key = "shop"
        else:
            key = "page-" + G.slug(p["name"])
        keys[key] = p["name"]
        texts = [n.get("text", "") for n in p.get("nodes", [])]
        tip = (texts[0] if texts else p["name"]).split("\n")[0][:200]
        it = Item("page-" + G.slug(p["name"]), "pages", p["name"], tip, "document", "index.html?drawing=%s#top" % key, p["name"])
        it.say(p["name"], texts)
        if any(n.get("layer") == "flow" for n in p.get("nodes", [])):
            it.add("notation", "flowchart", "it draws a flow, step by step")
        says_notations(it, sorted(set(it.words)))
        for n in p.get("nodes", []):
            pl = {"user": "person", "server": "place", "parallelogram": "path"}.get(n.get("type"))
            if pl and n.get("layer") != "flow":
                it.add("pillar", pl, "it draws %s, a %s" % (n.get("text", "").split("\n")[0] or n.get("type"), pl))
        items.append(it.done())

    # ---- demos
    for d in C.DEMOS:
        repo = next(r for r in C.REPOS if r["id"] == d["repo"])
        it = Item("demo-" + d["id"], "demos", d["name"], d["what"], "rect", "demo/%s/" % d["id"])
        it.say(d["name"], d["what"], d["run"], d["credit"], d["licence"], repo["name"])
        it.add("says", repo["kind"], "it demonstrates %s, which the catalog files under %s" % (repo["name"], kinds.get(repo["kind"], repo["kind"])))
        it.add("pillar", "part", "it demonstrates a project")
        items.append(it.done())

    facets = {
        "show": [{"id": s, "label": l, "glyph": g} for s, l, g in SECTIONS],
        "notation": [{"id": n, "label": table[n]["name"], "glyph": glyph(table[n]["elements"].get(NOTATION_GLYPH[n], "rounded")),
                      "about": table[n]["about"]} for n in PR.CHOICES],
        "pillar": [{"id": p, "label": l, "glyph": g} for p, l, g in PILLARS],
        "says": [{"id": k, "label": l, "glyph": "rounded"} for k, l in C.KINDS],
    }
    index = {"version": 1, "about": "corwin.cloud's left nav: docs/NAV.md", "doc": G.DOC_NAME,
             "notations_from": src, "facets": facets, "items": items, "keys": keys, "stop": sorted(STOP)}
    os.makedirs(os.path.join(out, "nav"), exist_ok=True)
    with open(os.path.join(out, "nav", "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1, ensure_ascii=False)
    return index


def listv_words(v):
    return " ".join(G.listv(v))


def render(index):
    """The nav without scripts: a heading per section and a link per item. js/nav.js replaces it."""
    out = ['<aside class="navframe" id="nav" aria-labelledby="nav-h">',
           '<h2 id="nav-h" class="nf-static-h">Navigator <span class="muted">everything the drawing draws, by kind</span></h2>',
           '<div class="nf-static">']
    for sid, label, g in SECTIONS:
        its = [i for i in index["items"] if i["section"] == sid]
        if not its:
            continue
        out.append('<section class="nf-sec" aria-labelledby="nfs-%s"><h3 id="nfs-%s">%s <span class="muted">(%d)</span></h3><ul>'
                   % (sid, sid, e(label), len(its)))
        for i in its:
            out.append('<li><a href="%s" data-item="%s"><span class="g g-%s" aria-hidden="true"></span>%s</a></li>'
                       % (e(i["href"], quote=True), e(i["id"], quote=True), i["glyph"], e(i["name"])))
        out.append("</ul></section>")
    out.append("</div></aside>")
    return "".join(out)


if __name__ == "__main__":
    import sys
    a = sys.argv[1:]
    if len(a) < 1:
        sys.exit("usage: python3 navindex.py OUT_DIR [TOPOLOGY_DIR]   (after build.py has written OUT_DIR)")
    with open(os.path.join(a[0], "drawings", "index.json"), encoding="utf-8") as f:
        ix = make(a[0], a[1] if len(a) > 1 else "../topology", json.load(f))
    print("navindex: %d items" % len(ix["items"]))
