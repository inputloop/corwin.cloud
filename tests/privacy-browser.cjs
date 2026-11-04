// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 11, the note on what this site keeps in the browser (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/privacy-browser.cjs
// Corwin, 2026-11-04: "Keep it, disclose it": keep the remembering on the device, say so in a note every page links,
// with a one-press "forget my settings". Here: what the pages keep in use is only what the note names; one press of
// Forget leaves the browser's storage empty of every name the note lists (this tab's, the drawing app's, the board's
// prefixes too) and says in the echo area what it removed; it asks first only when a drawing or a board holds work kept
// nowhere else (not the app's sample, not the shop's drawing unchanged); and the free frame's Options, Site and Navigator
// menus, classic's navigator and Customize, and the legend's Your drawing all reach the note.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const offsite = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
const staged = fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html')) && fs.existsSync(path.join(out, 'nav', 'index.json'));
const drawing = staged ? JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8')) : null;
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: shots ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource.*404/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) offsite.push(r.url()); });
  const dialogs = []; let answer = true;
  p.on('dialog', async (d) => { dialogs.push({ type: d.type(), text: d.message() }); if (answer) await d.accept(); else await d.dismiss(); });
  const fresh = async () => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  // the note's list, as the page gives it
  const note = () => p.evaluate(() => [...document.querySelectorAll('#kept [data-key]')].map((li) => ({ key: li.getAttribute('data-key'), prefix: li.getAttribute('data-kind') === 'prefix', store: li.getAttribute('data-store') })));
  const stored = (pg) => (pg || p).evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  const named = (list, store, k) => list.some((x) => x.store === store && (x.prefix ? k.indexOf(x.key) === 0 : k === x.key));
  const press = async () => { await p.click('#forget'); await p.waitForFunction(() => !document.getElementById('forget').disabled); await p.waitForTimeout(150); };
  const echo = () => p.evaluate(() => [document.getElementById('echo').textContent, document.getElementById('forget-said').textContent]);
  const app = () => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const homeReady = async (ui, there) => {
    if (!there) await p.goto(base + 'index.html' + (ui ? '?ui=' + ui : ''));
    await p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
    if (ui !== 'classic') { await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); }
    else await p.waitForSelector('#nav[data-ready]', { timeout: 10000 });
    await p.waitForTimeout(500);
  };

  // 1. the note itself: one heading, the list, the button, nothing sideways, at a desktop and a phone width
  await fresh();
  await p.goto(base + 'privacy.html');
  const L = await note();
  assert.ok(L.length >= 6, 'the note lists ' + L.length + ' names');
  assert.match((await echo())[1], /^This browser keeps none of these names now\.$/);
  for (const w of [1280, 390]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, b: document.getElementById('forget').getBoundingClientRect().width }));
    assert.ok(m.sw <= m.cw + 1, `the note scrolls sideways at ${w}: ${m.sw} > ${m.cw}`);
    assert.ok(m.b > 40, 'the button is not drawn');
    if (shots && w === 1280) await p.screenshot({ path: path.join(shots, 'r11-privacy-note-1280.png'), fullPage: true });
  }
  await p.setViewportSize({ width: 1280, height: 800 });
  ok(`the note: ${L.length} names in ${new Set(L.map((x) => x.store)).size} stores, the Forget button, no sideways scroll at 1280 and 390`);

  // 2. in use: what the pages keep is only what the note names (the home page in free, its options, the switch to
  //    classic in this tab, the drawing turned to another page and edited, the navigator)
  if (staged) {
    await fresh(); await homeReady('');
    await p.evaluate(() => { const b = document.querySelector('#ef-1 .ef-mb[data-menu="Options"]'); b.click(); const it = document.querySelector('#ef-1 .ef-pop [data-act="map-names"], #ef-1 .ef-pop [data-act^="map-"]'); if (it) it.click(); });
    await app().evaluate(() => { TopoForge.showPage(2); });
    await p.waitForTimeout(900);
    await Promise.all([p.waitForNavigation(), p.click('#ui-switch')]); await homeReady('classic', true);
    await app().evaluate(() => { edit(() => { P().nodes.push(makeNode('router', 5, 5, { text: 'kept here' })); }); render(); });
    await p.waitForTimeout(900);
    const s = await stored();
    assert.ok(s.local.includes('topoforge.autosave.v1') && s.local.includes('corwin.cloud.ui.v1') && s.session.includes('corwin.cloud.blink'), 'the pages kept less than expected: ' + JSON.stringify(s));
    const stray = [...s.local.filter((k) => !named(L, 'local', k)).map((k) => 'local ' + k), ...s.session.filter((k) => !named(L, 'session', k)).map((k) => 'session ' + k)];
    assert.deepEqual(stray, [], 'kept but not named in the note');
    ok(`in use, the pages keep only names the note lists: ${s.local.length} in local storage, ${s.session.length} in this tab's`);

    // 3. the visitor's own work: Forget asks first; Cancel keeps everything and says so; OK forgets it all, this tab's too
    await p.goto(base + 'privacy.html');
    assert.match((await echo())[1], /^This browser keeps \d+ names? from this list now\.$/);
    const before = await stored();
    answer = false; dialogs.length = 0; await press();
    assert.equal(dialogs.length, 1, 'no question before forgetting work kept only here');
    assert.match(dialogs[0].text, /your changes to the shop’s drawing/);
    assert.deepEqual(await stored(), before, 'Cancel removed something');
    assert.match((await echo())[0], /^Nothing was forgotten/);
    answer = true; dialogs.length = 0; await press();
    assert.equal(dialogs.length, 1);
    const after = await stored();
    assert.deepEqual(after, { local: [], session: [] }, 'Forget left names behind');
    const [e1, e2] = await echo();
    const m = /^Forgot (\d+) names this site kept in this browser: (.+)\.$/.exec(e1);
    assert.ok(m, 'the echo does not say what was forgotten: ' + e1);
    assert.equal(+m[1], before.local.length + before.session.length);
    assert.deepEqual(m[2].split(', ').sort(), [...before.local, ...before.session].sort());
    assert.equal(e2, e1, 'the line under the button and the echo area differ');
    if (shots) await p.screenshot({ path: path.join(shots, 'r11-privacy-forgot-1280.png'), clip: { x: 0, y: 0, width: 1280, height: 800 } });
    ok(`work kept only here: Forget asks first, Cancel keeps all ${before.local.length + before.session.length} names, OK forgets them all (this tab's too) and the echo area names each`);

    // 4. the shop's drawing unchanged (the app keeps it when only the page is turned) is not work: no question
    await fresh(); await homeReady('classic');
    await app().evaluate(() => { TopoForge.showPage(3); }); await p.waitForTimeout(900);
    assert.ok((await stored()).local.includes('topoforge.autosave.v1'), 'turning the page kept no autosave');
    await p.goto(base + 'privacy.html'); dialogs.length = 0; await press();
    assert.equal(dialogs.length, 0, 'Forget asked about the shop’s drawing, unchanged');
    assert.deepEqual(await stored(), { local: [], session: [] });
    ok('the shop’s drawing, kept but unchanged: Forget does not ask, and forgets it');
  }

  // 5. every listed name, prefixes too, forgotten in one press; the app's sample asks nothing; a board asks
  await fresh(); await p.goto(base + 'privacy.html');
  const seed = (list, extra) => p.evaluate(([list, extra]) => {
    for (const x of list) (x.store === 'session' ? sessionStorage : localStorage).setItem(x.prefix ? x.key + 'seeded' : x.key, '1');
    for (const [k, v] of extra) localStorage.setItem(k, v);
  }, [list, extra]);
  const sample = { name: 'Sample office network', pages: [{ name: 'Page 1', nodes: Array.from({ length: 19 }, (_, i) => ({ id: 'n' + i, type: 'rect', text: '', x: i, y: 0, w: 1, h: 1 })), links: Array.from({ length: 15 }, (_, i) => ({ id: 'e' + i, a: 'n0', b: 'n1' })) }] };
  await seed(L.filter((x) => x.key !== 'topology-board:'), [['topoforge.autosave.v1', JSON.stringify(sample)]]);
  await p.reload();
  const all = await stored();
  dialogs.length = 0; await press();
  assert.equal(dialogs.length, 0, 'Forget asked about the app’s own sample');
  assert.deepEqual(await stored(), { local: [], session: [] }, 'names left after Forget');
  assert.equal(+/^Forgot (\d+)/.exec((await echo())[0])[1], all.local.length + all.session.length);
  await seed([], [['topology-board:my-plan', '{}'], ['topology-board:last', 'my-plan']]);
  answer = false; dialogs.length = 0; await press();
  assert.equal(dialogs.length, 1, 'no question before forgetting a board');
  assert.match(dialogs[0].text, /a board drawn on topology’s board/);
  answer = true; await press();
  assert.deepEqual(await stored(), { local: [], session: [] });
  await press();
  assert.match((await echo())[0], /^Nothing to forget: this site keeps nothing in this browser\.$/);
  ok(`every listed name (${all.local.length + all.session.length}, prefixes and this tab's included) goes in one press; the app's sample asks nothing, a board asks; with nothing kept it says so`);

  // 6. the links back: free's Options, Site and Navigator menus; classic's navigator Help and Customize; the legend
  if (staged) {
    const reach = async (href, frag) => {
      assert.ok(href, 'no link');
      const u = new URL(href, p.url());
      assert.equal(u.pathname, '/privacy.html', 'the link goes to ' + u.pathname);
      assert.equal(u.hash, frag);
      const q = await ctx.newPage(); await q.goto(u.href);
      const there = await q.evaluate((f) => !f || !!document.getElementById(f.slice(1)), frag); await q.close();
      assert.ok(there, 'the note has no ' + frag);
    };
    const menuLink = async (frame, menu, label) => p.evaluate(([frame, menu, label]) => {
      const b = document.querySelector(`${frame} .ef-mb[data-menu="${menu}"]`); if (!b) return null; b.click();
      const a = [...document.querySelectorAll(`${frame} .ef-pop a.ef-mi`)].find((x) => x.textContent.includes(label));
      const h = a ? a.getAttribute('href') : null; b.click(); return h;
    }, [frame, menu, label]);
    await fresh(); await homeReady('');
    await reach(await menuLink('#ef-1', 'Options', 'What these options keep in this browser'), '#layout');
    await reach(await menuLink('#ef-1', 'Site', 'What this site keeps in your browser'), '');
    const navF = await p.evaluate(() => { const f = [...document.querySelectorAll('section.ef')].find((e) => e.querySelector('.navframe')); return f ? '#' + f.id : null; });
    assert.ok(navF, 'no frame shows the navigator');
    await p.evaluate((f) => { const a = document.querySelector(f + ' .navframe a.it'); if (a) a.focus(); }, navF);
    await reach(await menuLink(navF, 'Navigator', 'What the navigator keeps in this browser'), '#layout');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]');
    await p.click('#ef-1 .ef-pop a.ef-mi[href$="privacy.html#layout"]');
    await p.waitForURL(/privacy\.html#layout$/);
    ok('free: Options, Site and the Navigator menu each link the note, and Options takes you there');
    await homeReady('classic');
    const navHelp = await p.evaluate(() => {
      const b = document.querySelector('#nav .menu-b[data-menu="Help"]'); if (!b) return null; b.click();
      const a = [...document.querySelectorAll('#nav a.mi')].find((x) => x.textContent.includes('What the navigator keeps')); return a ? a.getAttribute('href') : null;
    });
    await reach(navHelp, '#layout');
    await p.click('#custom-btn');
    const row = await p.evaluate(() => { const a = document.getElementById('c-ui-kept'); return a ? a.getAttribute('href') : null; });
    await reach(row, '#layout');
    assert.equal(await p.evaluate(() => { const a = document.querySelector('#custom-panel a[href="#privacy"]'); const t = document.getElementById('privacy'); return a ? !!(t && t.getAttribute('rel') === 'privacy-policy') : true; }), true, "Customize's own link lands nowhere");
    await p.click('#custom-btn');
    await p.evaluate(() => { const b = document.querySelector('.lg-more'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
    await p.click('#stage-kept');
    await p.waitForURL(/privacy\.html#drawing$/);
    ok("classic: the navigator's Help and Customize's layout row link the note's #layout; the legend's Your drawing takes you to #drawing");
  }

  assert.deepEqual(errs, [], 'errors: ' + errs.join(' | '));
  assert.deepEqual(offsite, [], 'asked another host: ' + offsite.join(' '));
  ok('no errors, nothing asked of another host');
  await browser.close(); server.close();
  console.log(`privacy browser checks: ${n} passed`);
})().catch((e) => { console.error('FAIL', e && e.stack || e); process.exit(1); });
