/*
 * POLEA · Primer vuelo — datos de la tocata.
 *
 * bandas: en el orden del afiche. `hora` es la de inicio (HH:MM, hora de
 * Chile). `cinta` es la imagen recortada del afiche (polea/img/). `redes`:
 * links completos; los vacíos no aparecen.
 */
window.POLEA_CONFIG = {
  nombre: 'POLEA',
  bajada: 'Primer vuelo',
  coproduccion: 'Vieja Sorda',
  fecha: '2026-11-15',
  zonaHoraria: 'America/Santiago',
  lugar: 'Monarca',
  direccion: 'Aníbal Pinto 143, Concepción',
  // Hora en que se apaga el "en vivo" de la última banda.
  termino: '21:00',
  bandas: [
    {
      id: 'proyectada', nombre: 'Proyectada', hora: '15:15', cinta: 'img/proyectada.webp',
      redes: { instagram: 'https://www.instagram.com/proyectadaaaa/' },
    },
    {
      id: 'misigno', nombre: 'Misigno', hora: '16:00', cinta: 'img/misigno.webp',
      redes: {
        instagram: 'https://www.instagram.com/misigno.banda/',
        spotify: 'https://open.spotify.com/intl-es/artist/1Us5AFMuc4jarUiSuEcYDv',
      },
    },
    {
      id: 'engrama', nombre: 'Engrama', hora: '17:00', cinta: 'img/engrama.webp',
      redes: {
        instagram: 'https://www.instagram.com/proyectoengrama/',
        soundcloud: 'https://soundcloud.com/engrama-883861145',
      },
    },
    {
      id: 'oto', nombre: 'OTO', hora: '18:00', cinta: 'img/oto.webp',
      redes: {
        instagram: 'https://www.instagram.com/oto._banda/',
        spotify: 'https://open.spotify.com/intl-es/artist/4z1YQrQhaGqRfX56JTqpSm',
      },
    },
    {
      id: 'belle-troquet', nombre: 'Belle Troquet', hora: '19:00', cinta: 'img/belle-troquet.webp',
      redes: {
        instagram: 'https://www.instagram.com/belletroquet/',
        spotify: 'https://open.spotify.com/intl-es/artist/0sZzQY2yrSeLPmOKI03yjs',
      },
    },
    {
      id: 'navarino', nombre: 'Navarino', hora: '20:00', cinta: 'img/navarino.webp',
      redes: {
        instagram: 'https://www.instagram.com/navarinoooo/',
        spotify: 'https://open.spotify.com/intl-es/artist/1liYNhCX22v9X3gb4UDBr7',
      },
    },
  ],
};
