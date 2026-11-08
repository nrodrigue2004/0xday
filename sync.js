/* 0xDay sync: copies your progress (every localStorage key starting "oxday-") to a secret GitHub Gist you own, so it follows you across devices.
   No server of mine. The token you paste lives only in this browser (key oxday-sync-cfg, never synced or exported).
   Merge rule: per key, the most recently changed copy wins. Loads on every page; the setup UI is on sync.html. */
(function () {
  if (window.OXSYNC) return;
  const P = "oxday-", CFG = "oxday-sync-cfg", META = "oxday-sync-meta", FILE = "oxday-progress.json", DESC = "0xday-progress (site progress backup)";
  const NEVER = ["oxday-booted", "oxday-lastlogin"];
  const JOBS = ["oxday-jobs", "oxday-jobs-goal"];
  let rawGet, rawSet, rawRem;
  try { rawGet = Storage.prototype.getItem; rawSet = Storage.prototype.setItem; rawRem = Storage.prototype.removeItem; localStorage.length; } catch (e) { return; }
  const jget = (k, d) => { try { const v = JSON.parse(rawGet.call(localStorage, k)); return v && typeof v === "object" ? v : d; } catch (e) { return d; } };
  const jset = (k, v) => { try { rawSet.call(localStorage, k, JSON.stringify(v)); } catch (e) {} };
  const cfg = () => jget(CFG, {});
  const meta = () => jget(META, {});
  const linked = () => !!cfg().token;
  const syncable = k => typeof k === "string" && k.startsWith(P) && !k.startsWith("oxday-sync") && !NEVER.includes(k) && (cfg().jobs || !JOBS.includes(k));

  let status = linked() ? "idle" : "off", msg = "", busy = false, dirty = false, timer = null, lastPull = 0;
  const setStatus = (s, m) => { status = s; msg = m || ""; paint(); };

  /* record the time of every change to a synced key; ignore writes that change nothing */
  function touch(k, deleted) { const m = meta(); m[k] = (deleted ? -1 : 1) * Date.now(); jset(META, m); if (linked()) { dirty = true; clearTimeout(timer); timer = setTimeout(() => sync(false), 4000); } }
  Storage.prototype.setItem = function (k, v) {
    if (this === localStorage && syncable(k)) { let old = null; try { old = rawGet.call(this, k); } catch (e) {} if (old !== String(v)) { rawSet.call(this, k, v); touch(k, false); return; } }
    return rawSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === localStorage && syncable(k) && rawGet.call(this, k) !== null) { rawRem.call(this, k); touch(k, true); return; }
    return rawRem.call(this, k);
  };

  function localState() {
    const m = meta(), out = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (syncable(k)) out[k] = { v: rawGet.call(localStorage, k), t: Math.abs(m[k] || 0) || 1 }; }
    for (const k in m) if (m[k] < 0 && syncable(k) && !(k in out)) out[k] = { d: 1, t: -m[k] };
    return out;
  }

  async function api(path, opt) {
    const c = cfg();
    const r = await fetch("https://api.github.com" + path, Object.assign({ headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" } }, opt));
    if (r.status === 401) throw new Error("GitHub rejected the token (expired or revoked?)");
    if (r.status === 403 || r.status === 404) throw new Error("GitHub says " + r.status + ": token needs the gist scope");
    if (!r.ok) throw new Error("GitHub error " + r.status);
    return r.json();
  }
  async function findGist() {
    const c = cfg(); if (c.gist) return c.gist;
    for (let page = 1; page <= 5; page++) {
      const list = await api("/gists?per_page=100&page=" + page);
      const g = list.find(x => x.files && x.files[FILE]);
      if (g) { c.gist = g.id; jset(CFG, c); return g.id; }
      if (list.length < 100) break;
    }
    return null;
  }
  async function readRemote(id) {
    const g = await api("/gists/" + id);
    const f = g.files && g.files[FILE]; if (!f) return {};
    let text = f.content;
    if (f.truncated) text = await (await fetch(f.raw_url)).text();
    try { const d = JSON.parse(text); return d && d.keys ? d.keys : {}; } catch (e) { return {}; }
  }

  /* pull, merge newest-wins per key, push whatever local has that is newer. Returns number of keys changed here. */
  async function sync(initial) {
    if (!linked() || busy) return 0;
    busy = true; setStatus("sync", "syncing");
    try {
      let id = await findGist();
      const remote = id ? await readRemote(id) : {};
      const local = localState(), merged = {}, m = meta();
      let applied = 0, push = !id;
      for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
        const L = local[k], R = remote[k];
        if (!syncable(k)) continue;
        if (R && (!L || R.t > L.t)) {
          if (R.d) { rawRem.call(localStorage, k); m[k] = -R.t; } else { rawSet.call(localStorage, k, R.v); m[k] = R.t; }
          merged[k] = R; applied++;
        } else { merged[k] = L; if (!R || L.t > R.t) push = true; }
      }
      jset(META, m);
      if (push) {
        const body = { files: { [FILE]: { content: JSON.stringify({ v: 1, saved: new Date().toISOString(), keys: merged }) } } };
        if (id) await api("/gists/" + id, { method: "PATCH", body: JSON.stringify(body) });
        else { const g = await api("/gists", { method: "POST", body: JSON.stringify(Object.assign({ description: DESC, public: false }, body)) }); const c = cfg(); c.gist = g.id; jset(CFG, c); }
      }
      dirty = false; lastPull = Date.now();
      const c = cfg(); c.last = Date.now(); jset(CFG, c);
      setStatus("ok", applied ? "pulled " + applied + " change" + (applied > 1 ? "s" : "") : "up to date");
      if (applied) {
        let again = false; try { again = Date.now() - (+sessionStorage.getItem("oxday-sync-rl") || 0) < 15000; } catch (e) {}
        if (initial && !again) { try { sessionStorage.setItem("oxday-sync-rl", String(Date.now())); } catch (e) {} location.reload(); }
        else setStatus("ok", "pulled " + applied + " change(s) from another device. Reload to see them");
      }
      return applied;
    } catch (e) {
      setStatus("err", e && e.message ? e.message : "sync failed (offline?)");
      return 0;
    } finally { busy = false; }
  }

  /* footer indicator */
  function paint() {
    const a = document.getElementById("sync-link");
    if (a) { a.textContent = "sync" + (status === "off" ? "" : status === "ok" ? " ✓" : status === "err" ? " !" : " …"); a.title = status === "off" ? "not linked: save progress across devices" : msg; a.className = "sync-" + status; }
    const s = document.getElementById("sy-status");
    if (s) { const c = cfg(); s.textContent = status === "off" ? "not linked" : (status === "err" ? "error: " : "linked, ") + (msg || status) + (c.last && status !== "err" ? " (last sync " + new Date(c.last).toLocaleTimeString() + ")" : ""); s.className = status === "err" ? "warn" : status === "off" ? "muted" : "ok"; }
    const on = linked(), q = id => document.getElementById(id);
    if (q("sy-setup")) { q("sy-setup").hidden = on; q("sy-linked").hidden = !on; }
  }

  function exportAll() {
    const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P) && !k.startsWith("oxday-sync") && !NEVER.includes(k)) o[k] = rawGet.call(localStorage, k); }
    return JSON.stringify({ site: "0xday", exported: new Date().toISOString(), keys: o }, null, 1);
  }

  function ui() {
    const root = document.getElementById("sy-root"); if (!root) return;
    const $ = id => document.getElementById(id), note = t => { $("sy-msg").textContent = t; };
    $("sy-jobs").checked = !!cfg().jobs;
    $("sy-link").onclick = async () => {
      const t = $("sy-token").value.trim(); if (!/^(ghp_|github_pat_)?[A-Za-z0-9_]{30,}$/.test(t)) return note("that does not look like a token");
      const c = cfg(); c.token = t; c.jobs = $("sy-jobs").checked; delete c.gist; jset(CFG, c); $("sy-token").value = "";
      setStatus("sync", "connecting"); const n = await sync(false);
      note(status === "err" ? "failed: " + msg : "linked. Open the site on your other device and do the same steps there with the same token." + (n ? " Pulled " + n + " existing change(s); reload this page." : ""));
      if (status === "err") { const d = cfg(); delete d.token; jset(CFG, d); setStatus("off"); }
    };
    $("sy-now").onclick = async () => { await sync(false); note(status === "err" ? msg : "done"); };
    $("sy-jobs2").checked = !!cfg().jobs;
    $("sy-jobs2").onchange = () => { const c = cfg(); c.jobs = $("sy-jobs2").checked; jset(CFG, c); dirty = true; sync(false); };
    $("sy-unlink").onclick = () => { const c = cfg(); delete c.token; delete c.gist; delete c.last; jset(CFG, c); setStatus("off"); note("unlinked. Your data stays on this device. Revoke the token at github.com/settings/tokens to be thorough."); };
    $("sy-export").onclick = () => { const b = new Blob([exportAll()], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "0xday-progress-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); note("exported"); };
    $("sy-import").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); if (!d || d.site !== "0xday" || !d.keys) throw 0;
        let n = 0; for (const k in d.keys) if (k.startsWith(P) && !k.startsWith("oxday-sync") && typeof d.keys[k] === "string") { localStorage.setItem(k, d.keys[k]); n++; }
        note("imported " + n + " keys (they now count as newest and will sync). Reload to see them.");
      } catch (err) { note("that is not a 0xDay export file"); }
      e.target.value = "";
    };
  }

  window.OXSYNC = { sync, status: () => status, exportAll };
  const ready = () => { paint(); ui(); if (linked()) sync(true); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
  document.addEventListener("visibilitychange", () => {
    if (!linked()) return;
    if (document.visibilityState === "hidden" && dirty && !busy) sync(false);
    else if (document.visibilityState === "visible" && Date.now() - lastPull > 120000) sync(false);
  });
  window.addEventListener("online", () => { if (linked() && dirty) sync(false); });
})();
