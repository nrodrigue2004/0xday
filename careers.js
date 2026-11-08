/* 0xDay ~/careers: filter interview questions, expand answers, mark "can answer", random drill.
   Progress is saved in localStorage only. */
(function () {
  const KEY = "oxday-careers";
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const put = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  let done = get(), lvl = "all";
  const items = () => [...document.querySelectorAll(".qa__item")];
  function paint() {
    let shown = 0, got = 0;
    items().forEach(li => {
      const d = !!done[li.dataset.q];
      li.classList.toggle("done", d);
      const b = li.querySelector(".qa__done");
      b.setAttribute("aria-pressed", d); b.textContent = d ? "[x] can answer" : "[ ] can answer";
      const name = { e: "easy", n: "normal", h: "hard" }[li.dataset.lv];
      li.hidden = !(lvl === "all" || lvl === name);
      if (!li.hidden) { shown++; if (d) got++; }
    });
    const c = document.querySelector(".qa__count");
    if (c) c.textContent = shown + " shown, " + got + " marked can-answer";
    document.querySelectorAll(".qa__prog").forEach(el => {
      const p = el.dataset.path, n = Object.keys(done).filter(k => k.startsWith(p + ".") && done[k]).length;
      el.textContent = n ? n + "/" + el.dataset.total : "";
    });
  }
  document.addEventListener("click", e => {
    const chip = e.target.closest(".qa__chip");
    if (chip) {
      lvl = chip.dataset.lv;
      document.querySelectorAll(".qa__chip").forEach(x => x.setAttribute("aria-pressed", x === chip));
      return paint();
    }
    const b = e.target.closest(".qa__done");
    if (b) {
      const q = b.closest(".qa__item").dataset.q;
      if (done[q]) delete done[q]; else done[q] = 1;
      put(done); return paint();
    }
    if (e.target.closest(".qa__open")) {
      const ds = items().filter(li => !li.hidden).map(li => li.querySelector("details"));
      const open = ds.some(d => !d.open);
      ds.forEach(d => d.open = open);
      e.target.closest(".qa__open").textContent = open ? "[ collapse all ]" : "[ expand all ]";
      return;
    }
    if (e.target.closest(".qa__rand")) {
      const pool = items().filter(li => !li.hidden && !done[li.dataset.q]);
      if (!pool.length) return;
      items().forEach(li => { li.classList.remove("hit"); li.querySelector("details").open = false; });
      const li = pool[Math.floor(Math.random() * pool.length)];
      li.classList.add("hit"); li.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  if (document.readyState !== "loading") paint(); else document.addEventListener("DOMContentLoaded", paint);
})();
