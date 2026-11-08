"""~/ossim and ~/dbsim: browser-only teaching simulators for CS220 and CS230.
Called from build.py as build_sims.build(page, esc). Logic and wiring are in sims.js, styles in sims.css."""
import hashlib


def _head():
    v = hashlib.sha1((open("sims.js").read() + open("sims.css").read()).encode()).hexdigest()[:8]
    return f'\n<link rel="stylesheet" href="sims.css?v={v}">\n<script src="sims.js?v={v}" defer></script>'


def _panel(title, intro, inner):
    return f'<section class="sm__p"><h2>{title}</h2><p>{intro}</p>{inner}</section>'


OS_BODY = '''<p class="cmd">./ossim</p><h1>~/ossim <span class="muted">operating-system simulators</span></h1>
<p>Three small tools for <a href="courses/CS220.html">CS220</a>. Do the problem by hand first, then check yourself here. Everything runs in your browser.</p>
<div id="sim-root">
''' + _panel("CPU scheduler",
"One process per line: <code>name arrival burst [priority]</code>, whole numbers. Lower priority number runs first. Load the 24/3/3 example and compare FCFS (average wait 17) with SJF (3) and round robin.",
'''<textarea id="sch-in" class="sm__ta" rows="6" spellcheck="false" aria-label="processes">A 0 8 2
B 1 4 1
C 2 9 3
D 3 5 2</textarea>
<p class="sm__row"><label>algorithm <select id="sch-algo"><option value="fcfs">FCFS</option><option value="sjf">SJF (non-preemptive)</option><option value="srtf">SRTF (preemptive SJF)</option><option value="prio">priority (non-preemptive)</option><option value="rr">round robin</option></select></label>
<label id="sch-qrow" hidden>quantum <input id="sch-q" type="number" min="1" max="20" value="4"></label>
<button class="btn btn--sm" type="button" id="sch-run">[ run ]</button> <button class="btn btn--sm" type="button" id="sch-ex">[ load 24/3/3 ]</button></p>
<div id="sch-run-out" aria-live="polite"></div>''') + _panel("Page replacement",
"Reference string of page numbers, and how many frames. FIFO, LRU and optimal run side by side. The Belady button loads the classic string where FIFO gets <em>worse</em> from 3 to 4 frames.",
'''<p class="sm__row"><label>reference string <input id="pg-refs" class="sm__in" value="7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1"></label>
<label>frames <input id="pg-n" type="number" min="1" max="8" value="3"></label>
<button class="btn btn--sm" type="button" id="pg-run">[ run ]</button> <button class="btn btn--sm" type="button" id="pg-ex">[ Belady, 3 frames ]</button> <button class="btn btn--sm" type="button" id="pg-ex2">[ Belady, 4 frames ]</button></p>
<div id="pg-run-out" aria-live="polite"></div>''') + _panel("Deadlock avoidance: Banker's algorithm",
"One row per process. Enter the allocation matrix, the max-demand matrix and the available vector. The tool computes need, looks for a safe sequence, and can test a request (<code>process r1 r2 r3</code>, e.g. <code>1 1 0 2</code>).",
'''<p class="sm__row"><label>resource types <input id="bk-m" type="number" min="1" max="6" value="3"></label> <label>available <input id="bk-av" class="sm__in" value="3 3 2"></label></p>
<div class="sm__two"><label>allocation<textarea id="bk-al" class="sm__ta" rows="6" spellcheck="false">0 1 0
2 0 0
3 0 2
2 1 1
0 0 2</textarea></label>
<label>max<textarea id="bk-mx" class="sm__ta" rows="6" spellcheck="false">7 5 3
3 2 2
9 0 2
2 2 2
4 3 3</textarea></label></div>
<p class="sm__row"><label>test a request <input id="bk-rq" class="sm__in" placeholder="1 1 0 2"></label>
<button class="btn btn--sm" type="button" id="bk-run">[ run ]</button> <button class="btn btn--sm" type="button" id="bk-ex">[ load textbook example ]</button> <button class="btn btn--sm" type="button" id="bk-ex2">[ example: risky request ]</button></p>
<div id="bk-run-out" aria-live="polite"></div>''') + '''</div>
<noscript><p class="callout">The simulators need JavaScript.</p></noscript>
<p class="muted small">Related: <a href="courses/CS220.html">CS220 operating systems</a> · <a href="dbsim.html">~/dbsim</a> · <a href="learn/operating-systems.html">operating-systems guide</a> · <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/" rel="noopener" target="_blank">OSTEP (free book)</a></p>'''

DB_BODY = '''<p class="cmd">./dbsim</p><h1>~/dbsim <span class="muted">database design and performance tools</span></h1>
<p>Three tools for <a href="courses/CS230.html">CS230</a>: find keys and normal forms, see why an index helps (and when it does not), and test whether a set of overlapping transactions is serializable.</p>
<div id="sim-root">
''' + _panel("Functional dependencies and normal forms",
"One dependency per line, like <code>order_id product_id -> qty</code>. The tool finds every candidate key, the prime attributes and the highest normal form, and lists what violates the next one. Extra attributes with no dependency go in the second box. Closure asks: from these columns, what can I derive?",
'''<textarea id="fd-in" class="sm__ta" rows="5" spellcheck="false" aria-label="dependencies">order_id product_id -> qty
product_id -> product_name
order_id -> customer_id
customer_id -> customer_email</textarea>
<p class="sm__row"><label>extra attributes <input id="fd-ex" class="sm__in" value="qty"></label> <label>closure of <input id="fd-cl" class="sm__in" placeholder="order_id"></label>
<button class="btn btn--sm" type="button" id="fd-run">[ analyze ]</button> <button class="btn btn--sm" type="button" id="fd-exa">[ orders example ]</button> <button class="btn btn--sm" type="button" id="fd-exb">[ 3NF but not BCNF ]</button></p>
<div id="fd-run-out" aria-live="polite"></div>''') + _panel("Index versus table scan",
"A simplified cost model counted in page reads. The B-tree walk costs its height, then one table page for every matching row. A scan reads every page. Slide the table size, then raise the rows returned and watch the planner give up on the index.",
'''<p class="sm__row"><label>table rows 10^<input id="ix-rows" type="range" min="3" max="9" value="6"> <b id="ix-rowsv"></b></label>
<label>rows returned <input id="ix-k" type="number" min="1" value="1"></label>
<label>fanout <input id="ix-fan" type="number" min="2" value="100"></label>
<label>rows per page <input id="ix-pp" type="number" min="1" value="100"></label>
<button class="btn btn--sm" type="button" id="ix-run">[ run ]</button></p>
<div id="ix-run-out" aria-live="polite"></div>''') + _panel("Schedule serializability",
"Write a schedule as <code>r1(x) w2(x) ...</code> (transaction number, item). The tool draws the precedence graph as a list of edges and says whether the schedule is conflict-serializable, with an equivalent serial order if so.",
'''<textarea id="tx-in" class="sm__ta" rows="2" spellcheck="false" aria-label="schedule">r1(x) r2(x) w1(x) w2(x)</textarea>
<p class="sm__row"><button class="btn btn--sm" type="button" id="tx-run">[ check ]</button> <button class="btn btn--sm" type="button" id="tx-exa">[ serial-like ]</button> <button class="btn btn--sm" type="button" id="tx-exb">[ lost update ]</button> <button class="btn btn--sm" type="button" id="tx-exc">[ cycle ]</button></p>
<div id="tx-run-out" aria-live="polite"></div>''') + '''</div>
<noscript><p class="callout">The tools need JavaScript.</p></noscript>
<p class="muted small">Related: <a href="courses/CS230.html">CS230 databases</a> · <a href="ossim.html">~/ossim</a> · <a href="learn/databases-and-sql.html">databases guide</a> · <a href="learn/sql.html">SQL guide</a></p>'''


def build(page, esc):
    head = _head()
    page("ossim.html", "ossim :: 0xDay", OS_BODY, cur="lab", head=head,
         desc="Operating-system simulators: CPU scheduling, page replacement and Banker's algorithm.")
    page("dbsim.html", "dbsim :: 0xDay", DB_BODY, cur="lab", head=head,
         desc="Database tools: functional dependencies and normal forms, index versus scan, schedule serializability.")
    return 2
