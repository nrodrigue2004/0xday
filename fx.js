/* 0xDay fx: tmux status bar, settings, CRT, glitch transitions, sound, vim keys, fzf palette,
   boot sequence, split-pane reader, xxd view. Everything here is optional and degrades to the plain site. */
(function () {
  const OX = window.OX || {};
  const D = OX.D || window.OXDAY || {};
  const ROOT = document.documentElement.dataset.root || "";
  const html = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------------- settings (~/.0xdayrc) ---------------- */
  const DEFAULTS = { crt: false, sound: false, fx: true, vim: false, boot: true };
  const S = Object.assign({}, DEFAULTS, (() => { try { return JSON.parse(ls.get("oxday-set") || "{}"); } catch (e) { return {}; } })());
  const save = () => ls.set("oxday-set", JSON.stringify(S));
  const LABEL = { crt: "crt", sound: "snd", fx: "fx", vim: "vim", boot: "boot" };
  function setOpt(k, v) {
    if (!(k in DEFAULTS)) return false;
    S[k] = v === undefined ? !S[k] : v; save();
    html.classList.toggle("crt", !!S.crt);
    html.classList.toggle("vim", !!S.vim);
    renderBar();
    if (k === "sound" && S.sound) beep(880, .06);
    return true;
  }
  html.classList.toggle("crt", !!S.crt);
  html.classList.toggle("vim", !!S.vim);
  const embed = html.classList.contains("embed");

  /* ---------------- sound (WebAudio, off by default) ---------------- */
  let ac;
  function beep(freq = 440, dur = .05, type = "square", vol = .03) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    } catch (e) {}
  }
  const clack = () => beep(1800 + Math.random() * 900, .015, "square", .012);
  document.addEventListener("keydown", e => { if (/input|textarea/i.test(document.activeElement.tagName) && e.key.length === 1) clack(); });

  /* ---------------- tmux status bar ---------------- */
  const WINDOWS = [["home", "index.html"], ["blog", "posts.html"], ["projects", "projects.html"], ["skills", "skills.html"],
    ["certs", "certs.html"], ["learn", "learn.html"], ["lab", "lab.html"], ["now", "now.html"], ["about", "about.html"]];
  const here = (location.pathname.split("/").pop() || "index.html");
  const inPosts = /\/posts\//.test(location.pathname);
  const inLearn = /\/(learn|secplus)\/[^/]*$|secplus\.html$/.test(location.pathname);
  const curWin = WINDOWS.findIndex(([n, h]) => h === here || (inPosts && n === "blog") || (inLearn && n === "learn"));
  let bar, mode = "NORMAL", cmdline = null;
  function renderBar() {
    if (!bar) return;
    const wins = WINDOWS.map(([n, h], i) => `<a href="${ROOT}${h}" class="tw${i === curWin ? " tw--on" : ""}">${i}:${n}${i === curWin ? "*" : ""}</a>`).join("");
    const toggles = Object.keys(DEFAULTS).map(k => `<button type="button" class="tt${S[k] ? " tt--on" : ""}" data-opt="${k}" aria-pressed="${!!S[k]}" title="toggle ${k}">${LABEL[k]}</button>`).join("");
    const t = new Date(); const clock = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    bar.innerHTML = cmdline !== null
      ? `<form class="tcmd"><label>:</label><input aria-label="command" spellcheck="false" autocomplete="off" value="${esc(cmdline)}"></form>`
      : `<span class="tsess">[0xday]</span><nav class="twins" aria-label="windows">${wins}</nav>
         <span class="tright">${S.vim ? `<span class="tmode">-- ${mode} --</span>` : ""}
         <button type="button" class="tt tfind" title="fuzzy find (Ctrl+P)">find</button>
         <span class="ttoggles">${toggles}</span><span class="tclock">${clock}</span></span>`;
    if (cmdline !== null) {
      const f = bar.querySelector("form"), i = f.querySelector("input");
      i.focus(); i.setSelectionRange(i.value.length, i.value.length);
      i.addEventListener("keydown", e => { if (e.key === "Escape") { cmdline = null; mode = "NORMAL"; renderBar(); } });
      f.addEventListener("submit", e => { e.preventDefault(); const v = i.value; cmdline = null; mode = "NORMAL"; renderBar(); exCommand(v); });
    } else {
      bar.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => setOpt(b.dataset.opt)));
      bar.querySelector(".tfind").addEventListener("click", () => fzf());
    }
  }
  function buildBar() {
    if (embed || html.classList.contains("tty-page")) return;
    bar = document.createElement("div"); bar.className = "tmux"; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "status bar");
    document.body.append(bar); html.classList.add("has-tmux");
    renderBar(); setInterval(() => { if (cmdline === null) renderBar(); }, 30000);
  }
  // tmux prefix: Ctrl+B then a window number, n/p for next/prev
  let prefix = false;
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key.toLowerCase() === "b") { prefix = true; e.preventDefault(); flash("prefix: Ctrl+B"); setTimeout(() => (prefix = false), 1500); return; }
    if (!prefix) return;
    prefix = false;
    if (/^[0-7]$/.test(e.key)) { e.preventDefault(); goto(ROOT + WINDOWS[+e.key][1]); }
    else if (e.key === "n") goto(ROOT + WINDOWS[(curWin + 1) % WINDOWS.length][1]);
    else if (e.key === "p") goto(ROOT + WINDOWS[(curWin - 1 + WINDOWS.length) % WINDOWS.length][1]);
    else if (e.key === "d") goto(ROOT + "tty.html");
  });
  function flash(msg) {
    let f = document.querySelector(".tflash");
    if (!f) { f = document.createElement("div"); f.className = "tflash"; document.body.append(f); }
    f.textContent = msg; f.classList.add("on"); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove("on"), 1400);
  }

  /* ---------------- glitch page transitions ---------------- */
  function goto(url) {
    if (!S.fx || reduced || embed) { location.href = url; return; }
    beep(220, .05, "sawtooth", .02);
    const o = document.createElement("div"); o.className = "glitch-out";
    o.innerHTML = `<div class="go-bar"><i></i></div><div class="go-msg">loading ${esc(url.replace(ROOT, "/"))} ...</div>`;
    document.body.append(o); html.classList.add("tearing");
    setTimeout(() => (location.href = url), 260);
  }
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash) || /\.(xml|txt|pdf)$/.test(u.pathname)) return;
    if (!S.fx || reduced || embed) return;
    e.preventDefault(); goto(u.href);
  });
  addEventListener("pageshow", () => { html.classList.remove("tearing"); document.querySelectorAll(".glitch-out").forEach(x => x.remove()); });

  /* ---------------- vim keys (opt-in) ---------------- */
  let lastG = 0;
  document.addEventListener("keydown", e => {
    if (!S.vim || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/input|textarea|select/i.test(document.activeElement.tagName) || document.querySelector(".fzf")) return;
    const k = e.key, step = 60, half = innerHeight / 2;
    const act = {
      j: () => scrollBy(0, step), k: () => scrollBy(0, -step),
      d: () => scrollBy(0, half), u: () => scrollBy(0, -half),
      G: () => scrollTo(0, document.body.scrollHeight),
      g: () => { const n = Date.now(); if (n - lastG < 400) scrollTo(0, 0); lastG = n; },
      h: () => goto(ROOT + WINDOWS[(Math.max(curWin, 0) - 1 + WINDOWS.length) % WINDOWS.length][1]),
      l: () => goto(ROOT + WINDOWS[(Math.max(curWin, 0) + 1) % WINDOWS.length][1]),
      "/": () => fzf(),
      ":": () => { cmdline = ""; mode = "COMMAND"; renderBar(); },
      i: () => { mode = "INSERT"; renderBar(); OX.open && OX.open(); }
    }[k];
    if (act) { e.preventDefault(); act(); if (k !== ":" && k !== "i") { mode = "NORMAL"; } }
  });
  document.addEventListener("focusout", () => { if (S.vim && mode === "INSERT") { mode = "NORMAL"; renderBar(); } });
  const PAGEALIAS = Object.fromEntries(WINDOWS.map(([n, h]) => [n, h]).concat([["posts", "posts.html"], ["tty", "tty.html"], ["htop", "htop.html"], ["desktop", "desktop.html"], ["i3", "desktop.html"], ["resume", "resume.html"], ["ctf", "ctf.html"], ["man", "man.html"], ["tags", "tags.html"], ["changelog", "changelog.html"], ["homelab", "homelab.html"], ["attack-chain", "attack-chain.html"], ["deep-dives", "deep-dives.html"]]));
  function exCommand(v) {
    v = v.trim(); if (!v) return;
    const [c, ...a] = v.split(/\s+/);
    if (/^q(a|uit)?!?$/.test(c)) return goto(ROOT + "index.html");
    if (/^wq?!?$|^x$/.test(c)) return flash("E45: 'readonly' option is set (add ! to override)");
    if (c === "e" || c === "edit" || c === "o") { const p = PAGEALIAS[(a[0] || "").replace(/\.html$/, "")]; return p ? goto(ROOT + p) : flash(`E484: Can't open file ${a[0] || ""}`); }
    if (c === "set") {
      const m = (a[0] || "").match(/^(no)?(\w+)(!)?$/); if (!m) return flash(Object.entries(S).map(([k, x]) => (x ? "" : "no") + k).join("  "));
      return setOpt(m[2], m[3] ? undefined : !m[1]) ? flash(`${m[1] ? "no" : ""}${m[2]}`) : flash(`E518: Unknown option: ${m[2]}`);
    }
    if (c === "help" || c === "h") return OX.exec && OX.exec("help");
    if (/^\d+$/.test(c)) return scrollTo(0, (+c / 100) * document.body.scrollHeight);
    OX.exec && OX.exec(v); // anything else goes to ghost
  }

  /* ---------------- fzf palette ---------------- */
  function index() {
    const it = [];
    const P = (n, h, kind) => it.push({ n, h: h.startsWith("http") ? h : ROOT + h, kind });
    WINDOWS.forEach(([n, h]) => P("~/" + n, h, "page"));
    [["homelab map", "homelab.html"], ["attack chain", "attack-chain.html"], ["deep-dives", "deep-dives.html"], ["tty mode", "tty.html"], ["htop", "htop.html"], ["i3 desktop", "desktop.html"], ["resume", "resume.html"], ["ctf scoreboard", "ctf.html"], ["man pages", "man.html"], ["tags", "tags.html"], ["changelog", "changelog.html"], ["resources", "resources.html"]].forEach(([n, h]) => P(n, h, "page"));
    (D.posts || []).forEach(p => P(p.title, "posts/" + p.slug + ".html", "post"));
    (D.projects || []).forEach(p => P(p.name, p.url || "projects.html", "project"));
    (D.man || []).forEach(m => P("man " + m.name, "man/" + m.slug + ".html", "man"));
    (D.ctf || []).forEach(c => P(c.name, c.url, "thm"));
    (D.matrix || []).forEach(g => g.skills.forEach(s => P(s.name, "skills.html", "skill")));
    [["security+ study", "secplus.html"], ["flashcard drill", "secplus/drill.html"], ["learn", "learn.html"]].forEach(([n, h]) => P(n, h, "learn"));
    (D.guides || []).forEach(g => P("learn " + g.name, "learn/" + g.slug + ".html", "learn"));
    (D.secplus_objs || []).forEach(o => P("sec+ " + o.id + " " + o.title, "secplus/" + o.id + ".html", "sec+"));
    Object.keys(D.tags || {}).forEach(t => P("#" + t, "tags.html#" + t, "tag"));
    return it;
  }
  function score(q, s) {
    s = s.toLowerCase(); let i = 0, sc = 0, last = -2;
    for (const ch of q.toLowerCase()) {
      const j = s.indexOf(ch, i); if (j < 0) return -1;
      sc += j === last + 1 ? 3 : 1; if (j === 0 || /[\s/#~-]/.test(s[j - 1])) sc += 2; last = j; i = j + 1;
    }
    return sc - s.length * .01;
  }
  function fzf() {
    if (document.querySelector(".fzf")) return;
    const items = index(); let sel = 0, res = items;
    const box = document.createElement("div"); box.className = "fzf"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "fuzzy finder");
    box.innerHTML = `<div class="fzf__win"><ul class="fzf__list" role="listbox"></ul><div class="fzf__info"></div><form class="fzf__prompt"><label for="fzf-in">&gt;</label><input id="fzf-in" spellcheck="false" autocomplete="off" placeholder="fuzzy find pages, posts, rooms, skills"></form></div>`;
    document.body.append(box);
    const list = box.querySelector(".fzf__list"), info = box.querySelector(".fzf__info"), input = box.querySelector("input");
    const hl = (s, q) => { let i = 0, out = ""; const lq = q.toLowerCase(); for (const ch of s) { if (i < lq.length && ch.toLowerCase() === lq[i]) { out += `<b>${esc(ch)}</b>`; i++; } else out += esc(ch); } return out; };
    const draw = () => {
      const q = input.value.trim();
      res = q ? items.map(x => [score(q, x.n), x]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]).map(([, x]) => x) : items;
      sel = Math.min(sel, Math.max(res.length - 1, 0));
      list.innerHTML = res.slice(0, 14).map((x, i) => `<li role="option" aria-selected="${i === sel}" class="${i === sel ? "on" : ""}" data-i="${i}"><span class="fk">${x.kind}</span>${hl(x.n, q)}</li>`).reverse().join("");
      info.textContent = `  ${res.length}/${items.length}`;
    };
    const close = () => box.remove();
    const pick = () => { const x = res[sel]; close(); if (x) { x.h.startsWith("http") && !x.h.startsWith(location.origin) ? (location.href = x.h) : goto(x.h); } };
    input.addEventListener("input", () => { sel = 0; draw(); });
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "k")) { e.preventDefault(); sel = Math.min(sel + 1, Math.min(res.length, 14) - 1); draw(); }
      else if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "j")) { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    });
    box.querySelector("form").addEventListener("submit", e => { e.preventDefault(); pick(); });
    list.addEventListener("click", e => { const li = e.target.closest("li"); if (li) { sel = +li.dataset.i; pick(); } });
    box.addEventListener("click", e => { if (e.target === box) close(); });
    draw(); input.focus();
  }
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); fzf(); } });

  /* ---------------- boot sequence + GRUB ---------------- */
  const POST = ["0xBIOS v4.04 (C) 2026 0xDay Systems", "CPU: x86_64 @ 4.04GHz, 8 cores", "Memory Test: 16777216K OK",
    "Detecting drives ... /dev/sda: 0xDAY-SSD 1TB", "Detecting drives ... /dev/sdb: homelab-raid (7 VMs)", "USB: 1 keyboard, 1 mouse",
    "", "Press DEL to enter setup, any key to skip"];
  const SYSTEMD = ["Started Journal Service.", "Mounted /home/guest.", "Started ghost.service (terminal assistant).", "Reached target Network.",
    "sshd.service: disabled.", "Reached target Graphical Interface."];
  function boot(force) {
    const booting = html.classList.contains("booting");
    if (!force && !booting) return;
    if (embed) { html.classList.remove("booting"); return; }
    const o = document.createElement("div"); o.className = "boot-screen"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "boot screen");
    o.innerHTML = `<pre class="bs-text" aria-live="polite"></pre><button class="bs-skip" type="button">skip boot</button>`;
    document.body.append(o); html.classList.remove("booting"); html.classList.add("boot-lock");
    const pre = o.querySelector("pre"); let stage = "post", timers = [], grubSel = 0, count = 5;
    const T = (f, ms) => timers.push(setTimeout(f, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const done = (mode) => {
      clear(); ls.set("oxday-booted", "1"); removeEventListener("keydown", key, true);
      if (mode === "tty") { location.href = ROOT + "tty.html"; return; }
      stage = "systemd"; pre.innerHTML = "";
      SYSTEMD.forEach((l, i) => T(() => { pre.innerHTML += `[  <span class="ok">OK</span>  ] ${esc(l)}\n`; beep(600 + i * 40, .02); }, i * 90));
      T(() => { o.classList.add("bs-out"); html.classList.remove("boot-lock"); T(() => o.remove(), 400); }, SYSTEMD.length * 90 + 250);
    };
    const GRUB = ["0xDay GNU/Linux (graphical)", "0xDay GNU/Linux (tty mode)", "memtest86+"];
    const grub = () => {
      clear(); stage = "grub"; count = 5;
      const draw = () => {
        pre.innerHTML = `<div class="grub"><div class="grub__title">GNU GRUB  version 2.12</div><div class="grub__box">${GRUB.map((g, i) => `<div class="grub__item${i === grubSel ? " on" : ""}" data-i="${i}">${i === grubSel ? "*" : " "}${esc(g)}</div>`).join("")}</div>` +
          `<div class="grub__help">Use the ↑ and ↓ keys to select which entry is highlighted.\nPress enter to boot the selected OS, \`e' to edit the commands\nbefore booting or \`c' for a command-line.${count >= 0 ? `\n\nThe highlighted entry will be executed automatically in ${count}s.` : ""}</div></div>`;
        pre.querySelectorAll(".grub__item").forEach(el => el.addEventListener("click", () => { grubSel = +el.dataset.i; choose(); }));
      };
      const tick = () => { draw(); if (count-- <= 0) return choose(); T(tick, 1000); };
      tick(); o._draw = () => { count = -1; clear(); draw(); };
    };
    const choose = () => (grubSel === 0 ? done("gui") : grubSel === 1 ? done("tty") : memtest());
    const memtest = () => {
      clear(); stage = "memtest"; let pct = 0, pass = 0;
      const draw = () => {
        pre.innerHTML = `<div class="memtest"><div class="mt-head">Memtest86+ v7.04      | Pass ${pass}  ${"#".repeat(Math.floor(pct / 5)).padEnd(20, ".")} ${pct}%\nCPU: x86_64 @ 4.04GHz | Test 4 [Moving inversions, random pattern]\nMemory: 16 GB          | Errors: 0     PASS\n</div>\n<span class="muted">(ESC) reboot to GRUB</span></div>`;
      };
      const tick = () => { pct += 7; if (pct >= 100) { pct = 0; pass++; } draw(); T(tick, 120); };
      tick();
    };
    const key = e => {
      if (e.key === "Tab") return;
      e.preventDefault(); e.stopPropagation();
      if (stage === "post") return grub();
      if (stage === "memtest") { if (e.key === "Escape") grub(); return; }
      if (stage === "grub") {
        if (e.key === "ArrowUp") { grubSel = (grubSel + GRUB.length - 1) % GRUB.length; o._draw(); }
        else if (e.key === "ArrowDown") { grubSel = (grubSel + 1) % GRUB.length; o._draw(); }
        else if (e.key === "Enter") choose();
        else if (e.key === "Escape") done("gui");
        else if (e.key === "e" || e.key === "c") { o._draw(); pre.innerHTML += `\n<span class="err">error: editing is disabled on this system.</span>`; }
      }
    };
    addEventListener("keydown", key, true);
    o.querySelector(".bs-skip").addEventListener("click", () => done("gui"));
    o.addEventListener("click", e => { if (stage === "post" && !e.target.closest("button")) grub(); });
    beep(988, .12, "square", .04);
    POST.forEach((l, i) => T(() => { pre.innerHTML += esc(l) + "\n"; }, 120 + i * 140));
    T(grub, 120 + POST.length * 140 + 500);
  }

  /* ---------------- split-pane reader (tmux) on the posts page ---------------- */
  function splitReader() {
    if (embed || here !== "posts.html" || innerWidth < 1100) return;
    const main = document.querySelector("main"); if (!main) return;
    const left = document.createElement("div"); left.className = "pane pane--left pane--on";
    while (main.firstChild) left.append(main.firstChild);
    const right = document.createElement("div"); right.className = "pane pane--right";
    right.innerHTML = `<div class="pane__title">[1] reader</div><div class="pane__body"><p class="muted">// hover or focus a post on the left to preview it here.\n// click to open it full screen.</p></div>`;
    main.classList.add("split"); main.append(left, right);
    const body = right.querySelector(".pane__body"); const cache = {};
    let cur;
    const show = async (a) => {
      if (cur === a.href) return; cur = a.href;
      left.classList.remove("pane--on"); right.classList.add("pane--on");
      body.innerHTML = '<p class="muted">loading ...</p>';
      try {
        cache[a.href] = cache[a.href] || await fetch(a.href).then(r => r.text());
        const doc = new DOMParser().parseFromString(cache[a.href], "text/html");
        const art = doc.querySelector("article"); if (!art || cur !== a.href) return;
        art.querySelectorAll(".pager, p:last-child > a[href='../posts.html']").forEach(x => x.remove());
        art.querySelectorAll("a[href]").forEach(x => x.setAttribute("href", new URL(x.getAttribute("href"), a.href).href));
        body.innerHTML = art.innerHTML; body.scrollTop = 0;
        right.querySelector(".pane__title").textContent = `[1] ${a.querySelector(".ls-title").textContent}`;
      } catch (e) { body.innerHTML = '<p class="err">failed to load preview</p>'; }
    };
    left.querySelectorAll(".ls-row").forEach(a => { a.addEventListener("mouseenter", () => show(a)); a.addEventListener("focus", () => show(a)); });
    left.addEventListener("mouseenter", () => { left.classList.add("pane--on"); right.classList.remove("pane--on"); });
    right.addEventListener("mouseenter", () => { right.classList.add("pane--on"); left.classList.remove("pane--on"); });
    const first = left.querySelector(".ls-row"); if (first) show(first);
  }

  /* ---------------- xxd view on posts ---------------- */
  function xxd() {
    const prose = document.querySelector(".post .prose"), meta = document.querySelector(".post .meta");
    if (!prose || !meta) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn btn--sm"; b.textContent = "[ xxd ]"; b.setAttribute("aria-pressed", "false");
    meta.append(b);
    let dump;
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "[ cat ]" : "[ xxd ]";
      if (on) {
        if (!dump) {
          const bytes = new TextEncoder().encode(prose.innerText.replace(/\n{3,}/g, "\n\n"));
          let out = "";
          for (let i = 0; i < bytes.length; i += 16) {
            const ch = bytes.slice(i, i + 16);
            const hex = [...ch].map(x => x.toString(16).padStart(2, "0")).join("").replace(/(.{4})/g, "$1 ").padEnd(40);
            const asc = [...ch].map(x => (x >= 32 && x < 127 ? String.fromCharCode(x) : ".")).join("");
            out += `<span class="xo">${i.toString(16).padStart(8, "0")}:</span> <span class="xh">${hex}</span> <span class="xa">${esc(asc)}</span>\n`;
          }
          dump = document.createElement("pre"); dump.className = "xxd"; dump.innerHTML = out;
          prose.after(dump);
        }
        prose.hidden = true; dump.hidden = false;
      } else { prose.hidden = false; dump.hidden = true; }
    });
  }

  /* ---------------- ghost gets the new commands ---------------- */
  function extendGhost() {
    const C = OX.CMDS; if (!C) return;
    const optList = () => Object.keys(DEFAULTS).map(k => `  ${(S[k] ? "<b>on </b>" : "off").padEnd(3)} ${k}`).join("\n");
    C.set = (a) => {
      if (!a.length) return `~/.0xdayrc\n${optList()}\n\n<span class="sys">set &lt;option&gt; [on|off]</span>`;
      const k = a[0].toLowerCase(), v = a[1] ? /^(on|1|true|yes)$/i.test(a[1]) : undefined;
      return setOpt(k, v) ? `${k} = <b>${S[k] ? "on" : "off"}</b>` : `<span class="err">set: unknown option ${esc(k)}</span>\n${optList()}`;
    };
    C.crt = () => C.set(["crt"]); C.sound = () => C.set(["sound"]); C.vim = (a) => (a.length ? C.set(["vim", ...a]) : `${C.set(["vim"])}\n<span class="sys">j/k scroll, gg/G, h/l prev/next window, / find, : command, i ghost</span>`);
    C.emacs = () => `<span class="err">emacs: command not found.</span> <span class="sys">try: vim</span>`;
    C.nano = () => `<span class="err">nano: read-only file system.</span>`;
    C.reboot = () => { ls.set("oxday-booted", ""); setTimeout(() => boot(true), 300); return "rebooting ..."; };
    C.tty = () => { goto(ROOT + "tty.html"); return "switching to tty1 ..."; };
    C.htop = () => { goto(ROOT + "htop.html"); return "starting htop ..."; };
    C.top = C.htop;
    C.startx = () => { goto(ROOT + "desktop.html"); return "starting i3 ..."; };
    C.i3 = C.startx;
    C.fzf = () => { setTimeout(fzf, 50); return "fzf ..."; };
    C.tmux = () => `tmux is already running. windows: ${WINDOWS.map(([n], i) => `${i}:${n}`).join(" ")}\n<span class="sys">Ctrl+B then 0-7 to switch, n/p next/prev, d detach to tty</span>`;
  }

  /* ---------------- init ---------------- */
  function init() {
    extendGhost(); buildBar(); splitReader(); xxd(); boot(false);
    if (S.vim) flash("vim mode: j/k scroll, : for commands");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  setTimeout(() => html.classList.remove("booting"), 9000); // never leave the page hidden
  Object.assign(OX, { fzf, goto, setOpt, settings: S, beep, clack, flash, boot });
})();
