/* ~/bigo: growth visualizer + complexity drill */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const data = $("#bo-data"); if (!data) return;
  const D = JSON.parse(data.textContent);

  /* ----- visualizer ----- */
  const F = [
    ["O(1)", n => 1], ["O(log n)", n => Math.max(1, Math.ceil(Math.log2(n)))], ["O(n)", n => n],
    ["O(n log n)", n => n * Math.max(1, Math.ceil(Math.log2(n)))], ["O(n²)", n => n * n], ["O(2ⁿ)", n => Math.pow(2, n)],
  ];
  const fmt = x => x >= 1e9 ? x.toExponential(2).replace("e+", "e") : Math.round(x).toLocaleString("en-US");
  function time(ops) {
    const s = ops / 1e9;
    if (s < 1e-6) return Math.round(s * 1e9) + " ns";
    if (s < 1e-3) return (s * 1e6).toFixed(1) + " µs";
    if (s < 1) return (s * 1e3).toFixed(1) + " ms";
    if (s < 3600) return s.toFixed(1) + " s";
    if (s < 86400 * 365) return (s / 86400).toFixed(1) + " days";
    const y = s / (86400 * 365);
    return (y >= 1e6 ? y.toExponential(1).replace("e+", "e") : y.toFixed(0)) + " years";
  }
  const range = $("#bo-n"), bars = $("#bo-bars");
  function draw() {
    const n = +range.value, max = Math.log10(Math.pow(2, 64)) + 1;
    document.querySelectorAll(".bo__nv").forEach(e => (e.textContent = n));
    bars.innerHTML = F.map(([name, f]) => {
      const ops = f(n), w = Math.max(1, (Math.log10(ops) + 1) / max * 100);
      return `<div class="bo__row"><span class="bo__lbl">${esc(name)}</span><span class="bo__track"><span class="bo__fill" style="width:${w.toFixed(1)}%"></span></span><span class="bo__ops">${fmt(ops)}</span><span class="bo__time muted">${time(ops)}</span></div>`;
    }).join("");
  }
  if (range) { range.addEventListener("input", draw); draw(); }

  /* ----- drill ----- */
  const KEY = "oxday-bigo";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } };
  const st = Object.assign({ i: 0, right: 0, seen: 0 }, load());
  const box = $("#bo-drill");
  function show() {
    const [code, ans, why] = D.drill[st.i % D.drill.length];
    box.querySelector(".bo__prog").textContent = `question ${st.i % D.drill.length + 1}/${D.drill.length} · score ${st.right}/${st.seen}`;
    box.querySelector(".bo__code code").textContent = code;
    box.querySelector(".bo__why").innerHTML = "";
    box.querySelector(".bo__next").hidden = true;
    const ch = box.querySelector(".bo__ch");
    ch.innerHTML = D.choices.map(c => `<button class="btn bo__opt" type="button">${esc(c)}</button>`).join(" ");
    ch.querySelectorAll(".bo__opt").forEach(b => b.addEventListener("click", () => {
      const ok = b.textContent === ans;
      ch.querySelectorAll(".bo__opt").forEach(x => { x.disabled = true; if (x.textContent === ans) x.classList.add("bo__opt--ok"); });
      if (!ok) b.classList.add("bo__opt--bad");
      st.seen++; if (ok) st.right++; save(st);
      box.querySelector(".bo__why").innerHTML = `<span class="${ok ? "ok" : "bad"}">${ok ? "correct" : "no, it's " + esc(ans)}</span> <span class="muted">// ${esc(why).replace(/`([^`]+)`/g, "<code>$1</code>")}</span>`;
      box.querySelector(".bo__next").hidden = false;
      box.querySelector(".bo__prog").textContent = `question ${st.i % D.drill.length + 1}/${D.drill.length} · score ${st.right}/${st.seen}`;
    }));
  }
  box.querySelector(".bo__next").addEventListener("click", () => { st.i = (st.i + 1) % D.drill.length; save(st); show(); });
  show();
})();
