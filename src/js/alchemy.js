// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// alchemy.js: the combine-and-split game on /alchemy. It asks this site (and only this site) once for
// the decks (#al-game's data-src: alchemy-decks.json, built from c4's atoms by alchemy.py), and builds the
// game inside #al-game. Combine two things you have found to find a third; split one to see every pair
// that makes it. What you have found is kept in this browser only, under one name
// (corwin.cloud.alchemy.v1, listed on privacy.html, forgotten by its one press). It sends nothing.
(function () {
  'use strict';
  var doc = document, root = doc.getElementById('al-game');
  if (!root || !window.fetch) return;
  var ID = /^[a-z0-9]+$/;
  var decks = {}, order = [], saved = { deck: null, found: {} }, deck = null, mode = 'combine', pick = [];
  var ui = {};

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function say(t) { ui.said.textContent = ''; window.setTimeout(function () { ui.said.textContent = t; }, 30); }
  function nm(d, i) { return d.names[i] || i; }

  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem('corwin.cloud.alchemy.v1'); } catch (e) { return 'unavailable'; }
    if (raw == null) return 'none';
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || typeof s.found !== 'object') throw new Error('shape');
      saved.deck = typeof s.deck === 'string' ? s.deck : null;
      Object.keys(s.found).forEach(function (k) {
        if (decks[k] && Array.isArray(s.found[k])) {
          saved.found[k] = s.found[k].filter(function (x) { return typeof x === 'string' && ID.test(x) && decks[k].known[x]; });
        }
      });
      if (s.made && typeof s.made === 'object') {
        Object.keys(s.made).forEach(function (k) {
          if (!decks[k] || !s.made[k] || typeof s.made[k] !== 'object') return;
          saved.made[k] = {};
          Object.keys(s.made[k]).forEach(function (p) { if (decks[k].pair[p]) saved.made[k][p] = 1; });
        });
      }
      return 'ok';
    } catch (e) { return 'corrupt'; }
  }
  function store() {
    try { window.localStorage.setItem('corwin.cloud.alchemy.v1', JSON.stringify(saved)); } catch (e) { /* a private window: play on, unsaved */ }
  }

  function found(d) { return saved.found[d.id]; }
  function has(d, x) { return found(d).indexOf(x) !== -1; }

  function index(d) {   // pair -> reaction, product -> reactions
    d.pair = {}; d.makes = {}; d.known = {};
    d.start.forEach(function (s) { d.known[s] = true; });
    d.rx.forEach(function (r) {
      d.pair[r[0] + ' ' + r[1]] = r; d.known[r[2]] = true;
      (d.makes[r[2]] = d.makes[r[2]] || []).push(r);
    });
  }

  function button(label, cls, onpress) {
    var b = el('button', cls, label); b.type = 'button';
    b.addEventListener('click', onpress);
    return b;
  }

  function build() {
    root.textContent = '';
    var bar = el('div', 'al-bar');
    var dk = el('div', 'al-group'); dk.setAttribute('role', 'group'); dk.setAttribute('aria-label', 'Deck');
    dk.appendChild(el('span', 'al-label', 'Deck'));
    ui.deckBtns = {};
    order.forEach(function (id) {
      var b = button(decks[id].title, 'act al-deck', function () { choose(id); });
      ui.deckBtns[id] = b; dk.appendChild(b);
    });
    var md = el('div', 'al-group'); md.setAttribute('role', 'group'); md.setAttribute('aria-label', 'Move');
    md.appendChild(el('span', 'al-label', 'Move'));
    ui.modeBtns = {
      combine: button('Combine', 'act al-mode', function () { setMode('combine'); }),
      split: button('Split', 'act al-mode', function () { setMode('split'); })
    };
    md.appendChild(ui.modeBtns.combine); md.appendChild(ui.modeBtns.split);
    ui.count = el('p', 'al-count');
    bar.appendChild(dk); bar.appendChild(md); bar.appendChild(ui.count);
    root.appendChild(bar);

    var cols = el('div', 'al-cols');
    var left = el('section', 'al-found'); left.setAttribute('aria-labelledby', 'al-found-h');
    var h = el('h2', null, 'Found'); h.id = 'al-found-h'; left.appendChild(h);
    ui.list = el('ul', 'al-items'); left.appendChild(ui.list);

    var mid = el('section', 'al-bench'); mid.setAttribute('aria-labelledby', 'al-bench-h');
    ui.benchH = el('h2', null, 'Bench'); ui.benchH.id = 'al-bench-h'; mid.appendChild(ui.benchH);
    ui.howto = el('p', 'hint'); mid.appendChild(ui.howto);
    ui.slots = el('p', 'al-slots'); mid.appendChild(ui.slots);
    ui.said = el('p', 'al-said'); ui.said.id = 'al-said'; ui.said.setAttribute('role', 'status'); ui.said.setAttribute('aria-live', 'polite');
    mid.appendChild(ui.said);
    ui.out = el('div', 'al-out'); mid.appendChild(ui.out);

    var right = el('section', 'al-log'); right.setAttribute('aria-labelledby', 'al-log-h');
    var h3 = el('h2', null, 'Your recipe book'); h3.id = 'al-log-h'; right.appendChild(h3);
    ui.log = el('ul', 'al-logl'); right.appendChild(ui.log);
    ui.reset = button('Start this deck again', 'act al-reset', resetPress); right.appendChild(ui.reset);

    cols.appendChild(left); cols.appendChild(mid); cols.appendChild(right);
    root.appendChild(cols);
  }

  function choose(id) {
    deck = decks[id]; saved.deck = id; pick = []; armed = false;
    if (!saved.found[id] || !saved.found[id].length) saved.found[id] = deck.start.slice();
    store(); draw();
    say('Deck: ' + deck.title + '. ' + found(deck).length + ' of ' + deck.count + ' found.');
  }
  function setMode(m) { mode = m; pick = []; draw(); say(m === 'combine' ? 'Combine: choose two things.' : 'Split: choose one thing to see what makes it.'); }

  function draw() {
    var d = deck;
    order.forEach(function (id) { ui.deckBtns[id].setAttribute('aria-pressed', String(id === d.id)); });
    ['combine', 'split'].forEach(function (m) { ui.modeBtns[m].setAttribute('aria-pressed', String(m === mode)); });
    var f = found(d);
    ui.count.textContent = f.length + ' of ' + d.count + ' found' + (f.length === d.count ? ': all of them.' : '.');
    ui.howto.textContent = mode === 'combine'
      ? 'Choose two things from Found (the same one twice is allowed).'
      : 'Choose one thing from Found to see every pair that makes it.';
    ui.slots.textContent = mode === 'combine'
      ? (pick.length ? nm(d, pick[0]) + ' + …' : 'Nothing chosen yet.')
      : '';
    ui.list.textContent = '';
    f.slice().sort(function (a, b) { return nm(d, a) < nm(d, b) ? -1 : 1; }).forEach(function (x) {
      var li = el('li');
      var b = button(nm(d, x), 'al-item', function () { press(x); });
      b.setAttribute('data-id', x);
      if (pick.indexOf(x) !== -1) b.setAttribute('aria-pressed', 'true');
      if (d.start.indexOf(x) !== -1) b.appendChild(el('span', 'al-tag', ' first matter'));
      li.appendChild(b); ui.list.appendChild(li);
    });
    ui.log.textContent = '';
    d.rx.forEach(function (r) {
      if (has(d, r[2]) && (saved.made[d.id] || {})[r[0] + ' ' + r[1]]) {
        var li = el('li', null, nm(d, r[0]) + ' + ' + nm(d, r[1]) + ' = ' + nm(d, r[2]));
        li.title = r[3]; ui.log.appendChild(li);
      }
    });
    if (!ui.log.firstChild) ui.log.appendChild(el('li', 'hint', 'What you make is written here.'));
    ui.reset.textContent = armed ? 'Press again to forget ' + d.title + "'s progress" : 'Start this deck again';
  }

  function press(x) {
    var d = deck;
    if (mode === 'split') return split(x);
    pick.push(x);
    if (pick.length < 2) { draw(); say(nm(d, x) + ' chosen. Now a second thing.'); return; }
    var a = pick[0], b = pick[1]; pick = [];
    if (a > b) { var t = a; a = b; b = t; }
    var r = d.pair[a + ' ' + b];
    ui.out.textContent = '';
    if (!r) { draw(); say(nm(d, a) + ' + ' + nm(d, b) + ': nothing comes of it.'); return; }
    saved.made[d.id] = saved.made[d.id] || {}; saved.made[d.id][a + ' ' + b] = 1;
    var isNew = !has(d, r[2]);
    if (isNew) found(d).push(r[2]);
    store();
    var card = el('div', 'al-card' + (isNew ? ' al-new' : ''));
    card.appendChild(el('p', 'al-eq', nm(d, a) + ' + ' + nm(d, b) + ' = ' + nm(d, r[2]) + (isNew ? ' (new)' : '')));
    card.appendChild(el('p', 'al-why', r[3]));
    ui.out.appendChild(card);
    draw();
    say(nm(d, a) + ' plus ' + nm(d, b) + ' makes ' + nm(d, r[2]) + (isNew ? ', new. ' : ', found before. ') + r[3]
        + (isNew && found(d).length === d.count ? ' That is everything in this deck.' : ''));
  }

  function split(x) {
    var d = deck; ui.out.textContent = '';
    var card = el('div', 'al-card');
    if (d.start.indexOf(x) !== -1) {
      card.appendChild(el('p', 'al-eq', nm(d, x) + ' is first matter: it does not split.'));
      ui.out.appendChild(card); say(nm(d, x) + ' is first matter: it does not split.'); return;
    }
    var rs = d.makes[x] || [], words = [];
    card.appendChild(el('p', 'al-eq', nm(d, x) + (rs.length === 1 ? ' is made one way:' : ' is made ' + rs.length + ' ways:')));
    var ul = el('ul', 'al-ways');
    rs.forEach(function (r) {
      var A = has(d, r[0]) ? nm(d, r[0]) : 'something not found yet', B = has(d, r[1]) ? nm(d, r[1]) : 'something not found yet';
      var li = el('li'); li.appendChild(el('span', 'al-eq', A + ' + ' + B)); li.appendChild(el('span', 'al-why', ' ' + r[3]));
      ul.appendChild(li); words.push(A + ' plus ' + B + '. ' + r[3]);
    });
    card.appendChild(ul); ui.out.appendChild(card);
    say(nm(d, x) + ': ' + words.join(' Or: '));
  }

  var armed = false;
  function resetPress() {
    if (!armed) { armed = true; draw(); say('Press again to forget what you found in ' + deck.title + '.'); return; }
    armed = false; saved.found[deck.id] = deck.start.slice(); delete saved.made[deck.id]; store(); ui.out.textContent = ''; draw();
    say(deck.title + ' starts again from first matter.');
  }

  fetch(root.getAttribute('data-src'), { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then(function (data) {
    (data.decks || []).forEach(function (d) { index(d); decks[d.id] = d; order.push(d.id); });
    if (!order.length) throw new Error('no decks');
    saved.made = {};
    var was = load();
    if (!saved.made || typeof saved.made !== 'object') saved.made = {};
    build();
    choose(saved.deck && decks[saved.deck] ? saved.deck : order[0]);
    if (was === 'corrupt') say('What was saved here could not be read, so this starts fresh.');
  }).catch(function (e) {
    root.textContent = '';
    root.appendChild(el('p', 'al-off', 'The decks could not be loaded (' + e.message + '), so the game cannot start. The recipe books below are the whole game.'));
  });
}());
// @license-end
