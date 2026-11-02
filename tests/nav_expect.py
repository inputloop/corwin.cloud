#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
"""What the left nav must show for a context, worked out here in Python, apart from js/nav.js.

    SITE_OUT=public python3 tests/nav_expect.py '{"show":["projects"],"f":{"notation":["bpmn"]},"q":"topology"}'

prints the ids that qualify, one per line. The rule is docs/NAV.md's, written again from the words
there (not imported from navindex.py), so the browser's answer is checked against a second reader:
a section shows when every context lets it; within a facet the pressed values are alternatives, and
every facet must hold; every word of the prompt (less the index's stop words) is one the item says:
the same word, a plural, or the start of one, three letters or more.
"""
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("SITE_OUT", os.path.join(ROOT, "public"))


def words_of(text):
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(c for c in t if not unicodedata.combining(c)).replace("‘", "'").replace("’", "'")
    return [w.strip("-'.") for w in re.split(r"[^a-z0-9'+.-]+", t) if w.strip("-'.")]


def matches(w, t):
    return w == t or w + "s" == t or t + "s" == w or (len(w) >= 3 and t.startswith(w))


def qualifies(item, ctx, stop):
    if ctx.get("show") and item["section"] not in ctx["show"]:
        return False
    for facet, pressed in (ctx.get("f") or {}).items():
        if pressed and not any(v in item["facets"].get(facet, []) for v in pressed):
            return False
    return all(any(matches(w, t) for t in item["words"]) for w in words_of(ctx.get("q", "")) if w not in stop)


def expect(index, ctxs):
    stop = set(index.get("stop", []))
    return [it["id"] for it in index["items"] if all(qualifies(it, c, stop) for c in ctxs)]


def load(out=OUT):
    with open(os.path.join(out, "nav", "index.json"), encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    ctx = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    for i in expect(load(), ctx if isinstance(ctx, list) else [ctx]):
        print(i)
