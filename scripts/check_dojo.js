#!/usr/bin/env node
/* Runs every ~/dojo reference solution against its own tests, through the same worker code the
   browser uses (plus the real toolchains for the self-test files). Use it after adding a kata.

     npm i --no-save pyodide@0.26.4 sql.js@1.10.3 typescript@5.4.5   # once
     node scripts/check_dojo.js [lang ...]

   Also checks that each starter does NOT already pass. gcc, python3, bash, java and pwsh are used
   for the self-test files when they're installed; missing ones are skipped. */
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), NM = path.join(process.cwd(), "node_modules");
const want = process.argv.slice(2);
const req = m => require(path.join(NM, m));

const langs = JSON.parse(execFileSync("python3", ["-c", `
import json, glob, build_dojo
out = []
for p in sorted(glob.glob("content/dojo/*.kata")):
    h, ks = build_dojo.parse(p)
    h["katas"] = ks
    out.append(h)
print(json.dumps(out))`], { cwd: ROOT }).toString());

global.document = { querySelector: () => null }; global.window = global;
require(path.join(ROOT, "dojo.js"));
const { cSource, SELF } = global.DojoTools;

function makeWorker(lang) {
  const ctx = { console, performance, TextEncoder, TextDecoder, atob, btoa, WebAssembly, JSON, Math, Promise, setTimeout, BigInt, Error, RangeError, Object, Array, String, Number, RegExp, Map, Set, Uint8Array, DataView };
  ctx.self = ctx; ctx.globalThis = ctx;
  let onmsg = null;
  ctx.postMessage = m => onmsg && onmsg(m);
  ctx.fetch = async u => ({ arrayBuffer: async () => fs.readFileSync(path.join(ROOT, "dojo", u)) });
  ctx.importScripts = u => {
    if (/pyodide/.test(u)) ctx.loadPyodide = () => req("pyodide").loadPyodide({ indexURL: path.join(NM, "pyodide") + "/" });
    else if (/sql-wasm/.test(u)) ctx.initSqlJs = () => req("sql.js")({ locateFile: f => path.join(NM, "sql.js/dist", f) });
    else if (/typescript/.test(u)) ctx.ts = req("typescript");
    else vm.runInContext(fs.readFileSync(path.join(ROOT, "dojo", u), "utf8"), ctx);
  };
  ctx.XMLHttpRequest = class { open(m, u) { this.u = u; } send() { const f = path.join(NM, "typescript/lib", this.u.replace(/^.*\//, "")); this.status = fs.existsSync(f) ? 200 : 404; this.responseText = this.status === 200 ? fs.readFileSync(f, "utf8") : ""; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "dojo/worker.js"), "utf8"), ctx);
  let seq = 0;
  const call = msg => new Promise(res => { onmsg = m => { if (m.status !== undefined) return; res(m); }; ctx.onmessage({ data: msg }); });
  return { boot: () => call({ boot: lang }), run: job => call(Object.assign({ id: ++seq, lang }, job)) };
}

const have = cmd => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;
const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "dojo-"));
function selfTest(lang, k, code) {
  const f = SELF[lang](k, code), file = path.join(TMP, f.file);
  fs.writeFileSync(file, f.text);
  let r;
  if (lang === "python") r = spawnSync("python3", [file], { encoding: "utf8", timeout: 20000 });
  else if (lang === "c") { const exe = path.join(TMP, "kata"); const c = spawnSync("gcc", ["-Wall", "-Wno-unused-variable", "-O1", "-o", exe, file, "-lm"], { encoding: "utf8" }); if (c.status) return { compile: c.stderr }; r = spawnSync(exe, [], { encoding: "utf8", timeout: 10000 }); }
  else if (lang === "bash") r = spawnSync("bash", [file], { encoding: "utf8", timeout: 10000, cwd: TMP });
  else if (lang === "java") r = spawnSync("java", [file], { encoding: "utf8", timeout: 60000, cwd: TMP });
  else if (lang === "powershell") r = spawnSync("pwsh", ["-NoProfile", "-File", file], { encoding: "utf8", timeout: 30000 });
  const lines = (r.stdout || "").split("\n");
  return { pass: lines.filter(l => l.startsWith("PASS ")).length, fail: lines.filter(l => l.startsWith("FAIL ")), out: (r.stdout || "") + (r.stderr || "") };
}
const TOOL = { python: "python3", c: "gcc", bash: "bash", java: "java", powershell: "pwsh" };

(async () => {
  let bad = 0, ok = 0;
  for (const h of langs) {
    const L = h.lang;
    if (want.length && !want.includes(L)) continue;
    console.log(`\n== ${L} (${h.katas.length} katas)`);
    const browser = (h.mode || "browser") === "browser";
    let w = null;
    if (browser) { w = makeWorker(L); const b = await w.boot(); if (!b.ready) { console.log("  runtime failed:", b.error); bad++; continue; } }
    for (const k of h.katas) {
      const probs = [];
      const n = L === "sql" ? 4 : k.tests.length + (L === "typescript" ? 1 : 0);
      if (browser) {
        const job = c => Object.assign({ code: c, tests: k.tests, support: k.support, schema: k.schema, solution: k.solution, ordered: k.ordered, ctype: k.ctype }, L === "c" ? cSource(k, c) : {});
        const r = await w.run(job(k.solution));
        const p = r.results.filter(x => x.ok).length;
        if (r.error || p !== n || r.results.length !== n) probs.push(`solution: ${p}/${n} in browser runtime${r.error ? " error=" + r.error : ""}\n${r.out}\n${r.results.filter(x => !x.ok).map(x => "    ✗ " + x.name + " // " + x.msg).join("\n")}`);
        const s = await w.run(job(k.starter));
        if (!s.error && s.results.length && s.results.every(x => x.ok)) probs.push("starter already passes every test");
      }
      if (SELF[L] && have(TOOL[L])) {
        const r = selfTest(L, k, k.solution);
        if (r.compile) probs.push("self-test does not compile:\n" + r.compile);
        else if (r.pass !== k.tests.length) probs.push(`self-test (${TOOL[L]}): ${r.pass}/${k.tests.length}\n${r.out}`);
        if (!browser) { const st = selfTest(L, k, k.starter); if (!st.compile && st.pass === k.tests.length) probs.push("starter already passes every test"); }
      } else if (SELF[L]) console.log(`  (skip ${k.id} self-test: ${TOOL[L]} not installed)`);
      if (probs.length) { bad++; console.log(`  ✗ ${k.id}\n    ` + probs.join("\n    ")); }
      else { ok++; console.log(`  ✓ ${k.id}`); }
    }
  }
  console.log(`\n${ok} ok, ${bad} broken`);
  process.exit(bad ? 1 : 0);
})();
