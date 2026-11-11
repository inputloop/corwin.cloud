// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 9 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free9-browser.cjs
// draw 1.12's card that fills the map (bigcard) and the pad that pages it (cardpad), turned on in
// free: the card fills the map with words larger than 1.10's, a picture and its facts; the card the page sends
// carries a title, facts, a statement, and art only of this origin; the pad turns 45 degrees while a card
// shows and returns to its 1.11 self when it goes; a hover card still goes when the pointer leaves, and a
// PRESSED item's card stays so the pointer can reach the pad and page it (a turned page stays turned); C-g, a
// selection or another page in view puts it away; on a narrow screen nothing is kept; the turned pad meets
// neither frame 2, the legend nor the layout switch; classic asks for neither switch and is unchanged.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 9 browser checks skipped: no topology checkout staged'); process.exit(0);
}
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(out, 'nav', 'index.json'), 'utf8'));
// the item the checks press: a project with its own page and several shapes drawn for it there (gitcha: the
// shop's title zone, Bryant's drawing pages ...); the first such project in the index if gitcha ever goes
const ITEM = (index.items.find((it) => it.id === 'project-gitcha') || index.items.find((it) => it.section === 'projects' && it.page)).id;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const origin = base.replace(/\/$/, '');
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(600); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  const meets = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const navSel = (p) => p.evaluate(() => { const f = [...document.querySelectorAll('section.ef:not(.ef-small)')].find((e) => e.querySelector('.navframe')); return f ? '#' + f.id : null; });
  // the card in the map and the pad, as the app draws them (read only: the page itself never reaches in)
  const look = (p) => app(p).evaluate(() => {
    const c = document.querySelector('#minimap .mm-card'), mm = document.getElementById('minimap'), pad = document.getElementById('mmPad');
    const card = c && !c.hidden && c.offsetWidth ? { big: c.classList.contains('mc-big'), box: c.classList.contains('mc-box'), lines: c.classList.contains('mc-lines'),
      title: c.querySelector('.mc-t').textContent, of: c.querySelector('.mc-n') && !c.querySelector('.mc-n').hidden ? c.querySelector('.mc-n').textContent : '',
      titlePx: parseFloat(getComputedStyle(c.querySelector('.mc-t')).fontSize), factPx: c.querySelector('.mc-f dd') ? parseFloat(getComputedStyle(c.querySelector('.mc-f dd')).fontSize) : 0,
      facts: c.querySelectorAll('.mc-f > div:not([hidden])').length, allFacts: c.querySelectorAll('.mc-f > div').length, art: c.querySelectorAll('.mc-a > svg, .mc-a > img').length > 0 && !c.classList.contains('mc-noart'),
      w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height, mw: mm.clientWidth, mh: mm.clientHeight } : null;
    const m = pad && getComputedStyle(pad).transform.match(/matrix\(([^)]+)\)/), v = m ? m[1].split(',').map(Number) : [1, 0];
    return { card, turned: !!pad && pad.classList.contains('mp-cardmode'), angle: Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI),
      padLabel: pad ? pad.getAttribute('aria-label') : null, titles: pad ? [...pad.querySelectorAll('.mp-b')].filter((b) => b.title).length : 0,
      slider: !!pad && !!pad.querySelector('.mp-sl') && getComputedStyle(pad.querySelector('.mp-sl')).display !== 'none', page: TopoForge.cardPage() };
  });
  const toMap = async (p) => { const off = await p.evaluate(() => document.getElementById('topology').getBoundingClientRect().toJSON()); const mm = await app(p).evaluate(() => document.getElementById('minimap').getBoundingClientRect().toJSON()); await p.mouse.move(off.left + mm.left + 30, off.top + mm.top + 30); };
  const empty = async (p) => { const g = await box(p, '#stage-grid'); await p.mouse.move(g.x + g.w * 0.5, g.y + g.h * 0.42); };
  const record = (p) => Promise.all([
    app(p).evaluate(() => { if (window.__wrapped) return; window.__wrapped = true; window.__cards = []; const o = TopoForge.preview; TopoForge.preview = function (w, x) { if (x && typeof x === 'object' && x.card) window.__cards.push(JSON.parse(JSON.stringify(x.card))); return o.apply(this, arguments); }; }),
    p.evaluate(() => { window.__cp = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:cardpage') window.__cp.push(e.data.detail.page); }); })]);
  const ownOrigin = (a, o) => { if (a === 'matches' || a === 'none' || a === undefined || a === null) return true; if (a && typeof a === 'object' && a.shape && !a.src) return true;
    if (a && typeof a === 'object' && typeof a.src === 'string') { try { const u = new URL(a.src, o + '/'); return u.origin === o && /^https?:$/.test(u.protocol); } catch (e) { return false; } } return false; };

  for (const [w, h, scheme] of [[1280, 800, 'light'], [1366, 768, 'dark'], [1440, 900, 'light'], [1920, 1080, 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: shots ? 2 : 1 }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w}x${h} ${scheme}`;
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (!(await app(p).evaluate(() => typeof TopoForge.cardPage === 'function'))) { ok(`revision 9 checks skipped: the staged app has no cardPage (older than 1.12), at ${tag}`); await ctx.close(); continue; }
    const sw = await app(p).evaluate(() => { const e = TopoForge.embed(); return [e.bigcard, e.cardpad]; });
    assert.deepEqual(sw, [true, true], 'free did not turn on bigcard and cardpad: ' + sw);
    await record(p);
    const nf = await navSel(p);
    assert.ok(nf, 'no navigator frame at ' + tag);
    const it = `${nf} .navframe a.it[data-id="${ITEM}"]`;
    await p.locator(it).scrollIntoViewIfNeeded();

    // ---- the card fills the map (hover): larger words, a picture, its facts ----
    await p.hover(it); await p.waitForTimeout(350);
    let L = await look(p);
    assert.ok(L.card && L.card.big, 'pointing at an item shows no big card in the map at ' + tag + ': ' + JSON.stringify(L));
    assert.ok(L.card.w >= L.card.mw - 3 && L.card.h >= L.card.mh - 3, `the card does not fill the map (${L.card.w}x${L.card.h} in ${L.card.mw}x${L.card.mh}) at ${tag}`);
    assert.ok(L.card.titlePx >= 12.5 * 1.5, `the card's title is not larger than 1.10's (${L.card.titlePx} px, 12.5 is 1.10's) at ${tag}`);
    assert.ok(L.card.art, 'the card has no picture at ' + tag);
    const sent = await app(p).evaluate(() => window.__cards.slice(-1)[0]);
    assert.ok(sent && sent.title && Array.isArray(sent.facts) && sent.facts.length >= 1 && sent.facts.length <= 8 && sent.facts.every((f) => f.length === 2) && sent.statement, 'the card sent lacks a title, facts or a statement: ' + JSON.stringify(sent));
    // every fact the page sent is in the card (the app leaves out, not cuts, the last ones that do not fit)
    assert.ok(L.card.title === sent.title && L.card.allFacts === sent.facts.length, 'the card in the map is not the one the page sent: ' + JSON.stringify([L.card.title, L.card.allFacts, sent.title, sent.facts.length]));
    const big1 = L.card;
    // a card with a short statement shows its facts, as a box score or as lines (the Security tile: three facts)
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(350);
    const S = (await look(p)).card;
    assert.ok(S && S.big && S.facts >= 1 && (S.box || S.lines) && S.titlePx >= 12.5, 'the Security tile\'s card shows no facts as a box score or lines at ' + tag + ': ' + JSON.stringify(S));
    await p.hover(it); await p.waitForTimeout(350);
    ok(`the card fills the map (${big1.w}x${big1.h} of ${big1.mw}x${big1.mh}), its title at ${big1.titlePx} px (1.10: 12.5), with a picture and every fact the page sent (title, ${sent.facts.length} facts, a statement); the Security tile's card shows ${S.facts} facts as ${S.box ? 'a box score' : 'lines'}, at ${tag}`);
    L = await look(p);
    // ---- the pad turns while a card shows; a hover card goes when the pointer leaves, and the pad turns back ----
    assert.ok(L.turned && Math.abs(L.angle - 45) <= 1, 'the pad did not turn 45 degrees while the card shows at ' + tag + ': ' + JSON.stringify([L.turned, L.angle]));
    assert.match(L.padLabel, /turned: it pages the cards/);
    if (shots && w === 1280) { const m = await box(p, '#topology'); const mm = await app(p).evaluate(() => document.getElementById('mmwrap').getBoundingClientRect().toJSON()); await p.screenshot({ path: path.join(shots, `r9-card-filled-${scheme}-${w}.png`), clip: { x: Math.max(0, m.x + mm.left - 300), y: Math.max(0, m.y + mm.top - 190), width: Math.min(w - Math.max(0, m.x + mm.left - 300), 300 + mm.width + 20), height: Math.min(h - Math.max(0, m.y + mm.top - 190), 190 + mm.height + 20) } }); }
    await empty(p); await p.waitForTimeout(800);
    L = await look(p);
    assert.equal(L.card, null, 'a hover card stayed after the pointer left (only a pressed item\'s card stays) at ' + tag);
    assert.ok(!L.turned && L.angle === 0 && L.slider && L.titles === 0, 'with the card gone the pad is not its 1.11 self at ' + tag + ': ' + JSON.stringify(L));
    ok(`the pad turns 45 degrees while the card shows; a hover card goes when the pointer leaves, and the pad is its 1.11 self again (no turn, its slider back, no tooltips left), at ${tag}`);

    // ---- a pressed item's card stays, so the pad can page it; a turned page stays turned ----
    await p.click(it); await p.waitForTimeout(400);
    assert.match(await p.textContent(nf + ' .ef-msg'), /card stays in the map, 1 of \d+: the map’s pad pages it; C-g puts it away/, 'the press does not say the card stays and how to page it at ' + tag);
    L = await look(p);
    const N = L.page.pages;
    assert.ok(N >= 2 && L.card && L.card.of === '1 of ' + N, `the pressed item's card has no pages (${JSON.stringify(L.page)}) at ${tag}`);
    // straight to the pad's Next arm (the pointer leaves the item on the way); the leave's timer runs after the turn
    await p.evaluate(() => { window.__cp = []; });
    await app(p).locator('#mmPad .mp-e').click(); await p.waitForTimeout(800);
    L = await look(p);
    assert.ok(L.card && L.turned, 'the pressed item\'s card went when the pointer went to the pad at ' + tag);
    assert.equal(L.page.page, 2, 'the pad\'s Next arm did not turn to card 2, or the turn was undone when the pointer\'s leave timer ran, at ' + tag);
    assert.equal(L.card.of, '2 of ' + N);
    assert.deepEqual(await p.evaluate(() => window.__cp.slice()), [2], 'the page did not hear one topoforge:cardpage for the turn');
    await app(p).locator('#mmPad .mp-dn').click(); await p.waitForTimeout(200);
    assert.equal((await look(p)).page.page, N, 'the pad\'s down arm did not go to the last card');
    await app(p).locator('#mmPad .mp-up').click(); await p.waitForTimeout(200);
    L = await look(p);
    assert.equal(L.page.page, 1, 'the pad\'s up arm did not go to the first card');
    assert.equal(await app(p).getAttribute('#mmPad .mp-e', 'title'), `Next card: 2 of ${N}`, 'the Next arm\'s tooltip does not say its job');
    await app(p).locator('#mmPad .mp-e').click(); await p.waitForTimeout(200);
    if (shots && w === 1280) { await toMap(p); await p.waitForTimeout(300); const m = await box(p, '#topology'); const mm = await app(p).evaluate(() => document.getElementById('mmwrap').getBoundingClientRect().toJSON()); await p.screenshot({ path: path.join(shots, `r9-pad-turned-${scheme}-${w}.png`), clip: { x: Math.max(0, m.x + mm.left - 300), y: Math.max(0, m.y + mm.top - 190), width: Math.min(w - Math.max(0, m.x + mm.left - 300), 300 + mm.width + 20), height: Math.min(h - Math.max(0, m.y + mm.top - 190), 190 + mm.height + 20) } }); }
    // the turned pad meets neither frame 2, the legend nor the switch
    await toMap(p); await p.waitForTimeout(300);
    const off = await box(p, '#topology');
    const cells = await app(p).evaluate(() => [...document.querySelectorAll('#mmPad .mp-b')].filter((b) => b.offsetParent && getComputedStyle(b).display !== 'none').map((b) => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, c: b.className }; }));
    assert.ok(cells.length >= 5, 'the turned pad shows fewer than five cells: ' + cells.length);
    for (const c of cells) {
      const q = { x: c.x + off.x, y: c.y + off.y, r: c.r + off.x, b: c.b + off.y };
      for (const sel of [nf, '#legend', '#ui-switch']) assert.ok(!meets(q, await box(p, sel)), `the turned pad's ${c.c} meets ${sel} at ${tag}: ` + JSON.stringify([q, await box(p, sel)]));
    }
    ok(`a pressed item's card stays (said in the echo area, 1 of ${N}) while the pointer goes to the pad; its arms page it (Next to 2, down to ${N}, up to 1; one topoforge:cardpage per turn; a turned page outlives the pointer's leave); the turned pad clear of frame 2, the legend and the switch, at ${tag}`);
    // every card the page sent: art the app's own, or a picture of this origin only
    const arts = await app(p).evaluate(() => window.__cards.map((c) => c.art));
    const foreign = arts.filter((a) => !ownOrigin(a, origin));
    assert.deepEqual(foreign, [], 'the page sent card art that is not the app\'s own picture nor of this origin: ' + JSON.stringify(foreign));
    ok(`every card the page sent (${arts.length}) has art that is the app's own picture or of this origin, at ${tag}`);

    // ---- C-g, a selection, another page: each puts the kept card away ----
    await p.focus('#ef-1 .ef-slider'); await p.keyboard.press('Control+g'); await p.waitForTimeout(500);
    assert.match(await p.textContent('#ef-1 .ef-msg'), /^Quit \(the card kept in the map is put away\)\.$/, 'C-g did not say the card is put away at ' + tag);
    await empty(p); await p.waitForTimeout(600);
    L = await look(p);
    assert.equal(L.card, null, 'C-g left the kept card in the map at ' + tag);
    assert.ok(!L.turned && L.angle === 0 && L.slider, 'after C-g the pad is not back at ' + tag);
    await p.click(it); await p.waitForTimeout(300); await empty(p); await p.waitForTimeout(700);
    assert.ok((await look(p)).card, 'pressed again, the card did not stay');
    await app(p).evaluate(() => { const pg = TopoForge.doc.pages[TopoForge.doc.cur]; TopoForge.select([pg.nodes[0].id]); }); await p.waitForTimeout(400);
    await app(p).evaluate(() => TopoForge.select([])); await p.waitForTimeout(800);
    assert.equal((await look(p)).card, null, 'a shape selected (then cleared) left the kept card in the map at ' + tag);
    await p.click(it); await p.waitForTimeout(300); await empty(p); await p.waitForTimeout(700);
    assert.ok((await look(p)).card, 'pressed a third time, the card did not stay');
    await app(p).evaluate(() => { const d = TopoForge.doc, other = d.pages.find((pg, i) => i !== d.cur); TopoForge.showPage(other.name); }); await p.waitForTimeout(800);
    assert.equal((await look(p)).card, null, 'another page in view left the kept card in the map at ' + tag);
    ok(`the kept card is put away by C-g in a frame (said: "Quit (the card kept in the map is put away)."), by a shape selected in the drawing, and by another page in view, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 9 at ${tag}: no sideways scroll, no request to another host, no console errors`);
    await fresh(p); await ctx.close();
  }

  // ---- a map laid out after ready (found by the pre-push run, 2026-11-03): under load the app sometimes says it is
  // ready before its map is laid out, and frame 2 then kept the height it had while the map was unknown. Made
  // certain here: the app's panels() reports no map until 150 ms after the page's 1.12 embed call ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
    await p.addInitScript(() => {
      if (!/\/topoforge\//.test(location.pathname)) return;
      let tf, until = Infinity;
      Object.defineProperty(window, 'TopoForge', { configurable: true, get() { return tf; }, set(v) {
        tf = v; const pn = v.panels, em = v.embed;
        v.panels = function () { const r = pn.apply(this, arguments); if (performance.now() < until && r && r.map) r.map = Object.assign({}, r.map, { x: 0, y: 0, w: 0, h: 0, shown: false }); return r; };
        v.embed = function (o) { if (o && o.bigcard) until = performance.now() + 150; return em.apply(this, arguments); };
      } });
    });
    await fresh(p); await p.goto(base + 'index.html'); await ready(p); await p.waitForTimeout(600);
    if (await app(p).evaluate(() => typeof TopoForge.cardPage === 'function')) {
      const off = await box(p, '#topology'), m = await app(p).evaluate(() => TopoForge.panels().map), nf = await navSel(p), f2 = await box(p, nf);
      const reach = Math.max(0, Math.ceil(66 * Math.SQRT2 - m.h / 2)), top = off.y + m.y - reach;
      assert.ok(m.shown && f2, 'no map or no navigator frame: ' + JSON.stringify([m, f2]));
      assert.ok(f2.b <= top - 12 + 1.5, `with the map laid out after ready, frame 2 ends at ${f2.b}, not 12 above the turned pad's reach (${top - 12}): it kept the height it had while the map was unknown`);
      ok(`a map laid out after ready: frame 2 is placed again when the map shows, and ends 12 above the turned pad's reach (${f2.b} <= ${top - 12}), at 1366x768`);
    } else ok('the late-map check skipped: the staged app is older than 1.12');
    await fresh(p); await ctx.close();
  }

  // ---- a narrow screen keeps no card (as it shows no selection's card): the map's sheet goes with the pointer ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1 }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForTimeout(1000);
    if (await app(p).evaluate(() => typeof TopoForge.cardPage === 'function')) {
      // the frame starts folded at the foot on a narrow screen: unfold it to reach the finder's items
      if (!(await p.evaluate(() => document.getElementById('ef-1').classList.contains('ef-open')))) { await p.click('#ef-1 .ef-fold'); await p.waitForTimeout(300); }
      const a = await p.evaluate(() => { const x = [...document.querySelectorAll('#ef-1 a.ef-it[data-item^="project-"]')].find((e) => e.offsetParent); return x ? x.getAttribute('data-item') : null; });
      assert.ok(a, 'no project item in the finder at 390');
      await p.locator(`#ef-1 a.ef-it[data-item="${a}"]`).scrollIntoViewIfNeeded();
      await p.click(`#ef-1 a.ef-it[data-item="${a}"]`); await p.waitForTimeout(400);
      await p.mouse.move(195, 20); await p.waitForTimeout(800);
      const sheet = await app(p).evaluate(() => { const m = document.getElementById('minimap'); return !!m && m.classList.contains('mm-carded') && m.offsetWidth > 0 && !!m.querySelector('.mm-card:not([hidden])'); });
      assert.equal(sheet, false, 'on a narrow screen a pressed item\'s card stayed in the map\'s sheet');
      assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at 390');
      ok('on a narrow screen (390) a pressed item\'s card is not kept: the map\'s sheet goes with the pointer');
    } else ok('the narrow check skipped: the staged app is older than 1.12');
    await fresh(p); await ctx.close();
  }

  // ---- classic: neither switch; no big card, no pad; the same as revision 8 ----
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await fresh(p); await p.evaluate(() => localStorage.setItem('corwin.cloud.ui.v1', 'classic'));
    await p.goto(base + 'index.html'); await waitDoc(p); await p.waitForTimeout(800);
    if (await app(p).evaluate(() => typeof TopoForge.cardPage === 'function')) {
      assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'classic');
      const e = await app(p).evaluate(() => { const x = TopoForge.embed(); return { bigcard: !!x.bigcard, cardpad: !!x.cardpad, mappad: !!x.mappad, preview: !!x.preview, reset: !!x.reset }; });
      assert.deepEqual(e, { bigcard: false, cardpad: false, mappad: false, preview: false, reset: true }, 'classic\'s switches changed: ' + JSON.stringify(e));
      // classic's navigator (an option, hidden at first): if it shows an item, point at it; nothing previews
      const first = await p.evaluate(() => { const a = [...document.querySelectorAll('.navframe a.it[href*="drawing="]')].find((x) => x.offsetParent); return a ? a.getAttribute('data-id') : null; });
      if (first) { await p.hover(`.navframe a.it[data-id="${first}"]`); await p.waitForTimeout(300); }
      const seen = await app(p).evaluate(() => ({ big: !!document.querySelector('#minimap .mm-card.mc-big'), pad: (() => { const x = document.getElementById('mmPad'); return !!x && !x.hidden && getComputedStyle(x).display !== 'none'; })(), body: document.body.classList.contains('tf-bigcard') }));
      assert.deepEqual(seen, { big: false, pad: false, body: false }, 'classic shows 1.12\'s card or a pad: ' + JSON.stringify(seen));
      ok(`classic at ${w}: neither bigcard nor cardpad (nor mappad or preview); reset as in revision 8; no big card and no pad`);
    } else ok(`classic revision 9 checks skipped at ${w}: the staged app is older than 1.12`);
    await fresh(p); await ctx.close();
  }
  await browser.close(); server.close();
  console.log('revision 9 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
