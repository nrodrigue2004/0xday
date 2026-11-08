"""Phase 3 pages for 0xDay: the interactive homelab map, the attack-chain
walkthrough, and the per-project deep-dives.

Called from build.py as build_homelab.build(page, esc). Kept in its own file,
with its own homelab.css / homelab.js, so it doesn't collide with other work
on build.py. The three pages all share one stylesheet and one script.

Data:
  content/homelab.json    nodes, links and firewall rules (placeholder IPs)
  content/attackchain.json six staged red/blue panels
  content/deepdives.json   one long-form write-up per big project
"""
import json, hashlib


def _ver():
    return hashlib.sha1((open("homelab.css").read() + open("homelab.js").read()).encode()).hexdigest()[:8]


def _head(v, data=None):
    h = f'\n<link rel="stylesheet" href="homelab.css?v={v}">\n<script src="homelab.js?v={v}" defer></script>'
    if data:
        # ship the page's data inline as JSON so homelab.js needs no fetch
        h += f'\n<script id="hl-data" type="application/json">{json.dumps(data)}</script>'
    return h


def _map(page, esc, v):
    H = json.load(open("content/homelab.json"))
    hw = H["hardware"]
    hwline = f'{esc(hw["cpu"])} · {esc(hw["ram"])} · {esc(hw["disk"])} · {esc(hw["hypervisor"])}'
    body = f'''<p class="cmd">cat ~/homelab/README &amp;&amp; ./map</p>
<h1>~/homelab</h1>
<p>Seven VMs on one Proxmox host, wired to look like a small company network. Click a node to ssh in and see what it runs and what I practice on it. {esc(H["note"])}</p>
<p class="muted small">{hwline}</p>
<div class="hl-mapwrap">
  <div class="hl-toolbar" role="group" aria-label="map controls">
    <button class="btn" type="button" data-mode="explore" aria-pressed="true">[ explore ]</button>
    <button class="btn" type="button" data-mode="trace" aria-pressed="false">[ traceroute ]</button>
    <span class="hl-hint muted" aria-live="polite">Click a node to inspect it.</span>
  </div>
  <div id="hl-map" class="hl-map" aria-label="homelab network map"></div>
  <div class="hl-trace" hidden>
    <label>from <select id="hl-src"></select></label>
    <label>to <select id="hl-dst"></select></label>
    <button class="btn" type="button" id="hl-go">[ ./trace ]</button>
  </div>
  <div id="hl-panel" class="hl-panel" aria-live="polite"></div>
</div>
<noscript><p>The map needs JavaScript. The same machines are described in the <a href="deep-dives.html#homelab">homelab deep-dive</a>.</p></noscript>
<p><a href="attack-chain.html">./attack-chain</a> <span class="muted">// watch one host get owned, stage by stage</span><br><a href="weekly.html">./weekly</a> <span class="muted">// what to do in the lab this week</span> · <a href="harden.html">./harden</a> <span class="muted">// checklist with a score</span> · <a href="drills/security-onion-intrusion-hunt.html">./hunt</a> <span class="muted">// log-hunt lab</span></p>'''
    page("homelab.html", "homelab map :: 0xDay", body, cur="lab",
         head=_head(v, {"kind": "map", "data": H}),
         desc="Interactive terminal map of Nathan's seven-VM Proxmox homelab, with a traceroute mode.")


def _chain(page, esc, v):
    A = json.load(open("content/attackchain.json"))
    dots = "".join(f'<button class="hl-dot" type="button" data-i="{i}" aria-label="stage {s["n"]}: {esc(s["name"])}">{s["n"]}</button>'
                   for i, s in enumerate(A["stages"]))
    body = f'''<p class="cmd">./replay --scenario ad-compromise</p>
<h1>{esc(A["title"])}</h1>
<p>{esc(A["intro"])}</p>
<div class="hl-chain">
  <div class="hl-chain__bar">
    <div class="hl-dots">{dots}</div>
    <div class="hl-chain__ctl">
      <button class="btn" type="button" id="hl-prev">[ p ]</button>
      <button class="btn" type="button" id="hl-play">[ &#9654; play ]</button>
      <button class="btn" type="button" id="hl-next">[ n ]</button>
    </div>
  </div>
  <div class="hl-chain__screen">
    <div class="hl-pane hl-pane--red">
      <div class="hl-pane__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="hl-pane__t">root@kali: attacker</span></div>
      <pre id="hl-red" class="hl-pane__body" aria-live="polite"></pre>
    </div>
    <div class="hl-pane hl-pane--blue">
      <div class="hl-pane__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="hl-pane__t">analyst@security-onion: defender</span></div>
      <pre id="hl-blue" class="hl-pane__body" aria-live="polite"></pre>
    </div>
  </div>
  <div id="hl-stage" class="hl-stage" aria-live="polite"></div>
</div>
<noscript><p>The walkthrough needs JavaScript.</p></noscript>
<p><a href="homelab.html">cd ../homelab</a> <span class="muted">// the network this runs on</span></p>'''
    page("attack-chain.html", "attack chain :: 0xDay", body, cur="lab",
         head=_head(v, {"kind": "chain", "data": A}),
         desc="A scripted red-team vs blue-team walkthrough: Kali to domain controller, with the Security Onion telemetry each stage should raise.")


def _dives(page, esc, v):
    D = json.load(open("content/deepdives.json"))["dives"]
    nav = " · ".join(f'<a href="#{esc(d["slug"])}">{esc(d["title"])}</a>' for d in D)
    arts = ""
    for d in D:
        stack = "".join(f'<span class="hl-tag">{esc(s)}</span>' for s in d["stack"])
        secs = ""
        for s in d["sections"]:
            ps = "".join(f"<p>{esc(p)}</p>" for p in s["p"])
            secs += f'<h3>{esc(s["h"])}</h3>{ps}'
        links = " · ".join(f'<a href="{esc(u)}">{esc(t)}</a>' for t, u in d.get("links", []))
        arts += f'''<article class="hl-dive" id="{esc(d["slug"])}">
  <div class="hl-dive__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="hl-pane__t">less {esc(d["slug"])}.md</span></div>
  <div class="hl-dive__body">
    <h2>{esc(d["title"])}</h2>
    <p class="hl-dive__sum">{esc(d["summary"])}</p>
    <p class="hl-dive__stack">{stack}</p>
    {secs}
    <p class="hl-dive__links"><a href="{esc(d["repo"])}">repo &rarr;</a>{(" · " + links) if links else ""}</p>
  </div>
</article>'''
    body = f'''<p class="cmd">ls ~/deep-dives</p>
<h1>~/deep-dives</h1>
<p>Long-form write-ups of the two labs I keep coming back to: how they're built, why, and what they taught me. My other projects have their own <a href="posts.html">blog posts</a>.</p>
<p class="muted">jump to: {nav}</p>
{arts}
<p><a href="projects.html">cd ../projects</a></p>'''
    page("deep-dives.html", "deep-dives :: 0xDay", body, cur="projects",
         head=_head(v),
         desc="In-depth write-ups of Nathan's cybersecurity homelab and enterprise IT support lab.")


def build(page, esc):
    v = _ver()
    _map(page, esc, v)
    _chain(page, esc, v)
    _dives(page, esc, v)
