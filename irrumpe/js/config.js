/*
 * IRRUMPE — todo el contenido editable de la página vive aquí.
 *
 * No hace falta tocar HTML, CSS ni app.js para cambiar la fecha, los puntos,
 * los artistas o los links: edita este archivo y recarga.
 *
 * ⚠ Lo marcado con [PENDIENTE] es provisorio o falta confirmarlo.
 *   Cualquier texto o link que se deje vacío ('') simplemente no aparece.
 *
 * Fechas: formato ISO con zona horaria. En verano Chile continental está en
 * UTC-3, por eso terminan en "-03:00".
 *
 * Coordenadas: en Google Maps, clic derecho sobre el lugar → el primer ítem
 * del menú son "lat, lng". Cópialos tal cual en `lat` y `lng`.
 */
window.IRRUMPE_CONFIG = {
  evento: {
    nombre: 'IRRUMPE',
    bajada: 'Intervención musical',
    ciudad: 'Concepción',
    inicio: '2027-02-01T17:00:00-03:00', // fecha provisoria
    fin: '2027-02-01T23:00:00-03:00',    // [PENDIENTE] hora de término
    zonaHoraria: 'America/Santiago',
  },

  compania: {
    nombre: 'La Única Compañía',
    logo: 'assets/logo-la-unica-compania.png',
    web: 'https://launicacompania.cl/',
  },

  // Acceso especial de realidad aumentada (ver ar/README.md).
  ar: {
    url: 'ar/',
    // Desde cuándo se puede entrar a la experiencia. null = al inicio del evento.
    activaDesde: null,
  },

  /*
   * Los puntos del mapa, en orden (01, 02, ...). Puede haber más o menos de cuatro.
   *
   * hora:           opcional, p. ej. '17:30'. Vacío = no se muestra.
   * artista.foto:   imagen en assets/artistas/ (cuadrada o vertical).
   * artista.genero / artista.bio: textos cortos; vacíos = no se muestran.
   * artista.redes:  links completos (https://...). Vacíos = no aparecen.
   * artista.musica: `titulo` + `url` muestran un tema destacado.
   *                 `embed` (opcional) es un link de Spotify o YouTube que se
   *                 incrusta como reproductor cuando la tarjeta queda fija.
   *                 `preview` (opcional) es un .mp3 corto en assets/audio/ que
   *                 se reproduce con el botón ▶ de la tarjeta.
   *
   * [PENDIENTE] qué artista va en qué punto (hoy siguen el orden de la web de
   * La Única Compañía) y confirmar las coordenadas exactas de cada lugar.
   */
  puntos: [
    {
      id: 'parque-ecuador',
      lugar: 'Parque Ecuador',
      direccion: 'Av. Víctor Lamas, a los pies del cerro Caracol',
      lat: -36.8320,
      lng: -73.0465,
      hora: '',
      artista: {
        nombre: 'Azga',
        genero: '',
        bio: '',
        foto: 'assets/artistas/azga.jpg',
        musica: { titulo: '', url: '', embed: '', preview: '' },
        redes: { instagram: '', spotify: '', youtube: '', soundcloud: '', tiktok: '', web: '' },
      },
    },
    {
      id: 'plaza-independencia',
      lugar: 'Plaza de la Independencia',
      direccion: 'Barros Arana con Caupolicán',
      lat: -36.8270,
      lng: -73.0503,
      hora: '',
      artista: {
        nombre: 'Surdo',
        genero: '',
        bio: '',
        foto: 'assets/artistas/surdo.jpg',
        musica: { titulo: '', url: '', embed: '', preview: '' },
        redes: { instagram: '', spotify: '', youtube: '', soundcloud: '', tiktok: '', web: '' },
      },
    },
    {
      id: 'plaza-bicentenario',
      lugar: 'Plaza Bicentenario',
      direccion: 'Barrio Cívico',
      lat: -36.8282,
      lng: -73.0609,
      hora: '',
      artista: {
        nombre: 'Yuri',
        genero: '',
        bio: '',
        foto: 'assets/artistas/yuri.jpg',
        musica: { titulo: '', url: '', embed: '', preview: '' },
        redes: { instagram: '', spotify: '', youtube: '', soundcloud: '', tiktok: '', web: '' },
      },
    },
    {
      id: 'udec',
      lugar: 'Universidad de Concepción',
      direccion: 'Campanil · Barrio Universitario',
      lat: -36.8297,
      lng: -73.0359,
      hora: '',
      artista: {
        nombre: 'Antipatriarka',
        genero: '',
        bio: '',
        foto: 'assets/artistas/antipatriarka.jpg',
        musica: { titulo: '', url: '', embed: '', preview: '' },
        redes: { instagram: '', spotify: '', youtube: '', soundcloud: '', tiktok: '', web: '' },
      },
    },
  ],
};
