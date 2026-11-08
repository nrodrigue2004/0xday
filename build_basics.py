"""~/basics: foundational topics (networking, OSINT, CIA/crypto, OS basics). Called from build.py. Standard library only.

Chapters live in content/basics/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
Order and blurbs are in CHAPTERS below.
"""
import os, html
import build_learn as L

esc = html.escape
CHAPTERS = [
    ("osi-and-tcpip", "OSI and TCP/IP", "The seven layers, the four-layer model, encapsulation, and what attacks live where"),
    ("ports-and-protocols", "ports and protocols", "The ports and protocols you are expected to know cold, with DNS and DHCP in depth"),
    ("osint", "OSINT", "Open-source intelligence: methods, tools, and the legal and ethical limits. Lab: profile a fictional company"),
    ("cia-and-crypto", "CIA and crypto basics", "Confidentiality, integrity, availability, hashing, symmetric, asymmetric, TLS"),
    ("linux-windows-basics", "Linux and Windows basics", "File systems, permissions, processes, services, logs and the commands for each"),
    ("http-and-the-web", "HTTP and the web", "Requests, responses, methods, status codes, headers, cookies and sessions. Lab: find the weak session cookie in a captured login"),
    ("apis-rest-json", "APIs, REST and JSON", "How apps talk to servers, how tokens work, and the authorization bug that shows up everywhere. Lab: spot the IDOR in an API log"),
    ("how-web-apps-work", "how web apps work", "One click from DNS to database and back, plus the browser dev tools. Lab: trace a broken login to the failing backend"),
    ("relational-databases", "relational databases", "Tables, keys, joins, indexes, transactions and how the app and database stay safe. Lab: find the orphaned order"),
    ("web-attack-classes", "web attack classes", "Injection, XSS, CSRF, access control, SSRF at concept level, with defenses and detection. Lab: find the injection that worked in a web log"),
]
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it."),
          "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer.")}


def build(page):
    os.makedirs("basics", exist_ok=True)
    chs = [(s, n, b, L.parse_guide(open(f"content/basics/{s}.txt").read())) for s, n, b in CHAPTERS]
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
            how = HOWMAP[g["lab"].get("style", "shell")]
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {how[0]}</span></h2>'
                     f'{L.md(g["lab"]["brief"])}<p class="muted">{how[1]}</p></section>')
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">basics --chapter {slug}</p>
<h1>~/basics/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../basics.html">cd ~/basics</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"basics/{slug}.html", f"{name} :: ~/basics :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"Fundamentals, {name}: {blurb}.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="{s}"><a class="ls-row" href="basics/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{"lab" if g["lab"].get("brief") else "read"}</span></a></li>'''
        for s, n, b, g in chs)
    page("basics.html", "basics :: 0xDay", f'''<p class="cmd">ls ~/basics</p><h1>~/basics</h1>
<p>The foundations everything else sits on. Each chapter goes <strong>simple, mid, complex</strong>, and commands live in the chapter, not just the theory.</p>
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read (plus lab solved, if any). Saved in your browser.</p>''',
         cur="learn", scripts=("learn.js",), desc="Fundamentals: OSI and TCP/IP, ports and protocols, OSINT, CIA and crypto, Linux and Windows basics, HTTP, APIs, web apps, databases and web attack classes.")
    return chs
