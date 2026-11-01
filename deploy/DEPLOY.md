<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Putting corwin.cloud on gw26

The site is plain files. Nothing runs on the server but nginx.

1. On a machine that has this repository and a checkout of topology:
   `TOPOLOGY_DIR=../topology python3 build.py` writes `public/` and `deploy/topology-csp.conf`.
   Run `sh tests/run.sh` first; it must end `ALL CHECKS PASSED`.
2. Copy `public/` to `/var/www/corwin.cloud/public/` on gw26 (rsync with `--delete` is fine).
3. Copy `deploy/topology-csp.conf` to `/etc/nginx/snippets/corwin-cloud-topology-csp.conf`, and
   `deploy/nginx-corwin.cloud.conf` to `/etc/nginx/sites-available/corwin.cloud`; link it into
   `sites-enabled`; add the certificate lines; `sudo nginx -t && sudo systemctl reload nginx`.
4. Check: `curl -sI https://corwin.cloud/ | grep -i content-security-policy` shows
   `script-src 'self'` with no `unsafe-inline`; `curl -sI https://corwin.cloud/topology/app.html`
   shows the hash list.
5. DNS is Corwin's to point. This note does not touch it.

Without a topology checkout the build still works: the home page says so in place of the app.
The staged topology leaves out its `context/` folder (starting requests and transcript reviews, which
are for its own host); set `TOPOLOGY_KEEP_CONTEXT=1` to keep it.
