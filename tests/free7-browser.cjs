// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 7 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free7-browser.cjs
// The menu bar, the mode-lines and the message area take their own lines by default, and grow together
// when Options says so (kept); the map mode slider (cards, both, rings) starts in the middle, moves by
// arrows, Home, End and Options' radios, and is kept; rings says the caption in the frame's echo area;
// cards and both show a card whose facts equal the data and whose one statement is the catalog's (an item)
// or composed from its facts (a category, a kind); the selection has a card too.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 7 browser checks skipped: no topology checkout staged'); process.exit(0);
}
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(out, 'nav', 'index.json'), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };
function lum(c) { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(500); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const keys = async (p, ...ks) => { for (const k of ks) await p.keyboard.press(k); await p.waitForTimeout(60); };
  const lines = (p, f) => p.evaluate((sel) => {
    const r = document.querySelector(sel), lo = (el) => { const cs = getComputedStyle(el); const ch = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth); return Math.round((el.getBoundingClientRect().height - ch) / 24); };
    return { mode: r.getAttribute('data-lines-mode'), menu: lo(r.querySelector('.ef-menubar')), msg: lo(r.querySelector('.ef-msg')), ml: [...r.querySelectorAll('.ef-win .ef-ml')].filter((x) => x.offsetHeight).map(lo) };
  }, `#ef-${f}`);
  const longMsg = (p) => p.evaluate(() => { const f = document.querySelector('#ef-1 .ef-mb[data-menu="Help"]'); f.click(); document.querySelector('#ef-1 .ef-pop [data-act="describe-mode"]').click(); });
  const nineteen = (p) => app(p).evaluate(() => typeof TopoForge.preview === 'function');
  const card = (p) => p.evaluate(() => { const h = document.getElementById('ef-hud'); if (h.hidden) return null;
    return { kind: h.getAttribute('data-card'), title: (h.querySelector('.ef-card-t') || {}).textContent, icons: h.querySelectorAll('.ef-card-v svg, .ef-card-v .g').length,
      facts: Object.fromEntries([...h.querySelectorAll('.ef-card-f dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent])),
      statement: (h.querySelector('.ef-card-s') || {}).textContent, statements: h.querySelectorAll('.ef-card-s').length,
      color: getComputedStyle(h.querySelector('.ef-card-s')).color, bg: getComputedStyle(document.body).backgroundColor }; });
  // draw 1.10: the card is in the map; read it there (what shows) and in topoforge:preview (the card as shown)
  const ten = (p) => app(p).evaluate(() => typeof TopoForge.mapMode === 'function');
  const listen = (p) => p.evaluate(() => { window.__pv = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:preview') window.__pv.push(e.data.detail); }); });
  const mapCard = async (p) => {
    const c = await app(p).evaluate(() => { const c = document.querySelector('#minimap .mm-card'); if (!c || c.hidden) return null;
      const bg = (el) => { for (; el; el = el.parentElement) { const b = getComputedStyle(el).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return 'rgb(255, 255, 255)'; };
      return { title: c.querySelector('.mc-t').textContent, art: c.querySelectorAll('.mc-a svg').length,
        facts: Object.fromEntries([...c.querySelectorAll('.mc-f dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent])),
        statement: c.querySelector('.mc-s').textContent, statements: c.querySelectorAll('.mc-s').length,
        color: getComputedStyle(c.querySelector('.mc-t')).color, bg: bg(document.getElementById('minimap')) }; });
    if (!c) return null;
    const last = await p.evaluate(() => (window.__pv || []).slice(-1)[0] || null);
    c.sent = last && last.card; c.count = last ? last.count : null; c.mode = last ? last.mode : null;
    return c;
  };
  const lit = (p) => app(p).evaluate(() => document.querySelectorAll('#tfHi rect').length);
  const rect = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; }, sel);
  const meets = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;


  // draw 1.10 (revision 7, stage 2): the slider and the app's mapMode are one setting, both ways; the
  // cards go into the map (the stand-in box is retired, kept for 1.9); the middle lights the matches in the drawing
  const appMode = (p) => app(p).evaluate(() => TopoForge.mapMode().mode);
  const sliderAt = (p) => p.evaluate(() => [document.querySelector('#ef-1 .ef-slider').getAttribute('aria-valuenow'), CCFree.mapMode()]);
  const t10cards = async (p, w, h, tag, shapes) => {
    const sec = shapes.find((c) => c.id === 'sec');
    // ---- one source of truth: the slider drives the app, the app's Mode menu drives the slider ----
    assert.equal(await appMode(p), 'both', 'the slider in the middle, but the app is not in both');
    await p.focus('#ef-1 .ef-slider'); await keys(p, 'Home');
    assert.equal(await appMode(p), 'cards', 'the slider does not drive the app\'s mapMode');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="map-rings"]');
    assert.equal(await appMode(p), 'rings', 'Options, Map mode does not drive the app\'s mapMode');
    await app(p).evaluate(() => { const b = document.querySelector('#mmwrap .mm-mode'); b.click(); });
    await p.waitForTimeout(120);
    await app(p).evaluate(() => { const it = [...document.querySelectorAll('.menu .mi')].find((x) => /^Cards:/.test(x.querySelector('.lb').textContent)); it.click(); });
    await p.waitForTimeout(200);
    assert.deepEqual(await sliderAt(p), ['0', 'cards'], 'the app\'s own Mode menu did not move the slider');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]');
    assert.equal(await p.getAttribute('#ef-1 .ef-pop [data-act="map-cards"]', 'aria-checked'), 'true', 'the Options radio does not follow the app\'s Mode menu');
    await p.keyboard.press('Escape');
    // at ready the page follows the app; mapMode() is not called on every load
    await app(p).evaluate(() => TopoForge.mapMode('rings')); await p.waitForTimeout(100);
    const calls = await p.evaluate(() => JSON.parse(localStorage.getItem('corwin.cloud.free.v1') || '{}'));
    assert.equal(calls.mapMode, 'rings', 'the page did not keep the app\'s change');
    await p.reload(); await ready(p); await listen(p);
    assert.deepEqual(await sliderAt(p), ['2', 'rings'], 'after a reload the slider does not show the app\'s mode');
    // the app alone changes it (as if opened on its own page), then the home page loads: the app's wins, not the page's old one
    await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('topoforge.ui.v1') || '{}'); o.mapMode = { mode: 'cards', mapCaption: false }; localStorage.setItem('topoforge.ui.v1', JSON.stringify(o)); });
    await p.reload(); await ready(p); await listen(p);
    assert.deepEqual(await sliderAt(p), ['0', 'cards'], 'at ready the page\'s saved mode overrode the visitor\'s choice made in the app');
    assert.equal(await appMode(p), 'cards');
    await p.focus('#ef-1 .ef-slider'); await keys(p, 'ArrowRight');
    assert.equal(await appMode(p), 'both');
    ok(`one map mode: the slider and Options' radios set the app's mapMode, the app's Mode menu moves the slider and the radio, and at ready the page reads the app's mode (never forcing its own), at ${tag}`);

    // ---- the card in the map (both) ----
    assert.equal(await p.isVisible('#ef-hud'), false);
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150);
    let C = await mapCard(p);
    assert.ok(C && C.title === sec.label, 'no category card in the map: ' + JSON.stringify(C));
    assert.equal(await p.isVisible('#ef-hud'), false, 'with 1.10 the stand-in box still shows');
    assert.equal(C.facts.Shapes, String(sec.shapes.length), 'the map card\'s shape count is not shapes()\'s');
    assert.equal(C.statements, 1, 'not exactly one statement');
    for (const s of sec.shapes) assert.ok(C.statement.includes(s.label), 'the statement is not composed from the data: ' + C.statement);
    assert.ok(C.sent && C.sent.title === sec.label && C.sent.art === 'matches', 'the app did not take the page\'s card: ' + JSON.stringify(C.sent));
    assert.equal(C.mode, 'both');
    assert.equal(await lit(p), C.count, 'in the middle the drawing does not light the matches (the app\'s highlight)');
    assert.ok(contrast(C.color, C.bg) >= 4.5, 'the map card\'s title is below AA: ' + C.color + ' on ' + C.bg);
    // the 1280 overlap: the card is in the map now, and the map is not under frame 2
    const mm = await p.evaluate(() => { const f = document.getElementById('topology').getBoundingClientRect(); return { x: f.left, y: f.top }; });
    const mr = await app(p).evaluate(() => { const r = document.querySelector('#minimap .mm-card').getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; });
    const cardR = { x: mr.x + mm.x, y: mr.y + mm.y, r: mr.r + mm.x, b: mr.b + mm.y };
    if (await p.isVisible('#ef-2')) assert.ok(!meets(cardR, await rect(p, '#ef-2')), 'the card is under frame 2 at ' + tag + ': ' + JSON.stringify([cardR, await rect(p, '#ef-2')]));
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `r7s2-both-${p.__scheme}-${w}.png`) }); }
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    // a category drawn on this page (end points): its matches lit in the drawing
    await p.hover('#ef-1 .ef-tile[data-cat="end"]'); await p.waitForTimeout(150);
    const E = await mapCard(p);
    assert.ok(E && E.count > 0 && (await lit(p)) === E.count, 'in the middle the drawing does not light the matches (the app\'s highlight): ' + (E && E.count));
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    assert.equal(await mapCard(p), null, 'the map card stays after the pointer leaves');
    assert.equal(await lit(p), 0, 'the drawing stays lit after the pointer leaves');
    // a kind: its own picture
    const fw = sec.shapes[0];
    await p.focus(`#ef-1 .ef-shape[data-shape="${fw.id}"]`); await p.waitForTimeout(150);
    C = await mapCard(p);
    assert.ok(C && C.title === fw.label && C.facts.Category === sec.label && C.facts.Size === fw.w + ' by ' + fw.h, 'the kind card does not match shapes(): ' + JSON.stringify(C));
    assert.ok(C.art === 1 && C.sent.art && C.sent.art.shape === fw.id, 'the kind card does not show the shape\'s own picture');
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    // an item
    const it = index.items.find((x) => x.id === 'project-topology');
    await p.hover('#ef-2 .navframe a.it[data-id="project-topology"], #ef-1 a.ef-it[data-item="project-topology"]'); await p.waitForTimeout(150);
    C = await mapCard(p);
    assert.ok(C && C.title === it.name, 'no item card in the map: ' + JSON.stringify(C));
    assert.equal(C.statement, it.tip, 'the item\'s statement is not its catalog description');
    const notation = it.facets.notation.map((id) => index.facets.notation.find((v) => v.id === id).label).join(', ');
    assert.equal(C.facts.Notation, notation, 'the item\'s notation is not its index facets');
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    // the selection
    await app(p).evaluate(() => { const x = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((y) => y.data && y.data.what); TopoForge.select([x.id]); });
    await p.waitForTimeout(200);
    C = await mapCard(p);
    const selName = await app(p).evaluate(() => TopoForge.selection.name);
    assert.ok(C && C.title === selName, 'the selection has no card in the map: ' + JSON.stringify(C));
    await app(p).evaluate(() => TopoForge.select([])); await p.waitForTimeout(200);
    assert.equal(await mapCard(p), null, 'the selection\'s card stays after the selection is cleared');
    ok(`cards in the map (1.10): a category (shapes() count, one statement naming its shapes), a kind (its own picture), an item (catalog description, notation), the selection; the drawing lit in the middle; the stand-in box gone; not under frame 2; AA, at ${tag}`);

    // ---- cards (left): the card, nothing lit ----
    await p.focus('#ef-1 .ef-slider'); await keys(p, 'Home');
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150);
    C = await mapCard(p);
    assert.ok(C && C.title === sec.label && C.mode === 'cards', 'no card in the left position');
    assert.equal(await lit(p), 0, 'in the left position the drawing is lit');
    if (shots) await p.screenshot({ path: path.join(shots, `r7s2-cards-${p.__scheme}-${w}.png`) });
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    await p.focus('#ef-1 .ef-slider'); await keys(p, 'ArrowRight');
    ok(`cards (left): the card in the map and nothing lit in the drawing, at ${tag}`);

    // ---- with 1.9 the stand-in box is still the card ----
    await app(p).evaluate(() => { window.__v = TopoForge.version; TopoForge.version = '1.9'; });
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150);
    const B = await card(p);
    assert.ok(B && B.kind === 'category' && B.title === sec.label, 'with 1.9 the stand-in box does not show: ' + JSON.stringify(B));
    assert.equal(B.icons, Math.min(8, sec.shapes.length));
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    await app(p).evaluate(() => { TopoForge.version = window.__v; });
    ok(`with 1.9 the stand-in box is still the card (kept for 1.9 and 1.8), at ${tag}`);

    // ---- mapwheel: the wheel over the map zooms the drawing (about the view's centre: the app's choice) ----
    const k0 = await app(p).evaluate(() => TopoForge.view.k);
    const mb = await app(p).evaluate(() => { const r = document.getElementById('minimap').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(mm.x + mb.x, mm.y + mb.y); await p.mouse.wheel(0, -200); await p.waitForTimeout(200);
    const k1 = await app(p).evaluate(() => TopoForge.view.k);
    assert.ok(k1 > k0, 'the wheel over the map does not zoom the drawing (mapwheel off?): ' + k0 + ' -> ' + k1);
    await app(p).evaluate((k) => TopoForge.setView({ k }), k0).catch(() => {});
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(300);
    ok(`mapwheel is on: the wheel over the map zooms the drawing, at ${tag}`);
  };
  for (const [w, h] of [[1920, 950], [1280, 800]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage(); p.__scheme = scheme;
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w} ${scheme}`;
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);

    // ---- independent lines (default), together as an option ----
    await p.evaluate(() => CCFloat.get('frame1').set({ w: 440 }, true));
    await longMsg(p); await p.waitForTimeout(150);
    let L = await lines(p, 1);
    assert.equal(L.mode, 'independent', 'the lines are not independent by default');
    assert.ok(L.msg >= 2 && L.menu === 1 && L.ml.every((x) => x === 1), 'a long message grew more than the message area: ' + JSON.stringify(L));
    await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="lines-together"]');
    await longMsg(p); await p.waitForTimeout(150);
    L = await lines(p, 1);
    assert.equal(L.mode, 'together', 'Options did not turn on lines growing together');
    assert.ok(L.msg >= 2 && L.menu === L.msg && L.ml.every((x) => x === L.msg), 'together, the three lines are not in step: ' + JSON.stringify(L));
    await p.reload(); await ready(p);
    assert.equal((await lines(p, 1)).mode, 'together', 'lines growing together was not kept');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]');
    assert.equal(await p.getAttribute('#ef-1 .ef-pop [data-act="lines-together"]', 'aria-checked'), 'true');
    await p.click('#ef-1 .ef-pop [data-act="lines-together"]');
    assert.equal((await lines(p, 1)).mode, 'independent');
    ok(`lines: independent by default (a long message grows only the message area); Options, Lines grow together puts all three in step, kept across a reload, and back, at ${tag}`);

    // ---- the map mode slider ----
    const sl = '#ef-1 .ef-slider';
    const val = () => p.evaluate(() => [document.querySelector('#ef-1 .ef-slider').getAttribute('aria-valuenow'), CCFree.mapMode()]);
    assert.equal(await p.getAttribute(sl, 'role'), 'slider');
    assert.deepEqual(await val(), ['1', 'both'], 'the map mode does not start in the middle');
    assert.ok((await p.getAttribute(sl, 'aria-valuetext')).length > 10, 'the slider does not say its value in words');
    await p.focus(sl); await keys(p, 'ArrowRight');
    assert.deepEqual(await val(), ['2', 'rings'], 'ArrowRight did not move the slider right');
    await keys(p, 'Home');
    assert.deepEqual(await val(), ['0', 'cards'], 'Home did not move the slider left');
    await keys(p, 'End');
    assert.deepEqual(await val(), ['2', 'rings']);
    await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="map-cards"]');
    assert.deepEqual(await val(), ['0', 'cards'], 'Options, Map mode did not set the slider');
    await p.waitForTimeout(350);   // the thumb glides (revision 8)
    const th = await p.locator('#ef-1 .ef-sl-thumb').boundingBox(), tr = await p.locator(sl).boundingBox();
    assert.ok(th.x + th.width / 2 < tr.x + tr.width / 3, 'the thumb is not at the left in the left position');
    await p.reload(); await ready(p);
    assert.deepEqual(await val(), ['0', 'cards'], 'the map mode was not kept');
    const tr2 = await p.locator(sl).boundingBox(); await p.mouse.click(tr2.x + tr2.width / 2, tr2.y + tr2.height / 2);
    assert.deepEqual(await val(), ['1', 'both'], 'a click on the middle did not set the middle');
    ok(`the map mode slider: role slider, starts in the middle, says its value in words; arrows, Home, End, a click and Options' radios move it; kept across a reload, at ${tag}`);

    // ---- cards from data (both, then cards) ----
    const shapes = await app(p).evaluate(() => TopoForge.shapes());
    const T10 = await ten(p);
    if (T10) { await listen(p); await t10cards(p, w, h, tag, shapes); }
    else {
    const sec = shapes.find((c) => c.id === 'sec');
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(120);
    let C = await card(p);
    assert.ok(C && C.kind === 'category' && C.title === sec.label, 'no category card: ' + JSON.stringify(C));
    assert.equal(C.facts.Shapes, String(sec.shapes.length), 'the card\'s shape count is not shapes()\'s');
    assert.equal(C.icons, Math.min(8, sec.shapes.length), 'the card does not show the category\'s icons');
    assert.equal(C.statements, 1, 'not exactly one statement');
    for (const s of sec.shapes) assert.ok(C.statement.includes(s.label), 'the statement is not composed from the data: ' + C.statement);
    assert.ok(contrast(C.color, C.bg) >= 4.5, 'the card\'s statement is below AA');
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    const fw = sec.shapes[0];
    await p.focus(`#ef-1 .ef-shape[data-shape="${fw.id}"]`); await p.waitForTimeout(120);
    C = await card(p);
    assert.ok(C && C.kind === 'kind' && C.title === fw.label && C.facts.Category === sec.label && C.facts.Size === fw.w + ' by ' + fw.h, 'the kind card does not match shapes(): ' + JSON.stringify(C));
    const it = index.items.find((x) => x.id === 'project-topology');
    await p.hover('#ef-2 .navframe a.it[data-id="project-topology"], #ef-1 a.ef-it[data-item="project-topology"]');
    await p.waitForTimeout(150);
    C = await card(p);
    assert.ok(C && C.kind === 'item' && C.title === it.name, 'no item card: ' + JSON.stringify(C));
    assert.equal(C.statement, it.tip, 'the item\'s statement is not its catalog description');
    const notation = it.facets.notation.map((id) => index.facets.notation.find((v) => v.id === id).label).join(', ');
    assert.equal(C.facts.Notation, notation, 'the item\'s notation is not its index facets');
    assert.ok(+C.facts['Shapes drawn for it'] >= 1, 'the item card counts no shapes drawn for it');
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    // the selection has a card (left and middle)
    await app(p).evaluate(() => { const x = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((y) => y.data && y.data.what); TopoForge.select([x.id]); });
    await p.waitForTimeout(200);
    C = await card(p);
    const selName = await app(p).evaluate(() => TopoForge.selection.name);
    assert.ok(C && C.kind === 'selection' && C.title === selName, 'the selection has no card: ' + JSON.stringify(C));
    await app(p).evaluate(() => TopoForge.select([])); await p.waitForTimeout(200);
    assert.equal(await p.isVisible('#ef-hud'), false, 'the selection\'s card stays after the selection is cleared');
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150); await p.screenshot({ path: path.join(shots, `r7-card-${scheme}-${w}.png`) }); await p.mouse.move(w / 2, 5); await p.waitForTimeout(450); }
    ok(`cards from data: a category (its shapes() count and icons, one statement naming its shapes), a kind (category, size), a navigator item (its catalog description, its notation facets, shapes drawn for it), the selection; AA, at ${tag}`);
    }

    // ---- rings: the caption in the echo area ----
    await p.focus(sl); await keys(p, 'End');
    if (await nineteen(p)) {
      await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150);
      assert.match(await p.textContent('#ef-1 .ef-msg'), /Security/, 'in the rings position the echo area does not say the caption');
      if (await ten(p)) {
        const last = await p.evaluate(() => (window.__pv || []).slice(-1)[0]);
        assert.ok(last && last.mode === 'rings' && last.card === null, 'in rings the app still sent a card: ' + JSON.stringify(last));
        assert.equal(await p.textContent('#ef-1 .ef-msg'), last.caption, 'the echo area is not topoforge:preview\'s caption (the app\'s own, which counts already)');
        assert.equal(await app(p).evaluate(() => { const c = document.querySelector('#minimap .mm-cap'); return !!c && !c.hidden; }), false, 'with 1.10 the caption is written in the map too (the page asked for it in the echo area)');
        assert.equal(await app(p).evaluate(() => document.querySelectorAll('#mmPrev rect').length), last.count, 'in rings the map does not ring the matches: ' + JSON.stringify(last));
        await p.hover('#ef-1 .ef-tile[data-cat="end"]'); await p.waitForTimeout(150);
        const le = await p.evaluate(() => (window.__pv || []).slice(-1)[0]);
        assert.ok(le.count > 0 && (await app(p).evaluate(() => document.querySelectorAll('#mmPrev rect').length)) === le.count, 'in rings the map does not ring the matches');
        assert.ok(/\d/.test(le.caption) && (await p.textContent('#ef-1 .ef-msg')) === le.caption, 'the echo area does not carry the app\'s counted caption once: ' + le.caption);
        await p.mouse.move(w / 2, 5); await p.waitForTimeout(300);
        // an item: the page names it, the counts follow, "(n here, m on other pages)"
        await p.hover('#ef-2 .navframe a.it[data-id="project-topology"], #ef-1 a.ef-it[data-item="project-topology"]'); await p.waitForTimeout(150);
        const li = await p.evaluate(() => (window.__pv || []).slice(-1)[0]), it7 = index.items.find((x) => x.id === 'project-topology');
        const want = li.caption + '  (' + li.count + ' here' + (li.other ? ', ' + li.other + ' on other pages' : '') + ')';
        const said = [await p.textContent('#ef-1 .ef-msg'), await p.textContent('#ef-2 .ef-msg')];
        assert.ok(li.caption === it7.name && said.includes(want), 'an item\'s echo is not its name with the counts: ' + JSON.stringify([want, said]));
        if (shots) await p.screenshot({ path: path.join(shots, `r7s2-rings-${p.__scheme}-${w}.png`) });
      }
      assert.equal(await p.isVisible('#ef-hud'), false, 'in the rings position a card shows');
      await p.mouse.move(w / 2, 5); await p.waitForTimeout(300);
      ok(`rings (right): the map's caption is said in the frame's echo area, and no card shows, at ${tag}`);
    } else ok(`rings echo check skipped: the staged app has no preview(), at ${tag}`);
    await p.focus(sl); await keys(p, 'ArrowLeft');

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 7 at ${tag}: no sideways scroll, no request to another host, no console errors`);
    await fresh(p); await ctx.close();
  }
  // ---- 390: the lines independent in the one frame ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    await longMsg(p); await p.waitForTimeout(150);
    const L = await lines(p, 1);
    assert.ok(L.mode === 'independent' && L.msg >= 2 && L.menu === 1, 'at 390 the lines are not independent: ' + JSON.stringify(L));
    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at 390');
    await fresh(p); await ctx.close();
    ok('at 390 the lines are independent too, and nothing scrolls sideways');
  }
  await browser.close(); server.close();
  console.log('revision 7 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
