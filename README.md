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

Then rebuild the HTML and push:

```sh
python3 build.py
git add -A && git commit -m "Update site" && git push
```

`site.js` holds the menu and **ghost**, the scripted terminal assistant (press `` ` `` or Ctrl+K on any page).

The hidden site CTF flags live in `FLAGS` in `build.py` (only their SHA-256 hashes ship to the browser, but the flags themselves are discoverable on purpose).
