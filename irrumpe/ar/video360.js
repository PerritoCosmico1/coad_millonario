/*
 * IRRUMPE AR — fondo 360 con la grabación de una intervención.
 *
 * Dos fuentes posibles (ver `galeria` en js/config.js):
 *
 * - YouTube (en vivo o grabado). Un video de YouTube no se puede usar como
 *   textura 3D (viene de otro dominio), así que el reproductor oficial va a
 *   pantalla completa debajo del tótem y en cada cuadro se le indica hacia
 *   dónde mirar (setSphericalProperties), con el mismo giro que la cámara
 *   virtual. Así el fondo y el tótem se mueven juntos.
 * - Un .mp4 360 propio (equirectangular 2:1), que se dibuja en una esfera
 *   alrededor de la cámara. Calza perfecto, pero hay que alojar el archivo.
 *
 * Ambos devuelven el mismo control: look(), play(), pause(), mute(), unmute(),
 * muted, ready (promesa) y dispose().
 */
import * as THREE from '../vendor/three.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Acepta el link completo (youtu.be/…, watch?v=…, /live/…, /shorts/…) o solo el ID.
export function youtubeId(url) {
  if (!url) return null;
  if (/^[\w-]{11}$/.test(url)) return url;
  const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/(?:live|shorts|embed)\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Errores del reproductor de YouTube (onError) → texto corto.
// 101 y 150: el dueño, o un titular de derechos (por ejemplo de la música), no
// permite verlo fuera de YouTube. Se sabe recién al cargarlo incrustado.
export function youtubeError(code) {
  if (code === 101 || code === 150 || code === 152 || code === 153) return 'Este video no se puede ver fuera de YouTube';
  if (code === 100) return 'Video no encontrado o privado';
  if (code === 2) return 'Link de YouTube no válido';
  return 'No se pudo reproducir el video';
}

export const watchUrl = (url) => {
  const id = youtubeId(url);
  return id ? 'https://www.youtube.com/watch?v=' + id : url;
};

export const thumbnail = (url) => {
  const id = youtubeId(url);
  return id ? 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' : '';
};

let api = null;
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (api) return api;
  api = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { api = null; reject(new Error('No se pudo cargar YouTube')); };
    document.head.appendChild(s);
  });
  return api;
}

function youtube360(host, id, { start = 0, onChange, onError }) {
  let player = null;
  let alive = true;
  let muted = false;
  let sent = { yaw: NaN, pitch: NaN, fov: NaN };
  const el = document.createElement('div');
  host.replaceChildren(el);
  host.hidden = false;

  const giveUp = new Promise((resolve, reject) => setTimeout(() => reject(new Error('YouTube no respondió')), 12000));
  const ready = Promise.race([loadYouTubeAPI(), giveUp]).then((YT) => new Promise((resolve, reject) => {
    if (!alive) { reject(new Error('cancelado')); return; }
    const timer = setTimeout(() => reject(new Error('YouTube no respondió')), 15000);
    player = new YT.Player(el, {
      videoId: id,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3,
        start: Math.floor(start), loop: 1, playlist: id, origin: location.origin,
      },
      events: {
        onReady() {
          clearTimeout(timer);
          player.playVideo();
          // Si el navegador no deja partir con sonido, parte en silencio (siempre se permite).
          setTimeout(() => {
            if (!alive) return;
            const st = player.getPlayerState();
            if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) {
              player.mute();
              muted = true;
              player.playVideo();
              if (onChange) onChange();
            }
          }, 2500);
          resolve();
        },
        // Puede llegar antes o después de onReady (p. ej. bloqueo por derechos de la música).
        onError(e) {
          clearTimeout(timer);
          reject(new Error(youtubeError(e.data)));
          if (alive && onError) onError(e.data);
        },
      },
    });
  }));
  ready.catch(() => {});

  return {
    kind: 'youtube',
    ready,
    get muted() { return muted; },
    // Grados: yaw crece al girar a la izquierda y pitch al mirar hacia arriba
    // (igual que la cámara de three.js); fov se mide en el lado más largo.
    look(yaw, pitch, fov) {
      if (!player || !player.setSphericalProperties) return;
      yaw = ((yaw % 360) + 360) % 360;
      pitch = clamp(pitch, -90, 90);
      fov = clamp(fov, 30, 120);
      const dy = Math.abs(((yaw - sent.yaw + 540) % 360) - 180);
      if (dy < 0.1 && Math.abs(pitch - sent.pitch) < 0.1 && Math.abs(fov - sent.fov) < 0.1) return;
      sent = { yaw, pitch, fov };
      player.setSphericalProperties({ yaw, pitch, roll: 0, fov, enableOrientationSensor: false });
    },
    play() { if (player && player.playVideo) player.playVideo(); },
    pause() { if (player && player.pauseVideo) player.pauseVideo(); },
    mute() { muted = true; if (player && player.mute) player.mute(); },
    unmute() {
      muted = false;
      if (player && player.unMute) { player.unMute(); player.playVideo(); }
    },
    dispose() {
      alive = false;
      try { if (player && player.destroy) player.destroy(); } catch (e) { /* ya no existe */ }
      host.replaceChildren();
      host.hidden = true;
    },
  };
}

function file360(scene, url, { start = 0, onChange, onError }) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.playsInline = true;
  video.loop = true;
  video.preload = 'auto';
  video.src = url;
  video.addEventListener('loadedmetadata', () => { if (start) video.currentTime = start; }, { once: true });
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(30, 64, 32).scale(-1, 1, 1),
    new THREE.MeshBasicMaterial({ map: tex, depthWrite: false }),
  );
  sphere.renderOrder = -1;
  sphere.userData.role = 'video360';
  scene.add(sphere);
  let alive = true;
  let blobUrl = null;

  // Con sonido si se puede; si no, en silencio (siempre se permite).
  const play = () => video.play().catch(() => {
    if (!alive) return;
    video.muted = true;
    video.play().catch(() => {});
    if (onChange) onChange();
  });

  const ready = new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', resolve, { once: true });
    const fail = () => {
      reject(new Error('No se pudo cargar el video'));
      if (alive && onError) onError(-1);
    };
    // Si el servidor no entrega el video por partes (algunos hostings, y Safari
    // lo exige), se descarga entero una vez y se reproduce desde la memoria.
    video.addEventListener('error', async () => {
      if (!alive) return;
      if (blobUrl || url.startsWith('blob:')) { fail(); return; }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const blob = await res.blob();
        if (!alive) return;
        blobUrl = URL.createObjectURL(blob);
        video.addEventListener('error', fail, { once: true });
        video.src = blobUrl;
        play();
      } catch (e) {
        fail();
      }
    }, { once: true });
  });
  ready.catch(() => {});
  play();

  return {
    kind: 'file',
    ready,
    get muted() { return video.muted; },
    // La esfera está en la escena: solo hay que girarla para que su frente
    // quede hacia donde se miraba al entrar.
    look(yaw, pitch, fov, yaw0) { sphere.rotation.y = yaw0 - Math.PI / 2; },
    play() { video.play().catch(() => {}); },
    pause() { video.pause(); },
    mute() { video.muted = true; },
    unmute() { video.muted = false; video.play().catch(() => {}); },
    dispose() {
      alive = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      scene.remove(sphere);
      sphere.geometry.dispose();
      sphere.material.dispose();
      tex.dispose();
    },
  };
}

// item: { video: link de YouTube o .mp4, inicio?: segundos }.
// onError(código): el video no se puede reproducir aquí (código de YouTube, o -1).
export function createBackground(item, { host, scene, onChange, onError }) {
  const id = youtubeId(item.video);
  const opts = { start: item.inicio || 0, onChange, onError };
  return id ? youtube360(host, id, opts) : file360(scene, item.video, opts);
}
