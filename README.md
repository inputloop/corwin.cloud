<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# corwin.cloud

The website at corwin.cloud. Its home page is **topology**, the drawing app, with a tab strip below
it: one tab of full design detail for each public app (and for obsmage, which has a tab though it is
not public yet). Two more pages: a **directory** of every inputloop repository we can name, and the
**packages** we curate, each with its state said plainly (today, built, designed).

It reads well with scripts off. The one script is free software, labelled for GNU LibreJS (see
`jslicense.html`), served from this site, and adds real tabs, an Emacs-style mode-line and an Alt+x
prompt that jumps to a page or a project. The policy forbids inline script, inline style and any
other host.

## topology is not in this repository

topology (branch `corwin`) has been public since 2026-11-01 and carries Bryant Frankford's TopoForge. This repository still holds only the
shell: navigation, tabs, directory, packages, footer. At build time the build asks a local checkout
of topology to stage its own `www` (`sh bin/stage-www.sh DEST`) into `public/topology/`. Without a
checkout the home page says so in place of the app, and everything else still builds.

The build leaves out the staged `context/` folder (working notes for topology's own host) and
replaces the address of any repository still private (`PRIVATE_NAMES` in `catalog.py`) with "(private
repository, not public yet)"; topology's own address is public now and stays. `TOPOLOGY_KEEP_CONTEXT=1` keeps the folder.

## The drawings and the demos (2026-11-01)

The home page is TopoForge itself, full width, opened on **the shop, drawn**: one TopoForge page per
project the directory lists (the tabs along the bottom of the drawing), obsmage's workflows and
scenes, and Bryant Frankford's five-page drawing of how Gitcha works. `drawings.py` makes them at
build time from `catalog.py` and the `TOPOLOGY.md` files in topology's `examples/inputloop/`; they are
TopoForge's own JSON, opened with its own `?load=`, so they can be saved, changed and opened in any
copy of TopoForge. A person's own working copy is never replaced: `src/js/stage.js` opens the shop's
drawings only when TopoForge has kept nothing in this browser, and a button starts again on request.

`/demo/<id>/` has a page for every inputloop app: the ones that run in a browser run there, staged
at build time by `demos.py` from a checkout of the public repository (never committed here); the
rest say what they need and how to run them. `INPUTLOOP_DIR` (default `../inputloop`) is a folder of
checkouts (`quantum3d5`, `hello-taxgnomes`, `egad`, `gitcha`); a demo with no checkout says so. The
staged copy changes in two ways only: each inline script moves into a file beside its page, and the
page links `jslicense.html`. The policy for `/demo/*/app/` is written to `generated/demo-csp.conf`.

## The next pass (2026-11-01)

- **Every directory project has a `TOPOLOGY.md`** in topology's `examples/inputloop/` now, so no
  page in the drawing is made from the catalog alone (a check fails if one is).
- **Processes as data** (`processes.py`): lanes, and elements that say what they are (event, task,
  gateway, data, and for BPMN+ an act). The shape comes from the notation, read from topology's own
  `NOTATIONS` table at build time. Each process is a page in the drawing (BPMN) and a file in each
  notation (BPMN, BPMN+, flowchart), offered under the drawing on the home page.
- **NextTime's demo runs here** on pinned copies of Vue 3.5.44, Vue Router 4.6.4 and MapLibre 4.7.1
  (`vendor.py`): the npm registry's tarballs, checked by sha256 and sha512 at every build, kept in
  `VENDOR_CACHE` (default `~/.cache/corwin.cloud/npm`, fetched once), never in this repository.
  The staged copy's addresses on other hosts are replaced by the local copies (`rewrite` in
  `catalog.DEMOS`); staging is refused if one is left. Vue compiles that demo's templates in the
  page, so its folder alone gets `'unsafe-eval'` (written beside it in `generated/demo-csp.conf`).
- **about-corwin's Customize palette and Emacs CI strip are shared, not copied** (`share.py`): the
  build stages them from a checkout (`ABOUT_DIR`, default `../about-corwin`), unchanged.
- **Status lines from the channel feed** (`src/js/badges.js`): a card whose project has a channel
  reads `/dist/<channel>/channel.json` from this site (c4's `d/channels/SPEC.md`, line form) and
  says its last revision and stamp in words; with no feed the line stays hidden. The site policy's
  `connect-src` is `'self'` for this.

## The navigator (2026-11-01)

Beside the drawing, on the left, an Emacs frame lists everything the drawing draws (projects,
processes, hosts, people, paths, pages, demos) in layered categories: a tool bar of categories you
press (by kind, notation, pillar and what the catalog says each is) and a prompt whose words narrow
at the same time. Splits with their own mode-lines, pins that stay put, buffers as tabs, a context you
can bake into a buffer, and a right edge you can drag. `docs/NAV.md` says what it does and the rule
that decides what shows; `navindex.py` builds its one data file (`nav/index.json`) at build time from
the drawing's own sources; `src/js/nav.js` draws it, matching words with about-corwin's `taxonomy.js`
(staged by `share.py`, unchanged). With scripts off it is a plain list of links.

`docs/AMBITIONS.md` is our reading of what this site is for; `docs/UI-AUDIT-2026-11-01.md` lists
what differs from TopoForge as Bryant made it, and why each difference stays or went.

## Build

```sh
TOPOLOGY_DIR=../topology INPUTLOOP_DIR=../inputloop ABOUT_DIR=../about-corwin python3 build.py   # writes public/, deploy/topology-csp.conf, generated/demo-csp.conf
python3 -m http.server -d public 8000            # then open http://127.0.0.1:8000/
```

Python 3.8 or later, standard library only. `TOPOLOGY_DIR` defaults to `../topology`.

## Test

```sh
sh tests/run.sh                 # build, then every check
sh tests/run.sh --prove-red     # plant one fault per promise in a copy; each must turn a check red
```

The checks: every internal link resolves; every external link is on the allow-list of public
addresses in `catalog.py` (a private repository's address anywhere in the output fails); every tab
is reachable from a directory card; every directory project has its own page in the default
drawings, saying who made it as the directory does; nothing under a `## Private` heading and no
private host name is drawn; the navigator's index covers every drawn thing, gives a reason for every
category, carries no private name, and answers Projects + BPMN + "topology" the same way a second
reader in Python (`tests/nav_expect.py`) works it out from the sources; Bryant's drawing is his, byte for byte; every demo page names who made
it, its licence and how to run it; no staged demo page keeps an inline script; the ARIA tab pattern; no inline script or style; LibreJS
labels and the `jslicense.html` row; no machine paths or vendor strings; the deploy policy stays
strict. `tests/browser.cjs` drives the built site in Chromium at 1280 and 390 pixels, under the
deploy policies, with scripts on and off; it runs when the `playwright` package is installed. `tests/nav-browser.cjs` does the same for the
navigator (splits, pins, drag, buffers, the context light, the width, storage refused, scripts off),
and `--prove-red` plants a fault for each of those promises and runs it in the browser too.
Node 18 or later for the node checks.

## Change the words

`catalog.py` holds every card, tab, package and link. Link only public repositories: add the address
to `PUBLIC_URLS` and the test will accept it; a private repository gets a name and "not public yet",
never an address. Counts carry the date they were counted.

## Put it on gw33

`deploy/DEPLOY.md`, with an nginx server block in `deploy/nginx-corwin.cloud.conf`. DNS is Corwin's
to point.

## Licences

Code GPL-3.0-or-later OR LGPL-3.0-or-later; prose and diagrams CC-BY-SA-4.0. Texts in `LICENSES/`;
`REUSE.toml` says which covers which file. The mode-line footer and the build and test habits
(a plain build, checks that are shown able to fail) are reused from the aboutcorwin.com source.

Corwin and Bryant (BryantAndCorwin@inputloop.com) · Copyright 2026 INPUTLOOP
