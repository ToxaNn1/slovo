// The landing's only behaviour: the light/dark switch and the goal counter.
(function () {
  'use strict';

  // PLACEHOLDER: a demo number until the live count of confirmed Entries exists.
  var CONFIRMED = 48317;
  var GOAL = 1000000;

  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var chosen = null;

  function applyTheme() {
    var th = chosen || (mq.matches ? 'dark' : 'light');
    root.dataset.th = th;
    document.getElementById('theme-label').textContent = th === 'dark' ? 'Темна' : 'Світла';
  }
  document.getElementById('theme-toggle').addEventListener('click', function () {
    chosen = root.dataset.th === 'dark' ? 'light' : 'dark';
    applyTheme();
  });
  mq.addEventListener('change', applyTheme);
  applyTheme();

  function fmt(v) {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  var full = fmt(CONFIRMED);
  var digits = document.getElementById('digits');
  digits.setAttribute('aria-label', full);
  var cells = full.split('').map(function (ch) {
    var el = document.createElement('span');
    el.className = ch === ' ' ? 'digit-gap' : 'digit';
    digits.appendChild(el);
    return el;
  });
  var count = document.getElementById('goal-count');
  var pct = document.getElementById('goal-pct');
  var bar = document.getElementById('goal-bar');
  var share = (CONFIRMED / GOAL) * 100;
  pct.textContent = share.toLocaleString('uk-UA', { maximumFractionDigits: 1 }) + ' %';

  function show(n) {
    var shown = fmt(n);
    while (shown.length < full.length) shown = ' ' + shown;
    cells.forEach(function (el, i) {
      if (full[i] !== ' ') el.textContent = shown[i] === ' ' ? '0' : shown[i];
    });
    count.textContent = fmt(n);
    bar.style.width = Math.max(share * (n / (CONFIRMED || 1)), 0.8) + '%';
  }

  if (reduced) {
    show(CONFIRMED);
    return;
  }
  var start = performance.now();
  var DURATION = 1800;
  function step(now) {
    var p = Math.min(1, (now - start) / DURATION);
    show(Math.round(CONFIRMED * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
