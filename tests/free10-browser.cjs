// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Revision 10 of the home page (docs/NAV.md), in a browser (needs playwright):
//   SITE_OUT=dir [SHOTS=dir] node tests/free10-browser.cjs
// Free's tool-bar: the zoom slider in place of Zoom out, Fit and Zoom in (drawn as the map mode slider is; its
// middle is Fit, the knob on a log scale about topology forge 1.13's fitScale(); a press beside the knob nudges,
// a drag zooms as it goes, the middle mark fits; keys; it follows the view; with an app that has no fitScale()
// its middle is 100% and it says so); undo and redo as one split pill (a named group of two buttons, each
// disabled when there is nothing to do, read again after an undo; it tilts toward the half pressed, never with
// reduced motion); 1.13's peek turned on in free (Shift over a placed shape shows its card in the map, the echo
// area says so in words and is put back when Shift is let go, also with the focus in the page); no button added
// in the freed places; classic unchanged.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('revision 10 browser checks skipped: no topology checkout staged'); process.exit(0);
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
const near = (a, b, d) => Math.abs(a - b) <= d;
const ratio = (a, b, tol = 0.015) => Math.abs(a / b - 1) <= tol;

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const app = (p) => p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
  const waitDoc = (p) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, drawing.doc, { timeout: 15000 });
  const ready = async (p) => { await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForFunction(() => window.CCNav && document.querySelector('#ef-1 .ef-tile'), null, { timeout: 10000 }); await p.waitForTimeout(600); };
  const fresh = async (p) => { await p.goto(base + '404.html'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); };
  const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  const Z = '#ef-1 .ef-zoom';
  // the zoom slider as drawn: where its knob's middle is (pixels from its left), its value, its words
  const zs = (p) => p.evaluate((s) => { const z = document.querySelector(s); if (!z) return null; const r = z.getBoundingClientRect(), t = z.querySelector('.ef-zs-thumb').getBoundingClientRect();
    return { knob: t.left + t.width / 2 - r.left, now: +z.getAttribute('aria-valuenow'), min: +z.getAttribute('aria-valuemin'), max: +z.getAttribute('aria-valuemax'), text: z.getAttribute('aria-valuetext'), tip: z.getAttribute('data-tip'), x: r.left, y: r.top, h: r.height }; }, Z);
  const K = (p) => app(p).evaluate(() => TopoForge.view.k);
  const FIT = (p) => app(p).evaluate(() => TopoForge.fitScale());
  // a zoom set by the app (about the view's middle), as the wheel or its menus would
  const setK = (p, k) => app(p).evaluate((k) => { const v = TopoForge.view, cx = v.width / 2, cy = v.height / 2; TopoForge.setView({ k, x: cx - (cx - v.x) / v.k * k, y: cy - (cy - v.y) / v.k * k }); }, k);
  const settle = (p) => p.waitForTimeout(450);   // the view message (at most every 60 ms), then the knob's 0.25 s glide
  const pill = (p) => p.evaluate(() => { const g = document.querySelector('#ef-1 .ef-tg.ef-pill'); if (!g) return null;
    const bs = [...g.querySelectorAll('button')];
    return { role: g.getAttribute('role'), label: g.getAttribute('aria-label'), acts: bs.map((b) => b.getAttribute('data-act')), types: bs.map((b) => b.getAttribute('type')),
      off: Object.fromEntries(bs.map((b) => [b.getAttribute('data-half'), b.getAttribute('aria-disabled') === 'true'])), tilt: g.getAttribute('data-tilt') }; });
  const angle = (p) => p.evaluate(() => { const b = document.querySelector('#ef-1 .ef-pill .ef-pill-b'); const m = getComputedStyle(b).transform.match(/matrix\(([^)]+)\)/); if (!m) return 0; const v = m[1].split(',').map(Number); return Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI * 10) / 10; });
  const mapCard = (p) => app(p).evaluate(() => { const c = document.querySelector('#minimap .mm-card'); return c && !c.hidden && c.offsetWidth ? c.querySelector('.mc-t').textContent : null; });

  for (const [w, h, scheme] of [[1280, 800, 'light'], [1280, 800, 'dark'], [1920, 1080, 'dark']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: shots ? 2 : 1 }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w}x${h} ${scheme}`;
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (!(await app(p).evaluate(() => typeof TopoForge.fitScale === 'function'))) { ok(`revision 10 checks skipped: the staged app has no fitScale (older than 1.13), at ${tag}`); await ctx.close(); continue; }

    // ---- the tool-bar: a zoom slider and a pill in place of five buttons, nothing in the freed places ----
    const tb = await p.evaluate(() => ({ groups: [...document.querySelectorAll('#ef-1 .ef-tg')].map((g) => g.getAttribute('data-group')),
      acts: [...document.querySelectorAll('#ef-1 .ef-toolbar .ef-tool:not(.ef-tile)')].map((b) => b.getAttribute('data-act')) }));
    for (const a of ['view::zoom-out', 'view::fit-to-window', 'view::zoom-in']) assert.ok(!tb.acts.includes(a), `the tool-bar still has the ${a} button at ${tag}`);
    assert.deepEqual(tb.groups, ['shapes', 'edit', 'win', 'zoom', 'map'], 'the tool-bar\'s groups are not shapes, the pill, windows, the zoom slider, the map mode slider: ' + tb.groups);
    assert.deepEqual(tb.acts, ['edit::undo', 'edit::redo', 'split-window-right', 'make-frame', 'show-navigator'], 'a button was added to the tool-bar (the freed places stay empty): ' + tb.acts);
    if (shots && w === 1280) { const f = await box(p, '#ef-1'), t = await box(p, '#ef-1 .ef-toolbar'); await p.screenshot({ path: path.join(shots, `r10-toolbar-${scheme}-1280.png`), clip: { x: f.x, y: f.y, width: f.w, height: t.b - f.y + 30 } }); }
    ok(`the tool-bar: the zoom slider in place of Zoom out, Fit and Zoom in, undo and redo as one pill, no button added in the freed places, at ${tag}`);

    // ---- drawn as the map mode slider is: the same groove, knob and focus ring ----
    const look = await p.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s));
      const pick = (cs) => [cs.height, cs.borderRadius, cs.backgroundImage, cs.boxShadow, cs.borderTopColor, cs.borderTopWidth];
      const pickT = (cs) => [cs.width, cs.height, cs.borderRadius, cs.backgroundImage, cs.boxShadow, cs.borderTopColor];
      return { track: [pick(g('#ef-1 .ef-zs-track')), pick(g('#ef-1 .ef-sl-track'))], thumb: [pickT(g('#ef-1 .ef-zs-thumb')), pickT(g('#ef-1 .ef-sl-thumb'))],
        size: [g('#ef-1 .ef-zoom').width, g('#ef-1 .ef-slider').width, g('#ef-1 .ef-zoom').height, g('#ef-1 .ef-slider').height] }; });
    assert.deepEqual(look.track[0], look.track[1], 'the zoom slider\'s groove is not the map mode slider\'s');
    assert.deepEqual(look.thumb[0], look.thumb[1], 'the zoom slider\'s knob is not the map mode slider\'s');
    assert.ok(look.size[0] === look.size[1] && look.size[2] === look.size[3], 'the zoom slider is not the map mode slider\'s size: ' + look.size);
    await p.focus(Z);
    const ring = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('#ef-1 .ef-zoom')); return [a.outlineStyle, a.outlineWidth]; });
    await p.focus('#ef-1 .ef-slider');
    const ring2 = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('#ef-1 .ef-slider')); return [a.outlineStyle, a.outlineWidth]; });
    assert.deepEqual(ring, ring2, 'the zoom slider\'s focus ring is not the map mode slider\'s');
    const role = await p.evaluate((s) => [document.querySelector(s).getAttribute('role'), document.querySelector(s).getAttribute('aria-label'), document.querySelector(s).tabIndex], Z);
    assert.deepEqual(role, ['slider', 'Zoom', 0]);
    ok(`the zoom slider is drawn as the map mode slider is (groove, knob, size, focus ring), a focusable slider named Zoom, at ${tag}`);

    // ---- the middle is Fit, on a log scale: k = fit x 4^p, p from -1 to +1 ----
    await p.focus(Z); await p.keyboard.press('Home'); await settle(p);
    const fit = await FIT(p);
    let s = await zs(p), k = await K(p);
    assert.ok(ratio(k, fit, 0.001), `Home did not fit (k ${k}, fit ${fit}) at ${tag}`);
    assert.ok(near(s.knob, 42, 1.5), `at Fit the knob is ${s.knob} px in, not in the middle (42) at ${tag}`);
    assert.equal(s.now, Math.round(k * 100));
    assert.equal(s.text, `${Math.round(k * 100)}%, fit is ${Math.round(fit * 100)}%`, 'the zoom slider\'s value text is not "N%, fit is F%"');
    assert.match(s.tip, /^Zoom: \d+%, fit is \d+%/);
    for (const [m, want] of [[2, 55], [0.5, 29], [0.25, 16], [4, 68]]) {
      await setK(p, fit * m); await settle(p); s = await zs(p);
      assert.ok(near(s.knob, want, 1.5), `with the zoom at Fit x ${m} the knob is ${s.knob} px in, not ${want} (k = fit x 4^p) at ${tag}`);
    }
    await setK(p, Math.min(5, fit * 9)); await settle(p); s = await zs(p);
    assert.ok(near(s.knob, 68, 1.5), `past Fit x 4 the knob ran off the slider's right end (${s.knob}) at ${tag}`);
    await setK(p, Math.max(0.08, fit / 9)); await settle(p); s = await zs(p);
    assert.ok(near(s.knob, 16, 1.5), `below Fit / 4 the knob ran off the slider's left end (${s.knob}) at ${tag}`);
    assert.ok(s.min >= 8 && s.max <= 500 && s.min < s.max, 'the slider\'s range is outside the app\'s limits (8 % to 500 %): ' + [s.min, s.max]);
    ok(`the middle is Fit (k = fitScale() = ${fit}); the knob on a log scale, k = fit x 4^p (x2 at 55, x0.5 at 29, x4 and beyond at the right end, /4 and below at the left), the value text "${Math.round(fit * 100)}%, fit is ${Math.round(fit * 100)}%", at ${tag}`);

    // ---- keys: Left and Right a step (x 1.2), PageUp and PageDown x 2, Home or Enter fits ----
    await p.focus(Z); await p.keyboard.press('Home'); await settle(p);
    const steps = [['ArrowRight', 1.2], ['ArrowLeft', 1], ['PageUp', 2], ['PageDown', 1], ['ArrowLeft', 1 / 1.2], ['PageUp', 2 / 1.2]];
    for (const [key, m] of steps) { await p.keyboard.press(key); await settle(p); k = await K(p); assert.ok(ratio(k, fit * m), `${key} did not set the zoom to Fit x ${m.toFixed(3)} (k ${k}, fit ${fit}) at ${tag}`); }
    await p.keyboard.press('Enter'); await settle(p);
    assert.ok(ratio(await K(p), fit, 0.001), 'Enter did not fit');
    ok(`keys: Right and Left a step (x 1.2), PageUp and PageDown x 2, Home and Enter fit, at ${tag}`);

    // ---- presses: beside the knob a step toward the press, on the middle mark Fit ----
    s = await zs(p);
    await p.mouse.click(s.x + 24, s.y + s.h / 2); await settle(p);
    assert.ok(ratio(await K(p), fit / 1.2), 'a press left of the knob did not zoom out one step: ' + (await K(p)) / fit);
    s = await zs(p);
    await p.mouse.click(s.x + 76, s.y + s.h / 2); await settle(p);
    assert.ok(ratio(await K(p), fit), 'a press right of the knob did not zoom in one step: ' + (await K(p)) / fit);
    await p.focus(Z); await p.keyboard.press('PageUp'); await settle(p);
    s = await zs(p);
    await p.mouse.click(s.x + 42, s.y + s.h / 2); await settle(p);
    assert.ok(ratio(await K(p), fit, 0.001), 'a press on the middle mark did not fit: ' + (await K(p)) / fit);
    ok(`presses on the slider: left of the knob a step out, right of it a step in, on the middle mark Fit, at ${tag}`);

    // ---- a drag zooms as it goes, and lets go where the knob is ----
    s = await zs(p);
    await p.mouse.move(s.x + 42, s.y + s.h / 2); await p.mouse.down();
    for (const x of [46, 50, 54, 58]) await p.mouse.move(s.x + x, s.y + s.h / 2);
    await p.waitForTimeout(150);
    const mid = { k: await K(p), s: await zs(p), drag: await p.evaluate((q) => document.querySelector(q).hasAttribute('data-drag'), Z) };
    assert.ok(mid.drag, 'no drag is shown while the knob is dragged');
    assert.ok(near(mid.s.knob, 58, 2), 'the knob does not follow the pointer while dragged: ' + mid.s.knob);
    assert.ok(ratio(mid.k, fit * Math.pow(4, (58 - 16) / 52 * 2 - 1), 0.05), `mid-drag the drawing is not zoomed to the knob (k ${mid.k}, fit ${fit}): the drag must zoom as it goes, at ${tag}`);
    if (shots && w === 1280) await p.screenshot({ path: path.join(shots, `r10-zoom-mid-drag-${scheme}-1280.png`) });
    await p.mouse.move(s.x + 60, s.y + s.h / 2); await p.mouse.up(); await settle(p);
    assert.ok(ratio(await K(p), fit * Math.pow(4, (60 - 16) / 52 * 2 - 1), 0.03), 'let go, the zoom is not where the knob was: ' + (await K(p)) / fit);
    assert.ok(near((await zs(p)).knob, 60, 1.5), 'let go, the knob did not stay where it was let go');
    ok(`a drag zooms as it goes (mid-drag Fit x ${(mid.k / fit).toFixed(2)}, the knob under the pointer) and stays where it is let go, at ${tag}`);

    // ---- it follows the view, whatever moved it ----
    await app(p).evaluate(() => TopoForge.run('view::zoom-in')); await settle(p);
    assert.equal((await zs(p)).now, Math.round((await K(p)) * 100), 'the slider did not follow the app\'s own Zoom in');
    const fr = await box(p, '#topology');
    await p.mouse.move(fr.x + fr.w * 0.45, fr.y + fr.h * 0.55); await p.keyboard.down('Control'); await p.mouse.wheel(0, 300); await p.keyboard.up('Control'); await p.waitForTimeout(400);
    s = await zs(p);
    assert.equal(s.now, Math.round((await K(p)) * 100), 'the slider did not follow the wheel');
    assert.ok(near(s.knob, 42 + 26 * Math.max(-1, Math.min(1, Math.log((await K(p)) / fit) / Math.log(4))), 1.5), 'the knob did not follow the wheel: ' + s.knob);
    ok(`the slider follows the view: the app's Zoom in and the wheel move its value and knob, at ${tag}`);

    // ---- an app with no fitScale(): the middle is 100%, and the slider says so ----
    await app(p).evaluate(() => { window.__fs = TopoForge.fitScale; TopoForge.fitScale = undefined; });
    await setK(p, 1); await settle(p); s = await zs(p);
    assert.ok(near(s.knob, 42, 1.5), 'with no fitScale() the knob is not in the middle at 100%: ' + s.knob);
    assert.match(s.text, /^100%, the middle is 100%/, 'with no fitScale() the value text does not say the middle is 100%: ' + s.text);
    assert.match(s.tip, /the middle is 100%/, 'with no fitScale() the tooltip does not say the middle is 100%');
    await setK(p, 2); await settle(p);
    assert.ok(near((await zs(p)).knob, 55, 1.5), 'with no fitScale() the scale is not about 100%');
    await app(p).evaluate(() => { TopoForge.fitScale = window.__fs; });
    ok(`with an app that has no fitScale() the middle is 100%, and the value text and the tooltip say so, at ${tag}`);
    // an app that cannot set the view (before 1.9) keeps the three buttons the slider replaced (drawn again on a select)
    await app(p).evaluate(() => { window.__v = TopoForge.version; TopoForge.version = '1.8'; const n = TopoForge.doc.pages[TopoForge.doc.cur].nodes[0]; TopoForge.select([n.id]); });
    await p.waitForTimeout(300);
    const old = await p.evaluate(() => ({ groups: [...document.querySelectorAll('#ef-1 .ef-tg')].map((g) => g.getAttribute('data-group')), acts: [...document.querySelectorAll('#ef-1 .ef-tg[data-group="view"] .ef-tool')].map((b) => b.getAttribute('data-act')) }));
    await app(p).evaluate(() => { TopoForge.version = window.__v; TopoForge.select([]); }); await p.waitForTimeout(300);
    assert.ok(!old.groups.includes('zoom'), 'an app that cannot set the view got the zoom slider: ' + old.groups);
    assert.deepEqual(old.acts, ['view::zoom-out', 'view::fit-to-window', 'view::zoom-in'], 'an app that cannot set the view lost Zoom out, Fit and Zoom in: ' + JSON.stringify(old));
    assert.ok((await p.evaluate(() => [...document.querySelectorAll('#ef-1 .ef-tg')].map((g) => g.getAttribute('data-group')))).includes('zoom'), 'the zoom slider did not come back with the app\'s own version');
    ok(`an app that cannot set the view (1.8) keeps Zoom out, Fit and Zoom in, and no slider, at ${tag}`);

    // ---- the pill: one named group of two buttons, each disabled with nothing to do, read again after an undo ----
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    let P = await pill(p);
    assert.ok(P, 'no undo and redo pill at ' + tag);
    assert.deepEqual([P.role, P.label, P.acts, P.types], ['group', 'Undo and redo', ['edit::undo', 'edit::redo'], ['button', 'button']], 'the pill is not a group named "Undo and redo" of two buttons: ' + JSON.stringify(P));
    assert.deepEqual(P.off, { undo: true, redo: true }, 'on a fresh drawing undo or redo is not disabled: ' + JSON.stringify(P.off));
    await app(p).evaluate(() => TopoForge.place('router', 'center')); await p.waitForTimeout(400);
    assert.deepEqual((await pill(p)).off, { undo: false, redo: true }, 'after a shape was placed undo is not enabled');
    await p.mouse.move(5, h - 5);
    // held down, the pill tilts toward the half pressed; let go, it rights itself (Motion on)
    const ub = await box(p, '#ef-1 .ef-pill-b[data-half="undo"]');
    await p.mouse.move(ub.x + ub.w / 2, ub.y + ub.h / 2); await p.mouse.down(); await p.waitForTimeout(200);
    const aU = await angle(p);
    if (shots && w === 1280) { const g = await box(p, '#ef-1 .ef-pill'); await p.screenshot({ path: path.join(shots, `r10-pill-held-${scheme}-1280.png`), clip: { x: g.x - 60, y: g.y - 24, width: g.w + 120, height: g.h + 48 } }); }
    await p.mouse.up(); await p.waitForTimeout(450);
    assert.ok(aU <= -2 && aU >= -8, `held down on undo, the pill does not tilt a few degrees toward it (${aU} degrees) at ${tag}`);
    assert.equal(await angle(p), 0, 'let go, the pill did not right itself');
    P = await pill(p);
    assert.deepEqual(P.off, { undo: true, redo: false }, 'after the undo half was pressed, undo is not disabled and redo enabled: ' + JSON.stringify(P.off));
    const rb = await box(p, '#ef-1 .ef-pill-b[data-half="redo"]');
    await p.mouse.move(rb.x + rb.w / 2, rb.y + rb.h / 2); await p.mouse.down(); await p.waitForTimeout(200);
    const aR = await angle(p);
    await p.mouse.up(); await p.waitForTimeout(450);
    assert.ok(aR >= 2 && aR <= 8, `held down on redo, the pill does not tilt toward it (${aR} degrees) at ${tag}`);
    assert.deepEqual((await pill(p)).off, { undo: false, redo: true }, 'after the redo half was pressed, undo is not enabled and redo disabled');
    // a disabled half does not tilt
    const rb2 = await box(p, '#ef-1 .ef-pill-b[data-half="redo"]');
    await p.mouse.move(rb2.x + rb2.w / 2, rb2.y + rb2.h / 2); await p.mouse.down(); await p.waitForTimeout(150);
    const aD = await angle(p); await p.mouse.up(); await p.waitForTimeout(300);
    assert.equal(aD, 0, 'a disabled half tilted the pill');
    // a half pressed with Enter keeps the focus when the tool-bar is drawn again: a shape placed (and so selected),
    // then undone, changes the selection, and the app's selection message draws the tool-bar again
    await app(p).evaluate(() => TopoForge.place('router', 'center')); await p.waitForTimeout(400);
    await p.focus('#ef-1 .ef-pill-b[data-half="undo"]'); await p.evaluate(() => { document.activeElement.__old = true; });
    await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    const fk = await p.evaluate(() => { const a = document.activeElement; return [a && a.getAttribute('data-act'), !!(a && a.__old)]; });
    assert.equal(fk[1], false, 'the tool-bar was not drawn again after Enter on the undo half (no selection message): the focus is not tested');
    assert.equal(fk[0], 'edit::undo', 'Enter on the undo half lost the keyboard focus when the tool-bar was drawn again');
    assert.equal((await pill(p)).off.redo, false, 'Enter on the undo half did not undo');
    // a redo with nothing selected changes no selection, so the app sends no message: the pill reads it itself
    await p.evaluate(() => { window.__sel10 = 0; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:select') window.__sel10++; }); });
    const rb3 = await box(p, '#ef-1 .ef-pill-b[data-half="redo"]');
    await p.mouse.click(rb3.x + rb3.w / 2, rb3.y + rb3.h / 2); await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => window.__sel10), 0, 'the redo sent a selection message: this step does not test the pill reading the state itself');
    assert.deepEqual((await pill(p)).off, { undo: false, redo: true }, 'after a redo with nothing selected the pill did not read undo and redo again: ' + JSON.stringify((await pill(p)).off));
    // an undo made in the drawing: the pill reads it again when pointed at
    await p.mouse.move(5, h - 5);
    await app(p).evaluate(() => { TopoForge.undo(); TopoForge.undo(); }); await p.waitForTimeout(200);
    await p.hover('#ef-1 .ef-pill'); await p.waitForTimeout(150);
    assert.deepEqual((await pill(p)).off, { undo: true, redo: false }, 'pointed at after an undo in the drawing, the pill did not read undo and redo again');
    ok(`the pill: a group named "Undo and redo" of two buttons, disabled with nothing to do; held down it tilts toward the half (undo ${aU}, redo ${aR} degrees), a disabled half does not; its halves follow each undo and redo, also one made in the drawing; Enter on a half keeps the focus, at ${tag}`);

    // ---- the peek: Shift over a placed shape shows its card; the echo says so and is put back ----
    assert.equal(await app(p).evaluate(() => TopoForge.embed().peek), true, 'free did not turn on peek at ' + tag);
    await p.focus(Z); await p.keyboard.press('Home'); await settle(p);
    await p.evaluate(() => { window.__pk = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'topoforge:peek') window.__pk.push(e.data.detail); }); });
    // a large shape whose middle is on the drawing, not under a frame, the legend or the map
    const tgt = await p.evaluate(() => {
      const f = document.getElementById('topology'), fr = f.getBoundingClientRect(), T = f.contentWindow.TopoForge, pg = T.doc.pages[T.doc.cur], v = T.view;
      return pg.nodes.filter((x) => x.w >= 80 && x.h >= 40).map((x) => ({ id: x.id, x: fr.left + v.x + (x.x + x.w / 2) * v.k, y: fr.top + v.y + (x.y + x.h / 2) * v.k, a: x.w * x.h }))
        .filter((o) => document.elementFromPoint(o.x, o.y) === f).sort((a, b) => b.a - a.a).slice(0, 6);
    });
    assert.ok(tgt.length, 'no shape on the drawing clear of the frames at ' + tag);
    const before = await p.textContent('#ef-1 .ef-msg');
    let hit = null;
    for (const o of tgt) {
      // as a reader would: a card shown by pointing at a tool-bar tile, then straight to the drawing with Shift
      // held, within the card's 400 ms timer (which, run in the peek, must not end it)
      await p.hover('#ef-1 .ef-tile[data-cat="sec"]'); await p.waitForTimeout(250);
      assert.equal(await mapCard(p), 'Security', 'pointing at the Security tile shows no card in the map');
      await p.mouse.move(o.x - 6, o.y); await p.keyboard.down('Shift'); await p.mouse.move(o.x, o.y, { steps: 2 }); await p.waitForTimeout(150);
      const pk = await p.evaluate(() => window.__pk.slice());
      if (pk.length && pk[pk.length - 1].id) { hit = { o, pk }; break; }
      await p.keyboard.up('Shift'); await p.waitForTimeout(150); await p.evaluate(() => { window.__pk = []; });
    }
    assert.ok(hit, 'Shift over a placed shape sent no topoforge:peek at ' + tag);
    const name = hit.pk[hit.pk.length - 1].name, echo = await p.textContent('#ef-1 .ef-msg');
    // (revision 11, his rewording: "The card for <name>: let go of Shift to put it away.")
    assert.match(echo, /^The card for .+: let go of Shift to put it away\.$/, 'the echo area does not say the peek in words: ' + echo);
    assert.ok(echo.length <= 'The card for '.length + 49 + ': let go of Shift to put it away.'.length && echo.startsWith('The card for ' + name.split('\n')[0].slice(0, 24)), 'the echo does not name the shape (shortly): ' + echo);
    const peeked = await mapCard(p);
    assert.ok(peeked && peeked !== 'Security', 'the peek shows no card of its own in the map: ' + peeked);
    // the card's 400 ms timer (the pointer left the tile on the way) runs in the peek and does not end it
    await p.waitForTimeout(700);
    assert.ok((await p.evaluate(() => window.__pk.slice(-1)[0])).id, 'the peek ended while Shift was still held (the page\'s own preview ended it)');
    assert.equal(await mapCard(p), peeked, 'the peek\'s card went while Shift was still held');
    if (shots && w === 1280) await p.screenshot({ path: path.join(shots, `r10-peek-${scheme}-1280.png`) });
    // Shift let go with the focus in this page and the pointer still: the peek ends, the echo is put back
    assert.notEqual(await p.evaluate(() => document.activeElement && document.activeElement.id), 'topology', 'the focus is in the app, not this page');
    await p.keyboard.up('Shift'); await p.waitForTimeout(400);
    assert.equal((await p.evaluate(() => window.__pk.slice(-1)[0])).id, null, 'Shift let go (the focus in this page, the pointer still) did not end the peek');
    assert.equal(await p.textContent('#ef-1 .ef-msg'), before, 'the echo area was not put back after the peek');
    assert.equal(await mapCard(p), null, 'after the peek the tile\'s stale card came back (the page\'s own card, held during the peek, was not caught up)');
    assert.equal(await app(p).evaluate(() => TopoForge.embed().peek), true, 'peek was left off after Shift was let go');
    // a long name is shortened in the echo: its first line, at most 48 characters, cut at a word with … (the app's
    // message, sent from the app's own window as the app sends it, for a shape whose name is long)
    const longName = 'The shop, drawn: what inputloop makes, where it runs, how work moves and who answers for it.';
    const m0 = await p.textContent('#ef-1 .ef-msg');
    await app(p).evaluate((nm) => { window.parent.postMessage({ type: 'topoforge:peek', detail: { id: 'x-long', name: nm } }, location.origin); }, longName); await p.waitForTimeout(200);
    const said = await p.textContent('#ef-1 .ef-msg'), shortName = said.replace(/^The card for /, '').replace(/: let go of Shift to put it away\.$/, '');
    await app(p).evaluate(() => { window.parent.postMessage({ type: 'topoforge:peek', detail: { id: null } }, location.origin); }); await p.waitForTimeout(200);
    assert.ok(shortName !== said && shortName.length <= 49 && shortName.endsWith('…') && longName.startsWith(shortName.slice(0, -1)), 'a long name is not shortened in the echo (48 characters, cut at a word, with …): ' + said);
    assert.equal(await p.textContent('#ef-1 .ef-msg'), m0, 'the echo was not put back after the long name\'s peek');
    ok(`the peek: Shift over a placed shape shows its card in the map, the echo says "${echo}", the card outlives the card timer, and Shift let go in this page ends it and puts the echo back, at ${tag}`);

    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`revision 10 at ${tag}: no sideways scroll, no request to another host, no console errors`);
    await fresh(p); await ctx.close();
  }

  // ---- reduced motion: the pill does not tilt, the knob does not glide ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await ready(p);
    if (await app(p).evaluate(() => typeof TopoForge.fitScale === 'function')) {
      await app(p).evaluate(() => TopoForge.place('router', 'center')); await p.waitForTimeout(400);
      const ub = await box(p, '#ef-1 .ef-pill-b[data-half="undo"]');
      await p.mouse.move(ub.x + ub.w / 2, ub.y + ub.h / 2); await p.mouse.down(); await p.waitForTimeout(200);
      const a = await angle(p); await p.mouse.up(); await p.waitForTimeout(300);
      assert.equal(a, 0, 'with reduced motion the pill tilts');
      const d = await p.evaluate(() => getComputedStyle(document.querySelector('#ef-1 .ef-zs-thumb')).transitionDuration);
      assert.ok(parseFloat(d) <= 0.001, 'with reduced motion the zoom knob glides: ' + d);
      ok('with reduced motion asked for, the pill does not tilt and the zoom knob does not glide');
    } else ok('the reduced-motion check skipped: the staged app is older than 1.13');
    await fresh(p); await ctx.close();
  }

  // ---- 390 pixels: the slider and the pill fit the folded frame's tool-bar, nothing scrolls sideways ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await fresh(p); await p.goto(base + 'index.html'); await waitDoc(p); await p.waitForSelector('#stage-grid[data-free="yes"]', { timeout: 10000 }); await p.waitForTimeout(1000);
    if (await app(p).evaluate(() => typeof TopoForge.fitScale === 'function')) {
      if (!(await p.evaluate(() => document.getElementById('ef-1').classList.contains('ef-open')))) { await p.click('#ef-1 .ef-fold'); await p.waitForTimeout(300); }
      const z = await box(p, '#ef-1 .ef-zoom'), g = await box(p, '#ef-1 .ef-pill');
      assert.ok(z && z.w > 0 && z.r <= 390 && g && g.r <= 390, 'at 390 the zoom slider or the pill is cut off: ' + JSON.stringify([z, g]));
      assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at 390');
      ok('at 390 the zoom slider and the pill are in the tool-bar, nothing scrolls sideways');
    } else ok('the 390 check skipped: the staged app is older than 1.13');
    await fresh(p); await ctx.close();
  }

  // ---- classic: unchanged; no peek, no slider or pill of this page's, the app's own zoom buttons ----
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await fresh(p); await p.evaluate(() => localStorage.setItem('corwin.cloud.ui.v1', 'classic'));
    await p.goto(base + 'index.html'); await waitDoc(p); await p.waitForTimeout(800);
    if (await app(p).evaluate(() => typeof TopoForge.fitScale === 'function')) {
      assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'classic');
      const e = await app(p).evaluate(() => { const x = TopoForge.embed(); return { peek: !!x.peek, bigcard: !!x.bigcard, cardpad: !!x.cardpad, mappad: !!x.mappad, preview: !!x.preview, reset: !!x.reset }; });
      assert.deepEqual(e, { peek: false, bigcard: false, cardpad: false, mappad: false, preview: false, reset: true }, 'classic\'s switches changed: ' + JSON.stringify(e));
      assert.deepEqual(await p.evaluate(() => [document.querySelectorAll('.ef-zoom').length, document.querySelectorAll('.ef-pill').length]), [0, 0], 'classic has this page\'s zoom slider or pill');
      assert.ok(await app(p).evaluate(() => { const b = document.getElementById('btnZoomIn'); return !!b && b.offsetWidth > 0; }), 'classic lost the app\'s own Zoom in button');
      ok(`classic at ${w}: no peek (nor 1.12's words), reset as before, no slider or pill of this page's, the app's own zoom buttons`);
    } else ok(`classic revision 10 checks skipped at ${w}: the staged app is older than 1.13`);
    await fresh(p); await ctx.close();
  }
  await browser.close(); server.close();
  console.log('revision 10 browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
