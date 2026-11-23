/* Ember — WebGL scenes (three.js)
   1) Hero: a zero-gravity pile of glossy, procedurally modelled coffee beans
      with simple sphere-collision physics. The cursor stirs them, a click bursts them.
   2) Roasting: a single large bean whose colour, gloss and size follow the roast,
      with a puff of chaff at "first crack". */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

/* ---------- Bean geometry: ellipsoid, flattened belly, S-shaped crease ---------- */
export function beanGeometry(seg = 96) {
  let geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const flat = 0.62;
  const depth = 0.56;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const x = v.x * 0.7;
    const y = v.y;
    let z = v.z * depth;
    if (z > 0) z *= flat;                                   // flat side of the bean
    const cx = 0.085 * Math.sin(y * 2.7);                   // S-curve of the crease
    const w = 0.07;
    const face = Math.max(0, z / (depth * flat));           // 0 at the rim → 1 at the middle of the flat side
    const ends = Math.max(0, 1 - Math.pow(Math.abs(y), 6));  // fade out at the tips
    z -= Math.exp(-((x - cx) ** 2) / (w * w)) * 0.17 * Math.pow(face, 0.45) * ends;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

function envFor(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  return env;
}

/* Runs `frame(dt)` only while the canvas is on screen and the tab is visible. */
function visibleLoop(canvas, frame) {
  let onScreen = false, raf = 0, last = 0;
  const tick = (t) => {
    raf = 0;
    if (!onScreen || document.hidden) return;
    const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
    last = t;
    frame(dt);
    raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); }, { rootMargin: '80px' }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  return kick;
}

/* =====================================================================
   HERO
   ===================================================================== */
export function createHero(canvas, { reduced = false } = {}) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const CAM_Z = 30;
  camera.position.set(0, 0, CAM_Z);

  const key = new THREE.DirectionalLight(0xfff1e2, 2.6); key.position.set(6, 10, 12);
  const rim = new THREE.DirectionalLight(0xffc39a, 2.2); rim.position.set(-10, -3, -8);
  const fill = new THREE.HemisphereLight(0xffe2cc, 0x3a1608, 0.7);
  scene.add(key, rim, fill);

  const mobile = matchMedia('(max-width: 700px)').matches;
  const N = mobile ? 30 : 54;
  const geo = beanGeometry(mobile ? 72 : 96);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.36, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.16,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const roasted = ['#3A1D10', '#4B2615', '#2E160B', '#5A301B', '#41210F', '#673820'];
  const col = new THREE.Color();
  const bodies = [];
  for (let i = 0; i < N; i++) {
    const s = THREE.MathUtils.randFloat(0.85, 1.22) * (mobile ? 1.05 : 1.2);
    let c = roasted[i % roasted.length];
    if (i % 9 === 4) c = '#6F7D45';          // a few green, unroasted beans
    else if (i % 11 === 7) c = '#B07A46';    // and a few light-roast ones
    mesh.setColorAt(i, col.set(c));
    const w0 = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(0.15, 0.45));
    bodies.push({
      p: new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(18, 28)),
      v: new THREE.Vector3(),
      s, r: s * 0.74,
      q: new THREE.Quaternion().random(),
      w: w0.clone(), w0,
    });
  }
  mesh.instanceColor.needsUpdate = true;

  /* anchor: a short line segment the pile is pulled towards (depends on aspect) */
  const A = new THREE.Vector2(), B = new THREE.Vector2();
  let halfW = 10, halfH = 8;
  function layout() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    halfW = halfH * camera.aspect;
    if (camera.aspect < 0.9) { A.set(-halfW * 0.12, halfH * 0.28); B.set(halfW * 0.12, halfH * 0.28); }
    else { A.set(-halfW * 0.02, halfH * 0.24); B.set(halfW * 0.5, halfH * 0.12); }
  }

  const mouse = { wx: 0, wy: 0, pwx: 0, pwy: 0, vx: 0, vy: 0, active: false, fresh: true };
  const ndc = new THREE.Vector3(), rayDir = new THREE.Vector3();
  function toWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera);
    rayDir.copy(ndc).sub(camera.position).normalize();
    const t = -camera.position.z / rayDir.z;
    return { x: camera.position.x + rayDir.x * t, y: camera.position.y + rayDir.y * t };
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = toWorld(e.clientX, e.clientY);
    if (mouse.fresh) { mouse.pwx = p.x; mouse.pwy = p.y; mouse.fresh = false; }
    mouse.wx = p.x; mouse.wy = p.y; mouse.active = true;
    kick();
  });
  canvas.addEventListener('pointerleave', () => { mouse.active = false; mouse.fresh = true; });
  canvas.addEventListener('pointercancel', () => { mouse.active = false; mouse.fresh = true; });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toWorld(e.clientX, e.clientY);
    for (const b of bodies) {
      const dx = b.p.x - p.x, dy = b.p.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 8) {
        const f = (1 - d / 8) * 26;
        b.v.x += (dx / d) * f; b.v.y += (dy / d) * f; b.v.z += (Math.random() - 0.3) * f * 0.6;
        b.w.x += (Math.random() - .5) * 8; b.w.y += (Math.random() - .5) * 8;
      }
    }
    kick();
  });

  let started = false;
  let attract = 1;
  let introT = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), axis = new THREE.Vector3();
  const dq = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = new THREE.Vector3();

  function step(dt) {
    if (mouse.active) {
      const vx = (mouse.wx - mouse.pwx) / dt, vy = (mouse.wy - mouse.pwy) / dt;
      mouse.vx = lerp(mouse.vx, clamp(vx, -80, 80), 0.35);
      mouse.vy = lerp(mouse.vy, clamp(vy, -80, 80), 0.35);
      mouse.pwx = mouse.wx; mouse.pwy = mouse.wy;
    } else { mouse.vx *= 0.9; mouse.vy *= 0.9; }

    if (started) introT += dt;
    const rush = Math.max(0, 1 - introT / 2.2);
    const k = started ? 2.4 * attract * (1 + 3.5 * rush) : 0;
    const damp = Math.pow(0.16, dt);
    for (const b of bodies) {
      // pull towards the nearest point of the anchor segment
      const t = clamp((b.p.x - A.x) / (B.x - A.x || 1), 0, 1);
      tmp.set(A.x + (B.x - A.x) * t - b.p.x, A.y + (B.y - A.y) * t - b.p.y, -b.p.z);
      b.v.addScaledVector(tmp, k * dt);

      if (mouse.active) {
        const dx = b.p.x - mouse.wx, dy = b.p.y - mouse.wy;
        const d = Math.hypot(dx, dy);
        const R = 4.6;
        if (d < R) {
          const f = 1 - d / R;
          const nx = dx / (d || 1), ny = dy / (d || 1);
          b.v.x += (nx * 70 * f + mouse.vx * 1.1 * f) * dt;
          b.v.y += (ny * 70 * f + mouse.vy * 1.1 * f) * dt;
          b.v.z += (b.p.z >= 0 ? 1 : -1) * 18 * f * dt;
          b.w.x += -ny * 9 * f * dt; b.w.y += nx * 9 * f * dt;
        }
      }
      b.v.multiplyScalar(damp);
      b.p.addScaledVector(b.v, dt);

      const ang = b.w.length();
      if (ang > 1e-5) {
        axis.copy(b.w).multiplyScalar(1 / ang);
        dq.setFromAxisAngle(axis, ang * dt);
        b.q.premultiply(dq);
      }
      b.w.lerp(b.w0, 1 - Math.pow(0.35, dt));
    }

    // pairwise collisions (sphere approximation)
    for (let i = 0; i < N; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < N; j++) {
        const c = bodies[j];
        tmp.subVectors(c.p, a.p);
        const min = a.r + c.r;
        const d2 = tmp.lengthSq();
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        tmp.multiplyScalar(1 / d);
        const push = (min - d) * 0.5;
        a.p.addScaledVector(tmp, -push);
        c.p.addScaledVector(tmp, push);
        const rel = tmp2.subVectors(c.v, a.v).dot(tmp);
        if (rel < 0) {
          const imp = -1.3 * rel * 0.5;
          a.v.addScaledVector(tmp, -imp);
          c.v.addScaledVector(tmp, imp);
          const spin = Math.min(-rel, 6) * 0.25;
          a.w.x += tmp.y * spin; a.w.y -= tmp.x * spin;
          c.w.x -= tmp.y * spin; c.w.y += tmp.x * spin;
        }
      }
    }
  }

  function sync() {
    for (let i = 0; i < N; i++) {
      const b = bodies[i];
      m4.compose(b.p, b.q, sc.setScalar(b.s));
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  let progress = 0;
  function frame(dt) {
    step(dt * 0.5); step(dt * 0.5);
    camera.position.z = CAM_Z + progress * 5;
    camera.position.y = progress * 2.5;
    camera.lookAt(0, progress * 2.5, 0);
    sync();
    renderer.render(scene, camera);
  }

  layout();
  new ResizeObserver(() => { layout(); if (reduced) render(); else kick(); }).observe(canvas);

  function render() { sync(); renderer.render(scene, camera); }
  const kick = reduced ? render : visibleLoop(canvas, frame);

  if (reduced) {
    // settle the pile instantly and draw a single still frame
    started = true;
    for (const b of bodies) b.p.multiplyScalar(0.12);
    for (let i = 0; i < 700; i++) step(1 / 60);
    render();
  }

  return {
    start() {
      if (!started && !reduced) {
        // pour the beans in from just outside the frame
        const R = Math.max(halfW, halfH) + 3;
        for (const b of bodies) {
          b.p.randomDirection().multiplyScalar(R * THREE.MathUtils.randFloat(1, 1.35));
          b.p.z *= 0.5;
          b.v.set(0, 0, 0);
        }
      }
      started = true; kick();
    },
    setProgress(p) { progress = p; attract = 1 - p * 0.75; },
  };
}

/* =====================================================================
   ROASTING BEAN
   ===================================================================== */
export function createRoast(canvas, { reduced = false } = {}) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 15);

  const key = new THREE.DirectionalLight(0xfff3e6, 2.4); key.position.set(5, 8, 10);
  const rim = new THREE.DirectionalLight(0xff6a2a, 3.2); rim.position.set(-6, 2, -8);
  const rim2 = new THREE.DirectionalLight(0xffd2a8, 1.4); rim2.position.set(8, -4, -6);
  scene.add(key, rim, rim2, new THREE.AmbientLight(0xffffff, 0.15));

  const mat = new THREE.MeshPhysicalMaterial({ color: '#8C9A63', roughness: 0.62, clearcoat: 0, clearcoatRoughness: 0.2 });
  const bean = new THREE.Mesh(beanGeometry(160), mat);
  const pivot = new THREE.Group();
  pivot.rotation.z = -0.42;
  pivot.add(bean);
  scene.add(pivot);

  // chaff flakes for "first crack"
  const CH = 28;
  const chGeo = new THREE.SphereGeometry(1, 10, 6); chGeo.scale(0.24, 0.14, 0.04);
  const chMat = new THREE.MeshStandardMaterial({ color: '#C8A27A', roughness: 0.85 });
  const chaff = new THREE.InstancedMesh(chGeo, chMat, CH);
  chaff.frustumCulled = false;
  const chDirs = Array.from({ length: CH }, () => ({
    d: new THREE.Vector3().randomDirection().multiply(new THREE.Vector3(1.3, 1, 0.6)),
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    s: THREE.MathUtils.randFloat(0.6, 1.4),
  }));
  scene.add(chaff);

  const stops = [
    { c: new THREE.Color('#8C9A63'), r: 0.66, cc: 0.0, s: 1.0 },
    { c: new THREE.Color('#D3AE5C'), r: 0.56, cc: 0.15, s: 1.05 },
    { c: new THREE.Color('#9A552B'), r: 0.42, cc: 0.55, s: 1.3 },
    { c: new THREE.Color('#3B1F12'), r: 0.24, cc: 1.0, s: 1.4 },
  ];

  let stage = 0, crack = 0, baseScale = 2.5;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();

  function applyStage() {
    const i = Math.min(Math.floor(stage), 2), f = clamp(stage - i, 0, 1);
    const a = stops[i], b = stops[i + 1];
    mat.color.copy(a.c).lerp(b.c, f);
    mat.roughness = lerp(a.r, b.r, f);
    mat.clearcoat = lerp(a.cc, b.cc, f);
    bean.scale.setScalar(baseScale * lerp(a.s, b.s, f));
    crack = clamp((stage - 1.5) / 0.55, 0, 1);
  }

  function layout() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // keep the bean comfortably inside the frame on narrow screens
    baseScale = camera.aspect < 1 ? 2.5 * Math.max(0.6, camera.aspect) : 2.5;
    applyStage();
  }

  let tiltX = 0, tiltY = 0, tx = 0, ty = 0, spin = 0;
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientY / innerHeight - 0.5) * 0.5;
      ty = (e.clientX / innerWidth - 0.5) * 0.7;
    }, { passive: true });
  }

  function draw(dt) {
    spin += dt * 0.5;
    tiltX = lerp(tiltX, tx, 0.05); tiltY = lerp(tiltY, ty, 0.05);
    // rock around the crease side (which faces the camera) instead of spinning away from it
    bean.rotation.set(0.18 + tiltX + Math.sin(spin * 0.6) * 0.12, Math.sin(spin * 0.8) * 0.85 + tiltY, 0);
    const shake = Math.sin(crack * Math.PI);
    pivot.position.x = shake * Math.sin(spin * 90) * 0.08;
    pivot.position.y = shake * Math.cos(spin * 77) * 0.05;
    const e = 1 - Math.pow(1 - crack, 3);
    for (let i = 0; i < CH; i++) {
      const c = chDirs[i];
      v.copy(c.d).multiplyScalar(2.2 + e * 6.5 * c.s);
      v.y += e * e * 1.5;
      q.setFromEuler(c.r.set(c.r.x + dt * 2, c.r.y + dt * 1.4, c.r.z));
      sc.setScalar(crack > 0 && crack < 1 ? Math.sin(crack * Math.PI) * c.s : 0.0001);
      m4.compose(v, q, sc);
      chaff.setMatrixAt(i, m4);
    }
    chaff.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  layout();
  const kick = reduced ? () => draw(0) : visibleLoop(canvas, draw);
  new ResizeObserver(() => { layout(); kick(); }).observe(canvas);
  if (reduced) draw(0);

  return {
    setStage(x) { stage = clamp(x, 0, 3); applyStage(); if (reduced) draw(0); },
  };
}
