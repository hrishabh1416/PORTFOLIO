/**
 * Portfolio — Hrishabh Shrivastava
 * Aurora Background Engine + Full Interactivity System
 */

'use strict';

/* ----------------------------------------------------------------
   0. UTILS
---------------------------------------------------------------- */
const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
const lerp = (a, b, t) => a + (b - a) * t;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isLowEnd = navigator.hardwareConcurrency < 4;

/* ----------------------------------------------------------------
   1. FOOTER YEAR
---------------------------------------------------------------- */
const yearEl = qs('#footer-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ----------------------------------------------------------------
   2. AURORA BACKGROUND ENGINE
   Multi-layer: Color fields → Aurora orbs → Particles → Cursor glow
---------------------------------------------------------------- */
class AuroraEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.W = 0; this.H = 0;
    this.t = 0;
    this.rafId = null;

    /* Smooth inertia state */
    this.mouse    = { x: 0.5, y: 0.5 };
    this.mouseTgt = { x: 0.5, y: 0.5 };
    this.scroll    = 0;
    this.scrollTgt = 0;

    /* Section atmosphere palette
       Each entry: [hue, sat%, lit%] per orb (5 orbs) */
    this.atmospheres = {
      hero:          [[262,90,68],[190,92,62],[315,85,68],[175,90,62],[42,88,72]],
      about:         [[245,80,64],[175,88,62],[295,78,66],[215,85,62],[18,82,66]],
      education:     [[232,82,62],[268,88,67],[202,84,62],[255,78,66],[178,84,62]],
      experience:    [[272,88,64],[196,90,62],[292,82,67],[178,84,62],[252,80,67]],
      skills:        [[188,94,62],[272,88,62],[158,85,58],[224,90,67],[298,84,62]],
      projects:      [[268,92,65],[315,88,68],[192,94,62],[288,84,67],[172,88,62]],
      achievements:  [[42,90,68],[268,84,64],[18,85,67],[282,88,62],[55,84,67]],
      certifications:[[262,82,64],[178,88,62],[288,78,67],[198,84,62],[242,84,64]],
      contact:       [[255,90,67],[192,94,62],[318,84,67],[172,90,62],[42,90,72]],
    };

    /* Orb state — 5 independent morphing light fields */
    this.orbs = [
      { cx:0.15, cy:0.15, phX:0.00, phY:0.00, freqX:0.000120, freqY:0.000095, ampX:0.30, ampY:0.28, size:0.65, hue:262, sat:90, lit:68 },
      { cx:0.82, cy:0.12, phX:1.57, phY:0.80, freqX:0.000082, freqY:0.000148, ampX:0.26, ampY:0.30, size:0.52, hue:190, sat:92, lit:62 },
      { cx:0.50, cy:0.88, phX:3.14, phY:2.50, freqX:0.000148, freqY:0.000072, ampX:0.28, ampY:0.24, size:0.58, hue:315, sat:85, lit:68 },
      { cx:0.08, cy:0.68, phX:0.70, phY:1.20, freqX:0.000105, freqY:0.000115, ampX:0.20, ampY:0.26, size:0.42, hue:175, sat:90, lit:62 },
      { cx:0.92, cy:0.62, phX:2.30, phY:0.40, freqX:0.000064, freqY:0.000162, ampX:0.22, ampY:0.28, size:0.46, hue: 42, sat:88, lit:72 },
    ];
    /* Target hues for smooth atmosphere transitions */
    this.orbs.forEach((o, i) => {
      o.targetHue = o.hue;
      o.targetSat = o.sat;
      o.targetLit = o.lit;
    });

    /* Particles */
    const COUNT = isLowEnd ? 35 : 70;
    this.particles = Array.from({ length: COUNT }, () => this._mkParticle(true));

    /* Resize */
    this._resize();
    window.addEventListener('resize', () => this._resize(), { passive: true });

    /* Mouse */
    document.addEventListener('mousemove', (e) => {
      this.mouseTgt.x = e.clientX / window.innerWidth;
      this.mouseTgt.y = e.clientY / window.innerHeight;
    }, { passive: true });

    /* Scroll */
    window.addEventListener('scroll', () => {
      const maxSY = document.documentElement.scrollHeight - window.innerHeight;
      this.scrollTgt = maxSY > 0 ? window.scrollY / maxSY : 0;
    }, { passive: true });

    /* Section atmosphere observer */
    this._setupAtmosphereObserver();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, isLowEnd ? 1 : 2);
    this.W = this.canvas.width  = window.innerWidth  * dpr;
    this.H = this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width  = window.innerWidth  + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this._dpr = dpr;
  }

  _mkParticle(randomY = false) {
    const hues = [252, 195, 315, 175, 265, 42, 285];
    return {
      x:       Math.random(),
      y:       randomY ? Math.random() : 1.05,
      vx:      (Math.random() - 0.5) * 0.00018,
      vy:      -(Math.random() * 0.00028 + 0.00010),
      r:       Math.random() * 1.8 + 0.5,
      opacity: Math.random() * 0.65 + 0.15,
      hue:     hues[Math.floor(Math.random() * hues.length)],
      life:    0,
      maxLife: Math.random() * 220 + 80,
    };
  }

  _setupAtmosphereObserver() {
    const sections = qsa('section[data-atmosphere]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const key = entry.target.dataset.atmosphere;
        const palette = this.atmospheres[key];
        if (!palette) return;
        this.orbs.forEach((o, i) => {
          if (!palette[i]) return;
          o.targetHue = palette[i][0];
          o.targetSat = palette[i][1];
          o.targetLit = palette[i][2];
        });
      });
    }, { threshold: 0.35 });
    sections.forEach(s => observer.observe(s));
  }

  _tick() {
    this.t++;

    /* Lerp mouse with inertia */
    this.mouse.x = lerp(this.mouse.x, this.mouseTgt.x, 0.028);
    this.mouse.y = lerp(this.mouse.y, this.mouseTgt.y, 0.028);
    this.scroll  = lerp(this.scroll,  this.scrollTgt,  0.055);

    /* Lerp orb colors toward atmosphere targets */
    this.orbs.forEach(o => {
      o.hue = lerp(o.hue, o.targetHue, 0.008);
      o.sat = lerp(o.sat, o.targetSat, 0.008);
      o.lit = lerp(o.lit, o.targetLit, 0.008);
    });

    const ctx = this.ctx;
    const W   = window.innerWidth;   /* logical px */
    const H   = window.innerHeight;
    const mx  = this.mouse.x;
    const my  = this.mouse.y;

    ctx.save();
    ctx.scale(1 / this._dpr, 1 / this._dpr);
    ctx.scale(this._dpr, this._dpr);
    ctx.restore();

    /* ---- Base ---- */
    ctx.fillStyle = '#04050f';
    ctx.fillRect(0, 0, W, H);

    /* ---- Aurora orbs (screen blend for luminous mixing) ---- */
    ctx.globalCompositeOperation = 'screen';

    this.orbs.forEach(o => {
      const t  = this.t;
      /* Two-frequency sine for each axis → organic non-repeating path */
      const px = (o.cx
        + Math.sin(t * o.freqX + o.phX) * o.ampX
        + Math.sin(t * o.freqX * 1.618 + o.phX * 0.7) * o.ampX * 0.4
        + mx * 0.048) * W;
      const py = (o.cy
        + Math.cos(t * o.freqY + o.phY) * o.ampY
        + Math.cos(t * o.freqY * 2.414 + o.phY * 0.5) * o.ampY * 0.3
        + my * 0.038
        + this.scroll * 0.10) * H;

      const r = o.size * Math.min(W, H) * 0.95;

      /* Pulsate radius + opacity */
      const pulse = 0.82 + Math.sin(t * 0.0065 + o.phX) * 0.18;

      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0.00, `hsla(${o.hue}, ${o.sat}%, ${o.lit}%, ${0.52 * pulse})`);
      g.addColorStop(0.28, `hsla(${o.hue + 12}, ${o.sat}%, ${o.lit * 0.85}%, ${0.24 * pulse})`);
      g.addColorStop(0.60, `hsla(${o.hue + 22}, ${o.sat * 0.80}%, ${o.lit * 0.65}%, ${0.10 * pulse})`);
      g.addColorStop(1.00, 'transparent');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';

    /* ---- Darkness overlay (keeps text readable) ---- */
    const ov = ctx.createLinearGradient(0, 0, 0, H);
    ov.addColorStop(0.0, 'rgba(4,5,15,0.52)');
    ov.addColorStop(0.5, 'rgba(4,5,15,0.40)');
    ov.addColorStop(1.0, 'rgba(4,5,15,0.55)');
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, W, H);

    /* ---- Cursor glow ---- */
    const cgx = mx * W, cgy = my * H;
    const cg = ctx.createRadialGradient(cgx, cgy, 0, cgx, cgy, 260);
    cg.addColorStop(0, `hsla(${this.orbs[0].hue}, 80%, 75%, 0.09)`);
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    /* ---- Atmospheric particles ---- */
    ctx.globalCompositeOperation = 'screen';
    this.particles.forEach((p, i) => {
      p.x   += p.vx + mx * 0.000025;
      p.y   += p.vy;
      p.life++;

      if (p.life > p.maxLife || p.y < -0.04) {
        this.particles[i] = this._mkParticle(false);
        return;
      }

      const tf = p.life / p.maxLife;
      const alpha = tf < 0.14 ? tf / 0.14 : tf > 0.78 ? (1 - tf) / 0.22 : 1;

      ctx.save();
      ctx.globalAlpha = p.opacity * alpha;
      ctx.shadowBlur  = p.r * 8;
      ctx.shadowColor = `hsl(${p.hue}, 80%, 78%)`;
      ctx.fillStyle   = `hsl(${p.hue}, 80%, 78%)`;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  start() {
    const loop = () => { this._tick(); this.rafId = requestAnimationFrame(loop); };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.rafId); }
}

/* Init Aurora */
let aurora = null;
if (!prefersReducedMotion) {
  const bgCanvas = qs('#bg-canvas');
  if (bgCanvas) {
    aurora = new AuroraEngine(bgCanvas);
    aurora.start();
  }
}

/* ----------------------------------------------------------------
   3. NAVBAR — Scroll compact + active section highlight
---------------------------------------------------------------- */
(function initNavbar() {
  const navbar      = qs('#navbar');
  const hamburger   = qs('#hamburger');
  const mobileNav   = qs('#mobile-nav-overlay');
  const mobileLinks = qsa('.mobile-nav-link');
  const navLinks    = qsa('.nav-link');
  const sections    = qsa('section[id]');

  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    highlightActiveSection();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggleMenu = (open) => {
    hamburger.classList.toggle('open', open);
    mobileNav.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileNav.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  hamburger.addEventListener('click', () => toggleMenu(!hamburger.classList.contains('open')));
  mobileLinks.forEach(link => link.addEventListener('click', () => toggleMenu(false)));
  mobileNav.addEventListener('click', (e) => { if (e.target === mobileNav) toggleMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });

  function highlightActiveSection() {
    let current = '';
    const mid = window.scrollY + window.innerHeight * 0.4;
    sections.forEach(sec => { if (mid >= sec.offsetTop) current = sec.id; });
    navLinks.forEach(link => link.classList.toggle('active', link.dataset.section === current));
  }
  highlightActiveSection();
})();

/* ----------------------------------------------------------------
   4. SMOOTH SCROLL
---------------------------------------------------------------- */
qsa('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#' || href === '#!') return;
    const target = qs(href);
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  });
});

/* ----------------------------------------------------------------
   5. TYPEWRITER EFFECT
---------------------------------------------------------------- */
(function initTypewriter() {
  const el = qs('#typewriter');
  if (!el) return;

  const phrases = [
    'full-stack web apps.',
    'scalable REST APIs.',
    'React experiences.',
    'real-time features.',
    'MERN solutions.',
  ];

  let pi = 0, ci = 0, deleting = false;

  function type() {
    const phrase = phrases[pi];
    if (!deleting) {
      el.textContent = phrase.slice(0, ++ci);
      if (ci === phrase.length) { deleting = true; return setTimeout(type, 1800); }
    } else {
      el.textContent = phrase.slice(0, --ci);
      if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; return setTimeout(type, 420); }
    }
    setTimeout(type, deleting ? 40 : 68);
  }
  setTimeout(type, 1000);
})();

/* ----------------------------------------------------------------
   6. SCROLL REVEAL — Intersection Observer
---------------------------------------------------------------- */
(function initScrollReveal() {
  const els = qsa('.reveal');

  if (prefersReducedMotion) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ----------------------------------------------------------------
   7. CARD STAGGER REVEAL
---------------------------------------------------------------- */
(function initCardStagger() {
  if (prefersReducedMotion) return;

  const STAGGER_SELECTORS = '.project-card, .skill-category, .stat-card, .achievement-card, .platform-card';
  const cards = qsa(STAGGER_SELECTORS);

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = qsa(STAGGER_SELECTORS, entry.target.parentElement);
      const idx = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = `${idx * 0.055}s`;
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  cards.forEach(c => io.observe(c));
})();

/* ----------------------------------------------------------------
   8. CONTACT FORM — Frontend validation + backend email integration
---------------------------------------------------------------- */
(function initContactForm() {
  const form    = qs('#contact-form');
  if (!form) return;

  /* ── Backend API endpoint ── */
  const API_URL = 'http://localhost:5000/api/contact';

  /* ── Guard against duplicate/concurrent submissions ── */
  let isSubmitting = false;

  const fields = {
    name:    { el: qs('#contact-name'),    err: qs('#name-error'),    validate: v => v.trim().length < 2 ? 'Please enter your name.' : '' },
    email:   { el: qs('#contact-email'),   err: qs('#email-error'),   validate: v => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Please enter a valid email.' : '' },
    message: { el: qs('#contact-message'), err: qs('#message-error'), validate: v => v.trim().length < 10 ? 'Message must be at least 10 characters.' : '' },
  };

  const setError = (f, msg) => {
    f.err.textContent = msg;
    f.el.classList.toggle('error', !!msg);
  };

  /* Original button HTML — used to restore state after submission */
  const ORIGINAL_BTN_HTML = '<span>Send Message</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  Object.values(fields).forEach(f => {
    f.el.addEventListener('blur', () => setError(f, f.validate(f.el.value)));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Prevent duplicate submissions */
    if (isSubmitting) return;

    /* Run frontend validation */
    Object.values(fields).forEach(f => setError(f, f.validate(f.el.value)));
    if (!Object.values(fields).every(f => !f.err.textContent)) return;

    const btn = qs('#contact-submit');
    isSubmitting = true;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.textContent = 'Sending…';

    try {
      const response = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    fields.name.el.value.trim(),
          email:   fields.email.el.value.trim(),
          message: fields.message.el.value.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        /* ── Success: show confirmation, reset form ── */
        btn.textContent = '✓ Message Sent!';
        btn.style.opacity = '1';
        form.reset();
        Object.values(fields).forEach(f => f.el.classList.remove('error'));
        setTimeout(() => {
          btn.innerHTML = ORIGINAL_BTN_HTML;
          btn.disabled = false;
          btn.style.opacity = '';
          isSubmitting = false;
        }, 4000);
      } else {
        /* ── Server-side error: show message, restore button ── */
        const errMsg = (data && data.message) ? data.message : 'Unable to send your message. Please try again.';
        qs('#message-error').textContent = errMsg;
        btn.innerHTML = ORIGINAL_BTN_HTML;
        btn.disabled = false;
        btn.style.opacity = '';
        isSubmitting = false;
      }
    } catch (networkErr) {
      /* ── Network / connection error ── */
      qs('#message-error').textContent = 'Could not reach the server. Please check your connection and try again.';
      btn.innerHTML = ORIGINAL_BTN_HTML;
      btn.disabled = false;
      btn.style.opacity = '';
      isSubmitting = false;
    }
  });
})();

/* ----------------------------------------------------------------
   9. EDUCATION / EXPERIENCE TIMELINE — Line reveal
---------------------------------------------------------------- */
(function initTimelineLines() {
  if (prefersReducedMotion) return;

  qsa('.edu-marker-line, .exp-marker-line').forEach(line => {
    line.style.transform    = 'scaleY(0)';
    line.style.transformOrigin = 'top';
    line.style.transition   = 'transform 0.75s var(--ease-out-expo)';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.transform = 'scaleY(1)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.25 });

  qsa('.edu-marker-line, .exp-marker-line').forEach(el => io.observe(el));
})();

/* ----------------------------------------------------------------
   10. ANIMATED COUNTERS
---------------------------------------------------------------- */
(function initCounters() {
  if (prefersReducedMotion) return;

  qsa('.stat-value').forEach(el => {
    const raw = el.textContent.trim();
    const num  = parseInt(raw.replace(/\D/g, ''), 10);
    const suf  = raw.replace(/[\d,]/g, '');
    if (isNaN(num)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        let start = null;
        const dur  = 1300;
        const step = (ts) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / dur, 1);
          const e = 1 - Math.pow(1 - p, 4); /* ease-out quart */
          el.textContent = Math.round(e * num) + suf;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });

    io.observe(el);
  });
})();

/* ----------------------------------------------------------------
   11. PROJECT CARD — Section atmosphere color shift on hover
   Shifts the aurora orbs' target hues subtly on project hover
---------------------------------------------------------------- */
(function initProjectHoverAtmosphere() {
  if (prefersReducedMotion || !aurora) return;

  const cardColors = [
    { targetHue: 268, targetSat: 92, targetLit: 65 },  /* violet */
    { targetHue: 185, targetSat: 94, targetLit: 62 },  /* cyan */
    { targetHue: 315, targetSat: 88, targetLit: 68 },  /* magenta */
    { targetHue: 42,  targetSat: 90, targetLit: 70 },  /* warm */
    { targetHue: 158, targetSat: 85, targetLit: 60 },  /* teal */
  ];

  const projectSection = qs('#projects');
  let sectionAtmos = null;

  qsa('.project-card, .project-featured').forEach((card, i) => {
    const col = cardColors[i % cardColors.length];

    card.addEventListener('mouseenter', () => {
      /* Save current if not saved */
      if (!sectionAtmos) sectionAtmos = aurora.orbs.map(o => ({ targetHue: o.targetHue, targetSat: o.targetSat, targetLit: o.targetLit }));
      /* Shift orb 0 toward this card's color */
      aurora.orbs[0].targetHue = col.targetHue;
      aurora.orbs[0].targetSat = col.targetSat;
      aurora.orbs[0].targetLit = col.targetLit;
    });

    card.addEventListener('mouseleave', () => {
      if (sectionAtmos) {
        aurora.orbs[0].targetHue = sectionAtmos[0].targetHue;
        aurora.orbs[0].targetSat = sectionAtmos[0].targetSat;
        aurora.orbs[0].targetLit = sectionAtmos[0].targetLit;
      }
    });
  });
})();

/* ----------------------------------------------------------------
   12. SKILL TAGS — accessibility
---------------------------------------------------------------- */
qsa('.skill-tag').forEach(tag => {
  tag.setAttribute('tabindex', '0');
  tag.setAttribute('role', 'listitem');
});

/* ----------------------------------------------------------------
   INIT LOG
---------------------------------------------------------------- */
console.log('%c  Hrishabh Shrivastava — Portfolio  ', 'background: linear-gradient(135deg,#9b7dff,#22d3ee); color: #fff; font-weight: 800; font-size: 13px; padding: 6px 16px; border-radius: 6px;');
console.log('%c  MERN Stack Developer  ·  github.com/hrishabh-16  ', 'color: #9b7dff; font-weight: 600;');
