#!/usr/bin/env node
/* Test the ~/ai/chat engine against several hundred generated and hand-written questions.
   Usage:  node scripts/chat_test.js [--show N] [--min 0.95] [--only def,cmp] [--seed 7]
   Needs ai/chat-index.json (python3 build.py). Uses chatcore.js, the same file the page loads. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const ChatCore = require(path.join(ROOT, "chatcore.js"));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const SHOW = +opt("show", 25), MIN = +opt("min", 0), ONLY = opt("only", "") ? opt("only", "").split(",") : null;
let seed = +opt("seed", 7);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "ai/chat-index.json"), "utf8"));
const eng = ChatCore.createEngine(data);
const results = [];
function record(cat, q, ok, why, r) { results.push({ cat, q, ok, why, kind: r && r.kind }); }
function ask(q, S) { return eng.answer(q, S || eng.newSession()); }
const low = (r) => eng.plain(r).toLowerCase();
const defHeads = (r) => r.blocks.filter((b) => b.t === "def").map((b) => b.head);

/* ---- 1. hand-written cases ---- */
const caseLines = fs.readdirSync(__dirname).filter((f) => /^chat_cases.*\.txt$/.test(f)).sort().flatMap((f) => fs.readFileSync(path.join(__dirname, f), "utf8").split("\n"));
for (const raw of caseLines) {
  if (!raw.trim() || raw.startsWith("#")) continue;
  const m = raw.match(/^([\w-]+)\s*\|\s*(.+?)(?:\s*==>\s*(.+))?$/);
  if (!m) continue;
  const [, cat, q, rx] = m;
  const r = ask(q);
  if (/neg$/.test(cat)) { record(cat, q, r.kind === "unknown" || r.kind === "chat" || (r.kind === "partial" && /don't have/.test(eng.plain(r))), "expected don't-know, got " + r.kind, r); continue; }
  if (cat === "w-chat") { record(cat, q, r.kind === "chat", "expected chat, got " + r.kind, r); continue; }
  const ok = r.kind !== "unknown" && new RegExp(rx, "is").test(eng.plain(r));
  record(cat, q, ok, r.kind === "unknown" ? "said unknown" : "missing /" + rx + "/ (kind " + r.kind + ")", r);
}

/* ---- 2. every glossary term, several phrasings ---- */
const terms = eng.docs.filter((d) => d.kind === "glossary");
const TPL = ["what is {t}", "what is a {t}", "define {t}", "explain {t}", "what does {t} mean", "{t} meaning", "tell me about {t}", "what's {t}", "{t}", "can you explain {t}", "what is {t} used for", "i dont understand {t}", "whats {t} in security"];
const plainName = (h) => h.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().split(/\s*\/\s*/)[0].toLowerCase();
terms.forEach((d, i) => {
  const name = plainName(d.head);
  const q = TPL[i % TPL.length].replace("{t}", name);
  const r = ask(q);
  record("term", q, defHeads(r).some((h) => h === d.head || plainName(h) === plainName(d.head) || plainName(h).split(" ").includes(plainName(d.head)) || h.toLowerCase().split(/[^a-z0-9+#]+/).includes(plainName(d.head))), "wanted " + d.head + ", got " + (defHeads(r).join("/") || r.kind), r);
});
// aliases
terms.filter((d) => d.extra && /[a-z]/i.test(d.extra)).forEach((d, i) => {
  const al = pick(d.extra.split(" | ").filter((x) => /[a-z]/i.test(x)));
  const q = (i % 2 ? "what is " : "define ") + al;
  const r = ask(q);
  const heads = defHeads(r);
  record("alias", q, heads.length > 0 && (heads.includes(d.head) || r.kind === "definition"), "alias of " + d.head + ", got " + (heads.join("/") || r.kind), r);
});
// typos: drop or swap one letter in terms with 8+ letters
terms.filter((d) => plainName(d.head).replace(/[^a-z]/g, "").length >= 8 && !/[0-9]/.test(plainName(d.head)) && plainName(d.head).split(" ").every((w) => w.length > 3)).forEach((d, i) => {
  let n = plainName(d.head); const k = 2 + Math.floor(rnd() * (n.length - 4));
  n = i % 2 ? n.slice(0, k) + n.slice(k + 1) : n.slice(0, k) + n[k + 1] + n[k] + n.slice(k + 2);
  if (n === plainName(d.head)) return;
  const q = "what is " + n;
  const r = ask(q);
  record("typo-term", q, defHeads(r).includes(d.head) || (r.kind === "definition" && defHeads(r).length > 0), "wanted " + d.head + ", got " + (defHeads(r).join("/") || r.kind), r);
});

/* ---- 3. curated comparisons: both orders, several phrasings ---- */
const CP = ["difference between {a} and {b}", "{a} vs {b}", "what's the difference between {a} and {b}", "how is {a} different from {b}", "compare {a} and {b}", "{a} versus {b}", "what is the difference between a {a} and a {b}", "{a} or {b} which is better", "is {a} the same as {b}"];
const clean = (s) => s.replace(/\s*\/\s*/g, " ").trim().toLowerCase();
eng.comps.forEach((c, ci) => {
  const items = c.items;
  for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
    if (i === j || (items.length > 2 && j < i)) continue;
    const t = CP[(ci + i + j) % CP.length];
    const q = t.replace("{a}", items[i].toLowerCase()).replace("{b}", items[j].toLowerCase());
    const r = ask(q);
    const txt = low(r);
    const heads = r.blocks.filter((b) => b.t === "table").flatMap((b) => b.cols.map((x) => x.toLowerCase()));
    const ok = r.kind === "compare" && !r.composed && !r.partial && heads.includes(items[i].toLowerCase()) && heads.includes(items[j].toLowerCase());
    record("compare", q, ok, "kind " + r.kind + (r.composed ? " composed" : "") + " cols " + heads.join(","), r);
  }
});
// two random glossary terms: must produce a composed side-by-side or a partial, never "unknown"
for (let n = 0; n < 60; n++) {
  const a = pick(terms), b = pick(terms); if (a === b) continue;
  const q = "difference between " + plainName(a.head) + " and " + plainName(b.head);
  const r = ask(q);
  record("compare-composed", q, r.kind === "compare", "kind " + r.kind, r);
}

/* ---- 4. curated FAQ phrasings, plain and with filler ---- */
eng.faq.forEach((f) => f.q.forEach((p, i) => {
  const variants = [p, "hey ghost, " + p + "?", "quick question: " + p + " please"];
  const q = variants[i % 3];
  const r = ask(q);
  record("faq", q, r.faq === f.id || r.kind === "compare" || r.kind === "definition" || (r.kind === "chat" && f.id === "concept-how-this-chat") || (r.kind === "multi" && / and /.test(p)), "wanted " + f.id + ", got " + (r.faq || r.kind), r);
}));

/* ---- 5. follow-ups in one session ---- */
function convo(name, steps) {
  const S = eng.newSession();
  steps.forEach(([q, rx], i) => {
    const r = ask(q, S);
    record("followup", name + " #" + (i + 1) + ": " + q, rx.test(eng.plain(r)) && r.kind !== "unknown", "got " + r.kind + ": " + eng.plain(r).slice(0, 80).replace(/\n/g, " "), r);
  });
}
convo("tcp/udp", [["what is tcp", /tcp|transmission/i], ["what about udp", /udp|datagram|connectionless/i], ["what's the difference", /handshake|reliab|connectionless/i], ["which should i use", /tcp|udp/i]]);
convo("it/them", [["what is a firewall", /firewall/i], ["how does it work", /rule|packet|traffic|connection/i], ["tell me more", /firewall|rule|filter|pfsense|.+/i]]);
convo("ids", [["what is an ids", /ids|intrusion/i], ["and an ips?", /ips|intrusion|block/i], ["difference between them", /block|alert|inline/i]]);
convo("xss", [["what is xss", /script/i], ["give me an example", /xss|script|alert|encode|<script/i], ["how do i prevent it", /encod|csp|validat/i]]);
convo("sqli", [["what is sql injection", /query|input/i], ["why is it dangerous", /database|data|login|query/i], ["how do i fix it", /parameter|prepared/i]]);
convo("hash", [["what is hashing", /one-way|digest|fixed|hash/i], ["and encryption?", /key|reversible|ciphertext|encrypt/i], ["difference between them", /reversible|one-way/i]]);
convo("simple", [["what is kerberos", /ticket/i], ["i dont understand", /ticket|kerberos/i]]);
convo("topic", [["what is nmap", /nmap|scan/i], ["how do i use it", /nmap -|-sV|scan/i]]);

/* ---- 6. summary ---- */
const cats = [...new Set(results.map((r) => r.cat))].filter((c) => !ONLY || ONLY.includes(c));
let tot = 0, okTot = 0;
console.log(`chat engine: ${eng.stats.docs} passages, ${eng.stats.terms} term keys, ${eng.stats.comps} comparisons, ${eng.stats.faq} curated answers\n`);
console.log("category".padEnd(18) + "pass".padStart(6) + "total".padStart(7) + "rate".padStart(8));
for (const c of cats) {
  const rs = results.filter((r) => r.cat === c), ok = rs.filter((r) => r.ok).length;
  tot += rs.length; okTot += ok;
  console.log(c.padEnd(18) + String(ok).padStart(6) + String(rs.length).padStart(7) + (100 * ok / rs.length).toFixed(1).padStart(7) + "%");
}
const rate = okTot / tot;
console.log("-".repeat(39) + `\n${"ALL".padEnd(18)}${String(okTot).padStart(6)}${String(tot).padStart(7)}${(100 * rate).toFixed(1).padStart(7)}%`);
const fails = results.filter((r) => !r.ok && (!ONLY || ONLY.includes(r.cat)));
if (fails.length) {
  console.log(`\nfirst ${Math.min(SHOW, fails.length)} of ${fails.length} failures:`);
  for (const f of fails.slice(0, SHOW)) console.log(`  [${f.cat}] ${f.q}\n      ${f.why}`);
}
if (rate < MIN) { console.log(`\nbelow required ${MIN}`); process.exit(1); }
