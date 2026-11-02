#!/bin/sh
# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later OR LGPL-3.0-or-later
#
# sh tests/run.sh               build, then every check this machine can run
# sh tests/run.sh --prove-red   plant one fault per promise in a copy; each must turn a check red
#   (PLANT_ONLY=words: only the plants whose name has those words; PLANT_SHARD=i/n: every n-th from the i-th)
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
      step "the home page in classic: the drawing loads, the navigator, the minibuffer, the credit row (playwright)"
      SITE_OUT=$out "$node" tests/home-browser.cjs || fail=1
      step "the home page in free, and the switch: the Emacs frame, the tool-bar, the mode-line, the watermark (playwright)"
      SITE_OUT=$out "$node" tests/free-browser.cjs || fail=1
      step "revision 5, yes and: the one-line legend, the frame's place and width, the three lines, the navigator in free, the tool-bar, the switch (playwright)"
      SITE_OUT=$out "$node" tests/free5-browser.cjs || fail=1
      step "revision 6: frame 2's place, height and corner, the lettered legend, menus that never wrap, 1.9 part A (playwright)"
      SITE_OUT=$out "$node" tests/free6-browser.cjs || fail=1
      step "revision 7: independent lines (grow-together kept as an option), the map mode slider, cards from data, the echo caption (playwright)"
      SITE_OUT=$out "$node" tests/free7-browser.cjs || fail=1
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
  bad=0 pi=0
  # PLANT_SHARD=i/n runs every n-th plant from the i-th (0-based), so n copies can run side by side
  shard() { pi=$((pi + 1)); [ -z "${PLANT_SHARD:-}" ] && return 0; [ $((pi % ${PLANT_SHARD#*/})) = "${PLANT_SHARD%/*}" ]; }
  plant() {
    name=$1 file=$2 expr=$3
    case $name in *"${PLANT_ONLY:-}"*) ;; *) return ;; esac   # PLANT_ONLY=words runs only the plants whose name has them
    shard || return
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
    name=$1 file=$2 expr=$3 suite=${4:-tests/nav-browser.cjs}
    case $name in *"${PLANT_ONLY:-}"*) ;; *) return ;; esac
    shard || return
    rm -rf "$tmp/w"; mkdir "$tmp/w"
    (cd "$here" && tar cf - --exclude=./public --exclude=./node_modules --exclude=./.git --exclude=__pycache__ .) | (cd "$tmp/w" && tar xf -)
    sed "$expr" "$tmp/w/$file" > "$tmp/x" && cp "$tmp/x" "$tmp/w/$file"
    if cmp -s "$here/$file" "$tmp/w/$file"; then printf 'PLANT FAILED  %s (no change to %s)\n' "$name" "$file"; bad=1; return; fi
    rm -rf "$tmp/pub"
    if (cd "$tmp/w" && "$py" build.py --out "$tmp/pub" >/dev/null 2>&1 && SITE_OUT="$tmp/pub" "$node" "$suite") >"$tmp/log" 2>&1; then
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
  plant "stage.js writes to storage"        src/js/stage.js "s#^  var kind = classify(), kept#  localStorage.setItem('x', '1'); var kind = classify(), kept#"
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
  plant "the nav has no plain list"          build.py     's#NV.render(navx) if navx else ""#""#'
  plant "nav.js missing from jslicense"      build.py     's#"float.js", "nav.js", #"float.js", #'
  plant "free.js missing from jslicense"     build.py     's#, "nav.js", "free.js")#, "nav.js")#'
  plant "float.js missing from jslicense"    build.py     's#"badges.js", "float.js"#"badges.js"#'
  plant "float.js reads storage outside try" src/js/float.js 's#^  function saveAll() {#  function peek() { return window.localStorage.getItem(KEY); }\n  function saveAll() {#'
  plant "float.js asks another host"         src/js/float.js 's#^  var all = {}, list = \[\];#  var all = {}, list = []; fetch("https://x.example/");#'
  # the legend (revision 2): Bryant named with his link, TopoForge's licence as its README.org says
  plant "the legend loses Bryant's link"     build.py     's#^BRYANT_URL = "https://github.com/takushieternal"#BRYANT_URL = "\#bryant"#'
  plant "the legend's licence altered"       build.py     's#">GNU General Public License, version 3</a> #">GNU General Public License, version 2</a> #'
  plant "the legend's line drops his link"   build.py     's#comp("lg-c-by", "by", gh),#comp("lg-c-by", "by", "Bryant Frankford"),#'
  # revision 5 (docs/NAV.md): the legend is one line, in words
  plant "the legend's line in SPDX again"    build.py     's#<abbr title="%s">GPLv3+ or LGPLv3+</abbr>. % lic_words#GPL-3.0-or-later OR LGPL-3.0-or-later%.0s" % lic_words#'
  plant "a sentence in the legend's line"    build.py     's#comp("lg-c-date", "date", day),#comp("lg-c-date", "date", "Built today. " + day),#'
  # revision 6 (docs/NAV.md): the legend's fonts, served here, with their licences and credit
  plant "a legend font without its licence"   REUSE.toml   's#SPDX-License-Identifier = "OFL-1.1"#SPDX-License-Identifier = "OFL-1.0"#'
  plant "a legend font from another host"     src/css/site.css 's#src: url("../fonts/osifont.woff") format("woff");#src: url("https://fonts.example.com/osifont.woff") format("woff");#'
  plant "Credits forgets the fonts"           build.py     's#.Lettered in osifont, an ISO 3098 face#"Lettered in a face#'
  plant "a legend font changed, not as staged" src/fonts/README 's#^  sha256 6ee5#  sha256 7ee5#'
  # topology forge 1.8: the switches asked for, the name and its spelling, the app asked and never reached into
  plant "scripts cached for a day again"    deploy/nginx-corwin.cloud.conf 's#^        add_header Cache-Control "no-cache" always;\(.*\)$#        add_header Cache-Control "public, max-age=86400";#'
  plant "topology not revalidated"          deploy/corwin.cloud.interim.conf '/corwin-cloud-topology-csp.conf;/{n;d;}'
  plant "the frame asks for no selection"   build.py     's#^TF_EMBED_FREE = "bare,select,ready"#TF_EMBED_FREE = "bare,ready"#'
  plant "classic asks the app to hide its chrome" build.py 's#^TF_EMBED_CLASSIC = "select,ready"#TF_EMBED_CLASSIC = "bare,select,ready"#'
  # revision 4 (docs/NAV.md): free and classic
  plant "long explanatory text back"        build.py     's#<p class="hint">One tab per project. #<p class="hint">The projects in words: one tab each, with the design in full. Every project in the directory also has a page in the drawing above, and this sentence runs on and on. #'
  plant "ui.js missing from jslicense"      build.py     's#^JS_FILES = ("ui.js", #JS_FILES = (#'
  plant "ui.js deferred (the wrong layout flashes)" build.py 's#<script src="js/ui.js"></script>#<script src="js/ui.js" defer></script>#'
  plant "ui.js keeps storage outside try"   src/js/ui.js 's#^  var asked = null;#  var asked = null; window.localStorage.getItem(KEY);#'
  plant "a template placeholder left in"    share.py     's#res\["markup"\] = re.sub(r"\\{\\{\[A-Z_\]+\\}\\}", "", m.group(1))#res["markup"] = m.group(1)#'
  plant "free.js asks another host"         src/js/free.js "s#window.fetch('nav/index.json'#window.fetch('https://x.example/nav/index.json'#"
  plant "free.js keeps something itself"    src/js/free.js 's#^  var frames = \[\], cur = null#  try { localStorage.setItem("x", "1"); } catch (e) {} var frames = [], cur = null#'
  plant "free.js reaches into the app"      src/js/free.js 's#var w = app.contentWindow; return#var w = app.contentWindow; void app.contentDocument; return#'
  plant "free.js calls an undocumented app call" src/js/free.js 's#t.place(id, .center.);#t.addShapeCenter(id);#'
  plant "an Emacs frame animates"           src/css/site.css 's#^\.ef-msg { margin: 0;#.ef-msg { transition: color 1s; margin: 0;#'
  plant "a single key starts a frame command" src/js/free.js "s#if (ev.ctrlKey \&\& !ev.altKey \&\& !ev.metaKey \&\& (k === 'x' || k === 'X')) { ev.preventDefault(); prefix = 'C-x'#if ((k === 'x' || k === 'X')) { ev.preventDefault(); prefix = 'C-x'#"
  plant "Full size asks for switches"       build.py     's#% (e(first, quote=True), e(index\["file"\], quote=True))),#% (e(first + "\&embed=all", quote=True), e(index["file"], quote=True))),#'
  plant "the legend says only TopoForge"    build.py     's#^TF_NAME = "topology forge (formerly TopoForge)"#TF_NAME = "TopoForge"#'
  plant "the name misspelled"               build.py     's#^TF_NAME = "topology forge (formerly TopoForge)"#TF_NAME = "topograph""y forge (formerly TopoForge)"#'
  plant "nav.js reaches into the app again" src/js/nav.js "s#if (w.TopoForge.showPage(it.page))#if (frame.contentDocument.querySelector('\#pagetabs .ptab'))#"
  plant "a message heard from any frame"    src/js/stage.js 's#ev.origin !== window.location.origin || ev.source !== f.contentWindow || ##'
  plant "TopoForge's source not linked"      build.py     's#^TF_SRC_PROJECT = C.ORG + "/topology/tree/corwin/topoforge"#TF_SRC_PROJECT = C.ORG + "/topology/tree/corwin"#'
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
    plant_b "the context light says nothing"  src/js/nav.js "s#say(t.base.length ? 'Kept filter: ' + describe(t.base) + '.'#say(t.base.length ? ''#"
    plant_b "the width not kept"              src/js/float.js 's#if (ed) { ed = null; saveAll();#if (ed) { ed = null;#'
    plant_b "the browser ignores the facets"  src/js/nav.js 's#      if (p.length \&\& !p.some(#      if (false \&\& !p.some(#'
    plant_b "an emptied section still shown"   src/js/nav.js "s#if (!ix.items.some(function (it) { return it.section === sid \&\& model.pass\[it.id\]; })) return;##"
    plant_b "a fifth window allowed"          src/js/nav.js "s#MAXWIN = 4;#MAXWIN = 5;#"
    plant_b "an item does not open its page"  src/js/nav.js 's#if (w.TopoForge.showPage(it.page)) say#if (false) say#'
    plant_b "the echo gives no reasons"       src/js/nav.js 's#say(reasons(ITEMS\[#say((ITEMS[#'
    plant_b "refused storage stops the nav"   src/js/nav.js "s#function load() { try { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }#function load() { return JSON.parse(window.localStorage.getItem(KEY) || 'null'); }#"
    plant_b "the nav scrolls sideways at 390" src/css/site.css 's#^  .nf-handle { display: none; }#  .nf-handle { display: none; } .navframe { min-width: 480px; }#'
    # revision 2 (docs/NAV.md): the drawing loads, the palettes, every menu item, the minibuffer, the legend
    H=tests/home-browser.cjs
    plant_b "an empty kept copy beats the shop"   src/js/stage.js "s#^    if (!shapes) return 'empty';#    if (false) return 'empty';#" $H
    plant_b "TopoForge's sample beats the shop"   src/js/stage.js 's#^    if (d.name === SAMPLE.name#    if (false \&\& d.name === SAMPLE.name#' $H
    plant_b "no notice over the visitor's own"    src/js/stage.js 's#^    notice.hidden = !text;#    notice.hidden = true;#' $H
    plant_b "Full size plants the sample again"   build.py 's#% (e(first, quote=True), e(index\["file"\], quote=True))),#% ("topology/topoforge/index.html", e(index["file"], quote=True))),#' $H
    plant_b "the navigator docked by default"     src/js/float.js "s#: 'float',#: 'left',#" $H
    plant_b "the palette's place not kept"        src/js/float.js 's#^    try { window.localStorage.setItem(KEY, JSON.stringify(o)); }.*#    void o;#' $H
    plant_b "no keyboard move on the grip"        src/js/float.js 's#ArrowRight: \[n, 0\]#ArrowRiight: [n, 0]#' $H
    plant_b "no single-pointer Move"              src/js/nav.js "s#, \['mv-d', 'Move down', ''\]##" $H
    plant_b "the Site menu drops a link"          src/js/nav.js "s#querySelectorAll('header.top nav a')#querySelectorAll('header.top nav a:not([href=\"packages.html\"])')#" $H
    plant_b "a menu item that does nothing"       src/js/nav.js "s#'nextbuf': nextTab,#'nextbuf': function () {},#" $H
    plant_b "the minibuffer input boxed again"    src/css/site.css 's#background: transparent; border: 0; border-radius: 0; padding: 0; margin: 0; min-height: 24px; caret#background: transparent; border: 1px solid; border-radius: 0; padding: 0; margin: 0; min-height: 24px; caret#' $H
    plant_b "the echo area in another face"       src/css/site.css 's#height: 60px; overflow: auto; font: inherit;#max-height: 6.5em; overflow: auto; font: 14px/22px var(--sans);#' $H
    plant_b "the selection not in the mode-line" src/js/nav.js "s#drawSel = m.detail.count ? m.detail : null;#drawSel = null;#" $H
    F=tests/free-browser.cjs
    plant_b "the top bar shown in free"           src/css/site.css 's#^html\[data-ui="free"\] body\[data-page="home"\] header.top,$##' $F
    plant_b "the top bar hidden in classic"       src/css/site.css 's#^html\[data-ui="free"\] body\[data-page="home"\] .custom .custom-btn { display: none; }#& body[data-page="home"] header.top { display: none; }#' $H
    plant_b "long prose shown in classic"         src/css/site.css 's#^html\[data-ui="classic"\] .legend:not(.lg-open) .lg-you dt, html\[data-ui="classic"\] .legend:not(.lg-open) .lg-keep { display: none; }#html[data-ui="classic"] .legend .lg-you dt { display: none; } .lg-you dd::after { content: " This drawing app is the finest thing anyone has ever made, and we are proud to say so at length, every time, here."; }#' $H
    plant_b "the switch not kept"                 src/js/ui.js 's#^  if (asked === ui) keep(ui);##' $F
    plant_b "a link to a tab stays free"          src/js/ui.js "s#: deep ? 'classic' :#: false ? 'classic' :#" $F
    plant_b "a tile that does not narrow"         src/js/free.js 's#return !s.tiles.length || s.tiles.indexOf(c.id) >= 0;#return true;#' $F
    plant_b "Enter on a shape places nothing"     src/js/free.js "s#placeShape(row.getAttribute('data-shape'), true); return;#return;#" $F
    plant_b "a mode-line element with no command" src/js/free.js "s#text: function () { return PAGE ? 'p:' + PAGE : ''; }, act: 'pages',#text: function () { return PAGE ? 'p:' + PAGE : ''; }, act: null,#" $F
    plant_b "the selection not in %select"        src/js/free.js "s#^      SEL = m.detail.count ? m.detail : null; PAGE#      SEL = null; PAGE#" $F
    plant_b "the input stays when focus leaves"   src/js/free.js "s#f.form.addEventListener('focusout'#f.form.addEventListener('focusoutx'#" $F
    plant_b "ESC x is not M-x"                    src/js/free.js "s#'ESC': { 'x': 'execute-extended-command' }#'ESC': {}#" $F
    plant_b "C-x 5 2 undefined"                   src/js/free.js "s#, '5': 'C-x 5',#,#" $F
    plant_b "a split without its mode-line (free)" src/js/free.js "s#}, \[body, ml\]);#}, [body]);#" $F
    plant_b "an app command left out of the menus" src/js/free.js "s#refreshCmds().filter(function (c) { return c.menu.toLowerCase() === menu.toLowerCase(); })#refreshCmds().filter(function (c) { return c.menu.toLowerCase() === menu.toLowerCase() \&\& c.label !== 'Grid'; })#" $F
    plant_b "GPL dropped from the mode-line"      src/js/free.js "s#\['GPL', 'credits', #['', 'credits', #" $F
    plant_b "the watermark's off not kept"        src/js/float.js 's#setOff(!!freeState().legendOff, true);#setOff(false, true);#' $F
    plant_b "the frame's text ignores Customize"  src/css/site.css 's#font: calc(0.8125rem \* var(--read-scale, 1))/1.5 var(--mono); }#font: 0.8125rem/1.5 var(--mono); }#' $F
    plant_b "*Here* without the access settings"  src/js/free.js "s#mk('span', { cls: 'ef-gl', text: 'Colours: ' })#mk('span', { cls: 'ef-gl', text: 'Paint: ' })#" $F
    plant_b "the free page scrolls sideways at 390" src/css/site.css 's#^  .ef { flex: none; border-width: 1px 0 0; }#  .ef { flex: none; border-width: 1px 0 0; min-width: 480px; }#' $F
    plant_b "the frame's text below AA"           src/css/site.css 's#^\.ef-count { font-weight: 400; color: var(--text-dim);#.ef-count { font-weight: 400; color: var(--canvas-active);#' $F
    # revision 5 (docs/NAV.md): yes, and
    R=tests/free5-browser.cjs
    plant_b "the legend more than one line"       src/css/site.css 's#^\.lg-line { display: flex; flex-wrap: wrap;#.lg-line { display: grid; flex-wrap: wrap;#' $R
    plant_b "the frame's width not kept"          src/js/float.js 's#w: saved \&\& isFinite(saved.w) ? saved.w : (o.width || 320),#w: (o.width || 320),#' $R
    plant_b "the frame's edge keys dead"          src/js/float.js 's#if (nw === null) return;#if (true) return;#' $R
    plant_b "the menu bar does not drag the frame" src/js/free.js 's#grip: f.grip, drag: \[f.menubar\], edge#grip: f.grip, edge#' $R
    plant_b "the mode-line left out of the lines" src/css/site.css 's#^\.ef \.ef-ml { align-content: flex-start; min-height: calc(var(--ef-lines, 1) \* 24px + 1px); }#.ef .ef-ml { align-content: flex-start; }#' $R
    plant_b "the message area left out of the count" src/js/free.js "s#var parts = \[f.menubar, f.form.hidden ? f.msg : f.form\]#var parts = [f.menubar]#" $R
    plant_b "the navigator put away in free"      src/js/nav.js "s#^  var FREE = doc.documentElement.getAttribute('data-ui') !== 'classic';#  var FREE = doc.documentElement.getAttribute('data-ui') !== 'classic'; if (FREE) return;#" $R
    plant_b "no second frame for the navigator"   src/js/free.js "s#if (!narrowQ.matches \&\& fstate().navFrame !== false) {#if (false) {#" $R
    plant_b "tool labels back"                    src/js/free.js 's#tabindex: first ? .0. : .-1. }, \[glyph(t.icon)\]);#tabindex: first ? "0" : "-1" }, [glyph(t.icon), t.label]);#' $R
    plant_b "no tooltip on keyboard focus"        src/js/free.js "s#if (el.classList.contains('ef-tool')) showTip(el, ev.type === 'focusin');#if (el.classList.contains('ef-tool') \&\& ev.type !== 'focusin') showTip(el);#" $R
    plant_b "a tool-bar group's rows uneven"      src/js/free.js 's#cols = n <= max ? n : Math.ceil(n / Math.ceil(n / max));#cols = n <= max ? n : max;#' $R
    plant_b "no preview box"                      src/js/free.js 's#^    hud.hidden = false;#    hud.hidden = true;#' $R
    plant_b "the 1.9 hooks on with 1.8"           src/js/free.js "s#return t \&\& vge(t.version, '1.9')#return t \&\& vge(t.version, '1.8')#" $R
    plant_b "the switch moves in classic"         src/css/site.css 's#^html\[data-ui="classic"\] \.ui-switch { background: var(--canvas);#html[data-ui="classic"] .ui-switch { top: 3rem; background: var(--canvas);#' $R
    plant_b "the switch in every classic visit"   src/js/ui.js "s#if (ui !== 'free' \&\& !blinking()) return;#if (false) return;#" $R
    # revision 6 (docs/NAV.md): frames that fit, the lettered legend, menus that never wrap, 1.9 part A
    S=tests/free6-browser.cjs
    plant_b "frame 2 not at the top right"        src/js/free.js 's#return { x: Math.max(8, W - w2 - 8), y: y2,#return { x: 460, y: y2,#' $S
    plant_b "a frame let under the switch"        src/js/float.js 's#if (r \&\& s.x < r.x + r.w#if (false \&\& r \&\& s.x < r.x + r.w#' $S
    plant_b "the frame's height not kept"         src/js/float.js 's#h: saved \&\& isFinite(saved.h) ? saved.h : null,#h: null,#' $S
    plant_b "no bottom edge"                      src/js/float.js "s#^    bindResize(o.hedge, .h.);#    void 0;#" $S
    plant_b "the corner changes only the width"   src/js/float.js "s#if (mode !== 'w') f.state.h = #if (mode === 'h') f.state.h = #" $S
    plant_b "the corner marks only the width"     src/js/float.js "s#^    bindResize(o.corner, .wh.);#    bindResize(o.corner, 'w');#" $S
    plant_b "one font for both faces"             src/css/site.css 's#^\.lg-k { font: 300 9px/18px var(--letter-field);#.lg-k { font: 300 9px/18px var(--letter-value);#' $S
    plant_b "the legend high off the foot"        src/js/float.js 's#H - (el.offsetHeight || 22) - 4) };#H - (el.offsetHeight || 22) - 40) };#' $S
    plant_b "menus wrap: no overflow"             src/js/free.js 's#for (var i = 0; i < DROP.length \&\& !oneLine(); i++) {#for (var i = 0; i < 0; i++) {#' $S
    plant_b "the lighter opens nothing"           src/js/free.js 's#f.menuOpen(null, ev.detail === 0, md, c);#void md;#' $S
    plant_b "frame 2 not mirrored"                src/js/free.js 's#east = !fl.narrow() \&\& s.x !== null#east = false \&\& s.x !== null#' $S
    plant_b "frame 2 too narrow at 1920"          src/js/free.js 's#width: grid.clientWidth >= 1800 ? 500 : 440, east: true#width: 440, east: true#' $S
    plant_b "the frames ignore the default font"  src/css/site.css 's#font: calc(0.8125rem \* var(--read-scale, 1))/1.5 var(--mono); }#font: calc(13px * var(--read-scale, 1))/1.5 var(--mono); }#' $S
    plant_b "*Here* zooms with 1.9"               src/js/free.js 's#^    if (t9 \&\& SEL) {#    if (false \&\& t9 \&\& SEL) {#' $S
    plant_b "*Properties* never calls setProps"   src/js/free.js 's#var ok = tt.setProps(SEL.id,#var ok = false \&\& tt.setProps(SEL.id,#' $S
    plant_b "no first fit between the frames"     src/js/free.js 's#if (!t || fitted || !READY#if (true || !t || fitted || !READY#' $S
    plant_b "no CUA cut"                          src/js/free.js "s#if (seq.length === 1 \&\& (str === 'C-x' || str === 'C-c') \&\& SEL) {#if (false) {#" $S
    # stage 2 (docs/NAV.md, revision 6): the map as the preview, frames re-checked when it moves
    plant_b "map and preview not turned on"       src/js/free.js 's#view: true, map: true, preview: true })#view: true, map: false, preview: false })#' $S
    plant_b "a navigator item previews its id only" src/js/free.js 's#^    if (!sl || !t || !t.doc) return out;#    return out;#' $S
    plant_b "a finder shape previews its category" src/js/free.js 's#^        target: { kind: sh.id } };#        target: { category: sh.category } };#' $S
    plant_b "no re-check when the map moves"      src/js/free.js "s#if (ev.key === 'topoforge.ui.v1') mapCheck();#if (false) mapCheck();#" $S
    # revision 7 (docs/NAV.md): independent lines, the map mode, cards from data
    V=tests/free7-browser.cjs
    plant_b "the lines not independent by default" src/js/free.js 's#var together = !!fstate().linesTogether;#var together = true;#' $V
    plant_b "growing together not kept"           src/js/free.js "s#fkeep('linesTogether', v);#void 0;#" $V
    plant_b "the map mode not in the middle"      src/js/free.js "s#return MAPMODES.indexOf(m) >= 0 ? m : 'both';#return MAPMODES.indexOf(m) >= 0 ? m : 'rings';#" $V
    plant_b "the map mode not kept"               src/js/free.js "s#MAPMODE = m; fkeep('mapMode', m);#MAPMODE = m;#" $V
    plant_b "the slider's keys dead"              src/js/free.js 's#^      if (n === null) return;#      return;#' $V
    plant_b "no caption in the echo area"         src/js/free.js 's#if (d \&\& res \&\& res.caption) {#if (false) {#' $V
    plant_b "a card's count not from the data"    src/js/free.js "s#\['Shapes', String(c.shapes.length)\]#['Shapes', String(c.shapes.length + 1)]#" $V
    plant_b "an item's statement not its own"     src/js/free.js 's#statement: it.tip || (#statement: (#' $V
    plant_b "the selection has no card"           src/js/free.js "s#if (MAPMODE !== 'rings' \&\& SEL \&\& !narrowQ.matches) showCard(selCard());#if (false) showCard(selCard());#" $V
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
