/* 0xDay sandbox: an in-page fake shell for the hands-on labs on ~/learn pages.
   Lab data lives in <script type="application/json" id="lab-data"> (built from content/guides/*.txt).
   Everything runs in the browser. Nothing is sent anywhere. */
(function () {
  const dataEl = document.getElementById("lab-data"), el = document.getElementById("sandbox");
  if (!dataEl || !el) return;
  const LAB = JSON.parse(dataEl.textContent);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const USER = LAB.user || "student", HOST = LAB.host || "lab", HOME = "/home/" + USER;
  let FS, cwd, hintN, hist = [], hi = 0, sqlMode = null;
  function reset() {
    FS = {}; for (const [p, c] of Object.entries(LAB.fs || {})) FS[norm(p)] = c;
    cwd = LAB.cwd || HOME; hintN = 0; sqlMode = null;
  }

  /* ---------- paths ---------- */
  function norm(p, base) {
    if (!p) return base || cwd;
    if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
    else if (!p.startsWith("/")) p = (base || cwd) + "/" + p;
    const out = [];
    for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
    return "/" + out.join("/");
  }
  const isFile = p => Object.prototype.hasOwnProperty.call(FS, p);
  const isDir = p => p === "/" || Object.keys(FS).some(f => f.startsWith(p + "/"));
  function kids(d) {
    const pre = d === "/" ? "/" : d + "/", s = new Map();
    for (const f of Object.keys(FS)) if (f.startsWith(pre)) { const rest = f.slice(pre.length), n = rest.split("/")[0]; s.set(n, rest.includes("/")); }
    return [...s.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  const short = p => (p === HOME ? "~" : p.startsWith(HOME + "/") ? "~" + p.slice(HOME.length) : p);
  function read(p, cmd) {
    const a = norm(p);
    if (isFile(a)) return FS[a];
    throw new Error(`${cmd}: ${p}: ${isDir(a) ? "Is a directory" : "No such file or directory"}`);
  }
  function glob(arg) {
    if (!/[*?]/.test(arg)) return [arg];
    const a = norm(arg), re = new RegExp("^" + a.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
    const m = Object.keys(FS).filter(f => re.test(f)).sort();
    return m.length ? m.map(f => (arg.startsWith("/") || arg.startsWith("~") ? f : f.startsWith(cwd + "/") ? f.slice(cwd.length + 1) : f)) : [arg];
  }

  /* ---------- tokenizer: quotes, pipes, redirects, ; and && ---------- */
  function tokenize(line) {
    const t = []; let cur = "", q = null, has = false;
    const push = () => { if (has) t.push(cur); cur = ""; has = false; };
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && /["\\$]/.test(line[i + 1])) cur += line[++i]; else cur += c; continue; }
      if (c === "'" || c === '"') { q = c; has = true; continue; }
      if (c === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
      if (/\s/.test(c)) { push(); continue; }
      if (c === "|" || c === ";" || c === ">" || c === "&") {
        push();
        if (c === ">" && line[i + 1] === ">") { t.push({ op: ">>" }); i++; }
        else if (c === "&" && line[i + 1] === "&") { t.push({ op: "&&" }); i++; }
        else if (c === "|" && line[i + 1] === "|") { t.push({ op: "||" }); i++; }
        else t.push({ op: c });
        continue;
      }
      cur += c; has = true;
    }
    if (q) throw new Error("syntax error: unclosed quote");
    push(); return t;
  }

  /* ---------- text helpers ---------- */
  const lines = s => { const L = s.split("\n"); if (L.length && L[L.length - 1] === "") L.pop(); return L; };
  const join = L => (L.length ? L.join("\n") + "\n" : "");
  function flags(args, withVal = "") {
    const f = {}, rest = []; let stop = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (stop || !/^-[^-\d]|^--\w/.test(a)) { rest.push(a); continue; }
      if (a === "--") { stop = true; continue; }
      if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); f[k] = v ?? true; continue; }
      for (let j = 1; j < a.length; j++) {
        const k = a[j];
        if (withVal.includes(k)) { f[k] = a.slice(j + 1) || args[++i]; break; }
        f[k] = true;
      }
    }
    return [f, rest];
  }
  function trSet(s) {
    s = s.replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, " \t\n").replace(/\\n/g, "\n");
    let o = "";
    for (let i = 0; i < s.length; i++) {
      if (s[i + 1] === "-" && i + 2 < s.length) { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) o += String.fromCharCode(c); i += 2; }
      else o += s[i];
    }
    return o;
  }
  const b64d = s => { const b = atob(s.replace(/\s+/g, "")); try { return decodeURIComponent(escape(b)); } catch (e) { return b; } };
  const b64e = s => btoa(unescape(encodeURIComponent(s)));
  async function sha(algo, s) {
    const b = await crypto.subtle.digest(algo, new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  const normAns = s => String(s).trim().toLowerCase().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");

  /* ---------- awk (a useful subset) ---------- */
  function awk(prog, input, F) {
    const split = l => (F ? l.split(F.length === 1 ? F : new RegExp(F)) : l.trim().split(/\s+/));
    const rules = []; let m, src = prog.trim();
    const R = /^(BEGIN|END|[^{]*)\{([^}]*)\}\s*/;
    while (src && (m = src.match(R))) { rules.push({ pat: m[1].trim(), act: m[2].trim() }); src = src.slice(m[0].length); }
    if (src) rules.push({ pat: src, act: "print" });
    const V = {}, out = [];
    const val = (tok, f, NR) => {
      tok = tok.trim();
      if (/^\$\d+$/.test(tok)) { const n = +tok.slice(1); return n === 0 ? f.line : f[n - 1] ?? ""; }
      if (tok === "$NF") return f[f.length - 1] ?? "";
      if (tok === "NF") return f.length; if (tok === "NR") return NR;
      if (/^".*"$/.test(tok)) return tok.slice(1, -1).replace(/\\t/g, "\t").replace(/\\n/g, "\n");
      if (/^-?\d+(\.\d+)?$/.test(tok)) return +tok;
      if (/^[a-zA-Z_]\w*$/.test(tok)) return V[tok] ?? "";
      throw new Error("awk: this sandbox's awk doesn't understand `" + tok + "`");
    };
    const expr = (e, f, NR) => {  // juxtaposition = concatenation
      const toks = e.match(/"(?:[^"\\]|\\.)*"|\$NF|\$\d+|[A-Za-z_]\w*|-?\d+(?:\.\d+)?/g) || [];
      return toks.map(t => val(t, f, NR)).join("");
    };
    const test = (pat, f, NR) => {
      if (!pat) return true;
      return pat.split("&&").every(p => {
        p = p.trim(); let neg = false;
        if (p.startsWith("!")) { neg = true; p = p.slice(1).trim(); }
        let r;
        if ((m = p.match(/^\/(.*)\/$/))) r = new RegExp(m[1]).test(f.line);
        else if ((m = p.match(/^(\S+)\s*(!?~)\s*\/(.*)\/$/))) r = new RegExp(m[3]).test(String(val(m[1], f, NR))) === (m[2] === "~");
        else if ((m = p.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(\S+)$/))) {
          let a = val(m[1], f, NR), b = val(m[3], f, NR);
          if (!isNaN(a) && !isNaN(b) && a !== "" && b !== "") { a = +a; b = +b; }
          r = { "==": a == b, "!=": a != b, ">": a > b, "<": a < b, ">=": a >= b, "<=": a <= b }[m[2]];
        } else throw new Error("awk: unsupported pattern `" + p + "`");
        return neg ? !r : r;
      });
    };
    const act = (a, f, NR) => {
      for (let s of a.split(";")) {
        s = s.trim(); if (!s) continue;
        if (s === "print") out.push(f.line);
        else if ((m = s.match(/^print\s+(.*)$/))) out.push(m[1].split(",").map(x => expr(x, f, NR)).join(" "));
        else if ((m = s.match(/^([A-Za-z_]\w*)\s*\+=\s*(.+)$/))) V[m[1]] = (+V[m[1]] || 0) + (+expr(m[2], f, NR) || 0);
        else if ((m = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) V[m[1]] = expr(m[2], f, NR);
        else if ((m = s.match(/^([A-Za-z_]\w*)\+\+$/))) V[m[1]] = (+V[m[1]] || 0) + 1;
        else throw new Error("awk: unsupported action `" + s + "`");
      }
    };
    const empty = Object.assign([], { line: "" });
    rules.filter(r => r.pat === "BEGIN").forEach(r => act(r.act, empty, 0));
    let NR = 0;
    for (const l of lines(input)) {
      NR++; const f = Object.assign(split(l), { line: l });
      for (const r of rules) if (r.pat !== "BEGIN" && r.pat !== "END" && test(r.pat, f, NR)) act(r.act, f, NR);
    }
    rules.filter(r => r.pat === "END").forEach(r => act(r.act, empty, NR));
    return join(out);
  }

  /* ---------- builtins: (args, stdin) -> stdout string. throw Error for stderr ---------- */
  const inputs = (files, stdin, cmd) => (files.length ? files.map(f => read(f, cmd)).join("") : stdin);
  const B = {
    help: () => `<b>lab commands</b>
  brief            re-read the challenge        hint        get the next hint
  submit &lt;answer&gt;  check your answer             reset       restore the lab files
  solution         walkthrough (after solving)  clear       clear the screen
<b>shell</b>
  ls cd pwd cat head tail grep wc sort uniq cut awk sed tr find file strings nano
  base64 xxd rev nl tee echo sha256sum ipcalc whoami hostname id date uname history
  pipes (|), redirects (&gt; &gt;&gt;), ; &amp;&amp; ||, $VAR, $(cmd), $((math)),
  for/while/if one-liners and bash script.sh all work.${LAB.cmdnames && LAB.cmdnames.length ? "\n<b>lab tools</b>\n  " + LAB.cmdnames.join("  ") : ""}${LAB.js ? "\n  node &lt;file.js&gt; | node -e '&lt;code&gt;'   runs real JavaScript" : ""}${LAB.sql ? "\n  sqlite3 &lt;db&gt; [\"SQL\"]   runs real SQLite" : ""}${LAB.py ? "\n  python3 &lt;file.py&gt; | python3 -c '&lt;code&gt;'   runs real Python (Pyodide)" : ""}
Tip: every <b>▶</b> button in the guide types that example in here.\n`,
    pwd: () => cwd + "\n",
    whoami: () => USER + "\n", hostname: () => HOST + "\n",
    id: () => `uid=1000(${USER}) gid=1000(${USER}) groups=1000(${USER})\n`,
    uname: a => (a.includes("-a") ? `Linux ${HOST} 6.8.0-0xday #1 SMP x86_64 GNU/Linux\n` : "Linux\n"),
    date: () => new Date().toUTCString() + "\n",
    echo: (a) => { let n = false; if (a[0] === "-n") { n = true; a = a.slice(1); } if (a[0] === "-e") a = a.slice(1); return a.join(" ").replace(/\\n/g, "\n").replace(/\\t/g, "\t") + (n ? "" : "\n"); },
    history: () => hist.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n") + "\n",
    cd: a => { const d = norm(a[0] || "~"); if (isFile(d)) throw new Error(`cd: ${a[0]}: Not a directory`); if (!isDir(d)) throw new Error(`cd: ${a[0]}: No such file or directory`); cwd = d; return ""; },
    ls: a => {
      const [f, rest] = flags(a); const targets = rest.length ? rest : ["."]; const o = [], plain = [];
      for (const t of targets) {
        const p = norm(t);
        if (isFile(p)) { o.push(f.l ? lsl(t, FS[p]) : t); plain.push(o[o.length - 1]); continue; }
        if (!isDir(p)) throw new Error(`ls: cannot access '${t}': No such file or directory`);
        if (targets.length > 1) o.push(t + ":");
        const k = kids(p).filter(([n]) => f.a || !n.startsWith("."));
        if (f.l) { const L = ["total " + k.length, ...k.map(([n, d]) => (d ? `drwxr-xr-x 2 ${USER} ${USER}  4096 Nov  7 09:00 <b>${esc(n)}/</b>` : lsl(n, FS[p === "/" ? "/" + n : p + "/" + n])))]; o.push(...L); plain.push(...L); }
        else { o.push(k.map(([n, d]) => (d ? `<b>${esc(n)}/</b>` : esc(n))).join("  ")); plain.push(...k.map(([n]) => n)); }
      }
      return { html: o.join("\n") + "\n", text: join(plain.map(x => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))) };
    },
    cat: (a, i) => { const [f, files] = flags(a); const s = inputs(files.flatMap(glob), i, "cat"); return f.n ? join(lines(s).map((l, k) => `${String(k + 1).padStart(6)}\t${l}`)) : s; },
    head: (a, i) => { const [f, files] = flags(a.map(x => (/^-\d+$/.test(x) ? "-n" + x.slice(1) : x)), "nc"); return join(lines(inputs(files.flatMap(glob), i, "head")).slice(0, +(f.n || 10))); },
    tail: (a, i) => {
      const [f, files] = flags(a.map(x => (/^-\d+$/.test(x) ? "-n" + x.slice(1) : x)), "n"); const L = lines(inputs(files.flatMap(glob), i, "tail")); const n = f.n || "10";
      return join(String(n).startsWith("+") ? L.slice(+n.slice(1) - 1) : L.slice(-+n));
    },
    wc: (a, i) => {
      const [f, files0] = flags(a); const files = files0.flatMap(glob);
      const cnt = s => [lines(s).length, (s.match(/\S+/g) || []).length, new TextEncoder().encode(s).length];
      const fmt = (c, n) => { const parts = f.l || f.w || f.c ? [f.l && c[0], f.w && c[1], f.c && c[2]].filter(x => x !== false && x !== undefined) : c; return parts.map(x => (files.length ? String(x).padStart(5) : x)).join(" ") + (n ? " " + n : ""); };
      if (!files.length) return fmt(cnt(i)) + "\n";
      const rows = files.map(n => [cnt(read(n, "wc")), n]), tot = rows.reduce((t, [c]) => t.map((x, k) => x + c[k]), [0, 0, 0]);
      return join(rows.map(([c, n]) => fmt(c, n)).concat(files.length > 1 ? [fmt(tot, "total")] : []));
    },
    grep: (a, i) => {
      const [f, rest] = flags(a, "e"); const pat = f.e ?? rest.shift();
      if (pat === undefined) throw new Error("usage: grep [-ivcnoEFrlhw] PATTERN [FILE...]");
      let src = f.F ? pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : f.E ? pat : pat.replace(/\\\|/g, "|");
      if (f.w) src = `\\b(?:${src})\\b`;
      const re = new RegExp(src, f.i ? "i" : "");
      let files = rest.flatMap(glob);
      if (f.r || f.R) files = (files.length ? files : ["."]).flatMap(p => { const d = norm(p); return isFile(d) ? [p] : Object.keys(FS).filter(x => x.startsWith(d === "/" ? "/" : d + "/")).sort().map(x => (x.startsWith(cwd + "/") ? x.slice(cwd.length + 1) : x)); });
      const multi = (files.length > 1 || f.r || f.R) && !f.h, o = []; let total = 0;
      const srcs = files.length ? files.map(n => [n, read(n, "grep")]) : [["(stdin)", i]];
      for (const [name, s] of srcs) {
        let c = 0;
        lines(s).forEach((l, k) => {
          const hit = re.test(l) !== !!f.v; if (!hit) return; c++;
          if (f.c || f.l || f.q) return;
          const pre = (multi ? name + ":" : "") + (f.n ? k + 1 + ":" : "");
          if (f.o && !f.v) (l.match(new RegExp(re.source, re.flags + "g")) || []).forEach(x => o.push(pre + x)); else o.push(pre + l);
        });
        total += c;
        if (f.c) o.push((multi ? name + ":" : "") + c);
        if (f.l && c) o.push(name);
      }
      if (!total && !f.c) return { out: "", code: 1 };
      return f.q ? "" : join(o);
    },
    sort: (a, i) => {
      const [f, files] = flags(a, "kt"); let L = lines(inputs(files, i, "sort"));
      const key = l => { if (!f.k) return l; const k = parseInt(f.k, 10) - 1; const parts = f.t ? l.split(f.t) : l.trim().split(/\s+/); return parts.slice(k).join(f.t || " "); };
      const num = s => parseFloat(s) || 0;
      L.sort((x, y) => { const a1 = key(x), b1 = key(y); return f.n ? num(a1) - num(b1) : f.f ? a1.toLowerCase().localeCompare(b1.toLowerCase()) : a1 < b1 ? -1 : a1 > b1 ? 1 : 0; });
      if (f.r) L.reverse();
      if (f.u) L = L.filter((l, k) => k === 0 || l !== L[k - 1]);
      return join(L);
    },
    uniq: (a, i) => {
      const [f, files] = flags(a); const L = lines(inputs(files, i, "uniq")), o = [];
      for (const l of L) { const last = o[o.length - 1]; if (last && last[0] === l) last[1]++; else o.push([l, 1]); }
      return join(o.filter(([, c]) => (f.d ? c > 1 : f.u ? c === 1 : true)).map(([l, c]) => (f.c ? `${String(c).padStart(7)} ${l}` : l)));
    },
    cut: (a, i) => {
      const [f, files] = flags(a, "dfc"); const d = f.d ?? "\t";
      const spec = String(f.f || f.c || "").split(",").map(r => { const [x, y] = r.split("-"); return [x ? +x : 1, y === undefined ? +x : y === "" ? 1e9 : +y]; });
      const pick = arr => arr.filter((_, k) => spec.some(([x, y]) => k + 1 >= x && k + 1 <= y));
      return join(lines(inputs(files, i, "cut")).map(l => (f.c ? pick([...l]).join("") : l.includes(d) ? pick(l.split(d)).join(d) : l)));
    },
    awk: (a, i) => {
      const [f, rest] = flags(a, "F"); const prog = rest.shift();
      if (!prog) throw new Error("usage: awk [-F sep] 'program' [file]");
      return awk(prog, inputs(rest, i, "awk"), f.F === "\\t" ? "\t" : f.F);
    },
    sed: (a, i) => {
      const [f, rest] = flags(a); const prog = rest.shift() || ""; let L = lines(inputs(rest, i, "sed")); let m;
      if ((m = prog.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/))) {
        const re = new RegExp(m[2], m[4].includes("i") ? (m[4].includes("g") ? "gi" : "i") : m[4].includes("g") ? "g" : "");
        return join(L.map(l => l.replace(re, m[3].replace(/\\(\d)/g, "$$$1").replace(/&/g, "$$&"))));
      }
      if ((m = prog.match(/^\/(.*)\/(p|d)$/))) { const re = new RegExp(m[1]); return join(m[2] === "d" ? L.filter(l => !re.test(l)) : f.n ? L.filter(l => re.test(l)) : L.flatMap(l => (re.test(l) ? [l, l] : [l]))); }
      if ((m = prog.match(/^(\d+)(?:,(\d+))?p$/))) return join(L.slice(+m[1] - 1, m[2] ? +m[2] : +m[1]));
      throw new Error("sed: this sandbox supports s/re/rep/g, /re/p, /re/d and N,Mp");
    },
    tr: (a, i) => {
      const [f, rest] = flags(a);
      if (f.d) { const s = trSet(rest[0]); return [...i].filter(c => !s.includes(c)).join(""); }
      const x = trSet(rest[0] || ""), y = trSet(rest[1] || "");
      let o = [...i].map(c => { const k = x.indexOf(c); return k < 0 ? c : y[Math.min(k, y.length - 1)] ?? c; }).join("");
      if (f.s) o = o.replace(new RegExp(`([${y.replace(/[\]\\^-]/g, "\\$&")}])\\1+`, "g"), "$1");
      return o;
    },
    rev: (a, i) => join(lines(inputs(a, i, "rev")).map(l => [...l].reverse().join(""))),
    nl: (a, i) => join(lines(inputs(a, i, "nl")).map((l, k) => `${String(k + 1).padStart(6)}\t${l}`)),
    tee: (a, i) => { const [f, files] = flags(a); files.forEach(n => { const p = norm(n); FS[p] = f.a && isFile(p) ? FS[p] + i : i; }); return i; },
    base64: (a, i) => { const [f, files] = flags(a); const s = inputs(files, i, "base64"); if (f.d || f.decode) { try { return b64d(s); } catch (e) { throw new Error("base64: invalid input"); } } return b64e(s).replace(/(.{76})/g, "$1\n") + "\n"; },
    xxd: (a, i) => {
      const [f, files] = flags(a); const s = inputs(files, i, "xxd");
      if (f.r && f.p) { const h = s.replace(/[^0-9a-f]/gi, ""); return h.match(/../g)?.map(x => String.fromCharCode(parseInt(x, 16))).join("") ?? ""; }
      const bytes = [...new TextEncoder().encode(s)];
      if (f.p) return bytes.map(b => b.toString(16).padStart(2, "0")).join("").replace(/(.{60})/g, "$1\n") + "\n";
      const o = [];
      for (let k = 0; k < bytes.length; k += 16) {
        const row = bytes.slice(k, k + 16), hex = row.map(b => b.toString(16).padStart(2, "0")).join("").replace(/(.{4})/g, "$1 ");
        o.push(`${k.toString(16).padStart(8, "0")}: ${hex.padEnd(40)} ${row.map(b => (b > 31 && b < 127 ? String.fromCharCode(b) : ".")).join("")}`);
      }
      return join(o);
    },
    strings: (a, i) => { const [f, files] = flags(a, "n"); return join(inputs(files, i, "strings").match(new RegExp(`[\\x20-\\x7e]{${f.n || 4},}`, "g")) || []); },
    find: a => {
      const start = a[0] && !a[0].startsWith("-") ? a[0] : "."; const base = norm(start); const o = [];
      const nameI = a.indexOf("-name"), inameI = a.indexOf("-iname"), typeI = a.indexOf("-type");
      const pat = nameI >= 0 ? a[nameI + 1] : inameI >= 0 ? a[inameI + 1] : null;
      const re = pat ? new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", inameI >= 0 ? "i" : "") : null;
      const type = typeI >= 0 ? a[typeI + 1] : null; const dirs = new Set();
      for (const f of Object.keys(FS).sort()) {
        if (f !== base && !f.startsWith(base === "/" ? "/" : base + "/")) continue;
        const rel = f.slice(base.length).split("/").filter(Boolean);
        for (let k = 1; k < rel.length; k++) dirs.add(rel.slice(0, k).join("/"));
        if ((!type || type === "f") && (!re || re.test(rel[rel.length - 1]))) o.push(f);
      }
      if (!type || type === "d") dirs.forEach(d => { if (!re || re.test(d.split("/").pop())) o.push(base + "/" + d); });
      const show = p => (start.startsWith("/") ? p : "." + (p.slice(base.length) || "") ).replace(/^\.\/?$/, ".");
      return join(o.sort().map(show));
    },
    file: a => join(a.flatMap(glob).map(n => {
      const s = read(n, "file");
      const t = s.startsWith("MZ") ? "PE32 executable (GUI) Intel 80386, for MS Windows" : s.startsWith("\x7fELF") || s.startsWith("ELF") ? "ELF 64-bit LSB executable, x86-64" : s.startsWith("#!") ? "script, ASCII text executable" : /^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 16 ? "ASCII text (looks like base64)" : /\.pcap$/.test(n) ? "pcap capture file (text export)" : "ASCII text";
      return `${n}: ${t}`;
    })),
    sha256sum: async (a, i) => { const files = a.flatMap(glob); if (!files.length) return (await sha("SHA-256", i)) + "  -\n"; const o = []; for (const n of files) o.push(`${await sha("SHA-256", read(n, "sha256sum"))}  ${n}`); return join(o); },
    sha1sum: async (a, i) => { const files = a.flatMap(glob); if (!files.length) return (await sha("SHA-1", i)) + "  -\n"; const o = []; for (const n of files) o.push(`${await sha("SHA-1", read(n, "sha1sum"))}  ${n}`); return join(o); },
    clear: () => { out.innerHTML = ""; return ""; },
    brief: () => ({ html: `<b>// challenge</b>\n${LAB.brief}\n` }),
    hint: () => {
      const H = LAB.hints || [];
      if (!H.length) return "no hints for this one.\n";
      if (hintN >= H.length) return `no more hints (${H.length}/${H.length} used).\n`;
      hintN++; paintTicket(); return { html: `<b>hint ${hintN}/${H.length}:</b> ${H[hintN - 1]}\n` };
    },
    reset: () => { reset(); return "lab files restored.\n"; },
    solution: () => (solved() || hintN >= (LAB.hints || []).length ? { html: `<b>// walkthrough</b>\n${b64d(LAB.solution || "")}\n` } : `solve it first, or use all ${(LAB.hints || []).length} hints, then try again.\n`),
    submit: async a => {
      if (!a.length) throw new Error("usage: submit <answer>");
      const h = await sha("SHA-256", normAns(a.join(" ")));
      if ((LAB.answers || []).includes(h)) { markSolved(); return { html: `<span class="ok">[ PASS ] correct.</span> lab solved and saved. type <b>solution</b> for the walkthrough.\n` }; }
      document.dispatchEvent(new CustomEvent("oxday-lab-wrong"));
      throw new Error("[ FAIL ] not quite. try again, or type hint");
    },
    node: (a, i) => {
      if (!LAB.js) throw new Error("node: not installed in this lab");
      let code; if (a[0] === "-e" || a[0] === "-p") code = (a[0] === "-p" ? "console.log(" + a.slice(1).join(" ") + ")" : a.slice(1).join(" ")); else if (a[0]) code = read(a[0], "node"); else code = i;
      const o = []; const fmt = v => (typeof v === "string" ? v : JSON.stringify(v));
      const con = { log: (...x) => o.push(x.map(fmt).join(" ")), error: (...x) => o.push(x.map(fmt).join(" ")), table: x => o.push(JSON.stringify(x, null, 1)) };
      try { new Function("console", "process", '"use strict";\n' + code.replace(/^\s*(import|export)\b.*$/gm, ""))(con, { argv: ["node", ...a] }); }
      catch (e) { o.push((e.name || "Error") + ": " + e.message); }
      return join(o);
    },
    sqlite3: async (a) => {
      if (!LAB.sql) throw new Error("sqlite3: not installed in this lab");
      const db = await openDb(); if (!db) throw new Error("sqlite3: couldn't load the SQLite engine (needs a network connection to cdn.jsdelivr.net)");
      if (a[1]) return runSql(db, a.slice(1).join(" "));
      sqlMode = db; return "SQLite version 3 (sql.js, running in your browser)\nEnter SQL statements terminated with \";\". Type .tables, .schema or .quit\n";
    }
  };
  B.nano = B.vim = B.vi = B.edit = a => {
    if (!a[0]) throw new Error("usage: nano <file>");
    const p = norm(a[0]); if (isDir(p) && !isFile(p)) throw new Error(`nano: ${a[0]}: Is a directory`);
    const ed = document.createElement("div"); ed.className = "sb__ed";
    ed.innerHTML = `<div class="sb__edbar"><span>GNU nano · ${esc(a[0])}</span><span><button type="button" data-e="save">^S save</button> <button type="button" data-e="exit">^X exit</button></span></div><textarea spellcheck="false" aria-label="editing ${esc(a[0])}"></textarea>`;
    const ta = ed.querySelector("textarea"); ta.value = isFile(p) ? FS[p] : "";
    const close = save => { if (save) FS[p] = ta.value.endsWith("\n") ? ta.value : ta.value + "\n"; ed.remove(); print(save ? `[ wrote ${esc(a[0])} ]` : "[ closed without saving ]", "sys"); input.focus(); };
    ed.addEventListener("click", e => { const b = e.target.closest("[data-e]"); if (b) close(b.dataset.e === "save"); });
    ta.addEventListener("keydown", e => {
      if (e.ctrlKey && (e.key === "s" || e.key === "o")) { e.preventDefault(); FS[p] = ta.value; print(`[ saved ${esc(a[0])} ]`, "sys"); }
      else if (e.ctrlKey && e.key === "x") { e.preventDefault(); close(true); }
      else if (e.key === "Escape") { e.preventDefault(); close(false); }
      else if (e.key === "Tab") { e.preventDefault(); ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end"); }
    });
    el.classList.add("sb--open"); el.append(ed); setTimeout(() => ta.focus(), 0);
    return a[0] === "vim" ? "" : "";
  };
  B.ipcalc = a => {
    const arg = a.find(x => !x.startsWith("-")) || ""; const m = arg.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\/(\d+))?$/);
    if (!m) throw new Error("usage: ipcalc 192.168.1.10/24");
    const ip = ((+m[1] << 24) >>> 0) + (+m[2] << 16) + (+m[3] << 8) + +m[4], bits = m[5] === undefined ? 24 : +m[5];
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0, net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
    const q = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join(".");
    const hosts = bits >= 31 ? (bits === 32 ? 1 : 2) : bc - net - 1;
    const cls = +m[1] < 128 ? "A" : +m[1] < 192 ? "B" : +m[1] < 224 ? "C" : "D/E";
    const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(arg) ? ", Private Internet" : /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(arg) ? ", CGNAT (RFC 6598)" : "";
    return `Address:   ${q(ip)}\nNetmask:   ${q(mask)} = ${bits}\nWildcard:  ${q(~mask >>> 0)}\n=>\nNetwork:   ${q(net)}/${bits}\nHostMin:   ${bits >= 31 ? q(net) : q(net + 1)}\nHostMax:   ${bits >= 31 ? q(bc) : q(bc - 1)}\nBroadcast: ${bits >= 31 ? "-" : q(bc)}\nHosts/Net: ${hosts}   (Class ${cls}${priv})\n`;
  };
  B.ll = a => B.ls(["-l", ...a]); B.dir = B.ls; B.type = B.cat; B.cls = B.clear;
  for (const name of ["sudo", "su"]) B[name] = () => { throw new Error(`${USER} is not in the sudoers file. This incident will be reported.`); };
  B.rm = a => { const [, files] = flags(a); files.flatMap(glob).forEach(n => { const p = norm(n); Object.keys(FS).forEach(f => { if (f === p || f.startsWith(p + "/")) delete FS[f]; }); }); return ""; };
  B.touch = a => { a.forEach(n => { const p = norm(n); if (!isFile(p)) FS[p] = ""; }); return ""; };
  B.mkdir = a => { const [, d] = flags(a); d.forEach(n => (FS[norm(n) + "/.keep"] = "")); return ""; };
  B.cp = a => { const [s, d] = flags(a)[1]; const t = isDir(norm(d)) ? norm(d) + "/" + s.split("/").pop() : norm(d); FS[t] = read(s, "cp"); return ""; };
  B.mv = a => { const r = B.cp(a); delete FS[norm(flags(a)[1][0])]; return r; };
  function lsl(n, c) { const sz = new TextEncoder().encode(c || "").length; return `-rw-r--r-- 1 ${USER} ${USER} ${String(sz).padStart(5)} Nov  7 09:00 ${esc(n)}`; }

  /* ---------- SQLite via sql.js (only loaded on SQL labs) ---------- */
  let dbP = null;
  function openDb() {
    if (dbP) return dbP;
    const base = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
    dbP = new Promise(res => {
      const s = document.createElement("script"); s.src = base + "sql-wasm.js";
      s.onload = () => window.initSqlJs({ locateFile: f => base + f }).then(SQL => { const db = new SQL.Database(); db.run(LAB.sql); res(db); }, () => res(null));
      s.onerror = () => { dbP = null; res(null); };
      document.head.append(s);
    });
    return dbP;
  }
  function runSql(db, q) {
    q = q.trim();
    if (q === ".tables") return join(db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]?.values.map(r => r[0]) || []);
    if (q === ".schema") return join(db.exec("SELECT sql FROM sqlite_master WHERE sql NOT NULL")[0]?.values.map(r => r[0] + ";") || []);
    const res = db.exec(q), o = [];
    for (const r of res) {
      const w = r.columns.map((c, k) => Math.min(40, Math.max(String(c).length, ...r.values.map(v => String(v[k] ?? "NULL").length))));
      const line = cells => cells.map((c, k) => String(c ?? "NULL").slice(0, 40).padEnd(w[k])).join(" | ");
      o.push(line(r.columns), w.map(x => "-".repeat(x)).join("-+-"), ...r.values.map(line));
    }
    return join(o);
  }

  /* ---------- runner ---------- */
  const CANNED = (LAB.cmds || []).map(c => ({ re: new RegExp(c.re), out: c.out }));
  const VARS = {}; let lastCode = 0, ARGV = [];
  const canned = raw => { for (const c of CANNED) if (c.re.test(raw)) return c.out.endsWith("\n") || !c.out ? c.out : c.out + "\n"; return null; };
  async function runSeg(words, stdin, sink) {
    while (words.length && /^[A-Za-z_]\w*=/.test(words[0])) { const [k, ...v] = words.shift().split("="); VARS[k] = v.join("="); }
    if (words[0] === "export") { words.slice(1).forEach(w => { const [k, ...v] = w.split("="); if (v.length) VARS[k] = v.join("="); }); return { out: "" }; }
    const [cmd, ...args] = words; if (!cmd) return { out: stdin || "" };
    const c0 = canned(words.join(" ")); if (c0 !== null) return { out: c0 };
    if (cmd === "bash" || cmd === "sh" || (cmd.startsWith("./") && /\.sh$/.test(cmd))) {
      const f = cmd.startsWith("./") ? cmd : args.shift();
      if (!f) throw new Error("bash: interactive subshells aren't supported here; run a script: bash file.sh");
      return { out: await script(read(f, "bash"), cmd.startsWith("./") ? args : args) };
    }
    if (cmd === "python3" || cmd === "python") return { out: await python(args, stdin) };
    if (cmd === "[" || cmd === "test") return { out: "", code: test(cmd === "[" ? args.slice(0, -1) : args) ? 0 : 1 };
    const fn = B[cmd];
    if (!fn) {
      const p = norm(cmd);
      if (cmd.includes("/") && isFile(p)) {
        if (/\.js$/.test(p) && LAB.js) return runSeg(["node", cmd, ...args], stdin, sink);
        if (/\.py$/.test(p)) return runSeg(["python3", cmd, ...args], stdin, sink);
        throw new Error(`${cmd}: Permission denied (this sandbox only runs its built-in tools)`);
      }
      throw new Error(`${cmd}: command not found. type help for what this sandbox can run`);
    }
    const expanded = ["grep", "sed", "awk", "find", "echo", "tr", "submit", "node", "sqlite3"].includes(cmd) ? args : args.flatMap(x => (/[*?]/.test(x) && !x.startsWith("-") ? glob(x) : [x]));
    const r = await fn(expanded, stdin || "");
    if (r && typeof r === "object") return r.html !== undefined ? { html: r.html, text: r.text, code: 0 } : { out: r.out, code: r.code ?? 0 };
    return { out: r ?? "", code: 0 };
  }
  function test(a) {
    if (a[0] === "!") return !test(a.slice(1));
    if (a.length === 2) { const [o, x] = a; const p = norm(x || "");
      return { "-f": isFile(p), "-e": isFile(p) || isDir(p), "-d": isDir(p) && !isFile(p), "-z": !x, "-n": !!x, "-s": isFile(p) && FS[p].length > 0 }[o] ?? false; }
    if (a.length === 3) { const [x, o, y] = a;
      return { "=": x === y, "==": x === y, "!=": x !== y, "-eq": +x === +y, "-ne": +x !== +y, "-gt": +x > +y, "-lt": +x < +y, "-ge": +x >= +y, "-le": +x <= +y }[o] ?? false; }
    return a.length === 1 && !!a[0];
  }
  // $VAR, ${VAR}, $1, $?, $(cmd), $((math)); nothing inside single quotes
  async function expand(line) {
    let o = "", q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'" && q !== '"') { q = q ? null : "'"; o += c; continue; }
      if (c === '"' && q !== "'") { q = q ? null : '"'; o += c; continue; }
      if (c === "\\" && q !== "'") { o += c + (line[++i] ?? ""); continue; }
      if (c !== "$" || q === "'") { o += c; continue; }
      const rest = line.slice(i + 1); let m;
      if (rest.startsWith("((")) {
        let d = 0, j = i + 1; for (; j < line.length; j++) { if (line[j] === "(") d++; else if (line[j] === ")" && --d === 0) break; }
        const ex = line.slice(i + 3, j - 1).replace(/\$?([A-Za-z_]\w*)/g, (_, v) => +(VARS[v] ?? 0));
        if (!/^[\d\s+\-*/%()<>=!&|]*$/.test(ex)) throw new Error("bash: bad arithmetic: " + ex);
        o += String(Math.trunc(Function(`"use strict";return (${ex || 0})`)())); i = j; continue;
      }
      if (rest.startsWith("(")) {
        let d = 0, j = i + 1; for (; j < line.length; j++) { if (line[j] === "(") d++; else if (line[j] === ")" && --d === 0) break; }
        const buf = []; await exec(line.slice(i + 2, j), (t) => buf.push(t)); o += buf.join("").replace(/\n+$/, ""); i = j; continue;
      }
      if ((m = rest.match(/^\{(\w+)\}/)) || (m = rest.match(/^([A-Za-z_]\w*|\d|\?|#|@)/))) {
        const k = m[1], v = k === "?" ? String(lastCode) : k === "#" ? String(ARGV.length) : k === "@" ? ARGV.join(" ") : /^\d$/.test(k) ? (k === "0" ? "bash" : ARGV[+k - 1] ?? "")
          : k === "HOME" ? HOME : k === "USER" ? USER : k === "PWD" ? cwd : k === "HOSTNAME" ? HOST : VARS[k] ?? "";
        o += v; i += m[0].length; continue;
      }
      o += c;
    }
    return o;
  }
  // split a line on top-level ; while keeping for/while/if blocks together
  function statements(line) {
    const parts = []; let cur = "", q = null, depth = 0, word = "", atStart = true;
    const endWord = () => {
      if (word) {
        if (atStart && /^(for|while|if|until)$/.test(word)) depth++;
        else if (atStart && /^(done|fi)$/.test(word)) depth = Math.max(0, depth - 1);
        atStart = /^(do|then|else|!)$/.test(word);
      }
      word = "";
    };
    for (const c of line) {
      if (q) { if (c === q) q = null; cur += c; word += c; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; word += c; continue; }
      if (/\s/.test(c)) { endWord(); cur += c; continue; }
      if (c === ";" || c === "|" || c === "&") {
        endWord(); atStart = true;
        if (c === ";" && depth === 0) { if (cur.trim()) parts.push(cur.trim()); cur = ""; } else cur += c;
        continue;
      }
      cur += c; word += c;
    }
    endWord(); if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  async function exec(line, sink) {
    sink = sink || ((t, cls, html) => print(html ? t : esc(t), cls));
    for (const st of statements(line)) {
      let m;
      if ((m = st.match(/^for\s+(\w+)\s+in\s+([\s\S]*?);?\s*do\s+([\s\S]*?);?\s*done$/))) {
        const items = tokenize(await expand(m[2])).filter(t => typeof t === "string").flatMap(x => (/[*?]/.test(x) ? glob(x) : [x]));
        for (const it of items) { VARS[m[1]] = it; await exec(m[3], sink); }
        continue;
      }
      if ((m = st.match(/^while\s+read\s+(\w+)\s*;?\s*do\s+([\s\S]*?);?\s*done\s*<\s*(\S+)$/))) {
        for (const l of lines(read(m[3], "bash"))) { VARS[m[1]] = l; await exec(m[2], sink); }
        continue;
      }
      if ((m = st.match(/^if\s+([\s\S]*?);\s*then\s+([\s\S]*?)(?:;\s*else\s+([\s\S]*?))?;?\s*fi$/))) {
        await exec(m[1], () => {}); if (lastCode === 0) await exec(m[2], sink); else if (m[3]) await exec(m[3], sink);
        continue;
      }
      await pipeline(await expand(st), sink);
    }
  }
  async function pipeline(line, sink) {
    const c0 = canned(line.trim()); if (c0 !== null && /\|/.test(line)) { sink(c0.replace(/\n$/, "")); lastCode = 0; return; }
    const toks = tokenize(line); const chains = [[]], conds = [];
    for (const t of toks) { if (t.op === "&&" || t.op === "||") { conds.push(t.op); chains.push([]); } else chains[chains.length - 1].push(t); }
    for (let c = 0; c < chains.length; c++) {
      if (c > 0 && ((conds[c - 1] === "&&" && lastCode !== 0) || (conds[c - 1] === "||" && lastCode === 0))) continue;
      const segs = [[]]; let redir = null; const ch = chains[c];
      for (let k = 0; k < ch.length; k++) {
        const t = ch[k];
        if (t.op === "|") segs.push([]);
        else if (t.op === ">" || t.op === ">>") { redir = { op: t.op, file: ch[++k] }; if (typeof redir.file !== "string") throw new Error("syntax error near redirect"); }
        else if (t.op === "&" || t.op === ";") continue;
        else segs[segs.length - 1].push(t);
      }
      if (!segs[0].length) continue;
      let data = "", html = null; lastCode = 0;
      try {
        for (const s of segs) { const r = await runSeg(s.slice(), data, sink); if (r.html !== undefined) { html = r.html; data = r.text !== undefined ? r.text : r.html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"'); } else { html = null; data = r.out; } lastCode = r.code || 0; }
      } catch (e) { sink(e.message, "err"); lastCode = 1; continue; }
      if (redir) { const p = norm(redir.file === "/dev/null" ? "/dev/null" : redir.file); if (p !== "/dev/null") FS[p] = redir.op === ">>" && isFile(p) ? FS[p] + data : data; }
      else if (html !== null) sink(html.replace(/\n$/, ""), "", true);
      else if (data) sink(data.replace(/\n$/, ""));
    }
  }
  async function script(src, argv) {
    const saved = ARGV; ARGV = argv;
    const L = src.split("\n").map(l => l.replace(/^\s+/, "")).filter(l => l && !l.startsWith("#"));
    const joined = L.join("; ").replace(/\b(do|then|else|in)\s*;\s*/g, "$1 ").replace(/;\s*;/g, ";");
    const buf = []; try { await exec(joined, t => buf.push(t + "\n")); } finally { ARGV = saved; }
    return buf.join("");
  }

  /* ---------- Python via Pyodide (only loaded on Python labs) ---------- */
  let pyP = null;
  function loadPy() {
    if (pyP) return pyP;
    const base = "https://cdn.jsdelivr.net/npm/pyodide@0.26.4/";
    pyP = new Promise(res => {
      const s = document.createElement("script"); s.src = base + "pyodide.js";
      s.onload = () => window.loadPyodide({ indexURL: base }).then(res, () => res(null));
      s.onerror = () => { pyP = null; res(null); };
      document.head.append(s);
    });
    return pyP;
  }
  async function python(args, stdin) {
    if (!LAB.py) { const c = canned(["python3", ...args].join(" ")); if (c !== null) return c; throw new Error("python3: not installed in this lab"); }
    let code, file = null;
    if (args[0] === "-c") code = args.slice(1).join(" "); else if (args[0]) { file = norm(args[0]); code = read(args[0], "python3"); } else code = stdin;
    print("[ starting python (first run downloads ~10 MB) ... ]", "sys");
    const py = await loadPy(); if (!py) throw new Error("python3: couldn't load Python (needs a network connection to cdn.jsdelivr.net)");
    for (const [p, c] of Object.entries(FS)) { const d = p.slice(0, p.lastIndexOf("/")); py.FS.mkdirTree(d || "/"); py.FS.writeFile(p, c); }
    py.FS.chdir(cwd);
    const o = []; py.setStdout({ batched: t => o.push(t) }); py.setStderr({ batched: t => o.push(t) });
    py.setStdin({ stdin: (() => { const L = lines(stdin || ""); return () => L.shift(); })() });
    try { py.globals.set("__argv", [file || "-c", ...args.slice(1)]); await py.runPythonAsync("import sys; sys.argv = list(__argv)\n"); await py.runPythonAsync(code); }
    catch (e) { o.push(String(e.message || e).split("\n").filter(l => l.trim()).slice(-3).join("\n")); }
    return join(o);
  }

  /* ---------- solved state ---------- */
  const solved = () => !!store.get("oxday-labs", {})[LAB.id];
  function markSolved() {
    const s = store.get("oxday-labs", {}); s[LAB.id] = new Date().toISOString().slice(0, 10); store.set("oxday-labs", s);
    el.classList.add("sb--solved"); const st = el.querySelector(".sb__st"); if (st) st.textContent = "[ solved ]";
    document.dispatchEvent(new CustomEvent("oxday-lab-solved", { detail: LAB.id }));
  }

  /* ---------- UI ---------- */
  el.innerHTML = `<div class="term__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term__title">${esc(USER)}@${esc(HOST)}: sandbox</span>
    <span class="sb__st">${solved() ? "[ solved ]" : "[ unsolved ]"}</span></div>
    <div class="sb__out" role="log" aria-live="polite"></div>
    <div class="sb__chips"><button type="button" data-c="brief">brief</button><button type="button" data-c="hint">hint</button><button type="button" data-c="ls">ls</button><button type="button" data-c="help">help</button><button type="button" data-c="reset">reset</button></div>
    <form class="sb__line" autocomplete="off"><label class="sb__ps1" for="sb-in"></label><input id="sb-in" spellcheck="false" autocapitalize="off" aria-label="sandbox shell input"></form>`;
  if (solved()) el.classList.add("sb--solved");
  const out = el.querySelector(".sb__out"), form = el.querySelector("form"), input = el.querySelector("input"), ps1 = el.querySelector(".sb__ps1");
  function print(h, cls = "") { const d = document.createElement("div"); d.className = "sb__blk " + cls; d.innerHTML = h; out.append(d); out.scrollTop = out.scrollHeight; }
  const prompt = () => (sqlMode ? "sqlite&gt; " : (LAB.style === "debug") ? '<span class="p-u">(gdb)</span> ' : `<span class="p-u">${esc(USER)}@${esc(HOST)}</span>:<span class="p-d">${esc(short(cwd))}</span>$ `);
  const setPs1 = () => (ps1.innerHTML = prompt());
  async function run(line) {
    print(prompt() + `<span class="sb__cmd">${esc(line)}</span>`);
    if (line.trim()) { hist.push(line); hi = hist.length; }
    if (sqlMode) {
      const q = line.trim();
      if (q === ".quit" || q === ".exit" || q === "exit") sqlMode = null;
      else if (q) { try { const r = runSql(sqlMode, q); if (r) print(esc(r.replace(/\n$/, ""))); } catch (e) { print("Error: " + esc(e.message), "err"); } }
    } else if (line.trim()) {
      try { await exec(line); } catch (e) { print(esc(e.message), "err"); }
    }
    setPs1();
  }
  form.addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; run(v); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
    else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value, m = v.match(/(\S*)$/), part = m[1], dir = part.includes("/") ? part.slice(0, part.lastIndexOf("/") + 1) : "";
      const base = norm(dir || "."), stem = part.slice(dir.length);
      const pool = v.trim().includes(" ") ? kids(base).map(([n, d]) => n + (d ? "/" : "")) : Object.keys(B).concat(LAB.cmdnames || []);
      const hits = pool.filter(n => n.startsWith(stem));
      if (hits.length === 1) input.value = v.slice(0, v.length - stem.length) + hits[0] + (hits[0].endsWith("/") ? "" : " ");
      else if (hits.length > 1) print(esc(hits.join("  ")), "sys");
    }
  });
  el.querySelector(".sb__chips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { run(b.dataset.c); input.focus({ preventScroll: true }); } });
  const narrow = () => matchMedia("(max-width:1100px)").matches;
  el.querySelector(".term__bar").addEventListener("click", () => { if (narrow()) el.classList.toggle("sb--open"); });
  input.addEventListener("focus", () => { if (narrow()) el.classList.add("sb--open"); });
  out.addEventListener("click", () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });

  // ▶ buttons in the guide: type the command into the sandbox, then run it
  let typing = false;
  document.addEventListener("click", async e => {
    const b = e.target.closest(".run"); if (!b || typing) return;
    const cmd = b.dataset.cmd; typing = true;
    if (narrow()) el.classList.add("sb--open");
    else if (el.getBoundingClientRect().top > innerHeight || el.getBoundingClientRect().bottom < 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sqlMode) { sqlMode = null; setPs1(); }
    input.value = ""; const d = Math.min(12, 450 / cmd.length);
    for (const ch of cmd) { input.value += ch; if (!fast) await new Promise(r => setTimeout(r, d)); }
    input.value = ""; try { await run(cmd); } finally { typing = false; } input.focus({ preventScroll: true });
  });

  /* ================= lab styles: ticket queue and step-through debugger ================= */
  const STYLE = LAB.style || "shell";
  let wrong = 0;
  const score = () => Math.max(10, 100 - 15 * hintN - 5 * wrong);
  document.addEventListener("oxday-lab-wrong", () => { wrong++; paintTicket(); });
  function paintTicket() {
    const s = el.querySelector(".tk__pts"); if (s) s.innerHTML = `score <b>${solved() ? (store.get("oxday-labs", {})[LAB.id + ":score"] ?? score()) : score()}</b>/100 <span class="muted">· hints -15 · wrong -5</span>`;
  }
  if (STYLE === "ticket") {
    const T = LAB.ticket || {};
    el.classList.add("sb--ticket");
    el.querySelector(".term__title").textContent = `${T.system || "osTicket"} · ticket ${T.id || "#1000"}`;
    const tk = document.createElement("div"); tk.className = "tk";
    const att = Object.keys(LAB.fs || {}).filter(p => !p.endsWith("/.keep") && (!T.attach || T.attach.split(",").map(x => x.trim()).some(a => p.endsWith(a))));
    tk.innerHTML = `<div class="tk__head"><span class="tk__subj">${esc(T.subject || LAB.title)}</span>
        <span class="tk__meta"><span class="tk__chip tk__chip--${esc((T.priority || "P3").toLowerCase())}">${esc(T.priority || "P3")}</span><span class="tk__chip">from: ${esc(T.from || "user")}</span><span class="tk__chip tk__sla">SLA ${esc(T.sla || "4h")}</span><span class="tk__chip tk__status">${solved() ? "resolved" : "open"}</span></span></div>
      <div class="tk__body">${LAB.brief}</div>
      <div class="tk__att"><span class="muted">attachments:</span> ${att.map(p => `<button type="button" class="tk__file" data-p="${esc(p)}">📎 ${esc(p.split("/").pop())}</button>`).join(" ")}</div>
      <form class="tk__res"><input aria-label="resolution" placeholder="resolution: your answer" spellcheck="false"><button class="btn" type="submit">[ resolve ]</button><span class="tk__pts"></span></form>`;
    el.insertBefore(tk, el.querySelector(".sb__out"));
    tk.addEventListener("click", e => { const b = e.target.closest(".tk__file"); if (b) { run("cat " + b.dataset.p); input.focus({ preventScroll: true }); } });
    tk.querySelector(".tk__res").addEventListener("submit", e => { e.preventDefault(); const v = e.target.querySelector("input").value.trim(); if (v) run("submit " + v); });
    document.addEventListener("oxday-lab-solved", () => { tk.querySelector(".tk__status").textContent = "resolved"; const all = store.get("oxday-labs", {}); all[LAB.id + ":score"] = score(); store.set("oxday-labs", all); paintTicket(); });
    // SLA clock counts down from the ticket's SLA while the page is open
    const m = String(T.sla || "4h").match(/(\d+)\s*([hm])/); let left = m ? +m[1] * (m[2] === "h" ? 3600 : 60) : 14400;
    setInterval(() => { if (solved()) return; left = Math.max(0, left - 1); const sla = tk.querySelector(".tk__sla"); sla.textContent = `SLA ${Math.floor(left / 3600)}h ${String(Math.floor(left / 60) % 60).padStart(2, "0")}m ${String(left % 60).padStart(2, "0")}s`; sla.classList.toggle("late", left < 600); }, 1000);
    paintTicket();
  }

  let dbg = null;
  if (STYLE === "debug") {
    el.classList.add("sb--debug");
    const TR = LAB.trace || [], SRC = (LAB.fs[LAB.source] || "").replace(/\n$/, "").split("\n");
    dbg = { i: -1, bps: new Set(), prev: {} };
    const pane = document.createElement("div"); pane.className = "dbg";
    pane.innerHTML = `<pre class="dbg__src" aria-label="source"></pre><div class="dbg__vars" aria-label="locals"></div>`;
    el.insertBefore(pane, el.querySelector(".sb__out"));
    el.querySelector(".term__title").textContent = `gdb · ${LAB.source.split("/").pop()}`;
    const paint = () => {
      const cur = TR[dbg.i], ln = cur ? cur.line : 0;
      pane.querySelector(".dbg__src").innerHTML = SRC.map((l, k) => {
        const n = k + 1, bp = dbg.bps.has(n);
        return `<span class="dbg__l${n === ln ? " cur" : ""}${bp ? " bp" : ""}" data-n="${n}"><span class="dbg__n">${bp ? "●" : " "}${String(n).padStart(3)}${n === ln ? "→" : " "}</span>${esc(l) || " "}</span>`;
      }).join("");
      const v = cur ? cur.vars : {}, prev = TR[dbg.i - 1] ? TR[dbg.i - 1].vars : {};
      pane.querySelector(".dbg__vars").innerHTML = `<div class="dbg__h">${cur ? `step ${dbg.i + 1}/${TR.length}` : "not running · type <b>start</b>"}</div>` +
        Object.entries(v).map(([k, x]) => `<div class="dbg__v${prev[k] !== x ? " chg" : ""}"><span>${esc(k)}</span><span>${esc(x)}</span></div>`).join("");
      const c = pane.querySelector(".cur"); if (c) c.scrollIntoView({ block: "nearest" });
    };
    pane.querySelector(".dbg__src").addEventListener("click", e => { const l = e.target.closest(".dbg__l"); if (l) run((dbg.bps.has(+l.dataset.n) ? "delete " : "break ") + l.dataset.n); });
    const at = () => { const c = TR[dbg.i]; return c ? `${c.line}\t${SRC[c.line - 1].trim()}` + (c.out ? "" : "") : ""; };
    const go = (n) => {
      if (dbg.i < 0) return "The program is not being run. Type start.\n";
      const outs = [];
      for (let k = 0; k < n; k++) {
        if (dbg.i >= TR.length - 1) { paint(); return join(outs) + `[Inferior 1 (process 4242) exited normally]\n`; }
        dbg.i++; if (TR[dbg.i].out) outs.push(TR[dbg.i].out);
      }
      paint(); return join(outs.concat([at()]));
    };
    const D = {
      start: () => { dbg.i = 0; paint(); return `Temporary breakpoint 1 at main\nStarting program: ./${LAB.source.split("/").pop().replace(/\.\w+$/, "")}\n${at()}\n`; },
      step: a => go(+(a[0] || 1)),
      back: a => { if (dbg.i > 0) dbg.i = Math.max(0, dbg.i - (+(a[0] || 1))); paint(); return at() + "\n"; },
      continue: () => {
        if (dbg.i < 0) return "The program is not being run. Type start.\n";
        const outs = [];
        while (dbg.i < TR.length - 1) { dbg.i++; if (TR[dbg.i].out) outs.push(TR[dbg.i].out); if (dbg.bps.has(TR[dbg.i].line)) { paint(); return join(outs.concat([`Breakpoint, line ${TR[dbg.i].line}`, at()])); } }
        paint(); return join(outs.concat(["[Inferior 1 (process 4242) exited normally]"]));
      },
      break: a => { const n = +String(a[0] || "").replace(/^.*:/, ""); if (!n || n > SRC.length) throw new Error("usage: break <line number>"); dbg.bps.add(n); paint(); return `Breakpoint at line ${n}.\n`; },
      delete: a => { a.length ? a.forEach(n => dbg.bps.delete(+n)) : dbg.bps.clear(); paint(); return ""; },
      print: a => { const c = TR[dbg.i]; if (!c) throw new Error("No frame selected. Type start."); const k = a.join(" ").replace(/^\$/, ""); if (!(k in c.vars)) throw new Error(`No symbol "${k}" in current context.`); return `$1 = ${c.vars[k]}\n`; },
      info: () => { const c = TR[dbg.i]; if (!c) throw new Error("No frame selected. Type start."); return join(Object.entries(c.vars).map(([k, v]) => `${k.padEnd(10)} ${v}`)); },
      list: () => join(SRC.map((l, k) => `${String(k + 1).padStart(3)}  ${l}`)),
      finish: () => go(TR.length),
      kill: () => { dbg.i = -1; paint(); return "[Inferior 1 (process 4242) killed]\n"; }
    };
    Object.assign(B, D, { s: D.step, n: D.step, next: D.step, si: D.step, stepi: D.step, nexti: D.step, ni: D.step, r: D.start, run: D.start, c: D.continue, b: D.break, p: D.print, l: D.list, rs: D.back, "reverse-step": D.back, gdb: () => "(already attached)\n" });
    paint();
  }

  reset(); setPs1();
  print(`<b>0xDay sandbox</b> · lab: ${esc(LAB.title || LAB.id)}\nEverything here runs in your browser. Type <b>help</b>, or press a <b>▶</b> in the guide.`, "sys");
  if (STYLE === "ticket") print("The ticket is above. Click an attachment to open it here, or type <b>help</b>.", "sys");
  else if (STYLE === "debug") print("Debugger loaded. <b>start</b> runs to main, <b>step</b> / <b>back</b> move one line, <b>break N</b> (or click a line) sets a breakpoint, <b>continue</b> runs to it, <b>print x</b> / <b>info locals</b> inspect.", "sys");
  if (STYLE !== "ticket") print(`<b>// challenge</b>\n${LAB.brief}`);
})();
