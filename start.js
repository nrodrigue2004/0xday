/* 0xDay ~/start: ordered curriculum with progress. localStorage only (key oxday-start). Weeks start Monday, dates are local. */
(function () {
  const KEY = "oxday-start";
  const root = document.getElementById("st");
  if (!root) return;
  const $ = id => document.getElementById(id);
  const steps = [].slice.call(root.querySelectorAll(".st__step"));
  const ids = new Set(steps.map(s => s.dataset.id));
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
  let done = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { $("st-msg").textContent = "could not save (storage blocked?)"; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  let hide = false; try { hide = localStorage.getItem(KEY + "-hide") === "1"; } catch (e) {}

  function weekMinutes() {
    let log = []; try { log = JSON.parse(localStorage.getItem("oxday-log")) || []; } catch (e) {}
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return log.filter(e => e && e.date >= iso(mon)).reduce((a, e) => a + (+e.min || 0), 0);
  }
  const fmt = m => m >= 120 ? (m / 60).toFixed(1) + " h" : m + " min";

  function render() {
    let n = 0, mins = 0, left = 0, next = null;
    steps.forEach(s => {
      const on = !!done[s.dataset.id], m = +s.dataset.m;
      s.classList.toggle("done", on);
      s.classList.remove("next");
      s.querySelector("input").checked = on;
      s.hidden = hide && on;
      if (on) { n++; mins += m; } else { left += m; if (!next) next = s; }
    });
    if (next) next.classList.add("next");
    root.querySelectorAll(".st__stage").forEach(st => {
      const ss = [].slice.call(st.querySelectorAll(".st__step"));
      const d = ss.filter(s => done[s.dataset.id]).length;
      st.querySelector(".st__bar i").style.width = (ss.length ? d / ss.length * 100 : 0) + "%";
      st.querySelector(".st__count").textContent = d + "/" + ss.length;
      st.hidden = hide && d === ss.length;
    });
    $("st-pct").textContent = Math.round(n / steps.length * 100) + "%";
    $("st-hrs").textContent = fmt(mins) + " studied · ~" + fmt(left) + " to go";
    $("st-week").textContent = fmt(weekMinutes());
    const box = $("st-next");
    if (next) {
      const t = next.querySelector(".st__t");
      const topic = next.dataset.topic, m = next.dataset.m;
      const q = "log.html?topic=" + encodeURIComponent(topic) + "&min=" + encodeURIComponent(Math.min(+m, 120)) + "&what=" + encodeURIComponent(t.textContent);
      box.innerHTML = `<span class="k">// next up</span><h2><a href="${esc(t.getAttribute("href"))}">${esc(t.textContent)}</a></h2><p>${esc(next.querySelector(".st__w").textContent)}</p>` +
        `<button class="btn" type="button" id="st-done">[ mark done ]</button> <a class="btn" id="st-donelog" href="${esc(q)}">[ done + log it ]</a>`;
      $("st-done").onclick = () => { done[next.dataset.id] = iso(new Date()); save(); render(); };
      $("st-donelog").onclick = () => { done[next.dataset.id] = iso(new Date()); save(); };
    } else {
      box.innerHTML = '<span class="k">// done</span><h2>every step checked</h2><p>Keep the application count up and the log going. Come back when new sections land.</p>';
    }
    $("st-hide").setAttribute("aria-pressed", hide ? "true" : "false");
    $("st-hide").textContent = hide ? "[ show done ]" : "[ hide done ]";
  }

  root.addEventListener("change", ev => {
    const s = ev.target.closest(".st__step"); if (!s) return;
    if (ev.target.checked) done[s.dataset.id] = iso(new Date()); else delete done[s.dataset.id];
    save(); render();
  });
  $("st-hide").onclick = () => { hide = !hide; try { localStorage.setItem(KEY + "-hide", hide ? "1" : "0"); } catch (e) {} render(); };
  let armed = 0;
  $("st-reset").onclick = () => {
    if (!armed) { armed = 1; $("st-reset").textContent = "[ really reset? ]"; setTimeout(() => { armed = 0; $("st-reset").textContent = "[ reset ]"; }, 4000); return; }
    armed = 0; $("st-reset").textContent = "[ reset ]"; done = {}; save(); render();
  };
  $("st-export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(done, null, 1)], { type: "application/json" }));
    a.download = "0xday-start-progress-" + iso(new Date()) + ".json"; a.click(); URL.revokeObjectURL(a.href);
  };
  $("st-import").onclick = () => $("st-file").click();
  $("st-file").onchange = () => {
    const f = $("st-file").files[0]; if (!f) return;
    f.text().then(t => {
      const v = JSON.parse(t); let k = 0;
      Object.keys(v).forEach(id => { if (ids.has(id)) { done[id] = String(v[id]).slice(0, 10); k++; } });
      save(); $("st-msg").textContent = "imported " + k + " steps."; render();
    }).catch(() => { $("st-msg").textContent = "that file is not a valid progress export."; });
  };
  render();
})();
