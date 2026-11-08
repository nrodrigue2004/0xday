"""~/glossary: terms from content/glossary.json, each linking to the guide, Security+ objective, cheatsheet or drill
that covers it. Called from build.py. Standard library only.
Link prefixes: g=learn guide, s=Security+ objective id, m=cheatsheet, d=drill, a=ai chapter. Every link is checked at build time."""
import json, os, html

esc = html.escape
KINDS = {"g": ("learn/{}.html", "guide"), "s": ("secplus/{}.html", "Security+ "), "m": ("man/{}.html", "man "),
         "d": ("drills/{}.html", "drill"), "a": ("ai/{}.html", "ai")}


def check(kind, slug):
    tmpl = KINDS[kind][0].format(slug)
    return os.path.exists(tmpl)


def label(kind, slug):
    return {"g": "guide: " + slug, "s": "Security+ " + slug, "m": "man " + slug, "d": "drill: " + slug, "a": "ai: " + slug}[kind]


def build(page):
    terms = json.load(open("content/glossary.json"))["terms"]
    cats = sorted({t["c"] for t in terms})
    rows, letters = "", []
    for t in terms:
        links = []
        for l in t["l"]:
            k, s = l.split(":", 1)
            if not check(k, s):
                raise SystemExit(f"glossary: '{t['t']}' links to missing {l}")
            links.append(f'<a href="{KINDS[k][0].format(s)}">{esc(label(k, s))}</a>')
        ch = t["t"][0].upper()
        anchor = ""
        if ch not in letters:
            letters.append(ch); anchor = f' id="g-{ch}"'
        slug = "".join(c if c.isalnum() else "-" for c in t["t"].lower()).strip("-")
        rows += (f'<div class="gl" data-c="{esc(t["c"])}" data-t="{esc((t["t"] + " " + t["d"]).lower())}"{anchor}>'
                 f'<dt id="t-{slug}"><code>{esc(t["t"])}</code> <span class="tag">{esc(t["c"])}</span></dt>'
                 f'<dd>{esc(t["d"])}' + (f'<span class="gl__see"> see: {" · ".join(links)}</span>' if links else "") + "</dd></div>")
    chips = "".join(f'<button type="button" class="tagchip chip" data-c="{esc(c)}">{esc(c)}</button>' for c in cats)
    jump = " ".join(f'<a href="#g-{c}">{c}</a>' for c in letters)
    page("glossary.html", "glossary :: 0xDay", f'''<p class="cmd">grep -i "" ~/glossary</p><h1>~/glossary</h1>
<p>{len(terms)} terms in plain language. Most link to the guide, Security+ objective, cheatsheet or drill where the idea is used. Type to filter, or pick a category.</p>
<p><input id="gl-q" class="gl__q" type="search" placeholder="filter terms..." aria-label="filter terms" autocomplete="off"> <span id="gl-n" class="muted small"></span></p>
<p class="gl__chips"><button type="button" class="tagchip chip on" data-c="">all</button>{chips}</p>
<p class="muted small gl__jump">{jump}</p>
<dl class="gloss" id="gloss">{rows}</dl>
<p class="muted small">Written in my own words. If a term is missing, it will be added; this is a study aid, not a standard.</p>''',
         cur="lab", scripts=("glossary.js",), desc=f"Glossary of {len(terms)} security and IT terms, linked to guides and drills.")
    return terms
