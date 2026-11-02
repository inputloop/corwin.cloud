// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// The home page in classic (docs/NAV.md, revisions 2 to 4), in a browser (needs the playwright package):
//   SITE_OUT=dir [SHOTS=dir] node tests/home-browser.cjs
// The drawing loads for a returning visitor; the palettes float, move, dock, hide and keep their
// place; every menu item answers; the minibuffer wears the frame's face; the legend credits Bryant
// with his link and TopoForge's licence. 1280 and 390 pixels, light and dark, under the deploy policies.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const out = process.env.SITE_OUT || path.join(root, 'public');
const shots = process.env.SHOTS;
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors 'none'";
let topoCsp = null;
try { topoCsp = /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(path.join(root, 'deploy', 'topology-csp.conf'), 'utf8'))[1]; } catch (e) {}
if (!fs.existsSync(path.join(out, 'nav', 'index.json')) || !fs.existsSync(path.join(out, 'topology', 'topoforge', 'index.html'))) {
  console.log('home browser checks skipped: no topology checkout staged'); process.exit(0);
}
const drawing = JSON.parse(fs.readFileSync(path.join(out, 'drawings', 'index.json'), 'utf8'));
const shopJson = JSON.parse(fs.readFileSync(path.join(out, drawing.file), 'utf8'));
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
const AUTOSAVE = 'topoforge.autosave.v1';

// WCAG relative luminance and contrast, from computed rgb() strings
function lum(c) { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const shopDoc = () => (p) => p.evaluate(() => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d ? d.name : null; });
  const waitDoc = (p, name) => p.waitForFunction((nm) => { const f = document.getElementById('topology'); const d = f && f.contentWindow && f.contentWindow.TopoForge && f.contentWindow.TopoForge.doc; return d && d.name === nm; }, name, { timeout: 15000 });
  const ready = async (p) => { await p.waitForSelector('#nav[data-ready="yes"]', { timeout: 10000 }); await p.waitForSelector('#legend[data-ready="yes"]', { timeout: 10000 }); await p.waitForTimeout(150); };
  const plant = async (p, value) => { await p.goto(base + '404.html'); await p.evaluate(([k, v]) => { localStorage.clear(); if (v !== null) localStorage.setItem(k, v); }, [AUTOSAVE, value]); };

  // ---- 1. the drawing loads for a returning visitor ------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
    // TopoForge opened on its own plants its sample, as Corwin's browser had: the home page still opens the shop's
    await plant(p, null);
    await p.goto(base + 'topology/topoforge/index.html'); await p.waitForFunction(() => window.TopoForge && window.TopoForge.doc && window.TopoForge.doc.pages[0].nodes.length > 0, null, { timeout: 15000 });
    await p.goto(base + '404.html');
    const kept = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), AUTOSAVE);
    assert.ok(kept && kept.name === 'Sample office network' && kept.pages[0].name === 'Page-1', 'TopoForge on its own did not keep its sample (the case to reproduce)');
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, drawing.doc); await ready(p);
    assert.match(await p.textContent('#stage-msg'), /TopoForge's own sample/);
    assert.equal(await p.isHidden('#stage-notice'), true);
    ok('a returning visitor whose browser kept TopoForge\'s own sample (Page-1) sees the shop\'s drawings, and is told why');
    // an empty drawing (TopoForge's File, New)
    await plant(p, JSON.stringify({ format: 'topoforge', version: 1, name: 'Untitled topology', pages: [{ name: 'Page-1', nodes: [], links: [] }], cur: 0 }));
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, drawing.doc);
    assert.match(await p.textContent('#stage-msg'), /was empty/);
    ok('an empty kept drawing does not stop the shop\'s drawings opening');
    // a drawing of the visitor's own: kept, with a notice and a way to the shop's
    await plant(p, JSON.stringify({ name: 'mine', pages: [{ name: 'P', nodes: [{ id: 'a', type: 'server', x: 0, y: 0, w: 80, h: 60, text: 'my box' }], links: [] }], cur: 0 }));
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, 'mine'); await ready(p);
    assert.equal(await p.isVisible('#stage-notice'), true, 'no notice over a drawing of the visitor\'s own');
    assert.match(await p.textContent('#stage-notice'), /your own drawing, kept in this browser: .mine./);
    assert.ok(!/load=/.test(await p.getAttribute('#stage-full', 'href')), '"TopoForge full size" would open the shop\'s drawings over the visitor\'s own');
    await p.click('#stage-notice-b'); await waitDoc(p, drawing.doc);
    assert.equal(await p.isHidden('#stage-notice'), true);
    ok('a drawing of the visitor\'s own is kept, said at the top of the legend, and one press opens the shop\'s');
    // an older copy of the shop's drawings
    const old = JSON.parse(JSON.stringify(shopJson)); old.pages = old.pages.slice(0, -2);
    await plant(p, JSON.stringify(old));
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, drawing.doc); await ready(p);
    assert.match(await p.textContent('#stage-notice'), /older than this site: 2 pages are missing/);
    ok('an older copy of the shop\'s drawings says so, with a way to the current one');
    // nothing kept: "TopoForge full size" carries ?load=
    await plant(p, null); await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, drawing.doc);
    assert.match(await p.getAttribute('#stage-full', 'href'), /\?load=/);
    ok('"TopoForge full size" opens the shop\'s drawings when nothing of the visitor\'s is kept (it no longer plants the sample)');
    await plant(p, null);
    await ctx.close();
  }

  // ---- 2. per width and theme ------------------------------------------------------------------------
  for (const [w, h] of [[1280, 900], [390, 800]]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage();
    const errors = [], offsite = [];
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) offsite.push(u); });
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    const tag = `${w} ${scheme}`, wide = w > 760;
    const box = (s) => p.locator(s).boundingBox();
    const echo = () => p.textContent('#nav-echo');
    await plant(p, null);
    await p.goto(base + 'index.html?ui=classic'); await waitDoc(p, drawing.doc); await ready(p); await p.waitForTimeout(600);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `home-${scheme}-${w}.png`) }); }

    // classic (revision 4): the site's top bar is back at the top at every width
    assert.equal(await p.isVisible('header.top'), true, `the top bar is hidden in classic at ${tag}`);
    assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-ui')), 'classic');
    if (!(await p.isVisible('#nav-q'))) await p.click('.nf-hide');
    await p.click('.menu-b[data-menu="Site"]');
    const site = await p.$$eval('#nf-pop a.mi', (as) => as.map((a) => a.getAttribute('href')));
    const top = await p.$$eval('header.top nav a', (as) => as.map((a) => a.getAttribute('href')));
    for (const href of top) assert.ok(site.includes(href), `the Site menu lacks ${href}`);
    assert.ok(site.includes('jslicense.html'));
    await p.click('#nf-pop [data-cmd="customize"]');
    assert.equal(await p.isVisible('#custom-panel'), true, 'Site, Customize did not open Customize');
    await p.keyboard.press('Escape');
    ok(`the Site menu carries every link of the top bar (${top.length}) and Customize opens its panel, at ${tag}`);

    // every menu item answers in the echo area
    if (scheme === 'light') {
      const menus = await p.$$eval('.menu-b', (b) => b.map((x) => x.getAttribute('data-menu')));
      let count = 0;
      for (const m of menus) {
        await p.click(`.menu-b[data-menu="${m}"]`);
        const cmds = await p.$$eval('#nf-pop button[data-cmd]', (b) => b.map((x) => x.getAttribute('data-cmd')));
        await p.keyboard.press('Escape');
        for (const c of cmds) {
          if (c === 'customize') continue;   // checked above: it opens a panel
          await p.evaluate(() => { document.getElementById('nav-echo').textContent = ''; });
          await p.click(`.menu-b[data-menu="${m}"]`);
          const item = p.locator(`#nf-pop button[data-cmd="${c}"]`);
          if (!(await item.count())) continue;   // the menu changed under the walk (Show / Hide)
          await item.click(); await p.waitForTimeout(40);
          assert.ok((await echo()).trim().length > 0, `${m}, ${c} said nothing`);
          count++;
          if (c === 'hide' && !(await p.isVisible('#nav-q'))) await p.click('.nf-hide');
          if (c === 'newbuf' || c === 'pinbuf') { if (await p.isVisible('.nf-tabx')) await p.click('.nf-tabx'); }
        }
      }
      await p.evaluate(() => { localStorage.removeItem('corwin.cloud.float.v1'); });
      await p.reload(); await waitDoc(p, drawing.doc); await ready(p);
      if (!(await p.isVisible('#nav-q'))) await p.click('.nf-hide');
      ok(`every one of ${count} menu commands says what it did in the echo area, at ${tag}`);
    }

    // the minibuffer wears the frame's face
    const face = await p.evaluate(() => {
      const cs = (s) => getComputedStyle(document.querySelector(s));
      const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; el = el.parentElement; } return 'rgb(255, 255, 255)'; };
      const row = cs('.win .row .it');
      return { row: [row.fontFamily, row.fontSize, row.lineHeight], parts: ['.mb-prompt', '#nav-q', '#nav-pinbuf', '#nav-echo'].map((s) => [s, cs(s).fontFamily, cs(s).fontSize, cs(s).color, bg(document.querySelector(s))]),
        win: bg(document.querySelector('.win-body')), input: ['Top', 'Left', 'Right', 'Bottom'].map((k) => cs('#nav-q')['border' + k + 'Width']) };
    });
    for (const [s, fam, size, color, bgc] of face.parts) {
      assert.equal(fam, face.row[0], `${s} is not in the frame's font`); assert.equal(size, face.row[1], `${s} is not the frame's size`);
      assert.equal(bgc, face.win, `${s} has another background than the windows`);
      const c = contrast(color, bgc); assert.ok(c >= 4.5, `${s} contrast ${c.toFixed(2)} below AA at ${tag}`);
    }
    assert.deepEqual(face.input, ['0px', '0px', '0px', '0px'], 'the minibuffer input is boxed');
    ok(`the minibuffer (prompt, input with no box, [Pin as buffer], echo) shares the windows' font, size and background, AA contrast, at ${tag}`);

    // the palette
    const stage = await box('#stage-grid');
    if (wide) {
      assert.ok(await p.evaluate(() => document.getElementById('nav').classList.contains('fl-float')), 'the navigator does not float by default');
      const fr = await box('#topology');
      assert.ok(Math.abs(fr.width - stage.width) <= 1, `the drawing is ${fr.width}px in a ${stage.width}px stage: the navigator took a column`);
      if (scheme === 'light') {
        const b0 = await box('#nav');
        const g = await box('#nav-grip');
        await p.mouse.move(g.x + 30, g.y + g.height / 2); await p.mouse.down();
        await p.mouse.move(g.x + 80, g.y + g.height / 2 + 20, { steps: 4 }); await p.mouse.move(g.x + 130, g.y + g.height / 2 + 40, { steps: 4 }); await p.mouse.up();
        const b1 = await box('#nav');
        assert.ok(Math.abs(b1.x - b0.x - 100) <= 2 && Math.abs(b1.y - b0.y - 40) <= 2, `dragging the grip by (100, 40) moved it by (${b1.x - b0.x}, ${b1.y - b0.y})`);
        await p.focus('#nav-grip'); await p.keyboard.press('ArrowRight');
        const b2 = await box('#nav'); assert.ok(Math.abs(b2.x - b1.x - 16) <= 1, 'ArrowRight on the grip did not move it 16px');
        await p.click('.menu-b[data-menu="Window"]'); await p.click('#nf-pop [data-cmd="mv-d"]');
        const b3 = await box('#nav'); assert.ok(Math.abs(b3.y - b2.y - 64) <= 1, 'Window, Move down did not move it 64px');
        await p.reload(); await waitDoc(p, drawing.doc); await ready(p);
        const b4 = await box('#nav'); assert.ok(Math.abs(b4.x - b3.x) <= 1 && Math.abs(b4.y - b3.y) <= 1, 'the place was not kept across a reload');
        ok('the navigator floats over the drawing (no column); dragging its grip, the arrow keys and Window, Move each move it, and the place survives a reload');
        await p.click('[data-cmd="dock-left"]');
        const fl = await box('#topology'), nl = await box('#nav');
        assert.ok(nl.x <= stage.x + 1 && fl.x >= nl.x + nl.width - 2, 'docked left, the navigator is not a column on the left');
        await p.reload(); await waitDoc(p, drawing.doc); await ready(p);
        assert.ok(await p.evaluate(() => document.getElementById('stage-grid').classList.contains('dock-left')), 'docked left was not kept');
        await p.click('[data-cmd="dock-right"]');
        const fr2 = await box('#topology'), nr = await box('#nav');
        assert.ok(nr.x >= fr2.x + fr2.width - 2, 'docked right, the navigator is not on the right');
        await p.click('[data-cmd="hide"]');
        const nh = await box('#nav'); assert.ok(nh.width <= 40, `hidden while docked, the strip is ${nh.width}px wide`);
        await p.click('[data-cmd="hide"]'); await p.click('[data-cmd="float"]');
        await p.click('[data-cmd="hide"]');
        const nf = await box('#nav'); assert.ok(nf.height <= 40, `hidden while floating, ${nf.height}px tall`);
        await p.reload(); await waitDoc(p, drawing.doc); await ready(p);
        assert.ok((await box('#nav')).height <= 40, 'hidden was not kept');
        await p.click('[data-cmd="hide"]');
        ok('docked left or right it is a column by choice; float brings it back; hide leaves a strip; each survives a reload');
      }
    } else {
      assert.ok(await p.evaluate(() => document.getElementById('nav').classList.contains('fl-static')), 'on a narrow screen the navigator floats');
      assert.equal(await p.isVisible('[data-cmd="dock-left"]'), false, 'dock buttons offered on a narrow screen');
      ok(`on a narrow screen nothing floats: the navigator sits above the drawing, with no dock buttons, at ${tag}`);
    }

    // classic asks the app for its messages only: it keeps its own chrome; its selection in the navigator's mode-line
    if (wide && scheme === 'light') {
      const fr = p.frame({ url: (u) => /topoforge\/index\.html/.test(u.pathname) });
      const cls = await fr.evaluate(() => document.body.className);
      for (const c of ['tf-frameless', 'tf-fl-props', 'tf-pages', 'tf-hide-menus', 'tf-hide-shapes', 'tf-hide-props', 'tf-hide-pages']) assert.ok(!cls.includes(c), 'classic asked the app for ' + c + ' (' + cls + ')');
      assert.ok(await fr.isVisible('#pagetabs'), 'the app\'s own page tabs are not shown in classic');
      const id = await fr.evaluate(() => { const n = TopoForge.doc.pages[TopoForge.doc.cur].nodes.find((x) => x.data && x.data.what); TopoForge.select([n.id]); return { text: n.text.split('\n')[0], what: n.data.what }; });
      await p.waitForFunction((t) => [...document.querySelectorAll('#nav .ml-item')].some((s) => s.textContent.includes('Selected in the drawing: ' + t)), id.text, { timeout: 5000 });
      const line = await p.textContent('#nav .ml-item');
      assert.ok(line.includes(id.what), 'the mode-line does not carry the shape\'s tooltip: ' + line);
      await fr.evaluate(() => TopoForge.select([])); await p.waitForTimeout(200);
      assert.ok(!(await p.textContent('#nav .ml-item')).includes('Selected in the drawing'), 'the selection stays in the mode-line after it is cleared');
      ok('classic: the app keeps its own chrome; what is selected in it shows in the navigator\'s mode-line with its tooltip, and clears');
    }

    // the legend, in classic: its one row under the drawing (the five cells are free's watermark and *Credits*)
    const row = p.locator('#legend .lg-line a[href="https://github.com/takushieternal"]');
    assert.ok(await row.isVisible(), 'classic does not credit Bryant under the drawing');
    assert.match(await p.textContent('#legend .lg-line'), /GPLv3\+ or LGPLv3\+[\s\S]*CC BY-SA 4\.0/);
    assert.ok(!/-or-later|CC-BY-SA-/.test(await p.textContent('#legend .lg-line')), 'the legend line carries a machine-formatted licence string');
    assert.equal(await p.isVisible('#legend .lg-app'), false, 'classic shows the five-cell legend');
    assert.ok(await p.isVisible('#stage-full') && await p.isVisible('#stage-fresh'), 'classic hides the app full size or Start again');
    const lgc = await p.evaluate(() => { const c = document.querySelector('#legend .lg-line'); let el = c, bg; while (el) { bg = getComputedStyle(el).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) break; el = el.parentElement; } return [getComputedStyle(c).color, bg || 'rgb(255, 255, 255)']; });
    assert.ok(contrast(lgc[0], lgc[1]) >= 4.5, 'the credit row is below AA');
    ok(`classic credits Bryant with his link and the licence in words in one line, AA, with the app full size and Start again, at ${tag}`);
    // no long prose outside the project panels (Corwin: "loose all of the self congratulatory extemporizing");
    // the colophon is the site's credit and licence words, which stay
    const long = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.offsetParent && !el.closest('[role="tabpanel"], #nav, #custom-panel, .shared-ci, .colophon')
      && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && el.innerText.replace(/\s+/g, ' ').trim().length > 160).map((el) => el.tagName + ': ' + el.textContent.trim().slice(0, 70)));
    assert.deepEqual(long, [], 'long prose in classic: ' + long.join(' | '));
    ok(`classic has no block of prose longer than 160 characters outside the project panels, at ${tag}`);
    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'the page scrolls sideways at ' + tag);
    assert.deepEqual(offsite, [], 'requests to other hosts: ' + offsite.join(' | '));
    assert.deepEqual(errors, [], 'console errors: ' + errors.join(' | '));
    ok(`no sideways scroll, no request to another host, no console errors, at ${tag}`);
    await plant(p, null); await p.evaluate(() => localStorage.clear());
    await ctx.close();
  }

  // ---- 3. scripts off, and storage refused ----------------------------------------------------------
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
    await p.goto(base + 'index.html?ui=classic');
    assert.equal(await p.isVisible('header.top'), true);
    assert.ok(await p.locator('#legend .lg-app a[href="https://github.com/takushieternal"]').isVisible());
    assert.ok(await p.locator('#nav a[data-item]').first().isVisible());
    await ctx.close();
    ok('with scripts off: the top bar, the plain list of links and the legend with Bryant\'s link');
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('refused'); } }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(base + 'index.html?ui=classic'); await ready(p);
    const b0 = await p.locator('#nav').boundingBox();
    await p.focus('#nav-grip'); await p.keyboard.press('ArrowDown');
    assert.ok(Math.abs((await p.locator('#nav').boundingBox()).y - b0.y - 16) <= 1, 'with storage refused the navigator does not move');
    assert.ok(await p.locator('#legend .lg-line').isVisible());
    assert.deepEqual(errs, [], 'errors with storage refused: ' + errs.join(' | '));
    await ctx.close();
    ok('with storage refused (classic from the address) the navigator still floats and moves, and the credit row shows');
  }
  await browser.close(); server.close();
  console.log('home browser checks passed: ' + n);
})().catch((e) => { console.error(e); process.exit(1); });
// @license-end
