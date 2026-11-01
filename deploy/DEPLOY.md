<!--
SPDX-FileCopyrightText: 2026 INPUTLOOP
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Putting corwin.cloud on gw33

The site is plain files. Nothing runs on the server but nginx.

1. On a machine that has this repository and a checkout of topology:
   `TOPOLOGY_DIR=../topology python3 build.py` writes `public/` and `deploy/topology-csp.conf`.
   Run `sh tests/run.sh` first; it must end `ALL CHECKS PASSED`.
2. Copy `public/` to `/var/www/corwin.cloud/public/` on gw33 (rsync with `--delete` is fine).
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

## Live on gw33 (2026-11-01)

Installed with `sh deploy/install.sh` after `TOPOLOGY_DIR=../topology python3 build.py`: port 80 only,
through `deploy/corwin.cloud.interim.conf`, until DNS for corwin.cloud points at gw33. Checked on gw33
with `curl -H 'Host: corwin.cloud' http://127.0.0.1/…`: the three pages and `/topology/` answer 200, an
unknown path 404, and `/topology/` carries its own hash-listed script policy.

DNS pointed at gw33 the same day (porkbun: the parking ALIAS removed, apex and www A to 149.5.245.7; the
record is c4 `d/dns/corwin.cloud/2026/11/01/162544.txt`). Then `sh deploy/install-tls.sh`: certbot (webroot,
both names, renews on its own timer), the TLS block in place of the interim one, backed out if `nginx -t`
fails. https://corwin.cloud and https://www.corwin.cloud answer 200; plain http answers 301 to https.
Run as the gw33 account on gw33 (it has sudo); the vibrobeast account there has none.
