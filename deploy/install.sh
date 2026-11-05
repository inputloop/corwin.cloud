#!/bin/sh
# install.sh -- put corwin.cloud on this host's nginx. Uses the TLS block when corwin.cloud's certificate
# exists (the interim port-80 block only before it does), so a reinstall never takes https down. Backs out
# on any nginx -t failure, putting the previous site file back.  Run as the gw33 account on gw33.
#   sh deploy/install.sh        (from an unpacked build: public/, deploy/, generated/)
# Paths can be overridden for tests: NGINX_DIR, LE_LIVE, WWW_ROOT, LOG_DIR, LOGROTATE_D, LOG_OWNER.
# The site keeps its own request and error logs (logreq option A+agent, 2026-11-04): their folder must exist
# before nginx -t, and their rotation file sits beside the stock one.
# Copyright 2026 INPUTLOOP; GPL-3.0-or-later OR LGPL-3.0-or-later.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
NGINX_DIR=${NGINX_DIR:-/etc/nginx}
LE_LIVE=${LE_LIVE:-/etc/letsencrypt/live/corwin.cloud}
WWW_ROOT=${WWW_ROOT:-/var/www/corwin.cloud}
LOG_DIR=${LOG_DIR:-/var/log/nginx/corwin.cloud}
LOGROTATE_D=${LOGROTATE_D:-/etc/logrotate.d}
LOG_OWNER=${LOG_OWNER-root:adm}
SITE=$NGINX_DIR/sites-available/corwin.cloud

if sudo test -s "$LE_LIVE/fullchain.pem"; then conf=nginx-corwin.cloud.conf; else conf=corwin.cloud.interim.conf; fi
demo=""
for d in "$here/../generated/demo-csp.conf" "$here/demo-csp.conf"; do [ -f "$d" ] && { demo=$d; break; }; done
if grep -q corwin-cloud-demo-csp "$here/$conf" && [ -z "$demo" ]; then
  echo "no generated/demo-csp.conf beside the build, and $conf needs it: nothing changed" >&2; exit 1
fi

sudo mkdir -p "$WWW_ROOT" "$NGINX_DIR/snippets" "$NGINX_DIR/sites-available" "$NGINX_DIR/sites-enabled"
sudo rsync -a --delete "$here/../public/" "$WWW_ROOT/public/"
sudo install -m 644 "$here/topology-csp.conf" "$NGINX_DIR/snippets/corwin-cloud-topology-csp.conf"
if [ -n "$demo" ]; then sudo install -m 644 "$demo" "$NGINX_DIR/snippets/corwin-cloud-demo-csp.conf"; fi

sudo install -d -m 0755 "$LOG_DIR"; [ -z "$LOG_OWNER" ] || sudo chown "$LOG_OWNER" "$LOG_DIR"
sudo install -m 644 "$here/logrotate-corwin.cloud" "$LOGROTATE_D/nginx-corwin.cloud"

prev=$(mktemp); had=0
if [ -f "$SITE" ]; then sudo cp "$SITE" "$prev"; had=1; fi
sudo install -m 644 "$here/$conf" "$SITE"
sudo ln -sf "$SITE" "$NGINX_DIR/sites-enabled/corwin.cloud"
if sudo nginx -t 2>&1; then
  sudo systemctl reload nginx; sleep "${RELOAD_WAIT:-2}"   # reload is asynchronous: checks before it lands read the old config
  echo "installed with $conf; nginx reloaded"
else
  if [ $had = 1 ]; then sudo install -m 644 "$prev" "$SITE"; else sudo rm -f "$NGINX_DIR/sites-enabled/corwin.cloud"; fi
  rm -f "$prev"
  echo "nginx -t failed with $conf: the previous site file is back" >&2; exit 1
fi
rm -f "$prev"
if [ "$conf" = nginx-corwin.cloud.conf ]; then
  curl -s -o /dev/null -w 'https via SNI: %{http_code}\n' --resolve corwin.cloud:443:127.0.0.1 https://corwin.cloud/ || true
else
  curl -s -o /dev/null -w 'corwin.cloud via Host header: %{http_code}\n' -H 'Host: corwin.cloud' http://127.0.0.1/ || true
fi
