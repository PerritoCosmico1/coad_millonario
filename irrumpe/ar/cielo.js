/*
 * IRRUMPE AR — EL CIELO: al mirar hacia arriba, el techo se abre.
 *
 * Un cielo nocturno sobre quien mira (oscurece el techo real hacia arriba),
 * con estrellas, una aurora con los colores de la banda que late con la
 * música y aviones de papel dando vueltas (POLEA · "Primer vuelo").
 * Aparece de a poco al levantar el celular y no se ve mirando al frente.
 */
import * as THREE from '../vendor/three.min.js';

const ADD = THREE.AdditiveBlending;

function auroraGeometry(r, h0, h, a0, span, seed) {
  const n = 64, p = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (span * i) / n;
    const y = h0 + 2.5 * Math.sin(i * 0.21 + seed) + 1.5 * Math.sin(i * 0.07 + seed * 2);
    const rr = r + 3 * Math.sin(i * 0.13 + seed);
    p.push(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(a) * rr, y + h, Math.sin(a) * rr);
    uv.push(i / n, 0, i / n, 1);
    if (i < n) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function planeGeometry() {
  const nose = [0, 0, 0.6], tl = [-0.42, 0.04, -0.45], tc = [0, 0, -0.45], tr = [0.42, 0.04, -0.45], kb = [0, -0.17, -0.42];
  const p = [...nose, ...tl, ...tc, ...nose, ...tc, ...tr, ...nose, ...tc, ...kb];
  const w = [0.96, 0.95, 0.92], w2 = [0.86, 0.85, 0.82], k = [1, 0.29, 0.11];
  const c = [...w, ...w, ...w, ...w2, ...w2, ...w2, ...k, ...k, ...k];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

export function createCielo({ aviones = true } = {}) {
  const group = new THREE.Group();
  group.name = 'cielo';
  group.visible = false;

  // Cúpula: transparente en el horizonte, noche cerrada arriba.
  const domeMat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 }, uLow: { value: new THREE.Color('#0b1236') }, uTop: { value: new THREE.Color('#020309') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uFade; uniform vec3 uLow; uniform vec3 uTop; varying vec3 vP;
      void main() {
        float h = vP.y;
        float a = smoothstep(0.12, 0.55, h) * 0.93 * uFade;
        gl_FragColor = vec4(mix(uLow, uTop, smoothstep(0.35, 0.95, h)), a);
      }`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // Estrellas.
  const N = 650;
  const sp = new Float32Array(N * 3), ss = new Float32Array(N), sph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const y = 0.2 + Math.random() * 0.8, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    sp.set([Math.cos(a) * r * 70, y * 70, Math.sin(a) * r * 70], i * 3);
    ss[i] = 1.2 + Math.pow(Math.random(), 3) * 3.2;
    sph[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sph, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uFade: { value: 0 }, uPx: { value: 1 }, uE: { value: 0 } },
    vertexShader: `
      uniform float uT; uniform float uFade; uniform float uPx; uniform float uE;
      attribute float aSize; attribute float aPhase; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4 * sin(uT * (0.8 + aPhase * 2.0) + aPhase * 40.0);
        gl_PointSize = aSize * uPx * (0.85 + 0.25 * tw + 0.25 * uE);
        vA = tw * uFade * smoothstep(0.2, 0.42, normalize(position).y);
      }`,
    fragmentShader: `
      varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; gl_FragColor = vec4(1.0, 0.97, 0.92, exp(-dot(d, d) * 16.0) * vA); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: ADD,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  group.add(stars);

  // Aurora.
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uFade: { value: 0 }, uE: { value: 0 }, c1: { value: new THREE.Color('#ff4a1c') }, c2: { value: new THREE.Color('#ffffff') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uT; uniform float uFade; uniform float uE; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv;
      void main() {
        float flow = 0.5 + 0.5 * sin(vUv.x * 26.0 + uT * 0.8 + 2.2 * sin(vUv.x * 9.0 - uT * 0.45));
        float curtain = smoothstep(0.0, 0.22, vUv.y) * pow(1.0 - vUv.y, 1.7);
        float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        float a = curtain * edge * (0.25 + 0.75 * flow) * uFade * (0.5 + 0.5 * uE) * 1.15;
        gl_FragColor = vec4(mix(c1, c2, clamp(vUv.y * 1.2 + 0.15 * sin(vUv.x * 7.0 + uT * 0.3), 0.0, 1.0)), a);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: ADD, side: THREE.DoubleSide,
  });
  [[0, 3.6, 1], [Math.PI * 0.9, 3.4, 4]].forEach(([a0, span, seed]) => {
    const m = new THREE.Mesh(auroraGeometry(30, 13, 16, a0, span, seed), auroraMat);
    m.frustumCulled = false;
    m.renderOrder = -8;
    group.add(m);
  });

  // Aviones de papel con su estela.
  const planes = [];
  if (aviones) {
    const geo = planeGeometry();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0, depthTest: false });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.setScalar(1.3);
      m.renderOrder = -6;
      const T = 26;
      const tp = new Float32Array(T * 3), tc = new Float32Array(T * 3);
      for (let k = 0; k < T; k++) { const f = Math.pow(1 - k / (T - 1), 1.5) * 0.55; tc.set([f, f, f], k * 3); }
      const trail = new THREE.Line(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(tp, 3).setUsage(THREE.DynamicDrawUsage)).setAttribute('color', new THREE.BufferAttribute(tc, 3)),
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: ADD, opacity: 0 }),
      );
      trail.frustumCulled = false;
      trail.renderOrder = -7;
      group.add(m, trail);
      planes.push({
        m, trail, tp, T, filled: false,
        r: 7 + Math.random() * 6, h: 9 + Math.random() * 5, w: (0.09 + Math.random() * 0.07) * (i % 2 ? 1 : -1), a: Math.random() * Math.PI * 2, ph: Math.random() * 6,
      });
    }
  }

  let fade = 0;
  const fwd = new THREE.Vector3();
  const q = new THREE.Vector3();
  const next = new THREE.Vector3();

  return {
    group,
    get fade() { return fade; },
    setColors(c1, c2) {
      auroraMat.uniforms.c1.value.set(c1);
      auroraMat.uniforms.c2.value.set(c2);
    },
    update(t, dt, r, camera, renderer) {
      camera.getWorldDirection(fwd);
      const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
      const want = Math.min(1, Math.max(0, (pitch - 0.26) / 0.36));
      fade += (want - fade) * (1 - Math.exp(-dt * 5));
      group.visible = fade > 0.004;
      if (!group.visible) return;
      const s = t / 1000;
      domeMat.uniforms.uFade.value = fade;
      starMat.uniforms.uT.value = s;
      starMat.uniforms.uFade.value = fade;
      starMat.uniforms.uE.value = r.energy;
      starMat.uniforms.uPx.value = renderer.getPixelRatio();
      auroraMat.uniforms.uT.value = s;
      auroraMat.uniforms.uFade.value = fade;
      auroraMat.uniforms.uE.value = Math.min(1, r.energy * 0.8 + r.hype * 0.4);
      planes.forEach((p, i) => {
        p.a += p.w * dt;
        const y = p.h + 0.8 * Math.sin(s * 0.5 + p.ph);
        p.m.position.set(Math.cos(p.a) * p.r, y, Math.sin(p.a) * p.r);
        const a2 = p.a + Math.sign(p.w) * 0.05;
        next.set(Math.cos(a2) * p.r, p.h + 0.8 * Math.sin((s + 0.4) * 0.5 + p.ph), Math.sin(a2) * p.r);
        p.m.lookAt(next);
        p.m.rotateZ(Math.sign(p.w) * -0.4);
        p.m.material.opacity = fade;
        // estela
        const tp = p.tp;
        if (!p.filled) { for (let k = 0; k < p.T; k++) tp.set([p.m.position.x, y, p.m.position.z], k * 3); p.filled = true; }
        tp.copyWithin(3, 0, (p.T - 1) * 3);
        q.copy(p.m.position);
        tp[0] = q.x; tp[1] = q.y; tp[2] = q.z;
        p.trail.geometry.attributes.position.needsUpdate = true;
        p.trail.material.opacity = fade;
      });
    },
  };
}
