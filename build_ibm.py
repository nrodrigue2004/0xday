"""~/ibm: IBM interview prep page, rendered from content/ibm-prep.md (headings, lists, paragraphs, **bold**,
`code`, [text](link), and [[placeholder]] marks). Called from build.py as build_ibm.build(page). Stdlib only."""
import re
import build_learn as L


def fmt(s):
    s = L.inline(s)
    return re.sub(r"\[\[(.+?)\]\]", r'<mark class="ph">[\1]</mark>', s)


def build(page):
    lines = open("content/ibm-prep.md").read().split("\n")
    out, ul, ol, para = [], [], [], []

    def flush():
        nonlocal ul, ol, para
        if para: out.append("<p>" + fmt(" ".join(para)) + "</p>"); para = []
        if ul: out.append('<ul class="arrow">' + "".join(f"<li>{fmt(x)}</li>" for x in ul) + "</ul>"); ul = []
        if ol: out.append("<ol>" + "".join(f"<li>{fmt(x)}</li>" for x in ol) + "</ol>"); ol = []

    title = "IBM interview prep"
    for ln in lines:
        m = re.match(r"(#{1,3}) (.*)", ln)
        if m:
            flush()
            n = len(m.group(1))
            if n == 1: title = m.group(2); continue
            out.append(f"<h{n}>{fmt(m.group(2))}</h{n}>")
        elif ln.startswith("- "):
            if para or ol: flush()
            ul.append(ln[2:])
        elif re.match(r"\d+\. ", ln):
            if para or ul: flush()
            ol.append(re.sub(r"^\d+\. ", "", ln))
        elif ln.strip() == "":
            flush()
        else:
            if ul or ol: flush()
            para.append(ln)
    flush()
    body = (f'<p class="cmd">cat ~/ibm</p><h1>{L.esc(title) if hasattr(L, "esc") else title}</h1>'
            '<style>mark.ph{background:#3a3000;color:#ffd95a;padding:0 .2em}</style>' + "\n".join(out) +
            '<p><a href="interview.html">cd ~/interview</a></p>')
    page("ibm.html", "ibm interview prep :: 0xDay", body, cur="lab",
         head='\n<meta name="robots" content="noindex">',
         desc="A 4-day plan, STAR answers and a homelab talking sheet for an IBM security interview.")
