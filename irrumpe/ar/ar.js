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
 * En vivo (js/vivo.js): quién toca lo marca el director desde director.html y
 * cambia en todos los celulares a la vez; el tótem se transforma para mostrar
 * a ese artista. Los avisos del director aparecen arriba, las reacciones de
 * todos suben por el tótem y se ve cuántos hay conectados. Los faros (botón de
 * tres haces) apuntan con GPS y brújula hacia cada punto de la ciudad.
 *
 * Todo el contenido sale de js/config.js. `?preview` deja entrar a la AR desde
 * computador (para probar o proyectar), `?galeria` abre directo la galería y
 * `?video=<link>` agrega un video de prueba arriba de ella (probar-360.html).
 */
import * as THREE from '../vendor/three.min.js';
import { createHologram, REACTIONS, instagramHandle } from './hologram.js';
import { createFaros } from './faros.js';
import { xrSupported, startXR, startWindow, requestMotionPermission } from './sessions.js';
import { pulse } from './audio.js';
import { createBackground, thumbnail, youtubeId, youtubeError, watchUrl } from './video360.js';

const C = window.IRRUMPE_CONFIG;
const GEO = window.IRRUMPE_GEO;
const POINTS = C.puntos || [];
const AR = C.ar || {};
const PROTO = !!AR.prototipo;
const PARAMS = new URLSearchParams(location.search);
const PREVIEW = PARAMS.has('preview');
const USDZ = '../assets/irrumpe.usdz';
// Galería 360: solo las entradas con video; los puntos sin video salen como "Próximamente".
const TRY_VIDEO = PARAMS.get('video');
const GALLERY = [
  ...(TRY_VIDEO ? [{ titulo: 'Prueba', video: TRY_VIDEO }] : []),
  ...(C.galeria || []).filter((g) => g && g.video),
];
const HAS_GALLERY = GALLERY.length > 0 || POINTS.length > 0;
const POINT_INDEX = Object.fromEntries(POINTS.map((p, i) => [p.id, i]));
// Videos que no se pudieron reproducir aquí (link → motivo), y archivos
// propios que todavía no están en el sitio (salen como "Próximamente").
const failed = new Map();
const missing = new Set();

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
// Solo si el evento tiene su modelo para el iPhone (assets/irrumpe.usdz es el de IRRUMPE).
const QUICKLOOK = AR.modeloIphone !== false && (() => {
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
// Sin el link real, buscar al artista en la plataforma (provisorio, `redesProvisorias`).
const SOCIAL_SEARCH = {
  instagram: (q) => 'https://www.instagram.com/explore/search/keyword/?q=' + q,
  spotify: (q) => 'https://open.spotify.com/search/' + q,
  youtube: (q) => 'https://www.youtube.com/results?search_query=' + q,
};

// [red, link] para los botones de seguir: Instagram, Spotify y YouTube siempre
// (con el link real o la búsqueda) y después las otras redes que tengan link.
function socialLinks(a) {
  const redes = a.redes || {};
  const q = encodeURIComponent(a.nombre);
  const provisional = C.redesProvisorias !== false;
  return [...Object.keys(SOCIAL_SEARCH), ...Object.keys(redes).filter((k) => !SOCIAL_SEARCH[k])]
    .map((k) => [k, redes[k] || (provisional && SOCIAL_SEARCH[k] ? SOCIAL_SEARCH[k](q) : '')])
    .filter(([, url]) => url);
}

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
// Rutas del sitio (assets/…) desde ar/; los links completos y las imágenes data: quedan igual.
const asset = (p) => (!p ? '' : /^([a-z]+:|\/)/i.test(p) ? p : '../' + p);
// Video de la galería: un link de YouTube o absoluto queda igual; una ruta del
// sitio (assets/360/…, como las fotos en config.js) se resuelve desde la raíz.
const videoSrc = (v) => (youtubeId(v) ? v : asset(v));

function eventDate() {
  const parts = new Intl.DateTimeFormat('es-CL', {
    timeZone: C.evento.zonaHoraria || 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(START));
  const p = (t) => (parts.find((x) => x.type === t) || {}).value;
  return { date: p('day') + '.' + p('month') + '.' + p('year'), time: p('hour') + ':' + p('minute') };
}

// ------------------------------------------------------------------ quién está tocando

// Quién toca: lo que marque el director (un artista, o nadie); si dejó el
// modo automático, sale de la `hora` de cada punto (o partes iguales si no
// hay). En el prototipo cada artista toca `segundosPorSet` segundos, con una
// pausa corta entre sets (así se ve el tótem transformarse y volver).
const VIVO = window.IrrumpeVivo;
const vivo = { state: null, online: 0, conn: null };
const SET_GAP = 15000;

function liveIndex(now) {
  const n = POINTS.length;
  if (!n) return -1;
  const d = vivo.state;
  if (d && d.vivo != null) return d.vivo in POINT_INDEX ? POINT_INDEX[d.vivo] : -1;
  if (PROTO) {
    const set = (AR.segundosPorSet || 120) * 1000;
    return now % (set + SET_GAP) < set ? Math.floor(now / (set + SET_GAP)) % n : -1;
  }
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
  syncLive(liveIndex(Date.now()));
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
  $('#desktop-360').hidden = !HAS_GALLERY;
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
    const level = pulse.sample(t);
    holo.update(t, camera, level);
    if (faros) faros.update(t, camera, level);
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
    $('#xr-nosurface').hidden = false;
  },
  onPlaced() {
    lastSurface = null;
    $('#xr-nosurface').hidden = true;
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
    $('#xr-yt').hidden = true;
    clearTimeout(idleTimer);
    closeSheet();
    xrRoot.classList.remove('xr--webxr', 'is-idle');
    // Cambio de fondo (o paso a "Sin anclar"): se entra de inmediato, sin pasar por el lanzador.
    if (pendingSwitch) {
      const { item, free, thenFaros } = pendingSwitch;
      pendingSwitch = null;
      enterInteractive(route === 'xr' && !item && !free, item).then(() => { if (thenFaros) setFaros(true); });
      return;
    }
    setFaros(false);
    xrRoot.hidden = true;
    xrRoot.classList.remove('is-rec');
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
  $('#xr-nosurface').hidden = true;
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
      const bg = createBackground({ ...item, video: videoSrc(item.video) }, {
        host: $('#xr-bg'), scene, onChange: syncBackground, onError: (code) => videoFailed(item, code),
      });
      bg.ready.catch((e) => { if (bgCtl === bg && !failed.has(item.video)) toast(e.message); });
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
  // Foto: en los modos con cámara del navegador (en la AR anclada la cámara la pone el sistema).
  $('#xr-photo').hidden = !session.snapshot;
  syncBackground();
  updateLive();
  wake();
}

// ------------------------------------------------------------------ galería 360

function syncBackground() {
  const b = $('#xr-360');
  b.hidden = !HAS_GALLERY;
  b.setAttribute('aria-pressed', String(!!background));
  const sound = $('#xr-sound');
  sound.hidden = !bgCtl;
  if (bgCtl) sound.setAttribute('aria-pressed', String(!bgCtl.muted));
}

// El video no se puede ver aquí: se quita el aviso de YouTube (que no se puede
// tocar), queda el tótem y un botón para verlo en YouTube (la app también es 360).
function videoFailed(item, code) {
  const text = code === -1 ? 'No se pudo cargar el video' : youtubeError(code);
  failed.set(item.video, text);
  if (background !== item) return;
  $('#xr-bg').hidden = true;
  $('#xr-sound').hidden = true;
  toast(text);
  const yt = $('#xr-yt');
  yt.href = watchUrl(item.video);
  yt.hidden = !youtubeId(item.video);
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
    // Un video de YouTube que no se puede ver aquí se abre en YouTube.
    const yt = !!youtubeId(g.video);
    const blocked = failed.has(g.video) || missing.has(g.video);
    const onclick = blocked ? () => window.open(watchUrl(g.video), '_blank', 'noopener') : () => pickVideo(g);
    const tag = missing.has(g.video) ? 'Próximamente' : yt ? 'YouTube ↗' : 'No disponible';
    return h('li', null, h('button', { class: 'sheet__row' + (g === background ? ' is-current' : ''), type: 'button', onclick, disabled: blocked && !yt },
      h('img', { class: 'sheet__thumb', src: thumbnail(g.video) || (p ? asset(p.artista.foto) : null), alt: '' }),
      h('span', { class: 'sheet__row-num', text: p ? pad(i + 1) : '360' }),
      h('span', { class: 'sheet__row-text' }, h('strong', { text: p ? p.artista.nombre : g.titulo || '360' }), p && h('span', { text: p.lugar })),
      blocked && h('span', { class: 'sheet__row-tag sheet__row-tag--soft', text: tag }),
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
  const links = socialLinks(a);
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
      links.map(([k, url]) => h('a', { class: 'sheet__social-btn', href: url, target: '_blank', rel: 'noopener', text: (k === 'instagram' && instagramHandle(url)) || SOCIAL_LABELS[k] || k }))),
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

// El tótem muestra a quien toca (se transforma) y los faros lo marcan en rojo.
let shownLive = null;
function syncLive(k) {
  if (!holo) return;
  holo.setLive(k);
  holo.setFocus(k);
  if (faros && shownLive !== k) faros.setLive(k);
  shownLive = k;
}

function updateLive() {
  const k = liveNow();
  const box = $('#xr-live');
  box.hidden = k < 0;
  syncLive(k);
  const online = $('#xr-online');
  online.hidden = !vivo.online;
  online.textContent = vivo.online ? '· ' + vivo.online + ' en línea' : '';
  // Lanzador: quién toca ahora, antes de entrar.
  const ll = $('#launch-live');
  const lk = liveIndex(Date.now());
  ll.hidden = lk < 0 || (!IS_MOBILE && !PREVIEW);
  if (lk >= 0) {
    ll.replaceChildren('En vivo · ', h('strong', { text: POINTS[lk].artista.nombre }), ' · ' + POINTS[lk].lugar + (vivo.online ? ' · ' + vivo.online + ' en línea' : ''));
  }
  if (k < 0) return;
  const p = POINTS[k];
  $('#xr-live-name').textContent = p.artista.nombre;
  $('#xr-live-place').textContent = p.lugar;
  box.dataset.index = k;
  box.setAttribute('aria-label', 'En vivo: ' + p.artista.nombre + ', ' + p.lugar);
}

// ------------------------------------------------------------------ director, avisos y reacciones

let avisoTimer = 0;
let lastAviso = 0;
try { lastAviso = Number(sessionStorage.getItem('irrumpe:aviso') || 0); } catch (e) { /* sin almacenamiento */ }
function showAviso(text) {
  clearTimeout(avisoTimer);
  ['#xr-aviso', '#launch-aviso'].forEach((sel) => {
    const el = $(sel);
    el.textContent = text;
    el.hidden = false;
  });
  // Vibrar solo si la persona ya tocó la página (si no, el navegador lo bloquea).
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([20, 60, 20]);
  avisoTimer = setTimeout(() => { $('#xr-aviso').hidden = true; $('#launch-aviso').hidden = true; }, 7000);
}

function startVivo() {
  if (!VIVO || !VIVO.enabled) return;
  vivo.conn = VIVO.connect({
    onState(state) {
      vivo.state = state;
      updateLive();
      const a = state.aviso;
      // Un aviso se muestra una vez, y solo si es reciente.
      if (a && a.texto && a.t > lastAviso && Date.now() - a.t < 10 * 60e3) {
        lastAviso = a.t;
        try { sessionStorage.setItem('irrumpe:aviso', String(a.t)); } catch (e) { /* sin almacenamiento */ }
        showAviso(String(a.texto).slice(0, 140));
      }
    },
    onReaction({ r, p }) {
      if (holo && (session || !$('#launch').hidden)) holo.react(r, p >= 0 && p < POINTS.length ? p : -1, true);
    },
    onPresence(n) {
      vivo.online = n;
      updateLive();
    },
  });
}

// ------------------------------------------------------------------ faros

let faros = null;
let geoWatch = null;
async function setFaros(on) {
  const btn = $('#xr-faros');
  if (!on) {
    if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
    if (faros) faros.stop();
    btn.setAttribute('aria-pressed', 'false');
    return;
  }
  if (!faros || !navigator.geolocation) { toast('Este navegador no da la ubicación'); return; }
  // En la AR anclada, el aviso de permiso del navegador puede quedar oculto:
  // si falta el permiso, se pasa al modo sin anclar (los faros se ven igual).
  let perm = 'prompt';
  try { perm = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { /* sin API de permisos */ }
  if (perm === 'denied') { toast('Sin permiso de ubicación'); return; }
  if (session && session.mode === 'xr' && perm !== 'granted') {
    pendingSwitch = { item: null, free: true, thenFaros: true };
    session.end({ silent: true });
    return;
  }
  btn.setAttribute('aria-pressed', 'true');
  faros.start();
  let first = true;
  geoWatch = navigator.geolocation.watchPosition((pos) => {
    faros.setUser(pos.coords.latitude, pos.coords.longitude);
    if (!first) return;
    first = false;
    toast('Faros: gira para encontrar los puntos');
    setTimeout(() => {
      if (faros.active && !faros.hasHeading) toast('Este celular no informa la brújula: los faros no se pueden orientar');
    }, 3000);
  }, (err) => {
    toast(err.code === 1 ? 'Sin permiso de ubicación' : 'No se pudo obtener la ubicación');
    setFaros(false);
  }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
}

// ------------------------------------------------------------------ foto

let markLogo = null;
async function takePhoto() {
  if (!session || !session.snapshot) return;
  const shot = session.snapshot();
  xrRoot.classList.remove('is-flash');
  void xrRoot.offsetWidth;
  xrRoot.classList.add('is-flash');
  setTimeout(() => xrRoot.classList.remove('is-flash'), 500);
  // Marca: logo, nombre del evento y fecha, abajo a la izquierda.
  const g = shot.getContext('2d');
  const u = shot.width / 400;
  const grad = g.createLinearGradient(0, shot.height - 90 * u, 0, shot.height);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = grad;
  g.fillRect(0, shot.height - 90 * u, shot.width, 90 * u);
  if (!markLogo && C.compania.logo) {
    markLogo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = asset(C.compania.logo); });
  }
  if (markLogo) g.drawImage(markLogo, 16 * u, shot.height - 52 * u, 34 * u, 34 * u);
  g.fillStyle = '#ece9e2';
  g.font = '800 ' + 17 * u + 'px Archivo, sans-serif';
  g.fillText((C.evento.nombre || 'IRRUMPE').toUpperCase(), 58 * u, shot.height - 32 * u);
  g.fillStyle = 'rgba(236,233,226,0.7)';
  g.font = '400 ' + 9 * u + 'px "JetBrains Mono", monospace';
  g.fillText((C.compania.nombre + ' · ' + eventDate().date + ' · ' + (C.evento.ciudad || '')).toUpperCase(), 58 * u, shot.height - 18 * u);
  g.fillStyle = '#f11b1a';
  g.fillRect(0, shot.height - 3 * u, shot.width, 3 * u);
  const blob = await new Promise((res) => shot.toBlob(res, 'image/jpeg', 0.9));
  if (!blob) return;
  const file = new File([blob], 'irrumpe.jpg', { type: 'image/jpeg' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: C.evento.nombre || 'IRRUMPE' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // la persona cerró el menú de compartir
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'irrumpe.jpg';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Foto guardada');
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
  // Muy oscuro: la AR anclada no ve el piso o el tótem salta. El modo con
  // giroscopio no necesita luz (sigue los giros, no los pasos).
  $('#xr-free').addEventListener('click', () => {
    if (!session) return;
    pendingSwitch = { item: null, free: true };
    session.end({ silent: true });
  });
  // Modo grabación: sin botones en pantalla. Se vuelve manteniendo presionado.
  $('#xr-rec').addEventListener('click', () => {
    xrRoot.classList.add('is-rec');
    closeSheet();
    toast('Mantén presionado para volver');
  });
  let press = null;
  xrRoot.addEventListener('pointerdown', (e) => {
    clearTimeout(press && press.timer);
    if (!xrRoot.classList.contains('is-rec') || !e.isPrimary) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, timer: setTimeout(() => { xrRoot.classList.remove('is-rec'); wake(); }, 700) };
  });
  const cancelPress = (e) => {
    if (!press) return;
    if (e.type === 'pointermove' && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 12) return;
    clearTimeout(press.timer);
    press = null;
  };
  ['pointermove', 'pointerup', 'pointercancel'].forEach((t) => xrRoot.addEventListener(t, cancelPress));
  $('#xr-lineup').addEventListener('click', () => (sheet.hidden || sheet.dataset.kind !== 'lineup' ? openLineup() : closeSheet()));
  $('#xr-live').addEventListener('click', () => {
    const i = Number($('#xr-live').dataset.index);
    if (!Number.isNaN(i)) openArtist(i);
  });
  $('#xr-faros').addEventListener('click', () => setFaros($('#xr-faros').getAttribute('aria-pressed') !== 'true'));
  $('#xr-photo').addEventListener('click', takePhoto);
  document.querySelectorAll('[data-react]').forEach((b) => {
    b.innerHTML = icon(b.dataset.react);
    b.addEventListener('click', () => {
      holo.react(b.dataset.react, liveNow());
      // Las reacciones llegan a todos (si es una grabación de la galería, no).
      if (vivo.conn && !background) vivo.conn.react(b.dataset.react, liveNow());
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
  checkFiles();
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
  $('#open-360').hidden = !HAS_GALLERY;
  startVivo();
  try {
    holo = await createHologram({ config: C, geo: GEO });
    faros = createFaros({ points: POINTS, scene });
    startPreview();
  } catch (e) {
    msg('Este navegador no puede mostrar 3D');
    console.error(e);
  }
  renderLauncher();
  if ((PARAMS.has('galeria') || TRY_VIDEO) && HAS_GALLERY) openLaunchSheet();
}

// Los archivos propios de la galería que aún no se subieron no se ofrecen.
function checkFiles() {
  GALLERY.forEach((g) => {
    if (youtubeId(g.video) || /^blob:/.test(g.video)) return;
    fetch(videoSrc(g.video), { method: 'HEAD' })
      .then((r) => { if (!r.ok) missing.add(g.video); })
      .catch(() => {});
  });
}

// Acceso para depurar desde la consola del navegador.
window.IrrumpeAR = {
  renderer,
  get holo() { return holo; },
  get session() { return session; },
  get route() { return route; },
  get quality() { return quality; },
  get background() { return bgCtl; },
  get faros() { return faros; },
  get vivo() { return vivo; },
  openArtist, openLineup, openGallery, closeSheet, liveIndex, enterInteractive, switchBackground, setFaros, takePhoto, showAviso,
};

boot();
