/* 0xDay ~/jobs: application tracker. localStorage only (keys oxday-jobs, oxday-jobs-goal). Dates are local. */
(function () {
  const KEY = "oxday-jobs", GKEY = "oxday-jobs-goal";
  const ST = [["wishlist", "wishlist"], ["applied", "applied"], ["screen", "phone screen"], ["interview", "interview"], ["offer", "offer"], ["rejected", "rejected"], ["ghosted", "no reply"], ["withdrawn", "withdrawn"]];
  const NAME = Object.fromEntries(ST), $ = id => document.getElementById(id);
  if (!$("jb")) return;
  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = d => addDays(d, -((d.getDay() + 6) % 7));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dateOk = s => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s);
  const clean = a => a && typeof a.co === "string" && a.co && typeof a.role === "string" && a.status in NAME && dateOk(a.date || "") && dateOk(a.nextDate || "");
  const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v.filter(clean) : []; } catch (e) { return []; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(apps)); } catch (e) { $("jb-msg").textContent = "could not save (storage blocked?)"; } };
  let apps = load(), filter = "all", editing = -1, goal = 5;
  try { goal = +localStorage.getItem(GKEY) || 5; } catch (e) {}
  const days = (a, b) => Math.round((a - b) / 864e5);
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const isDue = (a, t) => a.status === "applied" && a.date && days(t, parse(a.date)) >= 7 && !(a.nextDate && parse(a.nextDate) > t);

  function render() {
    const t = today(), mon = iso(monday(t));
    const sent = apps.filter(a => a.status !== "wishlist");
    const wk = sent.filter(a => a.date && a.date >= mon).length;
    const replied = sent.filter(a => ["screen", "interview", "offer", "rejected"].includes(a.status)).length;
    const active = apps.filter(a => ["applied", "screen", "interview"].includes(a.status)).length;
    const due = apps.filter(a => isDue(a, t)).length;
    $("jb-total").textContent = apps.length;
    $("jb-active").textContent = active + " active";
    $("jb-week").textContent = wk;
    $("jb-goal").textContent = wk >= goal ? "weekly goal met" : (goal - wk) + " to hit " + goal;
    $("jb-resp").textContent = sent.length >= 5 ? Math.round(replied / sent.length * 100) + "%" : "–";
    $("jb-resp2").textContent = sent.length >= 5 ? replied + " of " + sent.length + " sent" : "needs 5+ sent";
    $("jb-due").textContent = due;
    const counts = { all: apps.length }; apps.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    $("jb-chips").innerHTML = [["all", "all"], ["due", "follow up"]].concat(ST).map(([k, l]) => {
      const n = k === "due" ? due : counts[k] || 0;
      return (n || k === "all") ? `<button type="button" class="jb__chip" data-f="${k}" aria-pressed="${filter === k}">${esc(l)} ${n}</button>` : "";
    }).join("");
    const rows = apps.map((a, i) => [a, i]).filter(([a]) => filter === "all" || (filter === "due" ? isDue(a, t) : a.status === filter))
      .sort((x, y) => (y[0].date || y[0].added || "").localeCompare(x[0].date || x[0].added || "") || y[1] - x[1]);
    $("jb-list").innerHTML = rows.length ? rows.map(([a, i]) => {
      const d = isDue(a, t), age = a.date ? days(t, parse(a.date)) : null;
      const link = safeUrl(a.url) ? ` · <a href="${esc(a.url)}" rel="noopener noreferrer" target="_blank">posting</a>` : "";
      const nxt = a.nextDate ? ` · next: ${a.nextDate}${parse(a.nextDate) < t && ["applied", "screen", "interview"].includes(a.status) ? ' <span class="due">(overdue)</span>' : ""}` : "";
      return `<div class="jb__app s-${a.status}${d ? " due" : ""}"><div><h3>${esc(a.co)} <span class="muted">/ ${esc(a.role)}</span></h3>` +
        `<div class="jb__meta">${a.date ? "applied " + a.date + " (" + age + "d ago)" : "not sent yet"}${a.resume ? " · resume: " + esc(a.resume) : ""}${nxt}${link}${d ? ' · <span class="due">follow up?</span>' : ""}</div></div>` +
        `<div class="jb__act"><select data-st="${i}" aria-label="status">${ST.map(([k, l]) => `<option value="${k}"${k === a.status ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>` +
        `<button type="button" data-edit="${i}">[edit]</button><button type="button" class="x" data-del="${i}" aria-label="delete">[x]</button></div>` +
        (a.notes ? `<div class="jb__note muted">${esc(a.notes)}</div>` : "") + `</div>`;
    }).join("") : '<p class="muted">' + (apps.length ? "Nothing in this view." : "Nothing tracked yet. Add the first one above.") + "</p>";
  }

  function resetForm() {
    editing = -1; $("jb-form").reset(); $("jb-date").value = iso(new Date());
    $("jb-save").textContent = "[ add ]"; $("jb-cancel").hidden = true; $("jb-formcmd").textContent = 'echo "..." >> ~/applications.tsv';
  }
  $("jb-form").addEventListener("submit", ev => {
    ev.preventDefault();
    const a = { co: $("jb-co").value.trim(), role: $("jb-role").value.trim(), status: $("jb-status").value, date: $("jb-date").value, resume: $("jb-resume").value, nextDate: $("jb-nextdate").value, url: $("jb-url").value.trim(), notes: $("jb-notes").value.trim() };
    if (!a.date && a.status !== "wishlist") a.date = iso(new Date());
    if (a.status === "wishlist") a.date = "";
    if (!clean(a)) return;
    if (editing >= 0) { a.added = apps[editing].added; apps[editing] = a; $("jb-msg").textContent = "updated."; }
    else { a.added = iso(new Date()); apps.push(a); $("jb-msg").textContent = "added."; }
    save(); resetForm(); render();
  });
  $("jb-cancel").onclick = () => { resetForm(); $("jb-msg").textContent = ""; };
  $("jb-status").addEventListener("change", () => { if ($("jb-status").value === "wishlist") $("jb-date").value = ""; else if (!$("jb-date").value) $("jb-date").value = iso(new Date()); });
  $("jb-list").addEventListener("change", ev => {
    const s = ev.target.closest("[data-st]"); if (!s) return;
    const a = apps[+s.dataset.st];
    a.status = s.value; if (a.status !== "wishlist" && !a.date) a.date = iso(new Date());
    save(); render();
  });
  $("jb-list").addEventListener("click", ev => {
    const e = ev.target.closest("[data-edit]"), d = ev.target.closest("[data-del]");
    if (e) {
      const a = apps[+e.dataset.edit]; editing = +e.dataset.edit;
      $("jb-co").value = a.co; $("jb-role").value = a.role; $("jb-status").value = a.status; $("jb-date").value = a.date || "";
      $("jb-resume").value = a.resume || ""; $("jb-nextdate").value = a.nextDate || ""; $("jb-url").value = a.url || ""; $("jb-notes").value = a.notes || "";
      $("jb-save").textContent = "[ save ]"; $("jb-cancel").hidden = false; $("jb-formcmd").textContent = "vi ~/applications.tsv  # editing";
      $("jb-form").scrollIntoView({ block: "center" });
    } else if (d) {
      if (d.dataset.armed) { apps.splice(+d.dataset.del, 1); save(); render(); }
      else { d.dataset.armed = "1"; d.textContent = "[sure?]"; setTimeout(() => { d.dataset.armed = ""; d.textContent = "[x]"; }, 3000); }
    }
  });
  $("jb-chips").addEventListener("click", ev => { const b = ev.target.closest("[data-f]"); if (b) { filter = b.dataset.f; render(); } });
  $("jb-goalsel").value = String(goal);
  $("jb-goalsel").addEventListener("change", () => { goal = +$("jb-goalsel").value; try { localStorage.setItem(GKEY, goal); } catch (e) {} render(); });
  const download = (name, type, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  $("jb-export").onclick = () => download("0xday-applications-" + iso(new Date()) + ".json", "application/json", JSON.stringify(apps, null, 1));
  $("jb-csv").onclick = () => {
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
    const cols = ["co", "role", "status", "date", "resume", "nextDate", "url", "notes"];
    download("0xday-applications-" + iso(new Date()) + ".csv", "text/csv", [cols.join(",")].concat(apps.map(a => cols.map(c => q(a[c])).join(","))).join("\n"));
  };
  $("jb-import").onclick = () => $("jb-file").click();
  $("jb-file").onchange = () => {
    const f = $("jb-file").files[0]; if (!f) return;
    f.text().then(t => {
      const v = JSON.parse(t).filter(clean).map(a => ({ co: a.co.slice(0, 80), role: a.role.slice(0, 100), status: a.status, date: a.date || "", resume: String(a.resume || "").slice(0, 20), nextDate: a.nextDate || "", url: safeUrl(a.url).slice(0, 300), notes: String(a.notes || "").slice(0, 300), added: a.added || iso(new Date()) }));
      const seen = new Set(apps.map(a => JSON.stringify(a)));
      v.forEach(a => { if (!seen.has(JSON.stringify(a))) apps.push(a); });
      save(); $("jb-msg").textContent = "imported " + v.length + " applications."; render();
    }).catch(() => { $("jb-msg").textContent = "that file is not a valid export."; });
  };
  resetForm(); render();
})();
