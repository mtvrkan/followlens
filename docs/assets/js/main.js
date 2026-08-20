(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var doc = document.documentElement;

  var subs = [];
  var queued = false;

  function frame(fn) { subs.push(fn); }

  function run() {
    queued = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    for (var i = 0; i < subs.length; i++) subs[i](y, vh);
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });

  var totop = document.getElementById('totop');
  var ring = totop && totop.querySelector('.val');

  frame(function (y, vh) {
    var max = doc.scrollHeight - vh;
    var p = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;

    if (ring) ring.style.strokeDashoffset = String(100 - p * 100);
    if (totop) totop.classList.toggle('on', y > vh * 0.9);
  });

  if (totop) {
    totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  }

  var hdr = document.getElementById('hdr');
  if (hdr) {
    frame(function (y) { hdr.classList.toggle('compact', y > 40); });
  }

  var main = document.getElementById('main');
  var spine = document.getElementById('spine');
  var bands = Array.prototype.slice.call(document.querySelectorAll('[data-band]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#hnav a'));
  var lastActive = null;

  if (main && (spine || bands.length)) {
    frame(function (y, vh) {
      if (spine) {
        var top = main.offsetTop;
        var span = main.offsetHeight - vh;
        var p = span > 0 ? (y - top + vh * 0.5) / span : 1;
        spine.style.setProperty('--p', String(Math.min(Math.max(p, 0), 1)));
      }

      var mid = y + vh * 0.42;
      var active = null;
      for (var i = 0; i < bands.length; i++) {
        if (bands[i].offsetTop <= mid) active = bands[i];
      }
      if (active === lastActive) return;
      if (lastActive) lastActive.classList.remove('here');
      lastActive = active;
      if (active) active.classList.add('here');

      var id = active ? '#' + active.id : null;
      navLinks.forEach(function (a) {
        a.classList.toggle('here', a.getAttribute('href') === id);
      });
    });
  }

  var scrubbed = Array.prototype.slice.call(document.querySelectorAll('[data-sc]')).map(function (el) {
    return { el: el, nums: Array.prototype.slice.call(el.querySelectorAll('[data-sc-num]')) };
  });

  var numLocale = null;
  var numFmt = null;

  function group(n) {
    var want = doc.lang === 'tr' ? 'tr-TR' : 'en-GB';
    if (want !== numLocale) {
      numLocale = want;
      try { numFmt = new Intl.NumberFormat(want); } catch (e) { numFmt = null; }
    }
    return numFmt ? numFmt.format(n) : String(n);
  }

  function scrub(item, p) {
    item.el.style.setProperty('--p', String(p));

    for (var i = 0; i < item.nums.length; i++) {
      var target = Number(item.nums[i].dataset.scNum) || 0;
      item.nums[i].textContent = group(Math.round(target * p));
    }
  }

  if (scrubbed.length && !reduce.matches) {
    frame(function (y, vh) {
      for (var i = 0; i < scrubbed.length; i++) {
        var box = scrubbed[i].el.getBoundingClientRect();

        var p = (vh - box.top) / (vh * 0.75);
        scrub(scrubbed[i], Math.min(Math.max(p, 0), 1));
      }
    });
  } else {

    scrubbed.forEach(function (item) { scrub(item, 1); });
  }

  document.addEventListener('fl:langchange', function () {
    if (reduce.matches) scrubbed.forEach(function (item) { scrub(item, 1); });
    else request();
  });

  (function tour() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-pane]'));
    if (!tabs.length) return;
    var panes = Array.prototype.slice.call(document.querySelectorAll('.win-pane'));

    var lit = Array.prototype.slice.call(document.querySelectorAll('[data-lit-target]'));

    function select(n, focus) {
      tabs.forEach(function (t, i) {
        var on = i === n;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      panes.forEach(function (p, i) { p.classList.toggle('on', i === n); });
      var want = panes[n] && panes[n].dataset.lit;
      lit.forEach(function (el) { el.classList.toggle('on', el.dataset.litTarget === want); });
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
          : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select((i + d + tabs.length) % tabs.length, true);
      });
    });

  })();

  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!('IntersectionObserver' in window) || reduce.matches) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var parent = el.parentNode;
        var sibs = parent ? Array.prototype.slice.call(parent.querySelectorAll(':scope > .reveal')) : [];
        var order = Math.max(sibs.indexOf(el), 0);

        el.style.transitionDelay = Math.min(order * 70, 280) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });

    window.addEventListener('load', function () {
      setTimeout(function () {
        items.forEach(function (el) {
          if (el.classList.contains('in')) return;
          var box = el.getBoundingClientRect();
          if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('in');
        });
      }, 400);
    });
  }

  request();
})();
