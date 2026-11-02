// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 6 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free6-browser.cjs
// Frame 2 starts top right under the layout switch and never under it; every frame's height (and then
// width and height together, at the corner) can be changed and is kept, and the frame shows which mode a
// press there is in; the legend is lettered in two served fonts, one line, at the canvas's foot; the menu
// bars never wrap (1920x950 at 100 % shows every menu; 1536x730 at 125 %, 1280, 390 and a 20-pixel default
// font fold into »); the mode-line's lighter opens its mode's menu; frame 2 is mirrored. topology forge
// 1.9 part A, when staged: *Here* beside the selection without zooming, *Properties* edits in one undo
// step, %zoom says the zoom, the first fit sits between the frames, CUA cut.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 6 browser checks skipped: no topology checkout staged'); process.exit(0);
}
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(out, p);
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'text/plain') + (/font/.test(types[path.extname(f)] || '') ? '' : '; charset=utf-8'),
    'Content-Security-Policy': p.startsWith('/topology/') && topoCsp ? topoCsp : STRICT });
  fs.createReadStream(f).pipe(res);
});
let n = 0; const ok = (m) => { n++; console.log('ok', n, '-', m); };
function lum(c) { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const near = (a, b, d = 1) => Math.abs(a - b) <= d;
const meets = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(500); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const keys = async (p, ...ks) => { for (const k of ks) await p.keyboard.press(k); await p.waitForTimeout(60); };
  const box = async (p, s) => { const b = await p.locator(s).boundingBox(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const nineteen = (p) => app(p).evaluate(() => /^1\.(9|[1-9]\d)|^[2-9]/.test(TopoForge.version));
  // every frame's menu bar on one line: nothing runs past it and its shown menus share one row
  const menus = (p) => p.evaluate(() => [...document.querySelectorAll('.ef:not(.ef-small)')].map((f) => {
    const mb = f.querySelector('.ef-menubar'), shown = [...mb.querySelectorAll('.ef-mb:not([hidden])')];
    const sum = [...mb.children].filter((c) => !c.hidden && c.offsetWidth).reduce((a, c) => a + c.offsetWidth, 0), cs = getComputedStyle(mb);
    const top = shown.length ? shown[0].getBoundingClientRect().top : 0;
    return { id: f.id, oneRow: shown.every((b) => Math.abs(b.getBoundingClientRect().top - top) < 3), fits: sum <= mb.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5,
      hidden: [...mb.querySelectorAll('.ef-mb[hidden]')].map((b) => b.getAttribute('data-menu')).filter((m) => m !== '»'), more: !mb.querySelector('.ef-mb[data-menu="»"]').hidden,
      east: f.classList.contains('ef-east') };
  }));

  // ---- 1920x950 (1920x1080 full screen at 100 %), light and dark ----
  for (const scheme of ['dark', 'light']) {
    const w = 1920, h = 950;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `1920 ${scheme}`;
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `r6-free-${scheme}-1920.png`) }); }

    const firstFit = (await nineteen(p)) ? [await app(p).evaluate(() => { TopoForge.run('edit::select-all'); const r = TopoForge.selectionRect(); TopoForge.select([]); return r; }), await box(p, '#ef-1'), await box(p, '#ef-2')] : null;
    // ---- frame 2: top right, under the switch, shorter, above the map ----
    const sw = await box(p, '#ui-switch'), f2 = await box(p, '#ef-2'), map = await app(p).evaluate(() => TopoForge.panels().map);
    assert.ok(near(f2.x + f2.w, w - 8, 2), 'frame 2 does not start at the right edge: ' + JSON.stringify(f2));
    assert.ok(f2.y >= sw.y + sw.h && f2.y <= sw.y + sw.h + 16, 'frame 2 does not start just under the switch: ' + JSON.stringify([f2, sw]));
    assert.ok(!meets(f2, sw), 'frame 2 meets the switch');
    assert.ok(f2.h <= 561 && f2.y + f2.h <= map.y + 1, 'frame 2 is taller than 560 or runs over the overview map: ' + JSON.stringify([f2, map]));
    const g0 = await box(p, '#ef-2 .ef-grip');
    await p.mouse.move(g0.x + 4, g0.y + 8); await p.mouse.down(); await p.mouse.move(g0.x + 4, 2, { steps: 5 }); await p.mouse.up();
    assert.ok(!meets(await box(p, '#ef-2'), sw), 'dragged up, frame 2 went under the switch');
    await p.evaluate(() => CCFloat.get('frame2').reset());
    ok(`frame 2 starts top right, just under the switch, ${Math.round(f2.h)} tall, above the overview map; dragged toward the switch it stays below it, at ${tag}`);

    // ---- menus: one line each, every menu showing, frame 2 mirrored ----
    let M = await menus(p);
    for (const m of M) {
      assert.ok(m.oneRow && m.fits, m.id + '\'s menu bar does not fit one line at 1920: ' + JSON.stringify(m));
      assert.deepEqual(m.hidden, [], m.id + ' folds menus into » at 1920 (100 %): ' + m.hidden);
    }
    assert.ok(M.find((m) => m.id === 'ef-2').east && !M.find((m) => m.id === 'ef-1').east, 'frame 2 is not mirrored, or frame 1 is');
    const gr = await box(p, '#ef-2 .ef-grip'), mb2 = await box(p, '#ef-2 .ef-menubar');
    assert.ok(gr.x + gr.w >= mb2.x + mb2.w - 6, 'frame 2\'s grip is not at its outer (right) end');
    for (const f of [1, 2]) {
      const names = await p.$$eval(`#ef-${f} .ef-mb:not([hidden])`, (b) => b.map((x) => x.getAttribute('data-menu')));
      for (const g of ['Site', 'File', 'Edit', 'Arrange', 'Layout', 'View', 'Options', 'Help']) assert.ok(names.includes(g), `frame ${f} lacks ${g} at 1920`);
    }
    ok(`menus at 1920x950 (100 %): both frames show every menu on one line, nothing in »; frame 2 mirrored with its grip at the right end, at ${tag}`);

    // ---- the mode-line's lighter opens its mode's menu ----
    await p.click('#ef-2 .ml-mode');
    assert.ok(await p.isVisible('#ef-2 .ef-pop'), 'the Navigator lighter opened nothing');
    assert.ok(await p.locator('#ef-2 .ef-pop [data-act^="nav:"]').count() >= 5, 'the Navigator lighter\'s menu lacks the navigator\'s commands');
    await keys(p, 'Escape');
    await p.click('#ef-1 .ml-mode');
    assert.ok(await p.locator('#ef-1 .ef-pop [data-act="filter-clear"]').count() === 1, 'the Finder lighter\'s menu lacks the finder\'s commands');
    await keys(p, 'Escape');
    ok(`the mode-line's lighter says the window's mode and opens its menu (Navigator, Finder), at ${tag}`);

    // ---- height, then the corner; kept ----
    await p.focus('#ef-1 .ef-hedge'); await keys(p, 'End');
    const hMax = (await box(p, '#ef-1')).h;
    await keys(p, 'ArrowUp', 'ArrowUp');
    const h1 = (await box(p, '#ef-1')).h;
    assert.ok(near(h1, hMax - 32), `the bottom edge's keys did not change the height (${hMax} to ${h1})`);
    await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+x', '^');
    assert.ok(near((await box(p, '#ef-1')).h, h1 + 16), 'C-x ^ did not make the frame taller');
    const hb = await box(p, '#ef-1 .ef-hedge');
    await p.mouse.move(hb.x + 100, hb.y + 4); await p.mouse.down(); await p.mouse.move(hb.x + 100, hb.y - 96, { steps: 5 }); await p.mouse.up();
    const h2 = (await box(p, '#ef-1')).h;
    assert.ok(near(h2, h1 + 16 - 100, 2), `dragging the bottom edge did not change the height (${h1 + 16} to ${h2})`);
    const c0 = await box(p, '#ef-1');
    await p.focus('#ef-1 .ef-corner'); await keys(p, 'ArrowRight', 'ArrowDown');
    const c1 = await box(p, '#ef-1');
    assert.ok(near(c1.w, c0.w + 16) && near(c1.h, c0.h + 16), 'the corner\'s keys did not change both: ' + JSON.stringify([c0, c1]));
    const cb = await box(p, '#ef-1 .ef-corner');
    await p.mouse.move(cb.x + 8, cb.y + 8); await p.mouse.down(); await p.mouse.move(cb.x + 48, cb.y + 28, { steps: 5 });
    assert.equal(await p.getAttribute('#ef-1', 'data-drag'), 'wh', 'dragging the corner shows no corner mark');
    await p.mouse.up();
    const c2 = await box(p, '#ef-1');
    assert.ok(near(c2.w, c1.w + 40, 2) && near(c2.h, c1.h + 20, 2), 'dragging the corner did not change both: ' + JSON.stringify([c1, c2]));
    await p.reload(); await ready(p);
    const c3 = await box(p, '#ef-1');
    assert.ok(near(c3.w, c2.w, 1) && near(c3.h, c2.h, 1), 'the width and height were not kept: ' + JSON.stringify([c2, c3]));
    ok(`height by the bottom edge (keys, drag) and C-x ^; width and height together by the corner (keys, drag); kept across a reload, at ${tag}`);

    // ---- which mode a press is in shows on the frame ----
    const grab = async (sel) => { const b = await box(p, sel); await p.mouse.move(b.x + b.w / 2, b.y + b.h / 2); await p.waitForTimeout(40); return p.getAttribute('#ef-1', 'data-grab'); };
    assert.equal(await grab('#ef-1 .ef-edge'), 'w', 'the right edge does not mark the width');
    assert.equal(await grab('#ef-1 .ef-hedge'), 'h', 'the bottom edge does not mark the height');
    assert.equal(await grab('#ef-1 .ef-corner'), 'wh', 'the corner does not mark both');
    const marks = await p.evaluate(() => [getComputedStyle(document.getElementById('ef-1')).boxShadow, getComputedStyle(document.querySelector('#ef-1 .ef-corner'), '::after').borderRightColor]);
    assert.ok(marks[0] !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(marks[1]), 'the corner\'s mark is not drawn: ' + marks.join(' | '));
    await p.mouse.move(w / 2, h / 2); await p.waitForTimeout(40);
    assert.equal(await p.getAttribute('#ef-1', 'data-grab'), null, 'the mark stays after the pointer leaves');
    await p.focus('#ef-1 .ef-hedge');
    assert.equal(await p.getAttribute('#ef-1', 'data-grab'), 'h', 'focusing the bottom edge does not mark the height');
    await p.evaluate(() => { const f = CCFloat.get('frame1'); f.set({ w: 440, h: null }, true); f.reset(); });
    ok(`the frame shows which mode a press is in: right edge "w", bottom edge "h", corner "wh" (with its L bracket), on pointing and on focus; dragging marks it stronger, at ${tag}`);

    // ---- the legend, lettered: two served fonts, one line, at the foot ----
    const L = await p.evaluate(async () => {
      await document.fonts.ready;
      const v = document.querySelector('#legend .lg-v'), k = document.querySelector('#legend .lg-k'), line = document.querySelector('#legend .lg-line'), lg = document.getElementById('legend');
      const cv = getComputedStyle(v), ck = getComputedStyle(k);
      return { vf: cv.fontFamily, kf: ck.fontFamily, kt: ck.textTransform, ks: parseFloat(ck.letterSpacing), kw: ck.fontWeight,
        loaded: [document.fonts.check('12px osifont'), document.fonts.check('300 9px "IBM Plex Sans Condensed"')],
        lines: Math.round(line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight)), bottom: lg.getBoundingClientRect().bottom, H: innerHeight,
        cv: cv.color, ck: ck.color, bg: getComputedStyle(document.body).backgroundColor, keys: [...document.querySelectorAll('#legend .lg-k')].map((x) => x.textContent) };
    });
    assert.ok(/^"?osifont/.test(L.vf), 'the values are not lettered in osifont: ' + L.vf);
    assert.ok(/^"?IBM Plex Sans Condensed/.test(L.kf), 'the field names are not in Plex Sans Condensed: ' + L.kf);
    assert.deepEqual(L.loaded, [true, true], 'a legend font did not load from this site');
    assert.ok(L.kt === 'uppercase' && L.ks > 0 && +L.kw <= 300, 'the field names are not light, tracked capitals');
    assert.equal(L.lines, 1, 'the legend is not one line');
    assert.ok(L.H - L.bottom <= 8 && L.H - L.bottom >= 0, 'the legend does not hang at the foot: ' + (L.H - L.bottom));
    assert.ok(contrast(L.cv, L.bg) >= 4.5 && contrast(L.ck, L.bg) >= 4.5, 'a legend face is below AA');
    for (const k of ['app', 'by', 'licence', 'prose', 'source', 'rev', 'date']) assert.ok(L.keys.includes(k), 'the legend lacks the field ' + k);
    ok(`the legend: field names in IBM Plex Sans Condensed Light, tracked capitals (Subtler), values in osifont (Subtle), both served here and AA; one line, ${Math.round(L.H - L.bottom)} pixels above the foot, at ${tag}`);

    // ---- topology forge 1.9 part A ----
    if (await nineteen(p)) {
      // the first fit (on the first load, above) sits between the frames
      const [fit, a1, a2] = firstFit;
      assert.ok(fit && fit.x >= a1.x + a1.w - 4 && fit.x + fit.w <= a2.x + 4, 'the first fit does not sit between the frames: ' + JSON.stringify([fit, a1, a2]));
      // %zoom says the zoom
      assert.match(await p.textContent('#ef-1 .ml-zoom'), /\d+%/, '%zoom does not say the zoom');
      // *Here* beside the selection, without zooming
      const nd = await app(p).evaluate(() => { const x = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((y) => y.data && y.data.what); TopoForge.select([x.id]); return x.id; });
      await p.waitForTimeout(150);
      const k0 = await app(p).evaluate(() => TopoForge.view.k), sr = await app(p).evaluate(() => TopoForge.selectionRect());
      await p.focus('#ef-1 .ef-tile'); await keys(p, 'Control+c', '.'); await p.waitForSelector('#ef-here:not([hidden])');
      const hr = await box(p, '#ef-here');
      assert.equal(await app(p).evaluate(() => TopoForge.view.k), k0, '*Here* zoomed with 1.9');
      assert.ok(near(hr.x, Math.min(w - 316, sr.x + sr.w + 12), 3) && near(hr.y, sr.y, 3), '*Here* is not beside the selection: ' + JSON.stringify([hr, sr]));
      await p.keyboard.press('Escape');
      // *Properties* edits the name, one undo step
      await p.click('#ef-1 .ef-mb[data-menu="Options"]'); await p.click('#ef-1 .ef-pop [data-act="properties"]');
      await p.fill('#ef-prop-text', 'renamed here'); await p.click('#ef-properties [data-set="text"]'); await p.waitForTimeout(100);
      const named = await app(p).evaluate((id) => TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((x) => x.id === id).text, nd);
      assert.match(named, /renamed here/, '*Properties* did not set the name through setProps');
      await app(p).evaluate(() => TopoForge.undo());
      assert.doesNotMatch(await app(p).evaluate((id) => TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((x) => x.id === id).text, nd), /renamed here/, 'the name was not one undo step');
      await p.click('#ef-properties .ef-x');
      // CUA: C-x in the drawing with a selection and no second key cuts
      const n0 = await app(p).evaluate(() => TopoForge.doc.pages[TopoForge.doc.cur].nodes.length);
      await app(p).evaluate((id) => { TopoForge.select([id]); document.querySelector('#canvas, svg, canvas') && document.querySelector('#canvas, svg, canvas').focus && document.querySelector('#canvas, svg, canvas').focus(); }, nd);
      await p.locator('#topology').focus(); await app(p).evaluate(() => { const c = document.activeElement; void c; });
      const frame = app(p); await frame.locator('body').press('Control+x'); await p.waitForTimeout(400);
      const n1 = await app(p).evaluate(() => TopoForge.doc.pages[TopoForge.doc.cur].nodes.length);
      assert.equal(n1, n0 - 1, 'C-x with a selection and no second key did not cut');
      await app(p).evaluate(() => TopoForge.undo());
      ok(`topology forge 1.9 part A: the first fit sits between the frames; %zoom says the zoom; *Here* floats beside the selection without zooming; *Properties* sets the name in one undo step; C-x in the drawing with a selection cuts (CUA), at ${tag}`);
    } else ok(`topology forge 1.9 part A checks skipped: the staged app is 1.8, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 6 at ${tag}: no sideways scroll, no request to another host (the fonts are this site's), no console errors`);
    await fresh(p); await ctx.close();
  }

  // ---- menus never wrap: 125 %, 1280, 390, and a 20-pixel default font ----
  const cases = [['1536x730 at 125 %', { viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1.25 }, null],
    ['1280x800', { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' }, null],
    ['390x800', { viewport: { width: 390, height: 800 } }, null],
    ['1920x950, a 20-pixel default font', { viewport: { width: 1920, height: 950 } }, 20]];
  for (const [tag, opt, font] of cases) {
    const ctx = await browser.newContext(opt); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    if (font) { const cdp = await ctx.newCDPSession(p); await cdp.send('Page.enable'); await cdp.send('Page.setFontSizes', { fontSizes: { standard: font, fixed: font - 3 } }); }
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (font) assert.ok(parseFloat(await p.evaluate(() => getComputedStyle(document.getElementById('ef-1')).fontSize)) > 15, 'the frames do not follow a larger default font');
    if (shots) await p.screenshot({ path: path.join(shots, `r6-menus-${tag.replace(/[^0-9a-z]+/gi, '-')}.png`) });
    const M = await menus(p);
    for (const m of M) assert.ok(m.oneRow && m.fits, `${m.id}'s menu bar does not fit one line at ${tag}: ` + JSON.stringify(m));
    const folded = M.filter((m) => m.hidden.length);
    for (const m of folded) {
      assert.ok(m.more, m.id + ' hides menus but shows no »');
      await p.click(`#${m.id} .ef-mb[data-menu="»"]`);
      const heads = await p.$$eval(`#${m.id} .ef-pop .ef-sep`, (s) => s.map((x) => x.textContent));
      for (const hm of m.hidden) assert.ok(heads.includes(hm), `» in ${m.id} does not list ${hm}: ` + heads.join(','));
      await keys(p, 'Escape');
    }
    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(errors, [], 'errors at ' + tag + ': ' + errors.join(' | '));
    ok(`menus at ${tag}: every frame's menu bar is one line` + (folded.length ? '; ' + folded.map((m) => m.id + ' folds ' + m.hidden.join(', ') + ' into », which lists them').join('; ') : '; nothing folded'));
    await fresh(p); await ctx.close();
  }

  // ---- storage refused: the frames still resize ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 950 } });
    await ctx.addInitScript(() => { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { get() { throw new Error('refused'); } }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + 'index.html'); await ready(p);
    const h0 = (await box(p, '#ef-2')).h;
    await p.focus('#ef-2 .ef-hedge'); await keys(p, 'ArrowUp');
    assert.ok(near((await box(p, '#ef-2')).h, h0 - 16), 'with storage refused the height does not change');
    assert.deepEqual(errs, [], 'errors with storage refused: ' + errs.join(' | '));
    await ctx.close();
    ok('with storage refused the frames still resize');
  }
  await browser.close(); server.close();
  console.log('revision 6 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
