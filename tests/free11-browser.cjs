// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 11 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free11-browser.cjs
// draw 1.14's peekKey: with the focus in this page and the pointer resting on a shape on the drawing, Shift
// pressed here shows that shape's card (no move needed) and Shift let go here puts it away; the echo area says "The card
// for <name>: let go of Shift to put it away."; Shift is not passed on while a field here takes typing, nor while the
// pointer is on a frame over the drawing (Shift+Tab among the frames, a shape selected, shows nothing); with an app
// older than 1.14 a still pointer waits for a move and Shift let go here still ends the peek; and the page still opens
// at its own first fit between the frames, not at Fit (Corwin, 2026-11-04: "No don't open the page at fit").
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 11 browser checks skipped: no topology checkout staged'); process.exit(0);
}
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };
const SAY = (name) => 'The card for ' + name + ': let go of Shift to put it away.';

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(600); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const mapCard = (p) => app(p).evaluate(() => { const c = document.querySelector('#minimap .mm-card'); return c && !c.hidden && c.offsetWidth ? c.querySelector('.mc-t').textContent : null; });
  const peeks = (p) => p.evaluate(() => (window.__pk || []).slice());
  const listen = (p) => p.evaluate(() => { window.__pk = []; if (!window.__pkOn) { window.__pkOn = true; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:peek') window.__pk.push(e.data.detail); }); } });
  // a shape on the drawing whose middle is clear of the frames, the legend and the map, and at least 8 screen pixels from
  // every other shape but the containers around it, so that the shape under the pointer there is that one, whatever the
  // zoom (at the first fit, 21 %, a zone's middle can be 2 pixels from a box inside it)
  const target = (p) => p.evaluate(() => {
    const f = document.getElementById('topology'), fr = f.getBoundingClientRect(), T = f.contentWindow.TopoForge, pg = T.doc.pages[T.doc.cur], v = T.view, m = 8 / v.k;
    const holds = (x, wx, wy, e) => wx >= x.x - e && wx <= x.x + x.w + e && wy >= x.y - e && wy <= x.y + x.h + e;
    const c = pg.nodes.filter((x) => x.w * v.k >= 30 && x.h * v.k >= 10).map((x) => ({ n: x, wx: x.x + x.w / 2, wy: x.y + x.h / 2 }))
      .filter((o) => pg.nodes.every((y) => y === o.n || (y.w * y.h > o.n.w * o.n.h && holds(y, o.n.x, o.n.y, 0) && holds(y, o.n.x + o.n.w, o.n.y + o.n.h, 0)) || !holds(y, o.wx, o.wy, m)))
      .map((o) => ({ id: o.n.id, name: String(o.n.text || '').split('\n')[0], x: fr.left + v.x + o.wx * v.k, y: fr.top + v.y + o.wy * v.k, a: o.n.w * o.n.h }))
      .filter((o) => document.elementFromPoint(o.x, o.y) === f).sort((a, b) => b.a - a.a)[0];
    return c ? { ids: [c.id], name: c.name, x: c.x, y: c.y } : null;
  });

  for (const [w, h, scheme] of [[1280, 800, 'light'], [1920, 1080, 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: shots ? 2 : 1 }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w}x${h} ${scheme}`;
    await fresh(p); await p.goto(base + 'index.html'); await ready(p); await p.waitForTimeout(400);
    if (!(await app(p).evaluate(() => typeof TopoForge.peekKey === 'function'))) { ok(`revision 11 checks skipped: the staged app has no peekKey (older than 1.14), at ${tag}`); await ctx.close(); continue; }

    // ---- the page opens at its own first fit between the frames, not at Fit ----
    const open = await app(p).evaluate(() => ({ k: TopoForge.view.k, fit: TopoForge.fitScale(), v: TopoForge.version }));
    assert.equal(open.v, '1.14');
    assert.ok(open.k > 0 && open.k <= open.fit * 0.95, `the page opened at Fit (k ${open.k}, fit ${open.fit}), not at its own first fit between the frames, at ${tag}`);
    ok(`the staged app is 1.14; the page opens at its own first fit between the frames (k ${open.k}), not at Fit (${open.fit}), at ${tag}`);

    // ---- a still pointer, the focus in this page: Shift here shows the card, and let go puts it away ----
    await listen(p);
    await p.focus('#ef-1 .ef-zoom');   // the focus in this page, in a frame
    const t = await target(p);
    assert.ok(t, 'no shape on the drawing clear of the frames at ' + tag);
    await p.mouse.move(t.x - 4, t.y); await p.mouse.move(t.x, t.y); await p.waitForTimeout(250);   // then the pointer rests
    const before = await p.textContent('#ef-1 .ef-msg');
    assert.deepEqual(await peeks(p), [], 'a peek without Shift');
    await p.keyboard.down('Shift'); await p.waitForTimeout(300);   // no move
    const pk1 = await peeks(p), card = await mapCard(p), echo = await p.textContent('#ef-1 .ef-msg');
    assert.ok(pk1.length === 1 && t.ids.includes(pk1[0].id), `Shift pressed with the focus in this page and the pointer still sent no peek of a shape under it: ${JSON.stringify(pk1)} (under it: ${t.ids.join(', ')}) at ${tag}`);
    const nm = pk1[0].name.split('\n')[0];
    assert.ok(card && card.startsWith(nm.slice(0, 12)), 'the still pointer\'s peek shows no card of that shape in the map: ' + card);
    if (nm.length <= 48 && !/[\s.]$/.test(nm)) assert.equal(echo, SAY(nm), 'the echo is not "The card for <name>: let go of Shift to put it away."');
    else assert.match(echo, /^The card for .+: let go of Shift to put it away\.$/, 'the echo is not "The card for <name>: ..."');
    assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('ef-zoom')), true, 'the focus left the page');
    if (shots && w === 1280) await p.screenshot({ path: path.join(shots, `r11-peek-still-pointer-${scheme}-1280.png`) });
    await p.keyboard.up('Shift'); await p.waitForTimeout(300);
    assert.equal((await peeks(p)).slice(-1)[0].id, null, 'Shift let go in this page did not end the peek');
    assert.equal(await mapCard(p), null, 'the card stayed after Shift was let go');
    assert.equal(await p.textContent('#ef-1 .ef-msg'), before, 'the echo was not put back');
    ok(`the focus in this page and the pointer still on "${nm}": Shift shows its card (no move needed), the echo says "${echo}", and Shift let go puts it away, at ${tag}`);
    // the wording, for a short name (his example): the app's message, sent from the app's own window as the app sends it
    const m0 = await p.textContent('#ef-1 .ef-msg');
    await app(p).evaluate(() => { window.parent.postMessage({ type: 'topoforge:peek', detail: { id: 'x-part', name: 'Part: what is made' } }, location.origin); }); await p.waitForTimeout(200);
    const said = await p.textContent('#ef-1 .ef-msg');
    await app(p).evaluate(() => { window.parent.postMessage({ type: 'topoforge:peek', detail: { id: null } }, location.origin); }); await p.waitForTimeout(200);
    assert.equal(said, 'The card for Part: what is made: let go of Shift to put it away.', 'the echo is not worded as Corwin asked');
    assert.equal(await p.textContent('#ef-1 .ef-msg'), m0, 'the echo was not put back after the worded peek');
    ok(`the echo is worded "${said}", at ${tag}`);

    // ---- not while a field here takes typing ----
    await listen(p);
    await p.focus('#nav-q'); await p.mouse.move(t.x + 1, t.y); await p.mouse.move(t.x, t.y); await p.waitForTimeout(200);
    await p.evaluate(() => { window.__pk = []; });
    await p.keyboard.down('Shift'); await p.waitForTimeout(300); const typed = await peeks(p); await p.keyboard.up('Shift'); await p.waitForTimeout(150);
    assert.deepEqual(typed, [], 'Shift in a field that takes typing (capitals) peeked: ' + JSON.stringify(typed));
    ok(`Shift is not passed on while a field here takes typing (the navigator's Narrow), the pointer resting on a shape, at ${tag}`);

    // ---- not while the pointer is on a frame: Shift+Tab among the frames, a shape selected, shows nothing ----
    await app(p).evaluate((id) => TopoForge.select([id]), t.ids[0]); await p.waitForTimeout(200);
    assert.equal(await app(p).evaluate(() => TopoForge.selection.count), 1, 'no shape selected for the Shift+Tab step');
    await p.hover('#ef-1 .ef-zoom'); await p.focus('#ef-1 .ef-zoom'); await p.waitForTimeout(200);
    await p.evaluate(() => { window.__pk = []; });
    await p.keyboard.down('Shift'); await p.waitForTimeout(300); const offDraw = await peeks(p); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await p.waitForTimeout(150);
    assert.deepEqual(offDraw, [], 'Shift with the pointer on a frame and a shape selected showed its card (Shift+Tab would flash it): ' + JSON.stringify(offDraw));
    await app(p).evaluate(() => TopoForge.select([])); await p.waitForTimeout(200);
    ok(`Shift is not passed on while the pointer is on a frame (a shape selected, Shift+Tab shows nothing), at ${tag}`);

    // ---- an app older than 1.14: a still pointer waits for a move; Shift let go here still ends the peek ----
    await app(p).evaluate(() => { window.__v = TopoForge.version; TopoForge.version = '1.13'; });
    await p.focus('#ef-1 .ef-zoom'); await p.mouse.move(t.x - 4, t.y); await p.mouse.move(t.x, t.y); await p.waitForTimeout(200);
    await p.evaluate(() => { window.__pk = []; }); const card0 = await mapCard(p);   // what the map shows before the peek
    await p.keyboard.down('Shift'); await p.waitForTimeout(300); const still13 = await peeks(p);
    await p.mouse.move(t.x + 2, t.y + 1); await p.waitForTimeout(300); const moved13 = await peeks(p);
    await p.keyboard.up('Shift'); await p.waitForTimeout(300); const up13 = await peeks(p), card13 = await mapCard(p);
    await app(p).evaluate(() => { TopoForge.version = window.__v; });
    assert.deepEqual(still13, [], 'with an app that says 1.13 the page passed Shift on');
    assert.ok(moved13.length === 1 && t.ids.includes(moved13[0].id), 'with 1.13, the pointer moving with Shift held did not peek: ' + JSON.stringify(moved13));
    assert.ok(up13.length === 2 && up13[1].id === null && card13 === card0, 'with 1.13, Shift let go in this page did not end the peek, or the map did not show again what it showed before: ' + JSON.stringify(up13) + ' card: ' + card13 + ', before: ' + card0);
    ok(`with an app that says 1.13: a still pointer waits for a move (as revision 10), and Shift let go in this page ends the peek, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 11 at ${tag}: no sideways scroll, no request to another host, no console errors`);
    await fresh(p); await ctx.close();
  }
  await browser.close(); server.close();
  console.log('revision 11 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
