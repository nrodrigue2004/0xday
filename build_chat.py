"""~/ai/chat: the site chatbot. Called from build.py. Standard library only.

build(page)  writes ai/chat.html (the page shell; the logic is in chat.js).
index()      runs LAST in build.py: it reads the finished HTML of the study sections, splits it into
             heading-sized chunks and writes ai/chat-index.json, which chat.js searches in the browser.
             Also pulls in the glossary and the Security+ flashcards. Nothing is sent anywhere.
"""
import json, os, re, html
from html.parser import HTMLParser

esc = html.escape

# (directory, label) pairs whose pages are indexed. Files listed in SKIP are not.
DIRS = [("learn", "guide"), ("code", "code"), ("cloud", "cloud"), ("detect", "detect"), ("crypto", "crypto"), ("sdl", "sdl"), ("mobile", "mobile"), ("basics", "basics"), ("cs", "cs"), ("ai", "ai"),
        ("man", "man"), ("drills", "drill"), ("history", "history"), ("cases", "case"), ("careers", "careers"), ("interview", "interview")]
SECPLUS = re.compile(r"^\d\.\d\.html$")
SKIP = {"ai/chat.html", "ai/news.html"}
MAXCH = 900          # soft cap per chunk, in characters
BLOCK = {"p", "li", "pre", "tr", "h1", "h2", "h3", "h4", "div", "section", "ul", "ol", "table", "blockquote", "dt", "dd"}
DROP = {"script", "style", "button", "nav", "noscript", "form", "svg", "header", "footer"}


class Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = False
        self.skip = 0
        self.title = ""
        self.in_title = False
        self.chunks = []        # [heading, anchor, [text pieces]]
        self.cur = ["", "", []]
        self.anchor = ""
        self.head = None        # collecting heading text
        self.hbuf = []

    def flush(self):
        t = re.sub(r"[ \t]+", " ", "".join(self.cur[2]))
        t = re.sub(r"\n\s*\n+", "\n", t).strip()
        if len(t) > 40:
            self.chunks.append((self.cur[0], self.cur[1], t))
        self.cur[2] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "main":
            self.in_main = True
            return
        if not self.in_main:
            return
        if tag in DROP:
            self.skip += 1
        if self.skip:
            return
        if a.get("id") and tag in ("section", "h2", "h3", "h4", "h1", "div"):
            self.anchor = a["id"]
        if tag in ("h1", "h2", "h3", "h4"):
            self.flush()
            self.head = tag
            self.hbuf = []
        elif tag in BLOCK:
            self.cur[2].append("\n")
        if tag in ("td", "th"):
            self.cur[2].append(" | ")
        if tag == "br":
            self.cur[2].append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "main":
            self.in_main = False
            self.flush()
            return
        if not self.in_main:
            return
        if tag in DROP:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip:
            return
        if tag == self.head:
            h = re.sub(r"\s+", " ", "".join(self.hbuf)).strip()
            h = re.sub(r"^\d\d\s+", "", h)
            self.cur[0] = h
            self.cur[1] = self.anchor
            self.head = None
        elif tag in BLOCK:
            self.cur[2].append("\n")

    def handle_data(self, d):
        if self.in_title:
            self.title += d
        if not self.in_main or self.skip:
            return
        if self.head:
            self.hbuf.append(d)
        else:
            self.cur[2].append(d)


def split(text):
    """break a long chunk at line boundaries so no piece is far over MAXCH"""
    if len(text) <= MAXCH * 1.4:
        return [text]
    out, buf = [], ""
    for line in text.split("\n"):
        if buf and len(buf) + len(line) > MAXCH:
            out.append(buf.strip()); buf = ""
        buf += line + "\n"
    if buf.strip():
        out.append(buf.strip())
    return out


def pages():
    for d, label in DIRS:
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.endswith(".html") and f"{d}/{fn}" not in SKIP:
                yield f"{d}/{fn}", label
    for fn in sorted(os.listdir("secplus")):
        if SECPLUS.match(fn):
            yield f"secplus/{fn}", "Security+"


def clean_title(t):
    t = re.sub(r"\s*::\s*0xDay\s*$", "", t)
    t = re.sub(r"\s*::\s*~/\w+\s*$", "", t)
    return re.sub(r"^learn\s+", "", t).strip()


def index():
    recs = []   # [url, page title, heading, kind, text]
    for path, label in pages():
        ex = Extract()
        ex.feed(open(path).read())
        title = clean_title(ex.title)
        for head, anchor, text in ex.chunks:
            for i, piece in enumerate(split(text)):
                url = path + (f"#{anchor}" if anchor else "")
                recs.append([url, title, head, label, piece])
    # glossary
    for t in json.load(open("content/glossary.json"))["terms"]:
        link = t["l"][0].split(":", 1) if t.get("l") else None
        base = {"g": "learn/", "s": "secplus/", "m": "man/", "d": "drills/", "a": "ai/"}
        url = f"{base[link[0]]}{link[1]}.html" if link else "glossary.html"
        recs.append([url, "glossary", t["t"], "glossary", f'{t["t"]}: {t["d"]}'])
    # Security+ flashcards (one record per card, linked to its objective page)
    for fn in sorted(os.listdir("secplus")):
        if not SECPLUS.match(fn):
            continue
        m = re.search(r'<script type="application/json" id="cards-data">(.*?)</script>', open(f"secplus/{fn}").read(), re.S)
        if m:
            for c in json.loads(m.group(1).replace("<\\/", "</")):
                recs.append([f"secplus/{fn}", "Security+ " + fn[:-5], c["q"], "card", f'{c["q"]}\n{c["a"]}'])
    out = {"built": 1, "n": len(recs), "recs": recs}
    with open("ai/chat-index.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    return len(recs), os.path.getsize("ai/chat-index.json")


def build(page):
    body = '''<p class="cmd">ai --chat</p>
<h1>~/ai/chat</h1>
<p>A study assistant for this site. It searches the guides, Security+ notes, flashcards, glossary and cheatsheets, and answers with links to the pages it used. It runs in your browser: no server, no API key, no tracking.</p>
<p class="callout"><strong>Read this first.</strong> Search mode quotes the site and never invents anything, but it matches words, not meaning, so it can pull the wrong passage. Local model mode writes sentences and <strong>can be wrong and sound sure</strong>. Verify anything that matters against the linked page or official docs. How it works: <a href="ai-chatbot.html">~/ai/ai-chatbot</a>.</p>
<div id="chat" class="chat" data-index="chat-index.json">
  <div class="term chat__term">
    <div class="term__bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term__title">ghost-ai@0xday <span id="chat-mode" class="chat__mode">[search]</span></span></div>
    <div id="chat-log" class="chat__log" role="log" aria-live="polite"></div>
    <div id="chat-chips" class="chat__chips"></div>
    <form id="chat-form" class="chat__form" autocomplete="off"><label for="chat-in">guest@0xday:~$</label><input id="chat-in" spellcheck="false" autocapitalize="off" placeholder="ask about the site's topics, e.g. what is kerberos"><button class="btn" type="submit">[ ask ]</button></form>
  </div>
  <details class="chat__llm" id="chat-llm">
    <summary>advanced: local model <span class="muted small">(off, optional download)</span></summary>
    <div class="chat__llmbody">
      <p>Runs a small language model <strong>on your own graphics card</strong> through WebGPU and uses the passages found by search as its source. Your questions never leave the tab. Requires a recent Chrome or Edge on desktop. It loads a library from jsDelivr and the weights from Hugging Face, which are third-party hosts, and it caches the weights in your browser storage. Small models are weak: expect basic rewording of the search results, not deep reasoning.</p>
      <p id="chat-gpu" class="muted small"></p>
      <label for="chat-model">model</label>
      <select id="chat-model">
        <option value="SmolLM2-360M-Instruct-q4f16_1-MLC">SmolLM2 360M: about 250 MB download, 0.4 GB GPU memory, fastest, weakest</option>
        <option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">Qwen2.5 1.5B: about 1 GB download, 1.7 GB GPU memory, slower, better</option>
      </select>
      <p><button id="chat-load" class="btn" type="button">[ download + enable ]</button> <button id="chat-off" class="btn" type="button" hidden>[ back to search mode ]</button> <button id="chat-purge" class="btn" type="button">[ delete cached model ]</button></p>
      <div id="chat-prog" class="chat__prog" hidden><div id="chat-bar" class="chat__bar"></div><span id="chat-ptxt" class="muted small"></span></div>
    </div>
  </details>
  <p class="muted small">Why no hosted model like Claude or GPT? A static site can't keep an API key secret; anything in the page is public. A hosted model needs a small server in the middle to hold the key. See <a href="ai-chatbot.html">how it works</a>.</p>
</div>
<noscript><p>The chat needs JavaScript.</p></noscript>
<p><a href="../ai.html">cd ~/ai</a></p>'''
    page("ai/chat.html", "chat :: ~/ai :: 0xDay", body, depth=1, cur="ai", scripts=("chat.js",),
         desc="A browser-only study assistant for 0xDay: searches the site and cites its sources, with an optional local AI model.")
