#!/bin/sh
# Checks install.sh against fakes (sudo, nginx, systemctl, curl, rsync run in temp folders). Touches no real nginx.
#   sh deploy/test-install.sh [--prove-red]
# Copyright 2026 INPUTLOOP; GPL-3.0-or-later OR LGPL-3.0-or-later.
set -u
here=$(cd "$(dirname "$0")" && pwd)
S=${INSTALL_SH:-$here/install.sh}
if [ "${1:-}" = "--prove-red" ]; then
  t=$(mktemp -d); bad=0
  plant() { cp "$here/install.sh" "$t/install.sh"; sed "$2" "$here/install.sh" > "$t/install.sh"
    cmp -s "$t/install.sh" "$here/install.sh" && { echo "PLANT FAILED  $1"; bad=1; return; }
    if INSTALL_SH=$t/install.sh sh "$0" >"$t/log" 2>&1; then echo "STAYED GREEN  $1"; bad=1; else echo "went red      $1"; fi; }
  plant "always installs the interim block" 's/then conf=nginx-corwin.cloud.conf; else/then conf=corwin.cloud.interim.conf; else/'
  plant "no back-out on nginx -t failure"   's/^  if \[ \$had = 1 \]; then sudo install -m 644 "\$prev" "\$SITE"; else/  if false; then :; else/'
  plant "reloads even when nginx -t fails"  's/^if sudo nginx -t 2>&1; then$/if true; then/'
  plant "demo policy not installed"         's/^if \[ -n "\$demo" \]; then sudo install/if false; then sudo install/'
  plant "goes on without the demo policy"   's/^  echo "no generated\/demo-csp.conf.*$/  :/'
  plant "no log folder before nginx -t"      's/^sudo install -d -m 0755 "\$LOG_DIR";/: ;/'
  plant "no rotation file for the site logs" 's/^sudo install -m 644 "\$here\/logrotate-corwin.cloud"/: /'
  rm -rf "$t"; [ $bad = 0 ] && echo "PROVE-RED OK" || { echo "PROVE-RED FAILED"; exit 1; }; exit 0
fi
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
F=0; N=0
chk() { N=$((N+1)); d=$1; shift; "$@" >/dev/null 2>&1 || { F=$((F+1)); echo "FAIL $d"; }; }
mkdir -p "$T/bin" "$T/build/deploy" "$T/build/public" "$T/build/generated" "$T/le" "$T/nginx/sites-available"
printf '#!/bin/sh\nexec "$@"\n' > "$T/bin/sudo"
printf '#!/bin/sh\necho "nginx $@" >> "$FAKE_LOG"\n[ "$1" = -t ] && [ "${NGINX_FAIL:-0}" = 1 ] && exit 1\nexit 0\n' > "$T/bin/nginx"
printf '#!/bin/sh\necho "systemctl $@" >> "$FAKE_LOG"\n' > "$T/bin/systemctl"
printf '#!/bin/sh\necho 200\n' > "$T/bin/curl"
printf '#!/bin/sh\n# stand-in for rsync -a --delete SRC/ DST/\nfor a; do s=$d; d=$a; done; rm -rf "$d"; mkdir -p "$d"; cp -R "$s." "$d"\n' > "$T/bin/rsync"
chmod +x "$T/bin/"*
cp "$S" "$T/build/deploy/install.sh"
cp "$here/nginx-corwin.cloud.conf" "$here/corwin.cloud.interim.conf" "$here/logrotate-corwin.cloud" "$T/build/deploy/"
echo "# topology policy" > "$T/build/deploy/topology-csp.conf"
echo "# demo policy" > "$T/build/generated/demo-csp.conf"
echo "<p>site</p>" > "$T/build/public/index.html"
mkdir -p "$T/logrotate.d"
export FAKE_LOG=$T/log PATH=$T/bin:$PATH NGINX_DIR=$T/nginx LE_LIVE=$T/le WWW_ROOT=$T/www RELOAD_WAIT=0 \
  LOG_DIR=$T/varlog/corwin.cloud LOGROTATE_D=$T/logrotate.d LOG_OWNER=
run() { : > "$T/log"; sh "$T/build/deploy/install.sh" >"$T/out" 2>&1; }

# 1. with a certificate: the TLS block, demo policy installed, content copied
echo cert > "$T/le/fullchain.pem"; echo "old site" > "$T/nginx/sites-available/corwin.cloud"
run; r=$?
chk "with a certificate: exits 0" test $r = 0
chk "with a certificate: the TLS block is installed" cmp -s "$T/nginx/sites-available/corwin.cloud" "$here/nginx-corwin.cloud.conf"
chk "the demo policy snippet is installed" grep -q "demo policy" "$T/nginx/snippets/corwin-cloud-demo-csp.conf"
chk "the topology policy snippet is installed" grep -q "topology policy" "$T/nginx/snippets/corwin-cloud-topology-csp.conf"
chk "the content is copied" test -f "$T/www/public/index.html"
chk "nginx reloaded" grep -q "systemctl reload nginx" "$T/log"
chk "the site's log folder is made (nginx -t needs it)" test -d "$T/varlog/corwin.cloud"
chk "the site's rotation file is installed" cmp -s "$T/logrotate.d/nginx-corwin.cloud" "$here/logrotate-corwin.cloud"
# 2. without a certificate: the interim block
rm "$T/le/fullchain.pem"; run; r=$?
chk "without a certificate: the interim block" cmp -s "$T/nginx/sites-available/corwin.cloud" "$here/corwin.cloud.interim.conf"
# 3. nginx -t fails: the previous site file is back, no reload
echo cert > "$T/le/fullchain.pem"; echo "old site" > "$T/nginx/sites-available/corwin.cloud"
NGINX_FAIL=1 run; r=$?
chk "nginx -t failure exits 1" test $r = 1
chk "nginx -t failure: the previous site file is back" grep -qx "old site" "$T/nginx/sites-available/corwin.cloud"
chk "nginx -t failure: no reload" test "$(grep -c 'systemctl reload' "$T/log")" = 0
# 4. TLS block needs the demo policy: refuses without it, changing nothing
rm "$T/build/generated/demo-csp.conf" "$T/nginx/snippets/corwin-cloud-demo-csp.conf"; echo "old site" > "$T/nginx/sites-available/corwin.cloud"
run; r=$?
chk "no demo policy beside the build: exits 1" test $r = 1
chk "no demo policy: the site file is untouched" grep -qx "old site" "$T/nginx/sites-available/corwin.cloud"
# 5. the repo conf itself
chk "the TLS block has the ^~ /demo/ location with its policy" sh -c "grep -q 'location \^~ /demo/' '$here/nginx-corwin.cloud.conf' && grep -q 'include snippets/corwin-cloud-demo-csp.conf;' '$here/nginx-corwin.cloud.conf'"
chk "the TLS block keeps /dist/ and the certificate lines" sh -c "grep -q 'location \^~ /dist/' '$here/nginx-corwin.cloud.conf' && grep -q '^    ssl_certificate ' '$here/nginx-corwin.cloud.conf'"
chk "the conf's braces balance" sh -c "[ \$(grep -o '{' '$here/nginx-corwin.cloud.conf' | wc -l) = \$(grep -o '}' '$here/nginx-corwin.cloud.conf' | wc -l) ]"
echo "$((N-F)) passed, $F failed"; [ $F = 0 ]
