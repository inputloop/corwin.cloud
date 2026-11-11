// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// float.js: movable palettes over the drawing (docs/NAV.md, revision 2). Without this file the
// navigator is a list beside the drawing and the legend a block under it. With it, on a screen wider
// than 47.5rem:
//   - window.CCFloat.make(...) floats an element over the stage: drag its grip, or focus the grip and
//     use the arrow keys (Shift for bigger steps), or call move() from a menu (one pointer, no drag);
//     a palette that may dock can sit as a column on the left or the right instead; any of them can
//     hide to a strip and come back;
//   - the legend (#legend) is made one of them here, and hides to its one-line credit by itself when
//     focus goes into the drawing, so it never covers what has focus there.
// Places are kept in this browser only (corwin.cloud.float.v1), read and written in try/catch; with
// storage refused each palette starts in its default place. It asks the network for nothing. It asks
// the app only where its panels are, by its own read-only TopoForge.panels(); it changes nothing there.
(function () {
  'use strict';
  var doc = document, KEY = 'corwin.cloud.float.v1', STEP = 16, BIG = 64, MINW = 220, MINH = 200, GUTTER = 8;   // the frames' first gutter (free.js places them on it)
  var area = doc.getElementById('stage-grid'), frame = doc.getElementById('topology');
  var narrowQ = window.matchMedia ? window.matchMedia('(max-width: 47.5rem)') : { matches: false, addListener: function () {} };
  var all = {}, list = [];

  function loadAll() { try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveAll() {
    var o = {};
    list.forEach(function (f) { o[f.name] = f.state; });
    try { window.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* refused: kept for this visit only */ }
  }
  // Where the app's own panels are (draw 1.8: TopoForge.panels(), read-only, in the frame's
  // pixels, which are the stage's): the shape palette's right edge, and the left edge of whichever of its
  // floating Properties and its overview box comes first. Falls back to its 1.7 widths before it is up.
  function tfEdges() {
    var left = 212, right = null;
    try {
      var tf = frame && frame.contentWindow && frame.contentWindow.TopoForge, p = tf && tf.panels && tf.panels();
      if (p) {
        left = p.shapes && p.shapes.shown && p.shapes.w > 0 ? p.shapes.x + p.shapes.w + 12 : 12;
        [p.props, p.map].forEach(function (b) { if (b && b.shown && b.w > 0 && (right === null || b.x - 12 < right)) right = b.x - 12; });
      }
    } catch (e) { /* not loaded yet: the fallbacks */ }
    return { left: left, right: right === null ? (area ? area.clientWidth - 282 : 900) : right };
  }

  function make(o) {
    var f = { name: o.name, el: o.el, grip: o.grip, docks: !!o.docks, state: null, temp: false };
    var saved = all[o.name];
    f.state = {
      mode: saved && /^(float|left|right)$/.test(saved.mode) ? saved.mode : 'float',
      x: saved && isFinite(saved.x) ? saved.x : null, y: saved && isFinite(saved.y) ? saved.y : null,
      w: saved && isFinite(saved.w) ? saved.w : (o.width || 320),
      h: saved && isFinite(saved.h) ? saved.h : null,
      hidden: saved ? !!saved.hidden : !!o.hidden,
      hiddenNarrow: saved && 'hiddenNarrow' in saved ? !!saved.hiddenNarrow : o.hiddenNarrow !== false
    };
    if (!f.docks) f.state.mode = 'float';
    f.narrow = function () { return !!narrowQ.matches; };
    f.isHidden = function () { return f.narrow() ? f.state.hiddenNarrow : (f.state.hidden || f.temp); };
    f.maxW = function () { return Math.max(MINW + 40, Math.min(900, Math.round((area.clientWidth || window.innerWidth) * 0.6))); };
    f.clamp = function () {
      var s = f.state, W = area.clientWidth, H = area.clientHeight, ew = f.el.offsetWidth || s.w, eh = f.el.offsetHeight || 40;
      s.w = Math.round(Math.max(MINW, Math.min(f.maxW(), s.w)));
      if (s.x === null || s.y === null) {
        var d = o.place(tfEdges(), W, H, f.el);
        s.x = d.x; s.y = d.y; if (d.w) s.w = d.w; s.h = d.h || null; f.auto = true;
        f.el.style.setProperty('--fw', s.w + 'px');
      }
      s.x = Math.round(Math.max(0, Math.min(W - Math.min(ew, 120), s.x)));
      s.y = Math.round(Math.max(0, Math.min(H - Math.min(eh, 32), s.y)));
      // o.avoid: a box (the layout switch, revision 6) no palette's top row may sit under; it is put below
      var r = o.avoid && o.avoid();
      if (r && s.x < r.x + r.w && s.x + ew > r.x && s.y < r.y + r.h && s.y + 40 > r.y) s.y = Math.round(r.y + r.h + 6);
    };
    f.apply = function () {
      var s = f.state, nar = f.narrow(), hid = f.isHidden();
      f.el.classList.add('fl');
      f.el.classList.toggle('fl-static', nar);
      ['float', 'left', 'right'].forEach(function (m) { f.el.classList.toggle('fl-' + m, !nar && s.mode === m); });
      f.el.classList.toggle('fl-hidden', hid);
      if (f.docks) {
        area.classList.toggle('dock-left', !nar && s.mode === 'left');
        area.classList.toggle('dock-right', !nar && s.mode === 'right');
        area.classList.toggle('dock-hidden', !nar && s.mode !== 'float' && hid);
        area.style.setProperty('--dock-w', s.w + 'px');
      }
      if (!nar && s.mode === 'float') {
        f.clamp();
        f.el.style.setProperty('--fx', s.x + 'px');
        f.el.style.setProperty('--fy', s.y + 'px');
        var room = area.clientHeight - s.y - 8;
        if (s.h) f.el.style.setProperty('--fh', Math.max(MINH, Math.min(room, s.h)) + 'px'); else f.el.style.removeProperty('--fh');
      }
      f.el.style.setProperty('--fw', s.w + 'px');
      if (o.edge) { o.edge.setAttribute('aria-valuenow', String(s.w)); o.edge.setAttribute('aria-valuemin', String(MINW)); o.edge.setAttribute('aria-valuemax', String(f.maxW())); }
      if (o.hedge) { var hh = f.height(); o.hedge.setAttribute('aria-valuenow', String(hh)); o.hedge.setAttribute('aria-valuemin', String(MINH)); o.hedge.setAttribute('aria-valuemax', String(f.maxH())); }
      if (o.onApply) o.onApply(f);
    };
    // height (revision 6): s.h, or what the frame is drawn at when it was never set
    f.maxH = function () { return Math.max(MINH, (area.clientHeight || window.innerHeight) - (f.state.y || 0) - 8); };
    f.height = function () { return Math.round(f.state.h ? Math.max(MINH, Math.min(f.maxH(), f.state.h)) : (f.el.offsetHeight || MINH)); };
    f.set = function (patch, quiet) {
      Object.keys(patch).forEach(function (k) { f.state[k] = patch[k]; });
      // moved or resized by the reader: no longer placed again by itself (revision 8: a width set by the
      // edge or C-x } survives the app's map moving, which places unmoved frames again)
      if ('x' in patch || 'y' in patch || 'w' in patch || 'h' in patch) f.auto = false;
      f.apply(); saveAll();
      if (!quiet && o.say) o.say(f.describe());
    };
    f.describe = function () {
      var s = f.state;
      if (f.narrow()) return o.label + (s.hiddenNarrow ? ' is hidden to its strip.' : ' is shown above the drawing.');
      if (f.isHidden()) return o.label + ' is hidden to a strip. "show" brings it back.';
      if (s.mode === 'left') return o.label + ' is docked on the left, ' + s.w + ' pixels wide.';
      if (s.mode === 'right') return o.label + ' is docked on the right, ' + s.w + ' pixels wide.';
      return o.label + ' floats over the drawing, ' + s.x + ' pixels from the left and ' + s.y + ' from the top.';
    };
    f.move = function (dx, dy) {
      if (f.narrow()) { if (o.say) o.say('On a narrow screen ' + o.label.toLowerCase() + ' sits above the drawing and does not move.'); return; }
      if (f.state.mode !== 'float') f.state.mode = 'float';
      f.clamp();
      f.set({ x: f.state.x + dx, y: f.state.y + dy, h: f.state.h });
    };
    f.dock = function (m) { if (!f.docks && m !== 'float') return; f.temp = false; f.set({ mode: m, hidden: false }); };
    f.toggle = function () {
      f.temp = false;
      if (f.narrow()) f.set({ hiddenNarrow: !f.state.hiddenNarrow }); else f.set({ hidden: !f.state.hidden });
    };
    f.reset = function () { f.temp = false; f.set({ mode: 'float', x: null, y: null, h: null, hidden: false }); };
    // revision 8, Reset layout: the first place and the first size (and, unless asked to keep it, shown)
    f.first = function (keepHidden) { f.temp = false; var p = { mode: 'float', x: null, y: null, h: null, w: o.width || 320 }; if (!keepHidden) p.hidden = false; f.set(p, true); };
    f.retarget = function () { if (f.auto && !f.narrow()) { f.state.x = f.state.y = null; f.apply(); } };

    // the grip: drag, or arrow keys. o.drag lists more places that drag it with a pointer only (the
    // free frame's menu bar, as a window manager's title bar: docs/NAV.md, revision 5); a press on a
    // button there is the button's, not a drag
    var drag = null;
    function bindDrag(h) {
      h.addEventListener('pointerdown', function (ev) {
        if (f.narrow() || ev.button > 0 || (ev.target.closest && ev.target.closest('button:not(.fl-grip), a, input'))) return;
        if (f.state.mode !== 'float') return;
        f.clamp();
        drag = { x: ev.clientX, y: ev.clientY, sx: f.state.x, sy: f.state.y, moved: false };
        try { h.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
      });
      h.addEventListener('pointermove', function (ev) {
        if (!drag) return;
        var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true; ev.preventDefault();
        f.state.x = drag.sx + dx; f.state.y = drag.sy + dy; f.auto = false; f.apply();
      });
      h.addEventListener('pointerup', function () {
        if (!drag) return;
        var moved = drag.moved; drag = null;
        if (moved) { f.grabbed = true; saveAll(); if (o.say) o.say(f.describe()); }
      });
    }
    [f.grip].concat(o.drag || []).forEach(bindDrag);
    f.grip.addEventListener('click', function (ev) { if (f.grabbed) { f.grabbed = false; ev.preventDefault(); ev.stopPropagation(); } }, true);
    f.grip.addEventListener('keydown', function (ev) {
      var k = ev.key, n = ev.shiftKey ? BIG : STEP;
      var d = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[k];
      if (!d) return;
      ev.preventDefault(); ev.stopPropagation();
      f.move(d[0], d[1]);
    });
    // the edge: the width, by drag or arrow keys
    if (o.edge) {
      var ed = null;
      o.edge.addEventListener('pointerdown', function (ev) {
        if (f.narrow()) return;
        ed = { x: ev.clientX, w: f.state.w, side: f.state.mode === 'right' ? -1 : 1 };
        try { o.edge.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
        ev.preventDefault();
      });
      o.edge.addEventListener('pointermove', function (ev) { if (ed) { f.state.w = ed.w + ed.side * (ev.clientX - ed.x); f.apply(); } });
      o.edge.addEventListener('pointerup', function () { if (ed) { ed = null; saveAll(); if (o.say) o.say(o.label + ': ' + f.state.w + ' pixels wide, kept in this browser.'); } });
      o.edge.addEventListener('keydown', function (ev) {
        var k = ev.key, side = f.state.mode === 'right' ? -1 : 1, w = f.state.w;
        var nw = k === 'ArrowRight' ? w + side * STEP : k === 'ArrowLeft' ? w - side * STEP : k === 'PageUp' ? w + 4 * STEP : k === 'PageDown' ? w - 4 * STEP : k === 'Home' ? MINW : k === 'End' ? f.maxW() : null;
        if (nw === null) return;
        ev.preventDefault(); ev.stopPropagation();
        f.set({ w: nw }, true);
        if (o.say) o.say(o.label + ': ' + f.state.w + ' pixels wide.');
      });
    }
    // the height edge (o.hedge) and the corner (o.corner), revision 6. The frame itself shows which mode a
    // press there will be in: data-grab="w|h|wh" while pointed at or focused, data-drag while dragging
    // (the width edge, o.edge, marks "w" the same way).
    function mark(attr, v) { if (v) f.el.setAttribute(attr, v); else f.el.removeAttribute(attr); }
    function bindResize(h, mode) {
      if (!h) return;
      var st = null;
      ['pointerenter', 'focus'].forEach(function (t) { h.addEventListener(t, function () { if (!f.narrow()) mark('data-grab', mode); }); });
      ['pointerleave', 'blur'].forEach(function (t) { h.addEventListener(t, function () { if (!st) mark('data-grab', null); }); });
      h.addEventListener('pointerdown', function (ev) {
        if (f.narrow() || ev.button > 0) return;
        st = { x: ev.clientX, y: ev.clientY, w: f.state.w, h: f.height() };
        mark('data-grab', mode); mark('data-drag', mode);
        try { h.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
        ev.preventDefault();
      });
      h.addEventListener('pointermove', function (ev) {
        if (!st) return;
        if (mode !== 'h') f.state.w = Math.max(MINW, Math.min(f.maxW(), st.w + ev.clientX - st.x));
        if (mode !== 'w') f.state.h = Math.max(MINH, Math.min(f.maxH(), st.h + ev.clientY - st.y));
        f.apply();
      });
      h.addEventListener('pointerup', function () {
        if (!st) return;
        st = null; mark('data-drag', null); saveAll();
        if (o.say) o.say(o.label + ': ' + f.state.w + ' by ' + f.height() + ' pixels, kept in this browser.');
      });
      h.addEventListener('keydown', function (ev) {
        var k = ev.key, w = f.state.w, hh = f.height(), nw = null, nh = null;
        if (mode !== 'h') nw = k === 'ArrowRight' ? w + STEP : k === 'ArrowLeft' ? w - STEP : null;
        if (mode !== 'w') nh = k === 'ArrowDown' ? hh + STEP : k === 'ArrowUp' ? hh - STEP : null;
        if (mode === 'h') nh = nh !== null ? nh : k === 'PageDown' ? hh + 4 * STEP : k === 'PageUp' ? hh - 4 * STEP : k === 'Home' ? MINH : k === 'End' ? f.maxH() : null;
        if (nw === null && nh === null) return;
        ev.preventDefault(); ev.stopPropagation();
        var p = {};
        if (nw !== null) p.w = Math.max(MINW, Math.min(f.maxW(), nw));
        if (nh !== null) p.h = Math.max(MINH, Math.min(f.maxH(), nh));
        f.set(p, true);
        if (o.say) o.say(o.label + ': ' + f.state.w + ' by ' + f.height() + ' pixels.');
      });
    }
    bindResize(o.hedge, 'h');
    bindResize(o.corner, 'wh');
    if (o.edge && o.marks) {
      ['pointerenter', 'focus'].forEach(function (t) { o.edge.addEventListener(t, function () { if (!f.narrow()) mark('data-grab', 'w'); }); });
      ['pointerleave', 'blur'].forEach(function (t) { o.edge.addEventListener(t, function () { if (!f.el.hasAttribute('data-drag')) mark('data-grab', null); }); });
      o.edge.addEventListener('pointerdown', function () { if (!f.narrow()) { mark('data-grab', 'w'); mark('data-drag', 'w'); } });
      o.edge.addEventListener('pointerup', function () { mark('data-drag', null); });
    }
    f.taller = function (d) { f.set({ h: Math.max(MINH, Math.min(f.maxH(), f.height() + d)) }, true); return f.height(); };
    list.push(f);
    f.apply();
    return f;
  }

  function relayout() { list.forEach(function (f) { f.apply(); }); }
  if (area) {
    all = loadAll();
    window.addEventListener('resize', relayout);
    if (narrowQ.addEventListener) narrowQ.addEventListener('change', relayout); else narrowQ.addListener(relayout);
    // the app's panels are where they are once it says it is ready: place what has not been moved
    if (frame) window.addEventListener('message', function (ev) {
      var m = ev.data;
      if (ev.origin !== window.location.origin || ev.source !== frame.contentWindow || !m || m.type !== 'topoforge:ready') return;
      list.forEach(function (f) { f.retarget(); });
    });
  }
  function get(n) { return list.filter(function (f) { return f.name === n; })[0] || null; }
  // free's own settings (the legend watermark off, the navigator's frame closed), one key, in try/catch
  var FKEY = 'corwin.cloud.free.v1';
  function freeState() { try { return JSON.parse(window.localStorage.getItem(FKEY) || '{}') || {}; } catch (e) { return {}; } }
  function freeKeep(k, v) { var s = freeState(); s[k] = v; try { window.localStorage.setItem(FKEY, JSON.stringify(s)); } catch (e) { /* refused: for this visit */ } }
  window.CCFloat = { make: make, relayout: relayout, available: !!area, get: get, all: function () { return list.slice(); }, freeState: freeState, freeKeep: freeKeep };

  // ---- the legend ----------------------------------------------------------------------------------
  var lg = doc.getElementById('legend');
  if (!lg || !area) return;
  // classic (docs/NAV.md, revision 4): the legend stays under the drawing as its one row; nothing floats
  var FREE = doc.documentElement.getAttribute('data-ui') !== 'classic';
  var more = lg.querySelector('.lg-more');
  if (more) more.addEventListener('click', function () {
    if (FREE && window.CCFloat.credits) { window.CCFloat.credits(); return; }
    var open = !lg.classList.contains('lg-open');
    lg.classList.toggle('lg-open', open);
    more.setAttribute('aria-expanded', String(open));
  });
  if (!FREE) { lg.setAttribute('data-ready', 'yes'); return; }
  lg.classList.add('watermark');
  var grip = doc.createElement('div');
  grip.className = 'lg-bar';
  var handle = doc.createElement('button');
  handle.type = 'button'; handle.className = 'fl-grip lg-grip';
  handle.setAttribute('aria-label', 'Move the legend: drag, or use the arrow keys');
  handle.setAttribute('title', 'Move the legend');
  handle.textContent = '\u283f';
  // free: the watermark can be turned off (Options, Legend watermark, in the frame's menus); the legal
  // notices stay on every mode-line (GPL) and in Help, Credits and licence. Kept in corwin.cloud.free.v1.
  var off = doc.createElement('button');
  off.type = 'button'; off.className = 'fl-btn lg-off'; off.textContent = 'off';
  off.setAttribute('aria-label', 'Turn the legend watermark off (Help, Credits and licence still shows it)');
  grip.appendChild(handle); grip.appendChild(off);
  lg.insertBefore(grip, lg.firstChild);
  function setOff(v, quiet) {
    freeKeep('legendOff', !!v);
    lg.hidden = !!v;
    window.CCFloat.legendOff = !!v;
    // shown again: placed again from its real width (it had none while off), so it never runs off the canvas
    var L0 = get('legend');
    if (!v && L0) { if (L0.auto) L0.retarget(); else L0.apply(); }
    if (!quiet && msg) msg.textContent = v ? 'The legend watermark is off. GPL on the mode-line, or Help, Credits and licence, shows it.' : 'The legend watermark is on.';
  }
  window.CCFloat.setLegendOff = setOff;
  off.addEventListener('click', function () { setOff(true); });
  setOff(!!freeState().legendOff, true);
  var msg = doc.getElementById('stage-msg');
  make({
    name: 'legend', label: 'The legend', el: lg, grip: handle, docks: false, width: 520, hiddenNarrow: false, hidden: false,
    say: function (t) { if (msg) msg.textContent = t; },
    // one line along the bottom of the canvas, on the frames' first lines (revision 8, "alignment to initial
    // placement"): its left edge on frame 1's first left edge, its foot on the same 8-pixel gutter. From
    // these numbers, never from where the frames are now, so moving a frame does not move it; the app's
    // overview map keeps the bottom right corner
    place: function (edges, W, H, el) {
      return { x: GUTTER, y: Math.max(GUTTER, H - (el.offsetHeight || 22) - GUTTER) };
    }
  });
  lg.setAttribute('data-ready', 'yes');
})();
// @license-end
