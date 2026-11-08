/* 0xDay ~/bullets: resume bullet bank + posting matcher. Bank data is embedded at build time from resume.json.
   Picks are kept in localStorage (key oxday-bullets); the pasted posting is never stored or sent. */
(function () {
  const el = document.getElementById("bl-data");
  if (!el) return;
  const D = JSON.parse(el.textContent), $ = id => document.getElementById(id), KEY = "oxday-bullets";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v.filter(t => typeof t === "string") : []; } catch (e) { return []; } };
  let picks = load().filter(t => D.items.some(i => i.t === t)), role = "all", q = "", scores = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) {} };
  const hay = (D.items.map(i => i.t).join(" ") + " " + D.skills.join(" ")).toLowerCase();
  const rx = a => new RegExp("(^|[^a-z0-9+#])" + a.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9])", "i");
  const has = (text, a) => rx(a).test(text);
  const copy = (txt, msg) => {
    const done = () => { $("bl-msg").textContent = msg; setTimeout(() => ($("bl-msg").textContent = ""), 2500); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, () => { $("bl-msg").textContent = "clipboard blocked; select and copy by hand."; });
    else $("bl-msg").textContent = "clipboard not available here.";
  };

  function renderList() {
    const f = q.toLowerCase();
    let rows = D.items.map((b, i) => [b, i]).filter(([b]) => (role === "all" || b.r.includes(role)) && (!f || (b.t + " " + b.s).toLowerCase().includes(f)));
    if (Object.keys(scores).length) rows.sort((a, b) => (scores[b[0].t] || 0) - (scores[a[0].t] || 0) || a[1] - b[1]);
    $("bl-list").innerHTML = rows.map(([b, i]) =>
      `<li class="bl__b${scores[b.t] ? " hit" : ""}"><span>${esc(b.t)}</span><span class="tools"><button type="button" data-copy="${i}" title="copy">[copy]</button><button type="button" data-add="${i}" title="add to picks">[+]</button></span>` +
      `<span class="src">${esc(b.s)}${scores[b.t] ? " · matches " + scores[b.t] + " keyword" + (scores[b.t] > 1 ? "s" : "") : ""}</span></li>`).join("") || '<li class="muted">No bullets match.</li>';
    document.querySelectorAll(".bl__chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.role === role ? "true" : "false"));
  }
  function renderPicks() {
    $("bl-pick").innerHTML = picks.length ? picks.map((t, i) => `<li><span>- ${esc(t)}</span><button type="button" data-rm="${i}" aria-label="remove">[x]</button></li>`).join("") : '<li class="muted">Nothing picked yet.</li>';
    $("bl-count").textContent = picks.length ? "(" + picks.length + ")" : "";
  }
  function match() {
    const jd = $("bl-jd").value.toLowerCase();
    scores = {};
    if (jd.trim().length < 20) { $("bl-match").innerHTML = ""; return renderList(); }
    const wanted = Object.entries(D.kw).filter(([, v]) => v.a.some(a => has(jd, a)));
    const covered = [], gaps = [];
    wanted.forEach(([k, v]) => {
      const hit = v.a.filter(a => has(jd, a));
      D.items.forEach(b => { if (hit.some(a => has(b.t.toLowerCase(), a)) || has(b.t.toLowerCase(), k)) scores[b.t] = (scores[b.t] || 0) + 1; });
      const mine = v.a.some(a => has(hay, a)) || has(hay, k);
      (mine ? covered : gaps).push([k, v.g]);
    });
    const kwHtml = (arr, cls) => arr.length ? arr.map(([k, g]) => g && cls === "gap" ? `<a class="bl__kw gap" href="${esc(g)}">${esc(k)}</a>` : `<span class="bl__kw ${cls}">${esc(k)}</span>`).join("") : '<span class="muted">none</span>';
    $("bl-match").innerHTML = wanted.length
      ? `<div class="grid"><div class="box"><h3>on your resume (${covered.length})</h3>${kwHtml(covered, "have")}</div><div class="box"><h3>in the posting, not on your resume (${gaps.length})</h3>${kwHtml(gaps, "gap")}<p class="muted small">Links go to the guide for that skill. Only add a keyword to your resume once you've actually done it.</p></div></div>` +
        `<p class="muted small">Bullets below are reordered by how many posting keywords they hit. Pick the top few.</p>`
      : '<p class="muted">No known keywords found in that text. The matcher knows common security, IT and software terms.</p>';
    renderList();
  }

  $("bl-jd").addEventListener("input", () => { clearTimeout(match.t); match.t = setTimeout(match, 200); });
  $("bl-q").addEventListener("input", () => { q = $("bl-q").value; renderList(); });
  document.querySelector(".bl__bar").addEventListener("click", ev => { const c = ev.target.closest(".bl__chip"); if (c) { role = c.dataset.role; renderList(); } });
  $("bl-list").addEventListener("click", ev => {
    const c = ev.target.closest("[data-copy]"), a = ev.target.closest("[data-add]");
    if (c) copy(D.items[+c.dataset.copy].t, "copied.");
    if (a) { const t = D.items[+a.dataset.add].t; if (!picks.includes(t)) { picks.push(t); save(); renderPicks(); } }
  });
  $("bl-pick").addEventListener("click", ev => { const r = ev.target.closest("[data-rm]"); if (r) { picks.splice(+r.dataset.rm, 1); save(); renderPicks(); } });
  $("bl-copy").onclick = () => picks.length ? copy(picks.map(t => "- " + t).join("\n"), "copied " + picks.length + " bullets.") : ($("bl-msg").textContent = "pick something first.");
  $("bl-clear").onclick = () => { picks = []; save(); renderPicks(); };
  renderList(); renderPicks();
})();
