"""~/ai/ml-lab: train a small model in the browser. Called from build.py as build_ml.build(page, esc).
Behaviour in ml.js, styles in ml.css. No libraries, no network: plain JavaScript on a canvas."""
import hashlib


def build(page, esc):
    v = hashlib.sha1((open("ml.js").read() + open("ml.css").read()).encode()).hexdigest()[:8]
    body = '''<p class="cmd">python train.py --in-browser</p><h1>~/ai/ml-lab <span class="muted">train a model</span></h1>
<p>Pick a dataset, pick a model, and press train. Everything runs in your browser: the model is a few lines of JavaScript doing gradient descent, the same loop described in <a href="ml-regression.html">regression</a> and <a href="ml-classifiers.html">classifiers</a>. Two classes of points (green = benign, red = malicious). The background shows what the model predicts everywhere.</p>
<noscript><p class="callout">The playground needs JavaScript.</p></noscript>
<div class="ml" id="ml">
<div class="ml__ctl">
  <label>dataset <select id="ml-data"><option value="blobs">two blobs (easy)</option><option value="xor">xor corners</option><option value="rings">rings</option><option value="moons">two moons</option></select></label>
  <label>model <select id="ml-model"><option value="lin">logistic regression (a straight line)</option><option value="nn">neural net (8 hidden units)</option></select></label>
  <label>learning rate <input id="ml-lr" type="range" min="0.01" max="2" step="0.01" value="0.3"><output id="ml-lro"></output></label>
  <label>noise <input id="ml-noise" type="range" min="0" max="0.5" step="0.05" value="0.1"><output id="ml-noiseo"></output></label>
  <label>malicious share <input id="ml-pos" type="range" min="0.05" max="0.5" step="0.05" value="0.5"><output id="ml-poso"></output></label>
</div>
<div class="ml__row">
  <canvas id="ml-cv" width="360" height="360" aria-label="decision boundary plot"></canvas>
  <div class="ml__side">
    <p><button class="btn" id="ml-train" type="button">[ train ]</button> <button class="btn" id="ml-step" type="button">[ +50 epochs ]</button> <button class="btn" id="ml-new" type="button">[ new data / reset ]</button></p>
    <pre class="ml__stats" id="ml-stats" aria-live="polite"></pre>
    <label>threshold <input id="ml-thr" type="range" min="0.05" max="0.95" step="0.05" value="0.5"><output id="ml-thro"></output></label>
    <table class="ml__cm"><thead><tr><th></th><th>predicted benign</th><th>predicted malicious</th></tr></thead><tbody>
      <tr><th>actually benign</th><td id="ml-tn"></td><td id="ml-fp"></td></tr>
      <tr><th>actually malicious</th><td id="ml-fn"></td><td id="ml-tp"></td></tr></tbody></table>
    <p class="muted small" id="ml-msg"></p>
  </div>
</div>
</div>
<h2># things to try</h2>
<ol>
<li><strong>Straight line, easy data.</strong> Two blobs plus logistic regression reaches near-perfect accuracy in a few dozen epochs. Watch the loss fall.</li>
<li><strong>The model that cannot bend.</strong> Switch to rings or xor with logistic regression. No amount of training helps, because a straight line cannot separate them. This is <em>underfitting</em>: the model is too simple.</li>
<li><strong>Add capacity.</strong> Keep the rings and switch to the neural net. Train a few hundred epochs: the boundary curves around the inner ring.</li>
<li><strong>Break the learning rate.</strong> Set it to the maximum and train the net. Loss may bounce or stall. Too small and it crawls.</li>
<li><strong>The accuracy trap.</strong> Drop the malicious share to 5 percent. Accuracy stays high while recall (shown in the stats) falls. Move the threshold down and watch recall rise and precision fall.</li>
<li><strong>Overfit.</strong> Use moons with noise 0.4 and train the net for 1000+ epochs. Compare train accuracy with test accuracy: the gap is overfitting.</li>
</ol>
<p class="muted small">Honest limits: two features, a few hundred points, one hidden layer, fixed seed per dataset. Real security models have hundreds of features and messy labels. Train/test: 70/30 split, test points are drawn with a hollow marker. Chapters: <a href="ml-math.html">math refresher</a> &middot; <a href="ml-regression.html">regression</a> &middot; <a href="ml-classifiers.html">classifiers</a> &middot; <a href="ml-evaluation.html">evaluation</a>.</p>
<p><a href="../ai.html">cd ~/ai</a></p>'''
    page("ai/ml-lab.html", "ml playground :: ~/ai :: 0xDay", body, depth=1, cur="ai",
         head=f'\n<link rel="stylesheet" href="../ml.css?v={v}">\n<script src="../ml.js?v={v}" defer></script>',
         desc="Train a logistic regression or a small neural network in your browser and watch the decision boundary, loss, precision and recall.")
