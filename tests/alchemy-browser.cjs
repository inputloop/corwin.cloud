// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// alchemy.html in a browser (needs playwright):   SITE_OUT=dir [SHOTS=dir] node tests/alchemy-browser.cjs
// The server here answers a short address the way nginx's location / does ($uri, then $uri.html). Checked: the game
// builds from the decks file; every element of every deck can be found by play (each reaction pressed, in the order
// the fewest combinations reach it); split shows every way a thing is made and says first matter does not split;
// what was found survives a reload; a corrupt save starts fresh and says so; the two-press restart; a missing decks
// file is said in place of the game; Enter works the buttons; nothing reaches another host; no sideways scroll at 360px.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const out = process.env.SITE_OUT || path.join(__dirname, '..', 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(out, p);
  if (!isFile(f)) f = isFile(f + '.html') ? f + '.html' : path.join(f, 'index.html');   // try_files $uri $uri.html $uri/
  if (!f.startsWith(out) || !isFile(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'text/plain', 'Content-Security-Policy': STRICT });
  fs.createReadStream(f).pipe(res);
});
const data = JSON.parse(fs.readFileSync(path.join(out, 'alchemy-decks.json'), 'utf8'));
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };

function plan(d) {   // the reactions to press, in an order that only ever uses what is found
  const have = new Set(d.start), steps = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b, p] of d.rx) if (have.has(a) && have.has(b) && !have.has(p)) { steps.push([a, b, p]); have.add(p); changed = true; }
  }
  return steps;
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: shots ? 2 : 1 });
  const p = await ctx.newPage();
  const errs = [], offsite = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) offsite.push(r.url()); });

  await p.goto(base + 'alchemy');   // the short address
  await p.waitForSelector('.al-item');
  assert.equal(await p.title(), 'Alchemy: combine two things, or split one');
  ok('the short address /alchemy serves the page and the game builds');
  if (shots) await p.screenshot({ path: path.join(shots, 'alchemy-1-start.png'), fullPage: true });

  for (const d of data.decks) {
    await p.click(`.al-deck >> text="${d.title}"`);
    await p.click('.al-mode >> text="Combine"');
    assert.match(await p.textContent('.al-count'), new RegExp('^' + d.start.length + ' of ' + d.count + ' found'));
    for (const [a, b, prod] of plan(d)) {
      await p.click(`.al-item[data-id="${a}"]`);
      await p.click(`.al-item[data-id="${b}"]`);
      await p.waitForSelector(`.al-item[data-id="${prod}"]`, { timeout: 2000 });
    }
    assert.equal(await p.textContent('.al-count'), d.count + ' of ' + d.count + ' found: all of them.');
    ok(`${d.title}: all ${d.count} elements found by play, each through a reaction pressed`);
  }
  if (shots) await p.screenshot({ path: path.join(shots, 'alchemy-2-c4-done.png'), fullPage: true });

  const classic = data.decks.find((d) => d.id === 'classic');
  await p.click(`.al-deck >> text="${classic.title}"`);
  await p.click('.al-mode >> text="Split"');
  await p.click('.al-item[data-id="stone"]');
  assert.equal(await p.locator('.al-ways li').count(), classic.rx.filter((r) => r[2] === 'stone').length);
  await p.waitForFunction(() => /stone:/.test(document.getElementById('al-said').textContent));
  ok('split shows every way stone is made, and says them in the live region');
  await p.click('.al-item[data-id="air"]');
  await p.waitForFunction(() => /first matter: it does not split/.test(document.getElementById('al-said').textContent));
  ok('split on first matter says it does not split');
  if (shots) await p.screenshot({ path: path.join(shots, 'alchemy-3-split.png'), fullPage: true });

  await p.reload(); await p.waitForSelector('.al-item');
  assert.match(await p.textContent('.al-count'), new RegExp('^' + classic.count + ' of ' + classic.count));
  ok('what was found survives a reload, deck and all');

  await p.click('.al-reset'); assert.match(await p.textContent('.al-reset'), /Press again/);
  await p.click('.al-reset'); assert.match(await p.textContent('.al-count'), new RegExp('^4 of ' + classic.count));
  ok('the restart asks with a second press, then starts the deck from first matter');

  await p.click('.al-mode >> text="Combine"');
  await p.focus('.al-item[data-id="water"]'); await p.keyboard.press('Enter');
  await p.focus('.al-item[data-id="water"]'); await p.keyboard.press('Enter');
  await p.waitForSelector('.al-item[data-id="sea"]');
  ok('Enter works the buttons: water and water make sea');

  await p.evaluate(() => localStorage.setItem('corwin.cloud.alchemy.v1', '{not json'));
  await p.reload(); await p.waitForSelector('.al-item');
  await p.waitForFunction(() => /could not be read/.test(document.getElementById('al-said').textContent));
  ok('a corrupt save starts fresh and says so');
  const keys = await p.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(keys, ['corwin.cloud.alchemy.v1']);
  ok('the game keeps one name in this browser, the one privacy.html lists');

  const q = await ctx.newPage();
  await q.route('**/alchemy-decks.json', (r) => r.fulfill({ status: 404, body: 'no' }));
  await q.goto(base + 'alchemy.html');
  await q.waitForSelector('.al-off');
  assert.match(await q.textContent('.al-off'), /could not be loaded/);
  ok('a missing decks file is said in place of the game');

  const s = await browser.newPage({ viewport: { width: 360, height: 740 } });
  await s.goto(base + 'alchemy.html'); await s.waitForSelector('.al-item');
  const over = await s.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, 'sideways scroll at 360px: ' + over + 'px');
  ok('no sideways scroll at 360px wide');
  if (shots) await s.screenshot({ path: path.join(shots, 'alchemy-4-phone.png'), fullPage: true });

  assert.deepEqual(errs, []); assert.deepEqual(offsite, []);
  ok('no script errors, and nothing asked of another host');
  await browser.close(); server.close();
  console.log('alchemy-browser: ' + n + ' checks passed');
})().catch((e) => { console.error('not ok -', e.message); process.exit(1); });
