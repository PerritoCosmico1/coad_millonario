/*
 * IRRUMPE AR — el holograma.
 *
 * Un disco con el mapa de puntos de Concepción (mismo estilo que la landing),
 * los puntos rojos con ondas, un rayo de luz desde cada punto hasta la tarjeta
 * de su artista, el título IRRUMPE, partículas y reacciones que suben.
 *
 * Todo en metros. El origen del grupo es el punto donde se "apoya" el
 * holograma (suelo o mesa); +z apunta hacia quien mira.
 */
import * as THREE from '../vendor/three.min.js';

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

const DISC_RADIUS = 0.55; // m
const MAP_RADIUS_KM = 1.75; // cuánto de la ciudad entra en el disco
const CARD_W = 0.28;
const CARD_H = CARD_W * (704 / 512);
const CARD_GAP = 0.31;

export const COLORS = { ink: '#ece9e2', red: '#f11b1a', bg: '#0b0b0b' };
const pad = (n) => String(n).padStart(2, '0');

// ------------------------------------------------------------------ utilidades de canvas

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function setFont(ctx, font, stretch) {
  ctx.font = font;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch || 'normal';
}

// Escribe con espaciado entre letras (canvas no lo soporta en todos lados).
function spacedText(ctx, text, x, y, spacing, align) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
  return total;
}

// Achica la fuente hasta que el texto quepa en `maxW`.
function fitFont(ctx, text, family, weight, size, maxW, stretch) {
  let s = size;
  do {
    setFont(ctx, weight + ' ' + s + 'px ' + family, stretch);
    if (ctx.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 16);
  return s;
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Dibuja `img` recortada para cubrir el rectángulo, en blanco y negro con tinte rojo.
function drawDuotone(ctx, img, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#151515';
  ctx.fillRect(x, y, w, h);
  if (img) {
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k, sh = h / k;
    if ('filter' in ctx) ctx.filter = 'grayscale(1) contrast(1.15) brightness(0.95)';
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ texturas

function chaikin(ring, passes) {
  let r = ring;
  for (let n = 0; n < passes; n++) {
    const out = [];
    for (let k = 0; k < r.length; k += 2) {
      const x0 = r[k], y0 = r[k + 1], x1 = r[(k + 2) % r.length], y1 = r[(k + 3) % r.length];
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    r = out;
  }
  return r;
}

// Disco: tierra como grilla de puntos, agua vacía, borde rojo con marcas.
function mapTexture(geo, center, points, toDisc) {
  const S = 1024, R = S / 2;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const kx = kmPerDegLng(center.lat);
  const px = (lng, lat) => [
    R + ((lng - center.lng) * kx / MAP_RADIUS_KM) * R,
    R - ((lat - center.lat) * KM_PER_DEG_LAT / MAP_RADIUS_KM) * R,
  ];
  const path = (rings) => {
    const p = new Path2D();
    for (const ring of rings) {
      const r = chaikin(ring, 3);
      for (let k = 0; k < r.length; k += 2) {
        const [x, y] = px(r[k], r[k + 1]);
        if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
    }
    return p;
  };

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(11, 11, 11, 0.55)';
  ctx.fillRect(0, 0, S, S);

  if (geo) {
    const land = path(geo.land), water = path(geo.water);
    // Máscara de tierra en un canvas aparte, después se "puntea".
    const m = canvas(S, S);
    const mctx = m.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.fill(land, 'evenodd');
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fill(water, 'evenodd');
    const dots = canvas(12, 12);
    const dctx = dots.getContext('2d');
    dctx.fillStyle = COLORS.ink;
    dctx.fillRect(4.5, 4.5, 3, 3);
    mctx.globalCompositeOperation = 'source-in';
    mctx.fillStyle = mctx.createPattern(dots, 'repeat');
    mctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(m, 0, 0);
    ctx.globalAlpha = 1;
    // Borde costero / riberas punteado y más brillante.
    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(236, 233, 226, 0.75)';
    ctx.stroke(water);
    ctx.setLineDash([]);
    // Agua: rayas tenues.
    ctx.save();
    ctx.clip(water, 'evenodd');
    ctx.fillStyle = 'rgba(236, 233, 226, 0.08)';
    for (let y = 0; y < S; y += 14) ctx.fillRect(0, y, S, 1.5);
    ctx.restore();
  }

  // Números junto a cada punto.
  setFont(ctx, '500 26px "JetBrains Mono", monospace');
  ctx.fillStyle = COLORS.red;
  points.forEach((p, i) => {
    const d = toDisc(p);
    const x = R + (d.x / DISC_RADIUS) * R, y = R + (d.z / DISC_RADIUS) * R;
    ctx.fillText(pad(i + 1), x + 18, y + 9);
  });
  ctx.restore();

  // Aro y marcas tipo brújula.
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(R, R, R - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let a = 0; a < 360; a += 10) {
    const len = a % 90 === 0 ? 26 : 12;
    const t = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(R + Math.sin(t) * (R - 14), R - Math.cos(t) * (R - 14));
    ctx.lineTo(R + Math.sin(t) * (R - 14 - len), R - Math.cos(t) * (R - 14 - len));
    ctx.stroke();
  }
  setFont(ctx, '500 24px "JetBrains Mono", monospace');
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'center';
  ctx.fillText('N', R, 62);
  return texture(c);
}

function cardTexture(point, index, total, img) {
  const W = 512, H = 704;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(236, 233, 226, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, W, 6);

  setFont(ctx, '500 20px "JetBrains Mono", monospace');
  ctx.fillStyle = COLORS.red;
  spacedText(ctx, pad(index + 1) + ' / ' + pad(total), 28, 46, 3);
  ctx.fillStyle = 'rgba(236, 233, 226, 0.45)';
  spacedText(ctx, 'IRRUMPE', W - 28, 46, 4, 'right');

  drawDuotone(ctx, img, 28, 66, W - 56, W - 56);

  const name = point.artista.nombre.toUpperCase();
  ctx.fillStyle = COLORS.ink;
  fitFont(ctx, name, 'Archivo, sans-serif', 800, 58, W - 56, 'expanded');
  ctx.fillText(name, 28, 590);

  setFont(ctx, '400 18px "JetBrains Mono", monospace');
  ctx.fillStyle = 'rgba(236, 233, 226, 0.66)';
  spacedText(ctx, point.lugar.toUpperCase(), 28, 628, 2);
  ctx.fillStyle = COLORS.red;
  spacedText(ctx, 'TOCA PARA VER REDES  ↗', 28, 672, 3);
  return texture(c);
}

function titleTexture(config, logo) {
  const W = 1024, H = 256;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  if (logo) ctx.drawImage(logo, W / 2 - 26, 8, 52, 52);
  setFont(ctx, '400 22px "JetBrains Mono", monospace');
  ctx.fillStyle = 'rgba(236, 233, 226, 0.7)';
  spacedText(ctx, (config.compania.nombre + ' presenta').toUpperCase(), W / 2, 100, 6, 'center');
  ctx.fillStyle = COLORS.ink;
  setFont(ctx, '800 110px Archivo, sans-serif', 'expanded');
  spacedText(ctx, (config.evento.nombre || 'IRRUMPE').toUpperCase(), W / 2, 220, 26, 'center');
  return texture(c);
}

function badgeTexture() {
  const c = canvas(256, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(34, 32, 9, 0, Math.PI * 2);
  ctx.fill();
  setFont(ctx, '500 28px "JetBrains Mono", monospace');
  spacedText(ctx, 'EN VIVO', 60, 42, 5);
  return texture(c);
}

// Iconos de reacción (corazón, chispa, rayo) como trazos SVG en un cuadro de 100×100.
// Se usan tanto en los botones (SVG) como en las partículas 3D (Path2D).
export const REACTIONS = {
  corazon: 'M50 84C12 58 6 34 22 22C34 12 46 18 50 30C54 18 66 12 78 22C94 34 88 58 50 84Z',
  chispa: 'M50 6Q56 44 94 50Q56 56 50 94Q44 56 6 50Q44 44 50 6Z',
  rayo: 'M58 4L20 56L46 56L38 96L80 40L54 40Z',
};
function reactionTexture(kind) {
  const c = canvas(100, 100);
  const ctx = c.getContext('2d');
  ctx.shadowColor = COLORS.red;
  ctx.shadowBlur = 14;
  ctx.fillStyle = kind === 'chispa' ? COLORS.ink : COLORS.red;
  ctx.fill(new Path2D(REACTIONS[kind] || REACTIONS.corazon));
  return texture(c);
}

// ------------------------------------------------------------------ holograma

export async function createHologram({ config, geo }) {
  const points = config.puntos || [];
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const kx = kmPerDegLng(center.lat);
  const toDisc = (p) => ({
    x: ((p.lng - center.lng) * kx / MAP_RADIUS_KM) * DISC_RADIUS,
    z: -((p.lat - center.lat) * KM_PER_DEG_LAT / MAP_RADIUS_KM) * DISC_RADIUS,
  });

  // Las fuentes tienen que estar cargadas antes de dibujar en canvas.
  if (document.fonts) {
    await Promise.race([
      Promise.all([
        document.fonts.load('800 60px Archivo'),
        document.fonts.load('400 20px "JetBrains Mono"'),
        document.fonts.load('500 20px "JetBrains Mono"'),
      ]).catch(() => {}),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  }
  const [logo, ...photos] = await Promise.all([
    loadImage(config.compania.logo ? '../' + config.compania.logo : null),
    ...points.map((p) => loadImage(p.artista.foto ? '../' + p.artista.foto : null)),
  ]);

  const group = new THREE.Group();
  group.name = 'irrumpe';
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });

  // Disco con el mapa.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(DISC_RADIUS, 96),
    new THREE.MeshBasicMaterial({ map: mapTexture(geo, center, points, toDisc), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.003;
  disc.userData.role = 'disc';
  group.add(disc);

  // Brillo bajo el disco.
  const glow = new THREE.Mesh(new THREE.RingGeometry(DISC_RADIUS, DISC_RADIUS + 0.06, 96), additive(COLORS.red, 0.18));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.002;
  glow.userData.role = 'glow';
  group.add(glow);

  // Disposición de las tarjetas: en fila, detrás del disco, ordenadas de oeste a este
  // para que los rayos no se crucen.
  const order = points.map((p, i) => i).sort((a, b) => points[a].lng - points[b].lng);
  const slot = new Map(order.map((idx, k) => [idx, k]));

  const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  const pins = [];
  const cards = [];
  const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  points.forEach((p, i) => {
    const d = toDisc(p);
    const pin = new THREE.Group();
    pin.position.set(d.x, 0.006, d.z);
    pin.userData = { role: 'pin', index: i };
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.red }));
    core.position.y = 0.008;
    pin.add(core);
    const rings = [0, 1].map(() => {
      const r = new THREE.Mesh(ringGeo, additive(COLORS.red, 0));
      r.rotation.x = -Math.PI / 2;
      pin.add(r);
      return r;
    });
    group.add(pin);

    const k = slot.get(i);
    const card = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({
      map: cardTexture(p, i, points.length, photos[i]), transparent: true, side: THREE.DoubleSide,
    }));
    card.position.set((k - (points.length - 1) / 2) * CARD_GAP, 1, -0.32 - Math.abs(k - (points.length - 1) / 2) * 0.06);
    card.userData = { role: 'card', index: i };
    group.add(card);

    // Rayo desde el punto hasta la base de la tarjeta.
    const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({
      color: COLORS.red, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    beam.userData = { role: 'beam', index: i };
    group.add(beam);

    pins.push({ group: pin, core, rings });
    cards.push({ mesh: card, beam, base: card.position.clone(), index: i });
  });

  // Título flotante.
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.18),
    new THREE.MeshBasicMaterial({ map: titleTexture(config, logo), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  title.userData.role = 'title';
  group.add(title);

  // Insignia "EN VIVO" que se mueve a la tarjeta del artista que está tocando.
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.0275),
    new THREE.MeshBasicMaterial({ map: badgeTexture(), transparent: true, side: THREE.DoubleSide }),
  );
  badge.userData.role = 'badge';
  group.add(badge);

  // Partículas rojas y blancas que suben.
  const N = 260;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const red = new THREE.Color(COLORS.red), ink = new THREE.Color(COLORS.ink);
  for (let n = 0; n < N; n++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * DISC_RADIUS * 1.2;
    pos.set([Math.cos(a) * r, Math.random() * 1.4, Math.sin(a) * r], n * 3);
    (Math.random() < 0.7 ? red : ink).toArray(col, n * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = canvas(32, 32);
  const dctx = dot.getContext('2d');
  const grad = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 32, 32);
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.012, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.userData.role = 'dust';
  group.add(dust);

  // Reacciones: pool de sprites.
  const reactionMats = Object.fromEntries(Object.keys(REACTIONS).map((k) => [k, new THREE.SpriteMaterial({
    map: reactionTexture(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })]));
  const floating = [];

  let height = 1.1;
  let selected = -1;
  let live = -1;
  const tmp = new THREE.Vector3();

  const api = {
    group,
    cards: cards.map((c) => c.mesh),

    // Alto de las tarjetas sobre el disco (se ajusta a la altura de los ojos).
    setHeight(h) {
      height = Math.max(0.35, Math.min(1.6, h));
      dust.scale.y = (height + 0.4) / 1.4;
      title.position.set(0, height + CARD_H / 2 + 0.16, -0.44);
      cards.forEach((c) => {
        c.base.y = height;
        c.mesh.position.y = height;
      });
    },

    select(i) { selected = i; },
    setLive(i) { live = i; },

    react(kind, from) {
      const mat = reactionMats[kind] || reactionMats.corazon;
      const s = new THREE.Sprite(mat.clone());
      const src = from != null && from >= 0 ? pins[from].group.position : new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.4);
      s.position.set(src.x + (Math.random() - 0.5) * 0.08, 0.05, src.z + (Math.random() - 0.5) * 0.08);
      s.scale.setScalar(0.07 + Math.random() * 0.04);
      s.userData = { t0: performance.now(), dx: (Math.random() - 0.5) * 0.2, spin: (Math.random() - 0.5) * 2 };
      group.add(s);
      floating.push(s);
    },

    // camera: cámara activa (para que las tarjetas la miren); level: 0..1 intensidad de la música.
    update(t, camera, level) {
      const sec = t / 1000;
      // Ondas en cada punto.
      pins.forEach((pin, i) => {
        const boost = i === live ? 1.6 : 1;
        pin.rings.forEach((r, k) => {
          const ph = ((sec * 0.55 + k * 0.5 + i * 0.17) % 1);
          const s = (0.015 + ph * 0.11 * boost) * (1 + level * 0.6);
          r.scale.set(s, s, s);
          r.material.opacity = (1 - ph) * (0.35 + level * 0.65) * (i === live ? 1 : 0.7);
        });
        pin.core.scale.setScalar(1 + level * 0.8 + (i === selected ? 0.5 : 0));
      });

      camera.getWorldPosition(tmp);
      group.worldToLocal(tmp);

      cards.forEach((c, k) => {
        const m = c.mesh;
        const sel = c.index === selected;
        m.position.y = c.base.y + Math.sin(sec * 0.9 + k) * 0.012;
        // Mirar a la cámara solo en el eje vertical.
        m.rotation.y = Math.atan2(tmp.x - m.position.x, tmp.z - m.position.z);
        const target = sel ? 1.12 : 1;
        m.scale.setScalar(m.scale.x + (target - m.scale.x) * 0.15);
        m.material.opacity = selected >= 0 && !sel ? 0.55 : 1;
        // Rayo: del punto a la base de la tarjeta.
        const a = pins[c.index].group.position;
        const arr = c.beam.geometry.attributes.position.array;
        arr[0] = a.x; arr[1] = 0.01; arr[2] = a.z;
        arr[3] = m.position.x; arr[4] = m.position.y - (CARD_H / 2) * m.scale.y; arr[5] = m.position.z;
        c.beam.geometry.attributes.position.needsUpdate = true;
        c.beam.material.opacity = (c.index === live ? 0.65 : 0.3) + level * 0.35 + (sel ? 0.2 : 0);
      });

      title.rotation.y = Math.atan2(tmp.x - title.position.x, tmp.z - title.position.z);
      title.position.y = height + CARD_H / 2 + 0.16 + Math.sin(sec * 0.6) * 0.01;

      badge.visible = live >= 0;
      if (live >= 0) {
        const m = cards[live].mesh;
        badge.position.set(m.position.x, m.position.y + (CARD_H / 2) * m.scale.y + 0.03, m.position.z);
        badge.rotation.y = m.rotation.y;
      }

      // Partículas.
      const arr = dustGeo.attributes.position.array;
      const top = height + 0.4;
      for (let n = 0; n < N; n++) {
        arr[n * 3 + 1] += 0.0012 + level * 0.006;
        if (arr[n * 3 + 1] > top) arr[n * 3 + 1] = 0;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dust.material.size = 0.011 + level * 0.012;

      // Reacciones.
      const now = performance.now();
      for (let n = floating.length - 1; n >= 0; n--) {
        const s = floating[n];
        const life = (now - s.userData.t0) / 2600;
        if (life >= 1) {
          group.remove(s);
          s.material.dispose();
          floating.splice(n, 1);
          continue;
        }
        s.position.y = 0.05 + life * (height + 0.2);
        s.position.x += s.userData.dx * 0.004 * Math.sin(life * 9);
        s.material.rotation = life * s.userData.spin;
        s.material.opacity = life < 0.15 ? life / 0.15 : 1 - (life - 0.15) / 0.85;
      }
    },
  };
  api.setHeight(height);
  return api;
}
