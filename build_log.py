"""~/log: weekly study log with a streak. Entries live in the browser (localStorage) only. Static page + log.js."""
import hashlib

TOPICS = [("secplus", "Security+"), ("homelab", "homelab"), ("dojo", "coding dojo"), ("interview", "interview prep"),
          ("thm", "TryHackMe"), ("reading", "reading / writing"), ("other", "other")]


def build(page, esc):
    ver = hashlib.sha1((open("log.css").read() + open("log.js").read()).encode()).hexdigest()[:8]
    head = f'\n<link rel="stylesheet" href="log.css?v={ver}">\n<script src="log.js?v={ver}" defer></script>'
    opts = "".join(f'<option value="{k}">{esc(v)}</option>' for k, v in TOPICS)
    body = f'''<p class="cmd">tail -f ~/log</p><h1>~/log</h1>
<p>A weekly study log. Add what you covered after each session and the streak takes care of itself. A day counts if you log anything, so a short session keeps the streak alive. Entries are saved in this browser only (nothing is sent anywhere), so use <strong>export</strong> now and then to keep a backup.</p>
<noscript><p class="callout">The log needs JavaScript.</p></noscript>
<div id="lg" class="lg">
<div class="lg__stats" aria-live="polite">
 <div class="tile"><span class="tile__k" id="lg-streak">0</span><span class="tile__v">day streak</span><span class="tile__n" id="lg-best"></span></div>
 <div class="tile"><span class="tile__k" id="lg-week">0 min</span><span class="tile__v">this week</span><span class="tile__n" id="lg-days"></span></div>
 <div class="tile"><span class="tile__k" id="lg-total">0</span><span class="tile__v">sessions logged</span><span class="tile__n" id="lg-hours"></span></div>
</div>
<form class="lg__form" id="lg-form" autocomplete="off">
 <p class="cmd">echo "..." &gt;&gt; ~/log</p>
 <div class="lg__row"><label>date<input type="date" id="lg-date" required></label>
 <label>topic<select id="lg-topic">{opts}</select></label>
 <label>minutes<input type="number" id="lg-min" min="1" max="720" value="30" required></label></div>
 <label class="lg__wide">what did you cover?<input type="text" id="lg-what" maxlength="200" placeholder="e.g. 2.3 vulnerability types, flashcards" required></label>
 <label class="lg__wide">one thing that stuck or was hard (optional)<input type="text" id="lg-note" maxlength="300"></label>
 <button class="btn" type="submit">[ log it ]</button> <span class="muted small" id="lg-msg" role="status"></span>
</form>
<h2># this week</h2><div class="lg__week" id="lg-weekgrid"></div>
<p class="muted small" id="lg-split"></p>
<h2># last 8 weeks</h2><pre class="lg__bars" id="lg-bars" aria-label="minutes per week"></pre>
<h2># goal</h2><p>Study on <select id="lg-goal"><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option></select> days a week. <span id="lg-goalmsg" class="muted"></span></p>
<h2># entries</h2><div id="lg-list" class="lg__list"></div>
<p class="lg__tools"><button class="btn" id="lg-export" type="button">[ export json ]</button> <button class="btn" id="lg-import" type="button">[ import json ]</button> <input type="file" id="lg-file" accept="application/json" hidden></p>
</div>
<p class="muted small">Related: <a href="secplus.html">~/secplus</a> · <a href="interview.html">~/interview</a> · <a href="dojo.html">~/dojo</a> · <a href="homelab.html">~/homelab</a></p>'''
    page("log.html", "log :: 0xDay", body, cur="lab", head=head, desc="Weekly study log with a streak counter, saved in your browser only.")
    return len(TOPICS)
