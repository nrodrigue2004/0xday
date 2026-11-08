/* 0xDay ~/glossary: live filter by text and category. */
(function () {
  function init() {
    const q = document.getElementById("gl-q"), n = document.getElementById("gl-n"), rows = [...document.querySelectorAll(".gl")];
    if (!q) return;
    let cat = "";
    const run = () => {
      const v = q.value.trim().toLowerCase(); let c = 0;
      rows.forEach(r => { const ok = (!v || r.dataset.t.includes(v)) && (!cat || r.dataset.c === cat); r.hidden = !ok; if (ok) c++; });
      n.textContent = c + " of " + rows.length;
    };
    q.addEventListener("input", run);
    document.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
      cat = b.dataset.c; document.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b)); run();
    }));
    run();
    if (location.hash.startsWith("#t-")) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
