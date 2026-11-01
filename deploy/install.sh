#!/bin/sh
# install.sh -- put corwin.cloud on this host's nginx (interim, port 80). Backs out on any nginx -t failure.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
sudo mkdir -p /var/www/corwin.cloud
sudo rsync -a --delete "$here/../public/" /var/www/corwin.cloud/public/
sudo install -m 644 "$here/topology-csp.conf" /etc/nginx/snippets/corwin-cloud-topology-csp.conf
sudo install -m 644 "$here/corwin.cloud.interim.conf" /etc/nginx/sites-available/corwin.cloud
sudo ln -sf /etc/nginx/sites-available/corwin.cloud /etc/nginx/sites-enabled/corwin.cloud
if sudo nginx -t 2>&1; then sudo systemctl reload nginx; sleep 2; echo "installed; nginx reloaded"  # reload is asynchronous: checks before it lands read the old config
else sudo rm -f /etc/nginx/sites-enabled/corwin.cloud; echo "nginx -t failed: backed out, nothing changed" >&2; exit 1; fi
curl -s -o /dev/null -w 'corwin.cloud via Host header: %{http_code}\n' -H 'Host: corwin.cloud' http://127.0.0.1/
curl -s -H 'Host: corwin.cloud' http://127.0.0.1/ | grep -c 'corwin.cloud' | sed 's/^/pages naming corwin.cloud: /'
curl -s -o /dev/null -w 'topology via Host header: %{http_code}\n' -H 'Host: corwin.cloud' http://127.0.0.1/topology/
