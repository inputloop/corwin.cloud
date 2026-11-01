// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Browser checks (needs the playwright package): SITE_OUT=dir [SHOTS=dir] node tests/browser.cjs
// Serves the build with the policies the deploy note sets (strict for the site, hashes for
// /topology/), then drives it at 1280 and 390 pixels, with scripts on and off.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  const h = { 'Content-Type': (types[path.extname(f)] || 'text/plain') + '; charset=utf-8' };
  h['Content-Security-Policy'] = p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT;
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const [w, h] of [[1280, 900], [390, 800]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const violations = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
    page.on('pageerror', (e) => violations.push('pageerror ' + e.message));
    for (const pg of ['index.html', 'directory.html', 'packages.html', 'jslicense.html', '404.html']) {
      await page.goto(base + pg); await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${pg} scrolls sideways by ${over}px at ${w}`);
    }
    ok(`no horizontal scroll on any page at ${w}px`);

    // tabs, by keyboard
    await page.goto(base + 'index.html'); await page.waitForTimeout(250);
    const sel = () => page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]').id);
    const tabIndexes = () => page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((t) => t.tabIndex));
    assert.equal(await sel(), 'tab-topology');
    const ti = await tabIndexes(); assert.equal(ti.filter((x) => x === 0).length, 1); assert.equal(ti.filter((x) => x === -1).length, ti.length - 1);
    await page.focus('#tab-topology');
    await page.keyboard.press('ArrowRight'); assert.equal(await sel(), 'tab-obsmage');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-obsmage');
    assert.equal(await page.evaluate(() => document.getElementById('panel-obsmage').hidden), false);
    assert.equal(await page.evaluate(() => document.getElementById('panel-topology').hidden), true);
    await page.keyboard.press('End'); assert.equal(await sel(), 'tab-card-games');
    await page.keyboard.press('ArrowRight'); assert.equal(await sel(), 'tab-topology');
    await page.keyboard.press('ArrowLeft'); assert.equal(await sel(), 'tab-card-games');
    await page.keyboard.press('Home'); assert.equal(await sel(), 'tab-topology');
    ok(`tabs work by keyboard (arrows wrap, Home, End, roving tabindex) at ${w}px`);

    // fragments and the directory
    await page.goto(base + 'index.html#tab-obsmage'); await page.waitForTimeout(250);
    assert.equal(await sel(), 'tab-obsmage');
    assert.ok(await page.isVisible('#panel-obsmage >> text=Scenes'));
    await page.goto(base + 'directory.html'); await page.waitForTimeout(150);
    await page.click('text=Design tab >> nth=1'); await page.waitForTimeout(250);
    assert.match(page.url(), /index\.html#tab-/);
    assert.ok((await sel()).startsWith('tab-'));
    ok('a directory card opens its tab');

    // the directory filter, without script
    await page.goto(base + 'directory.html');
    await page.check('#f-game', { force: true });
    const shown = await page.evaluate(() => [...document.querySelectorAll('.grid > li')].filter((li) => li.offsetParent).map((li) => li.dataset.kind));
    assert.ok(shown.length >= 2 && shown.every((k) => k === 'game'), 'filter: ' + shown);
    ok('the kind filter narrows the directory');

    // the prompt
    await page.goto(base + 'index.html'); await page.waitForTimeout(150);
    await page.keyboard.press('Alt+x');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt');
    await page.keyboard.type('quantum'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    assert.match(page.url(), /#tab-quantum3d5/);
    ok('Alt+x opens the prompt and it goes to a tab');

    // the topology frame loads under the deploy policy
    if (topoCsp && fs.existsSync(path.join(out, 'topology', 'app.html'))) {
      await page.goto(base + 'index.html'); await page.waitForTimeout(800);
      const fr = page.frames().find((f) => /topology\/app\.html/.test(f.url()));
      assert.ok(fr, 'topology frame');
      assert.ok(await fr.locator('text=Draw the graph').first().isVisible(), 'topology app drew');
      ok('topology loads in the frame under its own policy');
    }
    assert.deepEqual(violations, [], 'policy violations: ' + violations.join(' | '));
    ok(`no policy violations or script errors at ${w}px`);
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      for (const [nm, u, full] of [['home', 'index.html', false], ['obsmage', 'index.html#tab-obsmage', true], ['directory', 'directory.html', true], ['packages', 'packages.html', true]]) {
        await page.goto(base + u); await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(shots, `corwin-cloud-${nm}-${w}.png`), fullPage: full });
      }
    }
    await page.close();
  }
  // scripts off: every panel is there, links still work
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
  const np = await ctx.newPage();
  await np.goto(base + 'index.html');
  const vis = await np.evaluate(() => [...document.querySelectorAll('[role=tabpanel]')].filter((p) => p.offsetParent).length);
  assert.equal(vis, 9); ok('with scripts off all nine panels are readable');
  await np.goto(base + 'directory.html'); await np.check('#f-ai', { force: true });
  ok('with scripts off the directory still filters');
  await browser.close(); server.close();
  console.log('browser checks passed:', n);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
