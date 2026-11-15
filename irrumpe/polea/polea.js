/*
 * POLEA · Primer vuelo — AR para la tocata: ESCENARIO AUMENTADO.
 *
 * Se apunta al escenario, se encuadra con el contorno del truss y "Fijar
 * aquí": alrededor de la banda (sin taparla) se enciende luz por luz la
 * producción de un festival, que sigue la música en vivo por el micrófono:
 * focos, luces cinéticas, columnas LED, láseres hacia el público, ondas y
 * chispas (../ar/escenario.js). Cada banda tiene sus colores y su estilo
 * (config.js → show).
 *
 *   - Mirando hacia arriba, el techo se abre: cielo nocturno, aurora y
 *     aviones de papel (../ar/cielo.js).
 *   - Mirando hacia abajo, el line-up; tocar una banda la marca como la que
 *     está tocando (si hay atrasos).
 *   - Tocar la pantalla lanza fuegos artificiales (sobre el escenario o en el
 *     cielo).
 *   - Abajo, el botón grande para seguir a la banda en Instagram y sus otras
 *     redes.
 *
 * Usa la cámara + giroscopio (../ar/sessions.js): no necesita ver el piso ni
 * luz, así que funciona en una sala oscura.
 */
import * as THREE from '../vendor/three.min.js';
import { startWindow, requestMotionPermission } from '../ar/sessions.js';
import { pulse } from '../ar/audio.js';
import { createRitmo } from '../ar/ritmo.js';
import { createEscenario, createChispas, glowTexture } from '../ar/escenario.js';
import { createCielo } from '../ar/cielo.js';

const P = window.POLEA_CONFIG;
const BANDS = P.bandas;
const PARAMS = new URLSearchParams(location.search);
const PREVIEW = PARAMS.has('preview');
const $ = (s) => document.querySelector(s);
const ORANGE = '#ff4a1c';
const DIST = 6.5;      // m hasta la banda

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
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
const canVibrate = () => navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive);

// ------------------------------------------------------------------ quién toca

const SOCIAL = {
  instagram: 'Instagram', spotify: 'Spotify', soundcloud: 'SoundCloud', youtube: 'YouTube', bandcamp: 'Bandcamp', tiktok: 'TikTok', web: 'Web',
};
// Íconos reconocibles de cada red (con sus colores).
const ICONS = {
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="ig-g" cx="0.3" cy="1.07" r="1.2"><stop offset="0" stop-color="#fdd574"/><stop offset="0.25" stop-color="#fb7d2b"/><stop offset="0.55" stop-color="#d62976"/><stop offset="0.85" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></radialGradient></defs><rect width="24" height="24" rx="6.5" fill="url(#ig-g)"/><rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="16.3" cy="7.7" r="1.05" fill="#fff"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1ed760"/><path d="M6.2 9.3c3.8-1.1 8-.8 11.5 1.1M6.9 12.6c3.1-.9 6.5-.6 9.3 1M7.5 15.7c2.5-.7 5.1-.5 7.3.8" fill="none" stroke="#111" stroke-width="1.7" stroke-linecap="round"/></svg>',
  soundcloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#ff5500"/><path d="M10 16.2h7.2a2.6 2.6 0 0 0 .3-5.2 3.9 3.9 0 0 0-7.5-1.2z" fill="#fff"/><path d="M5.6 16v-2.6M7.1 16v-4.2M8.6 16v-5.4" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="0.5" y="4.5" width="23" height="15" rx="4.5" fill="#ff0033"/><path d="M10 8.8v6.4l5.4-3.2z" fill="#fff"/></svg>',
  web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#222"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M5.5 12h13M12 5.5c2.2 2 2.2 11 0 13M12 5.5c-2.2 2-2.2 11 0 13" fill="none" stroke="#fff" stroke-width="1.2"/></svg>',
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
function writeOverride(id) {
  try {
    if (id) localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ id, t: Date.now() }));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch (e) { /* sin almacenamiento */ }
}
function setOverride(id) {
  writeOverride(id);
  refresh();
}
// { i: índice, kind: 'live' | 'manual' | 'next' (aún no empieza) | 'after' (terminó) }
function scheduleState() {
  const m = minutesNow();
  const starts = BANDS.map((b) => toMin(b.hora));
  if (m < starts[0]) return { i: 0, kind: 'next' };
  if (m >= toMin(P.termino)) return { i: BANDS.length - 1, kind: 'after' };
  let i = 0;
  starts.forEach((s, k) => { if (m >= s) i = k; });
  return { i, kind: 'live' };
}
function nowState() {
  const o = readOverride();
  if (o) return { i: BANDS.findIndex((b) => b.id === o.id), kind: 'manual' };
  return scheduleState();
}
// Marca a mano quién toca; si es la que dice el horario, vuelve al horario.
function pickBand(i) {
  const s = scheduleState();
  setOverride(s.i === i && s.kind === 'live' ? null : BANDS[i].id);
  toast(BANDS[i].nombre);
}

// ------------------------------------------------------------------ line-up a los pies

// Mirando hacia abajo: las seis cintas del afiche; la que toca, destacada.
function createShelf(images) {
  const g = new THREE.Group();
  g.name = 'lineup';
  const dotMat = new THREE.SpriteMaterial({ map: glowTexture(), color: ORANGE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dot = new THREE.Sprite(dotMat);
  dot.scale.setScalar(0.07);
  g.add(dot);
  const rows = BANDS.map((b, i) => {
    const row = new THREE.Group();
    const tex = images[i];
    const aspect = tex.image ? tex.image.width / tex.image.height : 4;
    const hh = 0.075, w = Math.min(0.4, hh * aspect);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    strip.position.x = -0.2 + w / 2;
    strip.userData = { role: 'shelf', index: 'band:' + i };
    row.add(strip);
    row.position.y = 0.26 - i * 0.095;
    row.userData = { strip };
    g.add(row);
    return row;
  });
  g.visible = false;
  let live = -1;
  let fade = 0;
  const dir = new THREE.Vector3();
  return {
    group: g,
    get cards() { return g.visible ? rows.map((r) => r.userData.strip) : []; },
    get fade() { return fade; },
    setLive(i) { live = i; },
    update(camera, t) {
      camera.getWorldDirection(dir);
      const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      fade += ((pitch < -0.45 ? 1 : 0) - fade) * 0.2;
      g.visible = fade > 0.02;
      if (!g.visible) return;
      const yaw = Math.atan2(-dir.x, -dir.z);
      g.position.set(-Math.sin(yaw) * 1.05, -0.95, -Math.cos(yaw) * 1.05);
      g.rotation.set(-0.55, yaw, 0, 'YXZ');
      rows.forEach((r, i) => {
        const on = i === live;
        r.userData.strip.material.opacity = (on ? 1 : 0.5) * fade;
        r.scale.setScalar(on ? 1.12 : 1);
        r.position.x = on ? 0.02 : 0;
      });
      dot.visible = live >= 0;
      if (live >= 0) {
        dot.position.set(-0.235, rows[live].position.y, 0.01);
        dotMat.opacity = fade * (0.6 + 0.4 * Math.sin(t / 180));
      }
    },
  };
}

// ------------------------------------------------------------------ experiencia

const canvas = document.createElement('canvas');
canvas.className = 'xr__canvas';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
const MAX_RATIO = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(MAX_RATIO);
const scene = new THREE.Scene();
const xrRoot = $('#xr');
const video = $('#xr-video');
const ritmo = createRitmo();
const fx = createChispas();
scene.add(fx.points);
const rig = createEscenario({ fx });
const sky = createCielo();
scene.add(sky.group);
let images = [];
let shelf = null;
let session = null;
let entering = false;
let state = nowState();
let toastTimer = 0;
let hintTimer = 0;
let idleTimer = 0;
let fixed = false;
let lastBand = -1;
let lastT = 0;
let lastFire = 0;
let shownTips = false;

const aim = new THREE.Vector3(0, 0, -DIST);
const target = new THREE.Vector3();
const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();
const normal = new THREE.Vector3();

function toast(text) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.textContent = text;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
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
  idleTimer = setTimeout(() => { if (fixed) xrRoot.classList.add('is-idle'); }, 4500);
}

// Apuntar (encuadrar) o fijar y encender.
function setFixed(v) {
  fixed = v;
  rig.setGhost(!v);
  $('#fix').hidden = v;
  $('#aim').hidden = v;
  $('#follow').hidden = !v;
  if (v) {
    if (!shownTips) hint('Toca la pantalla · mira arriba y abajo', 5000);
    else hint('');
    shownTips = true;
    if (canVibrate()) navigator.vibrate([16, 90, 16, 90, 30]);
  } else {
    hint('Encuadra el escenario');
  }
  wake();
}

// Fuegos artificiales hacia donde se tocó: en el cielo si se mira arriba;
// si no, sobre el escenario (nunca encima de la banda).
function fireAt(ray) {
  const now = performance.now();
  if (now - lastFire < 160 || !ray) return;
  lastFire = now;
  const sh = BANDS[state.i].show || {};
  const colors = [sh.color || ORANGE, sh.color2 || '#ffffff', '#ffffff'];
  if (ray.direction.y > 0.38) {
    const to = ray.at(24, new THREE.Vector3());
    fx.firework(new THREE.Vector3(to.x * 0.8, to.y - 10, to.z * 0.8), to, colors, 3.2);
    return;
  }
  if (ray.direction.y < -0.4) return; // mirando el line-up
  const root = rig.group;
  normal.copy(root.position).negate().setY(0).normalize();
  const denom = ray.direction.dot(normal);
  let p = null;
  if (Math.abs(denom) > 1e-3) {
    const d = tmp.copy(root.position).sub(ray.origin).dot(normal) / denom;
    if (d > 0) p = ray.at(d, new THREE.Vector3());
  }
  if (!p) p = ray.at(DIST, new THREE.Vector3());
  const local = root.worldToLocal(p);
  local.set(Math.max(-2, Math.min(2, local.x)), Math.max(local.y, 1.8 + Math.random() * 0.5), 0);
  rig.launch(local);
}

// Calidad: si el celular no da abasto, menos resolución y luego menos efectos.
let slow = 0;
let quality = PARAMS.has('hd') ? -1 : 2;
function adapt(dt) {
  if (quality <= 0) return;
  slow = dt > 0.028 ? slow + 1 : Math.max(0, slow - 2);
  if (slow < 90) return;
  slow = 0;
  if (quality === 2 && MAX_RATIO > 1) renderer.setPixelRatio(1);
  else rig.low = true;
  quality--;
}

let firstFrame = true;
const ctx = {
  renderer, scene, canvas,
  get holo() { return stageHolo; },
  overlayRoot: xrRoot,
  onTick() {},
  onFrame(t, camera) {
    const dt = Math.min(0.1, Math.max(0.001, (t - (lastT || t - 16)) / 1000));
    lastT = t;
    camera.getWorldDirection(fwd);
    if (!fixed) {
      target.copy(fwd).multiplyScalar(DIST);
      if (firstFrame) aim.copy(target);
      else aim.lerp(target, 0.25);
      firstFrame = false;
    }
    const root = rig.group;
    root.position.copy(aim);
    // De frente a quien mira (solo gira en el eje vertical).
    root.rotation.set(0, Math.atan2(-aim.x, -aim.z), 0);
    const r = ritmo.update(t);
    rig.update(t, dt, r, camera);
    sky.update(t, dt, r, camera, renderer);
    shelf.update(camera, t);
    fx.update(dt, camera, renderer);
    adapt(dt);
  },
  onTap(index, ray) {
    wake();
    if (typeof index === 'string' && index.startsWith('band:')) { pickBand(+index.slice(5)); return; }
    if (!fixed) { setFixed(true); return; }
    fireAt(ray);
  },
  onLook(kind) {
    if (kind === 'drag') hint('Arrastra para mirar alrededor', 3000);
  },
  onCameraLost() { toast('No se pudo reabrir la cámara'); },
  onEnd() {
    session = null;
    xrRoot.hidden = true;
    xrRoot.classList.remove('is-rec', 'is-idle');
    document.body.classList.remove('is-xr');
    $('#launch').hidden = false;
    renderLaunch();
  },
};
// startWindow espera un "holo" con group, cards y setHeight: el escenario y el line-up.
const stageHolo = {
  get group() { return rig.group; },
  get cards() { return shelf ? shelf.cards : []; },
  setHeight() {},
};

// Micrófono: encendido por defecto (las luces siguen la música en vivo).
const MIC_KEY = 'polea:mic';
let wantMic = true;
try { wantMic = localStorage.getItem(MIC_KEY) !== '0'; } catch (e) { /* sin almacenamiento */ }
function saveMic(v) {
  wantMic = v;
  try { localStorage.setItem(MIC_KEY, v ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
}

async function enter() {
  if (session || entering || !shelf) return;
  entering = true;
  const motion = requestMotionPermission(); // iPhone: dentro del toque
  $('#launch').hidden = true;
  closeSheet();
  xrRoot.hidden = false;
  document.body.classList.add('is-xr');
  video.after(canvas);
  firstFrame = true;
  setFixed(false);
  try {
    await motion;
    scene.add(shelf.group);
    let noCamera = false;
    try {
      session = await startWindow(ctx, { video, useCamera: true });
    } catch (e) {
      session = await startWindow(ctx, { video, useCamera: false });
      noCamera = true;
      toast('Sin cámara: se ve sobre fondo oscuro');
    }
    if (wantMic && !pulse.micOn) {
      try { await pulse.enableMic(); } catch (e) { toast(noCamera ? 'Sin cámara ni micrófono' : 'Sin micrófono: luces de demostración'); }
    }
  } finally {
    entering = false;
  }
  syncMic();
  refresh();
  wake();
}

// ------------------------------------------------------------------ redes

function icon(kind) {
  return h('span', { class: 'icon', html: ICONS[kind] || ICONS.web });
}
// El botón para seguir a la banda: grande, aparte del escenario.
function renderFollow(b) {
  const ig = (b.redes || {}).instagram;
  const a = $('#ig');
  a.hidden = !ig;
  if (ig) {
    a.href = ig;
    $('#ig-handle').textContent = handleOf(b) || b.nombre;
    a.setAttribute('aria-label', 'Abrir el Instagram de ' + b.nombre);
  }
  $('#follow-more').replaceChildren(...linksOf(b).filter(([k]) => k !== 'instagram').slice(0, 2).map(([k, url]) => h('a', {
    class: 'follow__icon', href: url, target: '_blank', rel: 'noopener', 'aria-label': (SOCIAL[k] || k) + ' de ' + b.nombre,
  }, icon(k))));
}

// Ficha de una banda (en el lanzador): cinta, redes y "está tocando ahora".
function closeSheet() {
  const el = $('#launch-sheet');
  el.hidden = true;
  el.replaceChildren();
}
function openBand(i) {
  const b = BANDS[i];
  if (!b) return;
  const el = $('#launch-sheet');
  const s = nowState();
  const playing = s.i === i && (s.kind === 'live' || s.kind === 'manual');
  el.replaceChildren(...[
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('img', { class: 'sheet__strip', src: b.cinta, alt: b.nombre }),
    h('div', { class: 'sheet__links' }, linksOf(b).map(([k, url]) => h('a', { class: 'sheet__link', href: url, target: '_blank', rel: 'noopener' },
      icon(k), h('span', { text: k === 'instagram' && handleOf(b) ? handleOf(b) : SOCIAL[k] || k })))),
    playing && s.kind === 'manual'
      ? h('button', { class: 'sheet__btn', type: 'button', text: 'Volver al horario', onclick: () => { setOverride(null); closeSheet(); } })
      : !playing && h('button', { class: 'sheet__btn', type: 'button', text: 'Está tocando ahora', onclick: () => { setOverride(b.id); closeSheet(); } }),
  ].filter(Boolean));
  el.hidden = false;
}
function lineupList() {
  const s = nowState();
  return h('ol', { class: 'lineup' }, BANDS.map((b, i) => h('li', null, h('button', { class: 'lineup__row' + (i === s.i && s.kind !== 'next' ? ' is-now' : ''), type: 'button', onclick: () => openBand(i) },
    h('span', { class: 'lineup__time', text: b.hora }),
    h('img', { class: 'lineup__strip', src: b.cinta, alt: b.nombre }),
    i === s.i && (s.kind === 'live' || s.kind === 'manual') && h('span', { class: 'lineup__now', text: 'Ahora' }),
  ))));
}

// ------------------------------------------------------------------ estado

function applyBand(i, animate) {
  const sh = BANDS[i].show || {};
  rig.setLook({ color: sh.color, color2: sh.color2, estilo: sh.estilo, title: images[i] }, animate);
  sky.setColors(sh.color || ORANGE, sh.color2 || '#ffffff');
}
function refresh() {
  state = nowState();
  // Cambió la banda (por horario o a mano): apagón y se enciende con sus colores.
  if (images.length && state.i !== lastBand) {
    applyBand(state.i, lastBand >= 0);
    lastBand = state.i;
  }
  if (shelf) shelf.setLive(state.kind === 'next' ? -1 : state.i);
  renderFollow(BANDS[state.i]);
  if (!$('#launch').hidden) renderLaunch();
}

function renderLaunch() {
  $('#lineup-launch').replaceChildren(lineupList());
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
  $('#mic').setAttribute('aria-pressed', String(wantMic));
  $('#xr-mic').setAttribute('aria-pressed', String(pulse.micOn));
}
async function toggleMic() {
  if (pulse.micOn) {
    pulse.disableMic(true);
    saveMic(false);
  } else {
    saveMic(true);
    try { await pulse.enableMic(); } catch (e) { toast('Sin micrófono'); }
  }
  syncMic();
}

function bind() {
  $('#enter').addEventListener('click', enter);
  $('#mic').addEventListener('click', () => { saveMic(!wantMic); syncMic(); });
  $('#xr-mic').addEventListener('click', toggleMic);
  $('#xr-exit').addEventListener('click', () => { if (session) session.end(); });
  $('#fix').addEventListener('click', () => setFixed(true));
  $('#refix').addEventListener('click', () => setFixed(false));
  // Modo grabación: sin botones; se vuelve manteniendo presionado.
  $('#xr-rec').addEventListener('click', () => {
    xrRoot.classList.add('is-rec');
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
  images = await Promise.all(BANDS.map((b) => loadImage(b.cinta)));
  shelf = createShelf(images);
  refresh();
  $('#enter').disabled = false;
  setInterval(refresh, 20000);
  // Sin señal: después de la primera visita abre igual (ver ../sw.js).
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('../sw.js').catch(() => {});
}

window.Polea = {
  get session() { return session; }, get shelf() { return shelf; }, get state() { return state; },
  rig, sky, fx, ritmo, renderer, nowState, setOverride, pickBand, openBand, enter, setFixed, fireAt,
};

boot();
