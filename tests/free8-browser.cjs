// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 8 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free8-browser.cjs
// Fit it: frame 2 never under the layout switch, from its first placement, at 1280x800, 1366x768, 1440x900
// and 1920x1080, light and dark (bounding boxes); the legend on the frames' first lines, not following
// them; the map mode slider drawn (a track, a thumb that glides with the switch's timing, still without
// motion, dragged to a stop); Reset layout and one Undo reset.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 8 browser checks skipped: no topology checkout staged'); process.exit(0);
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
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(600); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const keys = async (p, ...ks) => { for (const k of ks) await p.keyboard.press(k); await p.waitForTimeout(60); };
  const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== 'fixed') return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  const meets = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  const near = (a, b, d = 1.5) => ['x', 'y', 'r', 'b'].every((k) => Math.abs(a[k] - b[k]) <= d);
  const navSel = (p) => p.evaluate(() => { const f = [...document.querySelectorAll('section.ef:not(.ef-small)')].find((e) => e.querySelector('.navframe')); return f ? '#' + f.id : null; });
  const listen11 = (p) => p.evaluate(() => { window.__mm = []; window.__rs = []; window.addEventListener('message', (e) => { if (!e.data) return; if (e.data.type === 'topoforge:mapmode') window.__mm.push(e.data.detail.mode); if (e.data.type === 'topoforge:reset') window.__rs.push(e.data.detail); }); });
  const opt = async (p, act) => { await p.click('#ef-1 .ef-mb[data-menu="Options"]'); const b = p.locator(`#ef-1 .ef-pop [data-act="${act}"]`); if (!(await b.count())) { await p.keyboard.press('Escape'); return false; } await b.click(); await p.waitForTimeout(250); return true; };
  // every place frame 2 is drawn at while the page loads, against the switch (revision 8: never under it)
  // and whether the switch is there when the first frame is put on the page (ui.js makes it first)
  const recorder = () => { window.__swFirst = null; new MutationObserver((rs, mo) => { if (document.getElementById('ef-1')) { window.__swFirst = !!document.getElementById('ui-switch'); mo.disconnect(); } }).observe(document, { childList: true, subtree: true });
    window.__f2 = []; const tick = () => { const e = document.getElementById('ef-2'), s = document.getElementById('ui-switch');
    if (e && s && e.offsetWidth && s.offsetWidth) { const a = e.getBoundingClientRect(), b = s.getBoundingClientRect(); window.__f2.push([a.left, a.top, a.right, a.bottom, b.left, b.top, b.right, b.bottom]); }
    if (performance.now() < 6000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };

  for (const [w, h] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w}x${h} ${scheme}`;
    await p.addInitScript(recorder);
    await fresh(p); await p.goto(base + 'index.html'); await ready(p); await p.waitForTimeout(400);

    // ---- S6: fit it ----
    const sw = await box(p, '#ui-switch'), f2 = await box(p, '#ef-2'), f1 = await box(p, '#ef-1');
    assert.ok(sw && f2, 'no switch or no frame 2 at ' + tag);
    assert.ok(!meets(sw, f2) && f2.y >= sw.b, 'frame 2 is under the layout switch at ' + tag + ': ' + JSON.stringify([sw, f2]));
    assert.equal(await p.evaluate(() => window.__swFirst), true, 'the layout switch was not there when the first frame was placed at ' + tag);
    const seen = await p.evaluate(() => window.__f2);
    assert.ok(seen.length > 0, 'frame 2 was never seen while loading');
    const under = seen.filter((q) => q[0] < q[6] && q[4] < q[2] && q[1] < q[7] && q[5] < q[3]);
    assert.equal(under.length, 0, 'while loading, frame 2 was drawn under the switch ' + under.length + ' times at ' + tag + ': ' + JSON.stringify(under[0]));
    // the switch grows (a larger text, a zoom): a frame under it is put below it when that happens
    await p.evaluate(() => { document.getElementById('ui-switch').style.height = '3.5rem'; });
    await p.waitForTimeout(250);
    const sw2 = await box(p, '#ui-switch'), f2b = await box(p, '#ef-2');
    assert.ok(!meets(sw2, f2b), 'when the switch grew, frame 2 stayed under it at ' + tag + ': ' + JSON.stringify([sw2, f2b]));
    await p.evaluate(() => { document.getElementById('ui-switch').style.height = ''; });
    ok(`fit it: frame 2 starts below the layout switch (never drawn under it while loading, ${seen.length} frames seen) and moves below it when the switch grows, at ${tag}`);

    // ---- S5: the legend on the frames' first lines ----
    const lg = await box(p, '#legend'), H = await p.evaluate(() => document.getElementById('stage-grid').getBoundingClientRect().bottom);
    const mp = await p.evaluate(() => { const fr = document.getElementById('topology').getBoundingClientRect(), m = document.getElementById('topology').contentWindow.TopoForge.panels().map; return m && m.shown ? { x: m.x + fr.left, y: m.y + fr.top, r: m.x + m.w + fr.left, b: m.y + m.h + fr.top } : null; });
    assert.ok(Math.abs(lg.x - f1.x) <= 1, `the legend's left edge (${lg.x}) is not frame 1's first left edge (${f1.x}) at ${tag}`);
    assert.ok(Math.abs(H - lg.b - 8) <= 1, `the legend's foot is ${H - lg.b} above the drawing's, not 8 (the frames' gutter) at ${tag}`);
    assert.ok(Math.abs(f1.y - 8) <= 1 && Math.abs(w - f2.r - 8) <= 1, 'the frames do not start on the 8-pixel gutter: ' + JSON.stringify([f1, f2]));
    assert.ok(!meets(lg, mp), 'the legend meets the overview map at ' + tag);
    assert.ok(!meets(lg, f1), 'frame 1 starts over the legend at ' + tag);
    await p.evaluate(() => { CCFloat.get('frame1').set({ x: 140, y: 60, w: 520, h: 380 }, true); CCFloat.get('frame2').set({ x: 300, y: 200, w: 400 }, true); });
    await p.waitForTimeout(150);
    assert.ok(near(await box(p, '#legend'), lg), 'the legend followed the frames when they moved at ' + tag);
    ok(`the legend on the frames' first lines: left edge on frame 1's (${f1.x}), foot 8 above the drawing's, clear of the map; it stays when the frames move, at ${tag}`);
    if (shots && w === 1280) { fs.mkdirSync(shots, { recursive: true }); }

    // ---- S2: the slider, drawn ----
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `r8-fresh-${scheme}-${w}.png`) }); }
    const sl = '#ef-1 .ef-slider', tr = await box(p, '#ef-1 .ef-sl-track'), tb = await box(p, '#ef-1 .ef-toolbar, #ef-1 .ef-tb');
    assert.ok(tr && tr.w >= 48 && tr.h >= 8, 'the slider\'s track is not drawn: ' + JSON.stringify(tr));
    const hit = await p.evaluate((s) => { const t = document.querySelector(s + ' .ef-sl-track').getBoundingClientRect(); const e = document.elementFromPoint(t.left + 4, t.top + t.height / 2); return !!e && !!e.closest('.ef-slider'); }, sl);
    assert.ok(hit, 'the slider\'s track is covered or hidden at ' + tag);
    const thumbAt = async () => { const t = await box(p, '#ef-1 .ef-sl-thumb'), s = await box(p, sl); return Math.round(t.x + t.w / 2 - s.x); };
    await p.focus(sl); await keys(p, 'Home'); await p.waitForTimeout(350); const L = await thumbAt();
    await keys(p, 'ArrowRight'); await p.waitForTimeout(350); const C = await thumbAt();
    await keys(p, 'End'); await p.waitForTimeout(350); const R = await thumbAt();
    assert.ok(Math.abs(L - 16) <= 2 && Math.abs(C - 42) <= 2 && Math.abs(R - 68) <= 2, 'the thumb is not on the left, centre and right stops: ' + [L, C, R]);
    const tt = await p.evaluate(() => { const cs = getComputedStyle(document.querySelector('#ef-1 .ef-sl-thumb')); return [cs.transitionProperty, cs.transitionDuration, cs.transitionTimingFunction]; });
    assert.deepEqual(tt, ['left', '0.25s', 'ease'], 'the thumb does not glide with the layout switch\'s timing: ' + tt);
    // mid-glide the thumb is between stops (it glides, it does not jump)
    const mid = await p.evaluate(() => new Promise((res) => {
      const sl = document.querySelector('#ef-1 .ef-slider'), th = sl.querySelector('.ef-sl-thumb');
      sl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const t0 = performance.now();
      const look = () => { if (performance.now() - t0 < 90) return requestAnimationFrame(look); const a = th.getBoundingClientRect(), b = sl.getBoundingClientRect(); res(Math.round(a.left + a.width / 2 - b.left)); };
      requestAnimationFrame(look);
    }));
    await p.waitForTimeout(350);
    assert.ok(mid > 18 && mid < 66, 'the thumb jumped instead of gliding: ' + mid);
    // Motion off (the page's own button): it jumps
    await p.click('#ef-1 [data-act="toggle-motion"]');
    const still = await p.evaluate(() => getComputedStyle(document.querySelector('#ef-1 .ef-sl-thumb')).transitionDuration);
    assert.ok(parseFloat(still) <= 0.001, 'with Motion off the thumb still glides: ' + still);
    await p.click('#ef-1 [data-act="toggle-motion"]');
    // drag: from the left stop to the right one; the thumb follows the pointer, and let go sets Highlight matches
    const sb = await box(p, sl);
    await p.mouse.move(sb.x + 16, sb.y + sb.h / 2); await p.mouse.down();
    for (let i = 1; i <= 6; i++) await p.mouse.move(sb.x + 16 + i * 9, sb.y + sb.h / 2);
    const during = await thumbAt();
    assert.ok(during > 40, 'the thumb does not follow the pointer while dragged: ' + during);
    await p.mouse.move(sb.x + 70, sb.y + sb.h / 2); await p.mouse.up(); await p.waitForTimeout(350);
    assert.equal(await p.evaluate(() => CCFree.mapMode()), 'rings', 'a drag to the right stop did not set Highlight matches');
    assert.ok(Math.abs((await thumbAt()) - 68) <= 2, 'let go, the thumb did not settle on the right stop');
    await p.mouse.click(sb.x + 14, sb.y + sb.h / 2); await p.waitForTimeout(350);
    assert.equal(await p.evaluate(() => CCFree.mapMode()), 'cards', 'a press on the track\'s left end did not set Preview shapes');
    assert.equal(await p.getAttribute(sl, 'role'), 'slider');
    assert.match(await p.getAttribute(sl, 'aria-valuetext'), /^Preview shapes/);
    if (shots) await p.screenshot({ path: path.join(shots, `r8-slider-${scheme}-${w}.png`), clip: { x: Math.max(0, sb.x - 120), y: Math.max(0, sb.y - 40), width: 340, height: 110 } });
    await p.focus(sl); await keys(p, 'ArrowRight');
    ok(`the slider drawn: a ${tr.w}x${tr.h} track in the tool-bar, the thumb on the stops (${L}, ${C}, ${R}), gliding left over 0.25 s ease, still with Motion off, dragged to a stop, a press on the track, at ${tag}`);

    // ---- S4: Reset layout, Undo reset ----
    await fresh(p);
    await p.evaluate(() => localStorage.setItem('aboutcorwin.customize', JSON.stringify({ size: '2', measure: 'normal', leading: 'normal', theme: 'auto', calm: false })));
    await p.goto(base + 'index.html'); await ready(p);
    const custom0 = await p.evaluate(() => [localStorage.getItem('aboutcorwin.customize'), document.documentElement.getAttribute('data-size')]);
    const first = { f1: await box(p, '#ef-1'), nav: await box(p, await navSel(p)), lg: await box(p, '#legend') };
    await p.evaluate(() => CCFloat.get('frame1').set({ x: 160, y: 80, w: 520, h: 360 }, true)); await p.waitForTimeout(100);
    const moved = await box(p, '#ef-1');
    await p.focus(sl); await keys(p, 'End');
    await p.click('#ef-2 .ef-mb[data-menu="File"]'); await p.click('#ef-2 .ef-pop [data-act="delete-frame"]'); await p.waitForTimeout(200);
    assert.equal(await navSel(p), null, 'the navigator\'s frame did not close');
    assert.ok(await opt(p, 'reset-layout'), 'Options has no Reset layout at ' + tag);
    const navR = await navSel(p);
    assert.ok(navR, 'Reset layout did not reopen the navigator\'s frame');
    assert.ok(near(await box(p, '#ef-1'), first.f1), 'frame 1 is not back in its first box: ' + JSON.stringify([await box(p, '#ef-1'), first.f1]));
    assert.ok(near(await box(p, navR), first.nav), 'the navigator\'s frame is not back in its first box (under the switch): ' + JSON.stringify([await box(p, navR), first.nav]));
    assert.ok(near(await box(p, '#legend'), first.lg), 'the legend is not back on the frames\' lines');
    assert.equal(await p.evaluate(() => CCFree.mapMode()), 'both', 'Reset layout did not set the map mode back to Both');
    if (await app(p).evaluate(() => typeof TopoForge.mapMode === 'function')) assert.equal(await app(p).evaluate(() => TopoForge.mapMode().mode), 'both', 'the app\'s map mode did not follow the reset');
    assert.deepEqual(await p.evaluate(() => [localStorage.getItem('aboutcorwin.customize'), document.documentElement.getAttribute('data-size')]), custom0, 'Reset layout touched the text size setting');
    assert.ok(await opt(p, 'undo-reset'), 'Options has no Undo reset after a reset');
    assert.ok(near(await box(p, '#ef-1'), moved), 'Undo reset did not put frame 1 back where it was moved');
    assert.equal(await navSel(p), null, 'Undo reset did not close the navigator\'s frame again');
    assert.equal(await p.evaluate(() => CCFree.mapMode()), 'rings', 'Undo reset did not put the map mode back');
    assert.equal(await opt(p, 'undo-reset'), false, 'Undo reset is still offered after use (one level)');
    ok(`Reset layout puts frame 1, the navigator's frame (reopened), the legend and the map mode back to their first state, leaves the text size alone; Undo reset puts them back, once, at ${tag}`);

    // ---- stage 2 (topology forge 1.11): the map's pad, and Reset layout on both sides ----
    if (await app(p).evaluate(() => typeof TopoForge.resetLayout === 'function')) {
      await fresh(p); await p.goto(base + 'index.html'); await ready(p); await listen11(p);
      const A = () => app(p);
      const sw11 = await A().evaluate(() => { const e = TopoForge.embed(); return [e.mappad, e.reset]; });
      assert.deepEqual(sw11, [true, true], 'free did not turn on mappad and reset: ' + sw11);
      // the pad shows near the map, and meets neither the legend, frame 2 nor the switch
      const off = await p.evaluate(() => document.getElementById('topology').getBoundingClientRect().toJSON());
      const mm = await A().evaluate(() => document.getElementById('minimap').getBoundingClientRect().toJSON());
      await p.mouse.move(off.left + mm.left + 20, off.top + mm.top + 20); await p.waitForTimeout(300);
      const pad = await A().evaluate(() => { const e = document.getElementById('mmPad'); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; });
      assert.ok(pad, 'free has no map pad at ' + tag);
      const padP = { x: pad.x + off.left, y: pad.y + off.top, r: pad.r + off.left, b: pad.b + off.top };
      for (const sel of ['#legend', '#ef-2', '#ui-switch']) assert.ok(!meets(padP, await box(p, sel)), `the map pad meets ${sel} at ${tag}: ` + JSON.stringify([padP, await box(p, sel)]));
      // the legend's line ends three gutters (24 pixels) short of the pad: room for a longer revision string or a wider fallback font
      const lgP = await box(p, '#legend');
      assert.ok(lgP.r + 24 <= padP.x, `the legend runs to within ${Math.round(padP.x - lgP.r)} pixels of the map pad at ${tag} (24 wanted)`);
      if (shots) await p.screenshot({ path: path.join(shots, `r8s2-pad-${scheme}-${w}.png`) });
      // one setting: the page's slider moves the pad's, the pad's moves the page's, one message per change
      await p.evaluate(() => { window.__mm = []; });
      await p.focus('#ef-1 .ef-slider'); await keys(p, 'End'); await p.waitForTimeout(200);
      assert.equal(await A().evaluate(() => document.querySelector('#mmPad .mp-sl').getAttribute('aria-valuenow')), '2', 'the page\'s slider did not move the pad\'s');
      const mm1 = await p.evaluate(() => window.__mm.slice());
      assert.deepEqual(mm1, ['rings'], 'one change of the page\'s slider did not send exactly one topoforge:mapmode: ' + JSON.stringify(mm1));
      assert.doesNotMatch(await p.textContent('#ef-1 .ef-msg'), /from the map/, 'the page took its own change back from the app as the map\'s (an echo)');
      await A().locator('#mmPad .mp-sl').focus(); await A().locator('#mmPad .mp-sl').press('Home'); await p.waitForTimeout(200);
      assert.deepEqual(await p.evaluate(() => [document.querySelector('#ef-1 .ef-slider').getAttribute('aria-valuenow'), CCFree.mapMode()]), ['0', 'cards'], 'the pad\'s slider did not move the page\'s');
      assert.deepEqual(await p.evaluate(() => window.__mm.slice()), ['rings', 'cards'], 'the pad\'s change was echoed back (a loop)');
      await p.focus('#ef-1 .ef-slider'); await keys(p, 'ArrowRight'); await p.waitForTimeout(150);
      ok(`the map pad in free (mappad, reset on), clear of the legend, frame 2 and the switch; its slider and the page's are one setting, one message per change, at ${tag}`);
      // Reset from the page: the app too, once; Undo from the page: both back, once
      const first1 = await box(p, '#ef-1');
      const mapFirst = await A().evaluate(() => TopoForge.panels().map);
      await p.evaluate(() => CCFloat.get('frame1').set({ x: 180, y: 70, w: 500, h: 380 }, true)); await p.waitForTimeout(100);
      const moved1 = await box(p, '#ef-1');
      await A().evaluate(() => TopoForge.mapScale(3));
      await A().locator('#mmPad .mp-grip').focus(); await A().locator('#mmPad .mp-grip').press('Shift+ArrowUp'); await p.waitForTimeout(200);
      const mapMoved = await A().evaluate(() => TopoForge.panels().map);
      assert.ok(mapMoved.y < mapFirst.y - 30, 'the pad\'s grip did not move the map');
      await p.evaluate(() => { window.__rs = []; });
      assert.ok(await opt(p, 'reset-layout'));
      await p.waitForTimeout(300);
      const mapR = await A().evaluate(() => [TopoForge.panels().map, TopoForge.mapScale()]);
      assert.ok(Math.abs(mapR[0].y - mapFirst.y) <= 1 && mapR[0].w === 190 && mapR[0].h === 130 && mapR[1] === 1, 'Options, Reset layout did not reset the app\'s map: ' + JSON.stringify(mapR));
      assert.ok(near(await box(p, '#ef-1'), first1), 'Options, Reset layout did not reset frame 1 (with the app)');
      assert.equal((await p.evaluate(() => window.__rs.slice())).length, 1, 'not exactly one topoforge:reset for one reset');
      assert.ok(await opt(p, 'undo-reset'));
      await p.waitForTimeout(300);
      assert.ok(near(await box(p, '#ef-1'), moved1), 'Undo reset did not put frame 1 back (was the page reset twice?)');
      const mapU = await A().evaluate(() => [TopoForge.panels().map, TopoForge.mapScale()]);
      assert.ok(Math.abs(mapU[0].y - mapMoved.y) <= 1 && mapU[1] === 3, 'Undo reset did not put the app\'s map and scale back (was the app reset twice?): ' + JSON.stringify(mapU));
      // Reset from the app's own menu: the page's frames too; Undo from the page puts both back
      await p.evaluate(() => { window.__rs = []; });
      await A().evaluate(() => TopoForge.run('view::reset-layout')); await p.waitForTimeout(300);
      assert.ok(near(await box(p, '#ef-1'), first1), 'the app\'s Reset layout did not reset the page\'s frames');
      assert.equal(await A().evaluate(() => TopoForge.mapScale()), 1);
      assert.ok(await opt(p, 'undo-reset'), 'after the app\'s reset the page offers no Undo reset');
      await p.waitForTimeout(300);
      assert.ok(near(await box(p, '#ef-1'), moved1), 'the page\'s Undo did not put frame 1 back after the app\'s reset');
      assert.equal(await A().evaluate(() => TopoForge.mapScale()), 3, 'the page\'s Undo did not undo the app\'s reset');
      // Reset from the page, Undo from the app
      assert.ok(await opt(p, 'reset-layout')); await p.waitForTimeout(300);
      await A().evaluate(() => TopoForge.run('view::undo-reset')); await p.waitForTimeout(300);
      assert.ok(near(await box(p, '#ef-1'), moved1), 'the app\'s Undo reset did not put the page\'s frame back');
      assert.equal(await opt(p, 'undo-reset'), false, 'after the app\'s undo the page still offers Undo reset');
      ok(`Reset layout both ways: the page's resets the app (map 190x130, scale 1) and the app's resets the page; Undo from either side puts both back; one message each, nothing reset twice, at ${tag}`);
      // the pad's arrows: a page option (pan), kept, not touched by a reset
      assert.equal(await A().evaluate(() => TopoForge.padArrows()), 'mode-scale', 'the pad\'s arrows do not start as mode and scale');
      assert.ok(await opt(p, 'pad-pan'), 'Options has no Map pad: arrows pan the drawing');
      assert.equal(await A().evaluate(() => TopoForge.padArrows()), 'pan');
      await p.reload(); await ready(p);
      assert.equal(await A().evaluate(() => TopoForge.padArrows()), 'pan', 'the pad\'s arrows were not set again after a reload');
      assert.ok(await opt(p, 'reset-layout')); await p.waitForTimeout(200);
      assert.equal(await A().evaluate(() => TopoForge.padArrows()), 'pan', 'a reset changed the pad\'s arrows (a setting)');
      assert.ok(await opt(p, 'pad-pan'));
      assert.equal(await A().evaluate(() => TopoForge.padArrows()), 'mode-scale');
      ok(`Options, Map pad: arrows pan the drawing sets padArrows('pan'), kept across a reload, untouched by a reset, at ${tag}`);
      // an app without reset (1.10): the page's reset still sets the map mode back to Both, in the page and the app
      await A().evaluate(() => { window.__v = TopoForge.version; TopoForge.version = '1.10'; });
      await p.focus('#ef-1 .ef-slider'); await keys(p, 'End'); await p.waitForTimeout(150);
      assert.ok(await opt(p, 'reset-layout')); await p.waitForTimeout(250);
      assert.deepEqual([await p.evaluate(() => CCFree.mapMode()), await A().evaluate(() => TopoForge.mapMode().mode)], ['both', 'both'], 'with 1.10, Reset layout did not set the map mode back to Both');
      await A().evaluate(() => { TopoForge.version = window.__v; });
      const sw3 = await box(p, '#ui-switch');
      assert.ok(!meets(sw3, await box(p, await navSel(p))), 'after the resets, frame 2 is under the switch at ' + tag);
    } else ok(`stage 2 checks skipped: the staged app has no resetLayout, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 8 at ${tag}: no sideways scroll, no request to another host, no console errors`);
    await fresh(p); await ctx.close();
  }
  // ---- classic keeps its menus: no pad; the app's Reset layout in its View menu (stage 2) ----
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await fresh(p); await p.evaluate(() => localStorage.setItem('corwin.cloud.ui.v1', 'classic'));
    await p.goto(base + 'index.html'); await waitDoc(p); await p.waitForTimeout(800);
    if (await app(p).evaluate(() => typeof TopoForge.resetLayout === 'function')) {
      assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'classic');
      const sw = await app(p).evaluate(() => { const e = TopoForge.embed(); return [!!e.mappad, !!e.reset]; });
      assert.deepEqual(sw, [false, true], 'classic should have reset and no pad: ' + sw);
      assert.equal(await app(p).evaluate(() => { const e = document.getElementById('mmPad'); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }), false, 'classic shows the map pad');
      assert.ok(await app(p).evaluate(() => TopoForge.commands().some((c) => c.id === 'view::reset-layout')), 'classic\'s View menu has no Reset layout');
      ok(`classic at ${w}: no map pad (its menus stay), the app's Reset layout in its View menu`);
    } else ok(`classic stage 2 checks skipped at ${w}: the staged app has no resetLayout`);
    await fresh(p); await ctx.close();
  }
  // ---- a caption that comes back late is said only if what asked is still pointed at (revision 8) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (await app(p).evaluate(() => typeof TopoForge.mapMode === 'function')) {
      await p.focus('#ef-1 .ef-slider'); await keys(p, 'End'); await p.mouse.move(640, 3); await p.waitForTimeout(200);
      await p.evaluate(() => { window.__pv8 = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:preview') window.__pv8.push(e.data.detail); }); });
      const m0 = await p.textContent('#ef-1 .ef-msg');
      // a pointer that passed over a tile and is gone (as when a finder is redrawn under a moved focus)
      await p.evaluate(() => { document.querySelector('#ef-1 .ef-tool[data-cat="end"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
      await p.waitForTimeout(300);
      const pv = await p.evaluate(() => window.__pv8.filter((d) => d.caption).slice(-1)[0]);
      assert.ok(pv && /Endpoints/.test(pv.caption), 'no preview was asked for: ' + JSON.stringify(pv));
      assert.equal(await p.textContent('#ef-1 .ef-msg'), m0, 'a caption for something no longer pointed at was said over the message area');
      ok('rings: a caption that comes back after the pointer has gone is not said over the message area');
    } else ok('the late-caption check skipped: the staged app has no mapMode');
    await fresh(p); await ctx.close();
  }
  // ---- reduced motion: the thumb never glides ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    const d = await p.evaluate(() => getComputedStyle(document.querySelector('#ef-1 .ef-sl-thumb')).transitionDuration);
    assert.ok(parseFloat(d) <= 0.001, 'with reduced motion the thumb glides: ' + d);
    await fresh(p); await ctx.close();
    ok('with reduced motion asked for, the slider\'s thumb jumps to its stop');
  }
  await browser.close(); server.close();
  console.log('revision 8 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
