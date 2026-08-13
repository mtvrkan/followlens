/* FollowLens — the animated set pieces.
 *
 * Each one demonstrates a real product behaviour rather than decorating the
 * page: the hero loses followers, the scanner collects, the tabs show what the
 * results view shows. Everything here is decorative in the accessibility sense
 * (the containers are aria-hidden and the same facts are in the prose), so
 * under prefers-reduced-motion this file does nothing at all and CSS leaves
 * every piece in a composed resting state.
 *
 * The scroll-scrubbed pieces — the chart, the export deck, the quality meter —
 * are NOT here. They are pure CSS driven by a `--p` custom property that
 * main.js writes from scroll position, so that scrubbing back up rewinds them.
 *
 * Every loop below is driven by an IntersectionObserver and stops when its
 * section leaves the viewport. A page this animated should cost nothing while
 * you are reading a different part of it.
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /** Runs `start` while the element is on screen and calls `stop` when it leaves. */
  function whileVisible(el, start, stop) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { start(); return; }
    var running = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !running) { running = true; start(); }
        else if (!e.isIntersecting && running) { running = false; if (stop) stop(); }
      });
    }, { threshold: 0.25 }).observe(el);
  }

  /** Runs `fn` once, the first time the element is on screen. */
  function onceVisible(el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        fn();
      });
    }, { threshold: 0.3 });
    io.observe(el);
  }

  /* Grouping follows the language on screen: 1,284 in English is 1.284 in
     Turkish. Cached against <html lang>, which i18n.js sets — so a switch is
     picked up on the counter's next tick without a listener here. */
  var numLocale = null;
  var numFmt = null;

  function group(n) {
    var want = document.documentElement.lang === 'tr' ? 'tr-TR' : 'en-GB';
    if (want !== numLocale) {
      numLocale = want;
      try { numFmt = new Intl.NumberFormat(want); } catch (e) { numFmt = null; }
    }
    return numFmt ? numFmt.format(n) : String(n);
  }

  /** An <svg class="i"><use href="#id"/></svg>, built the way the markup does. */
  function icon(id, cls) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  /** Stable hue per handle, so a person keeps their colour across sections.
   *
   *  Hashes the whole handle, not just its first character. With the previous
   *  roster the initials happened to be spread out; this one has three names
   *  starting with s and three with m, and one character in meant the scanner
   *  list showed the same colour three rows apart and read as a repeat. */
  function hue(name, salt) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100003;
    return String((h * salt) % 360);
  }

  /* ── Hero: the follower count drops and three people peel away ─────────── */

  (function hero() {
    var card = document.querySelector('[data-ig]');
    if (!card) return;
    var out = card.querySelector('[data-count]');
    var live = card.querySelector('.live');
    var leavers = Array.prototype.slice.call(card.querySelectorAll('[data-leaver]'));
    var verdict = document.querySelector('[data-verdict]');
    var timers = [];

    function clear() { timers.forEach(clearTimeout); timers = []; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function cycle() {
      var n = 1284;
      out.textContent = group(n);
      live.classList.remove('drop');
      if (verdict) verdict.classList.remove('on');
      leavers.forEach(function (l) { l.classList.remove('gone'); });
      // Reflow, so removing and re-adding the class restarts the animation.
      void card.offsetWidth;

      leavers.forEach(function (leaver, i) {
        later(function () {
          leaver.classList.add('gone');
          n -= 1;
          out.textContent = group(n);
          live.classList.add('drop');
          later(function () { live.classList.remove('drop'); }, 600);
        }, 900 + i * 1500);
      });

      later(function () { if (verdict) verdict.classList.add('on'); }, 900 + leavers.length * 1500 + 700);
      later(cycle, 900 + leavers.length * 1500 + 4200);
    }

    whileVisible(card, cycle, clear);
  })();

  /* ── "The problem": the same three disappearing, as a bare number ──────── */

  (function versus() {
    var el = document.querySelector('[data-count-down]');
    if (!el) return;
    var timers = [];
    function clear() { timers.forEach(clearTimeout); timers = []; }

    function run() {
      el.textContent = group(1284);
      for (var i = 1; i <= 3; i++) {
        (function (step) {
          timers.push(setTimeout(function () {
            el.textContent = group(1284 - step);
          }, 1200 + step * 900));
        })(i);
      }
      timers.push(setTimeout(run, 7000));
    }
    whileVisible(el, run, clear);
  })();

  /* ── Rotating word ─────────────────────────────────────────────────────── */

  (function rotator() {
    var box = document.querySelector('[data-rotator]');
    if (!box) return;
    var words = Array.prototype.slice.call(box.children);
    if (!words.length) return;
    var i = 0;
    var timer = null;

    // The words are absolutely positioned, so the box has no width of its own.
    // Reserve the WIDEST of them, not the current one: sizing to each word in
    // turn re-flows the headline every few seconds, and once a word is long
    // enough to push the following text past the end of the line the whole
    // sentence jumps between two and three lines as it cycles.
    function fit() {
      var max = 0;
      for (var n = 0; n < words.length; n++) max = Math.max(max, words[n].offsetWidth);
      box.style.setProperty('--w', max + 'px');
    }

    words[0].classList.add('on');
    fit();
    // Web fonts land after first paint and change every measurement.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', fit, { passive: true });
    // Turkish words are a different length; re-measure after a swap.
    document.addEventListener('fl:langchange', function () { setTimeout(fit, 0); });

    function tick() {
      var prev = i;
      words[prev].classList.remove('on');
      words[prev].classList.add('out');

      i = (i + 1) % words.length;
      var next = i;
      // Widen the box before the word arrives. Fading it in at the same moment
      // left a longer word still clipped by overflow while it was already
      // legible, which reads as a rendering fault rather than as motion.
      fit();
      setTimeout(function () {
        words[next].classList.remove('out');
        words[next].classList.add('on');
      }, 130);
      setTimeout(function () { words[prev].classList.remove('out'); }, 520);
    }

    whileVisible(
      box,
      function () { timer = setInterval(tick, 2200); },
      function () { clearInterval(timer); }
    );
  })();

  /* ── Auto-Collect simulation ───────────────────────────────────────────── */

  (function scanner() {
    var root = document.querySelector('[data-scanner]');
    if (!root) return;
    var list = root.querySelector('[data-scan-rows]');
    var countEl = root.querySelector('[data-scan-count]');
    var stateEl = root.querySelector('[data-scan-state]');
    var bar = root.querySelector('[data-scan-bar]');

    // Sixteen, so the window never repeats a face within one pass of the list.
    // These are the account being scanned in this section — @mtvrkan's own
    // followers — so nobody from the worked example in section 03, which is a
    // different account's data, appears here. Any handle that does show up in
    // two places is spelled identically in both: hue() derives the avatar
    // colour from it, and one person in two colours reads as two people.
    var NAMES = [
      'ismail.dmr', 'burak.snmz', 'merve.aky', 'nesibe.tan', 'tolga.sahin', 'sila.avci',
      'nisa.gns', 'batuhan.krt', 'irem.kaya', 'arda.gnc', 'mkemal.ates', 'harun.kaya',
      'orhan.bkr', 'sami.aln', 'murathan.ers', 'halit.ozt'
    ];
    var TARGET = 1284;
    var STEPS = 26;
    var timers = [];
    var idx = 0;

    function clear() { timers.forEach(clearTimeout); timers = []; }

    function row(name) {
      var li = document.createElement('li');
      li.style.setProperty('--h', hue(name, 37));
      var i = document.createElement('i');
      // Cased for the language on screen: Turkish uppercases i to İ, and a
      // roster of Turkish handles is exactly where a plain toUpperCase() shows
      // its seam — İsmail's avatar would read as a Latin I.
      i.textContent = name[0].toLocaleUpperCase(
        document.documentElement.lang === 'tr' ? 'tr-TR' : 'en-GB');
      var b = document.createElement('b');
      b.textContent = '@' + name;
      var ok = document.createElement('span');
      ok.className = 'ok';
      ok.appendChild(icon('i-check'));
      li.appendChild(i); li.appendChild(b); li.appendChild(ok);
      return li;
    }

    function run() {
      list.textContent = '';
      idx = 0;
      root.classList.remove('done');
      if (stateEl) stateEl.textContent = stateEl.dataset.collecting;
      bar.style.width = '0%';

      var step = function () {
        if (idx >= STEPS) {
          root.classList.add('done');
          if (stateEl) stateEl.textContent = stateEl.dataset.saved;
          countEl.textContent = group(TARGET);
          bar.style.width = '100%';
          timers.push(setTimeout(run, 3200));
          return;
        }
        list.appendChild(row(NAMES[idx % NAMES.length]));
        // Keeps the window showing the newest rows without a scrollbar.
        while (list.children.length > 7) list.removeChild(list.firstChild);
        idx += 1;
        var progress = idx / STEPS;
        countEl.textContent = group(Math.round(TARGET * progress));
        bar.style.width = (progress * 100).toFixed(1) + '%';
        timers.push(setTimeout(step, 190));
      };
      timers.push(setTimeout(step, 260));
    }

    // Both badge states are translated, so re-read them after a language swap.
    if (stateEl) {
      var cache = function () {
        stateEl.dataset.collecting = stateEl.textContent.trim();
        stateEl.dataset.saved = stateEl.dataset.collecting;
      };
      cache();
      document.addEventListener('fl:langchange', function () { setTimeout(cache, 0); });
    }

    whileVisible(root, run, clear);
  })();

  /* ── Results: tabs cycle through the real categories ───────────────────── */

  (function results() {
    var root = document.querySelector('[data-results]');
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.res-tab'));
    var body = root.querySelector('[data-res-rows]');
    if (!tabs.length || !body) return;

    /* One set per tab, and no name in two of them. The sets used to be
       overlapping windows onto a single list, so the same five faces showed up
       under "not following back" and again under "mutuals" — which is not a
       thing that can be true of one person at once, and the demo was making
       the categories look arbitrary.

       "Unfollowed you" holds the same three the hero card and section 01 name,
       because all three are the same story told at different depths. */
    var SETS = [
      { tone: 'warn', fallback: "Doesn't follow back", people: [
        ['ismail.dmr', 'İsmail Demir'], ['burak.snmz', 'Burak Sönmez'],
        ['merve.aky', 'Merve Akyol'], ['tolga.sahin', 'Tolga Şahin'], ['sila.avci', 'Sıla Avcı']
      ] },
      { tone: 'bad', fallback: 'Unfollowed you', people: [
        ['sumeyye.blt', 'Sümeyye Bulut'], ['irmak.ozk', 'Irmak Özkan'], ['alina.krm', 'Alina Karaman']
      ] },
      { tone: 'good', fallback: 'New follower', people: [
        ['nesibe.tan', 'Nesibe Tan'], ['semih_can_bastas', 'Semih Can Baştaş'],
        ['nisa.gns', 'Nisa Güneş'], ['irem.kaya', 'İrem Kaya'], ['arda.gnc', 'Arda Genç']
      ] },
      { tone: 'mut', fallback: 'Mutual', people: [
        ['mkemal.ates', 'Mustafa Kemal Ateş'], ['harun.kaya', 'Harun Kaya'],
        ['orhan.bkr', 'Orhan Bakır'], ['sami.aln', 'Sami Alan'], ['murathan.ers', 'Murathan Ersoy']
      ] }
    ];

    var current = -1;
    var timer = null;

    function paint(n) {
      if (n === current) return;
      current = n;
      tabs.forEach(function (t, i) { t.classList.toggle('on', i === n); });

      var set = SETS[n];
      body.textContent = '';
      for (var i = 0; i < set.people.length; i++) {
        var p = set.people[i];
        var li = document.createElement('li');
        li.style.animationDelay = (i * 55) + 'ms';
        li.style.setProperty('--h', hue(p[0], 41));

        var av = document.createElement('span');
        av.className = 'av';
        av.textContent = p[1].split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

        var nm = document.createElement('span');
        nm.className = 'nm';
        var b = document.createElement('b');
        b.textContent = '@' + p[0];
        var s = document.createElement('span');
        s.textContent = p[1];
        nm.appendChild(b); nm.appendChild(s);

        var pill = document.createElement('span');
        pill.className = 'pill ' + set.tone;
        pill.appendChild(icon(tabs[n].dataset.icon || 'i-users'));
        var label = document.createElement('span');
        label.textContent = tabs[n].dataset.pill || set.fallback;
        pill.appendChild(label);

        li.appendChild(av); li.appendChild(nm); li.appendChild(pill);
        body.appendChild(li);
      }
    }

    // Pill wording follows the tab labels, which i18n already translates.
    function syncPills() {
      tabs.forEach(function (t) {
        t.dataset.pill = t.textContent.replace(/\d+/g, '').trim();
      });
      var n = current;
      current = -1;
      if (n >= 0) paint(n);
    }

    document.addEventListener('fl:langchange', function () { setTimeout(syncPills, 0); });

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        paint(i);
        // A deliberate click owns the panel from then on.
        clearInterval(timer);
        timer = null;
      });
    });

    syncPills();
    paint(0);

    whileVisible(
      root,
      function () {
        if (timer) return;
        timer = setInterval(function () { paint((current + 1) % SETS.length); }, 3400);
      },
      function () { clearInterval(timer); timer = null; }
    );
  })();

})();
