"""~/bigo: one compact page on Big-O. Called from build.py as build_bigo.build(page, esc).
Content lives here (it's small); behaviour is in bigo.js, styles in bigo.css."""
import hashlib, json

CLASSES = [
    ("O(1)", "constant", "Same work no matter how big the input is.",
     "def first(a):\n    return a[0]          # one step, 10 items or 10 million",
     "Array index, hash map get/set, push/pop on a stack."),
    ("O(log n)", "logarithmic", "Each step throws away half of what's left. A million items is about 20 steps.",
     "def search(a, x):         # a is sorted\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == x: return mid\n        if a[mid] < x: lo = mid + 1\n        else: hi = mid - 1\n    return -1",
     "Binary search, balanced tree lookups, heap push/pop."),
    ("O(n)", "linear", "Look at every item once. Double the input, double the work.",
     "def biggest(a):\n    best = a[0]\n    for x in a:            # n steps\n        best = max(best, x)\n    return best",
     "Scanning a log file, summing a list, `x in list`."),
    ("O(n log n)", "linearithmic", "A log n amount of work for each of the n items. The floor for comparison sorting.",
     "sorted(a)                  # Timsort\n# merge sort: split in half (log n levels),\n# merge each level (n work per level)",
     "Merge sort, heapsort, average quicksort, sort-then-scan tricks."),
    ("O(n²)", "quadratic", "Compare everything with everything. Fine at 100 items, painful at 100,000.",
     "def has_dup(a):\n    for i in range(len(a)):\n        for j in range(i + 1, len(a)):   # nested loop over the same input\n            if a[i] == a[j]: return True\n    return False",
     "Bubble/insertion sort, naive duplicate checks, all pairs."),
    ("O(2ⁿ)", "exponential", "Every extra item doubles the work. n = 50 is already out of reach.",
     "def fib(n):\n    if n < 2: return n\n    return fib(n - 1) + fib(n - 2)    # two calls per call",
     "Naive recursion, trying every subset, brute-forcing a key."),
]

TABLE_DS = [
    ("Array / list", "O(1)", "O(n)", "O(n)", "O(1)*", "index by position; inserting in the middle shifts everything"),
    ("Hash map / set", "n/a", "O(1) avg", "O(1) avg", "O(1) avg", "O(n) worst case if keys collide"),
    ("Linked list", "O(n)", "O(n)", "O(1)†", "O(1)†", "† once you hold the node"),
    ("Stack / queue", "top only", "O(n)", "O(1)", "O(1)", "push/pop, enqueue/dequeue"),
    ("Binary heap", "min O(1)", "O(n)", "O(log n)", "O(log n)", "priority queues, top-k"),
    ("Balanced BST", "O(log n)", "O(log n)", "O(log n)", "O(log n)", "sorted order for free"),
]
TABLE_SORT = [
    ("Bubble / insertion", "O(n)", "O(n²)", "O(n²)", "O(1)", "insertion sort is great on nearly-sorted data"),
    ("Merge sort", "O(n log n)", "O(n log n)", "O(n log n)", "O(n)", "stable"),
    ("Quicksort", "O(n log n)", "O(n log n)", "O(n²)", "O(log n)", "worst case on bad pivots"),
    ("Heapsort", "O(n log n)", "O(n log n)", "O(n log n)", "O(1)", "not stable"),
    ("Timsort (Python, Java objects)", "O(n)", "O(n log n)", "O(n log n)", "O(n)", "what sorted() actually runs"),
    ("Counting / radix", "O(n + k)", "O(n + k)", "O(n + k)", "O(n + k)", "small integer keys only"),
]

# the drill: code, answer, why
DRILL = [
    ("for x in a:\n    print(x)", "O(n)", "One pass over the input."),
    ("total = a[0] + a[-1]", "O(1)", "Two index lookups, independent of length."),
    ("for i in range(n):\n    for j in range(n):\n        grid[i][j] = 0", "O(n²)", "n inner steps for each of n outer steps."),
    ("i = n\nwhile i > 1:\n    i //= 2", "O(log n)", "i halves every loop."),
    ("a.sort()\nfor x in a:\n    ...", "O(n log n)", "The sort dominates; the scan after it is only O(n)."),
    ("seen = set()\nfor x in a:\n    if x in seen: return True\n    seen.add(x)", "O(n)", "Set membership is O(1) on average, done n times."),
    ("for x in a:\n    if x in b:      # b is a list\n        hits += 1", "O(n²)", "`in` on a list is a linear scan, nested inside a loop. Make b a set and it's O(n)."),
    ("def f(n):\n    if n == 0: return 1\n    return f(n - 1) + f(n - 1)", "O(2ⁿ)", "Two recursive calls per level, n levels deep."),
    ("for i in range(n):\n    for j in range(5):\n        ...", "O(n)", "The inner loop is a constant 5. Constants drop out."),
    ("for i in range(n):\n    j = 1\n    while j < n:\n        j *= 2", "O(n log n)", "A log n inner loop inside an n outer loop."),
    ("for x in a: ...\nfor y in b: ...", "O(n + m)", "Two separate loops add, they don't multiply. Two different inputs keep two letters."),
    ("lo, hi = 0, len(a) - 1\nwhile lo < hi:\n    if a[lo] + a[hi] == t: return True\n    if a[lo] + a[hi] < t: lo += 1\n    else: hi -= 1", "O(n)", "Two pointers moving toward each other: each step moves one, so n steps total."),
]
CHOICES = ["O(1)", "O(log n)", "O(n)", "O(n + m)", "O(n log n)", "O(n²)", "O(2ⁿ)"]


def build(page, esc):
    v = hashlib.sha1((open("bigo.js").read() + open("bigo.css").read()).encode()).hexdigest()[:8]
    cards = "".join(
        f'<div class="bo__card"><h3><span class="bo__o">{esc(o)}</span> <span class="muted">{esc(name)}</span></h3>'
        f'<p>{esc(what)}</p><pre><code>{esc(code)}</code></pre><p class="muted small">seen in: {esc(seen).replace("`x in list`", "<code>x in list</code>")}</p></div>'
        for o, name, what, code, seen in CLASSES)
    def table(head, rows):
        return ('<div class="bo__tw"><table class="bo__t"><thead><tr>' + "".join(f"<th>{esc(h)}</th>" for h in head) + "</tr></thead><tbody>"
                + "".join("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table></div>")
    body = f'''<p class="cmd">man big-o</p>
<h1>~/bigo <span class="muted">time complexity</span></h1>
<p>Big-O answers one question: <strong>when the input gets bigger, how much more work does the code do?</strong> It ignores constants and small terms, so <code>3n + 20</code> is just O(n). It describes the growth, not the stopwatch time.</p>

<h2>three levels</h2>
<div class="prose">
<p><strong>simple.</strong> Count the loops. No loop over the input: O(1). One loop: O(n). A loop inside a loop over the same input: O(n²). Cutting the problem in half each step: O(log n).</p>
<p><strong>mid.</strong> Drop constants and keep the biggest term: <code>n² + n</code> is O(n²). Separate loops add (O(n + m)), nested loops multiply (O(n·m)). Watch for hidden loops: <code>x in list</code>, <code>list.index()</code>, string concatenation in a loop and slicing are all O(n) on their own. Space counts too: building a set of n items is O(n) extra memory.</p>
<p><strong>complex.</strong> Big-O is an upper bound, Θ is a tight bound, Ω is a lower bound; interviews say "O" and mean Θ. Know best, average and worst case (quicksort is O(n log n) on average, O(n²) on a bad pivot) and amortized cost (appending to a dynamic array is O(1) amortized even though a resize is O(n)). For recursion, count calls × work per call: the master theorem gives T(n) = 2T(n/2) + O(n) = O(n log n) for merge sort. Comparison sorting can't beat O(n log n). Security angle: algorithmic complexity attacks (hash flooding, ReDoS) push code into its worst case on purpose.</p>
</div>

<h2>the six you need</h2>
<div class="bo__cards">{cards}</div>

<h2>visualizer</h2>
<p class="cmd">./grow --n <span class="bo__nv">16</span></p>
<div class="bo__viz" id="bo-viz">
  <label class="bo__slider">n = <input type="range" id="bo-n" min="1" max="64" value="16" aria-label="input size n"> <span class="bo__nv">16</span></label>
  <div class="bo__bars" id="bo-bars" aria-live="polite"></div>
  <p class="muted small">Operation counts for each class at the chosen n. Bars are on a log scale so O(1) stays visible; the numbers are exact. At 1 op per nanosecond, the time column is what a real machine would need.</p>
</div>

<h2>drill: what's the complexity?</h2>
<p class="muted">n is the length of <code>a</code>, m the length of <code>b</code>. Pick an answer; your score stays in this browser.</p>
<div class="bo__drill" id="bo-drill">
  <p class="bo__prog muted small"></p>
  <pre class="bo__code"><code></code></pre>
  <div class="bo__ch"></div>
  <p class="bo__why" aria-live="polite"></p>
  <p><button class="btn bo__next" type="button" hidden>[ next ]</button></p>
</div>

<h2>cheat table: data structures</h2>
{table(["structure", "access", "search", "insert", "delete", "note"], TABLE_DS)}
<p class="muted small">* append at the end is O(1) amortized; insert anywhere else is O(n).</p>
<h2>cheat table: sorting</h2>
{table(["algorithm", "best", "average", "worst", "extra space", "note"], TABLE_SORT)}

<p class="muted small">Related: the <a href="learn/data-structures-and-algorithms.html">data structures &amp; algorithms guide</a> and the <a href="dojo.html">dojo</a>.</p>
<script type="application/json" id="bo-data">{json.dumps({"drill": DRILL, "choices": CHOICES}).replace("</", "<\\/")}</script>'''
    page("bigo.html", "bigo :: 0xDay", body, cur="lab",
         head=f'\n<link rel="stylesheet" href="bigo.css?v={v}">\n<script src="bigo.js?v={v}" defer></script>',
         desc="Big-O time complexity: the six common classes with examples, a growth visualizer, a practice drill and cost tables.")
    return len(DRILL)
