"""~/drills: focused hands-on labs (packets, permissions, regex, log parsing). Called from build.py. Standard library only.

Drills live in content/drills/<slug>.txt and use the same format as the ~/learn guides
(simple / mid / complex tiers plus one hands-on lab), see build_learn.py. All data is fictional.
Order and blurbs are in CHAPTERS below.
"""
import json, os, html
import build_learn as L

esc = html.escape
CHAPTERS = [
    ("read-a-packet-capture", "read a packet capture", "Text captures line by line: handshakes, scans, uploads. Lab: find who got the data"),
    ("linux-permissions", "Linux permissions", "ls -l, chmod, SUID, cron. Lab: the writable file root runs"),
    ("windows-permissions", "Windows permissions", "NTFS, shares, inheritance, nested groups. Lab ticket: why can the intern see Payroll"),
    ("regex-for-logs", "regex for logs", "Patterns from zero, encodings and false hits. Lab: count path traversal attempts"),
    ("parse-logs-with-pipes", "parse logs with pipes", "Narrow, extract, count on key=value logs. Lab: the one outside admin login"),
]


def load():
    out = []
    for slug, name, blurb in CHAPTERS:
        g = L.parse_guide(open(f"content/drills/{slug}.txt").read())
        out.append((slug, name, blurb, g))
    return out


def build(page):
    os.makedirs("drills", exist_ok=True)
    chs = load()
    howmap = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it."),
              "ticket": ("ticket queue", "This one is a ticket in the queue. Open the attachments, investigate in the console under the ticket, then resolve it with your answer. Hints cost 15 points, wrong answers 5.")}
    for i, (slug, name, blurb, g) in enumerate(chs):
        sid = slug
        lab = L.lab_json(g, sid, name)
        tiers = [t for t in L.TIERS[:3] if t[0] in g["tiers"]] + ([L.TIERS[3]] if lab else [])
        nav = "".join(f'<a href="#tier-{n}" class="tier" data-tier="{key}"><span class="tier__n">{n}</span>{lbl}</a>' for key, n, lbl, _ in tiers)
        secs = ""
        for key, n, lbl, sub in L.TIERS[:3]:
            if key in g["tiers"]:
                secs += (f'<section class="lvl" id="tier-{n}" data-tier="{key}"><h2><span class="lvl__n">0{n}</span> {lbl} <span class="muted">// {sub}</span></h2>'
                         f'{L.md(g["tiers"][key])}<p><button class="btn got" type="button" data-tier="{key}">[ ] got it</button></p></section>')
        if lab:
            style = g["lab"].get("style", "shell"); how = howmap[style]
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {how[0]}</span></h2>'
                     f'{L.md(g["lab"]["brief"])}<p class="muted">{how[1]}</p></section>')
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">drill {slug}</p>
<h1>~/drills/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{sid}">
<div class="learn__doc">{secs}{pager}<p><a href="../drills.html">cd ~/drills</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"drills/{slug}.html", f"{name} :: ~/drills :: 0xDay", body, depth=1, cur="lab", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",),
             desc=f"Hands-on drill, {name}: {blurb}.")

    # ---------- hub ----------
    rows = "".join(
        f'<li class="guiderow" data-skill="{s}"><a class="ls-row" href="drills/{s}.html"><span class="ls-perm gprog">[----]</span>'
        f'<span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "shell")}</span></a></li>'
        for s, n, b, g in chs)
    page("drills.html", "drills :: 0xDay", f'''<p class="cmd">ls ~/drills</p><h1>~/drills</h1>
<p>Short, focused practice: each drill teaches one skill at three depths (<strong>simple, mid, complex</strong>) and ends with a hands-on lab on realistic but <strong>made-up</strong> data. Addresses come from the documentation ranges, domains end in <code>.example</code>, and nothing here touches a real system.</p>
<h2># drills</h2><ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = simple, mid, complex read + lab solved. Saved in your browser. Need command syntax? Try the <a href="man.html">cheatsheets</a> or the <a href="glossary.html">glossary</a>.</p>''',
         cur="lab", scripts=("learn.js",), desc="Hands-on drills: read packet captures, audit permissions, write regex, parse logs.")
    return chs
