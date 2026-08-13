/* FollowLens — page chrome and the scroll journey.
 *
 * Everything here is progressive: with this file missing the page is still a
 * complete, readable document — the header just stops contracting, the spine
 * stops filling, and the reveals never hide in the first place (CSS only hides
 * .reveal elements once this file has confirmed it can un-hide them).
 *
 * One rAF-throttled scroll handler drives the lot. Registering a second
 * listener per animated element is what makes pages like this stutter, so
 * anything that needs scroll position subscribes to `frame` instead.
 *
 * The set pieces themselves live in motion.js; translations in i18n.js.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var doc = document.documentElement;

  /* ── Frame loop ───────────────────────────────────────────────────────────
     Subscribers run once per animation frame in which the page moved. */

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

  /* ── Scroll progress: the back-to-top ring ───────────────────────────────
     There used to be a hairline across the very top of the viewport as well.
     It reported the same number twice, and it sat in the browser's own chrome
     line where it read as part of the browser rather than part of the page. */

  var totop = document.getElementById('totop');
  var ring = totop && totop.querySelector('.val');

  frame(function (y, vh) {
    var max = doc.scrollHeight - vh;
    var p = max > 0 ? Math.min(Math.max(y / max, 0), 1) : 0;

    // pathLength="100" on the circle, so the offset is the percentage left.
    if (ring) ring.style.strokeDashoffset = String(100 - p * 100);
    if (totop) totop.classList.toggle('on', y > vh * 0.9);
  });

  if (totop) {
    totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    });
  }

  /* ── Header: contracts into an island on the first scroll ─────────────────── */

  var hdr = document.getElementById('hdr');
  if (hdr) {
    frame(function (y) { hdr.classList.toggle('compact', y > 40); });
  }

  /* The mobile menu button and its full-screen panel used to live here. The
     panel listed the sections in the order you reach them by scrolling, which
     is the only navigation this page has ever really had — below 1040px the
     header now carries the language switch alone. */

  /* ── The journey: spine fill, active band, active nav link ────────────────
     The spine reports how far through <main> you are; the band whose middle is
     nearest the centre of the viewport lights its dot and its nav link. */

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

  /* ── Scroll-linked sections ───────────────────────────────────────────────
     Anything with data-sc gets --p set to how far it has travelled through the
     viewport, 0 as its top reaches the bottom edge and 1 once it has risen to
     the upper third. CSS does the rest, which keeps the interpolation on the
     compositor and makes scrubbing back up rewind the animation. */

  var scrubbed = Array.prototype.slice.call(document.querySelectorAll('[data-sc]')).map(function (el) {
    return { el: el, nums: Array.prototype.slice.call(el.querySelectorAll('[data-sc-num]')) };
  });

  // Grouping follows the language on screen — 1,281 in English is 1.281 in
  // Turkish, and the paragraph beside this counter already writes it that way.
  // Cached against <html lang> rather than rebuilt per frame, and re-derived
  // by that same check when the language changes, so no listener is needed.
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
    // A figure counting up alongside the bar that represents it has to be
    // driven by the same value, or the two disagree mid-scroll.
    for (var i = 0; i < item.nums.length; i++) {
      var target = Number(item.nums[i].dataset.scNum) || 0;
      item.nums[i].textContent = group(Math.round(target * p));
    }
  }

  if (scrubbed.length && !reduce.matches) {
    frame(function (y, vh) {
      for (var i = 0; i < scrubbed.length; i++) {
        var box = scrubbed[i].el.getBoundingClientRect();
        // 0 as the element's top reaches the bottom edge, 1 once it has risen
        // three quarters of a viewport further.
        var p = (vh - box.top) / (vh * 0.75);
        scrub(scrubbed[i], Math.min(Math.max(p, 0), 1));
      }
    });
  } else {
    // With motion reduced the resting state is the finished state.
    scrubbed.forEach(function (item) { scrub(item, 1); });
  }

  // Nothing re-runs on its own once the page has settled, so a language switch
  // has to ask for the figures to be re-written in the new locale.
  document.addEventListener('fl:langchange', function () {
    if (reduce.matches) scrubbed.forEach(function (item) { scrub(item, 1); });
    else request();
  });

  /* ── Dashboard tour tabs ──────────────────────────────────────────────────
     A real tablist: arrow keys move between tabs, and the sidebar of the mock
     window follows along so the two halves never disagree. */

  (function tour() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-pane]'));
    if (!tabs.length) return;
    var panes = Array.prototype.slice.call(document.querySelectorAll('.win-pane'));
    // Each pane names which chrome in the mock window it belongs under, rather
    // than matching by index. The window's tab strip has two entries and the
    // sidebar one more, but there are four panes — Compare lives inside
    // Detailed Analysis, so two panes light the same tab.
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

    // The mock window's chrome used to be clickable, back when its sidebar had
    // one item per pane. It no longer does — the window now mirrors the real
    // dashboard, whose sidebar is two pickers and a scan list — and the panes
    // are driven from the feature list beside it. The elements it lights up
    // live inside aria-hidden="true", so they must not become controls.
  })();

  /* ── Reveal ───────────────────────────────────────────────────────────────
     One-shot, staggered within each group. */

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
        // Capped so the last item in a long group never feels like it is lagging.
        el.style.transitionDelay = Math.min(order * 70, 280) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });

    /* A safety net: anything still hidden shortly after load, but on screen,
       gets shown. An element must never be stranded invisible by a missed
       observer callback. */
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
