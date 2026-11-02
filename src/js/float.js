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
  var doc = document, KEY = 'corwin.cloud.float.v1', STEP = 16, BIG = 64, MINW = 220;
  var area = doc.getElementById('stage-grid'), frame = doc.getElementById('topology');
  var narrowQ = window.matchMedia ? window.matchMedia('(max-width: 47.5rem)') : { matches: false, addListener: function () {} };
  var all = {}, list = [];

  function loadAll() { try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveAll() {
    var o = {};
    list.forEach(function (f) { o[f.name] = f.state; });
    try { window.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* refused: kept for this visit only */ }
  }
  // Where the app's own panels are (topology forge 1.8: TopoForge.panels(), read-only, in the frame's
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
        if (s.h) f.el.style.setProperty('--fh', Math.max(200, Math.min(room, s.h)) + 'px'); else f.el.style.removeProperty('--fh');
      }
      f.el.style.setProperty('--fw', s.w + 'px');
      if (o.edge) { o.edge.setAttribute('aria-valuenow', String(s.w)); o.edge.setAttribute('aria-valuemin', String(MINW)); o.edge.setAttribute('aria-valuemax', String(f.maxW())); }
      if (o.onApply) o.onApply(f);
    };
    f.set = function (patch, quiet) {
      Object.keys(patch).forEach(function (k) { f.state[k] = patch[k]; });
      if ('x' in patch || 'y' in patch) f.auto = false;
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
    f.retarget = function () { if (f.auto && !f.narrow()) { f.state.x = f.state.y = null; f.apply(); } };

    // the grip: drag, or arrow keys
    var drag = null;
    f.grip.addEventListener('pointerdown', function (ev) {
      if (f.narrow() || ev.button > 0 || (ev.target.closest && ev.target.closest('button:not(.fl-grip)'))) return;
      if (f.state.mode !== 'float') return;
      f.clamp();
      drag = { x: ev.clientX, y: ev.clientY, sx: f.state.x, sy: f.state.y, moved: false };
      try { f.grip.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    });
    f.grip.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true; ev.preventDefault();
      f.state.x = drag.sx + dx; f.state.y = drag.sy + dy; f.auto = false; f.apply();
    });
    f.grip.addEventListener('pointerup', function () {
      if (!drag) return;
      var moved = drag.moved; drag = null;
      if (moved) { f.grabbed = true; saveAll(); if (o.say) o.say(f.describe()); }
    });
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
  window.CCFloat = { make: make, relayout: relayout, available: !!area, get: function (n) { return list.filter(function (f) { return f.name === n; })[0] || null; } };

  // ---- the legend ----------------------------------------------------------------------------------
  var lg = doc.getElementById('legend');
  if (!lg || !area) return;
  var grip = doc.createElement('div');
  grip.className = 'lg-bar';
  var handle = doc.createElement('button');
  handle.type = 'button'; handle.className = 'fl-grip lg-grip';
  handle.setAttribute('aria-label', 'Move the legend: drag, or use the arrow keys');
  handle.textContent = '⠿ Legend';
  var hide = doc.createElement('button');
  hide.type = 'button'; hide.className = 'fl-btn lg-hide'; hide.setAttribute('aria-expanded', 'true');
  hide.setAttribute('aria-controls', 'legend');
  grip.appendChild(handle); grip.appendChild(hide);
  lg.insertBefore(grip, lg.firstChild);
  var msg = doc.getElementById('stage-msg');
  var L = make({
    name: 'legend', label: 'The legend', el: lg, grip: handle, docks: false, width: 460, hiddenNarrow: false,
    say: function (t) { if (msg) msg.textContent = t; },
    // along the bottom of the canvas, between TopoForge's shape palette and its inspector
    place: function (edges, W, H, el) {
      var w = Math.round(Math.max(MINW, Math.min(900, edges.right - edges.left, W - 24)));
      el.style.setProperty('--fw', w + 'px');
      return { x: Math.max(12, Math.min(edges.left, W - w - 12)), y: Math.max(12, H - (el.offsetHeight || 170) - 40), w: w };
    },
    onApply: function (f) {
      var h = f.isHidden();
      hide.textContent = h ? 'show' : 'hide';
      hide.setAttribute('aria-expanded', h ? 'false' : 'true');
      hide.setAttribute('aria-label', h ? 'Show the whole legend' : 'Hide the legend to one line');
    }
  });
  hide.addEventListener('click', function () { L.toggle(); });
  // focus going into the drawing hides the legend to its one line (not kept: the next visit is as you left it)
  window.addEventListener('blur', function () {
    setTimeout(function () {
      if (doc.activeElement === frame && !L.narrow() && !L.isHidden()) { L.temp = true; L.apply(); }
    }, 0);
  });
  lg.setAttribute('data-ready', 'yes');
})();
// @license-end
