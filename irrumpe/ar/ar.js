/*
 * IRRUMPE AR — página de acceso y experiencia.
 *
 * Lanzador: el tótem girando y un solo botón, "Entrar". El modo se elige solo
 * según lo que permite el navegador, sin abrir otras apps ni otros navegadores:
 *
 *   1. WebXR (Chrome en Android con ARCore) → AR anclada: el tótem queda fijo
 *      en el mundo; artistas, reacciones, música.
 *   2. iPhone → AR Quick Look del sistema con el tótem animado y anclado
 *      (assets/irrumpe.usdz). Al volver, "Ver artistas" abre el modo 3.
 *   3. Resto (Firefox, Samsung Internet...) → cámara + giroscopio, interactiva
 *      pero sin anclaje.
 *
 * El botón 360 abre la galería: el mismo tótem sobre la transmisión 360 de una
 * intervención (en vivo o grabada), en cualquier celular o computador.
 *
 * Todo el contenido sale de js/config.js. `?preview` deja entrar a la AR desde
 * computador (para probar o proyectar) y `?galeria` abre directo la galería.
 */
import * as THREE from '../vendor/three.min.js';
import { createHologram, REACTIONS } from './hologram.js';
import { xrSupported, startXR, startWindow, requestMotionPermission } from './sessions.js';
import { pulse } from './audio.js';
import { createBackground, thumbnail } from './video360.js';

const C = window.IRRUMPE_CONFIG;
const GEO = window.IRRUMPE_GEO;
const POINTS = C.puntos || [];
const AR = C.ar || {};
const PROTO = !!AR.prototipo;
const PARAMS = new URLSearchParams(location.search);
const PREVIEW = PARAMS.has('preview');
const USDZ = '../assets/irrumpe.usdz';
// Galería 360: solo las entradas con video; los puntos sin video salen como "Próximamente".
const GALLERY = (C.galeria || []).filter((g) => g && g.video);
const POINT_INDEX = Object.fromEntries(POINTS.map((p, i) => [p.id, i]));

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
// Chrome propiamente tal (no Samsung Internet, Edge, Opera ni otros basados en Chromium).
const IS_CHROME = /Chrome\/\d/.test(UA) && !/SamsungBrowser|EdgA|OPR|YaBrowser|UCBrowser|; wv\)/.test(UA);
// AR Quick Look: Safari (y otros navegadores) en iPhone/iPad.
const QUICKLOOK = (() => {
  const a = document.createElement('a');
  return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
})();

// Elige el camino ("route") una vez que se sabe si hay WebXR.
// `?ar=giro` fuerza la cámara + giroscopio (para comparar en Chrome).
async function chooseRoute() {
  if (PARAMS.get('ar') === 'giro') return 'window';
  if (await xrSupported()) return 'xr';
  if (QUICKLOOK) return 'quicklook';
  return 'window';
}
let route = 'window';
// En Android sin WebXR se avisa una sola vez, en una línea, dónde se ancla.
let note = '';

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
let holo = null;
let session = null;
let entering = false;

// Calidad adaptable: el 3D parte a 1,5× (no a la resolución completa de la
// pantalla, que en celulares es 2,5–3× y no se nota) y, si el celular no
// alcanza ~45 cuadros por segundo, baja la resolución hasta que fluya.
const quality = {
  ratio: Math.min(window.devicePixelRatio || 1, 1.5),
  min: 0.75,
  slow: false,
  frames: 0,
  sum: 0,
  last: 0,
  from: 0,
  reset() { this.frames = 0; this.sum = 0; this.last = 0; this.from = performance.now() + 1500; },
  tick(t) {
    const dt = this.last ? t - this.last : 0;
    this.last = t;
    // Se ignoran el arranque (compilación, texturas) y las pausas.
    if (!dt || dt > 250 || performance.now() < this.from) return;
    this.sum += dt;
    if (++this.frames < 50) return;
    const avg = this.sum / this.frames;
    this.frames = 0;
    this.sum = 0;
    if (avg > 22 && this.ratio > this.min) {
      this.slow = true;
      this.ratio = Math.max(this.min, this.ratio * 0.8);
      renderer.setPixelRatio(this.ratio);
    }
  },
};
renderer.setPixelRatio(quality.ratio);
quality.reset();

// Lanzador: el tótem gira lento a pantalla completa.
const previewCam = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
function fitPreview() {
  const box = $('#preview').getBoundingClientRect();
  if (!box.width || !box.height) return;
  renderer.setSize(box.width, box.height, false);
  previewCam.aspect = box.width / box.height;
  previewCam.updateProjectionMatrix();
}
// La vista previa es decorativa: 30 cuadros por segundo bastan.
let lastPreview = 0;
function previewLoop(t) {
  quality.tick(t);
  if (t - lastPreview < 30) return;
  lastPreview = t;
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
    msg(note);
  }
}

function renderDesktop() {
  if (IS_MOBILE || PREVIEW) return;
  $('#actions').hidden = true;
  $('#desktop').hidden = false;
  $('#desktop-360').hidden = !GALLERY.length;
  if (typeof window.qrcode !== 'function') return;
  const qr = window.qrcode(0, 'M');
  qr.addData(location.href.split('?')[0]);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
  $('#qr').innerHTML = '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path fill="#070707" d="' + d + '"/></svg>';
}

// AR Quick Look (iPhone): se abre con un enlace especial al modelo .usdz.
function openQuickLook() {
  const d = eventDate();
  const params = new URLSearchParams({
    checkoutTitle: C.evento.nombre || 'IRRUMPE',
    checkoutSubtitle: C.compania.nombre + ' · ' + d.date,
    callToAction: 'Ver artistas',
  });
  const a = document.createElement('a');
  a.rel = 'ar';
  a.href = USDZ + '#' + params.toString().replace(/\+/g, '%20');
  a.appendChild(document.createElement('img')); // requisito de Quick Look
  a.addEventListener('message', (e) => {
    if (e.data === '_apple_ar_quicklook_button_tapped') location.href = '../';
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
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

// Fondo actual: null = cámara (o AR anclada); si no, la entrada de la galería.
let background = null;
let bgCtl = null;
let pendingSwitch = null;

const ctx = {
  renderer, scene, canvas,
  get holo() { return holo; },
  overlayRoot: xrRoot,
  onTick(t) { quality.tick(t); },
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
    bgCtl = null;
    background = null;
    clearTimeout(idleTimer);
    closeSheet();
    xrRoot.classList.remove('xr--webxr', 'is-idle');
    // Cambio de fondo: se entra de inmediato con el nuevo, sin pasar por el lanzador.
    if (pendingSwitch) {
      const { item } = pendingSwitch;
      pendingSwitch = null;
      enterInteractive(route === 'xr' && !item, item);
      return;
    }
    xrRoot.hidden = true;
    document.body.classList.remove('is-xr');
    $('#launch').hidden = false;
    startPreview();
  },
};

// Botón "Entrar": sigue el camino elegido para este navegador.
function enter() {
  if (!holo || session || entering) return;
  if (route === 'quicklook') { openQuickLook(); $('#more').hidden = false; return; }
  enterInteractive(route === 'xr');
}

// useXR: AR anclada. item: entrada de la galería para el fondo 360 (o null).
async function enterInteractive(useXR, item = null) {
  // Un segundo toque mientras se abre la cámara no debe abrir otra.
  if (!holo || session || entering) return;
  entering = true;
  closeLaunchSheet();
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
  quality.reset();

  try {
    if (useXR && !item) {
      xrRoot.classList.add('xr--webxr');
      try {
        session = await startXR(ctx, { scale: quality.slow ? 0.6 : 0.85 });
        ctx.onSurface(false);
      } catch (e) {
        xrRoot.classList.remove('xr--webxr');
        session = null;
      }
    }
    // Los permisos van de a uno: primero sensores (iPhone), después la cámara.
    if (!session) await motion;
    if (!session && item) {
      const bg = createBackground(item, { host: $('#xr-bg'), scene, onChange: syncBackground });
      bg.ready.catch(() => { if (bgCtl === bg) toast('No se pudo cargar el video'); });
      bgCtl = bg;
      background = item;
      session = await startWindow(ctx, { video, bg });
    }
    if (!session) {
      try {
        session = await startWindow(ctx, { video, useCamera: true });
      } catch (e) {
        session = await startWindow(ctx, { video, useCamera: false });
      }
    }
  } finally {
    entering = false;
  }
  $('#xr-recenter').setAttribute('aria-label', session.mode === 'xr' ? 'Mover el tótem' : 'Recentrar');
  syncBackground();
  updateLive();
  wake();
}

// ------------------------------------------------------------------ galería 360

function syncBackground() {
  const b = $('#xr-360');
  b.hidden = !GALLERY.length;
  b.setAttribute('aria-pressed', String(!!background));
  const sound = $('#xr-sound');
  sound.hidden = !bgCtl;
  if (bgCtl) sound.setAttribute('aria-pressed', String(!bgCtl.muted));
}

// Cambia el fondo sin salir: cierra la sesión actual y abre la nueva.
function switchBackground(item) {
  closeSheet();
  if (!session || item === background) return;
  pendingSwitch = { item };
  session.end({ silent: true });
}

function camThumb() {
  const el = h('span', { class: 'sheet__thumb sheet__thumb--cam' });
  el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  return el;
}

// Filas de la galería: primero los videos, después los puntos que aún no tienen.
function galleryList(inside) {
  const rows = GALLERY.map((g) => {
    const i = POINT_INDEX[g.punto];
    const p = POINTS[i];
    return h('li', null, h('button', { class: 'sheet__row' + (g === background ? ' is-current' : ''), type: 'button', onclick: () => pickVideo(g) },
      h('img', { class: 'sheet__thumb', src: thumbnail(g.video) || (p ? asset(p.artista.foto) : null), alt: '' }),
      h('span', { class: 'sheet__row-num', text: p ? pad(i + 1) : '360' }),
      h('span', { class: 'sheet__row-text' }, h('strong', { text: p ? p.artista.nombre : g.titulo || '360' }), p && h('span', { text: p.lugar })),
    ));
  });
  POINTS.forEach((p, i) => {
    if (GALLERY.some((g) => g.punto === p.id)) return;
    rows.push(h('li', null, h('button', { class: 'sheet__row', type: 'button', disabled: true },
      p.artista.foto ? h('img', { class: 'sheet__thumb', src: asset(p.artista.foto), alt: '' }) : h('span', { class: 'sheet__thumb sheet__thumb--empty', text: pad(i + 1) }),
      h('span', { class: 'sheet__row-num', text: pad(i + 1) }),
      h('span', { class: 'sheet__row-text' }, h('strong', { text: p.artista.nombre }), h('span', { text: p.lugar })),
      h('span', { class: 'sheet__row-tag sheet__row-tag--soft', text: 'Próximamente' }),
    )));
  });
  return h('ol', { class: 'sheet__list' },
    inside && h('li', null, h('button', { class: 'sheet__row' + (!background ? ' is-current' : ''), type: 'button', onclick: () => switchBackground(null) },
      camThumb(),
      h('span', { class: 'sheet__row-num' }),
      h('span', { class: 'sheet__row-text' }, h('strong', { text: 'Tu cámara' })),
    )),
    rows);
}

function pickVideo(item) {
  if (session) switchBackground(item);
  else enterInteractive(false, item);
}

function openGallery() {
  sheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeSheet }),
    galleryList(true),
  );
  sheet.dataset.kind = 'gallery';
  sheet.hidden = false;
}

// En el lanzador (y en computador) la galería se abre sobre el tótem girando.
const launchSheet = $('#launch-sheet');
function openLaunchSheet() {
  if (!holo) return;
  launchSheet.replaceChildren(
    h('button', { class: 'sheet__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: closeLaunchSheet }),
    galleryList(false),
  );
  launchSheet.hidden = false;
}
function closeLaunchSheet() {
  launchSheet.hidden = true;
  launchSheet.replaceChildren();
}

// Artista "en vivo": en un video de la galería, el de ese punto.
function liveNow() {
  if (background) return background.punto in POINT_INDEX ? POINT_INDEX[background.punto] : -1;
  return liveIndex(Date.now());
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
        !background && liveIndex(Date.now()) === i && h('p', { class: 'sheet__live', text: 'En vivo' }),
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
  const live = background ? -1 : liveIndex(Date.now());
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
  const k = liveNow();
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
  $('#open-360').addEventListener('click', openLaunchSheet);
  $('#desktop-360').addEventListener('click', openLaunchSheet);
  $('#xr-360').addEventListener('click', () => (sheet.hidden || sheet.dataset.kind !== 'gallery' ? openGallery() : closeSheet()));
  $('#xr-sound').addEventListener('click', () => {
    if (!bgCtl) return;
    if (bgCtl.muted) bgCtl.unmute();
    else bgCtl.mute();
    syncBackground();
  });
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
      holo.react(b.dataset.react, liveNow());
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
  // El micrófono se retoma recién cuando la cámara ya volvió (nunca dos cosas a la vez).
  document.addEventListener('visibilitychange', () => {
    quality.reset();
    if (document.visibilityState === 'hidden') {
      pulse.suspend();
      if (!session) renderer.setAnimationLoop(null);
    } else {
      setTimeout(() => {
        (session && session.resumed ? session.resumed : Promise.resolve())
          .then(() => pulse.resume())
          .then(syncMicButtons);
      }, 0);
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
  // (En Chrome sin WebXR el celular no tiene ARCore: no hay a dónde mandarlo.)
  if (route === 'window' && IS_ANDROID && !IS_CHROME) note = 'Para anclarlo al piso, ábrelo en Chrome';
  // La música solo aplica a los modos interactivos (no al visor del iPhone).
  $('#mic').hidden = route === 'quicklook';
  $('#open-360').hidden = !GALLERY.length;
  try {
    holo = await createHologram({ config: C, geo: GEO });
    startPreview();
  } catch (e) {
    msg('Este navegador no puede mostrar 3D');
    console.error(e);
  }
  renderLauncher();
  if (PARAMS.has('galeria') && GALLERY.length) openLaunchSheet();
}

// Acceso para depurar desde la consola del navegador.
window.IrrumpeAR = {
  renderer,
  get holo() { return holo; },
  get session() { return session; },
  get route() { return route; },
  get quality() { return quality; },
  get background() { return bgCtl; },
  openArtist, openLineup, openGallery, closeSheet, liveIndex, enterInteractive, switchBackground,
};

boot();
