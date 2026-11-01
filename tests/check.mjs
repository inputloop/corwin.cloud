// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Node checks, no dependencies: node tests/check.mjs  (SITE_OUT=dir to point at a build).
// What the Python checks cannot see: the script handles every fragment the pages link to, and the
// keyboard pattern of the tabs is in the script; the deploy policy stays strict.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.SITE_OUT || join(root, 'public');
const rd = (p) => readFileSync(join(out, p), 'utf8');
const js = rd('js/site.js');

test('every #tab- fragment linked anywhere is a tab on the home page', () => {
  const home = rd('index.html');
  const ids = new Set([...home.matchAll(/role="tab" id="(tab-[\w-]+)"/g)].map((m) => m[1]));
  assert.ok(ids.size >= 8, 'tabs found: ' + ids.size);
  for (const page of ['directory.html', 'packages.html', 'index.html']) {
    for (const m of rd(page).matchAll(/index\.html#(tab-[\w-]+)/g)) {
      assert.ok(ids.has(m[1]), `${page} links #${m[1]} which is no tab`);
    }
  }
});

test('the script has the whole keyboard pattern and roving tabindex', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(js.includes(`'${key}'`), key);
  assert.ok(js.includes("'tabindex'"), 'roving tabindex');
  assert.ok(js.includes('aria-selected'), 'aria-selected');
  assert.ok(js.includes('location.hash'), 'fragment addressing');
});

test('no single-key shortcuts: the prompt needs Alt', () => {
  assert.match(js, /ev\.altKey/);
  assert.ok(!/keydown[\s\S]{0,200}ev\.key === '\/'/.test(js));
});

test('the script reaches for no network and no storage', () => {
  for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sendBeacon', 'document.cookie', 'eval(']) {
    assert.ok(!js.includes(bad), 'script uses ' + bad);
  }
});

test('the deploy policy for the site proper has no unsafe-inline for scripts, and no other host', () => {
  const conf = readFileSync(join(root, 'deploy', 'nginx-corwin.cloud.conf'), 'utf8');
  const policies = [...conf.matchAll(/Content-Security-Policy "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(policies.length >= 1);
  for (const p of policies) {
    const script = (p.match(/script-src ([^;]*)/) || [])[1] || '';
    assert.ok(!script.includes('unsafe-inline') && !script.includes('unsafe-eval'), p);
    assert.ok(!/https?:\/\//.test(p), 'a policy names another host: ' + p);
  }
});

test('the generated topology policy lists scripts by hash, not unsafe-inline', () => {
  const f = join(root, 'deploy', 'topology-csp.conf');
  if (!existsSync(out + '/topology') || !existsSync(f)) return;
  const s = (readFileSync(f, 'utf8').match(/script-src ([^;]*)/) || [])[1] || '';
  assert.ok(!s.includes('unsafe-inline'));
  assert.match(s, /sha256-/);
});

// ---- the default drawings (made by drawings.py; checked here in another language) -------------
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
const topo = process.env.TOPOLOGY_DIR || join(root, '..', 'topology');
const ildir = process.env.INPUTLOOP_DIR || join(root, '..', 'inputloop');
const hasDrawings = existsSync(join(out, 'drawings', 'inputloop.json'));
const set = hasDrawings ? JSON.parse(rd('drawings/inputloop.json')) : null;
const strip = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// the directory, read from its page: each card's name and its "Made by" line
const cards = [...rd('directory.html').matchAll(/<h3 id="c-[^"]*">([^<]+)<\/h3>[\s\S]*?<p class="credit">Made by: ([^<]*)<\/p>/g)].map((m) => ({ name: strip(m[1]), credit: strip(m[2]) }));

test('every project the directory lists has its own tab (page) in the default drawings, with its credit', () => {
  assert.ok(hasDrawings, 'no drawings/inputloop.json');
  assert.ok(cards.length >= 20, 'cards read from directory.html: ' + cards.length);
  for (const c of cards) {
    const pg = set.pages.find((p) => p.name === c.name);
    assert.ok(pg, `no page named ${c.name} in the default drawings`);
    const title = pg.nodes.find((n) => n.type === 'text' && n.text.startsWith(c.name + ':'));
    assert.ok(title && title.text.includes('Made by: ' + c.credit.replace(/\.$/, '')), `${c.name}: its page does not say who made it as the directory does`);
    assert.ok(existsSync(join(out, 'drawings', c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json')), `${c.name}: no file of its own`);
  }
});

test('the drawings are TopoForge documents: pages with layers, nodes and links that point at nodes', () => {
  assert.equal(set.format, 'topoforge');
  for (const p of set.pages) {
    assert.ok(Array.isArray(p.layers) && p.layers.length, p.name);
    const ids = new Set(p.nodes.map((n) => n.id));
    for (const l of p.links) assert.ok(ids.has(l.a.id) && ids.has(l.b.id), `${p.name}: link ${l.id} has a loose end`);
    for (const n of p.nodes) if (n.parent) assert.ok(ids.has(n.parent), `${p.name}: ${n.id} sits in nothing`);
  }
});

// a TOPOLOGY.md, read here the plain way: front matter lines, and the lines under a Private heading
function readTopo(t) {
  const lines = t.split('\n'); const front = {}; let i = 0;
  if (lines[0] === '---') { for (i = 1; i < lines.length && lines[i] !== '---'; i++) { const m = /^([\w-]+):\s*(.*?)\s*(#.*)?$/.exec(lines[i]); if (m) front[m[1].toLowerCase()] = m[2]; } i++; }
  const priv = []; let lvl = 0;
  for (; i < lines.length; i++) {
    const h = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (h) { if (/^private$/i.test(h[2])) { lvl = h[1].length; continue; } if (lvl && h[1].length <= lvl) lvl = 0; }
    if (lvl && lines[i].trim()) priv.push(lines[i].trim());
  }
  return { front, priv };
}
function walk(d, acc = []) { if (!existsSync(d)) return acc; for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, acc); else if (f === 'TOPOLOGY.md' || f === '.topology.md') acc.push(p); } return acc; }
const examples = walk(join(topo, 'examples', 'inputloop')).map((p) => readTopo(readFileSync(p, 'utf8')));
const ours = hasDrawings ? readdirSync(join(out, 'drawings')).filter((f) => f.endsWith('.json') && f !== 'how-gitcha-works.json').map((f) => rd('drawings/' + f)).join('\n') : '';

test('nothing a TOPOLOGY.md keeps under ## Private is drawn', () => {
  const lines = examples.flatMap((e) => e.priv).filter((l) => l.length > 12);
  if (!examples.length) return;
  assert.ok(lines.length >= 1, 'the examples hold no private part to test against');
  for (const l of lines) assert.ok(!ours.includes(JSON.stringify(l).slice(1, -1)), 'a private line is drawn: ' + l);
});

test('no host is named in the drawings but the public ghostwheel hosts and forges', () => {
  const pub = /^(gw\d+|code\.bru\.st|github\.com\/inputloop)$/;
  const hidden = examples.filter((e) => e.front.pillar === 'place' && ['server', 'desktop', 'laptop'].includes(e.front.kind) && !pub.test(e.front.name)).map((e) => e.front.name);
  if (!examples.length) return;
  assert.ok(hidden.length >= 1, 'no private host in the examples to test against');
  for (const h of hidden) assert.ok(!new RegExp('\\b' + h + '\\b', 'i').test(ours), `${h} is named in the drawings`);
});

test("Bryant's drawing of Gitcha is his, byte for byte, credited, and in the default set", () => {
  const f = join(out, 'drawings', 'how-gitcha-works.json');
  if (!existsSync(f)) return;   // a build with no gitcha checkout leaves it out and says so
  const sha = createHash('sha256').update(readFileSync(f)).digest('hex');
  const story = join(ildir, 'gitcha', 'topoforge', 'how-gitcha-works-story.md');
  const want = existsSync(story) ? /drawing-sha256=([0-9a-f]{64})/.exec(readFileSync(story, 'utf8'))[1] : 'a7adb644bc436bfea2ee2445a7872936fc9b5897d6f92e25079cc5dda51f0289';
  assert.equal(sha, want);
  const n = JSON.parse(readFileSync(f, 'utf8')).pages.length;
  assert.equal(set.pages.filter((p) => p.name.startsWith('How Gitcha works (Bryant) ')).length, n);
  assert.match(rd('demo/gitcha/index.html'), /The drawing and the screenshots are Bryant Frankford&#x27;s|The drawing and the screenshots are Bryant Frankford's/);
});

test('stage.js reads one key, TopoForge\'s own, writes nothing and asks the network for nothing', () => {
  const s = rd('js/stage.js');
  assert.deepEqual([...s.matchAll(/localStorage\.(\w+)\(/g)].map((m) => m[1]), ['getItem']);
  assert.match(s, /getItem\('topoforge\.autosave\.v1'\)/);
  for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'document.cookie', 'eval(', 'setItem', 'removeItem', 'clear()']) assert.ok(!s.includes(bad), 'stage.js uses ' + bad);
  assert.ok(!/\bsrc\s*=\s*[^;]*\?load=/.test(s.replace(/getAttribute\('data-first'\)/g, '')), 'stage.js builds its own ?load= address');
});

test('the demo policy runs no inline script and names no other host', () => {
  const f = join(root, 'generated', 'demo-csp.conf');
  if (!existsSync(f)) return;
  const p = /Content-Security-Policy "([^"]+)"/.exec(readFileSync(f, 'utf8'))[1];
  const script = /script-src ([^;]*)/.exec(p)[1];
  assert.equal(script.trim(), "'self'");
  assert.ok(!/https?:/.test(p));
});
