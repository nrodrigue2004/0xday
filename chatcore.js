/* ~/ai/chat engine: no DOM, runs in the browser and in Node (scripts/chat_test.js uses the same file).
   createEngine(data) takes the parsed ai/chat-index.json and returns an object with answer(question, session).
   answer() returns { kind, blocks, hits, topic } where blocks are plain data (the page escapes and renders them).
   Pipeline: small talk -> split multi-part questions -> follow-ups -> comparison -> definition -> curated FAQ
   -> how / why / list / command passages -> "I don't know" with the closest pages.
   Everything is lookup and ranking over the site's own text. Nothing is generated and nothing leaves the browser. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ChatCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- text helpers ---------------- */
  const STOP = new Set(("a an and are as at be been being but by can could do does did doing for from has have how i if in into is it its me my of on or so than that the their them then there these they this to us was we what when where which who why will with would should you your about explain tell give show please define mean means vs versus between difference differences am im work works working meaning").split(" "));
  const KEEP = new Set(["ids", "ips", "dns", "is", "ssh", "ssl", "https", "aws", "vms", "gps", "plus"]);
  function stem(w) {
    if (w.length < 5 || KEEP.has(w)) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + "y";
    if (/(ss|us|is)$/.test(w)) return w;
    if (/sses$/.test(w)) return w.slice(0, -2);
    if (/ing$/.test(w) && w.length > 6) return w.slice(0, -3);
    if (/ed$/.test(w) && w.length > 5) return w.slice(0, -2);
    if (/es$/.test(w) && /(x|ch|sh|s|z)es$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(s, drop) {
    const out = [];
    for (const w of s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(" ")) {
      const t = w.replace(/^[.+#]+|[.]+$/g, "");
      if (!t || (drop && STOP.has(t))) continue;
      out.push(stem(t));
      if (t.includes(".") && t.length > 3) for (const p of t.split(".")) if (p) out.push(stem(p));
    }
    return out;
  }
  const compact = (x) => String(x).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9+#]+/g, "");
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
  function lev(a, b, max) { // Damerau-Levenshtein (optimal string alignment): a swapped pair of letters counts as one typo
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let pp = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > max) return max + 1;
      pp = prev; prev = cur;
    }
    return prev[b.length];
  }

  /* normalise a raw question: lowercase, fix common shorthand and typos of the question words, drop filler */
  function norm(q) {
    let c = String(q).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
    c = c.replace(/\bip ?v ?(4|6)\b/g, "ipv$1").replace(/\bip version ?(4|6)\b/g, "ipv$1");
    c = c.replace(/\bcan'?t\b/g, "cannot").replace(/\bwon'?t\b/g, "wont").replace(/\bdoesn'?t\b/g, "doesnt").replace(/\bdon'?t\b/g, "dont").replace(/\bisn'?t\b/g, "isnt");
    c = c.replace(/\bdiff(?:e?r[ae]nc?e?s?|s)?\b/g, "difference").replace(/\bdiferences?\b|\bdifferences?\b|\bdifferance\b|\bdifferenece\b|\bdiffrence\b/g, "difference");
    c = c.replace(/\bdif\w{3,9}\b/g, (w) => (/^(?:different|differ|differs|differently|differential|differing|differentiate|diff)$/.test(w) || lev(w, "difference", 3) > 3 ? w : "difference"));
    c = c.replace(/\bwat\b|\bwhat's\b|\bwhats\b|\bwhts\b|\bwut\b/g, "what is").replace(/\bwhy's\b/g, "why is").replace(/\bhows\b|\bhow's\b/g, "how is");
    c = c.replace(/\bhwo\b|\bhwat\b/g, "how").replace(/\bwhta\b|\bwaht\b/g, "what").replace(/\bwhats is\b/g, "what is").replace(/\bwhat is is\b/g, "what is");
    c = c.replace(/\bbetwen\b|\bbetween\b|\bbtwn\b|\bb\/w\b|\bbtw\b/g, "between").replace(/\bversus\b|\bvs\.?(?=\s|$)/g, " vs ").replace(/\bv\.\s/g, " vs ");
    c = c.replace(/\bcyber ?security\b|\bcyber(?! (?:kill|range|chain|crime))\b|\binfosec\b/g, "cybersecurity");
    c = c.replace(/\b(a|network|security|cysa|pentest|linux|server|cloud|project) plus\b/g, "$1+");
    c = c.replace(/\bu\b/g, "you").replace(/\bur\b/g, "your").replace(/\br\b/g, "are").replace(/\bpls\b|\bplz\b/g, "please").replace(/\bhow to's\b/g, "how to");
    c = c.replace(/\s*\b(?:in (?:simple|plain|easy|layman'?s) (?:terms|english|words)|for beginners|for a beginner|eli5|briefly|simply|in short|quickly)\b/g, "");
    // polite openers
    c = c.replace(/^(?:hey|hi|hello|yo|ok|okay|so|um|uh|well|hmm+|ghost(?:-ai)?)[,!.]?\s+(?=\S)/, "").replace(/^(?:ghost(?:-ai)?)[,!.]?\s+(?=\S)/, "");
    c = c.replace(/^(?:please\s+)+/, "");
    c = c.replace(/^(?:(?:i was|i am|im|i'm|i just)\s+(?:just\s+)?(?:wondering|curious|trying to (?:understand|learn|figure out|find out)|looking to learn)(?: about| if| whether)?|quick question|one question|i have a question|i need to know|i want to know|i would like to know|i'd like to know|i wanna know|do you know|can you|could you|would you|will you|can someone|could someone|anyone know|does anyone know)[,:]?\s*(?:please\s+)?(?:tell me\s+|let me know\s+|explain to me\s+|help me understand\s+|teach me\s+|show me\s+|give me\s+)?(?:if |whether |that )?/, "");
    c = c.replace(/^(?:tell me|let me know)\s+(?=what|how|why|which|who|when|where)/, "").replace(/\s+(?:please|thanks|thank you|pls|thx)[.!?]*$/, "");
    c = c.replace(/[?!]+$/g, "").replace(/\.+$/, "").trim();
    return c || String(q).toLowerCase().replace(/[?!.]+$/g, "").trim();
  }

  /* ---------------- engine ---------------- */
  function createEngine(data) {
    const docs = data.recs.map((r) => ({ url: r[0], page: r[1], head: r[2], kind: r[3], text: r[4], extra: r[5] || "", links: r[6] || [] }));
    const inv = new Map(); let total = 0;
    docs.forEach((doc, i) => {
      const tf = new Map();
      const add = (arr, wt) => { for (const t of arr) tf.set(t, (tf.get(t) || 0) + wt); };
      const body = tokens(doc.text, true), hd = tokens(doc.head + " " + doc.page, true);
      add(body, 1); add(hd, 3);
      doc.len = body.length + hd.length * 3; total += doc.len;
      doc.hset = new Set(hd);
      for (const [t, n] of tf) { let a = inv.get(t); if (!a) inv.set(t, (a = [])); a.push([i, n]); }
    });
    const X = { docs, inv, avg: total / docs.length, vocab: [...inv.keys()] };
    const byLen = new Map();
    for (const v of X.vocab) { let a = byLen.get(v.length); if (!a) byLen.set(v.length, (a = [])); a.push(v); }

    /* ---- typo repair for one unknown word: nearest vocabulary word, preferring common ones ---- */
    function repair(t) {
      const max = t.length >= 9 ? 2 : 1; let best = null, bd = max + 1, bn = 0;
      for (let L = t.length - max; L <= t.length + max; L++) {
        for (const v of byLen.get(L) || []) {
          if (v[0] !== t[0] && t.length < 7) continue;
          const d = lev(t, v, max), n = inv.get(v).length;
          if (d <= max && (d < bd || (d === bd && n > bn))) { bd = d; best = v; bn = n; }
        }
      }
      return best;
    }

    /* ---- BM25 search ---- */
    function search(q, k, opt) {
      opt = opt || {};
      const N = docs.length;
      let qt = [...new Set(tokens(q, true))];
      if (!qt.length) qt = [...new Set(tokens(q, false))];
      const terms = [], fixed = [];
      for (const t of qt) {
        if (inv.has(t)) terms.push([t, 1, t]);
        else if (t.length >= 5) {
          const m = X.vocab.filter((v) => v.startsWith(t)).slice(0, 3);
          if (m.length) m.forEach((v) => terms.push([v, 0.7, t]));
          else { const r = t.length >= 5 ? repair(t) : null; if (r) { terms.push([r, 0.8, t]); fixed.push([t, r]); } }
        }
      }
      if (!terms.length) return { hits: [], terms: [], asked: qt.length, fixed };
      const sc = new Map(), cov = new Map();
      for (const [t, w, o] of terms) {
        const post = inv.get(t), idf = Math.log(1 + (N - post.length + 0.5) / (post.length + 0.5));
        for (const [i, f] of post) {
          const d = docs[i], k1 = 1.4, b = 0.75;
          const s = idf * w * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / X.avg)));
          sc.set(i, (sc.get(i) || 0) + s); (cov.get(i) || cov.set(i, new Set()).get(i)).add(o);
        }
      }
      const prefer = opt.prefer || {};
      const ranked = [...sc].map(([i, s]) => {
        const d = docs[i], c = cov.get(i).size / qt.length;
        let hb = 0; for (const [t] of terms) if (d.hset.has(t)) hb += 0.5;
        return { d, score: (s + hb) * (0.4 + 0.6 * c) * (prefer[d.kind] || 1), cov: c };
      }).sort((a, b) => b.score - a.score);
      const hits = [], perPage = new Map();
      for (const r of ranked) {
        if (opt.skip && opt.skip.has(r.d.url + "|" + r.d.head)) continue;
        const key = r.d.url.split("#")[0];
        if ((perPage.get(key) || 0) >= 2) continue;
        if (hits.some((h) => h.d.text === r.d.text)) continue;
        perPage.set(key, (perPage.get(key) || 0) + 1);
        hits.push(r);
        if (hits.length >= k) break;
      }
      return { hits, terms: terms.map((t) => t[0]), asked: qt.length, fixed };
    }
    const confident = (res) => {
      if (!res.hits.length) return false;
      const h = res.hits[0];
      if (h.cov < 0.6 || h.score < 3.5) return false;
      // one lone matched word is only trustworthy when the passage is headed by it
      if (res.asked <= 1 || res.terms.length <= 1) { const t = res.terms[0]; if (!(t && h.d.hset.has(t)) || h.d.kind === "card" || h.d.head.split(" ").length > 8) return false; }
      return true;
    };

    /* ---- glossary term lookup ---- */
    const TERMS = new Map();
    const put = (k, d) => { k = compact(k); if (k.length >= 2 || (k === "c" && d.head === "C")) { if (!TERMS.has(k)) TERMS.set(k, d); } };
    const accr = (head) => { const par = head.match(/\(([^)\s]{2,6})\)/); return par && /^[A-Z0-9]/.test(par[1]) ? par[1] : null; };
    const gl = docs.filter((d) => d.kind === "glossary");
    for (const d of gl) {            // pass 1: real names win over aliases that other terms list
      put(d.head, d);
      put(d.head.replace(/\([^)]*\)/g, ""), d);
      for (const part of d.head.split(/\s*\/\s*/)) put(part.replace(/\([^)]*\)/g, ""), d);
    }
    for (const d of gl) {            // pass 2: acronym in brackets, then aliases
      const ac = accr(d.head); if (ac) put(ac, d);
      for (const al of d.extra.split(" | ")) if (al) put(al, d);
    }
    const trimTerm = (raw) => raw.toLowerCase().replace(/[?!.]+$/g, "").replace(/^(?:an?|the|some|this|that|these|those|what is|what are)\s+/, "").replace(/^(?:thing|something|word|term|concept) called\s+/, "").replace(/\s+(?:thing|stuff|protocol|term|concept|attack|attacks)$/, (m, off, s) => (TERMS.has(compact(s)) ? m : "")).trim();
    function lookupKey(k) { return TERMS.get(k) || null; }
    function findTerm(raw, exactOnly) {
      const w = trimTerm(raw); if (!w) return null;
      for (const k of [compact(w), compact(raw.toLowerCase().replace(/[?!.]+$/g, "").trim()), compact(w.replace(/ies$/, "y")), compact(w.replace(/es$/, "")), compact(w.replace(/s$/, "")), compact(w.replace(/'s$/, ""))]) { const d = lookupKey(k); if (d) return { d, fuzzy: false }; }
      if (exactOnly) return null;
      const rawc = compact(raw.toLowerCase().replace(/^(?:an?|the|some)\s+/, ""));
      for (const c of [...new Set([compact(w), rawc])]) {
        if (c.length < 5) continue;
        const max = c.length >= 10 ? 2 : 1; let best = null, bd = max + 1;
        for (const [k, d] of TERMS) { if (k.length < 5 || k.replace(/\D/g, "") !== c.replace(/\D/g, "")) continue; const x = lev(c, k, max); if (x < bd) { bd = x; best = d; } }
        if (best) return { d: best, fuzzy: true };
      }
      return null;
    }
    const TWO = new Set(["it", "is", "as", "an", "or", "in", "on", "to", "go", "do", "be", "we", "he", "me", "my", "us", "so", "no", "of", "at", "by", "if", "up", "am", "hr", "id"]);
    const GENERIC = new Set(["log", "process", "model", "port", "session", "cache", "scope", "index", "driver", "packet", "patch", "risk", "backup", "hash", "event", "cookie", "linux", "shell", "thread", "registry", "kernel", "algorithm", "binary", "database", "certificate", "gateway", "proxy", "sandbox", "database"]);
    /* every glossary term mentioned inside a longer question, longest phrase first, no overlaps */
    function termsIn(q) {
      const ws = q.toLowerCase().replace(/[^a-z0-9+#./& -]+/g, " ").split(/\s+/).filter(Boolean);
      const used = new Array(ws.length).fill(false), found = [];
      for (let n = Math.min(5, ws.length); n >= 1; n--) {
        for (let i = 0; i + n <= ws.length; i++) {
          if (used.slice(i, i + n).some(Boolean)) continue;
          const phrase = ws.slice(i, i + n).join(" ");
          if (n === 1 && (STOP.has(phrase) || TWO.has(phrase) && !/^(?:ai|os|ip|ml|c2|id)$/.test(phrase))) continue;
          if (n === 1 && ws.length > 1 && GENERIC.has(phrase) && false) continue;
          const f = findTerm(phrase, true);
          if (f) { found.push({ d: f.d, at: i, phrase }); for (let j = i; j < i + n; j++) used[j] = true; }
        }
      }
      return found.sort((a, b) => a.at - b.at);
    }

    /* ---- curated comparisons ---- */
    const comps = data.comps || [];
    const compKeys = new Map();   // compact(name or alias) -> [[compIdx, itemIdx]]
    comps.forEach((c, ci) => {
      c.items.forEach((name, ii) => {
        const own = new Set([compact(name)]), viaTerm = new Set();
        for (const part of name.split(/\s*\/\s*/)) own.add(compact(part));
        for (const [a, b] of Object.entries(c.alias || {})) if (compact(b) === compact(name)) own.add(compact(a));
        const f = findTerm(name, true);
        if (f && compact(f.d.head.replace(/\([^)]*\)/g, "").split(/\s*\/\s*/)[0]) === compact(name)) { viaTerm.add(compact(f.d.head)); for (const al of f.d.extra.split(" | ")) if (al) viaTerm.add(compact(al)); const ac = accr(f.d.head); if (ac) viaTerm.add(compact(ac)); }
        const add = (k, rank) => { if (k.length < 1) return; let a = compKeys.get(k); if (!a) compKeys.set(k, (a = [])); a.push([ci, ii, rank]); };
        for (const k of own) add(k, 0);
        for (const k of viaTerm) if (!own.has(k)) add(k, 1);
      });
    });
    for (const a of compKeys.values()) a.sort((x, y) => x[2] - y[2]);
    function compCandidates(item) {
      const w = trimTerm(item);
      for (const k of [compact(w), compact(w.replace(/ies$/, "y")), compact(w.replace(/es$/, "")), compact(w.replace(/s$/, ""))]) if (compKeys.has(k)) return compKeys.get(k);
      const c = compact(w);
      if (c.length >= 4) { let bk = null; for (const [k, v] of compKeys) if (k.length > c.length && k.length - c.length <= 4 && k.startsWith(c) && (!bk || k.length < bk[0].length)) bk = [k, v]; if (bk) return bk[1]; }
      if (c.length >= 5) { const max = c.length >= 10 ? 2 : 1; let best = null, bd = max + 1; for (const [k, v] of compKeys) { if (k.length < 5) continue; const x = lev(c, k, max); if (x < bd) { bd = x; best = v; } } if (best) return best; }
      return null;
    }
    function findComp(items) {
      const cands = items.map(compCandidates);
      if (cands.some((c) => !c)) return null;
      let best = null;
      const assign = (ci, k, used) => { // backtracking: each asked item takes a distinct column of this comparison
        if (k === cands.length) return [];
        for (const p of cands[k]) {
          if (p[0] !== ci || used.includes(p[1])) continue;
          const rest = assign(ci, k + 1, used.concat(p[1]));
          if (rest) return [p[1]].concat(rest);
        }
        return null;
      };
      for (let ci = 0; ci < comps.length; ci++) {
        const idx = assign(ci, 0, []);
        if (idx) { const extra = comps[ci].items.length - items.length; if (!best || extra < best.extra) best = { ci, idx, extra }; }
      }
      return best;
    }

    /* ---- curated FAQ: scored against every phrasing ---- */
    const faq = data.faq || [];
    const faqDf = new Map(); let faqN = 0;
    const faqP = [];
    faq.forEach((f, fi) => f.q.forEach((p) => { const set = new Set(tokens(norm(p), true)); faqP.push({ fi, set, p }); faqN++; for (const t of set) faqDf.set(t, (faqDf.get(t) || 0) + 1); }));
    const fw = (t) => Math.log(1 + faqN / (faqDf.get(t) || 0.5));
    function faqMatch(q) {
      const qs = new Set(tokens(q, true)); if (!qs.size) return null;
      let WQ = 0; for (const t of qs) WQ += fw(t);
      let best = null;
      for (const f of faqP) {
        let I = 0, WP = 0, n = 0; for (const t of f.set) WP += fw(t);
        for (const t of f.set) if (qs.has(t)) { I += fw(t); n++; }
        if (!WP || !n) continue;
        const sc = (I / WP) * (0.55 + 0.45 * (I / WQ)) + 0.004 * n;
        const frac = I / WQ;                      // how much of the question this phrasing explains
        if (frac < 0.5 || (f.set.size <= 2 && frac < 0.8)) continue;
        if ((n >= 2 || f.set.size === 1) && (!best || sc > best.sc)) best = { sc, fi: f.fi, p: f.p };
      }
      return best && best.sc >= 0.62 ? { f: faq[best.fi], sc: best.sc, p: best.p } : null;
    }

    /* ---------------- blocks ---------------- */
    const label = (d) => (d.kind === "glossary" ? d.head : d.page + (d.head ? " > " + d.head : ""));
    const kindLabel = (k) => ({ history: "history", case: "case", guide: "guide", card: "flashcard", glossary: "glossary", man: "cheatsheet", "Security+": "Security+", ai: "ai", drill: "drill" }[k] || k);
    const srcBlock = (hits, caption) => ({ t: "src", caption: caption || "sources (best match first). These are quotes from the site, not generated text.", hits: hits.map((h) => ({ url: h.d.url, label: label(h.d), kind: kindLabel(h.d.kind), snip: clip(h.d.text.replace(/\n+/g, " "), 220) })) });
    const defBlock = (d) => ({ t: "def", head: d.head, text: d.text.slice(d.head.length + 1).trim(), url: d.url, links: d.links.length ? d.links : [], ref: d.url });
    const say = (text) => ({ t: "say", text });
    const GUIDE_LINKS = { t: "links", caption: "browse", items: [{ url: "learn.html", label: "~/learn" }, { url: "glossary.html", label: "~/glossary" }, { url: "secplus.html", label: "~/secplus" }] };

    function bestSentences(text, terms, n) {
      const parts = text.split(/\n+/).flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z0-9`(])/)).map((s) => s.trim()).filter((s) => s.length > 20);
      if (parts.length <= n) return parts;
      const scored = parts.map((s, i) => { const tk = new Set(tokens(s, true)); let c = 0; for (const t of terms) if (tk.has(t)) c++; return { s, i, c }; });
      return scored.sort((a, b) => b.c - a.c || a.i - b.i).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
    }
    const CODEY = /^(?:[$#] |sudo |nmap |ssh |curl |wget |git |docker |kubectl |python3? |pip |ls\b|cd |cat |grep |chmod |chown |ping |ip |ifconfig |netstat |ss |dig |nslookup |tcpdump |tshark |journalctl |systemctl |get-|set-|new-|select-|import-|\w+ -{1,2}\w)/i;

    function passageBlocks(res, mode, qraw) {
      const top = res.hits[0].d, out = [];
      if (top.kind === "card") out.push({ t: "quote", text: top.text, url: top.url, label: label(top) });
      else if (top.kind === "glossary") out.push(defBlock(top));
      else if (top.kind === "resource") out.push({ t: "quote", text: top.text, url: top.extra, label: "resource", ext: true });
      else {
        const lines = top.text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
        const code = lines.filter((l) => CODEY.test(l));
        if (mode === "command" && code.length) out.push({ t: "code", lines: code.slice(0, 8).map((l) => clip(l, 160)), url: top.url, label: label(top) });
        else if (mode === "list" && lines.length >= 3) out.push({ t: "steps", items: lines.slice(0, 12).map((l) => clip(l, 200)), url: top.url, label: label(top) });
        else out.push({ t: "quote", text: bestSentences(top.text, res.terms, 3).map((s) => clip(s, 320)).join("\n"), url: top.url, label: label(top) });
      }
      out.push(srcBlock(res.hits));
      return out;
    }

    /* ---------------- question parsing ---------------- */
    const DEF_RE = /^(?:what is meant by|what do people mean by|what do you mean by|what does the term|what does|what do you know about|what is the meaning of|what the (?:heck|hell) is|what(?: is| are| was| were)(?: exactly| even| actually)?|define the term|define|definition of|give me a definition of|explain like i'm 5|explain|describe|tell me about|meaning of|who is|who are|teach me about|teach me|intro to|introduction to|overview of|basics of|info on|information on|learn about|i want to learn about|help me understand|understand|eli5|i dont understand|i do not understand|i dont get|i dont know what|i dont know about|i am confused about|im confused about|confused about|not sure what|no idea what|ok so what is|what is the deal with|help with|a quick explanation of|a summary of|summary of|what is the point of)\s+(.+)$/;
    const DEF_TAIL = /\s+(?:mean|means|stand for|stands for|do|does|used for|use for|is used for|are used for|good for|for|work|works|exactly|really|actually|anyway|even|is|are|in security|in networking|in cybersecurity|in computing|in it|in tech|in programming|in computer science|in cyber|in infosec|in ai|in ml|in the cloud|about)$/;
    function termQuestion(c) {
      let m = c.match(DEF_RE);
      if (m) { let t = m[1]; for (let i = 0; i < 3; i++) t = t.replace(DEF_TAIL, ""); return { term: t.trim(), asked: true }; }
      m = c.match(/^(.+?)\s+(?:meaning|definition|definitions|explained|explanation|basics|overview|101|for dummies|summary|info|information|in simple terms|in a nutshell)$/);
      if (m) return { term: m[1], asked: true };
      m = c.match(/^(?:what is|what are)\s+(?:an?\s+)?(.+?)\s+(?:and why does it matter|and why is it important)$/);
      if (m) return { term: m[1], asked: true };
      if (c.split(" ").length <= 3 && !/^(help|clear|search|about)$/.test(c)) return { term: c, asked: false };
      return null;
    }

    function splitItems(tail) {
      return tail.split(/\s*(?:,\s*(?:and\s+|or\s+|vs\s+)?|\s+and\s+|\s+vs\s+|\s+or\s+|\s*&\s*|\s+versus\s+)\s*/).map((x) => x.trim().replace(/^(?:the|a|an)\s+/, "")).filter(Boolean);
    }
    function parseCompare(c) {
      let m, tails = [], explicit = false;
      const T = (t, ex) => { if (t) tails.push(t); if (ex !== false) explicit = true; };
      if ((m = c.match(/^(?:what is |what are )?(?:the )?(?:(?:main|key|major|real|basic|big|actual|biggest|simple|primary|important|essential)\s+)?(?:difference|distinction|contrast|similarit(?:y|ies))(?: and (?:difference|similarit(?:y|ies)))?\s+(?:is |are )?(?:between|of|with|in)\s+(.+)$/))) T(m[1]);
      else if ((m = c.match(/^(?:compare|contrast|comparison of|comparison between|compare and contrast|compare\/contrast|compare with)\s+(.+)$/))) T(m[1]);
      else if ((m = c.match(/^how\s+(?:is|are|does|do|would)\s+(.+?)\s+(?:differ|different|compare|compared|distinct|vary|varies)\s+(?:from|to|than|with)\s+(.+)$/))) T(m[1] + " vs " + m[2]);
      else if ((m = c.match(/^(?:is|are|does|do|can)\s+(.+?)\s+(?:the same as|same as|different (?:from|than|to)|better than|worse than|faster than|slower than|safer than|more secure than|the same thing as|similar to|equal to|really different from|just|another word for|synonymous with)\s+(.+)$/))) T(m[1] + " vs " + m[2]);
      else if ((m = c.match(/^(.+?)\s+(?:compared (?:to|with)|as opposed to|instead of|rather than|against)\s+(.+)$/))) T(m[1] + " vs " + m[2]);
      else if ((m = c.match(/^(?:which|what)\s+(?:one\s+)?(?:is|are)\s+(?:better|best|faster|safer|more secure|easier|harder|cheaper|more common|stronger|worse|older|newer|more reliable|more popular|more useful|worth it)[:,]?\s+(.+)$/))) T(m[1], false);
      else if ((m = c.match(/^(?:should i|which should i|which do i|what should i|which to|which one should i|which one do i|do i|what do i|which one to|should we|which is the best to)\s+(?:use|choose|pick|learn|get|take|study|start with|go with|buy|install|run|need|do first|try|begin with|learn first|start|read|use first)[:,]?\s+(.+)$/))) T(m[1], false);
      else if ((m = c.match(/^(?:what is better|what is best|what is the better)[:,]?\s+(.+)$/))) T(m[1], false);
      else if ((m = c.match(/^(.+?)\s+(?:difference|differences|comparison|compared)$/))) T(m[1]);
      else if ((m = c.match(/^difference\s+(.+)$/))) T(m[1]);
      if (!tails.length && / vs /.test(" " + c + " ")) { tails.push(c); explicit = true; }
      if (!tails.length && (m = c.match(/^(?:is it |is this |is that |is )?(.+?)\s+or\s+(.+?)$/))) tails.push(m[1] + " or " + m[2]);
      if (!tails.length) return [];
      const out = [];
      for (let t of tails) {
        t = t.replace(/[,]?\s*(?:which|what)\b.*$/, "").replace(/\s+(?:better|best|faster|safer|easier|harder|more secure)$/, "").trim();
        const cand = [t, t.replace(/\s+(?:in|for|when|on|with|at|during|as|from|within)\s+(?:the\s+|a\s+|an\s+)?(?:[\w+-]+\s*){1,4}$/, "").trim()];
        for (const x of cand) { const it = splitItems(x); if (it.length >= 2 && it.length <= 4) out.push(it); }
        const it1 = splitItems(t);
        const ws = t.split(/\s+/).filter((w) => !/^(?:and|or|vs|the|a|an|&)$/.test(w));
        if (it1.length < ws.length && ws.length >= 3 && ws.length <= 4 && ws.every((w) => w.length <= 14)) out.push(Object.assign(ws, { ws: true }));
        if (it1.length === 1 && /\//.test(t)) { const s2 = t.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean); if (s2.length >= 2 && s2.length <= 4) out.push(s2); }
      }
      out.explicit = explicit;
      return out;
    }
    const sideOK = (x) => !!(compCandidates(x) || findTerm(x, true));
    function refine(items) { // "when should i use udp" / "tcp first": keep the part of each side that is a known thing
      const out = items.slice();
      out.forEach((it, i) => {
        if (sideOK(it)) return;
        const w = it.split(" ");
        for (let n = Math.min(4, w.length - 1); n >= 1; n--) {
          const cands = i === 0 ? [w.slice(-n).join(" ")] : [w.slice(0, n).join(" ")];
          if (i > 0 && i < out.length - 1) cands.push(w.slice(-n).join(" "));
          const hit = cands.find(sideOK); if (hit) { out[i] = hit; return; }
        }
        if (i === out.length - 1) for (let n = Math.min(4, w.length - 1); n >= 1; n--) { const x = w.slice(-n).join(" "); if (sideOK(x)) { out[i] = x; return; } }
      });
      return out;
    }
    const joinTry = (items) => { // "stack and heap" splits into two words that belong together: try merging neighbours
      const out = [items];
      for (let i = 0; i + 1 < items.length; i++) { const a = items.slice(); a.splice(i, 2, items[i] + " and " + items[i + 1]); if (a.length >= 1) out.push(a); }
      return out;
    };

    function answerCompare(sets0) {
      const itemSets = sets0.filter((s) => !s.ws || s.every(sideOK)).flatMap((s) => { const r = refine(s); return r.join("|") === s.join("|") ? [s] : [r, s]; });
      const explicit = sets0.explicit;
      for (const base of itemSets) {
        for (const items of joinTry(base)) {
          if (items.length < 2) continue;
          const fc = findComp(items);
          if (fc) {
            const c = comps[fc.ci], cols = fc.idx.map((i) => c.items[i]);
            const rows = c.rows.map((r) => [r[0]].concat(fc.idx.map((i) => r[i + 1])));
            const blocks = [{ t: "table", cols: [""].concat(cols), rows }];
            if (c.pick) blocks.push(say(c.pick));
            if (c.links.length) blocks.push({ t: "links", caption: "read more", items: c.links.map((l) => ({ url: l[0], label: l[1] })) });
            return { kind: "compare", blocks, topic: cols };
          }
        }
      }
      // no curated table: compose one from glossary definitions
      for (const base of itemSets) {
        for (const items of joinTry(base)) {
          if (items.length < 2) continue;
          if (!explicit) continue;
          const fs = items.map((it) => findTerm(it)).filter(Boolean);
          const uniq = fs.filter((f, i) => fs.findIndex((g) => g.d === f.d) === i);
          if (uniq.length >= 2) {
            const rows = [["what it is"].concat(uniq.map((f) => f.d.text.slice(f.d.head.length + 1).trim()))];
            const blocks = [say("I don't have a curated side-by-side for this pair, so here are the glossary definitions next to each other. Read them for what each one is for; the differences are in the definitions."), { t: "table", cols: [""].concat(uniq.map((f) => f.d.head)), rows }];
            const links = []; for (const f of uniq) for (const l of f.d.links) if (!links.some((x) => x.url === l[0])) links.push({ url: l[0], label: l[1] });
            if (links.length) blocks.push({ t: "links", caption: "read more", items: links.slice(0, 6) });
            return { kind: "compare", blocks, topic: uniq.map((f) => f.d.head), composed: true };
          }
          if (uniq.length === 1 && fs.length === items.length - 1 || (uniq.length === 1 && items.length === 2)) {
            const f = uniq[0];
            return { kind: "compare", partial: true, blocks: [say(`I only know one side of that comparison. Here is what the glossary says about ${f.d.head}; the other term isn't in the notes.`), defBlock(f.d)], topic: [f.d.head] };
          }
        }
      }
      return null;
    }

    /* ---------------- small talk ---------------- */
    const HELP = [say("Ask anything the site teaches, in your own words. Examples:"), { t: "list", items: ["what is kerberoasting", "difference between tcp and udp, or hub vs switch vs router", "how does a three-way handshake work", "why is my dns not resolving", "which cert should I get first", "nmap command to scan all ports", "steps of incident response", "tell me more / give an example (follow-ups work)"] }, say("Commands: help, clear, search (leave local model mode), about. It only knows this site; when it doesn't know, it says so.")];
    function smallTalk(c) {
      if (/^(?:hi|hello|hey|yo|sup|howdy|hola|good (?:morning|afternoon|evening)|greetings)(?: there| ghost| ghost-ai)?$/.test(c)) return [say("Hello. Ask a tech question, or type help.")];
      if (/^(?:thanks|thank you|thx|ty|cheers|appreciate it|thanks a lot|thank you so much|ok thanks|great thanks|nice|great|cool|awesome|perfect|got it|makes sense|i see|understood)$/.test(c)) return [say("Anytime. Ask another when you're ready.")];
      if (/^(?:ok|okay|k|alright|fine|sure|yes|yep|yeah|no|nope|nah|hmm+|lol|haha)$/.test(c)) return [say("Noted. Ask a question whenever you want one answered.")];
      if (/^(?:bye|goodbye|cya|see ya|see you|later|gn|good night)$/.test(c)) return [say("Later.")];
      if (/^(?:how are you|how r you|how are you doing|hows it going|how is it going|are you ok|you ok|what is up)$/.test(c)) return [say("Running. Nothing is on fire. What are you studying?")];
      if (/^(?:who are you|what are you|what is your name|who made you|who built you|what is this|what is ghost|what is ghost-ai|are you (?:an? )?(?:ai|bot|robot|human|real|person|chatgpt|claude|gpt|llm|gemini|alexa|siri)|are you (?:smart|dumb|stupid|good)|what model are you|what model is this|are you sentient|do you have feelings)$/.test(c))
        return [say("I'm a search assistant for this site, not a large language model. I look up your question in the site's guides, glossary, comparisons, Security+ notes and flashcards, and quote what they say with links. I don't invent answers, so I'll tell you when I don't have one. The optional local model mode below the terminal does write sentences, and it can be wrong.")];
      if (/^(?:what can you do|what do you know|what do you know about|what can i ask|what can i ask you|what topics|what topics do you cover|what do you cover|how do you work|how does this work|how do i use this|how do i use you|commands|options|menu|capabilities|what are your limits|what are you good at|examples?)$/.test(c)) return HELP;
      if (/^(?:you(?:'?re| are) (?:dumb|stupid|useless|bad|wrong|trash|terrible|not smart|not helpful)|this (?:is )?(?:sucks|useless|is dumb|is bad|is wrong)|that(?:'s| is) wrong|wrong|useless|bad bot|you suck|stupid bot)$/.test(c)) return [say("Fair. When I miss, the cause is usually wording or a gap in the notes. Try the key term on its own, or ask in a different shape (what is X, X vs Y, how does X work). If it's a gap, it should be added.")];
      if (/^(?:tell me a joke|joke|say something funny|make me laugh|sing|tell me a story|write me a poem|write a poem|rap|haiku)$/.test(c)) return [say("No entertainment in the index. Ask about something it does know.")];
      if (/^(?:who (?:invented|discovered|founded|created|won|is|was|wrote|directed|painted|sang)|how (?:tall|old|far|big|heavy|long ago)|where (?:is|was|can i buy|do i buy)|what is the (?:meaning of life|capital|population|president)|why is the sky|how many (?:people|calories|miles|days until)|best (?:restaurant|pizza|movie|song|book|phone to buy))/.test(c) && !termsIn(c).length && !/\b(?:computer|internet|email|unix|linux|windows|python|java|web|software|hacker|hacking|encryption|cipher|virus|worm|network|ai|cpu|transistor|operating system|programming|language|protocol)\b/.test(c))
        return [say("That's outside what I know. I only cover this site's tech, computer science and cybersecurity notes."), GUIDE_LINKS];
      if (/^(?:what time (?:is|does|will)\b.*|what time is it|what is the time|what is the date|what day is it|what is today|what is the weather|weather|what is the weather like|will it rain|news|what is the news|sports|score|who won|stock price|bitcoin price|what is the price of bitcoin)$/.test(c) || /\b(?:weather|forecast|recipe|super bowl|world cup|nba|nfl|celebrity|movie review|horoscope|lottery|pizza|restaurant near|directions to|translate to|capital of)\b/.test(c))
        return [say("That's outside what I know. I only cover this site's tech, computer science and cybersecurity notes."), GUIDE_LINKS];
      return null;
    }

    /* ---------------- conversation state ---------------- */
    function newSession() { return { recent: [], lastQ: "", lastKind: "", lastItems: [], shown: new Set(), lastRes: null }; }
    function remember(S, q, r, extra) {
      S.lastQ = q; S.lastKind = r.kind;
      const tp = (extra || r.topic || []).filter(Boolean);
      for (const t of tp.slice().reverse()) { S.recent = S.recent.filter((x) => x !== t); S.recent.unshift(t); }
      S.recent = S.recent.slice(0, 6);
      if (r.hits) for (const h of r.hits.slice(0, 5)) S.shown.add(h.d.url + "|" + h.d.head);
    }

    function followUp(c, S) {
      const topic = S.recent[0];
      if (!topic) return null;
      let m;
      if (/^(?:tell me more|more|more please|go on|elaborate|continue|more detail|more details|explain more|explain further|say more|expand|keep going|what else|anything else|and\?|so\?|go deeper|deeper|in more detail|can you elaborate|why\?*)$/.test(c) && c !== "why") return { op: "more", topic };
      if (/^(?:explain (?:that|it|this) (?:more|again|simpler|better)|i dont (?:get|understand)(?: (?:it|that|this))?|i don'?t (?:get|understand) (?:it|that|this)|i'?m confused|confused|huh|what do you mean|still don'?t get it|simpler|simplify|dumb it down|explain like i'?m five|can you simplify)$/.test(c)) return { op: "simple", topic };
      if (/^(?:example|examples|an example|give me an example|for example|show me an example|can you give an example|real world example|real life example|any examples|give an example)$/.test(c)) return { op: "ask", q: "example of " + topic, topic };
      if (/^(?:how does (?:it|that|this) work|how do they work|how does that work|how it works|how)$/.test(c)) return { op: "ask", q: "how does " + topic + " work", topic };
      if (/^(?:why|why does (?:it|that|this) matter|why is (?:it|that|this) important|why do (?:i|we) care|why does (?:it|that) happen|why is that|why do people use (?:it|that))$/.test(c)) return { op: "ask", q: "why is " + topic + " important", topic };
      if (/^(?:how (?:do|can|would) (?:i|you|we) (?:use|run|set up|configure|install|do) (?:it|that|this|them)|command|commands|how do i use (?:it|that|this)|syntax|show me the command|what is the command|what command)$/.test(c)) return { op: "ask", q: "how do i use " + topic + " command", topic };
      if (/^(?:is (?:it|that|this) (?:secure|safe|dangerous|bad|good|important|common|hard|difficult|easy|used|still used)|are (?:they|these|those) (?:secure|safe|common|important))\??$/.test(c)) return { op: "ask", q: c.replace(/\b(?:it|that|this|they|these|those)\b/, topic), topic };
      if ((m = c.match(/^(?:and |what about |how about |what of |what abt |and what about |then |ok and |okay and |so |and how about )(.+)$/)) && m[1].split(" ").length <= 5) {
        const t = m[1].replace(/^(?:the |a |an )/, "");
        if (/^(?:difference|why|how|which)/.test(t)) return null;
        return { op: "ask", q: S.lastKind === "compare" && S.recent.length ? "difference between " + topic + " and " + t : "what is " + t, topic: t };
      }
      if (/^(?:what'?s? the difference|what is the difference|difference|how are they different|how do they differ|what is different|are they the same|compare them|compare those|which is better|which one is better|which should i use|vs|how do they compare|which one)$/.test(c) || /\bbetween (?:them|those|these|the two|both|the 2)\b/.test(c)) {
        const prev = S.recent[1];
        if (prev) return { op: "ask", q: "difference between " + topic + " and " + prev, topic };
      }
      return null;
    }
    function subPronoun(c, S) {
      const topic = S.recent[0];
      if (!topic || c.split(" ").length > 12) return c;
      if (!/\b(?:it|its|that|this|they|them|those|these|one)\b/.test(c)) return c;
      if (termsIn(c).length) return c;
      return c.replace(/\b(?:it|that|this|they|them|those|these)\b/, topic).replace(/\bits\b/, topic + "'s");
    }

    /* ---------------- the main route for one question ---------------- */
    const WHYQ = /^(?:why|how come|what causes|what makes|what happens (?:if|when))\b/;
    const HOWQ = /^(?:how (?:do|does|did|can|could|would|should|is|are|to|exactly|much|many|long|often|fast|hard|easy|safe|secure)|how)\b/;
    const CMDQ = /\b(?:command|commands|syntax|cheat ?sheet|one-?liner|flags?|options|switches|script|run|usage|how do i|how to|how can i|how would i|how should i|steps? to|show me how)\b/;
    const LISTQ = /\b(?:list|steps?|phases?|stages?|types?|kinds?|layers?|categories|order|process of|process for|examples? of|name the|what are the|pillars?|principles?|components?|parts of|elements?|characteristics|properties|methods?|techniques?|tactics?|modes?|classes of|levels?)\b/;

    function routeOne(raw, S, depth) {
      const c0 = norm(raw);
      if (!c0) return { kind: "empty", blocks: [say("Ask a question and I'll look it up.")] };
      const fu = !depth ? followUp(c0, S) : null;
      const c = fu ? c0 : subPronoun(c0, S);
      const st = fu ? null : smallTalk(c);
      if (st) return { kind: "chat", blocks: st };
      if (fu) {
        if (fu.op === "ask") { const r = routeOne(fu.q, S, 1); r.followup = true; return r; }
        if (fu.op === "simple") { const f = findTerm(fu.topic, true); if (f) return { kind: "definition", blocks: [say("Same thing in short:"), defBlock(f.d)], topic: [f.d.head], hits: [{ d: f.d }] }; }
        if (fu.op === "more") {
          const res = search(S.lastQ + " " + fu.topic, 6, { skip: S.shown });
          if (res.hits.length) { const hh = res.hits.slice(0, 3); return { kind: "passages", blocks: [say("More from the notes on " + fu.topic + ":"), srcBlock(hh, "more passages")], hits: hh, topic: [fu.topic] }; }
          return { kind: "unknown", blocks: [say("That's everything I have on " + fu.topic + ". Try a more specific question about it.")] };
        }
      }
      // comparison
      const cmpSets = parseCompare(c);
      if (cmpSets.length) {
        const r = answerCompare(cmpSets);
        if (r) return r;
        if (/\bdifference\b|\bvs\b|\bcompare|\bcompared\b/.test(c) && !/\bor\b/.test(c)) {
          // the pair is not in the table or glossary: fall through to a search about both
        }
      }
      // definition
      const tq = termQuestion(c);
      if (tq) {
        const f = findTerm(tq.term);
        if (f) {
          const blocks = [];
          if (f.fuzzy) blocks.push({ t: "sys", text: `no exact match for "${tq.term}", showing "${f.d.head}".` });
          blocks.push(defBlock(f.d));
          const res = search(f.d.head + " " + (tq.asked ? "" : ""), 5);
          const more = res.hits.filter((h) => h.d !== f.d).slice(0, 3);
          if (more.length) blocks.push(srcBlock(more, "more on this in the notes"));
          return { kind: "definition", blocks, topic: [f.d.head], hits: [{ d: f.d, score: 99, cov: 1 }, ...more] };
        }
        // two terms joined: "what are tcp and udp"
        const parts = splitItems(tq.term);
        if (tq.asked && parts.length >= 2 && parts.length <= 3) {
          const fs = parts.map((p) => findTerm(p)).filter(Boolean);
          if (fs.length === parts.length) return { kind: "definition", blocks: fs.flatMap((x) => [defBlock(x.d)]), topic: fs.map((x) => x.d.head), hits: fs.map((x) => ({ d: x.d })) };
        }
      }
      // curated FAQ (troubleshooting, careers, certs, commands, scenarios)
      const fm = faqMatch(c);
      if (fm) {
        const blocks = [say(fm.f.a)];
        if (fm.f.links.length) blocks.push({ t: "links", caption: "read more", items: fm.f.links.map((l) => ({ url: l[0], label: l[1] })) });
        return { kind: "faq", blocks, topic: [], faq: fm.f.id };
      }
      // how / why / list / command / free text over the passages
      const mode = /^(?:what|which)\b/.test(c) && LISTQ.test(c) || /^(?:list|name|give me a list|enumerate|steps? (?:of|for|in)|phases? of|stages? of|types? of|kinds? of|layers? of)\b/.test(c) ? "list" : CMDQ.test(c) ? "command" : LISTQ.test(c) ? "list" : "sentences";
      const prefer = mode === "command" ? { man: 1.4, drill: 1.2, guide: 1.1, card: 0.7 } : mode === "list" ? { guide: 1.1, "Security+": 1.05, card: 0.8 } : WHYQ.test(c) || HOWQ.test(c) ? { card: 0.8 } : {};
      let res = search(c, 6, { prefer });
      const inq = termsIn(c);
      // "what is <unknown thing>": only trust a passage whose heading names it, otherwise say so
      if (tq && tq.asked && tq.term.split(" ").length <= 3 && res.hits.length) {
        const tt = tokens(tq.term, true).filter((t) => t.length > 2);
        const named = res.hits.filter((h) => tt.length && tt.every((t) => h.d.hset.has(t)));
        if (named.length) { res.hits = [...named, ...res.hits.filter((h) => !named.includes(h))].slice(0, 6); res.hits[0].cov = 1; res.hits[0].score = Math.max(res.hits[0].score, 4); res.asked = 2; res.terms = res.terms.length > 1 ? res.terms : [...res.terms, ...tt]; }
        else res.hits = res.hits.map((h) => ({ ...h, cov: Math.min(h.cov, 0.3) }));
      }
      if (confident(res)) {
        const blocks = [];
        if (res.fixed && res.fixed.length) blocks.push({ t: "sys", text: "reading " + res.fixed.map((p) => `"${p[0]}" as "${p[1]}"`).join(", ") + "." });
        // the question names a glossary term the top passage isn't about: lead with the short definition
        const topHead = new Set(tokens(res.hits[0].d.head + " " + res.hits[0].d.page, true));
        const lead = inq.find((x) => !tokens(x.d.head, true).some((t) => topHead.has(t)) && !(GENERIC.has(x.phrase)) && res.hits[0].d.kind !== "glossary");
        if (lead) blocks.push(say("In short:"), defBlock(lead.d));
        blocks.push(...passageBlocks(res, mode, c));
        return { kind: "passages", blocks, hits: res.hits, terms: res.terms, topic: inq.map((x) => x.d.head).slice(0, 2), mode };
      }
      // not confident: if the question names glossary terms, give those definitions instead of guessing
      const named = inq.filter((x) => !(GENERIC.has(x.phrase) && inq.length > 1)).slice(0, 2);
      if (named.length) {
        const lead = tq && tq.asked ? `I don't have a definition of "${tq.term}" on the site, and I won't guess.` : "I don't have a direct answer to that as asked.";
        const blocks = [say(named.length === 1 ? `${lead} The site does define ${named[0].d.head}, which your question mentions:` : `${lead} The site defines these terms from your question:`)];
        for (const x of named) blocks.push(defBlock(x.d));
        const near = res.hits.filter((h) => h.d.kind !== "glossary").slice(0, 3);
        if (near.length) blocks.push(srcBlock(near, "pages that may help (a search match, not a confirmed answer)"));
        return { kind: "partial", blocks, topic: named.map((x) => x.d.head), hits: near };
      }
      // truly unknown: say so and point at the closest pages
      const near = res.hits.slice(0, 3);
      const blocks = [say(tq && tq.asked ? `I don't have a definition of "${tq.term}" on the site yet, and I won't guess.` : "I couldn't find a good match for that in the site's notes. I'd rather say so than guess.")];
      if (near.length) blocks.push(srcBlock(near, "closest pages, probably not what you meant"));
      blocks.push(say("Try the key term on its own, or ask in another shape: what is X, X vs Y, how does X work."), GUIDE_LINKS);
      return { kind: "unknown", blocks, hits: near, topic: [] };
    }

    /* split "what is tcp and how does it differ from udp?" into parts */
    function splitParts(raw) {
      const s = raw.trim();
      if ((s.match(/\?/g) || []).length < 2 && !/;|\.\s+[A-Za-z]|\s+and (?:also )?(?:what|how|why|which|who|when|where|explain|define|tell me|give me|show me)\b|\s+then\s+(?:what|how|why|explain)/i.test(s)) return [s];
      const parts = s.split(/\?+\s*|;\s*|\.\s+(?=[A-Za-z])|\s+and (?:also )?(?=(?:what|how|why|which|who|when|where|explain|define|tell me|give me|show me)\b)|\s+then\s+(?=(?:what|how|why|explain))/i).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 2);
      return parts.length >= 2 && parts.length <= 4 ? parts : [s];
    }

    function answer(raw, S) {
      S = S || newSession();
      const whole = faqMatch(norm(raw));
      const parts = whole && whole.sc >= 0.8 && /\band\b|\?.*\?/.test(whole.p) ? [raw.trim()] : splitParts(raw);
      if (parts.length === 1) { const r = routeOne(raw, S, 0); remember(S, raw, r); S.lastRes = r; return r; }
      const blocks = []; let last = null;
      parts.forEach((p, i) => {
        const r = routeOne(p, S, 0); remember(S, p, r); last = r;
        blocks.push({ t: "sys", text: `${i + 1}/${parts.length}: ${p}` }, ...r.blocks);
      });
      const out = { kind: "multi", blocks, hits: last && last.hits, topic: last && last.topic, parts: parts.length };
      S.lastRes = out;
      return out;
    }

    /* flat text for tests and for the local model */
    function plain(r) {
      const out = [];
      for (const b of r.blocks) {
        if (b.t === "say" || b.t === "sys") out.push(b.text);
        else if (b.t === "def") out.push(b.head + ": " + b.text, ...b.links.map((l) => l[0]));
        else if (b.t === "table") { out.push(b.cols.join(" | ")); for (const row of b.rows) out.push(row.join(" | ")); }
        else if (b.t === "quote") out.push(b.text, b.url || "");
        else if (b.t === "code" || b.t === "steps") out.push((b.lines || b.items).join("\n"), b.url || "");
        else if (b.t === "list") out.push(b.items.join("\n"));
        else if (b.t === "src") for (const h of b.hits) out.push(h.url, h.label, h.snip);
        else if (b.t === "links") for (const i of b.items) out.push(i.url, i.label);
      }
      return out.join("\n");
    }

    return { _findComp: findComp, _compCandidates: compCandidates, answer, newSession, search, findTerm, termsIn, confident, plain, docs, comps, faq, parseCompare, norm, HELP, stats: { docs: docs.length, terms: TERMS.size, comps: comps.length, faq: faq.length } };
  }

  return { createEngine, tokens, norm, compact };
});
