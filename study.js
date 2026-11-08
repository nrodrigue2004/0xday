/* 0xDay Security+ study: checklists, private notes, flashcards (Leitner spaced repetition), progress. localStorage only. */
(function () {
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const INTERVAL = [0, 1, 2, 4, 8, 16, 32];
  const cardState = () => get("oxday-cards", {});
  const isDue = (st, id) => !st[id] || st[id].due <= today();
  const mastered = (st, id) => st[id] && st[id].box >= 3;
  const json = id => { const e = document.getElementById(id); return e ? JSON.parse(e.textContent) : null; };
  const bar = (pct, w = 20) => { const n = Math.round(pct / 100 * w); return `<span class="bar"><span class="bar__on">${"#".repeat(n)}</span><span class="bar__off">${"-".repeat(w - n)}</span></span> <span class="muted">${pct}%</span>`; };

  // objective progress: 3 checkboxes + share of mastered cards, each a quarter
  function objPct(oid, ncards, st) {
    const c = get("oxday-sp", {})[oid] || {};
    let m = 0; for (let i = 0; i < ncards; i++) if (mastered(st, `${oid}-${i}`)) m++;
    const cards = ncards ? m / ncards : 0;
    return Math.round(((c.watched ? 1 : 0) + (c.notes ? 1 : 0) + (c.own ? 1 : 0) + cards) / 4 * 100);
  }

  function objectivePage() {
    const box = document.querySelector(".obj[data-obj]"); if (!box) return;
    const oid = box.dataset.obj, all = get("oxday-sp", {}), mine = all[oid] || {};
    box.querySelectorAll(".checks input[data-k]").forEach(i => {
      if (i.dataset.k === "cards") return;
      i.checked = !!mine[i.dataset.k];
      i.addEventListener("change", () => { const a = get("oxday-sp", {}); a[oid] = a[oid] || {}; a[oid][i.dataset.k] = i.checked; set("oxday-sp", a); });
    });
    const ta = box.querySelector(".mynotes"), notes = get("oxday-sp-notes", {});
    ta.value = notes[oid] || "";
    let t; ta.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { const n = get("oxday-sp-notes", {}); n[oid] = ta.value; set("oxday-sp-notes", n); const a = get("oxday-sp", {}); a[oid] = a[oid] || {}; if (ta.value.trim().length > 40 && !a[oid].own) { a[oid].own = true; set("oxday-sp", a); box.querySelector('[data-k="own"]').checked = true; } }, 400); });
  }

  /* ---------- flashcard deck ---------- */
  function deck(el, cards, drill) {
    let queue = [], cur = null, shown = false, done = 0, cram = false;
    const filt = () => { if (!drill) return cards; const on = [...document.querySelectorAll(".domf:checked")].map(x => x.value); return cards.filter(c => on.includes(c.o[0])); };
    function build() {
      const st = cardState(), pool = filt();
      queue = cram ? pool.slice() : pool.filter(c => isDue(st, c.id));
      if (!drill && !queue.length) queue = pool.slice();
      queue.sort(() => Math.random() - .5);
      if (!drill) queue.sort((a, b) => isDue(st, b.id) - isDue(st, a.id));
      next();
    }
    function stats() {
      const st = cardState(), m = cards.filter(c => mastered(st, c.id)).length;
      const pct = el.closest(".obj")?.querySelector(".cards-pct"); if (pct) pct.textContent = `(${m}/${cards.length})`;
      const cb = el.closest(".obj")?.querySelector('[data-k="cards"]'); if (cb) cb.checked = cards.length && m === cards.length;
    }
    function next() {
      shown = false; cur = queue.shift(); stats();
      if (!cur) {
        el.innerHTML = `<div class="fc"><div class="fc__bar"><span>flashcard ${drill ? "--drill" : "--deck " + esc(el.dataset.deck)}</span><span>${done} reviewed</span></div>
          <div class="fc__q"><span class="ok">[ queue empty ]</span> nothing due right now. Come back tomorrow, or keep cramming.</div>
          <div class="fc__btns"><button type="button" class="btn" data-a="cram">[ cram all anyway ]</button></div></div>`;
        return;
      }
      const st = cardState()[cur.id];
      el.innerHTML = `<div class="fc"><div class="fc__bar"><span>flashcard ${drill ? "--drill · " + esc(cur.o) : "--deck " + esc(el.dataset.deck)}</span><span>${queue.length + 1} left · box ${st ? st.box : 0}/5</span></div>
        <div class="fc__q">${esc(cur.q)}</div>
        <div class="fc__a" aria-live="polite"></div>
        <div class="fc__btns"><button type="button" class="btn" data-a="flip">[ space ] decrypt answer</button></div></div>`;
    }
    function flip() {
      if (!cur || shown) return; shown = true;
      const a = el.querySelector(".fc__a"), txt = cur.a, chars = "0123456789abcdef#$%&*";
      const fast = matchMedia("(prefers-reduced-motion: reduce)").matches; let f = 0;
      const tick = () => {
        const n = Math.floor(txt.length * f / 14);
        a.textContent = txt.slice(0, n) + [...txt.slice(n)].map(c => (c === " " ? " " : chars[Math.random() * chars.length | 0])).join("");
        if (f++ < 14 && !fast) requestAnimationFrame(tick); else a.textContent = txt;
      };
      tick();
      el.querySelector(".fc__btns").innerHTML = `<button type="button" class="btn g1" data-a="1">[1] again</button><button type="button" class="btn g2" data-a="2">[2] hard</button><button type="button" class="btn g3" data-a="3">[3] got it</button>`;
    }
    function grade(g) {
      if (!cur || !shown) return;
      const all = cardState(), s = all[cur.id] || { box: 0 };
      if (g === 1) { s.box = 1; s.due = today(); queue.splice(Math.min(3, queue.length), 0, cur); }
      else if (g === 2) { s.box = Math.max(1, s.box); s.due = addDays(1); }
      else { s.box = Math.min(5, s.box + 1); s.due = addDays(INTERVAL[s.box]); }
      all[cur.id] = s; set("oxday-cards", all); done++;
      // miss log shared with ~/secplus/train (weak-spot drill)
      const w = get("oxday-weak", {}), e = w[cur.id] || { m: 0, c: 0 };
      if (g === 1) { e.m++; e.c = 0; } else if (g === 3) e.c++;
      e.o = cur.o || cur.id.split("-")[0]; e.t = today(); w[cur.id] = e; set("oxday-weak", w);
      next();
    }
    el.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a; if (a === "flip") flip(); else if (a === "cram") { cram = true; build(); } else grade(+a); });
    el.tabIndex = 0;
    document.addEventListener("keydown", e => {
      if (/input|textarea/i.test(document.activeElement.tagName)) return;
      if (drill || el.matches(":hover") || el.contains(document.activeElement) || document.querySelectorAll(".deck").length === 1) {
        if (e.key === " " && cur && !shown) { e.preventDefault(); flip(); }
        else if (/^[123]$/.test(e.key) && shown) grade(+e.key);
      }
    });
    document.querySelectorAll(".domf").forEach(x => x.addEventListener("change", () => { cram = false; build(); }));
    build();
  }

  function index() {
    const D = json("sp-data"); if (!D) return;
    const st = cardState(); let tw = 0, tot = 0, m = 0, due = 0, n = 0;
    for (const oid of D.objectives) for (let i = 0; i < D.cards[oid]; i++) { n++; const id = `${oid}-${i}`; if (mastered(st, id)) m++; if (isDue(st, id)) due++; }
    for (const [dn, d] of Object.entries(D.domains)) {
      const objs = D.objectives.filter(o => o.startsWith(dn + ".")); let sum = 0;
      objs.forEach(o => { const p = objPct(o, D.cards[o], st); sum += p; const r = document.querySelector(`.objrow[data-obj="${o}"] .objbar`); if (r) r.innerHTML = bar(p, 10); });
      const avg = objs.length ? Math.round(sum / objs.length) : 0;
      const db = document.querySelector(`.domsec[data-dom="${dn}"] .dombar`); if (db) db.innerHTML = "domain " + bar(avg);
      tw += d.weight * avg; tot += d.weight;
    }
    document.getElementById("sp-overall").textContent = Math.round(tw / tot) + "%";
    document.getElementById("sp-mastered").textContent = `${m}/${n}`;
    document.getElementById("sp-due").textContent = due;
  }

  function init() {
    objectivePage(); index();
    const cards = json("cards-data");
    document.querySelectorAll(".deck").forEach(d => deck(d, cards || [], d.dataset.deck === "all"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
