/*
 * IRRUMPE AR — modos de sesión.
 *
 * 1. WebXR (immersive-ar + hit-test): AR real. El celular detecta el suelo o
 *    una mesa y el tótem queda anclado a ese punto del mundo: uno puede
 *    acercarse, alejarse y rodearlo. Chrome en Android con ARCore
 *    (p. ej. Samsung Galaxy S24 FE).
 * 2. Ventana mágica: la cámara de fondo y el giroscopio orientan la escena.
 *    Solo sigue los giros del celular, no los pasos (el tótem no se queda
 *    anclado si uno camina). Funciona en casi cualquier celular.
 * 3. Sin cámara: igual que 2 sobre fondo oscuro. Si no hay giroscopio se mira
 *    alrededor arrastrando el dedo.
 * 4. Fondo 360: igual que 2, pero el fondo es la grabación 360 de una
 *    intervención (ver youtube360.js), que gira junto con el tótem.
 *
 * En todos los modos se puede pellizcar para cambiar el tamaño del tótem.
 * Cada modo recibe `ctx` (renderer, scene, holo y callbacks) y devuelve
 * { mode, end(), recenter(), placeAhead?() }.
 */
import * as THREE from '../vendor/three.min.js';

export async function xrSupported() {
  if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
  try { return await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { return false; }
}

// Tamaño base del tótem (1 = disco de 1,1 m de diámetro y tarjetas de 28 cm).
const BASE_SCALE = 1.35;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.2;
// Ventana mágica: la cámara virtual está a la altura de los ojos y el tótem
// se apoya 1,25 m más abajo, 2,4 m hacia adelante.
const EYE = 1.25;
const AHEAD = 2.4;

function faceOrigin(group, from) {
  group.rotation.set(0, Math.atan2(from.x - group.position.x, from.z - group.position.z), 0);
}

// Pellizcar con dos dedos cambia el tamaño. `busy` sirve para ignorar los
// toques que forman parte del gesto.
function attachPinch(el, holo) {
  const pts = new Map();
  const state = { active: false, last: 0, d0: 0, s0: 1 };
  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const down = (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      state.active = true;
      state.d0 = dist();
      state.s0 = holo.group.scale.x;
    }
  };
  const move = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.active && pts.size === 2 && state.d0 > 0) {
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.s0 * (dist() / state.d0)));
      holo.group.scale.setScalar(s);
    }
  };
  const up = (e) => {
    pts.delete(e.pointerId);
    if (state.active && pts.size < 2) {
      state.active = false;
      state.last = performance.now();
    }
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return {
    get busy() { return state.active || pts.size > 1 || performance.now() - state.last < 450; },
    dispose() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    },
  };
}

// ------------------------------------------------------------------ 1. WebXR

function makeReticle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#f11b1a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.122, 48).rotateX(-Math.PI / 2), mat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24).rotateX(-Math.PI / 2), mat);
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.166, 48).rotateX(-Math.PI / 2), mat.clone());
  outer.material.opacity = 0.35;
  g.add(ring, dot, outer);
  g.matrixAutoUpdate = false;
  g.visible = false;
  return g;
}

export async function startXR(ctx, { scale = 1 } = {}) {
  const { renderer, scene, holo } = ctx;
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'local-floor', 'anchors'],
    domOverlay: { root: ctx.overlayRoot },
  });

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  // Resolución del 3D respecto de la pantalla (la cámara del celular no cambia).
  renderer.xr.setFramebufferScaleFactor(scale);
  await renderer.xr.setSession(session);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
  const reticle = makeReticle();
  scene.add(reticle);
  holo.group.visible = false;
  scene.add(holo.group);

  const viewer = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewer });

  let placing = true;
  let searchingSince = performance.now();
  let offeredAhead = false;
  let anchor = null;
  let pendingAnchor = null;
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const rot = new THREE.Matrix4();
  const controller = renderer.xr.getController(0);
  scene.add(controller);
  const pinch = attachPinch(ctx.overlayRoot, holo);

  // Ubica el tótem en `pos` (espacio del mundo) mirando hacia el celular.
  function placeAt(pos) {
    renderer.xr.getCamera().getWorldPosition(camPos);
    holo.group.position.copy(pos);
    faceOrigin(holo.group, camPos);
    // Sobre una mesa cercana se achica; en el suelo a 2,4 m o más queda a tamaño completo.
    const dist = Math.hypot(camPos.x - pos.x, camPos.z - pos.z);
    const scale = BASE_SCALE * Math.max(0.45, Math.min(1, dist / 2.4));
    holo.group.scale.setScalar(scale);
    // Las tarjetas quedan un poco bajo la altura de los ojos, sea suelo o mesa.
    holo.setHeight((camPos.y - pos.y - 0.15) / scale);
    holo.group.visible = true;
    reticle.visible = false;
    placing = false;
    if (anchor) { try { anchor.delete(); } catch (e) { /* ya no existe */ } anchor = null; }
    pendingAnchor = pos.clone();
    ctx.onPlaced();
  }

  controller.addEventListener('select', () => {
    if (pinch.busy) return;
    if (placing) {
      if (reticle.visible) placeAt(new THREE.Vector3().setFromMatrixPosition(reticle.matrix));
      return;
    }
    rot.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rot);
    const hit = raycaster.intersectObjects(holo.cards, false)[0];
    ctx.onTap(hit ? hit.object.userData.index : -1);
  });

  renderer.setAnimationLoop((t, frame) => {
    if (frame) {
      const ref = renderer.xr.getReferenceSpace();
      if (placing) {
        const hits = frame.getHitTestResults(hitSource);
        const pose = hits.length ? hits[0].getPose(ref) : null;
        reticle.visible = !!pose;
        if (pose) reticle.matrix.fromArray(pose.transform.matrix);
        ctx.onSurface(!!pose);
        // Sala oscura o sin textura: ofrecer ponerlo al frente igual.
        if (!pose && !offeredAhead && performance.now() - searchingSince > 5000) {
          offeredAhead = true;
          ctx.onNoSurface();
        }
        if (pose) searchingSince = performance.now();
      }
      // Ancla del sistema: ARCore corrige su posición a medida que entiende el espacio.
      if (pendingAnchor && frame.createAnchor && window.XRRigidTransform) {
        const p = pendingAnchor;
        pendingAnchor = null;
        frame.createAnchor(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }), ref)
          .then((a) => { if (placing) a.delete(); else anchor = a; })
          .catch(() => {});
      }
      if (anchor && frame.trackedAnchors && frame.trackedAnchors.has(anchor)) {
        const ap = frame.getPose(anchor.anchorSpace, ref);
        if (ap) holo.group.position.set(ap.transform.position.x, ap.transform.position.y, ap.transform.position.z);
      }
    }
    ctx.onFrame(t, renderer.xr.getCamera());
    renderer.render(scene, camera);
  });

  let ended = false;
  let userEnded = false;
  // Al minimizar o bloquear, el navegador termina la sesión AR de todos modos:
  // se cierra de forma ordenada y al volver se entra con un toque.
  const onHide = () => { if (document.visibilityState === 'hidden') session.end().catch(() => {}); };
  document.addEventListener('visibilitychange', onHide);
  session.addEventListener('end', () => {
    if (ended) return;
    ended = true;
    document.removeEventListener('visibilitychange', onHide);
    renderer.setAnimationLoop(null);
    try { hitSource.cancel(); } catch (e) { /* ya cancelado */ }
    if (anchor) { try { anchor.delete(); } catch (e) { /* ya no existe */ } }
    pinch.dispose();
    scene.remove(reticle, controller);
    renderer.xr.enabled = false;
    ctx.onEnd({ unexpected: !userEnded });
  });

  return {
    mode: 'xr',
    end() {
      userEnded = true;
      session.end().catch(() => {});
    },
    // Volver a ubicar el tótem en otra superficie.
    recenter() {
      placing = true;
      offeredAhead = false;
      searchingSince = performance.now();
      holo.group.visible = false;
      if (anchor) { try { anchor.delete(); } catch (e) { /* ya no existe */ } anchor = null; }
      ctx.onSurface(false);
    },
    // Sin superficie detectada: 1,8 m al frente, a la altura aproximada del suelo.
    placeAhead() {
      const cam = renderer.xr.getCamera();
      cam.getWorldPosition(camPos);
      cam.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, -1);
      camDir.normalize().multiplyScalar(1.8);
      placeAt(new THREE.Vector3(camPos.x + camDir.x, camPos.y - 1.35, camPos.z + camDir.z));
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

// 1280×720 basta para el fondo y usa bastante menos memoria que 1080p.
const CAMERA = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

// Espera a que el video muestre un cuadro nuevo (o se rinde a los `ms`).
function nextFrame(video, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    const done = () => { clearTimeout(timer); resolve(true); };
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(done);
    } else {
      const t0 = video.currentTime;
      const check = () => (video.currentTime !== t0 ? done() : setTimeout(check, 100));
      check();
    }
  });
}

// En 360 se ignora el giro del celular sobre su propio eje (roll): el
// reproductor de YouTube no lo sigue y así el tótem y el fondo calzan.
const look = new THREE.Euler(0, 0, 0, 'YXZ');
const RAD = 180 / Math.PI;

export async function startWindow(ctx, { video, useCamera, bg }) {
  const { renderer, scene, holo, canvas } = ctx;
  let stream = null;
  let ended = false;
  let paused = false;
  let resuming = null;
  if (bg) useCamera = false;

  function stopStream() {
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    stream = null;
    video.srcObject = null;
  }
  async function startStream() {
    stopStream();
    const s = await navigator.mediaDevices.getUserMedia(CAMERA);
    if (ended || document.visibilityState !== 'visible') {
      s.getTracks().forEach((tr) => tr.stop());
      return;
    }
    stream = s;
    video.srcObject = stream;
    video.hidden = false;
    await video.play().catch(() => {});
  }
  // Al volver se reutiliza la cámara si sigue viva (así no se vuelve a pedir
  // permiso); solo si no llegan imágenes se abre de nuevo.
  async function reviveStream() {
    const track = stream && stream.getVideoTracks()[0];
    if (track && track.readyState === 'live') {
      await video.play().catch(() => {});
      if (await nextFrame(video, 1500)) return;
    }
    await startStream();
  }
  if (useCamera) await startStream();

  // Al minimizar, bloquear el celular o cambiar de app se detiene el dibujo y
  // el fondo 360. Al volver se retoma una sola vez, aunque lleguen varios avisos.
  function suspend() {
    if (ended || paused) return;
    paused = true;
    renderer.setAnimationLoop(null);
    if (bg) bg.pause();
  }
  function resume() {
    if (ended || !paused || resuming || document.visibilityState !== 'visible') return resuming;
    resuming = (async () => {
      if (useCamera) {
        try { await reviveStream(); } catch (e) { ctx.onCameraLost(); }
      }
      if (bg) bg.play();
      if (!ended && document.visibilityState === 'visible') {
        paused = false;
        renderer.setAnimationLoop(loop);
      }
    })().finally(() => { resuming = null; });
    return resuming;
  }
  const onVisibility = () => (document.visibilityState === 'visible' ? resume() : suspend());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', resume);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.01, 50);
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Campo visual parecido al de la cámara del celular (en 360, un poco más abierto).
    camera.fov = (camera.aspect < 1 ? 62 : 40) + (bg ? 10 : 0);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  scene.add(holo.group);
  holo.group.visible = true;
  const pinch = attachPinch(ctx.overlayRoot, holo);

  // Giroscopio; si no llega ningún dato, se mira arrastrando el dedo.
  let gyro = false;
  // En 360, el frente del video queda hacia donde se miraba al entrar.
  let yaw0 = 0;
  const target = new THREE.Quaternion();
  const onOrient = (e) => {
    if (e.alpha == null || e.beta == null) return;
    orientationQuaternion(target, e);
    if (!gyro) {
      gyro = true;
      camera.quaternion.copy(target);
      yaw0 = look.setFromQuaternion(target, 'YXZ').y;
      place();
      ctx.onLook('gyro');
    }
  };
  window.addEventListener('deviceorientation', onOrient);

  let yaw = 0, pitch = bg ? 0 : -0.32;
  const drag = { id: null, x: 0, y: 0, moved: 0, t: 0 };
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const onDown = (e) => {
    if (drag.id !== null) { drag.moved = 999; return; } // segundo dedo: es un pellizco
    drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.t = performance.now();
  };
  const onMove = (e) => {
    if (drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (!gyro && !pinch.busy) {
      yaw += dx * 0.005;
      pitch = Math.max(-1.3, Math.min(bg ? 1.3 : 0.6, pitch + dy * 0.005));
    }
  };
  const onUp = (e) => {
    if (drag.id !== e.pointerId) return;
    drag.id = null;
    if (pinch.busy || drag.moved > 12 || performance.now() - drag.t > 600) return;
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

  // Ubica el tótem delante de donde se está mirando.
  function place() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize().multiplyScalar(AHEAD);
    holo.group.position.set(dir.x, -EYE, dir.z);
    const scale = BASE_SCALE * 0.96;
    holo.group.scale.setScalar(scale);
    faceOrigin(holo.group, new THREE.Vector3(0, 0, 0));
    holo.setHeight((EYE - 0.15) / scale);
  }
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  place();
  const lookTimer = setTimeout(() => { if (!gyro) ctx.onLook('drag'); }, 1200);

  // Máximo 60 cuadros por segundo: en pantallas de 120 Hz no vale la pena el doble de trabajo.
  let last = 0;
  function loop(t) {
    ctx.onTick(t);
    if (t - last < 12) return;
    last = t;
    if (gyro) camera.quaternion.slerp(target, 0.35);
    else camera.quaternion.setFromEuler(look.set(pitch, yaw, 0, 'YXZ'));
    if (bg) {
      look.setFromQuaternion(camera.quaternion, 'YXZ');
      look.z = 0;
      camera.quaternion.setFromEuler(look);
      // El reproductor mide el campo visual en el lado más largo de la pantalla.
      const v = camera.fov / RAD;
      const fov = camera.aspect < 1 ? v : 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
      bg.look((look.y - yaw0) * RAD, look.x * RAD, fov * RAD, yaw0);
    }
    ctx.onFrame(t, camera);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(loop);

  return {
    mode: bg ? 'video360' : useCamera ? 'camera' : 'nocamera',
    // Promesa de la vuelta en curso (para pedir otras cosas recién después).
    get resumed() { return resuming || Promise.resolve(); },
    end({ silent } = {}) {
      if (ended) return;
      ended = true;
      clearTimeout(lookTimer);
      renderer.setAnimationLoop(null);
      pinch.dispose();
      window.removeEventListener('resize', resize);
      window.removeEventListener('deviceorientation', onOrient);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', resume);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      stopStream();
      video.hidden = true;
      if (bg) bg.dispose();
      ctx.onEnd({ unexpected: false, silent });
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
