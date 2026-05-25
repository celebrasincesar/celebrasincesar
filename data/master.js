// ══════════════════════════════════════════════════════════════════════
// MASTER CONFIG — CELEBRA SIN CESAR
// ──────────────────────────────────────────────────────────────────────
// Cambia aquí precios, textos e imágenes sin tocar ningún otro archivo.
//
// ÍNDICE:
//   ① MARCA           → nombre del negocio, WhatsApp, reseñas Google
//   ② PRECIOS JARDÍN  → arriendo según día y capacidad
//   ③ PRECIOS EXTRAS  → pack, hora adicional, aseo y niños extra
//   ④ ADICIONALES     → catálogo de servicios opcionales
//   ⑤ VITRINA         → cómo se muestran los adicionales en pantalla
// ══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────
// ① MARCA
// ─────────────────────────────────────────────────────────────────────
export const MARCA = {
  nombre:         'Celebra Sin César',
  venue:          'ALCE Kids',
  ubicacion:      'Talavera de la Reina, Las Condes, Santiago',
  whatsapp:       '56944356955',       // sin el +, sin espacios
  google_rating:  '5.0',
  google_reviews: '35',
  colores: {
    azul:    '#1565C0',
    naranja: '#F97316',
    cyan:    '#29B9E8',
  },
};


// ─────────────────────────────────────────────────────────────────────
// ② PRECIOS JARDÍN  (arriendo base según día y capacidad)
//    Formato: número sin puntos ni signos  →  180000 = $180.000
// ─────────────────────────────────────────────────────────────────────
export const PRECIOS_BASE = {

  // ── Viernes y Domingo ──────────────────────────────────────────
  independiente:     180000,  // $180.000 · hasta 10 niños · Sector Independiente
  completo_10:       225000,  // $225.000 · hasta 10 niños · Jardín Completo
  completo_20:       235000,  // $235.000 · hasta 20 niños
  completo_30:       250000,  // $250.000 · hasta 30 niños  (y más de 30)

  // ── Sábado ─────────────────────────────────────────────────────
  independiente_sab: 195000,  // $195.000 · hasta 10 niños · Sector Independiente
  completo_10_sab:   235000,  // $235.000 · hasta 10 niños · Jardín Completo
  completo_20_sab:   250000,  // $250.000 · hasta 20 niños
  completo_30_sab:   265000,  // $265.000 · hasta 30 niños  (y más de 30)

  completo_mas: 290000,       // legacy — no usar
};


// ─────────────────────────────────────────────────────────────────────
// ③ PRECIOS EXTRAS  (servicios adicionales fijos del wizard)
//    Formato: número sin puntos ni signos  →  45000 = $45.000
// ─────────────────────────────────────────────────────────────────────
export const PRECIOS_EXTRAS = {
  pack_celebra:   45000,  // $45.000 · Pack Celebra Sin Cesar (Piñata + Decoración)
  aseo_profundo:  30000,  // $30.000 · Aseo profundo de cocina
  hora_adicional: 50000,  // $50.000 · Hora extra (4 horas en total)
  nino_extra:     10000,  // $10.000 · Por cada niño adicional sobre 30
};


// ─────────────────────────────────────────────────────────────────────
// ④ ADICIONALES  (catálogo de servicios opcionales)
//
//  Para CAMBIAR UN PRECIO por capacidad de niños:
//    Cada ítem tiene un campo  precios  con 4 valores:
//      hasta10 → precio para grupos de hasta 10 niños
//      hasta20 → precio para grupos de hasta 20 niños
//      hasta30 → precio para grupos de hasta 30 niños
//      mas30   → precio para grupos de más de 30 niños
//    Ejemplo:  precios: { hasta10: 45000, hasta20: 55000, hasta30: 65000, mas30: 75000 }
//
//  Para CAMBIAR UN TEXTO:   edita  nombre:  o  desc:
//  Para CAMBIAR UNA IMAGEN: edita  imagen: '/nombre-archivo.webp'
//    → la imagen debe estar en la carpeta  /public
//
//  Campos de cada ítem:
//    id       → slug interno, no cambiar
//    nombre   → nombre visible en la web
//    precios  → objeto con precio por capacidad (ver arriba)
//    emoji    → ícono decorativo
//    imagen   → foto principal (thumbnail y fallback). Ruta desde /public
//    imagenes → GALERÍA: array de fotos para el carrusel. Opcional.
//               Si no se define, se usa solo  imagen  (comportamiento anterior).
//               Ejemplo con 3 fotos:
//                 imagenes: [
//                   '/inflable-grande-1.webp',   ← foto principal
//                   '/inflable-grande-2.webp',   ← foto 2
//                   '/inflable-grande-3.webp',   ← foto 3
//                 ],
//               El papá puede navegar entre ellas tocando la imagen en el carrusel.
//               → Las fotos deben estar en la carpeta  /public
//               → Tamaño recomendado: 1280 × 720 px  (ratio 16:9)
//    desc     → descripción corta que aparece en la tarjeta
//    gratis   → true: muestra badge "GRATIS" y precio siempre 0
// ─────────────────────────────────────────────────────────────────────
export const CATEGORIAS_ADICIONALES = [

  // ── 1. DECORACIÓN ───────────────────────────────────────────────
  {
    id: 'decoracion',
    label: 'Decoración',
    emoji: '🎨',
    imagen: '/categoria-decoracion.webp',
    desc: 'Transforma el espacio en algo completamente mágico',
    seleccionMultiple: false,
    items: [
      {
        id:     'deco-basica',
        nombre: 'Decoración Básica',
        precios: { hasta10: 30000, hasta20: 30000, hasta30: 30000, mas30: 30000 },
        emoji:  '🎀',
        imagen: '/adicional-deco-basica.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-deco-basica.webp',
          '/adicional-deco-basica-2.webp',
        ],
        desc:   'Globos de colores, manteles y vajilla temática por sexo',
      },
      {
        id:     'deco-tematica',
        nombre: 'Decoración Temática',
        precios: { hasta10: 60000, hasta20: 60000, hasta30: 60000, mas30: 60000 },
        emoji:  '🦄',
        imagen: '/adicional-deco-tematica.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-deco-tematica.webp',
          '/adicional-deco-tematica-1.webp',
          '/adicional-deco-tematica-2.webp',
          '/adicional-deco-tematica-3.webp',
        ],
        desc:   'Tu personaje favorito en globos, manteles, vasos y platos temáticos · número gigante y globos grandes incluidos',
      },
    ],
  },

  // ── 2. EXTRAS DE CELEBRACIÓN ────────────────────────────────────
  {
    id: 'extras-celebracion',
    label: 'Extras Celebración',
    emoji: '✨',
    imagen: '/categoria-extras.webp',
    desc: 'Detalles que hacen única tu fiesta',
    seleccionMultiple: true,
    highlights: [
      { texto: '💌 Invitación digital GRATIS al reservar', tipo: 'gratis' },
      { texto: '🏛️ Salón Grande disponible para tu evento', tipo: 'info' },
    ],
    items: [
      {
        id:     'ambientacion',
        nombre: 'Ambientación Completa',
        precios: { hasta10: 45000, hasta20: 45000, hasta30: 45000, mas30: 45000 },
        emoji:  '🎈',
        imagen: '/adicional-ambientacion.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-ambientacion.webp',
        ],
        desc:   'Globos, manteles, vasos y platos temáticos + número y globos grandes a juego',
      },
      {
        id:     'pinata',
        nombre: 'Piñata Temática',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 },
        emoji:  '🪅',
        imagen: '/adicional-pinata.webp',
        desc:   'Piñata artesanal con el tema de tu elección, rellena con dulces',
      },
      {
        id:     'invitacion-digital',
        nombre: 'Invitación Digital',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 },
        emoji:  '💌',
        imagen: '/adicional-invitacion.webp',
        desc:   'Diseño personalizado para compartir por WhatsApp. ¡Incluida GRATIS en tu reserva!',
        gratis: true,
      },
      {
        id:     'video-celebracion',
        nombre: 'Video 30 segundos',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 },
        emoji:  '🎥',
        imagen: '/adicional-video.webp',
        desc:   'Video editado de 30 segundos de los mejores momentos de tu celebración. Entrega a la semana siguiente.',
      },
    ],
  },

  // ── 3. ANIMACIÓN ────────────────────────────────────────────────
  {
    id: 'animacion',
    label: 'Animación',
    emoji: '🎭',
    imagen: '/categoria-animacion.webp',
    desc: 'Entretenimiento profesional que los niños recordarán',
    seleccionMultiple: false,
    items: [
      {
        id:     'animacion-full',
        nombre: 'Animación Full',
        precios: { hasta10: 95000, hasta20: 95000, hasta30: 95000, mas30: 95000 },
        emoji:  '🎉',
        imagen: '/adicional-animacion-full.webp',
        desc:   'Show completo durante toda la fiesta: juegos, pinta caritas, globoflexia, baile y sorpresas',
      },
      {
        id:     'animacion-basica',
        nombre: 'Animación Básica',
        precios: { hasta10: 65000, hasta20: 65000, hasta30: 65000, mas30: 65000 },
        emoji:  '🎪',
        imagen: '/adicional-animacion-basica.webp',
        desc:   'Juegos dirigidos, canciones y actividades para mantener a todos entretenidos',
      },
      {
        id:     'pinta-caritas',
        nombre: 'Pinta Caritas + Globoflexia',
        precios: { hasta10: 45000, hasta20: 45000, hasta30: 45000, mas30: 45000 },
        emoji:  '🎨',
        imagen: '/adicional-pinta-caritas.webp',
        desc:   'Arte facial personalizado y figuras de globos para cada niño',
      },
    ],
  },

  // ── 4. EXTRAS DE ANIMACIÓN ──────────────────────────────────────
  {
    id: 'extras-animacion',
    label: 'Extras Animación',
    emoji: '💃',
    imagen: '/categoria-extras-animacion.webp',
    desc: 'El toque especial que hace única tu fiesta',
    seleccionMultiple: true,
    items: [
      {
        id:     'kpop',
        nombre: 'Baile Guerreras K-pop',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 },
        emoji:  '🕺',
        imagen: '/adicional-kpop.webp',
        desc:   'Show de baile K-pop con animadoras disfrazadas de guerreras. ¡El favorito absoluto de las niñas!',
      },
      {
        id:     'canto-cumple',
        nombre: 'Canto de Cumpleaños Especial',
        precios: { hasta10: 20000, hasta20: 20000, hasta30: 20000, mas30: 20000 },
        emoji:  '🎤',
        imagen: '/adicional-canto-cumple.webp',
        desc:   'Canto de cumpleaños en vivo con fotos de los personajes favoritos del cumpleañero',
      },
    ],
  },

  // ── 5. JUEGOS DEPORTIVOS ─────────────────────────────────────────
  {
    id: 'deportivos',
    label: 'Juegos Deportivos',
    emoji: '🏓',
    imagen: '/categoria-deportivos.webp',
    desc: 'Actividad y competencia para toda la familia',
    seleccionMultiple: true,
    items: [
      {
        id:     'tacataca-adulto',
        nombre: 'Tacataca Adulto',
        precios: { hasta10: 20000, hasta20: 20000, hasta30: 20000, mas30: 20000 },
        emoji:  '⚽',
        imagen: '/adicional-tacataca-adulto.webp',
        desc:   'Mesa de futbolín tamaño adulto para papás y mayores',
      },
      {
        id:     'tacataca-nino',
        nombre: 'Tacataca Niño',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 },
        emoji:  '⚽',
        imagen: '/adicional-tacataca-nino.webp',
        desc:   'Mesa de futbolín pequeña especialmente diseñada para los niños',
      },
      {
        id:     'pingpong-adulto',
        nombre: 'Ping-pong Adulto',
        precios: { hasta10: 20000, hasta20: 20000, hasta30: 20000, mas30: 20000 },
        emoji:  '🏓',
        imagen: '/adicional-pingpong-adulto.webp',
        desc:   'Mesa de ping-pong reglamentaria para adultos y niños mayores',
      },
      {
        id:     'pingpong-nino',
        nombre: 'Ping-pong Niño',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 },
        emoji:  '🏓',
        imagen: '/adicional-pingpong-nino.webp',
        desc:   'Mesa de ping-pong pequeña adaptada para los más chicos',
      },
      {
        id:     'air-hockey',
        nombre: 'Air Hockey Niños',
        precios: { hasta10: 18000, hasta20: 18000, hasta30: 18000, mas30: 18000 },
        emoji:  '🥅',
        imagen: '/adicional-air-hockey.webp',
        desc:   'Mesa de air hockey para niños — ¡competencia asegurada!',
      },
      {
        id:     'saltarina-gigante',
        nombre: 'Saltarina Gigante',
        precios: { hasta10: 45000, hasta20: 45000, hasta30: 45000, mas30: 45000 },
        emoji:  '🦘',
        imagen: '/adicional-saltarina-gigante.webp',
        desc:   'Cama elástica gigante para saltar y volar sin parar durante toda la fiesta',
      },
      {
        id:     'saltarina-pequena',
        nombre: 'Saltarina Pequeña',
        precios: { hasta10: 30000, hasta20: 30000, hasta30: 30000, mas30: 30000 },
        emoji:  '🤸',
        imagen: '/adicional-saltarina-pequena.webp',
        desc:   'Cama elástica compacta ideal para los más pequeños',
      },
    ],
  },

  // ── 6. INFLABLES ─────────────────────────────────────────────────
  {
    id: 'inflables',
    label: 'Inflables',
    emoji: '🏰',
    imagen: '/categoria-inflables.webp',
    desc: 'El clásico que todos los niños adoran sin excepción',
    seleccionMultiple: false,
    items: [
      {
        id:     'inflable-pequeno',
        nombre: 'Inflable Pequeño',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 },
        emoji:  '🎈',
        imagen: '/adicional-inflable-pequeno.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-inflable-pequeno.webp',
        ],
        desc:   'Castillo inflable compacto, ideal para párvulos y bebés de hasta 3 años',
      },
      {
        id:     'inflable-mediano',
        nombre: 'Inflable Mediano',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 },
        emoji:  '🏯',
        imagen: '/adicional-inflable-mediano.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-inflable-mediano.webp',
        ],
        desc:   'Castillo clásico multicolor con tobogán, perfecto para niños de 2 a 5 años',
      },
      {
        id:     'inflable-grande',
        nombre: 'Inflable Grande',
        precios: { hasta10: 75000, hasta20: 75000, hasta30: 75000, mas30: 75000 },
        emoji:  '🏰',
        imagen: '/adicional-inflable-grande.webp',
        imagenes: [                              // ← galería (1280×720px) — agrega más fotos abajo
          '/adicional-inflable-grande.webp',
        ],
        desc:   'Mega castillo con tobogán combinado — ideal para grupos grandes hasta 6 años',
      },
    ],
  },

  // ── 7. RUEDAS Y AUTOPISTA ────────────────────────────────────────
  {
    id: 'ruedas',
    label: 'Ruedas y Autopista',
    emoji: '🚗',
    imagen: '/categoria-ruedas.webp',
    desc: '¡La Autopista Gigante: el hit absoluto de Alce Kids!',
    seleccionMultiple: true,
    highlights: [
      { texto: '🛣️ Autopista Gigante disponible en el jardín', tipo: 'info' },
    ],
    items: [
      {
        id:     'scooter',
        nombre: 'Scooter Manual',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 },
        emoji:  '🛴',
        imagen: '/adicional-scooter.webp',
        desc:   'Scooters de colores para recorrer la autopista del jardín a toda velocidad',
      },
      {
        id:     'bicis',
        nombre: 'Bicis sin Pedales',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 },
        emoji:  '🚲',
        imagen: '/adicional-bicis.webp',
        desc:   'Bicicletas sin pedales para los más pequeños que aún están aprendiendo',
      },
      {
        id:     'autos-pedales',
        nombre: 'Autos a Pedales',
        precios: { hasta10: 20000, hasta20: 20000, hasta30: 20000, mas30: 20000 },
        emoji:  '🚗',
        imagen: '/adicional-autos-pedales.webp',
        desc:   'Autos a pedales clásicos para recorrer el jardín a toda velocidad',
      },
      {
        id:     'autos-electricos',
        nombre: 'Autos Eléctricos',
        precios: { hasta10: 40000, hasta20: 40000, hasta30: 40000, mas30: 40000 },
        emoji:  '⚡',
        imagen: '/adicional-autos-electricos.webp',
        desc:   'Autos eléctricos de verdad por la autopista — ¡el hit número 1 de Alce Kids!',
      },
    ],
  },

  // ── 8. DECO ARENA (GRATIS) ───────────────────────────────────────
  {
    id: 'deco-arena',
    label: 'Deco Arena',
    emoji: '⛱️',
    imagen: '/categoria-deco-arena.webp',
    desc: 'Pozo de Arena incluido en el jardín — experiencia sensorial única',
    seleccionMultiple: true,
    gratis: true,
    highlights: [
      { texto: '🏖️ Pozo de Arena incluido en el jardín', tipo: 'info' },
    ],
    items: [
      {
        id:     'arena-moldes',
        nombre: 'Set de Moldes',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 },
        emoji:  '🏺',
        imagen: '/adicional-arena-moldes.webp',
        desc:   'Set de moldes temáticos para construir castillos y figuras en el pozo de arena',
        gratis: true,
      },
      {
        id:     'arena-palas',
        nombre: 'Palas y Rastrillos',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 },
        emoji:  '⛏️',
        imagen: '/adicional-arena-palas.webp',
        desc:   'Palas coloridas y rastrillos para cavar, explorar y crear en la arena',
        gratis: true,
      },
    ],
  },

  // ── 9. TEATRO ────────────────────────────────────────────────────
  {
    id: 'teatro',
    label: 'Teatro y Disfraz',
    emoji: '🎭',
    imagen: '/categoria-teatro.webp',
    desc: 'Escenario y Tarima disponibles — ¡todos a actuar!',
    seleccionMultiple: false,
    highlights: [
      { texto: '🎬 Escenario / Tarima disponible en el jardín', tipo: 'info' },
    ],
    items: [
      {
        id:     'teatro-baul',
        nombre: 'Baúl de Disfraces',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 },
        emoji:  '👒',
        imagen: '/adicional-teatro-baul.webp',
        desc:   'Baúl repleto de disfraces para montar una obra tipo cuento en el escenario del jardín',
      },
    ],
  },

  // ── 10. BANQUETERÍA ALCE ─────────────────────────────────────────
  {
    id: 'banqueteria',
    label: 'Banquetería ALCE',
    emoji: '🍽️',
    imagen: '/categoria-banqueteria.webp',
    desc: 'Servicio Delicias Añi — la mejor banquetera de Las Condes',
    seleccionMultiple: true,
    nota: 'Servicio derivado a nuestra banquetera oficial Delicias Añi · máxima calidad garantizada',
    highlights: [
      { texto: '☕ Zona de Cafetería con café de grano y croissants frescos', tipo: 'info' },
    ],
    items: [
      // ── Tortas ──────────────────────────────────────────────────
      {
        id:     'torta-cuchufi',
        nombre: 'Torta Cuchuflí Clásica',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 },
        emoji:  '🎂',
        imagen: '/adicional-torta-1.webp',
        desc:   'La torta favorita de los niños chilenos de siempre',
      },
      {
        id:     'torta-tematica',
        nombre: 'Torta Temática',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 },
        emoji:  '🎨',
        imagen: '/adicional-torta-2.webp',
        desc:   'Con el personaje favorito de tu hij@, decorada a mano',
      },
      {
        id:     'torta-premium',
        nombre: 'Torta Premium Artesanal',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 },
        emoji:  '✨',
        imagen: '/adicional-torta-3.webp',
        desc:   'Diseño completamente personalizado, elaborada artesanalmente',
      },
      // ── Cóctel ──────────────────────────────────────────────────
      {
        id:     'coctel-basico',
        nombre: 'Cóctel Básico',
        precios: { hasta10: 30000, hasta20: 30000, hasta30: 30000, mas30: 30000 },
        emoji:  '🥂',
        imagen: '/adicional-coctel-basico.webp',
        desc:   'Selección de bocaditos salados y dulces para adultos',
      },
      {
        id:     'coctel-premium',
        nombre: 'Cóctel Premium',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 },
        emoji:  '🍾',
        imagen: '/adicional-coctel-premium.webp',
        desc:   'Cóctel completo con bocaditos gourmet, quesos, frutas y variedad de preparaciones',
      },
      // ── Panes ───────────────────────────────────────────────────
      {
        id:     'panes-croissant',
        nombre: 'Croissants Artesanales',
        precios: { hasta10: 20000, hasta20: 20000, hasta30: 20000, mas30: 20000 },
        emoji:  '🥐',
        imagen: '/adicional-panes.webp',
        desc:   'Croissants frescos: ave palta · huevo palta · mechada queso · recién horneados',
      },
      // ── Bebestibles ─────────────────────────────────────────────
      {
        id:     'bebestibles',
        nombre: 'Bebestibles Completo',
        precios: { hasta10: 18000, hasta20: 18000, hasta30: 18000, mas30: 18000 },
        emoji:  '🥤',
        imagen: '/adicional-bebestibles.webp',
        desc:   'Bebidas, jugos naturales y café mix para toda la celebración',
      },
      // ── Carritos ────────────────────────────────────────────────
      {
        id:     'carrito-hot',
        nombre: 'Carrito Hot Dogs',
        precios: { hasta10: 45000, hasta20: 45000, hasta30: 45000, mas30: 45000 },
        emoji:  '🌭',
        imagen: '/adicional-carrito-hot.webp',
        desc:   'Carrito de hot dogs completos con todos los aderezos tradicionales',
      },
      {
        id:     'carrito-burger',
        nombre: 'Carrito Hamburguesas',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 },
        emoji:  '🍔',
        imagen: '/adicional-carrito-burger.webp',
        desc:   'Hamburguesas artesanales con papas fritas — el favorito de los adultos',
      },
      {
        id:     'carrito-lomito',
        nombre: 'Carrito Lomitos',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 },
        emoji:  '🥩',
        imagen: '/adicional-carrito-lomito.webp',
        desc:   'Lomitos al vapor, el clásico chileno que nunca falla',
      },
      {
        id:     'carrito-pizza',
        nombre: 'Carrito Pizzas',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 },
        emoji:  '🍕',
        imagen: '/adicional-carrito-pizza.webp',
        desc:   'Pizzas artesanales al corte con variedad de sabores para todos',
      },
    ],
  },
];


// ─────────────────────────────────────────────────────────────────────
// ⑤ VITRINA  (presentación visual del catálogo — estructura de pantalla)
//    Aquí se define cómo se agrupan los adicionales en pantalla.
//    Cambia  nombre / subNombre / imagen  de cada grupo si quieres
//    modificar lo que aparece en las tarjetas del catálogo.
//    NO cambies  id  ni  itemIds  salvo que agregues/elimines items.
// ─────────────────────────────────────────────────────────────────────
export const BLOQUES_VITRINA = [

  // ── 1. DECORACIÓN ───────────────────────────────────────────────
  {
    id: 'b-decoracion',
    titulo: 'DECORACIÓN',
    grupos: [
      {
        id: 'g-arco',
        nombre: 'Arco + Invitación',
        subNombre: 'Incluido en tu reserva',
        carpeta: 'arco',
        label: 'Arco + Invitación Digital',
        badge: 'INCLUIDO',
        badgeTipo: 'incluido',
        nota: 'El Arco Decorativo va incluido en el precio base. La Invitación Digital se agrega GRATIS al reservar.',
        seleccionMultiple: false,
        itemIds: ['invitacion-digital'],
      },
      {
        id: 'g-deco',
        nombre: 'Decoración',
        subNombre: 'Básica o Temática',
        carpeta: 'deco',
        label: 'Decoración del Espacio',
        seleccionMultiple: false,
        itemIds: ['deco-basica', 'deco-tematica'],
      },
      {
        id: 'g-ambientacion',
        nombre: 'Ambientación',
        subNombre: 'Globos · manteles · vajilla',
        carpeta: 'ambientacion',
        label: 'Ambientación Completa',
        seleccionMultiple: false,
        itemIds: ['ambientacion'],
      },
      {
        id: 'g-otros-deco',
        nombre: 'Piñata + Video',
        subNombre: 'Recuerdos para siempre',
        carpeta: 'pinata-video',
        label: 'Piñata y Video de la Fiesta',
        seleccionMultiple: true,
        itemIds: ['pinata', 'video-celebracion'],
      },
    ],
  },

  // ── 2. ANIMACIÓN ────────────────────────────────────────────────
  {
    id: 'b-animacion',
    titulo: 'ANIMACIÓN',
    grupos: [
      {
        id: 'g-parlantes',
        nombre: 'Parlantes BT',
        subNombre: 'Conecta tu playlist',
        carpeta: 'parlantes',
        label: 'Parlantes Bluetooth',
        badge: 'INCLUIDO',
        badgeTipo: 'incluido',
        nota: 'Sistema de parlantes Bluetooth incluido en el precio base. Conecta tu smartphone y pon tu música favorita.',
        seleccionMultiple: false,
        itemIds: [],
      },
      {
        id: 'g-pinta',
        nombre: 'Pinta Caritas + Globos',
        subNombre: 'Arte para los niños',
        carpeta: 'pinta-caritas',
        label: 'Pinta Caritas + Globoflexia',
        seleccionMultiple: false,
        itemIds: ['pinta-caritas'],
      },
      {
        id: 'g-animacion',
        nombre: 'Animación',
        subNombre: 'Full o Básica',
        carpeta: 'animacion',
        label: 'Animación Profesional',
        seleccionMultiple: false,
        itemIds: ['animacion-full', 'animacion-basica'],
      },
      {
        id: 'g-kpop',
        nombre: 'K-pop + Canto',
        subNombre: 'Shows especiales',
        carpeta: 'kpop',
        label: 'Shows Especiales',
        seleccionMultiple: true,
        itemIds: ['kpop', 'canto-cumple'],
      },
    ],
  },

  // ── 3. ENTRETENCIÓN ─────────────────────────────────────────────
  {
    id: 'b-entretencion',
    titulo: 'ENTRETENCIÓN',
    grupos: [
      {
        id: 'g-ruedas',
        nombre: 'Ruedas + Autopista',
        subNombre: 'Trae tu bici: GRATIS',
        carpeta: 'ruedas',
        label: 'Ruedas · Autopista Gigante',
        badge: 'Trae tu bici: GRATIS',
        badgeTipo: 'gratis',
        nota: 'La Autopista Gigante está incluida en el jardín. Puedes traer tu propia bicicleta sin costo adicional.',
        seleccionMultiple: true,
        itemIds: ['scooter', 'bicis', 'autos-pedales', 'autos-electricos'],
      },
      {
        id: 'g-deportivos',
        nombre: 'Juegos Deportivos',
        subNombre: 'Para toda la familia',
        carpeta: 'deportivos',
        label: 'Juegos Deportivos',
        seleccionMultiple: true,
        itemIds: [
          'tacataca-adulto', 'tacataca-nino',
          'pingpong-adulto', 'pingpong-nino',
          'air-hockey', 'saltarina-gigante', 'saltarina-pequena',
        ],
      },
      {
        id: 'g-inflables',
        nombre: 'Inflables',
        subNombre: 'Pequeño, Mediano o Grande',
        carpeta: 'inflables',
        label: 'Castillos Inflables',
        seleccionMultiple: false,
        itemIds: ['inflable-pequeno', 'inflable-mediano', 'inflable-grande'],
      },
      {
        id: 'g-arena-teatro',
        nombre: 'Arena + Teatro',
        subNombre: 'Pozo de arena y disfraces',
        carpeta: 'arena-teatro',
        label: 'Arena y Teatro',
        badge: 'Pozo de Arena INCLUIDO',
        badgeTipo: 'incluido',
        nota: 'El Pozo de Arena y el Escenario / Tarima están incluidos en el jardín sin costo.',
        seleccionMultiple: true,
        itemIds: ['arena-moldes', 'arena-palas', 'teatro-baul'],
      },
    ],
  },

  // ── 4. COMIDA INFANTIL ───────────────────────────────────────────
  {
    id: 'b-comida-inf',
    titulo: 'COMIDA INFANTIL',
    subTitulo: 'Servicio Delicias Añi · Banquetera oficial Alce Kids',
    grupos: [
      {
        id: 'g-tortas',
        nombre: 'Tortas',
        subNombre: 'Delicias Añi',
        carpeta: 'tortas',
        label: 'Tortas · Delicias Añi',
        nota: 'Elaboradas artesanalmente por nuestra banquetera oficial Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: false,
        itemIds: ['torta-cuchufi', 'torta-tematica', 'torta-premium'],
      },
      {
        id: 'g-coctel-inf',
        nombre: 'Cóctel Infantil',
        subNombre: 'Bocaditos para niños',
        carpeta: 'coctel-infantil',
        label: 'Cóctel Infantil · Delicias Añi',
        nota: 'Servicio Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: false,
        itemIds: ['coctel-basico'],
      },
      {
        id: 'g-comida-rapida',
        nombre: 'Hot Dogs + Pizza',
        subNombre: 'Los favoritos de los niños',
        carpeta: 'comida-rapida',
        label: 'Comida Rápida · Delicias Añi',
        nota: 'Servicio Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: true,
        itemIds: ['carrito-hot', 'carrito-pizza'],
      },
      {
        id: 'g-bebestibles',
        nombre: 'Bebestibles',
        subNombre: 'Bebidas · jugos · café mix',
        carpeta: 'bebestibles',
        label: 'Bebestibles · Delicias Añi',
        nota: 'Servicio Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: false,
        itemIds: ['bebestibles'],
      },
    ],
  },

  // ── 5. BANQUETERÍA ADULTOS ───────────────────────────────────────
  {
    id: 'b-banqueteria',
    titulo: 'BANQUETERÍA ADULTOS',
    subTitulo: 'Delicias Añi · La mejor banquetera de Las Condes',
    grupos: [
      {
        id: 'g-cafeteria',
        nombre: 'Cafetería',
        subNombre: 'Café de grano · croissants frescos',
        carpeta: 'cafeteria',
        label: 'Cafetería · Panes y Café',
        badge: 'Zona Cafetería INCLUIDA',
        badgeTipo: 'incluido',
        nota: 'La Zona de Cafetería con café de grano y croissants frescos está disponible en el salón. Servicio Delicias Añi.',
        seleccionMultiple: true,
        itemIds: ['panes-croissant', 'bebestibles'],
      },
      {
        id: 'g-coctel-adultos',
        nombre: 'Cóctel Premium',
        subNombre: 'Gourmet para adultos',
        carpeta: 'coctel-adultos',
        label: 'Cóctel Premium · Delicias Añi',
        nota: 'Servicio Delicias Añi · cóctel gourmet de máxima calidad para los adultos.',
        seleccionMultiple: false,
        itemIds: ['coctel-premium'],
      },
      {
        id: 'g-platos',
        nombre: 'Burgers + Lomitos',
        subNombre: 'Platos calientes adultos',
        carpeta: 'platos',
        label: 'Platos Calientes · Delicias Añi',
        nota: 'Servicio Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: true,
        itemIds: ['carrito-burger', 'carrito-lomito'],
      },
      {
        id: 'g-carritos',
        nombre: 'Carritos Completo',
        subNombre: 'Todas las opciones',
        carpeta: 'carritos',
        label: 'Carritos de Comida · Delicias Añi',
        nota: 'Servicio Delicias Añi · Máxima calidad garantizada.',
        seleccionMultiple: true,
        itemIds: ['carrito-hot', 'carrito-burger', 'carrito-lomito', 'carrito-pizza'],
      },
    ],
  },
];
