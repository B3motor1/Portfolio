/* ==================================================================
   Shared behaviour for every page.
   Loaded with `defer`, so the DOM is ready when this runs.
================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------
     Missing-image fallback. Inline onerror attributes call this, so it
     is exposed globally and defined before any image can finish loading.
  ---------------------------------------------------------------- */
  window.mediaFallback = function (img) {
    if (!img || img.getAttribute('data-placeholder') === 'true') return;
    img.onerror = null;                     /* never loop */
    img.setAttribute('data-placeholder', 'true');
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var label = esc(img.getAttribute('data-label') || 'IMAGE');
    var path  = esc(img.getAttribute('data-path') || '');
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">' +
        '<rect width="480" height="320" fill="#0E0E0E"/>' +
        '<rect x="9" y="9" width="462" height="302" fill="none" stroke="#D9FF00" stroke-opacity=".3" ' +
          'stroke-width="2" stroke-dasharray="9 7"/>' +
        '<text x="240" y="156" fill="#D9FF00" text-anchor="middle" font-size="18" font-weight="700" ' +
          'letter-spacing="3" font-family="ui-monospace,Menlo,monospace">' + label + '</text>' +
        '<text x="240" y="186" fill="#8A8A8A" text-anchor="middle" font-size="12" ' +
          'font-family="ui-monospace,Menlo,monospace">' + path + '</text>' +
      '</svg>';
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  function sweepImages() {
    $$('img[data-label]').forEach(function (img) {
      if (img.getAttribute('data-placeholder') === 'true') return;
      if (img.complete && img.naturalWidth === 0) window.mediaFallback(img);
    });
  }
  sweepImages();
  window.addEventListener('load', sweepImages);

  /* ----------------------------------------------------------------
     Scroll lock, shared by the mobile menu and the lightbox
  ---------------------------------------------------------------- */
  var lockCount = 0;
  function lockScroll() {
    if (lockCount++ > 0) return;
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', (sbw > 0 ? sbw : 0) + 'px');
    document.documentElement.classList.add('locked');
  }
  function unlockScroll() {
    if (lockCount === 0) return;
    if (--lockCount > 0) return;
    document.documentElement.classList.remove('locked');
    document.documentElement.style.setProperty('--sbw', '0px');
  }

  /* ----------------------------------------------------------------
     Nav
  ---------------------------------------------------------------- */
  var nav = $('#nav');
  var navMenu = $('#navMenu');
  var navToggle = $('#navToggle');
  var menuOpen = false;

  function setMenu(open) {
    if (!navMenu || !navToggle || open === menuOpen) return;
    menuOpen = open;
    navMenu.setAttribute('data-open', open ? 'true' : 'false');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    if (open) lockScroll(); else unlockScroll();
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () { setMenu(!menuOpen); });
    document.addEventListener('click', function (e) {
      if (menuOpen && !e.target.closest('#navMenu') && !e.target.closest('#navToggle')) setMenu(false);
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (window.innerWidth > 760) setMenu(false); }, 120);
    });
  }

  if (nav) {
    var ticking = false;
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 16);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------------
     Text scramble — h1 and h2 ONLY.
     Nav links are anchors, never headings, so they are structurally
     excluded; the .no-scramble escape hatch covers anything else.
  ---------------------------------------------------------------- */
  var GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01<>[]{}/\\=+*#$%&@!?';

  function escHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Split a heading into lines at <br>. Returns null if it holds any other
     element, so headings with nested markup are left alone entirely. */
  function collectLines(el) {
    var lines = [''], ok = true;
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3) lines[lines.length - 1] += n.textContent;
      else if (n.nodeName === 'BR') lines.push('');
      else ok = false;
    });
    return ok ? lines : null;
  }

  function Scrambler(el, lines) {
    this.el = el;
    this.lines = lines;
    this.originalHTML = el.innerHTML;
    this.raf = null;
    this.frame = 0;
  }
  Scrambler.prototype.run = function () {
    var self = this;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.q = this.lines.map(function (line) {
      return line.split('').map(function (ch) {
        var s = Math.floor(Math.random() * 12);
        return { ch: ch, start: s, end: s + Math.floor(Math.random() * 14) + 6, g: null };
      });
    });
    this.frame = 0;
    this.el.classList.add('is-scrambling');
    (function tick() {
      var total = 0, done = 0;
      var html = self.q.map(function (line) {
        var out = '';
        for (var i = 0; i < line.length; i++) {
          var it = line[i];
          total++;
          if (self.frame >= it.end) { done++; out += escHTML(it.ch); }
          else if (self.frame >= it.start) {
            /* Whitespace is never scrambled — it keeps word shapes stable. */
            if (/\s/.test(it.ch)) { out += it.ch; }
            else {
              if (!it.g || Math.random() < 0.3) it.g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
              out += escHTML(it.g);
            }
          } else { out += escHTML(it.ch); }
        }
        return out;
      }).join('<br>');

      self.el.innerHTML = html;
      if (done === total) {
        self.el.classList.remove('is-scrambling');
        self.el.innerHTML = self.originalHTML;   /* guarantee a clean end state */
        self.raf = null;
        return;
      }
      self.frame++;
      self.raf = requestAnimationFrame(tick);
    })();
  };

  if (!reduceMotion) {
    $$('h1, h2').forEach(function (h) {
      if (h.closest('nav') || h.classList.contains('no-scramble')) return;
      var lines = collectLines(h);
      if (!lines) return;                       /* text and <br> only */
      h.classList.add('scramble');
      var s = new Scrambler(h, lines);
      h.addEventListener('mouseenter', function () { s.run(); });
      h.addEventListener('focus', function () { s.run(); });
    });
  }

  /* ----------------------------------------------------------------
     Project filtering
  ---------------------------------------------------------------- */
  var filters = $$('.filter');
  var cards = $$('#projectGrid .card');
  var countEl = $('#filterCount');

  if (filters.length && cards.length) {
    var applyFilter = function (key) {
      var shown = 0;
      cards.forEach(function (card) {
        var cats = (card.getAttribute('data-category') || '').split(/\s+/);
        var match = key === 'all' || cats.indexOf(key) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      filters.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-filter') === key ? 'true' : 'false');
      });
      if (countEl) countEl.textContent = 'Showing ' + shown + ' of ' + cards.length + ' projects';
    };
    filters.forEach(function (b) {
      b.addEventListener('click', function () { applyFilter(b.getAttribute('data-filter')); });
    });
    applyFilter('all');
  }

  /* ----------------------------------------------------------------
     In-card carousels
  ---------------------------------------------------------------- */
  $$('[data-gallery]').forEach(function (g) {
    var imgs = $$('.gallery__img', g);
    if (!imgs.length) return;
    var prev = $('.gal-prev', g), next = $('.gal-next', g);
    var cap = $('.gallery__cap', g), count = $('.gallery__count', g), dots = $('.gallery__dots', g);
    var i = 0;

    function show(n) {
      i = (n % imgs.length + imgs.length) % imgs.length;
      imgs.forEach(function (im, k) {
        im.classList.toggle('is-active', k === i);
        im.setAttribute('tabindex', k === i ? '0' : '-1');
        im.setAttribute('role', 'button');
      });
      if (cap) cap.textContent = imgs[i].getAttribute('data-cap') || '';
      if (count) count.textContent = (i + 1) + ' / ' + imgs.length;
      if (dots) $$('.gal-dot', dots).forEach(function (d, k) {
        d.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
    }

    if (imgs.length < 2) {
      [prev, next, count, dots].forEach(function (el) { if (el) el.hidden = true; });
    } else if (dots) {
      imgs.forEach(function (im, k) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'gal-dot';
        d.setAttribute('aria-label', 'Show image ' + (k + 1) + ' of ' + imgs.length);
        d.addEventListener('click', function () { show(k); });
        dots.appendChild(d);
      });
    }
    if (prev) prev.addEventListener('click', function () { show(i - 1); });
    if (next) next.addEventListener('click', function () { show(i + 1); });

    var x0 = null;
    g.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    g.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) show(i + (dx < 0 ? 1 : -1));
    }, { passive: true });

    show(0);
  });

  /* ----------------------------------------------------------------
     Lightbox
  ---------------------------------------------------------------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('#lbImg'), lbCap = $('#lbCap');
    var lbClose = $('#lbClose'), lbPrev = $('#lbPrev'), lbNext = $('#lbNext');
    var group = [], index = 0, lastTrigger = null;

    var render = function () {
      var img = group[index];
      if (!img) return;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || '';
      lbCap.textContent = (img.getAttribute('data-cap') || '') +
        (group.length > 1 ? '   ' + (index + 1) + ' / ' + group.length : '');
    };
    var open = function (img) {
      var g = img.closest('[data-gallery]');
      group = g ? $$('.gallery__img', g).filter(function (x) {
        return x.getAttribute('data-placeholder') !== 'true';
      }) : [img];
      index = group.indexOf(img);
      if (index < 0) { group = [img]; index = 0; }
      lastTrigger = img;
      lbPrev.hidden = lbNext.hidden = group.length < 2;
      render();
      lb.hidden = false;
      lockScroll();
      lbClose.focus();
    };
    var close = function () {
      if (lb.hidden) return;
      lb.hidden = true;
      lbImg.removeAttribute('src');
      unlockScroll();
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    };
    var step = function (d) {
      if (group.length < 2) return;
      index = (index + d + group.length) % group.length;
      render();
    };
    var canOpen = function (img) {
      return img && img.classList.contains('is-active') &&
             img.getAttribute('data-placeholder') !== 'true';
    };

    document.addEventListener('click', function (e) {
      var img = e.target.closest('.gallery__img');
      if (canOpen(img)) open(img);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var img = e.target.closest ? e.target.closest('.gallery__img') : null;
      if (canOpen(img)) { e.preventDefault(); open(img); }
    });

    lbPrev.addEventListener('click', function () { step(-1); });
    lbNext.addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) close(); });

    lb.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [lbClose, lbPrev, lbNext].filter(function (b) { return !b.hidden; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!lb.hidden) { close(); return; }
        if (menuOpen) { setMenu(false); navToggle.focus(); }
        return;
      }
      if (lb.hidden) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    });
  } else {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) { setMenu(false); navToggle.focus(); }
    });
  }

  /* ----------------------------------------------------------------
     Click-to-load YouTube facade
  ---------------------------------------------------------------- */
  $$('[data-video]').forEach(function (box) {
    var play = $('.video__play', box);
    if (!play) return;
    play.addEventListener('click', function () {
      var id = (box.getAttribute('data-video') || '').trim();
      if (!id) { box.innerHTML = '<p class="video__msg">No video linked for this project yet.</p>'; return; }
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&modestbranding=1';
      f.title = 'Project demo video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      box.innerHTML = '';
      box.appendChild(f);
    });
  });

  /* ----------------------------------------------------------------
     Scroll reveal
  ---------------------------------------------------------------- */
  var revealables = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------
     Portrait easter egg — click swaps in the banana-costume shot.
     The swap only arms itself once the alternate image has actually
     loaded, so a missing file leaves a plain, non-broken portrait.
  ---------------------------------------------------------------- */
  var portrait = $('#portrait');
  if (portrait) {
    var photo = $('#portraitPhoto');
    var tip = $('#portraitTip');
    var mainSrc = photo.getAttribute('src');
    var altSrc = portrait.getAttribute('data-alt');
    var mainAlt = photo.alt;
    var armed = false, showingAlt = false, busy = false;

    var probe = new Image();
    probe.onload = function () {
      armed = true;
      if (tip) tip.textContent = 'Click me';
    };
    probe.onerror = function () {
      /* Leave it inert rather than swapping to a broken image. */
      portrait.setAttribute('aria-label', 'Photo of Behlool Moiz');
      portrait.style.cursor = 'default';
    };
    probe.src = altSrc;

    portrait.addEventListener('click', function () {
      if (!armed || busy) return;
      busy = true;
      portrait.classList.add('is-flipping');
      /* Swap at the halfway point so the change happens mid-turn. */
      setTimeout(function () {
        showingAlt = !showingAlt;
        photo.src = showingAlt ? altSrc : mainSrc;
        photo.alt = showingAlt ? 'Behlool Moiz in a banana costume' : mainAlt;
        if (tip) tip.textContent = showingAlt ? 'Click to change back' : 'Click me';
      }, 250);
      setTimeout(function () {
        portrait.classList.remove('is-flipping');
        busy = false;
      }, 560);
    });
  }

  /* Footer year */
  var y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
})();
