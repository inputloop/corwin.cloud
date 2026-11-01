#!/bin/sh
# Checks install-dist.sh against fakes (a fake sudo, nginx, systemctl, curl; temp folders). Touches no real nginx.
#   sh deploy/test-install-dist.sh [--prove-red]
set -u
here=$(cd "$(dirname "$0")" && pwd)
S=${INSTALL_DIST:-$here/install-dist.sh}
if [ "${1:-}" = "--prove-red" ]; then
  t=$(mktemp -d); bad=0
  plant() { cp "$here/install-dist.sh" "$here/nginx-corwin.cloud.conf" "$t/"; sed "$2" "$t/install-dist.sh" > "$t/y" && cp "$t/y" "$t/install-dist.sh"
    cmp -s "$t/install-dist.sh" "$here/install-dist.sh" && { echo "PLANT FAILED  $1"; bad=1; return; }
    if INSTALL_DIST=$t/install-dist.sh sh "$0" >"$t/log" 2>&1; then echo "STAYED GREEN  $1"; bad=1; else echo "went red      $1"; fi; }
  plant "no back-out on nginx -t failure" 's/^    sudo cp -p "\$bk" "\$CONF"$/    :/'
  plant "reloads even when nginx -t fails" 's/^  if sudo nginx -t 2>&1; then$/  if true; then/'
  plant "no backup before replacing"       's/^  sudo cp -p "\$CONF" "\$bk"$/  :/'
  plant "installs a file without the location" 's/^grep -q .*$/:/; s#^new=.*#new=/dev/null#'
  rm -rf "$t"; [ $bad = 0 ] && echo "PROVE-RED OK" || { echo "PROVE-RED FAILED"; exit 1; }; exit 0
fi
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
F=0; N=0
chk() { N=$((N+1)); d=$1; shift; "$@" >/dev/null 2>&1 || { F=$((F+1)); echo "FAIL $d"; }; }
mkdir "$T/bin" "$T/dist"
printf '#!/bin/sh\nexec "$@"\n' > "$T/bin/sudo"
printf '#!/bin/sh\necho "$@" >> "$FAKE_LOG"\n[ "$1" = -t ] && [ "${NGINX_FAIL:-0}" = 1 ] && exit 1\nexit 0\n' > "$T/bin/nginx"
printf '#!/bin/sh\necho "systemctl $@" >> "$FAKE_LOG"\n' > "$T/bin/systemctl"
printf '#!/bin/sh\necho 404\n' > "$T/bin/curl"
chmod +x "$T/bin/"*
export FAKE_LOG=$T/log PATH=$T/bin:$PATH NGINX_CONF=$T/live.conf DIST_ROOT=$T/dist
cp "$here/nginx-corwin.cloud.conf" "$T/new.conf"
mkdir "$T/repo"; cp "$S" "$T/repo/install-dist.sh"; cp "$here/nginx-corwin.cloud.conf" "$T/repo/"
echo "old conf" > "$T/live.conf"
sh "$T/repo/install-dist.sh" >"$T/out" 2>&1; r=$?
chk "success exits 0" test $r = 0
chk "live conf is now the repo's" cmp -s "$T/live.conf" "$T/repo/nginx-corwin.cloud.conf"
chk "the old conf was kept" sh -c "grep -q 'old conf' $T/live.conf.pre-dist.*"
chk "nginx reloaded" grep -q "systemctl reload nginx" "$T/log"
chk "publish folder made" test -d "$T/dist/about-corwin"
: > "$T/log"; sh "$T/repo/install-dist.sh" >"$T/out" 2>&1
chk "second run: says nothing changed" grep -q "nothing changed" "$T/out"
chk "second run: no reload" test ! -s "$T/log"
echo "old conf" > "$T/live.conf"; : > "$T/log"
NGINX_FAIL=1 sh "$T/repo/install-dist.sh" >"$T/out" 2>&1; r=$?
chk "nginx -t failure exits 1" test $r = 1
chk "nginx -t failure: old conf is back" grep -qx "old conf" "$T/live.conf"
chk "nginx -t failure: no reload" test "$(grep -c reload "$T/log")" = 0
chk "the repo conf has the ^~ /dist/ location with its alias" sh -c "grep -q 'location \^~ /dist/' $T/new.conf && grep -q 'alias /var/www/corwin.cloud-dist/;' $T/new.conf"
chk "the conf's braces balance" sh -c "[ \$(grep -o '{' $T/new.conf | wc -l) = \$(grep -o '}' $T/new.conf | wc -l) ]"
echo "$((N-F)) passed, $F failed"; [ $F = 0 ]
