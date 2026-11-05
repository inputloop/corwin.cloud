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
      step "revision 8: frame 2 below the layout switch at four sizes, the legend on the frames' lines, the slider drawn, Reset layout (playwright)"
      SITE_OUT=$out "$node" tests/free8-browser.cjs || fail=1
      step "revision 9: topology forge 1.12's big card and card pad in free, a pressed item's card kept for the pad, the turned pad clear of the frames, classic unchanged (playwright)"
      SITE_OUT=$out "$node" tests/free9-browser.cjs || fail=1
      step "revision 10: the zoom slider (Fit in the middle), the undo and redo pill, topology forge 1.13's peek in free, classic unchanged (playwright)"
      SITE_OUT=$out "$node" tests/free10-browser.cjs || fail=1
      step "revision 11: topology forge 1.14's peekKey (Shift here, the pointer still), his wording, not while typing or on a frame, the opening zoom not Fit (playwright)"
      SITE_OUT=$out "$node" tests/free11-browser.cjs || fail=1
      step "revision 11: the note on what the site keeps in the browser: only its names kept in use, one press forgets them all and says so, asks only for work kept nowhere else, the menus and the legend reach it (playwright)"
      SITE_OUT=$out "$node" tests/privacy-browser.cjs || fail=1
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
  plant "the request-log sentence edited by hand" privacy-log.txt '2s/for up to 14 days/for up to 15 days/'
  plant "a request-log sentence typed into the build" build.py 's/^    PRIVACY_LOG = _fh.read().split("\\n")\[1\]$/    PRIVACY_LOG = "The web server keeps its usual log of requests."/'
  plant "a private repository linked"       catalog.py   's#dict(id="c4", name="c4", kind="platform", public=False, tab=None,#dict(id="c4", name="c4", kind="platform", public=True, url=ORG + "/c4", tab=None,#'
  plant "obsmage not on the public allow-list" catalog.py '/^    ORG + "\/obsmage",$/d'
  plant "obsmage-corwin not on the allow-list" catalog.py '/^    ORG + "\/obsmage-corwin",$/d'
  plant "the obsmage tab still not public"   catalog.py   's#dict(id="obsmage", name="obsmage", kind="app", public=True,#dict(id="obsmage", name="obsmage", kind="app", public=False,#'
  plant "obsmage.com not on the allow-list"  catalog.py   '/^    "https:\/\/obsmage\.com\/",$/d'
  plant "obsmage.com not the project's home" catalog.py   's#url=ORG + "/obsmage", home="https://obsmage.com/",#url=ORG + "/obsmage",#'
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
  plant "a private name with a link"        catalog.py   's#credit="Corwin and Bryant; the drawing app#credit="see github.com/inputloop/c4; the drawing app#'
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
  plant "free.js missing from jslicense"     build.py     's#, "nav.js", "free.js", #, "nav.js", #'
  plant "privacy.js missing from jslicense"  build.py     's#, "free.js", "privacy.js")#, "free.js")#'
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
  plant "classic asks the app to hide its chrome" build.py 's#^TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "bare,select,ready,reset"#'
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
  # revision 9 (docs/NAV.md): free names every switch it relies on (an older app ignores words it does not
  # know, so none is left to cardpad's implication); classic asks for neither 1.12 word
  plant "free does not name bigcard"         src/js/free.js 's#reset: true, bigcard: true, cardpad: true })#reset: true, cardpad: true })#'
  plant "free does not name cardpad"         src/js/free.js 's#reset: true, bigcard: true, cardpad: true })#reset: true, bigcard: true })#'
  plant "free leaves map to cardpad"         src/js/free.js 's#view: true, map: true,#view: true,#'
  plant "free leaves preview to cardpad"     src/js/free.js 's#preview: true, mapwheel#mapwheel#'
  plant "free leaves mappad to cardpad"      src/js/free.js 's#mappad: true, reset#reset#'
  plant "classic asks for bigcard"           build.py     's#TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "select,ready,reset,bigcard"#'
  plant "classic asks for cardpad"           build.py     's#TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "select,ready,reset,cardpad"#'
  # revision 10 (docs/NAV.md): free names topology forge 1.13's peek; classic does not ask for it
  plant "free does not name peek"            src/js/free.js 's#pagelist: true, peek: true, view#pagelist: true, view#'
  plant "classic asks for peek"              build.py     's#TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "select,ready,reset,peek"#'
  # revision 11 (docs/NAV.md): the note on what the site keeps in the browser; every page links it; the forget button
  plant "the note misses a name the code keeps" build.py   '/^    ("drawing", "topoforge.theme", "key", "local",/d'
  plant "the note lists a name nothing keeps"  build.py     '/^    ("drawing", "topoforge.theme", "key", "local",/a    ("drawing", "topoforge.nothing", "key", "local", "Nothing."),'
  plant "a script keeps a name the note lacks" src/js/free.js "s|^  function keptHref(frag) {|  try { localStorage.setItem('corwin.cloud.extra', '1'); } catch (e) {}\n  function keptHref(frag) {|"
  plant "a write the check cannot read"        src/js/free.js "s|^  function keptHref(frag) {|  try { var w = location.hash; localStorage.setItem(w, '1'); } catch (e) {}\n  function keptHref(frag) {|"
  plant "this tab's name listed as kept for good" build.py  's|"corwin.cloud.blink", "key", "session"|"corwin.cloud.blink", "key", "local"|'
  plant "a page does not link the note"        build.py     's| <a href="privacy.html" rel="privacy-policy"%s>What this site keeps in your browser</a>.| <span%s></span>|'
  plant "the 404 page does not link the note"  build.py     's|<p class="colophon"><a href="/privacy.html" rel="privacy-policy" id="privacy">What this site keeps in your browser</a>.</p>||'
  plant "everywhere's list lacks the note"     build.py     's|^             ("What this site keeps in your browser", "privacy.html")\]|             ]|'
  plant "the legend does not link the note"    build.py     's|<a href="privacy.html#drawing" id="stage-kept">what is kept, and how to forget it</a>|what is kept|'
  plant "a demo that keeps names says nothing" build.py     's|"quantum3d5": ("demos",|"quantum3d5-not": ("demos",|'
  plant "Customize's #privacy lands nowhere"   build.py     "s|\"\" if buf == \"privacy\" else ' id=\\\"privacy\\\"'|\"\"|"
  plant "privacy.js writes a name"             src/js/privacy.js "s|^  function say(t) {|  try { localStorage.setItem('privacy.extra', '1'); } catch (e) {}\n  function say(t) {|"
  plant "privacy.js carries its own names"     src/js/privacy.js "s|var AUTOSAVE = 'topoforge.autosave.v1',|var AUTOSAVE = 'topoforge.autosave.v1', MINE = ['corwin.cloud.ui.v1'],|"
  plant "the note does not load privacy.js"    build.py     "s|'<script src=\"js/privacy.js\" defer></script>\\\\n'|''|"
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
    plant_b "no second frame for the navigator"   src/js/free.js "s#if (!narrowQ.matches \&\& fstate().navFrame !== false) navFrame();#if (false) navFrame();#" $R
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
    plant_b "the legend high off the foot"        src/js/float.js 's#H - (el.offsetHeight || 22) - GUTTER) };#H - (el.offsetHeight || 22) - 40) };#' $S
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
    # (revision 9: with 1.12, mappad turns map on and cardpad turns bigcard, mappad, preview and map on, so the
    # fault takes the words that imply them too; the words named one by one are held by check_site.py, below)
    plant_b "map and preview not turned on"       src/js/free.js 's#view: true, map: true, preview: true, mapwheel: true, mappad: true, reset: true, bigcard: true, cardpad: true#view: true, map: false, preview: false, mapwheel: true, mappad: false, reset: true, bigcard: false, cardpad: false#' $S
    plant_b "a navigator item previews its id only" src/js/free.js 's#^    if (!sl || !t || !t.doc) return out;#    return out;#' $S
    plant_b "a finder shape previews its category" src/js/free.js 's#^        target: { kind: sh.id } };#        target: { category: sh.category } };#' $S
    plant_b "no re-check when the map moves"      src/js/free.js "s#if (ev.key === 'topoforge.ui.v1') mapCheck();#if (false) mapCheck();#" $S
    # revision 7 (docs/NAV.md): independent lines, the map mode, cards from data
    V=tests/free7-browser.cjs
    plant_b "the lines not independent by default" src/js/free.js 's#var together = !!fstate().linesTogether;#var together = true;#' $V
    plant_b "growing together not kept"           src/js/free.js "s#fkeep('linesTogether', v);#void 0;#" $V
    plant   "the map mode not in the middle"      src/js/free.js "s#return MAPMODES.indexOf(m) >= 0 ? m : 'both';#return MAPMODES.indexOf(m) >= 0 ? m : 'rings';#"
    plant_b "the map mode not kept"               src/js/free.js "s#MAPMODE = m; fkeep('mapMode', m);#MAPMODE = m;#" $V
    plant_b "the slider's keys dead"              src/js/free.js 's#^      if (n === null) return;#      return;#' $V
    plant_b "no caption in the echo area"         src/js/free.js "s#else if (m.type === 'topoforge:preview' \&\& ten()) { echoPreview(m.detail); return; }#else if (false) { return; }#" $V
    plant_b "a card's count not from the data"    src/js/free.js "s#\['Shapes', String(c.shapes.length)\]#['Shapes', String(c.shapes.length + 1)]#" $V
    plant_b "an item's statement not its own"     src/js/free.js 's#statement: it.tip || (#statement: (#' $V
    plant_b "the selection has no card"           src/js/free.js "s#if (MAPMODE !== 'rings' \&\& SEL \&\& !narrowQ.matches) showSel();#if (false) showSel();#" $V
    # revision 7, stage 2: topology forge 1.10 (the map's modes, its card, its wheel)
    plant_b "mapwheel not turned on"              src/js/free.js 's#map: true, preview: true, mapwheel: true#map: true, preview: true#' $V
    plant_b "the slider does not drive the app"   src/js/free.js "s#if (t10 \&\& from !== 'app' \&\& from !== 'ready') {#if (false) {#" $V
    plant_b "the app's Mode menu moves no slider" src/js/free.js "s#{ setMapMode(m.detail.mode, 'app'); return; }#{ return; }#" $V
    plant_b "mapMode forced on every load"        src/js/free.js 's#if (!st.mapModeApp \&\& MAPMODES#if (MAPMODES#' $V
    plant_b "the page does not follow the app"    src/js/free.js "s#if (am.mode !== MAPMODE) setMapMode(am.mode, 'ready');#void 0;#" $V
    plant_b "the card not sent to the map"        src/js/free.js "s#if (mode !== 'rings') o.card = cardFor(d);#void 0;#" $V
    plant_b "the stand-in box kept with 1.10"     src/js/free.js "s#if (mode !== 'rings') o.card = cardFor(d);#if (mode !== 'rings') { o.card = cardFor(d); showCard(d); }#" $V
    plant_b "the stand-in box lost with 1.9"      src/js/free.js "s#vge(t.version, '1.10') \&\&#vge(t.version, '1.9') \&\&#" $V
    plant_b "a cleared selection keeps its card"  src/js/free.js "s#else if (!SEL \&\& ten('preview')) showSel(); ##" $V
    plant_b "a kind's card not its own picture"   src/js/free.js "s#d.kind === 'kind' \&\& d.target ? { shape: d.target.kind }#false ? 0#" $V
    plant_b "the counts said twice in the echo"   src/js/free.js 's#(PVCAP \&\& r.count !== undefined#(r.count !== undefined#' $V
    plant_b "an item's echo without its counts"   src/js/free.js 's#PVCAP = !!d.caption;#PVCAP = false;#' $V
    plant_b "the map's preview lingers in rings"  src/js/free.js "s#if (mode === 'rings') { try { t10.preview(null); }#if (false) { try { t10.preview(null); }#" tests/free6-browser.cjs
    # revision 8 (docs/NAV.md): fit it, the legend's lines, the slider drawn, Reset layout
    E=tests/free8-browser.cjs
    plant_b "the switch made after the frames"    src/js/ui.js   "s#if (document.readyState !== 'loading' \&\& document.body) lightSwitch();#void 0;#" $E
    plant_b "a grown switch covers frame 2"       src/js/free.js 's#function fitSwitch() { frames.forEach(#function fitSwitch() { return; frames.forEach(#' $E
    plant_b "the legend off frame 1's left edge"  src/js/float.js 's#return { x: GUTTER, y:#return { x: GUTTER + 30, y:#' $E
    plant_b "the legend's foot off the gutter"    src/js/float.js 's#H - (el.offsetHeight || 22) - GUTTER) };#H - (el.offsetHeight || 22) - 4) };#' $E
    plant_b "the slider's track not drawn"        src/css/site.css 's#top: 8px; height: 12px; box-sizing: border-box; border-radius: 999px;#top: 13px; height: 2px; box-sizing: border-box; border-radius: 999px;#' $E
    plant_b "the thumb jumps (no glide)"          src/css/site.css '/^html.motion-on .ef-sl-thumb { transition: left 0.25s ease; }$/d' $E
    plant_b "the thumb glides with Motion off"    src/css/site.css 's#^html.motion-on .ef-sl-thumb { transition#html .ef-sl-thumb { transition#' $E
    plant_b "a dragged thumb stays put"           src/js/free.js 's#th.style.left = Math.round(Math.max(8#void Math.round(Math.max(8#' $E
    plant_b "a drop goes to the middle"           src/js/free.js 's#return p < 29 ? 0 : p < 55 ? 1 : 2;#return 1;#' $E
    plant_b "no Reset layout in Options"          src/js/free.js "s#mine('reset-layout'); if (UNDO) mine('undo-reset');#if (UNDO) mine('undo-reset');#" $E
    plant_b "a reset keeps the frame's width"     src/js/float.js "s#var p = { mode: 'float', x: null, y: null, h: null, w: o.width || 320 };#var p = { mode: 'float', x: null, y: null, h: null };#" $E
    plant_b "a reset leaves the navigator closed" src/js/free.js 's#if (!frames.some(function (fr) { return fr.navFrame; })) {#if (false) {#' $E
    plant_b "a reset leaves the map mode"         src/js/free.js "s#    setMapMode('both', app_ ? 'app' : 'reset');#    void 0;#" $E
    plant_b "Undo reset puts nothing back"        src/js/free.js "s#window.CCFloat.all().forEach(function (fl) { if (u.st\[fl.name\]) fl.set(u.st\[fl.name\], true); });#void 0;#" $E
    plant_b "Undo reset offered twice"            src/js/free.js 's#var u = UNDO; UNDO = null;#var u = UNDO;#' $E
    plant_b "a late caption over a newer message" src/js/free.js 's#    if (!pointed) return;#    void pointed;#' $E
    # revision 8 stage 2: topology forge 1.11 (the map's pad, Reset layout both ways)
    # (revision 9: cardpad turns mappad on, so "no pad" takes cardpad too)
    plant_b "no pad in free"                      src/js/free.js 's#mapwheel: true, mappad: true, reset: true, bigcard: true, cardpad: true })#mapwheel: true, reset: true, bigcard: true })#' $E
    plant_b "no reset switch in free"             src/js/free.js 's#mappad: true, reset: true, bigcard: true#mappad: true, bigcard: true#' $E
    plant_b "the page's reset leaves the app"     src/js/free.js 's#try { if (t.resetLayout()) EXPECT.reset++; }#try { void 0; }#' $E
    plant_b "the app reset twice"                 src/js/free.js 's#try { if (t.resetLayout()) EXPECT.reset++; }#try { if (t.resetLayout() \&\& t.resetLayout()) EXPECT.reset += 2; }#' $E
    plant_b "the page reset twice"                src/js/free.js "s#else if (EXPECT.reset > 0) EXPECT.reset--; else resetLayout('app');#else resetLayout('app');#" $E
    plant_b "the app's reset leaves the frames"   src/js/free.js "s#else if (EXPECT.reset > 0) EXPECT.reset--; else resetLayout('app');#else if (EXPECT.reset > 0) EXPECT.reset--;#" $E
    plant_b "the page's undo leaves the app"      src/js/free.js 's#try { if (t.undoReset()) EXPECT.undo++; }#try { void 0; }#' $E
    plant_b "the app's undo leaves the frames"    src/js/free.js "s#if (EXPECT.undo > 0) EXPECT.undo--; else undoReset('app'); }#if (EXPECT.undo > 0) EXPECT.undo--; }#" $E
    plant_b "the pad does not move the page's slider" src/js/free.js "s#{ setMapMode(m.detail.mode, 'app'); return; }#{ return; }#" $E
    plant_b "the page's slider does not move the pad" src/js/free.js "s#if (t10 \&\& from !== 'app' \&\& from !== 'ready') {#if (false) {#" $E
    plant_b "the pad's change echoed back"        src/js/free.js "s#if (from \&\& from !== true \&\& m === MAPMODE) return;#if (from === 'ready' \&\& m === MAPMODE) return;#" $E
    plant_b "the pad's arrows not set at ready"   src/js/free.js "s#try { t11.padArrows(fstate().padPan ? 'pan' : 'mode-scale'); }#try { void 0; }#" $E
    plant_b "no pad arrows option"                src/js/free.js "s#      if (eleven('padArrows')) mine('pad-pan', !!fstate().padPan);##" $E
    plant_b "the legend runs under the pad"       src/css/site.css '/^@media (max-width: 87.5rem) { html\[data-ui="free"\] .legend.watermark .lg-c { padding: 0 0.45em; } }$/d' $E
    plant   "the pad in classic"                  build.py 's#TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "select,ready,reset,mappad"#'
    plant   "no reset in classic"                 build.py 's#TF_EMBED_CLASSIC = "select,ready,reset"#TF_EMBED_CLASSIC = "select,ready"#'
    # revision 9 (docs/NAV.md): topology forge 1.12's big card and card pad, and the kept card
    G=tests/free9-browser.cjs
    plant_b "no big card in free"                 src/js/free.js 's#, bigcard: true, cardpad: true })# })#' $G
    plant_b "the pad never turns in free"         src/js/free.js 's#bigcard: true, cardpad: true })#bigcard: true })#' $G
    plant_b "a pressed item's card not kept"      src/js/free.js 's#if (!twelve() || !d#if (true || !d#' $G
    plant_b "a hover card kept"                   src/js/free.js 's#^      preview(el);$#      preview(el); keepCard(el);#' $G
    plant_b "the kept card's words not said"      src/js/free.js "s#say(KEPT.d.title + '’s card stays#void (KEPT.d.title + '’s card stays#" $G
    plant_b "a turned page undone by the leave"   src/js/free.js 's#^      if (SHOWN === KEPT.key) return;$##' $G
    plant_b "C-g leaves the kept card"            src/js/free.js 's#function quitWords() { return dropKept(true) ?#function quitWords() { return false ?#' $G
    plant_b "a selection leaves the kept card"    src/js/free.js 's#if (KEPT \&\& (SEL || (KEPT.page \&\& PAGE !== KEPT.page))) dropKept(false);#if (KEPT \&\& ((KEPT.page \&\& PAGE !== KEPT.page))) dropKept(false);#' $G
    plant_b "another page leaves the kept card"   src/js/free.js 's#if (KEPT \&\& (SEL || (KEPT.page \&\& PAGE !== KEPT.page))) dropKept(false);#if (KEPT \&\& SEL) dropKept(false);#' $G
    plant_b "a kept card on a narrow screen"      src/js/free.js 's#|| narrowQ.matches || ownDrawing()) return;#|| ownDrawing()) return;#' $G
    plant_b "a card's art from another host"      src/js/free.js "s#statement: d.statement || '', art: art };#statement: d.statement || '', art: { src: 'https://x.example/a.png' } };#" $G
    plant_b "a frame over the turned pad's grip"  src/js/free.js 's#function padReach(m) { return twelve() \&\&#function padReach(m) { return false \&\&#' $G
    plant_b "a map laid out after ready ignored"  src/js/free.js 's#if (tries > 0) (window.requestAnimationFrame || setTimeout)(function () { mapCheck(tries - 1); }); ##' $G
    # revision 10 (docs/NAV.md): the zoom slider, the undo and redo pill, topology forge 1.13's peek
    X=tests/free10-browser.cjs
    plant_b "the zoom buttons back"               src/js/free.js "s#if (!zoomable()) gs.push({ id: 'view'#if (true) gs.push({ id: 'view'#" $X
    plant_b "no zoom slider"                      src/js/free.js "s#if (app_ \&\& zoomable()) gs.push({ id: 'zoom'#if (false) gs.push({ id: 'zoom'#" $X
    plant_b "an old app loses its zoom buttons"   src/js/free.js "s#if (!zoomable()) gs.push({ id: 'view'#if (false) gs.push({ id: 'view'#" $X
    plant_b "the zoom slider drawn otherwise"     src/css/site.css 's#^\.ef-sl-track, \.ef-zs-track {#.ef-sl-track {#' $X
    plant_b "the zoom's middle is not Fit"        src/js/free.js 's#var own = fitK(), fit = own || 1,#var own = fitK(), fit = 1,#' $X
    plant_b "the zoom on a straight scale"        src/js/free.js 's#Math.log(k / fit) / Math.log(ZSPAN)#(k / fit - 1) / (ZSPAN - 1)#' $X
    plant_b "the knob runs off the slider's ends" src/js/free.js 's#Math.max(-1, Math.min(1, Math.log(k / fit) / Math.log(ZSPAN)))#(Math.log(k / fit) / Math.log(ZSPAN))#' $X
    plant_b "the arrow keys do not nudge"         src/js/free.js "s#k === 'ArrowRight' || k === 'ArrowUp' ? 'in'#false ? 'in'#" $X
    plant_b "PageUp does not double"              src/js/free.js "s#k === 'PageUp' ? 'x2'#k === 'PageUp' ? 'in'#" $X
    plant_b "Enter does not fit"                  src/js/free.js "s#k === 'Home' || k === 'Enter' ? 'fit'#k === 'Home' ? 'fit'#" $X
    plant_b "a press beside the knob does nothing" src/js/free.js "/^      else if (px < knob - 8) zoomAct('out');\$/d" $X
    plant_b "the middle mark does not fit"        src/js/free.js "s#if (Math.abs(px - 42) <= 6) zoomAct('fit');#if (false) zoomAct('fit');#" $X
    plant_b "a drag zooms only when let go"       src/js/free.js 's#if (dr) dr.raf = 0; zoomTo((fitK() || 1) \* Math.pow(ZSPAN, pAt(queued)));#if (dr) dr.raf = 0;#' $X
    plant_b "the zoom slider does not follow"     src/js/free.js 's#f.modelinesOnly(); }); zoomSync(); }); }#f.modelinesOnly(); }); }); }#' $X
    plant_b "an older app's middle not said"      src/js/free.js "s#'the middle is 100% (this copy of the drawing app cannot say what Fit would set)'#'fit is 100%'#" $X
    plant_b "the zoom's value text not in words"  src/js/free.js "/^      z.setAttribute('aria-valuetext', words);\$/d" $X
    plant_b "undo and redo not one pill"          src/js/free.js "s#label: 'Undo and redo', pill: true,#label: 'Undo and redo',#" $X
    plant_b "the pill's group not named"          src/js/free.js "s#label: 'Undo and redo', pill: true,#label: 'Edit', pill: true,#" $X
    plant_b "the pill's halves never disabled"    src/js/free.js "s#if (c.enabled) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');#b.removeAttribute('aria-disabled');#" $X
    plant_b "the pill stale after an undo"        src/js/free.js '/^    pillSync();$/d' $X
    plant_b "a pressed half loses the focus"      src/js/free.js 's#^      nf.focus({ preventScroll: true });$#      void nf;#' $X
    plant_b "the pill pointed at reads nothing"   src/js/free.js "s#root.addEventListener('pointerover', function (ev) { if (ev.target.closest \&\& ev.target.closest('.ef-pill')) pillSync(); });##" $X
    plant_b "a disabled half tilts the pill"      src/js/free.js "s#if (!pill || b.getAttribute('aria-disabled') === 'true') return;#if (!pill) return;#" $X
    plant_b "the pill does not tilt"              src/css/site.css '/^html.motion-on .ef-pill\[data-tilt="undo"\]::before/d' $X
    plant_b "the pill tilts with reduced motion"  src/css/site.css 's#^html.motion-on .ef-pill\[data-tilt="undo"\]::before, html.motion-on .ef-pill\[data-tilt="undo"\]::after, html.motion-on .ef-pill\[data-tilt="undo"\] .ef-pill-b {#.ef-pill[data-tilt="undo"]::before, .ef-pill[data-tilt="undo"]::after, .ef-pill[data-tilt="undo"] .ef-pill-b {#' $X
    plant_b "the peek not said"                   src/js/free.js '/^      f.say(PEEK.said);$/d' $X
    plant_b "the echo not put back after a peek"  src/js/free.js 's#if (PEEK \&\& f.msg.textContent === PEEK.said) f.say(PEEK.before);#void 0;#' $X
    plant_b "a long name not shortened"           src/js/free.js 's#if (n.length <= 48) return n;#return n;#' $X
    plant_b "the card's timer ends a peek"        src/js/free.js 's#    if (PEEK \&\& t10) { PVWAIT = true; return; }##' $X
    plant_b "a stale card after a peek"           src/js/free.js 's#    if (PVWAIT) { PVWAIT = false; showSel(); }#    void 0;#' $X
    plant_b "Shift let go here leaves the card"   src/js/free.js "s#if (ev.key !== 'Shift' || (!PEEK \&\& !KEYDOWN)) return;#if (true) return;#" $X
    # revision 11 (docs/NAV.md): topology forge 1.14's peekKey, his wording, the opening zoom (retargeted above: the keyup line names KEYDOWN)
    Y=tests/free11-browser.cjs
    plant_b "a still pointer waits for a move"    src/js/free.js "s#    try { t.peekKey(true); }.*##" $Y
    plant_b "the page's Shift up leaves the card" src/js/free.js "s#    if (t) { try { t.peekKey(false); }.*#    if (t) { return; }#" $Y
    plant_b "Shift passed on while typing"        src/js/free.js "s#if (!t || !ONDRAW || typing(doc.activeElement)) return;#if (!t || !ONDRAW) return;#" $Y
    plant_b "Shift passed on over a frame"        src/js/free.js "s#if (!t || !ONDRAW || typing(doc.activeElement)) return;#if (!t || typing(doc.activeElement)) return;#" $Y
    plant_b "the pointer on the drawing not seen" src/js/free.js "s#app.addEventListener('mouseenter', function () { ONDRAW = true; });##" $Y
    plant_b "the echo in the old words"           src/js/free.js "s#'The card for ' + peekName(d.name) + ': let go of Shift to put it away.'#peekName(d.name) + '’s card: let go of Shift to put it away.'#" $Y
    plant_b "1.13's Shift up leaves the card"     src/js/free.js '/^    try { if (t) { t.embed({ peek: false }); t.embed({ peek: true }); } }/d' $Y
    plant_b "the page opens at Fit"               src/js/free.js 's#if (!t || fitted || !READY#if (true || !t || fitted || !READY#' $Y
    # revision 11: the note's one press, and the links that reach the note
    Z=tests/privacy-browser.cjs
    plant_b "Forget leaves this tab's name"       src/js/privacy.js "s|store: li.getAttribute('data-store') === 'session' ? 'session' : 'local'|store: 'local'|" $Z
    plant_b "Forget leaves the drawing app's names" src/js/privacy.js "s|      try { area(h.store).removeItem(h.name); gone.push(h.name); }|      if (h.name.indexOf('topoforge.') === 0) return; try { area(h.store).removeItem(h.name); gone.push(h.name); }|" $Z
    plant_b "Forget leaves the prefixed names"    src/js/privacy.js "s|if (!(k.prefix ? n.indexOf(k.key) === 0 : n === k.key)|if (!(n === k.key)|" $Z
    plant_b "Forget never asks"                   src/js/privacy.js "s|      if (work \&\& !window.confirm(|      if (false \&\& !window.confirm(|" $Z
    plant_b "Forget always asks"                  src/js/privacy.js "s|      if (work \&\& !window.confirm(|      if (!window.confirm(|" $Z
    plant_b "the shop's drawing unchanged asks"   src/js/privacy.js "s|with_(sig(f) === sig(d) ? '' : changed)|with_(changed)|" $Z
    plant_b "a board does not ask"                src/js/privacy.js "s|var more = boards ?|var more = false ?|" $Z
    plant_b "the echo area not told"              src/js/privacy.js "s|if (echo) echo.textContent = t;||" $Z
    plant_b "Options has no link to the note"     src/js/free.js "s|if (keptHref('')) out.push({ label: 'What these options keep in this browser'|if (false) out.push({ label: 'What these options keep in this browser'|" $Z
    plant_b "the Site menu has no link to the note" src/js/free.js "s|^    if (keptHref('')) out.push({ label: 'What this site keeps in your browser', href: keptHref('') });.*||" $Z
    plant_b "the Navigator menu has no link to the note" src/js/nav.js "s|^          if (kept('')) out.push({ label: KEPT_LABEL, href: kept('#layout') });||" $Z
    plant_b "the navigator's Help has no link to the note" src/js/nav.js "s|.concat(kept('') ? \[\['link', KEPT_LABEL, '', kept('#layout')\]\] : \[\])||" $Z
    plant_b "Customize's row has no link to the note" src/js/ui.js "s|kp.className = 'c-kept'; kp.appendChild(kept); fs.appendChild(kp);|void kp;|" $Z
    plant_b "the frame reads the navigator's link as a command" src/js/free.js "s|else if (it.href) out.push({ label: it.label, link: { href: it.href } }); ||" $Z
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
