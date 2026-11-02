<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# The left nav: an Emacs frame beside TopoForge

Status: design, written 2026-11-01 before the build; the QA plan is at the end. Correct it by editing
this file.

## What Corwin asked (his words, 2026-11-01)

"Use what we understand about taxonomy AND about layered categorization to build out our left nav so
it is modeled on the aboutcorwin interface, with the mode-line showing the hovered/selected shape's
tool-tip and other categorization/contextualization/instrumentation."

1. "Prompts can filter while a tool-bar at the top of the nav lets us simply press categories by
   shape/label: both can be in effect, such that we might press BPMN and Projects and type topology
   and see the Projects section with topology and aboutcorwin and corwin.cloud as projects that
   reference it and also have something to say about BPMN [...] while removing most of the other
   categories unless they happened to be pinned down, simulating Emacs' window splitting, giving
   splits their own mode-line but not title bars, and allowing the pinning to be used to keep things
   stationary as well as visible and at the item and group level, and enabling dragging of items
   around in the pinned section (always shown, in each split)."
2. "Enable making new 'buffers' (tabs) for the left nav, showing the tab group once the second buffer
   exists and emulating Emacs' tab-bar, so these do get their own tool-bars."
3. "Enable switching 'mode' of the buffer as if a prompt filter result was installed in the context
   for that buffer, then add a control for the input/prompt area to create a new buffer pinning the
   results [...] enable a pinned-context indicator on the mode-line [...] when hovered, it should put
   the context detail into the message/input area."
4. "Make sure we handle dragging the width of that left column's right edge."
5. "Make sure that we are thinking now about areas of that title bar."

"We want to achieve the effect of the Emacs which frames the aboutcorwin site living inside the left
nav of the corwin.cloud site."

## The shape on the page

The home page's stage becomes two columns: the nav frame on the left, TopoForge (unchanged, in its
frame) on the right. The nav frame is drawn as an Emacs frame, top to bottom:

| Part | Emacs name | What it does here |
|---|---|---|
| Title bar | frame title | Three areas (below). |
| Menu bar | menu-bar | One row of menus: Buffers, Window, Mode, Help. Each opens its commands below it, with their keys; Escape closes it. Every key in the nav has a command here or a button on the item. |
| Tab bar | tab-bar | Hidden while there is one buffer; appears with the second. One tab per buffer, each with a close button. |
| Tool bar | tool-bar | The categories, as buttons that stay pressed, each with the shape TopoForge draws it with and its label. One tool bar per buffer: switching tabs switches tool bars. Each facet's name folds its row; "Says" starts folded (seven long labels), and a folded row still shows what is pressed in it. |
| Windows | windows | One to four windows (splits) on the buffer. Each has a pinned area at its top, the sections below, and its own mode-line. No window has a title bar. |
| Echo area and prompt | minibuffer | The prompt that filters the current buffer, the "pin results to a new buffer" button, and the echo line where messages and the context detail appear. |

The right edge of the frame is a handle: drag it, or focus it and use the arrow keys, to change the
width; the width is kept in this browser.

Without scripts the frame is a plain list: one heading per section and a link per item, each link
opening that item's page in the drawing (`index.html?drawing=...`) or its demo page. Nothing else is
needed to use it.

## The categories: facets, and what puts an item in one

Every item in the nav is something the drawing draws: a project, a process, a host, a person, a path,
a drawing page, a demo. An item can be in several categories at once; the categories come in four
facets.

| Facet | Values (tool-bar buttons) | An item is in a value when |
|---|---|---|
| Show (section) | Projects, Processes, Hosts, People, Paths, Pages, Demos | it is that kind of thing. Each item has exactly one section. |
| Notation | BPMN, BPMN+, Flowchart | it has something to say in that notation: it says the word itself (in the catalog, its `TOPOLOGY.md`, or a part it contains); or a process drawn on this site names it (it takes part in BPMN it does not draw as a shape of its own); or the notation table the processes are drawn with is read from its source (it defines the notation). Flowchart also when its page draws "how it works" as a flowchart. BPMN+ is BPMN with more, so saying BPMN+ counts for BPMN too. |
| Pillar | place, part, path, person | its own pillar is that one, or its page draws something of that pillar (a host on a project's page puts the project in "place"). |
| Says | the catalog's kinds: Apps, Games, Learning, Claude and agents, Security, Platform and packaging, Sites and community | the catalog files it under that kind (projects and their demos only). |

Every membership carries its reason as a sentence ("a process drawn here names it: aboutcorwin.com's
assembly line"), and the mode-line shows the reasons for the item under the pointer.

The index is built at build time by `navindex.py` from the same sources the drawing uses
(`catalog.py`, the `TOPOLOGY.md` files, `processes.py`, topology's notation table, and the drawing's
own pages) into one file, `public/nav/index.json`, read by `js/nav.js` from this site. Private parts of
a `TOPOLOGY.md` never reach it, and a host that is not a public ghostwheel name is "a workstation", as
in the drawing.

## The rule that decides what shows

A context is: the pressed Show buttons, the pressed buttons of the other facets, and the prompt's text.

- **Sections.** With no Show button pressed every section shows; with some pressed only those show,
  except a pinned section.
- **Facets.** Within a facet the pressed buttons are alternatives (BPMN or Flowchart); across facets
  every facet must hold (BPMN and place). A facet with nothing pressed asks nothing.
- **Words.** Every word of the prompt must be one the item says (its words are its name, its own
  text, the text of the parts it contains, and the names of what its page draws it connected with,
  either way). The name of a machine the drawing calls "a workstation" is never one of its words. A word matches a
  word the item says when it is the same, a plural of it, or the start of it (three letters or more):
  the matching rule of aboutcorwin.com's prompt (`taxonomy.js`, similarity 0.8 or more), staged from
  about-corwin at build time and used unchanged. Its looser matches (one typo) are not admitted; the
  echo offers them as "did you mean".
- **Both at once.** An item shows when its section shows, every facet holds, and every word matches.

### The example from his words, and our hypothesis before the build

Press Projects and BPMN, type `topology`. Corwin expected topology, aboutcorwin and corwin.cloud.

Our reading of the data, written before the build: **topology and corwin.cloud**. topology says
"topology" and defines the BPMN and BPMN+ notations (the table the processes are drawn with is read
from its `www/js/topology-core.js`). corwin.cloud's `TOPOLOGY.md` says its front door is TopoForge and
it connects to topology-www, and the assembly-line process names it (the feed lane). about-corwin has
BPMN (the same process names it) but nothing it says about itself names topology. **Falsifier:** the
built nav shows a different set, or the check that recomputes it in Python from the data disagrees
with the browser. If Corwin wants about-corwin in that answer, one of two forks: about-corwin's
`TOPOLOGY.md` says what it shares with corwin.cloud (the palette and the CI strip, staged into a site
whose front door is topology), or "reference" grows to one hop (an item also says what the things it
connects to say). Neither is taken here.

## Pins

- **Pin an item:** it moves into the pinned area at the top of every window of that buffer and stays
  there whatever the filter. If the filter would not show it, it stays, marked "outside this filter".
- **Pin a section (group):** the section moves into the pinned area, keeps its place, and is never
  removed by the Show buttons; its items still follow the filter, and its heading says "0 of 9" rather
  than vanishing.
- **Order:** drag a pinned entry to reorder (pointer), press its up arrow (one tap, for touch screens,
  where browsers do not drag, and for anyone who cannot drag: WCAG 2.5.7), or Alt+Up and Alt+Down on a
  focused pinned entry (as org-mode's M-up and M-down). The order is the buffer's and is kept in this
  browser.
- Pins belong to the buffer, so every split of it shows the same pinned area (Emacs shows one buffer
  in two windows the same way).

## Buffers, modes and the pinned context

- A buffer is a tab. Each has its own tool bar, prompt text, pins and windows. "New buffer" (or
  C-x t 2) makes one with nothing pressed; the tab bar appears once there are two.
- A buffer's **mode** is a context baked into it: a list of contexts that must all hold, then the
  live tool bar and prompt narrow further inside it. A baked buffer's flags read `%%` (read-only, as
  Emacs marks a read-only buffer); a live one reads `--`.
- **Pin results to a new buffer** (the button by the prompt, or Ctrl+Enter in the prompt): bakes the
  current buffer's mode plus its live tool bar and prompt into a new buffer, named from the context,
  and switches to it; if a buffer with exactly that baked context and nothing live already exists, it
  switches there instead. With one tab and a filtered prompt, pressing it makes the second tab.
- **Set mode** (Mode menu, C-c m): bakes the live context into the current buffer; **Clear mode**
  (C-c k) returns it to live.
- The mode-line's **context light** is lit in a baked buffer. Pointing at it or focusing it puts the
  context in words into the echo area ("Context: Show Projects; Notation BPMN; words: topology").

## Splits

- C-x 2 splits the selected window above and below; C-x 3 side by side; C-x 0 closes it; C-x 1 keeps
  only it; C-x o moves to the next. The same commands are buttons in the menu bar.
- At most four windows per buffer (four is the house's GRAIN number, chosen because a number had to
  be picked, not measured). On a narrow screen a side-by-side split is drawn stacked.
- Each window has its own scroll position, its own point (the selected item) and its own folded
  sections, and its own mode-line. Emacs keeps folding per buffer; here it is per window, so two
  windows on one buffer can show different sections.

## The mode-line, per window

`-:--  *nav*  Top  ●  Projects 2/21 · 3 shown · W1/2 · 1 pinned  |  topology: the drawing app ... · project · BPMN, Flowchart · part, place · Apps`

Left to right: flags (`%%` when baked), buffer name, position (Top, Bot, All or a percentage of the
window), the context light, counts (shown of total, per section when one is pressed), window number,
pins; then the item under the pointer, or the window's point when nothing is pointed at: its tooltip
(the one-line description the drawing gives it) and its categories with their reasons on focus. When
TopoForge's page changes, the item for that page becomes the point of the selected window.

## Keys

Only while focus is inside the nav, never single keys, and never Ctrl+N, T or W (Chrome keeps them):
C-x 2, C-x 3, C-x 0, C-x 1, C-x o, C-x t 2, C-x t 0, C-x t o, C-x { and C-x } (narrower, wider),
C-c p (pin the item at point), C-c m (set mode), C-c k (clear mode), Alt+x (the nav's prompt; outside the nav it is the
site's own prompt, as before), Up and Down in a window's list, Enter to open, Alt+Up and Alt+Down to
reorder a pin, Escape or C-g to clear the prompt, close a menu or cancel a prefix. Let go of Ctrl
before the second key: Chrome keeps Ctrl+1 to Ctrl+9 for its own tabs. In the prompt, Ctrl+X is cut,
as browsers expect. "Keys" in the menu bar lists them in the echo area.

## The title bar: its areas

Built now:

1. **Frame title** (left): the buffer's name and, in a baked buffer, its context in short form. (Not
   copied into the page's own title: the browser tab keeps saying corwin.cloud.)
2. **Drawing** (middle): the name of the TopoForge page in view, read from TopoForge's own document.
3. **Frame buttons** (right): `_` collapses the frame to a strip (`▸` brings it back) and `□` toggles
   between your width and wide (up to 60% of the page), as a window manager's iconify and maximize.
4. **Menu bar** under it (see the table above): built, as one row of menus.

Planned, not built:

5. **The selected shape**, not only the page. A proposal, not built: TopoForge does not say what is
   selected (`setSel` is inside it; `window.TopoForge` offers `doc`, `select` and `fitView`, but no way
   to read the selection or hear it change). The hook we would want is one line beside `select` in
   `window.TopoForge`: a `selection` getter returning the selected ids, and a `topoforge:select` event
   on `window` from `setSel`, so the nav could map a shape's `data.tf_ref` to its item and show that
   shape's tooltip on the mode-line. It would go in topology (branch corwin) under `www/topoforge/`,
   credited to Bryant Frankford as TopoForge's maker, with a version bump, and only once Corwin changes
   topology's AGENTS.md line "Keep www/topoforge/ unchanged". inputloop/topoforge is a frozen reference
   copy and is not changed. Until then the nav follows the page in view (`TopoForge.doc.cur`) and
   presses TopoForge's own page tabs, both already there.
6. **Double-click the title to widen**, as window managers do.
7. **A second frame** (C-x 5 2): the nav as a floating frame over the drawing.
8. **Resizing one split** against another (drag the mode-line between them).
9. **The frame title in the page's own title**, if Corwin wants the browser tab to name the buffer.

## What it keeps, and where

Everything in this browser's storage under one key, `corwin.cloud.nav.v1`, read and written inside
try/catch; with storage refused the nav still works and forgets on reload. Nothing is sent anywhere:
the one request is `nav/index.json` from this site. No inline script or style; `js/nav.js` and the
staged `js/taxonomy.js` carry their LibreJS labels and rows in `jslicense.html`. Colours are egad's
tokens; motion respects reduced motion (nothing in the nav animates when it is asked not to); every
button and region has a name for screen readers; the echo line is a polite status.

## QA plan (written before the build)

Each promise gets a check and a planted fault in `tests/run.sh --prove-red`. Where it runs: the
Python and node checks in `tests/run.sh`; the browser checks in `tests/browser.cjs` (Chromium, 1280 and
390 pixels).

TOWER (the feature at reach)
- The index: every directory project, process, demo and drawing page is an item; every item's section
  is one of the seven; every facet value has a reason. (Python)
- The example: Projects + BPMN + "topology" gives exactly the set Python computes from the data,
  and the set is non-empty and includes topology. (Python on index.json, Python again from the sources;
  browser against the Python answer)
- Splits: C-x 2 and C-x 3 make windows, each with a mode-line and no title bar; at most four. (browser)
- Pinned items survive filtering, in every split. (browser)
- Drag reorder of pins persists across a reload; Alt+Up does the same. (browser)
- Tabs: no tab bar with one buffer; a tab bar at the second. (browser)
- Pin to buffer: creates a tab with the context baked; pressed again with the same context, switches
  instead of making a third. (browser)
- The context light: lit in the baked buffer, not in a live one; pointing at it puts the context in
  the echo. (browser)
- Resize: dragging the edge changes the width and the width survives a reload; arrow keys do too.
  (browser)
LADDER (access)
- Without scripts the nav is a list of links, one per item, each a real address. (Python, browser)
- Every button in the frame has a name; the echo is a status; the separator has a value. (browser)
- Reduced motion: no transitions in the nav. (CSS check, node)
SIGNAGE
- The echo says why an item matched and offers "did you mean" for a word that matches nothing.
  (browser)
ROOF
- No request to another host; no console errors; nav.js asks only for `nav/index.json`. (browser,
  node)
- No inline script or style; LibreJS labels and rows for nav.js and taxonomy.js; taxonomy.js staged
  byte for byte from about-corwin. (Python, node)
- No private part, no private repository address and no workstation name in the index. (Python)
PEERING: declined; there is no peer. The nav talks only to TopoForge in the same page, through its
documented `window.TopoForge.doc` and its own page tabs, and refuses to change a working copy of the
person's own, as `stage.js` does (browser).
REMOTES: TopoForge is not changed in this pass; about-corwin's taxonomy.js is used unchanged.
DOME
- Storage refused: the nav still renders and filters. (browser)
- No horizontal scroll at 1280 and 390 pixels. (browser)

Manifest: none owed.
