/* Phase 3 interactions for 0xDay: the homelab map and the attack-chain
   walkthrough. Both read inline JSON from <script id="hl-data">. The
   deep-dives page ships this file too but has no data, so we no-op there.
   No network calls, no real data: placeholder IPs and a scripted scenario. */
(function () {
  "use strict";
  var tag = document.getElementById("hl-data");
  if (!tag) return;
  var DATA, KIND;
  try { var p = JSON.parse(tag.textContent); KIND = p.kind; DATA = p.data; } catch (e) { return; }
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(name, attrs) { var e = document.createElementNS(SVGNS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  /* ===================== MAP ===================== */
  function initMap() {
    var host = document.getElementById("hl-map"); if (!host) return;
    var H = DATA, nodes = H.nodes, links = H.links, rules = H.rules;
    // hand-placed layout: x,y of each box's top-left in a 800x460 viewBox
    var POS = {
      wan: [36, 40], tailscale: [36, 150], pfsense: [250, 95], proxmox: [36, 360],
      dc01: [470, 24], ws01: [630, 24], ubuntu: [470, 108], kali: [630, 108],
      meta: [470, 192], so: [250, 300]
    };
    var W = 128, Bh = 46;
    function node(id) { for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i]; }
    function center(id) { var p = POS[id]; return [p[0] + W / 2, p[1] + Bh / 2]; }

    var s = svg("svg", { viewBox: "0 0 800 460", role: "img" });
    // lab-segment backdrop
    s.appendChild(svg("rect", { class: "hl-zone", x: 452, y: 10, width: 320, height: 232 }));
    var zl = svg("text", { class: "hl-zone-l", x: 462, y: 232 }); zl.textContent = "lab segment"; s.appendChild(zl);

    // links
    var linkEls = {};
    links.forEach(function (l) {
      var a = center(l[0]), b = center(l[1]);
      var ln = svg("line", { class: "hl-link " + l[2], x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      s.appendChild(ln); linkEls[l[0] + ">" + l[1]] = ln; linkEls[l[1] + ">" + l[0]] = ln;
    });
    // nodes
    var nodeEls = {};
    nodes.forEach(function (n) {
      var p = POS[n.id]; if (!p) return;
      var g = svg("g", { class: "hl-node z-" + n.zone, tabindex: "0", role: "button", "aria-label": n.label });
      g.appendChild(svg("rect", { x: p[0], y: p[1], width: W, height: Bh, rx: 7 }));
      var t1 = svg("text", { x: p[0] + 12, y: p[1] + 20 }); t1.textContent = n.label; g.appendChild(t1);
      var t2 = svg("text", { class: "hl-os", x: p[0] + 12, y: p[1] + 36 }); t2.textContent = n.os; g.appendChild(t2);
      g.addEventListener("click", function () { onNode(n.id); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNode(n.id); } });
      s.appendChild(g); nodeEls[n.id] = g;
    });
    host.appendChild(s);

    var panel = document.getElementById("hl-panel");
    var hint = host.parentNode.querySelector(".hl-hint");
    var mode = "explore";

    function clearHot() { for (var k in linkEls) linkEls[k].classList.remove("hot", "deny"); Object.keys(nodeEls).forEach(function (id) { nodeEls[id].classList.remove("on", "dim"); }); }

    function onNode(id) {
      if (mode === "trace") { srcSel.value = id; return; }
      clearHot();
      nodeEls[id].classList.add("on");
      var n = node(id);
      // light the links touching this node
      links.forEach(function (l) { if (l[0] === id || l[1] === id) linkEls[l[0] + ">" + l[1]].classList.add("hot"); });
      var svcs = (n.services || []).length ? '<p class="p-svc">' + n.services.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</p>" : '<p class="muted">no listening services</p>';
      var pr = (n.practice || []).length ? "<ul>" + n.practice.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "";
      var guide = n.guide ? ' <a href="learn.html#' + esc(n.guide) + '">./learn ' + esc(n.guide) + "</a>" : "";
      panel.innerHTML = '<p class="p-head">$ ssh <b>' + esc(n.label) + '</b> <span class="p-ip">' + esc(n.ip) + '</span></p>' +
        "<p>" + esc(n.role) + "</p>" + svcs +
        (pr ? '<p class="muted">practice:</p>' + pr : "") +
        (guide ? "<p>" + guide + "</p>" : "");
    }

    // trace mode
    var traceBox = host.parentNode.querySelector(".hl-trace");
    var srcSel = document.getElementById("hl-src"), dstSel = document.getElementById("hl-dst");
    nodes.forEach(function (n) {
      [srcSel, dstSel].forEach(function (sel) { var o = document.createElement("option"); o.value = n.id; o.textContent = n.label; sel.appendChild(o); });
    });
    srcSel.value = "kali"; dstSel.value = "dc01";

    function findRule(a, b) { for (var i = 0; i < rules.length; i++) if (rules[i].src === a && rules[i].dst === b) return rules[i]; return null; }

    function trace() {
      clearHot();
      var a = srcSel.value, b = dstSel.value;
      if (a === b) { panel.innerHTML = '<p class="muted">pick two different hosts.</p>'; return; }
      nodeEls[a].classList.add("on"); nodeEls[b].classList.add("on");
      var na = node(a), nb = node(b);
      // path: everything crosses pfSense, unless an endpoint IS pfsense/upstream-adjacent
      var viaPf = !(a === "pfsense" || b === "pfsense" || a === "tailscale" || b === "tailscale");
      var rule = findRule(a, b);
      var allow = rule ? rule.allow : false;
      var why = rule ? rule.why : "no rule matches this flow, so default-deny drops it";
      var seen = allow && (na.zone === "lab" || nb.zone === "lab" || na.zone === "edge" || nb.zone === "edge");
      var lines = [];
      lines.push('<p class="p-head">$ ./trace <b>' + esc(na.label) + "</b> &rarr; <b>" + esc(nb.label) + "</b></p>");
      lines.push('<p class="p-row">1  ' + esc(na.label) + "  " + esc(na.ip) + "  <span class='muted'>packet out</span></p>");
      if (viaPf) lines.push('<p class="p-row">2  pfsense  &lt;LAB_GW&gt;  <span class="' + (allow ? "p-allow" : "p-deny") + '">[' + (allow ? "ALLOW" : "BLOCK") + "]</span> " + esc(why) + "</p>");
      if (allow) {
        lines.push('<p class="p-row">' + (viaPf ? 3 : 2) + "  " + esc(nb.label) + "  " + esc(nb.ip) + '  <span class="p-allow">delivered</span></p>');
        lines.push('<p class="p-row">' + (seen ? '<span class="p-allow">security-onion:</span> captured on span0 &mdash; Zeek logs the connection' : '<span class="muted">security-onion:</span> off-segment, not mirrored') + "</p>");
      } else {
        lines.push('<p class="p-row"><span class="p-deny">dropped at pfsense</span> &mdash; ' + esc(nb.label) + " never sees it</p>");
      }
      panel.innerHTML = lines.join("");
      // light path + animate
      if (viaPf) { lightLink(a, "pfsense"); if (allow) lightLink("pfsense", b, !allow); }
      else { lightLink(a, b); }
      if (!allow) { if (linkEls[a + ">pfsense"]) linkEls[a + ">pfsense"].classList.add("deny"); }
      if (!reduced && allow) animatePacket(viaPf ? [a, "pfsense", b] : [a, b]);
    }
    function lightLink(a, b, deny) { var e = linkEls[a + ">" + b]; if (e) e.classList.add(deny ? "deny" : "hot"); }
    function animatePacket(path) {
      var pts = path.map(center);
      var dot = svg("circle", { class: "hl-pkt", r: 5, cx: pts[0][0], cy: pts[0][1] });
      s.appendChild(dot);
      var seg = 0, t0 = null, DUR = 420;
      function frame(ts) {
        if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / DUR);
        var a = pts[seg], b = pts[seg + 1];
        dot.setAttribute("cx", a[0] + (b[0] - a[0]) * k); dot.setAttribute("cy", a[1] + (b[1] - a[1]) * k);
        if (k >= 1) { seg++; t0 = null; if (seg >= pts.length - 1) { dot.remove(); return; } }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // mode toggle
    host.parentNode.querySelectorAll(".hl-toolbar .btn").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.dataset.mode;
        host.parentNode.querySelectorAll(".hl-toolbar .btn").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        traceBox.hidden = mode !== "trace";
        clearHot(); panel.innerHTML = "";
        hint.textContent = mode === "trace" ? "Pick a source and destination, then ./trace." : "Click a node to inspect it.";
        if (mode === "trace") trace();
      });
    });
    document.getElementById("hl-go").addEventListener("click", trace);
    srcSel.addEventListener("change", trace); dstSel.addEventListener("change", trace);
  }

  /* ===================== ATTACK CHAIN ===================== */
  function initChain() {
    var red = document.getElementById("hl-red"); if (!red) return;
    var blue = document.getElementById("hl-blue"), stageBox = document.getElementById("hl-stage");
    var A = DATA, stages = A.stages, cur = -1, playing = false, timer = null, typer = null;
    var dots = Array.prototype.slice.call(document.querySelectorAll(".hl-dot"));

    function paintBlueLine(l) {
      if (/\[suricata\]|\[zeek|\[windows|\[dce_rpc\]|classification/.test(l)) return '<span class="al">' + esc(l) + "</span>";
      if (/->|=|signature|highest-signal/.test(l)) return '<span class="hot">' + esc(l) + "</span>";
      return esc(l);
    }
    function render(i, instant) {
      cur = i;
      dots.forEach(function (d, j) { d.classList.toggle("on", j === i); d.classList.toggle("done", j < i); });
      var st = stages[i];
      stageBox.innerHTML = "<h3>Stage " + st.n + ": " + esc(st.name) + "</h3>" +
        '<div class="meta"><span class="att">' + esc(st.attack) + '</span><span class="sp">' + esc(st.secplus) + "</span></div>" +
        "<p>" + esc(st.takeaway) + '</p><p class="fix"><b>fix:</b> ' + esc(st.fix) + "</p>";
      if (typer) { clearInterval(typer); typer = null; }
      red.innerHTML = ""; blue.innerHTML = "";
      if (instant || reduced) {
        red.innerHTML = st.left.map(esc).join("\n");
        blue.innerHTML = st.right.map(paintBlueLine).join("\n");
        return;
      }
      // type the red pane line by line, then the blue pane
      var rl = 0, bl = 0, phase = "red";
      red.classList.add("cursor-line");
      typer = setInterval(function () {
        if (phase === "red") {
          red.innerHTML = st.left.slice(0, rl + 1).map(esc).join("\n");
          rl++;
          if (rl >= st.left.length) { phase = "blue"; red.classList.remove("cursor-line"); blue.classList.add("cursor-line"); }
        } else {
          blue.innerHTML = st.right.slice(0, bl + 1).map(paintBlueLine).join("\n");
          bl++;
          if (bl >= st.right.length) { clearInterval(typer); typer = null; blue.classList.remove("cursor-line"); if (playing) timer = setTimeout(next, 1400); }
        }
      }, phase === "red" ? 160 : 220);
    }
    function go(i) { if (i < 0 || i >= stages.length) return; render(i); }
    function next() { if (cur < stages.length - 1) render(cur + 1); else stop(); }
    function prev() { if (cur > 0) render(cur - 1); }
    function stop() { playing = false; playBtn.innerHTML = "[ ▶ play ]"; if (timer) clearTimeout(timer); }
    function play() {
      if (playing) { stop(); return; }
      playing = true; playBtn.innerHTML = "[ ■ stop ]";
      if (cur >= stages.length - 1) render(0); else render(cur);
      if (reduced) { // no typing delay drives the chain, so step on a timer
        timer = setInterval(function () { if (!playing) { clearInterval(timer); return; } if (cur < stages.length - 1) render(cur + 1); else stop(); }, 2600);
      }
    }
    var playBtn = document.getElementById("hl-play");
    playBtn.addEventListener("click", play);
    document.getElementById("hl-next").addEventListener("click", function () { stop(); next(); });
    document.getElementById("hl-prev").addEventListener("click", function () { stop(); prev(); });
    dots.forEach(function (d) { d.addEventListener("click", function () { stop(); go(+d.dataset.i); }); });
    document.addEventListener("keydown", function (e) {
      if (/input|select|textarea/i.test((e.target.tagName || ""))) return;
      if (e.key === "n") { stop(); next(); } else if (e.key === "p") { stop(); prev(); }
    });
    render(0, true);
  }

  if (KIND === "map") initMap();
  else if (KIND === "chain") initChain();
})();
