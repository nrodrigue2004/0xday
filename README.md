# 0xDay

Personal site of Nathan: cybersecurity, computer science and tech. Live at https://nrodrigue2004.github.io/0xday/

## Editing

Content lives in `content/`:

- `content/posts.json` lists posts (slug, title, date, tags)
- `content/posts/<slug>.html` holds each post body
- `content/projects.json` lists projects
- `content/certs.json` holds the cert roadmap, Security+ domain progress (0-100), practice scores (`{"date","score","source"}`, scaled 100-900), study log, and your TryHackMe username (`thm_username`)
- `content/skills.json` holds the skills matrix (levels 1-5, each with a proof link)
- `content/now.json` is the ~/now page (update monthly)
- `content/changelog.json` is the git-log style changelog
- `content/resume.json` is the public resume (no phone, email, address or employer names)
- `content/cheatsheets.json` holds the man-page cheatsheets
- `content/ctf.json` rooms: `{"name","url","date","difficulty":"easy|medium|hard|insane","category","writeup":"<post-slug or URL>"}`
- `content/tools.json` tools: `{"name","lang","desc","repo","code"}`
- `content/detections.json` rules: `{"name","format":"sigma|suricata|zeek|elastic","attack":"T1110","desc","rule"}`
- `content/roadmap.json` is ~/roadmap, future project ideas: `{"name","slug","area","status":"next|building|idea|shipped|shelved","difficulty":1-5,"size":"weekend|weeks|months","pitch","stack":[...],"first_step"}` (built by `build_roadmap.py`; `area` can be anything, new areas get their own filter chip)
- `content/books.json` books: `{"title","author","status":"read|reading|queued","take"}`

Then rebuild the HTML and push:

```sh
python3 build.py
git add -A && git commit -m "Update site" && git push
```

`site.js` holds the menu and **ghost**, the scripted terminal assistant (press `` ` `` or Ctrl+K on any page).

The hidden site CTF flags live in `FLAGS` in `build.py` (only their SHA-256 hashes ship to the browser, but the flags themselves are discoverable on purpose).

## ~/code

The programming path. Chapters are `content/code/<slug>.txt` in the same format as the learn guides; order, stage labels and cross-links are in `CHAPTERS` in `build_code.py`. Each chapter's `:: ref` is merged into the cheatsheet named by its `sheet:` header, so commands show up on ~/man too. Lab data is generated, so keep answers and `:: verify` lines in sync when you edit it.

## ~/comptia

Later/optional certs after Security+. `content/comptia/certs.json` lists them; each built cert has `content/comptia/<slug>.txt` (format in the `build_comptia.py` docstring: per objective `@notes`, `@cards`, `@check`, `@lab`, `@answer`). CySA+ (CS0-004) is built. Network+ (`netplus.txt`), A+ Core 1 (`aplus.txt`) and A+ Core 2 (`aplus2.txt`) are built from Nate's own notes; a new cert is a `.txt` file plus a certs.json entry with `built: true` and a `domains` map.

## ~/detect, ~/crypto, ~/sdl, ~/mobile

Advanced security chapters for courses BLU310, CRY300 and SDL300. Chapters are `content/<section>/<slug>.txt` in the learn-guide format; sections, order and blurbs are in `SECTIONS` in `build_adv.py`, which also publishes each chapter's `:: ref` as a cheatsheet (`man sigma`, `man yara`, `man openssl`, `man appsec`, `man mobile`). Question banks are `content/courses/<CODE>.txt`; the courses are listed in `content/courses.json`.

## ~/ai

Chapters are `content/ai/<slug>.txt` in the same format as the learn guides (tiers plus optional lab); order and blurbs are in `CHAPTERS` in `build_ai.py`. The reading list is `content/ai/news.json` (hand-curated and dated, the site is static, so update it by hand and bump `updated`).

## ~/drills and ~/glossary

Drills are `content/drills/<slug>.txt` in the learn-guide format (tiers plus one lab, all data fictional); order and blurbs are in `CHAPTERS` in `build_drills.py`. The glossary is `content/glossary.json` (`t`, `d`, `c`, `l`); each link is `g:`/`s:`/`m:`/`d:`/`a:` plus a slug and the build fails if one is missing.

## ~/cloud

Cloud chapters are `content/cloud/<slug>.txt` in the learn-guide format; order and blurbs are in `CHAPTERS` in `build_cloud.py`. A chapter's `:: ref` becomes a man page named by `sheet:` in its header (`cloud`, `aws` or `az`). Labs are simulated (files, or canned `aws`/`az` output with `:: cmd ...$`, anchored so pipes still work); no lab touches a real account.

## ~/basics

Foundations chapters are `content/basics/<slug>.txt` in the same format as the learn guides (tables with `|` rows are supported); order and blurbs are in `CHAPTERS` in `build_basics.py`.

## Weird UI (all optional)

`fx.js` adds the tmux status bar, settings (`set` in ghost, or the toggles in the bar: crt, snd, fx, vim, boot), the first-visit boot + GRUB screen, glitch page transitions, sound, opt-in vim keys (`:` commands), the Ctrl+P fuzzy finder, the split-pane reader on the posts page and the `[ xxd ]` toggle on posts. `tty.js` is the shell at `tty.html`, `htop.js` the homelab dashboard at `htop.html`, `desktop.js` the i3 desktop at `desktop.html` (pages load inside it with `?embed=1`).

## ~/dojo (coding katas)

`dojo.html` and `dojo/<lang>.html` are built by `build_dojo.py` from `content/dojo/<lang>.kata` (format documented at the top of `build_dojo.py`). Python, C, x86, JavaScript, TypeScript and SQL katas run in the browser inside a Web Worker (`dojo/worker.js`): Pyodide, picoc compiled to WebAssembly (`dojo/picoc.wasm`, see `dojo/picoc/README.md`), `dojo/x86.js`, the TypeScript compiler and sql.js. Java, Bash and PowerShell katas hand out a self-test file to run locally. After adding or editing a kata, check that every reference solution passes:

```sh
npm i --no-save pyodide@0.26.4 sql.js@1.10.3 typescript@5.4.5
node scripts/check_dojo.js        # or: node scripts/check_dojo.js c python
```

## ~/arcade (games)

`arcade.html` and `arcade/<game>.html` are built by `build_arcade.py`, with `arcade.css` and `arcade.js`. **iptables** is a packet-triage reflex game (its levels and rule sets are at the top of the iptables section in `arcade.js`). **crack** is a Wordle-style game whose word list is `content/arcade/acronyms.txt` (`ACRONYM | expansion | note | category`, 3-6 letters). High scores and the daily streak live in the visitor's localStorage.

## ~/start, ~/jobs, ~/bullets

`content/start.json` is the ordered curriculum for `~/start` (stages, then steps: `id`, `t`, `h`, `w`, `m` minutes, `topic` = a ~/log topic key). Progress is keyed on `id`, so don't rename ids. Add `"if": "page.html"` to a step to include it only when that built page exists, which is how sections from other branches (cloud, programming, web) link in once they land; hrefs without `if` must exist or the build fails. `~/jobs` (application tracker) and `~/bullets` (bank built from `content/resume.json`, plus a job-posting keyword matcher whose terms are `KEYWORDS` in `build_start.py`) keep all data in the browser. All three are built by `build_start.py`, called last in `build.py`.

## ~/history and ~/cases

`content/history/<slug>.txt` (tech history from Lovelace to quantum, hacking timeline, future) and `content/cases/<slug>.txt` (real exploit and malware case studies) use the learn-guide format; order and blurbs are in `HISTORY` and `CASES` in `build_history.py`. A header `sources:` line is printed as a sources section; `sheet: history|cases` publishes the `:: ref` as a man page. Case studies explain public bugs for defenders: abridged excerpts of the public vulnerable source with the fix, never working exploits or malware. Labs are fictional toy programs with the same bug class (debug style stepper, or sandbox files).

## ~/ai/chat

Browser-only study assistant (`chat.js`, page from `build_chat.py`). `build_chat.index()` runs last in `build.py`: it reads the finished HTML of guides, Security+ notes, cheatsheets, drills, basics, cloud, code, careers, interview and ai pages, plus the glossary and Security+ flashcards, and writes `ai/chat-index.json` (about 1.4 MB). The browser ranks chunks with BM25 and quotes the best ones with links. The optional local model mode loads WebLLM from jsDelivr (version pinned in `chat.js`) and runs a small model on the visitor's GPU; it is off by default. There is no API key anywhere and there must never be one: a hosted model would need a small proxy server to hold the key.
