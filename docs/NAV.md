<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# The left nav: an Emacs frame beside topology forge (formerly TopoForge)

Status: revision 5, 2026-11-02 morning: **yes, and**. The navigator of revisions 1 to 3 comes back in
free beside the shape finder; the legend is one line; the frame moves, widens and grows its three
lines together; the tool-bar is icons in even groups; a light switch for the layout that never moves.
Revisions 4 and earlier, below, stand where revision 5 does not replace them. Correct it by editing
this file. Revision 6 (2026-11-02, late morning), next, adds to revision 5 and replaces only what it
names. The newest is revision 9 (2026-11-03), first below; each adds to those before it and replaces
only what it names.

## Revision 9: topology forge 1.12's card that fills the map, and the pad that pages it (2026-11-03)

### What Corwin asked (his words, 2026-11-03, relayed with the task)

"the text in the mini-map when we show info be LARGER: fill as much space as that gives ... Why no images?
... baseball or flashcard or scoreboard or boxscore highlights, or several of these paginated ... this
could be the dpad's function when one is highlighted, changing the color and maybe even rotating the dpad
45deg".

topology forge 1.12 (topology, branch corwin, `ee1475a`, read-only) answers it with two switch words, off
unless a page asks: `bigcard` (the card fills the map, its words as large as fit, a large picture, its
facts a box score or lines, several matches as pages, "2 of 5") and `cardpad` (while a card shows, the
map's pad turns 45 degrees, takes the accent colour, and its arms page the cards). Its spec,
`topoforge/spec/EMBED-v1.md`, "Added in 1.12", says the calls.

### What the page does

| Control or call | What the page does | Intention |
|---|---|---|
| `bigcard`, `cardpad` | asked for in **free only**, at ready, in the one call that asks for free's other words | the card fills the map and the pad pages it, where he asked for them |
| every word named | the call names each switch the page relies on (`map`, `preview`, `mappad`, `bigcard` too), though in 1.12 `cardpad` turns those on by itself: an older app ignores a word it does not know | no switch left to another's implication; a check holds each name |
| classic | unchanged: its address asks `select,ready,reset`, never `preview`, so its map shows no card and no pad | revision 8's words: classic keeps its menus |
| the card the page sends | as revision 7 made it: a title, up to eight facts, one statement, and art that is only ever the app's own picture (`{ shape }`, or `'matches'`, which with `bigcard` is the matches' pictures side by side). No picture of the page's own (`{ src }`) is sent; a check fails on art from any other origin | the card gets all it can use, and nothing from another host |
| **a pressed item's card stays** | a press (click or Enter) on an item in the finder or the navigator that opens a page keeps that item's card in the map; when a hover ends, the map shows the kept card again, as it shows the selection's card; it says so in the echo area ("gitcha's card stays in the map, 1 of 3: the map's pad pages it; C-g puts it away.") | without it no pointer could reach the pad while a card shows (found while building, below) |
| put away by | **C-g** in a frame (also M-x keyboard-quit, and C-g ending a key sequence from the drawing): "Quit (the card kept in the map is put away)."; a shape selected in the drawing; another page in view | Emacs's quit; the selection's card takes the map; a card about another page's shapes is stale |
| a turned page stays turned | the kept card is not asked for again while it is the one in the map, so a hover's end does not send it back to "1 of N" | a page the person turned is theirs |
| narrow screens | nothing is kept (the selection's card is not shown there either); 1.12's sheet along the drawing's foot comes and goes with the pointer | the sheet covers 42 % of the drawing; it should not stay unasked |
| frames end above the turned pad | turned, the pad's grip reaches 28 pixels above the map (half the 132-pixel cross's diagonal, 94, less half the map's 130); a frame's first height, and the height it is given when the map moves, end 12 above that, not above the map | found by the check at 1366x768: frame 2 covered 16 pixels of the grip |
| with 1.11 or older | none of the above runs: the kept card, the reach and the words the app does not know are each gated on 1.12 | the page works with the app it is given |

### Found while building (2026-11-03)

- **A hover card could never be paged.** The card shows while the pointer is on an item and goes 400 ms
  after it leaves; a press opens the item's page, and the app's select message for that page cleared the
  card too. The map's pad is beside the map, far from the frames, so the pad was turned only while nobody
  could reach it. Hence the kept card, on a press only: passing over other items on the way to the map
  shows their cards for a moment, and the kept card comes back 400 ms after the last.
- **At the map's first size an item's card shows no facts.** In a 190 by 130 map 1.12 leaves out every
  fact before it leaves out the statement, and an item's statement is the catalog's description (one or
  two sentences). Gitcha's card on the shop's page is its title at 40 pixels and its picture; cards with a
  short statement do show facts: the Security tile 3 of 3, Firewall 2 of 4, the selection 2 of 3
  (counted 2026-11-03, 1280x800). A larger map shows more. Left for Corwin (below).
- **The turned pad reached under frame 2** at 1366x768 (above). At 1280x800 it cleared by 6 pixels.
- **A map laid out after ready.** The push's own run of the checks failed once: at 1366x768 frame 2's
  first box (foot at 606) was not its box after Reset layout (585). Under load the app sometimes says it
  is ready before its map is laid out (it reports the map at 0, not shown); the re-placing at ready then
  sees no map, and nothing places frame 2 again, so it keeps the height it was given while the map was
  unknown. Reproduced 3 times in 36 loaded fresh loads (2026-11-03); the commit before this one, 0 in 16,
  so 1.12's switches may make it likelier, or it was rarely seen. At ready the page now looks again on the
  next frames (at most 60) until the map shows. A check makes the late map certain and a planted fault
  holds it.

### For Corwin to decide (forks written, not taken)

1. **Item statements at the map's first size.** Send only the description's first sentence, so the box
   score shows in a 190 by 130 map, or leave it (today). Falsifier: point at gitcha on the shop's page and
   count the card's facts shown (0 today, 2026-11-03).
2. **A picture of the page's own.** Gitcha's four screenshots (Bryant Frankford's, CC BY-SA 4.0) are
   staged under `/demo/gitcha/shots/` and could be its card's picture (`{ src, alt }`, this origin). Not
   done: the card would show them without their credit; a fact such as "Picture: Bryant Frankford, CC
   BY-SA 4.0" could carry it.
3. **How a card is kept.** On a press (today); other readings: keep any card with pages after a hover, or
   keep none and page only from the keyboard.
4. **The match pages' titles** are each shape's first line of text; on gitcha's page the title zone's is a
   200-character sentence, so its page draws at 1.10's size. Shorter shape names are drawings.py's to give.

### Checks for revision 9

`tests/free9-browser.cjs`, at 1280x800 light, 1366x768 dark, 1440x900 light and 1920x1080 dark: free's
embed has `bigcard` and `cardpad`; pointing at an item gives a big card that fills the map, its title
larger than 1.10's 12.5 pixels, with a picture and every fact the page sent; the Security tile's card shows
its facts as a box score or lines; the card the page sent has a title, one to eight facts and a statement;
the pad turns 45 degrees while the card shows and is its 1.11 self when it goes (no turn, its slider back,
no tooltip left); a hover card goes when the pointer leaves; a pressed item's card stays (said, "1 of N")
while the pointer goes to the pad, whose arms page it (Next, the last, the first; one
`topoforge:cardpage` per turn; a turned page outlives the hover's end); each visible cell of the turned pad
meets neither frame 2, the legend nor the layout switch; every card's art is the app's own or of this
origin; C-g, a selection and another page each put the kept card away; no sideways scroll, no request to
another host, no console errors. At 1366x768, with the app made to report no map until 150 ms after the
page's 1.12 call, frame 2 still ends 12 above the turned pad's reach. At 390x844 a pressed item's card is
not kept. Classic, at 1280 and 1920:
neither word (nor `mappad` or `preview`), `reset` as before, no big card, no pad. `tests/check_site.py`:
free's call names each of its eleven words; neither layout's address asks for `bigcard` or `cardpad`.
Each promise has a planted fault in `tests/run.sh --prove-red`.

Built and checked (2026-11-03, revision 9), against topology `ee1475a` (1.12) read-only: `sh tests/run.sh`
Python 44 (one new), node 30, browser 33, navigator 31, classic 34, free 46, revision 5 30, revision 6 26,
revision 7 37, revision 8 68, revision 9 **28**, install 15 and 12. Planted faults: 23 new or changed, 7
held by `check_site.py` (each word named; neither address asks for the 1.12 words) and 16 in the browser
(13 new; 3 retargeted because `cardpad` now turns on what they took away: "map and preview not turned on",
"no pad in free", "no reset switch in free"), each seen red at the assertion written for it; 256 in all,
run in two shards.

## Revision 8: fit it at 1280, the legend on the frames' lines, a drawn slider, a reset (2026-11-02, evening)

### What Corwin asked (his words, 17:27; c4 `q/2026-11-02-obsmage-and-resume/PROMPT.md`, readings in `READINGS.md` beside it)

"indeed: "fit it" RE 1280"; "reset UI control"; "minimap(free, KEEP menus for classic): (a) bring the
D-pad gadget, (b) left/right/center: mini-map mode (RESUME; see note later on); (c) as a movable control
for positioning/calibration"; "for free: look to the positioning of footer per alignment to initial
placement".

From the resume note: "the original framing was in terms of slider and you even called it a slider on
the hand-back, but we didn't draw a slider."

This stage builds reading 1 of S2, S5 and S6, and the page's side of S1 and S4 (READINGS.md). The pad
itself and the app's reset arrive with topology forge 1.11 (stage 2, below when it lands).

### S6, fit it at 1280: frame 2 starts below the layout switch, at every width

What was wrong (observed with a timeline of frame 2's `--fy` and the switch, 1280 by 800): frame 2 was
first placed before the switch existed (ui.js made it on `DOMContentLoaded`, which comes after the
deferred scripts that build the frames), so it was put at the top, `y = 8`, under the switch, and moved
below it only when the app said it was ready. When anything kept it from that second placement, it
stayed under the switch (the 1280 screenshot of last round).

| Change | Intention |
|---|---|
| ui.js makes the switch when the document becomes interactive (before the deferred scripts run), not at `DOMContentLoaded` | the switch exists when frame 2 is first placed: it is placed below it the first time, with no jump |
| free.js watches for the switch to appear or change size; then a frame never moved is placed again, and every frame is checked against the switch (its top row is put below it) | a late switch, a font that loads later, or a kept place under it from an earlier visit is fixed when it happens, not only at the app's ready |

### S5, the legend on the frames' lines

The frames start out on an 8-pixel gutter: frame 1 at the left edge plus 8, frame 2 at the right edge
less 8, both 8 below the top (frame 2 below the switch). The legend now starts on the same lines: its
left edge on frame 1's first left edge (8), its foot 8 above the foot of the drawing (the same gutter;
revision 6 hung it 4 above), and it ends at least 8 short of the app's overview map, which holds the
bottom right corner. Frame 1's first height ends above the legend's row (at 700 or less, as before, at
the heights we test). It is placed from those numbers, not from where the frames are now: moving or
resizing a frame does not move it. It can still be moved by its own grip, and a reset puts it back.

### S2, the slider drawn

Revision 7's control had the role, the keys and a thumb, but its track was a 2-pixel line with three
6-pixel dots: it did not read as a slider. Redrawn as one, in the layout switch's own material (it rhymes
with the switch, which rhymes with the d-pad):

- a **track**: a recessed rounded groove, 64 by 12 pixels, with three small stops (left, centre, right);
- a **thumb**: the switch's domed knob, 16 pixels, that **glides** to the stop it is set to;
- the glide uses the same timing as the layout switch's cross-fade (the browser's view transition:
  0.25 seconds, `ease`); with the page's Motion off, or the system's reduced motion, it jumps;
- a press anywhere on the track sets the nearest stop; the thumb can be **dragged**, stepping to the
  nearest stop as it goes; arrows, Home and End as before; Options › Map mode's radios as before;
- the words are his, unchanged: Preview shapes (left), Both (centre, the default), Highlight matches
  (right), said in the slider's value text and its tooltip.

### S4, Reset layout (the page's side)

Options › **Reset layout**, and M-x `reset-layout`: every frame back to its first place and first size
(frame 1 top left; the navigator's frame top right under the switch, reopened if it was closed; frames
made later, by C-x 5 2, back to their own first places), the small frames' places forgotten (they open
in their first place next time), the legend back on the frames' lines, and the map mode back to Both (the
app follows). Untouched: text size and colours (Customize), the legend watermark off, Motion, the lines
growing together, the tool-bar shown or not, what each window shows. Intention: one press undoes a
morning of dragging, and nothing that is a setting rather than a place.

**Undo reset** (Options, and M-x `undo-reset`) appears after a reset and puts back what the reset changed,
once: the places and sizes, the map mode, and the navigator's frame closed again if the reset opened it.
It is kept for this visit only. With 1.11 the app's own reset will be wired to this one (stage 2).

### obsmage and obsmage-corwin, public (added to this stage)

Corwin made both repositories public at 17:44. Checked again here before linking: GitHub's API answers
both without a login, `"private": false`. Neither has a code.bru.st remote (both clones' only remote is
GitHub, and code.bru.st answers 404 for both names under inputloop and corwin), so GitHub is the one
address. They join the public allow-list (`catalog.py`, `PUBLIC_URLS`) and leave `PRIVATE_NAMES` (c4
stays); the directory's cards, the obsmage tab (its links and status), the packages page (the healer is in
`packaging/healer`) and the drawing's project pages stop saying "not public yet" and link them.
obsmage.com: at first it did not answer over https with a valid certificate (curl failed the TLS
check), so it was not linked; checked again before the commit, it answered 200 over https with a valid
certificate (www redirects to it), so it is now the project's home: on the allow-list, the first link
on the obsmage tab, and a Home link on its directory card.
`tests/check_site.py` checks both are on the allow-list, off the private list, linked from the directory,
that the obsmage tab links its repository and no longer says "not public yet", and that obsmage.com is on
the allow-list, the tab's first link and on the card; each has a planted
fault, and the old "a private repository linked" plant now links c4.

### QA plan for revision 8 (written before the build)

`tests/free8-browser.cjs`, at 1280×800, 1366×768, 1440×900 and 1920×1080, light and dark:

- frame 2's box never meets the switch's (bounding-box intersection), on a fresh load and after the app
  is ready; every place frame 2 was given during the load is below the switch (no first placement under
  it); a frame 2 kept under the switch from an earlier visit is put below it on load;
- the legend's left edge equals frame 1's first left edge, its foot is 8 above the drawing's foot, it does
  not meet the map; after frame 1 and frame 2 are moved and resized, the legend has not moved;
- the slider: its track is drawn (at least 48 by 8 pixels, inside the tool-bar, not hidden), the thumb sits
  at the left, centre and right stop for the three modes; the thumb's transition is `left` over 0.25 s,
  `ease`, with motion on; with reduced motion there is no glide; dragging the thumb from the left stop to
  the right one sets Highlight matches; a press on the track's left end sets Preview shapes;
- Reset layout: after moving and resizing both frames, closing the navigator's frame and setting the map
  mode to rings, Reset layout puts both frames at their first boxes (equal to a fresh load's), reopens
  the navigator, sets the mode to Both in the page and the app, and leaves the text size and the legend
  watermark setting as they were; Undo reset puts the moved boxes, the closed navigator and rings back;
  Undo reset is then gone (one level);
- no sideways scroll, no request to another host, no console errors.

Each promise has a planted fault in `tests/run.sh --prove-red`, proven in shards.

### Built and checked (2026-11-02, revision 8 stage 1, on topology forge 1.10 `e524fe8`)

`sh tests/run.sh`: Python 43 (one new: obsmage public and linked), node 30, browser 33, navigator 31,
classic 34, free 46, revision 5 30, revision 6 26, revision 7 37, revision 8 **42**. Found while building:
- The first placement under the switch was the order of scripts (above). Reproduced locally only by a
  timeline of `--fy`: frame 2 drawn at 8, then at 66 when the app said it was ready.
- A frame's width or height set by the reader did not stop it being placed again by itself (only a move
  did), so the app's map moving could throw a chosen width away; now a resize does too.
- Fresh and after Reset, the navigator's frame ended at different heights at 1366×768 (540, 548): its
  first place was taken before the app showed its map. A frame never moved is now placed again when the
  map is known, so both end 12 above the map.
- In rings, a caption that came back after a finder was redrawn under a moved focus was said over the
  newer message ("moved here from frame 2" became "Router: not on this page"). The caption is now said
  only if what asked for it is still pointed at or focused; a check and a planted fault hold it.
- The rule that nothing in a frame animates (revision 2) now has one written exception, the slider's
  thumb, which moves only when the reader moves it and never with Motion off; the node and browser
  checks that hold that rule name the exception.

### Stage 2: topology forge 1.11, the map's pad and Reset layout (topology, branch corwin, `adff93a`, read-only)

1.11 adds two switch words, `mappad` and `reset` (both off unless a page asks, in neither `all` nor
`bare`), and three calls: `padArrows`, `resetLayout`, `undoReset`.

| Control or call | What the page does | Intention |
|---|---|---|
| `mappad` | turned on in **free only**, with the rest of free's words at ready; classic's address never names it | S1 reading 1: the d-pad hangs on the map's edge in free; classic keeps its menus (his words) |
| `reset` | turned on in **both**: free at ready, classic in its address (`select,ready,reset`) | the app's View menu and the map's Mode menu offer Reset layout and Undo reset in either layout |
| the pad's slider and the page's slider | one setting, as in revision 7: the app's `mapMode` is the one source of truth; the pad drives it, `topoforge:mapmode` moves the page's slider and radios; the page's slider calls `mapMode`, which the pad follows; an echo of the page's own change is dropped | S2 reading 1: the pad's horizontal bar is the slider, and the tool-bar's slider rhymes with it; never two answers to "which mode" |
| `padArrows` | set at ready from Options › **Map pad: arrows pan the drawing** (unchecked: `mode-scale`, the default; checked: `pan`), kept in this browser (`corwin.cloud.free.v1`, `padPan`), because the app does not keep it | S3 reading 1 is the default (the vertical arm calibrates the map's scale, the grip positions it); S1 reading 2 (the arrows pan the drawing) is one switch away, options over removal |
| Options › Reset layout | the page's reset (revision 8, stage 1) **and** `TopoForge.resetLayout()` (the app's panels, the map's place, size, scale and mode, the pad) | one press puts the whole screen back |
| Options › Undo reset | the page's undo **and** `TopoForge.undoReset()` | one level, on both sides together |
| the app's Reset layout or Undo reset (View menu, the map's Mode menu) | `topoforge:reset` resets the page's frames too (`{ undo: true }`), or puts them back (`{ undone: true }`), without calling the app again | either side's control resets both |
| nothing twice | when the page calls `resetLayout()` or `undoReset()` itself, it expects the one `topoforge:reset` that call sends and drops it (counted, one per call); the map mode follows the app's message without being set back to it | a reset is one reset, wherever it starts |

What Reset layout leaves alone is as in stage 1 (text size, colours, the watermark, Motion, lines,
tool-bars, windows), and also the pad's arrows (a setting, not a place).

Three choices are the app's, written here for Corwin to revisit:

- **A press on the slider's thumb (without dragging) is The whole drawing** (`mapScale(1)`), while a click
  on the centre stop sets Both. The same spot does two things depending on whether the thumb is on it.
- **In pan mode the centre of the cross is Fit.**
- **The tick labels are short** (Cards, Both, Rings); his words (Preview shapes, Both, Highlight matches)
  are in the slider's value text and the page's own slider.

QA plan for stage 2 (written before the build), in `tests/free8-browser.cjs`, at 1280×800, 1366×768,
1440×900 and 1920×1080, light and dark: free has the pad (`#mmPad` shown near the map) and its embed
words include `mappad` and `reset`; classic has no pad and has `reset`, and the View menu offers Reset
layout; the page's slider moves the pad's (both ways: a key on the pad's slider moves the page's), with
no loop (one `topoforge:mapmode` per change); Options › Reset layout resets the app (the map back to
190 by 130 at 12 from the right and foot, scale 1) and the page, and exactly one `topoforge:reset` is
seen and nothing is reset twice (the page's undo stays one level deep); the app's Reset layout (its
View menu command) resets the page's frames; Undo from either side puts both back; Options › Map pad:
arrows pan sets `padArrows('pan')`, kept across a reload, untouched by a reset; frame 2 never under the
switch; the pad never meets the legend or frame 2; no console errors, no request to another host. Each
promise has a planted fault, proven in shards.

Built and checked (2026-11-02, revision 8 stage 2), against topology `adff93a` (1.11) from a read-only
archive: `sh tests/run.sh` Python 43, node 30, browser 33, navigator 31, classic 34, free 46, revision 5
30, revision 6 26, revision 7 37, revision 8 **68**. Found while building:
- At 1280 the pad, shown while the pointer is near the map, hung 18 pixels over the legend's last
  compartments (the legend's line is about 950 pixels there). Below 1400 pixels the compartments now sit
  closer (0.45 em each side, from 0.7), so the line ends 30 pixels short of the pad; the check wants 24
  (three gutters), room for a longer revision string or a wider fallback font. One line, as revision 5 asked.
- The plant "the switch made after the frames" could stay green: the page's own watch on the switch puts
  frame 2 below it before the browser paints, so no frame is ever drawn under it either way. The check
  now also asks the direct question (was the switch there when the first frame was put on the page).
- With 1.11 the app's reset brings the map mode back to Both itself, so the page's own setting of it only
  matters with an older app; it is checked by telling the app it is 1.10 for one reset.

## Revision 7: independent lines, map modes, cards (2026-11-02, afternoon)

### What Corwin asked (his words, 12:48; c4 `q/2026-11-02-minimap-modes/PROMPT.md`)

"The mini-map work is smooth as butter. [...] scroll-wheel over the mini-map should change the zoom level
of the outer frame; modifier keys could change this to adjust preview scale instead (Alt) or to move the
viewport (shift=E/W, Alt+Shift=N/S)"

"modality (mini-map controls, reachable via menus): three state slider default in the middle; RIGHT:
"highlight matches" mode (right most position, what we have now; the text that we currently put into
mini-map on item hover could be in the echo/input area); LEFT: "preview shapes" mode (show a HUD of
information about what we are hovering in one of the panels; like a packground transparent Index
Card/Flash Card with a visualization, left-top corner titling, and fact clusters, plus a single consise
statement of what we are looking at; background fade to draw attention without adding/adjusting
background/texturing so it just looks like less background (don't try to add a Index Card lines or
framing [...]) [...] the default orientation is setup already for the mini-map and can be adjusted by the
user; don't change that as the mode setting is change; MIDDLE: highlight maches in the DRAWING (not the
mini-map) and display the shape/item/character card (LEFT design) in the mini-map"

"my idea didn't work out of scaling together all three of menu line, mode-line and input/echo/message
area. Let's make them independant. If you think that's worth an option I'm fine with that. Addition
options around changes [...] is most often TRT [...] A feature disabled that way is much, much easier to
"bring back" than hunting though commit history"

### Independent lines (the new default), grow-together kept as an option

- **Independent** (default): the menu bar, each mode-line and the message area each take the lines their
  own content needs (the menu bar is always one, revision 6; a mode-line wraps on its own; the message
  area grows to at most four lines), and nothing else grows with them.
- **Lines grow together** (Options, a checkbox; kept per browser in `corwin.cloud.free.v1`): revision 5's
  rule, unchanged. Intention: his idea stays one press away, not in the history.

### The map mode: a three-position slider, default in the middle

| Position | Name | What pointing at something in a frame does |
|---|---|---|
| left | **Preview shapes** (cards) | the thing's card in the map |
| middle (default) | **Both** | its matches highlighted in the drawing, and its card in the map |
| right | **Highlight matches** (rings) | its matches ringed in the map (stage 2), its caption in the frame's echo area |

- Where: a slider (`role=slider`, values 0 to 2, its value said in words) at the end of the frame's
  tool-bar, in a group of its own; and Options, Map mode, as three radio items, so frames without a
  tool-bar and keyboard users reach it from the menus. Why the tool-bar and not with the map's own
  controls: the map and its door-handle controls are inside the app's frame, which this page does not
  draw in; the tool-bar is where the things that preview are. Kept per browser.
- The map's place, size and orientation are the reader's and are not touched when the mode changes.
- Until the app can draw cards and highlight in the drawing (topology forge 1.10), cards are shown in the
  plain box above the map; in the middle position the map's rings stand in for the drawing's highlight.

### Cards, built from data

A card for each thing that can be pointed at: a tool-bar category, a finder shape kind, a navigator item,
a shape selected in the drawing. Each card: a **title** (top left), a **visualization** (the shape's icon,
or the category's shape icons, or the item's glyph), **clusters of facts** (from `shapes()`, the drawing and
`nav/index.json`: kind, category, default size, how many on this page and on others, section, page,
notation, "is a", topic, shapes drawn for it), and **one statement**: the item's own one-line description
from the catalog, or, for a category or kind, one sentence composed from its facts. No hand-written prose.
The card's background fades the drawing behind it (less background, no card lines or frame).

### QA plan for revision 7 (written before the build)

`tests/free7-browser.cjs` (1280 and 1920, light and dark; 390 for the lines): lines independent by default
(a long message grows only the message area) and together when chosen (all three equal), each kept across
a reload; the slider starts in the middle, its arrows and Home/End move it, Options' radios set it, kept;
in the right position the echo area says the caption (1.9 staged); in the left and middle the card shows a
title, an icon, facts that equal the data (a category's count is its `shapes()` length; an item's notation
is its index facets) and one statement (an item's is its catalog description); nothing animates; AA.
Each promise has a planted fault, proven in shards. 1.10 (wheel, mapMode, `{card}`, highlight in the
drawing) is wired and checked when it lands.

Manifest: none owed.

### Built and checked (2026-11-02, revision 7 stage 1, before topology forge 1.10)

Built against topology, branch corwin, `25fae11` (1.9). `sh tests/run.sh`: ALL CHECKS PASSED (Python, node,
browser 33, navigator 31, classic 34, free 46, revision 5 30, revision 6 26, revision 7 21). The card box sits
just left of the map, above the legend, drawn over the frames while it shows (at 1280 it can cover frame 2's
foot for as long as something is pointed at; in 1.10 the card moves into the map). Revision 5's suite now
starts with the lines together and the rings position (its own settings); revision 6's with rings.
Found: in the rings position the echo area takes every hover's caption, so a long message can be replaced by
a hover under the pointer; that is the position's purpose, and the test now invokes its command without
moving the pointer.

### Stage 2: topology forge 1.10 wired (topology, branch corwin, `e524fe8`, read-only)

1.10 gives the map its three modes (`mapMode`), a card in the map (`preview(what, { caption, card })`), the
matches lit in the drawing (the middle mode), the map's own scale (`mapScale`, from its Mode menu) and the
wheel over the map (the switch `mapwheel`). What this page does with each, and why:

| Control or call | What the page does | Intention |
|---|---|---|
| embed words | `map`, `preview` and now `mapwheel` turned on with the rest of 1.9's | the wheel over the map is Corwin's first bullet; the app keeps it a switch, the page asks for it |
| the slider, Options › Map mode | a move calls `TopoForge.mapMode(mode)`; the page keeps its copy too (for 1.9 and 1.8) | one control on the page, one mode in the app |
| the app's own Mode menu (in the map's handles) | `topoforge:mapmode` moves the slider and the radio, and says "(from the map's Mode menu)" in the echo area | either control is the same setting; neither drifts from the other |
| page load | at ready the page reads `mapMode()` and follows it; it never calls `mapMode()` at load, except once in a browser's life: a choice made on this page before the app had modes (stage 1) is carried to the app, then `mapModeApp` is kept and the app's store is the one source of truth | the visitor's last choice wins, wherever it was made (on this page, in the app's menu, or in the app on its own page) |
| cards (left), both (middle) | the data-built card (title, up to 8 facts, one statement) goes to `preview(target, { caption, card })`; art is the app's own: a kind's or a selected shape's picture (`{ shape }`), else `'matches'` | the card is in the map, as he asked ("display the ... card in the mini-map"); the drawing's highlight in the middle is the app's |
| the stand-in box | retired when `TopoForge.version` is 1.10 or later; still the card for 1.9 and 1.8 | an older app still shows something useful |
| rings (right) | the echo area says `topoforge:preview`'s caption with its counts: the app's own caption already counts ("Endpoints: 4 shapes · 21 on other pages"); after a caption the page gave (an item's name) the counts follow, "(1 here, 3 on other pages)"; the map no longer writes it (`mapCaption` stays off) | "the text that we currently put into mini-map on item hover could be in the echo/input area" |
| the selection | its card is sent as the preview of its own id; cleared with the selection | a selected shape has a card in the map as a pointed-at one does |

Two choices are the app's, written here so nobody "fixes" them on this side:

- **The wheel zooms about the middle of the view, not the pointer.** Over the map the pointer is in the
  map, not in the drawing, so the app zooms the drawing in place; to zoom elsewhere, click the map there
  first. His bullet said "change the zoom level of the outer frame", which this is.
- **`mapwheel` is a switch, not a default.** It changes what the wheel does over the map, so the app keeps
  it off unless a page asks; this page asks. Alt+wheel (the map's own scale) can be taken by some desktops
  first; the Mode menu's Closer and Farther do the same.

QA plan (written before the build), in `tests/free7-browser.cjs`, at 1920 and 1280, light and dark: the
slider in the middle means the app is in both; Home and Options' radios set the app's mode; the app's
Mode menu (clicked in the app) moves the slider and checks the radio; after a change made only in the
app's store, a reload shows the app's mode (the page's older one does not win); in the middle a
category's card is in the map (its count from `shapes()`, one statement naming its shapes, the page's card
as the app took it), the stand-in box hidden, the drawing's lit shapes as many as the matches; a kind's
card has the shape's own picture; an item's statement is its catalog description and its notation its
facets; the selection's card comes and goes with it; in the left position the card shows and nothing is
lit; with the version told as 1.9 the stand-in box is the card again; in the right position the echo
area is exactly the caption with its counts, the map rings as many as the matches and writes no caption,
and no card is sent; the wheel over the map zooms the drawing; the card in the map never meets frame 2
(the overlap at 1280 in stage 1). `tests/free6-browser.cjs` reads the caption from `topoforge:preview`
under 1.10. Each promise has a planted fault, proven in shards.

Built and checked (2026-11-02, revision 7 stage 2), against topology `e524fe8` (1.10) from a read-only
archive: `sh tests/run.sh` browser 33, navigator 31, classic 34, free 46, revision 5 30, revision 6 26,
revision 7 37; node 30 (one new: the page's own fallback mode is the middle). Found while building:
- With 1.10 the page's own default can no longer be seen in a browser (the app's default wins at ready, by
  design), so the plant "the map mode not in the middle" now turns the node check red, not the browser's.
- Clearing the selection left its card in the map (the box had been hidden by a check on its own
  attribute); the select message now sends `preview(null)` with 1.10.
- In rings the preview now clears the moment the pointer leaves (as 1.9 did); in the left and middle the
  card stays 400 ms, then the selection's card or nothing.
- The live check showed the counts twice in the echo area ("Endpoints: 4 shapes · 21 on other pages (4
  here, 21 on other pages)"): the app's caption already counts, so the counts follow only a caption the
  page gave.
- The documented-calls check now also reads the names given `nine()` and `ten()`, and allows `mapMode`.

## Revision 6: frames that fit, a lettered title block, menus that never wrap (2026-11-02)

### What Corwin asked (his words, 10:38, with a screenshot at 1920x1080; c4 `q/2026-11-02-frames-legend-menus/PROMPT.md`)

"In the screenshot you can see approximately where I think the second Emacs frame should start out.
It needs to be a little shorter and we need to be able to resize height also. If we do corner grab
also do it second after height resize works and provide a subtle effect on the corner we are grabbing
itself -not just the pointer- that shows what is going on, so it's easy to see that effect of
click+drag is changing based on where the pointer is when we are starting that action."

"Legend should have two different font treatments neither of which is visually grabbing, both are
subtle because architects want people to look at what we drew, not at our names and meta-data [...]
Think about how drafts-persons will form the legend at the bottom of a blueprint and then see if you
can give it that treatment using a couple of different fonts to get a Subtle and Subtler [...] This
can hang very near the bottom"

"See if you can rethink the menus a little so that we don't have a wrap at 1080x when the window is
full screen at default font sizing: there is a probably a little research project here since
"default font sizing" covers a great deal of ground. Remember that these menus will [...] be mirrored
left and right and that they also serve as our principle -only, excluding the footer- page level
navigation, meaning that we have to get it right but also that we MUST be innovative"

OBSERVED in his screenshot (rev 2c79670): the layout switch sits on top of frame 2's menu bar and
hides "Navigator"; frame 2's menu bar wraps to two lines.

### The second frame: where it starts, how tall

Intention: two views at the window's two edges, the drawing between them, nothing hidden under the
switch. Frame 2 (`*navigator*`) starts at the top right, its top just under the layout switch, 440
pixels wide, and at most 560 tall, ending above the app's overview map. **No frame sits under the
switch**: a frame placed, dragged or moved by keys so that its menu bar would meet the switch is put
just below it (the switch never moves; the frame does).

### Height, then the corner

- **Height**: every Emacs frame's bottom edge is a handle (`role=separator`, horizontal): drag it, or
  focus it and use Up and Down (16 pixels), Page Up and Page Down (64), Home (shortest, 200) and End
  (tallest, to the canvas's foot); C-x ^ (Emacs's enlarge-window, here the frame) makes it 16 taller;
  Options, Taller and Shorter. Kept per browser with its place and width.
- **The corner** (bottom right), second: drags width and height together; focused, Left and Right
  change the width and Up and Down the height.
- **Which mode you are in shows on the frame itself**: pointing at or focusing the right edge draws a
  hairline along that edge; the bottom edge, along the bottom; the corner draws a small L bracket in
  the corner and both hairlines. While dragging, the same marks are drawn stronger. So before the
  press you can see whether it will change the width, the height, or both. Nothing animates.

### The legend: a title block, lettered Subtle and Subtler

Read on title blocks: an architect's or engineer's sheet carries a title block at the bottom right
(ISO 7200 names its fields: title, drawn by, approved by, document type, revision, date); its field
names are printed small, in capitals, and the values are lettered in the sheet's lettering, ISO 3098
for technical drawings (European CAD requires an ISO 3098 face; osifont exists for that). Here:

- **Subtler**, the field names: IBM Plex Sans Condensed Light, small capitals, tracked (letter-spacing
  0.12em), 9 pixels: APP, BY, LICENCE, PROSE, SOURCE, REV, DATE.
- **Subtle**, the values: osifont (ISO 3098 lettering), 12 pixels, regular: topology forge, Bryant
  Frankford (linked), GPLv3+ or LGPLv3+, CC BY-SA 4.0, topology (linked), the revision, the date; then
  `credits`.
- Both in the dim text colour, which keeps AA contrast (4.5:1): subtle by size, weight, width and
  lettering, never by being hard to read.
- One line, hairline compartments, hung 4 pixels above the canvas's foot.
- Fonts served from this site only (`fonts/`; CSP `font-src 'self'`):
  - osifont (https://github.com/hikikomori82/osifont, commit 2e9aa86): GNU GPL version 3 with the font
    exception (upstream also offers GPL 2 or LGPL 3, each with it);
  - IBM Plex Sans Condensed 300 and 400, Latin (npm @fontsource/ibm-plex-sans-condensed 5.2.6): SIL Open
    Font License 1.1.
  Both unchanged; provenance and hashes in `src/fonts/README`, licence texts in `LICENSES/`. Credits
  names both. Where a font cannot load, the stacks fall back to the system's condensed or plain sans.

### Menus that never wrap: the research, the cases, the design

What "default font sizing" covers (read 2026-11-02):

- the browser's default font sizes: Chrome's are standard 16 pixels, fixed-width (monospace) 13 and
  minimum 0 (Chrome's extension docs, https://developer.chrome.com/extensions/fontSettings, name the
  three settings; the values are Chrome's shipped defaults, from memory, not printed on that page);
- the operating system's display scaling: Windows offers 100, 125, 150 and 175 % (Windows Central, "How
  to adjust display scale settings in Windows 11"); a 1920x1080 screen at 125 % gives the page a
  1536-pixel-wide CSS viewport, at 150 % 1280;
- browser zoom, which scales the same way;
- a user's own default or minimum font size, and Customize's text size here.

The cases, and what each gets:

- **Supported, nothing folded**: 1920x1080, full screen, 100 % scaling, 16-pixel default (CSS viewport
  1920 wide): both frames show every global menu on one line.
- **Supported, never wrapping**: 125 % and 150 % scaling, browser zoom, a larger default font, Customize's
  text size: the menu bar stays one line, and what does not fit moves into `»` (below).
- The frames' text now follows the browser's default font size (`0.8125rem`, 13 pixels at the 16-pixel
  default, the same as the browser's fixed-width default) and Customize's size.

The design, weighed (Corwin: "we MUST be innovative"):

1. **The mode menu goes to the mode-line**, as Emacs does: clicking the major mode's name on a mode-line
   (mouse-1 on the mode name) pops up that mode's menu. Here the lighter is the window's own mode,
   `Finder` or `Navigator`, and it opens that mode's menu. Taken: authentic, and it frees the menu bar
   from a menu that differs per window.
2. **Priority+ overflow into `»`**: when the menus do not fit on one line, the least needed move, last
   first, into a `»` menu at the inner end (Layout, Arrange, Help, Options, View, Edit, File, then the
   mode menu); Site never moves. Taken: it is what makes "never wrap" true at every size; GTK's menubar
   does the same with an overflow arrow.
3. **Mirrored frames**: a frame on the right half of the window lays its menu bar out from the right:
   the grip at the outer (right) end, the menus flush right in reading order, `»` and the fold button at
   the inner end, menus opening toward the inside. Frame 1 is the mirror image. Taken: the two frames
   read as a pair framing the drawing.
4. Shorter labels: not taken. The app's menu names are the app's own, and "Site" stays a word (it is
   the page's navigation; an icon would hide it).
5. Site as the frame's name or an icon: not taken, for the same reason.
6. One shared menu row between the two frames: not taken. The frames move apart and together freely;
   a shared row would break the moment one moves. Written down as a fork.
7. The navigator's menu stays in the menu bar too while its window is selected, when there is room
   (yes, and): the mode-line lighter is one more way to it, not a replacement.

### topology forge 1.9, part A, wired now (built against topology, branch corwin, `c67b9f4`, read-only)

- `*Here*` floats beside the shape (`TopoForge.selectionRect()`), without zooming; with 1.8 it still
  recentres first (revision 4).
- A long press or right click on a shape (`context`, `topoforge:context`) opens `*Here*` beside it.
- `*Properties*` edits the name and the tooltip in place through `TopoForge.setProps(id, patch)`
  (one undo step each); [Open the app's own Properties] stays.
- `%zoom` prints the zoom (`view`, `topoforge:view`) between `−` and `+`.
- The first fit leaves room for the frames: once the drawing is loaded and the frames are where they
  start, `TopoForge.setView` scales and moves the app's own fit into the space between the frames and
  above the legend.
- Keys (`keys`, `topoforge:key`): Alt+x, F10, C-x and C-c pressed in the drawing reach the frames. While
  that is on, the drawing's own Ctrl+X and Ctrl+C are the page's; with something selected and no
  second key within 200 ms, C-x cuts and C-c copies (`run('edit::cut')`, `run('edit::copy')`), as
  Emacs's CUA mode does (`cua-prefix-override-inhibit-delay`).
- `pagelist` (`topoforge:pages`): `*Pages*` follows a page added, renamed or removed.

### Decisions, each with what would prove it wrong

- [HIS] Frame 2 starts top right under the switch, shorter. Falsifier: his next screenshot moves it.
- [MINE] At most 560 pixels tall. Falsifier: he still finds it too tall at 1080.
- [MINE] C-x ^ for taller (Emacs's enlarge-window); shorter is the edge and Options only, as Emacs
  has no default key for shrink-window. Falsifier: he reaches for a shrink key.
- [DOMAIN] osifont for the values (ISO 3098, what CAD letters a title block with), Plex Condensed for
  the field names. Falsifier: he finds osifont grabbing; then the values take Plex Condensed 400.
- [MINE] Subtle by type, not by contrast: both stay AA. Falsifier: none here (AA is the floor).
- [MINE] The frames' text follows the browser's default font size. Falsifier: someone with a large
  default finds the frames too large; Customize's size then brings it down.
- [MINE] CUA timing for cut and copy. Falsifier: C-x in the drawing cuts when he meant a prefix.

### QA plan for revision 6 (written before the build)

Where: `tests/free6-browser.cjs` (new; 1920x950, 1280 and 390, light and dark; 1536x730 at device
scale 1.25 for 125 %; a 20-pixel default font through the browser's own font setting), the earlier
suites updated where revision 6 changes what they check; part A's checks run against 1.9 part A
(staged from topology, branch corwin) and skip with 1.8. Each promise gets a planted fault, proven in
shards (`PLANT_SHARD`).

TOWER
- Frame 2 starts top right, under the switch, its box not meeting the switch's, at most 560 tall,
  above the overview map. Dragged under the switch, it is put below. (plant: placed at y 8)
- Height: the bottom edge's keys and drag change the height; C-x ^ adds 16; kept across a reload; the
  corner changes both. (plants: height not kept; no bottom edge keys; corner moves only one)
- The mode marks: hovering or focusing the right edge, the bottom edge and the corner each set its own
  mark on the frame (and only its own); dragging sets the strong mark. (plant: the corner marks only the
  width)
- The legend: every value in osifont and every field name in Plex Condensed (computed fonts, and both
  fonts loaded); field names uppercase and tracked; one line; its bottom within 8 pixels of the canvas's
  foot; AA both. (plants: one font for both; the legend high off the foot)
- Menus: at 1920x950 (100 %) both frames show every global menu on one line, nothing in `»`; at 1536x730
  (125 %), at 1280 and with a 20-pixel default, every frame's menu bar is one line (`»` takes the rest);
  `»` lists every hidden menu's items; the mode-line's lighter opens the mode's menu; frame 2 is
  mirrored (grip at its right end). (plants: no overflow; the lighter opens nothing; no mirror)
- 1.9 part A: `*Here*` beside the selection's rect with no zoom; context opens it; `*Properties*` sets the
  name in one undo step; `%zoom` shows a percentage; the first fit sits between the frames; C-x with a
  selection and no second key cuts. (plants: `*Here*` zooms with 1.9; setProps not called)
LADDER: every new handle has a name and a value; the marks are not the only signal (the handles say
their mode in their names); AA of the legend; no animation.
SIGNAGE: credits names the two fonts and their licences.
ROOF: fonts from this site only (no request elsewhere); CSP unchanged; no console errors.
PEERING: 1.9 part A through its documented calls only; with 1.8 none of them runs.
REMOTES: topology unchanged; built from a read-only archive of its corwin branch.
DOME: storage refused, the frames still resize; 390 wide nothing floats and nothing scrolls sideways.

Manifest: none owed.

### Built and checked (2026-11-02, revision 6, with topology forge 1.9 part A)

Built against topology, branch corwin, `c67b9f4` (1.9 part A), staged read-only with `git archive`.
`sh tests/run.sh`: ALL CHECKS PASSED (Python, node 29, browser 33, navigator 31, classic 34, free 46,
revision 5 30, revision 6 21). Observed at 1920x950: both frames show every menu on one line; frame 2
starts at 1412,66 (500 by 560), under the switch; the drawing's first fit sits between the frames.
At 1536x730 (125 %) and 1280, frame 2 folds Arrange and Layout into `»`; at 390, frame 1 folds Layout;
with a 20-pixel default font both fold Arrange and Layout; never a second line.

Found while building: a right-justified (mirrored) menu bar hides overflow at its start, where
`scrollWidth` does not report it, so "Site" disappeared unnoticed; the fit is now measured by adding up
the shown parts' widths. Frame 2's mode-line wrapped at 440 pixels at 1920, so frame 2 starts 500 wide
on windows 1800 or wider. The corner handle poked 4 pixels past a full-width frame at 390 (now hidden
there, with the edges). The revision 4 check that `*Here*` sits beside the middle holds for 1.8 only
(1.9 floats it beside the shape); the check that 1.9's hooks stay off with 1.8 now tells the app it is
1.8 for a moment, so it holds whichever app is staged.

### Stage 2: topology forge 1.9 parts B and C (topology, branch corwin, `25fae11`)

His words (08:57, c4 `q/2026-11-02-yes-and/PROMPT.md`): "when hovering/selecting something inside the
nav/emacs frame use the mini-map as a HUD to give a little dashboard of what we are looking for. Allow the
minimap to be resized and moved by dragging or position controls, put the positioning controls for it
OUTSIDE the visible frame of the minimap; display them only when the mouse is near, as if a door handle
appears when you reach for the car door"; and of the classic tabs: "limit how many we show and put the full
list under a fly-up menu, then have < and > controls".

- **The map is the preview.** Free asks the app for `map` (the map in a frame of its own, with its
  door-handle controls above it: resize, Move, Position; shown when the pointer comes within 40 pixels,
  on focus, and always on a touch screen) and `preview`. Pointing at or focusing a tool-bar tile rings that
  category's shapes in the map (`preview({ category })`); a finder shape, that kind (`preview({ kind })`);
  a navigator item, the shapes the drawing draws for it (its id and the `tf_ref`s drawings.py gave them:
  `shop-t-<name>`, `<page>-near-<name>`, `<name>-zone` ...), captioned with its name. Leaving clears it
  (`preview(null)`). Intention: a little dashboard of what a press would find, in the drawing's own map.
  Yes, and: with 1.8, or before the app is up, the plain box above the map still says it in words.
- **Frames and the map never overlap.** Frame 2 starts above the map; when the map is moved or resized with
  its own controls, the app keeps its place in `topoforge.ui.v1` (key `minimap`), which reaches this page as
  a storage event (no polling); then any frame the map now covers ends above it (never shorter than 200
  pixels), and an unmoved legend is placed again. Intention: the frames yield to where he put the map.
- **Classic tabs** are the app's own, fixed in 1.9 everywhere: the tabs that fit, `‹` and `›` moving one
  tab, "All N ▴" opening a fly-up list with a filter. This page adds nothing around them (observed at
  1920, 1280 and 390: 12, 8 and 1 of 31 shown; no sideways scroll).

Built and checked: `tests/free6-browser.cjs` now has 26 checks (stage 2 and the classic tabs added), each
with a planted fault.

## Revision 5: yes, and (2026-11-02, morning)

### What Corwin asked (his words, 08:57; the whole prompt is c4 `q/2026-11-02-yes-and/PROMPT.md`)

"legend is too much still: lets try one line; we are trying for the architectural draft-persons
astatic but this hits visually and also reads like a ptich. Why would we use a machine formatted
explainer of the license, for instance? GPLv3+ would fit into a small hair-line separated compartment
on the legend [...] machine-formatted-symbiology in the footer hits as dissonence/confusion"

"ability to move the Emacs frame around, change it's width; menu, modeline, and message/input areas
each get +1 line together when any need to wrap (most likely the menu/modeline)"

"Lost the original nagivation tool: we are looking for two different views that can be side by side
when we have a second frame: it is two rather big features in a row where I have asked YES AND and you
have replied NO INSTEAD [...] Let's really try hard to avoid throwing away work a user likes because
they want to try something else"

"flexible container groups based on what is shown and flexible grid for items that are currently
shown in the same group (even spacing and seperaters in the main tool selection/display area, rather
than long stretches of horizontal gap) [...] More than one toolbar row; segment the groups; really
study the emacs toolbar here to decide if this can work."

"For the free toolbar, Git rid of tool labels, add hover and reuse the mini-map as a preview and
legend [...] Allow the minimap to be resized and moved [...] put the positioning controls for it
OUTSIDE the visible frame of the minimap; display them only when the mouse is near, as if a door
handle appears when you reach for the car door"

"Provide a new control in the free view only that floats where "customize" is now in the classic
view. Visually like our d-pad but just to classic; in class the setting to switch to free stays in
customize where it is. The button to undo a visual change should not jump away when I execute that
change: it's sometimes nice to "blink compare" [...] maybe a simple light-swich that never moves [...]
On the classic the ascetic value is having it look "normal", like regular productivity/business
software"

"The list of tabs on the classic view needs some work [...] limit how many we show and put the full
list under a fly-up menu, then have < and > controls [...] for the free look I wasn't sure how to
change views at all without the (gone) navigation focused version of the Emacs controls that we had
before."

"This is worth the effort to put every single control and behavior exactly in terms of an intention
or several."

### The standing rule this revision answers

Yes, and: a feature he likes is not put away unless he says replace, remove, instead, "don't like" or
"want to try without". Revision 4 put the navigator away in free without his saying so; that was
wrong, and it is back. Every control below carries its intention.

### The Emacs tool-bar, studied (sources, read 2026-11-02)

- GNU Emacs Lisp Reference Manual, "Tool Bar"
  (https://www.gnu.org/software/emacs/manual/html_node/elisp/Tool-Bar.html): the tool bar is drawn
  from `tool-bar-map`; separators are `(menu-item "--")` entries; an item's `:help` is its help-echo,
  shown on hover like any help-echo (a tooltip); `auto-resize-tool-bars` non-nil "the tool bar
  automatically resizes to show all defined tool bar items", "but not larger than a quarter of the
  frame's height"; "If Emacs is built with GTK+ or Nextstep, the tool bar can only show one line, so
  this variable has no effect"; `tool-bar-button-margin` (default 4 pixels) and
  `tool-bar-button-relief` (default 1) space and bevel the buttons; GTK and NS draw separators natively.
- Elisp manual, "Frame Layout"
  (https://www.gnu.org/software/emacs/manual/html_node/elisp/Frame-Layout.html): the tool bar is
  internal (drawn by Emacs: Lucid, Motif, no toolkit, Windows) or external (GTK and NS); with
  `auto-resize-tool-bars` "Emacs wraps the internal tool bar when its width becomes too large for its
  frame", and a GTK build "never wraps the tool bar but may automatically increase the outer width of
  a frame".
- Elisp manual, "Layout Parameters"
  (https://www.gnu.org/software/emacs/manual/html_node/elisp/Layout-Parameters.html): `tool-bar-lines`
  "may change whenever the tool bar wraps"; `tool-bar-position` is top, bottom, left or right (left
  and right on GTK only).
- `tool-bar-style`'s docstring (Emacs 30.2, https://doc.emacsen.de/30.2/var/tool-bar-style.html):
  image, text, both, both-horiz, text-image-horiz; "This variable only affects the GTK+ toolkit version
  of Emacs." So labels are a GTK thing; the internal tool bar is images.
- The Emacs manual's own "Tool Bars" page was refused to the reader (robots), so it is not quoted here.

**What that decides.** Emacs's internal tool bar is exactly what he asked for: icons only, help-echo on
hover, separators between groups, and more than one row when the frame is narrow (up to a quarter of
the frame). It does wrap item by item, so a separator can land at a row's end and a group can split
across rows; GTK instead keeps one row and widens the frame. So more rows **can work**, and we do one
thing Emacs does not: a group never splits unevenly. Each group is a grid whose column count is chosen
so its rows are as even as they can be (eight tools in room for six make two rows of four, not six and
two), and groups wrap whole. The undockable palette (his fallback) is therefore not built; it is
written down as a fork below.

### What is built, control by control, each with its intention

**The legend: one line.** Hairline compartments in the drafting manner, small type, no sentences:
`topology forge · Bryant Frankford` | `GPLv3+ or LGPLv3+` | `prose CC BY-SA 4.0` | `source` |
`rev <sha> · <date>` | `credits`. Intentions: credit Bryant first and link him; say the licence in the
words people use for it (GPLv3+, as he wrote it; CC BY-SA 4.0 is Creative Commons' own short name),
never the SPDX expression meant for machines; keep the drawing's revision, as a title block does;
leave the whole words to Credits. `credits` opens Help, Credits and licence in free (the `*Credits*`
frame) and unfolds the whole words under the line in classic: the drawing app, made by Bryant
Frankford for Corwin Brust; its licence in full words (GNU General Public License, version 3 or any
later version, or GNU Lesser General Public License, version 3 or any later version, as you choose;
prose under Creative Commons Attribution-ShareAlike 4.0; no warranty to the extent the law allows);
its source; your drawing; the sheet. That keeps GPLv3 section 5(d)'s Appropriate Legal Notices one
press away, with `GPL` on every mode-line too. The licence compartment is an `abbr` whose title is the
whole words, so pointing at it says them. In free the line floats as the watermark (grip `⠿`: drag or
arrow keys; `off`: Options, Legend watermark brings it back); in classic it sits under the drawing.
Below 47.5rem the compartments may wrap to a second line, whole compartments only. Without scripts:
the line and the whole words as a block.

**The frame moves.** Drag its grip `⠿`, or any empty part of the menu bar (the title, as a window
manager's title bar; menus still open on their names); arrow keys on the grip (16 pixels, 64 with
Shift); Options, Move (left, right, up, down, back to its start: one press, WCAG 2.5.7). Kept per
browser. Intention: the frame never sits over what you are drawing.

**The frame widens.** Its right edge is a handle (`role=separator`): drag it, or focus it and use Left
and Right (16 pixels), Page Up and Page Down (64), Home (narrowest, 220) and End (widest: 60 % of the
window, at most 900); C-x { and C-x } (Emacs's shrink and enlarge, 16 pixels); Options, Wider and
Narrower. Kept per browser (`corwin.cloud.float.v1`). Intention: room for C-x 3 when you want both
views in one frame, narrow when you want the drawing.

**Three lines grow together.** The menu bar, every mode-line in the frame and the message area (or
the M-x input) each take the same number of lines: when any of them needs to wrap (most likely the
menu bar or a mode-line, in a narrow frame), all three grow by a line together, and shrink together.
Intention: the frame keeps its Emacs proportions and its rhythm; nothing is cut off with an ellipsis.
The message area now wraps instead of ending in `…`. At most four lines each (the house's GRAIN
number, picked).

**The navigator comes back in free** as the buffer `*navigator*`: everything it was (the layered
category tool bar, the Narrow prompt and its intersection with the categories, splits, pins, buffers
as tabs, Pin as buffer and the kept-filter light), now shown in a window of the Emacs frame, beside
`*finder*`. On a wide screen a first visit opens two frames side by side: frame 1 shows `*finder*`,
frame 2 shows `*navigator*` (Emacs's C-x 5 2), each movable and widenable on its own. Any window of
any frame can show either buffer: `%buffer` on its mode-line, C-x b, or the tool-bar's navigator tool
switch the selected window; C-x 3 in a wide frame puts both side by side in one frame. Changing pages
and views goes through it, as before: its Projects, Processes and Pages list the drawing's pages and
open them; `*Pages*` stays too. In free the navigator's own menus join the frame's menu bar
(Navigator: its Buffers, Window and Filter items) while a window showing it is selected, as a major
mode adds its menu in Emacs; its tab bar, tool bar, windows, mode-lines and Narrow line are its own,
inside the buffer. Keys: C-x 2, 3, 0, 1 and o act on the frame's windows (Emacs's windows); the
navigator's own splits are in the Navigator menu; C-x t 2, 0 and o (its buffers) and C-c p, m and k
(pin, keep the filter, drop it) reach it from the frame. One navigator lives in one window at a time:
showing it in another window moves it there and says so. Intention: two views of the shop side by
side, the one he liked kept whole. Classic keeps the navigator where it was.

**The tool-bar: icons only, in even groups.** Groups, from what is there now, each a grid with even
cells and a hairline separator between groups:
1. **Shapes**: one tile per category of the app's `shapes()` (seven today), the category's first
   shape as its icon; pressed narrows the finder (as revision 4).
2. **Edit**: Undo, Redo (the app's own commands, greyed when they cannot run).
3. **Selection**, only while something is selected in the drawing: Duplicate, Delete, Bring to front,
   Send to back, Zoom to selection, the frame by the shape (C-c .).
4. **View**: Zoom out, Fit to window, Zoom in.
5. **Windows**: Split right (C-x 3), New frame (C-x 5 2), `*navigator*` here, `*finder*` here, and One
   window (C-x 1) only while split.
No labels: each tool has an accessible name and a tooltip, shown on hover and on keyboard focus (with
its key, if it has one), that stays while pointed at and goes with Escape (WCAG 1.4.13). Arrow keys
move along the whole tool-bar. A frame's tool-bar can be turned off (Options, Tool-bar in this frame,
Emacs's `tool-bar-lines` 0); frame 2, made for the navigator, starts without one. Intention: the
shape picker first, the drawing's most used commands next to it, no word that a picture and a tooltip
already say.

**The preview (HUD).** Pointing at or focusing a tool, a shape row or a navigator item shows what you
are looking for in a small read-only box in the bottom right corner, just above the app's overview
map: the category and its shapes, the command and its key, the item and what it says. Intention: a
little dashboard of what a press would do, before you press. When topology forge 1.9 is there
(`TopoForge.version` 1.9 or later and `TopoForge.preview` a function), the page asks the app to show
it on the overview map itself (`preview({ category })`, `preview(refs)`, `preview(null)` on leaving),
and the plain box stands down.

**The minimap (1.9).** Planned, waiting for the app: once 1.9 lands, the overview map moves and
resizes (by dragging, and by position controls), and its door-handle controls (outside the map's
frame, shown when the pointer comes near, so a hand that knows where they are finds them there) are
the app's. This page then (1) stops placing its preview box (the map is the preview), (2) places the
legend and the frames from `panels().map` as the map moves, (3) adds Options, Overview map: Move and
Reset, which call the app's own controls, so no drag is ever needed. Nothing of this is built before
1.9.

**The layout switch, free only, a light switch that never moves.** A small switch floats just under
where Customize sits in classic (top right). Its body rhymes with about-corwin's d-pad, quietly: a
domed thumb in a rounded track, no glow, no accent bezel. Pressed, the page opens in classic, and the
switch is there in classic too, in the same box, for that tab (so a press undoes the change: blink
compare); it is drawn there as a plain toggle, as business software draws one. A classic visit not
reached by the switch shows only Customize, whose "Page layout" row still switches back. The change
cross-fades where the browser can (a view transition; none with reduced motion, and not with Motion
off); no strobe. Intention: compare the two layouts by pressing one control twice, without looking
for it.

**Classic tabs.** The app's page tabs are the app's (1.9 fixes their overflow); this page adds nothing
around them. Our own project tabs further down wrap onto more rows and never scroll sideways
(observed); they are left as they are. If this page ever adds anything around the app's tabs, it
follows 1.9: a limited count, a fly-up list, our own `<` and `>`, no browser-chrome scrolling.

**1.9 hooks.** Each turns on only when `TopoForge.version` is 1.9 or later and the call is there:
`preview` (above); `place(null)`, so Escape in a frame gives up an armed shape; a `keys` switch asked
for in the address (`embed=...,keys`), so Alt+x, F10, C-x and C-c pressed in the drawing reach the
frames; `topoforge:context` (long press or right click on a shape) opens `*Here*`; `setProps`, so
`*Properties*` edits; `topoforge:pages`, so `*Pages*` and the navigator follow a renamed page. Each
waits for its spec text before its exact shape is fixed.

### Decisions, each with what would prove it wrong

- [HIS] The navigator is back in free, whole. Falsifier: he says it should stay classic's only.
- [MINE] On a wide first visit, two frames side by side (finder, navigator). Falsifier: he finds two
  frames too much on a first visit; then frame 2 opens only on C-x 5 2 (one line, `start()`).
- [MINE] In free, C-x 2, 3, 0, 1, o are the frame's; the navigator's own splits are in its menu.
  Falsifier: he reaches for C-x 3 inside the navigator and expects the navigator's split.
- [MINE] The switch shows in classic only in a tab that got there by the switch. Falsifier: he wants
  it always in classic, or never.
- [MINE] The switch sits just under Customize's place, not on it, so the two never overlap in classic.
  Falsifier: he wants it exactly where Customize is.
- [PLATFORM] Switching still reloads the page (the app's switches are read from its address); a view
  transition softens it. Falsifier: a live switch is wanted; then `embed({...})` does it without reload.
- [DOMAIN] `GPLv3+ or LGPLv3+` and `CC BY-SA 4.0` are short names people use; the SPDX expressions
  stay in file headers, where machines read them. Falsifier: he reads either as machine syntax.
- [MINE] The site's colophon on every page still says `Code GPL-3.0-or-later OR LGPL-3.0-or-later;
  prose CC-BY-SA-4.0.`; this revision changes only the home page's legend. Falsifier: he means that
  footer too; then `LICENCE_LINE` in `build.py` becomes words.

### Found while building (each written where it was decided)

- **The frame you touch comes to the front**, as a window manager raises it: widening frame 1 slid it
  under frame 2, and a press meant for frame 1 moved frame 2 (the test caught it). The selected frame is
  drawn above the others.
- **The legend no longer hides itself when focus goes into the drawing** (revision 2 did, to one row): it
  is one row now, so there is nothing left to hide. Not a feature of his put away; it was ours, and it
  has no work left to do.
- **What free keeps** (the watermark off, the navigator's frame closed) is kept by `js/float.js` under
  `corwin.cloud.free.v1`; `js/free.js` still keeps nothing itself (the check that says so caught it).
- **The 1.9 draft spec** (topology, uncommitted, read 2026-11-02 morning) names `topoforge:key` with
  Emacs's key names (`M-x`, `<f10>`, `C-x`, ...), a sequence held open until the page calls
  `TopoForge.endKeys()`, and the switch words `keys`, `context` and `pagelist`; the hooks follow those
  names. `preview` and `map` are named there but not yet described, so `preview(...)`'s argument here
  is the caller's description (`refs`, `{ category }`, `null`) until the spec says.
- **This build stages committed 1.8** (topology, branch corwin, HEAD `847c8cf`, taken with `git
  archive`, read-only), not the shared checkout, which holds the other helper's unfinished 1.9.

### Forks written, not taken

- The tool-bar as an undockable palette (dock to the frame or float). Not needed: more rows work.
- A strobe (automatic blink compare). He said skip it.

### Built and checked (2026-11-02, stage 1: before topology forge 1.9)

Observed with `sh tests/run.sh` against committed topology forge 1.8: ALL CHECKS PASSED (Python,
node 29, browser 33, navigator 31, home in classic 34, free 46, revision 5 30). The revision 5 suite,
`tests/free5-browser.cjs`, checks each promise above at 1280 and 390, light and dark; its planted
faults (16 new, and 7 earlier ones rewritten for the one-line legend and the new keys table) each
turned red in `PLANT_ONLY=... sh tests/run.sh --prove-red`; `--prove-red` takes `PLANT_ONLY` now, to
prove a subset. The QA passes found and fixed: a frame widened under another took the other's
presses (now the touched frame comes to the front); free.js kept a value itself (moved to float.js);
the switch's cross-fade sat in the "frames never animate" section (moved to its own); an Escape that
dismissed a tooltip ate the next key (ESC now prefixes only a key it binds); the legend, shown again
after being off, ran off the canvas (placed again from its width, and never wider than the canvas).
Screenshots: `SHOTS=dir node tests/free5-browser.cjs`.

Stage 2 (when 1.9 lands in topology, branch corwin): run the suites against it; the preview, keys,
context and pages hooks then run for real; the minimap plan above is built.

### QA plan for revision 5 (written before the build)

Where: a new browser suite, `tests/free5-browser.cjs` (1280 and 390, light and dark, under the deploy
policies), and the existing suites updated where revision 5 changes what they check. Each promise
gets a planted fault in `tests/run.sh --prove-red`.

TOWER
- The legend is one line at 1280: its line's height is one line of its text; no SPDX-style string
  (`-or-later`, `-only`, `CC-BY-SA-`) in its visible text; it names topology forge and Bryant first with
  his link; `GPLv3+` is there. (browser and Python; plant: the SPDX line back)
- The frame moves and its width persists: grip drag and ArrowRight move it; the edge's End and
  ArrowLeft change the width; both survive a reload. (browser; plants: width not kept; edge keys dead)
- The three lines grow together: at the narrowest width the menu bar wraps, and the menu bar, every
  mode-line and the message area all have the same number of lines, more than one; widened, all one.
  (browser; plant: the mode-line left out of the count)
- The navigator is present in free: `*navigator*` shows in frame 2 beside frame 1 (no overlap, both
  visible) with its category tool bar, Narrow prompt and mode-line; pressing Projects and typing a word
  narrows it; an item opens its page; C-x 3 then switching a window shows finder and navigator side by
  side in one frame. (browser; plant: nav.js returns in free)
- No tool labels, but tooltips and names: no tool-bar button has visible text; every one has an
  accessible name; hover and focus each show a tooltip naming it; Escape hides it. (browser; plant:
  labels back)
- Groups are evenly spaced: within a group every horizontal gap between neighbours is the same; no
  gap between neighbours on a row is wider than one cell; the rows of a wrapped group differ by at
  most one tool. (browser; plant: uneven columns)
- The layout switch never moves: its box before the press (free) equals its box after (classic,
  reached by it), and again after pressing back (free); classic not reached by it shows no switch.
  (browser; plant: the switch moved in classic)
- Classic looks unchanged otherwise: the top bar, Customize, the app's own chrome, the navigator's
  grip row, no Emacs frame. (browser: home-browser.cjs, as before)
LADDER
- Every new control has a name; the edge is a separator with its value; tooltips appear on focus;
  AA contrast of the legend, the tooltip, the preview box and the switch in light and dark. (browser)
SIGNAGE
- The preview box says what is pointed at, and says it is a stand-in until the overview map can show
  it. (browser)
ROOF
- No console errors, no off-site request, in both layouts; no inline script or style; the 1.9 hooks
  call nothing when `TopoForge.version` is 1.8. (browser, Python, node)
PEERING: the app through its documented calls only; the hooks are feature-tested.
REMOTES: topology is not changed here (another helper builds 1.9 there).
DOME
- Storage refused: the frames, the navigator and the switch still work. 1280 and 390, light and dark,
  no sideways scroll. (browser)

Manifest: none owed.

## Revision 4: free and classic (2026-11-01, night)

### What Corwin asked (his words, 21:41, with a screenshot of an old cached page)

"I suggest a multi (for now two) stage setting, classic and free. In classic we have the classic
business/office flavored UI that we started from today. It has it's menu back at the top where it
belongs but it can keep the emacs esque footer line and loose all of the self congratulatory
extemporizing from the current. When in the (default) "free" position there are no borders. All of
the pallets look like little Emacs frames. We use an Emacs toolbar modality for the shape picker. Our
clever gadget that we used as a fancy link finder becomes a shape/item finder, this can be a single
modal pallet supporting split frame [...] The vision of free is that it's just this empty page with
our background... no title bar, page framing, footer. The bottom legend/attributions block floats
free in space behaving like a watermark; it can be disabled. An emacs frame floats left. It has menus.
They are the only menus [...] think about the mode-line the way Emacs thinks about the mode line: as
a string of elements which may be templatized and may be interactable [...] Look for ways to make
Emacs appear to be floating into the middle of our specially free-drawing drawing canvas to help us
reach editor/access related functions conveniently." (The whole prompt is in c4,
`q/2026-11-01-free-and-classic/PROMPT.md`.)

### The switch

- Two values, `free` (default) and `classic`, kept per browser under `corwin.cloud.ui.v1` (read and
  written in try/catch; with storage refused the page is free, or what the address says, for the
  visit). The address wins and is kept: `?ui=free` or `?ui=classic`.
- `js/ui.js` is a small script loaded in the head without `defer`, so the setting is on `<html
  data-ui="...">` before the page is drawn (no flash of the other setting). It adds one row to
  Customize, "Page layout: Free / Classic" (Customize's own markup is staged from about-corwin
  unchanged; the row is added at run time, after its last setting). The free frame's Options menu
  carries the same switch. Choosing the other value saves it and reloads the page, because the drawing
  app is asked for different switches in each (below).
- Only the home page differs. Every other page is the same in both.
- A link to a project's tab (`index.html#tab-...`, from the directory's cards and the Go to: prompt)
  needs the long page, which free does not show, so such a visit opens classic, and nothing is kept.
- With scripts off there is no setting: the top bar, a short heading, the plain list of links (the
  navigator without scripts), the legend as a block and the projects in words.

### Classic

- The site's top bar is back at the top (Home, Directory, Demos, Packages, About, and Customize at the
  right). The heading is two words: "The shop, drawn".
- topology forge with its own chrome: the frame asks only for `embed=select,ready` (the selection and
  ready messages; no switch that changes how it looks).
- The navigator (revisions 1 to 3, `js/nav.js`) is the finder, a palette that starts hidden to its
  one grip row, floating over the canvas right of the app's shapes; "show" opens it.
- Under the drawing, one row: "topology forge (formerly TopoForge) by Bryant Frankford · code
  GPL-3.0-or-later or LGPL-3.0-or-later · prose CC-BY-SA-4.0 · source", and one row of links (the app
  full size, the drawings as a file, start again) with the one-line status. The five-cell legend is not
  shown in classic.
- The page's mode-line and minibuffer (Go to:) stay at the foot.
- Gone, in both settings, from what is built: the heading's explanation of where the page tabs are,
  the paragraph introducing the processes (each process is now one line), the long hint above the
  project tabs, and the colophon's second licence sentence (it said the licence twice).

### Free (the default)

The page is our background and nothing else: no top bar, no heading in sight (it stays for screen
readers), no page frame, no footer, no page scroll. The drawing fills the window, asked for with
`embed=bare,select,ready` (and `load=` on a first visit), so every bar and panel of the app is hidden
and the page offers what they offered through the app's calls (`commands()`, `run(id)`, `shapes()`,
`place(id, ...)`, `showPage`, `embed({...})`). Over it: **one Emacs frame**, the legend as a
**watermark**, and the app's own overview map (bottom right).

#### The Emacs frame, top to bottom

| Part | Emacs name | What it holds |
|---|---|---|
| Grip | (the window manager's) | `⠿` at the start of the menu bar: drag it, or focus it and use the arrow keys (16 pixels, 64 with Shift); Options, Move does it with one press (WCAG 2.5.7) |
| Menu bar | menu-bar | **Site** (Home, Directory, Demos, Packages, About, JavaScript licences, the app full size, the drawings as a file, start again), **File**, **Edit**, **Arrange**, **Layout**, **View** (the app's `commands()`, each menu as the app groups it, its headings as separators, its keys shown, disabled ones disabled), **Options** (Customize..., Page layout: free or classic, Legend watermark on or off, Motion, Properties, Pages, Move, Show or hide the tool-bar and finder), **Help** (Keys, Credits and licence, About this frame, and the app's own Help items). They are the only menus on the page. F10 opens the first; Left and Right move between menus, Up and Down within one, Enter runs, Escape closes. File also carries Emacs's own frame and window items: New frame (C-x 5 2), Delete frame (C-x 5 0), Split window below (C-x 2), Split window right (C-x 3), One window (C-x 1), Delete window (C-x 0), Other window (C-x o). |
| Tool-bar | tool-bar | One **tile** per shape category, from `shapes()`: the first shape's own icon above the category's name, as Emacs draws a tool-bar with `tool-bar-style` set to `both`. A tile is a toggle (`aria-pressed`): up, it is a raised bevel; pressed, it is sunk in. Pressed tiles narrow the finder's shapes to those categories; none pressed shows every category. Deliberately unlike the navigator's flat bracketed category buttons. |
| Finder | windows | One to four **windows** (splits), each with its own scroll, point and folded sections and its **own mode-line**. Each window lists **Shapes** (by category, as the tool-bar narrows them) and then what the drawing draws, from the navigator's index (projects, processes, hosts, people, paths, pages, demos). The minibuffer's words narrow all of them (about-corwin's `taxonomy.js` matching, as the navigator). |
| Mode-line | mode-line | Built from a template (below), one per window; the selected window's is the active face. |
| Message area | echo area / minibuffer | One line. Messages land here. Click it, press Alt+x, or Escape then x (Emacs's ESC prefix), and it becomes the **one-line input**: `M-x ` and a text box with completion over the app's `commands()`, this frame's commands, the shapes and the finder's items (a list over the line, the W3C combobox pattern: Up and Down move, Tab completes, Enter runs, Escape quits). Typing also narrows the finder. When focus leaves it, it is the message line again. |

#### Choosing a shape (the tool-bar and the finder)

- **Enter** on a shape in the finder, or choosing it in M-x: `place(id, 'center')`, the shape is
  dropped in the middle of the view (WCAG 2.5.7: no drag needed).
- **A click** on a shape: `place(id)` arms it, as the app's own palette does; the next press on the
  drawing drops it there, and Enter in the frame while one is armed drops it in the middle.
- **Dragging** a shape onto the drawing: HTML drag and drop with the type `text/x-topoforge` set to
  the shape's id, as the app's own palette does; the drawing takes the drop.
- An item that has a page in the drawing opens it with `showPage` (not over a drawing of the
  visitor's own, as before); a demo or a link opens its address.

#### Splits and frames: the keys

With focus in a frame, never single keys, never Ctrl+N, T or W: C-x 2 (split below), C-x 3 (split
right), C-x 0 (delete window), C-x 1 (one window), C-x o (other window), **C-x 5 2** (a second
floating frame, with its own tool-bar, finder and mode-line), C-x 5 0 (delete this frame; the first
one stays), C-x 5 o (other frame), C-c . (the frame by the shape, below), Alt+x or ESC x (M-x), F10
(the menu bar), C-g or Escape (quit). At most four windows per frame and four frames (four is the
house's GRAIN number: picked, not measured). On a narrow screen there is one frame; C-x 5 2 says so.

#### The mode-line: a template of elements

Emacs builds a mode-line from `mode-line-format`, a list of elements: strings, `%`-constructs and
`(:eval ...)` forms, each of which may carry `help-echo` (said on hover) and a `local-map` (what a
click does). Here the same: **the template is a string**; text outside `%` is printed as it is;
`%name` is an element from the table; `%%` is a percent sign. The default template:

    %buffer  %page  %select  %zoom  %filter  %split  %lighters

Each element is `{ name, scope, text(ctx), help(ctx), act }`: `text` what it prints (empty prints
nothing, and the two spaces before it are dropped), `help` what pointing at it or focusing it says in
the message area, `act` the command a click (or Enter) runs. `scope` says whose command it is:
**core** (the frame's own), **mode** (the finder's, or the app's through `run(id)`), or **context**
(it depends on what is selected or shown). An interactive element is a button with a name for screen
readers; the selection's element also answers a long press (half a second). The table:

| Element | Scope | Prints | A click runs |
|---|---|---|---|
| `%buffer` | core | the buffer's name, `*finder*` | switch-to-buffer: M-x opens with the buffer names (`*finder*`, `*Pages*`, `*Properties*`, `*Credits*`, `*Here*`) |
| `%page` | context | `p:` and the page of the drawing in view | the Pages box |
| `%select` | context | what is selected in the drawing (the app's select message): its name, `+N` for more; nothing when nothing is | C-c .: the frame by the shape (also a long press) |
| `%zoom` | mode | `−` `zoom` `+`, three buttons | the app's View, Zoom out / Fit to window / Zoom in, by `run(id)`; the mouse wheel over it zooms too |
| `%filter` | mode | the pressed tiles and the words, or `all` | clears them |
| `%split` | core | `W1/2`: this window of how many (only when split) | C-x o |
| `%lighters` | core | `(Finder Motion GPL)`, Emacs's minor-mode lighters | `Finder`: describe the mode in the message area; `Motion`: turns motion on or off (about-corwin's Customize presses it for "Reduce motion": it is the page's `#motion` button); `GPL`: Credits and licence |

The template and the table live in `js/free.js` (`MODE_LINE`, `ELEMENTS`); a test reads every element
in the browser and presses each interactive one.

#### Every other palette is a small Emacs frame

A small frame is a box with one buffer and its own mode-line at the foot; its buffer name is its grip
(drag it, or arrow keys) and it has a `[x]` to close (C-g or Escape too). Built:

- **`*Pages*`** (Options, Pages; or a click on `%page`): every page of the drawing, the current one
  marked; Enter or a click opens it with `showPage`.
- **`*Properties*`** (Options, Properties): what the app's select message says of the selection (name,
  its tooltip, kind, page, id, reference, how many), read-only, with `[Open the app's own Properties]`
  (`embed({ props: true, 'hide-props': false })`, the app's floating inspector, where editing
  happens) and `[Hide it]`.
- **`*Credits*`** (Help, Credits and licence; or `GPL` on the mode-line): the legend's cells.
- **`*Here*`, Emacs floating into the canvas** (C-c ., a click or long press on `%select`): first the
  app's View, Zoom to selection runs (as C-l recentres in Emacs), which puts the selected shape in the
  middle of the view; then a small frame opens just right of the middle, beside it. It holds the
  selection's name and tooltip; the app's commands that apply to it now (Edit text, Duplicate, Delete,
  Bring to front, Send to back, Zoom to selection; disabled ones not offered); and the access settings
  carried over from about-corwin: text size smaller or larger, colour theme (follow system, light,
  dark, high contrast), reduce motion, and Customize... (these press Customize's own controls, so
  Customize stays the one place they are kept).

Written down, not built (each needs something the app does not yet offer; see the requests below):
the `*Here*` frame placed exactly at the shape without zooming (needs the shape's place on screen);
opened by a long press or a right click on the shape itself (needs the app to tell the page); a
`*Properties*` frame that edits (needs a way to set a shape's fields); a zoom number in `%zoom`
(needs the view); Alt+x, C-c . and F10 pressed while focus is inside the drawing (keys pressed there
go to the app).

#### The legend, as a watermark

On a wide screen the legend floats at the bottom of the canvas, left of the overview map, with no box:
the canvas colour at 90 % behind its text (so its words keep AA contrast over a drawing) and hairlines
only between its cells. It keeps its grip, its arrow keys and `hide` (to its one row), and gains
`off` (Options, Legend watermark). Off, the legal notices stay visible and reachable three ways:
`GPL` on every mode-line (a lighter, always shown), Help, Credits and licence (the `*Credits*` frame
with every cell), and the one-row credit, which the `*Credits*` frame heads. That is how GPLv3
section 5(d) ("each must display Appropriate Legal Notices") stays met with the watermark off (a
reading of its words, not legal advice). It is kept under `corwin.cloud.free.v1`.

#### Narrow screens (47.5rem or less), free

Nothing floats. The drawing fills the window above the frame; the frame sits at the foot, full width,
as Emacs in a terminal: its menu bar, the mode-line and the message line, with the tool-bar and
finder folded (the `+` at the end of the menu bar unfolds them; M-x works folded). The legend is its
one row.

### Accessibility

Keyboard routes for everything (above); every button, tile, element and frame has a name; the message
line is a polite status; nothing animates (no transition anywhere in a frame; reduced motion and
about-corwin's "Reduce motion" both turn the site's motion off); text in the frames follows
Customize's text size; AA contrast in both themes from egad's tokens (checked in the browser by
computing the ratios). Dragging is never the only way: shapes by Enter, frames by arrow keys and
Options, Move. Customize's settings are about-corwin's, staged unchanged; the `{{TONE_ROWS}}`
placeholder its page now carries is filled with nothing, as about-corwin's own build does when the
tone pads are off (it had leaked onto the live page as text).

### Decisions, each with what would prove it wrong

- [HIS] Free is the default. Falsifier: he says a first visit should be classic.
- [MINE] Classic keeps the navigator as the finder, hidden to its grip row: it is the finder he asked
  for in the afternoon, and free's finder is new. Falsifier: he says classic is the morning page with
  no navigator at all; then nav.js leaves classic too (one line in `nav.js`).
- [PLATFORM] Changing the setting reloads the page (the app's switches are read from its address).
  `embed({...})` could change most of them live, but `load=` and the first fit cannot be redone
  cleanly. Falsifier: a reload loses something a visitor did (it does not: the app keeps its working
  copy, and stage.js reopens it).
- [MINE] The by-shape frame zooms to the selection before it opens. Falsifier: he finds the jump
  unwelcome; then it opens at the middle without zooming.
- [DOMAIN] The watermark can be turned off, but `GPL` on the mode-line cannot. Falsifier: none here.

### Asked of the app (requests into topology, branch corwin, for Bryant's agreement; nothing changed in `www/topoforge`)

1. **The view**: `TopoForge.view` (`k`, `x`, `y`) and a `topoforge:view` message when it changes, so
   `%zoom` can print the zoom and the page can place things on the drawing.
2. **Where the selection is**: a `rect` (in the app's pixels) in the select message, so `*Here*` can
   float beside the shape without zooming to it.
3. **Disarming**: `place(null)` gives up an armed shape, so Escape in the frame can, as Escape in the
   drawing does.
4. **Keys for the parent**: an embed word `keys` that forwards Alt+x, F10, C-x and C-c prefixes pressed
   in the drawing to the parent page (the same origin rule as the select message).
5. **Long press and right click**: a `topoforge:context` message (the shape and the point), so a long
   press on a shape opens `*Here*`.
6. **Setting a shape's fields**: `TopoForge.setProps(id, patch)` (one undo step), so `*Properties*`
   can edit as a small Emacs frame and the app's inspector need not be called up.
7. **Pages changed**: a `topoforge:pages` message when a page is added, renamed or removed, so
   `*Pages*` follows without a reload.

### Built and checked (2026-11-01, night)

Observed, with `sh tests/run.sh` (ALL CHECKS PASSED: Python 40, node 29, browser 33, navigator 31,
home in classic 34, free 46) and `sh tests/run.sh --prove-red` (PROVE-RED OK: 145 planted faults,
each red; the first run found two checks too weak to turn red, the jslicense row and the GPL
lighter, and both checks were tightened). Screenshots, light and dark, 1280 and 390, both layouts:
`tests/free-browser.cjs` with `SHOTS=dir`.

Known and left (a warning, not a fault): in free, the app fits the drawing to the whole window, so
on a first visit the frame covers the drawing's left edge until it is moved or folded (`−` at the
end of its menu bar). Placing the fit beside the frame needs the view (request 1 below).

### QA plan for revision 4 (written before the build)

Where each runs: Python in `tests/check_site.py`; node in `tests/check.mjs`; the browser in
`tests/free-browser.cjs` (new: free and the switch, 1280 and 390, light and dark), `tests/home-browser.cjs`
and `tests/nav-browser.cjs` (now run in classic). Each promise gets a planted fault in
`tests/run.sh --prove-red`.

TOWER
- Free shows no chrome but the one frame and the watermark: the top bar, heading, page mode-line,
  minibuffer, colophon and the projects are not visible; nothing visible lies outside the frame, the
  legend and the drawing; the app's top bar, palette, inspector and page tabs are hidden (its body
  carries `tf-hide-*`); the page does not scroll. (browser; plant: the top bar shown in free)
- Classic has the top menu and no long prose: the top bar is visible; outside the project panels no
  visible block of text runs past 160 characters; the app is asked for `select,ready` only and keeps
  its own top bar. (browser, Python; plants: a long paragraph back; the top bar hidden in classic)
- The switch persists: `?ui=classic` is kept across a plain reload; the Customize row and Options both
  switch; with storage refused the page still opens free. (browser; plant: the setting not saved)
- A tool-bar tile toggles a category: pressing a tile sets `aria-pressed` and the finder lists only
  that category's shapes; pressing it again lists all. (browser; plant: the tile not filtering)
- Choosing a shape places it: Enter on a shape adds one shape to the page; a click arms it
  (`TopoForge.placing`); rows are draggable with `text/x-topoforge`. (browser; plant: Enter not placing)
- The mode-line elements are interactive: every element of the template renders from the table;
  every interactive one is a named button that does something (the message area or the page changes);
  the selection appears in `%select` and clears. (browser; plant: an element with no action)
- The message area becomes the input and back: a click, Alt+x and ESC x each turn it into the input;
  completion offers app commands and shapes; Enter runs one; focus leaving returns the message line.
  (browser; plant: blur not restoring)
- C-x 5 2 makes a second frame with its own mode-line; C-x 5 0 removes it; C-x 2 and C-x 3 split
  with a mode-line per window. (browser; plant: C-x 5 2 undefined)
- The small frames: Pages lists the pages and opens one; Properties shows the selection; `*Here*`
  opens by C-c . with the access settings. (browser)
LADDER
- Every menu is a keyboard menu (F10, arrows, Enter, Escape); every tile, element and button has a name;
  frame text has AA contrast in light and dark; no transition on any frame; frame text follows
  Customize's size. (browser; plant: a transition on the frame)
SIGNAGE
- With the watermark off, `GPL` is on the mode-line and Help, Credits and licence shows Bryant with his
  link and the licence words. (browser; plant: the lighter dropped)
ROOF
- No inline script or style (ui.js and free.js are files); LibreJS labels and jslicense rows for both;
  no console errors and no request to another host in either setting; no `{{` placeholder on any page.
  (Python, node, browser; plants: ui.js missing from jslicense; free.js asks another host; the
  placeholder left in)
- Icons from `shapes()` enter the page without `style` attributes or scripts. (browser)
PEERING: the app, unchanged, through its documented calls and messages only; no script reaches into
its page (the existing check, now over free.js too).
REMOTES: about-corwin's Customize used as staged; the row and the placeholder are handled at our end.
DOME
- Storage refused: free still opens and the frame works. No sideways scroll at 1280 and 390, light and
  dark, in both settings. Scripts off: the plain list of links. (browser)

Manifest: none owed.

## Revision 3: the page asks the app (2026-11-01, late evening)

### What Corwin said (his words)

20:20: "We are subsuming 'TOPOForge'. A number of us discussed. ... It is fine to call it topology
forge. Our work is focused on the corwin branch of the topology repo. Please make sure we are
collecting our 'best of' there, and building from there." (Quoted with the spelling he corrected at
20:51: "topology is the correct name.") 20:35, in this repository's AGENTS.md: TopoForge's project is
obsolete; its work is merged forward into topology, branch corwin, which is kept current and built from.

### The name

The drawing app is **topology forge (formerly TopoForge)**, made by Bryant Frankford, with Corwin
Brust and contributors. Bryant is named first. Our own text (this file, the legend, the catalog's
credits, README) says the new name; the app's internal names stay (`window.TopoForge`, its JSON
format, its storage keys), because saved drawings and this page rely on them.

### What was built in the app (topology, branch corwin, `www/topoforge/`, version 1.8)

The six changes proposed in revision 2 ("The TopoForge-side changes, proposed", below), built as
switches that are all off when the app is opened on its own; its spec is topology's
`topoforge/spec/EMBED-v1.md`, its checks `topoforge/tests/browser/embed.browser.mjs`. Opened on its
own, 1.8 draws the same pixels as 1.7 (that kit compares them at three widths, light and dark).

### What this page now asks for, and what went

- The frame's address asks for `embed=frameless,props,pages,select,ready` (with `load=` on a first
  visit): no frame, Properties floating from the right, the page tabs in the overview box at the
  drawing's bottom right, and the selection and ready messages. The shapes stay a column: the
  navigator floats beside them. "The app full size" opens it on its own, with no switch.
- `stage.js` waits for the app's `topoforge:ready` message and opens a project's page with the app's
  own `TopoForge.showPage`. Gone: polling `TopoForge.doc` every 100 ms (`fit`, `choose`) and pressing
  the app's page-tab buttons from outside.
- `nav.js` opens an item's page with `TopoForge.showPage`, and follows the page in view and the
  selection from the app's messages. Gone: the 700 ms poll (`watch`) and the tab-button clicks. What
  is selected in the drawing fills each window's item line when nothing is pointed at:
  "Selected in the drawing: <name>: <tooltip> · <kind> · page <page>".
- `float.js` asks `TopoForge.panels()` where the shapes, Properties and the overview are, and places
  the navigator and the legend from that and from the ready message. Gone: reading the app's page
  (`contentDocument`) and re-placing on a timer after the frame loads.
- Each message listener hears only its own frame, of this site's origin (`ev.origin` and
  `ev.source` both checked); the app itself posts only to its own origin.
- The legend says "topology forge (formerly TopoForge), made by Bryant Frankford ..." and its hidden
  row "topology forge (formerly TopoForge) by Bryant Frankford ...".

### Checks added (each with a planted fault in `tests/run.sh --prove-red`)

The frame asks for every switch and "Full size" for none (and each word is one the app's spec
defines); the legend names the app by its new name with Bryant first; the misspelling of the name is
in no source, document or built page; no home-page script reaches into the app's page or hears a
message from any other frame or origin, and no poll for the app is back; in the browser, the app
opens frameless with Properties floating and the tabs in the overview, and a selection in it shows in
the mode-line with its tooltip and clears.

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

### The TopoForge-side changes, proposed (built in topology forge 1.8: see revision 3 above)

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
REMOTES: the TopoForge-side proposal above was written, not built, in revision 2; revision 3 built it.
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
