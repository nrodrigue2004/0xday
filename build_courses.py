"""~/courses (course catalog), ~/courses/<code> (modules + quizzes + exam) and ~/transcript (progress rollup).
Called from build.py as build_courses.build(page, esc) after every other page is written, so href checks see them.

Data: content/courses.json (tracks, courses, modules, tiers). Question banks: content/courses/<CODE>.txt, one per course:

    ## 0                 <- module index (matches the order in courses.json)
    Q: question text
    * the right answer   <- exactly one "*", written first; the browser shuffles the order
    - a wrong answer     <- exactly three "-"
    ? why (shown after answering)

A module quiz asks every question tagged with that module. The exam draws up to 20 from the whole bank. Pass mark is 80%.
Progress lives in the browser only (localStorage key oxday-courses). No grades or school records are stored or shown.
Standard library only.
"""
import json, os, hashlib, re

PASS = 0.8
EXAM_N = 20


def parse_bank(code, path, nmods):
    qs, mod, cur = [], None, None

    def flush():
        nonlocal cur
        if cur is None:
            return
        where = f"{code} module {cur['m']} question {len(qs) + 1}"
        assert len(cur["good"]) == 1, f"{where}: needs exactly one *"
        assert len(cur["bad"]) == 3, f"{where}: needs exactly three -"
        assert cur["q"], f"{where}: empty question"
        qs.append({"m": cur["m"], "q": cur["q"], "a": cur["good"] + cur["bad"], "e": cur["e"]})
        cur = None
    for raw in open(path).read().splitlines():
        line = raw.rstrip()
        if line.startswith("## "):
            flush()
            mod = int(line[3:])
            assert 0 <= mod < nmods, f"{code}: module {mod} not in courses.json"
        elif line.startswith("Q: "):
            flush()
            assert mod is not None, f"{code}: question before any ## header"
            cur = {"m": mod, "q": line[3:].strip(), "good": [], "bad": [], "e": ""}
        elif cur is not None and line.startswith("* "):
            cur["good"].append(line[2:].strip())
        elif cur is not None and line.startswith("- "):
            cur["bad"].append(line[2:].strip())
        elif cur is not None and line.startswith("? "):
            cur["e"] = line[2:].strip()
        elif line.strip():
            raise SystemExit(f"{code}: cannot parse line: {line!r}")
    flush()
    for i in range(nmods):
        n = sum(1 for q in qs if q["m"] == i)
        assert n >= 3, f"{code}: module {i} has {n} questions, need at least 3"
    for i, q in enumerate(qs):
        q["id"] = f"{code}.{q['m']}.{i}"
    return qs


def _assets(prefix, base):
    css, js = open("courses.css").read(), open("courses.js").read()
    ver = hashlib.sha1((css + js).encode()).hexdigest()[:8]
    return f'\n<link rel="stylesheet" href="{base}courses.css?v={ver}">\n<script src="{base}courses.js?v={ver}" defer></script>'


def jsn(o):
    return json.dumps(o, separators=(",", ":")).replace("</", "<\\/")


def build(page, esc):
    C = json.load(open("content/courses.json"))
    courses = [c for t in C["tracks"] for c in t["courses"]]
    codes = [c["code"] for c in courses]
    assert len(set(codes)) == len(codes), "duplicate course code"
    for c in courses:
        for p in c["pre"]:
            assert p in codes, f"{c['code']}: unknown prerequisite {p}"
        for m in c["modules"]:
            for l in m["links"]:
                if not l["h"].startswith("http") and not os.path.exists(l["h"].split("#")[0]):
                    raise SystemExit(f"courses.json: {c['code']} link does not exist: {l['h']}")
    for t in C["tiers"]:
        for k in t["need"]:
            assert k in codes, f"tier {t['key']}: unknown course {k}"
    banks = {c["code"]: parse_bank(c["code"], f"content/courses/{c['code']}.txt", len(c["modules"])) for c in courses}

    track_of = {c["code"]: t["key"] for t in C["tracks"] for c in t["courses"]}
    meta = {"pass": PASS, "tiers": C["tiers"],
            "courses": [{"code": c["code"], "name": c["name"], "pre": c["pre"], "mods": len(c["modules"]),
                         "min": sum(m["m"] for m in c["modules"]), "track": track_of[c["code"]]} for c in courses]}
    metaj = f'<script type="application/json" id="c-meta">{jsn(meta)}</script>'
    hours = lambda mins: f"{mins / 60:.1f}".rstrip("0").rstrip(".")
    nq = sum(len(b) for b in banks.values())

    # ---------- ~/courses ----------
    head = _assets("courses", "")
    blocks = []
    for t in C["tracks"]:
        cards = ""
        for c in t["courses"]:
            mins = sum(m["m"] for m in c["modules"])
            pre = ", ".join(c["pre"]) if c["pre"] else "none"
            cards += (f'<li class="cl__card" data-code="{c["code"]}"><a class="cl__t" href="courses/{c["code"]}.html"><span class="cl__code">{c["code"]}</span> {esc(c["name"])}</a>'
                      f'<span class="cl__st" data-st>not started</span>'
                      f'<p class="cl__b">{esc(c["blurb"])}</p>'
                      f'<p class="cl__m muted small">needs: {pre} · {len(c["modules"])} modules · ~{hours(mins)} h · {len(banks[c["code"]])} questions</p>'
                      f'<p class="cl__lock muted small" data-lock hidden></p></li>')
        blocks.append(f'<section class="cl__track"><h2># {esc(t["name"])}</h2><ul class="cl__list">{cards}</ul></section>')
    tree = []
    for c in courses:
        tree.append(f'{c["code"]:<7}<- {", ".join(c["pre"]) if c["pre"] else "(none)"}')
    body = f'''<p class="cmd">ls ~/courses</p><h1>~/courses</h1>
<p>Everything already on the site, grouped into courses with modules, a quiz per module and an exam. This is a self-study curriculum modeled on a degree plan, not an accredited one. Progress is saved in this browser only; <a href="transcript.html">~/transcript</a> has the rollup and a backup button.</p>
<p><strong>Placement:</strong> every course has an exam. Score {int(PASS * 100)}% or better without doing the modules and the course is marked <em>tested out</em>. Locks are soft: a course whose prerequisites are unfinished is flagged but never blocked.</p>
<noscript><p class="callout">Progress tracking needs JavaScript. The course pages still work as reading lists.</p></noscript>
<div id="cl" class="cl"><div class="cl__sum muted" id="cl-sum" aria-live="polite"></div>{"".join(blocks)}</div>
<h2># prerequisites</h2>
<pre class="cl__tree">{esc(chr(10).join(tree))}</pre>
<p class="muted small">Companions: <a href="start.html">~/start</a> (the guided order) · <a href="transcript.html">~/transcript</a> · <a href="learn.html">~/learn</a> · <a href="secplus.html">~/secplus</a></p>
{metaj}'''
    page("courses.html", "courses :: 0xDay", body, cur="learn", head=head,
         desc=f"{len(courses)} self-study courses with module quizzes and placement exams, progress saved in your browser.")

    # ---------- ~/courses/<code> ----------
    os.makedirs("courses", exist_ok=True)
    head1 = _assets("courses", "../")
    for c in courses:
        code, bank = c["code"], banks[c["code"]]
        rows = ""
        for i, m in enumerate(c["modules"]):
            links = " ".join(
                f'<a href="{l["h"] if l["h"].startswith("http") else "../" + l["h"]}"{" rel=\"noopener\" target=\"_blank\"" if l["h"].startswith("http") else ""}>{esc(l["t"])}</a>' for l in m["links"])
            note = "".join(f'<p class="cp__note">{esc(x)}</p>' for x in m["note"].split("\n\n")) if m.get("note") else ""
            nm = sum(1 for q in bank if q["m"] == i)
            rows += (f'<li class="cp__mod" data-i="{i}"><label class="cp__chk"><input type="checkbox" aria-label="module done: {esc(m["t"])}"><span class="cp__box" aria-hidden="true"></span></label>'
                     f'<div><strong>{i + 1}. {esc(m["t"])}</strong> <span class="muted small">~{m["m"]} min</span>'
                     f'<p class="cp__links">{links}</p>{note}'
                     f'<p><button class="btn btn--sm" type="button" data-quiz="{i}">[ quiz: {nm} questions ]</button> <span class="muted small" data-best></span></p></div></li>')
        pre = ", ".join(f'<a href="{p}.html">{p}</a>' for p in c["pre"]) if c["pre"] else "none"
        pool = min(EXAM_N, len(bank))
        data = {"code": code, "name": c["name"], "pass": PASS, "exam": pool, "mods": [m["t"] for m in c["modules"]], "qs": bank}
        mins = sum(m["m"] for m in c["modules"])
        body = f'''<p class="cmd">cat ~/courses/{code}</p><h1>{code} {esc(c["name"])}</h1>
<p>{esc(c["blurb"])}</p>
<p class="muted">needs: {pre} · {len(c["modules"])} modules · ~{hours(mins)} h of study · <span id="cp-status" aria-live="polite">not started</span></p>
<div id="cp" class="cp" data-code="{code}">
<h2># modules</h2>
<ol class="cp__mods">{rows}</ol>
<h2># exam</h2>
<p>{pool} questions drawn from the whole course. Score {int(PASS * 100)}% or better to pass. If you take it before doing any modules, a pass counts as <em>tested out</em>, which is how placement works. Retakes are fine and the best score is kept.</p>
<p><button class="btn" type="button" id="cp-exam">[ take the exam ]</button> <span class="muted small" id="cp-exam-best"></span></p>
<section id="cq" class="cq" hidden aria-live="polite"></section>
</div>
<noscript><p class="callout">Quizzes need JavaScript.</p></noscript>
<p class="muted small"><a href="../courses.html">&lt; all courses</a> · <a href="../transcript.html">~/transcript</a> · <a href="../start.html">~/start</a></p>
<script type="application/json" id="cq-data">{jsn(data)}</script>
{metaj}'''
        page(f"courses/{code}.html", f"{code} {c['name']} :: 0xDay", body, depth=1, cur="learn", head=head1,
             desc=f"{c['name']}: {len(c['modules'])} modules, module quizzes and an exam.")

    # ---------- ~/transcript ----------
    tiers = "".join(f'<li class="tr__tier" data-tier="{t["key"]}"><strong>{esc(t["name"])}</strong> <span class="muted small">({", ".join(t["need"])})</span> <span data-tier-st class="muted">0/{len(t["need"])}</span></li>' for t in C["tiers"])
    body = f'''<p class="cmd">cat ~/transcript</p><h1>~/transcript</h1>
<p>Your progress across <a href="courses.html">~/courses</a>: what is passed, what was tested out, and the study time it represents. It is built from this browser's saved progress, so it only shows what you have done on this device. Use export to keep a backup. These are self-study milestones, not credits.</p>
<noscript><p class="callout">The transcript needs JavaScript.</p></noscript>
<div id="tr" class="tr">
<div class="cl__sum" id="tr-sum" aria-live="polite"></div>
<h2># milestones</h2>
<ul class="tr__tiers">{tiers}</ul>
<h2># courses</h2>
<div class="tbl"><table class="tr__tbl"><thead><tr><th>course</th><th>status</th><th>modules</th><th>exam</th><th>date</th></tr></thead><tbody id="tr-body"></tbody></table></div>
<p class="tr__tools"><button class="btn" type="button" id="tr-export">[ export ]</button> <button class="btn" type="button" id="tr-import">[ import ]</button> <button class="btn" type="button" id="tr-reset">[ reset ]</button> <input type="file" id="tr-file" accept="application/json" hidden> <span class="muted small" id="tr-msg" role="status"></span></p>
</div>
<p class="muted small">Companions: <a href="courses.html">~/courses</a> · <a href="start.html">~/start</a> · <a href="log.html">~/log</a> · <a href="resume.html">~/resume</a></p>
{metaj}'''
    page("transcript.html", "transcript :: 0xDay", body, cur="learn", head=head,
         desc="Course progress rollup with export and import, saved in your browser only.")
    return len(courses), nq
