// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
// Node checks, no dependencies: node tests/check.mjs  (SITE_OUT=dir to point at a build).
// What the Python checks cannot see: the script handles every fragment the pages link to, and the
// keyboard pattern of the tabs is in the script; the deploy policy stays strict.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
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
  const want = existsSync(story) ? /drawing-sha256=([0-9a-f]{64})/.exec(readFileSync(story, 'utf8'))[1] : '663e8a56a5874b0b7a083b89da7f5a753d68827ba95862043cf6e96cada1d3e0';
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

test('the demo policy runs no inline script and names no other host; eval only in a folder that says why', () => {
  const f = join(root, 'generated', 'demo-csp.conf');
  if (!existsSync(f)) return;
  const conf = readFileSync(f, 'utf8');
  const p = /^add_header Content-Security-Policy "([^"]+)"/m.exec(conf)[1];
  assert.equal(/script-src ([^;]*)/.exec(p)[1].trim(), "'self'");
  const lines = conf.split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const outside = lines.replace(/location [^{]*\{[^}]*\}/g, '');
  assert.ok(!outside.includes('unsafe-eval'), 'unsafe-eval outside a demo folder of its own');
  for (const m of conf.matchAll(/# ([\w.-]+): ([^\n]+)\nlocation \^~ (\S+) \{([^}]*)\}/g)) {
    assert.equal(m[3], `/demo/${m[1]}/app/`, 'a policy of its own for a folder that is not one demo\'s app');
    assert.equal(/script-src ([^;]*)/.exec(m[4])[1].trim(), "'self' 'unsafe-eval'", m[1]);
    assert.ok(m[2].length > 20, m[1] + ': no reason written beside it');
  }
  assert.equal((lines.match(/unsafe-eval/g) || []).length, (conf.match(/^location /gm) || []).length, 'unsafe-eval with no reason and folder of its own');
  assert.ok(!/https?:/.test(conf) && !conf.includes('unsafe-inline\' ;') && !/script-src[^;]*unsafe-inline/.test(conf));
});

// ---- release channels: badges.js reads the feed of c4's d/channels/SPEC.md -------------------------
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const fx = (n) => readFileSync(join(root, 'tests', 'fixtures', n), 'utf8');
const badgesSrc = rd('js/badges.js');

test('badges.js reads a feed in the line form and says it in words; anything else is nothing', () => {
  const B = req(resolve(out, 'js', 'badges.js'));
  const good = B.readFeed(fx('channel-good.json'), 'about-corwin');
  assert.ok(good, 'the good feed was refused');
  assert.equal(B.describe(good), 'Last revision 40ffbb38e32a, made 1 November 2026 at 18:13 UTC.');
  for (const bad of ['channel-one-line.json', 'channel-four-spaces.json', 'channel-other-channel.json', 'channel-bad-stamp.json', 'channel-no-format.json', 'channel-trailing-comma.json']) {
    assert.equal(B.readFeed(fx(bad), 'about-corwin'), null, bad + ' was read as a feed');
  }
});

test('badges.js asks only this site, only for /dist/<channel>/channel.json, and stores nothing', () => {
  assert.ok(!/https?:/.test(badgesSrc.split('\n').slice(1).join('\n')), 'badges.js names an address on another host');
  assert.match(badgesSrc, /new URL\('\/dist\/' \+ name \+ '\/channel\.json', root\.location\.href\)/);
  assert.match(badgesSrc, /url\.origin !== root\.location\.origin/);
  assert.equal((badgesSrc.match(/fetch\(/g) || []).length, 1);
  for (const bad of ['localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'document.cookie', 'eval(', 'innerHTML']) assert.ok(!badgesSrc.includes(bad), 'badges.js uses ' + bad);
});

test('the site policy lets a page read this site only: connect-src is self', () => {
  const conf = readFileSync(join(root, 'deploy', 'nginx-corwin.cloud.conf'), 'utf8');
  const site = /Content-Security-Policy "(default-src 'self'; script-src 'self'; style-src 'self';[^"]+)"/.exec(conf)[1];
  assert.equal(/connect-src ([^;]*)/.exec(site)[1].trim(), "'self'");
});

// ---- processes: the notation is data, decided by topology's own table ----------------------------
test('every process element is drawn with the shape its notation gives its role, as topology-core.js says', async () => {
  const core = join(topo, 'www', 'js', 'topology-core.js');
  if (!existsSync(core) || !hasDrawings) return;
  const { NOTATIONS } = await import(core);
  const ix = JSON.parse(rd('drawings/index.json'));
  assert.ok(Object.keys(ix.processes || {}).length >= 1, 'no process in the default set');
  let n = 0;
  for (const [pid, v] of Object.entries(ix.processes)) {
    for (const [key, file] of Object.entries(v.files)) {
      const nt = NOTATIONS[key]; assert.ok(nt, key);
      const page = JSON.parse(rd(file)).pages[0];
      for (const node of page.nodes) {
        const d = node.data || {};
        if (!d.element) continue;
        const role = d.element.replace(' (end)', '');
        let want;
        if (role === 'lane') want = nt.elements.lane || 'zone';
        else if (key === 'bpmnplus' && d.act && nt.elements[d.act]) want = nt.elements[d.act];
        else if (key === 'flowchart') want = nt.elements[{ event: d.element.endsWith('(end)') ? 'end' : 'start', task: 'step', gateway: 'decision', data: 'io' }[role]] || 'rounded';
        else want = nt.elements[role] || 'rounded';
        assert.equal(node.type, want, `${pid} as ${key}: ${node.id} (${d.element}${d.act ? ', ' + d.act : ''}) drawn as ${node.type}`);
        for (const k of ['bpmn', 'bpmnplus', 'flowchart']) assert.ok(d['as ' + NOTATIONS[k].name], `${node.id} does not say how ${NOTATIONS[k].name} reads it`);
        n++;
      }
    }
    assert.equal(set.pages[v.page].name, v.name, pid + ': not in the default set where the index says');
  }
  assert.ok(n >= 30, 'process elements checked: ' + n);
});

// ---- the left nav (docs/NAV.md) ------------------------------------------------------------------
const navSrc = existsSync(join(out, 'js', 'nav.js')) ? rd('js/nav.js') : null;
test('nav.js reads one file from this site, nav/index.json, and names no other host', { skip: !navSrc }, () => {
  const body = navSrc.split('\n').slice(1).join('\n');
  assert.equal((body.match(/\bfetch\(/g) || []).length, 1, 'nav.js fetches more than one thing');
  assert.match(body, /fetch\('nav\/index\.json'/);
  assert.ok(!/https?:\/\//.test(body), 'nav.js names an address on another host');
  assert.ok(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(body));
});
test('nav.js touches storage only inside try, under its one key', { skip: !navSrc }, () => {
  const lines = navSrc.split('\n').filter((l) => /localStorage/.test(l));
  assert.ok(lines.length >= 2);
  for (const l of lines) assert.match(l, /try \{.*localStorage\.(get|set)Item\(KEY/, 'storage outside try: ' + l.trim());
  assert.match(navSrc, /KEY = 'corwin\.cloud\.nav\.v1'/);
});
test('the nav keys need Ctrl or Alt first: no single-key shortcut starts anything', { skip: !navSrc }, () => {
  assert.match(navSrc, /ev\.ctrlKey && !ev\.altKey && !ev\.metaKey && \(ev\.key === 'x'/);
  assert.match(navSrc, /ev\.altKey && !ev\.ctrlKey && !ev\.metaKey && \(ev\.key === 'x'/);
  assert.match(navSrc, /if \(inField\) return;/, 'the prefix keys must leave the prompt alone (Ctrl+X is cut there)');
});
test('nothing in the navigator animates: its stylesheet section has no transition or animation', () => {
  const css = rd('css/site.css');
  const i = css.indexOf('/* ---- the navigator');
  assert.ok(i > 0, 'no navigator section in site.css');
  const sec = css.slice(i);
  assert.ok(!/\b(transition|animation)\s*:/.test(sec), 'the navigator section animates something');
});

// ---- fresh after every install (Corwin's browser kept an old page under max-age=86400, 2026-11-01) ----
test('every file the site serves revalidates: no-cache with an ETag, in every location that sets headers', () => {
  for (const f of ['nginx-corwin.cloud.conf', 'corwin.cloud.interim.conf']) {
    const conf = readFileSync(join(root, 'deploy', f), 'utf8').replace(/#.*$/gm, '');
    for (const m of conf.matchAll(/max-age=(\d+)/g)) assert.ok(+m[1] <= 300, f + ': max-age=' + m[1] + ' keeps an old page after an install');
    const site = conf.slice(conf.lastIndexOf('server {'));
    assert.match(site, /^\s*etag on;/m, f + ': no etag on');
    const top = site.split(/\n\s*location /)[0];
    assert.match(top, /add_header Cache-Control "no-cache" always;/, f + ': the server does not say no-cache');
    for (const loc of site.split(/\n\s*location /).slice(1)) {
      const body = loc.slice(0, loc.indexOf('\n    }'));
      if (/add_header/.test(body)) assert.match(body, /add_header Cache-Control "no-cache" always;/, f + ': location ' + body.split('{')[0].trim() + ' sets headers but not Cache-Control (nginx does not inherit it there)');
    }
  }
});

// ---- the app's own messages and calls (topology forge 1.8) ----------------------------------------
test('the home page scripts ask the app, never reach into its page, and hear only its own frame', () => {
  for (const f of ['stage.js', 'nav.js', 'float.js', 'free.js']) {
    const s = rd('js/' + f);
    for (const bad of ['contentDocument', '#pagetabs', '.ptab', "getElementById('palette')", "getElementById('side')"]) assert.ok(!s.includes(bad), f + ' reaches into the app\'s page: ' + bad);
    const listeners = s.split("addEventListener('message'").length - 1;
    const guarded = (s.match(/ev\.origin !== window\.location\.origin \|\| ev\.source !== (f|frame|app)\.contentWindow/g) || []).length;
    assert.equal(guarded, listeners, f + ': ' + listeners + ' message listener(s), ' + guarded + ' checking the origin and that the message is from the frame');
  }
  assert.ok(rd('js/stage.js').includes('showPage('), 'stage.js does not open a page by the app\'s own showPage');
  assert.ok(!/setInterval|setTimeout\(function \(\) \{ (choose|fit)/.test(rd('js/stage.js') + rd('js/nav.js').replace(/setTimeout/g, '')), 'a poll for the app is back');
});

// ---- the palettes (docs/NAV.md, revision 2) -------------------------------------------------------
const floatSrc = existsSync(join(out, 'js', 'float.js')) ? rd('js/float.js') : null;
test('float.js asks the network for nothing, keeps storage inside try under its one key, and only reads TopoForge', { skip: !floatSrc }, () => {
  const body = floatSrc.split('\n').slice(1).join('\n');
  assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\//.test(body), 'float.js reaches the network');
  const lines = floatSrc.split('\n').filter((l) => /localStorage/.test(l));
  assert.ok(lines.length >= 2);
  for (const l of lines) assert.match(l, /try \{.*localStorage\.(get|set)Item\(F?KEY/, 'storage outside try: ' + l.trim());
  assert.match(floatSrc, /KEY = 'corwin\.cloud\.float\.v1'/);
  assert.match(floatSrc, /FKEY = 'corwin\.cloud\.free\.v1'/);
  const tf = floatSrc.split('\n').filter((l) => /contentDocument|\bd\.|\bp\.|\bs\./.test(l) && /contentDocument|getElementById\('(palette|side)'\)/.test(l));
  for (const l of tf) assert.ok(!/(appendChild|setAttribute|classList|innerHTML|textContent\s*=|style\.)/.test(l), 'float.js changes TopoForge: ' + l.trim());
});


// ---- free and classic (docs/NAV.md, revision 4) ----------------------------------------------------
const freeSrc = existsSync(join(out, 'js', 'free.js')) ? rd('js/free.js') : null;
test('free.js reads one file from this site, nav/index.json, keeps nothing in storage, and names no other host', { skip: !freeSrc }, () => {
  const body = freeSrc.split('\n').slice(1).join('\n');
  const fetches = body.match(/\bfetch\(([^,)]*)/g) || [];
  assert.deepEqual(fetches, ["fetch('nav/index.json'"], 'free.js fetches: ' + fetches.join(', '));
  assert.ok(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource|https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(body), 'free.js reaches another host');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(body), 'free.js keeps something in this browser itself (places are float.js\'s)');
});
test('free.js asks the app only through its documented calls', { skip: !freeSrc }, () => {
  // every name given tf() (the app's window.TopoForge), and every call made on it
  const names = [...new Set((freeSrc.match(/\b(\w+) = tf\(\)/g) || []).map((m) => m.split(' ')[0]))];
  assert.ok(names.length >= 1);
  const calls = new Set();
  for (const n of names) for (const m of freeSrc.matchAll(new RegExp('\\b' + n + '\\.(\\w+)\\(', 'g'))) calls.add(m[1]);
  // EMBED v1 as 1.8 documents it, plus endKeys() (documented as added in 1.9; free.js calls it only on a
  // topoforge:key message, which only 1.9 sends, and only when the version says 1.9)
  const allowed = ['commands', 'run', 'shapes', 'place', 'showPage', 'embed', 'ready', 'panels', 'endKeys'];
  for (const c of calls) assert.ok(allowed.includes(c), 'free.js calls the app\'s ' + c + '(), which EMBED v1 does not document');
  for (const c of ['commands', 'shapes', 'place', 'showPage', 'embed']) assert.ok(calls.has(c), 'free.js does not use ' + c + '()');
});
test('the Emacs frame\'s keys start with Ctrl, Alt, Escape (Emacs\'s ESC prefix) or F10: no letter alone runs anything', { skip: !freeSrc }, () => {
  const k = freeSrc.slice(freeSrc.indexOf('function keys(f, ev)'), freeSrc.indexOf("// Alt+x anywhere on the page"));
  assert.ok(k.length > 500);
  assert.match(k, /if \(inField\) return;/);
  assert.match(k, /ev\.ctrlKey && !ev\.altKey && !ev\.metaKey && \(k === 'x' \|\| k === 'X'\)\) \{ ev\.preventDefault\(\); prefix = 'C-x'/);
  assert.ok(!/if \(k === '[a-z0-9.]'\)/.test(k), 'a single key starts something');
});
test('nothing in an Emacs frame moves by itself: its stylesheet section has no transition or animation', () => {
  const css = rd('css/site.css'), sec = css.slice(css.indexOf('/* ---- page layouts: free and classic'));
  assert.ok(sec.length > 1000, 'the free and classic section is missing');
  assert.ok(!/transition|animation/.test(sec.replace(/\/\*[\s\S]*?\*\//g, '')), 'an Emacs frame animates');
});
test('ui.js keeps one key inside try, defaults to free, and asks the network for nothing', () => {
  const u = rd('js/ui.js'), body = u.split('\n').slice(1).join('\n');
  assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(body));
  for (const l of u.split('\n').filter((x) => /localStorage/.test(x))) assert.match(l, /try \{.*localStorage\.(get|set)Item\(KEY/, 'storage outside try: ' + l.trim());
  assert.match(u, /: 'free';/);
});
