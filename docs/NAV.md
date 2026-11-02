<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# The left nav: an Emacs frame beside TopoForge

Status: revision 2, written 2026-11-01 evening before its build (the first design, below the
revision, stands where the revision does not replace it). The QA plan for revision 2 is at the end of
its section. Correct it by editing this file.

## Revision 2: frameless, floating, every word earning its place (2026-11-01 evening)

### What Corwin asked (his words)

19:12, with a screenshot of the live page in dark mode: "It feels like we have one too many left nav
now. The elements below the mode-line don't look like the others: they break the mood. the bottom
footer text makes us seem very, very proud to be working so closely with bryant yet we don't give him
any link or, in fact, mention the licensing terms despite having quite a bit of room reserved for
ourselves. I prefer a frameless experience and movable pallets but mostly: I want all of the controls
and words on the page to make sense (and work)."

19:20: "if we consider that there is a floating Emacs (starting on the left) and a floating Officey
Properties control (starting on the right), then we can think in terms of a frameless experience with
floating lower disclosure/disclaimer/footer text done up to look like a physical architecture drawing
legend (grid of hairlines). Menus can live with the Emacs frame since it has menus. Tab controls
become part of the mini-map/nav thumbnail. Open to improvements and even other ideas, of course."

### What was observed before this revision

- The drawing did not load for him: his TopoForge page tab read "Page-1". Reproduced with Playwright
  against https://corwin.cloud/ (2026-11-01, `observe3.cjs` in the session's scratchpad): open
  `topology/topoforge/index.html` on its own (our own "Full size" link does exactly that), and
  TopoForge, finding nothing kept, opens its own sample ("Sample office network", one page named
  Page-1) and keeps it in this browser under `topoforge.autosave.v1`. Back on the home page,
  `stage.js` sees a kept working copy and, by design, opens it instead of the shop's drawings,
  saying so only in one line under the drawing. TopoForge's File, New does the same with an empty
  "Untitled topology" whose one page is also Page-1. Either way the shop never loads again in that
  browser until "Start again" is pressed. A fresh visit, a reload, and a visit to topology's own front
  door were all fine (the shop loaded each time).
- Two left columns: our navigator (a column of its own) and TopoForge's shape palette.
- Under the navigator's mode-line: a boxed input, a boxed button and a grey echo block, in faces the
  rest of the frame does not use.
- The line under the drawing named Bryant with no link and no licence, while the site's own colophon
  carries both.

The full inventory of what a visitor sees and presses on the home page, with what became of each, is
in `docs/UI-AUDIT-2026-11-01.md`, section "The home page, control by control".

### The shape of the page, revised

- **The drawing is full-bleed.** On a screen wider than 47.5rem the home page's first screen is
  TopoForge, edge to edge, from the top of the window to the page's own mode-line. No heading bar
  above it (the heading stays, for screen readers and with scripts off), no border, no frame title.
- **The site's top bar folds into the navigator's menus** on that screen: a **Site** menu (Home,
  Directory, Demos, Packages, About at aboutcorwin.com, JavaScript licences, Customize reading). The
  top bar stays in the page's markup and is shown again with scripts off and on narrow screens, where
  nothing floats. Customize's own button is hidden there (it sat over TopoForge's document name); the
  menu item presses it, and its panel opens where it always does.
- **The navigator is a palette, not a column.** It floats over the drawing, starting on the left,
  just right of TopoForge's shape palette (it reads that palette's width from TopoForge's page, which
  it may read: same site; it changes nothing there). It can be:
  - **moved**: drag its grip (the top row, "⠿ Navigator"); or focus the grip and use the arrow keys
    (16 pixels, Shift for 64); or, with one pointer and no drag, Window, Move left / right / up /
    down (WCAG 2.5.7);
  - **docked** left or right (the grip row's `left` and `right` buttons, or the Window menu): then it
    is a column beside the drawing, by the visitor's choice, and its edge drags (or arrow keys) to set
    the width; **floated** again with `float`;
  - **hidden to a strip** (`hide`): floating, only its grip row stays, where it was; docked, a strip
    28 pixels wide with "Navigator" written down it. `show` brings it back.
  - Its place, dock, width and strip state are kept per browser under one key for the palettes,
    `corwin.cloud.float.v1` (the navigator's buffers stay under `corwin.cloud.nav.v1`), read and
    written in try/catch; with storage refused it starts in its default place each visit.
  Its starting place: just right of TopoForge's shapes, below TopoForge's top bar, and down to the
  top of the legend, so the two palettes do not overlap on a first visit.
  Why float by default: Corwin asked for one left nav, frameless, and movable palettes. Docked by
  default would be the second column again; a strip by default would hide the categories he asked
  for. Floating over the empty left of the canvas keeps both palettes visible and the drawing whole;
  TopoForge's own fit-to-window still fits the drawing to the whole canvas, so the navigator may cover
  part of it until moved (said in Help, About).
- **Narrow screens** (47.5rem or less): nothing floats. The top bar shows, the navigator sits above
  the drawing and starts as its strip (one row: "⠿ Navigator ... show"), so the drawing is on the
  first screen; the dock buttons and Move items are not offered (they would do nothing).
- **The title bar goes.** Its "drawing: <page>" repeated TopoForge's own page tabs; `□` (widen)
  duplicated the edge; `_` becomes `hide`. The buffer's name moves to the mode-line, where Emacs keeps
  it.
- **The minibuffer is a real Emacs minibuffer**, one face with the frame: the prompt `Narrow: ` in
  the prompt face, then the input with no box (a caret and, on focus, an underline), then the action
  `[Pin as buffer]` drawn as an Emacs widget button (bracketed, in the link colour, no box), which
  does what "Pin results to a new buffer" did (also Ctrl+Enter, and Buffers, Pin results to a new
  buffer). Under it the echo area: plain text in the frame's face, no box. Same font, size, line
  height and background as the windows above; contrast AA from egad's tokens in both themes (checked
  by computing the ratio in the browser test).
- **The mode-line says words.** Before: `-:--- *nav* 86% ○ 63/63 shown · W1/1`. After:
  `*all*  63 of 63 shown`, then `· window 1 of 2` only when split, `· 2 pinned` only with pins, and a
  `kept filter: Projects+BPMN` button only in a buffer that keeps one (pointing at it or focusing it
  puts the filter in words in the echo area, as the light did). The flags, the scroll position and
  the unlit light are removed: none told a visitor anything. The second line (the item under the
  pointer, its description and categories) stays: it is the tooltip he asked for.
- **Words in the tool bar.** The facet names become Show, Notation, Is a (was Pillar: place, part,
  path, person) and Topic (was Says: the catalog's kinds). Each name says on hover and to a screen
  reader that pressing it folds the row.
- **The Mode menu becomes Filter**: "Keep this filter in this buffer" (C-c m), "Drop the kept filter"
  (C-c k), "Pin results to a new buffer" (Ctrl+Enter). "Mode", "bake" and "context" are gone from
  what a visitor reads.
- **Two hosts both named "a workstation"** are told apart in the navigator by the project that draws
  them: "a workstation (obsmage)", "a workstation (corwin.cloud)". Still no machine name.
- **The legend replaces the footer line.** Under the drawing, the credit becomes a title block as on
  an architect's drawing: a grid of hairline cells (1 pixel rules in egad's border colour).
  Cells: **Drawing app**: TopoForge, by Bryant Frankford (his public GitHub page,
  https://github.com/takushieternal, as about-corwin's `content/involvements/inputloop.txt` and
  `content/personae/bryant.txt` give it), with Corwin Brust and contributors; **Licence**: code
  GPL-3.0-or-later or LGPL-3.0-or-later, your choice; prose CC-BY-SA-4.0 (as TopoForge's
  `README.org`, "Licences", states it); **Source**: topology, branch corwin: `www/topoforge/` (the
  app served here) and `topoforge/` (its README, AUTHORS and licence texts); **Your drawing**: what
  you draw stays in this browser until you save it yourself (File, Export), with "Start again from
  the shop's drawings" and the drawings as a file; **Sheet**: "The shop, drawn: one page per
  project", the revision of this site and the date it was built. Bryant's cells take more room than
  ours. With scripts off it is a plain block under the drawing. With scripts on, on a wide screen, it
  floats at the bottom of the canvas, left of TopoForge's inspector, and can be dragged by its grip,
  moved with the arrow keys, or hidden to one row that still reads "TopoForge by Bryant Frankford ·
  GPL/LGPL · CC-BY-SA" with the link. It hides to that row by itself when focus goes into the drawing
  (so it never covers what has focus there) and its place is kept per browser like the navigator's.

### The drawing loads: what stage.js now decides

`stage.js` now reads the working copy TopoForge keeps (its name, its page names, and whether any page
has a shape), never writes it, and decides:

| What this browser keeps | What opens | What it says (in the legend's Your drawing cell; the last two also in a notice at the legend's top) |
|---|---|---|
| nothing | the shop's drawings (`?load=`) | nothing |
| an empty drawing (no shape on any page: TopoForge's File, New) | the shop's drawings | "The drawing kept in this browser was empty, so the shop's drawings are open." |
| TopoForge's own sample, unchanged (named "Sample office network", one page, 19 shapes, 15 links, as TopoForge makes it) | the shop's drawings | "This browser had kept TopoForge's own sample; the shop's drawings are open in its place." |
| the shop's drawings, with every page this build has | them, as you left them | "Showing the shop's drawings as you left them." |
| the shop's drawings from an earlier build (a page this build has is missing) | them, as you left them, with a notice at the top of the legend | "Your copy of the shop's drawings is older than this site: N pages are missing. [Open the current drawings]" |
| anything else: a drawing of your own | it, with a notice at the top of the legend | "This is your own drawing, kept in this browser: <name>. [Open the shop's drawings] (it replaces yours here; File, Export keeps a copy)" |

Nothing of a visitor's is lost: the two cases that replace a kept copy without asking are an empty
drawing and TopoForge's untouched sample, which hold nothing of theirs. The "Full size" link now
opens TopoForge on the shop's drawings (`?load=`) when this browser keeps no drawing of the
visitor's own, so it no longer plants the sample. **Falsifier:** a returning visitor whose browser
keeps an empty copy or the sample sees anything but the shop; or a visitor's own drawing is replaced
without their press. Chosen over (a) always loading the shop (loses their work) and (b) keeping the
old rule with a louder message (the shop still would not load for him).

### What TopoForge already lets the page do, unchanged

Checked in `www/topoforge/index.html` (topology, branch corwin, TopoForge 1.7):

- `?load=<same-site path>` opens a drawing; `window.TopoForge` offers `doc` (get and set), `select`,
  `fitView`, `render`, `importCSV`, the exporters and `story`.
- The drawing's own `settings` (in our JSON) set the grid, snapping, guides, labels and whether the
  **mini-map** shows (`minimap`), per drawing.
- Below 860 pixels of its own width TopoForge already turns its shape palette and its inspector into
  drawers that slide over the canvas (buttons in its top bar); at 1280 they are columns.
- Nothing lets the page move the inspector, fold the page tabs into the mini-map, or hide TopoForge's
  top bar; and nothing says what is selected. Restyling TopoForge from outside (writing CSS into its
  document) would be a change to TopoForge in all but name, so it is not done.

### The TopoForge-side changes, proposed (not made: topology's AGENTS.md keeps `www/topoforge/` unchanged)

Credit: TopoForge is Bryant Frankford's; these would go into topology (branch corwin) under
`www/topoforge/`, with a version bump (1.8), his name first in AUTHORS as now, and only after Corwin
lifts the line "Keep www/topoforge/ unchanged". inputloop/topoforge (the frozen reference copy) is not
touched.

1. **An embed switch.** `?embed=frameless` (or `window.TopoForge.embed({ chrome: false })`): hide the
   top bar's brand and document name, drop the outer borders, and let the host page draw its own
   chrome. The File, Edit, Arrange, Layout, View and Help menus stay reachable (from a compact menu
   button, or offered to the host through `window.TopoForge.menus()` so our Emacs menu bar can carry
   them, as Corwin's "menus can live with the Emacs frame" asks).
2. **The inspector as a floating panel, starting on the right.** `#side` becomes `position:
   absolute` over the canvas in frameless mode, with a grip (drag, arrow keys, and Move buttons for
   one pointer), dock right or float, hide to a strip; its place kept under TopoForge's own key
   (`topoforge.ui.v1`). The same code path as its below-860-pixel drawer, kept open.
3. **The shape palette the same way**, starting on the left, so all three (shapes, navigator,
   inspector) are palettes of one kind.
4. **Page tabs folded into the mini-map.** In frameless mode `#pagetabs` moves into the mini-map's
   box: the thumbnail on top, a strip of page names under it (scrolling, with the current page
   marked), plus a "pages" button that opens the full list. The mini-map itself becomes movable like
   the palettes.
5. **The selection hook** (already proposed above under "The title bar: its areas", item 5): a
   `selection` getter and a `topoforge:select` event from `setSel`, so the navigator's mode-line can
   show the selected shape's tooltip.
6. **A ready event**: `topoforge:ready` on `window` once a `?load=` has finished (or failed), so the
   page need not poll `TopoForge.doc` to know which drawing is open.

Each of these is a promise to test in TopoForge's own kit (`topoforge/kit`, `bin/test.sh`) with a
planted fault, as the rest of 1.6 and 1.7 were.

### QA plan for revision 2 (written before the build)

Where each runs: Python in `tests/check_site.py`; node in `tests/check.mjs`; the browser in
`tests/home-browser.cjs` (new: Chromium, 1280 and 390 pixels, light and dark, under the deploy
policies) and `tests/nav-browser.cjs` (updated). Every check gets a planted fault in
`tests/run.sh --prove-red`.

TOWER
- The drawing loads for a returning visitor whose browser keeps an empty copy, or TopoForge's
  sample: the shop's drawings open. (browser; plant: `stage.js` treats any kept copy as the
  visitor's)
- A visitor's own drawing is kept, with the notice at the top of the legend and the button that opens the
  shop's; an older copy of the shop's gets its own notice. (browser; plant: the notice not shown)
- "Full size" carries `?load=` when nothing of the visitor's is kept. (browser; plant)
- The navigator floats by default at 1280 (not a grid column: the drawing is as wide as the stage);
  dragging the grip moves it; Arrow keys on the grip move it 16 pixels; Window, Move right moves it
  with one press; docking left makes it a column and the drawing narrower; float brings it back;
  hide leaves only the grip row; every one of these survives a reload. (browser; plants: the default
  docked; the place not kept; no keyboard move; no Move menu items)
- The Site menu carries every link of the top bar, and its Customize item opens Customize's panel.
  (browser; plant: a link dropped)
- Every control in the inventory marked "works" and testable: the menus' every item does something
  that the echo or the page shows; no button is left that does nothing. (browser, walking every menu
  item and every grip button; plant: a menu item with no command)
LADDER
- With scripts off: the top bar, the plain list of links, and the legend as a block, all present.
  (browser, Python)
- The minibuffer's prompt, input, action and echo share the windows' computed font family, size and
  background; the input has no box (border width 0 on three sides); text-to-background contrast is AA
  (4.5:1) in light and dark. (browser; plant: the input boxed again)
- Every grip and button has a name; the grip says how to move it without a mouse. (browser)
SIGNAGE
- The legend names Bryant with his public link, states the licence as TopoForge's README.org does,
  and links the two source folders in topology; with the legend hidden its row still names him and
  links him. (Python on the built page, and browser; plants: the link dropped, the licence altered)
ROOF
- No inline script or style; LibreJS labels and jslicense rows for every script (float.js is new);
  no request to another host; no console errors. (Python, node, browser; existing plants plus one for
  float.js's row)
- Every external address in the legend is on `PUBLIC_URLS`. (Python; the existing plant shape)
PEERING: TopoForge, unchanged, through `?load=`, `window.TopoForge.doc`, its page tabs, and reading
(never writing) its kept working copy and its palette's width. (browser)
REMOTES: the TopoForge-side proposal above is written, not built.
DOME
- Storage refused: the navigator and the legend still render, float, move and filter. (browser)
- No sideways scroll at 1280 and 390 in either theme. (browser)
- The legend hides itself when focus goes into the drawing. (browser; plant)

Manifest: none owed.

## The first design (2026-11-01 afternoon)

### What Corwin asked (his words, 2026-11-01)

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
