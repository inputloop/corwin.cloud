// @license magnet:?xt=urn:btih:1f739d935676111cfff4b4693e3816e664797050&dn=gpl-3.0.txt GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 INPUTLOOP
// SPDX-License-Identifier: GPL-3.0-or-later
//
// badges.js: a status line for each project that has a release channel. An element with
// data-channel="<name>" asks this site (and only this site) for /dist/<name>/channel.json, the
// channel feed of c4's d/channels/SPEC.md, and says in words its last revision and when it was
// made. A feed that is missing, cannot be read, or breaks the spec leaves the line hidden, and
// nothing else changes. It stores nothing and sends nothing but that one request.
(function (root) {
  'use strict';
  var NAME = /^[a-z][a-z0-9-]{0,40}$/;
  var LINE = /^ {2}"([A-Za-z0-9_]+)": "([^"\\]*)",?$/;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // The feed as an object, or null. The spec's "line form": braces on their own lines, one field a
  // line, two spaces of indent, every value a string, printable ASCII only.
  function readFeed(text, channel) {
    if (typeof text !== 'string' || /[^\x20-\x7e\n]/.test(text)) return null;
    var lines = text.replace(/\n$/, '').split('\n');
    if (lines.length < 3 || lines[0] !== '{' || lines[lines.length - 1] !== '}') return null;
    var f = {};
    for (var i = 1; i < lines.length - 1; i++) {
      var m = LINE.exec(lines[i]);
      if (!m || Object.prototype.hasOwnProperty.call(f, m[1])) return null;
      if ((i < lines.length - 2) !== /,$/.test(lines[i])) return null;
      f[m[1]] = m[2];
    }
    if (f.format !== 'channel/1' || f.channel !== channel || !NAME.test(f.channel)) return null;
    if (!/^[0-9a-f]{7,64}$/.test(f.revision || '') || !/^\d{8}-\d{6}$/.test(f.stamp || '')) return null;
    if (!/^[0-9a-f]{64}$/.test(f.sha256 || '') || !/^[A-Za-z0-9._:+-]{1,160}$/.test(f.key || '')) return null;
    return f;
  }

  // "Last revision 40ffbb38e32a, made 1 November 2026 at 18:13 UTC."
  function describe(f) {
    var s = f.stamp, mo = parseInt(s.slice(4, 6), 10), d = parseInt(s.slice(6, 8), 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return 'Last revision ' + f.revision.slice(0, 12) + ', made ' + d + ' ' + MONTHS[mo - 1] + ' ' + s.slice(0, 4) +
      ' at ' + s.slice(9, 11) + ':' + s.slice(11, 13) + ' UTC.';
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { readFeed: readFeed, describe: describe }; return; }
  var doc = root.document;
  if (!doc || !root.fetch) return;
  Array.prototype.forEach.call(doc.querySelectorAll('[data-channel]'), function (el) {
    var name = el.getAttribute('data-channel');
    if (!NAME.test(name)) return;
    var url = new URL('/dist/' + name + '/channel.json', root.location.href);
    if (url.origin !== root.location.origin) return;
    root.fetch(url.href, { credentials: 'omit', cache: 'no-cache', redirect: 'error' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (t) {
        var f = t && readFeed(t, name), words = f && describe(f);
        if (!words) return;
        el.querySelector('.ch-words').textContent = words;
        el.hidden = false;
      })
      .catch(function () { /* no feed: the line stays hidden */ });
  });
})(this);
// @license-end
