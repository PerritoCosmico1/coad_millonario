/*
 * IRRUMPE — acceso AR (andamiaje).
 *
 * La experiencia de realidad aumentada todavía no existe. Esta página deja
 * resuelto todo lo que la rodea, para que el día que se construya solo haya
 * que implementar IrrumpeAR.start():
 *
 *   - bloqueo hasta `ar.activaDesde` (o el inicio del evento) según js/config.js
 *   - revisión de lo que soporta el celular (HTTPS, cámara, WebXR, sensores, GPS)
 *   - "Preparar mi celular": pide permisos de cámara y movimiento por adelantado
 *   - un escenario (#stage) donde montar la escena
 *
 * Agrega ?preview a la URL para saltarse el bloqueo mientras se desarrolla.
 * Ver ar/README.md para opciones de implementación.
 */
(function () {
  'use strict';

  const C = window.IRRUMPE_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');

  const START = new Date(C.evento.inicio).getTime();
  const END = C.evento.fin ? new Date(C.evento.fin).getTime() : START + 4 * 3600e3;
  const OPENS = C.ar && C.ar.activaDesde ? new Date(C.ar.activaDesde).getTime() : START;
  const PREVIEW = new URLSearchParams(location.search).has('preview');

  const stage = $('#stage');
  const video = $('#camera');
  const stageMsg = $('#stage-msg');
  let stream = null;

  // ---------------------------------------------------------------- capacidades

  const CHECKS = [
    { id: 'secure', label: 'HTTPS', test: async () => window.isSecureContext },
    { id: 'camera', label: 'Cámara', test: async () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) },
    {
      id: 'webxr',
      label: 'WebXR',
      optional: true,
      test: async () => {
        if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
        try { return await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { return false; }
      },
    },
    { id: 'motion', label: 'Sensores', test: async () => 'DeviceOrientationEvent' in window },
    { id: 'geo', label: 'GPS', optional: true, test: async () => 'geolocation' in navigator },
  ];

  async function checkSupport() {
    const result = {};
    for (const c of CHECKS) result[c.id] = await c.test();
    return result;
  }

  async function renderChecks() {
    const list = $('#checks');
    list.replaceChildren();
    // Una fila de indicadores: verde = listo, rojo = falta, hueco = opcional.
    const rows = CHECKS.map((c) => {
      const li = document.createElement('li');
      li.dataset.state = 'wait';
      li.textContent = c.label;
      list.append(li);
      return li;
    });
    const result = await checkSupport();
    CHECKS.forEach((c, i) => {
      const ok = result[c.id];
      rows[i].dataset.state = ok ? 'ok' : c.optional ? 'opt' : 'no';
      rows[i].title = ok ? 'Listo' : c.optional ? 'Opcional' : 'No disponible';
      rows[i].setAttribute('aria-label', c.label + ': ' + rows[i].title);
    });

    const note = $('#note');
    const phone = matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!result.secure) note.textContent = 'La cámara solo funciona en un sitio publicado con HTTPS (o en localhost).';
    else if (!phone) note.textContent = 'Esta experiencia está pensada para celular. Abre esta misma página desde tu teléfono.';
    else if (!result.camera) note.textContent = 'Tu navegador no permite usar la cámara. Prueba con Chrome (Android) o Safari (iPhone).';
    else note.textContent = 'Todo en orden. Vuelve a esta página la noche del evento.';
    return result;
  }

  // ---------------------------------------------------------------- permisos

  // Pide cámara (trasera) y, en iPhone, permiso de sensores. Debe llamarse desde un toque.
  async function prepareCamera() {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* el usuario puede negarlo */ }
    }
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    return stream;
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
  }

  // ---------------------------------------------------------------- experiencia

  /*
   * PUNTO DE ENTRADA DE LA EXPERIENCIA AR.
   * Recibe el elemento #stage (y la cámara ya autorizada si se preparó).
   * Reemplazar este cuerpo por la escena real (ver ar/README.md).
   */
  async function start(stageEl) {
    stageEl.dataset.mode = 'pending';
    stageMsg.textContent = 'Experiencia en construcción';
  }

  // ---------------------------------------------------------------- estado / bloqueo

  function isOpen(now) {
    return PREVIEW || (now >= OPENS && now < END);
  }

  function renderStatus() {
    const now = Date.now();
    const el = $('#status');
    const open = isOpen(now);
    el.classList.toggle('is-open', open);
    $('#enter').disabled = !open;
    if (PREVIEW) {
      el.textContent = 'Modo vista previa · bloqueo desactivado';
    } else if (now < OPENS) {
      const s = Math.floor((OPENS - now) / 1000);
      el.textContent = 'Bloqueado · se abre en ' + Math.floor(s / 86400) + 'd ' + pad(Math.floor((s % 86400) / 3600)) + 'h ' +
        pad(Math.floor((s % 3600) / 60)) + 'm ' + pad(s % 60) + 's';
    } else if (now < END) {
      el.textContent = 'Abierto · experiencia en vivo';
    } else {
      el.textContent = 'Cerrado · la noche ya pasó';
    }
  }

  // ---------------------------------------------------------------- arranque

  document.querySelectorAll('[data-event-name]').forEach((el) => { el.textContent = C.evento.nombre || 'IRRUMPE'; });
  document.title = 'Acceso AR — ' + (C.evento.nombre || 'IRRUMPE');

  renderStatus();
  setInterval(renderStatus, 1000);
  renderChecks();

  const prepare = $('#prepare');
  prepare.addEventListener('click', async () => {
    if (stream) {
      stopCamera();
      prepare.textContent = 'Preparar mi celular';
      stageMsg.textContent = 'Señal en espera';
      return;
    }
    try {
      await prepareCamera();
      prepare.textContent = 'Apagar cámara';
      stageMsg.textContent = 'Cámara lista · permisos guardados';
    } catch (e) {
      stageMsg.textContent = 'Sin acceso a la cámara';
    }
  });

  $('#enter').addEventListener('click', () => {
    if (isOpen(Date.now())) start(stage);
  });

  window.IrrumpeAR = { checkSupport, prepareCamera, stopCamera, start, isOpen };
})();
