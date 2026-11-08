/* 0xDay ~/log: weekly study log + streak. localStorage only (key oxday-log). Weeks start Monday, dates are local. */
(function () {
  const KEY = "oxday-log", GKEY = "oxday-log-goal";
  const NAMES = { secplus: "Security+", homelab: "homelab", dojo: "coding dojo", interview: "interview prep", thm: "TryHackMe", reading: "reading / writing", other: "other" };
  const $ = id => document.getElementById(id);
  if (!$("lg")) return;
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { $("lg-msg").textContent = "could not save (storage blocked?)"; } };
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = d => addDays(d, -((d.getDay() + 6) % 7));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clean = e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.min > 0 && typeof e.what === "string";
  let log = load().filter(clean);
  let goal = 5; try { goal = +localStorage.getItem(GKEY) || 5; } catch (e) {}

  function render() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tIso = iso(today);
    const byDay = {};
    log.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.min; });
    // streak: consecutive days ending today (or yesterday if nothing logged yet today)
    let streak = 0, c = byDay[tIso] ? today : addDays(today, -1);
    while (byDay[iso(c)]) { streak++; c = addDays(c, -1); }
    const days = Object.keys(byDay).sort();
    let best = 0, run = 0, prev = null;
    days.forEach(d => { run = prev && iso(addDays(parse(prev), 1)) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    $("lg-streak").textContent = streak;
    $("lg-best").textContent = best ? "best: " + best : "log something to start";
    const mon = monday(today), wk = [];
    let weekMin = 0, weekDays = 0;
    for (let i = 0; i < 7; i++) { const d = addDays(mon, i), k = iso(d), m = byDay[k] || 0; wk.push([d, k, m]); weekMin += m; if (m) weekDays++; }
    $("lg-week").textContent = weekMin + " min";
    $("lg-days").textContent = weekDays + " of 7 days";
    $("lg-total").textContent = log.length;
    $("lg-hours").textContent = (log.reduce((a, e) => a + e.min, 0) / 60).toFixed(1) + " hours total";
    $("lg-weekgrid").innerHTML = wk.map(([d, k, m]) =>
      `<div class="lg__day${m ? " on" : ""}${k === tIso ? " today" : ""}${k > tIso ? " future" : ""}"><b>${"MTWTFSS"[wk.findIndex(x => x[1] === k)]}</b>${m ? m + "m" : "·"}</div>`).join("");
    const split = {};
    log.filter(e => e.date >= iso(mon)).forEach(e => { split[e.topic] = (split[e.topic] || 0) + e.min; });
    $("lg-split").textContent = Object.keys(split).length ? Object.entries(split).sort((a, b) => b[1] - a[1]).map(([t, m]) => (NAMES[t] || t) + " " + m + "m").join(" · ") : "nothing logged this week yet";
    const need = goal - weekDays;
    $("lg-goalmsg").textContent = need <= 0 ? "goal met this week." : need + " more " + (need === 1 ? "day" : "days") + " to hit it.";
    // last 8 weeks
    const rows = [];
    for (let w = 7; w >= 0; w--) {
      const s = addDays(mon, -7 * w); let m = 0;
      for (let i = 0; i < 7; i++) m += byDay[iso(addDays(s, i))] || 0;
      rows.push([iso(s), m]);
    }
    const mx = Math.max(60, ...rows.map(r => r[1]));
    $("lg-bars").textContent = rows.map(([d, m]) => d.slice(5) + " " + "█".repeat(Math.round(m / mx * 30)).padEnd(30, "░") + " " + m + "m").join("\n");
    const sorted = log.map((e, i) => [e, i]).sort((a, b) => b[0].date.localeCompare(a[0].date) || b[1] - a[1]);
    $("lg-list").innerHTML = sorted.length ? sorted.map(([e, i]) =>
      `<div class="lg__e"><span class="d">${e.date}</span><span class="t">${esc(NAMES[e.topic] || e.topic)}</span><span class="m">${e.min}m</span><span>${esc(e.what)}${e.note ? `<span class="n">${esc(e.note)}</span>` : ""}</span><button type="button" data-del="${i}" aria-label="delete entry">[x]</button></div>`).join("")
      : '<p class="muted">No entries yet.</p>';
  }

  $("lg-date").value = iso(new Date());
  $("lg-goal").value = String(goal);
  $("lg-form").addEventListener("submit", ev => {
    ev.preventDefault();
    const e = { date: $("lg-date").value, topic: $("lg-topic").value, min: Math.max(1, Math.min(720, +$("lg-min").value | 0)), what: $("lg-what").value.trim(), note: $("lg-note").value.trim() };
    if (!clean(e) || !e.what) return;
    log.push(e); save(log);
    $("lg-what").value = ""; $("lg-note").value = "";
    $("lg-msg").textContent = "logged.";
    render();
  });
  $("lg-list").addEventListener("click", ev => {
    const b = ev.target.closest("[data-del]"); if (!b) return;
    log.splice(+b.dataset.del, 1); save(log); render();
  });
  $("lg-goal").addEventListener("change", () => { goal = +$("lg-goal").value; try { localStorage.setItem(GKEY, goal); } catch (e) {} render(); });
  $("lg-export").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(log, null, 1)], { type: "application/json" }));
    a.download = "0xday-study-log-" + iso(new Date()) + ".json"; a.click(); URL.revokeObjectURL(a.href);
  });
  $("lg-import").addEventListener("click", () => $("lg-file").click());
  $("lg-file").addEventListener("change", () => {
    const f = $("lg-file").files[0]; if (!f) return;
    f.text().then(t => {
      const v = JSON.parse(t).filter(clean).map(e => ({ date: e.date, topic: e.topic in NAMES ? e.topic : "other", min: +e.min, what: String(e.what).slice(0, 200), note: String(e.note || "").slice(0, 300) }));
      const seen = new Set(log.map(e => JSON.stringify(e)));
      v.forEach(e => { if (!seen.has(JSON.stringify(e))) log.push(e); });
      save(log); $("lg-msg").textContent = "imported " + v.length + " entries."; render();
    }).catch(() => { $("lg-msg").textContent = "that file is not a valid log."; });
  });
  render();
})();
