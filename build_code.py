"""~/code: the programming and scripting path. Called from build.py as build_code.build(page, SHEETS).
Chapters live in content/code/<slug>.txt (same format as the ~/learn guides, see build_learn.py).
Each chapter's :: ref is merged into the cheatsheet named by its "sheet:" header, so the commands also
live on ~/man. Chapters link out to the existing guide, dojo language and Big-O page instead of repeating them.
Returns the chapter list [(slug, name, blurb, parsed)]."""
import os, html
import build_learn as L

esc = html.escape
# slug, name, blurb, stage label, [(label, href)] related pages (hrefs relative to the site root)
CHAPTERS = [
    ("python-automation", "Python for automation", "read logs, parse JSON, enrich with an API, write a tool that exits cleanly", "1 · script",
     [("python guide", "learn/python.html"), ("python dojo", "dojo/python.html")]),
    ("bash-automation", "Bash pipelines and scripts", "grep, awk, sort, uniq, loops, set -euo pipefail, cron", "2 · shell",
     [("bash guide", "learn/bash-scripting.html"), ("bash dojo", "dojo/bash.html"), ("linux guide", "learn/linux-command-line.html")]),
    ("powershell-automation", "PowerShell for admins", "object pipelines, event logs, CSV, Invoke-RestMethod, functions", "3 · windows",
     [("powershell guide", "learn/windows-admin-powershell.html"), ("powershell dojo", "dojo/powershell.html")]),
    ("sql-for-analysts", "SQL for analysts", "group, join and count your way through an alert table", "4 · data",
     [("sql guide", "learn/sql.html"), ("sql dojo", "dojo/sql.html"), ("databases guide", "learn/databases-and-sql.html")]),
    ("git-for-scripts", "Git for your scripts", "history, blame, bisect, secrets and guardrails for automation", "5 · history",
     [("git guide", "learn/git-github.html")]),
    ("data-structures-in-practice", "Data structures in practice", "dict, set, deque and heap solving real detection problems", "6 · structures",
     [("data structures guide", "learn/data-structures-and-algorithms.html"), ("big-o", "bigo.html"), ("python dojo", "dojo/python.html")]),
]
HOW = ("sandbox shell", "Solve it in the sandbox. Every <span class=\"ok\">▶ run</span> above works on the same lab files. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it.")


def build(page, SHEETS):
    os.makedirs("code", exist_ok=True)
    chs = [(s, n, b, L.parse_guide(open(f"content/code/{s}.txt").read()), st, rel) for s, n, b, st, rel in CHAPTERS]
    L.merge_sheets(SHEETS, {s: ({"name": n}, "code", g) for s, n, b, g, st, rel in chs})
    for i, (slug, name, blurb, g, stage, rel) in enumerate(chs):
        lab = L.lab_json(g, slug, name)
        tiers = [t for t in L.TIERS[:3] if t[0] in g["tiers"]] + ([L.TIERS[3]] if lab else [])
        nav = "".join(f'<a href="#tier-{n}" class="tier" data-tier="{key}"><span class="tier__n">{n}</span>{lbl}</a>' for key, n, lbl, _ in tiers)
        secs = ""
        for key, n, lbl, sub in L.TIERS[:3]:
            if key in g["tiers"]:
                secs += (f'<section class="lvl" id="tier-{n}" data-tier="{key}"><h2><span class="lvl__n">0{n}</span> {lbl} <span class="muted">// {sub}</span></h2>'
                         f'{L.md(g["tiers"][key])}<p><button class="btn got" type="button" data-tier="{key}">[ ] got it</button></p></section>')
        if lab:
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {HOW[0]}</span></h2>'
                     f'{L.md(g["lab"]["brief"])}<p class="muted">{HOW[1]}</p></section>')
        if g.get("ref"):
            secs += L.ref_html(g, slug)
            nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        related = " · ".join(f'<a href="../{h}">{esc(l)}</a>' for l, h in rel)
        body = f'''<p class="cmd">code --stage {slug}</p>
<h1>~/code/{slug}</h1>
<p class="learn__meta"><span class="muted">stage {esc(stage)}</span> · practice with: {related}</p>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../code.html">cd ~/code</a></p></div>
<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>
</div>
<script type="application/json" id="lab-data">{lab}</script>'''
        page(f"code/{slug}.html", f"{name} :: ~/code :: 0xDay", body, depth=1, cur="learn", htmlcls="wide",
             scripts=("sandbox.js", "learn.js"), desc=f"Programming path, {name}: {blurb}. Simple, mid and complex levels plus a hands-on lab.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="{s}"><a class="ls-row" href="code/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(st)} · {esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">lab</span></a></li>'''
        for s, n, b, g, st, rel in chs)
    page("code.html", "code :: 0xDay", f'''<p class="cmd">ls ~/code</p><h1>~/code</h1>
<p>A practice path for the programming a security job actually uses: Python, shell, PowerShell, SQL, git and the data structures behind detection logic. Every chapter has three levels (<strong>simple, mid, complex</strong>), a hands-on lab in the browser, and its commands on the <a href="man.html">cheatsheets</a>.</p>
<p>Each lab is a small piece of real work: parse an auth log, enrich alerts with an API response, rank assets in an IDS table, find the commit that deleted the logs, write a sliding-window brute-force detector. Do them in order, or jump to whichever language the job post asks for.</p>
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read and the lab solved. Saved in your browser.</p>
<h2>pair it with</h2>
<ul class="arrow">
<li><a href="dojo.html">~/dojo</a>: daily katas in nine languages. Chapters here teach the task, the dojo is the reps.</li>
<li><a href="bigo.html">~/bigo</a>: why a set beats a list and a window beats a counter. The cost tables behind stage 6.</li>
<li><a href="learn.html">~/learn</a>: the full guides for each language and tool, and <a href="drills.html">~/drills</a> for log, regex and permission labs.</li>
<li><a href="man.html">~/man</a>: the commands from every chapter, as man pages.</li>
</ul>
<p class="muted small">Scripts here run against made-up logs and public example IPs only. Never point automation at systems or APIs you are not allowed to use, and keep keys in the environment, not the file.</p>''',
         cur="learn", scripts=("learn.js",), desc="A programming and scripting path for security work: Python, Bash, PowerShell, SQL, git and data structures, with browser labs.")
    return chs
