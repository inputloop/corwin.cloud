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

  for (const [w, h] of [[1920, 950], [1280, 800]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
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
    const th = await p.locator('#ef-1 .ef-sl-thumb').boundingBox(), tr = await p.locator(sl).boundingBox();
    assert.ok(th.x + th.width / 2 < tr.x + tr.width / 3, 'the thumb is not at the left in the left position');
    await p.reload(); await ready(p);
    assert.deepEqual(await val(), ['0', 'cards'], 'the map mode was not kept');
    const tr2 = await p.locator(sl).boundingBox(); await p.mouse.click(tr2.x + tr2.width / 2, tr2.y + tr2.height / 2);
    assert.deepEqual(await val(), ['1', 'both'], 'a click on the middle did not set the middle');
    ok(`the map mode slider: role slider, starts in the middle, says its value in words; arrows, Home, End, a click and Options' radios move it; kept across a reload, at ${tag}`);

    // ---- cards from data (both, then cards) ----
    const shapes = await app(p).evaluate(() => TopoForge.shapes());
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

    // ---- rings: the caption in the echo area ----
    await p.focus(sl); await keys(p, 'End');
    if (await nineteen(p)) {
      await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(150);
      assert.match(await p.textContent('#ef-1 .ef-msg'), /Security/, 'in the rings position the echo area does not say the caption');
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
