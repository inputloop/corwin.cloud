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
if [ -z "${INPUTLOOP_DIR:-}" ]; then INPUTLOOP_DIR=$(cd "$here/../inputloop" 2>/dev/null && pwd || echo "$here/../inputloop"); fi
export INPUTLOOP_DIR
if [ -z "${ABOUT_DIR:-}" ]; then ABOUT_DIR=$(cd "$here/../about-corwin" 2>/dev/null && pwd || echo "$here/../about-corwin"); fi
export ABOUT_DIR
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
      step "the navigator in the browser (playwright)"
      SITE_OUT=$out "$node" tests/nav-browser.cjs || fail=1
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
    # build outside the copy: a build inside it would trip the "no sources in the repository" checks
    # and turn every plant red for the wrong reason
    rm -rf "$tmp/pub"
    if (cd "$tmp/w" && "$py" build.py --out "$tmp/pub" >/dev/null 2>&1 && SITE_OUT="$tmp/pub" "$py" tests/check_site.py && SITE_OUT="$tmp/pub" "$node" --test tests/check.mjs) >"$tmp/log" 2>&1; then
      printf 'STAYED GREEN  %s\n' "$name"; bad=1
    else printf 'went red      %s\n' "$name"; fi
  }
  # a planted fault only a browser can see: build the copy, then run the navigator's browser checks on it
  plant_b() {
    name=$1 file=$2 expr=$3
    rm -rf "$tmp/w"; mkdir "$tmp/w"
    (cd "$here" && tar cf - --exclude=./public --exclude=./node_modules --exclude=./.git --exclude=__pycache__ .) | (cd "$tmp/w" && tar xf -)
    sed "$expr" "$tmp/w/$file" > "$tmp/x" && cp "$tmp/x" "$tmp/w/$file"
    if cmp -s "$here/$file" "$tmp/w/$file"; then printf 'PLANT FAILED  %s (no change to %s)\n' "$name" "$file"; bad=1; return; fi
    rm -rf "$tmp/pub"
    if (cd "$tmp/w" && "$py" build.py --out "$tmp/pub" >/dev/null 2>&1 && SITE_OUT="$tmp/pub" "$node" tests/nav-browser.cjs) >"$tmp/log" 2>&1; then
      printf 'STAYED GREEN  %s (browser)\n' "$name"; bad=1
    else printf 'went red      %s (browser)\n' "$name"; fi
  }
  plant "a private repository linked"       catalog.py   's#ORG + "/vibrobeast-skills",$#ORG + "/obsmage",#'
  plant "an inline script"                  build.py     's#<script src="js/site.js" defer></script>#<script>1</script>#'
  plant "an inline style attribute"         build.py     's#<a class="skip"#<a style="x" class="skip"#'
  plant "a script from another host"        build.py     's#<script src="js/site.js" defer></script>#<script src="https://cdn.example.com/a.js"></script>#'
  plant "pubs not on the public allow-list"  catalog.py   '/^    ORG + "\/pubs",$/d'
  plant "pubs missing from the directory"   catalog.py   's#^    dict(id="pubs", name="pubs", kind="site", public=True, tab=None, url=ORG + "/pubs",#    dict(id="pubs", name="pubs", kind="site", public=True, tab=None, url=ORG + "/pubz",#'
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
  plant "a directory project with no tab"   drawings.py  's#^    for repo in C.REPOS:$#    for repo in C.REPOS[:-1]:#'
  plant "a private part drawn"              drawings.py  's#^        if private_level is None:$#        if private_level is not None:\n            out.insert(0, ln)\n        else:#'
  plant "a workstation named"               drawings.py  's#return name if re.match(C.PUBLIC_HOSTS_RE, name) else "a workstation"#return name#'
  plant "a drawing page without its credit" drawings.py  's#"Made by: %s." % repo\["credit"\].rstrip(".")#"Made by: someone."#'
  plant "Bryant's drawing altered"          drawings.py  's#            f.write(raw)#            f.write(raw + b" ")#'
  plant "an inline script left in a demo"   demos.py     's#    t = SCRIPT.sub(repl, t)#    t = t#'
  plant "a demo script not in jslicense"    build.py     's#for path, lic, source in res.get("scripts", \[\]):#for path, lic, source in []:#'
  plant "a demo page loses its credit"      build.py     's#e(d\["credit"\]), e(d\["licence"\]), e(d\["run"\])#"", e(d["licence"]), e(d["run"])#'
  plant "stage.js writes to storage"        src/js/stage.js "s#^  var kept = false;#  var kept = false; localStorage.setItem('x', '1');#"
  plant "the home frames a host page"       build.py     's#first = "topology/topoforge/index.html?load=/" + index\["file"\]#first = "topology/app.html"#'
  plant "the demo policy allows inline js"  build.py     "s#DEMO_POLICY = (\"default-src 'self'; script-src 'self';#DEMO_POLICY = (\"default-src 'self'; script-src 'self' 'unsafe-inline';#"
  plant "a card without its drawing link"   build.py     '/t.append(a("index.html?drawing=%s#top" % r\["id"\], "Drawing", "act"))/d'
  plant "a project drawn from the catalog alone" drawings.py  's#        for f in ("TOPOLOGY.md", ".topology.md"):#        for f in (".topology.md",):#'
  plant "a notation baked into the shape"    drawings.py  's#        shape, word = PR.shape_for(el, notation, table)#        shape, word = "rounded", el["role"]#'
  plant "a process with no BPMN page"        processes.py 's#^CHOICES = ("bpmn", "bpmnplus", "flowchart")#CHOICES = ("bpmnplus", "flowchart")#'
  plant "a process not offered on the home"  build.py     's#        items.append(.<li>%s: %s; as a file#        0 and items.append("<li>%s: %s; as a file#'
  plant "a pinned tarball's sha256 altered"  vendor.py    's#sha256="33cd651dcae080f76c110bdb035faf9e0bab35f44cd4bd9cf8cf40ae7ed97256"#sha256="43cd651dcae080f76c110bdb035faf9e0bab35f44cd4bd9cf8cf40ae7ed97256"#'
  plant "a library left on another host"     catalog.py   '/vue@3\/dist\/vue.global.prod.js"><\/script>., ./d'
  plant "a minified library without source"  demos.py     's#p\["licence"\]\[0\], "%s/%s" % (V.folder(p), full)))#p["licence"][0], None))#'
  plant "eval allowed for every demo"        build.py     "s#DEMO_POLICY = (\"default-src 'self'; script-src 'self';#DEMO_POLICY = (\"default-src 'self'; script-src 'self' 'unsafe-eval';#"
  plant "NextTime credited by another name"  catalog.py   "s#credit=\"definitelynotaspren's work.\", licence=#credit=\"Someone's work.\", licence=#"
  plant "the palette copied, not as staged"  share.py     's#        f.write(js)#        f.write(js + "// changed\\n")#'
  plant "the palette missing from the pages" build.py     's#(SHARED\["markup"\] + "\\n") if SHARED\["staged"\] else ""#""#'
  plant "the CI strip left off the home"     build.py     's#topology_area(have, index, navx) + (.<div class="wrap shared-wrap">%s</div>. % ci_strip() if ci_strip() else "")#topology_area(have, index, navx)#'
  plant "badges read another layout"         src/js/badges.js 's#^  var LINE = /^ {2}"#  var LINE = /^ *"#'
  plant "badges ask another host"            src/js/badges.js "s#new URL('/dist/' + name#new URL('https://feeds.example/dist/' + name#"
  plant "the site policy reads other hosts"  deploy/nginx-corwin.cloud.conf "s#font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src#font-src 'self'; connect-src *; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src#"
  plant "a channel with no status line"      build.py     's#    if r.get("channel"):#    if False:#'
  # the navigator (docs/NAV.md): its index, the page and the script
  plant "a workstation named in the nav index" navindex.py "s#if not any(w == h or w.startswith(h + \"'\") for h in HIDDEN)#if True#"
  plant "a process lends the nav no BPMN"    navindex.py  's#^            if names_in(words, name):$#            if False:#'
  plant "a nav category with no reason"      navindex.py  's#self.d\["why"\]\["%s:%s" % (facet, value)\] = why#self.d["why"]["%s:%s" % (facet, value)] = ""#'
  plant "taxonomy.js staged altered"         share.py     's#        f.write(t)$#        f.write(t + "//x\\n")#'
  plant "the nav has no plain list"          build.py     's#(NV.render(navx), frame))#("", frame))#'
  plant "nav.js missing from jslicense"      build.py     's#"badges.js", "nav.js")#"badges.js")#'
  plant "nav.js asks another host"           src/js/nav.js "s#window.fetch('nav/index.json'#window.fetch('https://x.example/nav/index.json'#"
  plant "nav.js reads storage outside try"   src/js/nav.js 's#^  function save() {#  function peek() { return window.localStorage.getItem(KEY); }\n  function save() {#'
  plant "a single-key shortcut in the nav"   src/js/nav.js "s#if (ev.ctrlKey \&\& !ev.altKey \&\& !ev.metaKey \&\& (ev.key === 'x' || ev.key === 'X'))#if ((ev.key === 'x' || ev.key === 'X'))#"
  plant "the navigator animates"             src/css/site.css 's#^\.nf-handle { position: absolute;#.nf-handle { transition: width 1s; position: absolute;#'
  if command -v "$node" >/dev/null 2>&1 && "$node" -e "require('playwright')" >/dev/null 2>&1 && [ "${SKIP_BROWSER:-}" != 1 ]; then
    plant_b "a split without its mode-line"   src/js/nav.js 's#}, \[body, ml\]);#}, [body]);#'
    plant_b "a split with a title bar"        src/js/nav.js "s#}, \[body, ml\]);#}, [mk('div', { cls: 'win-title', text: 'W' }), body, ml]);#"
    plant_b "pinned items filtered away"      src/js/nav.js 's#^      t.pins.forEach(function (p, i) {#      t.pins.filter(function (p) { return p.k !== "i" || model.pass[p.id]; }).forEach(function (p, i) {#'
    plant_b "the pin order not restored"      src/js/nav.js 's#        t.pins = t.pins.filter(function (p)#        t.pins = t.pins.reverse().filter(function (p)#'
    plant_b "no way to move a pin but drag"   src/js/nav.js 's#^        if (i > 0) {$#        if (false) {#'
    plant_b "a tab bar with one buffer"       src/js/nav.js 's#els.tabs.hidden = state.tabs.length < 2;#els.tabs.hidden = false;#'
    plant_b "a lone hidden tab with one buffer" src/js/nav.js 's#^    if (els.tabs.hidden) return;.*$##'
    plant_b "pin-to-buffer makes duplicates"  src/js/nav.js 's#if (o.base.length \&\& canon(o.base) === key \&\& ctxEmpty(o.live)) {#if (false) {#'
    plant_b "the context light never lit"     src/js/nav.js "s#light.classList.toggle('lit', baked);#light.classList.toggle('lit', false);#"
    plant_b "the context light says nothing"  src/js/nav.js "s#say(t.base.length ? 'Context: ' + describe(t.base) + '.'#say(t.base.length ? ''#"
    plant_b "the width not kept"              src/js/nav.js 's#^    applyWidth(); save();$#    applyWidth();#'
    plant_b "the browser ignores the facets"  src/js/nav.js 's#      if (p.length \&\& !p.some(#      if (false \&\& !p.some(#'
    plant_b "a fifth window allowed"          src/js/nav.js "s#MAXWIN = 4,#MAXWIN = 5,#"
    plant_b "an item does not open its page"  src/js/nav.js 's#if (b) { b.click();#if (b) {#'
    plant_b "the echo gives no reasons"       src/js/nav.js 's#say(reasons(ITEMS\[#say((ITEMS[#'
    plant_b "refused storage stops the nav"   src/js/nav.js "s#function load() { try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }#function load() { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); }#"
    plant_b "the nav scrolls sideways at 390" src/css/site.css 's#^  .nf-handle { display: none; }#  .nf-handle { display: none; } .navframe { min-width: 480px; }#'
  else
    echo "browser plants skipped (SKIP_BROWSER=1, or playwright is not installed)"
  fi
  if [ $bad = 0 ]; then echo "PROVE-RED OK"; return 0; fi
  echo "PROVE-RED FAILED"; return 1
}

case "${1:-}" in
  --prove-red) prove_red && sh "$here/deploy/test-install.sh" --prove-red && sh "$here/deploy/test-install-dist.sh" --prove-red ;;
  "") run_checks "${SITE_OUT:-$here/public}" && sh "$here/deploy/test-install.sh" && sh "$here/deploy/test-install-dist.sh" && echo && echo "ALL CHECKS PASSED" ;;
  *) echo "usage: sh tests/run.sh [--prove-red]" >&2; exit 2 ;;
esac
