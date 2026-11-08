"""~/history (history and future of tech) and ~/cases (real exploit and malware case studies). Called from build.py. Standard library only.

Chapters live in content/history/<slug>.txt and content/cases/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
A chapter's :: ref is published as a cheatsheet: set "sheet: <slug>" in the header.
Case studies explain publicly documented bugs for education. Labs are fictional toy programs with the same bug class;
nothing here is a working exploit or working malware, and no lab touches a real system.
"""
import os, html
import build_learn as L

esc = html.escape
HISTORY = [
    ("h1-before-computers", "1: before electronics", "1804 to 1945: Jacquard, Lovelace, Boole, Hollerith, Turing, Colossus, ENIAC"),
    ("h2-transistors-pcs", "2: transistors to the PC", "1947 to 1984: the transistor, Unix, C, microprocessors, the PC"),
    ("h3-networks-web", "3: networks to the web", "1969 to 1995: ARPANET, TCP/IP, email, the web, Linux"),
    ("h4-web-cloud-mobile", "4: web, cloud, mobile", "1995 to 2015: dot-com, search, smartphones, cloud, open source"),
    ("h5-ai-era", "5: the AI era", "2012 to now: deep learning, transformers, LLMs and agents"),
    ("h6-future", "6: the future", "AI, quantum, post-quantum crypto, memory safety, and what to watch. Lab: harvest now, decrypt later"),
    ("h7-hack-timeline", "7: hacking timeline", "1971 to 2024: the worms, breaches and bugs that shaped security, with links to the case studies"),
]
CASES = [
    ("morris-worm", "Morris worm (1988)", "The first internet worm: a gets() overflow, a debug backdoor and weak passwords. Lab: fix the bug"),
    ("heartbleed", "Heartbleed (2014)", "A missing bounds check in OpenSSL leaked server memory. Real code, line by line. Lab: count the leak"),
    ("wannacry", "WannaCry and EternalBlue (2017)", "A leaked SMB exploit, a ransomware worm and a kill switch, at concept level. Lab: find unpatched hosts"),
    ("stuxnet", "Stuxnet (2010)", "Malware built to break centrifuges: zero-days, signed drivers, air gaps"),
    ("log4shell", "Log4Shell (2021)", "A log line that fetched code: JNDI lookups in Log4j 2. Real code, patch, and detection. Lab: hunt it in logs"),
]
SHEET_DEFAULTS = {"history": ("history", "Tech history in dates: people, machines, protocols and the hacks beside them"),
                  "cases": ("cases", "Case studies in one table: CVE, bug class, fix and the lesson")}
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it. Everything is simulated."),
          "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer. Everything is simulated."),
          "debug": ("debugger", "Step through the toy program in the debugger pane, then <code>submit &lt;answer&gt;</code>. It is a fictional program with the same bug class, not the real code.")}


def group(page, SHEETS, chapters, cdir, hub, cmd, title, intro, blurb_desc, other):
    os.makedirs(cdir, exist_ok=True)
    chs = [(s, n, b, L.parse_guide(open(f"content/{cdir}/{s}.txt").read())) for s, n, b in chapters]
    for s, n, b, g in chs:
        if not g.get("ref"): continue
        tgt = g["meta"].get("sheet", cdir)
        sh = next((x for x in SHEETS if x["slug"] == tgt), None)
        if sh is None:
            nm, summ = SHEET_DEFAULTS[tgt]
            sh = {"slug": tgt, "name": nm, "section": "7", "category": "skills", "summary": summ, "groups": []}
            SHEETS.append(sh)
        have = {x["title"].lower() for x in sh["groups"]}
        sh["groups"] += [x for x in g["ref"] if x["title"].lower() not in have]
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
        if g.get("ref"):
            g["meta"].setdefault("sheet", cdir)
            nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
            secs += L.ref_html(g, slug)
        src = g["meta"].get("sources")
        if src: secs += f'<section class="lvl" id="sources"><h2><span class="lvl__n">src</span> sources <span class="muted">// read these, not just me</span></h2><p>{L.inline(src)}</p></section>'
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">{cmd} --chapter {slug}</p>
<h1>~/{cdir}/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../{hub}">cd ~/{cdir}</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"{cdir}/{slug}.html", f"{name} :: ~/{cdir} :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"{title}, {name}: {blurb}.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="{s}"><a class="ls-row" href="{cdir}/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "shell") if g["lab"].get("brief") else "read"}</span></a></li>'''
        for s, n, b, g in chs)
    page(hub, f"{cdir} :: 0xDay", f'''<p class="cmd">ls ~/{cdir}</p><h1>~/{cdir}</h1>
{intro}
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read (plus lab solved, if any). Saved in your browser. See also: {other}.</p>''',
         cur="learn", scripts=("learn.js",), desc=blurb_desc)
    return chs


def build(page, SHEETS):
    h = group(page, SHEETS, HISTORY, "history", "history.html", "history", "History of tech",
              '<p>The history of computing from Ada Lovelace to quantum computers, in chapters. Each chapter goes <strong>simple, mid, complex</strong>. The last two connect it to security: the hacking timeline and the future.</p>'
              '<p class="callout">History is told from public sources and simplified; dates are the commonly cited ones. Chapter 6 is opinion and labeled as such. The real code, bugs and malware are in <a href="cases.html">~/cases</a>. Dates are also on the cheatsheet: <a href="man/history.html">man history</a>.</p>',
              "History of tech from Ada Lovelace to quantum computers, with a hacking timeline and the future of tech.", '<a href="cases.html">~/cases</a>')
    c = group(page, SHEETS, CASES, "cases", "cases.html", "cases", "Case study",
              '<p>Real exploits and malware, explained for defenders. Each case has the story, the timeline, the root cause, a short excerpt of the publicly documented vulnerable code with the patch, how it was detected, and the lessons.</p>'
              '<p class="callout">Education only. No case contains a working exploit or working malware. Where code is shown it is a short, abridged excerpt of the public source and its fix, explained line by line. Labs use fictional toy programs with the same bug class, so you find the bug and fix it. Summary table: <a href="man/cases.html">man cases</a>.</p>',
              "Case studies of real exploits and malware (Morris worm, Heartbleed, WannaCry, Stuxnet, Log4Shell) with code excerpts, patches, detection and labs.", '<a href="history.html">~/history</a>')
    return h, c
