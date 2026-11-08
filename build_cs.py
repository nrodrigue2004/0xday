"""~/cs: computer-science core chapters (CS201 data structures and algorithms in depth, CS240 software engineering)
and the algorithm visualizer ~/cs/viz. Called from build.py as build_cs.build(page) BEFORE build_chat so the chatbot indexes it.

Chapters live in content/cs/<slug>.txt, same format as ~/basics (see build_learn.py). Courses CS201 and CS240 in
content/courses.json link to these pages. vizalgo.js holds the algorithms (tested by scripts/check_viz.js), viz.js draws them.
Standard library only.
"""
import os, html, hashlib
import build_learn as L

esc = html.escape
CHAPTERS = [
    ("sorting", "sorting algorithms", "CS201", "Six classic sorts, stability, the n log n lower bound, counting and radix sort. Lab: count comparisons"),
    ("hashing", "hash tables and hashing", "CS201", "Collisions, chaining vs probing, load factor, Bloom filters, hash flooding. Lab: find the crowded bucket"),
    ("trees", "trees, heaps and tries", "CS201", "BST, AVL and red-black balance, heaps, tries, B-trees and traversals. Lab: measure a degenerate tree"),
    ("graphs", "graphs", "CS201", "BFS, DFS, topological sort, Dijkstra, union-find, spanning trees, attack-path graphs. Lab: fastest route"),
    ("dp", "dynamic programming, greedy and backtracking", "CS201", "The five-step DP recipe, coin change, LCS, knapsack, greedy proofs. Lab: where greedy fails"),
    ("analysis", "algorithm analysis and proofs", "CS201", "Big-O, Omega, Theta, recurrences, master theorem, amortized cost, loop invariants, NP-completeness"),
    ("testing", "software testing", "CS240", "Test pyramid, TDD, mocks, coverage, property tests and fuzzing. Lab: find the boundary bug"),
    ("patterns", "design patterns and SOLID", "CS240", "SOLID, strategy, observer, factory, builder, decorator, dependency injection, UML basics"),
    ("cicd", "git workflows, CI/CD and DevSecOps", "CS240", "Branching, GitHub Actions pipelines, deployment strategies, securing the pipeline. Lab: fix the deploy gate"),
    ("agile", "requirements, agile and teamwork", "CS240", "Waterfall vs agile, user stories, Scrum and Kanban, estimation, code review, technical debt"),
    ("architecture", "architecture and the secure SDLC", "CS240", "Layers, monolith vs microservices, scaling, reliability, threat modeling with STRIDE"),
]
HOWMAP = {"shell": ("sandbox shell", "Solve it in the sandbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it.")}
COURSE = {"CS201": "data structures and algorithms in depth", "CS240": "software engineering"}


def build(page):
    os.makedirs("cs", exist_ok=True)
    chs = [(s, n, c, b, L.parse_guide(open(f"content/cs/{s}.txt").read())) for s, n, c, b in CHAPTERS]
    for i, (slug, name, course, blurb, g) in enumerate(chs):
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
        body = f'''<p class="cmd">cs --chapter {slug}</p>
<h1>~/cs/{slug}</h1>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<p class="muted small">{course}: {COURSE[course]} · <a href="../courses/{course}.html">course page with quizzes and exam</a></p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="cs-{slug}">
<div class="learn__doc">{secs}{pager}<p><a href="../cs.html">cd ~/cs</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"cs/{slug}.html", f"{name} :: ~/cs :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"Computer science, {name}: {blurb}.")
    rows = "".join(
        f'''<li class="guiderow" data-skill="cs-{s}"><a class="ls-row" href="cs/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(n)} <span class="muted small">{c} · {esc(b)}</span></span><span class="ls-tags">{"lab" if g["lab"].get("brief") else "read"}</span></a></li>'''
        for s, n, c, b, g in chs)
    page("cs.html", "cs :: 0xDay", f'''<p class="cmd">ls ~/cs</p><h1>~/cs</h1>
<p>Computer science depth for the technical screen and the job: <strong>CS201</strong> data structures and algorithms (sorting, hashing, trees, graphs, dynamic programming, proofs of cost) and <strong>CS240</strong> software engineering (testing, patterns, CI/CD, agile, architecture and the secure SDLC). Each chapter goes simple, mid, complex, and most end in a hands-on lab. Course pages: <a href="courses/CS201.html">CS201</a> and <a href="courses/CS240.html">CS240</a> (module quizzes and a final exam).</p>
<p><a class="btn" href="cs/viz.html">[ open the algorithm visualizer ]</a> <span class="muted small">sorting, BFS/DFS/Dijkstra, DP tables, hash tables, BST/AVL/heaps</span></p>
<ul class="ls guides">{rows}</ul>
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read (plus lab solved). Saved in your browser. Interview angle: <a href="interview/technical.html">~/interview technical screen</a>.</p>''',
         cur="learn", scripts=("learn.js",), desc="Computer science depth: sorting, hashing, trees, graphs, dynamic programming, algorithm analysis, testing, design patterns, CI/CD, agile and architecture.")

    ver = hashlib.sha1((open("viz.css").read() + open("viz.js").read() + open("vizalgo.js").read()).encode()).hexdigest()[:8]
    tabs = [("sort", "sorting"), ("graph", "graphs"), ("dp", "dynamic programming"), ("hash", "hash tables"), ("tree", "trees and heaps")]
    page("cs/viz.html", "algorithm visualizer :: ~/cs :: 0xDay", f'''<p class="cmd">./viz --step</p><h1>~/cs/viz</h1>
<p>Step through the algorithms from <a href="../cs.html">CS201</a> one comparison at a time. Every run is computed in your browser; pause, step back, and change the input to see best and worst cases.</p>
<div id="viz">
<div class="vz__tabs" role="tablist">{"".join(f'<button class="vz__tab" role="tab" type="button" data-tab="{k}" aria-selected="false">{v}</button>' for k, v in tabs)}</div>
{"".join(f'<section class="vz__panel" data-tab="{k}" hidden role="tabpanel"></section>' for k, _ in tabs)}
<noscript><p>The visualizer needs JavaScript.</p></noscript>
</div>
<p class="muted small">Related: <a href="../bigo.html">~/bigo growth chart</a>, <a href="../learn/data-structures-and-algorithms.html">data structures guide</a>, <a href="../dojo.html">dojo</a>.</p>''',
         depth=1, cur="learn", head=f'\n<link rel="stylesheet" href="../viz.css?v={ver}">\n<script src="../vizalgo.js?v={ver}" defer></script>\n<script src="../viz.js?v={ver}" defer></script>',
         desc="Algorithm visualizer: step through sorting, BFS, DFS, Dijkstra, dynamic programming tables, hash tables, BSTs, AVL trees and heaps in the browser.")
    return chs
