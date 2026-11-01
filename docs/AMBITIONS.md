# What corwin.cloud is for: our reading of Corwin's interface ambitions

Written 2026-11-01 from Corwin's words that day, his original topology request (kept word for word in
topology's `context/PROMPT-2026-10-31-topology-corwin.md`), and topology's design notes. Corwin read
the eight points below on 2026-11-01 and said: "Ambitions is good, thank you for this." Correct it
by editing this file; the site is built toward it.

Each point says what we read, then what the site does about it today and what is still open.

## 1. The drawing is the front door, and the person is at the centre

**Read.** topology is the front door of corwin.cloud. Each person who uses it is "at the center of
the universe", and the site shows the shop's methods without saying so ("say it without saying it").

**Today.** The home page is TopoForge itself, full width, opened on a drawing of the shop. Its first
page puts "You (this browser)" in the middle, with the four pillars (place, part, path, person)
around you. Everything you draw stays in your browser. The methods show in what the page lets you
do (keep your own copy, start again, read every source, switch views), not in claims about them.

**Open.** A first-visit tour in TopoForge's own words would be Bryant's to add.

## 2. A tab for every project, in the default drawings

**Read.** A TopoForge page for each project the directory lists, in the default set of drawings,
plus obsmage's workflows and scenes; drawn from the four pillars and the show-private rule (show,
hide or auto).

**Today.** Built: `drawings.py` makes one page per directory project (21 on 2026-11-01), obsmage's
workflows and scenes, and Bryant's five pages of how Gitcha works. The pages are TopoForge's own page
tabs. This site is public, so its floor is "never": a private part of a `TOPOLOGY.md` is never drawn,
and the page says one was kept back.

**Done (next pass, 2026-11-01).** The nine projects that had no `TOPOLOGY.md` (card-games.el, .github,
ta, three-phase-transcription, journal, pubs, the PHP backport, egad and hello-taxgnomes) have one in
topology's `examples/inputloop/`, written from each project's own README, with four path files
(pubs-refresh, transcript-sync, egad-emit, profile-build). A check fails if a page is drawn from the
catalog alone.

## 3. Choices belong to the person: late, reversible, visible

**Read.** Options before guards, guards before hard-coded behaviour. "Zero Sharing" by default:
everything in browser storage only.

**Today.** Nothing is sent anywhere. Your working copy in TopoForge is never replaced without you
asking ("Start again from the shop's drawings"). topology's own settings are one click away, closed
until asked for.

## 4. Treatments through TopoForge's own interfaces

**Read.** Let people choose how a drawing is read: UI and UX views, BPMN (and Corwin's BPMN+),
flowcharts and logic, operational and physical layouts, using TopoForge's own interfaces, not a
second interface bolted on beside it.

**Today.** Each drawing puts its shapes on TopoForge layers named for what they are: words,
abstract (people), operational (projects, parts, paths), physical (hosts, screens) and flow (how it
works). TopoForge's own Layers panel switches views. Every project with a "how it works" gets a
flowchart drawn with TopoForge's own flowchart shapes. The look and notation menus that changed only
the page around TopoForge are tucked away (see the UI audit).

**Today (next pass).** Two processes are drawn as data: aboutcorwin.com's assembly line (mint on gw33,
the feed, the pull on the web host) and a GNU release uploaded as a triplet. Each element says what
it is; topology's own notation table decides the shape. Each is a page in the drawing (BPMN) and a
file in BPMN, BPMN+ and flowchart, offered under the drawing.

**Open.** Asking Bryant whether TopoForge could relabel its palette per notation; Corwin's own BPMN+
may hold more than the act axis.

## 5. A showcase that hosts every demo it can

**Read.** Live demos of every inputloop application that can run here (static, same origin), each
credited as the shop's catalog gives it; the site as the first entry of an "inputloop ring" of free
software self-hosting providers, without a forge as its front door.

**Today.** `/demo/` has a page for every app. Quantum 3D5, hello-taxgnomes and egad's measured
colours run here, staged at build time from their public repositories. Gitcha and topology open as
drawings. NextTime, fourSwordsFromThePast, vibrobeast, vibrobeast-skills, card-games.el and the PHP
backport say what they need and how to run them.

**Today (next pass).** NextTime's demo runs here on pinned copies of Vue, Vue Router and MapLibre,
checked by sha256 at build time; its map has no base map (the tiles would come from another server).
Its folder alone allows the browser's eval, because Vue compiles the demo's templates in the page.

**Open.** A "ring" page naming the other members, once there are any. Precompiling NextTime's
templates would drop the eval exception; that is a change to the demo, so it is the demo's author's.

## 6. One house design, shared, not forked

**Read.** egad (the house design system, from Emacs's Modus colours), the Emacs mode-line footer, and
from aboutcorwin.com the floating Customize-style accessibility palette and the Emacs CI gadget:
share them, do not fork them.

**Today.** The colours and the mode-line are shared already. egad has a demo page that measures its
own promises.

**Today (next pass).** The Customize palette (kept per browser) and the Emacs CI strip are staged at
build time from an about-corwin checkout, unchanged, and a check proves it byte for byte.

## 7. Live data in one shape

**Read.** The channel feed (the last revision per channel), specified in c4's `d/channels/SPEC.md`;
per-app status badges can read it later.

**Today (next pass).** The about-corwin directory card reads its channel feed from this site and says
its last revision and when it was made, in words. A missing feed leaves the line hidden.

**Open.** Badges on demo pages, once a demo app has a channel of its own.

## 8. From the physical to the graphical

**Read.** From obsmage: screen maps, cameras and hosts as places, drawn; a kind of drawing the site
can show.

**Today.** "obsmage: scenes" draws a screen map (invented names) on the physical layer; hosts sit on
the physical layer of every page.

**Open.** A drawing of a real desk (monitors, cameras, the host behind them) once obsmage's composer
can write TopoForge JSON.
