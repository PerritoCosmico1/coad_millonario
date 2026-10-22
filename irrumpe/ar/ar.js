/*
 * IRRUMPE AR — página de acceso y experiencia.
 *
 * Lanzador: el tótem girando y un solo botón, "Entrar". La mejor forma de
 * verlo se elige sola según lo que permite el navegador (no se puede saber
 * cuál es el navegador predeterminado, pero sí qué soporta el actual):
 *
 *   1. WebXR (Chrome y otros Chromium en Android con ARCore) → experiencia
 *      completa y anclada: tótem fijo en el mundo, artistas, reacciones, música.
 *   2. iPhone → AR Quick Look del sistema con el tótem animado y anclado
 *      (assets/irrumpe.usdz).
 *   3. Android sin WebXR (Firefox, Samsung Internet...) → Scene Viewer de Google
 *      con el tótem animado y anclado (assets/irrumpe.glb). Si no abre, pasa
 *      solo al modo 4.
 *   4. Resto → cámara + giroscopio (sin anclaje), interactiva.
 *
 * Después de 2 o 3 aparece "Ver artistas", que abre el modo 4 con las fichas.
 * Todo el contenido sale de js/config.js. `?preview` deja entrar desde
 * computador (para probar o proyectar).
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
const PARAMS = new URLSearchParams(location.search);
const PREVIEW = PARAMS.has('preview');
const MODELS = { usdz: '../assets/irrumpe.usdz', glb: '../assets/irrumpe.glb' };

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');

const START = new Date(C.evento.inicio).getTime();
const END = C.evento.fin ? new Date(C.evento.fin).getTime() : START + 4 * 3600e3;
const OPENS = AR.activaDesde ? new Date(AR.activaDesde).getTime() : START;
const isOpen = (now) => PROTO || PREVIEW || (now >= OPENS && now < END);

// ------------------------------------------------------------------ navegador

const UA = navigator.userAgent;
const IS_MOBILE = (navigator.userAgentData && navigator.userAgentData.mobile)
  || /Android|iPhone|iPad|iPod|Mobile/i.test(UA)
  || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);
const IS_ANDROID = /Android/i.test(UA);
// AR Quick Look: Safari (y otros navegadores) en iPhone/iPad.
const QUICKLOOK = (() => {
  const a = document.createElement('a');
  return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
})();

// Elige el camino ("route") una vez que se sabe si hay WebXR.
async function chooseRoute() {
  if (PARAMS.get('ar') === 'giro') return 'window'; // vuelta desde un visor que no abrió
  if (await xrSupported()) return 'xr';
  if (QUICKLOOK) return 'quicklook';
  if (IS_ANDROID) return 'sceneviewer';
  return 'window';
}
let route = 'window';

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
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const icon = (kind) => '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + REACTIONS[kind] + '"/></svg>';
const asset = (p) => (p ? '../' + p : '');

function eventDate() {
  const parts = new Intl.DateTimeFormat('es-CL', {
    timeZone: C.evento.zonaHoraria || 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(START));
  const p = (t) => (parts.find((x) => x.type === t) || {}).value;
  return { date: p('day') + '.' + p('month') + '.' + p('year'), time: p('hour') + ':' + p('minute') };
}

// ------------------------------------------------------------------ quién está tocando

// En el evento real se usa `hora` de cada punto (o partes iguales si no hay).
// En el prototipo cada artista queda "en vivo" `segundosPorSet` segundos, en loop.
function liveIndex(now) {
  const n = POINTS.length;
  if (!n) return -1;
  if (PROTO) return Math.floor(now / ((AR.segundosPorSet || 120) * 1000)) % n;
  if (now < START || now >= END) return -1;
  const day = C.evento.inicio.slice(0, 10);
  const offset = C.evento.inicio.slice(19) || '';
  const starts = POINTS.map((p, i) => (p.hora
    ? new Date(day + 'T' + p.hora + ':00' + offset).getTime()
    : START + ((END - START) / n) * i));
  let k = -1;
  starts.forEach((s, i) => { if (now >= s && (k < 0 || s >= starts[k])) k = i; });
  return k;
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

// Lanzador: el tótem gira lento a pantalla completa.
const previewCam = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
function fitPreview() {
  const box = $('#preview').getBoundingClientRect();
  if (!box.width || !box.height) return;
  renderer.setSize(box.width, box.height, false);
  previewCam.aspect = box.width / box.height;
  previewCam.updateProjectionMatrix();
}
function previewLoop(t) {
  const a = Math.sin(t / 5200) * 0.55;
  const dist = previewCam.aspect < 0.9 ? 5.2 : 3.1;
  previewCam.position.set(Math.sin(a) * dist, 1.5, Math.cos(a) * dist);
  previewCam.lookAt(0, previewCam.aspect < 0.9 ? 0.75 : 0.6, 0);
  holo.setLive(liveIndex(Date.now()));
  holo.update(t, previewCam, pulse.sample(t));
  renderer.render(scene, previewCam);
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
  renderer.setAnimationLoop(document.visibilityState === 'visible' ? previewLoop : null);
}
new ResizeObserver(() => { if (!session) fitPreview(); }).observe($('#preview'));

// ------------------------------------------------------------------ lanzador

function msg(text) {
  const el = $('#msg');
  el.textContent = text || '';
  el.hidden = !text;
}

function renderLauncher() {
  const now = Date.now();
  if (!IS_MOBILE && !PREVIEW) return;
  const ready = !!holo && isOpen(now);
  $('#enter').disabled = !ready;
  if (!isOpen(now)) {
    const d = eventDate();
    msg(now < OPENS ? d.date + ' · ' + d.time : '');
  } else if (!window.isSecureContext) {
    msg('Necesita HTTPS');
  } else {
    msg('');
  }
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
  $('#qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path fill="#070707" d="' + d + '"/></svg>';
}

// Visores de AR del sistema: necesitan que el navegador abra un enlace especial.
function clickLink(href, rel) {
  const a = document.createElement('a');
  if (rel) a.rel = rel;
  a.href = href;
  if (rel === 'ar') a.appendChild(document.createElement('img')); // requisito de Quick Look
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
  return a;
}

function openQuickLook() {
  const d = eventDate();
  const params = new URLSearchParams({
    checkoutTitle: C.evento.nombre || 'IRRUMPE',
    checkoutSubtitle: C.compania.nombre + ' · ' + d.date,
    callToAction: 'Ver artistas',
  });
  const a = clickLink(MODELS.usdz + '#' + params.toString().replace(/\+/g, '%20'), 'ar');
  a.addEventListener('message', (e) => {
    if (e.data === '_apple_ar_quicklook_button_tapped') location.href = '../';
  });
}

function openSceneViewer() {
  const back = new URL(location.href);
  back.search = '?ar=giro';
  const params = new URLSearchParams({
    file: new URL(MODELS.glb, location.href).href,
    mode: 'ar_preferred',
    title: (C.evento.nombre || 'IRRUMPE') + ' · ' + C.compania.nombre,
    link: new URL('../', location.href).href,
  });
  clickLink('intent://arvr.google.com/scene-viewer/1.0?' + params.toString()
    + '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;'
    + 'S.browser_fallback_url=' + encodeURIComponent(back.href) + ';end;');
  // Si a los 3 s la página sigue a la vista, el visor no se abrió: experiencia interactiva.
  setTimeout(() => {
    if (document.visibilityState === 'visible' && !session) enterInteractive(false);
  }, 3000);
}

function syncMicButtons() {
  const on = pulse.micOn;
  $('#mic').setAttribute('aria-pressed', String(on));
  $('#xr-mic').setAttribute('aria-pressed', String(on));
}

async function toggleMic() {
  if (pulse.micOn) {
    pulse.disableMic(true);
  } else {
    try {
      await pulse.enableMic();
    } catch (e) {
      toast('Sin micrófono');
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
let idleTimer = 0;
let lastSurface = null;
let pinchHinted = false;

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

function pinchHint() {
  if (pinchHinted) return;
  pinchHinted = true;
  setHint('Pellizca para escalar', 2500);
}

// La interfaz se atenúa si no se toca por unos segundos.
function wake() {
  xrRoot.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (sheet.hidden) xrRoot.classList.add('is-idle'); }, 3500);
}

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
    setHint(found ? 'Toca para colocar' : 'Apunta al suelo');
  },
  onNoSurface() {
    $('#xr-ahead').hidden = false;
  },
  onPlaced() {
    lastSurface = null;
    $('#xr-ahead').hidden = true;
    setHint('');
    pinchHint();
    if (navigator.vibrate) navigator.vibrate(30);
  },
  onLook(kind) {
    if (kind === 'drag') setHint('Arrastra para mirar', 3000);
    else pinchHint();
  },
  onCameraLost() {
    toast('No se pudo reabrir la cámara');
  },
  onEnd() {
    session = null;
    clearTimeout(idleTimer);
    closeSheet();
    xrRoot.hidden = true;
    xrRoot.classList.remove('xr--webxr', 'is-idle');
    document.body.classList.remove('is-xr');
    $('#launch').hidden = false;
    startPreview();
  },
};

// Botón "Entrar": sigue el camino elegido para este navegador.
function enter() {
  if (!holo || session) return;
  if (route === 'quicklook') { openQuickLook(); $('#more').hidden = false; return; }
  if (route === 'sceneviewer') { openSceneViewer(); $('#more').hidden = false; return; }
  enterInteractive(route === 'xr');
}

async function enterInteractive(useXR) {
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
  $('#xr-ahead').hidden = true;

  if (useXR) {
    xrRoot.classList.add('xr--webxr');
    try {
      session = await startXR(ctx);
      ctx.onSurface(false);
    } catch (e) {
      xrRoot.classList.remove('xr--webxr');
      session = null;
    }
  }
  if (!session) {
    await motion;
    try {
      session = await startWindow(ctx, { video, useCamera: true });
    } catch (e) {
      session = await startWindow(ctx, { video, useCamera: false });
    }
  }
  $('#xr-recenter').setAttribute('aria-label', session.mode === 'xr' ? 'Mover el tótem' : 'Recentrar');
  updateLive();
  wake();
}

// ------------------------------------------------------------------ fichas

function closeSheet() {
  sheet.hidden = true;
  sheet.replaceChildren();
  if (holo) holo.select(-1);
}

function openArtist(i) {
  const p = POINTS[i];
  const a = p.artista;
  const mus = a.musica || {};
  const links = Object.entries(a.redes || {}).filter(([, url]) => url);
  const maps = 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng;
  sheet.replaceChildren(...[
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('div', { class: 'sheet__head' },
      a.foto ? h('img', { class: 'sheet__photo', src: asset(a.foto), alt: a.nombre }) : h('div', { class: 'sheet__photo sheet__photo--empty', text: pad(i + 1) }),
      h('div', null,
        h('p', { class: 'sheet__kicker' }, h('strong', { text: pad(i + 1) }), p.hora ? ' · ' + p.hora : ''),
        h('h2', { class: 'sheet__name', text: a.nombre }),
        liveIndex(Date.now()) === i && h('p', { class: 'sheet__live', text: 'En vivo' }),
        a.genero && h('p', { class: 'sheet__genre', text: a.genero }),
        h('p', { class: 'sheet__place', text: p.lugar }),
      ),
    ),
    a.bio && h('p', { class: 'sheet__bio', text: a.bio }),
    links.length > 0 && h('div', { class: 'sheet__social' },
      links.map(([k, url]) => h('a', { class: 'sheet__social-btn', href: url, target: '_blank', rel: 'noopener', text: SOCIAL_LABELS[k] || k }))),
    (mus.titulo || mus.url) && h('a', { class: 'sheet__music', href: mus.url || null, target: '_blank', rel: 'noopener' },
      h('strong', { text: mus.titulo || 'Escuchar' })),
    h('a', { class: 'sheet__link', href: maps, target: '_blank', rel: 'noopener', text: 'Cómo llegar ↗' }),
  ].filter(Boolean)); // los campos vacíos no se muestran
  sheet.dataset.kind = 'artist';
  sheet.hidden = false;
  holo.select(i);
}

function openLineup() {
  const live = liveIndex(Date.now());
  sheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    h('ol', { class: 'sheet__list' }, POINTS.map((p, i) => h('li', null,
      h('button', { class: 'sheet__row', type: 'button', onclick: () => openArtist(i) },
        p.artista.foto ? h('img', { class: 'sheet__thumb', src: asset(p.artista.foto), alt: '' }) : h('span', { class: 'sheet__thumb sheet__thumb--empty', text: pad(i + 1) }),
        h('span', { class: 'sheet__row-num', text: pad(i + 1) }),
        h('span', { class: 'sheet__row-text' }, h('strong', { text: p.artista.nombre }), h('span', { text: p.lugar })),
        live === i && h('span', { class: 'sheet__row-tag', text: 'En vivo' }),
      ),
    ))),
  );
  sheet.dataset.kind = 'lineup';
  sheet.hidden = false;
}

// ------------------------------------------------------------------ en vivo

function updateLive() {
  const k = liveIndex(Date.now());
  const box = $('#xr-live');
  box.hidden = k < 0;
  if (holo) holo.setLive(k);
  if (k < 0) return;
  const p = POINTS[k];
  $('#xr-live-name').textContent = p.artista.nombre;
  $('#xr-live-place').textContent = p.lugar;
  box.dataset.index = k;
  box.setAttribute('aria-label', 'En vivo: ' + p.artista.nombre + ', ' + p.lugar);
}

// ------------------------------------------------------------------ arranque

function bindUI() {
  $('#enter').addEventListener('click', enter);
  $('#more').addEventListener('click', () => enterInteractive(false));
  $('#mic').addEventListener('click', toggleMic);
  $('#xr-mic').addEventListener('click', toggleMic);
  $('#xr-exit').addEventListener('click', () => { if (session) session.end(); });
  $('#xr-recenter').addEventListener('click', () => { if (session) session.recenter(); });
  $('#xr-ahead').addEventListener('click', () => { if (session && session.placeAhead) session.placeAhead(); });
  $('#xr-lineup').addEventListener('click', () => (sheet.hidden || sheet.dataset.kind !== 'lineup' ? openLineup() : closeSheet()));
  $('#xr-live').addEventListener('click', () => {
    const i = Number($('#xr-live').dataset.index);
    if (!Number.isNaN(i)) openArtist(i);
  });
  document.querySelectorAll('[data-react]').forEach((b) => {
    b.innerHTML = icon(b.dataset.react);
    b.addEventListener('click', () => {
      holo.react(b.dataset.react, liveIndex(Date.now()));
      b.classList.remove('is-pop');
      void b.offsetWidth;
      b.classList.add('is-pop');
      if (navigator.vibrate) navigator.vibrate(12);
    });
  });
  xrRoot.addEventListener('pointerdown', wake);
  // En WebXR, los toques sobre la interfaz no deben contar como toques en la escena.
  $('#xr-ui').addEventListener('beforexrselect', (e) => {
    if (e.target.closest('button, a, .xr__sheet')) e.preventDefault();
  });
  // Al minimizar o volver: soltar/retomar micrófono y la vista previa del lanzador.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pulse.suspend();
      if (!session) renderer.setAnimationLoop(null);
    } else {
      pulse.resume().then(syncMicButtons);
      if (!session && holo) renderer.setAnimationLoop(previewLoop);
    }
  });
}

async function boot() {
  document.querySelectorAll('[data-event-name]').forEach((el) => { el.textContent = C.evento.nombre || 'IRRUMPE'; });
  bindUI();
  syncMicButtons();
  renderDesktop();
  renderLauncher();
  setInterval(renderLauncher, 1000);
  setInterval(updateLive, 1000);
  route = await chooseRoute();
  // La música solo aplica a los modos interactivos (no a los visores del sistema).
  $('#mic').hidden = !(route === 'xr' || route === 'window');
  try {
    holo = await createHologram({ config: C, geo: GEO });
    startPreview();
  } catch (e) {
    msg('Este navegador no puede mostrar 3D');
    console.error(e);
  }
  renderLauncher();
}

// Acceso para depurar desde la consola del navegador.
window.IrrumpeAR = {
  renderer,
  get holo() { return holo; },
  get session() { return session; },
  get route() { return route; },
  openArtist, openLineup, closeSheet, liveIndex, enterInteractive,
};

boot();
