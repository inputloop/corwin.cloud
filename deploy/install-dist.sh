#!/bin/sh
# install-dist.sh -- on gw33: put the /dist/ location (release channels) into corwin.cloud's nginx server
# block, from this repository's deploy/nginx-corwin.cloud.conf. Makes the publish folder. Backs out on any
# nginx -t failure: the old file comes back, nginx is not reloaded. Safe to run again (no change, no reload).
#   sh deploy/install-dist.sh
# Settings for tests: NGINX_CONF (/etc/nginx/sites-available/corwin.cloud), DIST_ROOT (/var/www/corwin.cloud-dist).
# Copyright 2026 INPUTLOOP; GPL-3.0-or-later.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
CONF=${NGINX_CONF:-/etc/nginx/sites-available/corwin.cloud}
DIST=${DIST_ROOT:-/var/www/corwin.cloud-dist}
new=$here/nginx-corwin.cloud.conf
grep -q 'location \^~ /dist/' "$new" || { echo "install-dist: $new has no /dist/ location; nothing changed" >&2; exit 1; }
sudo mkdir -p "$DIST/about-corwin"
sudo chown "$(id -un)" "$DIST/about-corwin"
if sudo cmp -s "$new" "$CONF"; then echo "nginx already has the /dist/ location; nothing changed"
else
  bk=$CONF.pre-dist.$(date +%Y%m%d-%H%M%S)
  sudo cp -p "$CONF" "$bk"
  sudo install -m 644 "$new" "$CONF"
  if sudo nginx -t 2>&1; then
    sudo systemctl reload nginx; sleep 2; echo "installed; nginx reloaded (old file kept as $bk)"
  else
    sudo cp -p "$bk" "$CONF"
    echo "nginx -t failed with the new file: the old file is back, nginx was not reloaded" >&2; exit 1
  fi
fi
curl -s -o /dev/null -w 'https://corwin.cloud/dist/about-corwin/channel.json via SNI: %{http_code} (404 until the first mint)\n' --resolve corwin.cloud:443:127.0.0.1 https://corwin.cloud/dist/about-corwin/channel.json || true
