// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// corwin.cloud. The pages read fine without this file. It adds three things:
//   - real tabs on the home page (roving tabindex, arrow keys, Home and End, #tab-<id> in the address),
//   - the mode-line's position and section as you scroll,
//   - the prompt at the end of the page (Alt+x, as M-x in Emacs), which filters the list of everywhere.
// It reads nothing from the network and stores nothing.
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  html.classList.add('js');
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!(reduce && reduce.matches)) html.classList.add('motion-on');

  // ---- tabs ---------------------------------------------------------------------------------------
  var tabs = $$('[role="tab"]'), panels = tabs.map(function (t) { return doc.getElementById(t.getAttribute('aria-controls')); });
  function select(i, focus, push) {
    tabs.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
    if (push && window.history && history.replaceState) history.replaceState(null, '', '#' + tabs[i].id);
  }
  function fromHash() {
    var h = decodeURIComponent((location.hash || '').slice(1)), i = -1;
    tabs.forEach(function (t, j) { if (t.id === h || (t.getAttribute('aria-controls') === h)) i = j; });
    return i;
  }
  if (tabs.length) {
    var start = fromHash();
    select(start < 0 ? 0 : start, false, false);
    if (start >= 0) { var tl = $('.tabs'); if (tl && tl.scrollIntoView) tl.scrollIntoView(); }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (ev) { ev.preventDefault(); select(i, false, true); });
      t.addEventListener('keydown', function (ev) {
        var n = tabs.length, j = -1;
        if (ev.key === 'ArrowRight') j = (i + 1) % n;
        else if (ev.key === 'ArrowLeft') j = (i + n - 1) % n;
        else if (ev.key === 'Home') j = 0;
        else if (ev.key === 'End') j = n - 1;
        else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); select(i, false, true); return; }
        if (j >= 0) { ev.preventDefault(); select(j, true, true); }
      });
    });
    window.addEventListener('hashchange', function () {
      var k = fromHash();
      if (k >= 0) { select(k, false, false); var tl2 = $('.tabs'); if (tl2 && tl2.scrollIntoView) tl2.scrollIntoView(); }
    });
  }

  // ---- the mode-line ---------------------------------------------------------------------------------
  var ml = $('#modeline'), pos = ml && $('.ml-pos', ml), sec = ml && $('.ml-sec', ml);
  var names = { top: 'topology', projects: 'projects', main: 'page', minibuffer: 'prompt' };
  var ticking = false;
  function where() {
    ticking = false;
    if (!ml) return;
    var max = html.scrollHeight - window.innerHeight, y = window.scrollY;
    var atBottom = max <= 0 || y >= max - 4;
    pos.textContent = max <= 0 ? 'All' : y <= 2 ? 'Top' : atBottom ? 'Bot' : Math.round(100 * y / max) + '%';
    var name = doc.body.getAttribute('data-page') || 'page';
    var p = $('#projects');
    if (p && p.getBoundingClientRect().top < window.innerHeight * 0.4) {
      var cur = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
      name = cur ? cur.textContent : 'projects';
    }
    if (atBottom && max > 0) name = 'prompt';
    sec.textContent = '*' + name + '*';
    html.classList.toggle('at-bottom', atBottom && max > 0);
  }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(where); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  doc.addEventListener('click', function () { window.setTimeout(onScroll, 0); });
  where();

  // ---- the prompt: Alt+x, then type a page or a project ------------------------------------------------
  var input = $('#prompt'), list = $('#goto'), echo = $('#echo'), form = $('#mb-form');
  if (input && list && form) {
    var items = $$('li', list);
    var filter = function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      items.forEach(function (li) {
        var ok = !q || li.textContent.toLowerCase().indexOf(q) >= 0;
        li.hidden = !ok;
        if (ok) shown++;
      });
      list.classList.add('open');
      echo.textContent = shown ? shown + ' places. Enter goes to the first.' : '[No match]';
    };
    input.addEventListener('input', filter);
    input.addEventListener('focus', filter);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' || (ev.ctrlKey && ev.key === 'g')) {
        ev.preventDefault(); input.value = ''; list.classList.remove('open'); echo.textContent = 'Quit.'; input.blur();
      }
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var first = items.filter(function (li) { return !li.hidden; })[0];
      if (first) window.location.href = $('a', first).getAttribute('href');
    });
    doc.addEventListener('keydown', function (ev) {
      // Alt+x, as M-x. No single-key shortcuts: a stray key never moves the page.
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'x' || ev.key === '≈' || ev.code === 'KeyX')) {
        ev.preventDefault();
        input.scrollIntoView(); input.focus();
      }
    });
    var link = $('.ml-link', ml);
    if (link) link.addEventListener('click', function (ev) { ev.preventDefault(); input.scrollIntoView(); input.focus(); });
  }
})();
// @license-end
