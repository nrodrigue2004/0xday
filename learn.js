/* 0xDay ~/learn: "got it" tier tracking and the hub's progress bars. Saved in localStorage only. */
(function () {
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const T = ["simple", "mid", "complex"];
  const prog = s => { const r = get("oxday-learn", {})[s] || {}; const labs = get("oxday-labs", {}); return [...T.map(t => !!r[t]), !!labs[s]]; };
  function init() {
    const wrap = document.querySelector(".learn[data-skill]");
    if (wrap) {
      const s = wrap.dataset.skill;
      const paint = () => {
        const p = prog(s);
        document.querySelectorAll(".got").forEach(b => { const on = p[T.indexOf(b.dataset.tier)]; b.textContent = on ? "[x] got it" : "[ ] got it"; b.classList.toggle("on", on); });
        document.querySelectorAll(".tier").forEach(a => { const k = a.dataset.tier; a.classList.toggle("done", k === "lab" ? p[3] : p[T.indexOf(k)]); });
      };
      document.addEventListener("click", e => {
        const b = e.target.closest(".got"); if (!b) return;
        const all = get("oxday-learn", {}); all[s] = all[s] || {}; all[s][b.dataset.tier] = !all[s][b.dataset.tier]; set("oxday-learn", all); paint();
      });
      document.addEventListener("oxday-lab-solved", paint);
      // highlight the tier in view
      const secs = [...document.querySelectorAll(".lvl")], tabs = [...document.querySelectorAll(".tier")];
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) tabs.forEach(t => t.classList.toggle("cur", t.dataset.tier === en.target.dataset.tier)); }), { rootMargin: "-30% 0px -60% 0px" });
        secs.forEach(x => io.observe(x));
      }
      paint();
    }
    document.querySelectorAll(".guiderow").forEach(li => {
      const p = prog(li.dataset.skill), el = li.querySelector(".gprog");
      el.innerHTML = "[" + p.map(x => (x ? '<span class="ok">#</span>' : "-")).join("") + "]";
      if (p.every(Boolean)) li.classList.add("done");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
