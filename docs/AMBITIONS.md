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

**Open.** Nine projects have no `TOPOLOGY.md` yet (card-games.el, .github, ta,
three-phase-transcription, journal, pubs, the PHP backport, egad and hello-taxgnomes, counted
2026-11-01); their pages come from the catalog alone and say so. Writing those files in topology's
`examples/inputloop/` fills their pages in on the next build.

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

**Open.** BPMN and BPMN+ drawings as data (lanes as zones, gateways as diamonds) for a project whose
work has a process worth drawing; asking Bryant whether TopoForge could relabel its palette per
notation.

## 5. A showcase that hosts every demo it can

**Read.** Live demos of every inputloop application that can run here (static, same origin), each
credited as the shop's catalog gives it; the site as the first entry of an "inputloop ring" of free
software self-hosting providers, without a forge as its front door.

**Today.** `/demo/` has a page for every app. Quantum 3D5, hello-taxgnomes and egad's measured
colours run here, staged at build time from their public repositories. Gitcha and topology open as
drawings. NextTime, fourSwordsFromThePast, vibrobeast, vibrobeast-skills, card-games.el and the PHP
backport say what they need and how to run them.

**Open.** NextTime's demo loads Vue and MapLibre from another host; serving our own pinned copies
would let it run here. A "ring" page naming the other members, once there are any.

## 6. One house design, shared, not forked

**Read.** egad (the house design system, from Emacs's Modus colours), the Emacs mode-line footer, and
from aboutcorwin.com the floating Customize-style accessibility palette and the Emacs CI gadget:
share them, do not fork them.

**Today.** The colours and the mode-line are shared already. egad has a demo page that measures its
own promises.

**Open.** The Customize palette and the CI gadget live in about-corwin; the way to share them is the
way topology is shared: stage them at build time from a checkout, not copy them.

## 7. Live data in one shape

**Read.** The channel feed (the last revision per channel), specified in c4's `d/channels/SPEC.md`;
per-app status badges can read it later.

**Open.** Not built here yet. When the feed is public, a badge on each demo and directory card can
read it from this site's own address.

## 8. From the physical to the graphical

**Read.** From obsmage: screen maps, cameras and hosts as places, drawn; a kind of drawing the site
can show.

**Today.** "obsmage: scenes" draws a screen map (invented names) on the physical layer; hosts sit on
the physical layer of every page.

**Open.** A drawing of a real desk (monitors, cameras, the host behind them) once obsmage's composer
can write TopoForge JSON.
