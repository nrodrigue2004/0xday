# 0xDay

Personal site of Nathan Rodrigue: cybersecurity, computer science and tech. Live at https://nrodrigue2004.github.io/0xday/

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
- `content/books.json` books: `{"title","author","status":"read|reading|queued","take"}`

Then rebuild the HTML and push:

```sh
python3 build.py
git add -A && git commit -m "Update site" && git push
```

`site.js` holds the menu and **ghost**, the scripted terminal assistant (press `` ` `` or Ctrl+K on any page).

The hidden site CTF flags live in `FLAGS` in `build.py` (only their SHA-256 hashes ship to the browser, but the flags themselves are discoverable on purpose).

## Weird UI (all optional)

`fx.js` adds the tmux status bar, settings (`set` in ghost, or the toggles in the bar: crt, snd, fx, vim, boot), the first-visit boot + GRUB screen, glitch page transitions, sound, opt-in vim keys (`:` commands), the Ctrl+P fuzzy finder, the split-pane reader on the posts page and the `[ xxd ]` toggle on posts. `tty.js` is the shell at `tty.html`, `htop.js` the homelab dashboard at `htop.html`, `desktop.js` the i3 desktop at `desktop.html` (pages load inside it with `?embed=1`).
