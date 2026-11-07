/* 0xDay TTY mode: the whole site as a shell. */
(function () {
  const OX = window.OX, D = OX.D, ROOT = OX.ROOT;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const el = document.getElementById("tty"); if (!el) return;

  // virtual filesystem: dirs map names -> node. files have a loader returning HTML
  const fetchPart = (url, sel) => async () => {
    const t = await fetch(ROOT + url).then(r => r.text());
    const doc = new DOMParser().parseFromString(t, "text/html");
    const n = doc.querySelector(sel); if (!n) return "<span class=\"err\">empty file</span>";
    n.querySelectorAll(".pager,.btn,script").forEach(x => x.remove());
    n.querySelectorAll("a[href]").forEach(a => a.setAttribute("href", new URL(a.getAttribute("href"), new URL(url, location.href)).href));
    return `<div class="tty-doc">${n.innerHTML}</div>`;
  };
  const ghost = (cmd) => async () => OX.run(cmd);
  const dir = (o) => ({ dir: true, kids: o });
  const file = (load, size) => ({ load, size: size || 1024 });
  const FS = dir({
    "README": file(async () => README),
    "about.txt": file(fetchPart("about.html", "main")),
    "resume.txt": file(fetchPart("resume.html", ".resume")),
    "now.txt": file(ghost("now")),
    "skills.txt": file(ghost("skills --matrix")),
    "certs.txt": file(ghost("certs")),
    "ctf.txt": file(ghost("ctf")),
    ".secret": file(ghost("cat .secret")),
    ".0xdayrc": file(ghost("set")),
    "posts": dir(Object.fromEntries(D.posts.map(p => [p.slug + ".md", file(fetchPart("posts/" + p.slug + ".html", "article"))]))),
    "projects": dir(Object.fromEntries(D.projects.map(p => [p.slug + ".txt", file(ghost("project " + p.slug))]))),
    "man": dir(Object.fromEntries((D.man || []).map(m => [m.slug, file(fetchPart("man/" + m.slug + ".html", "main"))])))
  });
  let cwd = [];
  const HOME = "/home/guest";
  const pathStr = (p) => (p.length ? "~/" + p.join("/") : "~");
  function resolve(arg) {
    if (!arg || arg === "~") return [];
    let parts = arg.startsWith("/") ? (arg.startsWith(HOME) ? arg.slice(HOME.length) : null) : arg.startsWith("~") ? arg.slice(1) : cwd.join("/") + "/" + arg;
    if (parts === null) return null;
    const out = [];
    for (const s of parts.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
    return out;
  }
  function node(p) { let n = FS; for (const s of p) { if (!n.dir || !n.kids[s]) return null; n = n.kids[s]; } return n; }

  const README = `<b>0xDay tty mode</b>: the whole site, as a shell.

  ls [-la] [dir]   list files          cd &lt;dir&gt;     change directory
  cat &lt;file&gt;       read a file         open &lt;file&gt;   open it in the normal site
  tree             show everything     neofetch       system info
  startx           i3 desktop          exit           back to the graphical site
  clear (Ctrl+L)   history             Tab            autocomplete

anything else is handed to <b>ghost</b> (try: whoami, hire, man nmap, submit &lt;flag&gt;)
start with: <b>cd posts</b> then <b>ls</b> then <b>cat proxmox-homelab.md</b>`;

  el.innerHTML = `<div class="tty__out" role="log" aria-live="polite"></div><form class="tty__line" autocomplete="off"><label class="tty__ps1" for="tty-in"></label><input id="tty-in" spellcheck="false" autocapitalize="off" aria-label="shell input"></form>`;
  const out = el.querySelector(".tty__out"), form = el.querySelector("form"), input = el.querySelector("input"), ps1 = el.querySelector(".tty__ps1");
  const prompt = () => `<span class="p-u">guest@0xday</span>:<span class="p-d">${esc(pathStr(cwd))}</span>$ `;
  const print = (h, cls = "") => { const d = document.createElement("div"); d.className = "tty__blk " + cls; d.innerHTML = h; out.append(d); scrollTo(0, document.body.scrollHeight); return d; };
  const setPs1 = () => { ps1.innerHTML = prompt(); };
  const hist = []; let hi = 0;

  const now = new Date(); const last = OX.store.get("oxday-lastlogin");
  print(`0xDay GNU/Linux 6.6.6-ghost tty1\n\n0xday login: guest (automatic login)\n${last ? `Last login: ${esc(last)} on tty1` : "Welcome! This is your first login."}\n\nType <b>help</b> to get started, or <b>exit</b> for the normal site.\n`);
  OX.store.set("oxday-lastlogin", now.toString().slice(0, 24));
  setPs1();

  function lsOut(p, flags) {
    const n = node(p); if (!n) return null;
    if (!n.dir) return esc(p[p.length - 1]);
    const names = Object.keys(n.kids).filter(k => flags.includes("a") || !k.startsWith(".")).sort();
    if (flags.includes("l")) {
      return `total ${names.length}\n` + names.map(k => { const c = n.kids[k]; return `${c.dir ? "drwxr-xr-x" : "-rw-r--r--"} 1 nathan nathan ${String(c.dir ? 4096 : c.size).padStart(5)} Nov  6 2026 ${c.dir ? `<span class="p-d">${esc(k)}/</span>` : esc(k)}`; }).join("\n");
    }
    return names.map(k => (n.kids[k].dir ? `<span class="p-d">${esc(k)}/</span>` : esc(k))).join("  ");
  }
  function tree(n, pre = "") {
    const ks = Object.keys(n.kids).filter(k => !k.startsWith(".")).sort(); let s = "";
    ks.forEach((k, i) => { const last = i === ks.length - 1, c = n.kids[k]; s += `${pre}${last ? "└── " : "├── "}${c.dir ? `<span class="p-d">${esc(k)}</span>` : esc(k)}\n`; if (c.dir) s += tree(c, pre + (last ? "    " : "│   ")); });
    return s;
  }
  function pageFor(p) {
    const [a, b] = p; if (!a) return "index.html";
    if (a === "posts") return b ? "posts/" + b.replace(/\.md$/, ".html") : "posts.html";
    if (a === "projects") return "projects.html";
    if (a === "man") return b ? "man/" + b + ".html" : "man.html";
    return { "about.txt": "about.html", "resume.txt": "resume.html", "now.txt": "now.html", "skills.txt": "skills.html", "certs.txt": "certs.html", "ctf.txt": "ctf.html" }[a] || null;
  }

  const BUILTIN = {
    help: () => README, README: () => README,
    pwd: () => HOME + (cwd.length ? "/" + cwd.join("/") : ""),
    ls: (a) => { const flags = a.filter(x => x.startsWith("-")).join(""); const t = a.find(x => !x.startsWith("-")); const p = resolve(t); const r = p && lsOut(p, flags); return r === null || r === undefined ? `<span class="err">ls: cannot access '${esc(t)}': No such file or directory</span>` : r; },
    ll: (a) => BUILTIN.ls(["-la", ...a]),
    cd: (a) => { const p = resolve(a[0]); const n = p && node(p); if (!n) return `<span class="err">cd: ${esc(a[0])}: No such file or directory</span>`; if (!n.dir) return `<span class="err">cd: ${esc(a[0])}: Not a directory</span>`; cwd = p; return ""; },
    cat: async (a) => {
      if (!a.length) return "usage: cat &lt;file&gt;";
      let res = "";
      for (const f of a) {
        const p = resolve(f), n = p && node(p);
        if (!n) res += `<span class="err">cat: ${esc(f)}: No such file or directory</span>\n`;
        else if (n.dir) res += `<span class="err">cat: ${esc(f)}: Is a directory</span>\n`;
        else { try { res += await n.load(); } catch (e) { res += `<span class="err">cat: ${esc(f)}: I/O error</span>`; } }
      }
      return res;
    },
    open: (a) => { const p = resolve(a[0] || "."); const u = p && pageFor(p); if (!u) return `<span class="err">open: no page for ${esc(a[0] || ".")}</span>`; location.href = ROOT + u; return "opening ..."; },
    tree: () => `<span class="p-d">~</span>\n` + tree(FS),
    neofetch: fetchPart("about.html", ".neofetch"),
    whoami: () => "guest",
    id: () => "uid=1001(guest) gid=1001(guest) groups=1001(guest)",
    exit: () => { location.href = ROOT + "index.html"; return "logout"; }, logout: () => BUILTIN.exit(),
    startx: () => { location.href = ROOT + "desktop.html"; return "starting X ..."; },
    history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join("\n"),
    sl: () => `      ====        ________                ___________\n  _D _|  |_______/        \\__I_I_____===__|_________|\n   |(_)---  |   H\\________/ |   |        =|___ ___|\n   /     |  |   H  |  |     |   |         ||_| |_||\n  |      |  |   H  |__--------------------| [___] |\n  | ________|___H__/__|_____/[][]~\\_______|       |\n  |/ |   |-----------I_____I [][] []  D   |=======|_\n<span class="sys">you meant ls. the train has left.</span>`,
    clear: () => { out.innerHTML = ""; return ""; }
  };

  async function exec(line) {
    const raw = line.trim();
    print(prompt() + esc(line), "tty__cmd");
    if (!raw) return;
    hist.push(raw); hi = hist.length;
    const [c, ...a] = raw.split(/\s+/);
    let r;
    if (BUILTIN[c]) r = await BUILTIN[c](a);
    else {
      r = await OX.run(raw, (h) => print(h, "sys"));
      if (typeof r === "string") r = r.replace("guest@0xday:~$", "");
    }
    if (r) print(r);
    setPs1();
  }
  form.addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; exec(v); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { if (hi > 0) input.value = hist[--hi]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; e.preventDefault(); }
    else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); out.innerHTML = ""; }
    else if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); print(prompt() + esc(input.value) + "^C", "tty__cmd"); input.value = ""; }
    else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value, parts = v.split(/\s+/), last = parts[parts.length - 1];
      let cands;
      if (parts.length === 1) cands = [...new Set([...Object.keys(BUILTIN), ...Object.keys(OX.CMDS)])].filter(k => k.startsWith(last));
      else {
        const slash = last.lastIndexOf("/"), base = slash >= 0 ? last.slice(0, slash + 1) : "", pre = last.slice(slash + 1);
        const n = node(resolve(base || ".") || []);
        cands = n && n.dir ? Object.keys(n.kids).filter(k => k.startsWith(pre) && (pre.startsWith(".") || !k.startsWith("."))).map(k => base + k + (n.kids[k].dir ? "/" : "")) : [];
      }
      if (cands.length === 1) { parts[parts.length - 1] = cands[0] + (cands[0].endsWith("/") ? "" : " "); input.value = parts.join(" "); }
      else if (cands.length > 1) print(cands.map(esc).join("  "), "sys");
    }
  });
  el.addEventListener("click", () => { if (!getSelection().toString()) input.focus(); });
  input.focus();
})();
