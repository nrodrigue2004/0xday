/* Homelab practice tools for 0xDay: ~/harden, ~/report, ~/weekly.
   Data comes inline from <script id="ho-data">. State is saved in this browser's localStorage only;
   every storage call is wrapped, so the pages still work with storage blocked. No network calls. */
(function () {
  "use strict";
  var tag = document.getElementById("ho-data"); if (!tag) return;
  var P; try { P = JSON.parse(tag.textContent); } catch (e) { return; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function el(id) { return document.getElementById(id); }

  /* ============ harden ============ */
  function initHarden() {
    var host = el("ho-harden"), SYS = P.data.systems, KEY = "oxday-harden-v1";
    var st = load(KEY, {}), cur = "overview";
    function sys(id) { return SYS.filter(function (s) { return s.id === id; })[0]; }
    function score(s) {
      var got = 0, tot = 0, c = (st[s.id] && st[s.id].c) || {};
      s.checks.forEach(function (k, i) { tot += k.w; if (c[i]) got += k.w; });
      return tot ? Math.round(100 * got / tot) : 0;
    }
    function cls(n) { return n < 40 ? "lo" : n < 75 ? "mid" : ""; }
    function persist() { save(KEY, st); }
    function render() {
      var tabs = '<div class="ho-tabs" role="group" aria-label="systems"><button class="btn" type="button" data-t="overview" aria-pressed="' + (cur === "overview") + '">[ overview ]</button>' +
        SYS.map(function (s) { return '<button class="btn" type="button" data-t="' + s.id + '" aria-pressed="' + (cur === s.id) + '">[ ' + esc(s.name) + ' ]</button>'; }).join("") + "</div>";
      host.innerHTML = tabs + (cur === "overview" ? overview() : detail(sys(cur)));
      host.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { cur = b.getAttribute("data-t"); render(); }; });
      if (cur === "overview") bindOverview(); else bindDetail(sys(cur));
    }
    function overview() {
      var rows = "", tg = 0, tn = 0, tb = 0, nb = 0;
      SYS.forEach(function (s) {
        var n = score(s), b = st[s.id] && st[s.id].base, d = b ? n - b.score : null;
        tn += n; if (b) { tb += b.score; nb++; }
        rows += "<tr><td>" + esc(s.name) + "</td><td>" + (b ? b.score + "% <span class=\"muted\">(" + esc(b.date) + ")</span>" : "—") + "</td><td>" + n + "%</td><td>" +
          (d == null ? "—" : '<span class="ho-delta' + (d < 0 ? " neg" : "") + '">' + (d >= 0 ? "+" : "") + d + "</span>") + "</td></tr>";
      });
      var avg = Math.round(tn / SYS.length);
      return '<div class="ho-score"><span class="ho-score__n ' + cls(avg) + '">' + avg + '%</span><span>lab average, ' + SYS.length + ' systems</span><span class="ho-meter"><i style="width:' + avg + '%"></i></span></div>' +
        '<table class="ho-sum"><thead><tr><th>system</th><th>baseline</th><th>now</th><th>change</th></tr></thead><tbody>' + rows + "</tbody></table>" +
        '<p class="ho-note">Pick a system, tick what is truly done, then press save baseline. Next session, tick more and compare. Scores are weighted: items that remove the most risk count for more.</p>' +
        '<details><summary class="muted">export / import (move between browsers)</summary><textarea id="ho-io" class="ho-io" rows="5" spellcheck="false" aria-label="export or import JSON"></textarea>' +
        '<p><button class="btn" type="button" id="ho-exp">[ export ]</button> <button class="btn" type="button" id="ho-imp">[ import ]</button> <span id="ho-msg" class="muted"></span></p></details>';
    }
    function bindOverview() {
      var io = el("ho-io"), msg = el("ho-msg");
      el("ho-exp").onclick = function () { io.value = JSON.stringify(st); msg.textContent = "copy this somewhere safe"; };
      el("ho-imp").onclick = function () {
        try { var v = JSON.parse(io.value); if (!v || typeof v !== "object") throw 0; st = v; persist(); render(); } catch (e) { msg.textContent = "that is not valid export text"; }
      };
    }
    function detail(s) {
      var n = score(s), b = st[s.id] && st[s.id].base, c = (st[s.id] && st[s.id].c) || {};
      var d = b ? n - b.score : null;
      var h = '<div class="ho-score"><span class="ho-score__n ' + cls(n) + '">' + n + '%</span><span>' + esc(s.os) + '</span><span class="ho-meter"><i style="width:' + n + '%"></i></span>' +
        (b ? '<span class="muted">baseline ' + b.score + "% on " + esc(b.date) + ' · <span class="ho-delta' + (d < 0 ? " neg" : "") + '">' + (d >= 0 ? "+" : "") + d + "</span></span>" : '<span class="muted">no baseline yet</span>') + "</div>" +
        '<div class="ho-bar"><button class="btn" type="button" id="ho-base">[ save baseline ]</button><button class="btn" type="button" id="ho-reset">[ clear ticks ]</button></div>';
      s.checks.forEach(function (k, i) {
        h += '<div class="ho-chk' + (c[i] ? " done" : "") + '"><input type="checkbox" id="ck' + i + '" data-i="' + i + '"' + (c[i] ? " checked" : "") + '><label for="ck' + i + '">' + esc(k.t) + '<span class="w">weight ' + k.w + '</span></label><span class="why">' + esc(k.why) + '</span><span class="how">$ ' + esc(k.how) + "</span></div>";
      });
      return h;
    }
    function bindDetail(s) {
      host.querySelectorAll("input[data-i]").forEach(function (cb) {
        cb.onchange = function () {
          st[s.id] = st[s.id] || { c: {} }; st[s.id].c = st[s.id].c || {};
          if (cb.checked) st[s.id].c[cb.getAttribute("data-i")] = true; else delete st[s.id].c[cb.getAttribute("data-i")];
          persist(); render();
        };
      });
      el("ho-base").onclick = function () { st[s.id] = st[s.id] || { c: {} }; st[s.id].base = { score: score(s), date: today() }; persist(); render(); };
      el("ho-reset").onclick = function () { if (st[s.id]) st[s.id].c = {}; persist(); render(); };
    }
    render();
  }

  /* ============ report ============ */
  var SAMPLE = [
    "Overnight Security Onion review, fictional lab.",
    "Workstation downloaded an executable and began beaconing to an outside server.",
    "host: ws01 (10.20.0.50)",
    "host: dc01 (checked, no signs)",
    "ioc: 203.0.113.9 (download source)",
    "ioc: 198.51.100.44 (beacon destination)",
    "ioc: update-cdn-check.example (domain)",
    "attack: T1105 Ingress Tool Transfer",
    "attack: T1071.001 Web Protocols",
    "02:14 Two high alerts: executable retrieved from 203.0.113.9 by ws01",
    "02:33 ws01 begins connecting to 198.51.100.44:443 about once a minute",
    "03:40 Confirmed 60 near-identical connections and DNS lookups for the same domain",
    "Contained by: isolating ws01 from the lab segment, blocking the IP and domain at pfSense",
    "Cause: user opened a downloaded file (lab exercise, assumed)",
    "Action: add a detection for regular small outbound connections; require application allow-listing on ws01"
  ].join("\n");

  function initReport() {
    var host = el("ho-report"), KEY = "oxday-report-v1", s = load(KEY, { notes: "", title: "", sev: "medium", status: "contained" });
    host.innerHTML = '<div class="ho-cols"><div class="ho-form">' +
      '<div><label for="r-title">title</label><input id="r-title" maxlength="120" placeholder="Beaconing from ws01"></div>' +
      '<div class="ho-cols"><div><label for="r-sev">severity</label><select id="r-sev"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div>' +
      '<div><label for="r-status">status</label><select id="r-status"><option>investigating</option><option>contained</option><option>resolved</option></select></div></div>' +
      '<div><label for="r-notes">lab notes</label><textarea id="r-notes" spellcheck="false" placeholder="02:14 something happened&#10;host: ws01&#10;ioc: 198.51.100.44&#10;attack: T1071&#10;Contained by: ...&#10;Cause: ...&#10;Action: ..."></textarea></div>' +
      '<div class="ho-bar"><button class="btn" type="button" id="r-sample">[ load sample ]</button><button class="btn" type="button" id="r-copy">[ copy markdown ]</button><button class="btn" type="button" id="r-dl">[ download .md ]</button><span id="r-msg" class="muted"></span></div>' +
      '<p class="ho-note">Prefixes understood: <code>HH:MM</code>, <code>host:</code>, <code>ioc:</code>, <code>attack:</code>, <code>contained by:</code>, <code>cause:</code>, <code>action:</code>. Notes are kept in this browser.</p></div>' +
      '<div><div id="r-out" class="ho-out" aria-live="polite"></div></div></div>';
    var T = el("r-title"), SV = el("r-sev"), ST = el("r-status"), N = el("r-notes"), O = el("r-out"), M = el("r-msg");
    T.value = s.title; SV.value = s.sev; ST.value = s.status; N.value = s.notes;
    function gen() {
      var tl = [], hosts = [], iocs = [], att = [], sum = [], cont = [], cause = [], act = [];
      N.value.split("\n").forEach(function (l) {
        l = l.trim(); if (!l) return; var m;
        if ((m = l.match(/^(\d{1,2}:\d{2})\s+(.*)$/))) tl.push(m[1] + " | " + m[2]);
        else if ((m = l.match(/^host:\s*(.*)$/i))) hosts.push(m[1]);
        else if ((m = l.match(/^ioc:\s*(.*)$/i))) iocs.push(m[1]);
        else if ((m = l.match(/^attack:\s*(.*)$/i))) att.push(m[1]);
        else if ((m = l.match(/^contained by:\s*(.*)$/i))) cont.push(m[1]);
        else if ((m = l.match(/^cause:\s*(.*)$/i))) cause.push(m[1]);
        else if ((m = l.match(/^action:\s*(.*)$/i))) act.push(m[1]);
        else sum.push(l);
      });
      function ul(a, none) { return a.length ? a.map(function (x) { return "- " + x; }).join("\n") : "- " + none; }
      var md = "# Incident report: " + (T.value || "untitled") + "\n\n" +
        "- **Date:** " + today() + "\n- **Severity:** " + SV.value + "\n- **Status:** " + ST.value + "\n- **Environment:** home lab (fictional data, no production systems)\n\n" +
        "## Summary\n\n" + (sum.join(" ") || "_Add two or three sentences: what happened, what was affected, what was done._") + "\n\n" +
        "## Timeline (UTC)\n\n" + (tl.length ? "| Time | Event |\n|---|---|\n" + tl.map(function (x) { return "| " + x.replace(/\|/g, "\\|").replace(" \\| ", " | ") + " |"; }).join("\n") : "_No timestamps yet. Start a line with HH:MM._") + "\n\n" +
        "## Affected systems\n\n" + ul(hosts, "none recorded") + "\n\n" +
        "## Indicators of compromise\n\n" + ul(iocs, "none recorded") + "\n\n" +
        "## ATT&CK techniques\n\n" + ul(att, "none mapped") + "\n\n" +
        "## Containment\n\n" + ul(cont, "not yet done") + "\n\n" +
        "## Root cause\n\n" + ul(cause, "unknown; say what you checked") + "\n\n" +
        "## Recommendations\n\n" + ul(act, "none yet") + "\n\n" +
        "## What I would check next\n\n- Other hosts talking to the same indicators\n- Whether the detection fired, and how long it took\n";
      O.textContent = md; s = { notes: N.value, title: T.value, sev: SV.value, status: ST.value }; save(KEY, s); return md;
    }
    [T, SV, ST, N].forEach(function (x) { x.addEventListener("input", gen); x.addEventListener("change", gen); });
    el("r-sample").onclick = function () { T.value = "Beaconing from ws01"; N.value = SAMPLE; gen(); };
    el("r-copy").onclick = function () {
      var md = gen();
      function fb() { var r = document.createRange(); r.selectNodeContents(O); var g = getSelection(); g.removeAllRanges(); g.addRange(r); M.textContent = "selected, press Ctrl+C"; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(function () { M.textContent = "copied"; }, fb); else fb();
    };
    el("r-dl").onclick = function () {
      var md = gen(), a = document.createElement("a"), slug = (T.value || "incident").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "incident";
      a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); a.download = today() + "-" + slug + ".md";
      document.body.appendChild(a); a.click(); a.remove(); M.textContent = "downloaded";
    };
    gen();
  }

  /* ============ weekly ============ */
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), n = Math.ceil(((t - y0) / 864e5 + 1) / 7);
    return { y: t.getUTCFullYear(), n: n };
  }
  function wkey(w) { return w.y + "-W" + (w.n < 10 ? "0" : "") + w.n; }
  function initWeekly() {
    var host = el("ho-weekly"), D = P.data, KEY = "oxday-weekly-v1", st = load(KEY, {});
    var now = new Date(), w = isoWeek(now), k = wkey(w), focus = D.focus[w.n % D.focus.length];
    function done() { return st[k] || []; }
    function streak() {
      var s = 0, d = new Date(now.getTime());
      for (var i = 0; i < 52; i++) {
        d = new Date(now.getTime() - i * 7 * 864e5);
        var n = (st[wkey(isoWeek(d))] || []).length;
        if (n >= 3) s++; else if (i > 0) break;
      }
      return s;
    }
    function render() {
      var dn = done(), mins = 0, left = 0;
      D.tasks.forEach(function (t) { if (dn.indexOf(t.id) < 0) left += t.min; });
      var h = '<div class="ho-focus">Week <b>' + k + '</b> focus: <b>' + esc(focus) + '</b>. Do the tasks that touch it first. <span class="muted">Do three or more to keep the streak: current streak ' + streak() + ' week' + (streak() === 1 ? "" : "s") + ".</span></div>" +
        '<p class="ho-note">' + dn.length + " of " + D.tasks.length + " done, about " + left + " minutes left if you do everything.</p>";
      D.tasks.forEach(function (t) {
        var on = dn.indexOf(t.id) >= 0;
        h += '<div class="ho-task' + (on ? " done" : "") + '"><input type="checkbox" id="wk-' + t.id + '" data-id="' + t.id + '"' + (on ? " checked" : "") + '><label for="wk-' + t.id + '">' + esc(t.t) + '</label><span class="m">~' + t.min + ' min</span><span class="d">' + esc(t.d) + ' <a href="' + esc(t.link) + '">open</a></span></div>';
      });
      h += '<p class="ho-note">Only 20 minutes? Fire a test alert, check the backup log, and move one credential into the password manager.</p>';
      host.innerHTML = h;
      host.querySelectorAll("input[data-id]").forEach(function (cb) {
        cb.onchange = function () {
          var a = done().slice(), id = cb.getAttribute("data-id"), i = a.indexOf(id);
          if (cb.checked && i < 0) a.push(id); if (!cb.checked && i >= 0) a.splice(i, 1);
          st[k] = a;
          var keys = Object.keys(st).sort(); while (keys.length > 60) delete st[keys.shift()];
          save(KEY, st); render();
        };
      });
    }
    render();
  }

  if (P.kind === "harden") initHarden(); else if (P.kind === "report") initReport(); else if (P.kind === "weekly") initWeekly();
})();
