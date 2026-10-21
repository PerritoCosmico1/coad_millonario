/*
 * IRRUMPE — todo el contenido editable de la página vive aquí.
 *
 * No hace falta tocar HTML, CSS ni app.js para cambiar la fecha, los puntos,
 * los artistas o los links: edita este archivo y recarga.
 *
 * ⚠ Los valores marcados con [PENDIENTE] son de ejemplo y hay que reemplazarlos
 *   con los datos reales antes de publicar.
 *
 * Fechas: formato ISO con zona horaria. En noviembre Chile continental está
 * en horario de verano (UTC-3), por eso terminan en "-03:00".
 *
 * Coordenadas: en Google Maps, clic derecho sobre el lugar → el primer ítem
 * del menú son "lat, lng". Cópialos tal cual en `lat` y `lng`.
 */
window.IRRUMPE_CONFIG = {
  evento: {
    nombre: 'IRRUMPE',
    bajada: 'Intervención musical',
    ciudad: 'Concepción',
    inicio: '2026-11-27T19:00:00-03:00', // [PENDIENTE] fecha y hora reales
    fin: '2026-11-27T23:00:00-03:00',    // [PENDIENTE] cuándo termina
    zonaHoraria: 'America/Santiago',
  },

  compania: {
    nombre: 'La Única Compañía',
    // [PENDIENTE] reemplazar por el logo oficial (SVG o PNG con fondo transparente).
    logo: 'assets/logo-la-unica-compania.svg',
    web: 'https://launicacompania.cl/',
  },

  // Acceso especial de realidad aumentada (ver ar/README.md).
  ar: {
    url: 'ar/',
    // Desde cuándo se puede entrar a la experiencia. null = al inicio del evento.
    activaDesde: null,
  },

  /*
   * Los puntos del mapa. Puede haber más o menos de cuatro.
   *
   * artista.foto:   ruta a una imagen en assets/artistas/ (ideal 800×1000, vertical).
   *                 Si se deja vacía se muestra un recuadro con el número del punto.
   * artista.redes:  cualquier red que se deje vacía ('') no aparece.
   * artista.musica: `url` es el link que se abre al hacer clic en el tema.
   *                 `embed` (opcional) es un link de Spotify o YouTube que se
   *                 incrusta como reproductor cuando la tarjeta queda fija.
   *                 `preview` (opcional) es un .mp3 corto en assets/audio/ que
   *                 se reproduce con el botón ▶ de la tarjeta.
   */
  puntos: [
    {
      id: 'plaza',
      lugar: 'Plaza de la Independencia',             // [PENDIENTE]
      direccion: 'Barros Arana con Caupolicán',
      lat: -36.8270,
      lng: -73.0503,
      hora: '19:00',
      artista: {
        nombre: 'Artista 01',                          // [PENDIENTE]
        genero: 'Electrónica / ambient',
        bio: 'Texto breve sobre el artista y lo que va a pasar en este punto. Una o dos líneas bastan.',
        foto: '',
        musica: { titulo: 'Tema por anunciar', url: 'https://open.spotify.com/', embed: '', preview: '' },
        redes: {
          instagram: 'https://www.instagram.com/',
          spotify: 'https://open.spotify.com/',
          youtube: 'https://www.youtube.com/',
          soundcloud: '',
          tiktok: '',
          web: '',
        },
      },
    },
    {
      id: 'campanil',
      lugar: 'Campanil UdeC',                          // [PENDIENTE]
      direccion: 'Universidad de Concepción',
      lat: -36.8299,
      lng: -73.0357,
      hora: '19:40',
      artista: {
        nombre: 'Artista 02',                          // [PENDIENTE]
        genero: 'Rock / experimental',
        bio: 'Texto breve sobre el artista y lo que va a pasar en este punto. Una o dos líneas bastan.',
        foto: '',
        musica: { titulo: 'Tema por anunciar', url: 'https://open.spotify.com/', embed: '', preview: '' },
        redes: {
          instagram: 'https://www.instagram.com/',
          spotify: 'https://open.spotify.com/',
          youtube: '',
          soundcloud: '',
          tiktok: '',
          web: '',
        },
      },
    },
    {
      id: 'pascualas',
      lugar: 'Laguna Las Tres Pascualas',              // [PENDIENTE]
      direccion: 'Barrio Lorenzo Arenas',
      lat: -36.8130,
      lng: -73.0386,
      hora: '20:20',
      artista: {
        nombre: 'Artista 03',                          // [PENDIENTE]
        genero: 'Hip hop / spoken word',
        bio: 'Texto breve sobre el artista y lo que va a pasar en este punto. Una o dos líneas bastan.',
        foto: '',
        musica: { titulo: 'Tema por anunciar', url: 'https://open.spotify.com/', embed: '', preview: '' },
        redes: {
          instagram: 'https://www.instagram.com/',
          spotify: 'https://open.spotify.com/',
          youtube: 'https://www.youtube.com/',
          soundcloud: '',
          tiktok: '',
          web: '',
        },
      },
    },
    {
      id: 'costanera',
      lugar: 'Costanera · Teatro Biobío',              // [PENDIENTE]
      direccion: 'Ribera norte del río Biobío',
      lat: -36.8337,
      lng: -73.0630,
      hora: '21:00',
      artista: {
        nombre: 'Artista 04',                          // [PENDIENTE]
        genero: 'Pop / synth',
        bio: 'Texto breve sobre el artista y lo que va a pasar en este punto. Una o dos líneas bastan.',
        foto: '',
        musica: { titulo: 'Tema por anunciar', url: 'https://open.spotify.com/', embed: '', preview: '' },
        redes: {
          instagram: 'https://www.instagram.com/',
          spotify: '',
          youtube: 'https://www.youtube.com/',
          soundcloud: '',
          tiktok: '',
          web: '',
        },
      },
    },
  ],
};
