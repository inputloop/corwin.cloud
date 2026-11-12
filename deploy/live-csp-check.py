#!/usr/bin/env python3
# live-csp-check.py -- after a deploy, check that the live policy lets the live app run.
#
#   python3 deploy/live-csp-check.py [URL]       exit 0 when every inline script of the page is named in its policy
#   python3 deploy/live-csp-check.py --prove-red  a policy one hash short, and one for another app, must each fail
#
# The app under /topology/ runs only inline scripts whose sha256 its Content-Security-Policy names (script-src 'self'
# 'sha256-...'). That policy is an nginx snippet, installed apart from the files: on 2026-11-12 the files went live
# with draw 1.15 and the snippet stayed at 1.14, every page answered 200, and the browser refused the app's script
# (no drawing, no shapes) for an hour and a half. A 200 cannot see that; this does. Standard library only.
#
# Copyright 2026 INPUTLOOP (Bryant Frankford and Corwin Brust).  SPDX-License-Identifier: GPL-3.0-or-later
# Mentat (for Corwin; claude-opus-5-5)
import base64, hashlib, re, sys, urllib.request

URL = 'https://corwin.cloud/topology/topoforge/index.html'


def inline_hashes(html):
    """The sha256 (base64) of each inline <script> body, as a browser computes it for a policy."""
    out = []
    for attrs, body in re.findall(r'<script\b([^>]*)>(.*?)</script>', html, re.S | re.I):
        if re.search(r'\bsrc\s*=', attrs, re.I):
            continue
        out.append('sha256-' + base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode())
    return out


def judge(html, policy):
    """None when every inline script is allowed, else what is missing, in words."""
    m = re.search(r"script-src(?:-elem)?\s+([^;]*)", policy or '')
    if not m:
        return 'the page sends no script-src policy'
    allowed = set(re.findall(r"'(sha256-[A-Za-z0-9+/=]+)'", m.group(1)))
    if "'unsafe-inline'" in m.group(1) and not allowed:
        return None
    need = inline_hashes(html)
    missing = [h for h in need if h not in allowed]
    if missing:
        return '%d of %d inline scripts are not in the policy: %s' % (len(missing), len(need), ' '.join(missing))
    return None


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=20) as r:
        return r.read().decode('utf-8'), r.headers.get('Content-Security-Policy', '')


if sys.argv[1:2] == ['--prove-red']:
    page = '<script>var a = 1;</script><script src="x.js"></script><script>var b = 2;</script>'
    hs = inline_hashes(page)
    good = "script-src 'self' '%s' '%s'" % tuple(hs)
    plants = [('a policy that names every inline script', good, True),
              ('a policy one hash short (the 2026-11-12 fault)', "script-src 'self' '%s'" % hs[0], False),
              ('a policy for another app', "script-src 'self' 'sha256-AAAA'", False),
              ('no policy at all', '', False)]
    bad = 0
    for name, policy, want_ok in plants:
        ok = judge(page, policy) is None
        print(('ok    ' if ok == want_ok else 'FAIL  ') + name + (': passes' if ok else ': caught'))
        bad += ok != want_ok
    print('prove-red: ' + ('every plant caught, the right policy passes' if not bad else '%d wrong' % bad))
    sys.exit(1 if bad else 0)

url = sys.argv[1] if len(sys.argv) > 1 else URL
html, policy = fetch(url)
why = judge(html, policy)
n = len(inline_hashes(html))
print(('ok    ' if why is None else 'FAIL  ') + url + ': ' + (why or 'all %d inline scripts are in the policy' % n))
sys.exit(1 if why else 0)
