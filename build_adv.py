"""Advanced security sections: ~/detect (BLU310), ~/crypto (CRY300), ~/sdl (SDL300), ~/mobile (CRY300 module).
Called from build.py. Standard library only.

Chapters live in content/<section>/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
A chapter's :: ref is published as a cheatsheet: set "sheet: <slug>" in the header; chapters sharing a slug merge into one man page.
Order and blurbs are in SECTIONS below. Every lab is fictional and simulated; nothing here touches a real system.
"""
import os, html
import build_learn as L

esc = html.escape
SECTIONS = [
    {"dir": "detect", "course": "BLU310", "title": "detection engineering and hunting",
     "intro": "Turn attacker behavior into rules that fire, then hunt for what the rules miss: ATT&amp;CK mapping, Sigma, YARA and hypothesis-driven hunts.",
     "note": "Rules and logs in the labs are fictional. Real rule repos are linked from the chapters.",
     "chapters": [
         ("attack-mapping", "ATT&CK and detection basics", "Tactics, techniques, data sources, and how to say what a rule actually covers. Lab: map alerts to techniques"),
         ("sigma-rules", "Sigma rules", "Write vendor-neutral log detections, tune out noise. Lab: find the rule that misses the attack"),
         ("yara-rules", "YARA rules", "Match files and memory by strings, hex and conditions. Lab: write the condition that fits"),
         ("threat-hunting", "threat hunting", "Hypothesis, data, pivot, document. Lab: hunt beaconing in proxy logs")],
     "sheets": {"sigma": ("sigma", "Sigma rule fields, modifiers and conditions, plus ATT&CK tactic names"),
                "yara": ("yara", "YARA rule syntax, string types and common conditions")}},
    {"dir": "crypto", "course": "CRY300", "title": "cryptography",
     "intro": "How the primitives behave and how they fail: block cipher modes, RSA and elliptic curves, TLS and PKI internals, and the classic attacks.",
     "note": "Concepts and openssl-style tools only, no math proofs. Practice the attacks in the Cryptopals challenges linked from the course page.",
     "chapters": [
         ("symmetric-modes", "symmetric encryption and modes", "AES, ECB, CBC, CTR, GCM, nonces. Lab: spot the ECB leak"),
         ("public-key", "RSA, ECC and signatures", "Key exchange, signing, sizes, and why curves won. Lab: audit a fleet of keys for weak ones"),
         ("tls-pki", "TLS and PKI internals", "The handshake, certificates, chains and revocation. Lab: read a chain and find the break"),
         ("crypto-attacks", "attacking crypto", "Padding oracles, nonce reuse, weak randomness, downgrade. Lab: break reused-nonce traffic")],
     "sheets": {"openssl": ("openssl", "openssl commands for keys, certificates, hashes and TLS checks")}},
    {"dir": "sdl", "course": "SDL300", "title": "secure development",
     "intro": "Build security into the pipeline: threat modeling, SAST and DAST, dependency and secret scanning, and how to triage what they report.",
     "note": "Tools are named so you can look them up; the labs use fictional code and reports.",
     "chapters": [
         ("threat-modeling", "threat modeling", "Data flow diagrams, STRIDE, and ranking risks. Lab: find the unmodeled trust boundary"),
         ("sast-dast", "SAST and DAST", "Static and dynamic testing, what each finds, triaging findings. Lab: triage a scanner report"),
         ("dependency-scanning", "dependencies, secrets and the pipeline", "SCA, SBOMs, lockfiles, secret scanning, CI gates. Lab: find the vulnerable transitive package")],
     "sheets": {"appsec": ("appsec", "STRIDE, common scanner commands and CI security gates")}},
    {"dir": "mobile", "course": "CRY300", "title": "mobile security",
     "intro": "Android and iOS security models, the OWASP mobile risks, and how apps store secrets, talk to servers and get tested.",
     "note": "Test only apps and devices you own. Labs are simulated file listings, no real app is touched.",
     "chapters": [
         ("android-security", "Android security", "Sandbox, permissions, manifest, storage, APK analysis. Lab: audit an AndroidManifest"),
         ("ios-and-mobile-crypto", "iOS and mobile crypto", "Keychain, Secure Enclave, ATS, pinning, mobile storage mistakes. Lab: find the secret stored the wrong way")],
     "sheets": {"mobile": ("mobile", "Android and iOS testing commands and OWASP MASVS areas")}},
]
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it. Everything is simulated."),
          "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer. Everything is simulated.")}


def build_section(page, SHEETS, S):
    d = S["dir"]
    os.makedirs(d, exist_ok=True)
    chs = [(s, n, b, L.parse_guide(open(f"content/{d}/{s}.txt").read())) for s, n, b in S["chapters"]]
    for s, n, b, g in chs:  # publish :: ref blocks as cheatsheets
        if not g.get("ref"): continue
        tgt = g["meta"].get("sheet", d)
        sh = next((x for x in SHEETS if x["slug"] == tgt), None)
        if sh is None:
            nm, summ = S["sheets"][tgt]
            sh = {"slug": tgt, "name": nm, "section": "7", "category": "skills", "summary": summ, "groups": []}
            SHEETS.append(sh)
        have = {x["title"].lower() for x in sh["groups"]}
        sh["groups"] += [x for x in g["ref"] if x["title"].lower() not in have]
    for i, (slug, name, blurb, g) in enumerate(chs):
        lab = L.lab_json(g, f"{d}-{slug}", name)
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
            g["meta"].setdefault("sheet", d)
            nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
            secs += L.ref_html(g, slug)
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">{d} --chapter {slug}</p>
<h1>~/{d}/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{d}-{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../{d}.html">cd ~/{d}</a> · <a href="../courses/{S["course"]}.html">course {S["course"]}</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"{d}/{slug}.html", f"{name} :: ~/{d} :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"{S['title'].capitalize()}, {name}: {blurb}.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="{d}-{s}"><a class="ls-row" href="{d}/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "shell") if g["lab"].get("brief") else "read"}</span></a></li>'''
        for s, n, b, g in chs)
    sheets = ", ".join(f'<a href="man/{k}.html">man {k}</a>' for k in S["sheets"])
    page(f"{d}.html", f"{d} :: 0xDay", f'''<p class="cmd">ls ~/{d}</p><h1>~/{d}</h1>
<p>{S["intro"]} Part of course <a href="courses/{S["course"]}.html">{S["course"]}</a>. Each chapter goes <strong>simple, mid, complex</strong>, then a hands-on lab.</p>
<p class="callout">{S["note"]} Commands and terms are also on the cheatsheets: {sheets}.</p>
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read plus the lab solved. Saved in your browser.</p>''',
         cur="learn", scripts=("learn.js",), desc=f"{S['title'].capitalize()}: {S['intro'].replace('&amp;', 'and')}")
    return chs


def build(page, SHEETS):
    return {S["dir"]: build_section(page, SHEETS, S) for S in SECTIONS}
