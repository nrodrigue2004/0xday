#!/usr/bin/env python3
"""Split a pasted Professor Messer SY0-701 transcript into one file per exam objective.

    python3 scripts/secplus_import.py transcript.txt

Detects video headings such as
    "Security Controls - CompTIA Security+ SY0-701 - 1.1"
    "1.1 - Security Controls"      or   "## 1.1 Security Controls"
and writes the raw text to content/secplus/raw/<objective>.txt.

content/secplus/raw/ is git-ignored on purpose: the transcript is Professor Messer's
copyrighted material and this repo is public. Turn each raw file into your own notes in
content/secplus/notes/<objective>.md (this script creates a stub with one heading per video),
then run python3 build.py. Notes use the same light markdown as the skill guides.
"""
import os, re, sys

HEAD = [re.compile(r"SY0-?701\s*[-–—:]\s*(\d\.\d)\b", re.I),
        re.compile(r"^\s*#*\s*(\d\.\d)\s*[-–—:]?\s+\S"),
        re.compile(r"\((\d\.\d)\)\s*$")]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def title_of(line, oid):
    t = re.sub(r"\s*[-–—]\s*CompTIA Security\+.*$", "", line, flags=re.I)
    t = re.sub(r"^\s*#*\s*" + re.escape(oid) + r"\s*[-–—:]?\s*", "", t)
    return t.strip(" -–—:#") or oid


def main(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    parts, cur = {}, None
    for line in text.splitlines():
        oid = next((m.group(1) for r in HEAD if (m := r.search(line)) and len(line) < 160), None)
        if oid:
            cur = oid
            parts.setdefault(oid, []).append(("### " + title_of(line, oid), []))
            continue
        if cur is None:
            continue
        parts[cur][-1][1].append(line)
    if not parts:
        sys.exit("no objective headings found. Put a line like '1.1 - Security Controls' before each video's text.")
    raw = os.path.join(ROOT, "content/secplus/raw"); notes = os.path.join(ROOT, "content/secplus/notes")
    os.makedirs(raw, exist_ok=True); os.makedirs(notes, exist_ok=True)
    for oid, vids in sorted(parts.items()):
        with open(os.path.join(raw, f"{oid}.txt"), "w") as f:
            for h, body in vids:
                f.write(h + "\n" + "\n".join(body).strip() + "\n\n")
        n = os.path.join(notes, f"{oid}.md")
        if not os.path.exists(n):
            with open(n, "w") as f:
                f.write("\n\n".join(f"{h}\n- (your notes)" for h, _ in vids) + "\n")
        words = sum(len(" ".join(b).split()) for _, b in vids)
        print(f"{oid}: {len(vids):2d} videos, {words:6d} words -> content/secplus/raw/{oid}.txt")
    print("\nnext: write notes in content/secplus/notes/<id>.md (or ask Claude to), then python3 build.py")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
