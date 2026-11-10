# SPDX-FileCopyrightText: 2026 INPUTLOOP
# SPDX-License-Identifier: GPL-3.0-or-later
"""Pinned copies of the libraries a demo needs, so it runs from this site and asks no other host.

Each pin names one npm registry tarball by exact version, address and sha256 (and the sha512 the
npm lockfile format records). build.py calls fetch(): a tarball already in the cache is checked; a
missing one is downloaded from the registry once and checked; a tarball whose sha256 differs is
refused and the demo that needs it is not staged (the demo page says why). Nothing here is
committed to this repository: the cache is outside it (VENDOR_CACHE, default ~/.cache/corwin.cloud/npm)
and the files land only in the built site.

The versions are what NextTime-Dev's demo (demo/index.html) asks for, resolved to exact versions on
2026-11-01: vue@3, vue-router@4 and maplibre-gl@4 from unpkg.com. vue 3.5.44 is also the version in
NextTime-Dev's package-lock.json; the app itself uses vue-router 5 and maplibre-gl 6, which the demo
cannot (maplibre-gl 6 ships no browser global build), so the demo's own majors are kept.

Standard library only.
"""
import base64
import hashlib
import io
import os
import tarfile
import urllib.request

REGISTRY = "https://registry.npmjs.org"
EXPAT = ("Expat", "http://www.jclark.com/xml/copying.txt", "magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt")
BSD3 = ("Modified-BSD", "http://www.xfree86.org/3.3.6/COPYRIGHT2.html#5", "magnet:?xt=urn:btih:c80d50af7d3db9be66a4d0a86db0286e4fd33292&dn=modified-bsd.txt")

# files: published name -> path inside the tarball. min: a minified file served -> its unminified twin, served beside it.
PINS = [
    dict(name="vue", version="3.5.44", spdx="MIT", licence=EXPAT,
         sha256="33cd651dcae080f76c110bdb035faf9e0bab35f44cd4bd9cf8cf40ae7ed97256",
         integrity="sha512-dvvmaOCG7lAMkJTPqPwWeGMsPS6DIsFsfZDUgBp9V6mHf9b3+/wyVwYR4Es+WV6uJC0FKRxp81Obcq0ZwUcGFQ==",
         files={"vue.global.prod.js": "package/dist/vue.global.prod.js", "vue.global.js": "package/dist/vue.global.js", "LICENSE": "package/LICENSE"},
         min={"vue.global.prod.js": "vue.global.js"},
         by="Evan You and Vue contributors", home="https://github.com/vuejs/core"),
    dict(name="vue-router", version="4.6.4", spdx="MIT", licence=EXPAT,
         sha256="831b6c4c185c37490bdfe6708585df9000d2264abf138a4bbba61daf944cc9c9",
         integrity="sha512-Hz9q5sa33Yhduglwz6g9skT8OBPii+4bFn88w6J+J4MfEo4KRRpmiNG/hHHkdbRFlLBOqxN8y8gf2Fb0MTUgVg==",
         files={"vue-router.global.prod.js": "package/dist/vue-router.global.prod.js", "vue-router.global.js": "package/dist/vue-router.global.js", "LICENSE": "package/LICENSE"},
         min={"vue-router.global.prod.js": "vue-router.global.js"},
         by="Eduardo San Martin Morote", home="https://github.com/vuejs/router"),
    dict(name="maplibre-gl", version="4.7.1", spdx="BSD-3-Clause", licence=BSD3,
         sha256="7e8a778cff03abad64ae19674977058616e1cf7c3712cabd1c35461ae465f923",
         integrity="sha512-lgL7XpIwsgICiL82ITplfS7IGwrB1OJIw/pCvprDp2dhmSSEBgmPzYRvwYYYvJGJD7fxUv1Tvpih4nZ6VrLuaA==",
         files={"maplibre-gl-csp.js": "package/dist/maplibre-gl-csp.js", "maplibre-gl-csp-worker.js": "package/dist/maplibre-gl-csp-worker.js",
                "maplibre-gl-csp-dev.js": "package/dist/maplibre-gl-csp-dev.js", "maplibre-gl-csp-worker-dev.js": "package/dist/maplibre-gl-csp-worker-dev.js",
                "maplibre-gl.css": "package/dist/maplibre-gl.css", "LICENSE.txt": "package/LICENSE.txt"},
         min={"maplibre-gl-csp.js": "maplibre-gl-csp-dev.js", "maplibre-gl-csp-worker.js": "maplibre-gl-csp-worker-dev.js"},
         by="MapLibre contributors", home="https://github.com/maplibre/maplibre-gl-js"),
]


def tarball_url(p):
    return "%s/%s/-/%s-%s.tgz" % (REGISTRY, p["name"], p["name"], p["version"])


def folder(p):
    """Where a pin's files are published, under a demo's app/ folder."""
    return "vendor/%s/%s" % (p["name"], p["version"])


def cache_dir():
    return os.environ.get("VENDOR_CACHE") or os.path.join(os.path.expanduser("~"), ".cache", "corwin.cloud", "npm")


def check(p, raw):
    """None when the bytes are the pinned tarball, else the reason in words."""
    got = hashlib.sha256(raw).hexdigest()
    if got != p["sha256"]:
        return "%s %s: sha256 %s, but the pin says %s" % (p["name"], p["version"], got, p["sha256"])
    if "sha512-" + base64.b64encode(hashlib.sha512(raw).digest()).decode() != p["integrity"]:
        return "%s %s: the sha512 differs from the pin" % (p["name"], p["version"])
    return None


def fetch(p, offline=False):
    """The pinned tarball's bytes, checked, or raise ValueError saying why not."""
    d = cache_dir()
    path = os.path.join(d, "%s-%s.tgz" % (p["name"], p["version"]))
    if not os.path.isfile(path):
        if offline or os.environ.get("VENDOR_OFFLINE") == "1":
            raise ValueError("%s %s is not in the cache (%s) and fetching is off" % (p["name"], p["version"], d))
        os.makedirs(d, exist_ok=True)
        with urllib.request.urlopen(tarball_url(p), timeout=60) as r:
            raw = r.read()
        why = check(p, raw)
        if why:
            raise ValueError(why + " (downloaded; not kept)")
        with open(path + ".part", "wb") as f:
            f.write(raw)
        os.replace(path + ".part", path)
    with open(path, "rb") as f:
        raw = f.read()
    why = check(p, raw)
    if why:
        raise ValueError(why + " (in the cache: %s)" % path)
    return raw


def stage(p, dest):
    """Unpack the pinned files of one pin into dest/<folder>/. Returns the published paths."""
    raw = fetch(p)
    out = os.path.join(dest, folder(p))
    os.makedirs(out, exist_ok=True)
    made = []
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t:
        for pub, inner in p["files"].items():
            m = t.getmember(inner)
            if not m.isfile():
                raise ValueError("%s %s: %s is not a plain file" % (p["name"], p["version"], inner))
            with open(os.path.join(out, pub), "wb") as f:
                f.write(t.extractfile(m).read())
            made.append("%s/%s" % (folder(p), pub))
    return made


def by_name(name):
    return next(p for p in PINS if p["name"] == name)
