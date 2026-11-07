"""~/roadmap: future project ideas, rendered from content/roadmap.json.
Called from build.py as build_roadmap.build(page, esc). Kept in its own file so it
doesn't collide with other work on build.py.

Entry format (content/roadmap.json -> "ideas"):
  {"name", "slug", "area": "games|tools|hardware|homelab|security|ai|cs|...",
   "status": "next|building|idea|shipped|shelved", "difficulty": 1-5,
   "size": "weekend|weeks|months", "pitch", "stack": [...], "first_step"}
"""
import json, hashlib

ORDER = ["building", "next", "idea", "shipped", "shelved"]
LABEL = {"building": "in progress", "next": "up next", "idea": "backlog", "shipped": "shipped", "shelved": "shelved"}
CMD = {"building": "ps aux | grep build", "next": "cat ~/roadmap/NEXT", "idea": "ls ~/roadmap/backlog",
       "shipped": "git tag --list", "shelved": "ls ~/roadmap/.trash"}


def build(page, esc):
    R = json.load(open("content/roadmap.json"))
    ideas = R["ideas"]
    areas = sorted({i["area"] for i in ideas})
    count = {s: sum(1 for i in ideas if i["status"] == s) for s in ORDER}

    def item(i):
        d = max(1, min(5, int(i.get("difficulty", 3))))
        stack = " ".join(f"<span>{esc(s)}</span>" for s in i.get("stack", []))
        step = f'<p class="rm__step"><span class="muted">first step:</span> {esc(i["first_step"])}</p>' if i.get("first_step") else ""
        return (f'<li class="rm__item" id="{esc(i["slug"])}" data-area="{esc(i["area"])}" data-status="{esc(i["status"])}">'
                f'<div class="rm__head"><span class="rm__st rm__st--{esc(i["status"])}">[{esc(i["status"])}]</span>'
                f'<span class="rm__name">{esc(i["name"])}</span>'
                f'<span class="rm__meta"><span class="rm__area">#{esc(i["area"])}</span>'
                f'<span class="sk__lv" title="difficulty {d}/5" aria-label="difficulty {d} of 5"><span class="bar__on">{"■" * d}</span><span class="bar__off">{"□" * (5 - d)}</span></span>'
                f'<span class="muted">~{esc(i.get("size", "?"))}</span></span></div>'
                f'<p class="rm__pitch">{esc(i["pitch"])}</p>'
                f'<p class="rm__stack">{stack}</p>{step}</li>')

    sections = ""
    for s in ORDER:
        xs = [i for i in ideas if i["status"] == s]
        if not xs:
            continue
        xs.sort(key=lambda i: (i["area"] != "games", i["area"], i.get("difficulty", 3)))
        sections += (f'<section class="rm__sec" data-sec="{s}"><p class="cmd">{CMD[s]}</p>'
                     f'<h2>{LABEL[s]} <span class="muted">({len(xs)})</span></h2><ul class="rm__list">{"".join(item(i) for i in xs)}</ul></section>')

    chips = '<button class="tagchip rm__chip" type="button" data-area="all" aria-pressed="true">#all</button>' + "".join(
        f'<button class="tagchip rm__chip" type="button" data-area="{esc(a)}" aria-pressed="false">#{esc(a)} <span class="muted">{sum(1 for i in ideas if i["area"] == a)}</span></button>'
        for a in areas)
    summary = " · ".join(f'{count[s]} {LABEL[s]}' for s in ORDER if count[s])
    body = f'''<p class="cmd">cat ~/roadmap/README</p><h1>~/roadmap</h1>
<p>{esc(R.get("intro", ""))} <span class="muted">Last updated {esc(R.get("updated", ""))}.</span></p>
<p class="muted small">{len(ideas)} ideas: {summary}. Difficulty is ■ out of 5.</p>
<div class="rm__bar"><div class="rm__chips" role="group" aria-label="filter by area">{chips}</div>
<button class="btn rm__roll" type="button">[ ./pick --random ]</button></div>
<p class="rm__out muted" aria-live="polite"></p>
{sections}
<p><a href="projects.html">cd ../projects</a> <span class="muted">// what's already built</span></p>'''
    v = hashlib.sha1((open("roadmap.css").read() + open("roadmap.js").read()).encode()).hexdigest()[:8]
    page("roadmap.html", "roadmap :: 0xDay", body, cur="projects",
         head=f'\n<link rel="stylesheet" href="roadmap.css?v={v}">\n<script src="roadmap.js?v={v}" defer></script>',
         desc="Future project ideas: games, tools, hardware, homelab and more.")
    return ideas
