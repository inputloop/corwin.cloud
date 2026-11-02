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
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null, demoCsp = null; const demoLocs = [];   // [prefix, policy]: a demo folder with a policy of its own
try {
  const conf = fs.readFileSync(path.join(root, 'generated', 'demo-csp.conf'), 'utf8');
  demoCsp = /^add_header Content-Security-Policy "([^"]+)"/m.exec(conf)[1];
  for (const m of conf.matchAll(/location \^~ (\S+) \{[^}]*?Content-Security-Policy "([^"]+)"/g)) demoLocs.push([m[1], m[2]]);
} catch (e) {}
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png' };
const index = (() => { try { return JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8')); } catch (e) { return null; } })();
const demoIds = fs.existsSync(path.join(out, 'demo')) ? fs.readdirSync(path.join(out, 'demo')).filter((d) => fs.existsSync(path.join(out, 'demo', d, 'index.html'))) : [];
// the release channel feed, as the live site serves it at /dist/ (outside public/): a fixture, or missing
let feedMode = 'good';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (p === '/dist/about-corwin/channel.json') {
    if (feedMode !== 'good') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Security-Policy': "default-src 'none'" });
    return res.end(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'channel-good.json')));
  }
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  const h = { 'Content-Type': (types[path.extname(f)] || 'text/plain') + '; charset=utf-8' };
  const own = demoLocs.find(([pre]) => p.startsWith(pre));
  h['Content-Security-Policy'] = p.startsWith('/topology/') && topoCsp ? topoCsp : (own ? own[1] : (/^\/demo\/[^/]+\/app\//.test(p) && demoCsp ? demoCsp : STRICT));
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  for (const [w, h] of [[1280, 900], [390, 800]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const violations = [], offsite = [];
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) violations.push(page.url().replace(base, '/') + ': ' + m.text()); });
    page.on('pageerror', (e) => violations.push('pageerror ' + e.message));
    for (const pg of ['index.html', 'directory.html', 'packages.html', 'jslicense.html', '404.html', 'demo/index.html', ...demoIds.map((d) => `demo/${d}/index.html`)]) {
      await page.goto(base + pg); await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${pg} scrolls sideways by ${over}px at ${w}`);
    }
    ok(`no horizontal scroll on any page at ${w}px`);

    // tabs, by keyboard (a link to a tab opens the long page: classic for that visit, docs/NAV.md revision 4)
    await page.goto(base + 'index.html#tab-topology'); await page.waitForTimeout(250);
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

    // the release channel badge: read from this site's feed, said in words
    await page.goto(base + 'directory.html');
    await page.waitForSelector('[data-channel="about-corwin"]:not([hidden])', { timeout: 5000 });
    assert.equal(await page.textContent('[data-channel="about-corwin"] .ch-words'), 'Last revision 40ffbb38e32a, made 1 November 2026 at 18:13 UTC.');
    ok('the about-corwin card says its last revision and stamp, from the channel feed');

    // about-corwin's Customize palette, shared: choices kept in this browser, Escape closes, Reset forgets
    if (fs.existsSync(path.join(out, 'js', 'customize.js'))) {
      await page.goto(base + 'directory.html'); await page.waitForTimeout(200);
      await page.click('#custom-btn');
      assert.equal(await page.isVisible('#custom-panel'), true);
      await page.check('#custom-panel input[name="size"][value="3"]', { force: true });
      await page.check('#custom-panel input[name="theme"][value="hc"]', { force: true });
      await page.click('#c-apply');
      await page.goto(base + 'directory.html'); await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-size')), '3', 'the size was not kept');
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'hc');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `with the largest text the directory scrolls sideways by ${over}px at ${w}`);
      await page.click('#custom-btn'); await page.focus('#c-reset'); await page.keyboard.press('Escape');
      assert.equal(await page.isVisible('#custom-panel'), false, 'Escape did not close the palette');
      await page.click('#custom-btn'); await page.click('#c-reset'); await page.click('#custom-btn');
      await page.reload(); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-size')), null, 'Reset did not forget');
      ok(`about-corwin's Customize palette: kept per browser across pages, Escape closes, Reset forgets, at ${w}px`);
    }

    // the prompt (on the free home page Alt+x is the Emacs frame's M-x: tests/free-browser.cjs)
    await page.goto(base + 'directory.html'); await page.waitForTimeout(150);
    await page.keyboard.press('Alt+x');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt');
    await page.keyboard.type('quantum'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    assert.match(page.url(), /#tab-quantum3d5/);
    ok('Alt+x opens the prompt and it goes to a tab');

    // the front door: TopoForge itself, opened on the shop's drawings, one page per directory project
    if (topoCsp && index && fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
      await page.goto(base + 'index.html'); await page.evaluate(() => localStorage.clear());
      await page.goto(base + 'index.html');
      const tf = () => page.frames().find((f) => /topology\/topoforge\/index\.html/.test(f.url()));
      await page.waitForFunction((name) => { const f = document.getElementById('topology'); const d = f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === name; }, index.doc, { timeout: 15000 });
      const tabs = await tf().evaluate(() => [...document.querySelectorAll('#pagetabs .ptab:not(.add)')].map((b) => b.textContent));
      for (const [id, p] of Object.entries(index.projects)) assert.ok(tabs.includes(p.name), `no tab in the drawing for ${id}`);
      assert.equal(tabs.length, index.pages.length);
      ok(`the home page opens TopoForge on the shop's drawings: ${tabs.length} tabs, one for each of the ${Object.keys(index.projects).length} directory projects`);
      await page.goto(base + 'index.html?drawing=quantum3d5#top');
      await page.waitForFunction(() => /quantum3d5/.test(document.getElementById('stage-msg').textContent), null, { timeout: 15000 });
      const cur = await tf().evaluate(() => window.TopoForge.doc.pages[window.TopoForge.doc.cur].name);
      assert.equal(cur, index.projects.quantum3d5.name);
      ok('index.html?drawing=<project> opens that project\'s page with TopoForge\'s own tab');
      for (const [pid, v] of Object.entries(index.processes || {})) {
        await page.goto(base + `index.html?drawing=process-${pid}#top`);
        await page.waitForFunction((p) => new RegExp(p).test(document.getElementById('stage-msg').textContent), pid, { timeout: 15000 });
        assert.equal(await tf().evaluate(() => window.TopoForge.doc.pages[window.TopoForge.doc.cur].name), v.name);
      }
      ok('each process opens as its own page in the drawing (BPMN)');
      // a working copy of the person's own is never replaced
      await tf().evaluate(() => { window.TopoForge.doc = { name: 'mine', pages: [{ name: 'P', nodes: [{ id: 'a', type: 'server', x: 0, y: 0, text: 'my box' }], links: [] }] }; });
      await page.evaluate(() => { const f = document.getElementById('topology'); f.contentWindow.dispatchEvent(new Event('beforeunload')); });
      await page.goto(base + 'index.html?ui=classic&drawing=gitcha'); await page.waitForTimeout(1500);
      assert.ok(!/load=/.test(tf().url()), 'the frame was given ?load= over a working copy: ' + tf().url());
      assert.equal(await tf().evaluate(() => window.TopoForge.doc.name), 'mine');
      assert.match(await page.textContent('#stage-msg'), /your own drawing/);
      await page.click('#stage-fresh');
      await page.waitForFunction((name) => { const d = document.getElementById('topology').contentWindow.TopoForge; return d && d.doc && d.doc.name === name; }, index.doc, { timeout: 15000 });
      ok('a working copy of your own is kept; "Start again" brings the shop\'s drawings back');
    }
    // the demos: each page, and each app that runs here, with no errors and nothing from another host
    for (const d of demoIds) {
      await page.goto(base + `demo/${d}/index.html`); await page.waitForTimeout(150);
      assert.ok(await page.isVisible('text=Made by'), d);
      if (fs.existsSync(path.join(out, 'demo', d, 'app', 'index.html'))) { await page.goto(base + `demo/${d}/app/index.html`); await page.waitForTimeout(2000); }
      if (d === 'NextTime-Dev' && fs.existsSync(path.join(out, 'demo', d, 'app', 'vendor'))) {
        assert.ok(await page.isVisible('button:has-text("Post New Need")'), 'NextTime did not render: Vue or its router did not run');
        await page.click('button:has-text("Map")'); await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 10000 });
        ok(`NextTime's demo runs here on the pinned Vue, Vue Router and MapLibre, map view included, at ${w}px`);
      }
    }
    ok(`${demoIds.length} demo pages and their apps load at ${w}px`);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    ok(`no request to another host from any page or demo at ${w}px`);
    assert.deepEqual(violations, [], 'policy violations: ' + violations.join(' | '));
    ok(`no policy violations or script errors at ${w}px`);
    if (shots) {
      fs.mkdirSync(shots, { recursive: true });
      for (const [nm, u, full] of [['home', 'index.html', false], ['obsmage', 'index.html#tab-obsmage', true], ['directory', 'directory.html', true], ['packages', 'packages.html', true]]) {
        await page.goto(base + u); await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(shots, `corwin-cloud-${nm}-${w}.png`), fullPage: full });
      }
    }
    await page.close();
  }
  // a missing feed: the badge stays hidden and nothing breaks
  feedMode = 'missing';
  { const mp = await browser.newPage(); const errs = [];
    mp.on('pageerror', (e) => errs.push(e.message));
    mp.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await mp.goto(base + 'directory.html'); await mp.waitForTimeout(1500);
    assert.equal(await mp.isHidden('[data-channel="about-corwin"]'), true, 'a badge shows with no feed');
    assert.deepEqual(errs, []); await mp.close(); feedMode = 'good';
    ok('with no feed the badge stays hidden and the page has no errors'); }
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
