// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// ui.js: the page layout setting, free (the default) or classic (docs/NAV.md, revision 4). Loaded in
// the head without defer, so <html data-ui="..."> is set before the page is drawn. The address wins
// and is kept (?ui=free or ?ui=classic); a link to a project's tab (#tab-...) opens classic for that
// visit; otherwise this browser's choice (corwin.cloud.ui.v1, read and
// written in try/catch); otherwise free. It adds one row to Customize ("Page layout") once the page is
// there; choosing the other value keeps it and reloads, because the drawing app is asked for other
// switches in each. window.CCUI.set(v) does the same for the free frame's Options menu. On the home page
// it adds the layout switch (revision 5): a light switch that never moves. It asks the network for nothing.
// The row links privacy.html#layout (revision 11), where what it keeps is named and can be forgotten.
(function () {
  'use strict';
  var KEY = 'corwin.cloud.ui.v1', VALUES = ['free', 'classic'], html = document.documentElement;
  function stored() { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }
  function keep(v) { try { window.localStorage.setItem(KEY, v); return true; } catch (e) { return false; } }
  var asked = null;
  try { asked = new URLSearchParams(window.location.search).get('ui'); } catch (e) { /* old browser: no address choice */ }
  // a link to a project's tab (index.html#tab-x, from the directory and the Go to: prompt) needs the long
  // page, which free does not show: such a visit is classic, and nothing is kept
  var DEEP = /^#(tab-|panel-|projects)/;
  var deep = DEEP.test(window.location.hash || '');
  var ui = VALUES.indexOf(asked) >= 0 ? asked : deep ? 'classic' : VALUES.indexOf(stored()) >= 0 ? stored() : 'free';
  if (asked === ui) keep(ui);
  html.setAttribute('data-ui', ui);

  function set(v) {
    if (VALUES.indexOf(v) < 0) return false;
    keep(v);
    var u = new URL(window.location.href);
    // the address must not overrule the choice just made
    if (u.searchParams.has('ui')) u.searchParams.set('ui', v);
    u.hash = '';   // a fragment-only change would not reload
    if (v === ui && !u.searchParams.has('ui')) return true;
    window.location.replace(u.toString());
    return true;
  }
  window.CCUI = { get: function () { return ui; }, set: set, values: VALUES.slice(), deep: deep };
  window.addEventListener('hashchange', function () { if (ui === 'free' && DEEP.test(window.location.hash || '')) window.location.reload(); });

  // the Customize row, after Customize's own settings (its markup is about-corwin's, staged unchanged)
  function row() {
    var panel = document.getElementById('custom-panel');
    if (!panel || document.getElementById('c-ui')) return;
    var fs = document.createElement('fieldset');
    fs.id = 'c-ui';
    var lg = document.createElement('legend');
    lg.textContent = 'Page layout (the home page):';
    fs.appendChild(lg);
    VALUES.forEach(function (v) {
      var lb = document.createElement('label'), r = document.createElement('input'), b = document.createElement('span');
      r.type = 'radio'; r.name = 'ui'; r.value = v; r.checked = v === ui;
      b.className = 'box';
      lb.appendChild(r); lb.appendChild(b);
      lb.appendChild(document.createTextNode(v === 'free' ? 'Free (the drawing, one Emacs frame)' : 'Classic (menus at the top)'));
      r.addEventListener('change', function () { if (r.checked) set(v); });
      fs.appendChild(lb);
    });
    // revision 11: what Customize, the layout and the frames keep in this browser, and how to forget it,
    // by the colophon's own link to the note (so it is right from a page in a sub-folder too)
    var note = document.querySelector('a[rel="privacy-policy"]'), kept = document.createElement('a'), kp = document.createElement('p');
    kept.id = 'c-ui-kept';
    kept.href = (note ? note.getAttribute('href') : 'privacy.html').split('#')[0] + '#layout';
    kept.textContent = 'What these settings keep in this browser, and how to forget them';
    kp.className = 'c-kept'; kp.appendChild(kept); fs.appendChild(kp);
    var act = panel.querySelector('.c-actions');
    panel.insertBefore(fs, act || null);
  }
  // the layout switch (docs/NAV.md, revision 5): a light switch that never moves, for blink compare.
  // Free (home page): always, just under where Customize sits in classic. Classic: only in a tab that got
  // there by the switch (kept for the tab in sessionStorage), in the same box, drawn plain; a classic
  // visit not reached by it shows only Customize, whose row above still switches back.
  var BLINK = 'corwin.cloud.blink';
  function blinking() { try { return window.sessionStorage.getItem(BLINK) === '1'; } catch (e) { return false; } }
  function lightSwitch() {
    if (!document.body || document.body.getAttribute('data-page') !== 'home' || document.getElementById('ui-switch')) return;
    if (ui !== 'free' && !blinking()) return;
    var other = ui === 'free' ? 'classic' : 'free';
    var b = document.createElement('button'), t = document.createElement('span');
    b.type = 'button'; b.id = 'ui-switch'; b.className = 'ui-switch';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(ui === 'classic'));
    b.setAttribute('aria-label', 'Classic layout');
    b.title = ui === 'free' ? 'Classic layout: off. Press for classic; this switch stays here, so a second press comes back.' : 'Classic layout: on. Press for free; this switch stays here.';
    t.className = 'ui-thumb'; t.setAttribute('aria-hidden', 'true');
    b.appendChild(t);
    b.addEventListener('click', function () {
      try { window.sessionStorage.setItem(BLINK, '1'); } catch (e) { /* refused: the switch then shows in classic for this page only */ }
      b.setAttribute('aria-checked', String(other === 'classic'));
      set(other);
    });
    document.body.appendChild(b);
  }
  function ready() { row(); lightSwitch(); }
  // revision 8 (fit it at 1280): the switch is made when the document turns interactive, which is before
  // the deferred scripts run, so the frames are first placed with it already there (DOMContentLoaded comes
  // after them); the Customize row waits for DOMContentLoaded, when customize.js has built its panel. Each
  // does nothing a second time.
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', function () { if (document.readyState !== 'loading' && document.body) lightSwitch(); });
    document.addEventListener('DOMContentLoaded', ready);
  } else ready();
})();
// @license-end
