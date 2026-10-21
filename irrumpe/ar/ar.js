/*
 * IRRUMPE AR — página de acceso y experiencia.
 *
 * Lanzador (una pantalla): estado, vista previa 3D del holograma, revisión del
 * celular y botones para entrar. Al entrar elige el mejor modo disponible
 * (ver sessions.js): WebXR → cámara + giroscopio → sin cámara.
 *
 * Dentro de la experiencia: quién está tocando ahora, line-up, ficha de cada
 * artista con foto y redes, reacciones y visuales que siguen la música.
 *
 * Todo el contenido sale de js/config.js. Con `ar.prototipo: true` funciona en
 * cualquier momento y lugar, y simula el show (cada artista toca unos segundos).
 * `?preview` deja entrar también desde computador (para probar o proyectar).
 */
import * as THREE from '../vendor/three.min.js';
import { createHologram, REACTIONS } from './hologram.js';
import { xrSupported, startXR, startWindow, requestMotionPermission } from './sessions.js';
import { pulse } from './audio.js';

const C = window.IRRUMPE_CONFIG;
const GEO = window.IRRUMPE_GEO;
const POINTS = C.puntos || [];
const AR = C.ar || {};
const PROTO = !!AR.prototipo;
const PREVIEW = new URLSearchParams(location.search).has('preview');

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');

const START = new Date(C.evento.inicio).getTime();
const END = C.evento.fin ? new Date(C.evento.fin).getTime() : START + 4 * 3600e3;
const OPENS = AR.activaDesde ? new Date(AR.activaDesde).getTime() : START;
const isOpen = (now) => PROTO || PREVIEW || (now >= OPENS && now < END);

const IS_MOBILE = (navigator.userAgentData && navigator.userAgentData.mobile)
  || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);

const SOCIAL_LABELS = {
  instagram: 'Instagram', spotify: 'Spotify', youtube: 'YouTube', soundcloud: 'SoundCloud',
  tiktok: 'TikTok', bandcamp: 'Bandcamp', web: 'Web',
};

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

const icon = (kind) => '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + REACTIONS[kind] + '"/></svg>';
const asset = (p) => (p ? '../' + p : '');

// ------------------------------------------------------------------ quién está tocando

// En prototipo cada artista "toca" `segundosPorSet` y se repite en loop.
// En el evento real se usa `hora` de cada punto o, si no hay, partes iguales.
function liveState(now) {
  const n = POINTS.length;
  if (!n) return null;
  if (PROTO) {
    const set = (AR.segundosPorSet || 45) * 1000;
    const k = Math.floor(now / set) % n;
    return { index: k, progress: (now % set) / set, next: (k + 1) % n, remaining: set - (now % set) };
  }
  if (now < START || now >= END) return null;
  const day = C.evento.inicio.slice(0, 10);
  const offset = C.evento.inicio.slice(19) || '';
  const starts = POINTS.map((p, i) => (p.hora
    ? new Date(day + 'T' + p.hora + ':00' + offset).getTime()
    : START + ((END - START) / n) * i));
  let k = -1;
  starts.forEach((s, i) => { if (now >= s && (k < 0 || s >= starts[k])) k = i; });
  if (k < 0) return null;
  const until = Math.min(...starts.filter((s) => s > starts[k]), END);
  return { index: k, progress: (now - starts[k]) / (until - starts[k]), next: until < END ? starts.indexOf(until) : -1, remaining: until - now };
}

// ------------------------------------------------------------------ 3D compartido

const canvas = document.createElement('canvas');
canvas.className = 'xr__canvas';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
let holo = null;
let session = null;

// Vista previa en el lanzador: la cámara se mece frente al holograma.
const previewCam = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
function fitPreview() {
  const box = $('#preview').getBoundingClientRect();
  if (!box.width || !box.height) return;
  renderer.setSize(box.width, box.height, false);
  previewCam.aspect = box.width / box.height;
  previewCam.updateProjectionMatrix();
}
function startPreview() {
  if (!holo) return;
  $('#preview').prepend(canvas);
  holo.group.position.set(0, 0, 0);
  holo.group.rotation.set(0, 0, 0);
  holo.group.scale.setScalar(1);
  holo.group.visible = true;
  holo.setHeight(0.85);
  holo.select(-1);
  scene.add(holo.group);
  fitPreview();
  renderer.setAnimationLoop((t) => {
    const a = Math.sin(t / 5200) * 0.55;
    const dist = previewCam.aspect < 0.9 ? 3.6 : 2.9;
    previewCam.position.set(Math.sin(a) * dist, 1.45, Math.cos(a) * dist);
    previewCam.lookAt(0, 0.58, 0);
    const live = liveState(Date.now());
    holo.setLive(live ? live.index : -1);
    holo.update(t, previewCam, pulse.sample(t));
    renderer.render(scene, previewCam);
  });
}
new ResizeObserver(() => { if (!session) fitPreview(); }).observe($('#preview'));

// ------------------------------------------------------------------ lanzador

const CHECKS = [
  { id: 'secure', label: 'HTTPS', test: async () => window.isSecureContext },
  { id: 'camera', label: 'Cámara', test: async () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
  { id: 'xr', label: 'AR completa', optional: true, test: xrSupported },
  { id: 'motion', label: 'Giroscopio', test: async () => 'DeviceOrientationEvent' in window },
  { id: 'mic', label: 'Micrófono', optional: true, test: async () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
];
const support = {};

async function renderChecks() {
  const list = $('#checks');
  const rows = CHECKS.map((c) => {
    const li = h('li', { 'data-state': 'wait', text: c.label });
    list.append(li);
    return li;
  });
  for (const [i, c] of CHECKS.entries()) {
    support[c.id] = await c.test();
    const state = support[c.id] ? 'ok' : c.optional ? 'opt' : 'no';
    rows[i].dataset.state = state;
    rows[i].setAttribute('aria-label', c.label + ': ' + (state === 'ok' ? 'listo' : state === 'opt' ? 'opcional' : 'no disponible'));
  }
  const note = $('#note');
  if (!IS_MOBILE && !PREVIEW) note.textContent = '';
  else if (!support.secure) note.textContent = 'La cámara y la AR solo funcionan con el sitio publicado en HTTPS.';
  else if (support.xr) note.textContent = 'Tu celular soporta AR completa: el holograma se apoya en el suelo o en una mesa.';
  else if (support.camera) note.textContent = 'Se usará la cámara y el giroscopio. Para AR completa, usa Chrome en Android.';
  else note.textContent = 'Sin cámara disponible: entra en modo sin cámara.';
}

function renderStatus() {
  const now = Date.now();
  const el = $('#status');
  const open = isOpen(now);
  el.classList.toggle('is-open', open);
  if (PROTO) el.textContent = 'Prototipo · funciona en cualquier lugar';
  else if (PREVIEW) el.textContent = 'Vista previa · bloqueo desactivado';
  else if (now < OPENS) {
    const s = Math.floor((OPENS - now) / 1000);
    el.textContent = 'Bloqueado · se abre en ' + Math.floor(s / 86400) + 'd ' + pad(Math.floor((s % 86400) / 3600)) + 'h ' + pad(Math.floor((s % 3600) / 60)) + 'm ' + pad(s % 60) + 's';
  } else if (now < END) el.textContent = 'Abierto · experiencia en vivo';
  else el.textContent = 'Cerrado · la noche ya pasó';
  const ready = open && !!holo && (IS_MOBILE || PREVIEW);
  $('#enter').disabled = !ready;
  $('#enter-nocam').disabled = !ready;
}

function renderDesktop() {
  if (IS_MOBILE || PREVIEW) return;
  $('#actions').hidden = true;
  const box = $('#desktop');
  box.hidden = false;
  const url = location.href.split('?')[0];
  const link = $('#desktop-link');
  link.href = url;
  link.textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (typeof window.qrcode !== 'function') { $('#qr').hidden = true; return; }
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
  $('#qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path fill="#070707" d="' + d + '"/></svg>';
}

function syncMicButtons() {
  const on = pulse.micOn;
  for (const id of ['#mic', '#xr-mic']) {
    const b = $(id);
    b.setAttribute('aria-pressed', String(on));
  }
  $('#mic').textContent = on ? 'Música: micrófono' : 'Música: demo';
  $('#xr-mic').textContent = on ? 'Mic' : 'Música';
}

async function toggleMic() {
  if (pulse.micOn) {
    pulse.disableMic();
    toast('Visuales en modo demo');
  } else {
    try {
      await pulse.enableMic();
      toast('Las visuales siguen la música que suena');
    } catch (e) {
      toast(session && session.mode === 'xr' ? 'Activa el micrófono antes de entrar' : 'Sin micrófono: visuales en modo demo');
    }
  }
  syncMicButtons();
}

// ------------------------------------------------------------------ experiencia

const xrRoot = $('#xr');
const video = $('#xr-video');
const sheet = $('#xr-sheet');
let hintTimer = 0;
let toastTimer = 0;
let lastSurface = null;

function setHint(text, hideAfter) {
  const el = $('#xr-hint');
  clearTimeout(hintTimer);
  el.textContent = text || '';
  el.hidden = !text;
  if (text && hideAfter) hintTimer = setTimeout(() => { el.hidden = true; }, hideAfter);
}

function toast(text) {
  const el = $('#xr-toast');
  clearTimeout(toastTimer);
  el.textContent = text;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

const MODE_LABELS = { xr: 'AR completa', camera: 'AR · cámara', nocamera: 'Sin cámara' };

const ctx = {
  renderer, scene, canvas,
  get holo() { return holo; },
  overlayRoot: xrRoot,
  onFrame(t, camera) {
    holo.update(t, camera, pulse.sample(t));
  },
  onTap(i) {
    if (i >= 0) openArtist(i);
    else closeSheet();
  },
  onSurface(found) {
    if (found === lastSurface) return;
    lastSurface = found;
    setHint(found ? 'Toca la pantalla para hacer irrumpir aquí' : 'Apunta al suelo o a una mesa y mueve un poco el celular');
  },
  onPlaced() {
    lastSurface = null;
    setHint('Toca una tarjeta para ver al artista', 5000);
    if (navigator.vibrate) navigator.vibrate(30);
  },
  onLook(kind) {
    setHint(kind === 'gyro' ? 'Mueve el celular para mirar · toca una tarjeta' : 'Arrastra para mirar alrededor · toca una tarjeta', 6000);
  },
  onEnd() {
    session = null;
    closeSheet();
    xrRoot.hidden = true;
    xrRoot.classList.remove('xr--webxr');
    document.body.classList.remove('is-xr');
    $('#launch').hidden = false;
    startPreview();
  },
};

async function enter(useCamera) {
  if (!holo || session) return;
  // iPhone exige pedir el permiso de sensores dentro del toque, antes de cualquier espera.
  const motion = requestMotionPermission();
  renderer.setAnimationLoop(null);
  $('#launch').hidden = true;
  xrRoot.hidden = false;
  document.body.classList.add('is-xr');
  video.after(canvas); // el 3D va sobre el video de la cámara y debajo de la interfaz
  lastSurface = null;
  setHint('');

  if (useCamera && support.xr) {
    xrRoot.classList.add('xr--webxr');
    try {
      session = await startXR(ctx);
      ctx.onSurface(false);
    } catch (e) {
      xrRoot.classList.remove('xr--webxr');
      session = null;
      toast('AR completa no disponible: usando la cámara');
    }
  }
  if (!session) {
    await motion;
    try {
      session = await startWindow(ctx, { video, useCamera });
    } catch (e) {
      toast('Sin acceso a la cámara: modo sin cámara');
      session = await startWindow(ctx, { video, useCamera: false });
    }
  }
  $('#xr-mode').textContent = MODE_LABELS[session.mode] + (PROTO ? ' · prototipo' : '');
  $('#xr-recenter').textContent = session.mode === 'xr' ? 'Mover' : 'Recentrar';
  updateLive();
}

// ------------------------------------------------------------------ fichas

function closeSheet() {
  sheet.hidden = true;
  sheet.replaceChildren();
  if (holo) holo.select(-1);
}

function socialLinks(a) {
  const links = Object.entries(a.redes || {}).filter(([, url]) => url);
  if (links.length) {
    return h('div', { class: 'sheet__social' },
      links.map(([k, url]) => h('a', { class: 'sheet__social-btn', href: url, target: '_blank', rel: 'noopener', text: SOCIAL_LABELS[k] || k })));
  }
  // Prototipo sin links cargados: se muestran como "pronto".
  return h('div', { class: 'sheet__social' },
    ['Instagram', 'Spotify', 'YouTube'].map((label) => h('span', { class: 'sheet__social-btn is-off', text: label })),
    h('p', { class: 'sheet__soon', text: 'Redes por anunciar' }));
}

function openArtist(i) {
  const p = POINTS[i];
  const a = p.artista;
  const live = liveState(Date.now());
  const isLive = live && live.index === i;
  const mus = a.musica || {};
  const maps = 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng;
  sheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('div', { class: 'sheet__head' },
      a.foto ? h('img', { class: 'sheet__photo', src: asset(a.foto), alt: a.nombre }) : h('div', { class: 'sheet__photo sheet__photo--empty', text: pad(i + 1) }),
      h('div', null,
        h('p', { class: 'sheet__kicker' }, h('strong', { text: pad(i + 1) }), ' / ' + pad(POINTS.length) + (p.hora ? ' · ' + p.hora + ' hrs' : '')),
        h('h2', { class: 'sheet__name', text: a.nombre }),
        isLive && h('p', { class: 'sheet__live', text: 'En vivo ahora' }),
        a.genero && h('p', { class: 'sheet__genre', text: a.genero }),
        h('p', { class: 'sheet__place', text: p.lugar }),
      ),
    ),
    a.bio && h('p', { class: 'sheet__bio', text: a.bio }),
    socialLinks(a),
    (mus.titulo || mus.url) && h('a', { class: 'sheet__music', href: mus.url || null, target: '_blank', rel: 'noopener' },
      h('span', { text: 'Escucha' }), h('strong', { text: mus.titulo || 'Escuchar' })),
    h('div', { class: 'sheet__actions' },
      h('a', { class: 'sheet__link', href: maps, target: '_blank', rel: 'noopener', text: 'Cómo llegar ↗' }),
      h('button', { class: 'sheet__link', type: 'button', text: 'Ver en el holograma', onclick: () => { sheet.hidden = true; holo.select(i); } }),
    ),
  );
  sheet.dataset.kind = 'artist';
  sheet.hidden = false;
  holo.select(i);
}

function openLineup() {
  const live = liveState(Date.now());
  sheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('p', { class: 'sheet__kicker', text: 'Line-up · ' + POINTS.length + ' puntos' }),
    h('ol', { class: 'sheet__list' }, POINTS.map((p, i) => h('li', null,
      h('button', { class: 'sheet__row', type: 'button', onclick: () => openArtist(i) },
        a11yThumb(p, i),
        h('span', { class: 'sheet__row-num', text: pad(i + 1) }),
        h('span', { class: 'sheet__row-text' }, h('strong', { text: p.artista.nombre }), h('span', { text: p.lugar })),
        live && live.index === i ? h('span', { class: 'sheet__row-tag', text: 'En vivo' })
          : live && live.next === i ? h('span', { class: 'sheet__row-tag is-next', text: 'Sigue' }) : null,
      ),
    ))),
  );
  sheet.dataset.kind = 'lineup';
  sheet.hidden = false;
}
function a11yThumb(p, i) {
  return p.artista.foto
    ? h('img', { class: 'sheet__thumb', src: asset(p.artista.foto), alt: '' })
    : h('span', { class: 'sheet__thumb sheet__thumb--empty', text: pad(i + 1) });
}

// ------------------------------------------------------------------ en vivo

function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? Math.floor(s / 3600) + ' h ' + pad(Math.floor((s % 3600) / 60)) + ' min' : Math.floor(s / 60) + ':' + pad(s % 60);
}

function updateLive() {
  const live = liveState(Date.now());
  const box = $('#xr-live');
  box.hidden = !live;
  if (holo) holo.setLive(live ? live.index : -1);
  if (!live) return;
  const p = POINTS[live.index];
  $('#xr-live-name').textContent = p.artista.nombre;
  $('#xr-live-place').textContent = p.lugar;
  $('#xr-live-bar').style.transform = 'scaleX(' + live.progress.toFixed(3) + ')';
  $('#xr-live-next').textContent = live.next >= 0 ? 'Sigue ' + POINTS[live.next].artista.nombre + ' en ' + fmtLeft(live.remaining) : '';
  box.dataset.index = live.index;
}

// ------------------------------------------------------------------ arranque

function bindUI() {
  $('#enter').addEventListener('click', () => enter(true));
  $('#enter-nocam').addEventListener('click', () => enter(false));
  $('#mic').addEventListener('click', toggleMic);
  $('#xr-mic').addEventListener('click', toggleMic);
  $('#xr-exit').addEventListener('click', () => { if (session) session.end(); });
  $('#xr-recenter').addEventListener('click', () => {
    if (!session) return;
    session.recenter();
    if (session.mode !== 'xr') setHint('Listo: el holograma quedó al frente', 2500);
  });
  $('#xr-lineup').addEventListener('click', () => (sheet.hidden || sheet.dataset.kind !== 'lineup' ? openLineup() : closeSheet()));
  $('#xr-live').addEventListener('click', () => {
    const i = Number($('#xr-live').dataset.index);
    if (!Number.isNaN(i)) openArtist(i);
  });
  document.querySelectorAll('[data-react]').forEach((b) => {
    b.innerHTML = icon(b.dataset.react);
    b.addEventListener('click', () => {
      const live = liveState(Date.now());
      holo.react(b.dataset.react, live ? live.index : -1);
      b.classList.remove('is-pop');
      void b.offsetWidth;
      b.classList.add('is-pop');
      if (navigator.vibrate) navigator.vibrate(12);
    });
  });
  // En WebXR, los toques sobre la interfaz no deben contar como toques en la escena.
  $('#xr-ui').addEventListener('beforexrselect', (e) => {
    if (e.target.closest('button, a, .xr__sheet, .xr__dock, .xr__top')) e.preventDefault();
  });
}

async function boot() {
  document.querySelectorAll('[data-event-name]').forEach((el) => { el.textContent = C.evento.nombre || 'IRRUMPE'; });
  document.title = 'Acceso AR — ' + (C.evento.nombre || 'IRRUMPE');
  $('#proto-tag').hidden = !PROTO;
  bindUI();
  syncMicButtons();
  renderDesktop();
  renderStatus();
  setInterval(renderStatus, 1000);
  setInterval(updateLive, 500);
  renderChecks();
  try {
    holo = await createHologram({ config: C, geo: GEO });
    $('#stage-msg').textContent = PROTO ? 'Vista previa del holograma' : '';
    startPreview();
  } catch (e) {
    $('#stage-msg').textContent = 'No se pudo cargar el 3D en este navegador';
    console.error(e);
  }
  renderStatus();
}

// Acceso para depurar desde la consola del navegador.
window.IrrumpeAR = {
  renderer,
  get holo() { return holo; },
  get session() { return session; },
  openArtist, openLineup, closeSheet, liveState,
};

boot();
