"""~/dojo: coding katas for every language on the site, rendered from content/dojo/*.kata.
Called from build.py as build_dojo.build(page, esc). Kept in its own file so it doesn't
collide with other work on build.py. Returns the number of katas.

Kata file format (one file per language, katas separated by "=== <slug>" lines):

  lang: python                 # header: lang, name, runtime, mode (browser|local), blurb, run
  === caesar-shift
  title: Caesar shift
  level: 1                     # 1-5
  tags: strings, crypto
  ctype: int                   # C only: int | hex | str | dbl | char (what the tests compare)
  ordered: yes                 # SQL only: row order matters
  prompt:                      # a key with nothing after the colon starts an indented block
    Write `caesar(s, k)` ...   # `backticks` become <code>, blank line = new paragraph
  starter:
    def caesar(s, k):
        pass
  solution:
    ...
  support:                     # optional: helpers appended after the user's code (C/SQL schema etc.)
  schema:                      # SQL only: CREATE/INSERT run before every attempt
  hints:
    - first nudge
    - bigger nudge
  test: shifts by one :: caesar("abc", 1) :: "bcd"      # name :: expression :: expected
"""
import json, os, re, hashlib, glob

ORDER = ["python", "c", "x86", "javascript", "typescript", "sql", "java", "bash", "powershell"]
BELT = {1: "white", 2: "yellow", 3: "green", 4: "brown", 5: "black"}
BLOCKS = {"prompt", "starter", "solution", "support", "schema", "hints", "notes"}


def parse(path):
    head, katas, cur, block = {}, [], None, None
    for raw in open(path, encoding="utf-8").read().split("\n"):
        line = raw.rstrip()
        m = re.match(r"^=== *([a-z0-9-]+)\s*$", line)
        if m:
            cur = {"id": m.group(1), "tests": []}; katas.append(cur); block = None; continue
        tgt = cur if cur is not None else head
        if block and (line.startswith("  ") or not line.strip()):
            tgt[block].append(line[2:] if line.startswith("  ") else ""); continue
        block = None
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([a-z_]+):\s?(.*)$", line)
        if not m:
            raise SystemExit(f"{path}: can't parse line: {line!r}")
        k, v = m.group(1), m.group(2)
        if k == "test":
            parts = [p.strip() for p in (v[:-3].split(" :: ") + [""] if v.endswith(" ::") else v.split(" :: "))]
            if len(parts) != 3:
                raise SystemExit(f"{path} [{cur and cur['id']}]: test needs 'name :: expr :: want': {v!r}")
            cur["tests"].append({"name": parts[0], "expr": parts[1], "want": parts[2]})
        elif v == "" and k in BLOCKS:
            block = k; tgt[k] = []
        else:
            tgt[k] = v
    for x in [head] + katas:
        for k in list(x):
            if isinstance(x[k], list) and k != "tests":
                x[k] = "\n".join(x[k]).strip("\n")
    for k in katas:
        k["level"] = int(k.get("level", 1))
        k["tags"] = [t.strip() for t in k.get("tags", "").split(",") if t.strip()]
        k["hints"] = [unquote(h[2:].strip() if h.startswith("- ") else h) for h in k.get("hints", "").split("\n") if h.strip()]
        k["ordered"] = k.get("ordered", "no") == "yes"
        if "schema" not in k and head.get("schema"):
            k["schema"] = head["schema"]  # a header-level schema is shared by every kata
        for need in ("title", "prompt", "starter", "solution"):
            if need not in k:
                raise SystemExit(f"{path} [{k['id']}]: missing {need}")
        if not k["tests"] and head.get("lang") != "sql":
            raise SystemExit(f"{path} [{k['id']}]: no tests")
    return head, katas


def unquote(h):
    """hints may be wrapped in "double quotes" (handy when they start with a backtick)"""
    if len(h) > 1 and h[0] == h[-1] == '"':
        h = h[1:-1].replace('\\"', '"').replace("\\\\", "\\")
    return h


def prose(t, esc):
    out = []
    for para in re.split(r"\n\s*\n", t.strip()):
        if para.startswith("    ") or para.startswith("```"):
            body = "\n".join(l[4:] if l.startswith("    ") else l for l in para.split("\n") if not l.startswith("```"))
            out.append(f"<pre><code>{esc(body)}</code></pre>"); continue
        h = esc(para)
        h = re.sub(r"`([^`]+)`", r"<code>\1</code>", h)
        h = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", h)
        if all(l.strip().startswith("- ") for l in para.split("\n")):
            items = [re.sub(r"`([^`]+)`", r"<code>\1</code>", esc(l.strip()[2:])) for l in para.split("\n")]
            out.append("<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"); continue
        out.append(f"<p>{h}</p>")
    return "".join(out)


def bar(n):
    return f'<span class="sk__lv" title="level {n}/5"><span class="bar__on">{"■" * n}</span><span class="bar__off">{"□" * (5 - n)}</span></span>'


def build(page, esc):
    langs = []
    for path in glob.glob("content/dojo/*.kata"):
        head, katas = parse(path)
        head["katas"] = katas
        head.setdefault("name", head["lang"])
        langs.append(head)
    langs.sort(key=lambda h: ORDER.index(h["lang"]) if h["lang"] in ORDER else 99)
    os.makedirs("dojo", exist_ok=True)
    v = hashlib.sha1("".join(open(f).read() for f in ("dojo.css", "dojo.js", "dojo/worker.js", "dojo/x86.js", "dojo/picoc-wasi.js")).encode()).hexdigest()[:8]
    total = sum(len(h["katas"]) for h in langs)

    for h in langs:
        L, ks = h["lang"], h["katas"]
        ks.sort(key=lambda k: k["level"])
        for i, k in enumerate(ks, 1):
            k["n"] = i
        rows = "".join(
            f'<li class="kata" id="{esc(k["id"])}" data-id="{esc(L)}/{esc(k["id"])}" data-level="{k["level"]}">'
            f'<button class="kata__head" type="button" aria-expanded="false">'
            f'<span class="kata__st" aria-label="not solved">[ ]</span>'
            f'<span class="kata__n">{k["n"]:02d}</span>'
            f'<span class="kata__title">{esc(k["title"])}</span>'
            f'<span class="kata__meta">{bar(k["level"])}<span class="kata__belt kata__belt--{BELT[k["level"]]}">{BELT[k["level"]]}</span>'
            f'<span class="kata__tags">{" ".join("#" + esc(t) for t in k["tags"])}</span></span></button>'
            f'<div class="kata__body" hidden><div class="kata__prompt">{prose(k["prompt"], esc)}</div></div></li>'
            for k in ks)
        data = {"lang": L, "name": h["name"], "mode": h.get("mode", "browser"), "runtime": h.get("runtime", ""), "run": h.get("run", ""),
                "ext": h.get("ext", ""), "katas": [{x: k[x] for x in ("id", "n", "title", "level", "starter", "solution", "hints", "tests", "ctype", "ordered", "support", "schema") if x in k} for k in ks]}
        mode = h.get("mode", "browser")
        badge = ('<span class="dj__mode dj__mode--browser">[runs in your browser]</span>' if mode == "browser"
                 else '<span class="dj__mode dj__mode--local">[runs in your own shell]</span>')
        body = f'''<p class="cmd">cd ~/dojo/{esc(L)} &amp;&amp; ls</p>
<h1>~/dojo/{esc(L)} <span class="muted">{len(ks)} katas</span></h1>
<p>{esc(h.get("blurb", ""))}</p>
<p class="dj__rt">{badge} <span class="muted">runtime:</span> {esc(h.get("runtime", ""))}</p>
{('<p class="muted small">' + esc(h["notes"]) + '</p>') if h.get("notes") else ''}
<div class="dj__prog" aria-live="polite"><span class="dj__bar"></span> <span class="dj__count">0/{len(ks)} solved</span></div>
<ol class="katas">{rows}</ol>
<p class="muted small">Keys inside the editor: <kbd>Tab</kbd> indents, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs the tests, <kbd>Esc</kbd> leaves the editor. Progress is saved in this browser only.</p>
<p><a href="../dojo.html">cd ..</a> <span class="muted">// all languages</span></p>
<script type="application/json" id="dojo-data">{json.dumps(data).replace("</", "<\\/")}</script>'''
        page(f"dojo/{L}.html", f"dojo/{L} :: 0xDay", body, depth=1, cur="lab",
             head=f'\n<link rel="stylesheet" href="../dojo.css?v={v}">\n<script src="../dojo.js?v={v}" defer></script>',
             desc=f"{h['name']} katas: short drills with tests, {'run right in the browser' if mode == 'browser' else 'with a self-test you run locally'}.")

    rows = "".join(
        f'<li><a class="ls-row dj__lang" href="dojo/{esc(h["lang"])}.html" data-lang="{esc(h["lang"])}" data-total="{len(h["katas"])}">'
        f'<span class="ls-perm">{"drwxr-xr-x" if h.get("mode", "browser") == "browser" else "drwxr-x---"}</span>'
        f'<span class="dj__lname">{esc(h["name"])}</span>'
        f'<span class="dj__lmode muted">{"browser" if h.get("mode", "browser") == "browser" else "local"}</span>'
        f'<span class="dj__lcount"><span class="dj__solved">0</span>/{len(h["katas"])}</span>'
        f'<span class="ls-title muted">{esc(h.get("runtime", ""))}</span></a></li>'
        for h in langs)
    index = [{"lang": h["lang"], "name": h["name"], "katas": [{"id": k["id"], "title": k["title"], "level": k["level"]} for k in h["katas"]]} for h in langs]
    body = f'''<p class="cmd">cat ~/dojo/README</p>
<h1>~/dojo</h1>
<p>Daily drills. A kata is a small problem you solve from a blank file, over and over, until the moves are automatic. Martial artists run kata to stay sharp; I run these across every language I ship in, from Python scripts to C and raw x86.</p>
<p>Each kata starts simple and the set climbs to hard. Write the code yourself, hit run, and the tests go green or tell you exactly what broke. Hints are there if you want them, and the reference solution unlocks after your first attempt. Visitors are welcome to grab a belt too.</p>
<div class="dj__today" hidden><p class="cmd">./drill --today</p><p class="dj__pick"></p></div>
<p class="dj__streak muted small" hidden></p>
<p class="cmd">ls -l ~/dojo</p>
<ul class="ls dj__langs">{rows}</ul>
<p class="muted small">{total} katas across {len(langs)} languages. Browser katas run locally in a sandboxed Web Worker (Pyodide, a C interpreter compiled to WebAssembly, SQLite, the real TypeScript compiler and an x86 emulator); nothing is sent to a server. Shell and JVM katas give you a self-test file to run on your own machine. Belts: white, yellow, green, brown, black.</p>
<script type="application/json" id="dojo-index">{json.dumps(index).replace("</", "<\\/")}</script>'''
    page("dojo.html", "dojo :: 0xDay", body, cur="lab",
         head=f'\n<link rel="stylesheet" href="dojo.css?v={v}">\n<script src="dojo.js?v={v}" defer></script>',
         desc="Daily coding drills in Python, C, x86, JavaScript, TypeScript, SQL, Java, Bash and PowerShell, with tests that run in the browser.")
    return total
