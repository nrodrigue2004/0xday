#!/usr/bin/env python3
"""Builds the 0xDay static site.
Edit content/posts.json + content/posts/<slug>.html (post bodies) and content/projects.json,
then run:  python3 build.py
"""
import json, html, os, hashlib, base64, datetime, re
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
NAME = "Nathan"; FULL_NAME = "Nathan Rodrigue"  # last name only on the resume
USER = "nathan"; HOST = "0xday"
GH = "https://github.com/nrodrigue2004"
LI = "https://www.linkedin.com/in/nathan-rodrigue-669795249/"
NAV = [("blog", "posts.html"), ("projects", "projects.html"), ("skills", "skills.html"), ("certs", "certs.html"), ("learn", "learn.html"), ("lab", "lab.html"), ("now", "now.html"), ("about", "about.html")]
SITE = "https://nrodrigue2004.github.io/0xday/"
POSTS = json.load(open("content/posts.json"))
PROJECTS = json.load(open("content/projects.json"))
CERTS = json.load(open("content/certs.json"))
SKILLS = json.load(open("content/skills.json"))
NOW = json.load(open("content/now.json"))
CHANGELOG = json.load(open("content/changelog.json"))
# hidden site CTF: only hashes ship in data.js; each flag is hidden somewhere on the site
FLAGS = {"source": "0xDAY{v13w_s0urc3_4lw4ys}", "console": "0xDAY{c0ns0l3_c0wb0y}", "robots": "0xDAY{r0b0ts_t3ll_s3cr3ts}"}
for p in POSTS:
    p["body"] = open(f"content/posts/{p['slug']}.html").read()
esc = html.escape
V = hashlib.sha1("".join(open(f).read() for f in ("style.css", "site.js", "fx.js", "tty.js", "htop.js", "desktop.js", "sandbox.js", "learn.js", "study.js", "resume.js")).encode()).hexdigest()[:8]  # cache-buster

def short(d):
    import datetime
    return datetime.date.fromisoformat(d).strftime("%b %d").replace(" 0", " ")

BOOT_JS = ("(function(){var d=document.documentElement,s={},b='1';"
           "try{s=JSON.parse(localStorage.getItem('oxday-set')||'{}');b=localStorage.getItem('oxday-booted')}catch(e){}"
           "if(/[?&]embed=1/.test(location.search))d.classList.add('embed');"
           "if(s.crt)d.classList.add('crt');"
           "if(!b&&s.boot!==false&&!d.classList.contains('embed')&&!d.classList.contains('tty-page')"
           "&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!/bot|crawl|spider|lighthouse/i.test(navigator.userAgent))d.classList.add('booting')})();")

def page(fn, title, body, depth=0, cur=None, desc=f"0xDay by {NAME}: notes on cybersecurity, computer science and tech.", root=None, head="", htmlcls="", scripts=()):
    p = root if root is not None else "../" * depth
    nav = "".join(
        f'<li><a href="{p}{h}"{" aria-current=\"page\"" if l == cur else ""}>./{l}</a></li>' for l, h in NAV)
    out = f'''<!doctype html>
<html lang="en" data-root="{p}"{f' class="{htmlcls}"' if htmlcls else ""}>
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
<link rel="alternate" type="application/rss+xml" title="0xDay" href="{SITE}feed.xml">{head}
<script src="{p}data.js?v={V}" defer></script>
<script src="{p}site.js?v={V}" defer></script>
<script src="{p}fx.js?v={V}" defer></script>{"".join(f'\n<script src="{p}{x}?v={V}" defer></script>' for x in scripts)}
<script>{BOOT_JS}</script>
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
  <span class="footer__links"><a href="{p}tags.html">tags</a> <a href="{p}resources.html">resources</a> <a href="{p}changelog.html">changelog</a> <a href="{p}feed.xml">rss</a> <a href="{GH}">github</a> <a href="{LI}">linkedin</a> <button class="link ghost-open" type="button">ghost --help</button></span>
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
boot = ["[  OK  ] Mounted /home/nathan", "[  OK  ] Started ghost.service", "[  OK  ] Reached target: homelab.target"]
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
home = f"<!-- psst. not everything on 0xDay is on the screen: {base64.b64encode(FLAGS['source'].encode()).decode()} -->\n" + home
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
    tags = " ".join(f'<a class="tag" href="../tags.html#{t}">#{t}</a>' for t in p["tags"])
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
     f'<p class="cmd">ls ~/projects</p><h1>~/projects</h1><p>Labs, challenges and software I\'ve built. Source on <a href="{GH}">GitHub</a>. The two labs get full <a href="deep-dives.html">deep-dives</a>, and what\'s next lives in <a href="roadmap.html">~/roadmap</a>.</p>'
     f'<div class="cards">{"".join(card(x) for x in PROJECTS)}</div>', cur="projects")

import build_roadmap
ROADMAP = build_roadmap.build(page, esc)

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


def bar(pct, width=20):
    n = round(pct / 100 * width)
    return f'<span class="bar" aria-label="{pct}%"><span class="bar__on">{"#" * n}</span><span class="bar__off">{"-" * (width - n)}</span></span>'

# ---------- certs ----------
cert_rows = "".join(
    f'<li class="pkg"><span class="pkg__st pkg__st--{c["status"]}">[{c["status"]}]</span>'
    f'<span class="pkg__name">{esc(c["id"])}</span><span class="muted">{esc(c["code"])}</span>'
    f'{bar(c["progress"], 12)}<span class="muted">target: {esc(c["target"] or "TBD")}</span></li>' for c in CERTS["certs"])
sp = CERTS["secplus"]
overall = round(sum(d["weight"] * d["progress"] for d in sp["domains"]) / 100)
dom_rows = "".join(
    f'<li class="dom"><span class="dom__n">{d["n"]}.0</span><span class="dom__name">{esc(d["name"])}</span>'
    f'<span class="muted dom__w">{d["weight"]}%</span>{bar(d["progress"])}<span class="dom__pct">{d["progress"]}%</span></li>' for d in sp["domains"])
if sp["practice"]:
    W, H, pad = 640, 200, 30
    pts = sp["practice"]; bw = (W - pad * 2) / len(pts)
    y = lambda v: H - pad - (v - 100) / 800 * (H - pad * 2)
    bars_svg = "".join(
        f'<rect x="{pad + i * bw + 4:.1f}" y="{y(p["score"]):.1f}" width="{bw - 8:.1f}" height="{H - pad - y(p["score"]):.1f}" '
        f'class="{"pass" if p["score"] >= 750 else "fail"}"><title>{esc(p["date"])}: {p["score"]} ({esc(p.get("source", ""))})</title></rect>'
        for i, p in enumerate(pts))
    chart = (f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Practice exam scores">'
             f'<line x1="{pad}" x2="{W - pad}" y1="{y(750):.1f}" y2="{y(750):.1f}" class="passline"/>'
             f'<text x="{W - pad}" y="{y(750) - 6:.1f}" text-anchor="end" class="passlabel">pass 750</text>{bars_svg}</svg>')
else:
    chart = '<p class="muted">No practice exams logged yet.</p>'
log = "".join(f'<li><span class="ls-date">{esc(e["date"])}</span> {esc(e["msg"])}</li>' for e in sp["log"]) or '<li class="muted">nothing logged yet</li>'
thm = CERTS.get("thm_username")
thm_html = (f'<p><a href="https://tryhackme.com/p/{esc(thm)}">tryhackme.com/p/{esc(thm)}</a> · <a href="ctf.html">see my rooms in ~/ctf</a></p>'
            if thm else '<p class="muted">TryHackMe profile coming soon.</p>')
page("certs.html", "certs :: 0xDay", f"""<p class="cmd">apt list --installed | grep cert</p><h1>~/certs</h1>
<p>Certifications I have, am working on, or plan to take.</p>
<ul class="pkgs">{cert_rows}</ul>
<h2>security+ tracker</h2>
<p class="cmd">./progress --exam SY0-701</p>
<p>Studying with my own system: <a href="secplus.html">~/secplus</a> (objectives, notes, flashcards, labs).</p>
<p>Overall, weighted by exam domain: <strong class="ok">{overall}%</strong></p>
<ul class="doms">{dom_rows}</ul>
<h3>practice exams</h3>{chart}
<h3>study log</h3><ul class="arrow">{log}</ul>
<h2>tryhackme</h2>{thm_html}""", cur="certs")

# ---------- skills ----------
LV = {1: "aware", 2: "familiar", 3: "working", 4: "strong", 5: "expert"}
import build_learn
def learnlink(k):
    s = build_learn.slug(k["name"])
    return f' <a href="learn/{s}.html">learn</a>' if os.path.exists(f"content/guides/{s}.txt") else ""
def proof(u):
    return f'<a href="{u}">proof</a>' if u else '<span class="muted">soon</span>'
groups_html = "".join(
    f'<h2>{esc(g["name"])}</h2><ul class="skills">' + "".join(
        f'<li><span class="sk__name">{esc(k["name"])}</span><span class="sk__lv" aria-label="level {k["level"]} of 5">'
        f'<span class="bar__on">{"■" * k["level"]}</span><span class="bar__off">{"□" * (5 - k["level"])}</span></span>'
        f'<span class="muted sk__label">{LV[k["level"]]}</span><span class="sk__proof">{proof(k["proof"])}{learnlink(k)}</span></li>'
        for k in g["skills"]) + "</ul>" for g in SKILLS["groups"])
page("skills.html", "skills :: 0xDay", f"""<p class="cmd">skills --matrix</p><h1>~/skills</h1>
<p>Self-rated, and every rating links to the work behind it. Each <strong>learn</strong> link opens a guide (simple, mid, complex) with a hands-on sandbox lab. <span class="muted">1 aware · 2 familiar · 3 working · 4 strong · 5 expert</span></p>
{groups_html}""", cur="skills")
GUIDES, SP, NCARDS = build_learn.build(page, SKILLS, LV, bar)

# ---------- now ----------
def nl(xs): return "".join(f"<li>{esc(x)}</li>" for x in xs)
page("now.html", "now :: 0xDay", f"""<p class="cmd">cat ~/now</p><h1>~/now</h1>
<p class="muted">What I'm focused on right now. Last updated {esc(NOW["updated"])}.</p>
<div class="prose">{"".join(f"<h2>{k}</h2><ul>{nl(NOW[k])}</ul>" for k in ("studying", "building", "reading") if NOW.get(k))}</div>""", cur="now")

# ---------- tags ----------
TAGS = {}
for p in POSTS:
    for t in p["tags"]:
        TAGS.setdefault(t, []).append(p)
cloud = " ".join(f'<a class="tagchip" href="#{t}">#{t} <span class="muted">{len(v)}</span></a>' for t, v in sorted(TAGS.items()))
sections = "".join(f'<section id="{t}" class="tagsec"><h2 class="year"># {t}</h2><ul class="ls">{"".join(row(p) for p in v)}</ul></section>' for t, v in sorted(TAGS.items()))
page("tags.html", "tags :: 0xDay", f'<p class="cmd">grep -r "#" ~/posts</p><h1>~/tags</h1><p class="tagcloud">{cloud}</p>{sections}')

# ---------- changelog ----------
def fake_sha(e): return hashlib.sha1((e["date"] + e["msg"]).encode()).hexdigest()
HEAD = ' <span class="head">(HEAD -&gt; main)</span>'
cl = "".join(f'<li class="commit"><div><span class="sha">commit {fake_sha(e)}</span>{HEAD if i == 0 else ""}</div>'
             f'<div class="muted">Date:   {esc(e["date"])}</div><div class="msg"><span class="ctype">{esc(e["type"])}:</span> {esc(e["msg"])}</div></li>'
             for i, e in enumerate(CHANGELOG))
page("changelog.html", "changelog :: 0xDay", f'<p class="cmd">git log</p><h1>~/changelog</h1><ul class="commits">{cl}</ul>')

# ---------- 404 (GitHub Pages serves this for any missing path, so asset paths are absolute) ----------
page("404.html", "kernel panic :: 0xDay", """<div class="panic">
<pre>[    0.000000] Kernel panic - not syncing: VFS: Unable to mount page on unknown-block(4,0,4)
[    0.000001] CPU: 0 PID: 404 Comm: you Not tainted 6.6.6-ghost
[    0.000002] Call Trace:
[    0.000003]  &lt;TASK&gt;
[    0.000004]  find_page+0x404/0x404
[    0.000005]  follow_broken_link+0x13/0x37
[    0.000006]  ? typo_in_url+0x0/0x1
[    0.000007]  &lt;/TASK&gt;
[    0.000008] ---[ end Kernel panic - not syncing: 404 Not Found ]---</pre>
<p>The page you were looking for doesn't exist (or never did).</p>
<p><a href="/0xday/index.html">reboot</a> &nbsp; <button class="link ghost-open" type="button">ask ghost</button></p>
</div>""", root="/0xday/", head='\n<meta name="robots" content="noindex">')

# ---------- flag 3: robots.txt points at a "hidden" page ----------
open("robots.txt", "w").write("User-agent: *\nAllow: /\nDisallow: /0xday/s3cr3t/\n# not for crawlers.\n")
os.makedirs("s3cr3t", exist_ok=True)
page("s3cr3t/index.html", "s3cr3t :: 0xDay", f"""<p class="cmd">cat /s3cr3t/flag.txt</p><h1>you found it</h1>
<p>robots.txt lists the places people don't want crawled, which makes it a list of places worth looking.</p>
<pre><code>{FLAGS["robots"]}</code></pre>
<p>Submit it to ghost: <code>submit &lt;flag&gt;</code></p>""", depth=1, head='\n<meta name="robots" content="noindex">')

# ---------- RSS ----------
def rfc822(d): return datetime.datetime.fromisoformat(d).strftime("%a, %d %b %Y 12:00:00 +0000")
def item(p):
    cats = "".join(f"<category>{esc(t)}</category>" for t in p["tags"])
    u = f'{SITE}posts/{p["slug"]}.html'
    return (f'\n  <item><title>{esc(p["title"])}</title><link>{u}</link><guid>{u}</guid>'
            f'<pubDate>{rfc822(p["date"])}</pubDate>{cats}<description>{esc(p["body"])}</description></item>')
open("feed.xml", "w").write(f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
  <title>0xDay</title><link>{SITE}</link><description>Notes on cybersecurity, computer science and tech by {NAME}.</description><language>en</language>
  <atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml"/>{"".join(item(p) for p in POSTS)}
</channel></rss>
""")


# ================= phase 2 =================
RESUME = json.load(open("content/resume.json"))
_ctf = json.load(open("content/ctf.json")); CTF = _ctf["rooms"]; CTFSTATS = _ctf.get("stats")
TOOLS = json.load(open("content/tools.json"))["tools"]
DETS = json.load(open("content/detections.json"))["rules"]
BOOKS = json.load(open("content/books.json"))["books"]
SHEETS = json.load(open("content/cheatsheets.json"))

def empty(what, file, example):
    # public pages show a short placeholder; the entry format lives in README.md
    return f'<div class="empty"><p class="muted">// {what}. check back soon.</p></div>'

def href(u):
    if not u: return None
    return u if u.startswith("http") else (f"posts/{u}.html" if "/" not in u and not u.endswith(".html") else u)

# ---------- resume ----------
# One view per role (content/resume.json "roles"); buttons switch views, #it / #cyber / #dev deep-link.
r = RESUME
def rs_items(items, key="name", when=False):
    out = ""
    for e in items:
        w = f'<span class="muted">{esc(e["when"])}</span>' if when and e.get("when") else ""
        lis = "".join(f"<li>{esc(b)}</li>" for b in e["bullets"])
        out += f'<div class="rs-item"><div class="rs-head"><strong>{esc(e[key])}</strong>{w}</div><ul>{lis}</ul></div>'
    return out
edu = "".join(f'<div class="rs-item"><div class="rs-head"><strong>{esc(e["school"])}</strong></div><div>{esc(e["degree"])}</div><div class="muted">{esc(e["detail"])}</div></div>' for e in r["education"])
base_prj = {p["name"]: p for p in r["projects"]}
def rs_view(role):
    prjs = [{"name": p["name"], "bullets": p.get("bullets") or base_prj[p["name"]]["bullets"]} for p in role["projects"]] if role.get("projects") else r["projects"]
    skills = role.get("skills") or r["skills"]
    secs = {"education": f"<h2>education</h2>{edu}",
            "experience": f"<h2>experience</h2>{rs_items(r['experience'], 'title', when=True)}",
            "projects": f"<h2>projects</h2>{rs_items(prjs)}",
            "skills": '<h2>skills</h2><div class="rs-skills">' + "".join(f'<div><span class="k">{esc(k)}</span> {esc(v)}</div>' for k, v in skills.items()) + "</div>"}
    order = role.get("order") or ["education", "experience", "projects", "skills"]
    hid = "" if role["key"] == "all" else " hidden"
    return (f'<section class="rs-view" id="rs-{role["key"]}" data-role="{role["key"]}"{hid}>'
            f'<p class="rs-headline">{esc(role.get("headline") or r["headline"])}</p>{"".join(secs[k] for k in order)}</section>')
roles = r["roles"]
rbtns = "".join(f'<a class="rs-role" href="#{x["key"]}" data-role="{x["key"]}" data-hint="{esc(x["hint"])}"'
                f'{" aria-current=\"true\"" if x["key"] == "all" else ""}>[ {esc(x["label"])} ]</a>' for x in roles)
page("resume.html", "resume :: 0xDay", f'''<p class="cmd no-print">cat ~/resume.txt --role <span class="rs-cur">all</span></p>
<div class="rs-roles no-print" role="group" aria-label="Pick a role to tailor this resume">
<span class="muted">// recruiters: pick the role you're hiring for</span>
<div class="rs-role-btns">{rbtns}</div>
<p class="rs-hint muted" aria-live="polite">&gt; {esc(roles[0]["hint"])}</p>
</div>
<div class="resume">
<div class="rs-top"><h1>{FULL_NAME}</h1><button class="btn no-print" type="button" onclick="window.print()">[ print / save as PDF ]</button></div>
<p class="rs-links"><a href="{GH}">github.com/nrodrigue2004</a> · <a href="{LI}">linkedin</a> · <a href="{SITE}">{SITE.replace("https://", "")}</a></p>
{"".join(rs_view(x) for x in roles)}
</div>''', desc=f"Resume of {FULL_NAME}: IT, cybersecurity and software / data versions.", scripts=("resume.js",))

# ---------- ctf log ----------
def wl(c):
    return f'<a href="{href(c["writeup"])}">writeup</a>' if c.get("writeup") else ""
if CTF:
    cats = {}
    for c in CTF: cats[c.get("category", "other")] = cats.get(c.get("category", "other"), 0) + 1
    top = max(cats.values())
    catbars = "".join(f'<li><span class="cat__name">{esc(k)}</span>{bar(round(v / top * 100), 16)}<span class="muted">{v}</span></li>'
                      for k, v in sorted(cats.items(), key=lambda kv: -kv[1]))
    rows = "".join(
        f'<li class="ctf"><span class="ls-date">{len(CTF) - i:02d}</span><a class="ctf__name" href="{esc(c["url"])}">{esc(c["name"])}</a>'
        f'<span class="diff diff--{esc(c.get("difficulty", "easy"))}">{esc(c.get("difficulty", ""))}</span>'
        f'<span class="muted">{esc(c.get("category", ""))}</span>'
        f'<span>{wl(c)}</span></li>' for i, c in enumerate(CTF))
    st = CTFSTATS or {}
    stats = "".join(f'<div class="stat"><span class="stat__v">{esc(str(v))}</span><span class="stat__k">{k}</span></div>'
                    for k, v in [("rooms", st.get("rooms", len(CTF))), ("rank", st.get("rank", "-")), ("level", st.get("level", "-")), ("points", st.get("points", "-")), ("badges", st.get("badges", "-"))])
    asof = f'<p class="muted small">stats as of {esc(st["as_of"])}.</p>' if st.get("as_of") else ""
    badge = ""
    ctf_body = (f'<div class="stats">{stats}</div>{asof}{badge}'
                f'<h2>by category</h2><ul class="cats">{catbars}</ul>'
                f'<h2>rooms</h2><ul class="ctfs">{rows}</ul>')
else:
    ctf_body = empty("no rooms logged yet", "", "")
thm_profile = (f'<p><a href="https://tryhackme.com/p/{esc(CERTS["thm_username"])}">tryhackme.com/p/{esc(CERTS["thm_username"])}</a></p>' if CERTS.get("thm_username") else "")
page("ctf.html", "ctf :: 0xDay", f'<p class="cmd">cat ~/ctf/scoreboard</p><h1>~/ctf</h1><p>TryHackMe rooms and challenges I\'ve solved.</p>{thm_profile}{ctf_body}')

# ---------- tools ----------
def src(t):
    return f' · <a href="{t["repo"]}">source</a>' if t.get("repo") else ""
if TOOLS:
    tl = "".join(f'<article class="tool"><h2>{esc(t["name"])}</h2><p>{esc(t["desc"])}</p>'
                 f'<p class="card__tags">{esc(t.get("lang", ""))}{src(t)}</p>'
                 f'{"<pre><code>" + esc(t["code"]) + "</code></pre>" if t.get("code") else ""}</article>' for t in TOOLS)
else:
    tl = empty("no tools published yet", "content/tools.json",
               '{"name": "subnet-sweep", "lang": "python", "desc": "Pings a /24 and lists live hosts.",\n "repo": "https://github.com/nrodrigue2004/...", "code": "import subprocess ..."}')
page("tools.html", "tools :: 0xDay", f'<p class="cmd">ls ~/bin</p><h1>~/tools</h1><p>Small scripts and utilities I\'ve written.</p>{tl}')

# ---------- detections ----------
if DETS:
    dl = "".join(f'<article class="tool"><h2>{esc(d["name"])}</h2><p>{esc(d["desc"])}</p>'
                 f'<p class="card__tags">{esc(d.get("format", ""))}{" · ATT&amp;CK " + esc(d["attack"]) if d.get("attack") else ""}</p>'
                 f'<pre><code>{esc(d["rule"])}</code></pre></article>' for d in DETS)
else:
    dl = empty("no rules published yet", "content/detections.json",
               '{"name": "SMB brute force from one host", "format": "sigma", "attack": "T1110",\n "desc": "Many failed SMB logons from a single source in a short window.",\n "rule": "title: ...\\nlogsource: ...\\ndetection: ..."}')
page("detections.html", "detections :: 0xDay", f'<p class="cmd">cat ~/rules/*.yml</p><h1>~/detections</h1><p>Detection rules I\'ve written and tested in my homelab\'s Security Onion.</p>{dl}')

# ---------- bookshelf ----------
if BOOKS:
    order = {"reading": 0, "read": 1, "queued": 2}
    bl = "".join(f'<li class="book"><span class="pkg__st pkg__st--{ {"read": "installed", "reading": "downloading", "queued": "queued"}[b["status"]] }">[{esc(b["status"])}]</span>'
                 f'<span><strong>{esc(b["title"])}</strong> <span class="muted">{esc(b.get("author", ""))}</span>'
                 f'{"<br><span>" + esc(b["take"]) + "</span>" if b.get("take") else ""}</span></li>'
                 for b in sorted(BOOKS, key=lambda b: order.get(b["status"], 3)))
    books_body = f'<ul class="books">{bl}</ul>'
else:
    books_body = empty("shelf is empty", "content/books.json",
                       '{"title": "Practical Malware Analysis", "author": "Sikorski & Honig",\n "status": "reading", "take": "the lab exercises are the whole point."}')
page("books.html", "books :: 0xDay", f'<p class="cmd">ls ~/bookshelf</p><h1>~/books</h1><p>Security books and courses, with a one-line take on each.</p>{books_body}')

# ---------- man pages ----------
os.makedirs("man", exist_ok=True)
def gid(t): return "g-" + re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
for sh in SHEETS:
    grp = "".join(f'<h2 id="{gid(g["title"])}">{esc(g["title"])}</h2><dl class="man">' + "".join(
        f'<dt><code>{esc(c)}</code></dt><dd>{esc(d)}</dd>' for c, d in g["rows"]) + "</dl>" for g in sh["groups"])
    toc = (f'<p class="man-toc"><span class="muted">SECTIONS</span> ' + " ".join(f'<a href="#{gid(g["title"])}">{esc(g["title"])}</a>' for g in sh["groups"]) + "</p>") if len(sh["groups"]) > 4 else ""
    title = f'{sh["name"].upper()}({sh["section"]})'
    page(f'man/{sh["slug"]}.html', f'man {sh["name"]} :: 0xDay', f'''<p class="cmd">man {esc(sh["name"])}</p>
<div class="manhead"><span>{esc(title)}</span><span>0xDay Field Manual</span><span>{esc(title)}</span></div>
<h1>{esc(sh["name"])} <span class="muted">- {esc(sh["summary"])}</span></h1>
{toc}{grp}
<p><a href="../man.html">cd ..</a></p>''', depth=1, desc=f'{sh["name"]} cheatsheet: {sh["summary"]}')
def manrow(s): return f'<li><a class="ls-row" href="man/{s["slug"]}.html"><span class="ls-perm">{esc(s["name"])}({s["section"]})</span><span class="ls-title">{esc(s["summary"])}</span></a></li>'
MANCATS = [("os", "operating systems", "apropos shell"), ("tools", "security tools", "apropos security")]
mi = "".join(f'<p class="cmd">{cmd}</p><h2>{label}</h2><ul class="ls manidx">{"".join(manrow(s) for s in SHEETS if s.get("category", "tools") == k)}</ul>' for k, label, cmd in MANCATS)
page("man.html", "man :: 0xDay", f'<p class="cmd">apropos .</p><h1>~/man</h1><p>Command references for Windows, Linux and macOS, plus the security tools I use most, written as man pages.</p>{mi}')

# ---------- dojo (coding katas, see build_dojo.py) ----------
import build_dojo
DOJO = build_dojo.build(page, esc)

# ---------- lab hub ----------
def n(x, unit): return f'{len(x)} {unit}{"" if len(x) == 1 else "s"}' if x else "coming soon"
HUB = [("ctf", "ctf.html", "TryHackMe scoreboard", n(CTF, "room")),
       ("man", "man.html", "cheatsheets as man pages", n(SHEETS, "page")),
       ("tools", "tools.html", "scripts I've written", n(TOOLS, "tool")),
       ("detections", "detections.html", "SIEM detection rules", n(DETS, "rule")),
       ("books", "books.html", "bookshelf", n(BOOKS, "book")),
       ("resume", "resume.html", "printable resume", "1 page"),
       ("learn", "learn.html", "skill guides + sandbox labs", f'{len(GUIDES)} guides'),
       ("secplus", "secplus.html", "Security+ study system", f'{len(SP["objectives"])} objectives'),
       ("certs", "certs.html", "cert roadmap", f'{len(CERTS["certs"])} tracked'),
       ("skills", "skills.html", "skills matrix", f'{sum(len(g["skills"]) for g in SKILLS["groups"])} skills')]
HUB = [x for x in HUB if x[3] != "coming soon"]
HUB.insert(0, ("dojo", "dojo.html", "daily coding drills, 9 languages", f"{DOJO} katas"))
HUB += [("homelab", "homelab.html", "interactive network map", "7 nodes"), ("attack-chain", "attack-chain.html", "recon to detection", "6 stages"),
        ("htop", "htop.html", "homelab as htop", "7 VMs"), ("tty", "tty.html", "the whole site as a shell", "tty1"), ("desktop", "desktop.html", "i3 tiling desktop", "startx")]  # hide sections until they have content
tiles = "".join(f'<a class="tile" href="{h}"><span class="tile__k">./{k}</span><span class="tile__v">{esc(d)}</span><span class="tile__n">{esc(c)}</span></a>' for k, h, d, c in HUB)
page("lab.html", "lab :: 0xDay", f'<p class="cmd">ls ~/lab</p><h1>~/lab</h1><p>Everything that isn\'t a blog post: practice, references, and the paper trail.</p><div class="hub">{tiles}</div>', cur="lab")

# ---------- phase 3: homelab map, attack chain, deep-dives ----------
import build_homelab
build_homelab.build(page, esc)

# ================= round 4 pages =================
page("tty.html", "tty1 :: 0xDay", '<div id="tty" class="tty" aria-label="0xDay shell"></div><noscript><p>TTY mode needs JavaScript. <a href="index.html">Back to the normal site</a>.</p></noscript>',
     htmlcls="tty-page", scripts=("tty.js",), desc="0xDay as a real shell.")
page("htop.html", "htop :: 0xDay", '<p class="cmd">htop --homelab</p><h1 class="sr-only">Homelab htop</h1><div id="htop" class="htop"></div>'
     '<p class="muted small">// simulated view of my Proxmox homelab: the VMs and their roles are real; IPs, live numbers and packets are made up for fun.</p>',
     scripts=("htop.js",), desc="htop-style dashboard of Nathan's homelab.")
page("desktop.html", "i3 :: 0xDay", '<div id="i3" class="i3" aria-label="tiling desktop"></div><noscript><p>The desktop needs JavaScript. <a href="index.html">Back</a>.</p></noscript>',
     htmlcls="i3-page", scripts=("desktop.js",), desc="0xDay as an i3 tiling desktop.")

# ---------- data for the ghost assistant ----------
data = {"name": NAME, "gh": GH, "li": LI,
        "posts": [{k: p[k] for k in ("slug", "title", "date", "tags")} for p in POSTS],
        "projects": PROJECTS,
        "skills": {k: v for k, v in facts if k in ("security", "infra", "langs")},
        "matrix": SKILLS["groups"], "certs": CERTS["certs"], "secplus": {"overall": overall, "domains": sp["domains"]},
        "now": NOW, "changelog": CHANGELOG[:5], "tags": {t: len(v) for t, v in TAGS.items()},
        "flags": {k: hashlib.sha256(v.encode()).hexdigest() for k, v in FLAGS.items()},
        "consoleFlag": FLAGS["console"].encode().hex(),
        "man": [{"slug": x["slug"], "name": x["name"], "summary": x["summary"], "groups": x["groups"]} for x in SHEETS],
        "ctf": CTF, "ctfstats": CTFSTATS, "thm": CERTS.get("thm_username"), "tools": [t["name"] for t in TOOLS], "detections": [d["name"] for d in DETS], "books": BOOKS,
        "guides": [{"slug": k, "name": v[0]["name"]} for k, v in GUIDES.items()],
        "secplus_objs": [{"id": o["id"], "title": o["title"]} for o in SP["objectives"]]}
open("data.js", "w").write("window.OXDAY=" + json.dumps(data) + ";\n")
print("built", len(POSTS), "posts,", len(PROJECTS), "projects,", len(TAGS), "tags,", len(GUIDES), "guides,", len(SP["objectives"]), "objectives,", NCARDS, "cards")
