"""~/interview: interview prep mapped to the projects on the resume.
Called from build.py as build_interview.build(page, esc). Standard library only.

Content: content/interview/<slug>.txt, same format as content/careers (see build_careers.py), plus header
`resume:` (the project name in content/resume.json, checked at build), `guides:` and `posts:` (comma lists, checked)
and a `:: prep` section. Reuses careers.css / careers.js for the question list and the "can answer" marks.
"""
import os, re, json, hashlib
import build_learn as L
import build_careers as C

DIR = "content/interview"
ORDER = ["homelab", "it-support-lab", "malware-labs", "forensics", "software", "technical", "work"]


def build(page, esc):
    os.makedirs("interview", exist_ok=True)
    resume = json.load(open("content/resume.json"))
    rnames = {p["name"] for p in resume["projects"]} | {"Work"}
    guides = {f[:-4] for f in os.listdir("content/guides") if f.endswith(".txt")}
    posts = {f[:-5] for f in os.listdir("content/posts") if f.endswith(".html")}
    rbul = {p["name"]: p["bullets"] for p in resume["projects"]}
    rbul["Work"] = [b for e in resume["experience"] for b in e["bullets"]]
    projs = {}
    for slug in ORDER:
        meta, S = C.parse(open(f"{DIR}/{slug}.txt").read())
        assert meta["slug"] == slug and meta["resume"] in rnames, slug
        projs[slug] = (meta, S)
    ver = hashlib.sha1((open("careers.css").read() + open("careers.js").read()).encode()).hexdigest()[:8]
    head = f'\n<link rel="stylesheet" href="{{p}}careers.css?v={ver}">\n<script src="{{p}}careers.js?v={ver}" defer></script>'

    def qlist(qs, scope):
        rows = ""
        for i, (lv, q, a) in enumerate(qs):
            rows += (f'<li class="qa__item" data-lv="{lv}" data-q="{scope}.{i}"><details><summary><span class="qa__lv qa__lv--{lv}">[{C.LV[lv][0]}]</span> '
                     f'<span class="qa__q">{L.inline(q)}</span></summary><div class="qa__a">{L.inline(a)}</div></details>'
                     f'<button class="qa__done" type="button" aria-pressed="false" title="mark as something you can answer">[ ] can answer</button></li>')
        return f'<ol class="qa__list">{rows}</ol>'

    chips = "".join(f'<button class="tagchip qa__chip" type="button" data-lv="{k}" aria-pressed="{"true" if k == "all" else "false"}">#{k}</button>' for k in ("all", "easy", "normal", "hard"))
    toolbar = (f'<div class="qa__bar"><div class="rm__chips" role="group" aria-label="filter by difficulty">{chips}</div>'
               f'<span class="qa__tools"><button class="btn qa__open" type="button">[ expand all ]</button> <button class="btn qa__rand" type="button">[ ./random --unanswered ]</button></span></div>'
               f'<p class="muted small qa__count" aria-live="polite"></p>')

    total = 0
    for idx, slug in enumerate(ORDER):
        meta, S = projs[slug]
        qs = C.questions(S["q"]); total += len(qs)
        gl = [g.strip() for g in meta["guides"].split(",") if g.strip()]
        pl = [p.strip() for p in meta.get("posts", "").split(",") if p.strip()]
        for g in gl: assert g in guides, f"{slug}: guide {g}"
        for p in pl: assert p in posts, f"{slug}: post {p}"
        bullets = "".join(f"<li>{esc(b)}</li>" for b in rbul[meta["resume"]])
        links = " ".join([f'<a href="learn/{g}.html">guide: {g}</a>' for g in gl] + [f'<a href="posts/{p}.html">post: {p}</a>' for p in pl])
        prep = "".join(f"<li>{L.inline(x[2:])}</li>" for x in S["prep"])
        pv = projs[ORDER[idx - 1]][0] if idx else None
        nx = projs[ORDER[idx + 1]][0] if idx + 1 < len(ORDER) else None
        pager = ('<nav class="pager">' + (f'<a href="{ORDER[idx-1]}.html">&lt; {esc(pv["title"])}</a>' if pv else "<span></span>")
                 + (f'<a href="{ORDER[idx+1]}.html">{esc(nx["title"])} &gt;</a>' if nx else '<a href="../interview.html">all projects &gt;</a>') + "</nav>")
        body = f'''<p class="cmd">cat ~/interview/{slug}</p><h1>{esc(meta["title"])}</h1>
<p>{L.inline(meta["tagline"])}</p>
<section class="cr__sec"><h2># what the resume says</h2><ul class="arrow">{bullets}</ul>
<p class="muted small">Every bullet is a door. An interviewer picks one and asks "tell me more", so you need a story behind each.</p></section>
<section class="cr__sec"><h2># the pitch</h2>{C.paras(S["pitch"])}</section>
<section class="cr__sec"><h2># prep before the interview</h2><ul class="arrow">{prep}</ul>
<p class="small">{links}</p></section>
<section class="cr__sec"><h2># questions <span class="muted">// {len(qs)}</span></h2>
<p class="callout">Model answers show the shape. Replace the details with what you actually did: a borrowed story falls apart at the first follow-up. Generic questions are in <a href="../careers/interview.html">interview basics</a>, role-specific ones in <a href="../careers.html">~/careers</a>.</p>
{toolbar}{qlist(qs, "ivw-" + slug)}</section>
{pager}<p><a href="../interview.html">cd ..</a></p>'''
        page(f"interview/{slug}.html", f'{meta["title"]} :: ~/interview :: 0xDay', body, depth=1, cur="lab", head=head.replace("{p}", "../"),
             desc=f'Interview prep for the {meta["title"]} entry on the resume, with questions and model answers.')

    rows = ""
    for slug in ORDER:
        meta, S = projs[slug]; n = len(C.questions(S["q"]))
        rows += (f'<li><a class="ls-row" href="interview/{slug}.html"><span class="ls-perm">{n}q</span>'
                 f'<span class="ls-title">{esc(meta["title"])} <span class="muted small">{L.inline(meta["tagline"])}</span></span>'
                 f'<span class="ls-tags qa__prog" data-path="ivw-{slug}" data-total="{n}"></span></a></li>')
    body = f'''<p class="cmd">ls ~/interview</p><h1>~/interview</h1>
<p>Interview prep built from the resume itself. Each project gets a 30-second pitch, a prep checklist, links to the guides and write-ups behind it, and the questions an interviewer is most likely to ask, with model answers.</p>
<div class="callout">Use this with <a href="careers/interview.html">interview basics</a> (opening and behavioral questions) and the role pages in <a href="careers.html">~/careers</a>. Tracking which questions you can answer is saved in your browser only.</div>
<p class="callout"><a href="ibm.html">~/ibm</a>: 4-day plan, STAR answers and homelab talking sheet for the IBM interview.</p>
<ul class="ls">{rows}</ul>
<p class="muted small">Record yourself answering the questions out loud, then track the practice in the <a href="log.html">study log</a>.</p>'''
    page("interview.html", "interview :: 0xDay", body, cur="lab", head=head.replace("{p}", ""),
         desc="Interview prep mapped to the projects on the resume: pitches, prep checklists and questions with model answers.")
    return {"projects": [{"slug": s, "name": projs[s][0]["title"]} for s in ORDER], "questions": total}
