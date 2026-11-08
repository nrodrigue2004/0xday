/* 0xDay ~/ossim and ~/dbsim: small teaching simulators. Pure logic first, DOM wiring at the bottom. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- CPU scheduling ---------- */
  function parseProcs(text) {
    var out = [];
    text.split("\n").forEach(function (line) {
      var p = line.trim().split(/[\s,]+/);
      if (p.length < 3 || !p[0]) return;
      var a = +p[1], b = +p[2], pr = p.length > 3 ? +p[3] : 0;
      if (!(a >= 0) || !(b > 0) || isNaN(pr) || a % 1 || b % 1) throw new Error("bad line: " + line.trim() + "  (name arrival burst [priority], whole numbers)");
      out.push({ n: p[0], a: a, b: b, pr: pr, i: out.length });
    });
    if (!out.length) throw new Error("add at least one process");
    if (out.length > 12) throw new Error("12 processes max");
    return out;
  }
  function schedule(procs, algo, q) {
    var n = procs.length, rem = procs.map(function (p) { return p.b; }), first = [], fin = [], segs = [];
    var queued = {}, queue = [], cur = -1, qleft = 0, t = 0, done = 0;
    function arrive() {
      procs.forEach(function (p, i) { if (p.a <= t && !queued[i]) { queued[i] = 1; queue.push(i); } });
    }
    function pick() {
      var best = -1;
      for (var i = 0; i < n; i++) {
        if (rem[i] <= 0 || procs[i].a > t) continue;
        if (best < 0) { best = i; continue; }
        var k = function (j) { return algo === "fcfs" ? [procs[j].a, j] : algo === "prio" ? [procs[j].pr, procs[j].a, j] : algo === "sjf" ? [procs[j].b, procs[j].a, j] : [rem[j], procs[j].a, j]; };
        var x = k(i), y = k(best);
        for (var z = 0; z < x.length; z++) { if (x[z] < y[z]) { best = i; break; } if (x[z] > y[z]) break; }
      }
      return best;
    }
    var guard = 0;
    while (done < n && guard++ < 100000) {
      arrive();
      if (algo === "rr") { if (cur < 0 && queue.length) { cur = queue.shift(); qleft = q; } }
      else if (algo === "srtf") { cur = pick(); }
      else if (cur < 0) { cur = pick(); }
      if (cur < 0) { push("idle", t, t + 1); t++; continue; }
      if (first[cur] === undefined) first[cur] = t;
      push(procs[cur].n, t, t + 1);
      rem[cur]--; t++; qleft--;
      if (algo === "rr") arrive();
      if (rem[cur] === 0) { fin[cur] = t; done++; cur = -1; }
      else if (algo === "rr" && qleft === 0) { queue.push(cur); cur = -1; }
    }
    function push(name, s, e) {
      var l = segs[segs.length - 1];
      if (l && l.n === name && l.e === s) l.e = e; else segs.push({ n: name, s: s, e: e });
    }
    var rows = procs.map(function (p, i) {
      var tat = fin[i] - p.a;
      return { n: p.n, a: p.a, b: p.b, done: fin[i], tat: tat, wait: tat - p.b, resp: first[i] - p.a };
    });
    var avg = function (k) { return rows.reduce(function (s, r) { return s + r[k]; }, 0) / rows.length; };
    return { segs: segs, rows: rows, wait: avg("wait"), tat: avg("tat"), resp: avg("resp") };
  }

  /* ---------- page replacement ---------- */
  function replace(refs, nf, algo) {
    var fr = [], steps = [], faults = 0, last = {}, age = [];
    refs.forEach(function (r, i) {
      var hit = fr.indexOf(r) >= 0, ev = null;
      if (!hit) {
        faults++;
        if (fr.length === nf) {
          var v;
          if (algo === "fifo") v = 0;
          else if (algo === "lru") { v = 0; fr.forEach(function (p, k) { if (last[p] < last[fr[v]]) v = k; }); }
          else {
            v = 0; var far = -1;
            fr.forEach(function (p, k) {
              var nx = refs.indexOf(p, i + 1); if (nx < 0) nx = 1e9;
              if (nx > far) { far = nx; v = k; }
            });
          }
          ev = fr[v];
          if (algo === "fifo") fr.shift(); else fr.splice(v, 1);
        }
        fr.push(r);
      }
      last[r] = i;
      steps.push({ ref: r, frames: fr.slice(), fault: !hit, ev: ev });
    });
    return { steps: steps, faults: faults };
  }

  /* ---------- Banker's algorithm ---------- */
  function matrix(text, cols, what) {
    var rows = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var v = l.split(/[\s,]+/).map(Number);
      if (v.length !== cols || v.some(function (x) { return !(x >= 0) || x % 1; })) throw new Error(what + ": every row needs " + cols + " whole numbers");
      return v;
    });
    return rows;
  }
  function safeSeq(alloc, need, avail) {
    var n = alloc.length, work = avail.slice(), done = [], seq = [], trace = [];
    for (var round = 0; round < n; round++) {
      var found = -1;
      for (var i = 0; i < n; i++) {
        if (done[i]) continue;
        if (need[i].every(function (x, k) { return x <= work[k]; })) { found = i; break; }
      }
      if (found < 0) break;
      done[found] = true; seq.push(found);
      trace.push({ p: found, work: work.slice() });
      work = work.map(function (w, k) { return w + alloc[found][k]; });
    }
    return { safe: seq.length === n, seq: seq, trace: trace, end: work };
  }
  function banker(alloc, max, avail, req) {
    var need = max.map(function (r, i) { return r.map(function (x, k) { return x - alloc[i][k]; }); });
    if (need.some(function (r) { return r.some(function (x) { return x < 0; }); })) throw new Error("Max must be at least Allocation");
    var res = { need: need, base: safeSeq(alloc, need, avail), req: null };
    if (req) {
      var p = req.p, v = req.v, r = { ok: false, why: "" };
      if (v.some(function (x, k) { return x > need[p][k]; })) r.why = "request exceeds P" + p + "'s remaining need";
      else if (v.some(function (x, k) { return x > avail[k]; })) r.why = "not enough available right now, P" + p + " must wait";
      else {
        var a2 = alloc.map(function (x) { return x.slice(); }), n2 = need.map(function (x) { return x.slice(); });
        a2[p] = a2[p].map(function (x, k) { return x + v[k]; }); n2[p] = n2[p].map(function (x, k) { return x - v[k]; });
        var s = safeSeq(a2, n2, avail.map(function (x, k) { return x - v[k]; }));
        r.ok = s.safe; r.s = s; r.why = s.safe ? "granting it leaves a safe state" : "granting it would leave an unsafe state, so deny it";
      }
      res.req = r;
    }
    return res;
  }

  /* ---------- functional dependencies ---------- */
  function parseFDs(text) {
    var fds = [], attrs = {};
    text.split("\n").forEach(function (l) {
      l = l.trim(); if (!l) return;
      var m = l.split("->");
      if (m.length !== 2) throw new Error("bad dependency: " + l + "  (write A B -> C)");
      var side = function (s) { return s.trim().split(/[\s,]+/).filter(Boolean); };
      var L = side(m[0]), R = side(m[1]);
      if (!L.length || !R.length) throw new Error("bad dependency: " + l);
      L.concat(R).forEach(function (a) { attrs[a] = 1; });
      fds.push({ l: L, r: R });
    });
    return { fds: fds, attrs: Object.keys(attrs).sort() };
  }
  function closure(set, fds) {
    var c = {}; set.forEach(function (a) { c[a] = 1; });
    var ch = true;
    while (ch) {
      ch = false;
      fds.forEach(function (f) {
        if (f.l.every(function (a) { return c[a]; })) f.r.forEach(function (a) { if (!c[a]) { c[a] = 1; ch = true; } });
      });
    }
    return Object.keys(c).sort();
  }
  function subsets(arr) {
    var out = [];
    for (var m = 1; m < (1 << arr.length); m++) out.push(arr.filter(function (_, i) { return m & (1 << i); }));
    return out;
  }
  function analyze(text, extra) {
    var P = parseFDs(text), attrs = P.attrs;
    if (extra) extra.forEach(function (a) { if (attrs.indexOf(a) < 0) attrs.push(a); });
    attrs = attrs.slice().sort();
    if (!attrs.length) throw new Error("enter some dependencies");
    if (attrs.length > 10) throw new Error("10 attributes max");
    var all = subsets(attrs), keys = [];
    all.filter(function (s) { return closure(s, P.fds).length === attrs.length; })
      .sort(function (a, b) { return a.length - b.length; })
      .forEach(function (s) { if (!keys.some(function (k) { return k.every(function (a) { return s.indexOf(a) >= 0; }); })) keys.push(s); });
    var prime = {}; keys.forEach(function (k) { k.forEach(function (a) { prime[a] = 1; }); });
    var isSuper = function (X) { return closure(X, P.fds).length === attrs.length; };
    var viol = { bcnf: [], nf3: [], nf2: [] };
    P.fds.forEach(function (f) {
      f.r.forEach(function (a) {
        if (f.l.indexOf(a) >= 0) return;
        var txt = f.l.join(" ") + " -> " + a;
        if (!isSuper(f.l)) {
          viol.bcnf.push(txt + " (left side is not a key)");
          if (!prime[a]) viol.nf3.push(txt + " (" + a + " is not part of any key)");
        }
      });
    });
    keys.forEach(function (k) {
      if (k.length < 2) return;
      subsets(k).forEach(function (s) {
        if (s.length === k.length) return;
        closure(s, P.fds).forEach(function (a) {
          if (!prime[a] && s.indexOf(a) < 0) viol.nf2.push(s.join(" ") + " -> " + a + " (part of key " + k.join(" ") + ")");
        });
      });
    });
    var uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
    viol.nf2 = uniq(viol.nf2);
    var level = viol.nf2.length ? "1NF" : viol.nf3.length ? "2NF" : viol.bcnf.length ? "3NF" : "BCNF";
    return { attrs: attrs, keys: keys, prime: Object.keys(prime).sort(), viol: viol, level: level };
  }

  /* ---------- index cost model ---------- */
  function indexCost(rows, fanout, perPage, k) {
    var pages = Math.ceil(rows / perPage);
    var height = Math.max(1, Math.ceil(Math.log(rows) / Math.log(fanout)));
    var seq = pages;
    var idx = height + k; /* one root-to-leaf walk plus one random heap fetch per matching row */
    return { pages: pages, height: height, seq: seq, idx: idx, pick: idx < seq ? "index scan" : "sequential scan" };
  }

  /* ---------- schedule serializability ---------- */
  function parseSchedule(text) {
    var re = /([rwRW])(\d+)\((\w+)\)/g, ops = [], m, last = 0;
    var clean = text.trim();
    if (!clean) throw new Error("enter a schedule, e.g. r1(x) w2(x) w1(x)");
    while ((m = re.exec(clean))) ops.push({ k: m[1].toLowerCase(), t: +m[2], x: m[3] });
    var rest = clean.replace(re, "").replace(/[\s,;]+/g, "");
    if (!ops.length || rest) throw new Error("use tokens like r1(x) and w2(y), separated by spaces");
    return ops;
  }
  function serial(ops) {
    var tx = [], edges = [];
    ops.forEach(function (o) { if (tx.indexOf(o.t) < 0) tx.push(o.t); });
    tx.sort(function (a, b) { return a - b; });
    for (var i = 0; i < ops.length; i++) for (var j = i + 1; j < ops.length; j++) {
      var a = ops[i], b = ops[j];
      if (a.t !== b.t && a.x === b.x && (a.k === "w" || b.k === "w")) {
        if (!edges.some(function (e) { return e[0] === a.t && e[1] === b.t; })) edges.push([a.t, b.t, a.k + a.t + "(" + a.x + ") before " + b.k + b.t + "(" + b.x + ")"]);
      }
    }
    var indeg = {}; tx.forEach(function (t) { indeg[t] = 0; });
    edges.forEach(function (e) { indeg[e[1]]++; });
    var order = [], left = tx.slice();
    while (left.length) {
      var z = left.filter(function (t) { return indeg[t] === 0; })[0];
      if (z === undefined) break;
      order.push(z); left.splice(left.indexOf(z), 1);
      edges.forEach(function (e) { if (e[0] === z) indeg[e[1]]--; });
    }
    return { tx: tx, edges: edges, ok: !left.length, order: order, stuck: left };
  }

  window.__sims = { parseProcs: parseProcs, schedule: schedule, replace: replace, matrix: matrix, banker: banker, analyze: analyze, closure: closure, parseFDs: parseFDs, indexCost: indexCost, parseSchedule: parseSchedule, serial: serial };
  if (typeof document === "undefined" || !$("sim-root")) return;

  /* ---------- DOM ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fail(el, e) { el.innerHTML = '<p class="bad">' + esc(e.message) + "</p>"; }
  function bind(id, fn) {
    var b = $(id); if (!b) return;
    var go = function () { try { fn(); } catch (e) { fail($(id + "-out"), e); } };
    b.addEventListener("click", go);
    go();
  }
  function on(id, fn) { var e = $(id); if (e) e.addEventListener("click", fn); }
  var COLORS = ["#3bff7f", "#5ccfe6", "#ffb454", "#c792ea", "#ff5f56", "#ffe66d", "#82aaff", "#f78c6c"];

  bind("sch-run", function () {
    var ps = parseProcs($("sch-in").value), algo = $("sch-algo").value, q = Math.max(1, +$("sch-q").value || 1);
    var r = schedule(ps, algo, q), end = r.segs[r.segs.length - 1].e;
    var col = {}; ps.forEach(function (p, i) { col[p.n] = COLORS[i % COLORS.length]; });
    var bar = r.segs.map(function (s) {
      var c = s.n === "idle" ? "var(--panel-2)" : col[s.n];
      return '<span class="sm__seg" style="flex:' + (s.e - s.s) + ';background:' + c + '" title="' + esc(s.n) + " " + s.s + "-" + s.e + '">' + (s.e - s.s > 1 || end < 30 ? esc(s.n === "idle" ? "" : s.n) : "") + "</span>";
    }).join("");
    var ticks = r.segs.map(function (s) { return '<span style="flex:' + (s.e - s.s) + '">' + s.s + "</span>"; }).join("");
    var tbl = '<div class="sm__tw"><table class="sm__t"><thead><tr><th>proc</th><th>arrive</th><th>burst</th><th>done</th><th>turnaround</th><th>waiting</th><th>response</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return "<tr><td>" + esc(x.n) + "</td><td>" + x.a + "</td><td>" + x.b + "</td><td>" + x.done + "</td><td>" + x.tat + "</td><td>" + x.wait + "</td><td>" + x.resp + "</td></tr>"; }).join("") +
      '<tr class="sm__avg"><td colspan="4">average</td><td>' + r.tat.toFixed(2) + "</td><td>" + r.wait.toFixed(2) + "</td><td>" + r.resp.toFixed(2) + "</td></tr></tbody></table></div>";
    $("sch-run-out").innerHTML = '<div class="sm__gantt">' + bar + '</div><div class="sm__ticks">' + ticks + '<span>' + end + "</span></div>" + tbl;
  });
  if ($("sch-algo")) $("sch-algo").addEventListener("change", function () { $("sch-qrow").hidden = this.value !== "rr"; });
  on("sch-ex", function () { $("sch-in").value = "A 0 24\nB 0 3\nC 0 3"; $("sch-algo").value = "fcfs"; $("sch-qrow").hidden = true; $("sch-run").click(); });

  bind("pg-run", function () {
    var refs = $("pg-refs").value.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (!refs.length || refs.some(function (x) { return !(x >= 0) || x % 1; }) || refs.length > 60) throw new Error("reference string: up to 60 whole numbers, e.g. 1 2 3 4 1 2 5");
    var nf = Math.max(1, Math.min(8, +$("pg-n").value || 3));
    var html = "";
    ["fifo", "lru", "opt"].forEach(function (a) {
      var r = replace(refs, nf, a);
      html += "<h3>" + a.toUpperCase() + ' <span class="muted">' + r.faults + " faults of " + refs.length + "</span></h3>";
      html += '<div class="sm__tw"><table class="sm__t sm__pg"><tbody><tr><th>ref</th>' + r.steps.map(function (s) { return "<td>" + s.ref + "</td>"; }).join("") + "</tr>";
      for (var k = 0; k < nf; k++) html += "<tr><th>f" + k + "</th>" + r.steps.map(function (s) { return "<td>" + (s.frames[k] === undefined ? "" : s.frames[k]) + "</td>"; }).join("") + "</tr>";
      html += "<tr><th>fault</th>" + r.steps.map(function (s) { return '<td class="' + (s.fault ? "bad" : "ok") + '">' + (s.fault ? "x" : "") + "</td>"; }).join("") + "</tr></tbody></table></div>";
    });
    $("pg-run-out").innerHTML = html;
  });
  on("pg-ex", function () { $("pg-refs").value = "1 2 3 4 1 2 5 1 2 3 4 5"; $("pg-n").value = 3; $("pg-run").click(); });
  on("pg-ex2", function () { $("pg-refs").value = "1 2 3 4 1 2 5 1 2 3 4 5"; $("pg-n").value = 4; $("pg-run").click(); });

  bind("bk-run", function () {
    var avail = matrix($("bk-av").value, +$("bk-m").value, "Available")[0];
    var m = +$("bk-m").value;
    var alloc = matrix($("bk-al").value, m, "Allocation"), max = matrix($("bk-mx").value, m, "Max");
    if (!avail) throw new Error("Available needs one row");
    if (alloc.length !== max.length) throw new Error("Allocation and Max need the same number of rows (one per process)");
    var req = null, rv = $("bk-rq").value.trim();
    if (rv) { var p = rv.split(/[\s,]+/).map(Number); if (p.length !== m + 1 || p.some(function (x) { return !(x >= 0) || x % 1; })) throw new Error("request: process number then " + m + " amounts"); if (p[0] >= alloc.length) throw new Error("no such process"); req = { p: p[0], v: p.slice(1) }; }
    var r = banker(alloc, max, avail, req);
    var h = '<div class="sm__tw"><table class="sm__t"><thead><tr><th>proc</th><th>allocation</th><th>max</th><th>need</th></tr></thead><tbody>' +
      alloc.map(function (a, i) { return "<tr><td>P" + i + "</td><td>" + a.join(" ") + "</td><td>" + max[i].join(" ") + "</td><td>" + r.need[i].join(" ") + "</td></tr>"; }).join("") + "</tbody></table></div>";
    var b = r.base;
    h += b.safe ? '<p class="ok">Safe state. One safe sequence: ' + b.seq.map(function (i) { return "P" + i; }).join(" &rarr; ") + "</p>" : '<p class="bad">Unsafe state: no process order lets everyone finish. Processes that could run: ' + (b.seq.length ? b.seq.map(function (i) { return "P" + i; }).join(", ") : "none") + ".</p>";
    h += "<ol class=\"sm__trace\">" + b.trace.map(function (s) { return "<li>work = (" + s.work.join(", ") + "): P" + s.p + " fits its need, finishes and returns its allocation</li>"; }).join("") + "</ol>";
    if (r.req) h += '<p class="' + (r.req.ok ? "ok" : "bad") + '">Request P' + req.p + " (" + req.v.join(", ") + "): " + (r.req.ok ? "GRANT, " : "DENY, ") + esc(r.req.why) + (r.req.s && r.req.s.safe ? ". Safe sequence: " + r.req.s.seq.map(function (i) { return "P" + i; }).join(" &rarr; ") : "") + ".</p>";
    $("bk-run-out").innerHTML = h;
  });
  on("bk-ex", function () {
    $("bk-m").value = 3; $("bk-av").value = "3 3 2"; $("bk-al").value = "0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2"; $("bk-mx").value = "7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3"; $("bk-rq").value = ""; $("bk-run").click();
  });
  on("bk-ex2", function () { $("bk-ex").click(); $("bk-rq").value = "4 3 3 0"; $("bk-run").click(); });

  bind("fd-run", function () {
    var a = analyze($("fd-in").value, $("fd-ex").value.trim().split(/[\s,]+/).filter(Boolean));
    var h = "<p>attributes: <code>" + a.attrs.join(" ") + "</code></p>";
    h += "<p>candidate keys: " + a.keys.map(function (k) { return "<code>{" + k.join(", ") + "}</code>"; }).join(" ") + "</p>";
    h += "<p>prime attributes: <code>" + (a.prime.join(" ") || "none") + "</code></p>";
    h += '<p class="ok">Highest normal form: <strong>' + a.level + "</strong> (assuming atomic values)</p>";
    var list = function (t, arr) { return arr.length ? "<p>" + t + "</p><ul>" + arr.map(function (x) { return "<li><code>" + esc(x) + "</code></li>"; }).join("") + "</ul>" : ""; };
    h += list("2NF violations (partial dependencies):", a.viol.nf2) + list("3NF violations:", a.viol.nf3) + list("BCNF violations:", a.viol.bcnf);
    var cl = $("fd-cl").value.trim().split(/[\s,]+/).filter(Boolean);
    if (cl.length) h += "<p>closure of <code>{" + cl.join(", ") + "}</code> = <code>{" + closure(cl, parseFDs($("fd-in").value).fds).join(", ") + "}</code></p>";
    $("fd-run-out").innerHTML = h;
  });
  on("fd-exa", function () { $("fd-in").value = "order_id product_id -> qty\nproduct_id -> product_name\norder_id -> customer_id\ncustomer_id -> customer_email"; $("fd-ex").value = "qty"; $("fd-run").click(); });
  on("fd-exb", function () { $("fd-in").value = "student course -> teacher\nteacher -> course"; $("fd-ex").value = ""; $("fd-run").click(); });

  bind("ix-run", function () {
    var rows = Math.pow(10, +$("ix-rows").value), k = Math.max(1, +$("ix-k").value || 1);
    var fan = Math.max(2, +$("ix-fan").value || 100), pp = Math.max(1, +$("ix-pp").value || 100);
    $("ix-rowsv").textContent = rows.toLocaleString();
    var c = indexCost(rows, fan, pp, k), mx = Math.max(c.seq, c.idx);
    $("ix-run-out").innerHTML =
      '<div class="sm__bar"><span>sequential scan</span><i style="width:' + Math.max(1, c.seq / mx * 100) + '%"></i><b>' + c.seq.toLocaleString() + " page reads</b></div>" +
      '<div class="sm__bar"><span>index lookup</span><i style="width:' + Math.max(1, c.idx / mx * 100) + '%"></i><b>' + c.idx.toLocaleString() + " page reads</b></div>" +
      "<p>B-tree height <code>" + c.height + "</code> (fanout " + fan + "), table is <code>" + c.pages.toLocaleString() + "</code> pages. A planner would pick the <strong>" + c.pick + "</strong>.</p>" +
      '<p class="muted small">Model: index cost = tree height + one heap page per matching row. Raise "rows returned" until the planner flips to a sequential scan: that is why an index on a low-selectivity column does not help.</p>';
  });
  if ($("ix-rows")) $("ix-rows").addEventListener("input", function () { $("ix-run").click(); });

  bind("tx-run", function () {
    var ops = parseSchedule($("tx-in").value), s = serial(ops);
    var h = "<p>transactions: " + s.tx.map(function (t) { return "T" + t; }).join(", ") + "</p>";
    h += s.edges.length ? "<ul>" + s.edges.map(function (e) { return "<li><code>T" + e[0] + " &rarr; T" + e[1] + "</code> <span class=\"muted\">" + esc(e[2]) + "</span></li>"; }).join("") + "</ul>" : "<p class=\"muted\">no conflicting operations, no edges</p>";
    h += s.ok ? '<p class="ok">Conflict-serializable. Equivalent serial order: ' + s.order.map(function (t) { return "T" + t; }).join(" &rarr; ") + "</p>" : '<p class="bad">Cycle in the precedence graph (' + s.stuck.map(function (t) { return "T" + t; }).join(", ") + "): NOT conflict-serializable.</p>";
    $("tx-run-out").innerHTML = h;
  });
  on("tx-exa", function () { $("tx-in").value = "r1(x) w1(x) r2(x) w2(x) r1(y) w1(y)"; $("tx-run").click(); });
  on("tx-exb", function () { $("tx-in").value = "r1(x) r2(x) w1(x) w2(x)"; $("tx-run").click(); });
  on("tx-exc", function () { $("tx-in").value = "r1(x) w2(x) w2(y) r1(y)"; $("tx-run").click(); });
})();
