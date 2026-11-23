/* ==========================================================================
   ORBIT — motion & WebGL showcase
   three.js (hero physics + scroll ribbon) · GSAP + ScrollTrigger · Lenis
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;
const { gsap, ScrollTrigger, Lenis } = window;
const reduced = root.classList.contains('reduced'); // system setting or ?reduced in the URL
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isMobile = () => innerWidth < 760;
const padPx = () => parseFloat(getComputedStyle(document.querySelector('.stack')).paddingLeft) || clamp(innerWidth * 0.022, 16, 32);

const LIME = 0xd2ff3a;

/* --------------------------------------------------------------------------
   Utilities
   -------------------------------------------------------------------------- */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    s.style.setProperty('--i', i);
    s.setAttribute('aria-hidden', 'true');
    el.appendChild(s);
  });
  return $$('.ch', el);
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
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = part;
        frag.appendChild(w);
      }
    });
    node.parentNode.replaceChild(frag, node);
  });
  return $$('.w', rootEl);
}

function makeEnv(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pm.dispose();
  return tex;
}

/* --------------------------------------------------------------------------
   HERO — glossy objects in a soft-body-ish physics cluster, pushed by cursor
   -------------------------------------------------------------------------- */
class HeroScene {
  constructor(card, canvas) {
    this.card = card;
    this.canvas = canvas;
    this.visible = true;
    this.attract = 0;       // ramps up on intro
    this.scrollP = 0;       // 0..1 as the hero scrolls away
    this.time = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0d0e10);
    scene.environment = makeEnv(r);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(6, 9, 10);
    const rim = new THREE.DirectionalLight(LIME, 1.1);
    rim.position.set(-9, -5, -4);
    scene.add(key, rim);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.camera.position.set(0, 0, 20);
    this.group = new THREE.Group();
    scene.add(this.group);

    const geos = [
      { g: new THREE.CapsuleGeometry(0.42, 1.0, 12, 28), r: 0.84 },
      { g: new THREE.TorusGeometry(0.6, 0.27, 32, 80), r: 0.86 },
      { g: new THREE.SphereGeometry(0.7, 56, 40), r: 0.7 },
      { g: new RoundedBoxGeometry(1.05, 1.05, 1.05, 6, 0.3), r: 0.8 },
    ];
    const mats = [
      new THREE.MeshPhysicalMaterial({ color: 0xdcdde0, metalness: 1, roughness: 0.13 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf3f3ef, metalness: 0, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06 }),
      new THREE.MeshPhysicalMaterial({ color: 0x111214, metalness: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
      new THREE.MeshPhysicalMaterial({ color: LIME, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }),
    ];
    // material pattern → roughly 25% chrome, 30% white, 25% black, 20% lime
    const matSeq = [0, 1, 2, 1, 3, 0, 2, 1, 3, 0, 1, 2, 3, 1, 0, 2, 1, 3, 2, 0];

    const n = isMobile() ? 20 : 34;
    this.bodies = [];
    for (let i = 0; i < n; i++) {
      const gi = (i * 7) % geos.length;
      const s = 0.82 + ((i * 37) % 11) / 20; // 0.82..1.32, deterministic variety
      const mesh = new THREE.Mesh(geos[gi].g, mats[matSeq[i % matSeq.length]]);
      mesh.scale.setScalar(s);
      mesh.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      const a = Math.random() * Math.PI * 2;
      const rad = 26 + Math.random() * 10;
      const p = new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad * 0.6, -10 - Math.random() * 20);
      mesh.position.copy(p);
      this.group.add(mesh);
      this.bodies.push({
        mesh, p,
        v: new THREE.Vector3(),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.4),
        r: geos[gi].r * s,
      });
    }

    // pointer → world (plane z = 0)
    this.mouse = new THREE.Vector3(999, 999, 0);
    this.mouseTarget = new THREE.Vector3(999, 999, 0);
    this.prevMouse = new THREE.Vector3(999, 999, 0);
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.center = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();

    const move = (e) => {
      const rect = this.card.getBoundingClientRect();
      this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.camera);
      this.ray.ray.intersectPlane(this.plane, this.mouseTarget);
    };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerdown', move);
    card.addEventListener('pointerleave', () => this.mouseTarget.set(999, 999, 0));

    new IntersectionObserver(([e]) => (this.visible = e.isIntersecting), { threshold: 0 }).observe(card);

    this.resize();
    r.compile(scene, this.camera);
  }

  resize() {
    const w = this.card.clientWidth, h = this.card.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const vh = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const vw = vh * this.camera.aspect;
    this.view = { w: vw, h: vh };
    // cluster sits up-and-right on desktop (title lives bottom-left), centred-high on portrait
    if (this.camera.aspect > 1) {
      this.base = new THREE.Vector3(vw * 0.16, vh * 0.06, 0);
      this.ax = 0.75; this.ay = 1.25;
    } else {
      this.base = new THREE.Vector3(0, vh * 0.12, 0);
      this.ax = 1.3; this.ay = 0.8;
    }
  }

  assemble() {
    gsap.to(this, { attract: 3.2, duration: 2.4, ease: 'power2.out' });
  }

  settle(steps = 600) {
    this.attract = 3.2;
    for (let i = 0; i < steps; i++) this.step(1 / 60);
  }

  step(dt) {
    const B = this.bodies, n = B.length, tmp = this.tmp, tmp2 = this.tmp2;

    // smooth mouse; jump straight in when the pointer (re)enters
    this.prevMouse.copy(this.mouse);
    if (this.mouseTarget.x > 500) this.mouse.copy(this.mouseTarget);
    else if (this.mouse.x > 500) { this.mouse.copy(this.mouseTarget); this.prevMouse.copy(this.mouse); }
    else this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-dt * 16));
    const mouseSpeed = this.mouse.x > 500 ? 0 : this.mouse.distanceTo(this.prevMouse) / dt;
    const mouseR = 2.0 + Math.min(mouseSpeed * 0.025, 1.4);

    // centre breathes a little; scroll pushes cluster apart
    const sp = this.scrollP;
    this.center.copy(this.base);
    this.center.x += Math.sin(this.time * 0.35) * 0.35;
    this.center.y += Math.cos(this.time * 0.27) * 0.25 + sp * 2.5;
    const k = this.attract * (1 - sp * 0.75);
    const damp = Math.exp(-dt * 2.4);

    for (const b of B) {
      tmp.subVectors(this.center, b.p);
      tmp.x *= this.ax; tmp.y *= this.ay; tmp.z *= 1.8;
      b.v.addScaledVector(tmp, k * dt);

      if (this.mouse.x < 500) {
        tmp.subVectors(b.p, this.mouse);
        tmp.z *= 0.4;
        const d = tmp.length() || 0.0001;
        const reach = mouseR + b.r;
        if (d < reach) {
          const f = (reach - d) / reach;
          b.v.addScaledVector(tmp.divideScalar(d), f * (38 + mouseSpeed * 1.6) * dt);
          b.w.x += (tmp.y) * f * 6 * dt;
          b.w.y -= (tmp.x) * f * 6 * dt;
        }
      }
      b.v.multiplyScalar(damp);
    }

    // sphere–sphere collisions (O(n²) is fine for ~34 bodies)
    for (let i = 0; i < n; i++) {
      const a = B[i];
      for (let j = i + 1; j < n; j++) {
        const c = B[j];
        tmp.subVectors(a.p, c.p);
        const min = a.r + c.r;
        const d2 = tmp.lengthSq();
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        tmp.divideScalar(d);
        const ov = (min - d) * 0.5;
        a.p.addScaledVector(tmp, ov);
        c.p.addScaledVector(tmp, -ov);
        const rel = tmp2.subVectors(a.v, c.v).dot(tmp);
        if (rel < 0) {
          const imp = -rel * 0.72;
          a.v.addScaledVector(tmp, imp);
          c.v.addScaledVector(tmp, -imp);
          a.w.x += tmp.y * imp * 0.5; a.w.y -= tmp.x * imp * 0.5;
          c.w.x -= tmp.y * imp * 0.5; c.w.y += tmp.x * imp * 0.5;
        }
      }
    }

    const wd = Math.exp(-dt * 0.9);
    for (const b of B) {
      b.p.addScaledVector(b.v, dt);
      b.w.multiplyScalar(wd);
      b.mesh.position.copy(b.p);
      b.mesh.rotation.x += (b.w.x + 0.06) * dt;
      b.mesh.rotation.y += (b.w.y + 0.09) * dt;
      b.mesh.rotation.z += b.w.z * dt;
    }
  }

  tick(dt) {
    if (!this.visible) return;
    this.time += dt;
    const sub = 2, h = Math.min(dt, 1 / 30) / sub;
    for (let i = 0; i < sub; i++) this.step(h);
    this.group.rotation.x = this.scrollP * 0.35;
    this.camera.position.z = 20 - this.scrollP * 3;
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

/* --------------------------------------------------------------------------
   RIBBON — a glossy 3D tube that draws itself through the intro on scroll
   -------------------------------------------------------------------------- */
class Ribbon {
  constructor(section) {
    this.section = section;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ribbon';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(this.canvas);

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.scene.environment = makeEnv(r);
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-0.4, 1, 1);
    this.scene.add(key);

    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 3000);
    this.camera.position.z = 1500;
    this.material = new THREE.MeshPhysicalMaterial({
      color: LIME, roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    this.active = false;
    this.build();
  }

  build() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    Object.assign(this.camera, { left: 0, right: w, top: 0, bottom: -h });
    this.camera.updateProjectionMatrix();

    const rect = this.section.getBoundingClientRect();
    this.top = rect.top + scrollY;
    this.H = this.section.offsetHeight;

    // path in (x as fraction of width, y as fraction of section height, z depth)
    const P = isMobile()
      ? [[-0.15, -0.02, 0], [0.35, 0.06, 60], [0.85, 0.12, -40], [0.7, 0.3, 50], [0.2, 0.34, -30], [0.1, 0.5, 40], [0.6, 0.62, -50], [0.95, 0.74, 30], [1.25, 0.82, 0]]
      : [[-0.08, -0.04, 0], [0.16, 0.1, 60], [0.42, 0.05, -50], [0.56, 0.2, 70], [0.38, 0.36, -10], [0.24, 0.25, -70], [0.4, 0.17, 50], [0.76, 0.36, -30], [0.64, 0.6, 60], [0.86, 0.8, -40], [1.12, 0.9, 0]];
    const pts = P.map(([x, y, z]) => new THREE.Vector3(x * w, -(this.top + y * this.H), z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const radius = clamp(w * 0.016, 10, 26);

    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const geo = new THREE.TubeGeometry(curve, 520, radius, 28, false);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.scene.add(this.mesh);
    this.total = geo.index.count;
    this.update(true);
  }

  update(force = false) {
    if (!this.active && !force) return;
    const y = scrollY;
    this.camera.position.y = -y;
    const p = clamp((y + innerHeight * 0.82 - this.top) / (this.H * 0.98), 0, 1);
    const count = Math.floor((p * this.total) / 3) * 3;
    this.mesh.geometry.setDrawRange(0, count);
    this.renderer.render(this.scene, this.camera);
  }
}

/* --------------------------------------------------------------------------
   APP
   -------------------------------------------------------------------------- */
function boot() {
  if (!gsap || !ScrollTrigger) {
    root.classList.add('no-motion', 'js-ready');
    root.classList.remove('is-loading');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const header = $('.header');
  let lenis = null;
  let hero = null;
  let ribbon = null;

  if (!reduced && Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    window.lenis = lenis;
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---------- WebGL ---------- */
  function initGL() {
    try {
      hero = new HeroScene($('.hero__card'), $('.hero__gl'));
      if (!reduced) ribbon = new Ribbon($('.intro'));
    } catch (err) {
      console.warn('WebGL unavailable', err);
      root.classList.add('no-webgl');
      hero = null; ribbon = null;
    }
    if (hero && reduced) { hero.settle(); hero.render(); }
    if (hero && !reduced) gsap.ticker.add((t, dtMs) => hero.tick(Math.min(dtMs, 50) / 1000));
  }

  /* ---------- text prep ---------- */
  function prepText() {
    $$('[data-roll]').forEach((el) => {
      const host = el.closest('a, button');
      if (host && !host.getAttribute('aria-label')) host.setAttribute('aria-label', el.textContent.trim());
      splitChars(el);
    });
  }

  /* ---------- cursor & magnetic ---------- */
  function setupCursor() {
    if (!fine || reduced) return;
    root.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, input, .plan');
      cur.classList.toggle('is-hover', !!t && !t.matches('input'));
      cur.classList.toggle('is-lg', !t && !!e.target.closest('[data-cursor="lg"]'));
    });
    document.addEventListener('pointerleave', () => gsap.to(cur, { autoAlpha: 0, duration: 0.2 }));
    document.addEventListener('pointerenter', () => gsap.to(cur, { autoAlpha: 1, duration: 0.2 }));
  }

  function setupMagnetic() {
    if (!fine || reduced) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- header: theme + scrolled state ---------- */
  let menuOpen = false;
  function probeTheme() {
    if (menuOpen) return;
    const els = document.elementsFromPoint(innerWidth / 2, 34);
    for (const el of els) {
      if (el.closest('.header, .cursor')) continue;
      const sec = el.closest('[data-theme]');
      if (sec) { header.dataset.theme = sec.dataset.theme; return; }
    }
  }
  function setupHeader() {
    const onScroll = () => {
      header.classList.toggle('is-scrolled', scrollY > 80);
      probeTheme();
    };
    addEventListener('scroll', onScroll, { passive: true });
    // scrubbed clip-paths keep moving after the last scroll event → re-check a few times a second
    let f = 0;
    gsap.ticker.add(() => { if (++f % 8 === 0) probeTheme(); });
    onScroll();
  }

  /* ---------- menu (circle reveal from the button) ---------- */
  function setupMenu() {
    const btn = $('.menu-btn'), menu = $('.menu');
    const tl = gsap.timeline({ paused: true })
      .set(menu, { visibility: 'visible' })
      .fromTo(menu, { '--r': '0px' }, { '--r': () => `${Math.ceil(Math.hypot(innerWidth, innerHeight) * 1.02)}px`, duration: 1, ease: 'expo.inOut' })
      .fromTo('.menu__links .mask > span', { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'expo.out' }, 0.45)
      .fromTo('.menu__num, .menu__foot > *', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.03, ease: 'power3.out' }, 0.6);
    tl.eventCallback('onReverseComplete', () => { menuOpen = false; probeTheme(); });

    const toggle = (force) => {
      const open = force ?? !menuOpen;
      if (open === menuOpen && force !== undefined) return;
      const r = btn.getBoundingClientRect();
      menu.style.setProperty('--mx', `${r.left + r.width / 2}px`);
      menu.style.setProperty('--my', `${r.top + r.height / 2}px`);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      if (open) {
        menuOpen = true;
        header.dataset.theme = 'dark';
        lenis?.stop();
        tl.timeScale(reduced ? 20 : 1).play();
      } else {
        lenis?.start();
        tl.timeScale(reduced ? 20 : 1.5).reverse();
      }
    };
    btn.addEventListener('click', () => toggle());
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) toggle(false); });
    return { close: () => toggle(false), get open() { return menuOpen; } };
  }

  /* ---------- anchors & page-leave ---------- */
  function setupLinks(menu) {
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      const go = () => {
        if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
        else if (target === 0) scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      };
      if (menu.open) { menu.close(); setTimeout(go, 650); } else go();
    }));

    $$('[data-leave]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduced) return;
      e.preventDefault();
      gsap.fromTo('.leave', { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut',
        onComplete: () => { location.href = a.href; },
      });
    }));
    addEventListener('pageshow', (e) => { if (e.persisted) gsap.set('.leave', { clipPath: 'inset(100% 0% 0% 0%)' }); });
  }

  /* ---------- signup (demo only — nothing is sent anywhere) ---------- */
  function setupSignup() {
    const form = $('.signup'), input = $('input', form), btn = $('button', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        form.classList.add('is-error');
        gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        input.focus();
        return;
      }
      form.classList.remove('is-error');
      input.value = '';
      input.placeholder = 'Thanks — we’ll be in touch.';
      input.disabled = true;
      const label = $('[data-roll]', btn) || btn;
      label.textContent = 'You’re on the list ✓';
      splitChars(label);
      gsap.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    });
    input.addEventListener('input', () => form.classList.remove('is-error'));
  }

  /* ---------- HERO intro + scroll ---------- */
  function heroIntro() {
    const tl = gsap.timeline();
    tl.from('.hero__card', { scale: 0.88, duration: 1.5, ease: 'expo.out' }, 0)
      .add(() => hero?.assemble(), 0.05)
      .from('.hero__title .line > span', { yPercent: 115, duration: 1.3, stagger: 0.1, ease: 'expo.out' }, 0.35)
      .from('.header > *', { y: -24, autoAlpha: 0, duration: 1, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, 0.25)
      .from('.hero__top > *, .hero__under > *', { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.05, ease: 'power3.out' }, 0.6);
    return tl;
  }

  function runLoader() {
    const num = $('.loader__num'), prog = $('.loader__prog');
    const L = 2 * Math.PI * 54;
    const o = { v: 0 };
    const intro = heroIntro();
    intro.pause();
    gsap.timeline({ onComplete: () => { root.classList.remove('is-loading'); lenis?.start(); } })
      .to(o, {
        v: 100, duration: 1.7, ease: 'power2.inOut',
        onUpdate: () => { num.textContent = String(Math.round(o.v)).padStart(3, '0'); prog.style.strokeDashoffset = L * (1 - o.v / 100); },
      })
      .to('.loader__inner', { autoAlpha: 0, scale: 0.9, duration: 0.45, ease: 'power2.in' }, '+=0.1')
      .to('.loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, '-=0.1')
      .add(() => intro.play(), '-=0.6')
      .set('.loader', { display: 'none' });
  }

  function setupHeroScroll() {
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom top',
      onUpdate: (s) => { if (hero) hero.scrollP = s.progress; },
    });
    gsap.to('.hero__title', {
      yPercent: -35, autoAlpha: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true },
    });
  }

  /* ---------- INTRO: ribbon + counters ---------- */
  function setupIntro() {
    if (!ribbon) return;
    ScrollTrigger.create({
      trigger: '.intro', start: 'top bottom', end: 'bottom top',
      onToggle: (s) => {
        ribbon.active = s.isActive;
        ribbon.canvas.style.visibility = s.isActive ? 'visible' : 'hidden';
        if (s.isActive) ribbon.update();
      },
      onUpdate: () => ribbon.update(),
    });
    ScrollTrigger.addEventListener('refresh', () => ribbon.build());
  }

  /* ---------- FEATURES (pinned, three app screens) ---------- */
  function setupFeatures() {
    const items = $$('.fitem'), screens = $$('.screen'), bar = $('.fprogress i');

    const ask = {
      el: $('.ask__text'), ans: $('.answer'), chips: $$('.answer .chip'), tl: null,
      run() {
        this.tl?.kill();
        const full = this.el.dataset.type, o = { n: 0 };
        this.el.textContent = '';
        gsap.set(this.ans, { autoAlpha: 0, y: 24 });
        gsap.set(this.chips, { autoAlpha: 0, y: 10 });
        this.tl = gsap.timeline({ delay: 0.35 })
          .to(o, { n: full.length, duration: full.length * 0.032, ease: 'none', onUpdate: () => { this.el.textContent = full.slice(0, Math.round(o.n)); } })
          .to(this.ans, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '+=0.35')
          .to(this.chips, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' }, '-=0.3');
      },
    };
    const draft = {
      lines: $$('.ml'), send: $('.send'), label: $('.send__label'), tl: null,
      run() {
        this.tl?.kill();
        gsap.set(this.lines, { autoAlpha: 0, y: 12 });
        this.label.textContent = 'Send';
        this.send.classList.remove('is-sent');
        this.tl = gsap.timeline({ delay: 0.35 })
          .to(this.lines, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.32, ease: 'power2.out' })
          .to(this.send, { scale: 1.1, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.inOut' }, '+=0.35')
          .call(() => { this.label.textContent = 'Sent ✓'; this.send.classList.add('is-sent'); });
      },
    };
    const flow = {
      nodes: $$('.node'), count: $('.js-flow-count'), tl: null,
      run() {
        this.tl?.kill();
        gsap.set(this.nodes, { autoAlpha: 0, x: -24 });
        this.nodes.forEach((n) => n.style.setProperty('--l', 0));
        const o = { v: 0 };
        this.count.textContent = '0';
        const tl = (this.tl = gsap.timeline({ delay: 0.35 }));
        this.nodes.forEach((n, i) => {
          if (i) tl.to(n, { '--l': 1, duration: 0.28, ease: 'none' });
          tl.to(n, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'power3.out' }, i ? '-=0.05' : 0);
        });
        tl.to(o, { v: 128, duration: 1.3, ease: 'power2.out', onUpdate: () => { this.count.textContent = Math.round(o.v); } }, '-=0.3');
      },
    };
    const apis = [ask, draft, flow];

    let active = -1;
    const show = (i) => {
      if (i === active) return;
      const prev = active;
      active = i;
      items.forEach((it, k) => it.classList.toggle('is-active', k === i));
      if (prev >= 0) gsap.to(screens[prev], { autoAlpha: 0, y: -24, duration: 0.4, ease: 'power2.in', overwrite: true });
      gsap.fromTo(screens[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, delay: prev >= 0 ? 0.2 : 0, ease: 'power3.out', overwrite: true });
      apis[i].run();
    };

    if (reduced) return;
    // start the first screen's micro-animation once the section comes into view
    ScrollTrigger.create({ trigger: '.features', start: 'top 55%', once: true, onEnter: () => show(0) });
    ScrollTrigger.create({
      trigger: '.features', start: 'top top', end: '+=240%', pin: true, anticipatePin: 1,
      onUpdate: (s) => {
        bar.style.transform = `scaleX(${s.progress})`;
        show(Math.min(2, Math.floor(s.progress * 3)));
      },
    });
  }

  /* ---------- STACK (card expands, labels orbit) ---------- */
  function setupStack() {
    const box = $('.orbits'), svg = $('.orbits__svg'), sats = $$('.sat');
    const rings = [
      { a: 0.44, b: 0.15, speed: 0.11, tilt: -9 },
      { a: 0.31, b: 0.11, speed: -0.16, tilt: 7 },
      { a: 0.19, b: 0.075, speed: 0.24, tilt: -3 },
    ];
    const per = [0, 0, 0];
    const sd = sats.map((el) => {
      const ring = +el.dataset.ring;
      return { el, ring, k: per[ring]++ };
    });
    sd.forEach((s) => { s.a0 = (s.k / per[s.ring]) * Math.PI * 2 + s.ring * 0.7; });

    let W = 0, H = 0, S = 0;
    const layout = () => {
      W = box.clientWidth; H = box.clientHeight;
      S = Math.min(W * (isMobile() ? 0.82 : 1), H * 1.9);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = rings.map((r) => `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${r.a * S}" ry="${r.b * S}" transform="rotate(${r.tilt} ${W / 2} ${H / 2})"/>`).join('');
    };
    layout();
    addEventListener('resize', layout);

    let on = false, t = 0;
    const place = () => {
      sd.forEach((s) => {
        const r = rings[s.ring];
        const th = s.a0 + t * r.speed * Math.PI * 2 * 0.25;
        const x = r.a * S * Math.cos(th), y = r.b * S * Math.sin(th);
        const tr = (r.tilt * Math.PI) / 180;
        const X = W / 2 + x * Math.cos(tr) - y * Math.sin(tr);
        const Y = H / 2 + x * Math.sin(tr) + y * Math.cos(tr);
        const depth = (Math.sin(th) + 1) / 2; // 0 back … 1 front
        s.el.style.transform = `translate(${X}px, ${Y}px) translate(-50%, -50%) scale(${0.78 + depth * 0.32})`;
        s.el.style.opacity = (0.4 + depth * 0.6).toFixed(3);
        s.el.style.zIndex = depth > 0.5 ? 3 : 1;
      });
    };
    place();
    if (!reduced) {
      gsap.ticker.add((time, dt) => { if (!on) return; t += dt / 1000; place(); });
      ScrollTrigger.create({ trigger: '.stack', start: 'top bottom', end: 'bottom top', onToggle: (s) => { on = s.isActive; } });

      const mob = isMobile();
      gsap.timeline({
        scrollTrigger: { trigger: '.stack', start: 'top top', end: '+=150%', pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true },
      })
        .fromTo('.stack__card',
          { clipPath: mob ? 'inset(20% 6% 20% 6% round 20px)' : 'inset(16% 18% 16% 18% round 28px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' })
        // labels drift from 9vw towards the page gutter as the card opens
        .fromTo('.stack__l', { x: 0 }, { x: () => -(innerWidth * 0.09 - padPx()), ease: 'none' }, 0)
        .fromTo('.stack__r', { x: 0 }, { x: () => innerWidth * 0.09 - padPx(), ease: 'none' }, 0)
        .fromTo('.orbits', { scale: 0.62 }, { scale: 1, ease: 'none' }, 0)
        .fromTo('.stack__glow', { scale: 0.5, autoAlpha: 0.4 }, { scale: 1.1, autoAlpha: 1, ease: 'none' }, 0);
    }
  }

  /* ---------- LOGO marquee (speeds up with scroll velocity) ---------- */
  function setupMarquee() {
    const track = $('.marquee__track'), unit = $('.marquee__unit');
    let w = unit.offsetWidth;
    const copies = Math.ceil((innerWidth * 1.5) / w) + 1;
    for (let i = 0; i < copies; i++) {
      const c = unit.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
    if (reduced) return;
    let x = 0, boost = 0, dir = 1;
    ScrollTrigger.create({
      trigger: '.logos', start: 'top bottom', end: 'bottom top',
      onUpdate: (s) => { dir = s.direction; boost = Math.min(Math.abs(s.getVelocity()) / 140, 12); },
    });
    ScrollTrigger.addEventListener('refresh', () => { w = unit.offsetWidth; });
    gsap.ticker.add((t, dt) => {
      boost *= 0.93;
      x = gsap.utils.wrap(-w, 0, x - dir * (1 + boost) * dt * 0.045);
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  /* ---------- generic reveals (created last → correct offsets after pins) ---------- */
  function setupReveals() {
    $$('.rl').forEach((h) => {
      gsap.from($$('.line > span', h), {
        yPercent: 115, duration: 1.25, stagger: 0.1, ease: 'expo.out',
        scrollTrigger: { trigger: h, start: 'top 85%' },
      });
    });
    $$('[data-fade]').forEach((el) => {
      gsap.from(el, { y: 36, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count;
      if (!end) return;
      const o = { v: 0 };
      el.textContent = '0';
      gsap.to(o, {
        v: end, duration: 1.8, ease: 'power3.out',
        onUpdate: () => { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    const words = splitWords($('.quote__text'));
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.quote__text', start: 'top 80%', end: 'bottom 50%', scrub: true },
    });

    gsap.from('.plan', {
      y: 90, autoAlpha: 0, rotationX: -12, transformOrigin: '50% 100%', duration: 1.2, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: { trigger: '.plans', start: 'top 82%' },
    });
    if (fine) {
      $$('.plan').forEach((p) => {
        const rx = gsap.quickTo(p, 'rotationX', { duration: 0.7, ease: 'power3' });
        const ry = gsap.quickTo(p, 'rotationY', { duration: 0.7, ease: 'power3' });
        p.addEventListener('pointermove', (e) => {
          const r = p.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 9);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 9);
        });
        p.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }

    const chars = splitChars($('.footer__word'));
    gsap.from(chars, {
      yPercent: 100, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  }

  /* ---------- go ---------- */
  function init() {
    scrollTo(0, 0);
    prepText();
    initGL();
    setupCursor();
    setupMagnetic();
    const menu = setupMenu();
    setupLinks(menu);
    setupSignup();

    if (reduced) {
      $$('[data-count]').forEach((el) => { el.textContent = el.dataset.count; });
      root.classList.remove('is-loading');
      root.classList.add('js-ready');
      setupFeatures();
      setupStack();
      setupMarquee();
      setupHeader();
      return;
    }

    setupHeroScroll();
    setupIntro();
    setupFeatures();
    setupStack();
    setupMarquee();
    setupReveals();
    setupHeader();

    addEventListener('resize', () => hero?.resize());
    ScrollTrigger.refresh();
    root.classList.add('js-ready');
    runLoader();
  }

  const fontsReady = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  fontsReady.then(init);
}

boot();
