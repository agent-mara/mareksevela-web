/* ═══════════════════════════════════════════════════════════════
   MAREK ŠEVELA — POHYB (motion layer)

   Co tenhle soubor dělá:
   1) 3D scéna v úvodu — síť světelných bodů, která reaguje na kurzor
   2) plynulé scrollování (Lenis)
   3) nástup úvodu + animace sekcí při scrollu (GSAP ScrollTrigger)
   4) tenký ukazatel postupu nahoře a „magnetická" tlačítka

   Všechno je dobrovolné: když se nenačte knihovna z internetu nebo má
   návštěvník vypnuté animace, stránka funguje dál jako předtím.
   ═══════════════════════════════════════════════════════════════ */

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
// Plynulé scrollování (Lenis) vypnuto 24. 11. 2026 — na Macu se pralo
// s vlastním setrvačným scrollem trackpadu a působilo gumově.
// Zpátky: přepnout na true.
const PLYNULY_SCROLL = false;

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

/* ───────── 1) plynulé scrollování ───────── */

let lenis = null;

function initLenis() {
  if (!PLYNULY_SCROLL || reduced || !window.Lenis) return;
  lenis = new window.Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6,
  });

  window.__lenisActive = true;

  if (gsap && ScrollTrigger) {
    // Lenis točíme na hodinách GSAPu, ať jde scroll i animace ruku v ruce
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // odkazy v menu posouvá Lenis (script.js svoje posouvání vypne)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const cil = document.querySelector(a.getAttribute('href'));
      if (!cil) return;
      e.preventDefault();
      lenis.scrollTo(cil, { offset: -70 });
    });
  });
}

/* ───────── 2) ukazatel postupu ───────── */

function initProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);

  const uprav = () => {
    const max = document.body.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = `scaleX(${p})`;
  };
  window.addEventListener('scroll', uprav, { passive: true });
  window.addEventListener('resize', uprav);
  uprav();
}

/* ───────── 3) nástup úvodu a animace sekcí ───────── */

function initIntro() {
  // bez GSAP (nebo s vypnutými animacemi) jen sundáme skrývací třídu,
  // aby byl úvod normálně vidět
  if (!gsap || reduced) {
    root.classList.remove('js-motion');
    root.classList.add('intro-done');
    return;
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.1 });

  tl.to('.hero-badge', { y: 0, opacity: 1, duration: 0.7 })
    .to('.hl-i', { y: 0, yPercent: 0, duration: 1.0, stagger: 0.09 }, '-=0.45')
    .to('.hero-sub', { y: 0, opacity: 1, duration: 0.8 }, '-=0.6')
    .to('.hero-cta > *', { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 }, '-=0.55')
    .to('.hero-stats .stat-card', { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 }, '-=0.5')
    .to('.hero-scroll', { opacity: 0.4, duration: 0.6 }, '-=0.3');

  root.classList.add('intro-done');
}

/* rozseká nadpis na slova; barevnou část (.gradient-text) nechává vcelku,
   aby se jí nerozbil přechod barev */
function rozdelNaSlova(el) {
  if (el.dataset.rozdeleno) return [...el.querySelectorAll('.w-i')];
  const kusy = [];

  const zabal = (text) => {
    const frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach((cast) => {
      if (!cast) return;
      if (/^\s+$/.test(cast)) {
        frag.appendChild(document.createTextNode(cast));
        return;
      }
      const vnejsi = document.createElement('span');
      vnejsi.className = 'w';
      const vnitrni = document.createElement('span');
      vnitrni.className = 'w-i';
      vnitrni.textContent = cast;
      vnejsi.appendChild(vnitrni);
      frag.appendChild(vnejsi);
      kusy.push(vnitrni);
    });
    return frag;
  };

  [...el.childNodes].forEach((uzel) => {
    if (uzel.nodeType === 3 && uzel.textContent.trim()) {
      el.replaceChild(zabal(uzel.textContent), uzel);
    } else if (uzel.nodeType === 1 && uzel.classList.contains('gradient-text')) {
      // barevné slovo necháme jako jeden celek, jen ho zabalíme do masky
      const vnejsi = document.createElement('span');
      vnejsi.className = 'w';
      uzel.parentNode.insertBefore(vnejsi, uzel);
      uzel.classList.add('w-i');
      vnejsi.appendChild(uzel);
      kusy.push(uzel);
    }
  });

  el.dataset.rozdeleno = '1';
  return kusy;
}

function initScrollAnimace() {
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // úvod se při odjíždění jemně vzdaluje
  gsap.to('.hero-inner', {
    y: -80,
    opacity: 0.25,
    ease: 'none',
    scrollTrigger: {
      trigger: '#home',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  });

  // nadpisy sekcí se odkrývají slovo po slovu
  gsap.utils.toArray('section h2').forEach((h) => {
    const slova = rozdelNaSlova(h);
    gsap.from(slova.length ? slova : [h], {
      yPercent: 110,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.045,
      scrollTrigger: { trigger: h, start: 'top 85%' },
    });
  });

  // náhledy webů se při scrollu lehce posouvají uvnitř rámečku
  gsap.utils.toArray('.web-shot img').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  });

  // Pozn.: karty v sekcích (.reveal) si nástup řeší samy přes script.js —
  // kdyby je přebral i GSAP, přepsal by jim průhlednost a zůstaly by neviditelné.
}

/* ───────── 4) magnetická tlačítka ───────── */

function initMagnet() {
  if (!fine || !gsap) return;
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      gsap.to(btn, { x: x * 0.18, y: y * 0.3, duration: 0.4, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

/* ───────── 5) 3D síť v úvodu ───────── */

async function initHero3D() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || reduced) return;

  let THREE;
  try {
    THREE = await import('three');
  } catch {
    return; // bez internetu / se starým prohlížečem prostě nic, pozadí zůstane
  }

  // antialias vypnutý a nižší strop rozlišení: na retina displeji to je
  // rozdíl ve čtvrtině vykreslovaných pixelů, okem skoro nepoznatelný
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 16;

  const skupina = new THREE.Group();
  scene.add(skupina);

  // body rozmístěné v kouli
  const POCET = window.innerWidth < 768 ? 70 : 120;
  const R = 9;
  const body = [];
  for (let i = 0; i < POCET; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = R * Math.cbrt(Math.random());
    body.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.65,
        r * Math.cos(phi)
      )
    );
  }

  // kulatá tečka jako textura
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(196,181,253,0.9)');
    grad.addColorStop(1, 'rgba(124,58,237,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  })();

  const geoBody = new THREE.BufferGeometry().setFromPoints(body);
  const matBody = new THREE.PointsMaterial({
    size: 0.42,
    map: sprite,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  skupina.add(new THREE.Points(geoBody, matBody));

  // spojnice mezi blízkými body
  const PRAH = 4.2;
  const vrcholy = [];
  const barvy = [];
  const fialova = new THREE.Color('#a78bfa');
  const modra = new THREE.Color('#60a5fa');
  for (let i = 0; i < body.length; i++) {
    for (let j = i + 1; j < body.length; j++) {
      const d = body[i].distanceTo(body[j]);
      if (d > PRAH) continue;
      const sila = 1 - d / PRAH;
      const c = fialova.clone().lerp(modra, Math.random());
      vrcholy.push(body[i].x, body[i].y, body[i].z, body[j].x, body[j].y, body[j].z);
      for (let k = 0; k < 2; k++) barvy.push(c.r * sila, c.g * sila, c.b * sila);
    }
  }
  const geoCary = new THREE.BufferGeometry();
  geoCary.setAttribute('position', new THREE.Float32BufferAttribute(vrcholy, 3));
  geoCary.setAttribute('color', new THREE.Float32BufferAttribute(barvy, 3));
  skupina.add(
    new THREE.LineSegments(
      geoCary,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
  );

  // velikost plátna
  let zakladniZ = 16;
  function zmenVelikost() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    zakladniZ = w < 768 ? 21 : 16;
    camera.position.z = zakladniZ;
    camera.updateProjectionMatrix();
  }
  zmenVelikost();
  window.addEventListener('resize', zmenVelikost);

  // kurzor
  const mys = { x: 0, y: 0 };
  const cil = { x: 0, y: 0 };
  if (fine) {
    window.addEventListener(
      'mousemove',
      (e) => {
        cil.x = (e.clientX / window.innerWidth - 0.5) * 2;
        cil.y = (e.clientY / window.innerHeight - 0.5) * 2;
      },
      { passive: true }
    );
  }

  // kreslí se jen když je úvod vidět
  let vidite = true;
  new IntersectionObserver(
    ([e]) => {
      vidite = e.isIntersecting;
    },
    { threshold: 0 }
  ).observe(document.getElementById('home'));

  // při scrollu se síť rozestoupí a odpluje do hloubky
  let scrollPodil = 0;
  window.addEventListener(
    'scroll',
    () => {
      scrollPodil = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    },
    { passive: true }
  );

  let t = 0;
  function smycka() {
    requestAnimationFrame(smycka);
    if (!vidite) return;
    t += 0.0016;

    mys.x += (cil.x - mys.x) * 0.045;
    mys.y += (cil.y - mys.y) * 0.045;

    skupina.rotation.y = t + mys.x * 0.45;
    skupina.rotation.x = Math.sin(t * 0.7) * 0.12 + mys.y * 0.25;

    // tep — body jemně dýchají
    matBody.size = 0.42 + Math.sin(t * 22) * 0.05;

    // scroll: síť se zvětší a ustoupí dozadu
    const zoom = 1 + scrollPodil * 0.35;
    skupina.scale.setScalar(zoom);
    camera.position.z = zakladniZ + scrollPodil * 6;

    renderer.render(scene, camera);
  }
  smycka();

  canvas.classList.add('hotovo');
}

/* ───────── 6) počítadla čísel v úvodu ───────── */

function initPocitadla() {
  if (!gsap) return;

  document.querySelectorAll('.hero-stats .stat-number').forEach((el) => {
    const text = el.textContent.trim();
    const cislo = text.replace(/\s/g, '').match(/^(\d+)(%?)$/);
    if (!cislo) return; // „24/7" a podobné necháme být

    const cil = parseInt(cislo[1], 10);
    const pripona = cislo[2] || '';
    const sMezerou = /\s/.test(text);
    const stav = { v: 0 };

    el.textContent = '0' + pripona;
    gsap.to(stav, {
      v: cil,
      duration: 1.8,
      delay: 1.4,
      ease: 'power2.out',
      onUpdate() {
        const n = Math.round(stav.v);
        el.textContent = (sMezerou ? n.toLocaleString('cs-CZ') : String(n)) + pripona;
      },
    });
  });
}

/* ───────── 7) světlo pod kurzorem na kartách ───────── */

function initSvetloKaret() {
  if (!fine) return;
  const karty = document.querySelectorAll('.auto-card, .web-card, .service-card-featured');

  karty.forEach((k) => {
    k.classList.add('ma-svetlo');
    k.addEventListener(
      'mousemove',
      (e) => {
        const r = k.getBoundingClientRect();
        k.style.setProperty('--mx', `${e.clientX - r.left}px`);
        k.style.setProperty('--my', `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
  });
}

/* ───────── 8) vlastní kurzor ───────── */

function initKurzor() {
  if (!fine) return;

  const zar = document.createElement('div');
  zar.className = 'kurzor-zar';
  const kruh = document.createElement('div');
  kruh.className = 'kurzor-kruh';
  document.body.append(zar, kruh);

  let x = -200;
  let y = -200;
  let kx = x;
  let ky = y;

  document.addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      zar.style.transform = `translate(${x}px, ${y}px)`;
    },
    { passive: true }
  );

  (function dojezd() {
    requestAnimationFrame(dojezd);
    kx += (x - kx) * 0.16;
    ky += (y - ky) * 0.16;
    kruh.style.transform = `translate(${kx}px, ${ky}px)`;
  })();

  // nad odkazy a tlačítky se kroužek zvětší
  document.querySelectorAll('a, button, .web-card, .auto-card, input, textarea, select').forEach((el) => {
    el.addEventListener('mouseenter', () => kruh.classList.add('velky'));
    el.addEventListener('mouseleave', () => kruh.classList.remove('velky'));
  });
}

/* ───────── spuštění ───────── */

initLenis();
initProgress();
initScrollAnimace();
initIntro();
initPocitadla();
initMagnet();
initSvetloKaret();
initKurzor();
initHero3D();
