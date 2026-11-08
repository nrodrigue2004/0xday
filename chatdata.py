"""Shared data loaders for ~/glossary and ~/ai/chat. Standard library only.

Sources (all plain text or JSON, edit these, not the generated pages):
  content/glossary.json         original glossary terms (JSON)
  content/glossary_more.txt     more terms, one per line:  Term | category | definition | links | aliases
                                links are space separated prefix:slug; aliases are comma separated; "-" means none
  content/chat_compare.txt      curated side-by-side comparisons (format described at the top of that file)
  content/chat_faq.txt          curated answers: troubleshooting, career, certs, commands, scenarios
Link prefixes: g=learn guide, s=Security+ objective, m=cheatsheet, d=drill, a=ai, b=basics, w=web, u=any site path without .html
"""
import json, os, re

TEMPLATES = {"g": "learn/{}.html", "s": "secplus/{}.html", "m": "man/{}.html", "d": "drills/{}.html", "a": "ai/{}.html",
             "b": "basics/{}.html", "w": "web/{}.html", "u": "{}.html"}


def resolve(l):
    """'g:python' -> (url, label). Raises SystemExit when the target page does not exist."""
    k, s = l.split(":", 1)
    url = TEMPLATES[k].format(s)
    if not os.path.exists(url):
        raise SystemExit(f"chat data: link {l} -> {url} does not exist")
    label = {"g": "guide: " + s, "s": "Security+ " + s, "m": "man " + s, "d": "drill: " + s, "a": "ai: " + s, "b": "basics: " + s, "w": "web: " + s}.get(k, s)
    return url, label


def _links(field):
    field = field.strip()
    return [] if field in ("", "-") else field.split()


def load_terms():
    terms = json.load(open("content/glossary.json"))["terms"]
    seen = {re.sub(r"[^a-z0-9+#]+", "", t["t"].lower()) for t in terms}
    if os.path.exists("content/glossary_more.txt"):
        for n, raw in enumerate(open("content/glossary_more.txt"), 1):
            raw = raw.strip()
            if not raw or raw.startswith("#"):
                continue
            p = [x.strip() for x in raw.split("|")]
            if len(p) < 3:
                raise SystemExit(f"glossary_more.txt:{n}: need at least term | category | definition")
            if len(p) > 5:
                raise SystemExit(f"glossary_more.txt:{n}: too many | fields ({len(p)})")
            p += ["-"] * (5 - len(p))
            key = re.sub(r"[^a-z0-9+#]+", "", p[0].lower())
            if key in seen:
                raise SystemExit(f"glossary_more.txt:{n}: duplicate term {p[0]}")
            seen.add(key)
            t = {"t": p[0], "c": p[1], "d": p[2], "l": _links(p[3])}
            al = [a.strip() for a in p[4].split(",") if a.strip() and a.strip() != "-"]
            if al:
                t["a"] = al
            terms.append(t)
    terms.sort(key=lambda t: t["t"].lower())
    return terms


def _blocks(path):
    """split a '## header' file into [(header, [lines])]"""
    out, cur = [], None
    if not os.path.exists(path):
        return out
    for raw in open(path):
        line = raw.rstrip("\n")
        if line.startswith("## "):
            cur = (line[3:].strip(), [])
            out.append(cur)
        elif cur is not None and line.strip() and not line.startswith("#"):
            cur[1].append(line.strip())
    return out


def load_compare():
    """## A | B | C   then 'Aspect: va | vb | vc' rows, 'pick: ...', 'links: ...', 'alias: x = A, y = B'"""
    out = []
    for head, lines in _blocks("content/chat_compare.txt"):
        items = [x.strip() for x in head.split("|")]
        c = {"items": items, "alias": {}, "rows": [], "pick": "", "links": []}
        for ln in lines:
            key, _, val = ln.partition(":")
            kl = key.strip().lower()
            if kl == "pick":
                c["pick"] = val.strip()
            elif kl == "links":
                c["links"] = [list(resolve(x)) for x in val.split()]
            elif kl == "alias":
                for pair in val.split(","):
                    a, _, b = pair.partition("=")
                    c["alias"][a.strip().lower()] = b.strip()
            else:
                vals = [x.strip() for x in val.split("|")]
                if len(vals) != len(items):
                    raise SystemExit(f"chat_compare.txt: '{head}' row '{key}' has {len(vals)} values, need {len(items)}")
                c["rows"].append([key.strip()] + vals)
        out.append(c)
    return out


def load_faq():
    """## id   then 'q: phrasing | phrasing', 'a: answer', optional 'links: u:slug ...'"""
    out = []
    for head, lines in _blocks("content/chat_faq.txt"):
        f = {"id": head, "q": [], "a": "", "links": []}
        for ln in lines:
            key, _, val = ln.partition(":")
            kl = key.strip().lower()
            if kl == "q":
                f["q"] += [x.strip() for x in val.split("|") if x.strip()]
            elif kl == "a":
                f["a"] = val.strip()
            elif kl == "links":
                f["links"] = [list(resolve(x)) for x in val.split()]
            else:
                raise SystemExit(f"chat_faq.txt: '{head}' unknown key {key}")
        if not f["q"] or not f["a"]:
            raise SystemExit(f"chat_faq.txt: '{head}' needs q: and a:")
        out.append(f)
    return out
