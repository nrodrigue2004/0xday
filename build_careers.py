"""~/careers: career paths (IT, cyber, software/data) with courses, skills, projects and interview questions.
Called from build.py as build_careers.build(page, esc). Standard library only.

Content: content/careers/<slug>.txt (one per path) and content/careers/_interview.txt (shared basics).
Format: `key: value` header lines, then `:: section` blocks. Lists are `- item | part | part`.
Question lines: `- [e|n|h] question => model answer` (e = easy, n = normal, h = hard).
The skills section links to the ~/learn guides, which carry the easy / normal / hard tiers and hands-on labs.
"""
import os, re, hashlib
import build_learn as L

DIR = "content/careers"
FAMILIES = [("it", "IT", "ls ~/careers/it", "Support, administration and infrastructure. The entry point for most tech careers."),
            ("cyber", "Cyber", "ls ~/careers/cyber", "Defense, investigation and offense. Most start with an IT or SOC foundation."),
            ("dev", "Software / Data", "ls ~/careers/dev", "Building software, testing it and working with data.")]
LV = {"e": ("easy", "easy"), "n": ("normal", "normal"), "h": ("hard", "hard")}
ORDER = ["it-help-desk", "sysadmin", "soc-analyst", "incident-responder", "pentester", "software-dev", "qa-tester", "data-analyst"]


def parse(src):
    meta, secs, cur = {}, {}, None
    for line in src.split("\n"):
        if line.startswith(":: "):
            cur = line[3:].strip(); secs[cur] = []
        elif cur is None:
            if ":" in line:
                k, v = line.split(":", 1); meta[k.strip()] = v.strip()
        elif line.strip():
            secs[cur].append(line.rstrip())
    return meta, secs


def items(lines):
    return [[p.strip() for p in l[2:].split(" | ")] for l in lines if l.startswith("- ")]


def paras(lines):
    return "".join(f"<p>{L.inline(l)}</p>" for l in lines)


def questions(lines):
    out = []
    for l in lines:
        m = re.match(r"- \[([enh])\] (.+?) => (.+)", l)
        if m:
            out.append((m.group(1), m.group(2), m.group(3)))
    return out


def build(page, esc):
    os.makedirs("careers", exist_ok=True)
    guides = {f[:-4] for f in os.listdir("content/guides") if f.endswith(".txt")}
    paths = {}
    for slug in ORDER:
        meta, secs = parse(open(f"{DIR}/{slug}.txt").read())
        assert meta["slug"] == slug and meta["family"] in {f[0] for f in FAMILIES}, slug
        paths[slug] = (meta, secs)
    imeta, isecs = parse(open(f"{DIR}/_interview.txt").read())
    qn = {"count": 0}

    def qlist(sec, qs, scope):
        if not qs:
            return ""
        rows = ""
        for i, (lv, q, a) in enumerate(qs):
            qid = f"{scope}.{sec}.{i}"; qn["count"] += 1
            rows += (f'<li class="qa__item" data-lv="{lv}" data-q="{qid}"><details><summary><span class="qa__lv qa__lv--{lv}">[{LV[lv][0]}]</span> <span class="qa__q">{L.inline(q)}</span></summary>'
                     f'<div class="qa__a">{L.inline(a)}</div></details>'
                     f'<button class="qa__done" type="button" aria-pressed="false" title="mark as something you can answer">[ ] can answer</button></li>')
        return f'<ol class="qa__list">{rows}</ol>'

    def toolbar():
        chips = "".join(f'<button class="tagchip qa__chip" type="button" data-lv="{k}" aria-pressed="{"true" if k == "all" else "false"}">#{k}</button>' for k in ("all", "easy", "normal", "hard"))
        return (f'<div class="qa__bar"><div class="rm__chips" role="group" aria-label="filter by difficulty">{chips}</div>'
                f'<span class="qa__tools"><button class="btn qa__open" type="button">[ expand all ]</button> <button class="btn qa__rand" type="button">[ ./random --unanswered ]</button></span></div>'
                f'<p class="muted small qa__count" aria-live="polite"></p>')

    ver = hashlib.sha1((open("careers.css").read() + open("careers.js").read()).encode()).hexdigest()[:8]
    head = f'\n<link rel="stylesheet" href="{{p}}careers.css?v={ver}">\n<script src="{{p}}careers.js?v={ver}" defer></script>'

    def pg(fn, title, body, depth, desc):
        p = "../" * depth
        page(fn, title, body, depth=depth, cur="lab", head=head.replace("{p}", p), desc=desc)

    # ---------- shared interview basics ----------
    sec = lambda cmd, h, inner, sub="": f'<section class="cr__sec"><p class="cmd">{cmd}</p><h2>{h}{f" <span class=muted>// {sub}</span>" if sub else ""}</h2>{inner}</section>'
    body = f'''<p class="cmd">cat ~/careers/interview</p><h1>~/careers/interview</h1>
<p>{L.inline(imeta["tagline"])}</p>
<div class="callout">Every path below has its own role-specific questions too. Start here, then go to the path you're aiming at.</div>
{sec("cat METHOD", "how to answer", paras(isecs["method"]))}
{toolbar()}
{sec("grep -i 'tell me' questions", "opening questions", qlist("intro", questions(isecs["intro"]), "core"))}
{sec("grep -i 'time when' questions", "behavioral (STAR)", qlist("behavioral", questions(isecs["behavioral"]), "core"))}
{sec("grep -i 'integrity' questions", "judgment and ethics", qlist("ethics", questions(isecs["ethics"]), "core"))}
{sec("grep -i 'start' questions", "closing questions", qlist("closing", questions(isecs["closing"]), "core"))}
{sec("cat ASK_THEM", "questions to ask them", "<ul class='arrow'>" + "".join(f"<li>{L.inline(x[2:])}</li>" for x in isecs["ask"]) + "</ul>")}
{sec("cat RED_FLAGS", "things that sink an interview", "<ul class='arrow'>" + "".join(f"<li>{L.inline(x[2:])}</li>" for x in isecs["red"]) + "</ul>")}
<nav class="pager"><a href="../careers.html">&lt; all paths</a><span></span></nav>'''
    pg("careers/interview.html", "interview basics :: ~/careers :: 0xDay", body, 1, "Common interview questions with model answers, how to use STAR, and questions to ask the interviewer.")

    # ---------- one page per path ----------
    for idx, slug in enumerate(ORDER):
        meta, S = paths[slug]
        skills = ""
        for it in items(S["skills"]):
            name, why, guide, lv = (it + ["", "", ""])[:4]
            link = f' <a href="../learn/{guide}.html">guide + lab</a>' if guide else ""
            if guide:
                assert guide in guides, f"{slug}: unknown guide {guide}"
            skills += f'<li><span class="cr__tag cr__tag--{lv}">[{lv}]</span><span><strong>{L.inline(name)}</strong> <span class="muted">{L.inline(why)}</span>{link}</span></li>'
        projects = "".join(
            f'<li><span class="cr__tag cr__tag--{m.group(1)}">[{m.group(1)}]</span><span><strong>{L.inline(m.group(2))}</strong> <span class="muted">{L.inline(m.group(3))}</span></span></li>'
            for m in (re.match(r"\[(easy|normal|hard)\] (.+?) \| (.+)", x[0] + " | " + " | ".join(x[1:])) for x in items(S["projects"])) if m)
        certs = "".join(f'<li><strong>{L.inline(c[0])}</strong>{" <span class=muted>" + L.inline(c[1]) + "</span>" if len(c) > 1 else ""}</li>' for c in items(S["certs"]) if c) or ""
        courses = ""
        for c in items(S["courses"]):
            name = L.inline(c[0]); note = c[1] if len(c) > 1 else ""
            url = c[2] if len(c) > 2 else ""
            courses += f'<li>{f"<a href={chr(34)}{esc(url)}{chr(34)} rel=noopener>{name}</a>" if url else name} <span class="muted">{L.inline(note)}</span></li>'
        ladder = "".join(f'<li><strong>{L.inline(a[0])}</strong> <span class="muted">{L.inline(a[1]) if len(a) > 1 else ""}</span></li>' for a in items(S["ladder"]))
        day = "".join(f"<li>{L.inline(x[2:])}</li>" for x in S["day"])
        res = "".join(f"<li>{L.inline(x[2:])}</li>" for x in S["resume"])
        qb, qt, qs = questions(S["basic"]), questions(S["technical"]), questions(S["scenario"])
        total = len(qb) + len(qt) + len(qs)
        titles = ", ".join(t.strip() for t in meta["titles"].split(","))
        pv = paths[ORDER[idx - 1]][0] if idx else None
        nx = paths[ORDER[idx + 1]][0] if idx + 1 < len(ORDER) else None
        pager = ('<nav class="pager">' + (f'<a href="{ORDER[idx-1]}.html">&lt; {esc(pv["title"])}</a>' if pv else "<span></span>")
                 + (f'<a href="{ORDER[idx+1]}.html">{esc(nx["title"])} &gt;</a>' if nx else '<a href="interview.html">interview basics &gt;</a>') + "</nav>")
        toc = "".join(f'<a href="#{i}" class="tier">{l}</a>' for i, l in (("about", "role"), ("path", "path"), ("learn", "learn"), ("skills", "skills"), ("build", "projects"), ("resume", "resume"), ("interview", f"interview ({total})")))
        body = f'''<p class="cmd">cat ~/careers/{slug}</p><h1>{esc(meta["title"])}</h1>
<p>{L.inline(meta["tagline"])}</p>
<p class="muted small">Also called: {esc(titles)}</p>
<nav class="tiers" aria-label="sections">{toc}</nav>
<section class="cr__sec" id="about"><h2># the role</h2>{paras(S["about"])}<h3>a typical day</h3><ul class="arrow">{day}</ul></section>
<section class="cr__sec" id="path"><h2># how it progresses</h2><ul class="arrow cr__ladder">{ladder}</ul></section>
<section class="cr__sec" id="learn"><h2># certifications and courses</h2>
<h3>certifications</h3><ul class="arrow">{certs}</ul><h3>courses and free resources</h3><ul class="arrow">{courses}</ul></section>
<section class="cr__sec" id="skills"><h2># skills to have <span class="muted">// easy, normal, hard</span></h2>
<p class="muted small">Each guide on this site goes simple, then mid, then complex, and most end in a hands-on sandbox lab. Do the easy ones first.</p><ul class="cr__list">{skills}</ul></section>
<section class="cr__sec" id="build"><h2># projects to build <span class="muted">// easy, normal, hard</span></h2>
<p class="muted small">Pick one per tier. Publish each with a README and a short write-up. These become your portfolio and your interview stories.</p><ul class="cr__list">{projects}</ul></section>
<section class="cr__sec" id="resume"><h2># resume advice</h2><ul class="arrow">{res}</ul></section>
<section class="cr__sec" id="interview"><h2># interview questions <span class="muted">// {total} for this role</span></h2>
<p class="callout">Do <a href="interview.html">interview basics</a> too: opening, behavioral and ethics questions apply to every role.</p>
{toolbar()}
<h3>about you and the role</h3>{qlist("basic", qb, slug)}
<h3>technical</h3>{qlist("tech", qt, slug)}
<h3>scenarios</h3>{qlist("scen", qs, slug)}</section>
{pager}<p><a href="../careers.html">cd ..</a></p>'''
        pg(f"careers/{slug}.html", f'{meta["title"]} :: ~/careers :: 0xDay', body, 1,
           f'Career path: {meta["title"]}. Certs, courses, skills, projects, resume advice and interview questions with model answers.')

    # ---------- hub ----------
    groups = ""
    for fam, label, cmd, blurb in FAMILIES:
        rows = ""
        for slug in ORDER:
            meta, S = paths[slug]
            if meta["family"] != fam:
                continue
            n = len(questions(S["basic"]) + questions(S["technical"]) + questions(S["scenario"]))
            rows += (f'<li><a class="ls-row" href="careers/{slug}.html"><span class="ls-perm">{n}q</span>'
                     f'<span class="ls-title">{esc(meta["title"])} <span class="muted small">{L.inline(meta["tagline"].split(".")[0])}.</span></span>'
                     f'<span class="ls-tags qa__prog" data-path="{slug}" data-total="{n}"></span></a></li>')
        groups += f'<p class="cmd">{cmd}</p><h2>{label}</h2><p class="muted small">{esc(blurb)}</p><ul class="ls">{rows}</ul>'
    core = sum(len(questions(isecs[k])) for k in ("intro", "behavioral", "ethics", "closing"))
    body = f'''<p class="cmd">ls ~/careers</p><h1>~/careers</h1>
<p>What it takes to get hired in the jobs I'm aiming at: the courses and certs, the skills (linked to the guides and labs here), projects worth building, and interview questions with model answers. Each path uses the same three levels as the rest of the site: <strong>easy → normal → hard</strong>.</p>
<div class="hub"><a class="tile" href="careers/interview.html"><span class="tile__k">./interview</span><span class="tile__v">basics and behavioral questions</span><span class="tile__n">{core} questions, any role</span></a>
<a class="tile" href="learn.html"><span class="tile__k">./learn</span><span class="tile__v">skill guides with hands-on labs</span><span class="tile__n">where the skills live</span></a>
<a class="tile" href="secplus.html"><span class="tile__k">./secplus</span><span class="tile__v">the cert most postings list</span><span class="tile__n">study system</span></a></div>
{groups}
<p class="muted small">Questions you mark "can answer" are saved in your browser only. Pay and market conditions change often, so check live job postings and the BLS Occupational Outlook Handbook rather than trusting any number written here. Last reviewed Nov 2026.</p>'''
    pg("careers.html", "careers :: 0xDay", body, 0, "Career paths for IT, cybersecurity and software/data roles, with courses, skills, projects and interview questions.")
    return {"paths": [{"slug": s, "name": paths[s][0]["title"]} for s in ORDER], "questions": qn["count"]}
