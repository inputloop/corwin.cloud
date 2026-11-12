<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Putting corwin.cloud on gw33

The site is plain files. Nothing runs on the server but nginx.

1. On a machine that has this repository and a checkout of draw:
   `DRAW_DIR=../draw python3 build.py` writes `public/` and `deploy/topology-csp.conf`.
   Run `sh tests/run.sh` first; it must end `ALL CHECKS PASSED`.
2. Copy `public/` to `/var/www/corwin.cloud/public/` on gw33 (rsync with `--delete` is fine), and give
   it world-readable modes: `rsync -a --delete --chmod=D755,F644`, or `install.sh`, which sets them. A
   build written on a Windows-backed folder carries owner-only modes, and nginx answers 403 for those
   files (2026-11-12: draw's pages under /topology/, for a minute, after a hand copy without them).
   Whenever the app changes, install the rebuilt `deploy/topology-csp.conf` with it (step 3): the
   policy names the app's inline script by its sha256, so new files under an old snippet answer 200
   and the browser refuses the app (2026-11-12: draw 1.15 under 1.14's snippet, an hour and a half
   with no drawing). After any deploy, run `python3 deploy/live-csp-check.py`: it fetches the live
   app and fails unless its policy names every inline script (`--prove-red` shows it can fail).
3. Copy `deploy/topology-csp.conf` to `/etc/nginx/snippets/corwin-cloud-topology-csp.conf`, and
   `deploy/nginx-corwin.cloud.conf` to `/etc/nginx/sites-available/corwin.cloud`; link it into
   `sites-enabled`; add the certificate lines; `sudo nginx -t && sudo systemctl reload nginx`.
4. Check: `curl -sI https://corwin.cloud/ | grep -i content-security-policy` shows
   `script-src 'self'` with no `unsafe-inline`; `curl -sI https://corwin.cloud/topology/app.html`
   shows the hash list.
5. DNS is Corwin's to point. This note does not touch it.

Without a draw checkout the build still works: the home page says so in place of the app.
The staged draw leaves out its `context/` folder (starting requests and transcript reviews, which
are for its own host); set `TOPOLOGY_KEEP_CONTEXT=1` to keep it.

## Live on gw33 (2026-11-01)

Installed with `sh deploy/install.sh` after `DRAW_DIR=../draw python3 build.py`: port 80 only,
through `deploy/corwin.cloud.interim.conf`, until DNS for corwin.cloud points at gw33. Checked on gw33
with `curl -H 'Host: corwin.cloud' http://127.0.0.1/…`: the three pages and `/topology/` answer 200, an
unknown path 404, and `/topology/` carries its own hash-listed script policy.

DNS pointed at gw33 the same day (porkbun: the parking ALIAS removed, apex and www A to 149.5.245.7; the
record is c4 `d/dns/corwin.cloud/2026/11/01/162544.txt`). Then `sh deploy/install-tls.sh`: certbot (webroot,
both names, renews on its own timer), the TLS block in place of the interim one, backed out if `nginx -t`
fails. https://corwin.cloud and https://www.corwin.cloud answer 200; plain http answers 301 to https.
Run as the gw33 account on gw33 (it has sudo); the vibrobeast account there has none.

## The site's own request and error logs (2026-11-04)

His pick for what the server keeps (logreq option A+agent, live since run 20261104T225156Z): the address, the
time, the page without its query, whether it was found, and the browser's description of itself, in
`/var/log/nginx/corwin.cloud/access.log`; errors in `error.log` beside it; both rotated daily and kept 14 days
(`deploy/logrotate-corwin.cloud`, installed as `/etc/logrotate.d/nginx-corwin.cloud`). The lines are in both
server blocks of `deploy/nginx-corwin.cloud.conf` and in the interim block. `deploy/install.sh` makes the folder
before `nginx -t` (which fails without it) and installs the rotation file. The note's sentence is
`privacy-log.txt`, rendered from the logreq register; change the register, render, rebuild, never edit by hand.

## 79cd1b6 on gw33 (2026-11-10)

Built away from the Windows mount (a clone in the Linux VM, with the demos taken by `git archive` at the
commits revision 11 staged, draw 1.14 at 68c76c1, about-corwin df4f22f); the file list matched
revision 11's exactly. Bundle `corwin-cloud-deploy/gw33-deploy-2026-11-10.tgz` (sha256 58573a778ad259bb...),
installed with its `run.sh`. 25 files staged from the mount kept mode 0700, and `/topology/` answered 403 for
about a minute until they were made readable; `install.sh` now sets 755/644 on everything it serves, and
`test-install.sh` holds it to that (with a planted fault in `--prove-red`).
