/* Ember — page motion: Lenis smooth scroll + GSAP/ScrollTrigger.
   The 3D scenes live in scene.js and are loaded lazily, so the page still
   works (with SVG fallbacks) if WebGL or the CDN is unavailable. */

const root = document.documentElement;
const reduced = root.classList.contains('reduced');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const header = $('.header');

let lenis = null;
let hero3d = null;
let roast3d = null;

/* ---------------- text splitting ---------------- */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = c === ' ' ? 'ch ch--sp' : 'ch';
    s.textContent = c === ' ' ? ' ' : c;
    s.style.setProperty('--i', i);
    el.appendChild(s);
  });
  return $$('.ch', el);
}

function setRoll(el, text) {
  el.textContent = text;
  splitChars(el);
}

function splitWords(rootEl) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
      else {
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        frag.appendChild(s);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
  return $$('.w', rootEl);
}

/* ---------------- loader ---------------- */
const loaderState = { v: 0 };
let loaderTween = null;
function paintLoader() {
  const n = $('.loader__num span');
  if (n) n.textContent = Math.round(loaderState.v);
  const bar = $('.loader__bar i');
  if (bar) bar.style.transform = `scaleX(${loaderState.v / 100})`;
}
function startLoader() {
  loaderTween = gsap.to(loaderState, { v: 84, duration: 3.2, ease: 'power2.out', onUpdate: paintLoader });
  gsap.to('.loader__bean', { rotation: 360, duration: 2.4, ease: 'none', repeat: -1 });
}
function finishLoader(heroChars) {
  loaderTween && loaderTween.kill();
  const intro = heroIntro(heroChars);
  const unlock = () => {
    root.classList.remove('is-loading');
    lenis && lenis.start();
    probeTheme();
  };
  gsap.timeline()
    .to(loaderState, { v: 100, duration: 0.7, ease: 'power2.inOut', onUpdate: paintLoader })
    .to('.loader__inner', { yPercent: -30, autoAlpha: 0, duration: 0.55, ease: 'power3.in' }, '+=0.1')
    .to('.curtain span', { yPercent: -101, duration: 1.1, stagger: 0.06, ease: 'expo.inOut' }, '-=0.15')
    .set('.loader', { display: 'none' })
    .add(unlock)
    .add(() => hero3d && hero3d.start(), '-=1.05')
    .add(intro, '-=0.95');
}

function heroIntro(chars) {
  return gsap.timeline()
    .from('.hero__card', { clipPath: 'inset(14% 10% 14% 10% round 48px)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0)
    .from(chars, { yPercent: 120, rotation: 7, duration: 1.3, stagger: 0.035, ease: 'expo.out' }, 0.5)
    .from('.header > *', { yPercent: -130, autoAlpha: 0, duration: 1, stagger: 0.07, ease: 'expo.out' }, 0.45)
    .from('.corner, .hero__hint', { y: 16, autoAlpha: 0, duration: 0.9, stagger: 0.06, ease: 'power3.out' }, 0.8)
    .from('.badge', { scale: 0, rotation: -140, duration: 1.2, ease: 'back.out(1.6)' }, 0.85);
}

/* ---------------- header: hide on scroll down, theme per section ---------------- */
function probeTheme() {
  if (root.classList.contains('menu-open')) return;
  const y = Math.round(header.offsetHeight / 2);
  const els = document.elementsFromPoint(innerWidth / 2, y);
  for (const el of els) {
    if (el.closest('.header, .cursor, .drink-preview, .fly, .curtain, .loader')) continue;
    const sec = el.closest('[data-theme]');
    if (sec) { header.dataset.theme = sec.dataset.theme; return; }
  }
}
function setupHeaderScroll() {
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    if (!root.classList.contains('menu-open')) {
      const d = y - lastY;
      if (y > 240 && d > 2) header.classList.add('is-hidden');
      else if (d < -2 || y < 240) header.classList.remove('is-hidden');
      probeTheme();
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  ScrollTrigger.addEventListener('refresh', probeTheme);
}

/* ---------------- cursor & magnetic ---------------- */
function setupCursor() {
  if (!fine || reduced) return;
  root.classList.add('has-cursor');
  const cursor = $('.cursor');
  const dot = $('.cursor__dot'), ring = $('.cursor__ring');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    cursor.classList.toggle('is-hover', !!t.closest('a, button'));
    cursor.classList.toggle('is-stir', !!t.closest('[data-stir]'));
  });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { autoAlpha: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to(cursor, { autoAlpha: 1, duration: 0.3 }));
}

function setupMagnetic() {
  if (!fine || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
    });
  });
}

/* ---------------- menu ---------------- */
const menuApi = { open: false, close: () => {} };
function setupMenu() {
  const btn = $('.menu-btn');
  const menu = $('.menu');
  const label = $('.menu-btn [data-roll]');
  const tl = gsap.timeline({ paused: true })
    .set(menu, { visibility: 'visible' })
    .fromTo('.menu__bg span', { yPercent: -101 }, { yPercent: 0, duration: 0.9, stagger: 0.05, ease: 'expo.inOut' })
    .fromTo('.menu__links .mask > span', { yPercent: 115 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'expo.out' }, '-=0.4')
    .fromTo('.menu__num, .menu__foot > *', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.03, ease: 'power3.out' }, '-=0.8');
  tl.eventCallback('onReverseComplete', probeTheme);
  if (reduced) tl.timeScale(6);

  function toggle(force) {
    const open = typeof force === 'boolean' ? force : !menuApi.open;
    if (open === menuApi.open) return;
    menuApi.open = open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    root.classList.toggle('menu-open', open);
    setRoll(label, open ? 'Close' : 'Menu');
    if (open) {
      lenis && lenis.stop();
      header.dataset.theme = 'dark';
      header.classList.remove('is-hidden');
      tl.timeScale(reduced ? 6 : 1).play();
    } else {
      lenis && lenis.start();
      tl.timeScale(reduced ? 6 : 1.5).reverse();
    }
  }
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  menuApi.close = () => toggle(false);
}

/* ---------------- anchors & leave transition ---------------- */
function scrollToTarget(id) {
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (target === 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
function setupAnchors() {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      e.preventDefault();
      if (menuApi.open) { menuApi.close(); setTimeout(() => scrollToTarget(id), 650); }
      else scrollToTarget(id);
    });
  });
}
function setupLeave() {
  $$('[data-leave]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduced) return;
      e.preventDefault();
      gsap.timeline({ onComplete: () => { window.location.href = a.href; } })
        .set('.curtain', { display: 'flex', visibility: 'visible', opacity: 1 })
        .fromTo('.curtain span', { yPercent: 101 }, { yPercent: 0, duration: 0.85, stagger: 0.05, ease: 'expo.inOut' });
    });
  });
  // coming back via the browser's back button (bfcache): lift the curtain again
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) gsap.set('.curtain span', { yPercent: -101 });
  });
}

/* ---------------- bag ---------------- */
function setupCart() {
  const cart = $('.cart');
  const count = $('.cart__count');
  let n = 0;
  const bump = () => {
    count.textContent = String(n);
    gsap.fromTo(cart, { scale: 1.18 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
  };
  $$('.add').forEach((b) => {
    const label = b.textContent;
    b.addEventListener('click', () => {
      n++;
      header.classList.remove('is-hidden');
      b.textContent = 'Added ✓';
      b.classList.add('is-added');
      setTimeout(() => { b.textContent = label; b.classList.remove('is-added'); }, 1600);
      if (reduced) { bump(); return; }
      const a = b.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'fly';
      document.body.appendChild(dot);
      // wait one frame so the header can slide back in before measuring the target
      requestAnimationFrame(() => {
        const c = cart.getBoundingClientRect();
        gsap.set(dot, { x: a.left + a.width / 2, y: a.top + a.height / 2 });
        gsap.to(dot, { x: c.left + c.width / 2, duration: 0.85, ease: 'power1.inOut' });
        gsap.to(dot, { y: Math.max(c.top + c.height / 2, 20), duration: 0.85, ease: 'back.in(2.2)', onComplete: () => { dot.remove(); bump(); } });
        gsap.to(dot, { scale: 0.5, duration: 0.85, ease: 'power2.in' });
      });
    });
  });
}

/* ---------------- hero ---------------- */
function setupHero() {
  const canvas = $('.hero__canvas');
  canvas.setAttribute('data-stir', '');
  gsap.to('.hero__card', {
    scale: 0.94, ease: 'none',
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (s) => hero3d && hero3d.setProgress(s.progress),
    },
  });
  gsap.to('.hero__title .line', {
    yPercent: (i) => -(3 - i) * 16, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------------- marquee bands (scroll-velocity reactive) ---------------- */
function setupBands() {
  const bands = $$('.band__track').map((track, i) => {
    const unit = track.firstElementChild;
    const u = { track, unit, w: unit.offsetWidth || 1, x: 0, sign: i === 0 ? 1 : -1 };
    const copies = Math.ceil((innerWidth * 1.4) / u.w) + 1;
    for (let k = 0; k < copies; k++) {
      const clone = unit.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
    return u;
  });
  let boost = 0, dir = 1;
  ScrollTrigger.create({
    trigger: '.bands', start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => { dir = s.direction; boost = Math.min(Math.abs(s.getVelocity()) / 140, 12); },
  });
  ScrollTrigger.addEventListener('refresh', () => bands.forEach((u) => { u.w = u.unit.offsetWidth || 1; }));
  gsap.ticker.add((t, dtMs) => {
    boost *= 0.93;
    const speed = (1 + boost) * Math.min(dtMs, 50) * 0.05;
    bands.forEach((u) => {
      u.x = gsap.utils.wrap(-u.w, 0, u.x + u.sign * dir * speed);
      u.track.style.transform = `translate3d(${u.x}px,0,0)`;
    });
  });
}

/* ---------------- statement ---------------- */
function setupStatement() {
  const words = splitWords($('.statement__text'));
  gsap.fromTo(words, { opacity: 0.12 }, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.statement__text', start: 'top 78%', end: 'bottom 42%', scrub: true },
  });
}

/* ---------------- our coffee: circle reveal + horizontal pin ---------------- */
function setupCoffee() {
  const sec = $('.coffee');
  const track = $('.coffee__track');
  const bar = $('.coffee__bar i');
  gsap.fromTo(sec, { clipPath: 'circle(0% at 50% 30%)' }, {
    clipPath: 'circle(100% at 50% 30%)', ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true },
  });
  gsap.from('.coffee__track > *', {
    yPercent: 16, rotation: 2.5, stagger: 0.05, ease: 'none',
    scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top top', scrub: true },
  });
  const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
  const h = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: sec, start: 'top top', end: () => '+=' + dist(),
      pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; },
    },
  });
  $$('.card .bag').forEach((bag) => {
    gsap.fromTo(bag, { rotation: -12, yPercent: 8 }, {
      rotation: 9, yPercent: -6, ease: 'none',
      scrollTrigger: { trigger: bag.closest('.card'), containerAnimation: h, start: 'left right', end: 'right left', scrub: true },
    });
  });
}

/* ---------------- roasting: colours, readout, steps, first crack ---------------- */
const STAGES = [
  { bg: '#DCE3C9', fg: '#1A110C', bean: '#8C9A63', t: 24, s: 0 },
  { bg: '#F0DDA0', fg: '#1A110C', bean: '#C9A048', t: 158, s: 300 },
  { bg: '#E09A5E', fg: '#1A110C', bean: '#8E4A22', t: 196, s: 552 },
  { bg: '#1F140E', fg: '#F3EBDD', bean: '#4A2716', t: 214, s: 690 },
];
function setupRoasting() {
  const sec = $('.roasting');
  const steps = $$('.step', sec);
  const labels = $$('.roasting__labels li', sec);
  const temps = $$('.js-temp', sec);
  const timeEl = $('.js-time', sec);
  const st = { stage: 0, t: STAGES[0].t, s: 0 };
  const paint = () => {
    const t = Math.round(st.t);
    temps.forEach((el) => { el.textContent = t; });
    const s = Math.round(st.s);
    timeEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    roast3d && roast3d.setStage(st.stage);
  };

  // SVG fallback chaff (only used when WebGL is unavailable)
  const chaffBox = $('.chaff', sec);
  const shards = [];
  if (!roast3d) {
    for (let i = 0; i < 14; i++) shards.push(chaffBox.appendChild(document.createElement('i')));
  }

  gsap.set(sec, { backgroundColor: STAGES[0].bg, '--fg': STAGES[0].fg, '--bean': STAGES[0].bean });
  gsap.set(steps.slice(1), { autoAlpha: 0, yPercent: 30 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sec, start: 'top top', end: '+=320%', pin: true, scrub: 0.7, anticipatePin: 1,
      onUpdate: (s) => { sec.dataset.theme = s.progress > 0.74 ? 'dark' : 'light'; },
    },
  });
  tl.to({}, { duration: 0.35 });
  STAGES.slice(1).forEach((x, i) => {
    const at = tl.duration();
    tl.to(sec, { backgroundColor: x.bg, '--bean': x.bean, duration: 1 }, at)
      // flip the text colour quickly mid-way (while the step text is crossfading) so it never
      // sits at the same mid-tone as the background
      .to(sec, { '--fg': x.fg, duration: 0.12 }, at + 0.42)
      .to(st, { stage: i + 1, t: x.t, s: x.s, duration: 1, onUpdate: paint }, at)
      .to('.roasting__track i', { scaleX: (i + 1) / 3, duration: 1 }, at)
      .to(steps[i], { autoAlpha: 0, yPercent: -30, duration: 0.35, ease: 'power2.in' }, at + 0.15)
      .to(steps[i + 1], { autoAlpha: 1, yPercent: 0, duration: 0.45, ease: 'power3.out' }, at + 0.55)
      .to(labels[i + 1], { opacity: 1, duration: 0.2 }, at + 0.8);
    if (i === 1) {
      // first crack: the readout jolts, the giant number flashes ember
      tl.to('.readout', { x: -6, duration: 0.04 }, at + 0.62)
        .to('.readout', { x: 6, duration: 0.04 })
        .to('.readout', { x: -3, duration: 0.04 })
        .to('.readout', { x: 0, duration: 0.04 })
        .to('.roasting__giant', { color: 'rgba(255,90,31,.55)', duration: 0.15 }, at + 0.6)
        .to('.roasting__giant', { color: 'rgba(255,90,31,0)', duration: 0.4 }, at + 0.8);
      if (shards.length) {
        tl.to('.roasting__svg', { keyframes: { x: [0, -9, 8, -6, 4, 0] }, duration: 0.35 }, at + 0.62);
        shards.forEach((sh) => {
          const p = at + 0.62;
          tl.to(sh, { x: gsap.utils.random(-240, 240), y: gsap.utils.random(-200, 180), rotation: gsap.utils.random(-180, 180), duration: 0.7, ease: 'power3.out' }, p)
            .to(sh, { scale: 1.2, duration: 0.15 }, p)
            .to(sh, { scale: 0, duration: 0.45 }, p + 0.25);
        });
      }
    }
    tl.to({}, { duration: 0.35 });
  });
  paint();
}

/* ---------------- café hover preview ---------------- */
function setupCafe() {
  if (!fine || reduced) return;
  const prev = $('.drink-preview');
  const label = $('.drink-preview__label');
  gsap.set(prev, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });
  const xTo = gsap.quickTo(prev, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(prev, 'y', { duration: 0.6, ease: 'power3' });
  const list = $('.drinks');
  list.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  $$('.drink', list).forEach((d) => {
    d.addEventListener('pointerenter', (e) => {
      prev.style.setProperty('--pc', d.dataset.color);
      label.textContent = d.dataset.name;
      if (gsap.getProperty(prev, 'scale') < 0.05) { gsap.set(prev, { x: e.clientX, y: e.clientY }); }
      gsap.to(prev, { scale: 1, autoAlpha: 1, rotation: gsap.utils.random(-10, 10), duration: 0.6, ease: 'back.out(1.6)', overwrite: 'auto' });
    });
  });
  list.addEventListener('pointerleave', () => gsap.to(prev, { scale: 0, autoAlpha: 0, duration: 0.4, ease: 'power3.in', overwrite: 'auto' }));
  window.addEventListener('scroll', () => {
    if (gsap.getProperty(prev, 'scale') > 0 && !list.matches(':hover')) gsap.to(prev, { scale: 0, autoAlpha: 0, duration: 0.3, overwrite: 'auto' });
  }, { passive: true });
}

/* ---------------- footer & generic reveals ---------------- */
function setupFooter(giantChars) {
  gsap.from(giantChars, {
    yPercent: 102, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: '.footer__giant', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}
function setupReveals() {
  $$('.rl').forEach((h) => {
    gsap.from($$('.line > span', h), {
      yPercent: 115, duration: 1.2, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 88%' },
    });
  });
  $$('[data-fade]').forEach((el) => {
    gsap.from(el, { y: 36, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  $$('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, {
      v: end, duration: 2, ease: 'power3.out',
      onUpdate: () => { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ---------------- boot ---------------- */
function init(mod) {
  window.scrollTo(0, 0);
  $$('[data-roll]').forEach((el) => {
    const host = el.closest('a, button');
    if (host && !host.hasAttribute('aria-label')) host.setAttribute('aria-label', el.textContent.trim());
    splitChars(el);
  });
  const heroChars = $$('.hero__title .split').flatMap(splitChars);
  const giantChars = splitChars($('.footer__giant'));

  if (mod) {
    try { hero3d = mod.createHero($('.hero__canvas'), { reduced }); } catch (err) { console.warn('[ember] hero 3D disabled:', err); }
    try {
      roast3d = mod.createRoast($('.roasting__canvas'), { reduced });
      $('.roasting').classList.add('has-3d');
    } catch (err) { console.warn('[ember] roast 3D disabled:', err); }
  }

  setupCursor();
  setupMagnetic();
  setupMenu();
  setupAnchors();
  setupLeave();
  setupCart();
  setupCafe();

  if (!reduced) {
    // ScrollTriggers in page order (pins first, triggers below them after)
    setupHero();
    setupBands();
    setupStatement();
    setupCoffee();
    setupRoasting();
    setupFooter(giantChars);
    setupReveals();
  }
  setupHeaderScroll();
  ScrollTrigger.refresh();
  root.classList.add('js-ready');

  if (reduced) {
    root.classList.remove('is-loading');
    hero3d && hero3d.start();
    probeTheme();
    return;
  }
  finishLoader(heroChars);
}

function main() {
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.add('js-ready');
    root.classList.remove('is-loading');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  if (!reduced) startLoader();

  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(2500)]);
  const threeReady = Promise.race([
    import('./scene.js').catch((err) => { console.warn('[ember] 3D unavailable:', err); return null; }),
    wait(9000).then(() => null),
  ]);
  Promise.all([fontsReady, threeReady]).then(([, mod]) => init(mod));
}

main();
