/* x86-32 subset emulator for the ~/dojo asm katas (Intel syntax, NASM-ish).
   Registers: eax ebx ecx edx esi edi ebp esp (+ ax/al/ah style sub-registers).
   Flags: ZF SF CF OF. Memory: flat 64 KiB, little-endian, stack grows down from 0xFFF0.
   Supports labels, `; comments`, byte/word/dword [base + index*scale + disp] operands,
   mov movzx movsx lea xchg add sub adc sbb inc dec neg not and or xor test cmp
   shl sal shr sar rol ror imul mul div idiv cdq push pop call ret jmp jcc loop nop.
   A routine starts at the first line (or a `_start`/`main` label) and ends at its top-level `ret`. */
(function (root) {
  const R32 = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"];
  const SUB = {
    ax: ["eax", 0, 16], cx: ["ecx", 0, 16], dx: ["edx", 0, 16], bx: ["ebx", 0, 16], si: ["esi", 0, 16], di: ["edi", 0, 16], bp: ["ebp", 0, 16], sp: ["esp", 0, 16],
    al: ["eax", 0, 8], cl: ["ecx", 0, 8], dl: ["edx", 0, 8], bl: ["ebx", 0, 8], ah: ["eax", 8, 8], ch: ["ecx", 8, 8], dh: ["edx", 8, 8], bh: ["ebx", 8, 8],
  };
  const MEM = 0x10000, STACK_TOP = 0xfff0, MAX_STEPS = 200000;
  const JCC = {
    je: f => f.ZF, jz: f => f.ZF, jne: f => !f.ZF, jnz: f => !f.ZF,
    jl: f => f.SF !== f.OF, jnge: f => f.SF !== f.OF, jge: f => f.SF === f.OF, jnl: f => f.SF === f.OF,
    jle: f => f.ZF || f.SF !== f.OF, jng: f => f.ZF || f.SF !== f.OF, jg: f => !f.ZF && f.SF === f.OF, jnle: f => !f.ZF && f.SF === f.OF,
    jb: f => f.CF, jc: f => f.CF, jnae: f => f.CF, jae: f => !f.CF, jnb: f => !f.CF, jnc: f => !f.CF,
    jbe: f => f.CF || f.ZF, jna: f => f.CF || f.ZF, ja: f => !f.CF && !f.ZF, jnbe: f => !f.CF && !f.ZF,
    js: f => f.SF, jns: f => !f.SF, jo: f => f.OF, jno: f => !f.OF,
  };
  class AsmError extends Error { constructor(line, msg) { super(`line ${line}: ${msg}`); this.line = line; } }

  function parseNum(t) {
    t = t.trim();
    if (/^'.'$/.test(t)) return t.charCodeAt(1);
    t = t.toLowerCase();
    let neg = false; if (t.startsWith("-")) { neg = true; t = t.slice(1).trim(); }
    let v;
    if (/^0x[0-9a-f]+$/.test(t)) v = parseInt(t, 16);
    else if (/^[0-9a-f]+h$/.test(t) && /^[0-9]/.test(t)) v = parseInt(t.slice(0, -1), 16);
    else if (/^0b[01]+$/.test(t)) v = parseInt(t.slice(2), 2);
    else if (/^[01]+b$/.test(t)) v = parseInt(t.slice(0, -1), 2);
    else if (/^\d+$/.test(t)) v = parseInt(t, 10);
    else if (/^'(.)'$/.test(t)) v = t.charCodeAt(1);
    else return null;
    return neg ? -v : v;
  }

  function assemble(src) {
    const prog = [], labels = {};
    src.split("\n").forEach((raw, i) => {
      const n = i + 1;
      let line = raw.replace(/;.*$/, "").trim();
      if (!line || /^(section|global|extern|bits|default)\b/i.test(line)) return;
      let m;
      while ((m = line.match(/^([A-Za-z_.$][\w.$]*):\s*(.*)$/))) { labels[m[1].toLowerCase()] = prog.length; line = m[2].trim(); }
      if (!line) return;
      m = line.match(/^(\w+)\s*(.*)$/);
      if (!m) throw new AsmError(n, `can't parse "${raw.trim()}"`);
      const op = m[1].toLowerCase();
      const args = m[2] ? splitArgs(m[2]).map(a => operand(a, n)) : [];
      prog.push({ op, args, line: n, text: raw.trim() });
    });
    return { prog, labels };
  }
  function splitArgs(s) { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "[") d++; if (c === "]") d--; if (c === "," && !d) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map(x => x.trim()); }
  function operand(a, n) {
    const t = a.toLowerCase().trim();
    let size = 0, m;
    if ((m = t.match(/^(byte|word|dword)\s*(ptr\s*)?(\[.*\])$/))) { size = { byte: 1, word: 2, dword: 4 }[m[1]]; return memOp(m[3], size, n); }
    if (t.startsWith("[")) return memOp(t, 0, n);
    if (R32.includes(t)) return { k: "r", r: t, size: 4 };
    if (SUB[t]) return { k: "r", r: t, size: SUB[t][2] / 8 };
    const v = parseNum(/^\s*'.'\s*$/.test(a) ? a : t);
    if (v !== null) return { k: "i", v: v >>> 0 };
    if (/^[a-z_.$][\w.$]*$/.test(t)) return { k: "l", name: t };
    throw new AsmError(n, `bad operand "${a}"`);
  }
  function memOp(t, size, n) {
    const inner = t.replace(/^\[|\]$/g, "").replace(/\s+/g, "");
    const op = { k: "m", size, base: null, index: null, scale: 1, disp: 0 };
    for (const part of inner.replace(/-/g, "+-").split("+").filter(Boolean)) {
      let m;
      if ((m = part.match(/^([a-z]+)\*(\d)$/)) || (m = part.match(/^(\d)\*([a-z]+)$/))) {
        const [r, s] = R32.includes(m[1]) ? [m[1], +m[2]] : [m[2], +m[1]];
        if (!R32.includes(r)) throw new AsmError(n, `bad index register in ${t}`);
        op.index = r; op.scale = s;
      } else if (R32.includes(part)) { if (op.base) op.index = part; else op.base = part; }
      else { const v = parseNum(part); if (v === null) throw new AsmError(n, `bad address ${t}`); op.disp += v; }
    }
    return op;
  }

  function Machine() {
    this.reg = { eax: 0, ecx: 0, edx: 0, ebx: 0, esp: STACK_TOP, ebp: 0, esi: 0, edi: 0 };
    this.f = { ZF: false, SF: false, CF: false, OF: false };
    this.mem = new Uint8Array(MEM);
  }
  Machine.prototype.addr = function (o, n) { const a = ((o.base ? this.reg[o.base] : 0) + (o.index ? this.reg[o.index] * o.scale : 0) + o.disp) >>> 0; if (a + 4 > MEM) throw new AsmError(n, `segfault: address 0x${a.toString(16)} is outside the 64 KiB sandbox`); return a; };
  Machine.prototype.read = function (o, size, n) {
    if (o.k === "i") return o.v >>> 0;
    if (o.k === "r") { if (R32.includes(o.r)) return this.reg[o.r] >>> 0; const [r, sh, w] = SUB[o.r]; return (this.reg[r] >>> sh) & ((1 << w) - 1); }
    if (o.k === "m") { const a = this.addr(o, n), s = size || o.size || 4; let v = 0; for (let i = s - 1; i >= 0; i--) v = v * 256 + this.mem[a + i]; return v >>> 0; }
    throw new AsmError(n, "can't read a label as a value");
  };
  Machine.prototype.write = function (o, v, size, n) {
    if (o.k === "r") {
      if (R32.includes(o.r)) { this.reg[o.r] = v >>> 0; return; }
      const [r, sh, w] = SUB[o.r]; const mask = ((1 << w) - 1) << sh;
      this.reg[o.r === undefined ? r : r] = ((this.reg[r] & ~mask) | ((v << sh) & mask)) >>> 0; return;
    }
    if (o.k === "m") { const a = this.addr(o, n), s = size || o.size || 4; for (let i = 0; i < s; i++) { this.mem[a + i] = v & 0xff; v = Math.floor(v / 256); } return; }
    throw new AsmError(n, "destination must be a register or memory");
  };

  function run(src, setup) {
    const { prog, labels } = assemble(src);
    const M = new Machine();
    (setup || ((m) => {}))(M);
    const RET = 0xdead0000 >>> 0;
    M.reg.esp = (M.reg.esp - 4) >>> 0; M.write({ k: "m", base: "esp", index: null, scale: 1, disp: 0, size: 4 }, RET, 4, 0);
    let ip = labels._start ?? labels.main ?? 0, steps = 0;
    const mask = s => s === 1 ? 0xff : s === 2 ? 0xffff : 0xffffffff;
    const sbit = s => s === 1 ? 0x80 : s === 2 ? 0x8000 : 0x80000000;
    const szOf = (a, b, ins) => { const s = (a.k !== "i" && (a.size || 0)) || (b && b.k !== "i" && b.size) || 0; if (!s) { if (a.k === "m" && (!b || b.k === "i")) throw new AsmError(ins.line, `operand size unknown, write "dword [..]" or "byte [..]"`); return 4; } return s; };
    const setZS = (r, s) => { M.f.ZF = (r & mask(s)) === 0; M.f.SF = !!(r & sbit(s)); };
    const push = (v, n) => { M.reg.esp = (M.reg.esp - 4) >>> 0; M.write({ k: "m", base: "esp", index: null, scale: 1, disp: 0 }, v, 4, n); };
    const pop = n => { const v = M.read({ k: "m", base: "esp", index: null, scale: 1, disp: 0 }, 4, n); M.reg.esp = (M.reg.esp + 4) >>> 0; return v; };
    const target = (o, n) => { if (o.k !== "l") throw new AsmError(n, "jump target must be a label"); const t = labels[o.name]; if (t === undefined) throw new AsmError(n, `unknown label "${o.name}"`); return t; };
    const toS = (v, s) => (v & sbit(s)) ? v - mask(s) - 1 : v;
    while (true) {
      if (ip === RET) break;
      if (ip < 0 || ip >= prog.length) throw new AsmError(prog.length ? prog[prog.length - 1].line : 0, "ran off the end of the code (missing ret?)");
      if (++steps > MAX_STEPS) throw new AsmError(prog[ip].line, `stopped after ${MAX_STEPS} instructions (infinite loop?)`);
      const ins = prog[ip], [a, b] = ins.args, n = ins.line, op = ins.op;
      const need = k => { if (ins.args.length !== k) throw new AsmError(n, `${op} takes ${k} operand${k === 1 ? "" : "s"}`); };
      let next = ip + 1;
      switch (op) {
        case "nop": break;
        case "mov": { need(2); const s = szOf(a, b, ins); M.write(a, M.read(b, s, n) & mask(s), s, n); break; }
        case "movzx": case "movsx": { need(2); const sb = b.size || 1; let v = M.read(b, sb, n); if (op === "movsx") v = toS(v, sb) >>> 0; M.write(a, v, a.size || 4, n); break; }
        case "lea": { need(2); if (b.k !== "m") throw new AsmError(n, "lea needs a [memory] operand"); M.write(a, (((b.base ? M.reg[b.base] : 0) + (b.index ? M.reg[b.index] * b.scale : 0) + b.disp) >>> 0), 4, n); break; }
        case "xchg": { need(2); const s = szOf(a, b, ins); const x = M.read(a, s, n), y = M.read(b, s, n); M.write(a, y, s, n); M.write(b, x, s, n); break; }
        case "add": case "adc": case "sub": case "sbb": case "cmp": {
          need(2); const s = szOf(a, b, ins), m = mask(s), x = M.read(a, s, n), y = M.read(b, s, n) & m;
          const c = (op === "adc" || op === "sbb") && M.f.CF ? 1 : 0;
          const add = op === "add" || op === "adc";
          const raw = add ? x + y + c : x - y - c; const r = ((raw % (m + 1)) + (m + 1)) % (m + 1);
          M.f.CF = add ? raw > m : raw < 0;
          const sx = !!(x & sbit(s)), sy = !!(y & sbit(s)), sr = !!(r & sbit(s));
          M.f.OF = add ? (sx === sy && sr !== sx) : (sx !== sy && sr !== sx);
          setZS(r, s); if (op !== "cmp") M.write(a, r, s, n); break;
        }
        case "inc": case "dec": { need(1); const s = szOf(a, null, ins), m = mask(s), x = M.read(a, s, n); const r = op === "inc" ? (x + 1) & m : (x - 1 + m + 1) & m; M.f.OF = op === "inc" ? r === sbit(s) : x === sbit(s); setZS(r, s); M.write(a, r, s, n); break; }
        case "neg": { need(1); const s = szOf(a, null, ins), m = mask(s), x = M.read(a, s, n); const r = (m + 1 - x) & m; M.f.CF = x !== 0; M.f.OF = x === sbit(s); setZS(r, s); M.write(a, r, s, n); break; }
        case "not": { need(1); const s = szOf(a, null, ins); M.write(a, ~M.read(a, s, n) & mask(s), s, n); break; }
        case "and": case "or": case "xor": case "test": {
          need(2); const s = szOf(a, b, ins), x = M.read(a, s, n), y = M.read(b, s, n);
          const r = (op === "or" ? x | y : op === "xor" ? x ^ y : x & y) & mask(s);
          M.f.CF = M.f.OF = false; setZS(r, s); if (op !== "test") M.write(a, r >>> 0, s, n); break;
        }
        case "shl": case "sal": case "shr": case "sar": case "rol": case "ror": {
          if (ins.args.length === 1) ins.args.push({ k: "i", v: 1 });
          const [d, c] = ins.args; const s = szOf(d, null, ins), bits = s * 8, m = mask(s);
          const k = M.read(c, 1, n) & 31; if (!k) break;
          let x = M.read(d, s, n), r;
          if (op === "shl" || op === "sal") { r = (x * 2 ** k) % (m + 1); M.f.CF = !!((x >>> (bits - k)) & 1); }
          else if (op === "shr") { r = x >>> k; M.f.CF = !!((x >>> (k - 1)) & 1); }
          else if (op === "sar") { r = (toS(x, s) >> k) & m; M.f.CF = !!((toS(x, s) >> (k - 1)) & 1); }
          else if (op === "rol") { const kk = k % bits; r = ((x << kk) | (x >>> (bits - kk))) & m; M.f.CF = !!(r & 1); }
          else { const kk = k % bits; r = ((x >>> kk) | (x << (bits - kk))) & m; M.f.CF = !!(r & sbit(s)); }
          r >>>= 0; if (op !== "rol" && op !== "ror") setZS(r, s); M.write(d, r, s, n); break;
        }
        case "imul": {
          if (ins.args.length === 1) { const v = BigInt(toS(M.read(a, 4, n), 4)) * BigInt(M.reg.eax | 0); M.reg.eax = Number(v & 0xffffffffn) >>> 0; M.reg.edx = Number((v >> 32n) & 0xffffffffn) >>> 0; break; }
          const src2 = ins.args.length === 3 ? ins.args[2] : b, src1 = ins.args.length === 3 ? b : a;
          const v = BigInt(M.read(src1, 4, n) | 0) * BigInt(M.read(src2, 4, n) | 0); const r = Number(BigInt.asIntN(32, v));
          M.f.CF = M.f.OF = BigInt(r) !== v; M.write(a, r >>> 0, 4, n); break;
        }
        case "mul": { need(1); const v = BigInt(M.read(a, 4, n)) * BigInt(M.reg.eax >>> 0); M.reg.eax = Number(v & 0xffffffffn) >>> 0; M.reg.edx = Number(v >> 32n) >>> 0; M.f.CF = M.f.OF = M.reg.edx !== 0; break; }
        case "div": case "idiv": {
          need(1); const d = M.read(a, 4, n); if (!d) throw new AsmError(n, "#DE divide by zero");
          if (op === "div") { const num = (BigInt(M.reg.edx >>> 0) << 32n) | BigInt(M.reg.eax >>> 0); const q = num / BigInt(d); if (q > 0xffffffffn) throw new AsmError(n, "#DE quotient overflow (did you zero edx?)"); M.reg.eax = Number(q) >>> 0; M.reg.edx = Number(num % BigInt(d)) >>> 0; }
          else { const num = BigInt.asIntN(64, (BigInt(M.reg.edx >>> 0) << 32n) | BigInt(M.reg.eax >>> 0)); const dd = BigInt(d | 0); const q = num / dd; if (q > 0x7fffffffn || q < -0x80000000n) throw new AsmError(n, "#DE quotient overflow (did you cdq?)"); M.reg.eax = Number(BigInt.asUintN(32, q)); M.reg.edx = Number(BigInt.asUintN(32, num % dd)); }
          break;
        }
        case "cdq": M.reg.edx = (M.reg.eax & 0x80000000) ? 0xffffffff : 0; break;
        case "push": need(1); push(M.read(a, 4, n), n); break;
        case "pop": need(1); M.write(a, pop(n), 4, n); break;
        case "call": need(1); push(ip + 1, n); next = target(a, n); break;
        case "ret": next = pop(n); if (next !== RET && (next < 0 || next >= prog.length)) throw new AsmError(n, "ret to a garbage address (stack unbalanced?)"); break;
        case "jmp": need(1); next = target(a, n); break;
        case "loop": need(1); M.reg.ecx = (M.reg.ecx - 1) >>> 0; if (M.reg.ecx) next = target(a, n); break;
        default:
          if (JCC[op]) { need(1); if (JCC[op](M.f)) next = target(a, n); break; }
          throw new AsmError(n, `unsupported instruction "${op}"`);
      }
      ip = next;
    }
    return { M, steps };
  }

  /* kata test lines: "ecx=5, esi=0x1000, mem:0x1000='hi\0'"  ->  "eax=120" or "mem:0x2000='olleh'" */
  function parseState(s) {
    const items = []; const re = /\s*(mem:(0x[0-9a-f]+|\d+)\s*=\s*('(?:[^'\\]|\\.)*'|\[[^\]]*\])|([a-z]{2,3})\s*=\s*(-?0x[0-9a-f]+|-?\d+))\s*,?/gi; let m;
    while ((m = re.exec(s))) {
      if (m[2]) {
        let bytes;
        if (m[3].startsWith("'")) bytes = [...m[3].slice(1, -1).replace(/\\0/g, "\0").replace(/\\n/g, "\n")].map(c => c.charCodeAt(0));
        else bytes = m[3].slice(1, -1).split(",").filter(x => x.trim()).map(x => parseNum(x) & 0xff);
        items.push({ mem: parseNum(m[2]), bytes, text: m[3] });
      } else items.push({ reg: m[4].toLowerCase(), v: parseNum(m[5]) >>> 0 });
    }
    return items;
  }
  const hex = v => "0x" + (v >>> 0).toString(16);
  function test(src, given, want) {
    const g = parseState(given), w = parseState(want);
    const { M, steps } = run(src, M => { for (const x of g) { if (x.reg) M.write({ k: "r", r: x.reg }, x.v, 4, 0); else M.mem.set(x.bytes, x.mem); } });
    const bad = [];
    for (const x of w) {
      if (x.reg) { const got = M.read({ k: "r", r: x.reg, size: SUB[x.reg] ? SUB[x.reg][2] / 8 : 4 }, 0, 0); if (got !== x.v) bad.push(`${x.reg}=${got} (${hex(got)}), want ${x.v} (${hex(x.v)})`); }
      else { const got = [...M.mem.slice(x.mem, x.mem + x.bytes.length)]; if (got.join() !== x.bytes.join()) bad.push(`mem ${hex(x.mem)} = [${got.map(b => b.toString(16).padStart(2, "0")).join(" ")}], want [${x.bytes.map(b => b.toString(16).padStart(2, "0")).join(" ")}]`); }
    }
    return { ok: !bad.length, msg: bad.join("; "), steps, regs: Object.fromEntries(R32.map(r => [r, M.reg[r] >>> 0])) };
  }
  root.X86 = { assemble, run, test, AsmError };
  if (typeof module !== "undefined") module.exports = root.X86;
})(typeof self !== "undefined" ? self : globalThis);
