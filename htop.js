/* 0xDay htop: a simulated, htop-style view of the homelab. VMs and roles are real; numbers are generated. */
(function () {
  const el = document.getElementById("htop"); if (!el) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const VMS = [
    { pid: 101, name: "pfsense", os: "pfSense CE", ip: "10.0.0.1", net: "all segments", role: "Firewall and router: rules between subnets, DHCP and NAT. Tailscale subnet routing for remote access.", mem: 2, cpu: 4 },
    { pid: 102, name: "kali", os: "Kali Linux", ip: "10.0.20.10", net: "attack-net", role: "Attacker box: recon, exploitation and testing the defenses.", mem: 4, cpu: 8 },
    { pid: 103, name: "metasploitable2", os: "Ubuntu 8.04 (very vulnerable)", ip: "10.0.30.20", net: "target-net", role: "Intentionally vulnerable Linux target.", mem: 1, cpu: 3 },
    { pid: 104, name: "dvwa-webgoat", os: "Docker (DVWA + WebGoat)", ip: "10.0.30.30", net: "target-net", role: "Vulnerable web apps for practicing web attacks.", mem: 2, cpu: 5 },
    { pid: 105, name: "dc01", os: "Windows Server 2022", ip: "10.0.10.5", net: "corp-net", role: "Active Directory domain controller: users, groups, Group Policy.", mem: 4, cpu: 6 },
    { pid: 106, name: "ws01", os: "Windows 11 (domain-joined)", ip: "10.0.10.50", net: "corp-net", role: "Corporate workstation that simulates an end user.", mem: 4, cpu: 7 },
    { pid: 107, name: "security-onion", os: "Security Onion", ip: "10.0.99.2", net: "mgmt (span)", role: "SIEM and network security monitoring: watches the traffic and raises alerts.", mem: 8, cpu: 20 }
  ];
  VMS.forEach(v => { v.c = v.cpu; v.t = Math.random() * 5000; });
  let sortKey = "c", sel = 0, cores = Array(8).fill(10), started = Date.now();
  const bar = (pct, w) => { const n = Math.round(pct / 100 * w); return `<span class="hb-on">${"|".repeat(n)}</span><span class="hb-off">${" ".repeat(w - n)}</span>`; };
  const fmtT = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}.${String(Math.floor(s) % 60).padStart(2, "0")}`;
  el.innerHTML = `<div class="ht-top"><div class="ht-cpus"></div><div class="ht-sum"></div></div>
    <div class="ht-table" role="table" aria-label="homelab VMs"><div class="ht-head" role="row">${[["pid", "PID"], ["user", "USER"], ["mem", "MEM"], ["c", "CPU%"], ["m", "MEM%"], ["t", "TIME+"], ["name", "Command"]].map(([k, l]) => `<button type="button" data-k="${k}" role="columnheader">${l}</button>`).join("")}</div><div class="ht-rows"></div></div>
    <div class="ht-detail" aria-live="polite"></div>
    <div class="ht-dump"><div class="ht-dump__title">tcpdump -i vmbr0 -n</div><pre class="ht-pkts" aria-hidden="true"></pre></div>
    <div class="ht-keys">${[["F1", "Help"], ["F3", "Search"], ["F6", "SortBy"], ["F9", "Kill"], ["F10", "Quit"]].map(([k, l]) => `<button type="button" data-f="${k}"><b>${k}</b>${l}</button>`).join("")}</div>`;
  const cpus = el.querySelector(".ht-cpus"), sum = el.querySelector(".ht-sum"), rows = el.querySelector(".ht-rows"), detail = el.querySelector(".ht-detail"), pkts = el.querySelector(".ht-pkts");
  function draw() {
    cpus.innerHTML = cores.map((c, i) => `<div><span class="hn">${i}</span>[${bar(c, 22)}<span class="hp">${c.toFixed(1)}%</span>]</div>`).join("");
    const memUsed = VMS.reduce((a, v) => a + v.mem * (0.6 + v.c / 200), 0);
    const up = (Date.now() - started) / 1000 + 86400 * 12 + 3600 * 4;
    sum.innerHTML = `<div>Mem[${bar(memUsed / 32 * 100, 22)}<span class="hp">${memUsed.toFixed(1)}G/32G</span>]</div><div>Swp[${bar(2, 22)}<span class="hp">0.1G/8G</span>]</div>
      <div>Tasks: <b>${VMS.length}</b> VMs, <b>${VMS.length * 31}</b> thr; <b>${VMS.filter(v => v.c > 10).length}</b> running</div>
      <div>Load average: <b>${(cores.reduce((a, b) => a + b) / 100).toFixed(2)}</b> 1.12 0.98</div><div>Uptime: <b>${Math.floor(up / 86400)} days, ${new Date(up * 1000).toISOString().slice(11, 19)}</b></div>`;
    const list = [...VMS].sort((a, b) => (sortKey === "name" ? a.name.localeCompare(b.name) : sortKey === "pid" ? a.pid - b.pid : (b[sortKey] || 0) - (a[sortKey] || 0)));
    rows.innerHTML = list.map(v => `<button type="button" role="row" class="ht-row${VMS.indexOf(v) === sel ? " on" : ""}" data-i="${VMS.indexOf(v)}">
      <span>${v.pid}</span><span>nathan</span><span>${v.mem}G</span><span class="${v.c > 50 ? "hot" : ""}">${v.c.toFixed(1)}</span><span>${(v.mem / 32 * 100).toFixed(1)}</span><span>${fmtT(v.t)}</span><span class="cmdn">qemu-kvm <b>${esc(v.name)}</b></span></button>`).join("");
    rows.querySelectorAll(".ht-row").forEach(r => r.addEventListener("click", () => { sel = +r.dataset.i; draw(); showDetail(); }));
  }
  function showDetail() {
    const v = VMS[sel];
    detail.innerHTML = `<b>${esc(v.name)}</b> · ${esc(v.os)} · ${esc(v.net)} · <span class="muted">${esc(v.ip)}</span><br>${esc(v.role)}`;
  }
  function step() {
    cores = cores.map(c => Math.max(1, Math.min(99, c + (Math.random() - .5) * 18)));
    VMS.forEach(v => { v.c = Math.max(.3, Math.min(97, v.c + (Math.random() - .5) * v.cpu * .6)); v.t += v.c / 50; });
    draw();
  }
  const PROTOS = [
    (a, b) => `${a.ip}.${port()} > ${b.ip}.443: Flags [P.], length ${len()}`,
    (a, b) => `${a.ip}.${port()} > 10.0.10.5.53: ${Math.floor(Math.random() * 60000)}+ A? ${pick(["lab.local", "dc01.lab.local", "update.microsoft.com", "0xday.local"])}. (${len() % 60 + 30})`,
    (a, b) => `${a.ip} > ${b.ip}: ICMP echo request, id ${Math.floor(Math.random() * 999)}, seq ${Math.floor(Math.random() * 20)}, length 64`,
    (a, b) => `${a.ip}.${port()} > ${b.ip}.445: Flags [S], seq ${Math.floor(Math.random() * 4e9)}, win 64240, length 0`,
    (a, b) => `${a.ip}.${port()} > ${b.ip}.88: Kerberos AS-REQ`,
    () => `10.0.20.10.${port()} > 10.0.30.20.21: Flags [S], length 0  <span class="alert">// security-onion: ET SCAN Nmap -sS</span>`
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)], port = () => 40000 + Math.floor(Math.random() * 20000), len = () => 40 + Math.floor(Math.random() * 1400);
  const lines = [];
  function pkt() {
    const a = pick(VMS), b = pick(VMS.filter(x => x !== a));
    const t = new Date().toISOString().slice(11, 23);
    lines.push(`<span class="muted">${t}</span> IP ${pick(PROTOS)(a, b)}`);
    while (lines.length > 9) lines.shift();
    pkts.innerHTML = lines.join("\n");
  }
  el.querySelectorAll(".ht-head button").forEach(b => b.addEventListener("click", () => { sortKey = b.dataset.k; draw(); }));
  const F = {
    F1: () => (detail.innerHTML = "Click a VM for details. Click a column to sort. ↑/↓ select. F9 kill. F10 quit."),
    F3: () => window.OX && OX.fzf && OX.fzf(),
    F6: () => { const ks = ["c", "m", "t", "pid", "name"]; sortKey = ks[(ks.indexOf(sortKey) + 1) % ks.length]; draw(); },
    F9: () => { detail.innerHTML = `<span class="err">kill -9 ${VMS[sel].pid}: Operation not permitted.</span> ${VMS[sel].name === "security-onion" ? "nice try, the SIEM stays up." : "this VM has feelings."}`; window.OX && OX.unlock && OX.unlock("sudo"); },
    F10: () => (location.href = (document.documentElement.dataset.root || "") + "lab.html")
  };
  el.querySelectorAll(".ht-keys button").forEach(b => b.addEventListener("click", () => F[b.dataset.f]()));
  document.addEventListener("keydown", e => {
    if (/input|textarea/i.test(document.activeElement.tagName)) return;
    if (F[e.key]) { e.preventDefault(); F[e.key](); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % VMS.length; draw(); showDetail(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel + VMS.length - 1) % VMS.length; draw(); showDetail(); }
    else if (e.key === "q") F.F10();
  });
  draw(); showDetail(); for (let i = 0; i < 6; i++) pkt();
  if (!reduced) { setInterval(step, 1500); setInterval(pkt, 700); }
})();
