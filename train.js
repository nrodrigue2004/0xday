/* ~/secplus/train: weak-spot drill, acronyms, PBQs, pairs, scenarios. No dependencies.
   localStorage keys: oxday-weak (miss log), oxday-acr (acronym stats), oxday-pbq (best PBQ scores), oxday-hi-acr. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dataEl = $("#tr-data"); if (!dataEl) return;
  const D = JSON.parse(dataEl.textContent), root = $("#tr");
  const typing = () => /input|textarea|select/i.test((document.activeElement || {}).tagName || "");

  /* ---------- miss log ---------- */
  const weak = () => ls.get("oxday-weak") || {};
  function record(id, ok, obj) {
    const w = weak(), e = w[id] || { m: 0, c: 0 };
    e.o = obj; e.t = new Date().toISOString().slice(0, 10);
    if (ok) e.c++; else { e.m++; e.c = 0; }
    w[id] = e; ls.set("oxday-weak", w);
  }
  const isWeak = e => e && e.m > 0 && e.c < 3;
  const score = e => e.m * 2 - e.c;
  const bar = (pct, w = 16) => { const n = Math.round(pct / 100 * w); return `<span class="bar"><span class="bar__on">${"#".repeat(n)}</span><span class="bar__off">${"-".repeat(w - n)}</span></span> <span class="muted">${pct}%</span>`; };
  const objLabel = o => /^\d\.\d$/.test(o) ? `${o} ${D.objs[o] || ""}` : (/^D\d$/.test(o) ? `domain ${o.slice(1)} ${D.doms[o.slice(1)] || ""}` : o);

  /* ---------- shared multiple-choice renderer ---------- */
  // item: {id, o, scene?, q (html), opts:[{t, ok}], why (text)}; calls done(ok)
  function mcq(box, item, done, ctl) {
    let locked = false;
    box.innerHTML = `${item.scene ? `<p class="tr-scene">${esc(item.scene)}</p>` : ""}<div class="tr-q">${item.q}</div>
      <div class="tr-opts ${item.two ? "two" : ""}">${item.opts.map((o, i) => `<button class="btn tr-o" type="button" data-i="${i}"><kbd>${i + 1}</kbd> ${esc(o.t)}</button>`).join("")}</div>
      <div class="tr-msg" aria-live="polite"></div>`;
    function pick(i) {
      if (locked || !item.opts[i]) return; locked = true;
      const ok = item.opts[i].ok;
      box.querySelectorAll(".tr-o").forEach((b, j) => { b.disabled = true; if (item.opts[j].ok) b.classList.add("good"); else if (j === i) b.classList.add("bad"); });
      record(item.id, ok, item.o);
      if (ctl && ctl.instant) { ctl.instant(ok); return; }
      box.querySelector(".tr-msg").innerHTML = `${ok ? '<span class="ok">correct.</span>' : '<span style="color:var(--red)">no.</span>'} ${esc(item.why)}<br><span class="muted">Enter or click for next.</span>`;
      const go = () => { box.removeEventListener("click", go2); document.removeEventListener("keydown", key); done(ok); };
      const go2 = e => { if (e.target.closest(".tr-o")) return; go(); };
      const key = e => { if (e.key === "Enter" && !typing()) { e.preventDefault(); go(); } };
      box.addEventListener("click", go2); document.addEventListener("keydown", key);
    }
    box.onclick = e => { const b = e.target.closest(".tr-o"); if (b) pick(+b.dataset.i); };
    if (box._kd) document.removeEventListener("keydown", box._kd);
    const kd = box._kd = e => { if (!box.isConnected) { document.removeEventListener("keydown", kd); return; } if (typing() || e.ctrlKey || e.metaKey || e.altKey) return; if (/^[1-6]$/.test(e.key)) pick(+e.key - 1); };
    document.addEventListener("keydown", kd);
  }

  /* ---------- item builders ---------- */
  const ACR = D.acr || [];
  function acrItem(a, rev) {
    const pool = shuf(ACR.filter(x => x.a !== a.a && (rev ? x.a : x.x) && x.x !== a.x));
    const same = pool.filter(x => x.d === a.d), rest = pool.filter(x => x.d !== a.d);
    const ds = same.concat(rest).slice(0, 3);
    const opts = shuf([a].concat(ds)).map(x => ({ t: rev ? x.a : x.x, ok: x === a }));
    return { id: "acr:" + a.a, o: "D" + a.d, kind: "acr", q: rev ? `<span class="muted">which acronym is</span> <b>${esc(a.x)}</b><span class="muted">?</span>` : `<b>${esc(a.a)}</b> <span class="muted">stands for?</span>`, opts, two: !rev ? false : true, why: `${a.a} = ${a.x}. ${a.h}.` };
  }
  function pairItem(p, i, rev) {
    const full = x => `${x.s} ${x.sp}`;
    if (!rev) {
      const ds = shuf(D.pairs.filter(x => full(x) !== full(p))).slice(0, 3);
      return { id: "pr:" + i, o: "3.2", kind: "pr", q: `<b>${esc(p.i)}</b> <span class="muted">(${esc(p.ip)}) is insecure. What replaces it?</span>`, opts: shuf([p].concat(ds)).map(x => ({ t: full(x), ok: x === p })), why: `${p.i} ${p.ip} -> ${full(p)}. ${p.w}.` };
    }
    const ds = shuf(D.pairs.filter(x => x.i !== p.i)).slice(0, 3);
    return { id: "pr:" + i, o: "3.2", kind: "pr", q: `<b>${esc(full(p))}</b> <span class="muted">secures which insecure protocol?</span>`, opts: shuf([p].concat(ds)).map(x => ({ t: `${x.i} (${x.ip})`, ok: x === p })), why: `${p.i} ${p.ip} -> ${full(p)}. ${p.w}.` };
  }
  function scItem(s, i) {
    return { id: "sc:" + i, o: s.o, kind: "sc", scene: s.s, q: esc(s.q), opts: shuf([{ t: s.good, ok: true }].concat(s.bad.map(t => ({ t, ok: false })))), why: s.w };
  }

  /* ---------- generic runner for a list of items ---------- */
  function runner(items, hud, finish, cardFn) {
    let i = 0, right = 0, miss = [];
    const wrap = document.createElement("div");
    root.innerHTML = `<div class="tr-hud">${hud}<span>item <b id="tr-n"></b></span><span>right <b id="tr-r">0</b></span></div><div id="tr-box"></div>`;
    const box = $("#tr-box"), n = $("#tr-n"), r = $("#tr-r");
    function next() {
      if (i >= items.length) return finish({ right, total: items.length, miss });
      const it = items[i]; n.textContent = `${i + 1}/${items.length}`;
      const cb = ok => { if (ok) { right++; r.textContent = right; } else miss.push(it); i++; next(); };
      if (it.kind === "card") cardFn(box, it, cb); else mcq(box, it, cb);
    }
    next();
  }
  function flash(box, it, done) {
    box.innerHTML = `<div class="tr-q"><span class="muted">${esc(objLabel(it.o))}</span><br>${esc(it.q)}</div><div class="tr-msg" id="fa"></div><div class="tr-list"><button class="btn" type="button" id="fl">[ space ] show answer</button></div>`;
    let shown = false;
    const kd = e => {
      if (!box.isConnected) { document.removeEventListener("keydown", kd); return; }
      if (typing()) return;
      if (e.key === " " && !shown) { e.preventDefault(); reveal(); }
      else if (shown && (e.key === "1" || e.key === "2")) grade(e.key === "2");
    };
    function reveal() { shown = true; $("#fa").innerHTML = `<span class="ok">&gt;</span> ${esc(it.a)}`; $(".tr-list", box).innerHTML = '<button class="btn" type="button" data-g="0">[1] missed it</button><button class="btn" type="button" data-g="1">[2] got it</button>'; }
    function grade(ok) { document.removeEventListener("keydown", kd); record(it.id, ok, it.o); done(ok); }
    box.onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.id === "fl") reveal(); else if (b.dataset.g != null) grade(b.dataset.g === "1"); };
    document.addEventListener("keydown", kd);
  }

  /* ================= hub summary ================= */
  if (D.page === "hub") {
    const w = weak(), n = Object.values(w).filter(isWeak).length;
    $("#tr-sum").textContent = n ? `// ${n} item${n === 1 ? "" : "s"} currently flagged weak.` : "// nothing flagged weak yet. Missed items show up here.";
  }

  /* ================= acronyms (timed) ================= */
  if (D.page === "acr") {
    const stats = () => ls.get("oxday-acr") || {};
    const mastered = (s, a) => s[a] && s[a].ok >= 2 && s[a].ok > s[a].bad;
    let dom = "all", rev = false;
    const hi = () => +(localStorage.getItem("oxday-hi-acr") || 0);
    function menu() {
      const s = stats();
      const rows = Object.keys(D.doms).map(d => {
        const list = ACR.filter(a => a.d === +d), m = list.filter(a => mastered(s, a.a)).length;
        return `<div class="tr-dom"><span>domain ${d}</span><span>${bar(Math.round(m / list.length * 100), 14)}</span><span class="muted">${m}/${list.length}</span></div>`;
      }).join("");
      const all = ACR.filter(a => mastered(s, a.a)).length;
      root.innerHTML = `<div class="tr-hud"><span>acronyms <b>${ACR.length}</b></span><span>mastered <b>${all}</b></span><span>hi <b>${hi() || "---"}</b></span></div>
        <div class="tr-list" id="tr-dom"><button class="btn" data-d="all" aria-pressed="${dom === "all"}">all</button>${Object.keys(D.doms).map(d => `<button class="btn" data-d="${d}" aria-pressed="${dom === d}">domain ${d}</button>`).join("")}</div>
        <div class="tr-list"><button class="btn" id="tr-rev" aria-pressed="${rev}">reverse: expansion -> acronym</button></div>
        ${rows}<p class="muted small">mastered = right at least twice and more right than wrong. Pick the filter, then go.</p>
        <p><button class="btn" id="tr-go" type="button">[ Enter ] start 60s round</button></p>`;
      $("#tr-dom").onclick = e => { const b = e.target.closest("[data-d]"); if (b) { dom = b.dataset.d; menu(); } };
      $("#tr-rev").onclick = () => { rev = !rev; menu(); };
      $("#tr-go").onclick = start;
    }
    function start() {
      let pool = ACR.filter(a => dom === "all" || a.d === +dom);
      const s = stats(), w = weak();
      // unseen and weak acronyms come up more
      const bag = []; pool.forEach(a => { const k = (!s[a.a] ? 3 : 1) + (isWeak(w["acr:" + a.a]) ? 3 : 0) + (mastered(s, a.a) ? 0 : 1); for (let i = 0; i < k; i++) bag.push(a); });
      let t = 60, pts = 0, streak = 0, best = 0, miss = [], last = null, over = false;
      root.innerHTML = `<div class="tr-hud"><span>time <b id="a-t">60</b></span><span>score <b id="a-s">0</b></span><span>streak <b id="a-k">0</b></span></div><div class="tr-bar" id="a-bar"><i style="width:100%"></i></div><div id="a-box"></div>`;
      const box = $("#a-box"), tt = $("#a-t");
      const tick = setInterval(() => { t -= 0.25; paint(); if (t <= 0) end(); }, 250);
      function paint() { const v = Math.max(0, Math.ceil(t)); tt.textContent = v; $("#a-bar").classList.toggle("low", t < 10); $("#a-bar i").style.width = Math.max(0, t / 60 * 100) + "%"; $("#a-s").textContent = pts; $("#a-k").textContent = streak; }
      function nxt() {
        if (over) return;
        let a; do { a = bag[Math.floor(Math.random() * bag.length)]; } while (a === last && pool.length > 1);
        last = a;
        const it = acrItem(a, rev); it.two = true;
        mcq(box, it, () => {}, { instant(ok) {
          const st = stats(); st[a.a] = st[a.a] || { ok: 0, bad: 0 }; ok ? st[a.a].ok++ : st[a.a].bad++; ls.set("oxday-acr", st);
          if (ok) { streak++; best = Math.max(best, streak); pts += 10 + Math.min(streak - 1, 5) * 2; }
          else { streak = 0; t -= 3; miss.push(a); }
          paint();
          box.querySelector(".tr-msg").innerHTML = `${ok ? '<span class="ok">ok</span>' : '<span style="color:var(--red)">no</span>'} <span class="muted">${esc(it.why)}</span>`;
          setTimeout(() => { if (!over && box.isConnected) nxt(); }, ok ? 450 : 1500);
        } });
      }
      function end() {
        if (over) return; over = true; clearInterval(tick);
        const newhi = pts > hi(); if (newhi) try { localStorage.setItem("oxday-hi-acr", String(pts)); } catch (e) {}
        const uniq = [...new Map(miss.map(a => [a.a, a])).values()];
        root.innerHTML = `<div class="tr-end"><pre>time. ${pts} pts · best streak ${best}${newhi ? " · NEW HIGH SCORE" : ""}\n\nmissed:\n${uniq.length ? uniq.map(a => `  ${a.a.padEnd(8)} ${a.x}`).join("\n") : "  none. clean."}</pre>
          <button class="btn" id="a-again">[ Enter ] again</button> <button class="btn" id="a-menu">menu</button></div>`;
        $("#a-again").onclick = start; $("#a-menu").onclick = menu;
      }
      nxt(); paint();
    }
    document.addEventListener("keydown", e => { if (typing() || !$("#tr-go") && !$("#a-again")) return; if (e.key === "Enter") { e.preventDefault(); ($("#tr-go") || $("#a-again")).click(); } });
    menu();
  }

  /* ================= pairs ================= */
  if (D.page === "pairs") {
    const P = D.pairs;
    const round = () => runner(shuf(P.map((p, i) => [p, i])).slice(0, 10).map(([p, i]) => pairItem(p, i, Math.random() < 0.4)), "<span>pairs round</span>", res => {
      root.innerHTML = `<div class="tr-end"><pre>${res.right}/${res.total} right.\n\nmissed:\n${res.miss.length ? [...new Set(res.miss.map(m => m.why))].join("\n") : "  none. clean."}</pre><button class="btn" id="again">[ Enter ] new round</button></div>`;
      const go = () => { document.removeEventListener("keydown", k); round(); }; const k = e => { if (e.key === "Enter" && !typing()) go(); };
      document.addEventListener("keydown", k); $("#again").onclick = go;
    });
    root.insertAdjacentHTML("beforebegin", `<table class="tr" style="padding:6px"><tr><th>insecure</th><th>secure</th><th>why</th></tr>${P.map(p => `<tr><td>${esc(p.i)} <span class="muted">${esc(p.ip)}</span></td><td>${esc(p.s)} <span class="muted">${esc(p.sp)}</span></td><td class="muted">${esc(p.w)}</td></tr>`).join("")}</table><p class="muted small">Study table above, then drill.</p>`);
    round();
  }

  /* ================= scenarios ================= */
  if (D.page === "sc") {
    const go = () => runner(shuf(D.sc.map((s, i) => scItem(s, i))).slice(0, 8), "<span>scenarios</span>", res => {
      root.innerHTML = `<div class="tr-end"><pre>${res.right}/${res.total} right.\n\nreview:\n${res.miss.length ? res.miss.map(m => `  [${m.o}] ${D.sc[+m.id.slice(3)].t}`).join("\n") : "  none. clean."}</pre><button class="btn" id="again">[ Enter ] new set</button></div>`;
      const g = () => { document.removeEventListener("keydown", k); go(); }; const k = e => { if (e.key === "Enter" && !typing()) g(); };
      document.addEventListener("keydown", k); $("#again").onclick = g;
    });
    go();
  }

  /* ================= PBQs ================= */
  if (D.page === "pbq") {
    const best = () => ls.get("oxday-pbq") || {};
    const names = { firewall: "firewall", match: "match", order: "order", log: "read the log" };
    function list() {
      const b = best();
      root.innerHTML = `<div class="tr-list" style="flex-direction:column">${D.pbq.map(p => `<button class="btn" style="text-align:left" data-id="${p.id}">[${names[p.t]}] ${esc(p.title)} <span class="muted">obj ${p.o}</span> ${b[p.id] != null ? `<span class="ok">best ${b[p.id]}%</span>` : ""}</button>`).join("")}</div>`;
      root.onclick = e => { const x = e.target.closest("[data-id]"); if (x) open(D.pbq.find(p => p.id === x.dataset.id)); };
    }
    function finish(p, pct, box) {
      const b = best(); b[p.id] = Math.max(b[p.id] || 0, pct); ls.set("oxday-pbq", b);
      record("pbq:" + p.id, pct === 100, p.o);
      box.insertAdjacentHTML("beforeend", `<p>${pct === 100 ? '<span class="ok">all correct.</span>' : `<span style="color:var(--red)">${pct}%.</span> Review the highlighted rows; this one is now on your weak list until you pass it three times.`} <button class="btn" id="p-back">back to list</button> <button class="btn" id="p-retry">retry</button></p>`);
      $("#p-back").onclick = list; $("#p-retry").onclick = () => open(p);
    }
    function open(p) {
      root.onclick = null;
      const head = `<p class="muted">${names[p.t]} · objective ${esc(objLabel(p.o))}</p><h2>${esc(p.title)}</h2><p>${esc(p.brief)}</p>`;
      let box;
      if (p.t === "firewall") {
        root.innerHTML = head + `<table><tr><th>flow</th><th>port</th><th>action</th></tr>${p.flows.map((f, i) => `<tr data-i="${i}"><td>${esc(f[0])}</td><td>${esc(f[1])}</td><td><select><option value="">?</option><option>allow</option><option>deny</option></select><span class="tr-why" hidden>${esc(f[3])}</span></td></tr>`).join("")}<tr data-i="d"><td>everything else (final rule)</td><td>any</td><td><select><option value="">?</option><option>allow</option><option>deny</option></select><span class="tr-why" hidden>${esc(p.dwhy)}</span></td></tr></table><p><button class="btn" id="chk">[ check ]</button></p>`;
        $("#chk").onclick = () => {
          let ok = 0; const rows = [...root.querySelectorAll("tr[data-i]")];
          rows.forEach(r => { const want = r.dataset.i === "d" ? p.default : p.flows[+r.dataset.i][2], got = $("select", r).value; const g = got === want; ok += g; r.className = g ? "good" : "bad"; $(".tr-why", r).hidden = false; $("select", r).disabled = true; });
          $("#chk").remove(); finish(p, Math.round(ok / rows.length * 100), root);
        };
      } else if (p.t === "match") {
        root.innerHTML = head + `<table><tr><th>attack / scenario</th><th>pick</th></tr>${p.items.map((it, i) => `<tr data-i="${i}"><td>${esc(it[0])}</td><td><select><option value="">?</option>${p.opts.map((o, j) => `<option value="${j}">${esc(o)}</option>`).join("")}</select><span class="tr-why" hidden></span></td></tr>`).join("")}</table><p><button class="btn" id="chk">[ check ]</button></p>`;
        $("#chk").onclick = () => {
          let ok = 0; const rows = [...root.querySelectorAll("tr[data-i]")];
          rows.forEach(r => { const it = p.items[+r.dataset.i], s = $("select", r), g = s.value === String(it[1]); ok += g; r.className = g ? "good" : "bad"; const w = $(".tr-why", r); w.hidden = false; w.textContent = (g ? "" : `answer: ${p.opts[it[1]]}. `) + it[2]; s.disabled = true; });
          $("#chk").remove(); finish(p, Math.round(ok / rows.length * 100), root);
        };
      } else if (p.t === "order") {
        let arr = shuf(p.steps.map((s, i) => i)); if (arr.every((v, i) => v === i)) arr.reverse();
        const draw = checked => {
          root.innerHTML = head + `<ol class="tr-ord">${arr.map((v, k) => `<li class="${checked ? (v === k ? "good" : "bad") : ""}"><span class="t">${esc(p.steps[v])}${checked ? `<span class="tr-why">${esc(p.why[v])}${v === k ? "" : ` (belongs at position ${v + 1})`}</span>` : ""}</span>${checked ? "" : `<button class="btn" data-m="-1" data-k="${k}" aria-label="move up">^</button><button class="btn" data-m="1" data-k="${k}" aria-label="move down">v</button>`}</li>`).join("")}</ol>${checked ? "" : '<p><button class="btn" id="chk">[ check ]</button></p>'}`;
          if (checked) { const ok = arr.filter((v, k) => v === k).length; finish(p, Math.round(ok / arr.length * 100), root); return; }
          root.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { const k = +b.dataset.k, m = k + +b.dataset.m; if (m < 0 || m >= arr.length) return; [arr[k], arr[m]] = [arr[m], arr[k]]; draw(false); });
          $("#chk").onclick = () => draw(true);
        };
        draw(false);
      } else if (p.t === "log") {
        root.innerHTML = head + `<pre class="tr-pre">${esc(p.log)}</pre><div id="lq"></div>`;
        let qi = 0, ok = 0;
        const ask = () => {
          if (qi >= p.qs.length) { $("#lq").innerHTML = ""; finish(p, Math.round(ok / p.qs.length * 100), root); return; }
          const q = p.qs[qi];
          mcq($("#lq"), { id: "pbqq:" + p.id + qi, o: p.o, q: esc(q[0]), opts: shuf(q[1].map((t, i) => ({ t, ok: i === q[2] }))), why: q[3] }, g => { ok += g; qi++; ask(); });
        };
        ask();
      }
    }
    list();
  }

  /* ================= weak-spot drill ================= */
  if (D.page === "weak") {
    const cardMap = Object.fromEntries(D.cards.map(c => [c.id, c]));
    function build(id) {
      if (id.startsWith("acr:")) { const a = ACR.find(x => x.a === id.slice(4)); return a && acrItem(a, Math.random() < 0.3); }
      if (id.startsWith("pr:")) { const i = +id.slice(3); return D.pairs[i] && pairItem(D.pairs[i], i, Math.random() < 0.4); }
      if (id.startsWith("sc:")) { const i = +id.slice(3); return D.sc[i] && scItem(D.sc[i], i); }
      if (cardMap[id]) return Object.assign({ kind: "card" }, cardMap[id]);
      return null;
    }
    const label = id => id.startsWith("acr:") ? "acronym " + id.slice(4) : id.startsWith("pr:") ? "pair: " + D.pairs[+id.slice(3)]?.i : id.startsWith("sc:") ? "scenario: " + D.sc[+id.slice(3)]?.t : id.startsWith("pbq:") ? "PBQ: " + (D.pbq.find(p => p.id === id.slice(4)) || {}).title : cardMap[id] ? "card: " + cardMap[id].q.slice(0, 60) : id;
    function menu() {
      const w = weak(), ids = Object.keys(w).filter(k => isWeak(w[k]) && !k.startsWith("pbqq:")).sort((a, b) => score(w[b]) - score(w[a]));
      const byObj = {}; ids.forEach(k => { const o = w[k].o; byObj[o] = (byObj[o] || 0) + 1; });
      const objs = Object.entries(byObj).sort((a, b) => b[1] - a[1]);
      const playable = ids.filter(k => build(k));
      if (!ids.length) { root.innerHTML = `<p><span class="ok">[ clean ]</span> nothing flagged yet. Miss a few flashcards, acronyms or scenarios and they land here.</p><p><a class="btn" href="drill.html">flashcards</a> <a class="btn" href="acronyms.html">acronyms</a> <a class="btn" href="scenarios.html">scenarios</a> <a class="btn" href="pbq.html">PBQs</a></p>`; return; }
      root.innerHTML = `<div class="tr-hud"><span>weak items <b>${ids.length}</b></span><span>objectives <b>${objs.length}</b></span></div>
        <h2># weakest objectives</h2>${objs.slice(0, 8).map(([o, n]) => `<div class="tr-dom"><span>${esc(o)}</span><span>${esc(objLabel(o).replace(/^[D\d. ]+/, "").slice(0, 60) || objLabel(o))}</span><span class="muted">${n} missed</span></div>`).join("")}
        <h2># worst items</h2><ul>${ids.slice(0, 10).map(k => `<li>${esc(label(k))} <span class="muted">x${w[k].m} · streak ${w[k].c}/3</span>${k.startsWith("pbq:") ? ` <a href="pbq.html">open PBQs</a>` : ""}</li>`).join("")}</ul>
        <p><button class="btn" id="w-go" ${playable.length ? "" : "disabled"}>[ Enter ] start session (${Math.min(12, playable.length)} items)</button> <button class="btn" id="w-clear">clear log</button></p>
        <p class="muted small">Sessions mix flashcards (self-graded), acronyms, scenarios and pairs. PBQs are listed but live on the <a href="pbq.html">PBQ page</a>.</p>`;
      const go = () => { document.removeEventListener("keydown", k); session(playable.slice(0, 12)); };
      const k = e => { if (e.key === "Enter" && !typing() && $("#w-go")) go(); };
      if (playable.length) { $("#w-go").onclick = go; document.addEventListener("keydown", k); }
      $("#w-clear").onclick = () => { if (confirm("Clear your miss log?")) { ls.set("oxday-weak", {}); menu(); } };
    }
    function session(ids) {
      const items = shuf(ids.map(build).filter(Boolean));
      runner(items, "<span>weak-spot session</span>", res => {
        const w = weak(), left = Object.values(w).filter(isWeak).length;
        root.innerHTML = `<div class="tr-end"><pre>${res.right}/${res.total} right. ${left} item${left === 1 ? "" : "s"} still flagged.\n\nstill shaky:\n${res.miss.length ? res.miss.map(m => "  " + label(m.id)).join("\n") : "  none this round."}</pre><button class="btn" id="w-menu">[ Enter ] back</button></div>`;
        const g = () => { document.removeEventListener("keydown", k); menu(); }; const k = e => { if (e.key === "Enter" && !typing()) g(); };
        document.addEventListener("keydown", k); $("#w-menu").onclick = g;
      }, flash);
    }
    menu();
  }
})();
