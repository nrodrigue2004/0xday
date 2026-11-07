/* ~/dojo: kata runner UI. Pages: dojo.html (index, #dojo-index) and dojo/<lang>.html (#dojo-data). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const KEY = "oxday-dojo", DAYS = "oxday-dojo-days";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  };
  const prog = () => store.get(KEY, {});
  function mark(id, patch) {
    const p = prog(); p[id] = Object.assign(p[id] || {}, patch); store.set(KEY, p);
    if (patch.s) { const d = store.get(DAYS, []); if (!d.includes(today())) { d.push(today()); store.set(DAYS, d.slice(-400)); } }
  }
  function streak() {
    const d = new Set(store.get(DAYS, [])); let n = 0; const t = new Date();
    if (!d.has(today())) t.setUTCDate(t.getUTCDate() - 1);
    while (d.has(t.toISOString().slice(0, 10))) { n++; t.setUTCDate(t.getUTCDate() - 1); }
    return n;
  }
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* ----- C source (shared by the browser run and the gcc self-test) ----- */
  const CTYPE = { int: "eq_int", uint: "eq_hex", hex: "eq_hex", str: "eq_str", dbl: "eq_dbl", char: "eq_chr" };
  const cstr = s => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const C_PRE = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
static int pass_ = 0, total_ = 0;
void eq_int(const char *n, int g, int w) { total_++; if (g == w) { pass_++; printf("@@PASS %s\\n", n); } else printf("@@FAIL %s|got %d, want %d\\n", n, g, w); }
void eq_hex(const char *n, unsigned int g, unsigned int w) { total_++; if (g == w) { pass_++; printf("@@PASS %s\\n", n); } else printf("@@FAIL %s|got 0x%08x, want 0x%08x\\n", n, g, w); }
void eq_chr(const char *n, char g, char w) { total_++; if (g == w) { pass_++; printf("@@PASS %s\\n", n); } else printf("@@FAIL %s|got '%c', want '%c'\\n", n, g, w); }
void eq_dbl(const char *n, double g, double w) { total_++; if (fabs(g - w) < 0.000001) { pass_++; printf("@@PASS %s\\n", n); } else printf("@@FAIL %s|got %f, want %f\\n", n, g, w); }
void eq_str(const char *n, const char *g, const char *w) { total_++; if (g == NULL) { printf("@@FAIL %s|got NULL, want \\"%s\\"\\n", n, w); return; } if (strcmp(g, w) == 0) { pass_++; printf("@@PASS %s\\n", n); } else printf("@@FAIL %s|got \\"%s\\", want \\"%s\\"\\n", n, g, w); }
/* ---- your code ---- */
`;
  function cSource(k, code) {
    const fn = CTYPE[k.ctype || "int"] || "eq_int";
    const user = code.replace(/^[ \t]*#include[ \t]*<[^>]+>[ \t]*$/gm, "");
    const main = `\n/* ---- tests ---- */\nint main(void) {\n${k.tests.map(t => `    ${fn}(${cstr(t.name)}, ${t.expr}, ${t.want});`).join("\n")}\n    printf("kata ${k.id}: %d/%d passed\\n", pass_, total_);\n    return pass_ == total_ ? 0 : 1;\n}\n`;
    return { src: C_PRE + user + "\n" + (k.support || "") + main, offset: C_PRE.split("\n").length - 1 };
  }

  /* ----- self-test files for running katas on your own machine ----- */
  const shq = s => "'" + s.replace(/'/g, "'\\''") + "'";
  const ansi = s => "$'" + s.replace(/\\(?!n|t)/g, "\\\\").replace(/'/g, "\\'") + "'";
  const psq = s => '"' + s.replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$").replace(/\\n/g, "`n").replace(/\\t/g, "`t") + '"';
  const SELF = {
    python: (k, code) => ({
      file: `kata_${k.id.replace(/-/g, "_")}.py`, cmd: `python3 kata_${k.id.replace(/-/g, "_")}.py`,
      text: `# ~/dojo/python/${k.id} self-test. Run: python3 kata_${k.id.replace(/-/g, "_")}.py\n${code}\n${k.support ? "\n# ---- kata helpers ----\n" + k.support + "\n" : ""}\n# ---- tests ----\nif __name__ == "__main__":\n    _p = 0\n    _tests = [\n${k.tests.map(t => `        (${JSON.stringify(t.name)}, lambda: ${t.expr}, lambda: ${t.want}),`).join("\n")}\n    ]\n    for _n, _g, _w in _tests:\n        try:\n            g, w = _g(), _w()\n            ok = g == w\n        except Exception as e:\n            g, w, ok = f"raised {type(e).__name__}: {e}", "no exception", False\n        print(("PASS " if ok else "FAIL ") + _n + ("" if ok else f": got {g!r}, want {w!r}"))\n        _p += ok\n    print(f"kata ${k.id}: {_p}/{len(_tests)} passed")\n`,
    }),
    c: (k, code) => ({ file: `kata_${k.id.replace(/-/g, "_")}.c`, cmd: `gcc -Wall -O1 -o kata kata_${k.id.replace(/-/g, "_")}.c -lm && ./kata`, text: cSource(k, code).src.replace(/@@PASS /g, "PASS ").replace(/@@FAIL %s\|/g, "FAIL %s: ") }),
    bash: (k, code) => ({
      file: `kata_${k.id.replace(/-/g, "_")}.sh`, cmd: `bash kata_${k.id.replace(/-/g, "_")}.sh`,
      text: `#!/usr/bin/env bash\n# ~/dojo/bash/${k.id} self-test. Run: bash kata_${k.id.replace(/-/g, "_")}.sh\n\n# ---- your code ----\n${code}\n${k.support ? "\n# ---- kata helpers ----\n" + k.support + "\n" : ""}\n# ---- tests ----\n__pass=0; __n=0\n__t() { local name=$1 want=$2 got; got=$(eval "$3" 2>&1); __n=$((__n+1))\n  if [[ "$got" == "$want" ]]; then __pass=$((__pass+1)); echo "PASS $name"; else echo "FAIL $name: got '$got', want '$want'"; fi; }\n${k.tests.map(t => `__t ${shq(t.name)} ${ansi(t.want)} ${shq(t.expr)}`).join("\n")}\necho "kata ${k.id}: $__pass/$__n passed"\n`,
    }),
    powershell: (k, code) => ({
      file: `kata_${k.id.replace(/-/g, "_")}.ps1`, cmd: `pwsh ./kata_${k.id.replace(/-/g, "_")}.ps1`,
      text: `# ~/dojo/powershell/${k.id} self-test. Run: pwsh ./kata_${k.id.replace(/-/g, "_")}.ps1   (or powershell -File on Windows)\n\n# ---- your code ----\n${code}\n${k.support ? "\n# ---- kata helpers ----\n" + k.support + "\n" : ""}\n# ---- tests ----\n$script:__pass = 0; $script:__n = 0\nfunction __t([string]$name, [string]$want, [scriptblock]$expr) {\n  $script:__n++\n  try { $got = ((& $expr) | Out-String).TrimEnd() -replace "\`r\`n", "\`n" } catch { $got = "threw: $_" }\n  if ($got -ceq $want) { $script:__pass++; "PASS $name" } else { "FAIL \${name}: got '$got', want '$want'" }\n}\n${k.tests.map(t => `__t ${psq(t.name)} ${psq(t.want)} { ${t.expr} }`).join("\n")}\n"kata ${k.id}: $script:__pass/$script:__n passed"\n`,
    }),
    java: (k, code) => {
      const imports = (code.match(/^\s*import\s+[\w.*]+\s*;\s*$/gm) || []).map(s => s.trim());
      const body = code.replace(/^\s*import\s+[\w.*]+\s*;\s*$/gm, "").trim();
      return {
        file: "Main.java", cmd: "java Main.java   # Java 11+",
        text: `// ~/dojo/java/${k.id} self-test. Run: java Main.java   (Java 11+, no javac step needed)\nimport java.util.*;\nimport java.util.function.*;\n${[...new Set(imports)].filter(i => !/^import java\.util\.(\*|function\.\*);$/.test(i)).join("\n")}\n\npublic class Main {\n    static int pass = 0, n = 0;\n    static String show(Object o) {\n        if (o instanceof int[]) return Arrays.toString((int[]) o);\n        if (o instanceof long[]) return Arrays.toString((long[]) o);\n        if (o instanceof char[]) return Arrays.toString((char[]) o);\n        if (o instanceof byte[]) return Arrays.toString((byte[]) o);\n        if (o instanceof Object[]) return Arrays.deepToString((Object[]) o);\n        if (o instanceof String) return "\\"" + o + "\\"";\n        return String.valueOf(o);\n    }\n    static void t(String name, Supplier<Object> got, Object want) {\n        n++;\n        try {\n            Object g = got.get();\n            if (Objects.deepEquals(g, want)) { pass++; System.out.println("PASS " + name); }\n            else System.out.println("FAIL " + name + ": got " + show(g) + ", want " + show(want));\n        } catch (Throwable e) { System.out.println("FAIL " + name + ": threw " + e); }\n    }\n    public static void main(String[] args) {\n${k.tests.map(t => `        t(${JSON.stringify(t.name)}, () -> ${t.expr}, ${t.want});`).join("\n")}\n        System.out.println("kata ${k.id}: " + pass + "/" + n + " passed");\n    }\n}\n\n// ---- your code ----\n${body}\n${k.support ? "\n// ---- kata helpers ----\n" + k.support + "\n" : ""}`,
      };
    },
  };

  // exported for scripts/check_dojo.js, which runs every reference solution against its tests
  (typeof window !== "undefined" ? window : globalThis).DojoTools = { cSource, SELF };

  /* ---------------- index page ---------------- */
  const idx = $("#dojo-index");
  if (idx) {
    const langs = JSON.parse(idx.textContent), p = prog();
    document.querySelectorAll(".dj__lang").forEach(a => {
      const L = a.dataset.lang, n = Object.keys(p).filter(k => k.startsWith(L + "/") && p[k].s).length;
      a.querySelector(".dj__solved").textContent = n;
      if (n && n === +a.dataset.total) a.classList.add("dj__lang--done");
    });
    const all = langs.flatMap(l => l.katas.map(k => ({ ...k, lang: l.lang, name: l.name })));
    const open = all.filter(k => !(p[k.lang + "/" + k.id] || {}).s);
    const pool = open.length ? open : all;
    if (pool.length) {
      const k = pool[hash(today()) % pool.length], belt = ["", "white", "yellow", "green", "brown", "black"][k.level];
      $(".dj__pick").innerHTML = `<a href="dojo/${esc(k.lang)}.html#${esc(k.id)}">${esc(k.lang)}/${esc(k.id)}</a> <span class="muted">// ${esc(k.title)}, ${belt} belt</span>`;
      $(".dj__today").hidden = false;
    }
    const s = streak(), solved = Object.values(p).filter(x => x.s).length;
    if (solved) { const el = $(".dj__streak"); el.textContent = `${solved} solved in this browser · streak: ${s} day${s === 1 ? "" : "s"}`; el.hidden = false; }
    return;
  }

  /* ---------------- language page ---------------- */
  const dataEl = $("#dojo-data");
  if (!dataEl) return;
  const D = JSON.parse(dataEl.textContent), L = D.lang, LOCAL = D.mode === "local";
  const byId = Object.fromEntries(D.katas.map(k => [k.id, k]));
  const TIMEOUT = { python: 15000, typescript: 20000 }[L] || 6000;

  /* ----- worker (one per page, restarted on timeout) ----- */
  let worker = null, booted = null, seq = 0;
  const pending = new Map();
  let statusCb = () => { };
  function spawn() {
    worker = new Worker("worker.js");
    worker.onmessage = e => {
      const m = e.data;
      if (m.status !== undefined) { statusCb(m.status); return; }
      if (m.ready !== undefined) { const r = booted._res; r(m); return; }
      const cb = pending.get(m.id); if (cb) { pending.delete(m.id); cb(m); }
    };
    worker.onerror = e => { e.preventDefault(); for (const [, cb] of pending) cb({ error: "worker crashed: " + (e.message || "unknown"), results: [], out: "" }); pending.clear(); };
    let res; booted = new Promise(r => (res = r)); booted._res = res;
    worker.postMessage({ boot: L });
  }
  async function run(job) {
    if (!worker) spawn();
    const b = await booted;
    if (!b.ready) { worker.terminate(); worker = null; return { error: b.error, results: [], out: "" }; }
    return new Promise(resolve => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id); worker.terminate(); worker = null;
        resolve({ error: `killed after ${TIMEOUT / 1000}s: infinite loop, or something very slow`, results: [], out: "", killed: true });
      }, TIMEOUT);
      pending.set(id, m => { clearTimeout(timer); resolve(m); });
      worker.postMessage(Object.assign({ id, lang: L }, job));
    });
  }

  /* ----- per-kata UI ----- */
  const STAT = { none: ["[ ]", "not solved"], solved: ["[x]", "solved"], assisted: ["[x]", "solved after viewing the solution"], peeked: ["[~]", "solution viewed"] };
  const stateOf = id => { const x = prog()[L + "/" + id] || {}; return x.s ? (x.p ? "assisted" : "solved") : x.p ? "peeked" : "none"; };
  function paintStatus(li) {
    const st = stateOf(li.id), [t, label] = STAT[st];
    const el = li.querySelector(".kata__st"); el.textContent = t; el.setAttribute("aria-label", label); li.dataset.state = st;
  }
  function paintProgress() {
    const n = D.katas.filter(k => /solved|assisted/.test(stateOf(k.id))).length, total = D.katas.length, w = 20, on = Math.round(n / total * w);
    $(".dj__bar").innerHTML = `<span class="bar__on">${"█".repeat(on)}</span><span class="bar__off">${"░".repeat(w - on)}</span>`;
    $(".dj__count").textContent = `${n}/${total} solved` + (n === total ? " · belt earned" : "");
  }

  const draftKey = id => `oxday-dojo-code:${L}/${id}`;
  function build(li) {
    const k = byId[li.id], body = li.querySelector(".kata__body");
    if (body.dataset.built) return;
    body.dataset.built = "1";
    let draft = null; try { draft = localStorage.getItem(draftKey(k.id)); } catch (e) { }
    const self = SELF[L];
    const wrap = document.createElement("div");
    wrap.className = "kata__work";
    wrap.innerHTML = `
<div class="kata__edwrap"><div class="kata__edbar"><span>${esc(LOCAL ? (self ? self(k, "").file : "kata") : "kata." + (D.ext || L))}</span><span class="muted kata__saved"></span></div>
<textarea class="kata__ed" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="code editor for ${esc(k.title)}"></textarea></div>
<div class="kata__btns">
  ${LOCAL ? `<button class="btn kata__copy" type="button">[ copy self-test ]</button><button class="btn kata__dl" type="button">[ download ]</button>`
            : `<button class="btn kata__run" type="button">[ ./test ]</button>`}
  <button class="btn kata__hint" type="button"${k.hints.length ? "" : " disabled"}>[ hint ${k.hints.length ? "0/" + k.hints.length : "-"} ]</button>
  <button class="btn kata__reset" type="button">[ reset ]</button>
  <button class="btn kata__sol" type="button" disabled title="unlocks after your first attempt">[ solution ]</button>
  ${!LOCAL && self ? `<button class="btn kata__copy" type="button" title="run it with the real toolchain on your machine">[ self-test ]</button>` : ""}
</div>
<ol class="kata__hints"></ol>
${LOCAL ? `<div class="kata__local"><p class="small muted">This one runs on your own machine: copy the self-test, save it, then <code class="kata__cmd"></code>. Paste the output below to log the result.</p>
<textarea class="kata__paste" spellcheck="false" placeholder="paste the self-test output here" aria-label="paste self-test output"></textarea></div>` : ""}
<pre class="kata__out" aria-live="polite" hidden></pre>
<div class="kata__solbox" hidden><p class="cmd">cat solution.${esc(D.ext || L)}</p><pre class="kata__solcode"></pre><button class="btn kata__load" type="button">[ load into editor ]</button></div>`;
    body.append(wrap);
    const ed = wrap.querySelector(".kata__ed"), out = wrap.querySelector(".kata__out");
    ed.value = draft !== null ? draft : k.starter;
    const fit = () => { ed.style.height = "auto"; ed.style.height = Math.max(160, Math.min(560, ed.scrollHeight + 4)) + "px"; };
    fit();
    let saveT; ed.addEventListener("input", () => { fit(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(draftKey(k.id), ed.value); wrap.querySelector(".kata__saved").textContent = "saved"; } catch (e) { } }, 400); wrap.querySelector(".kata__saved").textContent = "modified"; });
    editorKeys(ed, () => (LOCAL ? null : test()));
    const solBtn = wrap.querySelector(".kata__sol");
    const unlockSol = () => { solBtn.disabled = false; solBtn.title = ""; };
    if ((prog()[L + "/" + k.id] || {}).a) unlockSol();

    async function test() {
      const runBtn = wrap.querySelector(".kata__run");
      if (runBtn.disabled) return;
      runBtn.disabled = true; runBtn.textContent = "[ running... ]";
      out.hidden = false; out.className = "kata__out";
      statusCb = s => { if (s) out.innerHTML = `<span class="muted">${esc(s)}</span>`; };
      out.innerHTML = `<span class="muted">$ ${esc(D.run || "run")}</span>`;
      const job = { code: ed.value, tests: k.tests, support: k.support, schema: k.schema, solution: k.solution, ordered: k.ordered, ctype: k.ctype };
      if (L === "c") Object.assign(job, cSource(k, ed.value));
      const r = await run(job);
      runBtn.disabled = false; runBtn.textContent = "[ ./test ]";
      mark(L + "/" + k.id, { a: 1 }); unlockSol();
      render(r);
    }
    function render(r) {
      const pass = r.results.filter(x => x.ok).length, total = r.results.length;
      let h = `<span class="muted">$ ${esc(D.run || "run")}</span>\n`;
      if (r.out) h += esc(r.out) + "\n";
      if (r.error) h += `<span class="bad">${esc(r.error)}</span>\n`;
      for (const x of r.results) h += x.ok ? `<span class="ok">  ✓ ${esc(x.name)}</span>\n` : `<span class="bad">  ✗ ${esc(x.name)}</span>${x.msg ? `<span class="muted"> // ${esc(x.msg)}</span>` : ""}\n`;
      const all = total > 0 && pass === total && !r.error;
      h += `\n${all ? '<span class="ok">' : '<span class="bad">'}${pass}/${total} passed</span>${r.ms !== undefined ? `<span class="muted"> in ${r.ms} ms</span>` : ""}`;
      if (all) h += `  <span class="ok">[ kata complete ]</span>`;
      out.innerHTML = h; out.classList.toggle("kata__out--ok", all);
      if (all) { mark(L + "/" + k.id, { s: 1, d: today() }); paintStatus(li); paintProgress(); }
    }

    if (!LOCAL) wrap.querySelector(".kata__run").addEventListener("click", test);
    let hinted = 0;
    wrap.querySelector(".kata__hint").addEventListener("click", e => {
      if (hinted >= k.hints.length) return;
      const item = document.createElement("li"); item.innerHTML = esc(k.hints[hinted]).replace(/`([^`]+)`/g, "<code>$1</code>");
      wrap.querySelector(".kata__hints").append(item); hinted++;
      e.currentTarget.textContent = `[ hint ${hinted}/${k.hints.length} ]`;
      if (hinted >= k.hints.length) e.currentTarget.disabled = true;
    });
    wrap.querySelector(".kata__reset").addEventListener("click", e => {
      const b = e.currentTarget;
      if (b.dataset.arm) { ed.value = k.starter; fit(); try { localStorage.removeItem(draftKey(k.id)); } catch (x) { } b.textContent = "[ reset ]"; delete b.dataset.arm; wrap.querySelector(".kata__saved").textContent = ""; return; }
      b.dataset.arm = "1"; b.textContent = "[ wipe code? y/N ]"; setTimeout(() => { b.textContent = "[ reset ]"; delete b.dataset.arm; }, 3000);
    });
    solBtn.addEventListener("click", e => {
      const b = e.currentTarget, box = wrap.querySelector(".kata__solbox");
      if (!box.hidden) { box.hidden = true; b.textContent = "[ solution ]"; return; }
      if (!b.dataset.arm) { b.dataset.arm = "1"; b.textContent = "[ spoil it? y/N ]"; setTimeout(() => { if (box.hidden) { b.textContent = "[ solution ]"; delete b.dataset.arm; } }, 3000); return; }
      delete b.dataset.arm; b.textContent = "[ hide solution ]";
      wrap.querySelector(".kata__solcode").textContent = k.solution; box.hidden = false;
      mark(L + "/" + k.id, { p: 1 }); paintStatus(li);
    });
    wrap.querySelector(".kata__load").addEventListener("click", () => { ed.value = k.solution; fit(); ed.dispatchEvent(new Event("input")); });

    if (self) {
      const copyBtns = wrap.querySelectorAll(".kata__copy");
      const file = () => self(k, ed.value);
      if (LOCAL) wrap.querySelector(".kata__cmd").textContent = file().cmd;
      copyBtns.forEach(b => b.addEventListener("click", async () => {
        const f = file(); let ok = false;
        try { await navigator.clipboard.writeText(f.text); ok = true; } catch (e) { }
        out.hidden = false; out.className = "kata__out";
        out.innerHTML = ok ? `<span class="ok">copied ${esc(f.file)}</span> <span class="muted">// save it, then run:</span>\n$ ${esc(f.cmd)}` : `<span class="muted">clipboard blocked, here it is:</span>\n${esc(f.text)}`;
        mark(L + "/" + k.id, { a: 1 }); unlockSol();
      }));
      const dl = wrap.querySelector(".kata__dl");
      if (dl) dl.addEventListener("click", () => {
        const f = file(), a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([f.text], { type: "text/plain" })); a.download = f.file; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); mark(L + "/" + k.id, { a: 1 }); unlockSol();
      });
      const paste = wrap.querySelector(".kata__paste");
      if (paste) paste.addEventListener("input", () => {
        const lines = paste.value.split(/\r?\n/), results = [];
        for (const l of lines) { const m = l.match(/^(PASS|FAIL) (.*?)(?:: (.*))?$/); if (m && k.tests.some(t => t.name === m[2])) results.push({ ok: m[1] === "PASS", name: m[2], msg: m[3] || "" }); }
        if (!results.length) { out.hidden = false; out.innerHTML = `<span class="muted">no PASS/FAIL lines for this kata yet</span>`; return; }
        const missing = k.tests.filter(t => !results.some(r => r.name === t.name)).map(t => ({ ok: false, name: t.name, msg: "not in the pasted output" }));
        render({ results: results.concat(missing), out: "" });
      });
    }
  }

  function editorKeys(ed, onRun) {
    const IND = L === "powershell" || L === "javascript" || L === "typescript" || L === "sql" || L === "bash" ? "  " : "    ";
    ed.addEventListener("keydown", e => {
      if (e.key === "Escape") { ed.blur(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); onRun && onRun(); return; }
      const s = ed.selectionStart, t = ed.selectionEnd, v = ed.value;
      if (e.key === "Tab") {
        e.preventDefault();
        const ls = v.lastIndexOf("\n", s - 1) + 1;
        if (e.shiftKey) {
          const strip = v.slice(ls).match(new RegExp("^( {1," + IND.length + "}|\\t)"));
          if (strip) { ed.setRangeText("", ls, ls + strip[0].length, "end"); ed.selectionStart = ed.selectionEnd = Math.max(ls, s - strip[0].length); }
        } else if (s !== t && v.slice(s, t).includes("\n")) {
          const block = v.slice(ls, t).replace(/^/gm, IND); ed.setRangeText(block, ls, t, "select");
        } else ed.setRangeText(IND, s, t, "end");
        ed.dispatchEvent(new Event("input")); return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s), cur = line.match(/^[ \t]*/)[0];
        const extra = /[:{\[(]\s*$/.test(line) || (L === "x86" && /^\s*[\w.]+:\s*$/.test(line)) ? IND : "";
        e.preventDefault(); ed.setRangeText("\n" + cur + extra, s, t, "end"); ed.dispatchEvent(new Event("input"));
      }
    });
  }

  document.querySelectorAll(".kata").forEach(li => {
    paintStatus(li);
    const head = li.querySelector(".kata__head"), body = li.querySelector(".kata__body");
    head.addEventListener("click", () => {
      const open = body.hidden; body.hidden = !open; head.setAttribute("aria-expanded", String(open)); li.classList.toggle("kata--open", open);
      if (open) { build(li); history.replaceState(null, "", "#" + li.id); }
    });
  });
  paintProgress();
  function openHash() {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && target.classList.contains("kata")) {
      if (!target.classList.contains("kata--open")) target.querySelector(".kata__head").click();
      target.scrollIntoView({ block: "start" });
    }
  }
  openHash();
  addEventListener("hashchange", openHash);
  // warm the runtime once someone opens a kata (Pyodide is big)
  if (!LOCAL) document.querySelector(".katas").addEventListener("click", () => { if (!worker) spawn(); }, { once: true });
})();
