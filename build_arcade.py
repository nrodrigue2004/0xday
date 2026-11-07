"""~/arcade: small terminal games for 0xDay.

Called from build.py as build_arcade.build(page, esc). Pages share arcade.css
and arcade.js; each game page ships its data inline as JSON.

Data:
  content/arcade/acronyms.txt   word list for crack (ACRONYM | expansion | note | category)
  iptables levels live in arcade.js (they're game logic, not content)
"""
import json, hashlib, os

GAMES = [
    ("iptables", "packet triage: ACCEPT or DROP before the queue overflows", "reflex"),
    ("crack", "crack the hash: guess the Security+ acronym in six tries", "daily + endless"),
]


def _ver():
    return hashlib.sha1((open("arcade.css").read() + open("arcade.js").read()).encode()).hexdigest()[:8]


def _acronyms():
    out = []
    for line in open("content/arcade/acronyms.txt"):
        if line.startswith("#") or "|" not in line:
            continue
        w, exp, note, cat = [x.strip() for x in line.split("|")]
        if 3 <= len(w) <= 6 and w.isalpha():
            out.append({"w": w.upper(), "x": exp, "n": note, "c": cat})
    return out


def build(page, esc):
    v = _ver()
    os.makedirs("arcade", exist_ok=True)

    def head(p, data=None):
        h = f'\n<link rel="stylesheet" href="{p}arcade.css?v={v}">\n<script src="{p}arcade.js?v={v}" defer></script>'
        if data is not None:
            h += f'\n<script id="ar-data" type="application/json">{json.dumps(data)}</script>'
        return h

    tiles = "".join(
        f'<a class="tile ar-tile" href="arcade/{k}.html"><span class="tile__k">./{k}</span>'
        f'<span class="tile__v">{esc(d)}</span><span class="tile__n">{esc(m)} · hi <b data-hi="{k}">---</b></span></a>'
        for k, d, m in GAMES)
    body = f'''<p class="cmd">ls /usr/games</p>
<h1>~/arcade</h1>
<pre class="ar-banner" aria-hidden="true">
                          _
  __ _ _ __ ___ __ _  __| | ___
 / _` | '__/ __/ _` |/ _` |/ _ \\
| (_| | | | (_| (_| | (_| |  __/
 \\__,_|_|  \\___\\__,_|\\__,_|\\___|  insert coin</pre>
<p>Small games that run in the browser. They're built for fun first, but you'll pick up ports and Security+ acronyms along the way. High scores stay in your browser.</p>
<div class="hub">{tiles}</div>
<p class="muted small">// bigger game projects I want to build (boot-sector game, emulators, a hacking sim) are on <a href="roadmap.html">~/roadmap</a>.</p>'''
    page("arcade.html", "arcade :: 0xDay", body, cur="lab", head=head(""),
         desc="Terminal-style browser games on 0xDay: packet triage and a Security+ acronym cracker.")

    ipt = '''<p class="cmd">sudo ./iptables --interactive</p>
<h1>iptables</h1>
<p>Packets come down the queue. Check each one against the chain and <b>ACCEPT</b> or <b>DROP</b> it before it hits the bottom. The first matching rule wins; if nothing matches, the policy applies. Let a bad packet through and that's a breach. Drop a good one and that's an outage. Three strikes and the box goes down.</p>
<div class="ar-game ipt" id="ipt">
  <div class="ar-hud"><span>lvl <b id="ipt-lvl">1</b></span><span>score <b id="ipt-score">0</b></span><span>x<b id="ipt-combo">1</b></span><span>hp <b id="ipt-hp">###</b></span><span>hi <b data-hi="iptables">---</b></span></div>
  <div class="ipt-grid">
    <div class="ipt-lane" id="ipt-lane" aria-live="off"><div class="ipt-wire"></div></div>
    <pre class="ipt-rules" id="ipt-rules" aria-live="polite"></pre>
  </div>
  <div class="ar-pad">
    <button class="btn ar-big ar-ok" type="button" id="ipt-acc">[ A ] ACCEPT</button>
    <button class="btn ar-big ar-bad" type="button" id="ipt-drop">[ D ] DROP</button>
  </div>
  <div class="ar-over" id="ipt-over" hidden></div>
</div>
<p class="muted small">keys: <kbd>A</kbd>/<kbd>&larr;</kbd> accept · <kbd>D</kbd>/<kbd>&rarr;</kbd> drop · <kbd>P</kbd> pause · <kbd>Enter</kbd> start. Early levels label each port with its service; later ones don't. <a href="../arcade.html">cd ..</a></p>'''
    page("arcade/iptables.html", "iptables :: arcade :: 0xDay", ipt, depth=1, cur="lab", head=head("../", {"game": "iptables"}),
         desc="Firewall reflex game: accept or drop packets against a changing iptables chain.")

    words = _acronyms()
    crk = '''<p class="cmd">./crack --mode daily</p>
<h1>crack</h1>
<p>The hash is a Security+ acronym. You get six guesses. After each one, every letter is marked as in the right spot, somewhere else in the word, or not in it at all. Any letters count as a guess, real acronym or not.</p>
<div class="ar-game crk" id="crk">
  <div class="ar-hud"><span class="crk-modes" role="group" aria-label="mode"><button class="btn btn--sm" type="button" data-mode="daily" aria-pressed="true">daily</button> <button class="btn btn--sm" type="button" data-mode="endless" aria-pressed="false">endless</button></span><span id="crk-stat"></span><span>hi <b data-hi="crack">---</b></span></div>
  <pre class="crk-hash" id="crk-hash"></pre>
  <div class="crk-board" id="crk-board" aria-live="polite"></div>
  <div class="crk-msg" id="crk-msg" aria-live="polite"></div>
  <div class="crk-kb" id="crk-kb"></div>
</div>
<p class="muted small">keys: type letters · <kbd>Enter</kbd> guess · <kbd>Backspace</kbd> delete · <kbd>?</kbd> hint (endless costs a point). The daily hash is the same for everyone and resets at midnight UTC. <a href="../arcade.html">cd ..</a></p>'''
    page("arcade/crack.html", "crack :: arcade :: 0xDay", crk, depth=1, cur="lab", head=head("../", {"game": "crack", "words": words}),
         desc="Wordle-style game where you crack a hash by guessing the Security+ acronym.")
    return len(GAMES)
