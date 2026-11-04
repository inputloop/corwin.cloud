// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// privacy.js: the one press of privacy.html, "Forget my settings" (docs/NAV.md, revision 11; Corwin,
// 2026-11-04: "Keep it, disclose it"). It removes from this browser every name the page lists (#kept:
// data-key, data-kind "key" or "prefix", data-store "local" or "session"), the page's list and nothing
// else, and says in the echo area what it removed. It asks first only when work is kept nowhere but
// here: a drawing in topology forge's autosave that is neither the app's sample, nor empty, nor the
// shop's drawing as this site serves it (read from this site, data-drawing, only then), or a board
// drawn on topology's board. It writes nothing and asks no other host for anything.
(function () {
  'use strict';
  var doc = document, btn = doc.getElementById('forget');
  if (!btn) return;
  var said = doc.getElementById('forget-said'), echo = doc.getElementById('echo');
  var AUTOSAVE = 'topoforge.autosave.v1', BOARD = 'topology-board:', BOARD_LAST = 'topology-board:last';
  // topology forge's own sample, as it makes it (js/stage.js knows it the same way)
  var SAMPLE = { name: 'Sample office network', nodes: 19, links: 15 };

  function listed() {
    return Array.prototype.map.call(doc.querySelectorAll('#kept [data-key]'), function (li) {
      return { key: li.getAttribute('data-key'), prefix: li.getAttribute('data-kind') === 'prefix', store: li.getAttribute('data-store') === 'session' ? 'session' : 'local' };
    });
  }
  function area(store) { try { return store === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } }
  function names(st) { var out = []; try { for (var i = 0; i < st.length; i++) out.push(st.key(i)); } catch (e) { /* refused */ } return out; }
  // what this browser holds under the page's names: [{ store, name }], each once
  function held() {
    var out = [], seen = {};
    listed().forEach(function (k) {
      var st = area(k.store);
      if (!st) return;
      names(st).forEach(function (n) {
        if (!(k.prefix ? n.indexOf(k.key) === 0 : n === k.key) || seen[k.store + ' ' + n]) return;
        seen[k.store + ' ' + n] = 1;
        out.push({ store: k.store, name: n });
      });
    });
    return out;
  }
  function get(name) { var st = area('local'); try { return st ? st.getItem(name) : null; } catch (e) { return null; } }
  // a drawing's shapes and words, page by page, in a form that does not depend on order or on the app's view
  function sig(d) {
    return (d.pages || []).map(function (pg) {
      var nodes = (pg.nodes || []).map(function (n) { return [n.id, n.type, n.text, n.x, n.y, n.w, n.h, n.parent || ''].join('\u001f'); }).sort().join('\u001e');
      var links = (pg.links || []).map(function (l) { return [l.id, l.a, l.b, l.text || ''].join('\u001f'); }).sort().join('\u001e');
      return [pg.name, nodes, links].join('\u001d');
    }).join('\u001c');
  }
  // the work kept only here, in words for the question, or '' (done(words) is called once)
  function unsaved(done) {
    var boards = held().filter(function (h) { return h.store === 'local' && h.name.indexOf(BOARD) === 0 && h.name !== BOARD_LAST; }).length;
    var more = boards ? (boards === 1 ? 'a board' : boards + ' boards') + ' drawn on topology’s board' : '';
    function with_(drawing) {
      var parts = [drawing, more].filter(Boolean);
      done(parts.length ? parts.join(' and ') : '');
    }
    var raw = get(AUTOSAVE), d = null;
    if (raw === null) return with_('');
    try { d = JSON.parse(raw); } catch (e) { return with_('a drawing topology forge keeps that this page cannot read'); }
    var pages = d && Array.isArray(d.pages) ? d.pages : [];
    var shapes = pages.reduce(function (n, p) { return n + ((p && p.nodes) || []).length + ((p && p.links) || []).length; }, 0);
    if (!shapes) return with_('');
    if (d.name === SAMPLE.name && pages.length === 1 && (pages[0].nodes || []).length === SAMPLE.nodes && (pages[0].links || []).length === SAMPLE.links) return with_('');
    var mine = 'your drawing “' + String(d.name || 'untitled') + '”';
    if (d.name !== btn.getAttribute('data-doc')) return with_(mine);
    var changed = 'your changes to the shop’s drawing';
    try {
      window.fetch(btn.getAttribute('data-drawing'), { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (f) { with_(sig(f) === sig(d) ? '' : changed); }, function () { with_(changed); });
    } catch (e) { with_(changed); }
  }
  function say(t) { if (said) said.textContent = t; if (echo) echo.textContent = t; }
  function count() {
    var n = held().length;
    if (said && !said.textContent) said.textContent = n ? 'This browser keeps ' + n + (n === 1 ? ' name' : ' names') + ' from this list now.' : 'This browser keeps none of these names now.';
  }
  function forget() {
    var gone = [];
    held().forEach(function (h) {
      try { area(h.store).removeItem(h.name); gone.push(h.name); } catch (e) { /* refused: left as it was */ }
    });
    say(gone.length ? 'Forgot ' + gone.length + ' ' + (gone.length === 1 ? 'name' : 'names') + ' this site kept in this browser: ' + gone.join(', ') + '.'
      : 'Nothing to forget: this site keeps nothing in this browser.');
  }
  btn.addEventListener('click', function () {
    if (!area('local') && !area('session')) { say('This browser lets this site keep nothing, so there is nothing to forget.'); return; }
    btn.disabled = true;
    unsaved(function (work) {
      btn.disabled = false;
      if (work && !window.confirm('This browser keeps ' + work + ', and nowhere else has a copy. Forget it with the rest? (Cancel keeps everything; File, Export in the drawing app saves a drawing to a file.)')) {
        say('Nothing was forgotten: everything is still kept in this browser.');
        return;
      }
      forget();
    });
  });
  count();
})();
// @license-end
