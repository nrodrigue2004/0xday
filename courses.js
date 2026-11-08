/* 0xDay ~/courses, ~/courses/<code>, ~/transcript. Progress lives in localStorage only (key oxday-courses).
   Shape: { mods: {"IT110.2": "2026-11-08"}, quiz: {"IT110.2": {best, n, date}}, exam: {"IT110": {best, n, date, out}} }.
   Passing a module quiz also ticks the module. An exam passed before any module was done is recorded as tested out. */
(function () {
  const KEY = "oxday-courses";
  const $ = id => document.getElementById(id);
  const mj = $("c-meta"); if (!mj) return;
  const META = JSON.parse(mj.textContent), PASS = META.pass;
  const byCode = {}; META.courses.forEach(c => { byCode[c.code] = c; });
  const pad = n => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const clean = v => { const o = v && typeof v === "object" && !Array.isArray(v) ? v : {}; ["mods", "quiz", "exam", "cap"].forEach(k => { if (!o[k] || typeof o[k] !== "object" || Array.isArray(o[k])) o[k] = {}; }); return o; };
  const load = () => { try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return clean(null); } };
  let S = load();
  const save = msgEl => { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { if (msgEl) msgEl.textContent = "could not save (storage blocked?)"; return false; } };
  const modsDone = code => { let n = 0; for (let i = 0; i < byCode[code].mods; i++) if (S.mods[code + "." + i]) n++; return n; };
  const pct = (a, b) => Math.round(a / b * 100);
  function status(code) {
    const c = byCode[code], ex = S.exam[code], md = modsDone(code);
    if (ex && ex.pass) return { k: ex.out ? "tested out" : "passed", cls: "ok" };
    if (md === c.mods) return { k: "ready for exam", cls: "go" };
    if (md || Object.keys(S.quiz).some(k => k.indexOf(code + ".") === 0) || ex) return { k: "in progress", cls: "go" };
    return { k: "not started", cls: "" };
  }
  const capBy = {}; (META.caps || []).forEach(c => { capBy[c.code] = c; });
  const capDone = code => { const c = capBy[code]; if (!c) return 0; let n = 0; for (let i = 0; i < c.n; i++) if (S.cap[code + "." + i]) n++; return n; };
  const complete = code => capBy[code] ? capDone(code) === capBy[code].n : !!(S.exam[code] && S.exam[code].pass);
  function capStatus(code) {
    const n = capDone(code), t = capBy[code].n;
    if (n === t) return { k: "finished", cls: "ok" };
    return n ? { k: n + "/" + t + " done", cls: "go" } : { k: "not started", cls: "" };
  }
  const hrs = m => (m / 60).toFixed(1).replace(/\.0$/, "");

  /* ---------- catalog ---------- */
  if ($("cl")) {
    const render = () => {
      let done = 0;
      document.querySelectorAll(".cl__card").forEach(el => {
        const code = el.dataset.code || el.dataset.cap, isCap = !!el.dataset.cap;
        const st = isCap ? capStatus(code) : status(code);
        const b = el.querySelector("[data-st]"); b.textContent = st.k; b.className = "cl__st " + st.cls;
        if (complete(code)) done++;
        const miss = (isCap ? capBy[code] : byCode[code]).pre.filter(p => !complete(p));
        const lk = el.querySelector("[data-lock]");
        lk.hidden = !miss.length || complete(code);
        lk.textContent = miss.length ? "soft lock: finish " + miss.join(", ") + " first (or test out)" : "";
        el.classList.toggle("is-locked", miss.length > 0 && !complete(code));
      });
      const total = document.querySelectorAll(".cl__card").length;
      $("cl-sum").textContent = done + " of " + total + (document.querySelector("[data-cap]") ? " capstones finished" : " courses complete");
    };
    render();
  }

  /* ---------- transcript ---------- */
  if ($("tr")) {
    const msg = $("tr-msg");
    const render = () => {
      const rows = META.courses.map(c => {
        const st = status(c.code), ex = S.exam[c.code], md = modsDone(c.code);
        return `<tr><td><a href="courses/${c.code}.html">${c.code}</a> ${c.name.replace(/[&<>"]/g, "")}</td><td class="${st.cls ? "tr__" + st.cls : ""}">${st.k}</td><td>${md}/${c.mods}</td><td>${ex ? "best " + ex.best + "%, " + ex.n + " tr" + (ex.n === 1 ? "y" : "ies") : "–"}</td><td>${ex && ex.pass ? ex.date : "–"}</td></tr>`;
      });
      (META.caps || []).forEach(c => {
        const st = capStatus(c.code);
        rows.push(`<tr><td><a href="capstones/${c.code}.html">${c.code}</a> ${c.name.replace(/[&<>"]/g, "")}</td><td class="${st.cls ? "tr__" + st.cls : ""}">${st.k}</td><td>${capDone(c.code)}/${c.n} items</td><td>–</td><td>${st.k === "finished" ? (S.cap[c.code + ".done"] || "–") : "–"}</td></tr>`);
      });
      $("tr-body").innerHTML = rows.join("");
      let done = 0, mins = 0;
      META.courses.forEach(c => { if (complete(c.code)) done++; for (let i = 0; i < c.mods; i++) if (S.mods[c.code + "." + i]) mins += c.min / c.mods; });
      $("tr-sum").textContent = done + " of " + META.courses.length + " courses complete · ~" + hrs(mins) + " h of modules ticked";
      document.querySelectorAll(".tr__tier").forEach(el => {
        const t = META.tiers.find(x => x.key === el.dataset.tier), pk = t.pick || { n: 0, from: [] };
        const n = t.need.filter(complete).length + Math.min(pk.n, pk.from.filter(complete).length), tot = t.need.length + pk.n;
        el.querySelector("[data-tier-st]").textContent = n === tot ? "[ reached ]" : n + "/" + tot;
        el.classList.toggle("done", n === tot);
      });
    };
    $("tr-export").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
      a.download = "0xday-courses-" + today() + ".json"; a.click(); URL.revokeObjectURL(a.href);
    };
    $("tr-import").onclick = () => $("tr-file").click();
    $("tr-file").onchange = () => {
      const f = $("tr-file").files[0]; if (!f) return;
      f.text().then(t => {
        const v = clean(JSON.parse(t)); let k = 0;
        ["mods", "quiz", "exam"].forEach(sec => Object.keys(v[sec]).forEach(key => {
          const code = key.split(".")[0];
          if (byCode[code] || capBy[code]) { S[sec][key] = v[sec][key]; k++; }
        }));
        save(msg); msg.textContent = "imported " + k + " records."; render();
      }).catch(() => { msg.textContent = "that file is not a valid export."; });
    };
    let armed = 0;
    $("tr-reset").onclick = () => {
      if (!armed) { armed = 1; $("tr-reset").textContent = "[ really reset? ]"; setTimeout(() => { armed = 0; $("tr-reset").textContent = "[ reset ]"; }, 4000); return; }
      armed = 0; $("tr-reset").textContent = "[ reset ]"; S = clean(null); save(msg); render();
    };
    render();
  }

  /* ---------- capstone page ---------- */
  const capEl = $("cap");
  if (capEl) {
    const code = capEl.dataset.code, N = +capEl.dataset.n;
    const items = [].slice.call(capEl.querySelectorAll(".cp__mod"));
    const refresh = () => {
      items.forEach(li => { const on = !!S.cap[code + "." + li.dataset.i]; li.classList.toggle("done", on); li.querySelector("input").checked = on; });
      const n = capDone(code);
      $("cap-count").textContent = n + " of " + N + " items done";
      $("cp-status").textContent = capStatus(code).k;
    };
    items.forEach(li => li.querySelector("input").addEventListener("change", ev => {
      const key = code + "." + li.dataset.i;
      if (ev.target.checked) S.cap[key] = today(); else delete S.cap[key];
      if (capDone(code) === N) { if (!S.cap[code + ".done"]) S.cap[code + ".done"] = today(); } else delete S.cap[code + ".done"];
      save(); refresh();
    }));
    refresh();
  }

  /* ---------- course page + quiz engine ---------- */
  const dj = $("cq-data");
  if (dj && $("cp")) {
    const D = JSON.parse(dj.textContent), code = D.code;
    const box = $("cq");
    const mods = [].slice.call(document.querySelectorAll(".cp__mod"));
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const need = n => Math.ceil(n * PASS - 1e-9);

    function refresh() {
      mods.forEach(li => {
        const i = li.dataset.i, key = code + "." + i, on = !!S.mods[key], q = S.quiz[key];
        li.classList.toggle("done", on);
        li.querySelector("input").checked = on;
        li.querySelector("[data-best]").textContent = q ? "best " + q.best + "% · " + q.n + " tr" + (q.n === 1 ? "y" : "ies") : "";
      });
      const ex = S.exam[code];
      $("cp-exam-best").textContent = ex ? "best " + ex.best + "% · " + ex.n + " tr" + (ex.n === 1 ? "y" : "ies") + (ex.pass ? " · passed" + (ex.out ? " (tested out)" : "") : "") : "";
      const st = status(code); $("cp-status").textContent = st.k;
    }
    mods.forEach(li => {
      li.querySelector("input").addEventListener("change", ev => {
        const key = code + "." + li.dataset.i;
        if (ev.target.checked) S.mods[key] = today(); else delete S.mods[key];
        save(); refresh();
      });
      li.querySelector("[data-quiz]").onclick = () => start({ kind: "module", i: +li.dataset.i });
    });
    $("cp-exam").onclick = () => start({ kind: "exam" });

    let run = null;
    function start(spec, only) {
      let pool;
      if (only) pool = only;
      else if (spec.kind === "module") pool = D.qs.filter(q => q.m === spec.i);
      else pool = shuffle(D.qs).slice(0, D.exam);
      run = { spec, practice: !!only, qs: shuffle(pool), at: 0, right: 0, missed: [] };
      box.hidden = false; ask(); box.scrollIntoView({ block: "nearest" });
    }
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

    function ask() {
      const q = run.qs[run.at], opts = shuffle(q.a.map((t, i) => ({ t, ok: i === 0 })));
      box.textContent = "";
      const title = run.spec.kind === "module" ? "module " + (run.spec.i + 1) + " quiz" : "exam";
      box.appendChild(el("p", "cq__head muted", "// " + title + (run.practice ? " (retry, not recorded)" : "") + " · question " + (run.at + 1) + " of " + run.qs.length));
      box.appendChild(el("h3", "cq__q", q.q));
      const list = el("div", "cq__opts"); let locked = false;
      const fb = el("div", "cq__fb"); fb.setAttribute("role", "status");
      opts.forEach((o, n) => {
        const b = el("button", "cq__opt"); b.type = "button";
        b.appendChild(el("span", "cq__n", String(n + 1))); b.appendChild(document.createTextNode(" " + o.t));
        b.onclick = () => {
          if (locked) return; locked = true;
          [].slice.call(list.children).forEach((c, k) => { c.disabled = true; if (opts[k].ok) c.classList.add("right"); });
          if (o.ok) { run.right++; b.classList.add("right"); fb.textContent = "correct. " + q.e; }
          else { b.classList.add("wrong"); run.missed.push(q); fb.textContent = "not quite. " + q.e; }
          const nx = el("button", "btn", run.at + 1 < run.qs.length ? "[ next ]" : "[ see result ]"); nx.type = "button";
          nx.onclick = () => { run.at++; if (run.at < run.qs.length) ask(); else finish(); };
          fb.appendChild(document.createElement("br")); fb.appendChild(nx); nx.focus();
        };
        list.appendChild(b);
      });
      box.appendChild(list); box.appendChild(fb);
      box.onkeydown = ev => {
        const n = +ev.key; if (n >= 1 && n <= opts.length && !locked) list.children[n - 1].click();
      };
    }

    function finish() {
      const n = run.qs.length, pc = pct(run.right, n), pass = run.right >= need(n);
      box.textContent = ""; box.onkeydown = null;
      box.appendChild(el("h3", "cq__q", run.right + " / " + n + " (" + pc + "%) " + (pass ? "[ pass ]" : "[ not yet ]")));
      if (!run.practice) {
        const spec = run.spec;
        if (spec.kind === "module") {
          const key = code + "." + spec.i, q = S.quiz[key] || { best: 0, n: 0 };
          q.best = Math.max(q.best, pc); q.n++; q.date = today(); S.quiz[key] = q;
          if (pass && !S.mods[key]) S.mods[key] = today();
        } else {
          const ex = S.exam[code] || { best: 0, n: 0 };
          const first = !ex.pass && pass;
          ex.best = Math.max(ex.best, pc); ex.n++;
          if (first) { ex.pass = true; ex.date = today(); ex.out = modsDone(code) === 0; }
          S.exam[code] = ex;
        }
        save();
        let line = pass ? "Recorded." : "Need " + Math.ceil(PASS * 100) + "% (" + need(n) + " of " + n + ") to pass. Recorded as an attempt.";
        if (pass && run.spec.kind === "exam" && S.exam[code].out) line = "Tested out. The modules stay available if you want them anyway.";
        box.appendChild(el("p", "", line));
      }
      if (run.missed.length) {
        box.appendChild(el("h4", "", "missed"));
        const ul = el("ul", "cq__miss");
        run.missed.forEach(q => { const li = el("li"); li.appendChild(el("strong", "", q.q)); li.appendChild(el("div", "ok", "answer: " + q.a[0])); if (q.e) li.appendChild(el("div", "muted small", q.e)); ul.appendChild(li); });
        box.appendChild(ul);
      }
      const row = el("p");
      if (run.missed.length) { const r = el("button", "btn", "[ retry missed ]"); r.type = "button"; const miss = run.missed; r.onclick = () => start(run.spec, miss); row.appendChild(r); row.appendChild(document.createTextNode(" ")); }
      const again = el("button", "btn", "[ again ]"); again.type = "button"; const sp = run.spec; again.onclick = () => start(sp); row.appendChild(again); row.appendChild(document.createTextNode(" "));
      const cl = el("button", "btn", "[ close ]"); cl.type = "button"; cl.onclick = () => { box.hidden = true; box.textContent = ""; }; row.appendChild(cl);
      box.appendChild(row);
      refresh();
    }
    refresh();
  }
})();
