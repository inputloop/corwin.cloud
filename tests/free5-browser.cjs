// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 5 of the home page ("yes, and": docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free5-browser.cjs
// The legend is one line in words; the frame moves and its width is kept; the menu bar, the mode-lines
// and the message area grow together; the navigator is back in free, beside the finder; the tool-bar is
// icons only with tooltips and names, in evenly spaced groups; the preview box; topology forge 1.9's hooks
// stay off with 1.8 and turn on with 1.9; the layout switch never moves. 1280 and 390, light and dark,
// under the deploy policies; no console errors, no request to another host.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 5 browser checks skipped: no topology checkout staged'); process.exit(0);
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
const near = (a, b, d = 1) => Math.abs(a - b) <= d;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForSelector('#ef-1 .ef-tile', { state: 'attached', timeout: 10000 }); await p.waitForFunction(() => window.CCNav, null, { timeout: 10000 }); await p.waitForTimeout(300); };
  // revision 5's lines grow together and its map preview is rings; since revision 7 both are settings (free7-browser.cjs checks the rest)
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('corwin.cloud.free.v1', JSON.stringify({ linesTogether: true, mapMode: 'rings' })); }); };
  const msg = (p, f = 1) => p.textContent(`#ef-${f} .ef-msg`);
  const keys = async (p, ...ks) => { for (const k of ks) await p.keyboard.press(k); await p.waitForTimeout(60); };
  const box = async (p, s) => { const b = await p.locator(s).boundingBox(); return b && { x: Math.round(b.x * 2) / 2, y: Math.round(b.y * 2) / 2, w: Math.round(b.width * 2) / 2, h: Math.round(b.height * 2) / 2 }; };
  // each of the three lines' number of lines, from its height (the frame's own rule)
  const lines = (p, f) => p.evaluate((sel) => {
    const r = document.querySelector(sel), lo = (el) => { const cs = getComputedStyle(el); const ch = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth); return Math.round((el.getBoundingClientRect().height - ch) / 24); };
    const msgEl = r.querySelector('.ef-mb-form:not([hidden])') || r.querySelector('.ef-msg');
    return { n: +r.getAttribute('data-lines'), menu: lo(r.querySelector('.ef-menubar')), msg: lo(msgEl), ml: [...r.querySelectorAll('.ef-win .ef-ml')].filter((x) => x.offsetHeight).map(lo) };
  }, `#ef-${f}`);

  for (const [w, h] of [[1280, 800], [390, 800]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w} ${scheme}`, wide = w > 760;
    await fresh(p);
    await p.goto(base + 'index.html'); await ready(p);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `r5-free-${scheme}-${w}.png`) }); }
    const first = wide ? [await box(p, '#ef-1'), await box(p, '#ef-2')] : null;   // the first visit's two frames

    // ---- 1. the legend: one line, in words ----
    const lg = await p.evaluate(() => { const l = document.querySelector('#legend .lg-line'); const cs = getComputedStyle(l); return { h: l.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight), text: l.innerText, color: cs.color, bg: getComputedStyle(document.body).backgroundColor, n: l.querySelectorAll('.lg-c').length }; });
    if (wide) assert.ok(lg.h <= lg.lh * 1.5 + 2, `the legend is not one line (${lg.h} for a line of ${lg.lh}) at ${tag}`);
    assert.ok(!/-or-later|-only|CC-BY-SA-|SPDX/.test(lg.text), 'a machine-formatted licence string in the legend: ' + lg.text);
    assert.ok(/^app\s*topology forge\s*by\s*Bryant Frankford/i.test(lg.text.trim()) && /GPLv3\+/.test(lg.text), 'the legend line does not credit the app and Bryant first, or lacks GPLv3+: ' + lg.text);
    assert.ok(lg.n >= 6, 'fewer than six compartments');
    assert.ok(contrast(lg.color, lg.bg) >= 4.5, 'the legend line is below AA');
    ok(`the legend is ${wide ? 'one line' : 'whole compartments'} of ${lg.n} hairline compartments, in words (GPLv3+, no SPDX string), Bryant first, AA, at ${tag}`);

    // ---- 2. no tool labels: names, tooltips on hover and focus, Escape ----
    const tools = await p.$$eval('#ef-1 .ef-tool', (b) => b.map((x) => ({ text: x.textContent.trim(), name: (x.getAttribute('aria-label') || '').trim(), tip: x.getAttribute('data-tip') || '' })));
    // (revision 10: Zoom out, Fit and Zoom in became the zoom slider, three buttons fewer: 12 in a wide frame, 11 at
    // 390, where there is no second frame to make)
    assert.ok(tools.length >= 11, 'only ' + tools.length + ' tools');
    assert.deepEqual(tools.filter((t) => t.text), [], 'a tool shows a label');
    assert.deepEqual(tools.filter((t) => !t.name || !t.tip), [], 'a tool has no accessible name or no tooltip');
    if (!wide) await p.click('#ef-1 .ef-fold');
    await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(80);
    assert.ok(await p.isVisible('#ef-tip'), 'no tooltip on hover');
    assert.match(await p.textContent('#ef-tip'), /Security shapes/);
    assert.equal(await p.getAttribute('#ef-1 .ef-tile[data-cat="sec"]', 'aria-describedby'), 'ef-tip');
    const tipc = await p.evaluate(() => { const t = document.getElementById('ef-tip'), cs = getComputedStyle(t); return [cs.color, cs.backgroundColor]; });
    assert.ok(contrast(tipc[0], tipc[1]) >= 4.5, 'the tooltip is below AA');
    // ---- 3. the preview box (1.8: the plain stand-in; with 1.9 staged, the app is told it is 1.8 for this) ----
    if (wide) {
      const vv = await app(p).evaluate(() => { const v = TopoForge.version; TopoForge.version = '1.8'; return v; });
      await p.mouse.move(w / 2, 5); await p.waitForTimeout(450); await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(80);
      assert.ok(await p.isVisible('#ef-hud'), 'no preview box on hover');
      const hud = await p.textContent('#ef-hud');
      assert.ok(/Security: 3 shapes/.test(hud) && /Firewall/.test(hud) && /stand-in/.test(hud), 'the preview box does not say the category and that it is a stand-in: ' + hud);
      const hc = await p.evaluate(() => { const t = document.querySelector('#ef-hud .ef-card-s'), cs = getComputedStyle(t); return [cs.color, getComputedStyle(document.body).backgroundColor]; });
      assert.ok(contrast(hc[0], hc[1]) >= 4.5, 'the preview box is below AA');
      const hb = await box(p, '#ef-hud'), mapb = await app(p).evaluate(() => TopoForge.panels().map);
      assert.ok(hb.x + hb.w <= mapb.x + 1, 'the preview box is not beside the overview map (on its left)');
      await app(p).evaluate((v) => { TopoForge.version = v; }, vv);
    }
    await p.mouse.move(w / 2, 5); await p.waitForTimeout(500);
    assert.equal(await p.isVisible('#ef-tip'), false, 'the tooltip stays after the pointer leaves');
    assert.equal(await p.isVisible('#ef-hud'), false, 'the preview box stays after the pointer leaves');
    // (revision 10: Zoom in is now the zoom slider; the undo half of the undo and redo pill is a tool button still)
    await p.focus('#ef-1 .ef-tool[data-act="edit::undo"]'); await p.waitForTimeout(60);
    assert.ok(await p.isVisible('#ef-tip'), 'no tooltip on keyboard focus');
    assert.match(await p.textContent('#ef-tip'), /Undo/);
    await keys(p, 'Escape');
    assert.equal(await p.isVisible('#ef-tip'), false, 'Escape did not dismiss the tooltip');
    // whatever is staged, an app that says 1.8 gets none of 1.9's hooks
    const v0 = await app(p).evaluate(() => { const v = TopoForge.version; TopoForge.version = '1.8'; return v; });
    const thinks = await p.evaluate(() => CCFree.nineteen());
    await app(p).evaluate((v) => { TopoForge.version = v; }, v0);
    assert.equal(thinks, false, 'the 1.9 hooks think 1.8 is 1.9');
    ok(`the tool-bar: ${tools.length} tools, no labels, each with a name and a tooltip on hover and focus (AA, Escape dismisses)${wide ? '; the preview box says the category above the overview map' : ''}; 1.9's hooks off with 1.8, at ${tag}`);

    // ---- 4. groups evenly spaced ----
    const spacing = async () => p.evaluate(() => {
      const rows = {}, issues = [];
      document.querySelectorAll('#ef-1 .ef-toolbar .ef-tool').forEach((b) => { const r = b.getBoundingClientRect(); const k = Math.round(r.top); (rows[k] = rows[k] || []).push({ l: r.left, r: r.right, g: b.closest('.ef-tg').getAttribute('data-group') }); });
      Object.values(rows).forEach((row) => {
        row.sort((a, b) => a.l - b.l);
        const inner = [];
        for (let i = 1; i < row.length; i++) { const gap = row[i].l - row[i - 1].r; if (row[i].g === row[i - 1].g) inner.push(gap); else if (gap > 30) issues.push('a gap of ' + gap + ' between groups ' + row[i - 1].g + ' and ' + row[i].g); }
        if (inner.length && Math.max(...inner) - Math.min(...inner) > 0.5) issues.push('uneven gaps in a row: ' + inner.join(','));
      });
      document.querySelectorAll('#ef-1 .ef-tg').forEach((g) => {
        const per = {}; g.querySelectorAll('.ef-tool').forEach((b) => { const k = Math.round(b.getBoundingClientRect().top); per[k] = (per[k] || 0) + 1; });
        const c = Object.values(per); if (c.length && Math.max(...c) - Math.min(...c) > 1) issues.push('group ' + g.getAttribute('data-group') + ' rows ' + c.join('/'));
      });
      return { issues, rows: Object.keys(rows).length };
    });
    let sp = await spacing();
    assert.deepEqual(sp.issues, [], 'tool-bar spacing: ' + sp.issues.join('; '));
    if (wide) {
      await p.focus('#ef-1 .ef-edge'); await keys(p, 'Home');
      sp = await spacing();
      assert.deepEqual(sp.issues, [], 'tool-bar spacing at the narrowest frame: ' + sp.issues.join('; '));
      assert.ok(sp.rows >= 3, 'the narrowest frame\'s tool-bar did not take more rows (' + sp.rows + ')');
    }
    ok(`tool-bar groups: even gaps inside each group, no gap wider than a tool between groups, a wrapped group's rows differ by at most one${wide ? ' (also at the narrowest frame, ' + sp.rows + ' rows)' : ''}, at ${tag}`);

    // ---- 5. the three lines grow together; width and place kept ----
    if (wide) {
      let L = await lines(p, 1);
      assert.ok(L.n >= 2, 'at the narrowest frame the three lines did not grow (' + JSON.stringify(L) + ')');
      assert.ok(L.menu === L.n && L.msg === L.n && L.ml.every((x) => x === L.n), 'the three lines are not in step: ' + JSON.stringify(L));
      await keys(p, 'End');
      const wMax = (await box(p, '#ef-1')).w;
      await p.evaluate(() => { document.querySelector('#ef-1 .ef-msg').textContent = 'short'; }); await p.waitForTimeout(100);
      L = await lines(p, 1);
      assert.ok(L.n === 1 && L.menu === 1 && L.msg === 1 && L.ml.every((x) => x === 1), 'widened, the three lines did not come back to one: ' + JSON.stringify(L));
      // a long message alone makes the menu bar and the mode-lines grow with it
      await p.mouse.move(w / 2, 5); await p.waitForTimeout(450);   // no pointer over a frame: in rings mode a hover writes its caption in the echo area
      await p.evaluate(() => { document.querySelector('#ef-1 .ef-mb[data-menu="Help"]').click(); document.querySelector('#ef-1 .ef-pop [data-act="describe-mode"]').click(); }); await p.waitForTimeout(100);
      L = await lines(p, 1);
      assert.ok(L.n >= 2 && L.menu === L.n && L.msg === L.n && L.ml.every((x) => x === L.n), 'a wrapping message did not grow the three lines together: ' + JSON.stringify(L));
      await p.evaluate(() => { document.querySelector('#ef-1 .ef-msg').textContent = 'short'; });
      await p.focus('#ef-1 .ef-edge'); await keys(p, 'ArrowLeft', 'ArrowLeft');
      const w1 = (await box(p, '#ef-1')).w;
      assert.ok(near(w1, wMax - 32), `the edge's arrow keys did not narrow the frame (${wMax} to ${w1})`);
      const g0 = await box(p, '#ef-1 .ef-grip');
      await p.mouse.move(g0.x + 5, g0.y + 8); await p.mouse.down(); await p.mouse.move(g0.x + 45, g0.y + 38, { steps: 4 }); await p.mouse.up();
      const f0 = await box(p, '#ef-1');
      assert.ok(near(f0.x, 8 + 40) && near(f0.y, 8 + 30), 'dragging the grip did not move the frame: ' + JSON.stringify(f0));
      const mb = await box(p, '#ef-1 .ef-menubar'), fold = await box(p, '#ef-1 .ef-fold');
      await p.mouse.move(fold.x - 6, mb.y + 6); await p.mouse.down(); await p.mouse.move(fold.x + 14, mb.y + 26, { steps: 4 }); await p.mouse.up();
      const f1 = await box(p, '#ef-1');
      assert.ok(near(f1.x, f0.x + 20) && near(f1.y, f0.y + 20), 'dragging the menu bar\'s empty part did not move the frame: ' + JSON.stringify(f1));
      await p.focus('#ef-1 .ef-grip'); await keys(p, 'ArrowRight');
      const f2 = await box(p, '#ef-1');
      await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+x', '{');
      assert.ok(near((await box(p, '#ef-1')).w, w1 - 16), 'C-x { did not narrow the frame');
      await p.reload(); await ready(p);
      const f3 = await box(p, '#ef-1');
      assert.ok(near(f2.x, f1.x + 16), 'ArrowRight on the grip did not move the frame 16 pixels');
      assert.ok(near(f3.x, f2.x) && near(f3.y, f2.y) && near(f3.w, w1 - 16), 'the place or the width was not kept: ' + JSON.stringify([f2, f3]));
      assert.equal(await p.getAttribute('#ef-1 .ef-edge', 'role'), 'separator');
      ok(`the three lines grow together (menu bar, every mode-line, message area: ${L.n} line widened, more at the narrowest) and back; the frame moves by its grip, its menu bar and arrow keys; its width by the edge and C-x {; both kept across a reload, at ${tag}`);
    } else {
      const L = await lines(p, 1);
      assert.ok(L.menu === L.n && L.msg === L.n && L.ml.every((x) => x === L.n), 'the three lines are not in step: ' + JSON.stringify(L));
      ok(`narrow: the frame at the foot, its three lines in step (${L.n}), at ${tag}`);
    }

    // ---- 6. the navigator is back in free ----
    if (wide) {
      assert.deepEqual(await p.evaluate(() => CCFree.navAt()), { frame: 2, win: 1 }, 'the navigator is not in frame 2 on a first visit');
      const [a, b] = first;
      assert.ok(b.x >= a.x + a.w - 1 || a.x >= b.x + b.w - 1, 'the two frames overlap: ' + JSON.stringify([a, b]));
      await p.evaluate(() => { const f = CCFloat.get('frame1'); f.set({ w: 440 }, true); f.reset(); });   // back where it started, beside frame 2
      for (const s of ['#ef-2 .navframe .tb', '#nav-q', '#ef-2 .navframe .win', '#ef-2 .ef-win .ef-ml']) assert.ok(await p.locator(s).first().isVisible(), 'the navigator in free lacks ' + s);
      assert.match(await p.textContent('#ef-2 .ef-win[data-buf="navigator"] > .ef-ml .ml-buffer'), /\*navigator\*/);
      await p.click('#ef-2 .navframe .win');
      assert.ok(await p.isVisible('#ef-2 .ef-mb[data-menu="Navigator"]'), 'no Navigator menu while its window is selected');
      await p.click('#ef-2 .tb[data-facet="show"][data-val="projects"]');
      await p.fill('#nav-q', 'topology'); await p.dispatchEvent('#nav-q', 'input'); await p.waitForTimeout(120);
      const items = await p.$$eval('#ef-2 .navframe .win a.it', (x) => x.map((y) => y.getAttribute('data-id')));
      assert.ok(items.includes('project-topology') && items.length < 10, 'Projects + "topology" did not narrow the navigator: ' + items.join(','));
      assert.match(await p.textContent('#ef-2 .ef-win[data-buf="navigator"] > .ef-ml .ml-filter'), /topology/);
      const page0 = await app(p).evaluate(() => TopoForge.doc.cur);
      await p.click('#ef-2 .navframe .win a.it[data-id="project-topology"]'); await p.waitForTimeout(150);
      assert.notEqual(await app(p).evaluate(() => TopoForge.doc.cur), page0, 'a navigator item did not change the drawing\'s page');
      await p.fill('#nav-q', ''); await p.dispatchEvent('#nav-q', 'input'); await p.click('#ef-2 .tb[data-facet="show"][data-val="projects"]');
      // C-x 3 in frame 1, then the other window shows *navigator*: both views side by side in one frame
      await p.focus('#ef-1 .ef-edge'); await keys(p, 'End');
      await p.mouse.move(w / 2, 3);   // the pointer off the frames: a finder that appears under it would preview (rings) and take the echo area
      await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+x', '3', 'Control+x', 'o', 'Control+x', 'b');
      await p.keyboard.type('*navigator*'); await keys(p, 'Enter');
      assert.deepEqual(await p.evaluate(() => CCFree.navAt()), { frame: 1, win: 2 }, 'C-x b *navigator* did not move it to frame 1\'s other window');
      const l = await box(p, '#ef-1 .ef-win[data-buf="finder"]'), r = await box(p, '#ef-1 .ef-win[data-buf="navigator"]');
      assert.ok(near(l.y, r.y) && r.x >= l.x + l.w - 2, 'finder and navigator are not side by side in one frame');
      assert.equal(await p.locator('#ef-2 .ef-win[data-buf="finder"]').count(), 1, 'frame 2 did not fall back to *finder*');
      assert.match(await msg(p), /moved here from frame 2/);
      await keys(p, 'Control+x', '1');
      await p.focus('#ef-2 .ef-tile, #ef-2 .ef-it').catch(() => {});
      ok(`free: *navigator* is back, in frame 2 beside frame 1 (its categories, Narrow, windows, mode-line, Navigator menu); Projects + "topology" narrows it, an item opens its page; C-x 3 and C-x b put finder and navigator side by side in one frame, at ${tag}`);
    } else {
      await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+x', 'b');
      await p.keyboard.type('*navigator*'); await keys(p, 'Enter');
      assert.deepEqual(await p.evaluate(() => CCFree.navAt()), { frame: 1, win: 1 }, 'C-x b *navigator* did not show it on a narrow screen');
      assert.ok(await p.locator('#nav-q').isVisible(), 'the navigator is not visible on a narrow screen');
      ok(`narrow: C-x b shows *navigator* in the one frame, at ${tag}`);
    }

    // ---- 7. the layout switch never moves ----
    const s0 = await box(p, '#ui-switch');
    assert.ok(s0, 'no layout switch in free');
    assert.equal(await p.getAttribute('#ui-switch', 'aria-checked'), 'false');
    assert.ok((await p.getAttribute('#ui-switch', 'aria-label')).length > 3);
    await Promise.all([p.waitForNavigation(), p.click('#ui-switch')]);
    await waitDoc(p); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'classic');
    const s1 = await box(p, '#ui-switch');
    assert.deepEqual(s1, s0, 'the switch moved when it was pressed (free to classic)');
    assert.equal(await p.getAttribute('#ui-switch', 'aria-checked'), 'true');
    const cb = await box(p, '#custom-btn');
    if (cb) assert.ok(s1.y >= cb.y + cb.h - 0.5 || s1.x + s1.w <= cb.x + 0.5, 'the switch overlaps Customize in classic');
    assert.ok(await p.isVisible('header.top') && await p.locator('.ef').count() === 0, 'classic is not classic');
    if (shots) await p.screenshot({ path: path.join(shots, `r5-classic-blink-${scheme}-${w}.png`) });
    await Promise.all([p.waitForNavigation(), p.click('#ui-switch')]);
    await ready(p);
    assert.deepEqual(await box(p, '#ui-switch'), s0, 'the switch moved when it was pressed back (classic to free)');
    const p2 = await ctx.newPage();
    await p2.goto(base + 'index.html?ui=classic'); await waitDoc(p2);
    assert.equal(await p2.locator('#ui-switch').count(), 0, 'classic not reached by the switch shows it');
    await p2.goto(base + 'index.html?ui=free'); await p2.close();
    ok(`the layout switch keeps its box (${s0.x},${s0.y} ${s0.w}x${s0.h}) through free, classic and free again; it clears Customize; a classic visit not reached by it shows only Customize, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 5: no sideways scroll, no request to another host, no console errors in free or classic, at ${tag}`);
    await fresh(p); await ctx.close();
  }

  // ---- 1.9's hooks turn on with 1.9: the preview goes to the app ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    await app(p).evaluate(() => { window.__pv = []; TopoForge.version = '1.9'; TopoForge.preview = (x) => { window.__pv.push(x === null ? null : JSON.stringify(x)); }; });
    assert.equal(await p.evaluate(() => CCFree.nineteen()), true);
    await p.hover('#ef-1 .ef-tile[data-cat="net"]'); await p.waitForTimeout(80);
    await p.mouse.move(640, 5); await p.waitForTimeout(80);
    const pv = await app(p).evaluate(() => window.__pv);
    assert.deepEqual(pv.slice(0, 2), ['{"category":"net"}', null], 'with 1.9 the preview did not go to the app: ' + JSON.stringify(pv));
    assert.equal(await p.isVisible('#ef-hud'), false, 'with 1.9 the stand-in box still shows');
    await ctx.close();
    ok('with topology forge 1.9 (version and preview() there) the preview goes to the app: preview({ category }), then preview(null); the stand-in box stands down');
  }
  // ---- storage refused ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(() => { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { get() { throw new Error('refused'); } }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + 'index.html'); await ready(p);
    assert.ok(await p.isVisible('#ui-switch'), 'no switch with storage refused');
    assert.deepEqual(await p.evaluate(() => CCFree.navAt()), { frame: 2, win: 1 }, 'no navigator with storage refused');
    await p.focus('#ef-1 .ef-edge'); await keys(p, 'ArrowRight');
    assert.deepEqual(errs, [], 'errors with storage refused: ' + errs.join(' | '));
    await ctx.close();
    ok('with storage refused: the frames, the navigator, the edge and the switch work');
  }
  await browser.close(); server.close();
  console.log('revision 5 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
