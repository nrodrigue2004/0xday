/* 0xDay i3: a tiling "desktop" where every window is a page of the site. Mod = Alt. */
(function () {
  const el = document.getElementById("i3"); if (!el) return;
  const ROOT = document.documentElement.dataset.root || "";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const APPS = [["home", "index.html"], ["blog", "posts.html"], ["projects", "projects.html"], ["skills", "skills.html"], ["certs", "certs.html"],
    ["ctf", "ctf.html"], ["lab", "lab.html"], ["now", "now.html"], ["about", "about.html"], ["resume", "resume.html"], ["htop", "htop.html"],
    ["tty", "tty.html"], ["man nmap", "man/nmap.html"], ["man wireshark", "man/wireshark.html"], ["changelog", "changelog.html"]];
  const LAYOUTS = ["tile", "splith", "splitv", "tabbed"];
  let uid = 0;
  const win = (name) => { const a = APPS.find(x => x[0] === name) || APPS[0]; return { id: ++uid, name: a[0], url: a[1], full: false }; };
  const WS = { 1: { layout: "tile", wins: [win("home"), win("tty"), win("now")], focus: 0 }, 2: { layout: "splith", wins: [win("htop")], focus: 0 },
    3: { layout: "splitv", wins: [win("blog"), win("about")], focus: 0 }, 4: { layout: "tabbed", wins: [], focus: 0 } };
  let cur = 1;
  if (innerWidth < 800) Object.values(WS).forEach(w => (w.layout = "tabbed"));

  el.innerHTML = `<div class="i3-bar"><div class="i3-ws"></div><div class="i3-title"></div><div class="i3-status"></div></div>
    <div class="i3-dmenu" hidden><label for="i3-dm">run:</label><input id="i3-dm" spellcheck="false" autocomplete="off"><div class="i3-dm-list"></div></div>
    <div class="i3-area"></div>
    <div class="i3-help muted">Alt+Enter open · Alt+Shift+Q close · Alt+1-4 workspace · Alt+←/→ focus · Alt+E layout · Alt+F fullscreen · Alt+Shift+E exit · drag titles to swap</div>`;
  const wsEl = el.querySelector(".i3-ws"), titleEl = el.querySelector(".i3-title"), stat = el.querySelector(".i3-status"), area = el.querySelector(".i3-area");
  const dm = el.querySelector(".i3-dmenu"), dmIn = dm.querySelector("input"), dmList = dm.querySelector(".i3-dm-list");
  const frames = {}; // keep iframes alive across re-layouts

  function frameFor(w) {
    if (frames[w.id]) return frames[w.id];
    const f = document.createElement("iframe");
    f.src = ROOT + w.url + "?embed=1"; f.title = w.name; f.loading = "lazy";
    f.addEventListener("load", () => { try { f.contentWindow.addEventListener("keydown", keys); f.contentWindow.addEventListener("focus", () => focusWin(w)); f.contentDocument.addEventListener("mousedown", () => focusWin(w)); } catch (e) {} });
    return (frames[w.id] = f);
  }
  function focusWin(w) { const ws = WS[cur]; const i = ws.wins.indexOf(w); if (i >= 0 && i !== ws.focus) { ws.focus = i; paint(); } }
  function render() {
    const ws = WS[cur];
    wsEl.innerHTML = Object.keys(WS).map(k => `<button type="button" class="${+k === cur ? "on" : ""}${WS[k].wins.length ? "" : " empty"}" data-ws="${k}">${k}</button>`).join("") +
      `<button type="button" class="i3-btn" data-a="open" title="open (Alt+Enter)">+</button><button type="button" class="i3-btn" data-a="layout" title="layout (Alt+E)">${ws.layout}</button><button type="button" class="i3-btn" data-a="close" title="close (Alt+Shift+Q)">x</button><button type="button" class="i3-btn" data-a="exit" title="exit (Alt+Shift+E)">exit</button>`;
    wsEl.querySelectorAll("[data-ws]").forEach(b => b.addEventListener("click", () => switchWs(+b.dataset.ws)));
    wsEl.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", () => ACT[b.dataset.a]()));
    area.className = "i3-area i3-" + ws.layout + (ws.wins.some(w => w.full) ? " i3-hasfull" : "");
    [...area.children].forEach(c => c.remove());
    if (!ws.wins.length) { area.innerHTML = `<div class="i3-empty"><p>workspace ${cur} is empty.</p><p class="muted">Alt+Enter or <button type="button" class="link" data-a="open">+</button> to open something.</p></div>`; area.querySelector("[data-a]").addEventListener("click", ACT.open); paint(); return; }
    if (ws.layout === "tabbed") {
      const tabs = document.createElement("div"); tabs.className = "i3-tabs";
      tabs.innerHTML = ws.wins.map((w, i) => `<button type="button" data-i="${i}">${esc(w.name)}</button>`).join("");
      tabs.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { ws.focus = +b.dataset.i; paint(); }));
      area.append(tabs);
    }
    const stack = document.createElement("div"); stack.className = "i3-stack";
    ws.wins.forEach((w, i) => {
      const box = document.createElement("section"); box.className = "i3-win"; box.dataset.id = w.id; box.setAttribute("aria-label", w.name);
      box.innerHTML = `<div class="i3-wt" draggable="true"><span>[${i + 1}] ${esc(w.name)}</span><button type="button" aria-label="close ${esc(w.name)}">x</button></div>`;
      box.append(frameFor(w));
      box.querySelector(".i3-wt").addEventListener("mousedown", () => { ws.focus = ws.wins.indexOf(w); paint(); });
      box.querySelector(".i3-wt button").addEventListener("click", e => { e.stopPropagation(); ws.focus = ws.wins.indexOf(w); ACT.close(); });
      const t = box.querySelector(".i3-wt");
      t.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", String(w.id)); });
      box.addEventListener("dragover", e => e.preventDefault());
      box.addEventListener("drop", e => { e.preventDefault(); const from = ws.wins.findIndex(x => x.id === +e.dataTransfer.getData("text/plain")), to = ws.wins.indexOf(w); if (from >= 0 && from !== to) { [ws.wins[from], ws.wins[to]] = [ws.wins[to], ws.wins[from]]; ws.focus = to; render(); } });
      if (ws.layout === "tile" && i === 0) box.classList.add("i3-master");
      (ws.layout === "tile" && i > 0 ? (stack.parentNode ? stack : (area.append(stack), stack)) : area).append(box);
    });
    paint();
  }
  function paint() {
    const ws = WS[cur];
    area.querySelectorAll(".i3-win").forEach((b, i) => { const on = i === ws.focus; b.classList.toggle("on", on); b.classList.toggle("full", !!(ws.wins[i] && ws.wins[i].full)); b.classList.toggle("hidden-tab", ws.layout === "tabbed" && !on); });
    area.querySelectorAll(".i3-tabs button").forEach((b, i) => b.classList.toggle("on", i === ws.focus));
    const w = ws.wins[ws.focus]; titleEl.textContent = w ? `${w.name} - 0xDay` : "";
    document.title = `i3 [${cur}] ${w ? w.name : ""} :: 0xDay`;
  }
  function switchWs(n) { if (!WS[n]) return; cur = n; render(); }
  function openApp(name) { const ws = WS[cur]; ws.wins.push(win(name)); ws.focus = ws.wins.length - 1; render(); }
  const ACT = {
    open: () => { dm.hidden = false; dmIn.value = ""; drawDm(); dmIn.focus(); },
    close: () => { const ws = WS[cur]; const w = ws.wins[ws.focus]; if (!w) return; delete frames[w.id]; ws.wins.splice(ws.focus, 1); ws.focus = Math.max(0, ws.focus - 1); render(); },
    layout: () => { const ws = WS[cur]; ws.layout = LAYOUTS[(LAYOUTS.indexOf(ws.layout) + 1) % LAYOUTS.length]; render(); },
    full: () => { const ws = WS[cur]; const w = ws.wins[ws.focus]; if (w) { w.full = !w.full; render(); } },
    exit: () => { location.href = ROOT + "index.html"; },
    next: () => { const ws = WS[cur]; if (ws.wins.length) { ws.focus = (ws.focus + 1) % ws.wins.length; paint(); } },
    prev: () => { const ws = WS[cur]; if (ws.wins.length) { ws.focus = (ws.focus - 1 + ws.wins.length) % ws.wins.length; paint(); } }
  };
  let dmSel = 0, dmRes = APPS;
  function drawDm() {
    const q = dmIn.value.toLowerCase();
    dmRes = APPS.filter(([n]) => n.includes(q)); dmSel = Math.min(dmSel, Math.max(0, dmRes.length - 1));
    dmList.innerHTML = dmRes.map(([n], i) => `<button type="button" class="${i === dmSel ? "on" : ""}" data-n="${esc(n)}">${esc(n)}</button>`).join("");
    dmList.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { dm.hidden = true; openApp(b.dataset.n); }));
  }
  dmIn.addEventListener("input", () => { dmSel = 0; drawDm(); });
  dmIn.addEventListener("keydown", e => {
    if (e.key === "Escape") { dm.hidden = true; }
    else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); dmSel = Math.min(dmSel + 1, dmRes.length - 1); drawDm(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); dmSel = Math.max(dmSel - 1, 0); drawDm(); }
    else if (e.key === "Enter") { e.preventDefault(); const r = dmRes[dmSel]; dm.hidden = true; if (r) openApp(r[0]); }
  });
  function keys(e) {
    if (!e.altKey) return;
    const k = e.key.toLowerCase();
    let hit = true;
    if (k === "enter") ACT.open();
    else if (e.shiftKey && k === "q") ACT.close();
    else if (e.shiftKey && k === "e") ACT.exit();
    else if (/^[1-4]$/.test(e.code.replace("Digit", ""))) switchWs(+e.code.replace("Digit", ""));
    else if (k === "e") ACT.layout();
    else if (k === "f") ACT.full();
    else if (k === "arrowright" || k === "arrowdown" || k === "l" || k === "j") ACT.next();
    else if (k === "arrowleft" || k === "arrowup" || k === "h" || k === "k") ACT.prev();
    else hit = false;
    if (hit) e.preventDefault();
  }
  addEventListener("keydown", keys);
  function tickStatus() {
    const d = new Date();
    stat.textContent = `cpu ${Math.floor(5 + Math.random() * 20)}% | mem 9.${Math.floor(Math.random() * 9)}G | wlan: 0xday | ${d.toLocaleDateString(undefined, { weekday: "short" })} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  tickStatus(); setInterval(tickStatus, 5000);
  render();
})();
