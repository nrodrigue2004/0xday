/* ~/dist/cluster: a toy 3-node cluster. CP mode follows the Raft rules (terms, votes, log matching, majority commit).
   AP mode is a last-write-wins store with async replication. Fake clock, no real network. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  if (!$("#cl")) return;
  const N = 3, MAJ = 2, LAT = [2, 3], HB = 5, ETO = [14, 26];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ri = ([a, b]) => a + Math.floor(rnd() * (b - a + 1));
  let mode = "cp", now = 0, nodes, net, iso, logLines = [], paused = false, timer = null;

  function reset() {
    now = 0; net = []; iso = [false, false, false]; logLines = []; seed = 7;
    nodes = [0, 1, 2].map(i => ({ id: i, up: true, role: "follower", term: 0, voted: null, log: [], commit: 0, timer: ri(ETO), votes: 0, next: [1, 1, 1], match: [0, 0, 0], hb: 0, kv: {} }));
    say("g", mode === "cp" ? "cluster started in CP mode (majority = 2 of 3)" : "cluster started in AP mode (any node takes writes)");
    draw();
  }
  const nm = i => "n" + (i + 1);
  function say(c, t) { logLines.push(`<span class="${c}">t=${String(now).padStart(4, "0")}  ${t}</span>`); if (logLines.length > 200) logLines.shift(); }
  const linked = (a, b) => nodes[a].up && nodes[b].up && !iso[a] && !iso[b];

  function send(from, to, msg) {
    if (!linked(from, to)) return;
    net.push({ at: now + ri(LAT), from, to, msg });
  }
  function deliver() {
    const due = net.filter(m => m.at <= now); net = net.filter(m => m.at > now);
    due.forEach(m => { if (linked(m.from, m.to)) (mode === "cp" ? handleCP : handleAP)(nodes[m.to], m.from, m.msg); });
  }

  /* ---------------- CP: Raft-style ---------------- */
  const lastIdx = n => n.log.length, lastTerm = n => n.log.length ? n.log[n.log.length - 1].term : 0;
  function stepDown(n, term) { if (term > n.term) { n.term = term; n.voted = null; if (n.role !== "follower") say("w", `${nm(n.id)} sees term ${term}, steps down to follower`); n.role = "follower"; n.timer = ri(ETO); } }
  function startElection(n) {
    n.role = "candidate"; n.term++; n.voted = n.id; n.votes = 1; n.timer = ri(ETO);
    say("", `${nm(n.id)} election timeout: candidate in term ${n.term}`);
    for (let j = 0; j < N; j++) if (j !== n.id) send(n.id, j, { t: "rv", term: n.term, li: lastIdx(n), lt: lastTerm(n) });
  }
  function becomeLeader(n) {
    n.role = "leader"; n.next = [lastIdx(n) + 1, lastIdx(n) + 1, lastIdx(n) + 1]; n.match = [0, 0, 0]; n.match[n.id] = lastIdx(n);
    n.log.push({ term: n.term, cmd: "noop" }); n.match[n.id] = lastIdx(n);
    say("g", `${nm(n.id)} wins term ${n.term} with ${n.votes}/3 votes: LEADER`);
    bcast(n);
  }
  function bcast(n) { for (let j = 0; j < N; j++) if (j !== n.id) sendAE(n, j); n.hb = HB; }
  function sendAE(n, j) {
    const prev = n.next[j] - 1;
    send(n.id, j, { t: "ae", term: n.term, prev, pt: prev ? n.log[prev - 1].term : 0, ents: n.log.slice(prev), lc: n.commit });
  }
  function applyCommit(n, upto) {
    while (n.commit < upto) {
      n.commit++;
      const e = n.log[n.commit - 1];
      if (e && e.cmd !== "noop") { const [k, v] = e.cmd.split("="); n.kv[k] = v; }
    }
  }
  function handleCP(n, from, m) {
    if (m.term > n.term) stepDown(n, m.term);
    if (m.t === "rv") {
      const ok = m.term === n.term && (n.voted === null || n.voted === from) && (m.lt > lastTerm(n) || (m.lt === lastTerm(n) && m.li >= lastIdx(n)));
      if (ok) { n.voted = from; n.timer = ri(ETO); say("", `${nm(n.id)} votes for ${nm(from)} in term ${n.term}`); }
      send(n.id, from, { t: "rvr", term: n.term, ok });
    } else if (m.t === "rvr") {
      if (n.role === "candidate" && m.term === n.term && m.ok && ++n.votes >= MAJ) becomeLeader(n);
    } else if (m.t === "ae") {
      if (m.term < n.term) { send(n.id, from, { t: "aer", term: n.term, ok: false, m: 0 }); return; }
      n.role = "follower"; n.timer = ri(ETO);
      if (m.prev > 0 && (n.log.length < m.prev || n.log[m.prev - 1].term !== m.pt)) { send(n.id, from, { t: "aer", term: n.term, ok: false, m: 0 }); return; }
      let i = m.prev;
      m.ents.forEach(e => {
        i++;
        if (n.log.length >= i && n.log[i - 1].term !== e.term) { say("w", `${nm(n.id)} discards ${n.log.length - i + 1} conflicting entr${n.log.length - i + 1 === 1 ? "y" : "ies"} from index ${i}`); n.log.length = i - 1; }
        if (n.log.length < i) n.log.push({ term: e.term, cmd: e.cmd });
      });
      if (m.lc > n.commit) applyCommit(n, Math.min(m.lc, m.prev + m.ents.length));
      send(n.id, from, { t: "aer", term: n.term, ok: true, m: m.prev + m.ents.length });
    } else if (m.t === "aer") {
      if (n.role !== "leader" || m.term !== n.term) return;
      if (m.ok) {
        n.match[from] = Math.max(n.match[from], m.m); n.next[from] = n.match[from] + 1;
        for (let idx = lastIdx(n); idx > n.commit; idx--) {
          if (n.log[idx - 1].term === n.term && n.match.filter(x => x >= idx).length >= MAJ) {
            const before = n.commit; applyCommit(n, idx);
            for (let c = before + 1; c <= idx; c++) if (n.log[c - 1].cmd !== "noop") say("g", `${nm(n.id)} COMMITTED index ${c}: ${n.log[c - 1].cmd} (majority has it)`);
            break;
          }
        }
      } else n.next[from] = Math.max(1, n.next[from] - 1), sendAE(n, from);
    }
  }
  function tickCP() {
    nodes.forEach(n => {
      if (!n.up) return;
      if (n.role === "leader") { if (--n.hb <= 0) bcast(n); }
      else if (--n.timer <= 0) startElection(n);
    });
  }

  /* ---------------- AP: last write wins ---------------- */
  function handleAP(n, from, m) {
    if (m.t !== "put") return;
    const cur = n.kv[m.k];
    if (!cur || m.ts > cur.ts || (m.ts === cur.ts && m.by > cur.by)) {
      if (cur && cur.v !== m.v && cur.by !== m.by) say("w", `${nm(n.id)}: ${m.k}=${m.v} (written on ${nm(m.by)}) overwrites ${m.k}=${cur.v} (written on ${nm(cur.by)}) by timestamp: one write is lost`);
      n.kv[m.k] = { v: m.v, ts: m.ts, by: m.by };
    }
  }
  function tickAP() {
    if (now % 20 === 0) nodes.forEach(n => { if (!n.up) return; const j = (n.id + 1 + (rnd() < .5 ? 0 : 1)) % N; Object.keys(n.kv).forEach(k => send(n.id, j, { t: "put", k, ...n.kv[k] })); });
  }

  /* ---------------- client + controls ---------------- */
  function write(t, k, v) {
    const n = nodes[t];
    if (!n.up) return say("w", `client -> ${nm(t)}: no response (node is down)`);
    if (iso[t] && mode === "cp" && n.role !== "leader") return say("w", `client -> ${nm(t)}: refused, not the leader`);
    if (mode === "ap") {
      n.kv[k] = { v, ts: now, by: t }; say("", `client -> ${nm(t)}: ${k}=${v} accepted, replicating in the background`);
      for (let j = 0; j < N; j++) if (j !== t) send(t, j, { t: "put", k, v, ts: now, by: t });
      return;
    }
    if (n.role !== "leader") {
      const ld = nodes.findIndex(x => x.up && x.role === "leader" && x.term >= n.term && !iso[x.id]);
      return say("w", `client -> ${nm(t)}: refused, not the leader${ld >= 0 ? ` (try ${nm(ld)})` : " (no leader known yet)"}`);
    }
    n.log.push({ term: n.term, cmd: `${k}=${v}` }); n.match[n.id] = lastIdx(n);
    say("", `client -> ${nm(t)} (leader): appended index ${lastIdx(n)}: ${k}=${v}, waiting for a majority`);
    bcast(n);
    if (iso[t]) say("w", `${nm(t)} cannot reach a majority: index ${lastIdx(n)} will not commit while it is isolated`);
  }
  function read(t, k) {
    const n = nodes[t];
    if (!n.up) return say("w", `read ${k} <- ${nm(t)}: no response (node is down)`);
    if (mode === "cp") {
      if (n.role !== "leader") return say("w", `read ${k} <- ${nm(t)}: refused, only the leader answers in CP mode (consistency over availability)`);
      if (iso[t]) return say("w", `read ${k} <- ${nm(t)}: refused, leader cannot confirm it still has a majority`);
      return say("g", `read ${k} <- ${nm(t)}: ${n.kv[k] === undefined ? "(unset)" : n.kv[k]} (committed value)`);
    }
    const c = n.kv[k];
    const newest = nodes.reduce((b, x) => x.kv[k] && (!b || x.kv[k].ts > b.ts) ? x.kv[k] : b, null);
    const stale = (newest && (!c || c.ts < newest.ts));
    say(stale ? "w" : "g", `read ${k} <- ${nm(t)}: ${c ? c.v : "(unset)"}${stale ? `  STALE: the newest write is ${k}=${newest.v}` : ""}`);
  }

  function draw() {
    $("#cl-tick").textContent = `tick ${now}`;
    $("#cl-nodes").innerHTML = nodes.map(n => {
      const kvs = mode === "cp" ? Object.entries(n.kv).map(([k, v]) => `${k}=${v}`).join(" ") : Object.entries(n.kv).map(([k, o]) => `${k}=${o.v}`).join(" ");
      const chips = mode === "cp" ? n.log.map((e, i) => `<span class="cl3__chip t${e.term % 4}${i + 1 > n.commit ? " unc" : ""}" title="index ${i + 1}, term ${e.term}${i + 1 > n.commit ? ", NOT committed" : ", committed"}">${i + 1}:${e.cmd}</span>`).join("") : "";
      return `<div class="cl3__n${n.role === "leader" && n.up && mode === "cp" ? " is-leader" : ""}${n.up ? "" : " is-down"}${iso[n.id] ? " is-iso" : ""}">
<h3><span>${nm(n.id)}</span><span class="cl3__role">${!n.up ? "DOWN" : mode === "cp" ? n.role.toUpperCase() : "up"}${iso[n.id] ? " (isolated)" : ""}</span></h3>
${mode === "cp" ? `<div class="cl3__row">term ${n.term} &middot; commit ${n.commit} &middot; log ${n.log.length}</div><div class="cl3__log-chips">${chips || '<span class="muted small">empty log</span>'}</div>` : ""}
<div class="cl3__row">state: ${kvs || '<span class="muted">(empty)</span>'}</div>
<div class="cl3__btns"><button class="btn" data-a="kill" data-i="${n.id}" type="button">[ ${n.up ? "kill" : "revive"} ]</button><button class="btn" data-a="iso" data-i="${n.id}" type="button">[ ${iso[n.id] ? "rejoin" : "isolate"} ]</button></div></div>`;
    }).join("");
    const el = $("#cl-log"); const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    el.innerHTML = logLines.join("\n"); if (atEnd) el.scrollTop = el.scrollHeight;
  }
  function tick() { now++; deliver(); mode === "cp" ? tickCP() : tickAP(); draw(); }
  function loop() { clearInterval(timer); if (!paused) timer = setInterval(tick, 1000 / (+$("#cl-speed").value * 3)); }

  $("#cl-nodes").addEventListener("click", e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const i = +b.dataset.i, n = nodes[i];
    if (b.dataset.a === "kill") {
      n.up = !n.up;
      if (n.up) { n.role = "follower"; n.timer = ri(ETO); n.votes = 0; say("g", `${nm(i)} revived (log and term kept on disk)`); } else say("w", `${nm(i)} killed`);
    } else { iso[i] = !iso[i]; say(iso[i] ? "w" : "g", `${nm(i)} ${iso[i] ? "isolated: cut off from the other nodes" : "rejoined the network"}`); }
    draw();
  });
  $("#cl-form").addEventListener("submit", e => { e.preventDefault(); const k = $("#cl-key").value.trim() || "x", v = $("#cl-val").value.trim() || "1"; write(+$("#cl-target").value, k.replace(/[^\w]/g, ""), v.replace(/[^\w.-]/g, "")); draw(); });
  $("#cl-read").addEventListener("click", () => { read(+$("#cl-target").value, $("#cl-key").value.trim() || "x"); draw(); });
  $("#cl-mode").addEventListener("change", e => { mode = e.target.value; reset(); });
  $("#cl-speed").addEventListener("input", loop);
  $("#cl-pause").addEventListener("click", e => { paused = !paused; e.target.textContent = paused ? "[ resume ]" : "[ pause ]"; loop(); });
  $("#cl-step").addEventListener("click", () => { if (!paused) $("#cl-pause").click(); tick(); });
  $("#cl-heal").addEventListener("click", () => { iso = [false, false, false]; nodes.forEach(n => { if (!n.up) { n.up = true; n.role = "follower"; n.timer = ri(ETO); } }); say("g", "healed: every node up and connected"); draw(); });
  $("#cl-reset").addEventListener("click", reset);
  window.__cluster = { tick, write, read, get nodes() { return nodes; }, setMode: m => { mode = m; reset(); }, iso: (i, v) => { iso[i] = v; }, kill: (i, up) => { nodes[i].up = up; }, get iso_() { return iso; } };
  reset(); loop();
})();
