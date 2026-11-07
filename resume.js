// resume role switcher: [ all ] [ IT ] [ Cyber ] [ Software / Data ]; #it, #cyber, #dev deep-link a view
(function () {
  var btns = [].slice.call(document.querySelectorAll('.rs-role'));
  if (!btns.length) return;
  var hint = document.querySelector('.rs-hint'), cur = document.querySelector('.rs-cur');
  var keys = btns.map(function (b) { return b.dataset.role; }), active = 'all';
  function say(b) { if (hint) hint.textContent = '> ' + b.dataset.hint; }
  function show(k, push) {
    if (keys.indexOf(k) < 0) k = 'all';
    active = k;
    document.querySelectorAll('.rs-view').forEach(function (v) { v.hidden = v.dataset.role !== k; });
    btns.forEach(function (b) {
      if (b.dataset.role === k) { b.setAttribute('aria-current', 'true'); say(b); } else b.removeAttribute('aria-current');
    });
    if (cur) cur.textContent = k;
    if (push) history.replaceState(null, '', k === 'all' ? location.pathname : '#' + k);
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); show(b.dataset.role, true); });
    b.addEventListener('mouseenter', function () { say(b); });
    b.addEventListener('focus', function () { say(b); });
    b.addEventListener('mouseleave', function () { say(btns[keys.indexOf(active)]); });
    b.addEventListener('blur', function () { say(btns[keys.indexOf(active)]); });
  });
  show(location.hash.slice(1), false);
  window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });
})();
