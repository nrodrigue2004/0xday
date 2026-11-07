/* ~/arcade: iptables (packet triage) and crack (acronym hash cracking).
   No dependencies. High scores live in localStorage under oxday-hi-<game>. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const getHi = g => +(ls.get("oxday-hi-" + g) || 0);
  const setHi = (g, v) => { if (v > getHi(g)) { ls.set("oxday-hi-" + g, String(v)); return true; } return false; };
  const paintHi = () => document.querySelectorAll("[data-hi]").forEach(el => { const v = getHi(el.dataset.hi); el.textContent = v ? v : "---"; });
  // ignore keys while ghost, fzf or any other text field has focus
  const typing = () => /input|textarea|select/i.test((document.activeElement || {}).tagName || "") || !!$(".fzf");
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];

  paintHi();
  const dataEl = $("#ar-data");
  if (!dataEl) return;
  const DATA = JSON.parse(dataEl.textContent);

  /* =================================================================== */
  /*                              iptables                               */
  /* =================================================================== */
  if (DATA.game === "iptables") {
    const SVC = {
      20: ["tcp", "ftp-data"], 21: ["tcp", "ftp"], 22: ["tcp", "ssh"], 23: ["tcp", "telnet"], 25: ["tcp", "smtp"], 49: ["tcp", "tacacs"],
      53: ["udp", "dns"], 67: ["udp", "dhcp"], 69: ["udp", "tftp"], 80: ["tcp", "http"], 88: ["tcp", "kerberos"], 110: ["tcp", "pop3"],
      123: ["udp", "ntp"], 139: ["tcp", "netbios"], 143: ["tcp", "imap"], 161: ["udp", "snmp"], 389: ["tcp", "ldap"], 443: ["tcp", "https"],
      445: ["tcp", "smb"], 514: ["udp", "syslog"], 587: ["tcp", "submission"], 636: ["tcp", "ldaps"], 993: ["tcp", "imaps"], 995: ["tcp", "pop3s"],
      1433: ["tcp", "mssql"], 1812: ["udp", "radius"], 3306: ["tcp", "mysql"], 3389: ["tcp", "rdp"], 5060: ["udp", "sip"], 8080: ["tcp", "http-alt"]
    };
    const PORTS = Object.keys(SVC).map(Number);
    // dual-proto services: same port, the other protocol also exists in the wild
    const ALSO_UDP = { 53: 1, 88: 1, 123: 1 };
    const R = (act, o = {}) => ({ act, ...o });
    const LEVELS = [
      { name: "edge-router", policy: "ACCEPT", rules: [R("DROP", { p: "tcp", d: [23] }), R("DROP", { p: "tcp", d: [21] })] },
      { name: "web-01", policy: "DROP", rules: [R("ACCEPT", { p: "tcp", d: [80, 443] }), R("ACCEPT", { p: "udp", d: [53] })] },
      { name: "jumpbox", policy: "DROP", rules: [R("ACCEPT", { p: "tcp", d: [22], s: "10.0.20.0/24" }), R("ACCEPT", { p: "tcp", d: [443] }), R("ACCEPT", { p: "udp", d: [123] })] },
      { name: "mail-relay", policy: "DROP", rules: [R("DROP", { s: "198.51.100.0/24" }), R("ACCEPT", { p: "tcp", d: [25, 587, 993] })] },
      { name: "file-srv", policy: "ACCEPT", rules: [R("ACCEPT", { p: "tcp", d: [3389], s: "10.0.20.0/24" }), R("DROP", { p: "tcp", d: [3389] }), R("ACCEPT", { p: "tcp", d: [445], s: "10.0.0.0/16" }), R("DROP", { p: "tcp", d: [445, 139] }), R("DROP", { p: "udp", d: [161] })] },
      { name: "dc-01", policy: "DROP", rules: [R("ACCEPT", { p: "tcp", d: [88, 389, 636], s: "10.0.0.0/16" }), R("ACCEPT", { p: "udp", d: [53, 88, 123], s: "10.0.0.0/16" }), R("ACCEPT", { p: "tcp", d: [3389], s: "10.0.20.0/24" })] },
      { name: "under-attack", policy: "ACCEPT", rules: [R("DROP", { p: "tcp", syn: true, s: "45.0.0.0/8" }), R("ACCEPT", { p: "tcp", d: [443] }), R("DROP", { p: "tcp", d: [22, 23, 3389] }), R("DROP", { p: "udp" })] },
      { name: "db-tier", policy: "DROP", rules: [R("ACCEPT", { p: "tcp", d: [1433, 3306], s: "10.0.30.0/24" }), R("ACCEPT", { p: "tcp", d: [22], s: "10.0.20.0/24" }), R("ACCEPT", { p: "udp", d: [514], s: "10.0.0.0/16" })] }
    ];
    const SRC = { inet: ["203.0.113.", "198.51.100.", "45.33.", "45.79.", "192.0.2."], lan: ["10.0.10.", "10.0.20.", "10.0.30.", "10.0.40."] };
    const PER_LEVEL = 14;

    const ip2n = ip => ip.split(".").reduce((a, o) => a * 256 + +o, 0);
    const inNet = (ip, cidr) => { const [n, b] = cidr.split("/"); const m = b === "0" ? 0 : (~0 << (32 - b)) >>> 0; return ((ip2n(ip) & m) >>> 0) === ((ip2n(n) & m) >>> 0); };
    const ruleText = (r, i) => {
      let t = `${String(i + 1).padStart(2)} -A INPUT`;
      if (r.p) t += ` -p ${r.p}`;
      if (r.syn) t += " --syn";
      if (r.s) t += ` -s ${r.s}`;
      if (r.d) t += r.d.length > 1 ? ` -m multiport --dports ${r.d.join(",")}` : ` --dport ${r.d[0]}`;
      return t + ` -j ${r.act}`;
    };
    const matches = (r, k) => (!r.p || r.p === k.p) && (!r.syn || k.flag === "SYN") && (!r.s || inNet(k.src, r.s)) && (!r.d || r.d.includes(k.dp));
    const verdict = (lv, k) => { for (let i = 0; i < lv.rules.length; i++) if (matches(lv.rules[i], k)) return [lv.rules[i].act, i]; return [lv.policy, -1]; };

    const rand3 = () => 1 + rnd(254);
    function makeSrc(lv) {
      const nets = lv.rules.filter(r => r.s).map(r => r.s);
      if (nets.length && Math.random() < .45) {
        const n = pick(nets); const [base, bits] = n.split("/"); const o = base.split(".");
        if (bits === "24") return `${o[0]}.${o[1]}.${o[2]}.${rand3()}`;
        if (bits === "16") return `${o[0]}.${o[1]}.${pick([10, 20, 30, 40])}.${rand3()}`;
        return `${o[0]}.${rnd(255)}.${rnd(255)}.${rand3()}`;
      }
      const pre = pick(Math.random() < .5 ? SRC.inet : SRC.lan);
      return pre + (pre.split(".").length === 3 ? rnd(255) + "." : "") + rand3();
    }
    function makePacket(lv) {
      const rp = [].concat(...lv.rules.filter(r => r.d).map(r => r.d));
      let dp = rp.length && Math.random() < .6 ? pick(rp) : pick(PORTS);
      let p = SVC[dp][0];
      if (ALSO_UDP[dp] && Math.random() < .5) p = p === "tcp" ? "udp" : "tcp";
      const udpRule = lv.rules.find(r => r.p === "udp" && !r.d);
      if (udpRule && Math.random() < .15) { dp = pick([53, 123, 161, 514, 1812]); p = "udp"; }
      const k = { p, dp, src: makeSrc(lv), sp: 1024 + rnd(64000), dst: "10.0.30." + (5 + rnd(20)) };
      if (p === "tcp") k.flag = lv.rules.some(r => r.syn) ? (Math.random() < .6 ? "SYN" : "ACK") : "SYN";
      if (lv.rules.some(r => r.syn) && Math.random() < .35) { k.src = "45." + rnd(255) + "." + rnd(255) + "." + rand3(); k.p = "tcp"; k.flag = "SYN"; k.dp = pick([80, 443, 8080]); }
      [k.want, k.rule] = verdict(lv, k);
      return k;
    }

    const lane = $("#ipt-lane"), rulesEl = $("#ipt-rules"), over = $("#ipt-over");
    const hud = { lvl: $("#ipt-lvl"), score: $("#ipt-score"), combo: $("#ipt-combo"), hp: $("#ipt-hp") };
    let st = null, raf = 0, last = 0;

    function idle(msg) {
      over.hidden = false;
      over.innerHTML = msg || `<pre>iptables v1.8.10 (nf_tables)
chain INPUT: 0 packets, 0 bytes

  <b>[ Enter ]</b> or tap start to bring the interface up.
  A / &larr;  ACCEPT       D / &rarr;  DROP       P  pause</pre><button class="btn ar-big" type="button" data-start>[ ./start ]</button>`;
    }
    function loadLevel() {
      const lv = LEVELS[(st.lvl - 1) % LEVELS.length];
      st.lv = lv; st.left = PER_LEVEL;
      st.speed = 34 + st.lvl * 7; // px per second
      st.gap = Math.max(620, 1900 - st.lvl * 140);
      st.labels = st.lvl <= 4;
      rulesEl.innerHTML = `<span class="muted"># ${esc(lv.name)}${st.lvl > LEVELS.length ? "  (lap " + (1 + Math.floor((st.lvl - 1) / LEVELS.length)) + ")" : ""}</span>\n` +
        `<span class="muted">:INPUT</span> <b class="${lv.policy === "DROP" ? "err" : "ok"}">${lv.policy}</b> <span class="muted">[policy]</span>\n` +
        lv.rules.map((r, i) => `<span data-r="${i}">${esc(ruleText(r, i))}</span>`).join("\n") +
        `\n<span class="muted">${st.labels ? "# ports are labeled this level" : "# no labels. you know these."}</span>`;
      banner(`chain loaded: ${lv.name}`);
    }
    function banner(t) { const b = document.createElement("div"); b.className = "ipt-banner"; b.textContent = t; lane.appendChild(b); setTimeout(() => b.remove(), 1400); }
    function spawn() {
      const k = makePacket(st.lv); k.y = -30;
      const el = document.createElement("div"); el.className = "ipt-pkt";
      const lab = st.labels ? ` <span class="muted">${SVC[k.dp] ? SVC[k.dp][1] : ""}</span>` : "";
      el.innerHTML = `<span class="ipt-p">${k.p.toUpperCase()}</span> ${k.src} &rarr; ${k.dst}:<b>${k.dp}</b>${lab}${k.flag ? ` <span class="ipt-f">[${k.flag}]</span>` : ""}`;
      k.el = el; lane.appendChild(el); st.q.push(k); st.spawned++;
    }
    function hpBar() { return "#".repeat(st.hp) + "-".repeat(3 - st.hp); }
    function paint() { hud.lvl.textContent = st.lvl; hud.score.textContent = st.score; hud.combo.textContent = st.combo; hud.hp.textContent = hpBar(); }
    function flashRule(i) { const r = rulesEl.querySelector(`[data-r="${i}"]`); if (r) { r.classList.remove("hit"); void r.offsetWidth; r.classList.add("hit"); } }
    function strike(k, chose, why) {
      st.hp--; st.combo = 1; st.miss.push({ k, chose, why, lv: st.lv.name });
      lane.classList.remove("shake"); void lane.offsetWidth; lane.classList.add("shake");
      if (st.hp <= 0) end();
    }
    function decide(act) {
      if (!st || !st.run || st.paused) return;
      const k = st.q.shift(); if (!k) return;
      if (k.rule >= 0) flashRule(k.rule);
      k.el.classList.add(act === "ACCEPT" ? "acc" : "drop");
      setTimeout(() => k.el.remove(), 260);
      if (act === k.want) { st.score += 10 * st.lvl * st.combo; st.combo = Math.min(st.combo + 1, 8); }
      else strike(k, act, act === "ACCEPT" ? "breach" : "outage");
      done(k);
    }
    function done() {
      st.left--; paint();
      if (st.run && st.left <= 0 && !st.q.length) { st.lvl++; st.spawned = 0; loadLevel(); paint(); }
    }
    function tick(t) {
      if (!st || !st.run) return;
      const dt = Math.min(64, t - (last || t)); last = t;
      if (!st.paused) {
        st.acc += dt;
        if (st.spawned < PER_LEVEL && st.acc >= st.gap) { st.acc = 0; spawn(); }
        const h = lane.clientHeight - 28;
        st.q.forEach((k, i) => { k.y += st.speed * dt / 1000; k.el.style.transform = `translateY(${k.y}px)`; k.el.classList.toggle("head", i === 0); });
        while (st.q.length && st.q[0].y >= h) {
          const k = st.q.shift(); k.el.classList.add("lost"); setTimeout(() => k.el.remove(), 260);
          strike(k, "timeout", "queue overflow"); if (!st.run) return; done(k);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    function start() {
      cancelAnimationFrame(raf);
      lane.querySelectorAll(".ipt-pkt,.ipt-banner").forEach(e => e.remove());
      st = { lvl: 1, score: 0, combo: 1, hp: 3, q: [], spawned: 0, acc: 1e9, run: true, paused: false, miss: [] };
      over.hidden = true; loadLevel(); paint();
      const box = $("#ipt").getBoundingClientRect(); if (box.top < 0 || box.bottom > innerHeight) $("#ipt").scrollIntoView({ block: "start", behavior: "smooth" }); last = 0; raf = requestAnimationFrame(tick);
    }
    function end() {
      st.run = false; cancelAnimationFrame(raf);
      const best = setHi("iptables", st.score); paintHi();
      const why = st.miss.slice(-4).map(m => {
        const k = m.k, rule = k.rule >= 0 ? `rule ${k.rule + 1}` : "the policy";
        return `  ${m.why.padEnd(14)} ${k.p} ${k.src} &rarr; :${k.dp}${k.flag ? " [" + k.flag + "]" : ""}\n  ${" ".repeat(15)}<span class="muted">${m.chose === "timeout" ? "no verdict. " : ""}${rule} on ${esc(m.lv)} says ${k.want}</span>`;
      }).join("\n");
      idle(`<pre><span class="err">kernel: nf_conntrack: table full, dropping packet</span>
<span class="err">-- host down --</span>

  score  <b>${st.score}</b>${best ? '  <span class="ok">new high score</span>' : ""}
  level  ${st.lvl}

  what went wrong:
${why}

  <b>[ Enter ]</b> to bring it back up.</pre><button class="btn ar-big" type="button" data-start>[ ./restart ]</button>`);
    }
    function pause() { if (!st || !st.run) return; st.paused = !st.paused; lane.classList.toggle("paused", st.paused); }

    over.addEventListener("click", e => { if (e.target.closest("[data-start]")) start(); });
    $("#ipt-acc").addEventListener("click", () => decide("ACCEPT"));
    $("#ipt-drop").addEventListener("click", () => decide("DROP"));
    lane.addEventListener("click", () => { if (st && st.paused) pause(); });
    document.addEventListener("keydown", e => {
      if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "enter" && (!st || !st.run)) start();
      else if (k === "a" || k === "arrowleft") decide("ACCEPT");
      else if (k === "d" || k === "arrowright") decide("DROP");
      else if (k === "p" || (k === "escape" && st && st.run)) pause();
      else return;
      e.preventDefault(); e.stopImmediatePropagation(); // keep vim keys and other page shortcuts out of the game
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden && st && st.run && !st.paused) pause(); });
    idle();
  }

  /* =================================================================== */
  /*                                crack                                */
  /* =================================================================== */
  if (DATA.game === "crack") {
    const WORDS = DATA.words, TRIES = 6;
    const board = $("#crk-board"), msg = $("#crk-msg"), kb = $("#crk-kb"), hashEl = $("#crk-hash"), stat = $("#crk-stat");
    const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    const today = () => new Date().toISOString().slice(0, 10);
    const strHash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    const dailyWord = d => WORDS[strHash("0xday:" + d) % WORDS.length];
    const loadJ = (k, d) => { try { return JSON.parse(ls.get(k)) || d; } catch (e) { return d; } };
    let mode = ls.get("oxday-crack-mode") === "endless" ? "endless" : "daily";
    let g = null; // current game

    async function sha256(s) {
      try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
      catch (e) { return strHash(s).toString(16).padStart(8, "0").repeat(8); }
    }
    function score(guess, ans) {
      const res = Array(ans.length).fill("x"), left = {};
      for (let i = 0; i < ans.length; i++) { if (guess[i] === ans[i]) res[i] = "g"; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
      for (let i = 0; i < ans.length; i++) if (res[i] !== "g" && left[guess[i]]) { res[i] = "y"; left[guess[i]]--; }
      return res;
    }
    function newGame() {
      if (mode === "daily") {
        const d = today(), saved = loadJ("oxday-crack-daily", {});
        const w = dailyWord(d);
        g = { w, guesses: saved.date === d ? saved.guesses || [] : [], cur: "", over: false, hint: saved.date === d && saved.hint };
        g.guesses.forEach(x => (g.over = g.over || x === w.w));
        if (g.guesses.length >= TRIES) g.over = true;
      } else {
        const run = loadJ("oxday-crack-run", { pts: 0, solved: 0 });
        let w; do { w = pick(WORDS); } while (g && g.w === w);
        g = { w, guesses: [], cur: "", over: false, hint: false, run };
      }
      render(); drawHash();
      if (g.over) finish(true);
    }
    async function drawHash(status) {
      const w = g.w, h = await sha256(w.w);
      const solved = status === "cracked";
      hashEl.innerHTML = `<span class="muted">$</span> hashcat -a 3 -m 1400 target.hash ${"?u".repeat(w.w.length)}
target.hash  <span class="crk-h">${h}</span>
category     ${esc(w.c)}    length ${w.w.length}
Status.....: ${solved ? `<span class="ok">Cracked</span>  ${h.slice(0, 12)}...:<b>${w.w}</b>` : status === "exhausted" ? '<span class="err">Exhausted</span>' : "Running"}${g.hint ? `\nhint.......: <span class="amber">${esc(w.n.replace(new RegExp("\\b" + w.w + "\\b", "gi"), "█".repeat(w.w.length)))}</span>` : ""}`;
    }
    function render() {
      const L = g.w.w.length; let html = "";
      for (let r = 0; r < TRIES; r++) {
        const word = r < g.guesses.length ? g.guesses[r] : r === g.guesses.length ? g.cur : "";
        const res = r < g.guesses.length ? score(word, g.w.w) : null;
        html += `<div class="crk-row${r === g.guesses.length && !g.over ? " cur" : ""}">`;
        for (let i = 0; i < L; i++) html += `<span class="crk-c${res ? " " + res[i] : ""}${word[i] ? " f" : ""}">${word[i] || ""}</span>`;
        html += "</div>";
      }
      board.innerHTML = html;
      const best = {};
      g.guesses.forEach(w => score(w, g.w.w).forEach((s, i) => { const c = w[i], rank = { g: 3, y: 2, x: 1 }; if (!best[c] || rank[s] > rank[best[c]]) best[c] = s; }));
      kb.innerHTML = ROWS.map((row, ri) => `<div class="crk-kr">${ri === 2 ? '<button type="button" class="crk-k wide" data-k="ENTER">enter</button>' : ""}${[...row].map(c => `<button type="button" class="crk-k ${best[c] || ""}" data-k="${c}">${c}</button>`).join("")}${ri === 2 ? '<button type="button" class="crk-k wide" data-k="BACK" aria-label="backspace">del</button>' : ""}</div>`).join("") +
        `<div class="crk-kr"><button type="button" class="crk-k wide" data-k="HINT">? hint</button>${g.over ? '<button type="button" class="crk-k wide" data-k="NEXT">' + (mode === "daily" ? "copy result" : "next hash") + "</button>" : ""}</div>`;
      document.querySelectorAll(".crk-modes [data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      if (mode === "daily") {
        const s = loadJ("oxday-crack-stats", { streak: 0, played: 0, won: 0 });
        stat.innerHTML = `streak <b>${s.streak}</b> · won <b>${s.won}/${s.played}</b>`;
      } else stat.innerHTML = `run <b>${g.run.pts}</b> pts · <b>${g.run.solved}</b> cracked`;
    }
    function say(t, cls = "") { msg.className = "crk-msg " + cls; msg.innerHTML = t; }
    function save() { if (mode === "daily") ls.set("oxday-crack-daily", JSON.stringify({ date: today(), guesses: g.guesses, hint: g.hint })); }
    function key(k) {
      if (!g) return;
      if (k === "HINT") return hint();
      if (k === "NEXT") return mode === "daily" ? share() : newGame();
      if (g.over) { if (k === "ENTER" && mode === "endless") newGame(); return; }
      const L = g.w.w.length;
      if (k === "BACK") g.cur = g.cur.slice(0, -1);
      else if (k === "ENTER") {
        if (g.cur.length < L) { say(`need ${L} letters.`, "err"); shake(); return; }
        g.guesses.push(g.cur); g.cur = ""; save();
        if (g.guesses[g.guesses.length - 1] === g.w.w || g.guesses.length >= TRIES) { g.over = true; render(); return finish(false); }
      } else if (/^[A-Z]$/.test(k) && g.cur.length < L) g.cur += k;
      say(""); render();
    }
    function shake() { const r = board.querySelector(".crk-row.cur"); if (r) { r.classList.remove("shake"); void r.offsetWidth; r.classList.add("shake"); } }
    function hint() {
      if (g.over || g.hint) return;
      if (mode === "endless" && g.run.pts > 0) g.run.pts--;
      g.hint = true; save(); drawHash(); render();
    }
    function finish(restored) {
      const won = g.guesses.includes(g.w.w), n = g.guesses.length, w = g.w;
      drawHash(won ? "cracked" : "exhausted");
      const def = `<b>${w.w}</b> = ${esc(w.x)}<br><span class="muted">${esc(w.n)}</span>`;
      if (mode === "daily") {
        if (!restored) {
          const s = loadJ("oxday-crack-stats", { streak: 0, played: 0, won: 0, last: "" });
          const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
          s.played++; if (won) { s.won++; s.streak = s.last === y ? s.streak + 1 : 1; s.last = today(); } else s.streak = 0;
          ls.set("oxday-crack-stats", JSON.stringify(s));
        }
        say(`${won ? `<span class="ok">cracked in ${n}/${TRIES}.</span>` : '<span class="err">keyspace exhausted.</span>'} ${def}<br><span class="muted">next daily hash at 00:00 UTC. endless mode is always open.</span>`);
      } else {
        if (won) { g.run.pts += TRIES + 1 - n; g.run.solved++; ls.set("oxday-crack-run", JSON.stringify(g.run)); setHi("crack", g.run.pts); }
        else { const fin = g.run.pts; setHi("crack", fin); ls.set("oxday-crack-run", JSON.stringify({ pts: 0, solved: 0 })); say(`<span class="err">keyspace exhausted. run over at ${fin} pts.</span> ${def}<br><span class="muted">Enter for a new run.</span>`); g.run = { pts: 0, solved: 0 }; }
        if (won) say(`<span class="ok">cracked in ${n}. +${TRIES + 1 - n}</span> ${def}<br><span class="muted">Enter for the next hash.</span>`);
        paintHi();
      }
      render();
    }
    function share() {
      const won = g.guesses.includes(g.w.w);
      const grid = g.guesses.map(x => score(x, g.w.w).map(s => ({ g: "█", y: "▒", x: "░" }[s])).join("")).join("\n");
      const t = `0xDay crack ${today()} ${won ? g.guesses.length : "X"}/${TRIES}${g.hint ? " (hint)" : ""}\n${grid}\nnrodrigue2004.github.io/0xday/arcade/crack.html`;
      const ok = () => say("result copied to clipboard.", "ok");
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => say(`<pre>${esc(t)}</pre>`));
      else say(`<pre>${esc(t)}</pre>`);
    }

    kb.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) { key(b.dataset.k); b.blur(); } });
    document.querySelectorAll(".crk-modes [data-mode]").forEach(b => b.addEventListener("click", () => { mode = b.dataset.mode; ls.set("oxday-crack-mode", mode); say(""); g = null; newGame(); b.blur(); }));
    document.addEventListener("keydown", e => {
      if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === "Enter") key("ENTER");
      else if (k === "Backspace") key("BACK");
      else if (k === "?") key("HINT");
      else if (/^[a-z]$/i.test(k)) key(k.toUpperCase());
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    });
    newGame();
  }
})();
