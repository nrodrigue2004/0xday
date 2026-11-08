"""~/start (ordered curriculum with progress), ~/jobs (application tracker) and ~/bullets (resume-bullet bank).
Called from build.py as build_start.build(page, esc) after every other page is written, so "if" hooks can see them.

Curriculum: content/start.json -> stages -> steps {id, t, h, w, m, topic, [if]}. A step with "if": "page.html" is only
included when that page exists in the built site (hook for sections other branches add). All other hrefs must exist.
Bullets: built from content/resume.json (base resume plus the role overrides), so the bank cannot drift from the resume.
Progress, applications and picks live in the browser (localStorage) only. Standard library only.
"""
import json, os, hashlib, re

STATUS = [("wishlist", "wishlist"), ("applied", "applied"), ("screen", "phone screen"), ("interview", "interview"),
          ("offer", "offer"), ("rejected", "rejected"), ("ghosted", "no reply"), ("withdrawn", "withdrawn")]
# keyword -> (aliases, optional guide to study when the posting wants it and the resume lacks it)
KEYWORDS = {
    "siem": (["siem", "splunk", "elastic", "security onion", "qradar", "sentinel"], "learn/siem-security-onion.html"),
    "splunk": (["splunk"], "learn/siem-security-onion.html"),
    "log analysis": (["log analysis", "logs", "log review"], "learn/log-analysis.html"),
    "incident response": (["incident response", "ir ", "triage"], "learn/incident-response.html"),
    "forensics": (["forensics", "dfir", "autopsy", "ftk"], "learn/digital-forensics.html"),
    "malware analysis": (["malware", "reverse engineering", "ghidra", "ida pro"], "learn/malware-analysis.html"),
    "wireshark": (["wireshark", "pcap", "packet capture", "packet analysis", "tcpdump"], "learn/network-traffic-analysis.html"),
    "ids/ips": (["ids", "ips", "snort", "suricata", "intrusion detection"], "learn/ids-snort.html"),
    "firewall": (["firewall", "pfsense", "palo alto", "fortinet"], "learn/firewalls-pfsense.html"),
    "vpn": (["vpn", "tailscale", "ipsec", "wireguard"], "learn/vpn-tailscale.html"),
    "nmap": (["nmap", "vulnerability scan", "nessus", "port scan"], "learn/recon-nmap-metasploit.html"),
    "metasploit": (["metasploit", "penetration test", "pentest"], "learn/recon-nmap-metasploit.html"),
    "active directory": (["active directory", "ad ", "domain controller", "ldap", "entra", "azure ad"], "learn/active-directory.html"),
    "group policy": (["group policy", "gpo"], "learn/group-policy.html"),
    "powershell": (["powershell"], "learn/windows-admin-powershell.html"),
    "bash": (["bash", "shell script", "shell scripting"], "learn/bash-scripting.html"),
    "python": (["python"], "learn/python.html"),
    "java": (["java "], "learn/java.html"),
    "typescript": (["typescript", "javascript", "react", "node"], "learn/typescript-javascript.html"),
    "sql": (["sql", "mysql", "postgres", "database"], "learn/sql.html"),
    "git": (["git", "github", "version control"], "learn/git-github.html"),
    "linux": (["linux", "ubuntu", "red hat", "rhel", "debian"], "learn/linux-command-line.html"),
    "windows": (["windows", "windows server", "windows 11"], "learn/windows-deployment-and-drivers.html"),
    "networking": (["tcp/ip", "dns", "dhcp", "subnet", "vlan", "networking", "routing"], "learn/networking-tcp-ip-dhcp-nat-subnets.html"),
    "virtualization": (["virtualization", "vmware", "virtualbox", "proxmox", "hyper-v"], "learn/virtualization-proxmox.html"),
    "help desk": (["help desk", "service desk", "ticketing", "ticket", "servicenow", "osticket", "desktop support"], "learn/help-desk-ticketing-osticket.html"),
    "hardware": (["hardware", "laptop", "troubleshoot", "imaging", "deployment"], "learn/hardware-diagnostics-and-repair.html"),
    "hardening": (["hardening", "cis benchmark", "baseline", "patch"], "learn/system-hardening-windows-linux.html"),
    "phishing": (["phishing", "email security", "spam"], "learn/phishing-analysis.html"),
    "cryptography": (["cryptography", "encryption", "pki", "tls", "certificate"], "learn/cryptography-applied.html"),
    "security+": (["security+", "comptia", "sec+"], "secplus.html"),
    "mitre att&ck": (["mitre", "att&ck", "ttp"], "secplus/4.1.html"),
    "cloud": (["aws", "azure", "gcp", "cloud"], ""),
    "docker": (["docker", "kubernetes", "container"], ""),
    "testing": (["qa", "test cases", "test plan", "selenium", "unit test"], ""),
    "api": (["api", "rest", "json"], ""),
}


def _steps(page_exists):
    S = json.load(open("content/start.json"))["stages"]
    out, missing = [], []
    for st in S:
        steps = []
        for s in st["steps"]:
            if s.get("if"):
                if not page_exists(s["if"]):
                    continue
            elif not page_exists(s["h"]):
                missing.append(s["h"])
            if s.get("if") and s["h"] != s["if"]:
                pass
            steps.append(s)
        out.append({**st, "steps": steps})
    if missing:
        raise SystemExit("start.json: hrefs that do not exist: " + ", ".join(missing))
    return out


def _assets(prefix):
    css, js = open(f"{prefix}.css").read(), open(f"{prefix}.js").read()
    ver = hashlib.sha1((css + js).encode()).hexdigest()[:8]
    return f'\n<link rel="stylesheet" href="{prefix}.css?v={ver}">\n<script src="{prefix}.js?v={ver}" defer></script>'


def bank():
    """Every resume bullet, once, tagged with the role views it appears in."""
    R = json.load(open("content/resume.json"))
    items, idx = [], {}

    def add(text, src, kind, role):
        k = text.strip()
        if k not in idx:
            idx[k] = len(items)
            items.append({"t": k, "s": src, "k": kind, "r": []})
        if role not in items[idx[k]]["r"]:
            items[idx[k]]["r"].append(role)
    base_proj = {p["name"]: p for p in R["projects"]}
    for e in R["experience"]:
        for b in e["bullets"]:
            add(b, e["title"], "work", "all")
    for p in R["projects"]:
        for b in p["bullets"]:
            add(b, p["name"], "project", "all")
    for ro in R["roles"]:
        for p in ro.get("projects", []):
            bl = p.get("bullets") or base_proj.get(p["name"], {}).get("bullets", [])
            for b in bl:
                add(b, p["name"], "project", ro["key"])
        for e in R["experience"]:
            for b in e["bullets"]:
                add(b, e["title"], "work", ro["key"])
    roles = [{"key": r["key"], "label": r["label"]} for r in R["roles"]]
    skills = [s.strip().lower() for v in R["skills"].values() for s in re.split(r",\s*", v)]
    return items, roles, skills


def build(page, esc):
    exists = lambda h: h in ("start.html", "jobs.html", "bullets.html") or os.path.exists(h.split("#")[0])
    stages = _steps(exists)
    nsteps = sum(len(s["steps"]) for s in stages)
    # ---------- ~/start ----------
    head = _assets("start")
    blocks = []
    for st in stages:
        rows = "".join(
            f'<li class="st__step" data-id="{esc(s["id"])}" data-m="{s["m"]}" data-topic="{esc(s["topic"])}">'
            f'<label class="st__chk"><input type="checkbox" aria-label="done: {esc(s["t"])}"><span class="st__box" aria-hidden="true"></span></label>'
            f'<div><a class="st__t" href="{esc(s["h"])}">{esc(s["t"])}</a> <span class="muted small">~{s["m"] if s["m"] < 120 else round(s["m"]/60,1)}{"m" if s["m"] < 120 else "h"}</span>'
            f'<p class="st__w">{esc(s["w"])}</p></div></li>' for s in st["steps"])
        blocks.append(f'<section class="st__stage" data-stage="{esc(st["id"])}"><h2># {esc(st["name"])} <span class="st__count muted small"></span></h2>'
                      f'<p class="muted">{esc(st["blurb"])}</p><div class="st__bar" aria-hidden="true"><i></i></div><ol class="st__list">{rows}</ol></section>')
    body = f'''<p class="cmd">cat ~/start/README</p><h1>~/start</h1>
<p>The whole site in the order to study it, from nothing to a first application. Check a step off when it's done and the next one moves to the top. Progress lives in this browser only (nothing is sent anywhere), so use <strong>export</strong> now and then for a backup.</p>
<noscript><p class="callout">Progress tracking needs JavaScript. The list below still works as an ordered reading list.</p></noscript>
<div id="st" class="st" data-total="{nsteps}">
<div class="st__next" id="st-next" aria-live="polite"></div>
<div class="st__stats"><div class="tile"><span class="tile__k" id="st-pct">0%</span><span class="tile__v">of {nsteps} steps done</span><span class="tile__n" id="st-hrs"></span></div>
<div class="tile"><span class="tile__k" id="st-week">0 min</span><span class="tile__v">logged this week</span><span class="tile__n"><a href="log.html">open ~/log</a></span></div></div>
<p class="st__tools"><button class="btn" id="st-hide" type="button" aria-pressed="false">[ hide done ]</button> <button class="btn" id="st-export" type="button">[ export ]</button> <button class="btn" id="st-import" type="button">[ import ]</button> <button class="btn" id="st-reset" type="button">[ reset ]</button> <input type="file" id="st-file" accept="application/json" hidden> <span class="muted small" id="st-msg" role="status"></span></p>
{"".join(blocks)}
</div>
<p class="muted small">Companions: <a href="log.html">~/log</a> · <a href="jobs.html">~/jobs</a> · <a href="bullets.html">~/bullets</a> · <a href="careers.html">~/careers</a> · <a href="secplus.html">~/secplus</a></p>'''
    page("start.html", "start :: 0xDay", body, cur="start", head=head, desc="Ordered study roadmap across the whole site, with progress tracking in your browser.")

    # ---------- ~/jobs ----------
    head = _assets("jobs")
    opts = "".join(f'<option value="{k}">{esc(v)}</option>' for k, v in STATUS)
    _, roles, _ = bank()
    ropts = '<option value="">resume view</option>' + "".join(f'<option value="{esc(r["key"])}">{esc(r["label"])}</option>' for r in roles)
    body = f'''<p class="cmd">sort -k3 ~/applications.tsv</p><h1>~/jobs</h1>
<p>Application tracker. Log each application the day it goes out, move the status as things happen, and follow up after a week of silence. Saved in this browser only, so don't put anything sensitive in the notes; <strong>export</strong> keeps a backup.</p>
<noscript><p class="callout">The tracker needs JavaScript.</p></noscript>
<div id="jb" class="jb">
<div class="jb__stats" aria-live="polite">
 <div class="tile"><span class="tile__k" id="jb-total">0</span><span class="tile__v">tracked</span><span class="tile__n" id="jb-active"></span></div>
 <div class="tile"><span class="tile__k" id="jb-week">0</span><span class="tile__v">applied this week</span><span class="tile__n" id="jb-goal"></span></div>
 <div class="tile"><span class="tile__k" id="jb-resp">–</span><span class="tile__v">response rate</span><span class="tile__n" id="jb-resp2"></span></div>
 <div class="tile"><span class="tile__k" id="jb-due">0</span><span class="tile__v">need a follow-up</span><span class="tile__n">applied 7+ days ago</span></div>
</div>
<form class="jb__form" id="jb-form" autocomplete="off">
 <p class="cmd" id="jb-formcmd">echo "..." &gt;&gt; ~/applications.tsv</p>
 <div class="jb__row"><label>company<input type="text" id="jb-co" maxlength="80" required></label>
 <label>role<input type="text" id="jb-role" maxlength="100" required></label>
 <label>status<select id="jb-status">{opts}</select></label></div>
 <div class="jb__row"><label>date applied<input type="date" id="jb-date"></label>
 <label>resume used<select id="jb-resume">{ropts}</select></label>
 <label>next step on<input type="date" id="jb-nextdate"></label></div>
 <label class="jb__wide">posting link<input type="url" id="jb-url" maxlength="300" placeholder="https://"></label>
 <label class="jb__wide">next step / notes<input type="text" id="jb-notes" maxlength="300" placeholder="e.g. email recruiter Tuesday, asked about SIEM tools"></label>
 <button class="btn" type="submit" id="jb-save">[ add ]</button> <button class="btn" type="button" id="jb-cancel" hidden>[ cancel edit ]</button> <span class="muted small" id="jb-msg" role="status"></span>
</form>
<div class="jb__bar"><span class="muted">show</span> <span id="jb-chips"></span> <label class="jb__goal">weekly goal <select id="jb-goalsel"><option>3</option><option>5</option><option>8</option><option>10</option><option>15</option></select></label></div>
<div id="jb-list" class="jb__list"></div>
<p class="jb__tools"><button class="btn" id="jb-export" type="button">[ export json ]</button> <button class="btn" id="jb-csv" type="button">[ export csv ]</button> <button class="btn" id="jb-import" type="button">[ import json ]</button> <input type="file" id="jb-file" accept="application/json" hidden></p>
</div>
<p class="muted small">Related: <a href="bullets.html">~/bullets</a> (match your resume to a posting) · <a href="resume.html">~/resume</a> · <a href="interview.html">~/interview</a> · <a href="start.html">~/start</a></p>'''
    page("jobs.html", "jobs :: 0xDay", body, cur="lab", head=head, desc="Browser-only job application tracker with follow-up reminders.")

    # ---------- ~/bullets ----------
    items, roles, skills = bank()
    kw = {k: {"a": v[0], "g": v[1]} for k, v in KEYWORDS.items()}
    data = json.dumps({"items": items, "roles": roles, "skills": skills, "kw": kw}, separators=(",", ":")).replace("</", "<\\/")
    head = _assets("bullets")
    rchips = "".join(f'<button class="btn btn--sm bl__chip" type="button" data-role="{esc(r["key"])}" aria-pressed="{"true" if r["key"] == "all" else "false"}">{esc(r["label"])}</button> ' for r in roles)
    body = f'''<p class="cmd">grep -ri "$KEYWORDS" ~/resume</p><h1>~/bullets</h1>
<p>Every bullet on the resume in one place, built from the same data as <a href="resume.html">~/resume</a>, so the two cannot disagree. Paste a job posting and it ranks the bullets that fit and lists the keywords the resume doesn't cover yet, with a guide to study for each. It only reorders what is true: don't add a claim you couldn't defend in an interview.</p>
<noscript><p class="callout">The bullet bank needs JavaScript.</p></noscript>
<div id="bl" class="bl">
<h2># match a posting</h2>
<label class="bl__wide">paste the job description (stays in this page, nothing is sent)<textarea id="bl-jd" rows="6" placeholder="Paste the posting here..."></textarea></label>
<div id="bl-match" class="bl__match" aria-live="polite"></div>
<h2># the bank</h2>
<div class="bl__bar"><span class="muted">view</span> {rchips}<input type="search" id="bl-q" placeholder="filter..." aria-label="filter bullets"></div>
<ul id="bl-list" class="bl__list"></ul>
<h2># my pick <span class="muted small" id="bl-count"></span></h2>
<p class="muted small">Add bullets with [+], then copy the set into an application or a tailored resume. Order is the order you added them.</p>
<ol id="bl-pick" class="bl__pick"></ol>
<p><button class="btn" id="bl-copy" type="button">[ copy picks ]</button> <button class="btn" id="bl-clear" type="button">[ clear ]</button> <span class="muted small" id="bl-msg" role="status"></span></p>
<h2># writing a good one</h2>
<ul class="bl__tips"><li>Lead with a strong verb: built, configured, investigated, reconstructed, automated.</li>
<li>Then the thing, then the tool, then the outcome if you truly have one.</li>
<li>Numbers only when real. "7-VM environment" is a number you can defend; an invented percentage is not.</li>
<li>One line each. If the interviewer asks "tell me more" and you can't, cut the bullet.</li></ul>
</div>
<script type="application/json" id="bl-data">{data}</script>
<p class="muted small">Related: <a href="jobs.html">~/jobs</a> · <a href="resume.html">~/resume</a> · <a href="interview.html">~/interview</a> · <a href="start.html">~/start</a></p>'''
    page("bullets.html", "bullets :: 0xDay", body, cur="lab", head=head, desc="Resume bullet bank with a job-posting keyword matcher.")
    return {"steps": nsteps, "bullets": len(items), "stages": [{"id": s["id"], "name": s["name"], "n": len(s["steps"])} for s in stages]}
