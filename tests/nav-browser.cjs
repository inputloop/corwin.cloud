// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// The left nav in a browser (needs the playwright package): SITE_OUT=dir [SHOTS=dir] node tests/nav-browser.cjs
// Each promise of docs/NAV.md, at 1280 and 390 pixels, under the deploy policies. The answer to a
// filter is checked against tests/nav_expect.py, a second reader of the rule written in Python.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json'))) { console.log('nav browser checks skipped: no nav index (no topology checkout)'); process.exit(0); }
const index = JSON.parse(fs.readFileSync(path.join(out, 'nav', 'index.json'), 'utf8'));
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'text/plain') + '; charset=utf-8',
    'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
const py = process.env.PYTHON || 'python3';
const expectIds = (ctx) => execFileSync(py, [path.join(root, 'tests', 'nav_expect.py'), JSON.stringify(ctx)], { env: { ...process.env, SITE_OUT: out } })
  .toString().split('\n').filter(Boolean);
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };
const EXAMPLE = { show: ['projects'], f: { notation: ['bpmn'] }, q: 'topology' };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const want = expectIds(EXAMPLE);
  assert.ok(want.length > 0 && want.includes('project-topology'), 'the Python reader found nothing for the example');
  for (const [w, h] of [[1280, 900], [390, 800]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [], offsite = [];
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const ready = async () => { await page.waitForSelector('#nav[data-ready="yes"]', { timeout: 10000 }); await page.waitForTimeout(150); };
    const echo = () => page.textContent('#nav-echo');
    const shownIn = (sel) => page.$$eval(sel, (as) => as.map((a) => a.getAttribute('data-id')));
    const pins = () => page.evaluate(() => [...document.querySelector('.win .pinlist').children].map((li) => { const a = li.querySelector(':scope > a.it'); return a ? a.getAttribute('data-id') : 'g:' + li.querySelector('[data-pin-g]').getAttribute('data-pin-g'); }));
    const shot = async (name) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `nav-${name}-${w}.png`) }); } };
    const press = async (f, v, on) => { const sel = `.tb[data-facet="${f}"][data-val="${v}"]`; if ((await page.getAttribute(sel, 'aria-pressed') === 'true') !== on) await page.click(sel); };
    const keys = async (...ks) => { for (const k of ks) await page.keyboard.press(k); await page.waitForTimeout(80); };

    // clear storage from a page with no TopoForge on it: TopoForge saves its working copy as a page unloads
    await page.goto(base + '404.html'); await page.evaluate(() => localStorage.clear());
    await page.goto(base + 'index.html'); await ready();
    assert.equal(await page.isHidden('.nf-tabs'), true, 'the tab bar shows with one buffer');
    assert.equal(await page.$$eval('#nav [role="tab"]', (x) => x.length), 0, 'a hidden tab exists with one buffer (the page\'s own tabs would be confused with it)');
    assert.equal(await page.$$eval('.win', (x) => x.length), 1);
    ok(`one buffer, one window, no tab bar, at ${w}px`);
    await shot('plain');

    // an item opens its page in TopoForge, by TopoForge's own page tab
    if (topoCsp && fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
      await page.waitForFunction((name) => { const f = document.getElementById('topology'); const d = f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === name; }, drawing.doc, { timeout: 15000 });
      await page.click('.win a.it[data-id="project-gitcha"]');
      await page.waitForFunction((n) => { const d = document.getElementById('topology').contentWindow.TopoForge.doc; return d.pages[d.cur].name === n; }, drawing.projects.gitcha.name, { timeout: 5000 });
      await page.waitForFunction((n) => document.querySelector('.ft-draw').textContent === 'drawing: ' + n, drawing.projects.gitcha.name, { timeout: 3000 });
      ok('an item opens its page in the drawing, and the title bar names the page');
    }

    // the example from his words
    await page.click('.tb[data-facet="show"][data-val="projects"]');
    await page.click('.tb[data-facet="notation"][data-val="bpmn"]');
    await page.fill('#nav-q', 'topology'); await page.waitForTimeout(150);
    assert.deepEqual(await shownIn('.win .sec a.it'), want, 'the browser and the Python reader disagree');
    assert.equal(await page.$$eval('.win .sec', (s) => s.length), 1, 'sections other than Projects are still shown');
    assert.match(await echo(), /for Show Projects; Notation BPMN; words: topology\./);
    ok(`Projects + BPMN + "topology" shows exactly ${want.map((x) => x.replace('project-', '')).join(', ')}, as Python works it out from the data`);
    const first = index.items.find((i) => i.id === want[0]);
    await page.hover(`.win a.it[data-id="${first.id}"]`);
    const ml = await page.textContent('.win .ml-item');
    assert.ok(ml.startsWith(first.name + ': ' + first.tip.slice(0, 20)), 'the mode-line does not show the tooltip: ' + ml);
    assert.match(ml, /BPMN/); assert.match(ml, /Projects/);
    await page.focus(`.win a.it[data-id="${first.id}"]`);
    assert.match(await echo(), /BPMN, because /);
    ok('the mode-line shows the hovered item\'s tooltip and categories; focus puts the reasons in the echo');
    await shot('example');

    // pins: an item, and a section
    await page.click(`.win a.it[data-id="project-topology"] + .pin-i`);
    await page.fill('#nav-q', 'gitcha'); await page.waitForTimeout(150);
    assert.ok(await page.isVisible('.win .pinlist a.it[data-id="project-topology"]'), 'a pinned item was filtered away');
    assert.ok(await page.isVisible('.win .pinlist a.it[data-id="project-topology"] .out'), 'a pinned item outside the filter is not marked');
    await page.fill('#nav-q', ''); await page.waitForTimeout(100);
    await page.click('.win .sec [data-pin-g="projects"]');
    await page.click('.tb[data-facet="show"][data-val="projects"]');
    await page.click('.tb[data-facet="show"][data-val="hosts"]');
    assert.ok(await page.isVisible('.win .pinlist [data-pin-g="projects"]'), 'a pinned section was removed by the Show buttons');
    ok('a pinned item survives a filter that leaves it out (marked), and a pinned section survives the Show buttons');

    // splits
    await page.focus('.win a.it'); await keys('Control+x', '2');
    await page.focus('.win a.it'); await keys('Control+x', '3');
    assert.equal(await page.$$eval('.win', (x) => x.length), 3);
    const shape = await page.$$eval('.win', (ws) => ws.map((x) => [x.firstElementChild.className, x.lastElementChild.className, x.querySelectorAll('[class*="title"]').length,
      x.querySelectorAll('.pinlist a.it[data-id="project-topology"]').length]));
    for (const [a, b, t, p] of shape) { assert.equal(a, 'win-body'); assert.equal(b, 'ml'); assert.equal(t, 0, 'a window has a title bar'); assert.equal(p, 1, 'a window lacks the pinned area'); }
    ok('C-x 2 and C-x 3 split the window; every window has its own mode-line, the pinned area, and no title bar');
    await shot('splits');
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways with three windows');
    await page.focus('.win a.it'); await keys('Control+x', '2');
    await page.focus('.win a.it'); await keys('Control+x', '2');
    assert.equal(await page.$$eval('.win', (x) => x.length), 4);
    assert.match(await echo(), /At most 4 windows/);
    await page.focus('.win a.it'); await keys('Control+x', '1');
    assert.equal(await page.$$eval('.win', (x) => x.length), 1);
    ok('at most four windows; C-x 1 keeps one; no sideways scroll with splits');

    // drag to reorder, kept across a reload; Alt+Up does the same
    await press('show', 'hosts', false);
    await page.click('.win .pinlist a.it[data-id="project-corwin.cloud"] + .pin-i');
    assert.deepEqual(await pins(), ['project-topology', 'g:projects', 'project-corwin.cloud']);
    if (w >= 1000) await page.locator('.win .pinlist > li').nth(2).dragTo(page.locator('.win .pinlist > li').nth(0));
    else { await page.click('.win .pinlist [data-up="2"]'); await page.click('.win .pinlist [data-up="1"]'); }   // no drag on touch: the buttons
    await page.waitForTimeout(100);
    assert.deepEqual(await pins(), ['project-corwin.cloud', 'project-topology', 'g:projects'], w >= 1000 ? 'drag did not reorder the pins' : 'the move-up buttons did not reorder the pins');
    await page.reload(); await ready();
    assert.deepEqual(await pins(), ['project-corwin.cloud', 'project-topology', 'g:projects'], 'the pin order was not kept');
    await page.focus('.win .pinlist a.it[data-id="project-topology"]'); await keys('Alt+ArrowUp');
    assert.deepEqual(await pins(), ['project-topology', 'project-corwin.cloud', 'g:projects']);
    ok((w >= 1000 ? 'dragging a pin' : 'the move-up button (the no-drag way)') + ' reorders the pins, the order survives a reload, and Alt+Up moves a pin too');

    // pin results to a new buffer: create, then switch; the context light and its hover text
    await press('show', 'hosts', false); await press('show', 'projects', true); await press('notation', 'bpmn', true);
    await page.fill('#nav-q', 'topology'); await page.waitForTimeout(100);
    assert.equal(await page.isVisible('.win .ml-light.lit'), false, 'the light is lit in a live buffer');
    await page.click('#nav-pinbuf');
    assert.equal(await page.isVisible('.nf-tabs'), true, 'no tab bar at the second buffer');
    assert.equal(await page.$$eval('.nf-tab', (x) => x.length), 2);
    assert.equal(await page.getAttribute('.nf-tab[data-tab="1"]', 'aria-selected'), 'true');
    assert.equal(await page.isVisible('.win .ml-light.lit'), true, 'the light is not lit in the baked buffer');
    assert.match(await page.textContent('.win .ml-flags'), /%%/);
    assert.deepEqual(await shownIn('.win .sec a.it'), want, 'the baked buffer shows other items');
    await page.hover('.win .ml-light');
    assert.equal(await echo(), 'Context: Show Projects; Notation BPMN; words: topology.');
    ok('pin results to a new buffer: the tab bar appears, the context is baked, the light is lit and pointing at it says the context');
    await shot('buffers');
    await page.click('.nf-tab[data-tab="0"]');
    assert.equal(await page.isVisible('.win .ml-light.lit'), false);
    await page.click('#nav-pinbuf');
    assert.equal(await page.$$eval('.nf-tab', (x) => x.length), 2, 'a second identical buffer was made');
    assert.equal(await page.getAttribute('.nf-tab[data-tab="1"]', 'aria-selected'), 'true');
    assert.match(await echo(), /^Switched to /);
    ok('pressed again with the same context, it switches to that buffer instead of making another');

    // the menu bar
    await page.click('.menu-b[data-menu="Window"]');
    assert.ok(await page.isVisible('#nf-pop button[data-cmd="split-v"]'));
    await page.keyboard.press('Escape');
    assert.equal(await page.isHidden('#nf-pop'), true, 'Escape did not close the menu');
    ok('the menu bar opens a menu, and Escape closes it');

    // the width
    if (w >= 1000) {
      const before = (await page.locator('#nav').boundingBox()).width;
      const hb = await page.locator('.nf-handle').boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + 200); await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + 200, { steps: 4 }); await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + 200, { steps: 4 }); await page.mouse.up();
      const after = (await page.locator('#nav').boundingBox()).width;
      assert.ok(Math.abs(after - before - 120) <= 3, `dragging the edge 120px changed the width by ${after - before}`);
      await page.reload(); await ready();
      assert.ok(Math.abs((await page.locator('#nav').boundingBox()).width - after) <= 1, 'the width was not kept');
      await page.focus('.nf-handle'); await keys('ArrowRight');
      assert.ok(Math.abs((await page.locator('#nav').boundingBox()).width - after - 16) <= 1, 'ArrowRight on the edge did not widen by 16px');
      assert.equal(await page.getAttribute('.nf-handle', 'aria-valuenow'), String(Math.round(after + 16)));
      ok('dragging the right edge changes the width, which survives a reload; the arrow keys do it too');
      await page.click('[data-cmd="collapse"]');
      assert.ok((await page.locator('#nav').boundingBox()).width < 60, 'collapse did not shrink the frame');
      await page.click('[data-cmd="collapse"]');
      ok('the title bar collapses and expands the frame');
    } else {
      assert.equal(await page.isVisible('.nf-handle'), false, 'the edge handle shows on a narrow screen');
      ok('on a narrow screen the frame sits above the drawing and has no edge handle');
    }
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways');
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`no sideways scroll, no request to another host and no console errors at ${w}px`);
    await page.goto(base + '404.html'); await page.evaluate(() => localStorage.clear());
    await page.close();
  }

  // storage refused: the nav still renders and filters
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('refused'); } }); });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + 'index.html'); await p.waitForSelector('#nav[data-ready="yes"]', { timeout: 10000 });
    await p.click('.tb[data-facet="show"][data-val="processes"]');
    assert.deepEqual(await p.$$eval('.win .sec a.it', (as) => as.map((a) => a.getAttribute('data-id'))), expectIds({ show: ['processes'] }));
    assert.deepEqual(errs, [], 'errors with storage refused: ' + errs.join(' | '));
    await ctx.close();
    ok('with storage refused the nav still renders and filters');
  }
  // scripts off: a plain list, one link per item
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
    const p = await ctx.newPage();
    await p.goto(base + 'index.html');
    assert.equal(await p.$$eval('#nav a[data-item]', (as) => as.filter((a) => a.offsetParent).length), index.items.length);
    await ctx.close();
    ok(`with scripts off the nav is a plain list of ${index.items.length} links`);
  }
  await browser.close(); server.close();
  console.log('nav browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
