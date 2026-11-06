# 0xDay

Personal site of Nathan Rodrigue: cybersecurity, computer science and tech. Live at https://nrodrigue2004.github.io/0xday/

## Editing

Content lives in `content/`:

- `content/posts.json` lists posts (slug, title, date, tags)
- `content/posts/<slug>.html` holds each post body
- `content/projects.json` lists projects

Then rebuild the HTML and push:

```sh
python3 build.py
git add -A && git commit -m "Update site" && git push
```

`site.js` holds the menu and **ghost**, the scripted terminal assistant (press `` ` `` or Ctrl+K on any page).
