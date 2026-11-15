/*
 * POLEA · Primer vuelo — AR para la tocata.
 *
 * En vez de un objeto grande delante (que tapa el show), un CARTEL SOBRE EL
 * ESCENARIO: se apunta a la banda, "Fijar aquí", y arriba de ella queda
 * flotando su cinta del afiche, con "EN VIVO", su @ y botones de Instagram,
 * Spotify y SoundCloud que se pueden tocar. Las reacciones suben desde la
 * banda y, con el micrófono, todo late con la música. Mirando hacia abajo
 * aparece el line-up completo.
 *
 * Usa la cámara + giroscopio (../ar/sessions.js): no necesita ver el piso ni
 * luz, así que funciona en una sala oscura. Como el escenario está lejos,
 * basta con seguir los giros del celular: el cartel queda sobre la banda.
 *
 * Quién toca sale del horario (config.js); si hay atrasos, en la ficha de
 * cada banda: "Está tocando ahora".
 */
import * as THREE from '../vendor/three.min.js';
import { startWindow, requestMotionPermission } from '../ar/sessions.js';
import { pulse } from '../ar/audio.js';

const P = window.POLEA_CONFIG;
const BANDS = P.bandas;
const PARAMS = new URLSearchParams(location.search);
const PREVIEW = PARAMS.has('preview');
const $ = (s) => document.querySelector(s);
const ORANGE = '#ff4a1c';
const INK = '#f4f1ea';

const UA = navigator.userAgent;
const IS_MOBILE = (navigator.userAgentData && navigator.userAgentData.mobile)
  || /Android|iPhone|iPad|iPod|Mobile/i.test(UA)
  || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

// ------------------------------------------------------------------ quién toca

const SOCIAL = {
  instagram: 'Instagram', spotify: 'Spotify', soundcloud: 'SoundCloud', youtube: 'YouTube', bandcamp: 'Bandcamp', tiktok: 'TikTok', web: 'Web',
};
const linksOf = (b) => Object.entries(b.redes || {}).filter(([, u]) => u);
function handleOf(b) {
  const m = /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec((b.redes || {}).instagram || '');
  return m ? '@' + m[1] : '';
}
const toMin = (hhmm) => { const [hh, mm] = String(hhmm).split(':').map(Number); return hh * 60 + (mm || 0); };
function minutesNow() {
  // `?hora=17:30` simula una hora (para probar antes de la tocata).
  if (PARAMS.get('hora')) return toMin(PARAMS.get('hora'));
  const parts = new Intl.DateTimeFormat('es-CL', { timeZone: P.zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t) => +(parts.find((x) => x.type === t) || {}).value;
  return g('hour') * 60 + g('minute');
}
const OVERRIDE_KEY = 'polea:ahora';
function readOverride() {
  try {
    const o = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || 'null');
    if (o && Date.now() - o.t < 4 * 3600e3 && BANDS.some((b) => b.id === o.id)) return o;
  } catch (e) { /* sin almacenamiento */ }
  return null;
}
function setOverride(id) {
  try {
    if (id) localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ id, t: Date.now() }));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch (e) { /* sin almacenamiento */ }
  refresh();
}
// { i: índice, kind: 'live' | 'manual' | 'next' (aún no empieza) | 'after' (terminó) }
function nowState() {
  const o = readOverride();
  if (o) return { i: BANDS.findIndex((b) => b.id === o.id), kind: 'manual' };
  const m = minutesNow();
  const starts = BANDS.map((b) => toMin(b.hora));
  if (m < starts[0]) return { i: 0, kind: 'next' };
  if (m >= toMin(P.termino)) return { i: BANDS.length - 1, kind: 'after' };
  let i = 0;
  starts.forEach((s, k) => { if (m >= s) i = k; });
  return { i, kind: 'live' };
}
const tagText = (s) => {
  const b = BANDS[s.i];
  if (s.kind === 'next') return 'PRIMERO · ' + b.hora;
  if (s.kind === 'after') return 'ÚLTIMA BANDA';
  return '● EN VIVO' + (s.kind === 'live' ? ' · ' + b.hora : '');
};

// ------------------------------------------------------------------ texturas

function canvasTex(w, hgt, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  draw(c.getContext('2d'), w, hgt);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
// Íconos simples y reconocibles, en blanco.
function glyph(g, kind, x, y, s) {
  g.save();
  g.translate(x, y);
  g.strokeStyle = g.fillStyle = INK;
  g.lineWidth = s * 0.09;
  if (kind === 'instagram') {
    roundRect(g, -s / 2, -s / 2, s, s, s * 0.28); g.stroke();
    g.beginPath(); g.arc(0, 0, s * 0.22, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(s * 0.27, -s * 0.27, s * 0.06, 0, Math.PI * 2); g.fill();
  } else if (kind === 'spotify') {
    g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.stroke();
    [[-0.12, 0.34], [0.06, 0.27], [0.22, 0.2]].forEach(([dy, r]) => {
      g.beginPath(); g.arc(0, dy * s + s * 0.36, r * s * 1.4, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    });
  } else if (kind === 'soundcloud') {
    g.beginPath();
    g.arc(-s * 0.08, s * 0.06, s * 0.24, Math.PI * 0.95, Math.PI * 1.9);
    g.arc(s * 0.2, s * 0.08, s * 0.2, Math.PI * 1.4, Math.PI * 0.5);
    g.lineTo(-s * 0.32, s * 0.28);
    g.arc(-s * 0.32, s * 0.12, s * 0.16, Math.PI * 0.5, Math.PI * 1.5);
    g.closePath(); g.fill();
  } else if (kind === 'youtube') {
    roundRect(g, -s / 2, -s * 0.34, s, s * 0.68, s * 0.18); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.moveTo(-s * 0.1, -s * 0.16); g.lineTo(s * 0.2, 0); g.lineTo(-s * 0.1, s * 0.16); g.closePath(); g.fill();
  } else {
    g.beginPath(); g.arc(0, 0, s * 0.42, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(-s * 0.42, 0); g.lineTo(s * 0.42, 0); g.moveTo(0, -s * 0.42); g.lineTo(0, s * 0.42); g.stroke();
  }
  g.restore();
}
const REACTIONS = {
  corazon: 'M50 84C12 58 6 34 22 22C34 12 46 18 50 30C54 18 66 12 78 22C94 34 88 58 50 84Z',
  chispa: 'M50 6Q56 44 94 50Q56 56 50 94Q44 56 6 50Q44 44 50 6Z',
  rayo: 'M58 4L20 56L46 56L38 96L80 40L54 40Z',
};

// ------------------------------------------------------------------ el cartel

// Medidas en unidades del cartel (el grupo se escala ~1,3: 1 unidad ≈ 1,3 m).
const STRIP_H = 0.5;
const STRIP_MAX_W = 1.7;
const DIST = 6.5;      // m hasta el cartel
const LIFT = 1.0;      // m por encima de donde se apunta (la banda)

function createStage(images) {
  const root = new THREE.Group();
  root.name = 'cartel';
  const content = new THREE.Group();
  root.add(content);
  const plane = (w, hh, mat, role) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
    m.userData.role = role;
    return m;
  };
  const basic = (opts) => new THREE.MeshBasicMaterial(Object.assign({ transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts));

  // Brillo naranja detrás de la cinta.
  const glowTex = canvasTex(256, 128, (g, w, hh) => {
    const grad = g.createRadialGradient(w / 2, hh / 2, 4, w / 2, hh / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,90,40,0.85)');
    grad.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, hh);
  });
  const glow = plane(3.4, 1.5, basic({ map: glowTex, blending: THREE.AdditiveBlending, opacity: 0.5 }), 'glow');
  glow.renderOrder = 1;
  content.add(glow);

  // La cinta de la banda (imagen del afiche).
  const strip = plane(1, 1, basic({ map: images[0], depthWrite: false }), 'strip');
  strip.userData.index = 'strip';
  strip.renderOrder = 3;
  content.add(strip);

  // Etiqueta "EN VIVO · 17:00".
  const tag = plane(1.1, 0.17, basic({}), 'tag');
  tag.renderOrder = 4;
  content.add(tag);

  // @ de Instagram.
  const handle = plane(1.8, 0.25, basic({}), 'handle');
  handle.userData.index = 'strip';
  handle.renderOrder = 4;
  content.add(handle);

  // Ecualizador bajo la cinta (late con la música).
  const bars = [];
  const barMat = basic({ color: ORANGE, blending: THREE.AdditiveBlending, opacity: 0.85 });
  for (let k = 0; k < 22; k++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 1), barMat);
    b.renderOrder = 2;
    b.userData = { role: 'bar', phase: Math.random() * 6.28, speed: 0.6 + Math.random() };
    content.add(b);
    bars.push(b);
  }

  // Botones de redes (se tocan) y la próxima banda.
  let chips = [];
  const next = plane(1.6, 0.16, basic({ opacity: 0.85 }), 'next');
  next.renderOrder = 4;
  content.add(next);

  // Íconos de redes que orbitan alrededor del cartel.
  let orbit = [];

  // Reacciones que suben desde la banda.
  const reactionTex = Object.fromEntries(Object.entries(REACTIONS).map(([k, d]) => [k, canvasTex(128, 128, (g) => {
    g.shadowColor = ORANGE;
    g.shadowBlur = 16;
    g.fillStyle = k === 'chispa' ? INK : ORANGE;
    g.scale(1.28, 1.28);
    g.fill(new Path2D(d));
  })]));
  const floating = [];

  let band = -1;
  let switchT = -1;      // cuándo empezó a darse vuelta la cinta (cambio de banda)
  let pendingBand = -1;
  let pendingState = null;
  let ghost = true;      // siguiendo la mira (antes de fijar)
  let pop = 0;           // rebote al fijar
  let opacity = 0.6;

  function layout() {
    const tex = strip.material.map;
    const aspect = tex && tex.image ? tex.image.width / tex.image.height : 4;
    let w = STRIP_H * aspect, hh = STRIP_H;
    if (w > STRIP_MAX_W) { hh *= STRIP_MAX_W / w; w = STRIP_MAX_W; }
    strip.scale.set(w, hh, 1);
    // De abajo hacia arriba: próxima banda, botones, @, ecualizador, cinta, etiqueta.
    const yChips = 0.17;
    const yHandle = 0.44;
    const yStrip = 0.72 + hh / 2;
    strip.position.set(0, yStrip, 0);
    glow.position.set(0, yStrip, -0.05);
    glow.scale.set(w / 2.2 + 0.4, 1, 1);
    tag.position.set(-w / 2 + 0.55, yStrip + hh / 2 + 0.13, 0.01);
    handle.position.set(0, yHandle, 0);
    chips.forEach((c, k) => { c.position.set((k - (chips.length - 1) / 2) * 0.64, yChips, 0.01); });
    next.position.set(0, -0.06, 0);
    bars.forEach((b, k) => { b.position.set((k - (bars.length - 1) / 2) * (w / bars.length), yStrip - hh / 2 - 0.02, -0.02); b.userData.base = yStrip - hh / 2 - 0.02; });
  }

  function applyBand(i, state) {
    band = i;
    const b = BANDS[i];
    strip.material.map = images[i];
    strip.material.needsUpdate = true;
    tag.material.map = canvasTex(520, 80, (g, w, hh) => {
      const live = state.kind === 'live' || state.kind === 'manual';
      g.font = '700 40px "JetBrains Mono", monospace';
      const tw = Math.min(w, g.measureText(tagText(state)).width + 44);
      g.fillStyle = live ? ORANGE : 'rgba(10,10,10,0.75)';
      roundRect(g, 0, 0, tw, hh, 10);
      g.fill();
      g.fillStyle = INK;
      g.textBaseline = 'middle';
      g.fillText(tagText(state), 22, hh / 2 + 2);
    });
    tag.material.needsUpdate = true;
    const at = handleOf(b);
    handle.visible = !!at;
    handle.material.map = canvasTex(1024, 140, (g, w, hh) => {
      g.font = '800 92px Archivo, sans-serif';
      if ('fontStretch' in g) g.fontStretch = 'expanded';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 18;
      g.fillStyle = INK;
      let size = 92;
      while (size > 40 && g.measureText(at).width > w - 40) { size -= 6; g.font = '800 ' + size + 'px Archivo, sans-serif'; }
      g.fillText(at, w / 2, hh / 2);
    });
    handle.material.needsUpdate = true;
    // Botones de redes.
    chips.forEach((c) => { content.remove(c); c.material.map.dispose(); c.material.dispose(); });
    chips = linksOf(b).slice(0, 3).map(([kind, url]) => {
      const m = plane(0.6, 0.183, basic({ map: canvasTex(400, 122, (g, w, hh) => {
        g.fillStyle = 'rgba(8,8,8,0.82)';
        roundRect(g, 3, 3, w - 6, hh - 6, 22);
        g.fill();
        g.strokeStyle = ORANGE;
        g.lineWidth = 5;
        g.stroke();
        glyph(g, kind, 62, hh / 2, 58);
        g.fillStyle = INK;
        g.font = '600 40px "JetBrains Mono", monospace';
        g.textBaseline = 'middle';
        g.fillText(SOCIAL[kind] || kind, 112, hh / 2 + 2);
      }) }), 'chip');
      m.userData = { role: 'chip', index: 'link:' + url };
      m.renderOrder = 5;
      content.add(m);
      return m;
    });
    // Próxima banda.
    const nb = (state.kind === 'live' || state.kind === 'manual') && i + 1 < BANDS.length ? BANDS[i + 1] : null;
    next.visible = !!nb;
    if (nb) {
      next.material.map = canvasTex(640, 64, (g, w, hh) => {
        g.font = '500 32px "JetBrains Mono", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.shadowColor = 'rgba(0,0,0,0.9)';
        g.shadowBlur = 10;
        g.fillStyle = 'rgba(244,241,234,0.85)';
        g.fillText(('Sigue · ' + nb.nombre + ' ' + nb.hora).toUpperCase(), w / 2, hh / 2);
      });
      next.material.needsUpdate = true;
    }
    // Íconos que orbitan: los de las redes de esta banda.
    orbit.forEach((s) => { content.remove(s); s.material.map.dispose(); s.material.dispose(); });
    orbit = linksOf(b).slice(0, 3).map(([kind], k) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => glyph(g, kind, 64, 64, 80)), transparent: true, depthWrite: false, opacity: 0.9 }));
      s.scale.setScalar(0.2);
      s.renderOrder = 6;
      s.userData = { a: (k / 3) * Math.PI * 2 };
      content.add(s);
      return s;
    });
    layout();
  }

  return {
    group: root,
    // Lo que se puede tocar (lo invisible no cuenta).
    get cards() { return [strip, handle, ...chips].filter((m) => m.visible && root.visible); },
    setHeight() {},
    get band() { return band; },
    get ghost() { return ghost; },
    setGhost(v) {
      ghost = v;
      if (!v) pop = 1;
    },
    // Cambia de banda dando vuelta la cinta (sin animación la primera vez).
    setBand(i, state) {
      if (band < 0) { applyBand(i, state); return; }
      pendingBand = i;
      pendingState = state;
      switchT = performance.now();
    },
    react(kind) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: reactionTex[kind] || reactionTex.corazon, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set((Math.random() - 0.5) * 1.6, -0.55, 0.1);
      s.scale.setScalar(0.14 + Math.random() * 0.08);
      s.renderOrder = 7;
      s.userData = { t0: performance.now(), dx: (Math.random() - 0.5) * 0.4 };
      content.add(s);
      floating.push(s);
    },
    update(t, level) {
      const sec = t / 1000;
      // Cambio de banda: la cinta se da vuelta, cambia y vuelve (0,45 s).
      if (switchT >= 0) {
        const p = (performance.now() - switchT) / 450;
        if (p >= 0.5 && pendingBand >= 0) {
          applyBand(pendingBand, pendingState);
          pendingBand = -1;
        }
        strip.rotation.x = p >= 1 ? 0 : (p < 0.5 ? p * 2 : (1 - p) * 2) * (Math.PI / 2);
        if (p >= 1) switchT = -1;
      }
      // Fijar: rebote corto ("se pega" la cinta).
      pop = Math.max(0, pop - 0.05);
      content.scale.setScalar(1 + Math.sin(pop * Math.PI) * 0.12);
      opacity += ((ghost ? 0.55 : 1) - opacity) * 0.15;
      strip.material.opacity = opacity;
      tag.material.opacity = handle.material.opacity = next.material.opacity = opacity;
      chips.forEach((c) => { c.material.opacity = opacity; });
      glow.material.opacity = (0.28 + level * 0.55) * opacity;
      glow.scale.y = 1 + level * 0.35;
      content.position.y = Math.sin(sec * 0.8) * 0.02;
      bars.forEach((b) => {
        const v = 0.04 + level * 0.32 * (0.55 + 0.45 * Math.sin(sec * 7 * b.userData.speed + b.userData.phase));
        b.scale.y = v;
        b.position.y = b.userData.base - v / 2;
        b.material.opacity = 0.85 * opacity;
      });
      orbit.forEach((o, k) => {
        const a = o.userData.a + sec * 0.35;
        // Solo a los lados de la cinta (no sobre el @ ni los botones).
        o.position.set(Math.cos(a) * 1.25, strip.position.y + Math.sin(a) * 0.22, Math.sin(a) * 0.3);
        o.material.opacity = 0.75 * opacity;
        o.scale.setScalar(0.18 + level * 0.06 + (k === 0 ? 0.02 : 0));
      });
      const now = performance.now();
      for (let n = floating.length - 1; n >= 0; n--) {
        const r = floating[n];
        const life = (now - r.userData.t0) / 2800;
        if (life >= 1) { content.remove(r); r.material.dispose(); floating.splice(n, 1); continue; }
        r.position.y = -0.55 + life * 2.4;
        r.position.x += r.userData.dx * 0.004;
        r.material.opacity = life < 0.1 ? life * 10 : 1 - (life - 0.1) / 0.9;
      }
    },
  };
}

// ------------------------------------------------------------------ line-up a los pies

// Mirando hacia abajo: las seis cintas con su hora, la que toca destacada.
function createShelf(images) {
  const g = new THREE.Group();
  g.name = 'lineup';
  const rows = BANDS.map((b, i) => {
    const row = new THREE.Group();
    const tex = images[i];
    const aspect = tex.image ? tex.image.width / tex.image.height : 4;
    const hh = 0.075, w = Math.min(0.36, hh * aspect);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    strip.position.x = -0.08 + w / 2;
    strip.userData = { role: 'shelf', index: 'band:' + i };
    const time = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), new THREE.MeshBasicMaterial({ map: canvasTex(256, 80, (c, cw, ch) => {
      c.font = '700 46px "JetBrains Mono", monospace';
      c.fillStyle = ORANGE;
      c.textBaseline = 'middle';
      c.textAlign = 'right';
      c.fillText(b.hora, cw - 8, ch / 2);
    }), transparent: true, depthWrite: false }));
    time.position.x = -0.2;
    row.add(strip, time);
    row.position.y = 0.26 - i * 0.095;
    row.userData = { strip, time };
    g.add(row);
    return row;
  });
  g.visible = false;
  let live = -1;
  return {
    group: g,
    get cards() { return g.visible ? rows.map((r) => r.userData.strip) : []; },
    setLive(i) { live = i; },
    update(camera) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
      const show = pitch < -0.45;
      g.visible = show || g.userData.fade > 0.02;
      g.userData.fade = (g.userData.fade || 0) + ((show ? 1 : 0) - (g.userData.fade || 0)) * 0.2;
      if (!g.visible) return;
      const yaw = Math.atan2(-fwd.x, -fwd.z);
      g.position.set(-Math.sin(yaw) * 1.05, -0.95, -Math.cos(yaw) * 1.05);
      g.rotation.set(-0.55, yaw, 0, 'YXZ');
      rows.forEach((r, i) => {
        const on = i === live;
        r.userData.strip.material.opacity = (on ? 1 : 0.55) * g.userData.fade;
        r.userData.time.material.opacity = (on ? 1 : 0.6) * g.userData.fade;
        r.scale.setScalar(on ? 1.12 : 1);
        r.position.x = on ? -0.02 : 0;
      });
    },
  };
}

// ------------------------------------------------------------------ experiencia

const canvas = document.createElement('canvas');
canvas.className = 'xr__canvas';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const xrRoot = $('#xr');
const video = $('#xr-video');
const sheet = $('#sheet');
let images = [];
let stage = null;
let shelf = null;
let session = null;
let entering = false;
let state = nowState();
let toastTimer = 0;
let hintTimer = 0;
let idleTimer = 0;
let fixed = false;
let lastKey = '';

const aim = new THREE.Vector3(0, 0, -DIST);
const target = new THREE.Vector3();
const fwd = new THREE.Vector3();

function toast(text) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.textContent = text;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function hint(text, ms) {
  const el = $('#hint');
  clearTimeout(hintTimer);
  el.textContent = text || '';
  el.hidden = !text;
  if (text && ms) hintTimer = setTimeout(() => { el.hidden = true; }, ms);
}
function wake() {
  xrRoot.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (sheet.hidden && fixed) xrRoot.classList.add('is-idle'); }, 4000);
}

// Apuntar o fijar el cartel.
function setFixed(v) {
  fixed = v;
  if (stage) stage.setGhost(!v);
  $('#fix').hidden = v;
  $('#aim').hidden = v;
  if (v) {
    hint('Toca el cartel para ver sus redes', 3500);
    if (navigator.vibrate) navigator.vibrate(30);
  } else {
    hint('Apunta a la banda');
  }
  wake();
}

let firstFrame = true;
const ctx = {
  renderer, scene, canvas,
  get holo() { return stageHolo; },
  overlayRoot: xrRoot,
  onTick() {},
  onFrame(t, camera) {
    camera.getWorldDirection(fwd);
    if (!fixed) {
      target.copy(fwd).multiplyScalar(DIST);
      if (firstFrame) aim.copy(target);
      else aim.lerp(target, 0.2);
      firstFrame = false;
    }
    const root = stage.group;
    root.position.copy(aim);
    root.position.y += LIFT;
    // Siempre de frente a quien mira (solo gira en el eje vertical).
    root.rotation.set(0, Math.atan2(-root.position.x, -root.position.z), 0);
    const level = pulse.micOn ? pulse.sample(t) : 0.12 + 0.06 * Math.sin(t / 900);
    stage.update(t, level);
    shelf.update(camera);
  },
  onTap(index) {
    wake();
    if (typeof index === 'string') {
      if (index.startsWith('link:')) { openLink(index.slice(5)); return; }
      if (index.startsWith('band:')) { openBand(+index.slice(5)); return; }
      if (index === 'strip') { openBand(stage.band); return; }
    }
    if (!sheet.hidden) { closeSheet(); return; }
    // Tocar la pantalla mientras se apunta también fija el cartel.
    if (!fixed) setFixed(true);
  },
  onLook(kind) {
    if (kind === 'drag') hint('Arrastra para mirar alrededor', 3000);
  },
  onCameraLost() { toast('No se pudo reabrir la cámara'); },
  onEnd() {
    session = null;
    closeSheet();
    xrRoot.hidden = true;
    xrRoot.classList.remove('is-rec', 'is-idle');
    document.body.classList.remove('is-xr');
    $('#launch').hidden = false;
    renderLaunch();
  },
};
// startWindow espera un "holo" con group, cards y setHeight: el cartel y el line-up.
const stageHolo = {
  get group() { return stage.group; },
  get cards() { return [...stage.cards, ...shelf.cards]; },
  setHeight() {},
};

function openLink(url) {
  window.open(url, '_blank', 'noopener');
}

async function enter() {
  if (session || entering || !stage) return;
  entering = true;
  const motion = requestMotionPermission(); // iPhone: dentro del toque
  $('#launch').hidden = true;
  xrRoot.hidden = false;
  document.body.classList.add('is-xr');
  video.after(canvas);
  firstFrame = true;
  setFixed(false);
  try {
    await motion;
    scene.add(shelf.group);
    try {
      session = await startWindow(ctx, { video, useCamera: true });
    } catch (e) {
      session = await startWindow(ctx, { video, useCamera: false });
      toast('Sin cámara: se ve sobre fondo oscuro');
    }
  } finally {
    entering = false;
  }
  refresh();
  wake();
}

// ------------------------------------------------------------------ fichas

function closeSheet() {
  for (const el of [sheet, $('#launch-sheet')]) {
    el.hidden = true;
    el.replaceChildren();
  }
}
// Ficha de una banda: cinta, hora, redes y "está tocando ahora".
function openBand(i, where) {
  const b = BANDS[i];
  if (!b) return;
  const el = where || sheet;
  const s = nowState();
  const playing = s.i === i && (s.kind === 'live' || s.kind === 'manual');
  el.replaceChildren(...[
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('img', { class: 'sheet__strip', src: b.cinta, alt: b.nombre }),
    h('p', { class: 'sheet__meta' }, playing ? h('strong', { text: '● En vivo' }) : null, (playing ? ' · ' : '') + b.hora + ' hrs'),
    h('div', { class: 'sheet__links' }, linksOf(b).map(([k, url]) => h('a', { class: 'sheet__link sheet__link--' + k, href: url, target: '_blank', rel: 'noopener' },
      k === 'instagram' && handleOf(b) ? handleOf(b) : SOCIAL[k] || k))),
    playing && s.kind === 'manual'
      ? h('button', { class: 'sheet__btn', type: 'button', text: 'Volver al horario', onclick: () => { setOverride(null); closeSheet(); } })
      : !playing && h('button', { class: 'sheet__btn', type: 'button', text: 'Está tocando ahora', onclick: () => { setOverride(b.id); closeSheet(); toast('Ahora: ' + b.nombre); } }),
  ].filter(Boolean)); // lo que no aplica no se muestra
  el.dataset.kind = 'band';
  el.hidden = false;
}
function lineupList(onPick) {
  const s = nowState();
  return h('ol', { class: 'lineup' }, BANDS.map((b, i) => h('li', null, h('button', { class: 'lineup__row' + (i === s.i && s.kind !== 'next' ? ' is-now' : ''), type: 'button', onclick: () => onPick(i) },
    h('span', { class: 'lineup__time', text: b.hora }),
    h('img', { class: 'lineup__strip', src: b.cinta, alt: b.nombre }),
    i === s.i && (s.kind === 'live' || s.kind === 'manual') && h('span', { class: 'lineup__now', text: 'Ahora' }),
  ))));
}
function openLineup() {
  sheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    lineupList(openBand),
  );
  sheet.dataset.kind = 'lineup';
  sheet.hidden = false;
}

// ------------------------------------------------------------------ estado

function refresh() {
  state = nowState();
  // Cambió la banda o su estado (por horario o a mano): la cinta se actualiza.
  const key = state.i + ':' + state.kind;
  if (stage && key !== lastKey) stage.setBand(state.i, state);
  lastKey = key;
  if (shelf) shelf.setLive(state.kind === 'next' ? -1 : state.i);
  const b = BANDS[state.i];
  $('#now-name').textContent = b.nombre;
  $('#now-tag').textContent = tagText(state).replace('● ', '');
  $('#now').classList.toggle('is-live', state.kind === 'live' || state.kind === 'manual');
  if (!$('#launch').hidden) renderLaunch();
}

function renderLaunch() {
  $('#lineup-launch').replaceChildren(lineupList((i) => openBand(i, $('#launch-sheet'))));
}

function renderDesktop() {
  if (IS_MOBILE || PREVIEW) return;
  $('#actions').hidden = true;
  $('#desktop').hidden = false;
  if (typeof window.qrcode !== 'function') return;
  const qr = window.qrcode(0, 'M');
  qr.addData(location.href.split('?')[0]);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
  $('#qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path fill="#111" d="' + d + '"/></svg>';
}

function syncMic() {
  $('#mic').setAttribute('aria-pressed', String(pulse.micOn));
  $('#xr-mic').setAttribute('aria-pressed', String(pulse.micOn));
}
async function toggleMic() {
  if (pulse.micOn) pulse.disableMic(true);
  else {
    try { await pulse.enableMic(); } catch (e) { toast('Sin micrófono'); }
  }
  syncMic();
}

function bind() {
  $('#enter').addEventListener('click', enter);
  $('#mic').addEventListener('click', toggleMic);
  $('#xr-mic').addEventListener('click', toggleMic);
  $('#xr-exit').addEventListener('click', () => { if (session) session.end(); });
  $('#fix').addEventListener('click', () => setFixed(true));
  $('#refix').addEventListener('click', () => setFixed(false));
  $('#xr-lineup').addEventListener('click', () => (sheet.hidden || sheet.dataset.kind !== 'lineup' ? openLineup() : closeSheet()));
  $('#now').addEventListener('click', () => openBand(state.i));
  document.querySelectorAll('[data-react]').forEach((b) => {
    b.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + REACTIONS[b.dataset.react] + '"/></svg>';
    b.addEventListener('click', () => {
      if (stage) stage.react(b.dataset.react);
      b.classList.remove('is-pop');
      void b.offsetWidth;
      b.classList.add('is-pop');
      if (navigator.vibrate) navigator.vibrate(12);
    });
  });
  // Modo grabación: sin botones; se vuelve manteniendo presionado.
  $('#xr-rec').addEventListener('click', () => {
    xrRoot.classList.add('is-rec');
    closeSheet();
    toast('Mantén presionado para volver');
  });
  let press = null;
  xrRoot.addEventListener('pointerdown', (e) => {
    wake();
    clearTimeout(press && press.timer);
    if (!xrRoot.classList.contains('is-rec') || !e.isPrimary) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { xrRoot.classList.remove('is-rec'); wake(); }, 700) };
  });
  const cancel = (e) => {
    if (!press) return;
    if (e.type === 'pointermove' && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 12) return;
    clearTimeout(press.timer);
    press = null;
  };
  ['pointermove', 'pointerup', 'pointercancel'].forEach((t) => xrRoot.addEventListener(t, cancel));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pulse.suspend();
    else setTimeout(() => (session && session.resumed ? session.resumed : Promise.resolve()).then(() => pulse.resume()).then(syncMic), 0);
  });
}

function loadImage(src) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; resolve(t); }, undefined, () => resolve(new THREE.Texture()));
  });
}

async function boot() {
  bind();
  syncMic();
  renderDesktop();
  renderLaunch();
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]);
  images = await Promise.all(BANDS.map((b) => loadImage(b.cinta)));
  stage = createStage(images);
  shelf = createShelf(images);
  refresh();
  $('#enter').disabled = false;
  setInterval(refresh, 20000);
  // Sin señal: después de la primera visita abre igual (ver ../sw.js).
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('../sw.js').catch(() => {});
}

window.Polea = {
  get session() { return session; }, get stage() { return stage; }, get shelf() { return shelf; },
  nowState, setOverride, openBand, openLineup, enter, setFixed, renderer,
};

boot();
