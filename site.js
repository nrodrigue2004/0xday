/* 0xDay: menu, theme, and "ghost", a tiny terminal assistant. No network calls, no tracking. */
(function () {
  const D = window.OXDAY || { posts: [], projects: [], skills: {} };
  const ROOT = document.documentElement.dataset.root || "";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  if (store.get("oxday-theme") === "amber") document.documentElement.dataset.theme = "amber";

  document.addEventListener("DOMContentLoaded", () => {
    const t = document.querySelector(".menu-trigger"), m = document.querySelector(".menu");
    if (t) t.addEventListener("click", () => { m.classList.toggle("open"); t.setAttribute("aria-expanded", m.classList.contains("open")); });
    document.querySelectorAll(".year").forEach(e => (e.textContent = new Date().getFullYear()));
    buildGhost();
    konami();
    console.log("%c0xDay%c\nlooking under the hood? respect.\nhere's something for you (hex): " + (D.consoleFlag || ""),
      "color:#3bff7f;font:700 28px monospace", "color:#c3cfc7;font:13px monospace");
  });

  /* ---------------- achievements ---------------- */
  const ACH = {
    ghost: "hello, ghost: opened the terminal",
    sudo: "nice try: attempted sudo",
    hack: "hackerman: ran hack",
    konami: "old school: entered the Konami code",
    flag_source: "view-source: found the flag in the page source",
    flag_console: "console cowboy: found the flag in the console",
    flag_robots: "robots don't lie: found the flag via robots.txt",
    all_flags: "0xDAY champion: captured every flag"
  };
  const got = () => { try { return JSON.parse(store.get("oxday-ach") || "[]"); } catch (e) { return []; } };
  function unlock(id) {
    const g = got(); if (g.includes(id)) return false;
    g.push(id); store.set("oxday-ach", JSON.stringify(g));
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
    t.innerHTML = `achievement unlocked: <b>${esc(ACH[id].split(":")[0])}</b>`;
    document.body.append(t); setTimeout(() => t.remove(), 3800);
    return true;
  }
  async function sha256(s) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  function konami() {
    const seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]; let i = 0;
    document.addEventListener("keydown", e => {
      if (/input|textarea/i.test(document.activeElement.tagName)) return;
      i = (e.key === seq[i] || e.key.toLowerCase() === seq[i]) ? i + 1 : (e.key === seq[0] ? 1 : 0);
      if (i === seq.length) { i = 0; unlock("konami"); matrix(); }
    });
  }

  /* ---------------- ghost ---------------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
  const postUrl = p => `${ROOT}posts/${p.slug}.html`;
  const projUrl = p => (p.url && !/^https?:/.test(p.url) ? ROOT + p.url : p.url);
  const go = (url, log) => { log(`<span class="sys">opening ${esc(url)} ...</span>`); setTimeout(() => (location.href = url), 450); };
  const PAGES = { home: "index.html", "~": "index.html", blog: "posts.html", posts: "posts.html", projects: "projects.html", resources: "resources.html", about: "about.html", skills: "skills.html", certs: "certs.html", now: "now.html", tags: "tags.html", changelog: "changelog.html" };
  const started = Date.now();

  function findPost(q) {
    q = q.toLowerCase().trim();
    if (/^\d+$/.test(q)) return D.posts[+q - 1];
    return D.posts.find(p => p.slug === q) || D.posts.find(p => p.slug.includes(q) || p.title.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
  }
  function findProject(q) {
    q = q.toLowerCase().trim();
    if (/^\d+$/.test(q)) return D.projects[+q - 1];
    return D.projects.find(p => p.slug === q || p.name.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
  }
  const listPosts = () => D.posts.map((p, i) => `<b>[${i + 1}]</b> ${p.date}  ${link(postUrl(p), p.title)}`).join("\n") + `\n\n<span class="sys">read &lt;n&gt; to open one</span>`;
  const listProjects = () => D.projects.map((p, i) => `<b>[${i + 1}]</b> ${p.url ? link(projUrl(p), p.name) : esc(p.name)} <span class="sys">${p.tags.slice(0, 3).map(t => "#" + t).join(" ")}</span>`).join("\n") + `\n\n<span class="sys">project &lt;n&gt; for details</span>`;
  const projectInfo = p => `<b>${esc(p.name)}</b> [${p.status}]\n${esc(p.desc)}\n<span class="sys">${p.tags.map(t => "#" + t).join(" ")}</span>${p.url ? "\n" + link(projUrl(p), p.url.startsWith("http") ? p.url : "read the writeup") : ""}`;

  const bar = (p, w = 10) => { const n = Math.round(p / 100 * w); return `[<b>${"#".repeat(n)}</b>${"-".repeat(w - n)}]`; };
  const matrixOut = () => (D.matrix || []).map(g => `<b>${esc(g.name)}</b>\n` + g.skills.map(k => `  ${esc(k.name.padEnd(28))} <b>${"■".repeat(k.level)}</b>${"□".repeat(5 - k.level)}`).join("\n")).join("\n\n") + `\n\n${link(ROOT + "skills.html", "open ~/skills")}`;
  const HELP = `<b>ghost</b>: 0xDay's terminal assistant. Ask a question or run a command.

  <b>whoami</b>        who runs this site
  <b>posts</b>         list writeups      <b>read</b> &lt;n|topic&gt;  open one
  <b>projects</b>      list projects      <b>project</b> &lt;n|name&gt; details
  <b>skills</b>        tools &amp; languages   <b>skills --matrix</b>  self-rated levels
  <b>certs</b>         cert roadmap &amp; Security+ progress
  <b>now</b>           what I'm focused on right now
  <b>tags</b>          post topics         <b>changelog</b>     recent site updates
  <b>hire</b>          the recruiter summary
  <b>contact</b>       where to find me
  <b>cd</b> &lt;page&gt;     blog, projects, skills, certs, now, about, home
  <b>submit</b> &lt;flag&gt; there are 3 flags hidden on this site
  <b>achievements</b>  what you've unlocked
  <b>search</b> &lt;q&gt;    search posts and projects
  <b>theme</b>         toggle green / amber
  <b>clear</b>  <b>history</b>  <b>date</b>  <b>uptime</b>  <b>exit</b>

<span class="sys">or just ask: "what's in the homelab?", "any malware posts?"</span>`;

  const CMDS = {
    help: () => HELP, "?": () => HELP, man: () => HELP,
    whoami: () => `<b>${esc(D.name)}</b>\nCS student at LSU, concentrating in cybersecurity.\nInto homelabs, malware analysis, digital forensics and breaking things to see how they work.\n\n<span class="sys">try: projects, posts, skills</span>`,
    about: (a, log) => go(ROOT + "about.html", log),
    posts: listPosts, ls: (a) => (a[0] && /proj/.test(a[0]) ? listProjects() : `${/a/.test(a[0] || "") ? ".secret  robots.txt  " : ""}posts/  projects/  certs/  now  about.txt\n\n` + listPosts()),
    read: (a, log) => { const p = findPost(a.join(" ")); if (!a.length) return "usage: read &lt;n|topic&gt;"; if (!p) return `<span class="err">read: no post matches "${esc(a.join(" "))}"</span>`; return go(postUrl(p), log); },
    cat: (a, log) => (/^\.secret/.test(a[0] || "") ? `there are ${Object.keys(D.flags || {}).length} flags hidden on 0xDay. format: 0xDAY{...}\nsubmit them here with <b>submit</b> &lt;flag&gt;. type <b>flags</b> for hints.` : /robots/.test(a[0] || "") ? `User-agent: *\nAllow: /\nDisallow: /0xday/s3cr3t/` : /about/.test(a[0] || "") ? CMDS.whoami() : CMDS.read(a.map(x => x.replace(/\.md$|^.*\//g, "")), log)),
    projects: listProjects,
    project: (a) => { if (!a.length) return listProjects(); const p = findProject(a.join(" ")); return p ? projectInfo(p) : `<span class="err">project: nothing matches "${esc(a.join(" "))}"</span>`; },
    skills: (a) => (a.join(" ").includes("matrix") ? matrixOut() : Object.entries(D.skills).map(([k, v]) => `<b>${k.padEnd(9)}</b>${esc(v)}`).join("\n") + `\n\n<span class="sys">skills --matrix for levels</span>`),
    contact: () => `${link(D.gh, "github.com/nrodrigue2004")}\n${link(D.li, "linkedin")}`,
    github: (a, log) => go(D.gh, log), linkedin: (a, log) => go(D.li, log),
    cd: (a, log) => { const k = (a[0] || "~").replace(/^\.?\/?|\/$/g, "").toLowerCase() || "~"; if (k === "..") return go(ROOT + "index.html", log); const u = PAGES[k]; return u ? go(ROOT + u, log) : `<span class="err">cd: ${esc(a[0])}: No such file or directory</span>`; },
    search: (a) => {
      const q = a.join(" ").toLowerCase(); if (!q) return "usage: search &lt;query&gt;";
      const ps = D.posts.filter(p => (p.title + " " + p.tags.join(" ")).toLowerCase().includes(q));
      const pr = D.projects.filter(p => (p.name + " " + p.desc + " " + p.tags.join(" ")).toLowerCase().includes(q));
      if (!ps.length && !pr.length) return `no results for "${esc(q)}"`;
      return [...ps.map(p => `post     ${link(postUrl(p), p.title)}`), ...pr.map(p => `project  ${p.url ? link(projUrl(p), p.name) : esc(p.name)}`)].join("\n");
    },
    theme: () => { const r = document.documentElement; const amber = r.dataset.theme !== "amber"; if (amber) r.dataset.theme = "amber"; else delete r.dataset.theme; store.set("oxday-theme", amber ? "amber" : "green"); return `theme set to <b>${amber ? "amber" : "green"}</b>`; },
    date: () => new Date().toString(),
    uptime: () => { const s = Math.floor((Date.now() - started) / 1000); return `up ${Math.floor(s / 60)} min ${s % 60} s, 1 user, load average: 0.42, 0.13, 0.37`; },
    echo: (a) => esc(a.join(" ")),
    pwd: () => "/home/guest/" + (location.pathname.split("/").pop() || "index.html"),
    uname: () => "0xDay 6.6.6-ghost x86_64 GNU/Linux",
    sudo: (a) => (unlock("sudo"), a.join(" ").includes("rm")) ? `<span class="err">nice try.</span>` : `guest is not in the sudoers file. This incident will be reported.`,
    rm: () => `<span class="err">rm: permission denied (and rude)</span>`,
    nmap: () => `Starting Nmap ( https://nmap.org )\nNmap scan report for 0xday.local\nPORT    STATE  SERVICE\n22/tcp  closed ssh\n80/tcp  open   http     <span class="sys">(you're looking at it)</span>\n443/tcp open   https\n1337/tcp filtered elite`,
    hack: () => { unlock("hack"); matrix(); return `<span class="sys">initiating totally real hack... click or press any key to stop</span>`; },
    matrix: () => CMDS.hack(),
    ping: () => "PONG 64 bytes from ghost: icmp_seq=1 ttl=64 time=0.042 ms",
    hello: () => `hey 👋 I'm ghost. type <b>help</b> to see what I can do.`, hi: () => CMDS.hello(), hey: () => CMDS.hello(),
    jarvis: () => `close. I'm <b>ghost</b>, the budget version. type <b>help</b>.`,
    certs: () => {
      const c = (D.certs || []).map(c => `[${c.status}] <b>${esc(c.name)}</b> ${esc(c.code)}  ${c.progress}%  target: ${esc(c.target || "TBD")}`).join("\n");
      const s = D.secplus ? `\n\nSecurity+ progress: <b>${D.secplus.overall}%</b>\n` + D.secplus.domains.map(d => `  ${d.n}.0 ${esc(d.name.padEnd(40))} ${bar(d.progress, 10)} ${d.progress}%`).join("\n") : "";
      return c + s + `\n\n${link(ROOT + "certs.html", "open ~/certs")}`;
    },
    roadmap: () => CMDS.certs(),
    now: () => D.now ? `<span class="sys">updated ${esc(D.now.updated)}</span>\n<b>studying</b>  ${D.now.studying.map(esc).join(", ")}\n<b>building</b>  ${D.now.building.map(esc).join(", ")}\n<b>reading</b>   ${D.now.reading.map(esc).join(", ")}` : "nothing yet",
    tags: () => Object.entries(D.tags || {}).map(([t, n]) => link(ROOT + "tags.html#" + t, "#" + t) + ` <span class="sys">${n}</span>`).join("  "),
    changelog: () => (D.changelog || []).map(e => `<span style="color:var(--amber)">${e.date}</span> <b>${esc(e.type)}:</b> ${esc(e.msg)}`).join("\n"),
    git: (a) => (a[0] === "log" ? CMDS.changelog() : `git: '${esc(a[0] || "")}' is not a git command. try git log`),
    hire: () => `<b>${esc(D.name)}</b>: CS (cybersecurity) student at LSU.
  - built a 7-VM enterprise homelab: AD domain, pfSense segmentation, Security Onion SIEM
  - reverse-engineered real malware (RAT, SQL worm) in IDA Pro and Ghidra
  - reconstructed a data exfiltration from disk images + PCAP
  - working toward CompTIA Security+
${link(D.li, "linkedin")}  ${link(D.gh, "github")}  ${link(ROOT + "skills.html", "skills matrix")}`,
    submit: async (a) => {
      const f = a.join(" ").trim(); if (!f) return "usage: submit 0xDAY{...}";
      const h = await sha256(f);
      const hit = Object.entries(D.flags || {}).find(([, v]) => v === h);
      if (!hit) return `<span class="err">incorrect flag.</span> <span class="sys">format is 0xDAY{...}</span>`;
      const fresh = unlock("flag_" + hit[0]);
      const n = Object.keys(D.flags).filter(k => got().includes("flag_" + k)).length, total = Object.keys(D.flags).length;
      if (n === total) unlock("all_flags");
      return `<b>correct!</b> flag "${hit[0]}" ${fresh ? "captured" : "(already captured)"}. ${n}/${total} found.` + (n === total ? "\nyou found them all. go tell Nathan on LinkedIn." : "");
    },
    flags: () => { const k = Object.keys(D.flags || {}); const n = k.filter(x => got().includes("flag_" + x)).length; return `${n}/${k.length} flags captured.\n<span class="sys">hints: the page source, the browser console, and what robots shouldn't read.</span>`; },
    achievements: () => { const g = got(); return Object.entries(ACH).map(([k, v]) => `${g.includes(k) ? "<b>[x]</b>" : "[ ]"} ${g.includes(k) ? esc(v) : esc(v.split(":")[0]) + ": ???"}`).join("\n"); },
    hint: () => CMDS.flags()
  };

  // keyword answers for plain-English questions
  const INTENTS = [
    [/who (are|is)|about (you|nathan|him)|yourself|bio/, () => CMDS.whoami()],
    [/what (are|is) you|ghost/, () => `I'm <b>ghost</b>, a tiny scripted assistant living in this page. I know about Nathan's posts, projects and skills. No AI, no tracking, just JavaScript.`],
    [/contact|email|reach|linkedin|github|hire|socials?/, () => CMDS.contact()],
    [/cert|security\+|sec\+|comptia|exam/, () => CMDS.certs()],
    [/flag|ctf|secret|easter/, () => CMDS.flags()],
    [/hire|recruit|resume|cv\b/, () => CMDS.hire()],
    [/(right )?now|current|working on|studying/, () => CMDS.now()],
    [/skill|tool|language|stack|know/, () => CMDS.skills()],
    [/project|built|build|portfolio/, () => listProjects()],
    [/post|blog|writeup|article|read/, () => listPosts()],
    [/school|lsu|college|degree|study|major/, () => `B.S. Computer Science (Cybersecurity) at LSU.\nCoursework: reverse engineering &amp; malware analysis, digital forensics, mobile security &amp; applied crypto, software vulns &amp; exploitation.`],
    [/work|job|experience/, () => `<b>Laptop Technician</b> (secure data sanitization, repair, Windows deployment)\n<b>AI Trainer</b> (evaluating LLM output)`]
  ];

  function answerTopic(q) {
    const ps = D.posts.filter(p => p.tags.some(t => q.includes(t.split("-")[0])) || p.title.toLowerCase().split(/\W+/).some(w => w.length > 4 && q.includes(w)));
    const pr = D.projects.filter(p => p.tags.some(t => q.includes(t.split("-")[0])) || p.name.toLowerCase().split(/\W+/).some(w => w.length > 3 && q.includes(w)));
    if (!ps.length && !pr.length) return null;
    let out = "";
    if (pr.length) out += pr.slice(0, 2).map(projectInfo).join("\n\n");
    if (ps.length) out += (out ? "\n\n" : "") + "related posts:\n" + ps.slice(0, 3).map(p => "  " + link(postUrl(p), p.title)).join("\n");
    return out;
  }

  function run(line, log) {
    const raw = line.trim(); if (!raw) return "";
    const [cmd, ...args] = raw.split(/\s+/);
    const c = cmd.toLowerCase();
    if (CMDS[c] && (args.length === 0 || !/\?$/.test(raw))) return CMDS[c](args, log);
    const q = raw.toLowerCase();
    const topic = /homelab|malware|forensic|ghidra|proxmox|active directory|\bad\b|windows|java|flutter|react|wireshark|pfsense|siem/.test(q) ? answerTopic(q) : null;
    if (topic) return topic;
    for (const [re, fn] of INTENTS) if (re.test(q)) return fn();
    const t = answerTopic(q); if (t) return t;
    return `<span class="err">ghost: command not found: ${esc(cmd)}</span>\n<span class="sys">type help, or ask about projects, posts, skills</span>`;
  }

  function buildGhost() {
    const fab = document.createElement("button");
    fab.className = "ghost-fab"; fab.type = "button"; fab.innerHTML = "&gt;_ ghost"; fab.setAttribute("aria-label", "Open ghost terminal assistant");
    const box = document.createElement("section");
    box.className = "ghost"; box.hidden = true; box.setAttribute("aria-label", "ghost terminal assistant");
    box.innerHTML = `<div class="term__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term__title">ghost@0xday</span><button class="ghost__close" type="button" aria-label="Close">[x]</button></div>
      <div class="ghost__log" role="log" aria-live="polite"></div>
      <div class="ghost__chips"><button>help</button><button>whoami</button><button>projects</button><button>posts</button><button>skills</button><button>hack</button></div>
      <form class="ghost__form" autocomplete="off"><label for="ghost-in">guest@0xday:~$</label><input id="ghost-in" spellcheck="false" autocapitalize="off" placeholder="type a command or question"></form>`;
    document.body.append(fab, box);
    const logEl = box.querySelector(".ghost__log"), input = box.querySelector("input");
    const hist = []; let hi = 0, greeted = false;
    const log = (html, cls = "out") => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; logEl.append(d); logEl.scrollTop = logEl.scrollHeight; };
    const open = () => {
      box.hidden = false; fab.hidden = true;
      unlock("ghost");
      if (!greeted) { greeted = true; log(`ghost v0.1 · connected to 0xday\nhey. I'm <b>ghost</b>. type <b>help</b> or just ask me something.`, "sys"); }
      setTimeout(() => input.focus(), 0);
    };
    const close = () => { box.hidden = true; fab.hidden = false; fab.focus(); };
    const exec = (line) => {
      log(esc(line), "in"); hist.push(line); hi = hist.length;
      const c = line.trim().toLowerCase();
      if (c === "clear" || c === "cls") { logEl.innerHTML = ""; return; }
      if (c === "exit" || c === "quit") { log("logout", "sys"); setTimeout(close, 300); return; }
      if (c === "history") { log(hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join("\n")); return; }
      Promise.resolve(run(line, (h) => log(h, "sys"))).then(out => { if (out) log(out); });
    };
    fab.addEventListener("click", open);
    document.querySelectorAll(".ghost-open").forEach(b => b.addEventListener("click", open));
    box.querySelector(".ghost__close").addEventListener("click", close);
    box.querySelectorAll(".ghost__chips button").forEach(b => b.addEventListener("click", () => { exec(b.textContent); input.focus(); }));
    box.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; if (v.trim()) exec(v); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowUp") { if (hi > 0) input.value = hist[--hi]; e.preventDefault(); }
      else if (e.key === "ArrowDown") { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; e.preventDefault(); }
      else if (e.key === "Escape") close();
      else if (e.key === "Tab") {
        e.preventDefault(); const v = input.value.toLowerCase();
        const m = Object.keys(CMDS).filter(k => k.startsWith(v) && k.length > 1);
        if (m.length === 1) input.value = m[0] + " "; else if (m.length > 1) log(m.join("  "), "sys");
      }
    });
    document.addEventListener("keydown", e => {
      const typing = /input|textarea/i.test(document.activeElement.tagName);
      if ((e.key === "`" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); box.hidden ? open() : close(); }
    });
  }

  /* ---------------- matrix easter egg ---------------- */
  function matrix() {
    if (document.getElementById("matrix")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.id = "matrix"; document.body.append(c);
    const x = c.getContext("2d"); const fs = 16;
    const size = () => { c.width = innerWidth; c.height = innerHeight; };
    size(); addEventListener("resize", size);
    let drops = Array(Math.ceil(innerWidth / fs)).fill(0).map(() => Math.random() * -50);
    const chars = "01アイウエオカキクケコサシスセソ0xDAY{}<>/$#";
    const color = getComputedStyle(document.documentElement).getPropertyValue("--green").trim() || "#3bff7f";
    let raf;
    const tick = () => {
      x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = color; x.font = fs + "px monospace";
      drops.forEach((y, i) => { x.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y * fs); drops[i] = y * fs > c.height && Math.random() > .975 ? 0 : y + 1; });
      raf = requestAnimationFrame(tick);
    };
    tick();
    const stop = () => { cancelAnimationFrame(raf); c.remove(); removeEventListener("resize", size); removeEventListener("keydown", stop, true); };
    c.addEventListener("click", stop); addEventListener("keydown", stop, true);
    setTimeout(stop, 8000);
  }
})();
