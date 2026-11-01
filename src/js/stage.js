// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// stage.js: opens TopoForge on the home page, and does nothing else. It reads one thing this
// browser keeps, TopoForge's own working copy (the key TopoForge writes, topoforge.autosave.v1),
// only to ask whether there is one; it never reads what is in it, writes nothing, and asks the
// network for nothing.
//   - No working copy yet: TopoForge opens on the shop's drawings, by TopoForge's own ?load=.
//   - A working copy: TopoForge opens on it, as TopoForge always does. Your drawing is never
//     replaced unless you press "Start again from the shop's drawings".
//   - index.html?drawing=<project>: once TopoForge is up, the page for that project is chosen by
//     pressing TopoForge's own page tab, if the drawing in front of you is the shop's.
(function () {
  'use strict';
  var f = document.getElementById('topology');
  if (!f) return;
  var msg = document.getElementById('stage-msg'), fresh = document.getElementById('stage-fresh');
  var say = function (t) { if (msg) msg.textContent = t; };
  var pages = {};
  try { pages = JSON.parse(f.getAttribute('data-pages') || '{}'); } catch (e) { /* no page choice, still a drawing */ }
  var ours = f.getAttribute('data-doc');
  var want = null;
  try { want = new URLSearchParams(location.search).get('drawing'); } catch (e) { /* old browser: no choice */ }
  var kept = false;
  try { kept = window.localStorage.getItem('topoforge.autosave.v1') !== null; } catch (e) { /* storage off: TopoForge keeps nothing either */ }

  function choose(tries, loading) {
    if (!want) return;
    var name = pages[want];
    if (!name) { say('There is no page in the drawing for "' + want + '".'); return; }
    var w = f.contentWindow, d = f.contentDocument, doc = w && w.TopoForge && w.TopoForge.doc;
    if (!doc || (loading && doc.name !== ours)) {
      if (tries < 60) setTimeout(function () { choose(tries + 1, loading); }, 100);
      else say('The drawing did not open in time; the page for ' + want + ' was not chosen.');
      return;
    }
    if (doc.name !== ours) {
      say('This is your own working copy, so the page for ' + want + ' is not opened over it. "Start again from the shop\'s drawings" opens it.');
      return;
    }
    var i = doc.pages.findIndex(function (p) { return p.name === name; });
    var tab = i >= 0 && d && d.querySelector('#pagetabs .ptab[data-pi="' + i + '"]');
    if (tab) { tab.click(); say('Showing the page for ' + want + '.'); }
    else say('Your copy of the drawing has no page named "' + name + '" now.');
  }

  // After the shop's drawings open, fit them to the window with TopoForge's own fitView, once.
  function fit(tries) {
    var w = f.contentWindow, doc = w && w.TopoForge && w.TopoForge.doc;
    if (doc && doc.name === ours && w.TopoForge.fitView) { if (!want) w.TopoForge.fitView(); return; }
    if (tries < 60) setTimeout(function () { fit(tries + 1); }, 100);
  }
  function open(first) {
    f.addEventListener('load', function once() { f.removeEventListener('load', once); if (first) fit(0); choose(0, first); });
    f.src = f.getAttribute(first ? 'data-first' : 'data-resume');
  }
  open(!kept);
  if (kept) say('Showing your working copy from your last visit.');
  if (fresh) fresh.addEventListener('click', function () {
    say('Opening the shop\'s drawings in place of the working copy in this browser.');
    open(true);
  });
})();
// @license-end
