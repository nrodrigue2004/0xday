"""~/cloud: cloud basics (shared concepts, AWS, Azure, cloud security, free-tier labs). Called from build.py. Standard library only.

Chapters live in content/cloud/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
A chapter's :: ref is published as a cheatsheet: set "sheet: <slug>" (and optionally "sheet_name", "sheet_summary") in the header;
chapters that share a slug are merged into one man page. Order and blurbs are in CHAPTERS below.
Everything is simulated or free-tier guidance: no real account, key or bill is ever involved.
"""
import os, html
import build_learn as L

esc = html.escape
CHAPTERS = [
    ("cloud-basics", "cloud basics", "IaaS, PaaS, SaaS, regions, pricing and the shared responsibility model"),
    ("cloud-iam", "identity and access", "Users, roles, policies and least privilege, AWS and Azure side by side. Lab: find the policy that is too broad"),
    ("cloud-networking", "networking", "VPC and VNet, subnets, security groups and NSGs. Lab: who is actually reachable from the internet"),
    ("cloud-storage-compute", "storage and compute", "Buckets and blobs, VMs, containers and functions. Lab: find the public bucket with customer data"),
    ("aws-basics", "AWS", "The services that matter, the CLI, and a free-tier mindset. Lab: audit access keys with a simulated CLI"),
    ("azure-basics", "Azure", "Entra ID, subscriptions, RBAC and the az CLI. Lab: find the risky Owner with a simulated CLI"),
    ("cloud-security", "cloud security", "Misconfiguration, logging, encryption, posture tools. Lab: investigate a CloudTrail excerpt"),
    ("cloud-free-labs", "free-tier labs", "Practice safely: sandboxes, local emulators, billing guardrails, teardown"),
]
SHEET_DEFAULTS = {"cloud": ("cloud", "AWS and Azure side by side: the terms that map to each other"),
                  "aws": ("aws", "AWS CLI commands for identity, storage, compute and logs"),
                  "az": ("az", "Azure CLI commands for accounts, RBAC, storage, VMs and logs")}
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it. Everything is simulated."),
          "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer. Everything is simulated.")}


def build(page, SHEETS):
    os.makedirs("cloud", exist_ok=True)
    chs = [(s, n, b, L.parse_guide(open(f"content/cloud/{s}.txt").read())) for s, n, b in CHAPTERS]
    for s, n, b, g in chs:  # publish :: ref blocks as cheatsheets
        if not g.get("ref"): continue
        tgt = g["meta"].get("sheet", "cloud")
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
            g["meta"].setdefault("sheet", "cloud")
            nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
            secs += L.ref_html(g, slug)
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">cloud --chapter {slug}</p>
<h1>~/cloud/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../cloud.html">cd ~/cloud</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"cloud/{slug}.html", f"{name} :: ~/cloud :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"Cloud basics, {name}: {blurb}.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="{s}"><a class="ls-row" href="cloud/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "shell") if g["lab"].get("brief") else "read"}</span></a></li>'''
        for s, n, b, g in chs)
    page("cloud.html", "cloud :: 0xDay", f'''<p class="cmd">ls ~/cloud</p><h1>~/cloud</h1>
<p>Cloud basics for AWS and Azure: the concepts they share, then each platform, then security. Each chapter goes <strong>simple, mid, complex</strong>, and most end in a hands-on lab.</p>
<p class="callout">No lab here touches a real account. The labs are simulated, and the last chapter covers free-tier practice with billing guardrails. Commands and terms are also on the cheatsheets: <a href="man/cloud.html">man cloud</a>, <a href="man/aws.html">man aws</a>, <a href="man/az.html">man az</a>.</p>
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read (plus lab solved, if any). Saved in your browser.</p>''',
         cur="learn", scripts=("learn.js",), desc="Cloud basics: shared concepts, AWS, Azure, cloud security and free-tier labs, with simulated hands-on labs.")
    return chs
