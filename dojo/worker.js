/* ~/dojo runtimes. One worker per language, so a runaway loop only takes down its own runtime.
   in:  {id, lang, code, tests, support, schema, solution, ordered}
   out: {id, out, results:[{name, ok, msg}], error, ms, ready}
   Test results come back as lines "@@PASS name" / "@@FAIL name|why" on stdout. */
const CDN = "https://cdn.jsdelivr.net/npm/";
const V = { pyodide: "0.26.4", sqljs: "1.10.3", ts: "5.4.5" };
let lang = null, rt = null;

const post = m => self.postMessage(m);
const status = s => post({ status: s });

self.onmessage = async e => {
  const job = e.data;
  if (job.boot) { lang = job.boot; try { await boot(); post({ ready: true }); } catch (err) { post({ ready: false, error: "runtime failed to load: " + (err && err.message || err) }); } return; }
  const t0 = performance.now();
  let out = "", error = null;
  const write = s => { out += s; };
  try { await boot(); await RUN[lang](job, write); }
  catch (err) { error = (err && err.message) ? err.message : String(err); }
  const results = [];
  const lines = out.split("\n").filter(l => {
    const m = l.match(/^@@(PASS|FAIL) ([^|]*)(?:\|(.*))?$/);
    if (m) { results.push({ name: m[2], ok: m[1] === "PASS", msg: m[3] || "" }); return false; }
    return true;
  });
  post({ id: job.id, out: lines.join("\n").replace(/\n+$/, ""), results, error, ms: Math.round(performance.now() - t0) });
};

async function boot() {
  if (rt) return rt;
  if (lang === "python") {
    status("loading CPython (Pyodide, ~10 MB on first run)...");
    importScripts(CDN + `pyodide@${V.pyodide}/pyodide.js`);
    rt = await loadPyodide({ indexURL: CDN + `pyodide@${V.pyodide}/` });
  } else if (lang === "c") {
    status("loading picoc.wasm...");
    importScripts("picoc-wasi.js");
    const bytes = await (await fetch("picoc.wasm")).arrayBuffer();
    rt = await WebAssembly.compile(bytes);
  } else if (lang === "sql") {
    status("loading SQLite (sql.js)...");
    importScripts(CDN + `sql.js@${V.sqljs}/dist/sql-wasm.js`);
    rt = await initSqlJs({ locateFile: f => CDN + `sql.js@${V.sqljs}/dist/${f}` });
  } else if (lang === "typescript") {
    status("loading the TypeScript compiler (~3 MB)...");
    importScripts(CDN + `typescript@${V.ts}/lib/typescript.js`);
    rt = { libs: {} };
  } else if (lang === "x86") {
    importScripts("x86.js"); rt = self.X86;
  } else rt = true;
  status("");
  return rt;
}

/* ---------- shared test wiring ---------- */
const jsStr = s => JSON.stringify(s);
function jsHarness(code, tests) {
  // runs user code, then each test in its own try/catch; deep-compares with JSON
  return `"use strict";
const __out = []; const console = { log: (...a) => __print(a.map(__fmt).join(" ")), error: (...a) => __print(a.map(__fmt).join(" ")), warn: (...a) => __print(a.map(__fmt).join(" ")) };
function __fmt(x) { return typeof x === "string" ? x : (x === undefined ? "undefined" : (typeof x === "bigint" ? x + "n" : JSON.stringify(x))); }
function __same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
${code}
;(async () => {
${tests.map(t => `  try { const __g = await (async () => (${t.expr}))(); const __w = (${t.want});
    if (__same(__g, __w)) __print("@@PASS " + ${jsStr(t.name)}); else __print("@@FAIL " + ${jsStr(t.name)} + "|got " + __fmt(__g) + ", want " + __fmt(__w)); }
  catch (e) { __print("@@FAIL " + ${jsStr(t.name)} + "|threw " + (e && e.name ? e.name + ": " : "") + (e && e.message || e)); }`).join("\n")}
})()`;
}
function runJS(src, write) {
  // the harness ends in an async IIFE; return it so we can await the tests
  return (new Function("__print", src.replace(/\n;\(async \(\) => \{/, "\nreturn (async () => {")))(s => write(s + "\n"));
}

const RUN = {
  async javascript(job, write) {
    await runJS(jsHarness(job.code + "\n" + (job.support || ""), job.tests), write);
  },

  async typescript(job, write) {
    const ts = self.ts;
    const file = "kata.ts", full = job.code + "\n" + (job.support || "");
    const opts = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, strict: true, noEmitOnError: false, lib: ["lib.es2020.d.ts"], types: [] };
    const getLib = name => {
      if (rt.libs[name] !== undefined) return rt.libs[name];
      const x = new XMLHttpRequest(); x.open("GET", CDN + `typescript@${V.ts}/lib/${name}`, false); x.send();
      return (rt.libs[name] = x.status === 200 ? x.responseText : "");
    };
    const host = {
      getSourceFile: (n, l) => { const t = n === file ? full : getLib(n.replace(/^.*\//, "")); return t || t === "" ? ts.createSourceFile(n, t, l) : undefined; },
      getDefaultLibFileName: () => "lib.es2020.d.ts", writeFile: () => {}, getCurrentDirectory: () => "/", getDirectories: () => [],
      fileExists: n => n === file || /lib\..*\.d\.ts$/.test(n), readFile: n => n === file ? full : getLib(n.replace(/^.*\//, "")),
      getCanonicalFileName: n => n, useCaseSensitiveFileNames: () => true, getNewLine: () => "\n",
    };
    status("type-checking...");
    const prog = ts.createProgram([file], opts, host);
    const diags = ts.getPreEmitDiagnostics(prog).filter(d => !d.file || d.file.fileName === file);
    status("");
    if (diags.length) {
      const lines = diags.slice(0, 8).map(d => {
        const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
        if (!d.file) return `error TS${d.code}: ${msg}`;
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        return `kata.ts(${line + 1},${character + 1}): error TS${d.code}: ${msg}`;
      });
      write(lines.join("\n") + "\n");
      write("@@FAIL tsc --strict|" + diags.length + " type error" + (diags.length > 1 ? "s" : "") + ", tests not run\n");
      return;
    }
    write("@@PASS tsc --strict\n");
    const js = ts.transpileModule(job.code + "\n" + (job.support || ""), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
    const tests = job.tests.map(t => ({ ...t, expr: ts.transpileModule("(" + t.expr + ")", { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText.trim().replace(/;$/, "") }));
    await runJS(jsHarness(js, tests), write);
  },

  async python(job, write) {
    const py = rt;
    py.setStdout({ batched: s => write(s + "\n") });
    py.setStderr({ batched: s => write(s + "\n") });
    py.globals.set("__user_code", job.code + "\n" + (job.support || ""));
    py.globals.set("__tests_json", JSON.stringify(job.tests));
    await py.runPythonAsync(`
import json as __json, traceback as __tb
__ns = {"__name__": "__main__"}
__ok = True
try:
    exec(compile(__user_code, "kata.py", "exec"), __ns)
except BaseException as __e:
    __ok = False
    print("".join(__tb.format_exception(type(__e), __e, __e.__traceback__.tb_next)).rstrip())
for __t in __json.loads(__tests_json):
    if not __ok:
        print("@@FAIL " + __t["name"] + "|not run: your code raised before the tests")
        continue
    try:
        __g = eval(__t["expr"], __ns)
        __w = eval(__t["want"], __ns)
        if __g == __w and type(__g) == type(__w) or (isinstance(__g, (int, float)) and isinstance(__w, (int, float)) and not isinstance(__g, bool) and __g == __w):
            print("@@PASS " + __t["name"])
        else:
            print("@@FAIL " + __t["name"] + "|got " + repr(__g)[:200] + ", want " + repr(__w)[:200])
    except BaseException as __e:
        print("@@FAIL " + __t["name"] + "|raised " + type(__e).__name__ + ": " + str(__e)[:200])
`);
  },

  async c(job, write) {
    // dojo.js builds the full program (checks + your code + tests) so the browser run and the gcc self-test match
    const src = job.src.replace(/\bconst\b/g, ""), lineOffset = job.offset;
    let out = "";
    let code;
    try { code = self.runPicoc(rt, src, s => { out += s; }); }
    catch (err) {
      if (err instanceof RangeError) out += "\nstack overflow: recursion too deep for the in-browser interpreter\n";
      else throw err;
      code = 139;
    }
    // map picoc's "main.c:LINE:COL" onto the user's own line numbers
    out = out.replace(/main\.c:(\d+):(\d+)/g, (m, l, c) => { const u = +l - lineOffset; return u > 0 ? `kata.c:${u}:${c}` : `harness:${l}`; });
    write(out);
    if (code) write(`\n[exit ${code}]\n`);
    const ran = (out.match(/@@(PASS|FAIL) /g) || []).length;
    for (const x of job.tests.slice(ran)) write(`@@FAIL ${x.name}|not run (program stopped early)\n`);
  },

  async sql(job, write) {
    const db = new rt.Database();
    const exec = (q) => db.exec(q);
    try {
      exec(job.schema || "");
      let got, want;
      try { got = exec(job.code); } catch (err) { write("Error: " + err.message + "\n"); write("@@FAIL query runs|" + err.message + "\n"); return; }
      const db2 = new rt.Database(); db2.exec(job.schema || ""); want = db2.exec(job.solution); db2.close();
      const last = r => r.length ? r[r.length - 1] : { columns: [], values: [] };
      const g = last(got), w = last(want);
      write(table(g) + "\n");
      write("@@PASS query runs\n");
      if (g.columns.length !== w.columns.length) write(`@@FAIL column count|got ${g.columns.length} column${g.columns.length === 1 ? "" : "s"} (${g.columns.join(", ")}), want ${w.columns.length}\n`);
      else write("@@PASS column count\n");
      const norm = r => r.values.map(row => JSON.stringify(row.map(v => typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)));
      let gr = norm(g), wr = norm(w);
      if (!job.ordered) { gr = gr.slice().sort(); wr = wr.slice().sort(); }
      if (gr.length !== wr.length) write(`@@FAIL row count|got ${gr.length} rows, want ${wr.length}\n`);
      else write("@@PASS row count\n");
      const i = gr.findIndex((r, k) => r !== wr[k]);
      if (i === -1 && gr.length === wr.length) write(`@@PASS rows match${job.ordered ? " (in order)" : ""}\n`);
      else write(`@@FAIL rows match${job.ordered ? " (in order)" : ""}|first difference at row ${i + 1}: got ${gr[i] || "nothing"}, want ${wr[i] || "nothing"}\n`);
    } finally { db.close(); }
  },

  async x86(job, write) {
    const X = rt;
    try { X.assemble(job.code); } catch (err) { write("nasm: " + err.message + "\n"); for (const t of job.tests) write(`@@FAIL ${t.name}|did not assemble\n`); return; }
    for (const t of job.tests) {
      try { const r = X.test(job.code, t.expr, t.want); write(r.ok ? `@@PASS ${t.name}\n` : `@@FAIL ${t.name}|${r.msg}\n`); if (!r.ok) write(`  regs after: ${Object.entries(r.regs).map(([k, v]) => k + "=0x" + v.toString(16)).join(" ")}\n`); }
      catch (err) { write(`@@FAIL ${t.name}|${err.message}\n`); }
    }
  },
};

function table(r) {
  if (!r.columns.length) return "(no rows)";
  const rows = [r.columns, ...r.values.slice(0, 20).map(v => v.map(x => x === null ? "NULL" : String(x)))];
  const w = r.columns.map((_, i) => Math.min(24, Math.max(...rows.map(x => x[i].length))));
  const line = x => x.map((c, i) => c.slice(0, 24).padEnd(w[i])).join(" | ");
  return [line(rows[0]), w.map(n => "-".repeat(n)).join("-+-"), ...rows.slice(1).map(line)].join("\n") + (r.values.length > 20 ? `\n... ${r.values.length - 20} more rows` : "") + `\n(${r.values.length} row${r.values.length === 1 ? "" : "s"})`;
}
