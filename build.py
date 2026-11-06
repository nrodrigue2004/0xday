#!/usr/bin/env python3
"""Builds the 0xDay static site.
Edit content/posts.json + content/posts/<slug>.html (post bodies) and content/projects.json,
then run:  python3 build.py
"""
import json, html, os, hashlib
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
NAME = "Nathan Rodrigue"; USER = "nathan"; HOST = "0xday"
GH = "https://github.com/nrodrigue2004"
LI = "https://www.linkedin.com/in/nathan-rodrigue-669795249/"
NAV = [("blog", "posts.html"), ("projects", "projects.html"), ("resources", "resources.html"), ("about", "about.html")]
POSTS = json.load(open("content/posts.json"))
PROJECTS = json.load(open("content/projects.json"))
for p in POSTS:
    p["body"] = open(f"content/posts/{p['slug']}.html").read()
esc = html.escape
V = hashlib.sha1((open("style.css").read() + open("site.js").read()).encode()).hexdigest()[:8]  # cache-buster

def short(d):
    import datetime
    return datetime.date.fromisoformat(d).strftime("%b %d").replace(" 0", " ")

def page(fn, title, body, depth=0, cur=None, desc=f"0xDay by {NAME}: notes on cybersecurity, computer science and tech."):
    p = "../" * depth
    nav = "".join(
        f'<li><a href="{p}{h}"{" aria-current=\"page\"" if l == cur else ""}>./{l}</a></li>' for l, h in NAV)
    out = f'''<!doctype html>
<html lang="en" data-root="{p}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#07090a">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%2307090a'/%3E%3Ctext x='5' y='22' font-family='monospace' font-size='16' fill='%233bff7f'%3E%3E_%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{p}style.css?v={V}">
<script src="{p}data.js?v={V}" defer></script>
<script src="{p}site.js?v={V}" defer></script>
</head>
<body>
<a class="skip" href="#main">skip to content</a>
<div class="container">
<header class="header">
  <a href="{p}index.html" class="logo" aria-label="0xDay home"><span class="logo__user">{USER}@{HOST}</span><span class="logo__sep">:</span><span class="logo__path">~</span><span class="logo__sep">$</span><span class="cursor"></span></a>
  <nav class="menu" aria-label="Main"><ul>{nav}</ul></nav>
  <button class="menu-trigger" aria-label="Menu" aria-expanded="false">[≡]</button>
</header>
<main id="main">
{body}
</main>
<footer class="footer">
  <span><span class="ok">[ exit 0 ]</span> &copy; <span class="year">2026</span> {NAME}</span>
  <span><a href="{GH}">github</a> · <a href="{LI}">linkedin</a> · <button class="link ghost-open" type="button">ghost --help</button></span>
</footer>
</div>
</body>
</html>
'''
    open(fn, "w").write(out)

def row(p, depth=0):
    r = "../" * depth
    tags = " ".join(f"#{t}" for t in p["tags"][:2])
    return (f'<li><a class="ls-row" href="{r}posts/{p["slug"]}.html">'
            f'<span class="ls-perm">-rw-r--r--</span>'
            f'<span class="ls-date">{short(p["date"])}</span>'
            f'<span class="ls-title">{esc(p["title"])}</span>'
            f'<span class="ls-tags">{tags}</span></a></li>')

# ---------- home ----------
boot = ["[  OK  ] Mounting /dev/brain ...", "[  OK  ] Starting caffeine.service", "[  OK  ] Reached target: curiosity"]
home = f'''<section class="term" aria-label="Intro">
  <div class="term__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term__title">{USER}@{HOST}: ~</span></div>
  <div class="term__body">
    <div class="boot" aria-hidden="true">{"".join(f"<div>{esc(b)}</div>" for b in boot)}</div>
    <p class="cmd">whoami</p>
    <h1 class="glitch" data-text="0xDay">0xDay</h1>
    <p class="who">{NAME} <span class="muted">// cybersecurity @ LSU</span></p>
    <p class="cmd">cat interests.txt</p>
    <p>Homelabs, malware analysis, digital forensics, and the things I break to learn how they work.</p>
    <p class="cmd">ls -lt ~/posts | head</p>
    <ul class="ls">{"".join(row(p) for p in POSTS[:6])}</ul>
    <p class="cmd typing"><span class="muted">type <kbd>help</kbd> to ghost, or press <kbd>`</kbd></span></p>
  </div>
</section>
<section class="quick">
  <a class="tile" href="projects.html"><span class="tile__k">./projects</span><span class="tile__v">{len(PROJECTS)} builds, labs &amp; challenges</span></a>
  <a class="tile" href="posts.html"><span class="tile__k">./blog</span><span class="tile__v">{len(POSTS)} writeups</span></a>
  <button class="tile ghost-open" type="button"><span class="tile__k">./ghost</span><span class="tile__v">ask my terminal assistant</span></button>
</section>'''
page("index.html", "0xDay", home)

# ---------- posts index ----------
groups = {}
for p in POSTS:
    groups.setdefault(p["date"][:4], []).append(p)
body = '<p class="cmd">ls -l ~/posts</p><h1>~/posts</h1>'
body += "".join(f'<h2 class="year"># {y}</h2><ul class="ls">{"".join(row(p) for p in ps)}</ul>' for y, ps in groups.items())
page("posts.html", "posts :: 0xDay", body, cur="blog")

# ---------- posts ----------
os.makedirs("posts", exist_ok=True)
for i, p in enumerate(POSTS):
    tags = " ".join(f'<span class="tag">#{t}</span>' for t in p["tags"])
    nxt = POSTS[i - 1] if i > 0 else None
    prv = POSTS[i + 1] if i + 1 < len(POSTS) else None
    pager = '<nav class="pager">'
    pager += f'<a href="{prv["slug"]}.html">&lt; prev: {esc(prv["title"])}</a>' if prv else '<span></span>'
    pager += f'<a href="{nxt["slug"]}.html">next: {esc(nxt["title"])} &gt;</a>' if nxt else '<span></span>'
    pager += '</nav>'
    page(f"posts/{p['slug']}.html", f"{p['title']} :: 0xDay", f'''<article class="post">
<p class="cmd">cat ~/posts/{p["slug"]}.md</p>
<h1>{esc(p["title"])}</h1>
<div class="meta"><span>{p["date"]}</span><span>{NAME}</span><span>{tags}</span></div>
<div class="prose">
{p["body"]}
</div>
{pager}
<p><a href="../posts.html">cd ..</a></p>
</article>''', depth=1, cur="blog", desc=p["title"])

# ---------- projects ----------
def card(x):
    name = esc(x["name"])
    head = f'<a href="{x["url"]}">{name}</a>' if x["url"] else name
    st = f'<span class="status status--{x["status"]}">{x["status"]}</span>'
    return (f'<article class="card"><div class="card__top"><span class="muted">./{x["slug"]}</span>{st}</div>'
            f'<h3>{head}</h3><p>{esc(x["desc"])}</p>'
            f'<p class="card__tags">{" ".join("#" + t for t in x["tags"])}</p></article>')
page("projects.html", "projects :: 0xDay",
     f'<p class="cmd">ls ~/projects</p><h1>~/projects</h1><p>Labs, challenges and software I\'ve built. Source on <a href="{GH}">GitHub</a>.</p>'
     f'<div class="cards">{"".join(card(x) for x in PROJECTS)}</div>', cur="projects")

# ---------- resources ----------
RES = [("reverse engineering & malware", [("Ghidra", "https://ghidra-sre.org/"), ("IDA Free", "https://hex-rays.com/ida-free"), ("PE-bear", "https://github.com/hasherezade/pe-bear")]),
       ("forensics", [("Autopsy", "https://www.autopsy.com/"), ("Volatility", "https://volatilityfoundation.org/"), ("Wireshark", "https://www.wireshark.org/")]),
       ("homelab", [("Proxmox VE", "https://www.proxmox.com/"), ("pfSense", "https://www.pfsense.org/"), ("Security Onion", "https://securityonionsolutions.com/"), ("Tailscale", "https://tailscale.com/")]),
       ("practice", [("PortSwigger Web Security Academy", "https://portswigger.net/web-security"), ("OverTheWire", "https://overthewire.org/wargames/"), ("picoCTF", "https://picoctf.org/"), ("CTFtime", "https://ctftime.org/")])]
body = '<p class="cmd">cat ~/bookmarks</p><h1>~/resources</h1><p>Tools and references I use in my labs and projects.</p>'
body += "".join(f'<h2>{esc(h)}</h2><ul class="arrow">{"".join(f"<li><a href=\"{u}\">{esc(n)}</a></li>" for n, u in L)}</ul>' for h, L in RES)
page("resources.html", "resources :: 0xDay", body, cur="resources")

# ---------- about ----------
ascii_logo = r"""  ___       ___
 / _ \__ __|   \ __ _ _  _
| (_) \ \ /| |) / _` | || |
 \___//_\_\|___/\__,_|\_, |
                      |__/ """
facts = [("user", NAME), ("school", "Louisiana State University"), ("major", "B.S. Computer Science, Cybersecurity"),
         ("focus", "malware analysis, forensics, homelabs"),
         ("security", "IDA Pro, Ghidra, Wireshark, Autopsy, FTK Imager, Volatility, Kali, Nmap, Metasploit, Security Onion"),
         ("infra", "Proxmox, VMware, VirtualBox, pfSense, Windows Server, Linux"),
         ("langs", "Python, Java, C, TypeScript, JavaScript, Assembly, SQL")]
neo = "".join(f'<div><span class="k">{k}</span><span class="v">{esc(v)}</span></div>' for k, v in facts)
page("about.html", "about :: 0xDay", f'''<p class="cmd">neofetch</p>
<h1 class="sr-only">About</h1>
<div class="neofetch"><pre class="neofetch__logo" aria-hidden="true">{esc(ascii_logo)}</pre><div class="neofetch__info"><div class="neofetch__head">{USER}@{HOST}</div>{neo}
<div class="swatches" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>
<p class="cmd">cat about.txt</p>
<div class="prose">
<p>I'm Nathan, a Computer Science student at LSU concentrating in cybersecurity. My coursework covers reverse engineering and malware analysis, digital forensics, mobile security and applied cryptography, and software vulnerabilities and exploitation.</p>
<p>Outside class I run a Proxmox homelab that simulates a small enterprise network. That's where most of the writeups on 0xDay come from.</p>
<h2>work</h2>
<ul><li><strong>Laptop Technician</strong>: secure data sanitization, hardware and software repair, and Windows deployment for refurbished laptops.</li>
<li><strong>AI Trainer</strong>: evaluating and refining LLM output.</li></ul>
<h2>elsewhere</h2>
<ul class="arrow"><li><a href="{GH}">github.com/nrodrigue2004</a></li><li><a href="{LI}">linkedin</a></li></ul>
</div>''', cur="about")

# ---------- data for the ghost assistant ----------
data = {"name": NAME, "gh": GH, "li": LI,
        "posts": [{k: p[k] for k in ("slug", "title", "date", "tags")} for p in POSTS],
        "projects": PROJECTS,
        "skills": {k: v for k, v in facts if k in ("security", "infra", "langs")}}
open("data.js", "w").write("window.OXDAY=" + json.dumps(data) + ";\n")
print("built", len(POSTS), "posts,", len(PROJECTS), "projects")
