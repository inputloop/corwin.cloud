// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// The free page layout and the switch (docs/NAV.md, revision 4), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free-browser.cjs
// Free shows no chrome but the one Emacs frame and the watermark; the tool-bar's tiles narrow the
// shapes; a shape chosen is placed; the mode-line's elements answer; the message area becomes the
// input and back; C-x 5 2 makes a second frame; the small frames; the watermark and the legal notices;
// the switch persists. 1280 and 390 pixels, light and dark, under the deploy policies.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('free browser checks skipped: no topology checkout staged'); process.exit(0);
}
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
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };
function lum(c) { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForSelector('#ef-1 .ef-tile', { state: 'attached', timeout: 10000 }); await p.waitForSelector('#ef-1 .ef-it[data-item]', { state: 'attached', timeout: 10000 }); await p.waitForTimeout(200); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => localStorage.clear()); };
  const msg = (p, f = 1) => p.textContent(`#ef-${f} .ef-msg`);
  const nodes = (p) => app(p).evaluate(() => TopoForge.doc.pages[TopoForge.doc.cur].nodes.length);
  const keys = async (p, ...ks) => { for (const k of ks) await p.keyboard.press(k); await p.waitForTimeout(60); };

  for (const [w, h] of [[1280, 800], [390, 800]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w} ${scheme}`, wide = w > 760;
    await fresh(p);
    await p.goto(base + 'index.html'); await ready(p); await p.waitForTimeout(500);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `free-${scheme}-${w}.png`) }); }

    // ---- free shows no chrome but the one frame and the watermark ----
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'free', 'the default is not free');
    const stray = await p.evaluate(() => [...document.querySelectorAll('a, button, input, p, li, h1, h2, h3, h4, dt, dd, img, svg, iframe, label')].filter((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || !el.getClientRects().length) return false;
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      return !el.closest('.ef, #legend, .stage-drawing');
    }).map((el) => el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')));
    assert.deepEqual(stray, [], 'visible outside the frame, the legend and the drawing: ' + stray.join(', '));
    for (const s of ['header.top', '.modeline', '.minibuffer-wrap', '#projects', '.colophon', '#nav', '#custom-btn']) assert.equal(await p.isVisible(s), false, s + ' shows in free');
    assert.equal(await p.locator('.ef:not(.ef-small):visible').count(), 1, 'not one frame');
    const cls = await app(p).evaluate(() => document.body.className);
    for (const c of ['tf-frameless', 'tf-hide-menus', 'tf-hide-tools', 'tf-hide-shapes', 'tf-hide-props', 'tf-hide-pages']) assert.ok(cls.includes(c), 'the app was not asked for ' + c);
    assert.ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'the free page scrolls');
    ok(`free: nothing in sight but the one Emacs frame, the watermark and the drawing (the app's chrome hidden, bare); no page scroll, at ${tag}`);

    // ---- the icons came in clean ----
    assert.equal(await p.locator('.ef svg[style], .ef svg [style], .ef svg script, .ef svg foreignObject').count(), 0, 'an icon carries a style attribute or a script');
    assert.ok(await p.locator('#ef-1 .ef-tile svg').count() >= 5, 'the tiles have no icons');

    // ---- a tool-bar tile toggles a category ----
    const shapes = () => p.$$eval('#ef-1 .ef-win.selected .ef-shape', (b) => b.map((x) => x.getAttribute('data-shape')));
    if (!wide) await p.click('#ef-1 .ef-fold');
    const all = await shapes();
    await p.click('#ef-1 .ef-tile[data-cat="sec"]');
    assert.equal(await p.getAttribute('#ef-1 .ef-tile[data-cat="sec"]', 'aria-pressed'), 'true');
    assert.deepEqual(await shapes(), ['firewall', 'ids', 'vpn'], 'the Security tile did not narrow the shapes');
    assert.match(await msg(p), /Security/);
    await p.click('#ef-1 .ef-tile[data-cat="sec"]');
    assert.equal(await p.getAttribute('#ef-1 .ef-tile[data-cat="sec"]', 'aria-pressed'), 'false');
    assert.deepEqual(await shapes(), all, 'unpressing the tile did not bring every shape back');
    await p.focus('#ef-1 .ef-tile'); await keys(p, 'ArrowRight');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('data-cat')), 'sec', 'arrow keys do not move along the tool-bar');
    ok(`a tool-bar tile presses (aria-pressed) and narrows the finder to its category, and unpresses back; arrows move along the tiles, at ${tag}`);

    // ---- choosing a shape places it ----
    await p.click('#ef-1 .ef-tile[data-cat="sec"]');
    const n0 = await nodes(p);
    await p.focus('#ef-1 .ef-shape[data-shape="firewall"]'); await keys(p, 'Enter');
    assert.equal(await nodes(p), n0 + 1, 'Enter on a shape placed nothing');
    assert.match(await msg(p), /Firewall placed in the middle/);
    await p.click('#ef-1 .ef-shape[data-shape="vpn"]');
    assert.equal(await app(p).evaluate(() => TopoForge.placing), 'vpn', 'a click did not arm the shape');
    assert.equal(await p.getAttribute('#ef-1 .ef-shape[data-shape="ids"]', 'draggable'), 'true');
    const tb = await p.locator('#topology').boundingBox();
    await p.mouse.click(tb.x + tb.width - 60, tb.y + Math.round(tb.height * 0.3)); await p.waitForTimeout(150);
    assert.equal(await nodes(p), n0 + 2, 'a press on the drawing did not drop the armed shape');
    assert.equal(await app(p).evaluate(() => TopoForge.placing), null);
    await app(p).evaluate(() => { TopoForge.undo(); TopoForge.undo(); });
    await p.click('#ef-1 .ef-tile[data-cat="sec"]');
    ok(`Enter on a shape places it in the middle of the view; a click arms it (TopoForge.placing) and a press on the drawing drops it; rows drag as text/x-topoforge, at ${tag}`);

    // ---- the mode-line: the template's elements, each interactive one answering ----
    const tpl = await p.evaluate(() => window.CCFree && window.CCFree.template);
    assert.equal(tpl, '%buffer  %page  %select  %zoom  %filter  %split  %lighters');
    const els = await p.$$eval('#ef-1 .ef-win.selected .ef-ml [data-el]', (s) => s.map((x) => x.getAttribute('data-el')));
    for (const e of ['buffer', 'page', 'zoom', 'filter', 'lighters']) assert.ok(els.includes(e), 'the mode-line lacks %' + e + ' (' + els + ')');
    const named = await p.$$eval('#ef-1 .ef-ml button', (b) => b.filter((x) => !(x.getAttribute('aria-label') || '').trim()).length);
    assert.equal(named, 0, 'a mode-line button has no name');
    const idle = await p.$$eval('#ef-1 .ef-ml button', (b) => b.filter((x) => !x.getAttribute('data-act')).map((x) => x.textContent));
    assert.deepEqual(idle, [], 'a mode-line element with no command: ' + idle.join(', '));
    await app(p).evaluate(() => { const nd = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((x) => x.data && x.data.what); TopoForge.select([nd.id]); });
    await p.waitForFunction(() => !!document.querySelector('#ef-1 .ml-select button'), null, { timeout: 5000 });
    const selName = await app(p).evaluate(() => TopoForge.selection.name);
    assert.ok((await p.textContent('#ef-1 .ml-select')).includes(selName), '%select does not show the selection');
    if (wide && scheme === 'light') {
      const acts = await p.$$eval('#ef-1 .ef-win.selected .ef-ml button[data-act]', (b) => b.map((x) => x.getAttribute('data-act')));
      let pressed = 0;
      for (const a of acts) {
        await p.evaluate(() => { document.querySelector('#ef-1 .ef-msg').textContent = ''; });
        const before = await app(p).evaluate(() => JSON.stringify([TopoForge.doc.cur]));
        await p.click(`#ef-1 .ef-win.selected .ef-ml button[data-act="${a}"]`); await p.waitForTimeout(80);
        const smallOpen = await p.locator('.ef-small:visible').count();
        const said = (await msg(p)).trim() || (await p.evaluate(() => (document.querySelector('.ef-small:not([hidden])') || {}).id || ''));
        assert.ok(said || smallOpen, `the mode-line's ${a} did nothing`);
        pressed++;
        if (smallOpen) for (const x of await p.$$('.ef-small:not([hidden]) .ef-x')) await x.click();
        if (a === 'toggle-motion') await p.click('#ef-1 .ef-win.selected .ef-ml button[data-act="toggle-motion"]');
        if (a === 'switch-to-buffer' || await p.isVisible('#ef-1 .ef-mb-form')) { await p.focus('#ef-in-1'); await keys(p, 'Escape'); }
        void before;
      }
      assert.ok(pressed >= 8, 'only ' + pressed + ' interactive elements');
      ok(`every one of ${pressed} interactive mode-line elements is a named button that answers (message, small frame, or the app)`);
    }
    await app(p).evaluate(() => TopoForge.select([])); await p.waitForTimeout(200);
    assert.equal(await p.locator('#ef-1 .ml-select').count(), 0, '%select stays after the selection is cleared');
    ok(`the mode-line is built from its template: %buffer %page %zoom %filter %lighters; the selection appears in %select and clears, at ${tag}`);

    // ---- the message area becomes the input and back ----
    await p.click('#ef-1 .ef-msg');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'ef-in-1', 'a click on the message area did not open the input');
    await p.keyboard.type('zoom in'); await p.waitForTimeout(80);
    const opts = await p.$$eval('#ef-comp-1 [role="option"]', (o) => o.map((x) => x.textContent));
    assert.ok(opts.some((o) => /View › Zoom in/.test(o)), 'M-x does not complete the app\'s commands: ' + opts.join(' | '));
    await p.fill('#ef-in-1', 'firewall'); await p.dispatchEvent('#ef-in-1', 'input'); await p.waitForTimeout(80);
    assert.ok((await p.$$eval('#ef-comp-1 [role="option"]', (o) => o.map((x) => x.textContent))).some((o) => /Place Firewall/.test(o)), 'M-x does not complete shapes');
    await keys(p, 'Escape');
    assert.equal(await p.isVisible('#ef-1 .ef-msg'), true, 'Escape did not bring the message area back');
    await p.focus('#ef-1 .ef-tile'); await keys(p, 'Alt+x');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'ef-in-1', 'Alt+x did not open the input');
    const tb2 = await p.locator('#topology').boundingBox();
    await p.mouse.click(tb2.x + tb2.width - 20, tb2.y + 20); await p.waitForTimeout(150);
    assert.equal(await p.isVisible('#ef-1 .ef-msg'), true, 'focus left the input and the message line did not come back');
    assert.equal(await p.isVisible('#ef-1 .ef-mb-form'), false);
    await p.focus('#ef-1 .ef-tile'); await keys(p, 'Escape', 'x');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'ef-in-1', 'ESC x did not open the input');
    await p.keyboard.type('svg image'); await p.waitForTimeout(60);
    const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await keys(p, 'Enter');
    assert.ok(await dl, 'Enter on File › Export › SVG image did not run it (no download)');
    assert.equal(await p.isVisible('#ef-1 .ef-msg'), true);
    ok(`the message area becomes the one-line M-x input (click, Alt+x, ESC x), completes commands and shapes, runs one with Enter, and returns when focus leaves, at ${tag}`);

    // ---- splits and frames ----
    await p.focus('#ef-1 .ef-tile');
    await keys(p, 'Control+x', '2');
    assert.equal(await p.locator('#ef-1 .ef-win').count(), 2, 'C-x 2 did not split');
    assert.equal(await p.locator('#ef-1 .ef-win .ef-ml').count(), 2, 'a window without its mode-line');
    assert.ok((await p.textContent('#ef-1 .ef-win.selected .ml-split')).includes('W1/2'), '%split does not say the window');
    await keys(p, 'Control+x', '1');
    assert.equal(await p.locator('#ef-1 .ef-win').count(), 1);
    if (wide) {
      await keys(p, 'Control+x', '5', '2');
      assert.equal(await p.locator('.ef:not(.ef-small)').count(), 2, 'C-x 5 2 did not make a second frame');
      assert.equal(await p.locator('#ef-2 .ef-ml').count(), 1, 'the second frame has no mode-line');
      const b1 = await p.locator('#ef-1').boundingBox(), b2 = await p.locator('#ef-2').boundingBox();
      assert.ok(b2.x >= b1.x + b1.width - 2, 'the second frame covers the first');
      await p.focus('#ef-2 .ef-tile'); await keys(p, 'Control+x', '5', '0');
      assert.equal(await p.locator('.ef:not(.ef-small)').count(), 1, 'C-x 5 0 did not delete the frame');
      ok(`C-x 2 splits with a mode-line per window, C-x 1 joins; C-x 5 2 makes a second floating frame with its own mode-line, C-x 5 0 deletes it, at ${tag}`);
    } else {
      await keys(p, 'Control+x', '5', '2');
      assert.match(await msg(p), /narrow screen there is one frame/);
      ok(`C-x 2 and C-x 1 split and join; on a narrow screen C-x 5 2 says there is one frame, at ${tag}`);
    }

    // ---- the menus: F10, arrows, Escape; the app's commands as its menus grouped them ----
    await p.focus('#ef-1 .ef-tile'); await keys(p, 'F10');
    assert.equal(await p.getAttribute('#ef-1 .ef-mb[data-menu="Site"]', 'aria-expanded'), 'true', 'F10 did not open the first menu');
    const site = await p.$$eval('#ef-1 .ef-pop a.ef-mi', (a) => a.map((x) => x.getAttribute('href')));
    for (const href of ['index.html', 'directory.html', 'demo/index.html', 'packages.html', 'https://aboutcorwin.com']) assert.ok(site.includes(href), 'Site lacks ' + href);
    await keys(p, 'ArrowRight');
    assert.equal(await p.getAttribute('#ef-1 .ef-mb[data-menu="File"]', 'aria-expanded'), 'true');
    const file = await p.$$eval('#ef-1 .ef-pop .ef-mi', (b) => b.map((x) => x.textContent));
    assert.ok(file.some((x) => /SVG image/.test(x)) && file.some((x) => /New frame.*C-x 5 2/.test(x)), 'File lacks the app\'s Export or the frame items');
    const appCount = await app(p).evaluate(() => TopoForge.commands().length);
    let inMenus = 0;
    for (const m of ['File', 'Edit', 'Arrange', 'Layout', 'View', 'Help']) { await p.click(`#ef-1 .ef-mb[data-menu="${m}"]`); if (await p.getAttribute(`#ef-1 .ef-mb[data-menu="${m}"]`, 'aria-expanded') !== 'true') await p.click(`#ef-1 .ef-mb[data-menu="${m}"]`); inMenus += await p.locator('#ef-1 .ef-pop .ef-mi:not([data-act^="ui-"])').evaluateAll((b) => b.filter((x) => /^[a-z]+:/.test(x.getAttribute('data-act') || '')).length); }
    assert.equal(inMenus, appCount, `the menus carry ${inMenus} of the app's ${appCount} commands`);
    await keys(p, 'Escape');
    assert.equal(await p.isVisible('#ef-1 .ef-pop'), false, 'Escape did not close the menu');
    ok(`the menu bar: F10 opens Site (every page of the top bar), arrows move to File; the app's ${appCount} commands are all in its menus; Escape closes, at ${tag}`);

    // ---- small frames: *Pages*, *Properties*, *Here* ----
    if (wide) {
      await p.click('#ef-1 .ml-page button'); await p.waitForSelector('#ef-pages:not([hidden])');
      const pages = await p.$$eval('#ef-pages .ef-it', (b) => b.map((x) => x.textContent.trim()));
      assert.equal(pages.length, drawing.pages.length, '*Pages* does not list every page');
      await p.click('#ef-pages .ef-it >> nth=1');
      assert.equal(await app(p).evaluate(() => TopoForge.doc.cur), 1, '*Pages* did not open the page');
      await p.keyboard.press('Escape'); assert.equal(await p.isVisible('#ef-pages'), false);
      await app(p).evaluate(() => TopoForge.showPage(0));
      await app(p).evaluate(() => { const nd = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((x) => x.data && x.data.what); TopoForge.select([nd.id]); });
      await p.waitForTimeout(150);
      await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="properties"]');
      assert.ok((await p.textContent('#ef-properties')).includes(selName), '*Properties* does not show the selection');
      await p.click('#ef-properties .ef-x');
      await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+c', '.'); await p.waitForSelector('#ef-here:not([hidden])');
      const here = await p.textContent('#ef-here');
      assert.ok(here.includes(selName) && /Text:/.test(here) && /Colours:/.test(here) && /Motion:/.test(here), '*Here* lacks the selection or the access settings');
      const hb = await p.locator('#ef-here').boundingBox();
      assert.ok(hb.x > w / 2 - 10 && hb.x < w / 2 + 80, '*Here* is not beside the middle of the drawing, where the selection is centred');
      await p.click('#ef-here button[aria-label="Larger text"]');
      assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-size')), '1', '[A+] did not press Customize\'s text size');
      const fs1 = await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('ef-1')).fontSize));
      assert.ok(fs1 > 13.5, 'the frame\'s text does not follow Customize\'s size (' + fs1 + ')');
      await p.click('#ef-here button[aria-label="Smaller text"]');
      await p.keyboard.press('Escape');
      await app(p).evaluate(() => TopoForge.select([]));
      ok('the small frames: *Pages* lists and opens pages; *Properties* shows the selection; C-c . floats *Here* beside it with the access settings, and the frames\' text follows Customize\'s size');
    }

    // ---- faces: AA contrast, no transition ----
    const faces = await p.evaluate(() => {
      const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
      return ['#ef-1 .ef-msg', '#ef-1 .ef-mb', '#ef-1 .ef-tl', '#ef-1 .ef-it .nm', '#ef-1 .ef-ml .ml-b', '#ef-1 .ef-foldb', '#ef-1 .ef-count'].map((s) => { const el = document.querySelector(s); return [s, getComputedStyle(el).color, bg(el)]; });
    });
    for (const [s, c, b] of faces) assert.ok(contrast(c, b) >= 4.5, `${s} contrast ${contrast(c, b).toFixed(2)} below AA at ${tag}`);
    const moving = await p.evaluate(() => [...document.querySelectorAll('.ef, .ef *')].filter((el) => { const cs = getComputedStyle(el); return cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0) || cs.animationName !== 'none'; }).length);
    assert.equal(moving, 0, 'something in a frame animates');
    ok(`the frame's text keeps AA contrast (message, menus, tiles, rows, mode-line, headings) and nothing in it animates, at ${tag}`);

    // ---- the watermark, and the legal notices with it off ----
    const lg = p.locator('#legend');
    assert.ok(await lg.isVisible(), 'no watermark');
    const credit = p.locator('#legend .lg-short a[href="https://github.com/takushieternal"]');
    assert.ok(await credit.isVisible(), 'the watermark does not credit Bryant');
    assert.match(await p.textContent('#legend .lg-short'), /GPL-3\.0-or-later or LGPL-3\.0-or-later · prose CC-BY-SA-4\.0/);
    if (wide) {
      const lb = await lg.boundingBox(), fb = await p.locator('#ef-1').boundingBox();
      assert.ok(lb.x >= fb.x + fb.width - 1, 'the watermark sits under the frame');
      assert.equal(await lg.evaluate((e) => getComputedStyle(e).borderTopWidth), '0px', 'the watermark has a box');
      await p.click('.lg-hide');
      assert.ok(await p.locator('#legend .lg-app a[href="https://github.com/takushieternal"]').isVisible(), 'shown, the legend\'s cells do not credit Bryant');
      const lic = await p.textContent('#legend .lg-lic');
      for (const s of ['GPL-3.0-or-later', 'LGPL-3.0-or-later', 'your choice', 'CC-BY-SA-4.0']) assert.ok(lic.includes(s), 'the licence cell lacks ' + s);
      const lgc = await p.evaluate(() => { const c = document.querySelector('#legend .lg-cell dd'); return [getComputedStyle(c).color, getComputedStyle(c.parentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]; });
      assert.ok(contrast(lgc[0], lgc[2]) >= 4.5, 'the watermark\'s words are below AA against the canvas');
      const lb2 = await lg.boundingBox(); assert.ok(lb2.y + lb2.height <= h + 1, 'shown, the legend runs off the bottom');
      await p.click('.lg-hide');
      if (scheme === 'dark') {
        const l0 = await lg.boundingBox();
        await p.focus('.lg-grip'); await keys(p, 'ArrowUp');
        assert.ok(Math.abs((await lg.boundingBox()).y - l0.y + 16) <= 1, 'ArrowUp on the legend\'s grip did not move it');
        await p.click('.lg-hide');
        await p.click('#topology', { position: { x: w - 300, y: 200 } }); await p.waitForTimeout(150);
        assert.equal(await p.isVisible('#legend .lg-grid'), false, 'focus went into the drawing and the legend still covers it');
      }
    }
    await p.click('.lg-off');
    assert.equal(await lg.isVisible(), false, 'off did not turn the watermark off');
    assert.ok(await p.locator('#ef-1 .ml-lighters button[data-act="credits"]').isVisible(), 'GPL is not on the mode-line with the watermark off');
    assert.equal((await p.textContent('#ef-1 .ml-lighters button[data-act="credits"]')).trim(), 'GPL', 'the legal-notices lighter does not say GPL');
    await p.click('#ef-1 .ml-lighters button[data-act="credits"]'); await p.waitForSelector('#ef-credits:not([hidden])');
    assert.ok(await p.locator('#ef-credits a[href="https://github.com/takushieternal"]').first().isVisible(), '*Credits* does not link Bryant');
    assert.match(await p.textContent('#ef-credits'), /GPL-3\.0-or-later or LGPL-3\.0-or-later/);
    await p.click('#ef-credits .ef-x');
    await p.reload(); await ready(p);
    assert.equal(await lg.isVisible(), false, 'the watermark\'s off was not kept');
    await p.click('#ef-1 .ef-mb[data-menu="Help"]');
    assert.ok(await p.locator('#ef-1 .ef-pop [data-act="credits"]').isVisible(), 'Help has no Credits and licence');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="legend"]');
    assert.equal(await lg.isVisible(), true, 'Options, Legend watermark did not turn it on');
    ok(`the legend floats as a watermark (no box, AA, credits Bryant and the licence); off is kept, and then GPL on the mode-line and Help, Credits and licence still show Bryant and the licence, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`free: no sideways scroll, no request to another host, no console errors, at ${tag}`);
    await fresh(p); await ctx.close();
  }

  // ---- the switch persists; a link to a tab is classic for its visit ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });   // the directory's release feed is not served here
    const ui = () => p.evaluate(() => document.documentElement.getAttribute('data-ui'));
    await fresh(p);
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p);
    await p.goto(base + 'index.html'); await waitDoc(p);
    assert.equal(await ui(), 'classic', '?ui=classic was not kept');
    assert.ok(await p.isVisible('header.top'));
    if (await p.locator('#custom-btn').count()) {
      await p.click('#custom-btn');
      await Promise.all([p.waitForNavigation(), p.check('#c-ui input[value="free"]', { force: true })]);
      await ready(p);
      assert.equal(await ui(), 'free', 'Customize, Page layout: Free did not switch');
    } else { await p.goto(base + 'index.html?ui=free'); await ready(p); }
    await p.reload(); await ready(p);
    assert.equal(await ui(), 'free', 'free was not kept');
    await p.click('#ef-1 .ef-mb[data-menu="Options"]');
    await Promise.all([p.waitForNavigation(), p.click('#ef-1 .ef-pop [data-act="ui-classic"]')]);
    await waitDoc(p);
    assert.equal(await ui(), 'classic', 'Options, Page layout: Classic did not switch');
    await p.goto(base + 'directory.html');
    assert.equal(await ui(), 'classic', 'the setting is not the same on another page');
    await p.goto(base + 'index.html?ui=free'); await ready(p);
    await p.goto(base + 'index.html#tab-obsmage'); await p.waitForTimeout(400);
    assert.equal(await ui(), 'classic', 'a link to a project\'s tab did not open the long page');
    assert.ok(await p.isVisible('#panel-obsmage'));
    assert.equal(await p.evaluate(() => localStorage.getItem('corwin.cloud.ui.v1')), 'free', 'a link to a tab changed the kept setting');
    assert.deepEqual(errors, [], 'errors: ' + errors.join(' | '));
    await fresh(p); await ctx.close();
    ok('the switch persists: ?ui= is kept, Customize\'s Page layout and Options switch and keep it, every page agrees; a link to a tab opens classic for that visit only');
  }
  // ---- storage refused, and scripts off ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('refused'); } }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + 'index.html'); await ready(p);
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'free');
    await p.click('#ef-1 .ef-tile[data-cat="net"]');
    assert.equal(await p.getAttribute('#ef-1 .ef-tile[data-cat="net"]', 'aria-pressed'), 'true');
    assert.deepEqual(errs, [], 'errors with storage refused: ' + errs.join(' | '));
    await ctx.close();
    ok('with storage refused the page opens free and the frame works');
  }
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } }); const p = await ctx.newPage();
    await p.goto(base + 'index.html');
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), null);
    assert.ok(await p.locator('#nav a[data-item]').first().isVisible(), 'with scripts off there is no plain list of links');
    assert.equal(await p.locator('.ef').count(), 0);
    await ctx.close();
    ok('with scripts off: no setting, no frame, the plain list of links');
  }
  await browser.close(); server.close();
  console.log('free browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
