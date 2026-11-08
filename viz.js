/* ~/cs/viz: draws the frames recorded by vizalgo.js. Tabs: sort, graph, dp, hash, tree. */
(function () {
  "use strict";
  const V = window.OXVIZ, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  if (!V || !$("#viz")) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NS = "http://www.w3.org/2000/svg";

  /* playback controller shared by every tab */
  function Player(root, draw) {
    const P = { frames: [], i: 0, timer: null };
    const bar = $(".vz__bar", root), msg = $(".vz__msg", root), step = $(".vz__step", root), speed = $(".vz__speed", root);
    const show = () => { const f = P.frames[P.i]; if (!f) return; draw(f, P.i); msg.textContent = f.msg || ""; step.textContent = `step ${P.i + 1}/${P.frames.length}`; };
    const stop = () => { clearInterval(P.timer); P.timer = null; $(".vz__play", root).textContent = "[ play ]"; };
    const go = d => { P.i = Math.max(0, Math.min(P.frames.length - 1, P.i + d)); show(); if (P.i >= P.frames.length - 1) stop(); };
    const play = () => {
      if (P.timer) return stop();
      if (P.i >= P.frames.length - 1) P.i = 0;
      $(".vz__play", root).textContent = "[ pause ]";
      const tick = () => { go(1); };
      const ms = () => Math.max(15, 700 / Math.pow(1.5, +speed.value));
      P.timer = setInterval(tick, ms());
      speed.oninput = () => { if (P.timer) { clearInterval(P.timer); P.timer = setInterval(tick, ms()); } };
    };
    $(".vz__play", root).onclick = play;
    $(".vz__next", root).onclick = () => { stop(); go(1); };
    $(".vz__prev", root).onclick = () => { stop(); go(-1); };
    $(".vz__first", root).onclick = () => { stop(); P.i = 0; show(); };
    $(".vz__last", root).onclick = () => { stop(); P.i = P.frames.length - 1; show(); };
    P.set = fr => { stop(); P.frames = fr; P.i = 0; show(); };
    return P;
  }
  const controls = `<div class="vz__bar"><button class="btn vz__first" type="button" aria-label="first">|&lt;</button><button class="btn vz__prev" type="button">[ &lt; ]</button><button class="btn vz__play" type="button">[ play ]</button><button class="btn vz__next" type="button">[ &gt; ]</button><button class="btn vz__last" type="button" aria-label="last">&gt;|</button><label class="muted small">speed <input class="vz__speed" type="range" min="0" max="8" value="3"></label><span class="vz__step muted small"></span></div><p class="vz__msg" aria-live="polite"></p>`;
  const opt = (arr, sel) => arr.map(([v, l]) => `<option value="${v}"${v === sel ? " selected" : ""}>${esc(l)}</option>`).join("");
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  /* ---------- sort ---------- */
  function sortTab(root) {
    root.innerHTML = `<div class="vz__opts"><label>algorithm <select id="s-alg">${opt([["bubble", "bubble"], ["selection", "selection"], ["insertion", "insertion"], ["merge", "merge sort"], ["quick", "quicksort (last item pivot)"], ["heap", "heapsort"]], "insertion")}</select></label>
<label>input <select id="s-kind">${opt([["random", "random"], ["reversed", "reversed"], ["sorted", "already sorted"], ["nearly", "nearly sorted"], ["few", "few unique"]], "random")}</select></label>
<label>n <input id="s-n" type="range" min="5" max="40" value="20"> <span id="s-nv">20</span></label><button class="btn" id="s-new" type="button">[ new data ]</button></div>
<div class="vz__counts"><span>comparisons <b id="s-c">0</b></span><span>moves <b id="s-m">0</b></span></div>
<div class="vz__bars" id="s-bars" role="img" aria-label="array shown as bars"></div>${controls}`;
    let data = [];
    const make = () => {
      const n = +$("#s-n").value, k = $("#s-kind").value;
      let a = Array.from({ length: n }, (_, i) => i + 1);
      if (k === "random") a.sort(() => rnd() - .5);
      else if (k === "reversed") a.reverse();
      else if (k === "nearly") { for (let i = 0; i < Math.max(1, n / 8); i++) { const x = Math.floor(rnd() * n), y = Math.floor(rnd() * n); [a[x], a[y]] = [a[y], a[x]]; } }
      else if (k === "few") a = a.map(() => 1 + Math.floor(rnd() * 4) * 3);
      data = a; run();
    };
    const P = Player(root, f => {
      const max = Math.max(...f.a);
      $("#s-bars").innerHTML = f.a.map((v, i) => `<i class="${f.swp && f.swp.includes(i) ? "sw" : f.cmp && f.cmp.includes(i) ? "cm" : f.done.includes(i) ? "ok" : ""}" style="height:${(v / max * 100).toFixed(1)}%"></i>`).join("");
      $("#s-c").textContent = f.c; $("#s-m").textContent = f.s;
    });
    const run = () => P.set(V.sortFrames($("#s-alg").value, data));
    $("#s-alg").onchange = run; $("#s-kind").onchange = make; $("#s-new").onclick = make;
    $("#s-n").oninput = () => { $("#s-nv").textContent = $("#s-n").value; make(); };
    make();
  }

  /* ---------- graph ---------- */
  function graphTab(root) {
    const G = V.GRAPH;
    root.innerHTML = `<div class="vz__opts"><label>algorithm <select id="g-alg">${opt([["bfs", "BFS (queue)"], ["dfs", "DFS (stack)"], ["dijkstra", "Dijkstra (weights)"]], "bfs")}</select></label><label>start <select id="g-src">${opt(Object.keys(G.nodes).map(k => [k, k]), "A")}</select></label></div>
<svg class="vz__svg" id="g-svg" viewBox="0 0 600 250" role="img" aria-label="graph"></svg>${controls}
<p class="muted small">Node label: BFS shows hops, DFS the visit number, Dijkstra the best distance known. Green = finished, amber = current, cyan = waiting in the queue/stack.</p>`;
    const P = Player(root, f => {
      const svg = $("#g-svg"); let h = "";
      G.edges.forEach(([u, v, w]) => {
        const [x1, y1] = G.nodes[u], [x2, y2] = G.nodes[v];
        const t = f.tree.some(e => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)), hi = f.hi && ((f.hi[0] === u && f.hi[1] === v) || (f.hi[0] === v && f.hi[1] === u));
        h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${hi ? "hi" : t ? "tr" : ""}"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 5}" class="w">${w}</text>`;
      });
      Object.entries(G.nodes).forEach(([k, [x, y]]) => {
        const cls = f.cur === k ? "cur" : f.seen.includes(k) ? "ok" : f.front.includes(k) ? "q" : "";
        h += `<g class="${cls}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 4}" class="n">${k}</text>${f.dist[k] !== undefined ? `<text x="${x}" y="${y - 24}" class="d">${f.dist[k]}</text>` : ""}</g>`;
      });
      svg.innerHTML = h;
    });
    const run = () => P.set(V.graphFrames($("#g-alg").value, G, $("#g-src").value));
    $("#g-alg").onchange = run; $("#g-src").onchange = run; run();
  }

  /* ---------- dp ---------- */
  function dpTab(root) {
    root.innerHTML = `<div class="vz__opts"><label>problem <select id="d-k">${opt([["coins", "coin change (fewest coins)"], ["lcs", "longest common subsequence"], ["edit", "edit distance"]], "coins")}</select></label>
<span id="d-in"></span></div><div class="vz__tw"><table class="vz__tbl" id="d-t"></table></div>${controls}`;
    const inputs = () => {
      const k = $("#d-k").value;
      $("#d-in").innerHTML = k === "coins" ? `<label>coins <input id="d-a" value="1,5,12,19" size="10"></label> <label>amount <input id="d-b" value="15" size="3"></label>`
        : `<label>A <input id="d-a" value="${k === "lcs" ? "ABCBDAB" : "kitten"}" size="9"></label> <label>B <input id="d-b" value="${k === "lcs" ? "BDCABA" : "sitting"}" size="9"></label>`;
      $$("#d-in input").forEach(i => (i.onchange = run)); run();
    };
    const P = Player(root, f => {
      const t = $("#d-t");
      if (f.t) {
        const cell = i => `<td class="${f.cell === i ? "cur" : f.deps.includes(i) ? "dep" : ""}">${f.t[i] === Infinity ? "∞" : f.t[i]}</td>`;
        t.innerHTML = `<tr><th>x</th>${f.t.map((_, i) => `<th>${i}</th>`).join("")}</tr><tr><th>dp[x]</th>${f.t.map((_, i) => cell(i)).join("")}</tr>`;
      } else {
        const A = f.A, B = f.B;
        const isDep = (i, j) => f.deps.some(d => d[0] === i && d[1] === j);
        t.innerHTML = `<tr><th></th><th></th>${[...B].map(c => `<th>${esc(c)}</th>`).join("")}</tr>` +
          f.T.map((r, i) => `<tr><th>${i ? esc(A[i - 1]) : ""}</th>${r.map((v, j) => `<td class="${f.cell && f.cell[0] === i && f.cell[1] === j ? "cur" : isDep(i, j) ? "dep" : ""}">${v === null ? "" : v}</td>`).join("")}</tr>`).join("");
      }
    });
    function run() {
      const k = $("#d-k").value, a = $("#d-a").value, b = $("#d-b").value;
      if (k === "coins") {
        const coins = a.split(/[ ,]+/).map(Number).filter(x => x > 0 && isFinite(x)), amount = Math.min(60, Math.max(1, parseInt(b) || 1));
        P.set(V.dpFrames("coins", { coins: coins.length ? coins : [1], amount }));
      } else P.set(V.dpFrames(k, { a: a.slice(0, 12), b: b.slice(0, 12) }));
    }
    $("#d-k").onchange = inputs; inputs();
  }

  /* ---------- hash ---------- */
  function hashTab(root) {
    root.innerHTML = `<div class="vz__opts"><label>collisions <select id="h-m">${opt([["chain", "chaining"], ["probe", "linear probing"]], "chain")}</select></label>
<label>hash function <select id="h-f">${opt([["weak", "weak: sum of characters"], ["djb2", "djb2: mixes position"]], "weak")}</select></label>
<label>buckets <select id="h-s">${opt([["8", "8"], ["16", "16"], ["13", "13 (prime)"]], "8")}</select></label></div>
<label class="small">keys <input id="h-k" size="60" value="srv-a1 srv-1a srv-a2 srv-2a web-01 db-main log-01 mail-02 vpn-01 app-77 srv-a1x x1a-srv"></label>
<div class="vz__counts"><span>collisions <b id="h-c">0</b></span><span>load factor <b id="h-l">0</b></span></div><div id="h-t" class="vz__hash"></div>${controls}
<p class="muted small">Same keys, two hash functions: the weak one ignores character order, so anagrams always collide. Probing wraps around at the end of the table.</p>`;
    const P = Player(root, f => {
      $("#h-c").textContent = f.coll; $("#h-l").textContent = (f.count / f.size).toFixed(2);
      let h = "";
      for (let i = 0; i < f.size; i++) {
        const cells = f.mode === "chain" ? f.b[i].map(k => `<span class="${k === f.cur ? "cur" : ""}">${esc(k)}</span>`).join("") : (f.slots[i] ? `<span class="${i === f.idx && f.slots[i] === f.cur ? "cur" : ""}">${esc(f.slots[i])}</span>` : "");
        h += `<div class="${(f.idx === i && f.mode === "chain") || f.probe.includes(i) ? "hot" : ""}"><b>${i}</b>${cells}</div>`;
      }
      $("#h-t").innerHTML = h;
    });
    const run = () => P.set(V.hashFrames($("#h-m").value, $("#h-f").value, +$("#h-s").value, $("#h-k").value.split(/[\s,]+/).filter(Boolean).slice(0, 30)));
    ["h-m", "h-f", "h-s"].forEach(i => ($("#" + i).onchange = run)); $("#h-k").onchange = run; run();
  }

  /* ---------- tree ---------- */
  function layout(t) {
    const pos = new Map(); let x = 0, maxd = 0;
    (function walk(n, d) { if (!n) return; walk(n.l, d + 1); pos.set(n.k, [x++, d]); maxd = Math.max(maxd, d); walk(n.r, d + 1); })(t, 0);
    return { pos, w: Math.max(1, x), d: maxd + 1 };
  }
  function drawTree(svg, t, hi, cur) {
    const L = layout(t), W = Math.max(300, L.w * 38 + 20), Hh = Math.max(120, L.d * 56 + 20);
    svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    const P = k => { const [i, d] = L.pos.get(k); return [20 + i * 38, 28 + d * 56]; };
    let h = "";
    (function edges(n) { if (!n) return; [n.l, n.r].forEach(c => { if (c) { const [x1, y1] = P(n.k), [x2, y2] = P(c.k); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; edges(c); } }); })(t);
    L.pos.forEach((_, k) => { const [x, y] = P(k); h += `<g class="${cur === k ? "cur" : hi.includes(k) ? "ok" : ""}"><circle cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y + 4}" class="n">${k}</text></g>`; });
    svg.innerHTML = h;
  }
  function treeTab(root) {
    root.innerHTML = `<div class="vz__opts"><label>structure <select id="t-k">${opt([["bst", "binary search tree"], ["avl", "AVL (self-balancing)"], ["minheap", "min-heap"], ["maxheap", "max-heap"]], "bst")}</select></label>
<label>input <select id="t-in">${opt([["sorted", "1..12 in order"], ["mixed", "50 30 70 20 40 60 80"], ["custom", "custom"]], "mixed")}</select></label>
<input id="t-c" size="30" value="8 3 10 1 6 14 4 7 13" aria-label="custom keys"></div>
<div class="vz__counts"><span>height <b id="t-h">0</b></span></div><svg class="vz__svg vz__svg--tree" id="t-svg" role="img" aria-label="tree"></svg><pre id="t-arr" class="vz__arr"></pre>${controls}
<div class="vz__opts" id="t-walk"><span class="muted small">walk the finished tree:</span> ${["inorder", "preorder", "postorder", "levelorder"].map(k => `<button class="btn" type="button" data-w="${k}">${k}</button>`).join(" ")}</div>`;
    let last = null;
    const P = Player(root, f => {
      const arr = $("#t-arr");
      if (f.heap) {
        const t = fromHeap(f.heap); drawTree($("#t-svg"), t, [], null);
        $$("#t-svg g", root).forEach(g => { if (f.hi.includes(+g.textContent)) g.classList.add("ok"); });
        arr.textContent = "array: [" + f.heap.join(", ") + "]"; $("#t-h").textContent = f.heap.length ? Math.floor(Math.log2(f.heap.length)) + 1 : 0;
      } else {
        drawTree($("#t-svg"), f.tree, f.hi || [], f.cur); arr.textContent = f.visited ? "order: " + f.visited.join(" ") : ""; if (f.height !== undefined) $("#t-h").textContent = f.height;
      }
      last = f;
    });
    function fromHeap(a) { const mk = i => (i < a.length ? { k: a[i], l: mk(2 * i + 1), r: mk(2 * i + 2) } : null); return mk(0); }
    const keys = () => { const v = $("#t-in").value; return (v === "sorted" ? "1 2 3 4 5 6 7 8 9 10 11 12" : v === "mixed" ? "50 30 70 20 40 60 80" : $("#t-c").value).split(/[\s,]+/).map(Number).filter(x => isFinite(x)).slice(0, 24); };
    const run = () => {
      const k = $("#t-k").value, ks = keys().filter((x, i, a) => a.indexOf(x) === i);
      $("#t-walk").hidden = k.endsWith("heap");
      P.set(k.endsWith("heap") ? V.heapFrames(ks, k === "maxheap") : V.treeFrames(k, ks));
    };
    ["t-k", "t-in"].forEach(i => ($("#" + i).onchange = run)); $("#t-c").onchange = () => { $("#t-in").value = "custom"; run(); };
    $$("[data-w]", root).forEach(b => (b.onclick = () => { const fin = P.frames[P.frames.length - 1]; if (fin && fin.tree) { P.set(V.walkFrames(b.dataset.w, fin.tree)); } }));
    run();
  }

  const tabs = { sort: sortTab, graph: graphTab, dp: dpTab, hash: hashTab, tree: treeTab };
  const built = {};
  function open(name) {
    $$(".vz__tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    $$(".vz__panel").forEach(p => (p.hidden = p.dataset.tab !== name));
    if (!built[name]) { built[name] = 1; tabs[name]($(`.vz__panel[data-tab="${name}"]`)); }
    try { history.replaceState(null, "", "#" + name); } catch (e) { }
  }
  $$(".vz__tab").forEach(b => b.addEventListener("click", () => open(b.dataset.tab)));
  const h = location.hash.slice(1);
  open(tabs[h] ? h : "sort");
})();
