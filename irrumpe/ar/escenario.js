/*
 * IRRUMPE AR — ESCENARIO AUMENTADO.
 *
 * Se apunta al escenario real y, alrededor de la banda (sin taparla), aparece
 * la producción de un festival que sigue la música en vivo (ver ritmo.js):
 *
 *   - un truss (estructura metálica) que enmarca el escenario: al apuntar se ve
 *     solo su contorno, para encuadrar; al fijar se "enciende" luz por luz
 *   - 6 focos con haces de luz que barren el escenario y, en las partes
 *     fuertes, el público
 *   - luces cinéticas colgando sobre la banda, que suben y bajan en olas
 *   - columnas LED en los costados (graves a la izquierda, agudos a la derecha)
 *   - candilejas en el borde del escenario y humo bajo
 *   - en lo más fuerte: láseres hacia el público (en abanico sobre las cabezas
 *     o en túnel alrededor de quien mira), ondas que salen de la banda y
 *     chispas en las esquinas
 *   - al encender o cambiar de banda, su nombre aparece arriba unos segundos
 *
 * El centro (donde está la banda) queda siempre despejado.
 *
 * Medidas en unidades del grupo (el grupo se escala ~1,3 al empezar, y se
 * ajusta pellizcando): la banda está en (0, 0, 0), mirando hacia +z.
 */
import * as THREE from '../vendor/three.min.js';

const ADD = THREE.AdditiveBlending;
const W = 1.2;       // mitad del ancho entre las patas del truss
const TOP = 1.45;    // altura del truss sobre el centro de la banda
const FLOOR = -1.0;  // piso del escenario
const D = 0.11;      // grosor del truss
const N_BEAMS = 6;
const N_LASERS = 10;

/*
 * Estilos de show. `haz`: patrones de los focos, en orden de aparición.
 * `laser`, `ondas`, `chispas`: desde qué intensidad (0..1) aparecen.
 * `ancho`: apertura de los haces. `dos`: alterna los dos colores.
 */
export const ESTILOS = {
  proyector: { haz: ['abanico', 'ola', 'publico'], ancho: 1.5, laser: 0.8, ondas: 0.55, chispas: 0.78, dos: false },
  laser: { haz: ['cruce', 'ola', 'publico'], ancho: 0.7, laser: 0.42, ondas: 0.75, chispas: 0.7, dos: true },
  ondas: { haz: ['ola', 'abanico', 'publico'], ancho: 1.0, laser: 0.7, ondas: 0, chispas: 0.8, dos: true },
  tormenta: { haz: ['cruce', 'publico', 'ola'], ancho: 0.9, laser: 0.55, ondas: 0.5, chispas: 0.55, dos: true },
};

// [giro lateral, inclinación hacia el público] de cada foco, en radianes.
const PATRONES = {
  quieto: (k, n, s) => [(k - (n - 1) / 2) * 0.07 + 0.04 * Math.sin(s * 0.4 + k), 0.12 + 0.04 * Math.sin(s * 0.5)],
  abanico: (k, n, s) => [(k - (n - 1) / 2) * 0.16 * (0.8 + 0.4 * Math.sin(s * 0.7)), 0.32 + 0.12 * Math.sin(s * 0.9)],
  cruce: (k, n, s) => [(k % 2 ? 1 : -1) * (0.15 + 0.38 * Math.sin(s * 1.2)), 0.3 + 0.1 * Math.sin(s * 0.8 + k)],
  ola: (k, n, s) => [0.32 * Math.sin(s * 1.5 + k * 0.75), 0.24 + 0.18 * Math.sin(s * 1.1 + k * 0.6)],
  publico: (k, n, s) => [(k - (n - 1) / 2) * 0.2 + 0.22 * Math.sin(s * 0.8), 0.86 + 0.24 * Math.sin(s * 1.0 + k * 0.45)],
};

// ------------------------------------------------------------------ texturas

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let glowTex = null;
export function glowTexture() {
  if (!glowTex) {
    glowTex = canvasTexture(128, (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
  }
  return glowTex;
}
function hazeTexture() {
  return canvasTexture(256, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const x = s * (0.15 + Math.random() * 0.7), y = s * (0.35 + Math.random() * 0.3), r = s * (0.1 + Math.random() * 0.22);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    }
  });
}

// ------------------------------------------------------------------ chispas (espacio del mundo)

/*
 * Partículas compartidas: chispas del escenario y fuegos artificiales (sobre
 * el escenario o en el cielo). Coordenadas del mundo, en metros.
 */
export function createChispas(max = 700) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const base = new Float32Array(max * 3);
  const age = new Float32Array(max);
  const life = new Float32Array(max).fill(-1);
  const grav = new Float32Array(max);
  const drag = new Float32Array(max);
  const size0 = new Float32Array(max);
  let next = 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: `
      uniform float uScale; attribute float aSize; varying vec3 vC;
      void main() {
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = exp(-dot(d, d) * 14.0);
        gl_FragColor = vec4(vC, a);
      }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: ADD,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  const pending = [];
  const tmp = new THREE.Color();
  let alive = 0;

  function emit(px, py, pz, vx, vy, vz, color, lifeS, s, g, dr) {
    const i = next;
    next = (next + 1) % max;
    pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    base[i * 3] = color.r; base[i * 3 + 1] = color.g; base[i * 3 + 2] = color.b;
    age[i] = 0; life[i] = lifeS; size0[i] = s; grav[i] = g; drag[i] = dr;
  }
  function burst(p, colors, scale = 1) {
    const n = 90;
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = (1.7 + Math.random() * 0.5) * scale;
      tmp.set(colors[k % colors.length]);
      emit(p.x, p.y, p.z, r * Math.cos(a) * sp, u * sp + 0.3 * scale, r * Math.sin(a) * sp, tmp, 1.1 + Math.random() * 0.6, 0.075 * scale, -1.4 * scale, 1.6);
    }
    // destello
    tmp.set('#ffffff');
    emit(p.x, p.y, p.z, 0, 0, 0, tmp, 0.25, 0.9 * scale, 0, 0);
  }
  return {
    points,
    emit,
    burst,
    // Cohete que sube de `from` a `to` y explota.
    firework(from, to, colors, scale = 1) {
      const dur = 0.5;
      tmp.set('#fff2d6');
      emit(from.x, from.y, from.z, (to.x - from.x) / dur, (to.y - from.y) / dur, (to.z - from.z) / dur, tmp, dur, 0.08 * scale, 0, 0);
      pending.push({ at: performance.now() + dur * 1000, p: to.clone(), colors, scale, trail: { from: from.clone(), to: to.clone(), t0: performance.now(), dur } });
    },
    update(dt, camera, renderer) {
      const h = renderer.getDrawingBufferSize ? renderer.domElement.height : 800;
      mat.uniforms.uScale.value = (h / 2) / Math.tan((camera.fov * Math.PI) / 360);
      const now = performance.now();
      for (let n = pending.length - 1; n >= 0; n--) {
        const f = pending[n];
        // estela del cohete
        const p = Math.min(1, (now - f.trail.t0) / (f.trail.dur * 1000));
        if (p < 1 && Math.random() < 0.9) {
          tmp.set('#ffb070');
          const x = f.trail.from.x + (f.trail.to.x - f.trail.from.x) * p, y = f.trail.from.y + (f.trail.to.y - f.trail.from.y) * p, z = f.trail.from.z + (f.trail.to.z - f.trail.from.z) * p;
          emit(x, y, z, (Math.random() - 0.5) * 0.2, -0.3, (Math.random() - 0.5) * 0.2, tmp, 0.35, 0.05 * f.scale, -1, 2);
        }
        if (now >= f.at) { burst(f.p, f.colors, f.scale); pending.splice(n, 1); }
      }
      alive = 0;
      for (let i = 0; i < max; i++) {
        if (life[i] < 0) continue;
        age[i] += dt;
        const k = age[i] / life[i];
        if (k >= 1) { life[i] = -1; size[i] = 0; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        alive++;
        vel[i * 3 + 1] += grav[i] * dt;
        const f = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= f; vel[i * 3 + 1] *= f; vel[i * 3 + 2] *= f;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const fade = Math.pow(1 - k, 1.3) * (0.75 + 0.25 * Math.sin(age[i] * 40 + i));
        // de blanco caliente al color
        const hot = Math.max(0, 1 - k * 3);
        col[i * 3] = (base[i * 3] + (1 - base[i * 3]) * hot) * fade;
        col[i * 3 + 1] = (base[i * 3 + 1] + (1 - base[i * 3 + 1]) * hot) * fade;
        col[i * 3 + 2] = (base[i * 3 + 2] + (1 - base[i * 3 + 2]) * hot) * fade;
        size[i] = size0[i] * (k < 0.08 ? 0.6 + k * 5 : 1);
      }
      points.visible = alive > 0 || pending.length > 0;
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
    get alive() { return alive; },
  };
}

// ------------------------------------------------------------------ el escenario

const beamVertex = `
  varying vec3 vN; varying vec3 vV; varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vA = uv.y;
    gl_Position = projectionMatrix * mv;
  }`;
const beamFragment = `
  uniform vec3 uColor; uniform float uI;
  varying vec3 vN; varying vec3 vV; varying float vA;
  void main() {
    float e = abs(dot(normalize(vN), normalize(vV)));
    float a = uI * e * e * pow(vA, 1.6) * 0.6;
    gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
  }`;
const laserFragment = `
  uniform vec3 uColor; uniform float uI;
  varying vec2 vUv;
  void main() {
    float x = (vUv.x - 0.5) * 2.0;
    float core = exp(-x * x * 18.0) + 0.3 * exp(-x * x * 3.0);
    float along = smoothstep(0.0, 0.03, vUv.y) * pow(1.0 - vUv.y, 0.9);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), exp(-x * x * 45.0) * 0.55), clamp(uI * core * along, 0.0, 1.0));
  }`;
const uvVertex = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const pillarFragment = `
  uniform vec3 c1; uniform vec3 c2; uniform float uLevel; uniform float uPeak; uniform float uPow;
  varying vec2 vUv;
  void main() {
    float n = 26.0;
    float seg = floor(vUv.y * n);
    float f = fract(vUv.y * n);
    float cell = step(0.2, f) * step(f, 0.9) * step(0.14, vUv.x) * step(vUv.x, 0.86);
    float y = (seg + 0.5) / n;
    float on = max(step(y, uLevel), step(abs(y - uPeak), 0.6 / n));
    vec3 col = mix(c1, c2, y);
    col = mix(col, vec3(1.0), smoothstep(0.82, 1.0, y) * 0.6);
    gl_FragColor = vec4(col, cell * uPow * (0.06 + 0.94 * on));
  }`;

function trussGeometry() {
  const v = [];
  const seg = (x1, y1, x2, y2) => v.push(x1, y1, 0, x2, y2, 0);
  const x0 = -W - D, x1 = W + D, top = TOP + D;
  seg(x0, TOP, x1, TOP);
  seg(x0, top, x1, top);
  let k = 0;
  for (let x = x0; x < x1 - 1e-6; x += D, k++) seg(x, k % 2 ? TOP : top, Math.min(x1, x + D), k % 2 ? top : TOP);
  for (const sx of [-1, 1]) {
    const a = sx * W, b = sx * (W + D);
    seg(a, FLOOR, a, TOP);
    seg(b, FLOOR, b, top);
    seg(a, FLOOR, b, FLOOR);
    k = 0;
    for (let y = FLOOR; y < TOP - 1e-6; y += D, k++) seg(k % 2 ? a : b, y, k % 2 ? b : a, Math.min(TOP, y + D));
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
}

// Láser: dos cintas cruzadas a lo largo de +z (largo 1), para que se vea desde cualquier lado.
function laserGeometry(w) {
  const p = [], uv = [], idx = [];
  const quad = (ax, ay, bx, by) => {
    const o = p.length / 3;
    p.push(ax, ay, 0, bx, by, 0, ax, ay, 1, bx, by, 1);
    uv.push(0, 0, 1, 0, 0, 1, 1, 1);
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  };
  quad(-w / 2, 0, w / 2, 0);
  quad(0, -w / 2, 0, w / 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function createEscenario({ fx } = {}) {
  const root = new THREE.Group();
  root.name = 'escenario';
  const look = { color: new THREE.Color('#ff4a1c'), color2: new THREE.Color('#ffffff'), estilo: ESTILOS.proyector, title: null };
  const white = new THREE.Color('#ffffff');
  const tmpC = new THREE.Color();
  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const fwdZ = new THREE.Vector3(0, 0, 1);
  const camLocal = new THREE.Vector3();
  const camWorld = new THREE.Vector3();

  // Truss.
  const trussMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
  const truss = new THREE.LineSegments(trussGeometry(), trussMat);
  truss.renderOrder = 2;
  root.add(truss);

  // Focos y haces.
  const glow = glowTexture();
  const boxGeo = new THREE.BoxGeometry(0.07, 0.09, 0.07);
  const boxMat = new THREE.MeshBasicMaterial({ color: '#1b1b1b' });
  const coneGeo = new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0);
  const beams = [];
  for (let k = 0; k < N_BEAMS; k++) {
    const x = -W + 0.2 + (k * (2 * W - 0.4)) / (N_BEAMS - 1);
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(x, TOP - 0.05, 0.04);
    const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffffff', transparent: true, depthWrite: false, blending: ADD, opacity: 0 }));
    lens.position.set(x, TOP - 0.1, 0.08);
    lens.scale.setScalar(0.2);
    lens.renderOrder = 6;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uI: { value: 0 } },
      vertexShader: beamVertex, fragmentShader: beamFragment,
      transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(coneGeo, mat);
    beam.position.set(x, TOP - 0.1, 0.06);
    beam.renderOrder = 4;
    beam.frustumCulled = false;
    root.add(box, beam, lens);
    // orden de encendido: del centro hacia afuera
    beams.push({ box, lens, beam, mat, pan: 0, tilt: 0.1, order: Math.abs(k - (N_BEAMS - 1) / 2), i: 0 });
  }

  // Luces cinéticas sobre la banda.
  const KC = 9, KR = 2;
  const kinetic = [];
  const stringPos = new Float32Array(KC * KR * 6);
  const stringCol = new Float32Array(KC * KR * 6);
  const strings = new THREE.LineSegments(
    new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(stringPos, 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('color', new THREE.BufferAttribute(stringCol, 3)),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: ADD }),
  );
  strings.frustumCulled = false;
  root.add(strings);
  for (let r = 0; r < KR; r++) {
    for (let c = 0; c < KC; c++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: ADD, opacity: 0 }));
      s.scale.setScalar(0.13);
      s.position.set(-W + 0.15 + (c * (2 * W - 0.3)) / (KC - 1), TOP + 0.6, -0.35 - r * 0.45);
      s.renderOrder = 3;
      root.add(s);
      const n = kinetic.length;
      stringCol.set([0, 0, 0, 0.22, 0.21, 0.2], n * 6);
      kinetic.push({ s, c, r });
    }
  }

  // Columnas LED.
  const pillars = [-1, 1].map((sx) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, uLevel: { value: 0 }, uPeak: { value: 0 }, uPow: { value: 0 } },
      vertexShader: uvVertex, fragmentShader: pillarFragment,
      transparent: true, depthWrite: false, blending: ADD,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, TOP - FLOOR - 0.1), mat);
    m.position.set(sx * (W + D / 2), (TOP + FLOOR) / 2, 0.03);
    m.renderOrder = 5;
    root.add(m);
    return { m, mat, level: 0, peak: 0 };
  });

  // Candilejas.
  const foot = [];
  for (let k = 0; k < 9; k++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: ADD, opacity: 0 }));
    s.position.set(-W + 0.12 + (k * (2 * W - 0.24)) / 8, FLOOR + 0.03, 0.25);
    s.scale.set(0.16, 0.08, 1);
    s.renderOrder = 5;
    root.add(s);
    foot.push(s);
  }

  // Humo bajo.
  const hazeTex = hazeTexture();
  const haze = [0, 1, 2].map((k) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: hazeTex, transparent: true, depthWrite: false, blending: ADD, opacity: 0 }));
    s.scale.set(2.6, 0.55, 1);
    s.position.set((k - 1) * 0.9, FLOOR + 0.12, -0.4 - k * 0.1);
    s.renderOrder = 1;
    root.add(s);
    return s;
  });

  // Láseres.
  const laserGeo = laserGeometry(0.035);
  const lasers = [];
  for (let k = 0; k < N_LASERS; k++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uI: { value: 0 } },
      vertexShader: uvVertex, fragmentShader: laserFragment,
      transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(laserGeo, mat);
    m.position.set(0, TOP + 0.02, 0.1);
    m.frustumCulled = false;
    m.renderOrder = 7;
    m.visible = false;
    root.add(m);
    lasers.push({ m, mat });
  }

  // Ondas desde la banda.
  const ringGeo = new THREE.RingGeometry(0.95, 1, 72);
  const rings = [0, 1, 2, 3, 4, 5].map(() => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: ADD, side: THREE.DoubleSide, opacity: 0 }));
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 6;
    m.userData.t0 = -1;
    root.add(m);
    return m;
  });

  // Nombre de la banda (unos segundos al encender o cambiar).
  const title = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
  title.position.set(0, TOP + 0.85, 0.05);
  title.renderOrder = 8;
  title.visible = false;
  root.add(title);

  let ghost = true;
  let onAt = -1;        // s en que se encendió
  let offAt = -1;       // s en que empezó el apagón (cambio de banda)
  let pendingLook = null;
  let titleAt = -1;
  let flash = 0;        // destello de cada golpe
  let pattern = 'quieto';
  let lasersOn = 0;
  let laserPattern = 0;
  let low = false;
  let nowS = 0;

  function applyLook(l) {
    look.color.set(l.color || '#ff4a1c');
    look.color2.set(l.color2 || '#ffffff');
    look.estilo = ESTILOS[l.estilo] || ESTILOS.proyector;
    look.title = l.title || null;
    pillars.forEach((p) => { p.mat.uniforms.c1.value.copy(look.color); p.mat.uniforms.c2.value.copy(look.color2); });
    kinetic.forEach((k) => { k.s.material.color.copy(look.color).lerp(look.color2, k.c / (KC - 1)); });
    foot.forEach((s) => s.material.color.copy(look.color2));
    haze.forEach((s) => s.material.color.copy(look.color).lerp(white, 0.3));
    rings.forEach((m) => m.material.color.copy(look.color).lerp(white, 0.25));
    if (look.title && look.title.image) {
      const img = look.title.image;
      const aspect = img.width / img.height || 4;
      let w = 1.8, hh = w / aspect;
      if (hh > 0.5) { hh = 0.5; w = hh * aspect; }
      title.userData.w = w;
      title.userData.h = hh;
      title.scale.set(w, hh, 1);
      title.material.map = look.title;
      title.material.needsUpdate = true;
    }
  }
  function powerOn() {
    onAt = nowS;
    titleAt = look.title ? nowS + 0.5 : -1;
  }

  function updateBeams(s, dt, r) {
    const est = look.estilo;
    const phrase = Math.floor(r.beats / 16);
    let want = r.hype < 0.3 ? 'quieto' : est.haz[phrase % est.haz.length];
    if (r.hype > 0.78 && phrase % 2 === 1) want = 'publico';
    pattern = want;
    const fn = PATRONES[pattern];
    const speed = s * (0.6 + r.hype * 0.9);
    const k = 1 - Math.exp(-dt * 3.5);
    const chase = r.hype > 0.5;
    let sum = 0;
    beams.forEach((b, i) => {
      const [pan, tilt] = fn(i, N_BEAMS, speed);
      b.pan += (pan - b.pan) * k;
      b.tilt += (Math.min(1.12, tilt) - b.tilt) * k;
      const d = v3.set(Math.sin(b.pan), -Math.cos(b.pan) * Math.cos(b.tilt), Math.cos(b.pan) * Math.sin(b.tilt)).normalize();
      b.beam.quaternion.setFromUnitVectors(down, d);
      const len = 3 + 2.2 * Math.min(1, Math.max(0, (b.tilt - 0.5) / 0.5));
      const wide = est.ancho * 0.22 * (0.8 + 0.4 * r.hype);
      b.beam.scale.set(wide * len / 3, len, wide * len / 3);
      // encendido luz por luz, con un golpe de luz al prender
      const since = onAt < 0 ? -1 : s - onAt - b.order * 0.12;
      const p = since < 0 ? 0 : Math.min(1, since / 0.06);
      const kick = since < 0 ? 0 : Math.exp(-since * 4) * 1.4;
      const off = offAt >= 0 ? Math.max(0, 1 - (s - offAt) / 0.35) : 1;
      const on = (chase ? ((r.beats + i) % 2 === 0 ? 1 : 0.3) : 1);
      const base = 0.2 + 0.45 * r.energy * (0.55 + 0.45 * r.hype);
      b.i = p * off * (base + flash * on * (0.5 + 0.5 * r.hype) + kick);
      b.mat.uniforms.uI.value = b.i;
      const c = b.mat.uniforms.uColor.value.copy(est.dos && r.hype > 0.55 && i % 2 ? look.color2 : look.color);
      c.lerp(white, Math.min(0.6, flash * 0.45 * r.hype + kick * 0.3));
      b.lens.material.color.copy(c);
      b.lens.material.opacity = Math.min(1, p * off * (0.35 + b.i * 0.8));
      b.lens.scale.setScalar(0.16 + b.i * 0.08);
      b.beam.visible = b.i > 0.01;
      sum += b.i;
    });
    return sum / N_BEAMS;
  }

  function updateLasers(s, dt, r) {
    const est = look.estilo;
    const want = r.hype > est.laser && onAt >= 0 && offAt < 0 ? 1 : 0;
    lasersOn += (want - lasersOn) * (1 - Math.exp(-dt * (want ? 2.5 : 4)));
    const visible = lasersOn > 0.02;
    if (r.beat && r.beats % 16 === 0) laserPattern++;
    const n = low ? 5 : N_LASERS;
    const strobe = r.hype > 0.88 ? (r.sinceBeat < 0.12 ? 1 : 0.2) : 1;
    lasers.forEach((l, k) => {
      l.m.visible = visible && k < n;
      if (!l.m.visible) return;
      const sp = s * (0.7 + r.hype * 0.6);
      // destino cerca de quien mira, en coordenadas del escenario
      if (laserPattern % 2 === 0) {
        // abanico sobre las cabezas
        v3.set(camLocal.x + (k - (n - 1) / 2) * (7 / n) + Math.sin(sp * 0.8) * 1.1, camLocal.y + 1.5 + 0.5 * Math.sin(sp * 1.3 + k * 0.4), camLocal.z + 1.5);
      } else {
        // túnel alrededor de quien mira
        const a = sp * 1.1 + (k / n) * Math.PI * 2;
        v3.set(camLocal.x + Math.cos(a) * 1.7, camLocal.y + 0.25 + Math.sin(a) * 1.7, camLocal.z + 1.2);
      }
      v3b.copy(v3).sub(l.m.position);
      const len = v3b.length();
      l.m.quaternion.setFromUnitVectors(fwdZ, v3b.divideScalar(len));
      l.m.scale.set(1, 1, len);
      l.mat.uniforms.uColor.value.copy(k % 2 && look.estilo.dos ? look.color2 : look.color);
      l.mat.uniforms.uI.value = lasersOn * strobe * (0.65 + 0.35 * flash);
    });
  }

  function spawnRing(s) {
    const m = rings.find((x) => x.userData.t0 < 0) || rings.reduce((a, b) => (a.userData.t0 < b.userData.t0 ? a : b));
    m.userData.t0 = s;
    m.visible = true;
  }

  return {
    group: root,
    get ghost() { return ghost; },
    get pattern() { return pattern; },
    get lasers() { return lasersOn; },
    set low(v) { low = v; haze.forEach((h) => { h.visible = !v; }); },
    // Apuntando (solo el contorno) o encendido.
    setGhost(v) {
      if (v === ghost) return;
      ghost = v;
      if (v) { onAt = -1; offAt = -1; titleAt = -1; } else powerOn();
    },
    // Colores, estilo y nombre de la banda. Con `animate`, apagón y se vuelve a encender.
    setLook(l, animate) {
      if (animate && !ghost && onAt >= 0) {
        pendingLook = l;
        offAt = nowS;
        return;
      }
      applyLook(l);
      if (!ghost) powerOn();
    },
    // Fuego artificial hacia un punto del escenario (coordenadas locales).
    launch(local) {
      if (!fx) return;
      const to = root.localToWorld(v3.copy(local)).clone();
      const from = root.localToWorld(v3.set(local.x * 0.7, FLOOR, 0.15)).clone();
      fx.firework(from, to, ['#' + look.color.getHexString(), '#' + look.color2.getHexString(), '#ffffff'], root.scale.x);
    },
    update(t, dt, r, camera) {
      const s = t / 1000;
      nowS = s;
      root.updateMatrixWorld();
      camera.getWorldPosition(camWorld);
      camLocal.copy(camWorld);
      root.worldToLocal(camLocal);
      if (r.beat) flash = Math.max(flash, r.strength);
      flash *= Math.exp(-dt * 7);

      // Apuntando: solo el truss blanco.
      const on = !ghost;
      truss.material.color.set(on ? '#8d8781' : '#ffffff');
      truss.material.opacity = on ? 0.5 + 0.2 * flash : 0.55 + 0.15 * Math.sin(s * 4);
      for (const b of beams) b.box.visible = on;
      // Cambio de banda: tras el apagón, la nueva se enciende.
      if (offAt >= 0 && s - offAt > 0.45 && pendingLook) {
        applyLook(pendingLook);
        pendingLook = null;
        offAt = -1;
        powerOn();
      }
      const off = offAt >= 0 ? Math.max(0, 1 - (s - offAt) / 0.35) : 1;
      let avg = 0;
      if (on) avg = updateBeams(s, dt, r);
      else beams.forEach((b) => { b.beam.visible = false; b.lens.material.opacity = 0; });

      const up = onAt < 0 ? 0 : ease((s - onAt - 0.2) / 1.4);
      const live = on ? up * off : 0;

      // Luces cinéticas: bajan al encender y ondulan con la música.
      const amp = 0.12 + 0.3 * r.hype;
      kinetic.forEach((k, n) => {
        const y = TOP + 0.62 + (1 - up) * 1.1 + amp * Math.sin(s * (0.7 + r.hype * 0.8) + k.c * 0.55 + k.r * 1.3);
        k.s.position.y = y;
        k.s.visible = live > 0.01;
        k.s.material.opacity = live * (0.35 + 0.45 * r.energy + 0.4 * flash * ((k.c + r.beats) % 3 === 0 ? 1 : 0.3));
        k.s.scale.setScalar(0.11 + 0.05 * flash);
        const o = n * 6;
        stringPos[o] = k.s.position.x; stringPos[o + 1] = TOP + 2.2; stringPos[o + 2] = k.s.position.z;
        stringPos[o + 3] = k.s.position.x; stringPos[o + 4] = y; stringPos[o + 5] = k.s.position.z;
      });
      strings.geometry.attributes.position.needsUpdate = true;
      strings.visible = live > 0.01;
      strings.material.opacity = live;

      // Columnas LED: graves (izquierda) y agudos (derecha).
      const vals = [Math.min(1, r.bass * 1.2 + flash * 0.3) * (0.4 + 0.6 * r.energy), Math.min(1, r.high * 1.3 + flash * 0.15)];
      pillars.forEach((p, i) => {
        const v = vals[i] * up;
        p.level += (v - p.level) * (v > p.level ? 0.5 : 0.12);
        p.peak = Math.max(p.peak - dt * 0.35, p.level);
        p.mat.uniforms.uLevel.value = p.level;
        p.mat.uniforms.uPeak.value = p.peak;
        p.mat.uniforms.uPow.value = live;
        p.m.visible = live > 0.01;
      });

      // Candilejas y humo.
      foot.forEach((f, k) => {
        f.visible = live > 0.01;
        f.material.opacity = live * (0.2 + 0.45 * (0.5 + 0.5 * Math.sin(s * 3 + k * 0.8)) * r.hype + 0.5 * flash);
      });
      haze.forEach((hz, k) => {
        hz.visible = !low && live > 0.01;
        hz.position.x = (k - 1) * 0.9 + Math.sin(s * 0.15 + k * 2) * 0.25;
        hz.material.opacity = live * (0.03 + 0.12 * avg);
      });

      updateLasers(s, dt, r);

      // Ondas: viajan desde la banda hasta quien mira.
      if (r.beat && live > 0.5 && (r.hype > look.estilo.ondas) && (look.estilo.ondas === 0 || r.beats % 2 === 0)) spawnRing(s);
      rings.forEach((m) => {
        if (m.userData.t0 < 0) return;
        const p = (s - m.userData.t0) / 1.5;
        if (p >= 1) { m.userData.t0 = -1; m.visible = false; return; }
        const e = Math.pow(p, 1.25);
        m.position.set(camLocal.x * e * 0.9, 0.15 + (camLocal.y - 0.15) * e * 0.9, camLocal.z * e * 0.9);
        m.scale.setScalar(0.45 + e * 2.6);
        m.lookAt(camWorld);
        m.material.opacity = 0.55 * Math.pow(1 - p, 1.4);
      });

      // Chispas en las esquinas en lo más fuerte.
      if (fx && r.beat && live > 0.8 && r.hype > look.estilo.chispas) {
        const sc = root.scale.x;
        for (const sx of [-1, 1]) {
          for (let n = 0; n < 22; n++) {
            v3.set(sx * (W - 0.12), FLOOR + 0.02, 0.15);
            root.localToWorld(v3);
            v3b.set((Math.random() - 0.5) * 0.5, 2.8 + Math.random() * 1.3, (Math.random() - 0.2) * 0.5).applyQuaternion(root.quaternion).multiplyScalar(sc);
            tmpC.copy(n % 3 ? look.color : white);
            fx.emit(v3.x, v3.y, v3.z, v3b.x, v3b.y, v3b.z, tmpC, 0.7 + Math.random() * 0.4, 0.045 * sc, -6 * sc, 0.6);
          }
        }
      }

      // Nombre de la banda: aparece con parpadeo, se queda y se disuelve.
      if (titleAt >= 0 && look.title) {
        const p = s - titleAt;
        let a = 0;
        if (p > 0 && p < 3.6) {
          a = p < 0.3 ? (Math.sin(p * 60) > 0 ? 1 : 0.2) : p < 2.8 ? 1 : 1 - (p - 2.8) / 0.8;
          title.position.y = TOP + 0.85 + Math.max(0, p - 2.8) * 0.18;
          const k = 1 + Math.max(0, p - 2.8) * 0.12;
          title.scale.set(title.userData.w * k, title.userData.h * k, 1);
        }
        if (p >= 3.6) titleAt = -1;
        title.visible = a > 0.01;
        title.material.opacity = a * off;
      } else title.visible = false;
    },
  };
}
