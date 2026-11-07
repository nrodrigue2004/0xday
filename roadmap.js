// ~/roadmap: filter ideas by area, and ./pick --random
(function () {
  var items = [].slice.call(document.querySelectorAll('.rm__item'));
  if (!items.length) return;
  var chips = [].slice.call(document.querySelectorAll('.rm__chip'));
  var out = document.querySelector('.rm__out');
  function filter(area) {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.area === area)); });
    items.forEach(function (i) { i.hidden = area !== 'all' && i.dataset.area !== area; });
    [].forEach.call(document.querySelectorAll('.rm__sec'), function (s) {
      s.hidden = !s.querySelector('.rm__item:not([hidden])');
    });
    if (out) out.textContent = '';
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { filter(c.dataset.area); }); });
  var roll = document.querySelector('.rm__roll');
  if (roll) roll.addEventListener('click', function () {
    var pool = items.filter(function (i) { return !i.hidden && i.dataset.status !== 'shipped' && i.dataset.status !== 'shelved'; });
    if (!pool.length) return;
    items.forEach(function (i) { i.classList.remove('rm--hit'); });
    var n = 0, spins = 12, pick;
    (function spin() {
      pick = pool[Math.floor(Math.random() * pool.length)];
      if (out) out.textContent = '$ ./pick --random  -> ' + pick.querySelector('.rm__name').textContent;
      if (++n < spins) return setTimeout(spin, 40 + n * 12);
      pick.classList.add('rm--hit');
      pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (out) out.textContent += '   // go build it.';
    })();
  });
})();
