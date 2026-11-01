# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""The default drawings: one TopoForge page per project the directory lists, made at build time.

    python3 drawings.py OUT_DIR [TOPOLOGY_DIR [INPUTLOOP_DIR]]     (build.py calls make())

Reads catalog.py (what each project is, who made it, how it works) and the TOPOLOGY.md files in a
topology checkout (examples/inputloop/: what each thing contains and connects to, its layer and
pillar). Writes TopoForge JSON, the format TopoForge saves and opens with File > Open or ?load=:

    drawings/inputloop.json        the default set: the shop, then one page per directory project,
                                   obsmage's workflows and scenes, and Bryant's "how Gitcha works"
    drawings/<slug>.json           one project's page alone
    drawings/how-gitcha-works.json Bryant's drawing, byte for byte, staged from a gitcha checkout
    drawings/index.json            which page of inputloop.json is which project

The TOPOLOGY.md reader follows topology's spec/TOPOLOGY-md.md (front matter, ## Private parts). This
site is public, so its floor is "never": a private part is never drawn, and the page says one was
kept back and by what. Each node sits on a TopoForge layer named for its layer (abstract,
operational, physical) or for what it is (flow, words), so a person can switch views with
TopoForge's own Layers panel. Standard library only.
"""
import hashlib
import json
import os
import re
import shutil
import sys

import catalog as C
import processes as PR

DOC_NAME = "inputloop: the shop, drawn"
LAYERS = [("words", "Words: titles and notes"), ("abstract", "Abstract: people and ideas"),
          ("operational", "Operational: projects, parts and paths"), ("physical", "Physical: hosts and screens"),
          ("flow", "Flow: how it works, step by step")]
SETTINGS = {"grid": 20, "snap": True, "showGrid": True, "guides": True, "netLabels": True, "ifLabels": True,
            "minimap": True, "defaultRoute": "orthogonal"}
# TopoForge shape names a TOPOLOGY.md kind may use directly; anything else is drawn as a rounded box.
TF_SHAPES = set("router switch l3switch hub ap wrouter modem lb patch firewall ids vpn server vm container database "
                "storage ups nms desktop laptop phone ipphone tablet printer camera user users internet cloud wan tower "
                "zone site vlan subnet dmz vpc rack rect rounded ellipse diamond triangle hexagon parallelogram "
                "cylinder document note text".split())
GROUPS = {"zone", "site", "vlan", "subnet", "dmz", "vpc", "rack"}
GITCHA_SHA256 = "a7adb644bc436bfea2ee2445a7872936fc9b5897d6f92e25079cc5dda51f0289"  # from Bryant's story file
GITCHA_PREFIX = "How Gitcha works (Bryant) "


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---- the TOPOLOGY.md reader (spec/TOPOLOGY-md.md) ---------------------------------------------

HEADING = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$")


def read_topology_md(text):
    """Return (front: dict, public body: str, kept_back: int). Private parts are dropped here."""
    lines = text.split("\n")
    front, start = {}, 0
    if lines and lines[0].rstrip("\r") == "---":
        for i in range(1, len(lines)):
            if lines[i].rstrip("\r") == "---":
                for ln in lines[1:i]:
                    ln = ln.strip()
                    if not ln or ln.startswith("#") or ":" not in ln:
                        continue
                    k, v = ln.split(":", 1)
                    v = re.sub(r"\s+#.*$", "", v).strip()
                    front[k.strip().lower()] = v
                start = i + 1
                break
    out, kept, private_level, fence = [], 0, None, None
    for ln in lines[start:]:
        f = re.match(r"^ {0,3}(```+|~~~+)", ln)
        if f:
            mark = f.group(1)[0] * 3
            fence = None if fence == mark else (fence or mark)
        m = None if fence and not f else HEADING.match(ln)
        if m and not f:
            level, title = len(m.group(1)), (m.group(2) or "").strip()
            if private_level is not None and level <= private_level and title.lower() != "private":
                private_level = None
            if private_level is None and title.lower() == "private":
                private_level, kept = level, kept + 1
                continue
        if private_level is None:
            out.append(ln)
    return front, "\n".join(out).strip(), kept


def listv(v):
    return [x.strip() for x in re.split(r"[,;]", v or "") if x.strip()]


def load_examples(tdir):
    """name -> record, from every TOPOLOGY.md under examples/inputloop (symbolic links are not read)."""
    base = os.path.join(tdir or "", "examples", "inputloop")
    recs = {}
    for dp, ds, fs in os.walk(base):
        ds.sort()
        for f in ("TOPOLOGY.md", ".topology.md"):
            p = os.path.join(dp, f)
            if f in fs and not os.path.islink(p):
                with open(p, encoding="utf-8") as fh:
                    front, body, kept = read_topology_md(fh.read())
                name = front.get("name") or os.path.basename(dp)
                r = recs.setdefault(name, dict(name=name, front={}, body="", kept=0, says=[], rel=os.path.relpath(p, tdir)))
                r["front"].update(front)
                r["body"] = r["body"] or body
                r["kept"] += kept
                if "private" in front:
                    r["says"].append(front["private"])
    return recs


def summary(body, limit=420):
    """The first paragraph of the public body, as plain words."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip() and not p.strip().startswith(("#", "|", "-"))]
    t = re.sub(r"[`*_]", "", " ".join(paras[0].split())) if paras else ""
    return t if len(t) <= limit else t[:limit].rsplit(" ", 1)[0] + "..."


# ---- drawing helpers ------------------------------------------------------------------------------

class Page:
    def __init__(self, name, key):
        self.name, self.key, self.nodes, self.links = name, key, [], []

    def node(self, nid, typ, x, y, w, h, text, layer, parent=None, data=None, props=None, style=None):
        nid = "%s-%s" % (self.key, slug(nid))
        d = {"tf_ref": nid}
        d.update({k: str(v) for k, v in (data or {}).items() if v})
        self.nodes.append({"id": nid, "type": typ, "x": x, "y": y, "w": w, "h": h, "text": text, "layer": layer,
                           "parent": parent, "props": props or {}, "data": d, "style": style or {}})
        return nid

    def link(self, a, b, text="", arrows="end", layer="operational", dash=False):
        lid = "%s-l%d" % (self.key, len(self.links) + 1)
        self.links.append({"id": lid, "a": {"id": a, "port": None}, "b": {"id": b, "port": None}, "route": "orthogonal",
                           "text": text, "layer": layer, "arrows": arrows, "props": {},
                           "style": {"dash": "6 4"} if dash else {}, "data": {"tf_ref": lid}})

    def json(self):
        return {"id": "page-" + self.key, "name": self.name, "layers": [{"id": i, "name": n, "visible": True, "locked": False} for i, n in LAYERS],
                "activeLayer": "operational", "nodes": self.nodes, "links": self.links}


def shape_of(kind):
    return kind if kind in TF_SHAPES else "rounded"


def host_label(name):
    return name if re.match(C.PUBLIC_HOSTS_RE, name) else "a workstation"


def flow(page, steps, x, y, caption, key):
    """A flowchart left to right: an ellipse to start and end, rounded steps between."""
    page.node(key + "-cap", "text", x, y, 900, 30, caption, "flow")
    prev, bx = None, x
    for i, (head, sub) in enumerate(steps):
        typ = "ellipse" if i in (0, len(steps) - 1) else "rounded"
        nid = page.node("%s-%d" % (key, i), typ, bx, y + 50, 170, 80, "%s\n%s" % (head, sub), "flow", data={"step": i + 1})
        if prev:
            page.link(prev, nid, layer="flow")
        prev, bx = nid, bx + 230
    return y + 160


# ---- the pages ---------------------------------------------------------------------------------

def app_for(repo_id):
    return next((a for a in C.APPS if a["repo"] == repo_id), None)


def demo_for(repo_id):
    return next((d for d in C.DEMOS if d["repo"] == repo_id), None)


def related(name, recs):
    """Things whose TOPOLOGY.md connects to this one, or that this one connects to or contains."""
    me = recs.get(name, {"front": {}})
    out = []
    for n in listv(me["front"].get("connects")):
        out.append((n, "connects"))
    for r in recs.values():
        if name in listv(r["front"].get("connects")) and r["name"] != name:
            out.append((r["name"], "connects"))
    seen, uniq = set(), []
    for n, why in out:
        if n not in seen:
            seen.add(n)
            uniq.append((n, why))
    return uniq


def contained(name, recs, depth=0):
    me = recs.get(name)
    if not me or depth > 3:
        return []
    out = []
    for c in listv(me["front"].get("contains")):
        out.append((c, depth))
        out += contained(c, recs, depth + 1)
    return out


def project_page(repo, recs, key):
    """One project's page: who made it, what it is made of, what it touches, and how it works."""
    rec = recs.get(repo["name"])
    app, demo = app_for(repo["id"]), demo_for(repo["id"])
    pg = Page(repo["name"], key)
    head = ["%s: %s" % (repo["name"], repo["one"]),
            "Made by: %s." % repo["credit"].rstrip("."),
            ("Repository: %s" % repo["url"]) if repo["public"] else "Repository: not public yet."]
    if demo:
        head.append("Demo: corwin.cloud/demo/%s/" % demo["id"])
    pg.node("title", "text", 0, -170, 1200, 120, "\n".join(head), "words")
    parts = contained(repo["name"], recs)
    cols = 3
    rows = max(1, (len(parts) + cols - 1) // cols)
    zh = 190 + rows * 120 if parts else 180
    data = {"what": repo["one"], "credit": repo["credit"], "public": "yes" if repo["public"] else "not public yet",
            "repo": repo.get("url") if repo["public"] else "", "status": app and app["status"],
            "licence": app and app["licence"], "demo": demo and "/demo/%s/" % demo["id"],
            "described by": rec["rel"] if rec else "catalog.py only: this project has no TOPOLOGY.md yet"}
    layer = (rec and rec["front"].get("layer")) or "operational"
    zone = pg.node("zone", "zone", 0, 0, 640, zh, repo["name"], layer if layer in dict(LAYERS) else "operational", data=data,
                   style={"dash": "6 4"} if not repo["public"] else None)
    about = summary(rec["body"]) if rec else repo["one"]
    if rec and rec["kept"]:
        about += "\n[%d private part%s kept back: this site never shows private parts.]" % (rec["kept"], "" if rec["kept"] == 1 else "s")
    pg.node("about", "note", 20, 40, 600, 120, about, "words", parent=zone)
    for i, (c, depth) in enumerate(parts):
        cr = recs.get(c, {"front": {}, "body": ""})
        f = cr["front"]
        kind = f.get("kind", "rect")
        pg.node("part-" + c, shape_of("rounded" if kind in GROUPS else kind), 30 + (i % cols) * 200, 190 + (i // cols) * 120,
                170, 80, c + (" (%s)" % f["state"] if f.get("state") else ""), f.get("layer") if f.get("layer") in dict(LAYERS) else "operational",
                parent=zone, data={"file": f.get("file"), "what": summary(cr.get("body", ""), 200), "depth": depth})
    # what it touches: people to the left, places and paths and other projects to the right
    left = right = 0
    for n, why in related(repo["name"], recs):
        r = recs.get(n, {"front": {}, "body": ""})
        pillar = r["front"].get("pillar", "part")
        if pillar == "person":
            nid = pg.node("who-" + n, "user", -260, 20 + left * 130, 90, 90, n, "abstract", data={"what": summary(r["body"], 200)})
            pg.link(nid, zone, "answers for", layer="abstract")
            left += 1
        else:
            if pillar == "place":
                typ = shape_of(r["front"].get("kind", "server"))
                label = host_label(n)
                lay = "physical"
            elif pillar == "path":
                typ, label, lay = "parallelogram", n, "operational"
            else:
                typ, label, lay = "rounded", n + "\n(its own page)", "operational"
            nid = pg.node("near-" + (n if label == n or pillar != "place" else "workstation-%d" % right), typ, 760, 20 + right * 130, 150 if typ in ("rounded", "parallelogram") else 90, 90, label, lay,
                          data={"what": summary(r["body"], 200) if label == n or pillar != "place" else ""})
            pg.link(zone, nid, why)
            right += 1
    y = max(zh, left * 130, right * 130) + 80
    if app:
        y = flow(pg, app["flow"], 0, y, "How it works: %s." % app["how_title"], "flow")
        pg.node("how", "text", 0, y, 1100, 60, app["how"], "words")
    return pg


def overview_page(recs):
    """The shop: you in the middle, the four pillars around you."""
    pg = Page("The shop", "shop")
    order = [r["name"] for r in C.REPOS]
    groups = {"part": [n for n in order], "person": [], "place": [], "path": []}
    for r in recs.values():
        p = r["front"].get("pillar")
        if p in ("place", "path", "person") and r["name"] != "inputloop" and r["name"] not in groups["part"]:
            groups[p].append(r["name"])
    W, H, GX, GY = 150, 48, 165, 62

    def size(n, cols):
        rows = max(1, (n + cols - 1) // cols)
        return cols * GX + 20, 40 + rows * GY + 10

    pw, ph = size(len(groups["part"]), 6)
    boxes = {"part": (0, 0, 6, "Part: what is made"),
             "person": (-GX - 60, 0, 1, "Person: who answers"),
             "place": (0, ph + 200, 3, "Place: where it runs and lives"),
             "path": (3 * GX + 60, ph + 200, 3, "Path: how work moves")}
    pg.node("title", "text", -GX - 60, -150, 1200, 110,
            "The shop, drawn: what inputloop makes, where it runs, how work moves and who answers for it.\n"
            "Each project has its own page: the tabs along the bottom. Layers (right) switch views: people, projects, hosts, flows.\n"
            "Everything here is a drawing you can move, change and keep; it stays in this browser until you save it yourself (File).", "words")
    you = pg.node("you", "user", pw // 2 - 55, ph + 40, 110, 110, "You\n(this browser)", "abstract",
                  data={"what": "What you draw here stays in this browser. Nothing is sent anywhere."})
    ids = {}
    for k, (x, y, cols, title) in boxes.items():
        w, h = size(len(groups[k]), cols)
        z = pg.node("pillar-" + k, "zone", x, y, w, h, title, "words")
        for i, n in enumerate(groups[k]):
            r = recs.get(n, {"front": {}})
            repo = next((q for q in C.REPOS if q["name"] == n), None)
            label = host_label(n) if k == "place" else n
            if repo and not repo["public"]:
                label += "\n(not public yet)"
            typ = {"person": "user", "path": "parallelogram"}.get(k, "server" if k == "place" and r["front"].get("kind") == "server" else "rounded")
            ids[n] = pg.node("t-" + (n if label.split("\n")[0] == n else "workstation-%d" % i), typ,
                             x + 15 + (i % cols) * GX, y + 40 + (i // cols) * GY, W if typ != "user" else 60, H, label,
                             {"person": "abstract", "place": "physical"}.get(k, "operational"), parent=z,
                             data={"what": repo["one"] if repo else ""},
                             style={"dash": "6 4"} if repo and not repo["public"] else None)
    for r in recs.values():
        for c in listv(r["front"].get("connects")):
            if r["name"] in ids and c in ids:
                pg.link(ids[r["name"]], ids[c], layer="operational")
    if "corwin.cloud" in ids:
        pg.link(you, ids["corwin.cloud"], "you are here", layer="abstract")
    return pg


def obsmage_pages():
    out = []
    pg = Page("obsmage: workflows", "obsmage-workflows")
    pg.node("title", "text", 0, -120, 1200, 80, "obsmage: three things you do with it, each as the steps it takes.", "words")
    y = 0
    for w in C.OBS_WORKFLOWS:
        y = flow(pg, w["steps"], 0, y, "%s: %s" % (w["title"], w["intro"]), w["id"]) + 40
    out.append(pg)
    sc = Page("obsmage: scenes", "obsmage-scenes")
    sc.node("title", "text", 0, -140, 1200, 100, C.OBS_SCENES["intro"] + "\nThe names and sizes here are made up for the picture.", "words")
    desk = sc.node("desk", "site", 0, 0, 12 * 70 + 40, 280, "Scene: Screenmap (the canvas)", "physical")
    for name, x, y0, w, h in C.OBS_SCENES["displays"]:
        sc.node("display-" + name, "rect", 20 + x * 70, 50 + y0 * 70, w * 70 - 10, h * 70, name + ("\nunplugged: hidden, kept" if name == "Spare" else ""),
                "physical", parent=desk, style={"dash": "6 4"} if name == "Spare" else None)
    for i, (t, b) in enumerate(C.OBS_SCENES["points"]):
        sc.node("point-%d" % i, "note", (i % 2) * 450, 330 + (i // 2) * 130, 420, 110, "%s\n%s" % (t, b), "words")
    out.append(sc)
    return out


def gitcha_pages(idir):
    """Bryant's drawing, staged from a gitcha checkout and checked against the sha256 his story names."""
    p = os.path.join(idir or "", "gitcha", "topoforge", "how-gitcha-works.json")
    if not os.path.isfile(p):
        return None, None
    with open(p, "rb") as f:
        raw = f.read()
    if hashlib.sha256(raw).hexdigest() != GITCHA_SHA256:
        print("drawings: how-gitcha-works.json is not the drawing Bryant's story names; left out", file=sys.stderr)
        return None, None
    d = json.loads(raw)
    pages = []
    for pgd in d["pages"]:
        pgd = json.loads(json.dumps(pgd))
        pgd["name"] = GITCHA_PREFIX + pgd["name"]
        pages.append(pgd)
    return raw, pages


def process_page(proc, notation, table, src, key):
    """One process, in one notation: lanes stacked as TopoForge zones, elements placed by column.
    Every element carries its role and the shape each notation gives it, so the notation is data."""
    nt = table[notation]
    pg = Page(proc["name"] if notation == "bpmn" else "%s (%s)" % (proc["name"], nt["name"]), key)
    others = " · ".join(table[n]["name"] for n in PR.CHOICES if n != notation)
    pg.node("title", "text", 0, -170, 1400, 130,
            "%s\nRead as %s: %s. The same process as a file in %s: on corwin.cloud's home page, under the drawing.\n%s\nMade by: %s."
            % (proc["title"], nt["name"], nt["about"], others, proc["source"], proc["credit"]), "words")
    CW, LH, LX = 230, 260, 210
    cols = max(e["col"] for e in proc["elements"]) + 1
    lshape, lword = PR.lane_shape(notation, table)
    lane_ids, lane_y, y = {}, {}, 0
    for lid, lname in proc["lanes"]:
        h = LH if any(e.get("row") and e["lane"] == lid for e in proc["elements"]) else LH - 110
        lane_y[lid] = y
        ld = {"element": "lane", "read as": lword, "notation": nt["name"], "notations from": src}
        for n in PR.CHOICES:
            ld["as " + table[n]["name"]] = PR.lane_shape(n, table)[0]
        lane_ids[lid] = pg.node("lane-" + lid, lshape, 0, y, LX + cols * CW, h, lname, "flow", data=ld)
        y += h + 20
    ids = {}
    for el in proc["elements"]:
        shape, word = PR.shape_for(el, notation, table)
        w, h = {"diamond": (170, 120), "user": (90, 90), "ellipse": (160, 80)}.get(shape, (170, 90))
        x = LX + el["col"] * CW + (CW - 20 - w) // 2
        y = lane_y[el["lane"]] + (40 if not el.get("row") else 150)
        data = {"element": el["role"] + (" (end)" if el.get("end") else ""), "act": el.get("act", ""), "read as": word,
                "notation": nt["name"], "notations from": src}
        for n in PR.CHOICES:
            data["as " + table[n]["name"]] = PR.shape_for(el, n, table)[0]
        ids[el["id"]] = pg.node(el["id"], shape, x, y, w, h, el["text"], "flow", parent=lane_ids[el["lane"]], data=data)
    for a, b, label in proc["flows"]:
        pg.link(ids[a], ids[b], label, layer="flow")
    return pg


def process_pages(tdir, dest):
    """Write every process in every notation offered; return the BPMN pages for the default set."""
    table, src = PR.read_notations(tdir)
    out = []
    for proc in PR.PROCESSES:
        for n in PR.CHOICES:
            key = "process-%s-%s" % (proc["id"], n)
            pg = process_page(proc, n, table, src, "process-" + proc["id"])
            with open(os.path.join(dest, key + ".json"), "w", encoding="utf-8") as f:
                json.dump(dict(doc([pg]), name="%s (%s)" % (proc["name"], table[n]["name"])), f, indent=1)
            if n == "bpmn":
                out.append((proc, pg))
    return out, src


def doc(pages):
    return {"format": "topoforge", "version": 1, "name": DOC_NAME, "settings": SETTINGS,
            "pages": [p if isinstance(p, dict) else p.json() for p in pages], "cur": 0}


def make(out, tdir, idir):
    """Write out/drawings/. Returns the index (also written as index.json)."""
    recs = load_examples(tdir)
    dest = os.path.join(out, "drawings")
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest)
    pages, index = [overview_page(recs)], {"doc": DOC_NAME, "file": "drawings/inputloop.json", "pages": [], "projects": {}}
    index["pages"].append({"name": "The shop", "project": None})
    for repo in C.REPOS:
        key = slug(repo["id"])
        pg = project_page(repo, recs, key)
        index["projects"][repo["id"]] = {"page": len(pages), "name": pg.name, "file": "drawings/%s.json" % key,
                                         "from": recs[repo["name"]]["rel"] if repo["name"] in recs else "catalog.py"}
        index["pages"].append({"name": pg.name, "project": repo["id"]})
        pages.append(pg)
        with open(os.path.join(dest, key + ".json"), "w", encoding="utf-8") as f:
            json.dump(dict(doc([pg]), name="%s (inputloop)" % repo["name"]), f, indent=1)
        if repo["id"] == "obsmage":
            for extra in obsmage_pages():
                index["pages"].append({"name": extra.name, "project": "obsmage"})
                pages.append(extra)
    procs, src = process_pages(tdir, dest)
    index["processes"] = {}
    index["notations_from"] = src
    for proc, pg in procs:
        index["processes"][proc["id"]] = {"page": len(pages), "name": pg.name, "files": {n: "drawings/process-%s-%s.json" % (proc["id"], n) for n in PR.CHOICES}}
        index["pages"].append({"name": pg.name, "process": proc["id"]})
        pages.append(pg)
    raw, gp = gitcha_pages(idir)
    if gp:
        index["gitcha_bryant"] = {"page": len(pages), "file": "drawings/how-gitcha-works.json", "sha256": GITCHA_SHA256,
                                  "credit": "Bryant Frankford (drawing); Gitcha by Bryant Frankford and Corwin Brust"}
        for p in gp:
            index["pages"].append({"name": p["name"], "project": "gitcha", "by": "Bryant Frankford"})
            pages.append(p)
        with open(os.path.join(dest, "how-gitcha-works.json"), "wb") as f:
            f.write(raw)
    else:
        print("drawings: no gitcha checkout at %s: Bryant's drawing is left out of this build" % idir, file=sys.stderr)
    with open(os.path.join(dest, "inputloop.json"), "w", encoding="utf-8") as f:
        json.dump(doc(pages), f, indent=1)
    with open(os.path.join(dest, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=1)
    return index


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit("usage: python3 drawings.py OUT_DIR [TOPOLOGY_DIR [INPUTLOOP_DIR]]")
    ix = make(a[0], a[1] if len(a) > 1 else "../topology", a[2] if len(a) > 2 else "../inputloop")
    print("drawings: %d pages, %d projects" % (len(ix["pages"]), len(ix["projects"])))
