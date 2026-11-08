"""~/comptia: later/optional CompTIA certs after Security+ (CySA+, and Network+ / A+ once the notes arrive).
Called from build.py. Standard library only. Reuses study.js for checklists, notes and spaced-repetition cards.

content/comptia/certs.json   cert list: slug, name, code, file, status (notes|waiting), built, exam, domains {n: [name, weight]}, role
content/comptia/<slug>.txt   objectives, format:
    ## 1.1 Title
    labs: guide-slug, guide-slug        (optional, links into ~/learn)
    @notes                              markdown (same dialect as the learn guides)
    @cards                              Q: ... / A: ... pairs
    @check                              self-check: "? question", "a) ..", "b) ..", "= b | why"
    @lab                                first line is the title, rest is markdown (tasks)
    @answer                             walkthrough, hidden behind a details tag
"""
import json, os, re
from html import escape as esc
from build_learn import md, inline

HEAD = '\n<link rel="stylesheet" href="{p}comptia.css">'


def parse(path):
    objs, cur, sec, buf = [], None, None, []

    def flush():
        if cur is None or sec is None:
            return
        cur[sec] = "\n".join(buf).strip("\n")

    for line in open(path).read().split("\n"):
        if line.startswith("## "):
            flush(); sec, buf = None, []
            oid, title = line[3:].split(" ", 1)
            cur = {"id": oid, "title": title.strip(), "labs": [], "notes": "", "cards": "", "check": "", "lab": "", "answer": ""}
            objs.append(cur)
        elif cur is None or line.startswith("# "):
            continue
        elif line.startswith("@") and line[1:].strip() in ("notes", "cards", "check", "lab", "answer"):
            flush(); sec, buf = line[1:].strip(), []
        elif sec is None and line.startswith("labs:"):
            cur["labs"] = [x.strip() for x in line[5:].split(",") if x.strip()]
        elif sec is not None:
            buf.append(line)
    flush()
    return objs


def cards_of(txt):
    out, q = [], None
    for l in txt.split("\n"):
        if l.startswith("Q: "): q = l[3:].strip()
        elif l.startswith("A: ") and q: out.append((q, l[3:].strip())); q = None
    return out


def checks_of(txt):
    qs, cur = [], None
    for l in txt.split("\n"):
        if l.startswith("? "):
            cur = {"q": l[2:].strip(), "opts": [], "ans": "", "why": ""}; qs.append(cur)
        elif cur and re.match(r"^[a-d]\) ", l):
            cur["opts"].append(l[3:].strip())
        elif cur and l.startswith("= "):
            a, _, w = l[2:].partition("|"); cur["ans"], cur["why"] = a.strip().lower(), w.strip()
    return qs


def check_html(qs):
    out = []
    for i, q in enumerate(qs, 1):
        opts = "".join(f'<li><span class="ok">{"abcd"[j]})</span> {inline(o)}</li>' for j, o in enumerate(q["opts"]))
        out.append(f'<div class="chk"><p><strong>{i}.</strong> {inline(q["q"])}</p><ul class="chk__o">{opts}</ul>'
                   f'<details><summary>answer</summary><p><span class="ok">{esc(q["ans"])})</span> {inline(q["why"])}</p></details></div>')
    return "".join(out)


def lab_html(txt, ans):
    if not txt.strip():
        return ""
    title, _, rest = txt.strip().partition("\n")
    a = f'<details><summary>walkthrough</summary><div class="prose">{md(ans)}</div></details>' if ans.strip() else ""
    return f'<h2>short lab: {esc(title.strip())}</h2><div class="prose lab">{md(rest)}</div>{a}'


def build(page, guides=None):
    cfg = json.load(open("content/comptia/certs.json"))["certs"]
    os.makedirs("comptia", exist_ok=True)
    tiles = ""
    for c in cfg:
        slug = c["slug"]
        if not c["built"]:
            body = f'''<p class="cmd">study --exam {esc(c["code"])}</p><h1>~/comptia/{slug}</h1>
<p>{esc(c["name"])} ({esc(c["code"])}). Pages go up once the study notes arrive: I build this section from my own notes, the same way as Security+, with key ideas, flashcards, self-check questions and short labs.</p>
<p class="callout">status: waiting on notes. Nothing here yet on purpose.</p>
<p><a href="../comptia.html">cd ~/comptia</a></p>'''
            page(f"comptia/{slug}.html", f"{c['name']} :: 0xDay", body, depth=1, cur="learn", head=HEAD.format(p="../"),
                 desc=f"{c['name']} study section (coming).")
            tiles += (f'<li><a class="ls-row" href="comptia/{slug}.html"><span class="ls-perm">[....]</span><span class="ls-title">{esc(c["name"])} <span class="muted">{esc(c["code"])}</span></span>'
                      f'<span class="ls-tags">waiting on notes</span></a></li>')
            continue
        objs = parse(f"content/comptia/{c['file']}")
        os.makedirs(f"comptia/{slug}", exist_ok=True)
        allc = 0
        for n, o in enumerate(objs):
            oid = f'{slug}-{o["id"]}'
            cards = [{"id": f"{oid}-{i}", "q": q, "a": a} for i, (q, a) in enumerate(cards_of(o["cards"]))]
            allc += len(cards)
            prev_o = objs[n - 1] if n else None
            nxt_o = objs[n + 1] if n + 1 < len(objs) else None
            pager = ('<nav class="pager">' + (f'<a href="{prev_o["id"]}.html">&lt; {prev_o["id"]}</a>' if prev_o else "<span></span>")
                     + (f'<a href="{nxt_o["id"]}.html">{nxt_o["id"]} &gt;</a>' if nxt_o else "<span></span>") + "</nav>")
            rel = "".join(f'<li><a href="../../learn/{x}.html">{esc(x.replace("-", " "))}</a> <span class="muted">hands-on lab</span></li>' for x in o["labs"] if os.path.exists(f"content/guides/{x}.txt"))
            body = f'''<p class="cmd">study --objective {esc(o["id"])} --exam {esc(c["code"])}</p>
<div class="manhead"><span>{esc(c["code"])}</span><span>domain {o["id"][0]}.0 · {esc(c["domains"][o["id"][0]][0])}</span><span>{esc(o["id"])}</span></div>
<h1><span class="ok">{esc(o["id"])}</span> {esc(o["title"])}</h1>
<div class="obj" data-obj="{oid}">
<ul class="checks" aria-label="study checklist">
<li><label><input type="checkbox" data-k="watched"> did the lab</label></li>
<li><label><input type="checkbox" data-k="notes"> read the notes</label></li>
<li><label><input type="checkbox" data-k="own"> wrote my own notes</label></li>
<li><label><input type="checkbox" data-k="cards" disabled> flashcards mastered <span class="muted cards-pct"></span></label></li>
</ul>
<h2>study notes</h2>
<div class="prose notes">{md(o["notes"])}</div>
<h2>flashcards</h2>
<div class="deck" data-deck="{oid}"></div>
<h2>self-check</h2>
{check_html(checks_of(o["check"]))}
{lab_html(o["lab"], o["answer"])}
{f'<h2>practice it</h2><ul class="arrow">{rel}</ul>' if rel else ""}
<h2>my notes</h2>
<p class="muted small">Saved in this browser only.</p>
<textarea class="mynotes" rows="8" spellcheck="true" aria-label="my notes for {esc(o["id"])}" placeholder="# {esc(o["id"])} in my own words..."></textarea>
</div>
{pager}
<p><a href="../{slug}.html">cd ~/comptia/{slug}</a></p>
<script type="application/json" id="cards-data">{json.dumps(cards).replace("</", "<\\/")}</script>'''
            page(f"comptia/{slug}/{o['id']}.html", f"{c['name']} {o['id']} :: 0xDay", body, depth=2, cur="learn", scripts=("study.js",),
                 head=HEAD.format(p="../../"), desc=f"{c['name']} {c['code']} objective {o['id']}: {o['title']}")
        doms = ""
        for d, (dname, w) in c["domains"].items():
            rows = "".join(f'<li><a class="ls-row" href="{slug}/{o["id"]}.html"><span class="ls-perm">{o["id"]}</span><span class="ls-title">{esc(o["title"])}</span></a></li>'
                           for o in objs if o["id"].startswith(d + "."))
            doms += f'<section><h2># {d}.0 {esc(dname)} <span class="muted">{w}% of the exam</span></h2><ul class="ls objs">{rows}</ul></section>'
        page(f"comptia/{slug}.html", f"{c['name']} :: 0xDay", f'''<p class="cmd">study --exam {esc(c["code"])}</p><h1>~/comptia/{slug}</h1>
<p>{esc(c["name"])} ({esc(c["code"])}): {esc(c["exam"])}. Dense notes per objective in my own words, flashcards, self-check questions and a short lab on each. Later and optional: Security+ comes first.</p>
<p class="callout">The exam objectives list is CompTIA's. Everything written here is mine. Check <a href="https://www.comptia.org/">comptia.org</a> for the current exam code before booking.</p>
<p><a class="btn" href="{slug}/drill.html">[ drill all cards ]</a></p>
{doms}
<p><a href="../comptia.html">cd ~/comptia</a></p>''', depth=1, cur="learn", head=HEAD.format(p="../"), desc=f"{c['name']} {c['code']} study section.")
        # drill page over all cards
        alls = []
        for o in objs:
            alls += [{"id": f'{slug}-{o["id"]}-{i}', "q": q, "a": a, "o": o["id"]} for i, (q, a) in enumerate(cards_of(o["cards"]))]
        page(f"comptia/{slug}/drill.html", f"{c['name']} drill :: 0xDay", f'''<p class="cmd">flashcard --drill --due</p><h1>~/comptia/{slug}/drill</h1>
<p>Every {esc(c["name"])} card. <kbd>space</kbd> shows the answer, then <kbd>1</kbd> again · <kbd>2</kbd> hard · <kbd>3</kbd> got it.</p>
<div class="deck deck--drill" data-deck="all"></div>
<p><a href="../{slug}.html">cd ~/comptia/{slug}</a></p>
<script type="application/json" id="cards-data">{json.dumps(alls).replace("</", "<\\/")}</script>''', depth=2, cur="learn", scripts=("study.js",), head=HEAD.format(p="../../"))
        tiles += (f'<li><a class="ls-row" href="comptia/{slug}.html"><span class="ls-perm">[####]</span><span class="ls-title">{esc(c["name"])} <span class="muted">{esc(c["code"])}</span></span>'
                  f'<span class="ls-tags">{len(objs)} objectives · {allc} cards</span></a></li>')

    page("comptia.html", "CompTIA path :: 0xDay", f'''<p class="cmd">ls ~/comptia</p><h1>~/comptia</h1>
<p>The certs after Security+. Security+ is the target (Q1 2027) and lives at <a href="secplus.html">~/secplus</a>. Everything below is later and optional, ordered by what the job I land will probably ask for.</p>
<ul class="ls">{tiles}</ul>
<h2>how they fit</h2>
<div class="tbl"><table><thead><tr><th>path</th><th>order</th><th>why</th></tr></thead><tbody>
<tr><td>IT / help desk</td><td>A+ then Network+ then Security+</td><td>A+ is the standard entry ticket for help desk and desktop support. Network+ is what moves you from tickets to the network closet.</td></tr>
<tr><td>SOC analyst</td><td>Security+ then CySA+ (Network+ in parallel if packets feel shaky)</td><td>Security+ gets the HR filter open. CySA+ is the analyst-level cert, and its exam is the day job: logs, indicators, vulnerability triage, incident response, reporting.</td></tr>
<tr><td>Software / data</td><td>Security+ only, then stop</td><td>Certs matter little there. Projects and the dojo matter more. One security cert shows you can write code that does not leak.</td></tr>
</tbody></table></div>
<p class="callout">Nate's plan: Security+ first (Q1 2027). Nothing here moves ahead of it. A+ and Network+ are built from his own notes, so those two pages stay empty until the notes land.</p>
<h2>how they overlap</h2>
<ul class="arrow"><li>Network+ and Security+ share ports, protocols, VLANs, firewalls and VPNs. Learn them once.</li>
<li>A+ and Security+ share OS hardening, malware removal, backups and data destruction.</li>
<li>CySA+ assumes Security+ and adds the analyst loop: collect, correlate, decide, write it up.</li></ul>
<p><a href="learn.html">cd ~/learn</a> · <a href="certs.html">~/certs</a></p>''', cur="learn", head=HEAD.format(p=""), desc="CompTIA cert path after Security+: CySA+, Network+ and A+.")
    return cfg
