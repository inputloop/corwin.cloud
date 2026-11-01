# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""Processes as data, drawn in the notation the person chooses.

A process here is lanes, elements and flows. Each element has a role (event, task, gateway, data)
and, for BPMN+, an act (describe, propose, effect, go). The role says what the element is; the
notation says which TopoForge shape draws it. The notations are topology's own table, NOTATIONS in
its www/js/topology-core.js, read from the checkout at build time, so one table decides for both
projects. Nothing is baked into a shape: every node carries its role and the shape each notation
gives it, as data TopoForge shows in its Properties panel.

drawings.py writes, for each process and each notation, drawings/process-<id>-<notation>.json, and
puts the BPMN one in the default set as a TopoForge page. Standard library only.
"""
import json
import os
import re

# Used only when there is no topology checkout. The same table as topology's, 2026-11-01.
FALLBACK_NOTATIONS = {
    "flowchart": {"name": "Flowchart", "about": "start, step, decision, input/output, end",
                  "elements": {"start": "ellipse", "step": "rect", "decision": "diamond", "io": "parallelogram", "end": "ellipse", "note": "rounded"}},
    "bpmn": {"name": "BPMN", "about": "events, tasks, gateways, lanes (a subset of BPMN 2.0 drawn with basic shapes)",
             "elements": {"event": "ellipse", "task": "rounded", "gateway": "diamond", "data": "parallelogram", "lane": "zone", "pool": "site"}},
    "bpmnplus": {"name": "BPMN+", "about": "BPMN, plus the three acts: describe, propose, effect, and the hand that says go",
                 "elements": {"event": "ellipse", "task": "rounded", "gateway": "diamond", "data": "parallelogram", "lane": "zone", "pool": "site",
                              "describe": "rect", "propose": "hexagon", "effect": "triangle", "go": "user"}},
}
CHOICES = ("bpmn", "bpmnplus", "flowchart")   # the notations offered, in this order; BPMN is the default page
# A flowchart has no word for some BPMN roles: say which of its words reads them.
FLOWCHART_WORD = {"event": "start", "task": "step", "gateway": "decision", "data": "io"}


def read_notations(tdir):
    """topology's NOTATIONS, from its checkout; (table, where it came from)."""
    p = os.path.join(tdir or "", "www", "js", "topology-core.js")
    try:
        with open(p, encoding="utf-8") as f:
            src = f.read()
        m = re.search(r"export const NOTATIONS = (\{.*?\n\});", src, re.S)
        body = re.sub(r"([{,]\s*)([A-Za-z_]\w*)\s*:", r'\1"\2":', m.group(1))
        body = re.sub(r"'([^']*)'", lambda x: json.dumps(x.group(1)), body)
        body = re.sub(r",(\s*[}\]])", r"\1", body)
        table = json.loads(body)
        if all(k in table for k in CHOICES):
            return table, "topology's www/js/topology-core.js"
    except (OSError, AttributeError, ValueError):
        pass
    return FALLBACK_NOTATIONS, "corwin.cloud's copy of topology's table (no topology checkout at build time)"


def shape_for(el, notation, table):
    """The TopoForge shape a notation gives one element, and the word it reads it by."""
    els = table[notation]["elements"]
    role = el["role"]
    if notation == "bpmnplus" and el.get("act") in els:
        return els[el["act"]], el["act"]
    if notation == "flowchart":
        word = {"event": "end" if el.get("end") else "start"}.get(role, FLOWCHART_WORD.get(role, role))
        return els.get(word, "rounded"), word
    return els.get(role, "rounded"), role


def lane_shape(notation, table):
    els = table[notation]["elements"]
    return els.get("lane", "zone"), ("lane" if "lane" in els else "group (a flowchart has no lanes)")


# ---- the processes ---------------------------------------------------------------------------------
# col is the column an element sits in, left to right; lane is the lane it sits in.

PROCESSES = [
    dict(
        id="about-corwin-line", name="Process: aboutcorwin.com's assembly line",
        title="How aboutcorwin.com updates itself: mint on gw33, a feed on corwin.cloud, a pull on the web host.",
        source="Drawn 2026-11-01 from about-corwin's public deploy scripts (deploy/mint-about-corwin.sh, deploy/pull-aboutcorwin.sh, deploy/schedule).",
        credit="about-corwin by Corwin and Bryant; the assembly line by Corwin",
        lanes=[("corwin", "Corwin"), ("minter", "gw33: the minter, every 17 minutes"),
               ("feed", "corwin.cloud/dist/about-corwin/: the feed"), ("puller", "The web host (DreamHost): the puller, every 17 minutes")],
        elements=[
            dict(id="push", role="task", act="go", lane="corwin", col=0, text="Push a change\nto main"),
            dict(id="tick", role="event", lane="minter", col=0, text="The timer fires"),
            dict(id="moved", role="gateway", lane="minter", col=1, text="Did main, or a\nfeed the site\nshows, move?"),
            dict(id="idle", role="event", end=True, lane="minter", col=2, text="Nothing new:\nnothing minted", row=-1),
            dict(id="check", role="task", act="describe", lane="minter", col=2, text="Run the checks\nthat run headless"),
            dict(id="build", role="task", act="describe", lane="minter", col=3, text="Build the site"),
            dict(id="publish", role="task", act="effect", lane="minter", col=4, text="Publish tarball,\nmanifest and feed"),
            dict(id="feed", role="data", lane="feed", col=4, text="channel.json:\nrevision, stamp,\nsha256, key"),
            dict(id="cron", role="event", lane="puller", col=0, text="Cron fires"),
            dict(id="read", role="task", act="describe", lane="puller", col=1, text="Read the feed"),
            dict(id="new", role="gateway", lane="puller", col=2, text="Is its key the\none installed?"),
            dict(id="same", role="event", end=True, lane="puller", col=2, text="Already installed:\nnothing to do", row=1),
            dict(id="fetch", role="task", act="describe", lane="puller", col=3, text="Download it;\ncheck its sha256"),
            dict(id="stage", role="task", act="propose", lane="puller", col=4, text="Stage a dated\nrelease (manifest\nchecked)"),
            dict(id="live", role="task", act="effect", lane="puller", col=5, text="Go live (the old\nweb root copied\naside first)"),
            dict(id="done", role="event", end=True, lane="puller", col=6, text="aboutcorwin.com\nupdated"),
            dict(id="left", role="event", end=True, lane="puller", col=4, text="Any failure: the\nsite is left as it\nwas; one log line", row=1),
        ],
        flows=[("push", "tick", "noticed on the next run"), ("tick", "moved", ""), ("moved", "idle", "no"), ("moved", "check", "yes"),
               ("check", "build", ""), ("build", "publish", ""), ("publish", "feed", ""), ("cron", "read", ""), ("feed", "read", "same origin, https"),
               ("read", "new", ""), ("new", "same", "yes"), ("new", "fetch", "no: a new revision"), ("fetch", "stage", ""),
               ("stage", "live", ""), ("live", "done", ""), ("fetch", "left", "sha256 wrong")],
    ),
    dict(
        id="gnu-upload", name="Process: a GNU release, uploaded as a triplet",
        title="How a GNU maintainer publishes a release: three files, two signatures, one robot.",
        source="Drawn 2026-11-01 from the GNU Maintainers guide, section 12.6.4, FTP Upload Directive File (gnu.org/prep/maintain).",
        credit="The process is the GNU Project's; drawn by Corwin, a GNU volunteer",
        lanes=[("maint", "The maintainer"), ("robot", "GNU's upload server (ftp-upload.gnu.org)"), ("ftp", "ftp.gnu.org and its mirrors")],
        elements=[
            dict(id="ready", role="event", lane="maint", col=0, text="A release is\nready: foo-1.0.tar.gz"),
            dict(id="sig", role="task", act="describe", lane="maint", col=1, text="Sign it, detached:\nfoo-1.0.tar.gz.sig"),
            dict(id="dir", role="data", lane="maint", col=2, text="The directive:\nversion: 1.2\ndirectory: foo\nfilename: foo-1.0.tar.gz"),
            dict(id="clear", role="task", act="propose", lane="maint", col=3, text="Clearsign it:\nfoo-1.0.tar.gz\n.directive.asc"),
            dict(id="up", role="task", act="go", lane="maint", col=4, text="Upload the three\nby anonymous FTP\nto /incoming/ftp"),
            dict(id="auth", role="gateway", lane="robot", col=4, text="Do both signatures\nverify against a\nregistered key?"),
            dict(id="no", role="event", end=True, lane="robot", col=5, text="Not published: register\nthe key with the\nadministrators", row=1),
            dict(id="place", role="task", act="effect", lane="robot", col=5, text="Place the file and\nits .sig in gnu/foo/"),
            dict(id="out", role="data", lane="ftp", col=5, text="ftp.gnu.org/gnu/foo/\nfoo-1.0.tar.gz\nand .sig"),
            dict(id="mirrors", role="event", end=True, lane="ftp", col=6, text="Available from\nftp.gnu.org and\nthe mirrors"),
        ],
        flows=[("ready", "sig", ""), ("sig", "dir", ""), ("dir", "clear", ""), ("clear", "up", ""), ("up", "auth", "the triplet"),
               ("auth", "no", "no"), ("auth", "place", "yes"), ("place", "out", ""), ("out", "mirrors", "")],
    ),
]
