#!/bin/sh
# install-tls.sh -- on gw33, after install.sh and once corwin.cloud's DNS points here: get the certificate
# (certbot, webroot: nginx keeps serving) and swap the port-80 interim block for the TLS block.
# Backs out to the interim block on any nginx -t failure.  Safe to run again: certbot keeps a valid certificate.
# Copyright 2026 INPUTLOOP; GPL-3.0-or-later OR LGPL-3.0-or-later.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
sudo certbot certonly --webroot -w /var/www/corwin.cloud/public -d corwin.cloud -d www.corwin.cloud \
  --non-interactive --agree-tos --keep-until-expiring
sudo test -s /etc/letsencrypt/live/corwin.cloud/fullchain.pem || { echo "no certificate; nothing swapped" >&2; exit 1; }
sudo cp /etc/nginx/sites-available/corwin.cloud /etc/nginx/sites-available/corwin.cloud.interim-backup
sudo install -m 644 "$here/nginx-corwin.cloud.conf" /etc/nginx/sites-available/corwin.cloud
if sudo nginx -t 2>&1; then sudo systemctl reload nginx; sleep 2; echo "TLS installed; nginx reloaded"
else sudo cp /etc/nginx/sites-available/corwin.cloud.interim-backup /etc/nginx/sites-available/corwin.cloud
     echo "nginx -t failed with the TLS block: the interim block is back, nothing else changed" >&2; exit 1; fi
curl -s -o /dev/null -w 'https via SNI: %{http_code}\n' --resolve corwin.cloud:443:127.0.0.1 https://corwin.cloud/
curl -s -o /dev/null -w 'http redirects: %{http_code}\n' -H 'Host: corwin.cloud' http://127.0.0.1/
