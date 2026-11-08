"""~/dist: distributed systems (course CS320). Called from build.py as build_dist.build(page, esc).

Chapters live in content/dist/<slug>.txt and use the ~/learn guide format (simple / mid / complex tiers, optional lab).
dist/cluster.html is a simulated 3-node cluster (behaviour in cluster.js, styles in dist.css). Standard library only.
"""
import os, hashlib
import build_learn as L

CHAPTERS = [
    ("dist-fundamentals", "fundamentals", "Partial failure, unreliable networks, clocks, timeouts, retries, and the impossibility results"),
    ("dist-replication", "replication", "Leaders, quorums, consistency levels, CAP and PACELC. Lab: find the write a merge threw away"),
    ("dist-consensus", "consensus", "Majorities, Raft elections and log replication, split brain. Lab: find the write that was never committed"),
    ("dist-queues", "queues and streams", "Delivery guarantees, idempotent consumers, dead letters. Lab: find the double charge"),
]


def build(page, esc):
    os.makedirs("dist", exist_ok=True)
    chs = []
    for slug, name, blurb in CHAPTERS:
        chs.append((slug, name, blurb, L.parse_guide(open(f"content/dist/{slug}.txt").read())))
    howmap = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it.")}
    for i, (slug, name, blurb, g) in enumerate(chs):
        lab = L.lab_json(g, slug, name)
        tiers = [t for t in L.TIERS[:3] if t[0] in g["tiers"]] + ([L.TIERS[3]] if lab else [])
        nav = "".join(f'<a href="#tier-{n}" class="tier" data-tier="{key}"><span class="tier__n">{n}</span>{lbl}</a>' for key, n, lbl, _ in tiers)
        secs = ""
        for key, n, lbl, sub in L.TIERS[:3]:
            if key in g["tiers"]:
                secs += (f'<section class="lvl" id="tier-{n}" data-tier="{key}"><h2><span class="lvl__n">0{n}</span> {lbl} <span class="muted">// {sub}</span></h2>'
                         f'{L.md(g["tiers"][key])}<p><button class="btn got" type="button" data-tier="{key}">[ ] got it</button></p></section>')
        if lab:
            how = howmap[g["lab"].get("style", "shell")]
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {how[0]}</span></h2>'
                     f'{L.md(g["lab"]["brief"])}<p class="muted">{how[1]}</p></section>')
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = ('<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>")
                 + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else '<a href="cluster.html">cluster simulator &gt;</a>') + "</nav>")
        body = f'''<p class="cmd">dist --chapter {slug}</p>
<h1>~/dist/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../dist.html">cd ~/dist</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"dist/{slug}.html", f"{name} :: ~/dist :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",),
             desc=f"Distributed systems, {name}: {blurb}.")

    # ---------- cluster simulator ----------
    v = hashlib.sha1((open("cluster.js").read() + open("dist.css").read()).encode()).hexdigest()[:8]
    sim = '''<p class="cmd">./cluster --nodes 3</p><h1>~/dist/cluster <span class="muted">simulated</span></h1>
<p>Three nodes run a small Raft-style cluster, or an AP store, inside your browser. Nothing here touches a network: it is a toy with a fake clock, built to <strong>show</strong> what the chapters describe. Try the experiments below the controls.</p>
<noscript><p class="callout">The simulator needs JavaScript.</p></noscript>
<div id="cl" class="cl3">
<div class="cl3__bar">
  <label>mode <select id="cl-mode"><option value="cp">CP: Raft-style, majority commits</option><option value="ap">AP: write anywhere, last write wins</option></select></label>
  <label>speed <input id="cl-speed" type="range" min="1" max="10" value="4"></label>
  <button class="btn" id="cl-pause" type="button">[ pause ]</button>
  <button class="btn" id="cl-step" type="button">[ step ]</button>
  <button class="btn" id="cl-heal" type="button">[ heal all ]</button>
  <button class="btn" id="cl-reset" type="button">[ reset ]</button>
  <span class="muted small" id="cl-tick"></span>
</div>
<div class="cl3__nodes" id="cl-nodes"></div>
<form class="cl3__cmd" id="cl-form"><label>client: <select id="cl-target"><option value="0">n1</option><option value="1">n2</option><option value="2">n3</option></select></label>
  <input id="cl-key" value="x" size="4" aria-label="key"> = <input id="cl-val" value="1" size="4" aria-label="value">
  <button class="btn" type="submit">[ write ]</button> <button class="btn" type="button" id="cl-read">[ read key ]</button></form>
<h2># event log</h2>
<pre class="cl3__log" id="cl-log" aria-live="polite"></pre>
</div>
<h2># experiments</h2>
<ol>
<li><strong>Crash the leader.</strong> In CP mode, press <em>kill</em> on the leader. Watch a follower time out, raise its term and win with 2 of 3 votes. Revive the old leader: it comes back as a follower.</li>
<li><strong>Lose the majority.</strong> Kill two nodes, then write to the survivor. It cannot commit (1 of 3), so the entry stays dashed. This is the cluster choosing consistency over availability. Revive one node and the write commits.</li>
<li><strong>Split brain, avoided.</strong> Press <em>isolate</em> on the leader, then write to it. The other two elect a new leader and take writes. Heal: the old leader's uncommitted entry is <strong>discarded</strong>. This is the same story as the consensus lab.</li>
<li><strong>Stale read.</strong> In AP mode isolate n3, write <code>x=1</code> to n1, then read <code>x</code> from n3. It answers (available) with an old or missing value (not consistent).</li>
<li><strong>Last write wins.</strong> In AP mode isolate n3 and write <code>x=A</code> on n1 and <code>x=B</code> on n3, then heal. One value survives and the other write is silently lost. Compare with the replication lab.</li>
</ol>
<p class="muted small">Simplifications: ticks instead of milliseconds, no disk, no cluster changes, a global clock for last-write-wins (real clocks drift, which makes LWW worse). The Raft rules for terms, votes, log matching and majority commit are followed. Read the real thing: <a href="https://raft.github.io/" rel="noopener">raft.github.io</a>.</p>
<nav class="pager"><a href="dist-queues.html">&lt; queues and streams</a><span></span></nav>
<p><a href="../dist.html">cd ~/dist</a></p>'''
    page("dist/cluster.html", "cluster simulator :: ~/dist :: 0xDay", sim, depth=1, cur="learn",
         head=f'\n<link rel="stylesheet" href="../dist.css?v={v}">\n<script src="../cluster.js?v={v}" defer></script>',
         desc="Simulated 3-node cluster: Raft-style leader election and log replication, partitions, and an AP mode with last-write-wins.")

    # ---------- hub ----------
    rows = "".join(
        f'<li class="guiderow" data-skill="{s}"><a class="ls-row" href="dist/{s}.html"><span class="ls-perm gprog">[----]</span>'
        f'<span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{"shell" if g["lab"].get("brief") else "read"}</span></a></li>'
        for s, n, b, g in chs)
    page("dist.html", "dist :: 0xDay", f'''<p class="cmd">ls ~/dist</p><h1>~/dist</h1>
<p>Distributed systems: what changes when your program runs on several machines that can fail separately. Replication, consensus, CAP, queues and streams, each at three depths with a lab, plus a simulated 3-node cluster to break on purpose. This is course <a href="courses/CS320.html">CS320</a>, with quizzes and an exam.</p>
<div class="hub"><a class="tile" href="dist/cluster.html"><span class="tile__k">./cluster</span><span class="tile__v">kill nodes, split the network</span><span class="tile__n">simulator</span></a>
<a class="tile" href="courses/CS320.html"><span class="tile__k">./CS320</span><span class="tile__v">course, quizzes, exam</span><span class="tile__n">~/courses</span></a></div>
<h2># chapters</h2><ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = simple, mid, complex read + lab solved (if any). Saved in your browser. Written in my own words; verify specifics against the papers and docs linked in the chapters.</p>''',
         cur="learn", scripts=("learn.js",), desc="Distributed systems: replication, consensus, CAP, queues, with labs and a simulated cluster.")
    return chs
