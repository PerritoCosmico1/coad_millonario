/*
 * IRRUMPE AR — faros sobre la ciudad.
 *
 * Un haz de luz gigante en la dirección real de cada punto de IRRUMPE, con su
 * artista y la distancia, visible desde cualquier parte de Concepción. El que
 * está en vivo es rojo y late con la música.
 *
 * Usa el GPS (dónde estoy) y la brújula del celular (hacia dónde miro). La
 * cámara de cada modo (AR anclada o giroscopio) tiene su propio "norte"
 * arbitrario: cada cuadro se compara hacia dónde mira según la brújula con
 * hacia dónde mira según la cámara, y la diferencia (suavizada) gira los faros.
 * Como están lejos (a 70 m en la escena), basta con acertar la dirección: dar
 * unos pasos no los mueve, igual que el cielo.
 *
 * La brújula de los celulares tiene unos 10–20° de error: los faros indican
 * hacia dónde queda cada punto, no su posición exacta.
 */
import * as THREE from '../vendor/three.min.js';
import { orientationQuaternion } from './sessions.js';

const KM_PER_DEG_LAT = 110.574;
const RADIUS = 70;   // m: distancia de los faros en la escena
const HEIGHT = 160;  // m: alto del haz
const RED = new THREE.Color('#f11b1a');
const INK = new THREE.Color('#ece9e2');
const pad = (n) => String(n).padStart(2, '0');

// Distancia (km) y rumbo (radianes, desde el norte hacia el este).
export function bearing(from, to) {
  const kx = 111.32 * Math.cos((from.lat * Math.PI) / 180);
  const east = (to.lng - from.lng) * kx;
  const north = (to.lat - from.lat) * KM_PER_DEG_LAT;
  return { km: Math.hypot(east, north), rad: Math.atan2(east, north) };
}

export function formatDistance(km) {
  if (km < 1) return Math.max(10, Math.round((km * 1000) / 10) * 10) + ' m';
  return (km < 10 ? km.toFixed(1) : Math.round(km).toString()).replace('.', ',') + ' km';
}

// Haz: cilindro abierto, aditivo, que se desvanece hacia arriba.
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

function labelCanvas(point, index, distance, live) {
  const W = 640, H = 200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(7, 7, 7, 0.72)';
  g.fillRect(0, 0, W, H);
  g.fillStyle = live ? '#f11b1a' : 'rgba(236, 233, 226, 0.5)';
  g.fillRect(0, 0, 8, H);
  g.font = '500 30px "JetBrains Mono", monospace';
  g.fillStyle = '#f11b1a';
  g.fillText(pad(index + 1) + (live ? '  ● EN VIVO' : ''), 36, 52);
  g.font = '800 64px Archivo, sans-serif';
  g.fillStyle = '#ece9e2';
  let name = point.artista.nombre.toUpperCase();
  while (name.length > 3 && g.measureText(name).width > W - 70) name = name.slice(0, -2) + '…';
  g.fillText(name, 34, 122);
  g.font = '400 28px "JetBrains Mono", monospace';
  g.fillStyle = 'rgba(236, 233, 226, 0.7)';
  g.fillText((point.lugar + ' · ' + distance).toUpperCase(), 36, 172);
  return c;
}

export function createFaros({ points, scene }) {
  const group = new THREE.Group();
  group.name = 'faros';
  group.visible = false;
  scene.add(group);
  const tex = beamTexture();

  const beams = points.map((p, i) => {
    const holder = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, HEIGHT, 20, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, color: INK, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, HEIGHT, 12, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, color: INK, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    outer.position.y = core.position.y = HEIGHT / 2 - 1.6;
    const canvas = document.createElement('canvas');
    const labelTex = new THREE.CanvasTexture(canvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false }));
    label.scale.set(16, 5, 1);
    label.position.y = 7;
    holder.add(outer, core, label);
    holder.userData = { role: 'faro', index: i };
    outer.renderOrder = core.renderOrder = 20;
    label.renderOrder = 21;
    group.add(holder);
    return { holder, outer, core, label, labelTex, point: p, index: i, text: '' };
  });

  let user = null;
  let live = -1;
  let offset = null;      // giro (rad) entre el "norte" de la escena y el de la brújula
  let heading = null;     // { yaw, t }: hacia dónde mira la cámara según la brújula
  const q = new THREE.Quaternion();
  const fwd = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  // Rumbo de la cámara según la brújula, en el mismo sentido que el giro de three.js.
  const yawOf = (quat) => {
    fwd.set(0, 0, -1).applyQuaternion(quat);
    if (Math.abs(fwd.y) > 0.85) return null; // mirando al cielo o al suelo: no sirve
    return Math.atan2(-fwd.x, -fwd.z);
  };
  const onAbsolute = (e) => {
    if (e.alpha == null) return;
    const y = yawOf(orientationQuaternion(q, e));
    if (y != null) heading = { yaw: y, t: performance.now() };
  };
  // iPhone: la brújula viene como webkitCompassHeading (grados desde el norte, horario).
  const onIOS = (e) => {
    if (typeof e.webkitCompassHeading !== 'number' || e.beta == null) return;
    const alpha = (360 - e.webkitCompassHeading) % 360;
    const y = yawOf(orientationQuaternion(q, { alpha, beta: e.beta, gamma: e.gamma }));
    if (y != null) heading = { yaw: y, t: performance.now() };
  };

  function relabel(b) {
    const info = user ? bearing(user, b.point) : null;
    const text = (info ? formatDistance(info.km) : '') + '|' + (b.index === live);
    if (text === b.text) return;
    b.text = text;
    b.label.material.map.image = labelCanvas(b.point, b.index, info ? formatDistance(info.km) : '', b.index === live);
    b.label.material.map.needsUpdate = true;
  }

  function place() {
    if (!user) return;
    beams.forEach((b) => {
      const { rad } = bearing(user, b.point);
      // Norte = −z y este = +x en el sistema de la brújula.
      b.holder.position.set(Math.sin(rad) * RADIUS, 0, -Math.cos(rad) * RADIUS);
      relabel(b);
    });
  }

  let on = false;
  return {
    group,
    get active() { return on; },
    get hasHeading() { return !!heading && performance.now() - heading.t < 3000; },
    start() {
      if (on) return;
      on = true;
      window.addEventListener('deviceorientationabsolute', onAbsolute);
      window.addEventListener('deviceorientation', onIOS);
    },
    stop() {
      on = false;
      group.visible = false;
      window.removeEventListener('deviceorientationabsolute', onAbsolute);
      window.removeEventListener('deviceorientation', onIOS);
    },
    setUser(lat, lng) {
      user = { lat, lng };
      place();
    },
    setLive(i) {
      live = i;
      beams.forEach(relabel);
    },
    // Cada cuadro, con la cámara activa y la intensidad de la música (0..1).
    update(t, camera, level) {
      if (!on || !user) { group.visible = false; return; }
      camera.getWorldQuaternion(q);
      const yawScene = yawOf(q);
      if (heading && yawScene != null && performance.now() - heading.t < 600) {
        const target = yawScene - heading.yaw;
        if (offset == null) offset = target;
        // Promedio circular suave: la brújula tiembla.
        const d = Math.atan2(Math.sin(target - offset), Math.cos(target - offset));
        offset += d * 0.06;
      }
      if (offset == null) { group.visible = false; return; }
      group.visible = true;
      group.rotation.y = offset;
      // Siempre centrados en quien mira: están "en el horizonte".
      camera.getWorldPosition(camPos);
      group.position.set(camPos.x, camPos.y, camPos.z);
      const sec = t / 1000;
      beams.forEach((b) => {
        const isLive = b.index === live;
        const pulse = isLive ? 0.75 + 0.25 * Math.sin(sec * 4) + level * 0.5 : 1;
        b.outer.material.color.copy(isLive ? RED : INK);
        b.core.material.color.copy(isLive ? RED : INK);
        b.outer.material.opacity = (isLive ? 0.45 : 0.16) * pulse;
        b.core.material.opacity = (isLive ? 0.95 : 0.45) * pulse;
        b.outer.scale.x = b.outer.scale.z = isLive ? 1 + level * 0.6 : 1;
      });
    },
    dispose() {
      this.stop();
      scene.remove(group);
    },
  };
}
