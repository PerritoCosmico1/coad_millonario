/*
 * IRRUMPE AR — modos de sesión.
 *
 * 1. WebXR (immersive-ar + hit-test): AR real. El celular detecta el suelo o
 *    una mesa y el holograma queda anclado ahí. Chrome en Android con ARCore
 *    (p. ej. Samsung Galaxy S24 FE).
 * 2. Ventana mágica: la cámara de fondo y el giroscopio orientan la escena.
 *    No sabe dónde está el suelo, pero funciona en casi cualquier celular
 *    (iPhone incluido).
 * 3. Sin cámara: igual que 2 sobre fondo oscuro. Si no hay giroscopio se mira
 *    alrededor arrastrando el dedo.
 *
 * Cada modo recibe `ctx` (renderer, scene, holo y callbacks) y devuelve
 * { mode, end(), recenter() }.
 */
import * as THREE from '../vendor/three.min.js';

export async function xrSupported() {
  if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
  try { return await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { return false; }
}

// Cámara virtual mirando a la escena a la altura de los ojos: el holograma
// se apoya 1,25 m más abajo, a 2 m hacia adelante.
const EYE = 1.25;
const AHEAD = 2.35;

function faceOrigin(group, from) {
  group.rotation.set(0, Math.atan2(from.x - group.position.x, from.z - group.position.z), 0);
}

// ------------------------------------------------------------------ 1. WebXR

function makeReticle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#f11b1a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.1, 48).rotateX(-Math.PI / 2), mat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24).rotateX(-Math.PI / 2), mat);
  const ticks = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.135, 4, 1, 0, Math.PI * 2).rotateX(-Math.PI / 2), mat);
  g.add(ring, dot, ticks);
  g.matrixAutoUpdate = false;
  g.visible = false;
  return g;
}

export async function startXR(ctx) {
  const { renderer, scene, holo } = ctx;
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'local-floor'],
    domOverlay: { root: ctx.overlayRoot },
  });

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
  const reticle = makeReticle();
  scene.add(reticle);
  holo.group.visible = false;
  scene.add(holo.group);

  const viewer = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewer });

  let placing = true;
  const camPos = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const controller = renderer.xr.getController(0);
  scene.add(controller);

  controller.addEventListener('select', () => {
    if (placing) {
      if (!reticle.visible) return;
      holo.group.position.setFromMatrixPosition(reticle.matrix);
      renderer.xr.getCamera().getWorldPosition(camPos);
      faceOrigin(holo.group, camPos);
      // Sobre una mesa cercana el holograma se achica; en el suelo a 2 m o más queda a tamaño real.
      const dist = Math.hypot(camPos.x - holo.group.position.x, camPos.z - holo.group.position.z);
      const scale = Math.max(0.4, Math.min(1, dist / 2.2));
      holo.group.scale.setScalar(scale);
      // Las tarjetas quedan un poco bajo la altura de los ojos, sea suelo o mesa.
      holo.setHeight((camPos.y - holo.group.position.y - 0.15) / scale);
      holo.group.visible = true;
      reticle.visible = false;
      placing = false;
      ctx.onPlaced();
      return;
    }
    rot.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
    const hit = raycaster.intersectObjects(holo.cards, false)[0];
    ctx.onTap(hit ? hit.object.userData.index : -1);
  });

  renderer.setAnimationLoop((t, frame) => {
    if (frame && placing) {
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits.length ? hits[0].getPose(renderer.xr.getReferenceSpace()) : null;
      reticle.visible = !!pose;
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
      ctx.onSurface(!!pose);
    }
    ctx.onFrame(t, renderer.xr.getCamera());
    renderer.render(scene, camera);
  });

  let ended = false;
  session.addEventListener('end', () => {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    try { hitSource.cancel(); } catch (e) { /* ya cancelado */ }
    scene.remove(reticle, controller);
    renderer.xr.enabled = false;
    ctx.onEnd();
  });

  return {
    mode: 'xr',
    end: () => session.end().catch(() => {}),
    // Volver a ubicar el holograma en otra superficie.
    recenter() {
      placing = true;
      holo.group.visible = false;
      ctx.onSurface(false);
    },
  };
}

// ------------------------------------------------------------------ 2 y 3. Ventana mágica

// Orientación del dispositivo → cuaternión de cámara (como DeviceOrientationControls de three.js).
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° en X
function orientationQuaternion(out, e) {
  const d = Math.PI / 180;
  const screenAngle = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * d;
  euler.set(e.beta * d, e.alpha * d, -e.gamma * d, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(q1);
  out.multiply(q0.setFromAxisAngle(zee, -screenAngle));
  return out;
}

export async function startWindow(ctx, { video, useCamera }) {
  const { renderer, scene, holo, canvas } = ctx;
  let stream = null;
  if (useCamera) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    video.srcObject = stream;
    video.hidden = false;
    await video.play().catch(() => {});
  }

  const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 50);
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Campo visual parecido al de la cámara del celular.
    camera.fov = camera.aspect < 1 ? 62 : 40;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  scene.add(holo.group);
  holo.group.visible = true;

  // Giroscopio; si no llega ningún dato, se mira arrastrando el dedo.
  let gyro = false;
  const target = new THREE.Quaternion();
  const onOrient = (e) => {
    if (e.alpha == null || e.beta == null) return;
    orientationQuaternion(target, e);
    if (!gyro) {
      gyro = true;
      camera.quaternion.copy(target);
      place();
      ctx.onLook('gyro');
    }
  };
  window.addEventListener('deviceorientation', onOrient);

  let yaw = 0, pitch = -0.32;
  const drag = { id: null, x: 0, y: 0, moved: 0, t: 0 };
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const onDown = (e) => { drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.t = performance.now(); };
  const onMove = (e) => {
    if (drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (!gyro) {
      yaw += dx * 0.005;
      pitch = Math.max(-1.3, Math.min(0.6, pitch + dy * 0.005));
    }
  };
  const onUp = (e) => {
    if (drag.id !== e.pointerId) return;
    drag.id = null;
    if (drag.moved > 12 || performance.now() - drag.t > 600) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(holo.cards, false)[0];
    ctx.onTap(hit ? hit.object.userData.index : -1);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // Ubica el holograma delante de donde se está mirando.
  function place() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize().multiplyScalar(AHEAD);
    holo.group.position.set(dir.x, -EYE, dir.z);
    holo.group.scale.setScalar(1);
    faceOrigin(holo.group, new THREE.Vector3(0, 0, 0));
    holo.setHeight(EYE - 0.15);
  }
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  place();
  const lookTimer = setTimeout(() => { if (!gyro) ctx.onLook('drag'); }, 1200);

  renderer.setAnimationLoop((t) => {
    if (gyro) camera.quaternion.slerp(target, 0.35);
    else camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    ctx.onFrame(t, camera);
    renderer.render(scene, camera);
  });

  let ended = false;
  return {
    mode: useCamera ? 'camera' : 'nocamera',
    end() {
      if (ended) return;
      ended = true;
      clearTimeout(lookTimer);
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      window.removeEventListener('deviceorientation', onOrient);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
      video.srcObject = null;
      video.hidden = true;
      ctx.onEnd();
    },
    recenter: place,
  };
}

// iPhone: el permiso de sensores se pide desde un toque, antes de cualquier await.
export function requestMotionPermission() {
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
    return DeviceOrientationEvent.requestPermission().catch(() => 'denied');
  }
  return Promise.resolve('granted');
}
