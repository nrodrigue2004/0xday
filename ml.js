/* ~/ai/ml-lab: logistic regression or a 2-8-1 network trained by full-batch gradient descent on 2-D toy data. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const cv = $("#ml-cv"); if (!cv) return;
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height, R = 3;  // plot range -R..R
  let seed = 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const sig = z => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  let pts = [], model, epochs = 0, loss = 0, running = false, round = 1;

  function gen() {
    const kind = $("#ml-data").value, noise = +$("#ml-noise").value, pos = +$("#ml-pos").value, n = 240;
    seed = 1000 * round + kind.length * 7; pts = [];
    for (let i = 0; i < n; i++) {
      const y = rnd() < pos ? 1 : 0; let x1, x2;
      if (kind === "blobs") { const c = y ? 1.2 : -1.2; x1 = c + gauss() * (0.5 + noise * 2); x2 = c * 0.8 + gauss() * (0.5 + noise * 2); }
      else if (kind === "xor") { const a = rnd() < .5 ? 1 : -1, s = y ? a : -a; x1 = a * 1.3 + gauss() * (0.3 + noise); x2 = s * 1.3 + gauss() * (0.3 + noise); }
      else if (kind === "rings") { const r = y ? 0.9 : 2.1, t = rnd() * 6.283; x1 = r * Math.cos(t) + gauss() * (0.1 + noise); x2 = r * Math.sin(t) + gauss() * (0.1 + noise); }
      else { const t = rnd() * Math.PI; if (y) { x1 = Math.cos(t) * 1.4 - 0.7; x2 = Math.sin(t) * 1.4 - 0.5; } else { x1 = 0.7 - Math.cos(t) * 1.4; x2 = 0.5 - Math.sin(t) * 1.4; } x1 += gauss() * (0.1 + noise); x2 += gauss() * (0.1 + noise); }
      pts.push({ x: [x1, x2], y, test: i % 10 >= 7 });
    }
  }
  function init() {
    seed = 99 + round; const nn = $("#ml-model").value === "nn";
    model = nn ? { nn, H: 8, W1: Array.from({ length: 8 }, () => [gauss() * .7, gauss() * .7]), b1: new Array(8).fill(0), W2: Array.from({ length: 8 }, () => gauss() * .7), b2: 0 }
               : { nn, w: [0, 0], b: 0 };
    epochs = 0; loss = 0;
  }
  function predict(x) {
    if (!model.nn) return sig(model.w[0] * x[0] + model.w[1] * x[1] + model.b);
    let z = model.b2;
    for (let j = 0; j < model.H; j++) z += model.W2[j] * Math.tanh(model.W1[j][0] * x[0] + model.W1[j][1] * x[1] + model.b1[j]);
    return sig(z);
  }
  function epoch(lr) {
    const tr = pts.filter(p => !p.test), n = tr.length; let L = 0;
    if (!model.nn) {
      let g0 = 0, g1 = 0, gb = 0;
      tr.forEach(p => { const q = predict(p.x), e = q - p.y; g0 += e * p.x[0]; g1 += e * p.x[1]; gb += e; L -= p.y ? Math.log(q + 1e-9) : Math.log(1 - q + 1e-9); });
      model.w[0] -= lr * g0 / n; model.w[1] -= lr * g1 / n; model.b -= lr * gb / n;
    } else {
      const g = { W1: model.W1.map(() => [0, 0]), b1: new Array(model.H).fill(0), W2: new Array(model.H).fill(0), b2: 0 };
      tr.forEach(p => {
        const h = model.W1.map((w, j) => Math.tanh(w[0] * p.x[0] + w[1] * p.x[1] + model.b1[j]));
        const q = sig(model.b2 + h.reduce((s, v, j) => s + v * model.W2[j], 0)), e = q - p.y;
        L -= p.y ? Math.log(q + 1e-9) : Math.log(1 - q + 1e-9);
        g.b2 += e;
        for (let j = 0; j < model.H; j++) {
          g.W2[j] += e * h[j]; const d = e * model.W2[j] * (1 - h[j] * h[j]);
          g.W1[j][0] += d * p.x[0]; g.W1[j][1] += d * p.x[1]; g.b1[j] += d;
        }
      });
      model.b2 -= lr * g.b2 / n;
      for (let j = 0; j < model.H; j++) { model.W2[j] -= lr * g.W2[j] / n; model.W1[j][0] -= lr * g.W1[j][0] / n; model.W1[j][1] -= lr * g.W1[j][1] / n; model.b1[j] -= lr * g.b1[j] / n; }
    }
    loss = L / n; epochs++;
  }
  function metrics(set, thr) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    set.forEach(p => { const yh = predict(p.x) >= thr ? 1 : 0; if (p.y && yh) tp++; else if (!p.y && yh) fp++; else if (p.y) fn++; else tn++; });
    const n = set.length || 1;
    return { tp, fp, tn, fn, acc: (tp + tn) / n, prec: tp + fp ? tp / (tp + fp) : NaN, rec: tp + fn ? tp / (tp + fn) : NaN };
  }
  const pct = x => isNaN(x) ? "n/a" : (x * 100).toFixed(0) + "%";
  const X = v => (v + R) / (2 * R) * W, Y = v => H - (v + R) / (2 * R) * H;
  function draw() {
    const thr = +$("#ml-thr").value, c = 12;
    for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) {
      const p = predict([(i + .5) * c / W * 2 * R - R, R - (j + .5) * c / H * 2 * R]);
      ctx.fillStyle = p >= thr ? `rgba(255,80,80,${.12 + Math.abs(p - .5) * .5})` : `rgba(59,255,127,${.08 + Math.abs(p - .5) * .4})`;
      ctx.fillRect(i * c, j * c, c, c);
    }
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(X(p.x[0]), Y(p.x[1]), 4, 0, 6.283);
      const col = p.y ? "#ff5050" : "#3bff7f";
      if (p.test) { ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
    });
    const tr = metrics(pts.filter(p => !p.test), thr), te = metrics(pts.filter(p => p.test), thr), all = metrics(pts, thr);
    $("#ml-stats").textContent =
      `epochs     ${epochs}\nloss       ${epochs ? loss.toFixed(3) : "-"}\ntrain acc  ${pct(tr.acc)}\ntest acc   ${pct(te.acc)}   (hollow points)\nprecision  ${pct(all.prec)}\nrecall     ${pct(all.rec)}   (all points, at the threshold)`;
    $("#ml-tn").textContent = all.tn; $("#ml-fp").textContent = all.fp; $("#ml-fn").textContent = all.fn; $("#ml-tp").textContent = all.tp;
    const msg = [];
    if (+$("#ml-pos").value <= 0.15 && all.acc > .9 && all.rec < .7) msg.push("Accuracy looks great but recall is low: the model is missing most of the rare malicious points.");
    if (epochs > 150 && tr.acc - te.acc > .1) msg.push("Train accuracy is well above test accuracy: that gap is overfitting.");
    if (epochs > 200 && !model.nn && all.acc < .75) msg.push("A straight line is not enough for this data. Try the neural net.");
    $("#ml-msg").textContent = msg.join(" ");
    $("#ml-lro").textContent = $("#ml-lr").value; $("#ml-noiseo").textContent = $("#ml-noise").value; $("#ml-poso").textContent = $("#ml-pos").value; $("#ml-thro").textContent = $("#ml-thr").value;
  }
  function run(n) {
    if (running) return; running = true; let i = 0; const lr = +$("#ml-lr").value;
    (function go() { for (let k = 0; k < 5 && i < n; k++, i++) epoch(lr); draw(); if (i < n) requestAnimationFrame(go); else running = false; })();
  }
  function fresh(bump) { if (bump) round++; running = false; gen(); init(); draw(); }
  $("#ml-train").onclick = () => run(300);
  $("#ml-step").onclick = () => run(50);
  $("#ml-new").onclick = () => fresh(true);
  ["#ml-data", "#ml-noise", "#ml-pos"].forEach(s => $(s).addEventListener("change", () => fresh(false)));
  $("#ml-model").addEventListener("change", () => { init(); draw(); });
  ["#ml-lr", "#ml-thr"].forEach(s => $(s).addEventListener("input", draw));
  window.__ml = { epoch, metrics, get pts() { return pts; }, fresh, draw, get model() { return model; } };
  fresh(false);
})();
