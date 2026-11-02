// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// free.js: the free page layout (docs/NAV.md, revision 4). The drawing fills the window (the app is
// asked for embed=bare, so its own bars and panels are hidden) and one Emacs frame floats near the left
// edge, top to bottom: a menu bar (the site's pages, the app's commands() as its menus grouped them,
// Options, Help: the only menus on the page), a tool-bar of shape categories (tiles that press and
// unpress), the finder (shapes and what the drawing draws, in one to four windows, each with a
// mode-line built from a template of elements), and the message area, which becomes a one-line M-x
// input. C-x 5 2 makes another frame. Pages, Properties, Credits and the frame by the shape (*Here*,
// C-c .) are small Emacs frames. It talks to the app only through its documented calls and messages
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
    if (m.type === 'topoforge:ready') { READY = m.detail; PAGE = m.detail.page || ''; takeShapes(); refreshCmds(); }
    else if (m.type === 'topoforge:select') { SEL = m.detail.count ? m.detail : null; PAGE = m.detail.page || PAGE; }
    else return;
    frames.forEach(function (f) { f.modelines(); });
    if (small.pages && !small.pages.root.hidden) small.pages.fill();
    if (small.properties && !small.properties.root.hidden) small.properties.fill();
  });
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
    buffer: { scope: 'core', text: function () { return '*finder*'; }, act: 'switch-to-buffer',
      help: function () { return 'Buffer *finder*: the shapes and what the drawing draws. Click: switch to another buffer.'; } },
    page: { scope: 'context', text: function () { return PAGE ? 'p:' + PAGE : ''; }, act: 'pages',
      help: function () { return 'The page of the drawing in view: ' + PAGE + '. Click: the Pages box.'; } },
    select: { scope: 'context', long: 'here', act: 'here',
      text: function () { return SEL ? SEL.name + (SEL.count > 1 ? ' +' + (SEL.count - 1) : '') : ''; },
      help: function () { return SEL ? 'Selected in the drawing: ' + SEL.name + (SEL.tooltip ? ': ' + SEL.tooltip : '') + ' · ' + SEL.kind + ' · page ' + SEL.page + '. Click or long press: the frame by the shape (C-c .).' : ''; } },
    zoom: { scope: 'mode', parts: [['−', 'view::zoom-out', 'Zoom out (the mouse wheel here zooms too)'], ['zoom', 'view::fit-to-window', 'Fit the drawing to the window'], ['+', 'view::zoom-in', 'Zoom in']] },
    filter: { scope: 'mode', act: 'filter-clear',
      text: function (c) { return filterWords(c.frame); },
      help: function (c) { return filterWords(c.frame) === 'all' ? 'The finder shows everything: press a tile or type words (M-x) to narrow it.' : 'The finder is narrowed to ' + filterWords(c.frame) + '. Click: show everything again.'; } },
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
          var isMotion = q[1] === 'toggle-motion';
          var b = mk('button', { type: 'button', cls: 'ml-b', 'data-act': q[1], 'data-help': q[2], 'aria-label': q[2],
            id: isMotion && !motionMade ? 'motion' : null, 'aria-pressed': isMotion ? String(MOTION) : null, text: isMotion ? (MOTION ? 'Motion' : 'Still') : q[0] });
          if (isMotion) motionMade = true;
          if (i && e.wrap) node.appendChild(doc.createTextNode(' '));
          node.appendChild(b);
        });
        if (e.wrap) node.appendChild(doc.createTextNode(')'));
      } else {
        var txt = e.text(c);
        if (!txt) { pendingGap = ''; return; }
        var h = e.help(c);
        node.appendChild(mk('button', { type: 'button', cls: 'ml-b', 'data-act': e.act, 'data-long': e.long || null, 'data-help': h, 'aria-label': h, text: txt }));
      }
      if (pendingGap && el.childNodes.length) el.appendChild(doc.createTextNode(pendingGap));
      pendingGap = '';
      el.appendChild(node);
    });
  }

  // ---- commands: the frame's own, by name (Emacs's), and the app's by its id ----------------------
  var KEYS = { 'split-window-below': 'C-x 2', 'split-window-right': 'C-x 3', 'delete-window': 'C-x 0', 'delete-other-windows': 'C-x 1',
    'other-window': 'C-x o', 'make-frame': 'C-x 5 2', 'delete-frame': 'C-x 5 0', 'other-frame': 'C-x 5 o', 'here': 'C-c .',
    'execute-extended-command': 'Alt+x', 'menu-bar-open': 'F10', 'keyboard-quit': 'C-g' };
  var NAMES = { 'split-window-below': 'Split window below', 'split-window-right': 'Split window right', 'delete-window': 'Delete window',
    'delete-other-windows': 'One window', 'other-window': 'Other window', 'make-frame': 'New frame', 'delete-frame': 'Delete frame',
    'other-frame': 'Other frame', 'here': 'The frame by the shape (*Here*)', 'pages': 'Pages', 'properties': 'Properties', 'credits': 'Credits and licence',
    'customize': 'Customize…', 'ui-classic': 'Page layout: classic (menus at the top)', 'ui-free': 'Page layout: free', 'legend': 'Legend watermark',
    'toggle-motion': 'Motion', 'filter-clear': 'Show everything in the finder', 'describe-mode': 'About this frame', 'keys': 'Keys',
    'fold': 'Show or hide the tool-bar and finder', 'move-left': 'Move left', 'move-right': 'Move right', 'move-up': 'Move up', 'move-down': 'Move down',
    'move-reset': 'Back to where it started', 'switch-to-buffer': 'Switch to buffer', 'execute-extended-command': 'M-x: run a command',
    'menu-bar-open': 'Open the menu bar' };
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
    return ['*finder*', '*Pages*', '*Properties*', '*Credits*', '*Here*'].map(function (b) {
      return { label: b, run: function () { if (b === '*finder*') { cur.focusWin(); say('Buffer *finder*.'); } else core(b === '*Here*' ? 'here' : b.slice(1, -1).toLowerCase()); } };
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
  function Frame(n) {
    var f = this;
    f.n = n;
    f.st = { q: '', tiles: [], tree: { w: 1 }, wins: { 1: { fold: [], point: null, scroll: 0 } }, sel: 1, next: 2, open: !narrowQ.matches };
    f.root = mk('section', { cls: 'ef', id: 'ef-' + n, 'aria-label': 'Emacs frame ' + n + ': menus, tool-bar, finder, mode-line and message area', 'data-frame': n });
    f.grip = mk('button', { type: 'button', cls: 'fl-grip ef-grip', 'aria-label': 'Move this frame: drag, or use the arrow keys (Options, Move does it with one press)', title: 'Drag to move', text: '⠿' });
    f.menubar = mk('div', { cls: 'ef-menubar', role: 'menubar', 'aria-label': 'Menu bar (F10)' });
    f.menubar.appendChild(f.grip);
    f.menus = ['Site', 'File', 'Edit', 'Arrange', 'Layout', 'View', 'Options', 'Help'];
    f.menus.forEach(function (m, i) {
      f.menubar.appendChild(mk('button', { type: 'button', cls: 'ef-mb', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-menu': m, tabindex: i ? '-1' : '0', text: m }));
    });
    f.foldB = mk('button', { type: 'button', cls: 'ef-fold', 'aria-controls': 'ef-body-' + n, 'data-act': 'fold' });
    f.menubar.appendChild(f.foldB);
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
    [f.menubar, f.pop, f.body, f.echo].forEach(function (x) { f.root.appendChild(x); });
    grid.appendChild(f.root);
    f.fl = window.CCFloat.make({
      name: 'frame' + n, label: n === 1 ? 'The Emacs frame' : 'Emacs frame ' + n, el: f.root, grip: f.grip, docks: false, width: 440, hiddenNarrow: false,
      say: function (t) { f.say(t); },
      place: function (edges, W, H) {
        var k = n - 1;
        return n === 1 ? { x: 8, y: 8, h: Math.max(320, Math.min(H - 24, 700)) } : { x: Math.min(W - 460, 460 + 24 * k), y: 24 + 24 * k, h: Math.max(300, Math.min(H - 80, 560)) };
      }
    });
    f.wire();
    f.render();
  }
  Frame.prototype.say = function (t) { this.msg.textContent = t; };
  Frame.prototype.leaves = function (node) { var f = this; node = node || f.st.tree; return node.w ? [node.w] : node.kids.reduce(function (a, k) { return a.concat(f.leaves(k)); }, []); };
  Frame.prototype.split = function (dir) {
    var f = this, s = f.st, ls = f.leaves();
    if (ls.length >= MAXWIN) { f.say('At most ' + MAXWIN + ' windows in a frame here.'); return; }
    var id = s.next++, from = s.wins[s.sel];
    s.wins[id] = { fold: from.fold.slice(), point: from.point, scroll: from.scroll };
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
    f.render(); f.focusWin(); f.say('Window deleted (C-x 0).');
  };
  Frame.prototype.oneWin = function () {
    var f = this, s = f.st, n = f.leaves().length;
    s.tree = { w: s.sel }; Object.keys(s.wins).forEach(function (k) { if (+k !== s.sel) delete s.wins[k]; });
    f.render(); f.say(n > 1 ? 'One window: the others are closed (C-x 1).' : 'There is only one window.');
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
    f.foldB.textContent = s.open ? '−' : '+';
    f.foldB.setAttribute('aria-expanded', String(s.open));
    f.foldB.setAttribute('aria-label', s.open ? 'Fold the tool-bar and finder' : 'Unfold the tool-bar and finder');
    f.renderTools(); f.renderWins();
    if (keep && keep.sel) {
      var scope = keep.win ? f.wins.querySelector('.ef-win[data-win="' + keep.win + '"]') : f.root;
      var nn = scope && scope.querySelector(keep.sel);
      if (nn) nn.focus({ preventScroll: true });
    }
  };
  Frame.prototype.renderTools = function () {
    var f = this;
    f.toolbar.textContent = '';
    if (!CATS.length) { f.toolbar.appendChild(mk('span', { cls: 'ef-wait', text: 'The shapes arrive when the drawing app is ready.' })); return; }
    CATS.forEach(function (c, i) {
      var on = f.st.tiles.indexOf(c.id) >= 0;
      f.toolbar.appendChild(mk('button', { type: 'button', cls: 'ef-tile', 'data-cat': c.id, 'aria-pressed': String(on), tabindex: i ? '-1' : '0',
        'aria-label': c.label + ' shapes (' + c.shapes.length + '): ' + (on ? 'pressed; press again to show every category' : 'press to show only these'), title: c.label },
        [icon(c.shapes[0].id), mk('span', { cls: 'ef-tl', text: c.label.replace(' & ', ' ').split(' ')[0] })]));
    });
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
    var f = this, s = f.st, ws = s.wins[w] || (s.wins[w] = { fold: [], point: null, scroll: 0 });
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
    var box = mk('div', { cls: 'ef-win' + (w === s.sel ? ' selected' : ''), 'data-win': w, role: 'region', 'aria-label': 'Window ' + (ls.indexOf(w) + 1) + ' of ' + ls.length + ': *finder*' }, [body, ml]);
    body.addEventListener('scroll', function () { ws.scroll = body.scrollTop; }, { passive: true });
    return box;
  };
  Frame.prototype.modelines = function () {
    var f = this, ls = f.leaves();
    if (f.n === 1) motionMade = false;
    each(f.wins.querySelectorAll('.ef-ml'), function (el) {
      var w = +el.getAttribute('data-ml');
      renderModeline(el, { frame: f, win: w, n: ls.indexOf(w) + 1, total: ls.length });
    });
    if (f.n === 1) frames.slice(1).forEach(function (o) { o.modelinesOnly(); });
  };
  Frame.prototype.modelinesOnly = function () {
    var f = this, ls = f.leaves();
    each(f.wins.querySelectorAll('.ef-ml'), function (el) { var w = +el.getAttribute('data-ml'); renderModeline(el, { frame: f, win: w, n: ls.indexOf(w) + 1, total: ls.length }); });
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
      head(''); mine('legend', !window.CCFloat.legendOff); mine('toggle-motion', MOTION); mine('fold', this.st.open);
      head('Palettes'); mine('properties'); mine('pages'); mine('here');
      if (!this.fl.narrow()) { head('Move this frame'); ['move-left', 'move-right', 'move-up', 'move-down', 'move-reset'].forEach(function (n) { mine(n); }); }
    } else if (m === 'Help') { mine('keys'); mine('credits'); mine('describe-mode'); head('The drawing app'); app_('Help'); }
    else app_(m);
    return out;
  };
  Frame.prototype.menuOpen = function (i, focus) {
    var f = this, btns = f.menubar.querySelectorAll('.ef-mb');
    f.openMenu = i;
    each(btns, function (b, j) { b.setAttribute('aria-expanded', String(j === i)); b.setAttribute('tabindex', j === i ? '0' : '-1'); });
    f.pop.textContent = '';
    if (i === null || i === undefined) { f.pop.hidden = true; return; }
    var m = f.menus[i], b = btns[i];
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
    f.pop.style && f.pop.style.setProperty('--mx', Math.max(0, b.offsetLeft) + 'px');
    if (focus) { var first = f.pop.querySelector('.ef-mi:not([aria-disabled])'); if (first) first.focus(); else b.focus(); }
  };
  Frame.prototype.menuClose = function (refocus) {
    var f = this, i = f.openMenu;
    f.menuOpen(null);
    if (refocus && i !== null && i !== undefined) f.menubar.querySelectorAll('.ef-mb')[i].focus();
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
      if (w && +w.getAttribute('data-win') !== f.st.sel) { f.st.sel = +w.getAttribute('data-win'); each(f.wins.querySelectorAll('.ef-win'), function (b) { b.classList.toggle('selected', b === w); }); f.modelines(); }
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
    if (prefix) {
      ev.preventDefault(); ev.stopPropagation();
      if (k === 'Shift' || k === 'Control' || k === 'Alt') return;
      var p = prefix; prefix = null;
      if (k === 'Escape' || (ev.ctrlKey && (k === 'g' || k === 'G'))) { f.say('Quit'); return; }
      var table = { 'C-x': { '2': 'split-window-below', '3': 'split-window-right', '0': 'delete-window', '1': 'delete-other-windows', 'o': 'other-window', '5': 'C-x 5' },
        'C-x 5': { '2': 'make-frame', '0': 'delete-frame', 'o': 'other-frame' }, 'C-c': { '.': 'here' }, 'ESC': { 'x': 'execute-extended-command' } }[p];
      var name = table[k] || table[k.toLowerCase && k.toLowerCase()];
      if (name === 'C-x 5') { prefix = 'C-x 5'; f.say('C-x 5-'); return; }
      if (name) core(name, f); else f.say(p + ' ' + k + ' is undefined');
      return;
    }
    if (k === 'F10') { ev.preventDefault(); f.menuOpen(0, true); return; }
    // in the menus
    var mb = tg.closest && tg.closest('.ef-mb'), mi = tg.closest && tg.closest('.ef-mi');
    if (mb || mi) {
      var btns = Array.prototype.slice.call(f.menubar.querySelectorAll('.ef-mb')), i = mb ? btns.indexOf(mb) : f.openMenu;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { ev.preventDefault(); var j = (i + (k === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length; if (f.openMenu !== null && f.openMenu !== undefined) f.menuOpen(j, true); else { btns[j].focus(); btns.forEach(function (b, x) { b.setAttribute('tabindex', x === j ? '0' : '-1'); }); } return; }
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
    if (k === 'Escape' && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); prefix = 'ESC'; f.say('ESC-'); return; }
    // the tool-bar: arrows move along it
    var tile = tg.closest && tg.closest('.ef-tile');
    if (tile && (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End')) {
      ev.preventDefault();
      var ts = Array.prototype.slice.call(f.toolbar.querySelectorAll('.ef-tile')), a = ts.indexOf(tile);
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
    f.root.parentNode.removeChild(f.root);
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
      var o = mk('button', { type: 'button', cls: 'ef-wb-b', text: '[Open the app’s own Properties]' });
      o.addEventListener('click', function () { var t = tf(); if (t) { t.embed({ props: true, 'hide-props': false }); say('The app’s own Properties float over the drawing: edit there. [Hide it] puts them away.'); } });
      var h = mk('button', { type: 'button', cls: 'ef-wb-b', text: '[Hide it]' });
      h.addEventListener('click', function () { var t = tf(); if (t) { t.embed({ 'hide-props': true }); say('The app’s Properties are hidden again.'); } });
      b.appendChild(mk('p', { cls: 'ef-acts' }, [o, ' ', h]));
    }, besideFrame],
    credits: ['*Credits*', function (b) {
      var lg = doc.getElementById('legend');
      if (!lg) return;
      ['.lg-short', '.lg-grid'].forEach(function (s) {
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
    }, function (edges, W, H) { return { x: Math.round(Math.min(W - 316, W / 2 + 32)), y: Math.round(Math.max(8, H / 2 - 40)) }; }]
  };
  function openSmall(name, replace) {
    if (!small[name]) { var d = SMALL[name]; small[name] = new Small(name, d[0], d[1], d[2]); }
    small[name].show(replace);
  }
  // Emacs floating into the canvas: recentre on the selection (as C-l does), then a small frame beside it
  function here() {
    var c = cmd('view::zoom-to-selection'), t = tf();
    if (SEL && t && c && c.enabled) t.run(c.id);
    openSmall('here', true);
    say(SEL ? 'The frame by ' + SEL.name + ': the view is centred on it (View, Zoom to selection).' : 'Nothing is selected; the access settings are here.');
  }

  // ---- start ----------------------------------------------------------------------------------------
  function start() {
    var f = new Frame(nextFrame++);
    frames.push(f); cur = f;
    f.root.classList.add('ef-selected');
    // what stage.js says (about the drawing kept in this browser) is said here too
    var sm = doc.getElementById('stage-msg');
    if (sm && window.MutationObserver) new MutationObserver(function () { if (sm.textContent) say(sm.textContent); }).observe(sm, { childList: true, characterData: true, subtree: true });
    if (sm && sm.textContent) say(sm.textContent); else say('Alt+x or a click here: M-x. F10: the menus. The tiles narrow the shapes; Enter on a shape places it.');
    // Customize's Reduce motion, if kept: this page's motion button is on the mode-line
    var calm = doc.querySelector('#custom-panel input[name="calm"]');
    if (calm && calm.checked && MOTION) toggleMotion();
    var t = tf();
    if (t && t.ready && t.ready.then) t.ready.then(function (d) { READY = READY || d; PAGE = PAGE || (d && d.page) || ''; takeShapes(); refreshCmds(); frames.forEach(function (x) { x.modelines(); }); });
    grid.setAttribute('data-free', 'yes');
  }
  start();
  window.fetch('nav/index.json', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (d) { IX = d; IX.items.forEach(function (it) { it.words = it.words || tok(it.name); }); frames.forEach(function (f) { f.render(); }); }, function () { say('The finder’s index did not load: the shapes and M-x still work.'); });
  // the tests' handle: the template and the table, read-only
  window.CCFree = { template: MODE_LINE, elements: Object.keys(ELEMENTS), frames: function () { return frames.length; } };
})();
// @license-end
