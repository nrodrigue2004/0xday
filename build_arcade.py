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
    ("ports", "ports and protocols flashcards: 20-card rounds, missed cards come back", "drill"),
    ("subnet", "subnet sprint: masks, hosts, network and broadcast in 60 seconds", "timed"),
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


def _ports():
    out = []
    for line in open("content/arcade/ports.txt"):
        if line.startswith("#") or "|" not in line:
            continue
        p, pr, svc, note = [x.strip() for x in line.split("|")]
        out.append({"p": int(p), "pr": pr, "s": svc, "n": note})
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
    prt = '''<p class="cmd">./ports --drill</p>
<h1>ports</h1>
<p>Flashcards for the ports and protocols Security+ and every help desk love to ask about. Each round is 20 cards, shown both ways (port to service, service to port). Cards you miss get a heavier weight and come back more often, and the weights are saved in your browser.</p>
<div class="ar-game prt" id="prt">
  <div class="ar-hud"><span class="prt-modes" id="prt-mode" role="group" aria-label="direction"><button class="btn btn--sm" type="button" data-mode="mix" aria-pressed="true">mixed</button> <button class="btn btn--sm" type="button" data-mode="p2s" aria-pressed="false">port&rarr;name</button> <button class="btn btn--sm" type="button" data-mode="s2p" aria-pressed="false">name&rarr;port</button></span><span>card <b id="prt-n">1/20</b></span><span>score <b id="prt-score">0</b></span><span>streak <b id="prt-streak">0</b></span><span>hi <b data-hi="ports">---</b></span></div>
  <div class="prt-q" id="prt-q" aria-live="polite"></div>
  <div class="prt-opts" id="prt-opts"></div>
  <div class="prt-msg" id="prt-msg" aria-live="polite"></div>
  <div class="ar-over" id="prt-over" hidden></div>
</div>
<p class="muted small">keys: <kbd>1</kbd>-<kbd>4</kbd> answer · <kbd>Enter</kbd> next card. Tap works too. Pairs with the <a href="../iptables.html">iptables</a> game. <a href="../arcade.html">cd ..</a></p>'''
    page("arcade/ports.html", "ports :: arcade :: 0xDay", prt, depth=1, cur="lab", head=head("../", {"game": "ports", "cards": _ports()}),
         desc="Ports and protocols flashcard drill for Security+ with spaced repetition of missed cards.")

    sn = '''<p class="cmd">./subnet --sprint 60</p>
<h1>subnet</h1>
<p>You have 60 seconds. Answer subnetting questions as fast as you can: masks, prefixes, usable hosts, network and broadcast addresses, and whether two hosts share a subnet. Every 4 right answers moves you up a level (harder prefixes). A wrong answer costs 3 seconds and shows the working so you can learn the trick.</p>
<div class="ar-game sn" id="sn">
  <div class="ar-hud"><span>time <b id="sn-t">60s</b></span><span>lvl <b id="sn-lvl">1</b></span><span>score <b id="sn-score">0</b></span><span>streak <b id="sn-streak">0</b></span><span>hi <b data-hi="subnet">---</b></span></div>
  <div class="sn-barwrap"><div class="sn-bar" id="sn-bar"></div></div>
  <div class="sn-q" id="sn-q" aria-live="polite"></div>
  <div class="sn-opts" id="sn-opts"></div>
  <div class="sn-msg" id="sn-msg" aria-live="polite"></div>
  <div class="ar-over" id="sn-over" hidden></div>
</div>
<p class="muted small">keys: <kbd>1</kbd>-<kbd>4</kbd> answer (<kbd>1</kbd>/<kbd>2</kbd> for yes/no) · <kbd>Enter</kbd> restart after time. Trick: block size = 256 &minus; the interesting mask octet; network = round the address down to a multiple of the block size. <a href="../arcade.html">cd ..</a></p>'''
    page("arcade/subnet.html", "subnet :: arcade :: 0xDay", sn, depth=1, cur="lab", head=head("../", {"game": "subnet"}),
         desc="Timed subnetting sprint: masks, usable hosts, network and broadcast addresses.")
    return len(GAMES)
