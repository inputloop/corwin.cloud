#!/bin/sh
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
#
# sh tests/run.sh               build, then every check this machine can run
# sh tests/run.sh --prove-red   plant one fault per promise in a copy; each must turn a check red
# TOPOLOGY_DIR=../topology picks the topology checkout (the default); without one the home page
# gets a placeholder and the checks still run.
set -u
here=$(cd "$(dirname "$0")/.." && pwd)
cd "$here" || exit 2
py=${PYTHON:-python3}
node=${NODE:-node}
if [ -z "${TOPOLOGY_DIR:-}" ]; then TOPOLOGY_DIR=$(cd "$here/../topology" 2>/dev/null && pwd || echo "$here/../topology"); fi
export TOPOLOGY_DIR
fail=0
step() { printf '\n== %s\n' "$1"; }

run_checks() {
  out=$1
  step "build"
  "$py" build.py --out "$out" || return 1
  step "the site (python)"
  SITE_OUT=$out "$py" tests/check_site.py || fail=1
  if command -v "$node" >/dev/null 2>&1; then
    step "the script and the policy (node)"
    SITE_OUT=$out "$node" --test tests/check.mjs || fail=1
    if [ "${SKIP_BROWSER:-}" != 1 ] && "$node" -e "require('playwright')" >/dev/null 2>&1; then
      step "the browser (playwright)"
      SITE_OUT=$out "$node" tests/browser.cjs || fail=1
    else
      step "browser checks skipped (SKIP_BROWSER=1, or playwright is not installed)"
    fi
  else
    step "node not found: the node checks did not run"; fail=1
  fi
  return $fail
}

prove_red() {
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT INT TERM
  bad=0
  plant() {
    name=$1 file=$2 expr=$3
    rm -rf "$tmp/w"; mkdir "$tmp/w"
    (cd "$here" && tar cf - --exclude=./public --exclude=./node_modules --exclude=./.git --exclude=__pycache__ .) | (cd "$tmp/w" && tar xf -)
    sed "$expr" "$tmp/w/$file" > "$tmp/x" && cp "$tmp/x" "$tmp/w/$file"
    if cmp -s "$here/$file" "$tmp/w/$file"; then printf 'PLANT FAILED  %s (no change to %s)\n' "$name" "$file"; bad=1; return; fi
    if (cd "$tmp/w" && "$py" build.py --out pub >/dev/null 2>&1 && SITE_OUT=pub "$py" tests/check_site.py && SITE_OUT=pub "$node" --test tests/check.mjs) >"$tmp/log" 2>&1; then
      printf 'STAYED GREEN  %s\n' "$name"; bad=1
    else printf 'went red      %s\n' "$name"; fi
  }
  plant "a private repository linked"       catalog.py   's#ORG + "/vibrobeast-skills",$#ORG + "/obsmage",#'
  plant "an inline script"                  build.py     's#<script src="js/site.js" defer></script>#<script>1</script>#'
  plant "an inline style attribute"         build.py     's#<a class="skip"#<a style="x" class="skip"#'
  plant "a script from another host"        build.py     's#<script src="js/site.js" defer></script>#<script src="https://cdn.example.com/a.js"></script>#'
  plant "a tab no directory card reaches"   catalog.py   's#tab="quantum3d5",#tab=None,#'
  plant "the tablist role missing"          build.py     's# role="tablist"##'
  plant "a script loses its LibreJS label"  src/js/site.js '1s#^.*$#// no label#'
  plant "a script missing from jslicense"   build.py     's#^JS_FILES = .*#JS_FILES = ()#'
  plant "a machine path in the words"       catalog.py   's#Works for its makers#Works at /ho'me'/x for its makers#'
  plant "a broken internal link"            build.py     's#"packages.html")\]#"package.html")]#'
  plant "a private name with a link"        catalog.py   's#credit="Corwin and Bryant; the drawing app#credit="see github.com/inputloop/obsmage; the drawing app#'
  plant "End key missing from the tabs"     src/js/site.js "s#ev.key === 'End'#ev.key === 'Ennd'#"
  plant "the script phones home"            src/js/site.js 's#^  var doc = document, html = doc.documentElement;#  var doc = document, html = doc.documentElement; fetch("/x");#'
  plant "the policy allows inline script"   deploy/nginx-corwin.cloud.conf "s#script-src 'self'; style-src 'self'; img-src 'self' data:; font-src#script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; font-src#"
  plant "the licence line altered"          build.py     's#prose CC-BY-SA-4.0\.#prose CC-BY-4.0.#'
  plant "a version number invented"         catalog.py   's#what="The command and the graph API\.#what="The command and the graph API, 1.2.3.#'
  if [ $bad = 0 ]; then echo "PROVE-RED OK"; return 0; fi
  echo "PROVE-RED FAILED"; return 1
}

case "${1:-}" in
  --prove-red) prove_red ;;
  "") run_checks "${SITE_OUT:-$here/public}" && echo && echo "ALL CHECKS PASSED" ;;
  *) echo "usage: sh tests/run.sh [--prove-red]" >&2; exit 2 ;;
esac
