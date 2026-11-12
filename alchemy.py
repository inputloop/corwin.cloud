# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later
"""alchemy: the combine-and-split game's page, /alchemy (alchemy.html).

The decks are made in c4 as atoms (c4/alchemy/decks, one file per reaction) and folded into one table
each by c4's h/al1ch; the folds are carried here in src/alchemy/DECK.tsv so the site builds without a
c4 checkout. With one beside it (C4_DIR, default ../../c4), `python3 alchemy.py --refresh` refolds them,
and the checks compare the copies with a fresh fold (they say NOT CHECKED when there is no checkout).

The fold (c4/man/al1ch.md): about TAB deck TAB title TAB sentence / start TAB id / name TAB id TAB display /
rx TAB a TAB b TAB product TAB why. This module reads it a third way, after the sh tool and the Perl reader.
"""
import html
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DECK_DIR = os.path.join(ROOT, "src", "alchemy")
DECKS = ("classic", "c4")          # the order the page offers them
KEY = "corwin.cloud.alchemy.v1"    # the one name the game keeps in the browser (privacy.html lists it)
e = html.escape


def c4_dir():
    return os.environ.get("C4_DIR") or os.path.join(ROOT, "..", "..", "c4")


def read(deck, text=None):
    if text is None:
        with open(os.path.join(DECK_DIR, deck + ".tsv"), encoding="utf-8") as f:
            text = f.read()
    d = {"id": deck, "title": deck, "says": "", "start": [], "names": {}, "rx": []}
    for line in text.split("\n"):
        if not line:
            continue
        f = line.split("\t")
        if f[0] == "about" and len(f) == 4:
            d["title"], d["says"] = f[2], f[3]
        elif f[0] == "start" and len(f) == 2:
            d["start"].append(f[1])
        elif f[0] == "name" and len(f) == 3:
            d["names"][f[1]] = f[2]
        elif f[0] == "rx" and len(f) == 5:
            d["rx"].append(f[1:])
        else:
            raise ValueError("%s.tsv: not a fold row: %r" % (deck, line))
    return d


def name(d, i):
    return d["names"].get(i, i)


def elements(d):
    """Every element, in the order the fewest combinations reach it (then by name)."""
    lv = {s: 0 for s in d["start"]}
    changed = True
    while changed:
        changed = False
        for a, b, p, _ in d["rx"]:
            if a in lv and b in lv:
                l = max(lv[a], lv[b]) + 1
                if p not in lv or l < lv[p]:
                    lv[p] = l
                    changed = True
    return sorted(lv, key=lambda k: (lv[k], k)), lv


def data():
    """The decks as the browser game reads them (alchemy-decks.json)."""
    out = []
    for deck in DECKS:
        d = read(deck)
        order, lv = elements(d)
        out.append({"id": deck, "title": d["title"], "says": d["says"], "start": d["start"],
                    "names": d["names"], "rx": d["rx"], "count": len(order), "depth": max(lv.values())})
    return {"key": KEY, "decks": out}


def fresh_fold(deck):
    """(text, None) from c4's al1ch, or (None, why) when there is no c4 checkout to ask."""
    tool = os.path.join(c4_dir(), "h", "al1ch")
    if not os.path.isfile(tool):
        return None, "no c4 checkout at %s" % os.path.normpath(c4_dir())
    r = subprocess.run(["sh", tool, "fold", deck], capture_output=True, text=True)
    if r.returncode != 0:
        return None, "al1ch fold %s failed: %s" % (deck, r.stderr.strip())
    return r.stdout, None


def book(d):
    rows = []
    for a, b, p, why in d["rx"]:
        rows.append("<tr><td>%s + %s</td><td>%s</td><td>%s</td></tr>" % (e(name(d, a)), e(name(d, b)), e(name(d, p)), e(why)))
    return ('<details class="al-book"><summary>%s: the whole recipe book (%d reactions)</summary>'
            '<table><thead><tr><th scope="col">Together</th><th scope="col">Make</th><th scope="col">Why</th></tr></thead>'
            "<tbody>%s</tbody></table></details>" % (e(d["title"]), len(d["rx"]), "".join(rows)))


def page_body():
    """The page's main, with scripts off complete in itself; alchemy.js builds the game inside #al-game."""
    decks = [read(x) for x in DECKS]
    first = "".join("<li><strong>%s</strong>: %s. <span class=\"hint\">%s</span></li>"
                    % (e(d["title"]), ", ".join(e(name(d, s)) for s in d["start"]), e(d["says"])) for d in decks)
    return """<main id="main" class="wrap wide al">
<h1>Alchemy</h1>
<p class="lede">Put two things together and see what they make. Pull one apart and see what it was made of. Every deck starts with a little first matter; everything else is found.</p>
<p class="al-addr">The short address of this page: <a href="/alchemy">corwin.cloud/alchemy</a> (the same page as <a href="/alchemy.html">alchemy.html</a>).</p>
<div id="al-game" class="al-game" data-src="alchemy-decks.json">
<noscript><p class="al-off">The game needs JavaScript (one script, served from this site, free software: <a href="jslicense.html" rel="jslicense">its licence</a>). Without it, here is how it works, and the recipe books below are the whole game.</p></noscript>
</div>
<section class="al-how" aria-labelledby="al-how-h">
<h2 id="al-how-h">How it plays</h2>
<ul>
<li><strong>Combine</strong>: choose two things you have found (or one thing twice). If they make something, it is yours, with a line on why.</li>
<li><strong>Split</strong>: choose one thing to see every pair that makes it. A pair can name something you have not found yet; that is a clue.</li>
<li>First matter does not split. Some things can be made two ways.</li>
</ul>
<h3>The decks</h3>
<ul>%s</ul>
</section>
<section class="al-books" aria-labelledby="al-books-h">
<h2 id="al-books-h">The recipe books</h2>
<p class="hint">Closed until you open them. They are the decks as written, one file per reaction, in c4's <code>alchemy/decks</code>.</p>
%s
</section>
<p class="hint al-note">A test page, not in the menu yet. The game remembers what you have found in this browser only, under one name listed in <a href="privacy.html#games">what this site keeps in your browser</a>, where one press forgets it. Nothing is sent anywhere.</p>
</main>
""" % (first, "".join(book(d) for d in decks))


if __name__ == "__main__":
    if sys.argv[1:] == ["--refresh"]:
        for deck in DECKS:
            text, why = fresh_fold(deck)
            if text is None:
                sys.exit("alchemy: NOT REFRESHED: " + why)
            with open(os.path.join(DECK_DIR, deck + ".tsv"), "w", encoding="utf-8") as f:
                f.write(text)
            print("alchemy: %s.tsv refolded (%d rows)" % (deck, text.count("\n")))
    else:
        print(__doc__)
