// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// free.js: the free page layout (docs/NAV.md, revisions 4 and 5). The drawing fills the window (the app is
// asked for embed=bare, so its own bars and panels are hidden) and one Emacs frame floats near the left
// edge, top to bottom: a menu bar (the site's pages, the app's commands() as its menus grouped them,
// Options, Help: the only menus on the page), a tool-bar of shape categories (tiles that press and
// unpress), the finder (shapes and what the drawing draws, in one to four windows, each with a
// mode-line built from a template of elements), and the message area, which becomes a one-line M-x
// input. C-x 5 2 makes another frame. Pages, Properties, Credits and the frame by the shape (*Here*,
// C-c .) are small Emacs frames. Revision 5 ("yes, and"): a window can show *navigator* (js/nav.js, the
// navigator of revisions 1 to 3, whole) instead of *finder*; on a wide first visit frame 2 shows it beside
// frame 1; the frame moves by its menu bar too and widens by its right edge; the menu bar, the mode-lines
// and the message area grow by a line together; the tool-bar is icons in even groups with tooltips; a
// preview box says what is pointed at (topology forge 1.9's preview() takes over when it is there). It talks to the app only through its documented calls and messages
// (topology forge 1.8, spec/EMBED-v1.md), never reaching into its page; it reads one file from this
// site (nav/index.json) and asks the network for nothing else; it keeps only places (js/float.js) and
// the watermark's on or off (js/float.js) in this browser.
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  if (html.getAttribute('data-ui') === 'classic') return;
  var grid = doc.getElementById('stage-grid'), app = doc.getElementById('topology');
  if (!grid || !app || !window.fetch || !window.JSON || !window.CCFloat) return;
  var MAXWIN = 4, MAXFRAMES = 4;   // the house's GRAIN number: picked, not measured
  var T = window.Taxonomy && window.Taxonomy.tokenize && window.Taxonomy.similarity ? window.Taxonomy : null;
  var narrowQ = window.matchMedia ? window.matchMedia('(max-width: 47.5rem)') : { matches: false };
  var IX = null, CATS = [], SHAPE = {}, ICON = {}, CMDS = [], SEL = null, READY = null, PAGE = '';
  var frames = [], cur = null, small = {}, nextFrame = 1, MOTION = html.classList.contains('motion-on');
  var NAVAT = null, MAXLINES = 4, LH = 24, CELL = 30;   // where *navigator* is shown; lines and tool cells, in pixels
  var VIEW = null, HERE_AT = null;
  // the map mode (revision 7): cards (left), both (middle, the default), rings (right); kept per browser
  var MAPMODES = ['cards', 'both', 'rings'], MAPWORDS = { cards: 'Preview shapes: the card of what is pointed at', both: 'Both: matches highlighted, and the card', rings: 'Highlight matches: rings in the map, its caption in the echo area' };
  var MAPMODE = (function () { var m = fstate().mapMode; return MAPMODES.indexOf(m) >= 0 ? m : 'both'; })();   // topology forge 1.9: the view, and where *Here* floats (beside the selection)
  // the menu bar's priority+ overflow (revision 6): the last of these go into » first; Site never does
  var DROP = ['Layout', 'Arrange', 'Help', 'Options', 'View', 'Edit', 'File', 'Navigator'];
  // the layout switch's box, in the stage's pixels: no frame's top row sits under it (js/float.js moves it below)
  function switchBox() {
    var sw = doc.getElementById('ui-switch');
    if (!sw || !sw.offsetWidth) return null;
    var r = sw.getBoundingClientRect(), g = grid.getBoundingClientRect();
    return { x: r.left - g.left - 4, y: r.top - g.top - 4, w: r.width + 8, h: r.height + 8 };
  }
  function mapTop(H) { var t = tf(), m = null; try { m = t && t.panels && t.panels().map; } catch (e) { m = null; } return m && m.shown ? m.y : H - 150; }
  // what free keeps (the navigator's frame closed or not) is kept by js/float.js, under corwin.cloud.free.v1
  function fstate() { return window.CCFloat.freeState ? window.CCFloat.freeState() : {}; }
  function fkeep(k, v) { if (window.CCFloat.freeKeep) window.CCFloat.freeKeep(k, v); }

  // ---- small helpers ------------------------------------------------------------------------------
  function mk(tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'cls') n.className = v; else n.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function tf() { try { var w = app.contentWindow; return w && w.TopoForge && w.TopoForge.commands ? w.TopoForge : null; } catch (e) { return null; } }
  // topology forge 1.9's calls turn on only when its version says so and the call is there
  function vge(v, w) {
    var a = String(v || '0').split('.').map(Number), b = String(w).split('.').map(Number);
    for (var i = 0; i < Math.max(a.length, b.length); i++) { var x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y; }
    return true;
  }
  function nine(call) { var t = tf(); return t && vge(t.version, '1.9') && (!call || typeof t[call] === 'function') ? t : null; }
  // and 1.10's (the map's modes, its card): the slider drives the app's mapMode, the card goes into the map
  function ten(call) { var t = tf(); return t && vge(t.version, '1.10') && typeof t.mapMode === 'function' && (!call || typeof t[call] === 'function') ? t : null; }
  // and 1.11's (the map's pad, Reset layout)
  function eleven(call) { var t = tf(); return t && vge(t.version, '1.11') && typeof t.resetLayout === 'function' && (!call || typeof t[call] === 'function') ? t : null; }
  function nav() { return window.CCNav || null; }
  function say(t) { if (cur) cur.say(t); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function tok(q) {
    if (T) return T.tokenize(q);
    return String(q || '').toLowerCase().split(/[^a-z0-9'+.-]+/).filter(Boolean);
  }
  function sim(w, v) {
    if (T) return T.similarity(w, v);
    if (w === v) return 1;
    if (w + 's' === v || v + 's' === w) return 0.95;
    return w.length >= 3 && v.indexOf(w) === 0 ? 0.8 : 0;
  }
  function matches(words, q) {
    var ws = tok(q);
    return ws.every(function (w) { return words.some(function (v) { return sim(w, v) >= 0.8; }); });
  }
  // an icon from the app's shapes(): parsed as SVG, with no script, no style attribute, no handler
  function cleanIcon(src) {
    try {
      if (!/^<svg[\s>]/.test(src)) return null;
      if (!/\sxmlns=/.test(src.slice(0, src.indexOf('>')))) src = src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      var d = new DOMParser().parseFromString(src, 'image/svg+xml'), svg = d.documentElement;
      if (!svg || svg.nodeName !== 'svg') return null;
      each(svg.querySelectorAll('script, foreignObject, style'), function (x) { x.parentNode.removeChild(x); });
      [svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))).forEach(function (el) {
        Array.prototype.slice.call(el.attributes).forEach(function (a) {
          if (a.name === 'style' || /^on/i.test(a.name) || /href$/i.test(a.name)) el.removeAttribute(a.name);
        });
      });
      var n = doc.importNode(svg, true);
      n.setAttribute('aria-hidden', 'true'); n.setAttribute('focusable', 'false'); n.setAttribute('class', 'ef-icon');
      return n;
    } catch (e) { return null; }
  }
  function icon(id) { var n = ICON[id]; return n ? n.cloneNode(true) : mk('span', { cls: 'ef-icon ef-noicon', 'aria-hidden': 'true' }); }

  // ---- the app: what it says, and what we ask of it ------------------------------------------------
  function refreshCmds() { var t = tf(); if (t) { try { CMDS = t.commands(); } catch (e) { /* keep the last list */ } } return CMDS; }
  function cmd(id) { refreshCmds(); return CMDS.filter(function (c) { return c.id === id; })[0] || null; }
  function runApp(id) {
    var t = tf(), c = cmd(id);
    if (!t || !c) { say('The drawing app is not ready yet.'); return false; }
    if (!c.enabled) { say(cap(c.menu) + ', ' + c.label + ' cannot run now (nothing it applies to is selected).'); return false; }
    t.run(id); say(cap(c.menu) + ', ' + c.label + '.');
    return true;
  }
  function takeShapes() {
    var t = tf();
    if (!t || CATS.length) return;
    try { CATS = t.shapes(); } catch (e) { CATS = []; }
    CATS.forEach(function (c) { c.shapes.forEach(function (s) { SHAPE[s.id] = s; ICON[s.id] = cleanIcon(s.icon || ''); s.words = tok(s.label + ' ' + c.label + ' ' + s.id); }); });
    frames.forEach(function (f) { f.render(); });
  }
  function ownDrawing() { var t = tf(); return t && t.doc && t.doc.name !== app.getAttribute('data-doc'); }
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (ev.origin !== window.location.origin || ev.source !== app.contentWindow || !m || !m.detail) return;
    if (m.type === 'topoforge:ready') { READY = m.detail; PAGE = m.detail.page || ''; takeShapes(); refreshCmds(); hooks19(); }
    else if (m.type === 'topoforge:select') {
      SEL = m.detail.count ? m.detail : null; PAGE = m.detail.page || PAGE; frames.forEach(function (f) { f.renderTools(); f.layoutTools(); });
      // the selection's card (revision 7), in the left and middle map modes
      if (MAPMODE !== 'rings' && SEL && !narrowQ.matches) showSel(); else if (!SEL && ten('preview')) showSel(); else if (!SEL && hud.getAttribute('data-card') === 'selection') hud.hidden = true;
    }
    else if (m.type === 'topoforge:context' && nine()) { var cd = m.detail; SEL = SEL && SEL.id === cd.id ? SEL : { id: cd.id, ref: cd.ref, name: cd.name, tooltip: cd.tooltip, kind: cd.kind, page: cd.page, count: 1 }; here(cd.rect); }
    else if (m.type === 'topoforge:view' && nine()) { VIEW = m.detail; viewSoon(); return; }
    else if (m.type === 'topoforge:pages' && nine()) { if (small.pages && !small.pages.root.hidden) small.pages.fill(); }
    else if (m.type === 'topoforge:key' && nine()) { keyFromApp(m.detail); return; }
    // 1.10: the app's own Mode menu (in the map's handles) moved the mode; the slider and the radios follow
    else if (m.type === 'topoforge:mapmode' && ten()) { setMapMode(m.detail.mode, 'app'); return; }
    // 1.10: each preview's result; in rings mode its caption, with the counts, goes to the echo area
    else if (m.type === 'topoforge:preview' && ten()) { echoPreview(m.detail); return; }
    // 1.11: the app's Reset layout or Undo reset (View menu, the map's Mode menu), or the echo of the page's own
    else if (m.type === 'topoforge:reset' && eleven()) { fromAppReset(m.detail); return; }
    else return;
    frames.forEach(function (f) { f.modelines(); });
    if (small.pages && !small.pages.root.hidden) small.pages.fill();
    if (small.properties && !small.properties.root.hidden) small.properties.fill();
  });
  // topology forge 1.9 (docs/NAV.md, revision 5, "1.9 hooks"): each turns on only when the version says
  // 1.9 or later and the call is there; with 1.8 nothing here runs
  function hooks19() {
    var t = nine('embed');
    if (!t) return;
    // 1.9 B: the map in its own frame (moved and resized by its own door-handle controls) and the preview in it
    try { t.embed({ keys: true, context: true, pagelist: true, view: true, map: true, preview: true, mapwheel: true, mappad: true, reset: true }); } catch (e) { /* an older 1.9 without the words */ }
    // 1.11: the pad's arrows, which the app does not keep (Options, Map pad: arrows pan the drawing)
    var t11 = eleven('padArrows'); if (t11) { try { t11.padArrows(fstate().padPan ? 'pan' : 'mode-scale'); } catch (e) { /* the app's */ } }
    modeAtReady();
    mapCheck();
    try { VIEW = t.view || null; } catch (e) { VIEW = null; }
    firstFit();
  }
  // one source of truth for the map mode (revision 7, stage 2): with 1.10 it is the app's, kept in its own
  // storage and moved by its Mode menu as well as by this page's slider. At ready the page reads it and
  // follows; it calls mapMode() only once in a browser's life, to carry over a choice the visitor made on
  // this page before the app had modes (kept here as mapMode, with no mapModeApp yet). Never on every load.
  function modeAtReady() {
    var t = ten(), st = fstate(), am = null;
    if (!t) return;
    try { am = t.mapMode(); } catch (e) { am = null; }
    if (!am || MAPMODES.indexOf(am.mode) < 0) return;
    if (!st.mapModeApp && MAPMODES.indexOf(st.mapMode) >= 0 && st.mapMode !== am.mode) { try { t.mapMode(st.mapMode); } catch (e) { /* the app's */ } fkeep('mapModeApp', true); return; }
    fkeep('mapModeApp', true);
    if (am.mode !== MAPMODE) setMapMode(am.mode, 'ready');
  }
  // the frames and the map do not overlap (stage 2): the app keeps the map's place in its own storage
  // (topoforge.ui.v1, key minimap), so a move or resize there reaches this page as a storage event; then a
  // frame whose lower part the map now covers ends above it (never shorter than 200 pixels), and an unmoved
  // legend is placed again beside it. No polling.
  function mapCheck() {
    var t = tf(), m = null;
    try { m = t && t.panels && t.panels().map; } catch (e) { m = null; }
    if (!m || !m.shown || narrowQ.matches) return;
    frames.forEach(function (f) {
      var st = f.fl.state;
      if (st.x === null) return;
      // a frame never moved is placed again now that the map's real place is known (revision 8: its first
      // place is the same on a fresh load as after Reset layout, ending 12 above the map)
      if (f.fl.auto) { f.fl.retarget(); return; }
      var hh = f.fl.height(), r = { x: st.x, y: st.y, w: st.w, h: hh };
      var meets = r.x < m.x + m.w && r.x + r.w > m.x && r.y < m.y + m.h && r.y + r.h > m.y;
      if (meets && m.y - 12 - st.y >= 200) { f.fl.set({ h: Math.round(m.y - 12 - st.y) }, true); f.say('This frame now ends above the overview map.'); }
    });
    var L = window.CCFloat.get('legend'); if (L && L.auto) L.retarget();
  }
  window.addEventListener('storage', function (ev) { if (ev.key === 'topoforge.ui.v1') mapCheck(); });
  var viewQ = false;
  function viewSoon() { if (viewQ) return; viewQ = true; (window.requestAnimationFrame || setTimeout)(function () { viewQ = false; frames.forEach(function (f) { f.modelinesOnly(); }); }); }
  // the first fit leaves room for the frames (revision 6): the app fits the drawing to the whole canvas;
  // setView scales and moves that fit into the space between the frames and above the legend
  var fitted = false;
  function firstFit() {
    var t = nine('setView');
    if (!t || fitted || !READY || !READY.loaded || narrowQ.matches) return;
    fitted = true;
    setTimeout(function () {
      var v = t.view, W = grid.clientWidth, H = grid.clientHeight;
      if (!v || !v.k) return;
      var L = 12, R = W - 12, T = 8, B = H - 40;
      frames.forEach(function (f) {
        var st = f.fl.state; if (st.x === null) return;
        if (st.x + st.w / 2 < W / 2) L = Math.max(L, st.x + st.w + 12); else R = Math.min(R, st.x - 12);
      });
      var lg = doc.getElementById('legend');
      if (lg && !lg.hidden && lg.offsetHeight) B = Math.min(B, lg.getBoundingClientRect().top - grid.getBoundingClientRect().top - 8);
      if (R - L < 240) return;
      var sc = Math.min((R - L) / W, (B - T) / H);
      t.setView({ k: v.k * sc, x: L + v.x * sc + ((R - L) - W * sc) / 2, y: T + v.y * sc + ((B - T) - H * sc) / 2 });
    }, 60);
  }
  // 1.9's keys switch: Alt+x, F10, C-x and C-c pressed in the drawing come here (topoforge:key, with Emacs's
  // key names); a sequence stays open until this page ends it, so it ends every one it finishes or refuses
  var KEYSEQ = { 'C-x 2': 'split-window-below', 'C-x 3': 'split-window-right', 'C-x 0': 'delete-window', 'C-x 1': 'delete-other-windows', 'C-x o': 'other-window',
    'C-x b': 'switch-to-buffer', 'C-x {': 'shrink-frame', 'C-x }': 'enlarge-frame', 'C-x ^': 'taller', 'C-x 5 2': 'make-frame', 'C-x 5 0': 'delete-frame', 'C-x 5 o': 'other-frame',
    'C-x t 2': 'nav:newbuf', 'C-x t 0': 'nav:closebuf', 'C-x t o': 'nav:nextbuf', 'C-c .': 'here', 'C-c p': 'nav:pin', 'C-c m': 'nav:setmode', 'C-c k': 'nav:clearmode' };
  var cuaT = null;
  function keyFromApp(d) {
    var f = cur || frames[0], t = tf();
    if (!f || !d) return;
    var seq = d.seq && d.seq.length ? d.seq : [d.key], str = seq.join(' ');
    function end() { if (t && typeof t.endKeys === 'function') t.endKeys(); }
    clearTimeout(cuaT);
    // Emacs's CUA mode: C-x or C-c with something selected and no second key within 200 ms cuts or copies
    if (seq.length === 1 && (str === 'C-x' || str === 'C-c') && SEL) {
      var id = str === 'C-x' ? 'edit::cut' : 'edit::copy';
      cuaT = setTimeout(function () { end(); if (runApp(id)) f.say((str === 'C-x' ? 'Cut' : 'Copied') + ' (' + str + ' with a selection, as Emacs’s CUA mode).'); }, 200);
      f.say(str + '-');
      return;
    }
    if (seq[0] === 'M-x') { end(); core('execute-extended-command', f); return; }
    if (seq[0] === '<f10>') { end(); f.menuOpen(0, true); return; }
    if (seq[seq.length - 1] === 'C-g' || seq[seq.length - 1] === '<escape>') { end(); f.say('Quit'); return; }
    if (KEYSEQ[str]) { end(); run(KEYSEQ[str], f); return; }
    if (Object.keys(KEYSEQ).some(function (k) { return k.indexOf(str + ' ') === 0; })) { f.say(str + '-'); return; }
    end(); f.say(str + ' is undefined');
  }
  function placeShape(id, center) {
    var t = tf(), s = SHAPE[id];
    if (!t || !s) { say('The drawing app is not ready yet.'); return; }
    if (center) {
      var armed = t.placing;
      t.place(id, 'center');
      say(s.label + ' placed in the middle of the view.' + (armed ? ' The drawing still holds ' + (SHAPE[armed] ? SHAPE[armed].label : armed) + ' armed: press on the drawing to drop it, or Escape there to give up.' : ''));
    } else {
      t.place(id);
      say(s.label + ': press on the drawing where it goes, or Enter here for the middle of the view. Escape in the drawing gives up.');
    }
  }
  function openItem(it) {
    var t = tf();
    if (!it.page) { window.location.href = it.href; return; }
    if (!t) { window.location.href = it.href; return; }
    if (ownDrawing()) { say('The drawing open is your own, kept in this browser, so ' + it.name + '’s page is not opened over it. Site, Start again opens the shop’s.'); return; }
    if (t.showPage(it.page)) say('Showing ' + it.page + ' in the drawing.'); else say('The drawing in front of you has no page named “' + it.page + '”.');
  }

  // ---- the mode-line: a template of elements (docs/NAV.md, "The mode-line: a template of elements") --
  var MODE_LINE = '%buffer  %page  %select  %zoom  %filter  %split  %lighters';
  var ELEMENTS = {
    buffer: { scope: 'core', text: function (c) { return c.buf === 'navigator' ? '*navigator*' : '*finder*'; }, act: 'switch-to-buffer',
      help: function (c) { return c.buf === 'navigator' ? 'Buffer *navigator*: what the drawing draws, by category, with pins, buffers and splits of its own. Click: switch this window to another buffer (C-x b).' : 'Buffer *finder*: the shapes and what the drawing draws. Click: switch this window to another buffer (C-x b).'; } },
    page: { scope: 'context', text: function () { return PAGE ? 'p:' + PAGE : ''; }, act: 'pages',
      help: function () { return 'The page of the drawing in view: ' + PAGE + '. Click: the Pages box.'; } },
    select: { scope: 'context', long: 'here', act: 'here',
      text: function () { return SEL ? SEL.name + (SEL.count > 1 ? ' +' + (SEL.count - 1) : '') : ''; },
      help: function () { return SEL ? 'Selected in the drawing: ' + SEL.name + (SEL.tooltip ? ': ' + SEL.tooltip : '') + ' · ' + SEL.kind + ' · page ' + SEL.page + '. Click or long press: the frame by the shape (C-c .).' : ''; } },
    zoom: { scope: 'mode', parts: [['−', 'view::zoom-out', 'Zoom out (the mouse wheel here zooms too)'], ['zoom', 'view::fit-to-window', 'Fit the drawing to the window'], ['+', 'view::zoom-in', 'Zoom in']] },
    filter: { scope: 'mode', act: function (c) { return c.buf === 'navigator' ? 'nav-narrow' : 'filter-clear'; },
      text: function (c) { return c.buf === 'navigator' ? (nav() ? nav().shown() + '/' + nav().total() + ' ' + nav().context() : '') : filterWords(c.frame); },
      help: function (c) {
        if (c.buf === 'navigator') return nav() ? 'The navigator shows ' + nav().shown() + ' of ' + nav().total() + ' (' + nav().context() + '). Click: its Narrow line.' : '';
        return filterWords(c.frame) === 'all' ? 'The finder shows everything: press a tile or type words (M-x) to narrow it.' : 'The finder is narrowed to ' + filterWords(c.frame) + '. Click: show everything again.';
      } },
    split: { scope: 'core', act: 'other-window',
      text: function (c) { return c.total > 1 ? 'W' + c.n + '/' + c.total : ''; },
      help: function (c) { return 'Window ' + c.n + ' of ' + c.total + '. Click: the other window (C-x o).'; } },
    lighters: { scope: 'core', wrap: true, parts: [['Finder', 'describe-mode', 'Finder mode: what this frame is. Click to read it here.'],
      ['Motion', 'toggle-motion', 'Motion: on or off (Customize’s Reduce motion presses this).'],
      ['GPL', 'credits', 'The drawing app’s legal notices: topology forge by Bryant Frankford, its licence and source. Click for Credits.']] }
  };
  function filterWords(f) {
    var p = [];
    if (f.st.tiles.length) p.push(f.st.tiles.map(function (id) { var c = CATS.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; }).join('+'));
    if (tok(f.st.q).length) p.push('“' + f.st.q.trim() + '”');
    return p.length ? p.join(' ') : 'all';
  }
  var motionMade = false;
  function renderModeline(el, c) {
    el.textContent = '';
    var parts = MODE_LINE.split(/(%%|%[a-z]+)/), pendingGap = '';
    parts.forEach(function (p) {
      if (!p) return;
      if (p === '%%') { el.appendChild(doc.createTextNode(pendingGap + '%')); pendingGap = ''; return; }
      if (p.charAt(0) !== '%') { pendingGap += p; return; }
      var e = ELEMENTS[p.slice(1)];
      if (!e) return;
      var node = mk('span', { cls: 'ml-el ml-' + p.slice(1), 'data-el': p.slice(1), 'data-scope': e.scope });
      if (e.parts) {
        if (e.wrap) node.appendChild(doc.createTextNode('('));
        e.parts.forEach(function (q, i) {
          var isMotion = q[1] === 'toggle-motion', isMode = q[1] === 'describe-mode';
          var modeName = c.buf === 'navigator' ? 'Navigator' : 'Finder';
          var help = isMode ? modeName + ' mode: click for its menu (Emacs: the mode name on the mode-line opens the mode’s menu).' : q[2];
          var b = mk('button', { type: 'button', cls: 'ml-b' + (isMode ? ' ml-mode' : ''), 'data-act': isMode ? 'mode-menu' : q[1], 'data-mode': isMode ? modeName : null, 'data-help': help, 'aria-label': help,
            'aria-haspopup': isMode ? 'menu' : null, id: isMotion && !motionMade ? 'motion' : null, 'aria-pressed': isMotion ? String(MOTION) : null,
            text: isMotion ? (MOTION ? 'Motion' : 'Still') : isMode ? modeName : (q[1] === 'view::fit-to-window' && VIEW && isFinite(VIEW.zoom) ? Math.round(VIEW.zoom) + '%' : q[0]) });
          if (isMotion) motionMade = true;
          if (i && e.wrap) node.appendChild(doc.createTextNode(' '));
          node.appendChild(b);
        });
        if (e.wrap) node.appendChild(doc.createTextNode(')'));
      } else {
        var txt = e.text(c);
        if (!txt) { pendingGap = ''; return; }
        var h = e.help(c);
        node.appendChild(mk('button', { type: 'button', cls: 'ml-b', 'data-act': typeof e.act === 'function' ? e.act(c) : e.act, 'data-long': e.long || null, 'data-help': h, 'aria-label': h, text: txt }));
      }
      if (pendingGap && el.childNodes.length) el.appendChild(doc.createTextNode(pendingGap));
      pendingGap = '';
      el.appendChild(node);
    });
  }

  // ---- commands: the frame's own, by name (Emacs's), and the app's by its id ----------------------
  var KEYS = { 'split-window-below': 'C-x 2', 'split-window-right': 'C-x 3', 'delete-window': 'C-x 0', 'delete-other-windows': 'C-x 1',
    'other-window': 'C-x o', 'make-frame': 'C-x 5 2', 'delete-frame': 'C-x 5 0', 'other-frame': 'C-x 5 o', 'here': 'C-c .',
    'execute-extended-command': 'Alt+x', 'menu-bar-open': 'F10', 'keyboard-quit': 'C-g', 'switch-to-buffer': 'C-x b',
    'enlarge-frame': 'C-x }', 'shrink-frame': 'C-x {', 'taller': 'C-x ^' };
  var NAMES = { 'split-window-below': 'Split window below', 'split-window-right': 'Split window right', 'delete-window': 'Delete window',
    'delete-other-windows': 'One window', 'other-window': 'Other window', 'make-frame': 'New frame', 'delete-frame': 'Delete frame',
    'other-frame': 'Other frame', 'here': 'The frame by the shape (*Here*)', 'pages': 'Pages', 'properties': 'Properties', 'credits': 'Credits and licence',
    'customize': 'Customize…', 'ui-classic': 'Page layout: classic (menus at the top)', 'ui-free': 'Page layout: free', 'legend': 'Legend watermark',
    'toggle-motion': 'Motion', 'filter-clear': 'Show everything in the finder', 'describe-mode': 'About this frame', 'keys': 'Keys',
    'fold': 'Show or hide the tool-bar and finder', 'move-left': 'Move left', 'move-right': 'Move right', 'move-up': 'Move up', 'move-down': 'Move down',
    'move-reset': 'Back to where it started', 'switch-to-buffer': 'Switch to buffer', 'execute-extended-command': 'M-x: run a command',
    'menu-bar-open': 'Open the menu bar', 'enlarge-frame': 'Wider', 'shrink-frame': 'Narrower', 'toolbar': 'Tool-bar in this frame',
    'taller': 'Taller', 'shorter': 'Shorter', 'mode-menu': 'The mode’s menu', 'lines-together': 'Lines grow together (menu bar, mode-lines, message area)',
    'map-cards': 'Preview shapes (cards)', 'map-both': 'Both (highlight and card)', 'map-rings': 'Highlight matches (rings)',
    'show-navigator': 'Show *navigator* in this window', 'show-finder': 'Show *finder* in this window', 'nav-narrow': 'The navigator’s Narrow line',
    'reset-layout': 'Reset layout', 'undo-reset': 'Undo reset', 'pad-pan': 'Map pad: arrows pan the drawing' };
  function core(name, f) {
    f = f || cur;
    var fn = {
      'split-window-below': function () { f.split('v'); }, 'split-window-right': function () { f.split('h'); },
      'delete-window': function () { f.deleteWin(); }, 'delete-other-windows': function () { f.oneWin(); }, 'other-window': function () { f.otherWin(); },
      'make-frame': makeFrame, 'delete-frame': function () { deleteFrame(f); }, 'other-frame': otherFrame,
      'here': here, 'pages': function () { openSmall('pages'); }, 'properties': function () { openSmall('properties'); }, 'credits': function () { openSmall('credits'); },
      'customize': customize, 'ui-classic': function () { setUI('classic'); }, 'ui-free': function () { setUI('free'); },
      'legend': function () { var cf = window.CCFloat; if (cf.setLegendOff) { cf.setLegendOff(!cf.legendOff, true); say(cf.legendOff ? 'The legend watermark is off. GPL on the mode-line, or Help, Credits and licence, shows it.' : 'The legend watermark is on.'); } },
      'toggle-motion': toggleMotion, 'filter-clear': function () { f.st.q = ''; f.st.tiles = []; f.render(); say('The finder shows everything.'); },
      'describe-mode': function () { say('Finder mode: the tool-bar’s tiles narrow the shapes; M-x words narrow everything. Enter on a shape drops it in the middle of the view; a click arms it; drag it onto the drawing. An item opens its page. Help, Keys lists the keys.'); },
      'keys': function () { say('Keys, focus in a frame (let go of Ctrl before the second key): C-x 2, C-x 3, C-x 0, C-x 1, C-x o; C-x 5 2 new frame, C-x 5 0, C-x 5 o; C-c . the frame by the shape; Alt+x or ESC x M-x; F10 menus; Up, Down, Home, End in a window; Enter places a shape; C-g quits.'); },
      'fold': function () { f.fold(); },
      'move-left': function () { f.fl.move(-64, 0); }, 'move-right': function () { f.fl.move(64, 0); }, 'move-up': function () { f.fl.move(0, -64); }, 'move-down': function () { f.fl.move(0, 64); },
      'move-reset': function () { f.fl.reset(); },
      'enlarge-frame': function () { f.fl.set({ w: f.fl.state.w + 16 }, true); f.say('The frame is ' + f.fl.state.w + ' pixels wide, kept in this browser (C-x }).'); },
      'shrink-frame': function () { f.fl.set({ w: f.fl.state.w - 16 }, true); f.say('The frame is ' + f.fl.state.w + ' pixels wide, kept in this browser (C-x {).'); },
      'taller': function () { f.say('The frame is ' + f.fl.taller(16) + ' pixels tall, kept in this browser (C-x ^).'); },
      'shorter': function () { f.say('The frame is ' + f.fl.taller(-16) + ' pixels tall, kept in this browser.'); },
      'lines-together': function () { var v = !fstate().linesTogether; fkeep('linesTogether', v); frames.forEach(function (x) { x.lines(); }); f.say(v ? 'The menu bar, the mode-lines and the message area grow together.' : 'The menu bar, the mode-lines and the message area each take the lines they need.'); },
      'map-cards': function () { setMapMode('cards'); }, 'map-both': function () { setMapMode('both'); }, 'map-rings': function () { setMapMode('rings'); },
      'reset-layout': function () { resetLayout(); }, 'undo-reset': function () { undoReset(); },
      'pad-pan': function () { var v = !fstate().padPan; fkeep('padPan', v); var t = eleven('padArrows'); if (t) { try { t.padArrows(v ? 'pan' : 'mode-scale'); } catch (e) { /* the app's */ } }
        f.say(v ? 'The map pad’s arrows pan the drawing (north, south, west, east; the centre is Fit), kept in this browser.' : 'The map pad’s arrows set the map’s scale and its slider the mode (the default).'); },
      'mode-menu': function () { var b = f.wins.querySelector('.ef-win.selected .ml-mode'); if (b) b.click(); },
      'toolbar': function () { f.st.toolbar = !f.st.toolbar; f.render(); f.say(f.st.toolbar ? 'The tool-bar is shown in this frame.' : 'The tool-bar is off in this frame (Options, Tool-bar in this frame brings it back).'); },
      'show-navigator': function () { f.show('navigator'); }, 'show-finder': function () { f.show('finder'); },
      'nav-narrow': function () { var q = doc.getElementById('nav-q'); if (q && NAVAT) { q.focus(); f.say('Narrow the navigator: type words; its pressed categories hold too. Ctrl+Enter pins the results as a buffer.'); } else f.say('The navigator is not shown: C-x b *navigator*.'); },
      'switch-to-buffer': function () { f.mx('Switch to buffer: ', bufferCands); },
      'execute-extended-command': function () { f.mx('M-x ', allCands); },
      'menu-bar-open': function () { f.menuOpen(0, true); },
      'keyboard-quit': function () { say('Quit'); }
    }[name];
    if (fn) { fn(); return true; }
    return false;
  }
  function run(name, f) {
    if (/^[a-z]+:[a-z0-9-]*:/.test(name)) return runApp(name);
    if (name.indexOf('nav:') === 0) {
      if (!nav() || !NAVAT) { say('The navigator is not shown in any window: C-x b, then *navigator*.'); return false; }
      var r = nav().run(name.slice(4)); if (NAVAT) NAVAT.f.modelines(); return r;
    }
    return core(name, f);
  }
  function setUI(v) {
    if (window.CCUI) { say('Page layout: ' + v + '. The page opens again in it.'); window.CCUI.set(v); }
  }
  function customize() {
    var b = doc.getElementById('custom-btn');
    if (!b) { say('Customize is not on this page (about-corwin was not staged).'); return; }
    if (b.getAttribute('aria-expanded') !== 'true') b.click();
    var r = doc.querySelector('#custom-panel input:checked') || doc.querySelector('#custom-panel input');
    if (r) r.focus();
    say('Customize: text size, line length and spacing, colours, motion, and the page layout; kept in this browser.');
  }
  // press one of Customize's own controls, apply and keep it there: Customize stays the one place they live
  function pressCustom(name, value) {
    var p = doc.getElementById('custom-panel');
    var r = p && p.querySelector('input[name="' + name + '"]' + (value === null ? '' : '[value="' + value + '"]'));
    if (!r) { say('Customize is not on this page.'); return false; }
    if (r.type === 'checkbox') r.checked = !r.checked; else r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
    var a = doc.getElementById('c-apply'); if (a) a.click();
    return true;
  }
  function textSize(d) {
    var p = doc.getElementById('custom-panel'), r = p && p.querySelector('input[name="size"]:checked');
    var v = Math.max(0, Math.min(4, (r ? +r.value : 0) + d));
    if (pressCustom('size', String(v))) say('Text size ' + ['100', '115', '130', '150', '175'][v] + '%, kept in Customize.');
  }
  function toggleMotion() {
    MOTION = !MOTION;
    html.classList.toggle('motion-on', MOTION);
    each(doc.querySelectorAll('[data-act="toggle-motion"]'), function (b) { b.setAttribute('aria-pressed', String(MOTION)); b.textContent = MOTION ? 'Motion' : 'Still'; });
    say(MOTION ? 'Motion is on (nothing in these frames moves by itself either way).' : 'Motion is off: nothing on the page animates.');
  }

  // ---- M-x candidates ---------------------------------------------------------------------------------
  function siteLinks() {
    var out = [];
    each(doc.querySelectorAll('header.top nav a'), function (a) { out.push({ label: a.textContent, href: a.getAttribute('href') }); });
    var lic = doc.querySelector('a[rel="jslicense"]'); if (lic) out.push({ label: 'JavaScript licences', href: lic.getAttribute('href') });
    [['stage-full', 'The drawing app, full size'], ['stage-file', 'The shop’s drawings as a file'], ['stage-door', 'topology’s own front door']].forEach(function (x) {
      var a = doc.getElementById(x[0]); if (a) out.push({ label: x[1], href: a.getAttribute('href'), download: a.hasAttribute('download') });
    });
    if (doc.getElementById('stage-fresh')) out.push({ label: 'Start again from the shop’s drawings', press: 'stage-fresh' });
    return out;
  }
  function follow(l) {
    if (l.press) { var b = doc.getElementById(l.press); if (b) b.click(); return; }
    if (l.download) { var a = mk('a', { href: l.href, download: '' }); doc.body.appendChild(a); a.click(); a.remove(); return; }
    window.location.href = l.href;
  }
  function bufferCands() {
    return ['*finder*', '*navigator*', '*Pages*', '*Properties*', '*Credits*', '*Here*'].map(function (b) {
      return { label: b, run: function () { if (b === '*finder*' || b === '*navigator*') cur.show(b.slice(1, -1)); else core(b === '*Here*' ? 'here' : b.slice(1, -1).toLowerCase()); } };
    });
  }
  function allCands() {
    var out = [];
    Object.keys(NAMES).forEach(function (n) { out.push({ label: NAMES[n] + '  (' + n + ')', key: KEYS[n] || '', run: function () { core(n); } }); });
    refreshCmds().forEach(function (c) {
      out.push({ label: cap(c.menu) + ' › ' + (c.group ? c.group + ' › ' : '') + c.label, key: c.shortcut, off: !c.enabled, run: function () { runApp(c.id); } });
    });
    CATS.forEach(function (c) { c.shapes.forEach(function (s) { out.push({ label: 'Place ' + s.label + ' (' + c.label + ')', run: function () { placeShape(s.id, true); } }); }); });
    (IX ? IX.items : []).forEach(function (it) { out.push({ label: 'Go: ' + it.name, run: function () { openItem(it); } }); });
    siteLinks().forEach(function (l) { out.push({ label: 'Site: ' + l.label, run: function () { follow(l); } }); });
    return out;
  }

  // ---- the frame -------------------------------------------------------------------------------------
  function Frame(n, opts) {
    var f = this;
    opts = opts || {};
    f.n = n;
    f.st = { q: '', tiles: [], tree: { w: 1 }, wins: { 1: { fold: [], point: null, scroll: 0, buf: opts.buf || 'finder' } }, sel: 1, next: 2, open: !narrowQ.matches, toolbar: opts.toolbar !== false };
    f.root = mk('section', { cls: 'ef', id: 'ef-' + n, 'aria-label': 'Emacs frame ' + n + ': menus, tool-bar, finder, mode-line and message area', 'data-frame': n });
    f.grip = mk('button', { type: 'button', cls: 'fl-grip ef-grip', 'aria-label': 'Move this frame: drag, or use the arrow keys (Options, Move does it with one press)', title: 'Drag to move', text: '⠿' });
    f.menubar = mk('div', { cls: 'ef-menubar', role: 'menubar', 'aria-label': 'Menu bar (F10)' });
    f.menubar.appendChild(f.grip);
    f.foldB = mk('button', { type: 'button', cls: 'ef-fold', 'aria-controls': 'ef-body-' + n, 'data-act': 'fold' });
    f.renderMenubar();
    f.pop = mk('div', { cls: 'ef-pop', role: 'menu', hidden: true });
    f.toolbar = mk('div', { cls: 'ef-toolbar', role: 'toolbar', 'aria-label': 'Tool bar: shape categories. Pressed tiles narrow the finder’s shapes.' });
    f.wins = mk('div', { cls: 'ef-wins' });
    f.body = mk('div', { cls: 'ef-body', id: 'ef-body-' + n }, [f.toolbar, f.wins]);
    f.msg = mk('p', { cls: 'ef-msg', role: 'status', title: 'Click, or Alt+x, for M-x' });
    f.input = mk('input', { type: 'text', cls: 'ef-in', id: 'ef-in-' + n, role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'ef-comp-' + n, spellcheck: 'false', autocomplete: 'off' });
    f.prompt = mk('label', { cls: 'ef-prompt', for: 'ef-in-' + n, text: 'M-x ' });
    f.comp = mk('ul', { cls: 'ef-comp', id: 'ef-comp-' + n, role: 'listbox', 'aria-label': 'Completions', hidden: true });
    f.form = mk('form', { cls: 'ef-mb-form', hidden: true, role: 'search' }, [f.prompt, f.input]);
    f.echo = mk('div', { cls: 'ef-echo' }, [f.comp, f.msg, f.form]);
    // the right edge: the frame's width (drag, or arrow keys; kept per browser by js/float.js)
    f.edge = mk('div', { cls: 'ef-edge', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical',
      'aria-label': 'Width of this frame: drag, or Left and Right (16 pixels), Page Up and Page Down, Home and End; C-x { and C-x } too' });
    f.hedge = mk('div', { cls: 'ef-hedge', role: 'separator', tabindex: '0', 'aria-orientation': 'horizontal',
      'aria-label': 'Height of this frame: drag, or Up and Down (16 pixels), Page Up and Page Down, Home and End; C-x ^ too' });
    f.corner = mk('div', { cls: 'ef-corner', role: 'button', tabindex: '0',
      'aria-label': 'Width and height of this frame together: drag, or Left and Right for the width, Up and Down for the height' });
    [f.menubar, f.pop, f.body, f.echo, f.edge, f.hedge, f.corner].forEach(function (x) { f.root.appendChild(x); });
    grid.appendChild(f.root);
    f.fl = window.CCFloat.make({
      name: 'frame' + n, label: n === 1 ? 'The Emacs frame' : 'Emacs frame ' + n, el: f.root, grip: f.grip, drag: [f.menubar], edge: f.edge,
      hedge: f.hedge, corner: f.corner, marks: true, avoid: switchBox,
      docks: false, width: opts.width || 440, hiddenNarrow: false,
      say: function (t) { f.say(t); },
      onApply: function (fl) { f.mirror(fl); },
      place: function (edges, W, H) {
        // (revision 8) frame 1's first height ends above the legend's row (8 + one line + 8 at the foot)
        var prev = frames[frames.length - 1], h = Math.max(320, Math.min(H - 24, H - 56, 700));
        if (n === 1) return { x: 8, y: 8, h: h };
        // the navigator's frame (revision 6, his screenshot): top right, just under the layout switch, shorter,
        // ending above the app's overview map
        if (opts.east) {
          var sb = switchBox(), w2 = opts.width || 440, y2 = sb ? Math.round(sb.y + sb.h + 4) : 8;
          return { x: Math.max(8, W - w2 - 8), y: y2, h: Math.max(240, Math.min(560, mapTop(H) - 12 - y2)) };
        }
        // beside the frame before it when there is room (two views side by side), else stepped over it
        var px = prev && prev !== f && prev.fl.state.x !== null ? prev.fl.state.x + prev.fl.state.w + 12 : 460;
        var w = opts.width || 440;
        return px + w <= W - 8 ? { x: px, y: 8, h: h } : { x: Math.min(W - w - 8, 460 + 24 * (n - 1)), y: 24 + 24 * (n - 1), h: Math.max(300, Math.min(H - 80, 560)) };
      }
    });
    f.wire();
    f.render();
    if (window.ResizeObserver) { var lastW = 0; new window.ResizeObserver(function () { var w = f.root.offsetWidth; if (w !== lastW) { lastW = w; f.fitMenus(); f.layoutTools(); f.linesSoon(); } }).observe(f.root); }
  }
  Frame.prototype.say = function (t) { this.msg.textContent = t; this.linesSoon(); };
  // the menu bar: the site, the app's menus, Navigator while a window showing *navigator* is selected
  // (Emacs: a major mode's menu joins the menu bar), Options, Help
  Frame.prototype.menuNames = function () {
    var m = ['Site', 'File', 'Edit', 'Arrange', 'Layout', 'View'];
    if (nav() && this.st.wins[this.st.sel] && this.st.wins[this.st.sel].buf === 'navigator') m.push('Navigator');
    return m.concat(['Options', 'Help']);
  };
  // a frame on the right half of the window is laid out from the right (revision 6): the two read as a
  // pair framing the drawing
  Frame.prototype.mirror = function (fl) {
    var f = this, s = fl.state, W = grid.clientWidth, east = !fl.narrow() && s.x !== null && s.x + s.w / 2 > W / 2;
    if (f.root.classList.contains('ef-east') !== east) { f.root.classList.toggle('ef-east', east); f.fitMenus(); }
  };
  // priority+: the menu bar is always one line; what does not fit goes, least needed first, into »
  Frame.prototype.fitMenus = function () {
    var f = this, mb = f.menubar, more = mb.querySelector('.ef-mb[data-menu="»"]');
    if (!more || !mb.offsetWidth) return;
    var btns = Array.prototype.slice.call(mb.querySelectorAll('.ef-mb'));
    btns.forEach(function (b) { b.hidden = b === more; });
    // the bar is one line by its style (nowrap); it fits when its shown parts' widths add up to no more
    // than its own (summed, because a right-justified bar hides overflow at its start, not its end)
    var cs = getComputedStyle(mb), room = mb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    function oneLine() {
      var sum = 0;
      Array.prototype.forEach.call(mb.children, function (c) { if (c.hidden || !c.offsetWidth) return; sum += c.offsetWidth; });
      return sum <= room + 0.5;
    }
    f.hiddenMenus = [];
    if (oneLine()) return;
    more.hidden = false;
    for (var i = 0; i < DROP.length && !oneLine(); i++) {
      var b = mb.querySelector('.ef-mb[data-menu="' + DROP[i] + '"]');
      if (b && !b.hidden) { b.hidden = true; f.hiddenMenus.unshift(DROP[i]); }
    }
    // in menu order
    f.hiddenMenus = f.menus.filter(function (m) { return f.hiddenMenus.indexOf(m) >= 0; });
    more.setAttribute('aria-label', 'More menus: ' + f.hiddenMenus.join(', '));
  };
  Frame.prototype.renderMenubar = function () {
    var f = this, names = f.menuNames().concat(['»']);
    if (f.menus && f.menus.join() === names.join()) { f.fitMenus(); return; }
    if (f.openMenu !== null && f.openMenu !== undefined) f.menuOpen(null);
    var had = f.menubar.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-menu') : null;
    each(f.menubar.querySelectorAll('.ef-mb'), function (b) { b.parentNode.removeChild(b); });
    f.menus = names;
    names.forEach(function (m, i) {
      f.menubar.insertBefore(mk('button', { type: 'button', cls: 'ef-mb', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-menu': m, tabindex: i ? '-1' : '0', text: m }), f.foldB.parentNode === f.menubar ? f.foldB : null);
    });
    if (f.foldB.parentNode !== f.menubar) f.menubar.appendChild(f.foldB);
    f.fitMenus();
    if (had) { var b = f.menubar.querySelector('[data-menu="' + had + '"]'); if (b && !b.hidden) b.focus(); }
    f.linesSoon();
  };
  // show a buffer in the selected window. One navigator lives in one window at a time: showing it here
  // moves it from where it was, and that window shows *finder*
  Frame.prototype.show = function (buf, w) {
    var f = this, s = f.st;
    w = w || s.sel;
    if (buf === 'navigator' && !nav()) { f.say('The navigator is still loading (or its index did not load).'); return; }
    if (buf === 'navigator' && NAVAT && !(NAVAT.f === f && NAVAT.w === w)) {
      var o = NAVAT, ow = o.f.st.wins[o.w];
      if (ow) ow.buf = 'finder';
      NAVAT = null;
      if (o.f !== f) o.f.render();
      f.say('*navigator* moved here from ' + (o.f === f ? 'the other window' : 'frame ' + o.f.n) + ': it is shown in one window at a time.');
    } else f.say(buf === 'navigator' ? 'Buffer *navigator*: press categories, type words after Narrow, pin, split. Its menu is Navigator.' : 'Buffer *finder*.');
    s.wins[w].buf = buf;
    if (buf === 'navigator') NAVAT = { f: f, w: w };
    else if (NAVAT && NAVAT.f === f && NAVAT.w === w) NAVAT = null;
    f.render(); checkNav();
  };
  Frame.prototype.leaves = function (node) { var f = this; node = node || f.st.tree; return node.w ? [node.w] : node.kids.reduce(function (a, k) { return a.concat(f.leaves(k)); }, []); };
  Frame.prototype.split = function (dir) {
    var f = this, s = f.st, ls = f.leaves();
    if (ls.length >= MAXWIN) { f.say('At most ' + MAXWIN + ' windows in a frame here.'); return; }
    var id = s.next++, from = s.wins[s.sel];
    s.wins[id] = { fold: from.fold.slice(), point: from.point, scroll: from.scroll, buf: from.buf === 'navigator' ? 'finder' : from.buf };
    (function walk(nd, parent, i) {
      if (nd.w === s.sel) {
        if (parent && parent.dir === dir) parent.kids.splice(i + 1, 0, { w: id });
        else if (parent) parent.kids[i] = { dir: dir, kids: [nd, { w: id }] };
        else s.tree = { dir: dir, kids: [nd, { w: id }] };
        return true;
      }
      return nd.kids && nd.kids.some(function (k, j) { return walk(k, nd, j); });
    })(s.tree, null, 0);
    f.render();
    f.say(dir === 'v' ? 'Split the window: one above the other (C-x 2).' : 'Split the window: side by side (C-x 3).');
  };
  Frame.prototype.deleteWin = function () {
    var f = this, s = f.st;
    if (f.leaves().length < 2) { f.say('This is the only window, so it stays (Emacs: "Attempt to delete the sole ordinary window").'); return; }
    (function walk(nd) {
      if (!nd.kids) return;
      nd.kids = nd.kids.filter(function (k) { return k.w !== s.sel; });
      nd.kids.forEach(walk);
      nd.kids = nd.kids.map(function (k) { return k.kids && k.kids.length === 1 ? k.kids[0] : k; });
    })(s.tree);
    if (s.tree.kids && s.tree.kids.length === 1) s.tree = s.tree.kids[0];
    delete s.wins[s.sel]; s.sel = f.leaves()[0];
    checkNav(); f.render(); f.focusWin(); f.say('Window deleted (C-x 0).');
  };
  Frame.prototype.oneWin = function () {
    var f = this, s = f.st, n = f.leaves().length;
    s.tree = { w: s.sel }; Object.keys(s.wins).forEach(function (k) { if (+k !== s.sel) delete s.wins[k]; });
    checkNav(); f.render(); f.say(n > 1 ? 'One window: the others are closed (C-x 1).' : 'There is only one window.');
  };
  Frame.prototype.otherWin = function () {
    var f = this, s = f.st, ls = f.leaves();
    if (ls.length < 2) { f.say('There is no other window: C-x 2 or C-x 3 makes one.'); return; }
    s.sel = ls[(ls.indexOf(s.sel) + 1) % ls.length];
    f.render(); f.focusWin(); f.say('Window ' + (ls.indexOf(s.sel) + 1) + ' of ' + ls.length + ' (C-x o).');
  };
  Frame.prototype.fold = function () {
    var f = this; f.st.open = !f.st.open; f.render();
    f.say(f.st.open ? 'The tool-bar and the finder are shown.' : 'The tool-bar and the finder are folded: M-x still finds everything; + unfolds them.');
  };
  Frame.prototype.focusWin = function () {
    var w = this.wins.querySelector('.ef-win[data-win="' + this.st.sel + '"]');
    if (w && this.st.wins[this.st.sel].buf === 'navigator' && nav()) { nav().focus(); return; }
    var n = w && (w.querySelector('.ef-it[tabindex="0"]') || w.querySelector('button'));
    if (n) n.focus();
  };

  // drawing the frame
  Frame.prototype.render = function () {
    var f = this, s = f.st, a = doc.activeElement, keep = null;
    if (a && f.root.contains(a)) {
      var w = a.closest('.ef-win');
      keep = { win: w && w.getAttribute('data-win'), sel: ['data-shape', 'data-item', 'data-fold', 'data-cat', 'data-act', 'data-menu'].filter(function (k) { return a.hasAttribute(k); })
        .map(function (k) { return '[' + k + '="' + a.getAttribute(k) + '"]'; })[0] };
    }
    f.root.classList.toggle('ef-open', s.open);
    f.root.classList.toggle('ef-notools', !s.toolbar);
    f.renderMenubar();
    f.foldB.textContent = s.open ? '−' : '+';
    f.foldB.setAttribute('aria-expanded', String(s.open));
    f.foldB.setAttribute('aria-label', s.open ? 'Fold the tool-bar and finder' : 'Unfold the tool-bar and finder');
    f.renderTools(); f.renderWins();
    f.layoutTools(); f.linesSoon();
    if (keep && keep.sel) {
      var scope = keep.win ? f.wins.querySelector('.ef-win[data-win="' + keep.win + '"]') : f.root;
      var nn = scope && scope.querySelector(keep.sel);
      if (nn) nn.focus({ preventScroll: true });
    }
  };
  // the tool-bar (docs/NAV.md, revision 5): groups from what is there now, each an even grid, hairlines
  // between groups, icons only (each tool's name and key in its tooltip and its accessible name)
  Frame.prototype.toolGroups = function () {
    var f = this, s = f.st, gs = [], w = s.wins[s.sel] || {};
    function appT(id, ic) { var c = cmd(id); return c ? { act: id, label: c.label, key: c.shortcut, off: !c.enabled, icon: ic } : null; }
    function coreT(name, ic, label) { return { act: name, label: label || NAMES[name], key: KEYS[name] || '', icon: ic }; }
    if (CATS.length) gs.push({ id: 'shapes', label: 'Shape categories: pressed ones narrow the finder', tools: CATS.map(function (c) {
      var on = s.tiles.indexOf(c.id) >= 0;
      return { cat: c, label: c.label + ' shapes (' + c.shapes.length + ')', name: c.label + ' shapes (' + c.shapes.length + '): ' + (on ? 'pressed; press again to show every category' : 'press to show only these'), pressed: on };
    }) });
    if (refreshCmds().length) {
      gs.push({ id: 'edit', label: 'Edit', tools: [appT('edit::undo', 'undo'), appT('edit::redo', 'redo')] });
      if (SEL) gs.push({ id: 'sel', label: 'The selection', tools: [appT('edit::duplicate', 'dup'), appT('edit::delete', 'del'), appT('arrange::bring-to-front', 'front'),
        appT('arrange::send-to-back', 'back'), appT('view::zoom-to-selection', 'zsel'), coreT('here', 'here')] });
      gs.push({ id: 'view', label: 'View', tools: [appT('view::zoom-out', 'zout'), appT('view::fit-to-window', 'fit'), appT('view::zoom-in', 'zin')] });
    }
    var win = [coreT('split-window-right', 'split')];
    if (!narrowQ.matches) win.push(coreT('make-frame', 'frame'));
    if (nav()) win.push(w.buf === 'navigator' ? coreT('show-finder', 'finder') : coreT('show-navigator', 'nav'));
    if (f.leaves().length > 1) win.push(coreT('delete-other-windows', 'one'));
    gs.push({ id: 'win', label: 'Windows and frames', tools: win });
    gs.push({ id: 'map', label: 'Map mode', slider: true, tools: [{}] });
    gs.forEach(function (g) { g.tools = g.tools.filter(Boolean); });
    return gs.filter(function (g) { return g.tools.length; });
  };
  Frame.prototype.renderTools = function () {
    var f = this, first = true;
    f.toolbar.textContent = '';
    if (!f.st.toolbar) return;
    if (!CATS.length) { f.toolbar.appendChild(mk('span', { cls: 'ef-wait', text: 'The shapes arrive when the drawing app is ready.' })); return; }
    f.toolbar.setAttribute('aria-label', 'Tool bar: shape categories, then the drawing’s and the frame’s commands. Arrow keys move along it.');
    f.toolGroups().forEach(function (g) {
      var box = mk('div', { cls: 'ef-tg', role: 'group', 'aria-label': g.label, 'data-group': g.id });
      if (g.slider) { box.appendChild(mapSlider()); f.toolbar.appendChild(box); return; }
      g.tools.forEach(function (t) {
        var b;
        if (t.cat) b = mk('button', { type: 'button', cls: 'ef-tool ef-tile', 'data-cat': t.cat.id, 'aria-pressed': String(t.pressed), 'aria-label': t.name, 'data-tip': t.label, tabindex: first ? '0' : '-1' }, [icon(t.cat.shapes[0].id)]);
        else b = mk('button', { type: 'button', cls: 'ef-tool', 'data-act': t.act, 'aria-label': t.label + (t.key ? ' (' + t.key + ')' : ''), 'aria-disabled': t.off ? 'true' : null,
          'data-tip': t.label + (t.key ? '   ' + t.key : '') + (t.off ? ' (cannot run now)' : ''), tabindex: first ? '0' : '-1' }, [glyph(t.icon)]);
        first = false;
        box.appendChild(b);
      });
      f.toolbar.appendChild(box);
    });
  };
  // the map mode slider (revision 7): three positions, cards (left), both (middle), rings (right)
  function mapSlider() {
    var i = MAPMODES.indexOf(MAPMODE);
    var sl = mk('div', { cls: 'ef-slider', role: 'slider', tabindex: '0', 'aria-label': 'Map mode', 'aria-valuemin': '0', 'aria-valuemax': '2', 'aria-valuenow': String(i),
      'aria-valuetext': MAPWORDS[MAPMODE], 'data-tip': 'Map mode: ' + MAPWORDS[MAPMODE] + '   ←/→', 'data-pos': String(i) },
      [mk('span', { cls: 'ef-sl-track', 'aria-hidden': 'true' }, [mk('span', { cls: 'ef-sl-n' }), mk('span', { cls: 'ef-sl-n' }), mk('span', { cls: 'ef-sl-n' })]), mk('span', { cls: 'ef-sl-thumb', 'aria-hidden': 'true' })]);
    sl.addEventListener('keydown', function (ev) {
      var k = ev.key, j = MAPMODES.indexOf(MAPMODE), n = k === 'ArrowLeft' || k === 'ArrowDown' ? j - 1 : k === 'ArrowRight' || k === 'ArrowUp' ? j + 1 : k === 'Home' ? 0 : k === 'End' ? 2 : null;
      if (n === null) return;
      ev.preventDefault(); ev.stopPropagation();
      setMapMode(MAPMODES[Math.max(0, Math.min(2, n))], true);
    });
    // a press sets the nearest stop; a drag carries the thumb under the pointer and, let go, it glides to the
    // nearest stop (revision 8). Stops: 16, 42 and 68 pixels in; the thumb is 16 wide
    var th = sl.querySelector('.ef-sl-thumb'), dr = null;
    function stopAt(x) { var r = sl.getBoundingClientRect(), p = x - r.left; return p < 29 ? 0 : p < 55 ? 1 : 2; }
    sl.addEventListener('pointerdown', function (ev) {
      if (ev.button > 0) return;
      dr = { x: ev.clientX, moved: false };
      try { sl.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    });
    sl.addEventListener('pointermove', function (ev) {
      if (!dr) return;
      if (!dr.moved && Math.abs(ev.clientX - dr.x) < 3) return;
      dr.moved = true; sl.setAttribute('data-drag', '');
      var r = sl.getBoundingClientRect();
      th.style.left = Math.round(Math.max(8, Math.min(60, ev.clientX - r.left - 8))) + 'px';
    });
    function end(ev) {
      if (!dr) return;
      dr = null;
      var j = stopAt(ev.clientX);
      void th.offsetWidth;   // the dropped place is where the glide starts
      sl.removeAttribute('data-drag'); th.style.left = '';
      setMapMode(MAPMODES[j], true);
    }
    sl.addEventListener('pointerup', end);
    sl.addEventListener('pointercancel', function () { dr = null; sl.removeAttribute('data-drag'); th.style.left = ''; });
    return sl;
  }
  function setMapMode(m, from) {
    if (MAPMODES.indexOf(m) < 0) return;
    if (from && from !== true && m === MAPMODE) return;   // the echo of this page's own change
    MAPMODE = m; fkeep('mapMode', m);
    var t10 = ten();
    if (t10 && from !== 'app' && from !== 'ready') { try { t10.mapMode(m); } catch (e) { /* the app's */ } }
    var j = MAPMODES.indexOf(m);
    each(doc.querySelectorAll('.ef-slider'), function (sl) {
      sl.setAttribute('aria-valuenow', String(j)); sl.setAttribute('aria-valuetext', MAPWORDS[m]); sl.setAttribute('data-pos', String(j));
      sl.setAttribute('data-tip', 'Map mode: ' + MAPWORDS[m] + '   ←/→');
    });
    if (tip.shown && tip.owner && tip.owner.classList.contains('ef-slider')) showTip(tip.owner);
    var t9 = nine('preview'); if (t9) { try { t9.preview(null); } catch (e) { /* the app's */ } }
    hud.hidden = true;
    if (m !== 'rings') showSel();
    if (from !== 'ready') say('Map mode: ' + MAPWORDS[m] + (from === 'app' ? ' (from the map’s Mode menu).' : '.'));
  }
  // even rows: a group that cannot fit on one row gets the column count that makes its rows as even as
  // they can be (eight tools in room for six: two rows of four); a group that starts a row drops its hairline
  Frame.prototype.layoutTools = function () {
    var f = this, tb = f.toolbar, gs = tb.querySelectorAll('.ef-tg');
    if (!gs.length || !tb.clientWidth) return;
    var cs = getComputedStyle(tb), avail = tb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 10;
    var max = Math.max(1, Math.floor((avail + 2) / CELL));
    each(gs, function (g) {
      var n = g.children.length, cols = n <= max ? n : Math.ceil(n / Math.ceil(n / max));
      g.style.setProperty('--cols', String(cols));
    });
    var top = null;
    each(gs, function (g) { g.classList.toggle('ef-tg-row', g.offsetTop !== top); top = g.offsetTop; });
  };
  // the three lines (docs/NAV.md, revision 5): the menu bar, every mode-line and the message area take
  // the same number of lines; when one needs to wrap, all grow by a line together
  Frame.prototype.linesSoon = function () {
    var f = this;
    if (f.linesQ) return;
    f.linesQ = true;
    (window.requestAnimationFrame || setTimeout)(function () { f.linesQ = false; f.lines(); });
  };
  function linesOf(el) {
    var cs = getComputedStyle(el), ch = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    return Math.max(1, Math.round((el.getBoundingClientRect().height - ch) / LH));
  }
  Frame.prototype.lines = function () {
    var f = this, r = f.root;
    if (!r.isConnected || r.hidden || !r.offsetWidth) return;
    // revision 7: independent by default (each part its own lines); Options, Lines grow together brings back
    // revision 5's rule
    var together = !!fstate().linesTogether;
    r.setAttribute('data-lines-mode', together ? 'together' : 'independent');
    if (!together) { r.style.setProperty('--ef-lines', '1'); r.setAttribute('data-lines', '1'); return; }
    r.classList.add('ef-measure');
    var parts = [f.menubar, f.form.hidden ? f.msg : f.form].concat(Array.prototype.slice.call(f.wins.querySelectorAll('.ef-ml')));
    var n = Math.min(MAXLINES, parts.reduce(function (m, el) { return Math.max(m, linesOf(el)); }, 1));
    r.classList.remove('ef-measure');
    r.style.setProperty('--ef-lines', String(n));
    r.setAttribute('data-lines', String(n));
  };
  Frame.prototype.model = function () {
    var f = this, s = f.st, cats = CATS.filter(function (c) { return !s.tiles.length || s.tiles.indexOf(c.id) >= 0; });
    var secs = cats.map(function (c) { return { id: 'shapes:' + c.id, label: 'Shapes: ' + c.label, shapes: c.shapes.filter(function (x) { return matches(x.words, s.q); }) }; })
      .filter(function (x) { return x.shapes.length; });
    if (IX) IX.facets.show.forEach(function (sec) {
      var its = IX.items.filter(function (it) { return it.section === sec.id && matches(it.words, s.q); });
      if (its.length) secs.push({ id: sec.id, label: sec.label, glyph: sec.glyph, items: its });
    });
    return secs;
  };
  Frame.prototype.renderWins = function () {
    var f = this, s = f.st, ls = f.leaves(), model = f.model();
    f.wins.textContent = '';
    (function tree(nd, into) {
      if (nd.w) { into.appendChild(f.win(nd.w, ls, model)); return; }
      var box = mk('div', { cls: 'ef-tree ef-tree-' + nd.dir });
      nd.kids.forEach(function (k) { tree(k, box); });
      into.appendChild(box);
    })(s.tree, f.wins);
    ls.forEach(function (w) { var b = f.wins.querySelector('.ef-win[data-win="' + w + '"] .ef-wb'); if (b) b.scrollTop = s.wins[w].scroll || 0; });
    f.modelines();
  };
  Frame.prototype.win = function (w, ls, model) {
    var f = this, s = f.st, ws = s.wins[w] || (s.wins[w] = { fold: [], point: null, scroll: 0, buf: 'finder' });
    if (ws.buf === 'navigator') {
      var nb = mk('div', { cls: 'ef-wb ef-navwb' });
      if (nav() && NAVAT && NAVAT.f === f && NAVAT.w === w) nav().mount(nb);
      else nb.appendChild(mk('p', { cls: 'ef-none', text: nav() ? 'The navigator is shown in another window.' : 'The navigator is loading…' }));
      var nml = mk('div', { cls: 'ef-ml', 'data-ml': w, role: 'group', 'aria-label': 'Mode-line of window ' + (ls.indexOf(w) + 1) });
      return mk('div', { cls: 'ef-win ef-win-nav' + (w === s.sel ? ' selected' : ''), 'data-win': w, 'data-buf': 'navigator', role: 'region', 'aria-label': 'Window ' + (ls.indexOf(w) + 1) + ' of ' + ls.length + ': *navigator*' }, [nb, nml]);
    }
    var body = mk('div', { cls: 'ef-wb' });
    if (!model.length) body.appendChild(mk('p', { cls: 'ef-none', text: CATS.length || IX ? 'Nothing here says “' + s.q.trim() + '”. Click the filter on the mode-line to show everything.' : 'Loading…' }));
    model.forEach(function (sec) {
      var folded = ws.fold.indexOf(sec.id) >= 0, n = (sec.shapes || sec.items).length;
      var h = mk('h3', { cls: 'ef-sec' }, [mk('button', { type: 'button', cls: 'ef-foldb', 'data-fold': sec.id, 'aria-expanded': String(!folded), tabindex: '-1' },
        [sec.glyph ? mk('span', { cls: 'g g-' + sec.glyph, 'aria-hidden': 'true' }) : null, sec.label, mk('span', { cls: 'ef-count', text: String(n) })])]);
      body.appendChild(h);
      if (folded) return;
      var ul = mk('ul', { cls: 'ef-rows', 'aria-label': sec.label });
      (sec.shapes || []).forEach(function (x) {
        ul.appendChild(mk('li', {}, [mk('button', { type: 'button', cls: 'ef-it ef-shape' + (ws.point === 's:' + x.id ? ' is-point' : ''), 'data-shape': x.id, draggable: 'true', tabindex: '-1',
          'aria-label': x.label + ': Enter places it in the middle of the view; Space or a click arms it for a press on the drawing; or drag it there' }, [icon(x.id), mk('span', { cls: 'nm', text: x.label })])]));
      });
      (sec.items || []).forEach(function (it) {
        ul.appendChild(mk('li', {}, [mk('a', { cls: 'ef-it' + (ws.point === 'i:' + it.id ? ' is-point' : ''), href: it.href, 'data-item': it.id, tabindex: '-1', title: it.tip || null },
          [mk('span', { cls: 'g g-' + (it.glyph || 'rounded'), 'aria-hidden': 'true' }), mk('span', { cls: 'nm', text: it.name })])]));
      });
      body.appendChild(ul);
    });
    var first = body.querySelector('.ef-it.is-point') || body.querySelector('.ef-it');
    if (first) first.setAttribute('tabindex', '0');
    var ml = mk('div', { cls: 'ef-ml', 'data-ml': w, role: 'group', 'aria-label': 'Mode-line of window ' + (ls.indexOf(w) + 1) });
    var box = mk('div', { cls: 'ef-win' + (w === s.sel ? ' selected' : ''), 'data-win': w, 'data-buf': 'finder', role: 'region', 'aria-label': 'Window ' + (ls.indexOf(w) + 1) + ' of ' + ls.length + ': *finder*' }, [body, ml]);
    body.addEventListener('scroll', function () { ws.scroll = body.scrollTop; }, { passive: true });
    return box;
  };
  Frame.prototype.modelines = function () {
    var f = this;
    if (f.n === 1 || frames[0] === f) motionMade = false;
    f.modelinesOnly();
    if (frames[0] === f) frames.slice(1).forEach(function (o) { o.modelinesOnly(); });
  };
  Frame.prototype.modelinesOnly = function () {
    var f = this, ls = f.leaves();
    each(f.wins.querySelectorAll('.ef-ml'), function (el) { var w = +el.getAttribute('data-ml'); renderModeline(el, { frame: f, win: w, n: ls.indexOf(w) + 1, total: ls.length, buf: (f.st.wins[w] || {}).buf }); });
    f.linesSoon();
  };

  // menus
  Frame.prototype.items = function (m) {
    var out = [];
    function head(t) { out.push({ header: t }); }
    function app_(menu) {
      var g = null;
      refreshCmds().filter(function (c) { return c.menu.toLowerCase() === menu.toLowerCase(); }).forEach(function (c) {
        if (c.group !== g) { g = c.group; if (g) head(g); else if (out.length) head(''); }
        out.push({ label: c.label, key: c.shortcut, off: !c.enabled, checked: c.checked, act: c.id });
      });
      if (!CMDS.length) out.push({ label: 'The drawing app is not ready yet.', off: true });
    }
    function mine(n, checked) { out.push({ label: NAMES[n], key: KEYS[n] || '', act: n, checked: checked === undefined ? null : checked }); }
    if (m === 'Site') siteLinks().forEach(function (l, i) { if (i === 5 || (l.press && i)) head(''); out.push({ label: l.label, link: l }); });
    else if (m === 'File') { app_('File'); head('Frames and windows'); ['make-frame', 'delete-frame', 'other-frame', 'split-window-below', 'split-window-right', 'delete-window', 'delete-other-windows', 'other-window'].forEach(function (n) { mine(n); }); }
    else if (m === 'Options') {
      mine('customize'); head('Page layout');
      out.push({ label: 'Free', act: 'ui-free', radio: true, checked: true }); out.push({ label: 'Classic (menus at the top)', act: 'ui-classic', radio: true, checked: false });
      mine('reset-layout'); if (UNDO) mine('undo-reset');
      head(''); mine('legend', !window.CCFloat.legendOff); mine('toggle-motion', MOTION); mine('fold', this.st.open); mine('toolbar', this.st.toolbar);
      mine('lines-together', !!fstate().linesTogether);
      head('Map mode'); MAPMODES.forEach(function (m) { out.push({ label: NAMES['map-' + m], act: 'map-' + m, radio: true, checked: MAPMODE === m }); });
      if (eleven('padArrows')) mine('pad-pan', !!fstate().padPan);
      head('Buffers'); mine('show-finder'); mine('show-navigator');
      head('Palettes'); mine('properties'); mine('pages'); mine('here');
      if (!this.fl.narrow()) {
        head('Move this frame'); ['move-left', 'move-right', 'move-up', 'move-down', 'move-reset'].forEach(function (n) { mine(n); });
        head('Size of this frame'); mine('enlarge-frame'); mine('shrink-frame'); mine('taller'); mine('shorter');
      }
    } else if (m === '»') {
      var self = this;
      (self.hiddenMenus || []).forEach(function (h) { head(h); self.items(h).forEach(function (it) { out.push(it); }); });
    } else if (m === 'Finder') {
      mine('describe-mode'); mine('filter-clear'); mine('fold', this.st.open); mine('toolbar', this.st.toolbar); head(''); mine('show-navigator'); mine('keys');
    } else if (m === 'Navigator') {
      (nav() ? nav().menus() : []).forEach(function (it) { if (it.header !== undefined) head(it.header); else out.push({ label: it.label, key: it.key, act: 'nav:' + it.cmd }); });
    } else if (m === 'Help') { mine('keys'); mine('credits'); mine('describe-mode'); head('The drawing app'); app_('Help'); }
    else app_(m);
    return out;
  };
  Frame.prototype.menuOpen = function (i, focus, named, anchor) {
    var f = this, btns = f.menubar.querySelectorAll('.ef-mb');
    f.openMenu = named ? -1 : i;
    f.modeAnchor = named ? anchor : null;
    f.pop.classList.toggle('ef-pop-up', !!named);
    each(btns, function (b, j) { b.setAttribute('aria-expanded', String(!named && j === i)); b.setAttribute('tabindex', !named && j === i ? '0' : (named || i === null || i === undefined) && j === 0 ? '0' : '-1'); });
    f.pop.textContent = '';
    if (!named && (i === null || i === undefined)) { f.pop.hidden = true; return; }
    var m = named || f.menus[i], b = named ? anchor : btns[i];
    f.pop.setAttribute('aria-label', m + ' menu');
    f.items(m).forEach(function (it) {
      if (it.header !== undefined) { f.pop.appendChild(mk('div', { cls: 'ef-sep', role: 'separator', 'aria-label': it.header || null }, it.header ? [it.header] : [])); return; }
      var role = it.radio ? 'menuitemradio' : it.checked !== null && it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
      var kids = [mk('span', { cls: 'ef-ck', 'aria-hidden': 'true', text: it.checked ? (it.radio ? '●' : '✓') : '' }), mk('span', { cls: 'ef-ml-l', text: it.label }), it.key ? mk('span', { cls: 'kb', text: it.key }) : null];
      var node = it.link && !it.link.press && !it.link.download ? mk('a', { cls: 'ef-mi', role: role, href: it.link.href, tabindex: '-1' }, kids)
        : mk('button', { type: 'button', cls: 'ef-mi', role: role, tabindex: '-1', 'data-act': it.act || null, 'aria-disabled': it.off ? 'true' : null, 'aria-checked': role === 'menuitem' ? null : String(!!it.checked) }, kids);
      if (it.link && (it.link.press || it.link.download)) node._link = it.link;
      f.pop.appendChild(node);
    });
    f.pop.hidden = false;
    // under its menu name; in a mirrored frame its right edge under the name's; the mode menu above its lighter
    var rr = f.root.getBoundingClientRect(), br = b.getBoundingClientRect(), left = br.left - rr.left;
    if (named || f.root.classList.contains('ef-east')) left = br.right - rr.left - f.pop.offsetWidth;
    f.pop.style.setProperty('--mx', Math.round(Math.max(0, Math.min(rr.width - f.pop.offsetWidth, left))) + 'px');
    f.pop.style.setProperty('--my', Math.round(br.top - rr.top) + 'px');
    if (focus) { var first = f.pop.querySelector('.ef-mi:not([aria-disabled])'); if (first) first.focus(); else b.focus(); }
  };
  Frame.prototype.menuClose = function (refocus) {
    var f = this, i = f.openMenu, a = f.modeAnchor;
    f.menuOpen(null);
    if (refocus && i === -1 && a && a.isConnected) a.focus();
    else if (refocus && i !== null && i !== undefined && i >= 0) f.menubar.querySelectorAll('.ef-mb')[i].focus();
  };

  // the message area and the one-line input
  Frame.prototype.mx = function (prompt, cands) {
    var f = this;
    f.menuClose(false);
    f.mxCands = cands; f.q0 = f.st.q; f.mxActive = -1; f.mxPrompt = prompt;
    f.prompt.textContent = prompt; f.input.value = '';
    f.msg.hidden = true; f.form.hidden = false; f.root.classList.add('ef-mxing');
    f.input.focus();
    f.complete();
  };
  Frame.prototype.complete = function () {
    var f = this, q = f.input.value.toLowerCase().trim(), ws = q.split(/\s+/).filter(Boolean);
    var list = f.mxCands().filter(function (c) { var l = c.label.toLowerCase(); return ws.every(function (w) { return l.indexOf(w) >= 0; }); });
    f.mxList = list.slice(0, 8);
    f.comp.textContent = '';
    f.mxList.forEach(function (c, i) {
      f.comp.appendChild(mk('li', { role: 'option', id: 'ef-o-' + f.n + '-' + i, cls: 'ef-opt' + (c.off ? ' off' : ''), 'aria-selected': String(i === f.mxActive), 'data-i': i },
        [mk('span', { text: c.label }), c.key ? mk('span', { cls: 'kb', text: ' ' + c.key }) : null, c.off ? mk('span', { cls: 'kb', text: ' (not now)' }) : null]));
    });
    if (list.length > 8) f.comp.appendChild(mk('li', { cls: 'ef-more', role: 'presentation', text: (list.length - 8) + ' more: type more words' }));
    f.comp.hidden = !f.mxList.length;
    f.input.setAttribute('aria-expanded', String(!!f.mxList.length));
    if (f.mxActive >= 0) f.input.setAttribute('aria-activedescendant', 'ef-o-' + f.n + '-' + f.mxActive); else f.input.removeAttribute('aria-activedescendant');
    if (f.mxPrompt === 'M-x ') { f.st.q = f.input.value; f.renderWins(); }
  };
  Frame.prototype.mxDone = function (keepFilter) {
    var f = this;
    if (f.form.hidden) return;
    if (!keepFilter) { f.st.q = f.q0 || ''; }
    f.form.hidden = true; f.comp.hidden = true; f.msg.hidden = false; f.root.classList.remove('ef-mxing');
    f.input.setAttribute('aria-expanded', 'false');
    f.renderWins();
  };
  Frame.prototype.mxRun = function () {
    var f = this, c = f.mxList && f.mxList[f.mxActive >= 0 ? f.mxActive : 0];
    var typed = f.input.value.trim();
    if (!c) {
      if (typed && f.mxPrompt === 'M-x ') { f.mxDone(true); f.say('No command says “' + typed + '”; the finder is narrowed to it. Click the filter on the mode-line to show everything.'); }
      else { f.mxDone(false); f.say('[No match]'); }
      return;
    }
    f.mxDone(false);
    f.focusWin();
    c.run();
  };

  // events
  Frame.prototype.wire = function () {
    var f = this, root = f.root, lp = null;
    root.addEventListener('focusin', function () { cur = f; frames.forEach(function (o) { o.root.classList.toggle('ef-selected', o === f); }); });
    root.addEventListener('pointerdown', function () { cur = f; frames.forEach(function (o) { o.root.classList.toggle('ef-selected', o === f); }); });
    root.addEventListener('click', function (ev) {
      var n = ev.target, c, w = n.closest && n.closest('.ef-win');
      if (w && +w.getAttribute('data-win') !== f.st.sel) { f.st.sel = +w.getAttribute('data-win'); each(f.wins.querySelectorAll('.ef-win'), function (b) { b.classList.toggle('selected', b === w); }); f.renderMenubar(); f.renderTools(); f.layoutTools(); f.modelines(); }
      // the navigator's own clicks are its own; its window's mode-line follows them
      if (n.closest('.navframe')) { setTimeout(function () { f.modelinesOnly(); }, 0); return; }
      if (n.closest('.ef-msg')) { core('execute-extended-command', f); return; }
      if ((c = n.closest('.ef-mb'))) { var i = f.menus.indexOf(c.getAttribute('data-menu')); if (f.openMenu === i) f.menuClose(true); else f.menuOpen(i, ev.detail === 0); return; }
      if ((c = n.closest('.ef-mi'))) {
        if (c.getAttribute('aria-disabled') === 'true') { var lb = c.querySelector('.ef-ml-l'); f.say((lb ? lb.textContent : 'That') + ' cannot run now.'); ev.preventDefault(); return; }
        var act = c.getAttribute('data-act'), link = c._link;
        f.menuClose(!act || act !== 'execute-extended-command');
        if (link) { follow(link); return; }
        if (act) run(act, f);
        return;
      }
      if ((c = n.closest('[data-long]')) && c._longDone) { c._longDone = false; return; }
      if ((c = n.closest('[data-act="mode-menu"]'))) {
        var md = c.getAttribute('data-mode');
        if (f.openMenu === -1 && f.modeAnchor === c) { f.menuClose(true); return; }
        f.menuOpen(null, ev.detail === 0, md, c); f.say(md + ' mode’s menu (the mode name on a mode-line opens it, as in Emacs).'); return;
      }
      if ((c = n.closest('.ef-tool[aria-disabled="true"]'))) { f.say((c.getAttribute('data-tip') || 'That').replace(/\s+\(cannot run now\)$/, '').replace(/\s{3}.*$/, '') + ' cannot run now.'); return; }
      if ((c = n.closest('[data-act]'))) { run(c.getAttribute('data-act'), f); return; }
      if ((c = n.closest('.ef-tile'))) {
        var id = c.getAttribute('data-cat'), tl = f.st.tiles, j = tl.indexOf(id);
        if (j >= 0) tl.splice(j, 1); else tl.push(id);
        f.render();
        f.say(tl.length ? 'The finder’s shapes: ' + filterWords(f) + '.' : 'Every shape category is shown.');
        return;
      }
      if ((c = n.closest('[data-fold]'))) {
        var ws = f.st.wins[f.st.sel], sid = c.getAttribute('data-fold'), k = ws.fold.indexOf(sid);
        if (k >= 0) ws.fold.splice(k, 1); else ws.fold.push(sid);
        f.render(); return;
      }
      if ((c = n.closest('.ef-shape'))) { f.st.wins[f.st.sel].point = 's:' + c.getAttribute('data-shape'); placeShape(c.getAttribute('data-shape'), false); return; }
      if ((c = n.closest('a.ef-it'))) {
        var it = IX && IX.items.filter(function (x) { return x.id === c.getAttribute('data-item'); })[0];
        if (it) { f.st.wins[f.st.sel].point = 'i:' + it.id; if (it.page) { ev.preventDefault(); openItem(it); } }
      }
    });
    // pointing at or focusing a mode-line element says what it is (its help-echo)
    function help(ev) { var b = ev.target.closest && ev.target.closest('.ef-ml [data-help]'); if (b) f.say(b.getAttribute('data-help')); }
    root.addEventListener('mouseover', help);
    root.addEventListener('focusin', help);
    root.addEventListener('input', function (ev) { if (ev.target.closest && ev.target.closest('.navframe')) f.modelinesOnly(); });
    // tooltips and the preview: pointing at or focusing a tool, a shape or a navigator item
    function point(ev) {
      var el = ev.target.closest && ev.target.closest('.ef-tool, .ef-slider, .ef-shape, a.ef-it, .navframe a.it');
      if (!el) return;
      if (el.classList.contains('ef-slider')) { showTip(el); return; }
      if (el.classList.contains('ef-tool')) showTip(el, ev.type === 'focusin');
      preview(el);
    }
    root.addEventListener('mouseover', point);
    root.addEventListener('focusin', point);
    root.addEventListener('mouseout', function (ev) {
      var el = ev.target.closest && ev.target.closest('.ef-tool, .ef-slider, .ef-shape, a.ef-it, .navframe a.it');
      if (!el || (ev.relatedTarget && (el.contains(ev.relatedTarget) || tip.el.contains(ev.relatedTarget)))) return;
      if ((el.classList.contains('ef-tool') || el.classList.contains('ef-slider')) && doc.activeElement !== el) hideTip();
      if (el.classList.contains('ef-slider')) return;
      preview(null);
    });
    root.addEventListener('focusout', function (ev) { var el = ev.target.closest && ev.target.closest('.ef-tool, .ef-slider'); if (el) hideTip(); });
    // a long press on an element that has one (the selection: the frame by the shape)
    root.addEventListener('pointerdown', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-long]');
      if (!b) return;
      clearTimeout(lp);
      lp = setTimeout(function () { b._longDone = true; run(b.getAttribute('data-long'), f); }, 500);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { root.addEventListener(t, function () { clearTimeout(lp); }); });
    // the wheel over %zoom zooms the drawing
    root.addEventListener('wheel', function (ev) {
      if (!(ev.target.closest && ev.target.closest('.ml-zoom'))) return;
      ev.preventDefault(); runApp(ev.deltaY < 0 ? 'view::zoom-in' : 'view::zoom-out');
    }, { passive: false });
    // drag a shape onto the drawing: the app's own type
    root.addEventListener('dragstart', function (ev) {
      var b = ev.target.closest && ev.target.closest('.ef-shape');
      if (!b) return;
      try { ev.dataTransfer.setData('text/x-topoforge', b.getAttribute('data-shape')); ev.dataTransfer.effectAllowed = 'copy'; } catch (e) { /* old browser */ }
      f.say('Drop ' + (SHAPE[b.getAttribute('data-shape')] || {}).label + ' on the drawing.');
    });
    f.input.addEventListener('input', function () { f.mxActive = -1; f.complete(); });
    f.input.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        ev.preventDefault();
        var n = (f.mxList || []).length; if (!n) return;
        f.mxActive = k === 'ArrowDown' ? (f.mxActive + 1) % n : (f.mxActive <= 0 ? n - 1 : f.mxActive - 1);
        each(f.comp.querySelectorAll('[role="option"]'), function (o, i) { o.setAttribute('aria-selected', String(i === f.mxActive)); });
        f.input.setAttribute('aria-activedescendant', 'ef-o-' + f.n + '-' + f.mxActive);
        return;
      }
      if (k === 'Tab' && f.mxList && f.mxList.length) { ev.preventDefault(); f.input.value = f.mxList[f.mxActive >= 0 ? f.mxActive : 0].label; f.complete(); return; }
      if (k === 'Enter') { ev.preventDefault(); f.mxRun(); return; }
      if (k === 'Escape' || (ev.ctrlKey && (k === 'g' || k === 'G'))) { ev.preventDefault(); ev.stopPropagation(); f.mxDone(false); f.say('Quit'); f.focusWin(); }
    });
    f.comp.addEventListener('pointerdown', function (ev) {
      var o = ev.target.closest('[role="option"]'); if (!o) return;
      ev.preventDefault(); f.mxActive = +o.getAttribute('data-i'); f.mxRun();
    });
    f.form.addEventListener('submit', function (ev) { ev.preventDefault(); f.mxRun(); });
    // focus leaving the input: the message line again
    f.form.addEventListener('focusout', function (ev) { if (!ev.relatedTarget || !f.form.contains(ev.relatedTarget)) setTimeout(function () { if (!f.form.contains(doc.activeElement)) f.mxDone(true); }, 0); });
    root.addEventListener('keydown', function (ev) { keys(f, ev); });
  };

  // ---- keys ---------------------------------------------------------------------------------------------
  var prefix = null;
  function isMx(ev) { return ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'x' || ev.key === '≈' || ev.code === 'KeyX'); }
  function keys(f, ev) {
    var tg = ev.target, inField = tg.matches && tg.matches('input, textarea, select'), k = ev.key;
    if (isMx(ev)) { ev.preventDefault(); ev.stopPropagation(); prefix = null; core('execute-extended-command', f); return; }
    if (inField) return;
    // ESC is a prefix only for a plain key it binds (ESC x); any other key clears it and is itself, so an
    // Escape that dismissed a tooltip never eats the next key
    if (prefix === 'ESC' && k !== 'Shift' && k !== 'Control' && k !== 'Alt' && (ev.ctrlKey || ev.altKey || ev.metaKey || (k !== 'x' && k !== 'X' && k !== 'Escape'))) prefix = null;
    if (prefix) {
      ev.preventDefault(); ev.stopPropagation();
      if (k === 'Shift' || k === 'Control' || k === 'Alt') return;
      var p = prefix; prefix = null;
      if (k === 'Escape' || (ev.ctrlKey && (k === 'g' || k === 'G'))) { f.say('Quit'); return; }
      var table = { 'C-x': { '2': 'split-window-below', '3': 'split-window-right', '0': 'delete-window', '1': 'delete-other-windows', 'o': 'other-window', '5': 'C-x 5',
          'b': 'switch-to-buffer', '{': 'shrink-frame', '}': 'enlarge-frame', '^': 'taller', 't': 'C-x t' },
        'C-x 5': { '2': 'make-frame', '0': 'delete-frame', 'o': 'other-frame' }, 'C-x t': { '2': 'nav:newbuf', '0': 'nav:closebuf', 'o': 'nav:nextbuf' },
        'C-c': { '.': 'here', 'p': 'nav:pin', 'm': 'nav:setmode', 'k': 'nav:clearmode' }, 'ESC': { 'x': 'execute-extended-command' } }[p];
      var name = table[k] || table[k.toLowerCase && k.toLowerCase()];
      if (name === 'C-x 5' || name === 'C-x t') { prefix = name; f.say(name + '-'); return; }
      if (name && name.indexOf('nav:') === 0) { run(name, f); return; }
      if (name) core(name, f); else f.say(p + ' ' + k + ' is undefined');
      return;
    }
    if (k === 'F10') { ev.preventDefault(); f.menuOpen(0, true); return; }
    // in the menus
    var mb = tg.closest && tg.closest('.ef-mb'), mi = tg.closest && tg.closest('.ef-mi');
    if (mb || mi) {
      var btns = Array.prototype.slice.call(f.menubar.querySelectorAll('.ef-mb')), i = mb ? btns.indexOf(mb) : f.openMenu;
      if ((k === 'ArrowRight' || k === 'ArrowLeft') && f.openMenu !== -1) {
        ev.preventDefault();
        var j = i, step = k === 'ArrowRight' ? 1 : btns.length - 1;
        do { j = (j + step) % btns.length; } while (btns[j].hidden && j !== i);
        if (f.openMenu !== null && f.openMenu !== undefined) f.menuOpen(j, true); else { btns[j].focus(); btns.forEach(function (b, x) { b.setAttribute('tabindex', x === j ? '0' : '-1'); }); }
        return;
      }
      if (mb && (k === 'ArrowDown' || k === 'Enter' || k === ' ')) { ev.preventDefault(); f.menuOpen(i, true); return; }
      if (mi && (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End')) {
        ev.preventDefault();
        var all = Array.prototype.slice.call(f.pop.querySelectorAll('.ef-mi')), x = all.indexOf(mi);
        var y = k === 'Home' ? 0 : k === 'End' ? all.length - 1 : (x + (k === 'ArrowDown' ? 1 : all.length - 1)) % all.length;
        all[y].focus(); return;
      }
      if (k === 'Escape' || (ev.ctrlKey && k === 'g')) { ev.preventDefault(); f.menuClose(true); return; }
    }
    if (f.openMenu !== null && f.openMenu !== undefined && k === 'Escape') { ev.preventDefault(); f.menuClose(true); return; }
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && (k === 'x' || k === 'X')) { ev.preventDefault(); prefix = 'C-x'; f.say('C-x-'); return; }
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && (k === 'c' || k === 'C') && !String(window.getSelection && window.getSelection())) { ev.preventDefault(); prefix = 'C-c'; f.say('C-c-'); return; }
    if (ev.ctrlKey && (k === 'g' || k === 'G')) { ev.preventDefault(); f.say('Quit'); return; }
    if (k === 'Escape' && tip.shown) hideTip();   // the tooltip goes (WCAG 1.4.13), and Escape is still Emacs's ESC prefix
    // 1.9: Escape in a frame gives up a shape armed in the drawing, as Escape in the drawing does
    var t9 = k === 'Escape' && nine('place');
    if (t9 && t9.placing) { ev.preventDefault(); t9.place(null); f.say('The armed shape is given up.'); return; }
    if (k === 'Escape' && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); prefix = 'ESC'; f.say('ESC-'); return; }
    // the tool-bar: arrows move along the whole of it, group to group
    var tile = tg.closest && tg.closest('.ef-tool');
    if (tile && (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End')) {
      ev.preventDefault();
      var ts = Array.prototype.slice.call(f.toolbar.querySelectorAll('.ef-tool')), a = ts.indexOf(tile);
      var b = k === 'Home' ? 0 : k === 'End' ? ts.length - 1 : (a + (k === 'ArrowRight' ? 1 : ts.length - 1)) % ts.length;
      ts.forEach(function (x, z) { x.setAttribute('tabindex', z === b ? '0' : '-1'); }); ts[b].focus(); return;
    }
    // a window's rows
    var row = tg.closest && tg.closest('.ef-it, .ef-foldb');
    if (!row) return;
    if (k === 'Enter' && row.classList.contains('ef-shape')) { ev.preventDefault(); placeShape(row.getAttribute('data-shape'), true); return; }
    var box = row.closest('.ef-win'), rows = Array.prototype.slice.call(box.querySelectorAll('.ef-it, .ef-foldb')), r = rows.indexOf(row);
    var q = k === 'ArrowDown' ? r + 1 : k === 'ArrowUp' ? r - 1 : k === 'Home' ? 0 : k === 'End' ? rows.length - 1 : null;
    if (q === null) return;
    ev.preventDefault();
    q = Math.max(0, Math.min(rows.length - 1, q));
    rows.forEach(function (x) { x.setAttribute('tabindex', '-1'); }); rows[q].setAttribute('tabindex', '0'); rows[q].focus();
  }
  // Alt+x anywhere on the page (outside the drawing, whose keys are the app's) is M-x in the selected frame
  doc.addEventListener('keydown', function (ev) {
    if (!isMx(ev) || !cur || cur.root.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('#custom-panel')) return;
    ev.preventDefault(); core('execute-extended-command', cur);
  });

  // a click outside a frame's menus closes them
  doc.addEventListener('pointerdown', function (ev) {
    frames.forEach(function (f) { if (f.openMenu !== null && f.openMenu !== undefined && !f.menubar.contains(ev.target) && !f.pop.contains(ev.target)) f.menuClose(false); });
  });

  // ---- the navigator's one window ----------------------------------------------------------------------
  function checkNav() {
    if (!NAVAT) return;
    var ok = frames.indexOf(NAVAT.f) >= 0 && NAVAT.f.st.wins[NAVAT.w] && NAVAT.f.st.wins[NAVAT.w].buf === 'navigator';
    if (ok) return;
    NAVAT = null;
    var h = nav() && nav().host;
    if (h) { h.hidden = true; grid.appendChild(h); }
  }

  // ---- tool icons: small line drawings, 16 by 16, in the text's colour --------------------------------
  var GLYPHS = {
    undo: 'M5 4 2 7l3 3M2 7h7a4 4 0 0 1 0 8H6', redo: 'M11 4l3 3-3 3M14 7H7a4 4 0 0 0 0 8h3',
    dup: 'M2 5h8v9H2zM6 2h8v9', del: 'M3 3l10 10M13 3 3 13', front: 'M2 2h8v8H2zM6 6h8v8H6', back: 'M6 6h8v8H6zM2 2h8v8H2',
    zsel: 'M4 4h5v5H4zM7 7l7 7M2 2h0', here: 'M2 3h12v8H7l-3 3v-3H2z',
    zout: 'M6.5 2.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM9.5 9.5 14 14M4.5 6.5h4', zin: 'M6.5 2.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM9.5 9.5 14 14M4.5 6.5h4M6.5 4.5v4',
    fit: 'M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4', split: 'M2 2h12v12H2zM8 2v12', frame: 'M2 5h9v9H2zM5 2h9v9',
    nav: 'M2 3h12M2 6h12M2 9h8M2 12h5M12 9v5l2-2', finder: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z', one: 'M2 2h12v12H2z'
  };
  function glyph(name) {
    var NS = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(NS, 'svg'), path = doc.createElementNS(NS, 'path');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('class', 'ef-icon ef-glyph'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    path.setAttribute('d', GLYPHS[name] || GLYPHS.one); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  // ---- tooltips (WCAG 1.4.13: on hover and on focus; stays while pointed at; Escape dismisses) ----------
  var tip = { el: mk('div', { cls: 'ef-tip', id: 'ef-tip', role: 'tooltip', hidden: true }), shown: false, owner: null };
  grid.appendChild(tip.el);
  tip.el.addEventListener('mouseleave', function (ev) { if (!(tip.owner && tip.owner.contains(ev.relatedTarget))) hideTip(); });
  function showTip(b) {
    var text = b.getAttribute('data-tip');
    if (!text) return;
    if (tip.owner && tip.owner !== b) tip.owner.removeAttribute('aria-describedby');
    tip.el.textContent = text; tip.el.hidden = false; tip.shown = true; tip.owner = b;
    b.setAttribute('aria-describedby', 'ef-tip');
    var r = b.getBoundingClientRect(), g = grid.getBoundingClientRect(), W = grid.clientWidth;
    var x = Math.max(4, Math.min(W - tip.el.offsetWidth - 4, r.left - g.left)), y = r.bottom - g.top + 4;
    tip.el.style.setProperty('--tx', Math.round(x) + 'px'); tip.el.style.setProperty('--ty', Math.round(y) + 'px');
  }
  function hideTip() {
    if (tip.owner) tip.owner.removeAttribute('aria-describedby');
    tip.el.hidden = true; tip.shown = false; tip.owner = null;
  }

  // ---- the preview: what a press would do, in a small box above the app's overview map; topology forge
  // 1.9's preview() shows it on the map itself, and then the box stands down ---------------------------
  // the card box (revision 7): until the map can draw cards (topology forge 1.10) the card shows here, just
  // above the map; with 1.8 it is the whole preview
  var hud = mk('aside', { cls: 'ef-hud', id: 'ef-hud', 'aria-label': 'Card: what is pointed at', hidden: true });
  grid.appendChild(hud);
  var hudT = null;
  // ---- cards, built from data (docs/NAV.md, revision 7) ----------------------------------------------
  function onPages(test) {
    var t = tf(), here = 0, other = 0;
    try { t.doc.pages.forEach(function (pg, i) { pg.nodes.forEach(function (n) { if (test(n)) { if (i === t.doc.cur) here++; else other++; } }); }); } catch (e) { return null; }
    return { here: here, other: other };
  }
  function facetLabels(facet, ids) {
    var vals = (IX && IX.facets && IX.facets[facet]) || [];
    return (ids || []).map(function (id) { var v = vals.filter(function (x) { return x.id === id; })[0]; return v ? v.label : id; });
  }
  function catOf(id) { return CATS.filter(function (x) { return x.id === id; })[0] || null; }
  function describe(el) {
    var id, cnt;
    if ((id = el.getAttribute('data-cat'))) {
      var c = catOf(id);
      if (!c) return null;
      var kinds = c.shapes.map(function (x) { return x.id; });
      cnt = onPages(function (n) { return kinds.indexOf(n.type) >= 0; });
      return { kind: 'category', title: c.label, viz: c.shapes.slice(0, 8).map(function (x) { return icon(x.id); }),
        facts: [['Shapes', String(c.shapes.length)], ['On this page', cnt ? String(cnt.here) : '?'], ['On other pages', cnt ? String(cnt.other) : '?']],
        statement: c.label + ': ' + c.shapes.length + ' shapes in the palette (' + c.shapes.map(function (x) { return x.label; }).join(', ') + ').',
        target: { category: c.id } };
    }
    if ((id = el.getAttribute('data-shape'))) {
      var sh = SHAPE[id];
      if (!sh) return null;
      var cc = catOf(sh.category);
      cnt = onPages(function (n) { return n.type === sh.id; });
      return { kind: 'kind', title: sh.label, viz: [icon(sh.id)],
        facts: [['Category', cc ? cc.label : sh.category], ['Size', sh.w + ' by ' + sh.h], ['On this page', cnt ? String(cnt.here) : '?'], ['On other pages', cnt ? String(cnt.other) : '?']],
        statement: sh.label + ', a shape in ' + (cc ? cc.label : 'the palette') + ', ' + sh.w + ' by ' + sh.h + ' pixels when placed.',
        target: { kind: sh.id } };
    }
    if ((id = el.getAttribute('data-item') || (el.closest('.navframe') && el.getAttribute('data-id')))) {
      var it = (IX && IX.items.filter(function (x) { return x.id === id; })[0]) || (nav() && nav().item(id));
      if (!it) return null;
      var refs = refsFor(it), sec = facetLabels('show', [it.section])[0], fx = it.facets || {};
      var facts = [['Section', sec]];
      if (it.page) facts.push(['Page', it.page]);
      [['notation', 'Notation'], ['pillar', 'Is a'], ['says', 'Topic']].forEach(function (f) { if ((fx[f[0]] || []).length) facts.push([f[1], facetLabels(f[0], fx[f[0]]).join(', ')]); });
      facts.push(['Shapes drawn for it', String(refs.length - 1)]);
      return { kind: 'item', title: it.name, viz: [mk('span', { cls: 'g g-' + (it.glyph || 'rounded'), 'aria-hidden': 'true' })], facts: facts,
        statement: it.tip || (it.name + ', in ' + sec + '.'), target: refs, caption: it.name };
    }
    if (el.classList.contains('ef-tool')) return { kind: 'tool', title: el.getAttribute('data-tip') || '', viz: [], facts: [], statement: el.getAttribute('aria-pressed') ? '' : 'A press runs it.', target: null };
    return null;
  }
  // a shape selected in the drawing: what the app's select message says of it
  function selCard() {
    if (!SEL) return null;
    return { kind: 'selection', title: SEL.name, viz: SHAPE[SEL.kind] ? [icon(SEL.kind)] : [],
      facts: [['Kind', SHAPE[SEL.kind] ? SHAPE[SEL.kind].label : SEL.kind], ['Page', SEL.page]].concat(SEL.ref ? [['Reference', SEL.ref]] : []).concat(SEL.count > 1 ? [['Selected', String(SEL.count)]] : []),
      statement: SEL.tooltip || (SEL.name + ', selected in the drawing.'), target: null };
  }
  function showCard(d, note) {
    hud.textContent = '';
    hud.appendChild(mk('p', { cls: 'ef-card-t', text: d.title }));
    if (d.viz && d.viz.length) hud.appendChild(mk('div', { cls: 'ef-card-v', 'aria-hidden': 'true' }, d.viz));
    if (d.facts && d.facts.length) hud.appendChild(mk('dl', { cls: 'ef-card-f' }, d.facts.map(function (f) { return mk('div', {}, [mk('dt', { text: f[0] }), mk('dd', { text: f[1] })]); })));
    if (d.statement) hud.appendChild(mk('p', { cls: 'ef-card-s', text: d.statement }));
    if (note) hud.appendChild(mk('p', { cls: 'ef-hud-n', text: note }));
    hud.setAttribute('data-card', d.kind);
    var tt = tf(), p = null;
    try { p = tt && tt.panels && tt.panels().map; } catch (e) { p = null; }
    var W = grid.clientWidth, H = grid.clientHeight;
    // beside the map, on its left, in the open drawing and above the legend (frame 2 sits over the map)
    var lg = doc.getElementById('legend'), lgh = lg && !lg.hidden && lg.offsetHeight ? lg.offsetHeight + 10 : 12;
    hud.style.setProperty('--hr', Math.round(p && p.shown ? Math.max(8, W - p.x + 10) : 12) + 'px');
    hud.style.setProperty('--hb', Math.round(Math.max(lgh, p && p.shown ? H - p.y - p.h : 12)) + 'px');
    hud.hidden = false;
  }
  // what the drawing draws for an item: the shapes whose tf_ref is the item's (drawings.py names them
  // <page>-<slug>, shop-t-<slug>, <page>-near-<slug>, <slug>-zone ...), read from the open drawing
  function slug(x) { return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function refsFor(it) {
    var t = tf(), sl = slug(it.name), out = [it.id];
    if (!sl || !t || !t.doc) return out;
    try {
      t.doc.pages.forEach(function (pg) {
        pg.nodes.forEach(function (n) {
          var r = String((n.data || {}).tf_ref || '');
          if (r && (r === sl + '-zone' || r === sl + '-title' || r.slice(-(sl.length + 1)) === '-' + sl) && out.indexOf(r) < 0) out.push(r);
        });
      });
    } catch (e) { /* the drawing is the app's; without it, the id alone */ }
    return out;
  }
  // the preview, by the map mode (revision 7): rings (right) rings the matches in the map and says the
  // caption in the frame's echo area; both (middle) and cards (left) show the card, in the map once the app
  // can draw it (1.10), in the box above it until then; both also rings the matches, standing in for the
  // drawing's highlight. With 1.8 the card in the box is the whole preview.
  function frameOf(el) { var r = el && el.closest && el.closest('.ef'); return frames.filter(function (f) { return f.root === r; })[0] || cur; }
  // the card as 1.10 takes it: words only (set as text by the app), up to 8 facts, and art that is only ever
  // the app's own picture: a shape's for a kind or a selected shape, else a drawing of the matches
  function cardFor(d) {
    var art = d.kind === 'kind' && d.target ? { shape: d.target.kind } : d.kind === 'selection' && SEL && SHAPE[SEL.kind] ? { shape: SEL.kind } : 'matches';
    return { title: d.title, facts: (d.facts || []).slice(0, 8), statement: d.statement || '', art: art };
  }
  var PVF = null, PVCAP = false, PVEL = null;   // the frame whose pointer made the last preview (its echo area gets the caption); whether the page named it
  // the app's own caption already counts ("Endpoints: 4 shapes · 21 on other pages"); a caption the page
  // gave (an item's name) gets the counts after it, "(4 here, 21 on other pages)"
  function echoPreview(r) {
    if (!r || r.mode !== 'rings' || !r.caption || !PVF) return;
    // the caption comes back a moment later: said only if what asked is still pointed at or focused (a
    // finder redrawn under a moved focus would otherwise put a stale caption over a newer message)
    var pointed = false;
    try { pointed = !!PVEL && PVEL.isConnected && (PVEL === doc.activeElement || PVEL.matches(':hover')); } catch (e) { pointed = false; }
    if (!pointed) return;
    PVF.say(r.caption + (PVCAP && r.count !== undefined ? '  (' + r.count + ' here' + (r.other ? ', ' + r.other + ' on other pages' : '') + ')' : ''));
  }
  function preview(el) {
    clearTimeout(hudT);
    var d = el && describe(el), t9 = nine('preview'), t10 = ten('preview'), mode = MAPMODE;
    if (t10) {
      // 1.10: the card is in the map (left and middle); the middle also lights the matches in the drawing;
      // the stand-in box is retired. Rings: the app's topoforge:preview brings the caption (echoPreview)
      hud.hidden = true;
      if (!d || d.kind === 'tool' || !d.target) { if (mode === 'rings') { try { t10.preview(null); } catch (e) { /* the app's */ } } else hideCardSoon(); return; }
      PVF = frameOf(el); PVCAP = !!d.caption; PVEL = el;
      var o = { caption: d.caption };
      if (mode !== 'rings') o.card = cardFor(d);
      try { t10.preview(d.target, o); } catch (e) { /* the app's */ }
      return;
    }
    if (t9) {
      var res = null;
      try { res = t9.preview(d && d.target && mode !== 'cards' ? d.target : null, d && d.caption ? d.caption : undefined); } catch (e) { res = null; }
      if (mode === 'rings') {
        hud.hidden = true;
        if (d && res && res.caption) { var f = frameOf(el); if (f) f.say(res.caption + (res.count !== undefined ? '  (' + res.count + ' here' + (res.other ? ', ' + res.other + ' on other pages' : '') + ')' : '')); }
        return;
      }
      if (!d || d.kind === 'tool') { hideCardSoon(); return; }
      showCard(d, 'A stand-in until the map can show the card (topology forge 1.10).');
      return;
    }
    if (!d) { hideCardSoon(); return; }
    showCard(d, 'A stand-in until the overview map can show it (topology forge 1.9).');
  }
  // the selection's card: in the map with 1.10 (its shape, as the preview of its own id), else in the box
  function showSel() {
    var c = MAPMODE !== 'rings' && selCard(), t10 = ten('preview');
    if (t10) { try { if (c) t10.preview([SEL.id], { card: cardFor(c) }); else t10.preview(null); } catch (e) { /* the app's */ } return; }
    if (c) showCard(c); else hud.hidden = true;
  }
  function hideCardSoon() { hudT = setTimeout(showSel, 400); }

  // ---- frames: C-x 5 2 and friends ------------------------------------------------------------------
  function makeFrame() {
    if (narrowQ.matches) { say('On a narrow screen there is one frame.'); return; }
    if (frames.length >= MAXFRAMES) { say('At most ' + MAXFRAMES + ' frames here.'); return; }
    var f = new Frame(nextFrame++);
    frames.push(f); cur = f;
    f.say('A new frame (C-x 5 2): its own tool-bar, finder and mode-line. C-x 5 0 deletes it.');
    f.focusWin();
  }
  function deleteFrame(f) {
    if (frames.length < 2) { say('This is the only frame, so it stays (Emacs: "Attempt to delete the sole visible or iconified frame").'); return; }
    frames.splice(frames.indexOf(f), 1);
    if (f.navFrame) fkeep('navFrame', false);
    f.root.parentNode.removeChild(f.root);
    checkNav();
    cur = frames[0]; cur.focusWin(); cur.say('Frame deleted (C-x 5 0).');
  }
  function otherFrame() {
    if (frames.length < 2) { say('There is no other frame: C-x 5 2 makes one.'); return; }
    cur = frames[(frames.indexOf(cur) + 1) % frames.length]; cur.focusWin(); cur.say('Frame ' + cur.n + ' (C-x 5 o).');
  }

  // ---- small Emacs frames: *Pages*, *Properties*, *Credits*, *Here* -----------------------------------
  function Small(name, title, fill, place) {
    var s = this;
    s.name = name; s.fillFn = fill;
    s.body = mk('div', { cls: 'ef-sb' });
    s.grip = mk('button', { type: 'button', cls: 'fl-grip ml-b ef-sgrip', 'aria-label': title + ': move it by dragging, or with the arrow keys', text: title });
    s.close = mk('button', { type: 'button', cls: 'ml-b ef-x', 'aria-label': 'Close ' + title, text: '[x]' });
    s.root = mk('section', { cls: 'ef ef-small', id: 'ef-' + name, 'aria-label': title, hidden: true },
      [s.body, mk('div', { cls: 'ef-ml ef-sml' }, [s.grip, mk('span', { cls: 'ef-sp' }), s.close])]);
    grid.appendChild(s.root);
    s.fl = window.CCFloat.make({ name: 'small-' + name, label: title, el: s.root, grip: s.grip, docks: false, width: name === 'credits' ? 460 : 300, hiddenNarrow: false,
      say: say, place: place });
    s.close.addEventListener('click', function () { s.hide(); });
    s.root.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' || (ev.ctrlKey && (ev.key === 'g' || ev.key === 'G'))) { ev.preventDefault(); s.hide(); }
    });
    s.root.addEventListener('click', function (ev) { var b = ev.target.closest('[data-act]'); if (b) run(b.getAttribute('data-act')); });
  }
  // filling again keeps focus where it was (on the same control, else the first one), so keys still reach the frame
  Small.prototype.fill = function () {
    var a = doc.activeElement, had = a && this.body.contains(a), label = had ? a.textContent : null;
    this.body.textContent = ''; this.fillFn(this.body);
    if (!had) return;
    var same = Array.prototype.filter.call(this.body.querySelectorAll('button, a'), function (x) { return x.textContent === label; })[0];
    var n = same || this.body.querySelector('[aria-current="page"]') || this.body.querySelector('button, a') || this.close;
    n.focus({ preventScroll: true });
  };
  Small.prototype.show = function (replace) {
    this.opener = doc.activeElement;
    this.fill(); this.root.hidden = false;
    if (replace) { this.fl.state.x = this.fl.state.y = null; }
    this.fl.apply();
    var n = this.body.querySelector('button, a, [tabindex="0"]') || this.close; n.focus();
  };
  Small.prototype.hide = function () {
    this.root.hidden = true;
    if (this.opener && this.opener.isConnected && this.opener.focus) this.opener.focus(); else if (cur) cur.focusWin();
    say(this.root.getAttribute('aria-label') + ' closed.');
  };
  function besideFrame(edges, W) { return { x: Math.min(W - 320, 460), y: 8 }; }
  var SMALL = {
    pages: ['*Pages*', function (b) {
      var t = tf(), names = t && t.doc ? t.doc.pages.map(function (p) { return p.name; }) : (READY ? READY.pages : []);
      if (!names.length) { b.appendChild(mk('p', { text: 'The drawing app is not ready yet.' })); return; }
      var ul = mk('ul', { cls: 'ef-rows', 'aria-label': 'Pages of the drawing' });
      names.forEach(function (nm) {
        var b2 = mk('button', { type: 'button', cls: 'ef-it', 'aria-current': nm === PAGE ? 'page' : null, text: (nm === PAGE ? '▸ ' : '  ') + nm });
        b2.addEventListener('click', function () { var tt = tf(); if (tt && tt.showPage(nm)) { PAGE = nm; small.pages.fill(); var c = small.pages.body.querySelector('[aria-current="page"]'); if (c) c.focus(); say('Showing ' + nm + ' in the drawing.'); } });
        ul.appendChild(mk('li', {}, [b2]));
      });
      b.appendChild(ul);
    }, besideFrame],
    properties: ['*Properties*', function (b) {
      if (!SEL) b.appendChild(mk('p', { text: 'Nothing is selected in the drawing. Select a shape there; this shows what the app says of it.' }));
      else b.appendChild(mk('dl', { cls: 'ef-dl' }, [['Name', SEL.name], ['Says', SEL.tooltip || '(nothing)'], ['Kind', SEL.kind], ['Page', SEL.page], ['Id', SEL.id], ['Reference', SEL.ref || '(none)'], ['Selected', String(SEL.count)]]
        .map(function (r) { return mk('div', {}, [mk('dt', { text: r[0] }), mk('dd', { text: r[1] })]); })));
      var t9 = nine('setProps');
      if (SEL && SEL.id && t9) {
        // 1.9: the name and the tooltip edited here, one undo step each (TopoForge.setProps)
        [['Name', 'text', SEL.name], ['Says', 'tooltip', SEL.tooltip || '']].forEach(function (r) {
          var id = 'ef-prop-' + r[1], inp = mk('input', { type: 'text', id: id, cls: 'ef-in ef-prop', value: r[2], spellcheck: 'false', autocomplete: 'off' });
          var set = mk('button', { type: 'button', cls: 'ef-wb-b', 'data-set': r[1], text: '[Set]', 'aria-label': 'Set the ' + r[0].toLowerCase() + ' (one undo step)' });
          function apply() {
            var tt = nine('setProps'); if (!tt || !SEL) return;
            var ok = tt.setProps(SEL.id, r[1] === 'text' ? { text: inp.value } : { data: { tooltip: inp.value } });
            say(ok ? r[0] + ' set, one undo step (Edit, Undo takes it back).' : 'The app did not take that ' + r[0].toLowerCase() + '.');
          }
          set.addEventListener('click', apply);
          inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); apply(); } });
          b.appendChild(mk('p', { cls: 'ef-propr' }, [mk('label', { for: id, cls: 'ef-gl', text: r[0] + ': ' }), inp, ' ', set]));
        });
      }
      var o = mk('button', { type: 'button', cls: 'ef-wb-b', text: '[Open the app’s own Properties]' });
      o.addEventListener('click', function () { var t = tf(); if (t) { t.embed({ props: true, 'hide-props': false }); say('The app’s own Properties float over the drawing: edit there. [Hide it] puts them away.'); } });
      var h = mk('button', { type: 'button', cls: 'ef-wb-b', text: '[Hide it]' });
      h.addEventListener('click', function () { var t = tf(); if (t) { t.embed({ 'hide-props': true }); say('The app’s Properties are hidden again.'); } });
      b.appendChild(mk('p', { cls: 'ef-acts' }, [o, ' ', h]));
    }, besideFrame],
    credits: ['*Credits*', function (b) {
      var lg = doc.getElementById('legend');
      if (!lg) return;
      ['.lg-line', '.lg-grid'].forEach(function (s) {
        var x = lg.querySelector(s); if (!x) return;
        var c = x.cloneNode(true);
        each(c.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); });
        each(c.querySelectorAll('button'), function (e) { e.parentNode.removeChild(e); });
        c.classList.add('ef-credits');
        b.appendChild(c);
      });
      b.appendChild(mk('p', { cls: 'ef-note', text: 'There is no warranty for the drawing app, to the extent the law allows: see its licence.' }));
    }, besideFrame],
    here: ['*Here*', function (b) {
      b.appendChild(mk('p', { cls: 'ef-here-h', text: SEL ? SEL.name + (SEL.tooltip ? ': ' + SEL.tooltip : '') : 'Nothing is selected: the access settings are here all the same.' }));
      refreshCmds();
      var acts = ['edit::edit-text', 'edit::duplicate', 'edit::delete', 'arrange::bring-to-front', 'arrange::send-to-back', 'view::zoom-to-selection']
        .map(cmd).filter(function (c) { return c && c.enabled; });
      if (acts.length) b.appendChild(mk('div', { cls: 'ef-group', role: 'group', 'aria-label': 'Do to the selection' },
        [mk('span', { cls: 'ef-gl', text: 'Do: ' })].concat(acts.map(function (c) { return mk('button', { type: 'button', cls: 'ef-wb-b', 'data-act': c.id, text: '[' + c.label + ']' }); }))
          .concat([mk('button', { type: 'button', cls: 'ef-wb-b', 'data-act': 'properties', text: '[Properties]' })])));
      function btn(label, fn, extra) { var x = mk('button', Object.assign({ type: 'button', cls: 'ef-wb-b', text: label }, extra || {})); x.addEventListener('click', fn); return x; }
      var theme = (doc.querySelector('#custom-panel input[name="theme"]:checked') || {}).value || 'auto';
      b.appendChild(mk('div', { cls: 'ef-group', role: 'group', 'aria-label': 'Access settings (kept in Customize)' }, [
        mk('span', { cls: 'ef-gl', text: 'Text: ' }), btn('[A−]', function () { textSize(-1); }, { 'aria-label': 'Smaller text' }), btn('[A+]', function () { textSize(1); }, { 'aria-label': 'Larger text' }),
        mk('br'), mk('span', { cls: 'ef-gl', text: 'Colours: ' })].concat([['auto', 'system'], ['light', 'light'], ['dark', 'dark'], ['hc', 'high contrast']].map(function (v) {
          return btn('[' + v[1] + ']', function () { if (pressCustom('theme', v[0])) { say('Colours: ' + v[1] + ', kept in Customize.'); small.here.fill(); } }, { 'aria-pressed': String(theme === v[0]) });
        })).concat([mk('br'), mk('span', { cls: 'ef-gl', text: 'Motion: ' }),
          btn(MOTION ? '[reduce motion]' : '[allow motion]', function () { if (!pressCustom('calm', null)) toggleMotion(); small.here.fill(); }),
          btn('[Customize…]', customize)])));
    }, function (edges, W, H) {
      if (HERE_AT) return { x: Math.round(Math.max(8, Math.min(W - 316, HERE_AT.x))), y: Math.round(Math.max(8, Math.min(H - 200, HERE_AT.y))) };
      return { x: Math.round(Math.min(W - 316, W / 2 + 32)), y: Math.round(Math.max(8, H / 2 - 40)) };
    }]
  };
  function openSmall(name, replace) {
    if (!small[name]) { var d = SMALL[name]; small[name] = new Small(name, d[0], d[1], d[2]); }
    small[name].show(replace);
  }
  // Emacs floating into the canvas: recentre on the selection (as C-l does), then a small frame beside it
  function here(rect) {
    var t9 = nine('selectionRect');
    // 1.9: float beside the shape where it is, without moving the view
    if (t9 && SEL) {
      var r = rect || t9.selectionRect();
      HERE_AT = r ? { x: r.x + r.w + 12, y: r.y } : null;
      openSmall('here', true);
      say(SEL ? 'The frame by ' + SEL.name + ', beside it.' : 'Nothing is selected; the access settings are here.');
      return;
    }
    HERE_AT = null;
    var c = cmd('view::zoom-to-selection'), t = tf();
    if (SEL && t && c && c.enabled) t.run(c.id);
    openSmall('here', true);
    say(SEL ? 'The frame by ' + SEL.name + ': the view is centred on it (View, Zoom to selection).' : 'Nothing is selected; the access settings are here.');
  }

  // fit it (revision 8): a frame whose top row the layout switch covers is put below it whenever the switch
  // appears, changes size, or the fonts land; a frame never moved is placed again from the start (frame 2's
  // place is computed from the switch), one moved by the reader is only put below it
  function underSwitch(fr) {
    var b = switchBox(), s = fr.fl.state;
    if (!b || fr.fl.narrow() || s.x === null || s.y === null) return false;
    var w = fr.root.offsetWidth || s.w;
    return s.x < b.x + b.w && s.x + w > b.x && s.y < b.y + b.h && s.y + 40 > b.y;
  }
  function fitSwitch() { frames.forEach(function (fr) { if (underSwitch(fr)) { if (fr.fl.auto) fr.fl.retarget(); else fr.fl.apply(); } }); }
  function watchSwitch() {
    var sw = doc.getElementById('ui-switch');
    if (sw) { if (window.ResizeObserver) new window.ResizeObserver(fitSwitch).observe(sw); fitSwitch(); }
    else if (window.MutationObserver) {
      var mo = new MutationObserver(function () { if (doc.getElementById('ui-switch')) { mo.disconnect(); watchSwitch(); } });
      mo.observe(doc.body, { childList: true });
    }
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(fitSwitch);
  }

  function navFrame() {
    var g = new Frame(nextFrame++, { buf: 'navigator', toolbar: false, width: grid.clientWidth >= 1800 ? 500 : 440, east: true });
    g.navFrame = true; frames.push(g);
    g.say('*navigator*. C-x b: *finder*.');
    return g;
  }
  // Reset layout (revision 8): every frame and palette back to its first place and size, the navigator's
  // frame reopened, the map mode back to Both; settings (text size, colours, the watermark, Motion, lines,
  // tool-bars, what windows show, the pad's arrows) untouched. One level of Undo reset, for this visit.
  // Stage 2 (topology forge 1.11): one reset on both sides. From the page (from: undefined) it also calls
  // the app's resetLayout() / undoReset() and drops the one topoforge:reset that call sends (EXPECT); from
  // the app (from: 'app', its View or Mode menu) it resets or restores the page's side only.
  var UNDO = null, EXPECT = { reset: 0, undo: 0 };
  function appReset(call) { var t = eleven(call), e = null; try { e = t && t.embed(); } catch (er) { e = null; } return t && e && e.reset ? t : null; }
  function resetLayout(from) {
    var app_ = from === 'app';
    if (narrowQ.matches) { if (!app_) say('On a narrow screen nothing floats, so there is no layout to reset.'); return; }
    var snap = { mode: MAPMODE, nav: false, st: {} };
    window.CCFloat.all().forEach(function (fl) { snap.st[fl.name] = JSON.parse(JSON.stringify(fl.state)); });
    if (!frames.some(function (fr) { return fr.navFrame; })) {
      fkeep('navFrame', true);
      var g = navFrame(); snap.nav = true;
      if (!NAVAT) { NAVAT = { f: g, w: g.leaves()[0] }; }
      g.render();
    }
    window.CCFloat.all().forEach(function (fl) { fl.first(/^small-/.test(fl.name)); });
    frames.forEach(function (fr) { fr.render(); fr.modelines(); });
    if (!app_) { var t = appReset('resetLayout'); if (t) { try { if (t.resetLayout()) EXPECT.reset++; } catch (e) { /* the app's */ } } }
    setMapMode('both', app_ ? 'app' : 'reset');
    UNDO = snap;
    say(app_ ? 'Layout reset from the map’s menu: the frames, the legend, the map and its mode are back where they started. Options, Undo reset puts them back.'
      : 'Layout reset: the frames, the legend, the map and its mode are back where they started. Options, Undo reset puts them back.');
  }
  function undoReset(from) {
    var app_ = from === 'app';
    if (!UNDO) { if (!app_) say('There is no reset to undo.'); return; }
    var u = UNDO; UNDO = null;
    if (u.nav) { var g = frames.filter(function (fr) { return fr.navFrame; })[0]; if (g && frames.length > 1) deleteFrame(g); }
    window.CCFloat.all().forEach(function (fl) { if (u.st[fl.name]) fl.set(u.st[fl.name], true); });
    if (!app_) { var t = appReset('undoReset'); if (t) { try { if (t.undoReset()) EXPECT.undo++; } catch (e) { /* the app's */ } } }
    setMapMode(u.mode, app_ ? 'app' : 'reset');
    say('Undo reset: the frames, the legend, the map and its mode are back where they were.');
  }
  function fromAppReset(d) {
    if (d.undone) { if (EXPECT.undo > 0) EXPECT.undo--; else undoReset('app'); }
    else if (EXPECT.reset > 0) EXPECT.reset--; else resetLayout('app');
  }

  // ---- start ----------------------------------------------------------------------------------------
  function start() {
    var f = new Frame(nextFrame++);
    frames.push(f); cur = f;
    f.root.classList.add('ef-selected');
    window.CCFloat.credits = function () { openSmall('credits'); };
    // yes, and (revision 5): on a wide screen the navigator opens beside the finder in a second frame,
    // until it is closed (C-x 5 0 there), which this browser then remembers
    if (!narrowQ.matches && fstate().navFrame !== false) navFrame();
    var mountNav = function () {
      var target = null;
      frames.forEach(function (fr) { fr.leaves().forEach(function (w) { if (!target && fr.st.wins[w].buf === 'navigator') target = { f: fr, w: w }; }); });
      if (target) { NAVAT = target; target.f.render(); }
      frames.forEach(function (fr) { fr.render(); });
    };
    if (nav()) mountNav(); else doc.addEventListener('ccnav:ready', mountNav);
    watchSwitch();
    // what stage.js says (about the drawing kept in this browser) is said here too
    var sm = doc.getElementById('stage-msg');
    if (sm && window.MutationObserver) new MutationObserver(function () { if (sm.textContent) say(sm.textContent); }).observe(sm, { childList: true, characterData: true, subtree: true });
    if (sm && sm.textContent) say(sm.textContent); else say('Alt+x or a click here: M-x. F10: menus.');
    // Customize's Reduce motion, if kept: this page's motion button is on the mode-line
    var calm = doc.querySelector('#custom-panel input[name="calm"]');
    if (calm && calm.checked && MOTION) toggleMotion();
    var t = tf();
    if (t && t.ready && t.ready.then) t.ready.then(function (d) { READY = READY || d; PAGE = PAGE || (d && d.page) || ''; takeShapes(); refreshCmds(); hooks19(); frames.forEach(function (x) { x.modelines(); }); });
    grid.setAttribute('data-free', 'yes');
  }
  start();
  window.fetch('nav/index.json', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (d) { IX = d; IX.items.forEach(function (it) { it.words = it.words || tok(it.name); }); frames.forEach(function (f) { f.render(); }); }, function () { say('The finder’s index did not load: the shapes and M-x still work.'); });
  // the tests' handle: the template and the table, read-only
  window.CCFree = { template: MODE_LINE, elements: Object.keys(ELEMENTS), frames: function () { return frames.length; },
    navAt: function () { return NAVAT ? { frame: NAVAT.f.n, win: NAVAT.w } : null; }, nineteen: function () { return !!nine(); },
    mapMode: function () { return MAPMODE; } };
})();
// @license-end
