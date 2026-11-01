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

Work lands on `main` once the checks are green. Nothing here makes anything more public, rewrites
history or force-pushes. The person reviews and pushes.

## Public-repository care

- Link only public repositories (`PUBLIC_URLS` in `catalog.py`). A private project is named with
  "not public yet" and never given an address.
- topology is private and contains Bryant Frankford's TopoForge: never copy its `www/` or any of its
  sources here. The build stages it from a local checkout into `public/`, which is not committed.
- No secrets, no machine paths, no device ids (the obsmage tab's diagram uses invented names), no
  hostnames beyond the public ghostwheel names.
- No inline script, no `style=""`, nothing loaded from another host. Every script keeps its LibreJS
  label and its row in `jslicense.html`.
- Credit as the shop's catalog gives it. Numbers only with the date they were counted.

## Before every push

`sh tests/run.sh` ends `ALL CHECKS PASSED` and `sh tests/run.sh --prove-red` ends `PROVE-RED OK`. A
new promise gets a check, and the check gets a planted fault in `--prove-red`.
