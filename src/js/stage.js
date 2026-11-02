// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// stage.js: opens TopoForge on the home page, and does nothing else. It reads one thing this
// browser keeps, TopoForge's own working copy (the key TopoForge writes, topoforge.autosave.v1): its
// name, its page names and whether any page has a shape. It never writes it, writes nothing else,
// and asks the network for nothing. docs/NAV.md (revision 2, "The drawing loads") says why:
//   - nothing kept, an empty drawing (TopoForge's File, New), or TopoForge's own sample unchanged
//     (it plants itself when TopoForge is opened on its own): the shop's drawings open, by TopoForge's
//     own ?load=; none of these holds anything of the visitor's;
//   - the shop's drawings, kept: they open as left, with a notice if this build has pages they lack;
//   - a drawing of the visitor's own: it opens, as TopoForge always does, with a notice at the top of the
//     legend and a button that opens the shop's in its place. Nothing of theirs is replaced unasked.
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
  var notice = document.getElementById('stage-notice'), noticeT = document.getElementById('stage-notice-t');
  var noticeB = document.getElementById('stage-notice-b'), full = document.getElementById('stage-full');
  // TopoForge's own sample, as it makes it: the name, one page, and its counts of shapes and links
  var SAMPLE = { name: 'Sample office network', nodes: 19, links: 15 };
  function classify() {
    var raw = null, d;
    try { raw = window.localStorage.getItem('topoforge.autosave.v1'); } catch (e) { return 'none'; }   // storage off: TopoForge keeps nothing either
    if (raw === null) return 'none';
    try { d = JSON.parse(raw); } catch (e) { return 'own'; }   // unreadable to us; TopoForge may still read it: not ours to replace
    var pages = d && Array.isArray(d.pages) ? d.pages : [];
    var shapes = pages.reduce(function (n, p) { return n + ((p && p.nodes) || []).length + ((p && p.links) || []).length; }, 0);
    if (!shapes) return 'empty';
    if (d.name === SAMPLE.name && pages.length === 1 && (pages[0].nodes || []).length === SAMPLE.nodes && (pages[0].links || []).length === SAMPLE.links) return 'sample';
    if (d.name === ours) {
      var have = {}; pages.forEach(function (p) { have[p && p.name] = 1; });
      var lack = Object.keys(pages_wanted()).filter(function (n) { return !have[n]; });
      return lack.length ? { k: 'old', lack: lack.length } : 'shop';
    }
    return { k: 'own', name: String(d.name || 'untitled') };
  }
  function pages_wanted() { var o = {}; Object.keys(pages).forEach(function (k) { o[pages[k]] = 1; }); return o; }
  function show(text, button) {
    if (!notice) return;
    notice.hidden = !text;
    if (noticeT) noticeT.textContent = text || '';
    if (noticeB) { noticeB.textContent = button || ''; noticeB.hidden = !button; }
  }
  var kind = classify(), kept = !(kind === 'none' || kind === 'empty' || kind === 'sample');
  // "TopoForge full size" opens the shop's drawings unless a drawing worth keeping is kept here
  if (full && kept) full.setAttribute('href', f.getAttribute('data-resume'));

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
      say('This is your own drawing, kept in this browser, so the page for ' + want + ' is not opened over it. "Open the shop\'s drawings", at the top of the legend, opens it.');
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
  if (kind === 'empty') say('The drawing kept in this browser was empty, so the shop\'s drawings are open.');
  else if (kind === 'sample') say('This browser had kept TopoForge\'s own sample; the shop\'s drawings are open in its place.');
  else if (kind === 'shop') say('Showing the shop\'s drawings as you left them.');
  else if (kind.k === 'old') { say('Your copy of the shop\'s drawings is older than this site.'); show('Your copy of the shop\'s drawings is older than this site: ' + kind.lack + ' page' + (kind.lack === 1 ? ' is' : 's are') + ' missing.', 'Open the current drawings'); }
  else if (kind === 'own' || kind.k === 'own') { var nm = kind.name ? '\u201c' + kind.name + '\u201d' : 'one we cannot read'; say('This is your own drawing, kept in this browser.'); show('This is your own drawing, kept in this browser: ' + nm + '. The shop\'s drawings replace it here; File, Export keeps a copy first.', 'Open the shop\'s drawings'); }
  function fresh_() {
    show(null);
    say('Opening the shop\'s drawings in place of the drawing kept in this browser.');
    if (full) full.setAttribute('href', f.getAttribute('data-first'));
    open(true);
  }
  if (fresh) fresh.addEventListener('click', fresh_);
  if (noticeB) noticeB.addEventListener('click', fresh_);
})();
// @license-end
