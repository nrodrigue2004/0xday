// node scripts/check_viz.js : correctness checks for the ~/cs/viz algorithm recorders (vizalgo.js)
const V = require("../vizalgo.js");
const assert = require("assert");
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (const name of V.SORTS) {
  for (const n of [1, 2, 5, 17, 40]) {
    const arr = Array.from({ length: n }, () => Math.floor(rnd() * 30));
    const f = V.sortFrames(name, arr), last = f[f.length - 1];
    assert.deepStrictEqual(last.a, arr.slice().sort((x, y) => x - y), `${name} n=${n}`);
    assert.strictEqual(last.done.length, n);
  }
}
const rev = Array.from({ length: 200 }, (_, i) => 200 - i);
assert.strictEqual(V.sortFrames("insertion", rev).slice(-1)[0].c, 19900);
assert.strictEqual(V.sortFrames("merge", rev).slice(-1)[0].c, 812);
const g = f => f.slice(-1)[0];
assert.deepStrictEqual(g(V.graphFrames("bfs", V.GRAPH, "A")).dist, { A: 0, B: 1, C: 1, D: 2, E: 2, F: 3, G: 4, H: 3 });
const dj = g(V.graphFrames("dijkstra", V.GRAPH, "A")).dist;
assert.deepStrictEqual(dj, { A: 0, B: 2, C: 6, D: 5, E: 10, F: 9, G: 11, H: 14 });
assert.strictEqual(g(V.graphFrames("dfs", V.GRAPH, "A")).seen.length, 8);
assert.strictEqual(g(V.dpFrames("coins", { coins: [1, 5, 12, 19], amount: 15 })).answer, 3);
assert.strictEqual(g(V.dpFrames("coins", { coins: [1, 5, 12, 19], amount: 24 })).answer, 2);
assert.strictEqual(g(V.dpFrames("lcs", { a: "ABCBDAB", b: "BDCABA" })).answer, 4);
assert.strictEqual(g(V.dpFrames("edit", { a: "kitten", b: "sitting" })).answer, 3);
const ws = "srv-a1 srv-1a srv-a2 srv-2a web-01 db-main log-01 mail-02 vpn-01 app-77 srv-a1x x1a-srv".split(" ");
assert.ok(g(V.hashFrames("chain", "weak", 8, ws)).msg.includes("longest chain 6"));
assert.ok(g(V.hashFrames("probe", "djb2", 16, ws)).count === 12);
const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
assert.strictEqual(g(V.treeFrames("bst", keys)).height, 12);
assert.strictEqual(g(V.treeFrames("avl", keys)).height, 4);
const t = g(V.treeFrames("avl", [5, 3, 8, 1, 4, 7, 9])).tree;
assert.deepStrictEqual(V.inorder(t), [1, 3, 4, 5, 7, 8, 9]);
assert.deepStrictEqual(V.levelorder(t), [5, 3, 8, 1, 4, 7, 9]);
assert.deepStrictEqual(g(V.heapFrames([5, 3, 8, 1, 9, 2], false)).heap[0], 1);
assert.deepStrictEqual(g(V.heapFrames([5, 3, 8, 1, 9, 2], true)).heap[0], 9);
console.log("viz ok");
