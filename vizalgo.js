/* ~/cs/viz: pure algorithm recorders. Each function returns an array of frames; the UI (viz.js) only draws them.
   Also loadable from node for tests: scripts/check_viz.js */
(function (root) {
  "use strict";

  /* ---------------- sorting ---------------- */
  const SORTS = ["bubble", "selection", "insertion", "merge", "quick", "heap"];
  function sortFrames(name, input) {
    const a = input.slice(), n = a.length, frames = [], done = new Set();
    let c = 0, s = 0;
    const snap = (msg, cmp, swp) => frames.push({ a: a.slice(), cmp: cmp || null, swp: swp || null, done: [...done], c, s, msg });
    const less = (x, y) => { c++; return x < y; };
    const swap = (i, j) => { [a[i], a[j]] = [a[j], a[i]]; s++; snap(`swap positions ${i} and ${j}`, null, [i, j]); };
    snap("start: " + n + " items, comparisons and moves are counted");
    if (name === "bubble") {
      for (let i = 0; i < n - 1; i++) {
        let moved = false;
        for (let j = 0; j < n - 1 - i; j++) {
          const bad = less(a[j + 1], a[j]);
          snap(`compare ${a[j]} and ${a[j + 1]}`, [j, j + 1]);
          if (bad) { swap(j, j + 1); moved = true; }
        }
        done.add(n - 1 - i);
        if (!moved) { for (let k = 0; k < n; k++) done.add(k); break; }
      }
    } else if (name === "selection") {
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        for (let j = i + 1; j < n; j++) {
          const lt = less(a[j], a[m]);
          snap(`compare ${a[j]} with smallest so far ${a[m]}`, [j, m]);
          if (lt) m = j;
        }
        if (m !== i) swap(i, m);
        done.add(i);
      }
    } else if (name === "insertion") {
      for (let i = 1; i < n; i++) {
        let j = i;
        while (j > 0) {
          const lt = less(a[j], a[j - 1]);
          snap(`compare ${a[j]} with ${a[j - 1]}`, [j - 1, j]);
          if (!lt) break;
          swap(j - 1, j); j--;
        }
      }
    } else if (name === "merge") {
      const sort = (lo, hi) => {
        if (hi - lo < 1) return;
        const mid = lo + ((hi - lo + 1) >> 1) - 1;   // left half is floor(len/2), like merge_sort in the lab
        sort(lo, mid); sort(mid + 1, hi);
        const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        while (i < L.length && j < R.length) {
          const lt = less(R[j], L[i]);
          snap(`merge: compare ${L[i]} (left) with ${R[j]} (right)`, [lo + i, mid + 1 + j]);
          a[k] = lt ? R[j++] : L[i++]; s++; snap(`write ${a[k]} to position ${k}`, null, [k]); k++;
        }
        while (i < L.length) { a[k] = L[i++]; s++; snap(`copy rest of left: ${a[k]} to ${k}`, null, [k]); k++; }
        while (j < R.length) { a[k] = R[j++]; s++; snap(`copy rest of right: ${a[k]} to ${k}`, null, [k]); k++; }
      };
      sort(0, n - 1);
    } else if (name === "quick") {
      const qs = (lo, hi) => {
        if (lo > hi) return;
        if (lo === hi) { done.add(lo); return; }
        const p = a[hi]; let i = lo;
        snap(`pivot is ${p} (last item of positions ${lo}..${hi})`);
        for (let j = lo; j < hi; j++) {
          const lt = less(a[j], p);
          snap(`compare ${a[j]} with pivot ${p}`, [j, hi]);
          if (lt) { if (i !== j) swap(i, j); i++; }
        }
        if (i !== hi) swap(i, hi);
        done.add(i);
        qs(lo, i - 1); qs(i + 1, hi);
      };
      qs(0, n - 1);
    } else if (name === "heap") {
      const sift = (i, size) => {
        for (;;) {
          let l = 2 * i + 1, r = l + 1, m = i;
          if (l < size) { const g = less(a[m], a[l]); snap(`compare parent ${a[m]} with child ${a[l]}`, [m, l]); if (g) m = l; }
          if (r < size) { const g = less(a[m], a[r]); snap(`compare ${a[m]} with child ${a[r]}`, [m, r]); if (g) m = r; }
          if (m === i) return;
          swap(i, m); i = m;
        }
      };
      for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
      for (let e = n - 1; e > 0; e--) { swap(0, e); done.add(e); sift(0, e); }
    } else throw new Error("unknown sort " + name);
    for (let k = 0; k < n; k++) done.add(k);
    snap("sorted: " + c + " comparisons, " + s + " moves");
    return frames;
  }

  /* ---------------- graphs ---------------- */
  const GRAPH = {
    nodes: { A: [60, 120], B: [170, 40], C: [170, 200], D: [300, 60], E: [300, 190], F: [420, 120], G: [540, 60], H: [540, 190] },
    edges: [["A", "B", 2], ["A", "C", 6], ["B", "D", 3], ["B", "C", 5], ["C", "E", 4], ["D", "F", 4], ["D", "E", 7], ["E", "F", 2], ["F", "G", 2], ["F", "H", 5], ["E", "H", 8], ["G", "H", 3]],
  };
  function adj(g) {
    const m = {};
    Object.keys(g.nodes).forEach(k => (m[k] = []));
    g.edges.forEach(([u, v, w]) => { m[u].push([v, w]); m[v].push([u, w]); });
    Object.keys(m).forEach(k => m[k].sort());
    return m;
  }
  function graphFrames(name, g, src) {
    const m = adj(g), frames = [], seen = new Set(), tree = [], dist = {};
    let order = 0;
    const snap = (msg, cur, front, hi) => frames.push({ cur: cur || null, seen: [...seen], front: front ? front.slice() : [], tree: tree.map(e => e.slice()), dist: Object.assign({}, dist), hi: hi || null, msg });
    if (name === "bfs") {
      const q = [src]; seen.add(src); dist[src] = 0; snap(`start at ${src}: queue [${q}]`, src, q);
      while (q.length) {
        const u = q.shift(); snap(`take ${u} from the front of the queue`, u, q);
        for (const [v] of m[u]) if (!seen.has(v)) { seen.add(v); dist[v] = dist[u] + 1; tree.push([u, v]); q.push(v); snap(`${v} is new: ${dist[v]} hops, add to the queue`, u, q, [u, v]); }
      }
    } else if (name === "dfs") {
      const stack = [];
      const go = u => {
        seen.add(u); stack.push(u); order++; dist[u] = order; snap(`visit ${u} (visit number ${order}); stack [${stack}]`, u, stack);
        for (const [v] of m[u]) if (!seen.has(v)) { tree.push([u, v]); snap(`go deeper: ${u} to ${v}`, u, stack, [u, v]); go(v); snap(`back at ${u}`, u, stack); }
        stack.pop();
      };
      go(src);
    } else if (name === "dijkstra") {
      const best = {}; Object.keys(g.nodes).forEach(k => (best[k] = Infinity)); best[src] = 0;
      const pq = [[0, src]], parent = {}, fin = new Set();
      dist[src] = 0; snap(`start at ${src} with distance 0`, src, pq.map(x => x[1]));
      while (pq.length) {
        pq.sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : 1));
        const [d, u] = pq.shift();
        if (fin.has(u)) continue;
        fin.add(u); seen.add(u);
        if (parent[u]) tree.push([parent[u], u]);
        snap(`${u} is the closest unfinished node (distance ${d}): its distance is final`, u, pq.map(x => x[1]));
        for (const [v, w] of m[u]) {
          if (fin.has(v)) continue;
          if (d + w < best[v]) { best[v] = d + w; dist[v] = d + w; parent[v] = u; pq.push([d + w, v]); snap(`${u}-${v} costs ${w}: ${v} improves to ${d + w}`, u, pq.map(x => x[1]), [u, v]); }
          else snap(`${u}-${v} costs ${w}: ${d + w} is not better than ${best[v]}`, u, pq.map(x => x[1]), [u, v]);
        }
      }
    } else throw new Error("unknown graph algorithm " + name);
    snap("done");
    return frames;
  }

  /* ---------------- dynamic programming ---------------- */
  function dpFrames(kind, p) {
    const frames = [];
    if (kind === "coins") {
      const coins = p.coins, amt = p.amount, INF = Infinity, t = [0];
      for (let i = 1; i <= amt; i++) t.push(INF);
      const choice = new Array(amt + 1).fill(null);
      frames.push({ t: t.slice(), cell: null, deps: [], msg: `dp[x] = fewest coins that make x. dp[0] = 0, everything else starts at infinity.`, cols: amt + 1 });
      for (let x = 1; x <= amt; x++) {
        const deps = [];
        for (const c of coins) if (c <= x) { deps.push(x - c); if (t[x - c] + 1 < t[x]) { t[x] = t[x - c] + 1; choice[x] = c; } }
        frames.push({ t: t.slice(), cell: x, deps, msg: `dp[${x}] = ${t[x] === INF ? "no way" : t[x]}` + (choice[x] ? ` (last coin ${choice[x]}, from dp[${x - choice[x]}] + 1)` : ""), cols: amt + 1 });
      }
      const used = []; for (let x = amt; x > 0 && choice[x];) { used.push(choice[x]); x -= choice[x]; }
      frames.push({ t: t.slice(), cell: amt, deps: [], msg: t[amt] === INF ? "not possible" : `answer ${t[amt]}: ${used.join(" + ")}`, cols: amt + 1, answer: t[amt] });
      return frames;
    }
    const A = p.a, B = p.b, m = A.length, n = B.length;
    const T = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(null));
    const clone = () => T.map(r => r.slice());
    if (kind === "lcs") {
      for (let i = 0; i <= m; i++) T[i][0] = 0; for (let j = 0; j <= n; j++) T[0][j] = 0;
    } else { for (let i = 0; i <= m; i++) T[i][0] = i; for (let j = 0; j <= n; j++) T[0][j] = j; }
    frames.push({ T: clone(), cell: null, deps: [], msg: kind === "lcs" ? "row/column 0 = 0: an empty string shares nothing" : "row/column 0 = length: turning a string into the empty string takes that many deletes", A, B });
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      let deps, msg;
      if (kind === "lcs") {
        if (A[i - 1] === B[j - 1]) { T[i][j] = T[i - 1][j - 1] + 1; deps = [[i - 1, j - 1]]; msg = `${A[i - 1]} = ${B[j - 1]}: take the diagonal + 1 = ${T[i][j]}`; }
        else { T[i][j] = Math.max(T[i - 1][j], T[i][j - 1]); deps = [[i - 1, j], [i, j - 1]]; msg = `${A[i - 1]} != ${B[j - 1]}: max(up, left) = ${T[i][j]}`; }
      } else {
        const cost = A[i - 1] === B[j - 1] ? 0 : 1;
        T[i][j] = Math.min(T[i - 1][j] + 1, T[i][j - 1] + 1, T[i - 1][j - 1] + cost);
        deps = [[i - 1, j], [i, j - 1], [i - 1, j - 1]]; msg = `min(delete ${T[i - 1][j] + 1}, insert ${T[i][j - 1] + 1}, ${cost ? "replace" : "match"} ${T[i - 1][j - 1] + cost}) = ${T[i][j]}`;
      }
      frames.push({ T: clone(), cell: [i, j], deps, msg, A, B });
    }
    frames.push({ T: clone(), cell: [m, n], deps: [], msg: (kind === "lcs" ? "longest common subsequence length " : "edit distance ") + T[m][n], A, B, answer: T[m][n] });
    return frames;
  }

  /* ---------------- hash table ---------------- */
  const HASHES = {
    weak: k => { let h = 0; for (const ch of k) h += ch.charCodeAt(0); return h; },
    djb2: k => { let h = 5381; for (const ch of k) h = (Math.imul(h, 33) + ch.charCodeAt(0)) >>> 0; return h; },
  };
  function hashFrames(mode, hname, size, keys) {
    const H = HASHES[hname], frames = [];
    const b = Array.from({ length: size }, () => []), slots = new Array(size).fill(null);
    let coll = 0, probes = 0, count = 0;
    const snap = (msg, cur, idx, probe) => frames.push({ mode, b: b.map(x => x.slice()), slots: slots.slice(), cur, idx, probe: probe || [], coll, probes, count, size, msg });
    snap("empty table with " + size + " buckets");
    for (const k of keys) {
      const h = H(k), i = h % size;
      if (mode === "chain") {
        if (b[i].length) { coll++; snap(`${k}: hash ${h} mod ${size} = bucket ${i}, already holds ${b[i].length}: collision, add to the chain`, k, i); }
        b[i].push(k); count++;
        snap(`${k}: hash ${h} mod ${size} = bucket ${i}`, k, i);
      } else {
        if (count >= size) { snap(`${k}: table is full`, k, i); continue; }
        let j = i, tried = [];
        while (slots[j] !== null) { tried.push(j); probes++; j = (j + 1) % size; }
        if (tried.length) { coll++; snap(`${k}: hash ${h} mod ${size} = ${i}, taken. probe ${tried.concat(j).join(", ")}`, k, i, tried); }
        slots[j] = k; count++;
        snap(`${k}: stored in slot ${j}` + (tried.length ? ` after ${tried.length} extra probe${tried.length > 1 ? "s" : ""}` : ""), k, j);
      }
    }
    const longest = mode === "chain" ? Math.max(...b.map(x => x.length)) : 0;
    snap(`done: ${count} keys, load factor ${(count / size).toFixed(2)}, ${coll} collisions` + (mode === "chain" ? `, longest chain ${longest}` : `, ${probes} extra probes`));
    return frames;
  }

  /* ---------------- trees ---------------- */
  const H = n => (n ? n.h : 0);
  const fix = n => { n.h = 1 + Math.max(H(n.l), H(n.r)); return n; };
  const copy = n => (n ? { k: n.k, h: n.h, l: copy(n.l), r: copy(n.r) } : null);
  function rotR(y) { const x = y.l; y.l = x.r; x.r = y; fix(y); fix(x); return x; }
  function rotL(x) { const y = x.r; x.r = y.l; y.l = x; fix(x); fix(y); return y; }
  function treeFrames(kind, keys) {
    const frames = []; let root = null;
    const snap = (msg, hi, extra) => frames.push(Object.assign({ tree: copy(root), hi: hi || [], msg }, extra || {}));
    snap("empty tree");
    for (const k of keys) {
      const path = [];
      const ins = n => {
        if (!n) { return { k, h: 1, l: null, r: null }; }
        path.push(n.k);
        if (k === n.k) return n;
        if (k < n.k) n.l = ins(n.l); else n.r = ins(n.r);
        fix(n);
        if (kind === "avl") {
          const bal = H(n.l) - H(n.r);
          if (bal > 1) { if (k > n.l.k) { n.l = rotL(n.l); } snap(`unbalanced at ${n.k}: rotate right`, [n.k]); return rotR(n); }
          if (bal < -1) { if (k < n.r.k) { n.r = rotR(n.r); } snap(`unbalanced at ${n.k}: rotate left`, [n.k]); return rotL(n); }
        }
        return n;
      };
      const dup = (function f(n) { return n ? (n.k === k ? true : f(k < n.k ? n.l : n.r)) : false; })(root);
      if (dup) { snap(`${k} is already in the tree`, [k]); continue; }
      root = ins(root);
      snap(`insert ${k}: path ${path.length ? path.join(" > ") + " > " : ""}${k}`, [k], { height: H(root) });
    }
    snap(`done: ${keys.length} keys, height ${H(root)}`, [], { height: H(root) });
    return frames;
  }
  function inorder(n, out = []) { if (n) { inorder(n.l, out); out.push(n.k); inorder(n.r, out); } return out; }
  function preorder(n, out = []) { if (n) { out.push(n.k); preorder(n.l, out); preorder(n.r, out); } return out; }
  function postorder(n, out = []) { if (n) { postorder(n.l, out); postorder(n.r, out); out.push(n.k); } return out; }
  function levelorder(n) { const out = [], q = n ? [n] : []; while (q.length) { const x = q.shift(); out.push(x.k); if (x.l) q.push(x.l); if (x.r) q.push(x.r); } return out; }
  function walkFrames(kind, tree) {
    const order = { inorder, preorder, postorder, levelorder }[kind](tree), frames = [];
    for (let i = 0; i <= order.length; i++) frames.push({ tree, hi: order.slice(0, i), cur: order[i - 1], msg: i ? `visit ${order[i - 1]}: ${order.slice(0, i).join(" ")}` : `${kind}: start`, visited: order.slice(0, i) });
    return frames;
  }

  function heapFrames(keys, max) {
    const a = [], frames = [];
    const cmp = (x, y) => (max ? x > y : x < y);
    const snap = (msg, hi) => frames.push({ heap: a.slice(), hi: hi || [], msg });
    snap("empty " + (max ? "max" : "min") + "-heap");
    for (const k of keys) {
      a.push(k); let i = a.length - 1; snap(`add ${k} at the end (slot ${i})`, [i]);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!cmp(a[i], a[p])) break;
        [a[i], a[p]] = [a[p], a[i]]; snap(`${a[p]} ${max ? "is bigger" : "is smaller"} than its parent: swap up`, [p, i]); i = p;
      }
    }
    snap(`built: ${a.length} items, ${max ? "largest" : "smallest"} on top`);
    return frames;
  }

  const api = { sortFrames, SORTS, GRAPH, graphFrames, dpFrames, hashFrames, HASHES, treeFrames, walkFrames, heapFrames, inorder, preorder, postorder, levelorder };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.OXVIZ = api;
})(typeof window !== "undefined" ? window : globalThis);
