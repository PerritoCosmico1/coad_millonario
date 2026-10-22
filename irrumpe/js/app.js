/*
 * IRRUMPE — landing.
 *
 * Lee el contenido de window.IRRUMPE_CONFIG (js/config.js) y la costa de
 * window.IRRUMPE_GEO (js/concepcion-geo.js). Script clásico, sin módulos ni
 * build: funciona incluso abriendo index.html directo desde el disco.
 */
(function () {
  'use strict';

  const C = window.IRRUMPE_CONFIG;
  const GEO = window.IRRUMPE_GEO;
  const POINTS = C.puntos || [];

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Colores de marca: se leen de las variables de styles.css para no duplicarlos.
  const rootStyle = getComputedStyle(document.documentElement);
  const INK = rootStyle.getPropertyValue('--ink').trim() || '#ece9e2';
  const RED = rootStyle.getPropertyValue('--red').trim() || '#f11b1a';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const narrow = matchMedia('(max-width: 720px)');

  // Crea un elemento. attrs admite `class`, `text`, `on<evento>` y atributos normales.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c != null && c !== false) el.append(c);
    }
    return el;
  }

  // ------------------------------------------------------------------ tiempo

  const TZ = C.evento.zonaHoraria || 'America/Santiago';
  const START = new Date(C.evento.inicio).getTime();
  const END = C.evento.fin ? new Date(C.evento.fin).getTime() : START + 4 * 3600e3;

  // Fecha en hora de Chile sin importar dónde esté quien visita.
  function dateParts(ms) {
    const parts = new Intl.DateTimeFormat('es-CL', {
      timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(ms));
    const o = {};
    for (const p of parts) o[p.type] = p.value;
    o.weekday = o.weekday.replace('.', '').slice(0, 3).toUpperCase();
    return o;
  }

  // ------------------------------------------------------------------ marca

  function fillBrand() {
    const name = C.evento.nombre || 'IRRUMPE';
    document.title = name + ' — ' + C.compania.nombre;
    $('#event-name').textContent = name;
    document.querySelectorAll('[data-event-name]').forEach((el) => { el.textContent = name; });
    $('#brand-name').textContent = C.compania.nombre;
    const brand = $('#brand');
    if (C.compania.web) brand.href = C.compania.web;
    else brand.removeAttribute('target');
    const logo = $('#brand-logo');
    logo.src = C.compania.logo;
    logo.alt = C.compania.nombre;
    logo.addEventListener('error', () => { logo.hidden = true; });

    const d = dateParts(START);
    const date = $('#event-date');
    date.replaceChildren(
      d.weekday + ' ' + d.day + '.' + d.month + '.' + d.year,
      h('span', { class: 'sep', 'aria-hidden': 'true', text: '·' }),
      d.hour + ':' + d.minute,
      h('span', { class: 'sep', 'aria-hidden': 'true', text: '·' }),
      C.evento.ciudad || 'Concepción',
    );
  }

  // ------------------------------------------------------------------ cuenta regresiva

  const countdown = {
    nums: {},
    state: null,
    lastLabel: '',

    init() {
      document.querySelectorAll('.countdown__num').forEach((el) => { this.nums[el.dataset.unit] = el; });
      this.tick();
      setInterval(() => this.tick(), 1000);
    },

    tick() {
      const now = Date.now();
      const state = now >= END ? 'ended' : now >= START ? 'live' : 'soon';
      if (state !== this.state) {
        this.state = state;
        const live = $('#live-state');
        $('#countdown').hidden = state !== 'soon';
        live.hidden = state === 'soon';
        if (state === 'live') live.textContent = 'En vivo';
        if (state === 'ended') live.textContent = 'Ya irrumpió';
        // El alto del hero cambia: el mapa tiene que volver a encuadrar.
        if (map.ready) map.layout();
      }
      if (state !== 'soon') return;

      let s = Math.max(0, Math.floor((START - now) / 1000));
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      for (const k in v) {
        const t = pad(v[k]);
        if (this.nums[k].textContent !== t) this.nums[k].textContent = t;
      }
      const label = 'Faltan ' + v.d + ' días, ' + v.h + ' horas y ' + v.m + ' minutos';
      if (label !== this.lastLabel) {
        this.lastLabel = label;
        $('#countdown').setAttribute('aria-label', label);
      }
    },
  };

  // ------------------------------------------------------------------ mapa

  const KM_PER_DEG_LAT = 110.574;

  // Suaviza un anillo [lng, lat, ...] con el algoritmo de Chaikin: los datos
  // vienen simplificados y sin esto lagunas y riberas se ven como triángulos.
  function chaikin(ring, passes) {
    let r = ring;
    for (let n = 0; n < passes; n++) {
      const out = [];
      const len = r.length;
      for (let k = 0; k < len; k += 2) {
        const x0 = r[k], y0 = r[k + 1];
        const x1 = r[(k + 2) % len], y1 = r[(k + 3) % len];
        out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
      }
      r = out;
    }
    return r;
  }
  const SMOOTH = GEO && {
    land: GEO.land.map((r) => chaikin(r, 3)),
    water: GEO.water.map((r) => chaikin(r, 3)),
  };
  const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

  // Única etiqueta del mapa: el río, que es lo que más ubica a Concepción.
  // `to` define un segundo punto para orientar el texto.
  const GEO_LABELS = [
    { text: 'Río Biobío', lat: -36.8425, lng: -73.0685, to: [-36.832, -73.0765], kind: 'water' },
  ];

  const map = {
    ready: false,
    pins: [],
    labels: [],
    pointer: null,

    init() {
      this.el = $('#map');
      this.base = $('#map-base');
      this.fx = $('#map-fx');
      this.layer = $('#map-layer');
      this.bctx = this.base.getContext('2d');
      this.fctx = this.fx.getContext('2d');

      for (const l of GEO_LABELS) {
        const el = h('span', { class: 'geo-label' + (l.kind ? ' geo-label--' + l.kind : ''), text: l.text, 'aria-hidden': 'true' });
        this.layer.append(el);
        this.labels.push({ ...l, el });
      }

      POINTS.forEach((p, i) => {
        const el = h('button', {
          class: 'pin',
          type: 'button',
          style: '--delay:' + (i * 0.7).toFixed(1) + 's',
          'aria-label': pad(i + 1) + ' · ' + p.lugar + ' · ' + p.artista.nombre,
        },
        h('span', { class: 'pin__ring' }),
        h('span', { class: 'pin__ring' }),
        h('span', { class: 'pin__cross' }),
        h('span', { class: 'pin__core' }),
        h('span', { class: 'pin__tag', text: pad(i + 1) }));
        this.layer.append(el);
        this.pins.push({ el, x: 0, y: 0 });
      });

      this.layout();
      this.ready = true;
      requestAnimationFrame((t) => this.frame(t));
    },

    project(lat, lng) {
      return this.projectWith(this, lat, lng);
    },

    // Proyecta con una vista cualquiera {s, cx, cy} (escala en px/km y centro en pantalla).
    projectWith(v, lat, lng) {
      return { x: v.cx + (lng - this.lng0) * this.kx * v.s, y: v.cy - (lat - this.lat0) * KM_PER_DEG_LAT * v.s };
    },

    // Caja que ocupan los pins (con halo y etiqueta "01") en una vista dada.
    pinBounds(v) {
      const pts = POINTS.map((p) => this.projectWith(v, p.lat, p.lng));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      return { x0: Math.min(...xs) - 26, x1: Math.max(...xs) + 58, y0: Math.min(...ys) - 26, y1: Math.max(...ys) + 26 };
    },

    // Vista en la que todos los pins caben dentro del rectángulo libre f. Mueve lo
    // mínimo y solo aleja el mapa si el grupo de puntos no cabe a escala normal.
    fitView(f) {
      const home = this.home;
      const bb = this.pinBounds(home);
      const k = Math.min(1, (f.right - f.left) / (bb.x1 - bb.x0), (f.bottom - f.top) / (bb.y1 - bb.y0));
      const bcx = (bb.x0 + bb.x1) / 2, bcy = (bb.y0 + bb.y1) / 2;
      let nx = (f.left + f.right) / 2, ny = (f.top + f.bottom) / 2;
      if (k === 1) {
        nx = bcx + Math.max(0, f.left - bb.x0) + Math.min(0, f.right - bb.x1);
        ny = bcy + Math.max(0, f.top - bb.y0) + Math.min(0, f.bottom - bb.y1);
      }
      // x' = cx' + (x − cx)·k  ⇒  cx' = nx − (bcx − cx)·k
      return { s: home.s * k, cx: nx - (bcx - home.cx) * k, cy: ny - (bcy - home.cy) * k };
    },

    // Cambia la vista; con animación el mapa se desliza (y se redibuja) en ~0,5 s.
    setView(v, animate) {
      const same = Math.abs(v.s - this.s) < 1e-6 && Math.abs(v.cx - this.cx) < 0.5 && Math.abs(v.cy - this.cy) < 0.5;
      if (same && !this.anim) return;
      if (!animate || reducedMotion.matches) {
        this.anim = null;
        this.applyView(v, true);
        return;
      }
      this.anim = { from: { s: this.s, cx: this.cx, cy: this.cy }, to: v, t0: performance.now(), dur: 520 };
    },

    applyView(v, final) {
      this.s = v.s;
      this.cx = v.cx;
      this.cy = v.cy;
      this.rasterize(this.sp);
      this.drawBase();
      this.placeOverlay(final);
    },

    unproject(x, y) {
      return { lat: this.lat0 - (y - this.cy) / (KM_PER_DEG_LAT * this.s), lng: this.lng0 + (x - this.cx) / (this.kx * this.s) };
    },

    // Encuadre: los puntos quedan centrados en la franja libre entre la cuenta
    // regresiva y el índice, con aire suficiente para que se lea la geografía.
    layout() {
      const W = (this.W = this.el.clientWidth);
      const H = (this.H = this.el.clientHeight);
      const dpr = (this.dpr = Math.min(window.devicePixelRatio || 1, 2));
      const small = narrow.matches;

      // Se mide con el hero y el índice en su estado normal (no el compacto
      // que se usa en celular mientras hay una tarjeta abierta).
      const sheet = document.body.classList.contains('is-sheet');
      if (sheet) document.body.classList.remove('is-sheet');
      const stageTop = this.el.getBoundingClientRect().top;
      const heroBottom = $('#hero').getBoundingClientRect().bottom - stageTop;
      const index = $('#index');
      const indexTop = index.offsetParent ? index.getBoundingClientRect().top - stageTop : H;
      if (sheet) document.body.classList.add('is-sheet');
      const top = heroBottom + (small ? 36 : 44);
      const bottom = Math.min(H - 40, indexTop - (small ? 28 : 24));
      const side = small ? 34 : W * 0.16;

      const lats = POINTS.map((p) => p.lat);
      const lngs = POINTS.map((p) => p.lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      this.lat0 = (minLat + maxLat) / 2;
      this.lng0 = (minLng + maxLng) / 2;
      this.kx = kmPerDegLng(this.lat0);

      const wKm = Math.max((maxLng - minLng) * this.kx, 0.6);
      const hKm = Math.max((maxLat - minLat) * KM_PER_DEG_LAT, 0.6);
      const availW = Math.max(W - side * 2, 120);
      const availH = Math.max(bottom - top, 120);
      // px por km. El factor deja ver río, lagunas y bahía alrededor de los
      // puntos; entre ~4,5 km (celular) / ~11 km (escritorio) y ~26 km de ancho visible.
      const zoom = small ? 0.6 : 0.42;
      const s = clamp(Math.min(availW / wKm, availH / hKm) * zoom, W / 26, W / (small ? 4.5 : 11));
      this.home = { s, cx: W / 2, cy: top + availH / 2 };

      for (const c of [this.base, this.fx]) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      this.bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.fctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.sp = small ? 6 : 7;
      this.anim = null;
      this.applyView(this.home, true);
      card.reposition(false);
    },

    // Convierte costa y agua en una grilla de celdas: 0 = agua, 1 = tierra, 2 = borde costero.
    rasterize(sp) {
      const W = this.W, H = this.H;
      const cols = (this.cols = Math.ceil(W / sp) + 1);
      const rows = (this.rows = Math.ceil(H / sp) + 1);
      this.sp = sp;
      this.ox = (W - (cols - 1) * sp) / 2;
      this.oy = (H - (rows - 1) * sp) / 2;
      const mask = (this.mask = new Uint8Array(cols * rows));
      if (!GEO) { mask.fill(1); return; }

      const off = this.off || (this.off = document.createElement('canvas'));
      if (off.width !== cols || off.height !== rows) {
        off.width = cols;
        off.height = rows;
      }
      const m = off.getContext('2d', { willReadFrequently: true });
      m.setTransform(1, 0, 0, 1, 0, 0);
      m.clearRect(0, 0, cols, rows);
      // Pantalla → grilla: la celda (i, j) cubre el centro ox + i·sp, oy + j·sp.
      m.setTransform(1 / sp, 0, 0, 1 / sp, 0.5 - this.ox / sp, 0.5 - this.oy / sp);
      const path = (rings) => {
        const p = new Path2D();
        for (const r of rings) {
          for (let k = 0; k < r.length; k += 2) {
            const q = this.project(r[k + 1], r[k]);
            if (k === 0) p.moveTo(q.x, q.y);
            else p.lineTo(q.x, q.y);
          }
          p.closePath();
        }
        return p;
      };
      m.fillStyle = '#fff';
      m.fill(path(SMOOTH.land), 'evenodd');
      m.fillStyle = '#000';
      m.fill(path(SMOOTH.water), 'evenodd');
      const px = m.getImageData(0, 0, cols, rows).data;
      for (let n = 0; n < cols * rows; n++) mask[n] = px[n * 4] > 127 ? 1 : 0;
      for (let j = 1; j < rows - 1; j++) {
        for (let i = 1; i < cols - 1; i++) {
          const n = j * cols + i;
          if (mask[n] && (!mask[n - 1] || !mask[n + 1] || !mask[n - cols] || !mask[n + cols])) mask[n] = 2;
        }
      }
    },

    drawBase() {
      const ctx = this.bctx;
      const { cols, rows, sp, ox, oy, mask, W, H } = this;
      ctx.clearRect(0, 0, W, H);
      const reach = Math.max(W, H) * 0.75;
      const d = 1.5;
      ctx.fillStyle = INK;
      for (let j = 0; j < rows; j++) {
        const y = oy + j * sp;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * sp;
          const v = mask[j * cols + i];
          // La luz cae hacia los bordes: el mapa se pierde en la oscuridad.
          const fall = 1 - Math.min(1, Math.hypot(x - this.cx, y - this.cy) / reach);
          if (v) {
            ctx.globalAlpha = (v === 2 ? 0.8 : 0.3) * (0.3 + 0.7 * fall);
            ctx.fillRect(x - d / 2, y - d / 2, d, d);
          } else if (j % 2 === 0) {
            // Agua: rayas horizontales muy tenues.
            ctx.globalAlpha = 0.09 * fall;
            ctx.fillRect(x - sp * 0.25, y, sp * 0.5, 0.75);
          }
        }
      }
      ctx.globalAlpha = 1;
    },

    placeOverlay(checkLabels) {
      POINTS.forEach((pt, i) => {
        const p = this.project(pt.lat, pt.lng);
        const pin = this.pins[i];
        pin.x = p.x;
        pin.y = p.y;
        pin.el.style.left = p.x + 'px';
        pin.el.style.top = p.y + 'px';
      });
      for (const l of this.labels) {
        const p = this.project(l.lat, l.lng);
        let rot = 0;
        if (l.to) {
          const q = this.project(l.to[0], l.to[1]);
          rot = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          if (rot > 90) rot -= 180;
          if (rot < -90) rot += 180;
        }
        if (checkLabels) l.el.hidden = false;
        l.el.style.left = p.x + 'px';
        l.el.style.top = p.y + 'px';
        l.el.style.setProperty('--rot', rot.toFixed(1) + 'deg');
      }
      if (!checkLabels) return;
      // Etiquetas cortadas por el borde o tapadas por la cuenta regresiva / índice / tarjeta: fuera.
      const r0 = this.el.getBoundingClientRect();
      const blockers = ['.topbar .brand', '#ar-open', '#hero .hero__kicker', '#hero .countdown', '#hero .hero__live',
        '#hero .hero__title', '#hero .hero__date', '#index', '.readout', '#card']
        .map((sel) => document.querySelector(sel))
        .filter((el) => el && !el.hidden && el.offsetParent)
        .map((el) => el.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      for (const l of this.labels) {
        const b = l.el.getBoundingClientRect();
        const out = b.left < r0.left + 8 || b.right > r0.right - 8 || b.top < r0.top + 8 || b.bottom > r0.bottom - 8;
        l.el.hidden = out || blockers.some((k) => hit(b, k));
      }
    },

    // Capa animada: la luz del cursor y las ondas rojas de cada punto.
    frame(t) {
      if (this.anim) {
        const a = this.anim;
        const p = Math.min(1, (t - a.t0) / a.dur);
        const e = 1 - Math.pow(1 - p, 3);
        const mix = (k) => a.from[k] + (a.to[k] - a.from[k]) * e;
        if (p >= 1) this.anim = null;
        this.applyView({ s: mix('s'), cx: mix('cx'), cy: mix('cy') }, p >= 1);
      }
      const ctx = this.fctx;
      ctx.clearRect(0, 0, this.W, this.H);
      if (this.pointer) this.light(this.pointer.x, this.pointer.y);
      this.ripples(reducedMotion.matches ? null : t);
      requestAnimationFrame((tt) => this.frame(tt));
    },

    // Recorre las celdas dentro de un radio alrededor de (x, y).
    eachCell(x, y, r, fn) {
      const { sp, ox, oy, cols, rows, mask } = this;
      const i0 = Math.max(0, Math.floor((x - r - ox) / sp)), i1 = Math.min(cols - 1, Math.ceil((x + r - ox) / sp));
      const j0 = Math.max(0, Math.floor((y - r - oy) / sp)), j1 = Math.min(rows - 1, Math.ceil((y + r - oy) / sp));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = ox + i * sp, cy = oy + j * sp;
          const d = Math.hypot(cx - x, cy - y);
          if (d <= r) fn(cx, cy, d, mask[j * cols + i]);
        }
      }
    },

    light(x, y) {
      const ctx = this.fctx;
      const R = 180;
      ctx.fillStyle = INK;
      this.eachCell(x, y, R, (cx, cy, d, v) => {
        if (!v) return;
        const k = 1 - d / R;
        ctx.globalAlpha = 0.6 * k * k;
        ctx.fillRect(cx - 0.9, cy - 0.9, 1.8, 1.8);
      });
      ctx.globalAlpha = 1;
    },

    ripples(t) {
      const ctx = this.fctx;
      const period = 2800;
      const maxR = narrow.matches ? 110 : 170;
      const band = 12;
      ctx.fillStyle = RED;
      this.pins.forEach((pin, i) => {
        // Brillo rojo fijo alrededor del punto.
        this.eachCell(pin.x, pin.y, 30, (cx, cy, d, v) => {
          ctx.globalAlpha = (v ? 0.55 : 0.25) * (1 - d / 30);
          ctx.fillRect(cx - 1, cy - 1, 2, 2);
        });
        if (t == null) return;
        const phase = ((t + i * 700) % period) / period;
        const r = phase * maxR;
        const strength = Math.pow(1 - phase, 1.6) * 0.9;
        this.eachCell(pin.x, pin.y, r + band, (cx, cy, d, v) => {
          const off = Math.abs(d - r);
          if (off > band) return;
          ctx.globalAlpha = strength * (1 - off / band) * (v ? 1 : 0.45);
          ctx.fillRect(cx - 1, cy - 1, 2, 2);
        });
      });
      ctx.globalAlpha = 1;
    },
  };

  // ------------------------------------------------------------------ tarjeta

  const SOCIAL_LABELS = {
    instagram: 'Instagram', spotify: 'Spotify', youtube: 'YouTube', soundcloud: 'SoundCloud',
    tiktok: 'TikTok', bandcamp: 'Bandcamp', web: 'Web',
  };

  // Spotify / YouTube / SoundCloud → URL de reproductor incrustable.
  function embedFor(url) {
    if (!url) return null;
    let m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|artist|playlist|episode)\/([A-Za-z0-9]+)/);
    if (m) return { src: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] + '?theme=0', height: 152 };
    m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (m) return { src: 'https://www.youtube-nocookie.com/embed/' + m[1], height: 0 };
    if (/soundcloud\.com\//.test(url)) {
      return { src: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + '&color=' + encodeURIComponent(RED) + '&visual=false', height: 120 };
    }
    return null;
  }

  const card = {
    el: null,
    index: -1,
    pinned: false,
    hideTimer: 0,
    audio: null,

    init() {
      this.el = $('#card');
      this.el.addEventListener('pointerenter', () => clearTimeout(this.hideTimer));
      this.el.addEventListener('pointerleave', () => { if (!this.pinned) this.scheduleClose(); });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.index >= 0) {
          const pin = map.pins[this.index].el;
          this.close();
          pin.focus();
        }
      });
      document.addEventListener('click', (e) => {
        if (this.index < 0) return;
        if (e.target.closest('.card, .pin, .index__item, dialog')) return;
        this.close();
      });
    },

    open(i, pinned) {
      clearTimeout(this.hideTimer);
      if (this.index === i && this.pinned && !pinned) return;
      const changed = this.index !== i || this.pinned !== pinned;
      if (this.index !== i) this.stopAudio();
      this.index = i;
      this.pinned = pinned;
      if (changed) this.render();
      this.el.hidden = false;
      document.body.classList.add('has-card');
      document.body.classList.toggle('is-sheet', narrow.matches);
      map.pins.forEach((p, k) => p.el.classList.toggle('is-active', k === i));
      document.querySelectorAll('.index__item').forEach((el, k) => el.classList.toggle('is-active', k === i));
      this.reposition();
    },

    close() {
      clearTimeout(this.hideTimer);
      this.stopAudio();
      this.index = -1;
      this.pinned = false;
      this.el.hidden = true;
      document.body.classList.remove('is-sheet', 'has-card');
      this.el.replaceChildren();
      map.setView(map.home, true);
      map.pins.forEach((p) => p.el.classList.remove('is-active'));
      document.querySelectorAll('.index__item').forEach((el) => el.classList.remove('is-active'));
    },

    scheduleClose() {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => { if (!this.pinned) this.close(); }, 400);
    },

    // Ubica la tarjeta sin tapar nunca ningún punto: en escritorio va al costado
    // del grupo de puntos; en celular es una hoja inferior y el mapa se reencuadra
    // en el espacio que queda libre arriba de ella.
    reposition(animate = true) {
      if (!map.ready) return;
      if (this.index < 0) { map.setView(map.home, animate); return; }
      document.body.classList.toggle('is-sheet', narrow.matches);
      const W = map.W, H = map.H, m = 16, gap = 28;
      const r0 = map.el.getBoundingClientRect();
      const heroBottom = $('#hero').getBoundingClientRect().bottom - r0.top;

      if (narrow.matches) {
        const sheetTop = H - this.el.offsetHeight;
        map.setView(map.fitView({ left: m, right: W - m, top: heroBottom + 12, bottom: sheetTop - 12 }), animate);
        return;
      }

      this.el.classList.remove('card--peek');
      let cw = this.el.offsetWidth, ch = this.el.offsetHeight;
      const bb = map.pinBounds(map.home);
      const p = POINTS[this.index];
      const home = map.projectWith(map.home, p.lat, p.lng);
      let view = map.home;
      let left, top = null;
      if (bb.x1 + gap + cw <= W - m) left = bb.x1 + gap;
      else if (bb.x0 - gap - cw >= m) left = bb.x0 - gap - cw;
      else if (this.pinned) {
        // No cabe al costado: la tarjeta va a la derecha y el mapa se corre a la izquierda.
        left = W - m - cw;
        view = map.fitView({ left: m, right: left - gap, top: Math.min(heroBottom + 12, H / 2), bottom: H - m });
      } else {
        // Solo hover en pantallas medianas: el mapa no se mueve (el punto no se
        // escapa del cursor) y se muestra una versión mínima de la tarjeta
        // (foto, nombre, lugar) debajo o encima del grupo de puntos. Con clic
        // aparece la completa.
        this.el.classList.add('card--peek');
        cw = this.el.offsetWidth;
        ch = this.el.offsetHeight;
        left = clamp(home.x - cw / 2, m, W - m - cw);
        if (bb.y1 + 20 + ch <= H - m) top = bb.y1 + 20;
        else if (bb.y0 - 20 - ch >= m) top = bb.y0 - 20 - ch;
        else left = clamp(home.x + 34 + cw <= W - m ? home.x + 34 : home.x - 34 - cw, m, W - m - cw);
      }
      if (top == null) top = clamp(map.projectWith(view, p.lat, p.lng).y - 56, m, H - ch - m);
      this.el.style.left = r0.left + left + 'px';
      this.el.style.top = r0.top + top + 'px';
      map.setView(view, animate);
    },

    stopAudio() {
      if (this.audio) { this.audio.pause(); this.audio = null; }
    },

    render() {
      const i = this.index;
      const p = POINTS[i];
      const a = p.artista;
      const mus = a.musica || {};

      const photo = a.foto
        ? h('div', { class: 'card__photo' }, h('img', {
          src: a.foto, alt: a.nombre, loading: 'lazy',
          onerror: (e) => { const box = e.target.parentNode; box.className = 'card__photo card__photo--empty'; box.replaceChildren(h('span', { text: pad(i + 1) })); },
        }))
        : h('div', { class: 'card__photo card__photo--empty', 'aria-hidden': 'true' }, h('span', { text: pad(i + 1) }));

      let play = null;
      if (mus.preview) {
        play = h('button', {
          class: 'card__play', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Escuchar adelanto', text: '▶',
          onclick: () => {
            if (this.audio) { this.stopAudio(); play.setAttribute('aria-pressed', 'false'); play.textContent = '▶'; return; }
            this.audio = new Audio(mus.preview);
            this.audio.play().catch(() => {});
            this.audio.addEventListener('ended', () => { this.audio = null; play.setAttribute('aria-pressed', 'false'); play.textContent = '▶'; });
            play.setAttribute('aria-pressed', 'true');
            play.textContent = '❚❚';
          },
        });
      }

      const music = (mus.titulo || play) && h('div', { class: 'card__music' },
        play,
        h('div', null,
          h('div', { class: 'card__music-label', text: 'Escucha' }),
          mus.url ? h('a', { href: mus.url, target: '_blank', rel: 'noopener', text: mus.titulo || 'Escuchar' }) : h('span', { text: mus.titulo }),
        ),
      );

      const embed = this.pinned && embedFor(mus.embed);
      const embedEl = embed && h('div', { class: 'card__embed' }, h('iframe', {
        src: embed.src,
        title: 'Reproductor: ' + a.nombre,
        loading: 'lazy',
        allow: 'autoplay; clipboard-write; encrypted-media; picture-in-picture',
        style: embed.height ? 'height:' + embed.height + 'px' : 'aspect-ratio:16/9',
      }));

      const links = Object.entries(a.redes || {})
        .filter(([, url]) => url)
        .map(([k, url]) => h('a', { href: url, target: '_blank', rel: 'noopener', text: SOCIAL_LABELS[k] || k }));
      const maps = 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng;

      this.el.replaceChildren(...[
        h('div', { class: 'card__bar' },
          h('span', null, h('strong', { text: pad(i + 1) }), p.hora ? ' · ' + p.hora : ''),
          h('button', { class: 'card__close', type: 'button', 'aria-label': 'Cerrar', text: '×', onclick: () => this.close() }),
        ),
        h('div', { class: 'card__head' },
          photo,
          h('div', null,
            h('h2', { class: 'card__name', text: a.nombre }),
            h('p', { class: 'card__peek-place', text: p.lugar }),
            a.genero && h('p', { class: 'card__genre', text: a.genero }),
            a.bio && h('p', { class: 'card__bio', text: a.bio }),
          ),
        ),
        music,
        embedEl,
        h('div', { class: 'card__place' },
          h('span', { class: 'card__place-name', text: p.lugar }),
          p.direccion && h('span', { class: 'card__place-meta', text: p.direccion }),
        ),
        h('div', { class: 'card__links' },
          h('a', { href: maps, target: '_blank', rel: 'noopener', text: 'Cómo llegar' }),
          links,
        ),
      ].filter(Boolean));
    },
  };

  // ------------------------------------------------------------------ interacción con pins e índice

  function bindPoints() {
    const list = $('#index-list');

    POINTS.forEach((p, i) => {
      const pin = map.pins[i].el;
      const item = h('button', { class: 'index__item', type: 'button' },
        h('span', { class: 'index__num', text: pad(i + 1) }),
        h('span', { class: 'index__name', text: p.lugar }),
        h('span', { class: 'index__time', text: p.hora || '' }));
      list.append(h('li', null, item));

      for (const el of [pin, item]) {
        // Hover muestra la tarjeta de paso; si hay una fija, se cambia solo con clic.
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !card.pinned) card.open(i, false); });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !card.pinned) card.scheduleClose(); });
        el.addEventListener('click', () => {
          if (card.index === i && card.pinned) { card.close(); return; }
          card.open(i, true);
        });
      }
      // Teclado: al enfocar se muestra la tarjeta, Enter la deja fija.
      pin.addEventListener('focus', () => { if (pin.matches(':focus-visible') && !card.pinned) card.open(i, false); });
      pin.addEventListener('blur', () => { if (!card.pinned) card.scheduleClose(); });
    });
  }

  // ------------------------------------------------------------------ linterna del cursor

  function bindPointer() {
    const stage = $('#stage');
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !finePointer.matches) return;
      const r = map.el.getBoundingClientRect();
      map.pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    stage.addEventListener('pointerleave', () => { map.pointer = null; });
  }

  // ------------------------------------------------------------------ acceso AR

  const ar = {
    init() {
      this.dialog = $('#ar-dialog');
      this.url = new URL((C.ar && C.ar.url) || 'ar/', location.href).href;
      const link = $('#ar-open');
      link.href = this.url;
      // En celular el enlace lleva directo a la AR; en computador se muestra un QR.
      link.addEventListener('click', (e) => {
        if (!finePointer.matches) return;
        e.preventDefault();
        this.open();
      });
      $('#ar-close').addEventListener('click', () => this.dialog.close());
      // Clic en el fondo oscuro cierra.
      this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.dialog.close(); });
    },

    open() {
      this.renderQR();
      card.close();
      this.dialog.showModal();
    },

    renderQR() {
      const box = $('#ar-qr');
      if (box.childElementCount || typeof window.qrcode !== 'function') return;
      const qr = window.qrcode(0, 'M');
      qr.addData(this.url);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
      }
      box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges"><path fill="#070707" d="' + d + '"/></svg>';
    },
  };

  // ------------------------------------------------------------------ arranque

  function start() {
    fillBrand();
    countdown.init();
    card.init();
    map.init();
    bindPoints();
    map.layout(); // el índice ya existe y ocupa su lugar en celular
    bindPointer();
    ar.init();

    let t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => map.layout(), 120);
    });
    // Las fuentes cambian el alto del hero: re-encuadrar cuando terminen de cargar.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => map.layout());
  }

  start();
})();
