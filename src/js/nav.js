// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// nav.js: the navigator beside the drawing, drawn as an Emacs frame (docs/NAV.md says what and why).
// Without this file the navigator is a plain list of links. With it:
//   - a palette that floats over the drawing (js/float.js: drag its grip, arrow keys, or the Window
//     menu; dock it left or right; hide it to a strip), with a menu bar that also carries the site's
//     own pages, a tab bar once there are two buffers, a tool bar of categories per buffer, one to four
//     windows (splits) each with a pinned area and its own mode-line, and a minibuffer: the prompt,
//     a [Pin as buffer] action and the echo area;
//   - the tool bar's pressed categories and the prompt's words narrow the windows together;
//   - pins (items and sections) stay put and visible; drag them, or Alt+Up and Alt+Down, to reorder;
//   - "Pin results to a new buffer" bakes the context into a new tab (or switches to one that has it);
//   - its edge drags (or arrow keys) to change the width.
// It reads one file from this site, nav/index.json, and asks the network for nothing else. It keeps
// its state in this browser only (corwin.cloud.nav.v1), and works, forgetting on reload, when that
// storage is refused. Words are matched with about-corwin's taxonomy.js when it was staged.
(function () {
  'use strict';
  var doc = document, host = doc.getElementById('nav'), grid = doc.getElementById('stage-grid');
  var frame = doc.getElementById('topology');
  if (!host || !grid || !window.fetch || !window.JSON) return;
  var KEY = 'corwin.cloud.nav.v1', MAXWIN = 4;
  var T = window.Taxonomy && window.Taxonomy.tokenize && window.Taxonomy.similarity ? window.Taxonomy : null;
  var FACET_NAMES = { show: 'Show', notation: 'Notation', pillar: 'Is a', says: 'Topic' };
  var FACETS = ['notation', 'pillar', 'says'];
  var ix, ITEMS = {}, SECS = [], SEC_LABEL = {}, LABEL = {}, STOP = {}, VOCAB = [], state, hover = {}, prefix = null;
  var els = {}, fl = null;

  function load() { try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* refused: kept for this visit only */ } }

  function mk(tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'cls') n.className = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function glyph(g) { return mk('span', { cls: 'g g-' + (g || 'rounded'), 'aria-hidden': 'true' }); }
  function say(t) { if (els.echo) els.echo.textContent = t; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- words: about-corwin's matching, or the same rule by hand ---------------------------------
  function tok(q) {
    if (T) return T.tokenize(q);
    return String(q || '').toLowerCase().split(/[^a-z0-9'+.-]+/).map(function (w) { return w.replace(/^[-'.]+|[-'.]+$/g, ''); }).filter(Boolean);
  }
  function sim(w, t) {
    if (T) return T.similarity(w, t);
    if (w === t) return 1;
    if (w + 's' === t || t + 's' === w) return 0.95;
    return w.length >= 3 && t.indexOf(w) === 0 ? 0.8 : 0;
  }
  function qwords(q) { return tok(q).filter(function (w) { return !STOP[w]; }); }
  function saysWord(it, w) { for (var i = 0; i < it.words.length; i++) if (sim(w, it.words[i]) >= 0.8) return true; return false; }

  // ---- contexts ----------------------------------------------------------------------------------
  function emptyCtx() { return { show: [], f: { notation: [], pillar: [], says: [] }, q: '' }; }
  function ctxEmpty(c) { return !c.show.length && FACETS.every(function (f) { return !c.f[f].length; }) && !qwords(c.q).length; }
  function canon(list) {
    return JSON.stringify(list.map(function (c) {
      var f = {};
      FACETS.forEach(function (k) { f[k] = c.f[k].slice().sort(); });
      return { show: c.show.slice().sort(), f: f, q: qwords(c.q).join(' ') };
    }));
  }
  function ctxs(tab) { return tab.base.concat([tab.live]); }
  function passOne(it, c) {
    for (var i = 0; i < FACETS.length; i++) {
      var p = c.f[FACETS[i]];
      if (p.length && !p.some(function (v) { return it.facets[FACETS[i]].indexOf(v) >= 0; })) return false;
    }
    return qwords(c.q).every(function (w) { return saysWord(it, w); });
  }
  function passes(tab, it) { return ctxs(tab).every(function (c) { return passOne(it, c); }); }
  function secShown(tab, sid) { return ctxs(tab).every(function (c) { return !c.show.length || c.show.indexOf(sid) >= 0; }); }
  function describe(list, short) {
    var parts = [];
    list.forEach(function (c) {
      if (c.show.length) parts.push((short ? '' : 'Show ') + c.show.map(function (s) { return SEC_LABEL[s]; }).join(short ? '+' : ' or '));
      FACETS.forEach(function (f) {
        if (c.f[f].length) parts.push((short ? '' : FACET_NAMES[f] + ' ') + c.f[f].map(function (v) { return LABEL[f + ':' + v]; }).join(short ? '+' : ' or '));
      });
      var w = qwords(c.q);
      if (w.length) parts.push(short ? '“' + w.join(' ') + '”' : 'words: ' + w.join(', '));
    });
    return parts.join(short ? '·' : '; ');
  }

  // ---- state -------------------------------------------------------------------------------------
  function newTab(name, base) {
    return { name: name, base: base || [], live: emptyCtx(), pins: [], tfold: ['says'], tree: { w: 1 }, wins: { 1: { fold: [], point: null, scroll: 0 } }, sel: 1, next: 2 };
  }
  function sane(s) {
    if (!s || !Array.isArray(s.tabs) || !s.tabs.length) return null;
    try {
      s.tabs.forEach(function (t) {
        if (!t.live || !t.tree || !t.wins || !Array.isArray(t.base) || !Array.isArray(t.pins)) throw new Error('shape');
        t.pins = t.pins.filter(function (p) { return p.k === 'g' ? SEC_LABEL[p.id] : ITEMS[p.id]; });
        leaves(t.tree).forEach(function (w) { if (!t.wins[w]) t.wins[w] = { fold: [], point: null, scroll: 0 }; });
        if (leaves(t.tree).indexOf(t.sel) < 0) t.sel = leaves(t.tree)[0];
      });
      s.cur = Math.max(0, Math.min(s.tabs.length - 1, s.cur | 0));
      return s;
    } catch (e) { return null; }
  }
  function tab() { return state.tabs[state.cur]; }
  function leaves(n) { return n.w ? [n.w] : n.kids.reduce(function (a, k) { return a.concat(leaves(k)); }, []); }
  function uniqueName(base) {
    var names = state.tabs.map(function (t) { return t.name; }), n = base, i = 2;
    while (names.indexOf(n) >= 0) n = base + '<' + (i++) + '>';
    return n;
  }

  // ---- commands ----------------------------------------------------------------------------------
  function split(dir) {
    var t = tab(), ls = leaves(t.tree);
    if (ls.length >= MAXWIN) { say('At most ' + MAXWIN + ' windows in a buffer here.'); return; }
    var id = t.next++, from = t.wins[t.sel];
    t.wins[id] = { fold: from.fold.slice(), point: from.point, scroll: from.scroll };
    (function walk(n, parent, i) {
      if (n.w === t.sel) {
        if (parent && parent.dir === dir) parent.kids.splice(i + 1, 0, { w: id });
        else if (parent) parent.kids[i] = { dir: dir, kids: [n, { w: id }] };
        else t.tree = { dir: dir, kids: [n, { w: id }] };
        return true;
      }
      return n.kids && n.kids.some(function (k, j) { return walk(k, n, j); });
    })(t.tree, null, 0);
    say(dir === 'v' ? 'Split the window: one above the other (C-x 2).' : 'Split the window: side by side (C-x 3).');
    commit();
  }
  function deleteWin() {
    var t = tab();
    if (leaves(t.tree).length < 2) { say('This is the only window, so it stays (Emacs: "Attempt to delete the sole ordinary window").'); return; }
    (function walk(n) {
      if (!n.kids) return;
      n.kids = n.kids.filter(function (k) { return k.w !== t.sel; });
      n.kids.forEach(walk);
      n.kids = n.kids.map(function (k) { return k.kids && k.kids.length === 1 ? k.kids[0] : k; });
    })(t.tree);
    if (t.tree.kids && t.tree.kids.length === 1) t.tree = t.tree.kids[0];
    delete t.wins[t.sel];
    t.sel = leaves(t.tree)[0];
    commit(); focusWin(t.sel);
  }
  function oneWin() { var t = tab(), n = leaves(t.tree).length; t.tree = { w: t.sel }; Object.keys(t.wins).forEach(function (k) { if (+k !== t.sel) delete t.wins[k]; }); say(n > 1 ? 'One window: the others are closed (C-x 1).' : 'There is only one window.'); commit(); }
  function otherWin() { var t = tab(), ls = leaves(t.tree); if (ls.length < 2) { say('There is no other window: Split below or Split right makes one.'); return; } t.sel = ls[(ls.indexOf(t.sel) + 1) % ls.length]; say('Window ' + (leaves(t.tree).indexOf(t.sel) + 1) + ' of ' + ls.length + ' (C-x o).'); commit(); focusWin(t.sel); }
  function addTab(t, msg) { state.tabs.push(t); state.cur = state.tabs.length - 1; say(msg); commit(); }
  function newBuffer() { addTab(newTab(uniqueName('*all*')), 'A new buffer. The tab bar shows once there are two (C-x t 2).'); }
  function closeTab(i) {
    if (state.tabs.length < 2) { say('This is the only buffer, so it stays.'); return; }
    if (i === undefined) i = state.cur;
    state.tabs.splice(i, 1);
    state.cur = Math.min(state.cur, state.tabs.length - 1);
    commit();
  }
  function nextTab() { if (state.tabs.length < 2) { say('There is no other buffer: New buffer makes one.'); return; } state.cur = (state.cur + 1) % state.tabs.length; say('Buffer ' + tab().name + '.'); commit(); }
  function pinToBuffer() {
    var t = tab(), base = clone(t.base);
    if (!ctxEmpty(t.live)) base.push(clone(t.live));
    if (!base.length) { say('Nothing to pin yet: press a category or type words after Narrow first.'); return; }
    var key = canon(base);
    for (var i = 0; i < state.tabs.length; i++) {
      var o = state.tabs[i];
      if (o.base.length && canon(o.base) === key && ctxEmpty(o.live)) {
        state.cur = i; say('Switched to ' + o.name + ', which has this context already.'); commit(); return;
      }
    }
    addTab(newTab(uniqueName('*' + describe(base, true) + '*'), base), 'A new buffer with the context pinned: ' + describe(base) + '.');
  }
  function setMode() {
    var t = tab();
    if (ctxEmpty(t.live)) { say('Nothing to keep yet: press a category or type words after Narrow first.'); return; }
    t.base.push(clone(t.live)); t.live = emptyCtx(); els.q.value = '';
    say('This buffer now keeps the filter: ' + describe(t.base) + '.'); commit();
  }
  function clearMode() { var t = tab(); if (!t.base.length) { say('This buffer keeps no filter.'); return; } t.base = []; say('The kept filter is dropped: this buffer shows everything again.'); commit(); }
  function pinKey(p) { return p.k + ':' + p.id; }
  function togglePin(k, id) {
    var t = tab(), i = t.pins.map(pinKey).indexOf(k + ':' + id);
    var name = k === 'g' ? SEC_LABEL[id] : ITEMS[id].name;
    if (i >= 0) { t.pins.splice(i, 1); say('Unpinned ' + name + '.'); } else { t.pins.push({ k: k, id: id }); say('Pinned ' + name + ': it stays at the top of every window of this buffer, whatever the filter.'); }
    commit();
  }
  function movePin(from, to) {
    var t = tab();
    if (from === to || from < 0 || to < 0 || from >= t.pins.length || to >= t.pins.length) return;
    var p = t.pins.splice(from, 1)[0];
    t.pins.splice(to, 0, p);
    say('Moved the pin to place ' + (to + 1) + ' of ' + t.pins.length + '.');
    commit();
  }
  // The Site menu is the page's own top bar (Home, Directory, ...), read from it so the two never
  // disagree, plus Customize; on a wide screen the top bar itself is folded away into this menu.
  function siteItems() {
    var out = [];
    Array.prototype.forEach.call(doc.querySelectorAll('header.top nav a'), function (a) {
      out.push(['link', a.textContent + (a.getAttribute('aria-current') === 'page' ? ' (this page)' : ''), '', a.getAttribute('href')]);
    });
    var lic = doc.querySelector('a[rel="jslicense"]');
    if (lic) out.push(['link', 'JavaScript licences', '', lic.getAttribute('href')]);
    if (doc.getElementById('custom-btn')) out.push(['customize', 'Customize reading\u2026', '']);
    return out;
  }
  function windowItems() {
    var w = [['split-v', 'Split below', 'C-x 2'], ['split-h', 'Split right', 'C-x 3'], ['other', 'Other window', 'C-x o'], ['one', 'One window', 'C-x 1'], ['close', 'Close window', 'C-x 0']];
    if (!fl) return w;
    if (fl.narrow()) return w.concat([['hide', fl.isHidden() ? 'Show the navigator' : 'Hide the navigator to a strip', '']]);
    return w.concat([['dock-left', 'Dock on the left', ''], ['dock-right', 'Dock on the right', ''], ['float', 'Float over the drawing', ''],
      ['hide', fl.isHidden() ? 'Show the navigator' : 'Hide the navigator to a strip', ''],
      ['mv-l', 'Move left', ''], ['mv-r', 'Move right', ''], ['mv-u', 'Move up', ''], ['mv-d', 'Move down', ''], ['reset', 'Back to where it started', '']]);
  }
  var MENUS = {
    Site: siteItems,
    Buffers: function () { return [['newbuf', 'New buffer', 'C-x t 2'], ['closebuf', 'Close buffer', 'C-x t 0'], ['nextbuf', 'Next buffer', 'C-x t o'], ['pinbuf', 'Pin results to a new buffer', 'Ctrl+Enter']]; },
    Window: windowItems,
    Filter: function () { return [['setmode', 'Keep this filter in this buffer', 'C-c m'], ['clearmode', 'Drop the kept filter', 'C-c k'], ['pinbuf', 'Pin results to a new buffer', 'Ctrl+Enter']]; },
    Help: function () { return [['keys', 'Keys', ''], ['about', 'About the navigator', '']]; }
  };
  var openMenu = null;
  function menuShow(m) {
    openMenu = m === openMenu ? null : m;
    Array.prototype.forEach.call(els.menu.querySelectorAll('[data-menu]'), function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-menu') === openMenu ? 'true' : 'false'); });
    els.pop.textContent = '';
    els.pop.hidden = !openMenu;
    if (!openMenu) return;
    els.pop.setAttribute('aria-label', openMenu + ' menu');
    MENUS[openMenu]().forEach(function (c) {
      if (c[0] === 'link') els.pop.appendChild(mk('a', { href: c[3], cls: 'mi', 'data-link': c[3] }, [c[1]]));
      else els.pop.appendChild(mk('button', { type: 'button', cls: 'mi', 'data-cmd': c[0] }, [c[1], c[2] ? mk('span', { cls: 'kb', text: ' ' + c[2] }) : null]));
    });
    var f = els.pop.querySelector('.mi'); if (f) f.focus();
  }
  var COMMANDS = {
    'closebuf': function () { closeTab(); }, 'nextbuf': nextTab, 'other': otherWin, 'pinbuf': function () { pinToBuffer(); },
    'about': function () { say('The navigator lists what the drawing draws, by category. Press categories in the tool bar and type words after Narrow: both narrow at once. Pins stay put. It floats over the drawing and may cover part of it: drag its top row, dock it, or hide it. docs/NAV.md in the site\u2019s repository says how it decides.'); },
    'customize': function () { var b = doc.getElementById('custom-btn'); if (b) { b.click(); var r = doc.querySelector('#custom-panel input'); if (r) r.focus(); say('Customize: the reading text and colours of this site, kept in this browser.'); } },
    'dock-left': function () { fl.dock('left'); }, 'dock-right': function () { fl.dock('right'); }, 'float': function () { fl.dock('float'); },
    'hide': function () { fl.toggle(); }, 'reset': function () { fl.reset(); },
    'mv-l': function () { fl.move(-64, 0); }, 'mv-r': function () { fl.move(64, 0); }, 'mv-u': function () { fl.move(0, -64); }, 'mv-d': function () { fl.move(0, 64); },
    'newbuf': newBuffer, 'split-v': function () { split('v'); }, 'split-h': function () { split('h'); },
    'one': oneWin, 'close': deleteWin, 'setmode': setMode, 'clearmode': clearMode, 'keys': keysHelp
  };
  function keysHelp() {
    say('Keys, with focus in the navigator (let go of Ctrl before the second key): C-x 2 split below, C-x 3 split right, C-x 0 close window, ' +
        'C-x 1 one window, C-x o next window, C-x t 2 new buffer, C-x t 0 close buffer, C-x t o next buffer, C-x { narrower, C-x } wider, ' +
        'C-c p pin the item at point, C-c m keep the filter, C-c k drop it, Alt+x Narrow, Up and Down move, Alt+Up and Alt+Down move a pin, ' +
        'Ctrl+Enter after Narrow pins the results to a new buffer, arrow keys on the top row move the navigator, Escape or C-g quits.');
  }

  // ---- drawing the frame ---------------------------------------------------------------------------
  function build() {
    host.textContent = '';
    host.classList.add('nf-on');
    // the top row: the grip (drag it, or arrow keys) and the palette's own buttons. No title bar.
    els.title = mk('div', { cls: 'nf-bar' });
    els.grip = mk('button', { type: 'button', cls: 'fl-grip nf-grip', id: 'nav-grip', 'aria-describedby': 'nav-grip-d' }, ['\u283f ', mk('span', { id: 'nav-h', text: 'Navigator' })]);
    els.gripD = mk('span', { cls: 'visually-hidden', id: 'nav-grip-d', text: 'Drag to move the navigator over the drawing, or use the arrow keys here; Window, Move does it with one press.' });
    els.dockL = mk('button', { type: 'button', cls: 'fl-btn', 'data-cmd': 'dock-left', 'aria-pressed': 'false', 'aria-label': 'Dock the navigator on the left', text: 'left' });
    els.dockF = mk('button', { type: 'button', cls: 'fl-btn', 'data-cmd': 'float', 'aria-pressed': 'false', 'aria-label': 'Float the navigator over the drawing', text: 'float' });
    els.dockR = mk('button', { type: 'button', cls: 'fl-btn', 'data-cmd': 'dock-right', 'aria-pressed': 'false', 'aria-label': 'Dock the navigator on the right', text: 'right' });
    els.collapse = mk('button', { type: 'button', cls: 'fl-btn nf-hide', 'data-cmd': 'hide', 'aria-expanded': 'true', 'aria-controls': 'nf-body' });
    els.title.appendChild(els.grip); els.title.appendChild(els.gripD);
    els.title.appendChild(mk('span', { cls: 'nf-docks' }, [els.dockL, els.dockF, els.dockR]));
    els.title.appendChild(els.collapse);
    var menu = mk('div', { cls: 'nf-menu', role: 'group', 'aria-label': 'Menu bar' });
    Object.keys(MENUS).forEach(function (m) {
      menu.appendChild(mk('button', { type: 'button', cls: 'menu-b', 'data-menu': m, 'aria-expanded': 'false', 'aria-controls': 'nf-pop', text: m }));
    });
    els.menu = menu;
    els.pop = mk('div', { cls: 'nf-pop', id: 'nf-pop', role: 'group', hidden: true });
    els.tabs = mk('div', { cls: 'nf-tabs', role: 'tablist', 'aria-label': 'Buffers (tab bar)' });
    els.tools = mk('div', { cls: 'nf-tools', role: 'group', 'aria-label': 'Categories (tool bar)' });
    els.wins = mk('div', { cls: 'nf-wins', id: 'nf-wins' });
    // the minibuffer: one line, the prompt, the input (no box), and an Emacs widget button
    els.q = mk('input', { id: 'nav-q', type: 'search', spellcheck: 'false', autocomplete: 'off', 'aria-describedby': 'nav-echo', placeholder: 'words to narrow by' });
    els.pinbuf = mk('button', { type: 'button', id: 'nav-pinbuf', cls: 'mb-act', title: 'Pin these results as a new buffer (Ctrl+Enter)', 'aria-label': 'Pin these results as a new buffer (Ctrl+Enter)', text: '[Pin as buffer]' });
    var form = mk('form', { cls: 'nf-mb', role: 'search', 'aria-label': 'Narrow the navigator' },
      [mk('label', { for: 'nav-q', cls: 'mb-prompt', text: 'Narrow: ' }), els.q, els.pinbuf]);
    els.echo = mk('p', { id: 'nav-echo', cls: 'nf-echo', role: 'status' });
    els.handle = mk('div', { cls: 'nf-handle', role: 'separator', tabindex: '0', 'aria-orientation': 'vertical', 'aria-label': 'Navigator width: drag, or use the arrow keys' });
    els.body = mk('div', { cls: 'nf-body', id: 'nf-body' }, [menu, els.pop, els.tabs, els.tools, els.wins, form, els.echo]);
    host.setAttribute('aria-labelledby', 'nav-h');
    [els.title, els.body, els.handle].forEach(function (n) { host.appendChild(n); });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); summary(); });
  }

  function render() {
    var keep = focusKey();
    renderTitle(); renderTabs(); renderTools(); renderWins();
    els.q.value = tab().live.q;
    restoreFocus(keep);
  }
  function commit() { render(); save(); }

  function renderTitle() {
    if (!fl) return;
    var m = fl.state.mode, nar = fl.narrow(), hid = fl.isHidden();
    els.dockL.setAttribute('aria-pressed', String(!nar && m === 'left'));
    els.dockF.setAttribute('aria-pressed', String(!nar && m === 'float'));
    els.dockR.setAttribute('aria-pressed', String(!nar && m === 'right'));
    els.collapse.textContent = hid ? 'show' : 'hide';
    els.collapse.setAttribute('aria-expanded', hid ? 'false' : 'true');
    els.collapse.setAttribute('aria-label', hid ? 'Show the navigator' : 'Hide the navigator to a strip');
    var n = 0; tab() && (n = compute(tab()).shown);
    els.grip.setAttribute('title', hid ? 'Navigator: ' + n + ' of ' + ix.items.length + ' shown' : 'Drag to move');
  }
  function renderTabs() {
    els.tabs.textContent = '';
    els.tabs.hidden = state.tabs.length < 2;
    if (els.tabs.hidden) return;   // no tab bar, and no hidden tabs for a screen reader to find, until there are two
    state.tabs.forEach(function (t, i) {
      var on = i === state.cur;
      var b = mk('button', { type: 'button', role: 'tab', cls: 'nf-tab', 'data-tab': i, 'aria-selected': on ? 'true' : 'false', 'aria-controls': 'nf-wins', tabindex: on ? '0' : '-1' },
        [t.name]);
      var x = mk('button', { type: 'button', cls: 'nf-tabx', 'data-tabx': i, 'aria-label': 'Close ' + t.name, text: '×' });
      els.tabs.appendChild(mk('span', { cls: 'nf-tabw' + (on ? ' on' : '') }, [b, x]));
    });
  }
  function renderTools() {
    var t = tab();
    els.tools.textContent = '';
    ['show'].concat(FACETS).forEach(function (f) {
      var folded = (t.tfold || ['says']).indexOf(f) >= 0;
      var g = mk('div', { cls: 'tb-group', role: 'group', 'aria-label': FACET_NAMES[f] }, [mk('button', { type: 'button', cls: 'tb-name', 'data-tfold': f, 'aria-expanded': folded ? 'false' : 'true', title: (folded ? 'Unfold' : 'Fold') + ' the ' + FACET_NAMES[f] + ' row', 'aria-label': FACET_NAMES[f] + ': ' + (folded ? 'unfold' : 'fold') + ' this row', text: FACET_NAMES[f] })]);
      ix.facets[f].forEach(function (v) {
        var live = f === 'show' ? t.live.show : t.live.f[f];
        var baked = t.base.some(function (c) { return (f === 'show' ? c.show : c.f[f]).indexOf(v.id) >= 0; });
        var on = baked || live.indexOf(v.id) >= 0;
        if (folded && !on) return;
        g.appendChild(mk('button', { type: 'button', cls: 'tb' + (baked ? ' baked' : ''), 'data-facet': f, 'data-val': v.id,
          'aria-pressed': on ? 'true' : 'false', 'aria-label': FACET_NAMES[f] + ': ' + v.label + (baked ? ' (pinned in this buffer’s mode)' : '') },
          [glyph(v.glyph), v.label]));
      });
      els.tools.appendChild(g);
    });
  }

  function renderWins() {
    var t = tab();
    t.wins[t.sel] = t.wins[t.sel] || { fold: [], point: null, scroll: 0 };
    var ls = leaves(t.tree);
    var model = compute(t);
    els.wins.textContent = '';
    els.wins.appendChild(tree(t, t.tree, ls, model));
    ls.forEach(function (w) {
      var body = els.wins.querySelector('.win[data-win="' + w + '"] .win-body');
      if (body) body.scrollTop = t.wins[w].scroll || 0;
      modeline(w);
    });
  }
  function compute(t) {
    var pinnedItems = {}, pinnedGroups = {};
    t.pins.forEach(function (p) { if (p.k === 'i') pinnedItems[p.id] = 1; else pinnedGroups[p.id] = 1; });
    var pass = {}, shown = 0;
    ix.items.forEach(function (it) {
      pass[it.id] = passes(t, it);
      if (pass[it.id] && (secShown(t, it.section) || pinnedGroups[it.section] || pinnedItems[it.id])) shown++;
    });
    return { pass: pass, shown: shown, pi: pinnedItems, pg: pinnedGroups };
  }
  function tree(t, n, ls, model) {
    if (n.w) return win(t, n.w, ls, model);
    var box = mk('div', { cls: 'wtree wtree-' + n.dir });
    n.kids.forEach(function (k) { box.appendChild(tree(t, k, ls, model)); });
    return box;
  }
  function row(t, it, w, model, pinned) {
    var isPin = !!model.pi[it.id], point = t.wins[w].point === it.id;
    var a = mk('a', { cls: 'it' + (point ? ' is-point' : ''), href: it.href, 'data-id': it.id, tabindex: '-1' }, [glyph(it.glyph), mk('span', { cls: 'nm', text: it.name })]);
    if (pinned && !model.pass[it.id]) a.appendChild(mk('span', { cls: 'out', text: ' outside this filter' }));
    var pb = mk('button', { type: 'button', cls: 'pin-i', tabindex: '-1', 'data-pin': it.id, 'aria-pressed': isPin ? 'true' : 'false',
      'aria-label': (isPin ? 'Unpin ' : 'Pin ') + it.name, text: isPin ? 'unpin' : 'pin' });
    return mk('li', { cls: 'row' }, [a, pb]);
  }
  function secHead(t, sid, w, model, inPins) {
    var its = ix.items.filter(function (it) { return it.section === sid; });
    var n = its.filter(function (it) { return model.pass[it.id]; }).length;
    var folded = t.wins[w].fold.indexOf(sid) >= 0, pinned = !!model.pg[sid];
    return mk('h3', { cls: 'sec-h' }, [
      mk('button', { type: 'button', cls: 'fold', 'data-fold': sid, 'aria-expanded': folded ? 'false' : 'true', title: (folded ? 'Unfold ' : 'Fold ') + SEC_LABEL[sid] }, [glyph((ix.facets.show.filter(function (s) { return s.id === sid; })[0] || {}).glyph), SEC_LABEL[sid]]),
      mk('span', { cls: 'count', text: ' ' + n + ' of ' + its.length }),
      mk('button', { type: 'button', cls: 'pin-g', tabindex: inPins ? null : null, 'data-pin-g': sid, 'aria-pressed': pinned ? 'true' : 'false',
        'aria-label': (pinned ? 'Unpin the section ' : 'Pin the section ') + SEC_LABEL[sid], text: pinned ? 'unpin' : 'pin' })]);
  }
  function secList(t, sid, w, model) {
    var ul = mk('ul', { cls: 'rows' });
    if (t.wins[w].fold.indexOf(sid) >= 0) return ul;
    ix.items.forEach(function (it) { if (it.section === sid && model.pass[it.id] && !model.pi[it.id]) ul.appendChild(row(t, it, w, model, false)); });
    return ul;
  }
  function win(t, w, ls, model) {
    var body = mk('div', { cls: 'win-body' });
    if (t.pins.length) {
      var pl = mk('ol', { cls: 'pinlist', 'aria-label': 'Pinned (drag, or Alt+Up and Alt+Down, to reorder)' });
      t.pins.forEach(function (p, i) {
        var li;
        if (p.k === 'i') {
          li = row(t, ITEMS[p.id], w, model, true);
        } else {
          li = mk('li', { cls: 'pin-group' }, [secHead(t, p.id, w, model, true), secList(t, p.id, w, model)]);
        }
        if (i > 0) {
          var nm = p.k === 'i' ? ITEMS[p.id].name : SEC_LABEL[p.id];
          var up = mk('button', { type: 'button', cls: 'pin-up', tabindex: '-1', 'data-up': String(i), 'aria-label': 'Move ' + nm + ' up', title: 'Move up (or drag, or Alt+Up)', text: '\u2191' });
          if (p.k === 'i') li.insertBefore(up, li.lastChild); else li.querySelector('.sec-h').appendChild(up);
        }
        li.classList.add('pin-entry');
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-pi', String(i));
        pl.appendChild(li);
      });
      body.appendChild(mk('div', { cls: 'pinned' }, [mk('p', { cls: 'pinned-h', text: 'Pinned' }), pl]));
    }
    SECS.forEach(function (sid) {
      if (model.pg[sid] || !secShown(t, sid)) return;
      // a section the filter has emptied is not shown (a pinned section stays, in the pinned area)
      if (!ix.items.some(function (it) { return it.section === sid && model.pass[it.id]; })) return;
      body.appendChild(mk('section', { cls: 'sec' }, [secHead(t, sid, w, model, false), secList(t, sid, w, model)]));
    });
    var first = body.querySelector('a.it.is-point') || body.querySelector('a.it');
    if (first) first.setAttribute('tabindex', '0');
    var n = ls.indexOf(w) + 1;
    var ml = mk('div', { cls: 'ml', 'data-ml': w }, [
      mk('span', { cls: 'ml-buf' }), mk('span', { cls: 'ml-count' }),
      mk('button', { type: 'button', cls: 'ml-light', 'data-light': w, hidden: !t.base.length }),
      mk('span', { cls: 'ml-item' })]);
    var box = mk('div', { cls: 'win' + (w === t.sel ? ' selected' : ''), 'data-win': w, role: 'region', 'aria-label': 'Window ' + n + ' of ' + ls.length + ': ' + t.name }, [body, ml]);
    box._model = model;
    body.addEventListener('scroll', function () { t.wins[w].scroll = body.scrollTop; }, { passive: true });
    return box;
  }
  function labels(it, f) { return it.facets[f].map(function (v) { return LABEL[f + ':' + v]; }); }
  function modeline(w) {
    var t = tab(), box = els.wins.querySelector('.win[data-win="' + w + '"]');
    if (!box) return;
    var ml = box.querySelector('.ml'), model = box._model, ls = leaves(t.tree), baked = t.base.length > 0;
    ml.querySelector('.ml-buf').textContent = t.name;
    var light = ml.querySelector('.ml-light');
    light.classList.toggle('lit', baked);
    light.hidden = !baked;
    light.textContent = baked ? 'kept filter: ' + describe(t.base, true) : '';
    light.setAttribute('aria-label', baked ? 'This buffer keeps a filter: ' + describe(t.base, true) + '. Point at it or focus it to read it in words.' : '');
    var live = t.live.show.length ? t.live.show : t.base.reduce(function (a, c) { return a.concat(c.show); }, []);
    var per = live.filter(function (s, i) { return live.indexOf(s) === i; }).map(function (sid) {
      var its = ix.items.filter(function (it) { return it.section === sid; });
      return SEC_LABEL[sid] + ' ' + its.filter(function (it) { return model.pass[it.id]; }).length + ' of ' + its.length;
    });
    ml.querySelector('.ml-count').textContent = model.shown + ' of ' + ix.items.length + ' shown' + (per.length ? ' (' + per.join(', ') + ')' : '') +
      (ls.length > 1 ? ' · window ' + (ls.indexOf(w) + 1) + ' of ' + ls.length : '') + (t.pins.length ? ' · ' + t.pins.length + ' pinned' : '');
    var id = hover[w] || t.wins[w].point, it = id && ITEMS[id];
    var seg = ml.querySelector('.ml-item');
    if (!hover[w] && drawSel) {   // what is selected in the drawing, as the app says it: its tooltip
      seg.textContent = 'Selected in the drawing: ' + drawSel.name + (drawSel.tooltip ? ': ' + drawSel.tooltip : '') + ' · ' + drawSel.kind +
        ' · page ' + drawSel.page + (drawSel.count > 1 ? ' · and ' + (drawSel.count - 1) + ' more' : '');
      return;
    }
    seg.textContent = it ? it.name + ': ' + it.tip + ' · ' + [SEC_LABEL[it.section]].concat(labels(it, 'notation'), labels(it, 'pillar'), labels(it, 'says')).join(' · ') +
      (model.pi[it.id] ? ' · pinned' : '') : '';
  }
  function reasons(it) {
    var r = [];
    FACETS.forEach(function (f) { it.facets[f].forEach(function (v) { r.push(LABEL[f + ':' + v] + ', because ' + it.why[f + ':' + v]); }); });
    return it.name + ' (' + SEC_LABEL[it.section] + '): ' + (r.length ? r.join('; ') + '.' : 'in no other category.');
  }
  function summary() {
    var t = tab(), m = compute(t), list = ctxs(t).filter(function (c) { return !ctxEmpty(c); });
    var s = m.shown + ' of ' + ix.items.length + ' shown' + (list.length ? ' for ' + describe(list) : '') + '.';
    var miss = qwords(t.live.q).filter(function (w) { return !ix.items.some(function (it) { return saysWord(it, w); }); });
    if (miss.length && T) {
      miss.forEach(function (w) {
        var best = null, bs = 0;
        VOCAB.forEach(function (v) { var x = T.similarity(w, v); if (x < 0.8 && x > bs) { bs = x; best = v; } });
        s += ' Nothing says “' + w + '”' + (best && bs >= 0.5 ? '; did you mean “' + best + '”?' : '.');
      });
    } else if (miss.length) s += ' Nothing says “' + miss.join('”, “') + '”.';
    say(s);
  }

  // ---- focus ---------------------------------------------------------------------------------------
  function focusKey() {
    var a = doc.activeElement;
    if (!a || !host.contains(a)) return null;
    var w = a.closest('.win');
    return { win: w && w.getAttribute('data-win'), sel: ['data-id', 'data-pin', 'data-fold', 'data-pin-g', 'data-cmd', 'data-facet', 'data-tab', 'data-light', 'id']
      .filter(function (k) { return a.hasAttribute(k); }).map(function (k) { return '[' + k + '="' + a.getAttribute(k) + '"]' + (k === 'data-facet' ? '[data-val="' + a.getAttribute('data-val') + '"]' : ''); })[0], pinned: !!a.closest('.pinlist') };
  }
  function restoreFocus(k) {
    if (!k || !k.sel) return;
    var scope = k.win ? els.wins.querySelector('.win[data-win="' + k.win + '"]') : host;
    var n = scope && ((k.pinned && scope.querySelector('.pinlist ' + k.sel)) || scope.querySelector(k.sel));
    if (!n && k.sel.indexOf('data-tab') >= 0) n = els.tabs.querySelector('[aria-selected="true"]');
    if (n) n.focus({ preventScroll: true });
  }
  function focusWin(w) {
    var n = els.wins.querySelector('.win[data-win="' + w + '"] a.it[tabindex="0"]') || els.wins.querySelector('.win[data-win="' + w + '"] button');
    if (n) n.focus();
  }

  // ---- TopoForge: open a page, and follow the page in view ----------------------------------------
  function tf() { try { var w = frame && frame.contentWindow; return w && w.TopoForge && w.TopoForge.doc ? w : null; } catch (e) { return null; } }
  function openItem(it) {
    var w = tf(), d = w && w.TopoForge.doc;
    if (!d) { window.location.href = it.href; return; }
    if (d.name !== frame.getAttribute('data-doc')) {
      say('The drawing open is your own, kept in this browser, so ' + it.name + '’s page is not opened over it. "Open the shop’s drawings", at the top of the legend, opens the shop’s.');
      return;
    }
    if (w.TopoForge.showPage(it.page)) say('Showing ' + it.page + ' in the drawing.');
    else say('The drawing in front of you has no page named “' + it.page + '”.');
  }
  // The app tells this page what is selected and which page is in view (topology forge 1.8, its
  // "select" and "ready" switches, asked for in the frame's address): only messages from the frame,
  // of this site's own origin. The selection fills each window's item line when nothing is pointed at.
  var lastPage = null, drawSel = null, seenPage = null;
  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!frame || ev.origin !== window.location.origin || ev.source !== frame.contentWindow || !m || !m.detail) return;
    if (m.type !== 'topoforge:select' && m.type !== 'topoforge:ready') return;
    if (m.type === 'topoforge:select') drawSel = m.detail.count ? m.detail : null;
    seenPage = m.detail.page;
    if (ix) { watch(m.detail.page); leaves(tab().tree).forEach(function (w) { modeline(w); }); }
  });
  function watch(name) {
    if (name && name !== lastPage) {
      lastPage = name;
      var t = tab(), hit = ix.items.filter(function (it) { return it.page === name && it.section !== 'hosts' && it.section !== 'people' && it.section !== 'paths'; })[0];
      if (hit) {
        t.wins[t.sel].point = hit.id;
        var box = els.wins.querySelector('.win[data-win="' + t.sel + '"]');
        if (box) { Array.prototype.forEach.call(box.querySelectorAll('a.it'), function (a) { a.classList.toggle('is-point', a.getAttribute('data-id') === hit.id); }); }
        modeline(t.sel);
      }
    }
  }

  // ---- events --------------------------------------------------------------------------------------
  function winOf(n) { var w = n.closest && n.closest('.win'); return w ? +w.getAttribute('data-win') : null; }
  function wire() {
    host.addEventListener('click', function (ev) {
      var n = ev.target, t = tab(), w = winOf(n), c;
      if (w && w !== t.sel) { t.sel = w; Array.prototype.forEach.call(els.wins.querySelectorAll('.win'), function (b) { b.classList.toggle('selected', +b.getAttribute('data-win') === w); }); }
      if ((c = n.closest('[data-cmd]'))) {
        var cmd = c.getAttribute('data-cmd');
        if (openMenu) menuShow(null);
        if (COMMANDS[cmd]) COMMANDS[cmd]();
        return;
      }
      if ((c = n.closest('[data-menu]'))) { menuShow(c.getAttribute('data-menu')); return; }
      if ((c = n.closest('[data-tfold]'))) { var tf_ = c.getAttribute('data-tfold'), tl = t.tfold || (t.tfold = ['says']), q_ = tl.indexOf(tf_); if (q_ >= 0) tl.splice(q_, 1); else tl.push(tf_); commit(); return; }
      if ((c = n.closest('[data-tabx]'))) { closeTab(+c.getAttribute('data-tabx')); return; }
      if ((c = n.closest('[data-tab]'))) { state.cur = +c.getAttribute('data-tab'); commit(); return; }
      if ((c = n.closest('.tb'))) {
        var f = c.getAttribute('data-facet'), v = c.getAttribute('data-val');
        if (c.classList.contains('baked')) { say('That is part of this buffer’s pinned context. Clear mode (C-c k) to change it.'); return; }
        var arr = f === 'show' ? t.live.show : t.live.f[f], i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        commit(); summary(); return;
      }
      if ((c = n.closest('[data-up]'))) { var u = +c.getAttribute('data-up'); movePin(u, u - 1); return; }
      if ((c = n.closest('[data-pin]'))) { togglePin('i', c.getAttribute('data-pin')); return; }
      if ((c = n.closest('[data-pin-g]'))) { togglePin('g', c.getAttribute('data-pin-g')); return; }
      if ((c = n.closest('[data-fold]'))) {
        var sid = c.getAttribute('data-fold'), fl = t.wins[w].fold, j = fl.indexOf(sid);
        if (j >= 0) fl.splice(j, 1); else fl.push(sid);
        commit(); return;
      }
      if (n.closest('#nav-pinbuf')) { pinToBuffer(); return; }
      if ((c = n.closest('a.it'))) {
        var it = ITEMS[c.getAttribute('data-id')];
        t.wins[w].point = it.id; save();
        if (it.page) { ev.preventDefault(); openItem(it); }
      }
    });
    host.addEventListener('mouseover', function (ev) {
      var a = ev.target.closest('a.it'), w = winOf(ev.target);
      if (ev.target.closest('.ml-light')) { lightSay(); return; }
      if (!w) return;
      var id = a ? a.getAttribute('data-id') : null;
      if (hover[w] !== id) { hover[w] = id; modeline(w); }
    });
    host.addEventListener('mouseleave', function () { Object.keys(hover).forEach(function (w) { hover[w] = null; modeline(+w); }); });
    host.addEventListener('focusin', function (ev) {
      var a = ev.target.closest('a.it'), w = winOf(ev.target);
      if (ev.target.closest('.ml-light')) { lightSay(); return; }
      if (a && w) { tab().wins[w].point = a.getAttribute('data-id'); hover[w] = null; modeline(w); say(reasons(ITEMS[a.getAttribute('data-id')])); }
    });
    els.q.addEventListener('input', function () { tab().live.q = els.q.value; renderWins(); renderTitle(); save(); summary(); });
    els.q.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); pinToBuffer(); return; }
      if (ev.key === 'Escape' || (ev.ctrlKey && (ev.key === 'g' || ev.key === 'G'))) {
        ev.preventDefault();
        if (els.q.value) { els.q.value = ''; tab().live.q = ''; renderWins(); save(); summary(); } else say('Quit');
      }
    });
    host.addEventListener('keydown', keys);
    // drag to reorder the pins
    var dragFrom = -1;
    host.addEventListener('dragstart', function (ev) {
      var li = ev.target.closest && ev.target.closest('.pin-entry');
      if (!li) return;
      dragFrom = +li.getAttribute('data-pi');
      try { ev.dataTransfer.setData('text/plain', String(dragFrom)); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* old browser */ }
    });
    host.addEventListener('dragover', function (ev) { if (dragFrom >= 0 && ev.target.closest('.pin-entry')) ev.preventDefault(); });
    host.addEventListener('drop', function (ev) {
      var li = ev.target.closest('.pin-entry');
      if (!li || dragFrom < 0) return;
      ev.preventDefault();
      var to = +li.getAttribute('data-pi'), from = dragFrom;
      dragFrom = -1;
      movePin(from, to);
    });
    host.addEventListener('dragend', function () { dragFrom = -1; });
  }
  function lightSay() {
    var t = tab();
    say(t.base.length ? 'Kept filter: ' + describe(t.base) + '.' : 'This buffer keeps no filter. [Pin as buffer] makes one that does.');
  }

  function keys(ev) {
    var tgt = ev.target, inField = tgt.matches && tgt.matches('input, textarea, select');
    if (ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'x' || ev.key === '≈' || ev.code === 'KeyX')) {
      ev.preventDefault(); ev.stopPropagation(); els.q.focus(); say('Narrow the navigator: type words. Ctrl+Enter pins the results to a new buffer.'); return;
    }
    if (prefix) {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.key === 'Shift' || ev.key === 'Control' || ev.key === 'Alt') return;
      var k = ev.key, p = prefix; prefix = null;
      if (k === 'Escape' || (ev.ctrlKey && (k === 'g' || k === 'G'))) { say('Quit'); return; }
      var done = { 'C-x': { '2': function () { split('v'); }, '3': function () { split('h'); }, '0': deleteWin, '1': oneWin, 'o': otherWin,
                            '{': function () { if (fl) fl.set({ w: fl.state.w - 16 }); }, '}': function () { if (fl) fl.set({ w: fl.state.w + 16 }); },
                            't': function () { prefix = 'C-x t'; say('C-x t-'); } },
                   'C-x t': { '2': newBuffer, '0': function () { closeTab(); }, 'o': nextTab },
                   'C-c': { 'p': pinPoint, 'm': setMode, 'k': clearMode } }[p];
      var fn = done[k] || done[k.toLowerCase && k.toLowerCase()];
      if (fn) fn(); else say(p + ' ' + k + ' is undefined');
      return;
    }
    if (openMenu && (ev.key === 'Escape' || (ev.ctrlKey && ev.key === 'g'))) { ev.preventDefault(); var mb = els.menu.querySelector('[data-menu="' + openMenu + '"]'); menuShow(null); if (mb) mb.focus(); return; }
    if (inField) return;
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && (ev.key === 'x' || ev.key === 'X')) { ev.preventDefault(); prefix = 'C-x'; say('C-x-'); return; }
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey && (ev.key === 'c' || ev.key === 'C') && !String(window.getSelection && window.getSelection())) { ev.preventDefault(); prefix = 'C-c'; say('C-c-'); return; }
    var a = tgt.closest && tgt.closest('a.it');
    if (!a) return;
    var box = a.closest('.win'), all = Array.prototype.slice.call(box.querySelectorAll('a.it')), i = all.indexOf(a);
    if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      var li = a.closest('.pin-entry');
      if (!li) { say('Only a pinned item moves with Alt+Up and Alt+Down.'); return; }
      ev.preventDefault();
      var from = +li.getAttribute('data-pi');
      movePin(from, from + (ev.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    var j = ev.key === 'ArrowDown' ? i + 1 : ev.key === 'ArrowUp' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? all.length - 1 : null;
    if (j === null) return;
    ev.preventDefault();
    j = Math.max(0, Math.min(all.length - 1, j));
    all.forEach(function (x) { x.setAttribute('tabindex', '-1'); });
    all[j].setAttribute('tabindex', '0'); all[j].focus();
  }
  function pinPoint() {
    var t = tab(), id = t.wins[t.sel].point;
    if (!id || !ITEMS[id]) { say('No item at point: move to one first.'); return; }
    togglePin('i', id);
  }

  // ---- start ---------------------------------------------------------------------------------------
  function start(data) {
    ix = data;
    ix.items.forEach(function (it) { ITEMS[it.id] = it; it.words.forEach(function (w) { VOCAB.push(w); }); });
    VOCAB = VOCAB.filter(function (w, i) { return VOCAB.indexOf(w) === i; });
    ix.facets.show.forEach(function (s) { SECS.push(s.id); SEC_LABEL[s.id] = s.label; });
    FACETS.forEach(function (f) { ix.facets[f].forEach(function (v) { LABEL[f + ':' + v.id] = v.label; }); });
    (ix.stop || []).forEach(function (w) { STOP[w] = 1; });
    state = sane(load()) || { cur: 0, tabs: [newTab('*all*')] };
    build();
    if (window.CCFloat && window.CCFloat.available) {
      fl = window.CCFloat.make({
        name: 'nav', label: 'The navigator', el: host, grip: els.grip, edge: els.handle, docks: true, width: 320, hiddenNarrow: true,
        say: say,
        // starting on the left, over the canvas beside TopoForge's shapes; down to the legend's top
        place: function (edges, W, H) {
          var lg = window.CCFloat.get('legend'), y = 54, bottom = H - 8;
          if (lg && !lg.isHidden() && lg.state.y !== null) bottom = lg.state.y - 12;
          return { x: Math.max(8, Math.min(edges.left, W - 340)), y: y, h: Math.max(240, bottom - y) };
        },
        onApply: function () { if (els.dockL) renderTitle(); }
      });
    }
    wire(); render();
    if (seenPage) watch(seenPage);   // the app may have spoken before the index arrived
    say(T ? 'The navigator: press categories, or type words after Narrow (Alt+x). Help, Keys lists the rest.'
          : 'The navigator: press categories or type words (words match whole, plural or by their start; about-corwin’s matching was not staged).');
    host.setAttribute('data-ready', 'yes');
  }
  window.fetch('nav/index.json', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(start, function () { host.setAttribute('data-ready', 'no-index'); });
})();
// @license-end
