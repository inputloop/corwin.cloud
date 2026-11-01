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
