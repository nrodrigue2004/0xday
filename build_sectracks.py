"""~/grc: the chapters behind course GRC200. Called from build.py. Standard library only.

Chapters live in content/<section>/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
A chapter's :: ref is published as a cheatsheet: set "sheet: <slug>" in the header; chapters sharing a slug merge into one man page.
Every lab target is fictional or simulated (made-up hosts, made-up logs, a fake CLI). Nothing here touches a real system.
Order, titles and blurbs are in SECTIONS below.
"""
import os, html
import build_learn as L

esc = html.escape
SECTIONS = [
    {"dir": "web", "title": "web security", "course": "WEB300", "sheet": ("web-sec", "Web security: OWASP Top 10, Burp, HTTP and JWT quick reference"),
     "intro": "The web half of the job: what the OWASP Top 10 means in practice, how to drive Burp Suite, how login and sessions break, and how APIs fail. Each chapter goes <strong>simple, mid, complex</strong> and ends in a hands-on lab against a made-up app.",
     "ext": '<a href="https://portswigger.net/web-security" rel="noopener" target="_blank">PortSwigger Web Security Academy</a> is the free practice ground this section points at; it is the best hands-on material there is, so we summarize and link rather than copy it',
     "chapters": [
         ("owasp-top-10", "OWASP Top 10", "All ten categories in plain words, what each looks like in a real app and the fix. Lab: sort a scan report by category"),
         ("burp-workflow", "Burp Suite workflow", "Proxy, scope, Repeater, Intruder, Decoder and the habits that keep testing clean. Lab: find the tampered request in a Burp log"),
         ("injection-and-xss", "injection and XSS", "SQL, command and template injection plus XSS: how each works, how to confirm it safely and how to fix it. Lab: read the vulnerable code"),
         ("auth-and-sessions", "authentication and sessions", "Password storage, MFA, cookies, session fixation and JWT mistakes. Lab: decode a weak token"),
         ("access-control-and-ssrf", "access control, CSRF and SSRF", "IDOR, privilege escalation, CSRF tokens and server-side request forgery. Lab: find the broken authorization in an access log"),
         ("api-security", "API security", "The OWASP API Top 10, mass assignment, rate limits and GraphQL pitfalls. Lab: triage an API gateway ticket"),
     ]},
    {"dir": "pentest", "title": "penetration testing", "course": "PEN300", "sheet": ("pentest", "Pentest quick reference: methodology, enumeration, privesc, AD, tunnels"),
     "intro": "How a professional test runs: scope and rules first, then enumeration, privilege escalation on Linux and Windows, Active Directory attack paths, pivoting and the report. Concepts and defenses come first, and every lab uses a fictional network.",
     "ext": 'Practice legally on your own lab, <a href="https://tryhackme.com" rel="noopener" target="_blank">TryHackMe</a>, <a href="https://overthewire.org/wargames/" rel="noopener" target="_blank">OverTheWire</a> or <a href="https://www.hackthebox.com" rel="noopener" target="_blank">Hack The Box</a>. Never test anything you do not own or have written permission for',
     "chapters": [
         ("pentest-methodology", "methodology and rules of engagement", "The phases, scope, rules of engagement, authorization and the legal line. Lab: spot the out-of-scope action"),
         ("enumeration", "enumeration", "Ports, services, web content, SMB and DNS: turning a host list into a map. Lab: read scan output and pick the weakest service"),
         ("linux-privesc", "Linux privilege escalation", "sudo, SUID, cron, capabilities, writable paths and what to check first. Lab: find the misconfiguration on a fictional box"),
         ("windows-privesc", "Windows privilege escalation", "Services, unquoted paths, token privileges, stored credentials and registry. Lab: read a host audit and name the weak service"),
         ("ad-attacks", "Active Directory attacks", "Kerberoasting, AS-REP roasting, delegation, BloodHound paths, and the detections that catch each. Lab: review a fictional AD export"),
         ("pivoting", "pivoting and tunnels", "Port forwards, SSH tunnels, SOCKS proxies and segmentation. Lab: work out which host is the way in"),
         ("pentest-reporting", "report writing", "Findings, severity, CVSS, evidence and an executive summary people will read. Lab: rate three findings"),
     ]},
    {"dir": "grc", "title": "governance, risk and compliance", "course": "GRC200", "sheet": ("grc", "GRC quick reference: frameworks, risk formulas, privacy laws"),
     "intro": "The paperwork half of security that decides budgets and audits: frameworks, risk math, policies, compliance, privacy law and professional ethics. Pair it with Security+ domain 5. There is a working <a href=\"grc/risk-worksheet.html\">risk worksheet</a> that saves in your browser.",
     "ext": 'Primary sources are free: <a href="https://www.nist.gov/cyberframework" rel="noopener" target="_blank">NIST CSF</a> and the <a href="https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search" rel="noopener" target="_blank">SP 800-53 catalog</a>. We summarize in our own words and link to the real documents',
     "chapters": [
         ("grc-frameworks", "frameworks: NIST CSF, 800-53, ISO 27001", "What each framework is for, how they map to each other and how to pick one. Lab: map a control to the right function"),
         ("risk-management", "risk management", "Assets, threats, likelihood and impact, SLE/ALE, treatment options and the risk register. Lab: compute ALE"),
         ("policy-writing", "policy writing", "Policy, standard, procedure and guideline, and how to write one people follow. Lab: fix the unenforceable policy"),
         ("audits-and-compliance", "audits and compliance", "SOC 2, PCI DSS, HIPAA, evidence collection and how an audit really runs. Lab: pass or fail an audit sample"),
         ("privacy-law", "privacy law", "GDPR, CCPA, HIPAA, FERPA, data classification and breach notification clocks. Lab: which notification deadline applies"),
         ("ethics-and-disclosure", "ethics and responsible disclosure", "Professional codes, the CFAA, authorization, disclosure timelines and safe harbor. Lab: judge the researcher's choices"),
     ]},
]
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it. Everything is simulated."),
          "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer. Everything is simulated.")}


def build(page, SHEETS):
    out = []
    for S in SECTIONS:
        d = S["dir"]
        os.makedirs(d, exist_ok=True)
        chs = [(s, n, b, L.parse_guide(open(f"content/{d}/{s}.txt").read())) for s, n, b in S["chapters"]]
        for s, n, b, g in chs:  # publish :: ref blocks as cheatsheets
            if not g.get("ref"): continue
            tgt = g["meta"].get("sheet", S["sheet"][0])
            sh = next((x for x in SHEETS if x["slug"] == tgt), None)
            if sh is None:
                sh = {"slug": tgt, "name": tgt, "section": "7", "category": "skills", "summary": S["sheet"][1], "groups": []}
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
                g["meta"].setdefault("sheet", S["sheet"][0])
                nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
                secs += L.ref_html(g, slug)
            pv = chs[i - 1] if i else None
            nx = chs[i + 1] if i + 1 < len(chs) else None
            pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
            body = f'''<p class="cmd">{d} --chapter {slug}</p>
<h1>~/{d}/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../{d}.html">cd ~/{d}</a> {f' · <a href="../courses/{S["course"]}.html">{S["course"]}</a>' if S["course"] else ''}</p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
            page(f"{d}/{slug}.html", f"{name} :: ~/{d} :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
                 scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"{S['title'].capitalize()}, {name}: {blurb}.")
        rows = "".join(
            f'''<li class="guiderow" data-skill="{s}"><a class="ls-row" href="{d}/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "shell") if g["lab"].get("brief") else "read"}</span></a></li>'''
            for s, n, b, g in chs)
        extra = ""
        if d == "grc":
            extra = '<ul class="ls guides"><li class="guiderow"><a class="ls-row" href="grc/risk-worksheet.html"><span class="ls-perm">[tool]</span><span class="ls-title">risk worksheet <span class="muted small">Score risks, compute ALE and keep a register that saves in this browser</span></span><span class="ls-tags">tool</span></a></li></ul>'
        page(f"{d}.html", f"{S['title']} :: 0xDay", f'''<p class="cmd">ls ~/{d}</p><h1>~/{d}</h1>
<p>{S["intro"]}</p>
<p class="callout">{f'Course: <a href="courses/{S["course"]}.html">{S["course"]}</a> has the module checklist, quizzes and an exam. ' if S["course"] else 'Reading chapters with labs; quizzes are not added yet. '}Every target here is fictional. {S["ext"]}.</p>
<ul class="ls guides">{rows}</ul>{extra}
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read (plus lab solved, if any). Saved in your browser. Reference: <a href="man/{S["sheet"][0]}.html">man {S["sheet"][0]}</a></p>''',
             cur="learn", scripts=("learn.js",), desc=f"{S['title'].capitalize()}: {len(chs)} chapters with simulated hands-on labs.")
        out.append((S, chs))
    worksheet(page)
    return out


def worksheet(page):
    """~/grc/risk-worksheet: ALE calculator + risk register, browser-only (riskws.js)"""
    opts = lambda: "".join(f'<option value="{i}">{i}</option>' for i in range(1, 6))
    body = f'''<p class="cmd">grc --tool risk-worksheet</p><h1>~/grc/risk-worksheet</h1>
<p>Two tools from <a href="risk-management.html">risk management</a>: the ALE calculator and a risk register. Everything stays in this browser (local storage). Use made-up or generic risks here, not real client data.</p>
<noscript><p class="callout">The worksheet needs JavaScript.</p></noscript>
<div id="rw" class="rw">
<h2># ALE calculator</h2>
<div class="rw__box"><div class="rw__row">
<label>asset value ($)<input id="av" type="number" min="0" step="any" value="200000"></label>
<label>exposure factor (% lost per event)<input id="ef" type="number" min="0" max="100" step="any" value="25"></label>
<label>ARO (events per year)<input id="aro" type="number" min="0" step="any" value="0.5"></label></div>
<div class="rw__row"><label>ARO with the control<input id="aro2" type="number" min="0" step="any" value="0.1"></label>
<label>control cost ($ per year)<input id="cost" type="number" min="0" step="any" value="9000"></label></div>
<p class="rw__out">SLE = AV x EF = <strong id="rw-sle"></strong> &nbsp; ALE = SLE x ARO = <strong id="rw-ale"></strong></p>
<p class="rw__out">ALE with the control: <strong id="rw-after"></strong> &nbsp; net benefit: <strong id="rw-net"></strong></p></div>
<h2># risk register</h2>
<form id="rw-add" class="rw__box"><div class="rw__row">
<label>risk (be specific)<input id="r-name" required maxlength="140" placeholder="Credential stuffing on the customer portal"></label>
<label>owner<input id="r-owner" maxlength="60" placeholder="role, not a person"></label></div>
<div class="rw__row"><label>likelihood (1-5)<select id="r-l">{opts()}</select></label>
<label>impact (1-5)<select id="r-i">{opts()}</select></label>
<label>treatment<select id="r-t"><option>mitigate</option><option>transfer</option><option>accept</option><option>avoid</option></select></label></div>
<p><button class="btn" type="submit">[ add risk ]</button> <span class="muted small" id="rw-msg" aria-live="polite"></span></p></form>
<p id="rw-empty" class="muted">No risks yet. Score = likelihood x impact: 1-5 low, 6-12 medium, 13-25 high.</p>
<div class="rw__wrap"><table class="rw__reg" id="rw-tbl" hidden><thead><tr><th>risk</th><th>owner</th><th>L</th><th>I</th><th>score</th><th>treatment</th><th></th></tr></thead><tbody id="rw-body"></tbody></table></div>
<p><button class="btn btn--sm" type="button" id="rw-csv">[ export csv ]</button> <button class="btn btn--sm" type="button" id="rw-clear">[ clear all ]</button></p>
</div>
<p class="muted small"><a href="../grc.html">cd ~/grc</a> · <a href="../courses/GRC200.html">GRC200</a></p>'''
    page("grc/risk-worksheet.html", "risk worksheet :: ~/grc :: 0xDay", body, depth=1, cur="learn", scripts=("riskws.js",),
         head='\n<link rel="stylesheet" href="../riskws.css">', desc="ALE calculator and risk register that saves in your browser.")
