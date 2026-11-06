/*
 * IRRUMPE — otros eventos y cambios hechos desde el celular.
 *
 * js/config.js es el evento principal (IRRUMPE). Aquí se agregan otros
 * eventos con el mismo formato (evento, ar, puntos, galeria); se abren con
 * `?evento=<id>` en cualquier página, por ejemplo ar/?evento=balmafest.
 * Lo que no se defina aquí se toma de config.js (compañía, logo, etc.).
 *
 * Después, si alguien editó el evento en editar.html, se aplican esos
 * cambios (guardados solo en ese celular): artistas, fotos, ubicación y
 * quién está en vivo.
 */
window.IRRUMPE_EVENTOS = {
  balmafest: {
    evento: {
      nombre: 'BALMAFEST',
      bajada: 'Música en vivo · Feria de manufactura local',
      ciudad: 'Concepción',
      inicio: '2026-11-06T16:00:00-03:00',
      fin: '2026-11-06T23:00:00-03:00', // [PENDIENTE] hora de término
      zonaHoraria: 'America/Santiago',
    },
    // Abierta todo el día. El artista "en vivo" se marca en editar.html (si
    // no, rota cada `segundosPorSet`). El modelo del iPhone es el de IRRUMPE,
    // así que en este evento el iPhone usa la cámara + giroscopio.
    ar: { prototipo: true, segundosPorSet: 120, modeloIphone: false },
    galeria: [],
    // Todos tocan en el mismo lugar. [PENDIENTE] ubicación aproximada:
    // confirmarla con "Usar mi ubicación" en editar.html, estando en el BAJ.
    puntos: [
      ['asia-menor', 'Asia Menor', 'Post-punk · Temuco', { instagram: 'https://www.instagram.com/asiamen0r/', bandcamp: 'https://asiamenor.bandcamp.com/' }],
      ['playa-gotica', 'Playa Gótica', 'Pop · post-punk', { bandcamp: 'https://playagotica.bandcamp.com/' }],
      ['el-em3', 'El EM3', 'Rap · Concepción', {}],
      ['acuario', 'Acuario', '', {}],
      ['tantos-otros-todavia', 'Tantos Otros Todavía', '', {}],
      ['de-vez-en-cuando', 'De Vez En Cuando', '', {}],
    ].map(([id, nombre, genero, redes]) => ({
      id,
      lugar: 'BAJ Biobío',
      direccion: 'Colo-Colo 1855, Concepción',
      lat: -36.8163,
      lng: -73.0586,
      hora: '',
      artista: { nombre, genero, bio: '', foto: '', musica: {}, redes },
    })),
  },
};

(function () {
  'use strict';
  const C = window.IRRUMPE_CONFIG;
  const params = new URLSearchParams(location.search);
  const id = params.get('evento');
  const E = id && window.IRRUMPE_EVENTOS[id];
  if (E) {
    for (const [k, v] of Object.entries(E)) {
      const isObj = v && typeof v === 'object' && !Array.isArray(v);
      C[k] = isObj ? Object.assign({}, C[k], v) : v;
    }
    C.id = id;
  }

  // Cambios hechos en editar.html (solo en este celular).
  C.localKey = 'irrumpe:local:' + (C.id || 'irrumpe');
  try {
    const local = JSON.parse(localStorage.getItem(C.localKey) || 'null');
    if (local && Array.isArray(local.puntos) && local.puntos.length) {
      C.puntos = local.puntos;
      C.local = true;
    }
    if (local && local.envivo) C.envivo = local.envivo;
  } catch (e) { /* sin almacenamiento: se usa el evento tal cual */ }

  // Agrega ?evento=… a un link del sitio, para no perder el evento al navegar.
  C.withEvent = (url) => {
    if (!C.id) return url;
    const u = new URL(url, location.href);
    u.searchParams.set('evento', C.id);
    return u.href;
  };
})();
