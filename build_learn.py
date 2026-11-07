"""~/learn: skill guides (content/guides/*.txt) and the Security+ study section (content/secplus/).
Called from build.py. Only uses the standard library.

Guide file format (content/guides/<skill-slug>.txt):

    tagline: one line under the title
    :: simple            # tiers: simple, mid, complex. Light markdown inside.
    text, `code`, **bold**, [link](url), "- " lists, "> " callouts, "### " subheads
    ```
    $ grep "Failed" auth.log      <- lines starting with "$ " get a run button that types into the sandbox
    output lines are shown dimmed
    ```
    :: mid / :: complex
    :: lab               # optional key: value lines: host, user, cwd, js (yes), py (yes: real Python via Pyodide)
    :: brief             # the challenge (markdown)
    :: answer            # one accepted answer per line (case/space-insensitive, only hashes ship)
    :: hint              # repeat for more hints, given in order
    :: solution          # walkthrough shown after solving
    :: file /home/user/x.log
    :: cmd REGEX         # canned output for a simulated tool, matched against each pipeline stage
    :: verify            # not published: commands that solve the lab (used by tests)
    :: sql               # SQL run into an in-browser SQLite db (enables sqlite3)
    :: trace             # debug style: one step per line: "<source line> | var=val var=val | optional output"

Lab styles (":: lab" key "style"), picked per skill:
    shell   (default) a sandbox terminal
    ticket  a help-desk/SOC ticket: keys id, subject, priority, from, sla, system, attach (comma list of file names);
            files become attachments, there's a console, and the answer resolves the ticket. Hints cost points.
    debug   a gdb-style stepper: key source (path of a :: file); :: trace lists each step's line and variables
"""
import json, os, re, hashlib, base64, html

esc = html.escape


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", "and").replace("+", "plus")).strip("-")


def inline(s):
    out, parts = [], re.split(r"(`[^`]+`)", s)
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append(f"<code>{esc(p[1:-1])}</code>")
        else:
            t = esc(p, quote=False)
            t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
            t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
            out.append(t)
    return "".join(out)


def md(src):
    """tiny markdown: paragraphs, lists, callouts, ### heads, fenced code with runnable $ lines"""
    L, o, i = src.strip("\n").split("\n"), [], 0
    while i < len(L):
        l = L[i]
        if l.startswith("```"):
            lang = l[3:].strip(); i += 1; rows = []
            while i < len(L) and not L[i].startswith("```"):
                r = L[i]
                if r.startswith("$ "):
                    c = r[2:]
                    rows.append(f'<span class="ps">$</span> <span class="c">{esc(c)}</span><button class="run" type="button" data-cmd="{esc(c)}" title="run in the sandbox">▶ run</button>')
                elif r.startswith("# ") and lang != "code":
                    rows.append(f'<span class="cm">{esc(r)}</span>')
                else:
                    rows.append(f'<span class="o">{esc(r)}</span>' if lang != "code" else esc(r))
                i += 1
            o.append(f'<pre class="ex{" ex--code" if lang == "code" else ""}"><code>' + "\n".join(rows) + "</code></pre>")
            i += 1; continue
        if not l.strip():
            i += 1; continue
        if l.startswith("### "):
            o.append(f"<h4>{inline(l[4:])}</h4>"); i += 1; continue
        if l.startswith("- "):
            items = []
            while i < len(L) and L[i].startswith("- "):
                items.append(L[i][2:]); i += 1
                while i < len(L) and L[i].startswith("  ") and L[i].strip():
                    items[-1] += " " + L[i].strip(); i += 1
            o.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>"); continue
        if l.startswith("> "):
            buf = []
            while i < len(L) and L[i].startswith("> "):
                buf.append(L[i][2:]); i += 1
            o.append(f'<p class="callout">{inline(" ".join(buf))}</p>'); continue
        buf = []
        while i < len(L) and L[i].strip() and not L[i].startswith(("```", "- ", "> ", "### ")):
            buf.append(L[i]); i += 1
        o.append(f"<p>{inline(' '.join(buf))}</p>")
    return "\n".join(o)


def norm_answer(s):
    s = s.strip().lower()
    s = re.sub(r'^["\']|["\']$', "", s)
    return re.sub(r"\s+", " ", s)


def parse_guide(text):
    g = {"meta": {}, "tiers": {}, "lab": {"fs": {}, "cmds": [], "hints": [], "answers": [], "cmdnames": []}}
    cur, arg, buf = None, None, []

    def flush():
        body = "\n".join(buf).strip("\n")
        lab = g["lab"]
        if cur is None:
            for l in buf:
                if ":" in l:
                    k, v = l.split(":", 1); g["meta"][k.strip()] = v.strip()
        elif cur in ("simple", "mid", "complex"):
            g["tiers"][cur] = body
        elif cur == "lab":
            for l in buf:
                if ":" in l:
                    k, v = l.split(":", 1); lab[k.strip()] = v.strip()
        elif cur == "brief": lab["brief"] = body
        elif cur == "answer": lab["answers"] += [norm_answer(x) for x in body.split("\n") if x.strip()]
        elif cur == "hint": lab["hints"].append(body)
        elif cur == "solution": lab["solution"] = body
        elif cur == "file": lab["fs"][arg] = "\n".join(buf).strip("\n") + "\n"
        elif cur == "cmd":
            lab["cmds"].append({"re": arg, "out": "\n".join(buf).strip("\n")})
            name = re.sub(r"^\^", "", arg).split("\\")[0].split(" ")[0].split("(")[0]
            if name and re.match(r"^[\w.-]+$", name) and name not in lab["cmdnames"]: lab["cmdnames"].append(name)
        elif cur == "sql": lab["sql"] = body
        elif cur == "verify": g["verify"] = [l for l in buf if l.strip()]  # test-only: commands that solve the lab
        elif cur == "trace":
            tr = []
            for l in buf:
                if not l.strip() or l.startswith("#"): continue
                parts = [x.strip() for x in l.split(" | ")]
                vars_ = {m.group(1): m.group(2).strip('"') for m in re.finditer(r'([\w$\[\].>-]+)=("[^"]*"|\S+)', parts[1] if len(parts) > 1 else "")}
                st = {"line": int(parts[0]), "vars": vars_}
                if len(parts) > 2 and parts[2]: st["out"] = parts[2]
                tr.append(st)
            lab["trace"] = tr
        else: raise ValueError(f"unknown section :: {cur}")

    for line in text.split("\n"):
        m = re.match(r"^:: (\w+)(?: (.*))?$", line)
        if m:
            flush(); cur, arg, buf = m.group(1), (m.group(2) or "").strip(), []
        else:
            buf.append(line)
    flush()
    return g


def lab_json(g, sid, title):
    lab = g["lab"]
    if not lab.get("brief"): return None
    out = {"id": sid, "title": title, "user": lab.get("user", "student"), "host": lab.get("host", "lab"),
           "brief": md(lab["brief"]).replace("<p>", "").replace("</p>", "\n").strip(),
           "hints": [inline(h.replace("\n", " ")) for h in lab["hints"]],
           "answers": [hashlib.sha256(a.encode()).hexdigest() for a in lab["answers"]],
           "solution": base64.b64encode(md(lab.get("solution", "")).replace("<p>", "").replace("</p>", "\n").encode()).decode(),
           "fs": lab["fs"], "cmds": lab["cmds"], "cmdnames": lab["cmdnames"]}
    if lab.get("cwd"): out["cwd"] = lab["cwd"]
    if lab.get("js"): out["js"] = True
    if lab.get("py"): out["py"] = True
    if lab.get("sql"): out["sql"] = lab["sql"]
    out["style"] = lab.get("style", "shell")
    if out["style"] == "ticket":
        out["ticket"] = {k: lab[k] for k in ("id", "subject", "priority", "from", "sla", "system", "attach") if lab.get(k)}
    if out["style"] == "debug":
        out["source"] = lab["source"]; out["trace"] = lab.get("trace", [])
        assert lab["source"] in lab["fs"], f"{sid}: source file missing"
    return json.dumps(out).replace("</", "<\\/")


TIERS = [("simple", "1", "simple", "the idea in plain words"), ("mid", "2", "mid", "how it's actually used"),
         ("complex", "3", "complex", "what the pros do"), ("lab", "4", "hands-on", "your turn, in the sandbox")]


def build(page, SKILLS, LV, bar):
    os.makedirs("learn", exist_ok=True)
    guides, index = {}, []
    for gr in SKILLS["groups"]:
        for k in gr["skills"]:
            s = slug(k["name"]); f = f"content/guides/{s}.txt"
            if os.path.exists(f):
                guides[s] = (k, gr["name"], parse_guide(open(f).read()))
            index.append((gr["name"], k, s, os.path.exists(f)))

    for s, (k, grp, g) in guides.items():
        nav = "".join(f'<a href="#tier-{n}" class="tier" data-tier="{key}"><span class="tier__n">{n}</span>{lbl}</a>' for key, n, lbl, _ in TIERS)
        secs = ""
        for key, n, lbl, sub in TIERS[:3]:
            if key not in g["tiers"]: continue
            secs += (f'<section class="lvl" id="tier-{n}" data-tier="{key}"><h2><span class="lvl__n">0{n}</span> {lbl} <span class="muted">// {sub}</span></h2>'
                     f'{md(g["tiers"][key])}<p><button class="btn got" type="button" data-tier="{key}">[ ] got it</button></p></section>')
        lab = lab_json(g, s, k["name"])
        if lab:
            style = g["lab"].get("style", "shell")
            how = {"shell": ("sandbox shell", "Solve it in the sandbox. Every <span class=\"ok\">▶ run</span> above works on the same lab files, so the examples are your toolbox. Type <code>hint</code> when stuck and <code>submit &lt;answer&gt;</code> when you have it."),
                   "ticket": ("ticket queue", "This one is a ticket in the queue. Open the attachments, investigate in the console under the ticket (every <span class=\"ok\">▶ run</span> above works there), then resolve it with your answer. Hints cost 15 points, wrong answers 5."),
                   "debug": ("debugger", "This one runs in a step-through debugger. <code>start</code>, then <code>step</code> / <code>back</code> through the code and watch the variables change, or set a <code>break</code> and <code>continue</code>. Every <span class=\"ok\">▶ run</span> above is a debugger command. <code>submit &lt;answer&gt;</code> when you have it.")}[style]
            secs += (f'<section class="lvl lvl--lab" id="tier-4" data-tier="lab"><h2><span class="lvl__n">04</span> hands-on <span class="muted">// {how[0]}</span></h2>'
                     f'{md(g["lab"]["brief"])}<p class="muted">{how[1]}</p></section>')
        proof = k.get("proof")
        proof_html = f' · <a href="../{proof}">proof</a>' if proof and not proof.startswith("http") else (f' · <a href="{proof}">proof</a>' if proof else "")
        body = f'''<p class="cmd">learn --skill {s}</p>
<h1>~/learn/{s}</h1>
<p class="learn__meta"><span class="muted">{esc(grp)}</span> · my level: <span class="bar__on">{"■" * k["level"]}</span><span class="bar__off">{"□" * (5 - k["level"])}</span> <span class="muted">{LV[k["level"]]}</span>{proof_html}</p>
<p>{inline(g["meta"].get("tagline", ""))}</p>
<nav class="tiers" aria-label="levels">{nav}</nav>
<div class="learn" data-skill="{s}">
<div class="learn__doc">{secs}<p><a href="../learn.html">cd ~/learn</a></p></div>
{'<aside class="learn__lab"><div id="sandbox" class="term sb"></div><noscript><p>The sandbox needs JavaScript.</p></noscript></aside>' if lab else ""}
</div>
{f'<script type="application/json" id="lab-data">{lab}</script>' if lab else ""}'''
        page(f"learn/{s}.html", f"learn {k['name']} :: 0xDay", body, depth=1, cur="learn", htmlcls="wide",
             scripts=("sandbox.js", "learn.js"), desc=f"Learn {k['name']}: simple, mid and complex explanations, with a hands-on lab in a browser sandbox.")

    # ---------- Security+ ----------
    sp = parse_secplus()
    os.makedirs("secplus", exist_ok=True)
    allcards = []
    for o in sp["objectives"]:
        oid = o["id"]
        notes_f = f"content/secplus/notes/{oid}.md"
        notes = md(open(notes_f).read()) if os.path.exists(notes_f) else ""
        cards = [{"id": f"{oid}-{i}", "q": q, "a": a} for i, (q, a) in enumerate(o["cards"])]
        allcards += [dict(c, o=oid) for c in cards]
        rel = "".join(f'<li><a href="../learn/{x}.html">{esc(guides[x][0]["name"])}</a> <span class="muted">hands-on lab</span></li>' for x in o["labs"] if x in guides)
        prev_o = sp["objectives"][sp["objectives"].index(o) - 1] if sp["objectives"].index(o) > 0 else None
        nxt_o = sp["objectives"][sp["objectives"].index(o) + 1] if sp["objectives"].index(o) + 1 < len(sp["objectives"]) else None
        pager = '<nav class="pager">' + (f'<a href="{prev_o["id"]}.html">&lt; {prev_o["id"]}</a>' if prev_o else "<span></span>") + (f'<a href="{nxt_o["id"]}.html">{nxt_o["id"]} &gt;</a>' if nxt_o else "<span></span>") + "</nav>"
        body = f'''<p class="cmd">study --objective {oid}</p>
<div class="manhead"><span>SY0-701</span><span>domain {oid[0]}.0 · {esc(sp["domains"][oid[0]]["name"])}</span><span>{oid}</span></div>
<h1><span class="ok">{oid}</span> {esc(o["title"])}</h1>
<div class="obj" data-obj="{oid}">
<ul class="checks" aria-label="study checklist">
<li><label><input type="checkbox" data-k="watched"> watched the videos</label></li>
<li><label><input type="checkbox" data-k="notes"> read the notes</label></li>
<li><label><input type="checkbox" data-k="own"> wrote my own notes</label></li>
<li><label><input type="checkbox" data-k="cards" disabled> flashcards mastered <span class="muted cards-pct"></span></label></li>
</ul>
<h2>key ideas</h2>
<div class="prose">{md(chr(10).join("- " + x for x in o["key"]))}</div>
<h2>study notes</h2>
{f'<div class="prose notes">{notes}</div>' if notes else '<p class="muted">// full notes from the Professor Messer videos land here once the transcript is imported.</p>'}
<h2>flashcards</h2>
<div class="deck" data-deck="{oid}"></div>
{f'<h2>practice it</h2><ul class="arrow">{rel}</ul>' if rel else ""}
<h2>my notes</h2>
<p class="muted small">Saved in this browser only.</p>
<textarea class="mynotes" rows="8" spellcheck="true" aria-label="my notes for {oid}" placeholder="# {oid} in my own words..."></textarea>
</div>
{pager}
<p><a href="../secplus.html">cd ~/secplus</a></p>
<script type="application/json" id="cards-data">{json.dumps(cards).replace("</", "<\\/")}</script>'''
        page(f"secplus/{oid}.html", f"Security+ {oid} :: 0xDay", body, depth=1, cur="learn", scripts=("study.js",),
             desc=f"Security+ SY0-701 objective {oid}: {o['title']}")

    doms = ""
    for n, d in sp["domains"].items():
        objs = [o for o in sp["objectives"] if o["id"].startswith(n + ".")]
        rows = "".join(f'<li class="objrow" data-obj="{o["id"]}"><a class="ls-row" href="secplus/{o["id"]}.html"><span class="ls-perm">{o["id"]}</span>'
                       f'<span class="ls-title">{esc(o["title"])}</span><span class="objbar"></span></a></li>' for o in objs)
        doms += (f'<section class="domsec" data-dom="{n}"><h2># {n}.0 {esc(d["name"])} <span class="muted">{d["weight"]}% of the exam</span></h2>'
                 f'<p class="dombar"></p><ul class="ls objs">{rows}</ul></section>')
    ncards = len(allcards)
    page("secplus.html", "Security+ :: 0xDay", f'''<p class="cmd">study --exam SY0-701</p><h1>~/secplus</h1>
<p>My CompTIA Security+ (SY0-701) study system: every exam objective with key ideas, notes, flashcards and links to hands-on labs. Progress is saved in your browser.</p>
<div class="stats" id="sp-stats"><div class="stat"><span class="stat__v" id="sp-overall">0%</span><span class="stat__k">weighted progress</span></div>
<div class="stat"><span class="stat__v">{len(sp["objectives"])}</span><span class="stat__k">objectives</span></div>
<div class="stat"><span class="stat__v" id="sp-mastered">0/{ncards}</span><span class="stat__k">cards mastered</span></div>
<div class="stat"><span class="stat__v" id="sp-due">{ncards}</span><span class="stat__k">cards due</span></div></div>
<p><a class="btn" href="secplus/drill.html">[ drill due cards ]</a> <span class="muted small">spaced repetition across all domains</span></p>
{doms}
<p class="muted small">Progress lives in this browser's localStorage. The official domain bars on <a href="certs.html">~/certs</a> are updated by hand.</p>
<script type="application/json" id="sp-data">{json.dumps({"domains": sp["domains"], "objectives": [o["id"] for o in sp["objectives"]], "cards": {o["id"]: len(o["cards"]) for o in sp["objectives"]}})}</script>''',
         cur="learn", scripts=("study.js",), desc="Security+ SY0-701 study section: objectives, notes, flashcards and progress.")

    page("secplus/drill.html", "Security+ drill :: 0xDay", f'''<p class="cmd">flashcard --drill --due</p><h1>~/secplus/drill</h1>
<p>Due cards from every objective. <kbd>space</kbd> decrypts the answer, then <kbd>1</kbd> again · <kbd>2</kbd> hard · <kbd>3</kbd> got it.</p>
<p class="drillopts">domains: {"".join(f'<label><input type="checkbox" class="domf" value="{n}" checked> {n}.0</label> ' for n in sp["domains"])}</p>
<div class="deck deck--drill" data-deck="all"></div>
<p><a href="../secplus.html">cd ~/secplus</a></p>
<script type="application/json" id="cards-data">{json.dumps(allcards).replace("</", "<\\/")}</script>''', depth=1, cur="learn", scripts=("study.js",))

    # ---------- learn hub ----------
    gl = ""
    groups = {}
    for gname, k, s, has in index:
        groups.setdefault(gname, []).append((k, s, has))
    for gname, items in groups.items():
        gl += f'<h2>{esc(gname)}</h2><ul class="ls guides">' + "".join(
            (f'<li class="guiderow" data-skill="{s}"><a class="ls-row" href="learn/{s}.html"><span class="ls-perm gprog">[----]</span><span class="ls-title">{esc(k["name"])}</span><span class="ls-tags">{guides[s][2]["lab"].get("style", "shell")}</span></a></li>' if has else
             f'<li class="muted"><span class="ls-row"><span class="ls-perm">[....]</span><span class="ls-title">{esc(k["name"])}</span><span class="ls-tags">soon</span></span></li>')
            for k, s, has in items) + "</ul>"
    page("learn.html", "learn :: 0xDay", f'''<p class="cmd">ls ~/learn</p><h1>~/learn</h1>
<p>Study material I wrote for myself, open to anyone. Every skill goes <strong>simple → mid → complex → hands-on</strong>, and the hands-on part is a sandbox shell right on the page.</p>
<div class="hub"><a class="tile" href="secplus.html"><span class="tile__k">./secplus</span><span class="tile__v">Security+ SY0-701 study system</span><span class="tile__n">{len(sp["objectives"])} objectives · {ncards} cards</span></a>
<a class="tile" href="secplus/drill.html"><span class="tile__k">./drill</span><span class="tile__v">flashcards due today</span><span class="tile__n">spaced repetition</span></a></div>
<p class="muted small">progress: <span class="bar__on">[####]</span> = simple, mid, complex read + lab solved. Saved in your browser.</p>
{gl}''', cur="learn", scripts=("learn.js",), desc="Learn security skills: tiered guides with in-browser hands-on labs, and a Security+ study section.")
    return guides, sp, ncards


def parse_secplus():
    """content/secplus/objectives.txt:
    ## 1.1 Title
    labs: slug, slug
    - key idea
    Q: question
    A: answer
    """
    certs = json.load(open("content/certs.json"))
    domains = {str(d["n"]): {"name": d["name"], "weight": d["weight"]} for d in certs["secplus"]["domains"]}
    objs, cur, q = [], None, None
    for line in open("content/secplus/objectives.txt").read().split("\n"):
        if line.startswith("## "):
            oid, title = line[3:].split(" ", 1)
            cur = {"id": oid, "title": title.strip(), "key": [], "cards": [], "labs": []}; objs.append(cur)
        elif cur is None or not line.strip() or line.startswith("#"):
            continue
        elif line.startswith("labs:"):
            cur["labs"] = [x.strip() for x in line[5:].split(",") if x.strip()]
        elif line.startswith("- "):
            cur["key"].append(line[2:].strip())
        elif line.startswith("Q: "):
            q = line[3:].strip()
        elif line.startswith("A: "):
            cur["cards"].append((q, line[3:].strip())); q = None
    return {"domains": domains, "objectives": objs}
