"""~/capstones (index), ~/capstones/<CODE> (brief, checklist, rubric) and the CAP400 case file.
Data: content/capstones.json, content/capstones/cap400-evidence.txt and cap400-key.txt.
load(codes) is called by build_courses (tiers and ~/transcript need to know the capstones); build(page, esc) writes the pages.
Capstones are self-assessed checklists, not quizzes. Progress is browser-only, under 'cap' in localStorage key oxday-courses.
Pre-requisites that name a course missing from courses.json are dropped, so this keeps working while other course batches land.
Standard library only.
"""
import json, os
import build_courses

SRC = "content/capstones.json"


def load(codes):
    caps = json.load(open(SRC))["capstones"]
    for c in caps:
        for p in c["pre"]:
            assert p in codes, f"{c['code']}: unknown prerequisite {p}"
        c["pre"] = c["pre"] + [p for p in c.get("pre_want", []) if p in codes and p not in c["pre"]]
        n = 0
        for ph in c["phases"]:
            assert ph["items"], f"{c['code']}: empty phase {ph['t']}"
            n += len(ph["items"])
            for l in ph.get("links", []):
                if not l["h"].startswith("http") and not os.path.exists(l["h"].split("#")[0]):
                    raise SystemExit(f"capstones.json: {c['code']} link does not exist: {l['h']}")
        assert n >= 8, f"{c['code']}: too few checklist items"
    assert len({c["code"] for c in caps}) == len(caps), "duplicate capstone code"
    return caps


def sections(path):
    out, cur = [], None
    for raw in open(path).read().splitlines():
        if raw.startswith("## "):
            cur = [raw[3:].strip(), []]
            out.append(cur)
        elif cur is not None:
            cur[1].append(raw)
    return [(t, "\n".join(b).strip("\n")) for t, b in out]


def build(page, esc):
    codes = [c["code"] for t in json.load(open("content/courses.json"))["tracks"] for c in t["courses"]]
    caps = load(codes)
    metaj = build_courses.metaj_last
    head = build_courses._assets("courses", "")
    head1 = build_courses._assets("courses", "../")

    # ---------- ~/capstones ----------
    cards = ""
    for c in caps:
        n = sum(len(p["items"]) for p in c["phases"])
        pre = ", ".join(c["pre"]) if c["pre"] else "none"
        cards += (f'<li class="cl__card" data-cap="{c["code"]}"><a class="cl__t" href="capstones/{c["code"]}.html"><span class="cl__code">{c["code"]}</span> {esc(c["name"])}</a>'
                  f'<span class="cl__st" data-st>not started</span><p class="cl__b">{esc(c["blurb"])}</p>'
                  f'<p class="cl__m muted small">needs: {pre} · {n} checklist items · ~{c["hours"]} h</p>'
                  f'<p class="cl__lock muted small" data-lock hidden></p></li>')
    body = f'''<p class="cmd">ls ~/capstones</p><h1>~/capstones</h1>
<p>Three projects that pull the courses together: investigate a breach, attack the homelab, and ship a tool. Each is a checklist of deliverables with a self-grading rubric, and there is no quiz. Finish one and it counts toward the Specialist milestone on <a href="transcript.html">~/transcript</a>.</p>
<p>This is a self-study curriculum modeled on a degree plan, not an accredited one. Nobody grades these but you, so be honest in the rubric. Progress is saved in this browser only; use export on the transcript page as a backup.</p>
<noscript><p class="callout">Progress tracking needs JavaScript. The pages still work as plain checklists.</p></noscript>
<div id="cl" class="cl"><div class="cl__sum muted" id="cl-sum" aria-live="polite"></div><section class="cl__track"><h2># capstones</h2><ul class="cl__list">{cards}</ul></section></div>
<h2># milestones</h2>
<p>Foundations, Practitioner and Specialist are tracked on <a href="transcript.html">~/transcript</a>. Specialist needs one finished capstone.</p>
<p class="muted small">Companions: <a href="courses.html">~/courses</a> · <a href="transcript.html">~/transcript</a> · <a href="report.html">~/report</a> · <a href="homelab.html">~/homelab</a> · <a href="start.html">~/start</a></p>
{metaj}'''
    page("capstones.html", "capstones :: 0xDay", body, cur="learn", head=head,
         desc="Three self-graded capstone projects: investigate a breach, attack the homelab, publish a security tool.")

    # ---------- ~/capstones/<code> ----------
    os.makedirs("capstones", exist_ok=True)
    idx = 0
    for c in caps:
        code = c["code"]
        pre = ", ".join(f'<a href="../courses/{p}.html">{p}</a>' for p in c["pre"]) if c["pre"] else "none"
        brief = "".join(f"<p>{esc(p)}</p>" for p in c["brief"])
        if c.get("case"):
            brief += f'<p><a class="btn" href="{c["case"]}">[ open the case file ]</a></p>'
        phases = ""
        for ph in c["phases"]:
            items = ""
            for it in ph["items"]:
                items += (f'<li class="cp__mod" data-i="{idx}"><label class="cp__chk"><input type="checkbox" aria-label="done: {esc(it)}"><span class="cp__box" aria-hidden="true"></span></label>'
                          f'<div>{esc(it)}</div></li>')
                idx += 1
            links = " ".join(f'<a href="{l["h"] if l["h"].startswith("http") else "../" + l["h"]}"{" rel=\"noopener\" target=\"_blank\"" if l["h"].startswith("http") else ""}>{esc(l["t"])}</a>' for l in ph.get("links", []))
            phases += f'<h3>{esc(ph["t"])}</h3>' + (f'<p class="cp__links">{links}</p>' if links else "") + f'<ol class="cp__mods">{items}</ol>'
        idx = 0
        ex = c.get("extras")
        extra = ""
        if ex:
            extra = f'<h2># {esc(ex["title"].lower())}</h2>'
            if "rows" in ex:
                head_row, *rest = ex["rows"]
                extra += ('<div class="tbl"><table><thead><tr>' + "".join(f"<th>{esc(h)}</th>" for h in head_row) + "</tr></thead><tbody>"
                          + "".join("<tr>" + "".join(f"<td>{esc(x)}</td>" for x in r) + "</tr>" for r in rest) + "</tbody></table></div>")
                if ex.get("note"):
                    extra += f'<p class="muted small">{esc(ex["note"])}</p>'
            else:
                extra += "<ul>" + "".join(f"<li>{esc(x)}</li>" for x in ex["list"]) + "</ul>"
        rub = "".join(f"<li>{esc(r)}</li>" for r in c["rubric"])
        n = sum(len(p["items"]) for p in c["phases"])
        body = f'''<p class="cmd">cat ~/capstones/{code}</p><h1>{code} {esc(c["name"])}</h1>
<p>{esc(c["blurb"])}</p>
<p class="muted">needs: {pre} · {n} checklist items · ~{c["hours"]} h · <span id="cp-status" aria-live="polite">not started</span> · self-study, not an accredited course</p>
<div id="cap" class="cp" data-code="{code}" data-n="{n}">
<h2># brief</h2>{brief}
<h2># checklist</h2>
<p class="muted small" id="cap-count"></p>
{phases}
<h2># rubric</h2><p>Grade yourself honestly before you tick the last item.</p><ul>{rub}</ul>
{extra}
</div>
<noscript><p class="callout">Saving progress needs JavaScript.</p></noscript>
<p class="muted small"><a href="../capstones.html">&lt; all capstones</a> · <a href="../transcript.html">~/transcript</a> · <a href="../courses.html">~/courses</a></p>
{metaj}'''
        page(f"capstones/{code}.html", f"{code} {c['name']} :: 0xDay", body, depth=1, cur="learn", head=head1,
             desc=f"{c['name']}: brief, checklist and self-grading rubric.")

    # ---------- CAP400 case file ----------
    ev = sections("content/capstones/cap400-evidence.txt")
    key = sections("content/capstones/cap400-key.txt")
    parts = ""
    for title, text in ev:
        if title in ("Ticket", "Asset list", "Authentication note", "Response notes"):
            parts += f'<h2># {esc(title.lower())}</h2><pre>{esc(text)}</pre>'
        else:
            parts += f'<h2># {esc(title.lower())}</h2><pre class="cap__log">{esc(text)}</pre>'
    keyhtml = ""
    for line in key[0][1].split("\n"):
        if line.startswith("Q: "):
            keyhtml += f"<h3>{esc(line[3:])}</h3>"
        elif line.startswith("A: "):
            keyhtml += f"<p>{esc(line[3:])}</p>"
    body = f'''<p class="cmd">cat ~/capstones/cap400-case-file</p><h1>CAP400 case file: INC-2026-0312</h1>
<p>Fictional incident at a fictional company. All names, domains and addresses are invented; the domains use reserved example names and the IPs are from documentation ranges. Work the evidence, build your timeline, write the report, <em>then</em> open the answer key.</p>
<p class="muted small"><a href="CAP400.html">&lt; back to the CAP400 checklist</a></p>
{parts}
<h2># answer key</h2>
<details class="cap__key"><summary>Show the answer key (finish your report first)</summary>{keyhtml}</details>
<p class="muted small"><a href="CAP400.html">&lt; CAP400 checklist</a> · <a href="../report.html">~/report</a> · <a href="../capstones.html">~/capstones</a></p>'''
    page("capstones/cap400-case-file.html", "CAP400 case file :: 0xDay", body, depth=1, cur="learn",
         desc="Evidence for the CAP400 blue capstone: a simulated breach with email, endpoint, auth, DNS and firewall logs.")
    return len(caps)
