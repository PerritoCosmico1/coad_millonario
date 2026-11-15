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
    // Prototipo: la AR se abre en cualquier momento y lugar, y simula el show
    // en vivo (cada artista "toca" `segundosPorSet` segundos, en loop).
    // Para el evento real: prototipo: false.
    prototipo: true,
    segundosPorSet: 120,
    // Sin prototipo, desde cuándo se puede entrar. null = al inicio del evento.
    activaDesde: null,
  },

  /*
   * Galería 360: las transmisiones 360 de las intervenciones, para verlas
   * (en vivo o después) con el tótem encima. Se abre desde el botón 360.
   *
   * video:  link de YouTube (en vivo o grabado; tal como sale en "Compartir")
   *         o un .mp4 360 propio (equirectangular 2:1, p. ej. assets/360/azga.mp4).
   * punto:  id del punto (de `puntos`) al que corresponde; toma de ahí el
   *         artista y el lugar. Sin punto, se usa `titulo`.
   * inicio: opcional, segundo en que parte el video.
   *
   * ⚠ Antes de agregar un video de YouTube, probarlo en el celular con
   * probar-360.html: algunos no se pueden ver fuera de YouTube (por ejemplo,
   * si tienen música con derechos) y otros no son 360.
   *
   * Los puntos que todavía no tienen video aparecen como "Próximamente".
   */
  galeria: [
    // { punto: 'parque-ecuador', video: 'https://youtu.be/XXXXXXXXXXX' },
    // { punto: 'udec', video: 'assets/360/antipatriarka.mp4', inicio: 30 },
  ],

  /*
   * En vivo, en tiempo real (ver js/vivo.js y director.html): quién toca
   * ahora, avisos al público, reacciones compartidas y cuántos hay conectados.
   *
   * canal:   nombre del canal compartido. Cambiarlo deja a todos en uno nuevo.
   * clave:   llave pública del director. Solo quien tenga la llave privada
   *          que le corresponde (el archivo irrumpe-llave-director.json, que
   *          NO va en el sitio) puede cambiar quién toca o mandar avisos.
   *          Una llave nueva se crea en director.html.
   * brokers: servidores públicos de mensajes (MQTT por WebSocket), en orden.
   */
  vivo: {
    canal: 'luc-irrumpe-cb20cb7461',
    clave: { kty: 'EC', crv: 'P-256', x: 'oYG3fb4r6o6YYL73I-TiNCIoxgPpKVDiT6MX4ELggcM', y: '9GzKKz4holUfdhPPmDTKCJixN7DdzCvAMJ9w6kKWkzk' },
    brokers: ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'],
  },

  // Botones para seguir a los artistas: solo los links reales de `artista.redes`.
  // true = mientras falte un link, el botón busca el nombre del artista en esa
  // plataforma (provisorio; esas búsquedas pueden dar páginas de error).
  redesProvisorias: false,

  /*
   * Los puntos del mapa, en orden (01, 02, ...). Puede haber más o menos de cuatro.
   *
   * hora:           opcional, p. ej. '17:30'. Vacío = no se muestra.
   * artista.foto:   imagen en assets/artistas/ (cuadrada o vertical).
   * artista.genero / artista.bio: textos cortos; vacíos = no se muestran.
   * artista.redes:  links completos (https://...). Vacíos = búsqueda provisoria
   *                 (ver `redesProvisorias`) o, si está en false, no aparecen.
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
