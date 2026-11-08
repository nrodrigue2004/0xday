"""~/secplus/train: weak-spot drill, timed acronym trainer, PBQ sims, secure-vs-insecure pairings, scenario cards.

Called from build_learn.build() after the Security+ pages are written.
Content:
  content/secplus/acronyms.txt   ACRONYM | expansion | domain 1-5 | hint
  content/secplus/pairs.txt      insecure | port | secure | port | why
  content/secplus/scenarios.txt  "@ obj | title" blocks: S: Q: + - W:
  content/secplus/pbq.json       firewall / match / order / log sims
All answers are my own wording. Progress and misses live in localStorage (train.js).
"""
import json, os, re, hashlib, html

esc = html.escape
PAGES = [
    ("weak", "weak-spot drill", "builds each session from what you missed", "adaptive"),
    ("acronyms", "acronym trainer", "60-second rounds, per-domain progress", "timed"),
    ("pbq", "PBQ sims", "firewall rules, match, order, read the log", "hands-on"),
    ("pairs", "secure vs insecure", "ports and their encrypted replacements", "drill"),
    ("scenarios", "scenario cards", "short incidents: pick the control or response", "judgment"),
]


def _acronyms():
    out = []
    for l in open("content/secplus/acronyms.txt"):
        if l.startswith("#") or "|" not in l:
            continue
        a, x, d, h = [s.strip() for s in l.split("|")]
        out.append({"a": a.replace("SAN-cert", "SAN (cert)"), "x": x, "d": int(d), "h": h})
    return out


def _pairs():
    out = []
    for l in open("content/secplus/pairs.txt"):
        if l.startswith("#") or "|" not in l:
            continue
        i, ip, s, sp, w = [x.strip() for x in l.split("|")]
        out.append({"i": i, "ip": ip, "s": s, "sp": sp, "w": w})
    return out


def _scenarios():
    out, cur = [], None
    for l in open("content/secplus/scenarios.txt").read().split("\n"):
        if l.startswith("@"):
            o, t = [x.strip() for x in l[1:].split("|")]
            cur = {"o": o, "t": t, "good": None, "bad": []}
            out.append(cur)
        elif cur and l.startswith("S:"): cur["s"] = l[2:].strip()
        elif cur and l.startswith("Q:"): cur["q"] = l[2:].strip()
        elif cur and l.startswith("+ "): cur["good"] = l[2:].strip()
        elif cur and l.startswith("- "): cur["bad"].append(l[2:].strip())
        elif cur and l.startswith("W:"): cur["w"] = l[2:].strip()
    for s in out:
        assert s["good"] and len(s["bad"]) == 3 and s.get("w"), s["t"]
    return out


def build(page, sp, allcards):
    os.makedirs("secplus", exist_ok=True)
    css, js = open("train.css").read(), open("train.js").read()
    v = hashlib.sha1((css + js).encode()).hexdigest()[:8]
    head = f'\n<link rel="stylesheet" href="../train.css?v={v}">'
    objs = {o["id"]: o["title"] for o in sp["objectives"]}
    acr, pairs, scen = _acronyms(), _pairs(), _scenarios()
    pbq = json.load(open("content/secplus/pbq.json"))
    doms = {n: d["name"] for n, d in sp["domains"].items()}
    common = {"objs": objs, "doms": doms}

    def data(d):
        return f'<script id="tr-data" type="application/json">{json.dumps(dict(common, **d)).replace("</", "<\\/")}</script>'

    def pg(slug, title, cmd, intro, mount, d, desc):
        body = (f'<p class="cmd">{cmd}</p><h1>~/secplus/{slug}</h1>\n<p>{intro}</p>\n<div id="tr" class="tr">{mount}</div>\n'
                f'<noscript><p>This trainer needs JavaScript.</p></noscript>\n<p><a href="train.html">cd ../train</a> · <a href="../secplus.html">cd ~/secplus</a></p>\n{data(d)}')
        page(f"secplus/{slug}.html", f"{title} :: Security+ :: 0xDay", body, depth=1, cur="learn", head=head + "", scripts=("train.js",), desc=desc)

    pg("weak", "Weak-spot drill", "weak --session", "Every miss in the flashcards, acronym trainer, scenario cards, pairings and PBQs is logged in your browser. This page builds a session out of the things you actually miss, worst first. Get an item right three times in a row and it drops off the list.",
       "", {"page": "weak", "cards": [{"id": c["id"], "o": c["o"], "q": c["q"], "a": c["a"]} for c in allcards], "acr": acr, "pairs": pairs, "sc": scen, "pbq": [{"id": p["id"], "title": p["title"], "o": p["o"]} for p in pbq]},
       "Security+ weak-spot drill: sessions built from the cards, acronyms and scenarios you missed.")
    pg("acronyms", "Acronym trainer", "acronyms --timed 60", f"{len(acr)} Security+ acronyms in 60-second rounds. Pick the right expansion before time runs out. Each wrong answer costs 3 seconds. Mastery per domain is saved in your browser.",
       "", {"page": "acr", "acr": acr}, "Timed Security+ acronym trainer with per-domain progress.")
    pg("pbq", "PBQ sims", "pbq --list", "Performance-based questions are the exam's hands-on tasks. These are my own practice versions: set firewall rules, match attacks to defenses, order the steps, and read the logs. All addresses are made up.",
       "", {"page": "pbq", "pbq": pbq}, "Security+ performance-based question simulations: firewall rules, matching, ordering, log reading.")
    pg("pairs", "Secure vs insecure", "pairs --drill", 'Every insecure protocol on the exam has a replacement. This drill pairs them with their ports. The plain <a href="../arcade/ports.html">ports flashcards</a> in the arcade cover the base list.',
       "", {"page": "pairs", "pairs": pairs}, "Drill pairing insecure protocols with their secure replacements and ports for Security+.")
    pg("scenarios", "Scenario cards", "scenario --random", "A short incident, four options. Pick the best control or response, then read why. Real exam questions are mostly this shape.",
       "", {"page": "sc", "sc": scen}, "Security+ scenario cards: short incidents where you choose the best control or response.")

    tiles = "".join(f'<a class="tile" href="{k}.html"><span class="tile__k">./{k}</span><span class="tile__v">{esc(d)}</span><span class="tile__n">{esc(m)}</span></a>' for k, t, d, m in PAGES)
    page("secplus/train.html", "Train :: Security+ :: 0xDay",
         f'''<p class="cmd">ls ~/secplus/train</p><h1>~/secplus/train</h1>
<p>Drills that go beyond flashcards. They all feed one miss log in your browser, so the <a href="weak.html">weak-spot drill</a> knows where to push. {len(acr)} acronyms, {len(pbq)} PBQ sims, {len(scen)} scenarios, {len(pairs)} protocol pairs.</p>
<div class="hub">{tiles}</div>
<p class="muted small" id="tr-sum"></p>
<p class="muted small">Everything is stored in localStorage only. Clearing site data resets it.</p>
<script id="tr-data" type="application/json">{json.dumps({"page": "hub"})}</script>''',
         depth=1, cur="learn", head=head, scripts=("train.js",), desc="Security+ training drills: weak spots, acronyms, PBQs, protocol pairs, scenarios.")
    return v
