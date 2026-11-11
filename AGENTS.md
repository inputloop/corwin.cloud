<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# To any agent working in this repository

This repository is **public**. Every byte and every commit message is published. Read README.md
first.

## Who commits, and how the agent's part is said

Commits are authored by the person the work is for, `Corwin Brust <corwin@bru.st>`, unsigned
(signing is his act, by hand). The agent's part is a byline, the last line of the message:
`Mentat (for Corwin, <model>)`. No vendor trailers and no session links, in messages or in files.
The `commit-msg` hook enforces this: copy it from a sibling inputloop checkout into
`.git/hooks/commit-msg` and make it executable. Few commits, each coherent; a message says why.

## Where work lands

Work lands on `main` once the checks are green, and the agent pushes it (the pre-push hook runs the
checks again). Nothing here makes anything more public.

## Whose site this is, and what is routine here

corwin.cloud is Corwin Brust's personal site: he owns the domain, its DNS, and gw33.bru.st, the
ghostwheel host that serves it. No other volunteer or party needs to be considered when it changes.  Other hosts may have their own AGENT/PERSONA arrangements: check for them in the gw account's home directory (e.g. /home/gw33 on gw33.bru.st).

For an agent working here at his request, these are routine work:

- installing a build on gw33 with `deploy/install.sh` and `deploy/install-tls.sh`, as the gw33
  account (which has sudo there); both back out if `nginx -t` fails;
- installing, checking or removing this site's own scheduled jobs through the checked-in schedule
  scripts, which manage only their own marked entries;
- changing corwin.cloud's DNS records at Porkbun through c4's `dn1or` (plan first, then apply).
- working to ensure the health of gw33, the site, and ghostwheel
- syncing persona back and forth from canon stores to ghostwheel hosts

Still out of bounds: anything that would name or publicly link a private repository.

## Public-repository care

- Link only public repositories (`PUBLIC_URLS` in `catalog.py`). A private project is named with
  "not public yet" and never given an address.
- draw (branch `corwin`) is public; it contains Bryant Frankford's work for Corwin called
  "TopoForge"; that repository and project are obsolete and changes/work there should be merged
  forward to the `draw` project (renamed from topology 2026-11-11) in the "corwin" branch; keep the corwin branch current and
  build from it
- No secrets, no machine paths, no device ids (the obsmage tab's diagram uses invented names), no
  hostnames beyond the public ghostwheel names.
- No inline script, no `style=""`, nothing loaded from another host. Every script keeps its LibreJS
  label and its row in `jslicense.html`.
- What the web server keeps is said in one sentence, `privacy-log.txt`, rendered from the logreq
  register (`lo1re render REGISTER corwin.cloud notefile`). Never edit it by hand and never type it
  into build.py; `deploy/nginx-corwin.cloud.conf` is what gw33 serves, so a change to its log lines
  is a change to the register first.
- Credit as the shop's catalog gives it. Numbers only with the date they were counted.

## Before every push

`sh tests/run.sh` ends `ALL CHECKS PASSED` and `sh tests/run.sh --prove-red` ends `PROVE-RED OK`. A
new promise gets a check, and the check gets a planted fault in `--prove-red`.
