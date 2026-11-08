"""~/ai: the AI and AI-in-security section. Called from build.py. Standard library only.

Chapters live in content/ai/<slug>.txt and use the same format as the ~/learn guides
(simple / mid / complex tiers, optional hands-on lab), see build_learn.py.
The reading list is content/ai/news.json (hand-curated and dated, the site is static).
Order and blurbs are in CHAPTERS below.
"""
import json, os, html
import build_learn as L

esc = html.escape
CHAPTERS = [
    ("ai-history", "history", "From the 1956 Dartmouth workshop to LLMs, and the security timeline alongside it"),
    ("how-ai-works", "how it works", "Tokens, training, RAG and agents, plus classical ML, at three depths"),
    ("ml-intro", "what is ML", "Start here: what machine learning is, in plain English, with a spam filter, overfitting and the confusion matrix. Lab: count words"),
    ("ml-math", "ML math refresher", "Vectors, dot products, matrices and gradients in one short chapter, with Python"),
    ("ml-regression", "regression", "Fit a line, gradient descent, train and test splits, overfitting"),
    ("ml-classifiers", "classifiers", "Logistic regression, trees, forests, naive Bayes and a small neural net"),
    ("ml-evaluation", "evaluating models", "Confusion matrix, precision and recall, the base-rate trap. Lab: read a classifier honestly"),
    ("ai-chatbot", "the chatbot", "How ~/ai/chat works: search over this site, optional local model, and why it can still be wrong"),
    ("pe-basics", "prompts: basics", "What a prompt is, the five parts of a good one, and why vague ones fail. Lab: grade three versions"),
    ("pe-patterns", "prompts: patterns", "Few-shot examples, roles and structured output. Lab: find the answer that breaks the schema"),
    ("pe-reasoning", "prompts: reasoning and testing", "Step by step, eval sets, iterating, common failures. Lab: compare two versions on the same cases"),
    ("pe-security", "prompts: security", "Injection, jailbreaks and leakage from the defender's side. Lab: review a support bot's design"),
    ("ai-for-defense", "AI for defense", "Where AI helps a SOC, how to run it safely. Lab: audit an AI triage summary"),
    ("ai-for-attackers", "AI for attackers", "Phishing, deepfakes, recon, and what to change in your defenses"),
    ("attacking-ai", "attacking AI", "Prompt injection, poisoning, leaks, agents. Lab: trace a hijacked assistant"),
    ("ai-future", "the future", "Trends, scenarios and signposts, labeled as opinion"),
    ("ai-use-it-well", "using it well", "As a learner and on the job: prompts, verification, data handling"),
]


def load():
    out = []
    for slug, name, blurb in CHAPTERS:
        g = L.parse_guide(open(f"content/ai/{slug}.txt").read())
        out.append((slug, name, blurb, g))
    return out


def build(page):
    os.makedirs("ai", exist_ok=True)
    chs = load()
    HOW = L.build.__globals__  # unused; keeps imports explicit
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
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else '<a href="news.html">reading list &gt;</a>') + "</nav>"
        body = f'''<p class="cmd">ai --chapter {slug}</p>
<h1>~/ai/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{sid}">
<div class="learn__doc">{secs}{pager}<p><a href="../ai.html">cd ~/ai</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"ai/{slug}.html", f"{name} :: ~/ai :: 0xDay", body, depth=1, cur="ai", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",),
             desc=f"AI and security, {name}: {blurb}.")

    # ---------- reading list ----------
    news = json.load(open("content/ai/news.json"))
    secs = ""
    for s in news["sections"]:
        rows = ""
        for it in s["items"]:
            date = f'<span class="ls-perm">{esc(it["date"])}</span>' if it.get("date") else '<span class="ls-perm">ongoing</span>'
            rows += (f'<li><a class="ls-row" href="{esc(it["url"])}" rel="noopener"><span class="ls-title">{date} {esc(it["title"])}</span>'
                     f'<span class="ls-tags">{esc(it["source"])}</span></a><p class="muted small">{esc(it["note"])}</p></li>')
        secs += f'<h2># {esc(s["name"])}</h2><p class="muted small">{esc(s["blurb"])}</p><ul class="ls">{rows}</ul>'
    page("ai/news.html", "AI security reading list :: 0xDay", f'''<p class="cmd">cat ~/ai/news</p><h1>~/ai/news</h1>
<p class="callout">{esc(news["note"])} Last curated {esc(news["updated"])}.</p>
{secs}
<nav class="pager"><a href="ai-use-it-well.html">&lt; using it well</a><span></span></nav>
<p><a href="../ai.html">cd ~/ai</a></p>''', depth=1, cur="ai", desc="Curated, dated reading list for AI and AI security. Not a live feed.")

    # ---------- hub ----------
    rows = "".join(
        f'<li class="guiderow" data-skill="{s}"><a class="ls-row" href="ai/{s}.html"><span class="ls-perm gprog">[----]</span>'
        f'<span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{g["lab"].get("style", "read") if g["lab"].get("brief") else "read"}</span></a></li>'
        for s, n, b, g in chs)
    page("ai.html", "ai :: 0xDay", f'''<p class="cmd">ls ~/ai</p><h1>~/ai</h1>
<p>Artificial intelligence and AI in cybersecurity: where it came from, how it works, how defenders and attackers use it, how it gets attacked, where it is going, and how to use it well. Each chapter goes <strong>simple → mid → complex</strong>, and several end in a hands-on lab. The five machine-learning chapters are course <a href="courses/CS330.html">CS330</a>, and the four prompt engineering chapters are <a href="courses/AI310.html">AI310</a>.</p>
<p class="muted small">Written by me, in my own words, and dated {esc(news["updated"])}. Forecasts are labeled as opinion. Anything time-sensitive lives on the <a href="ai/news.html">reading list</a>, which is hand-curated, not a live feed.</p>
<div class="hub"><a class="tile" href="ai/chat.html"><span class="tile__k">./chat</span><span class="tile__v">ask the site, with sources</span><span class="tile__n">browser-only assistant</span></a>
<a class="tile" href="ai/ml-lab.html"><span class="tile__k">./ml-lab</span><span class="tile__v">train a model in your browser</span><span class="tile__n">playground</span></a>
<a class="tile" href="ai/pe-basics.html"><span class="tile__k">./prompts</span><span class="tile__v">prompt engineering, simple to advanced</span><span class="tile__n">4 chapters, 4 labs</span></a>
<a class="tile" href="ai/news.html"><span class="tile__k">./news</span><span class="tile__v">dated reading list</span><span class="tile__n">curated by hand</span></a>
<a class="tile" href="ai/ai-for-defense.html"><span class="tile__k">./triage-lab</span><span class="tile__v">catch what the AI summary left out</span><span class="tile__n">ticket lab</span></a>
<a class="tile" href="ai/attacking-ai.html"><span class="tile__k">./injection-lab</span><span class="tile__v">trace a hijacked assistant</span><span class="tile__n">shell lab</span></a></div>
<h2># chapters</h2><ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = simple, mid, complex read + lab solved (if any). Saved in your browser.</p>''',
         cur="ai", scripts=("learn.js",), desc="AI and AI in cybersecurity: history, how it works, defense, offense, attacks on AI, the future and how to use it well.")
    return chs
