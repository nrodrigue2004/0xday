/* 0xDay ~/grc/risk-worksheet: ALE calculator and a small risk register. localStorage only (key oxday-risk). Nothing leaves the browser. */
(function () {
  const KEY = "oxday-risk", $ = id => document.getElementById(id);
  if (!$("rw")) return;
  const TREAT = ["mitigate", "transfer", "accept", "avoid"];
  const money = n => "$" + Math.round(n).toLocaleString("en-US");
  const num = id => { const v = parseFloat($(id).value); return isFinite(v) && v >= 0 ? v : 0; };
  const band = s => (s >= 13 ? ["high", "rw__hi"] : s >= 6 ? ["medium", "rw__md"] : ["low", "rw__lo"]);
  const clean = r => r && typeof r.name === "string" && r.name && r.l >= 1 && r.l <= 5 && r.i >= 1 && r.i <= 5 && TREAT.includes(r.t);
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v.filter(clean) : []; } catch (e) { return []; } };
  let reg = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(reg)); $("rw-msg").textContent = ""; } catch (e) { $("rw-msg").textContent = "could not save (storage blocked?)"; } };

  function calc() {
    const av = num("av"), ef = Math.min(num("ef"), 100) / 100, aro = num("aro"), ale2 = num("aro2"), cost = num("cost");
    const sle = av * ef, ale = sle * aro, after = sle * ale2, net = ale - after - cost;
    $("rw-sle").textContent = money(sle);
    $("rw-ale").textContent = money(ale);
    $("rw-after").textContent = money(after);
    $("rw-net").textContent = (net >= 0 ? "+" : "-") + money(Math.abs(net)) + (cost && ale ? (net > 0 ? " per year: worth buying" : " per year: not worth the cost") : "");
  }
  ["av", "ef", "aro", "aro2", "cost"].forEach(id => $(id).addEventListener("input", calc));
  calc();

  function td(tr, text, cls) { const c = document.createElement("td"); c.textContent = text; if (cls) c.className = cls; tr.appendChild(c); return c; }
  function render() {
    const body = $("rw-body"); body.textContent = "";
    reg.slice().sort((a, b) => b.l * b.i - a.l * a.i).forEach(r => {
      const tr = document.createElement("tr"), s = r.l * r.i, b = band(s);
      td(tr, r.name); td(tr, r.owner || "-"); td(tr, String(r.l)); td(tr, String(r.i));
      td(tr, s + " " + b[0], b[1]); td(tr, r.t);
      const c = document.createElement("td"), x = document.createElement("button");
      x.type = "button"; x.className = "btn btn--sm"; x.textContent = "[x]"; x.setAttribute("aria-label", "delete risk " + r.name);
      x.addEventListener("click", () => { reg.splice(reg.indexOf(r), 1); save(); render(); });
      c.appendChild(x); tr.appendChild(c); body.appendChild(tr);
    });
    $("rw-empty").hidden = reg.length > 0;
    $("rw-tbl").hidden = reg.length === 0;
  }
  $("rw-add").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("r-name").value.trim().slice(0, 140);
    if (!name) return;
    reg.push({ name, owner: $("r-owner").value.trim().slice(0, 60), l: +$("r-l").value, i: +$("r-i").value, t: $("r-t").value });
    $("r-name").value = ""; save(); render();
  });
  $("rw-csv").addEventListener("click", () => {
    const q = s => '"' + String(s).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
    const rows = [["risk", "owner", "likelihood", "impact", "score", "treatment"]].concat(reg.map(r => [r.name, r.owner || "", r.l, r.i, r.l * r.i, r.t]));
    const blob = new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "risk-register.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("rw-clear").addEventListener("click", () => { if (!reg.length || !confirm("Delete all " + reg.length + " risks from this browser?")) return; reg = []; save(); render(); });
  render();
})();
