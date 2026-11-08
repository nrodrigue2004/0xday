"""~/langs (programming languages, compilers, theory of computation) and ~/rev (extra reverse engineering, malware and
binary exploitation labs). Called from build.py as build_langs.build(page, SHEETS) -> (LANGS, REV). Standard library only.

Chapters live in content/langs/<slug>.txt and content/rev/<slug>.txt, same format as the ~/learn guides (see build_learn.py).
Order, blurbs and the course each chapter belongs to are in SECTIONS below. A chapter's :: ref is merged into the cheatsheet named
by "sheet:" in its header (made if missing). The courses CS340, CS310, CS301, MAL300 and EXP400 (content/courses.json) link here.
Everything is a toy: made-up programs, fictional sample files, no working malware and no real targets.
"""
import os, html
import build_learn as L

esc = html.escape
SECTIONS = {
    "langs": {
        "title": "langs", "dir": "langs", "cmd": "langs --chapter",
        "lead": ("Programming languages, how compilers work, and the theory underneath. The three courses it feeds are "
                 "<a href=\"courses/CS340.html\">CS340</a>, <a href=\"courses/CS310.html\">CS310</a> and <a href=\"courses/CS301.html\">CS301</a>. "
                 "Each chapter goes <strong>simple, mid, complex</strong> and ends in a hands-on lab, most of them real Python that runs in your browser."),
        "after": ("Why a security person cares: parsers are where input becomes behavior, and most injection bugs are a parser confusion. "
                  "Reverse engineering is decompiling what a compiler did. Detection rules and regexes are automata. Pair it with "
                  "<a href=\"code.html\">~/code</a> for the practical scripting side and <a href=\"rev.html\">~/rev</a> for what the compiler's output looks like."),
        "groups": [
            ("CS340 Programming languages", [
                ("paradigms", "paradigms", "imperative, object-oriented, functional and declarative: what each one is good at"),
                ("types", "types", "static or dynamic, strong or weak, and the bug classes each one allows"),
                ("scope", "scope and closures", "names, binding, lifetimes and why a closure remembers"),
                ("functional", "functional programming", "pure functions, map, filter, fold, recursion and immutability"),
            ]),
            ("CS310 Compilers", [
                ("compiler-pipeline", "source to machine code", "lexer, parser, tree, IR, optimizer, code generator, linker"),
                ("lexer", "the lexer", "turn characters into tokens and report where it went wrong"),
                ("parser", "grammars and the parser", "recursive descent, precedence and the abstract syntax tree"),
                ("interpreter", "a tiny interpreter", "evaluate the tree, then run a whole calculator language"),
            ]),
            ("CS301 Theory of computation (optional)", [
                ("automata", "automata and regex", "DFAs, regular languages and why a regex cannot count"),
                ("computability", "grammars, Turing machines and limits", "context-free grammars, the halting problem and what NP means"),
            ]),
        ],
        "sheet": ("langs", "Languages and compilers: grammar notation, types, parsing terms and Python idioms for interpreters"),
    },
    "rev": {
        "title": "rev", "dir": "rev", "cmd": "rev --lab",
        "lead": ("More practice for <a href=\"courses/MAL300.html\">MAL300</a> (reverse engineering and malware) and "
                 "<a href=\"courses/EXP400.html\">EXP400</a> (binary exploitation). The main guides are in <a href=\"learn.html\">~/learn</a>: "
                 "<a href=\"learn/malware-analysis.html\">malware analysis</a>, <a href=\"learn/reverse-engineering.html\">reverse engineering</a>, "
                 "<a href=\"learn/binary-exploitation.html\">binary exploitation</a>. These chapters add labs, one per technique."),
        "after": ("Everything here is a toy. The programs are made up, the samples are fictional text, and no chapter ships a working "
                  "exploit, shellcode or malware. The point is to read what a defender sees: logs, disassembly, crash state and mitigations. "
                  "Run real samples only in an isolated VM with no shared folders and no route to your network."),
        "groups": [
            ("MAL300 Reverse engineering and malware (extra labs)", [
                ("dynamic-analysis", "dynamic analysis", "run it in a sandbox and read what it touched: files, registry, network"),
                ("unpacking", "packers and unpacking", "entropy, stubs, the original entry point and how to tell a packed file"),
                ("re-crackme", "reading a check function", "x86 listing to source: recover the logic of a license check"),
            ]),
            ("EXP400 Binary exploitation (toy programs only)", [
                ("format-strings", "format strings", "when user input is the format: leaking the stack and why it is fixed"),
                ("mitigations", "mitigations", "NX, stack canaries, ASLR, PIE and RELRO: what each stops and what it does not"),
                ("rop-basics", "ROP concepts", "why return-oriented programming exists and how a defender spots it"),
            ]),
        ],
        "sheet": ("rev", "Reverse engineering and exploitation: triage commands, dynamic-analysis tools, checksec and gdb"),
    },
}
HOW = {"shell": ("sandbox shell", "Solve it in the sandbox. Every <span class=\"ok\">▶ run</span> above works on the same lab files. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it."),
       "debug": ("debugger", "This one runs in a step-through debugger. <code>start</code>, then <code>step</code> / <code>back</code> through the code and watch the variables change, or set a <code>break</code> and <code>continue</code>. <code>submit &lt;answer&gt;</code> when you have it."),
       "ticket": ("ticket queue", "Open the attachments, investigate in the console, then resolve the ticket with your answer. Hints cost points.")}


def flat(sec):
    return [(s, n, b, gname) for gname, items in sec["groups"] for s, n, b in items]


def build_section(key, page, SHEETS):
    sec = SECTIONS[key]; d = sec["dir"]
    os.makedirs(d, exist_ok=True)
    chs = [(s, n, b, gname, L.parse_guide(open(f"content/{d}/{s}.txt").read())) for s, n, b, gname in flat(sec)]
    tgt, summ = sec["sheet"]
    for s, n, b, gname, g in chs:
        if not g.get("ref"): continue
        name = g["meta"].get("sheet", tgt)
        sh = next((x for x in SHEETS if x["slug"] == name), None)
        if sh is None:
            sh = {"slug": name, "name": name, "section": "7", "category": "skills", "summary": summ, "groups": []}
            SHEETS.append(sh)
        have = {x["title"].lower() for x in sh["groups"]}
        sh["groups"] += [x for x in g["ref"] if x["title"].lower() not in have]
    for i, (slug, name, blurb, gname, g) in enumerate(chs):
        lab = L.lab_json(g, slug, name)
        tiers = [t for t in L.TIERS[:3] if t[0] in g["tiers"]] + ([L.TIERS[3]] if lab else [])
        nav = "".join(f'<a href="#tier-{n}" class="tier" data-tier="{k}"><span class="tier__n">{n}</span>{lbl}</a>' for k, n, lbl, _ in tiers)
        secs = ""
        for k, n, lbl, sub in L.TIERS[:3]:
            if k in g["tiers"]:
                secs += (f'<section class="lvl" id="tier-{n}" data-tier="{k}"><h2><span class="lvl__n">0{n}</span> {lbl} <span class="muted">// {sub}</span></h2>'
                         f'{L.md(g["tiers"][k])}<p><button class="btn got" type="button" data-tier="{k}">[ ] got it</button></p></section>')
        if lab:
            how = HOW[g["lab"].get("style", "shell")]
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {how[0]}</span></h2>'
                     f'{L.md(g["lab"]["brief"])}<p class="muted">{how[1]}</p></section>')
        if g.get("ref"):
            secs += L.ref_html(g, slug)
            nav += '<a href="#ref" class="tier tier--ref" data-tier="ref"><span class="tier__n">+</span>ref</a>'
        src = g["meta"].get("sources")
        srch = f'<section class="lvl" id="sources"><h2><span class="lvl__n">src</span> further reading <span class="muted">// read these, not just me</span></h2><p>{L.inline(src)}</p></section>' if src else ""
        pv = chs[i - 1] if i else None
        nx = chs[i + 1] if i + 1 < len(chs) else None
        pager = '<nav class="pager">' + (f'<a href="{pv[0]}.html">&lt; {esc(pv[1])}</a>' if pv else "<span></span>") + (f'<a href="{nx[0]}.html">{esc(nx[1])} &gt;</a>' if nx else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">{sec["cmd"]} {slug}</p>
<h1>~/{d}/{slug}</h1>
<p class="learn__meta"><span class="muted">{esc(gname)}</span></p>
<p>{L.inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{slug}">
<div class="learn__doc">{secs}{srch}{pager}<p><a href="../{d}.html">cd ~/{d}</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"{d}/{slug}.html", f"{name} :: ~/{d} :: 0xDay", body, depth=1, cur="learn", htmlcls="wide" if lab else "",
             scripts=("sandbox.js", "learn.js") if lab else ("learn.js",), desc=f"{sec['title']}, {name}: {blurb}. Simple, mid and complex levels plus a hands-on lab.")
    rows = ""
    for gname, items in sec["groups"]:
        rows += f"<h2># {esc(gname)}</h2><ul class=\"ls guides\">"
        for s, n, b in items:
            g = next(c[4] for c in chs if c[0] == s)
            style = g["lab"].get("style", "shell") if g["lab"].get("brief") else "read"
            rows += (f'<li class="guiderow" data-skill="{s}"><a class="ls-row" href="{d}/{s}.html"><span class="ls-perm gprog">[----]</span>'
                     f'<span class="ls-title">{esc(n)} <span class="muted small">{esc(b)}</span></span><span class="ls-tags">{style}</span></a></li>')
        rows += "</ul>"
    page(f"{d}.html", f"{sec['title']} :: 0xDay", f'''<p class="cmd">ls ~/{d}</p><h1>~/{d}</h1>
<p>{sec["lead"]}</p>
{rows}
<p class="muted small">progress: <span class="bar__on">[####]</span> = all levels read and the lab solved. Saved in your browser. Courses with quizzes and exams: <a href="courses.html">~/courses</a>.</p>
<p class="muted small">{sec["after"]}</p>''', cur="learn", scripts=("learn.js",),
         desc=f"{sec['title']}: " + "; ".join(b for _, _, b, _ in flat(sec)[:3]) + ", with browser labs.")
    return [(s, n, b, gname) for s, n, b, gname, g in chs]


def build(page, SHEETS):
    return build_section("langs", page, SHEETS), build_section("rev", page, SHEETS)
