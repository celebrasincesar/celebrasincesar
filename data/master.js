// ══════════════════════════════════════════════════════════════════════
// MASTER CONFIG — CELEBRA SIN CESAR
// ──────────────────────────────────────────────────────────────────────
// Cambia aquí precios, textos e imágenes sin tocar ningún otro archivo.
//
// ÍNDICE:
//   ① MARCA           → nombre del negocio, WhatsApp, reseñas Google
//   ② PRECIOS JARDÍN  → arriendo según día y capacidad
//   ③ PRECIOS EXTRAS  → pack, hora adicional, aseo y niños extra
//   ④ ADICIONALES     → catálogo de servicios opcionales (= Catálogo PDF 2026)
//   ⑤ VITRINA         → cómo se muestran los adicionales en pantalla
// ══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────
// ① MARCA
// ─────────────────────────────────────────────────────────────────────
export const MARCA = {
  nombre:         'Celebra Sin Cesar',
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
  //  Estos son los PRECIOS BASE (rango mínimo: 1-3 años, hasta 10 niños).
  //  precio_final = PRECIOS_BASE × mult_edad × mult_cantidad (ver MULTIPLICADORES abajo).
  //  La diferencia entre hasta10 / hasta20 / hasta30 la manejan los multiplicadores,
  //  por eso completo_10 = completo_20 = completo_30 (mismo precio base).
  independiente:     150000,  // $150.000 · Sector Independiente · base (1-3 años, hasta 10 niños)
  completo_10:       195000,  // $195.000 · Jardín Completo     · base (1-3 años, hasta 10 niños)
  completo_20:       195000,  // igual que completo_10 — add_cantidad +$15k diferencia
  completo_30:       195000,  // igual que completo_10 — add_cantidad +$30k diferencia

  // ── Sábado (+$15.000 sobre el precio base de cada sector) ──────
  independiente_sab: 165000,  // $165.000 · Sector Independiente
  completo_10_sab:   210000,  // $210.000 · Jardín Completo
  completo_20_sab:   210000,  // igual que completo_10_sab
  completo_30_sab:   210000,  // igual que completo_10_sab

  completo_mas: 290000,       // legacy — no usar
};


// ─────────────────────────────────────────────────────────────────────
// ② B  INCREMENTOS DE PRECIO  (edad del cumpleañero + cantidad niños)
//
//  precio_final = PRECIOS_BASE[key]  +  add_edad  +  add_cantidad
//
//  Cada escalón sube $15.000 fijos (sistema lineal):
//    Rango 0 → +$0       (precio base)
//    Rango 1 → +$15.000
//    Rango 2 → +$30.000
//    Rango 3 → +$45.000
//
//  Para cambiar el incremento de un rango: edita sólo el campo add.
//  Para que todos sean iguales (sin diferencia): pon 0 en todos.
// ─────────────────────────────────────────────────────────────────────
export const MULTIPLICADORES = {

  // ── Edad del cumpleañero ────────────────────────────────────────────
  //    edades: las edades que caen en ese rango
  //    add:    monto fijo que se suma al precio base (en pesos)
  edad: [
    { edades: [1, 2, 3], add: 0      },  // 1, 2 o 3 años  → sin incremento (precio base)
    { edades: [4],        add: 15000  },  // 4 años         → +$15.000
    { edades: [5],        add: 30000  },  // 5 años         → +$30.000
    { edades: [6],        add: 45000  },  // 6 años         → +$45.000
  ],

  // ── Cantidad de niños ───────────────────────────────────────────────
  //    id:   valor de cantNinos en el wizard
  //    add:  monto fijo que se suma al precio base (en pesos)
  cantidad: [
    { id: 'hasta10', add: 0      },  // hasta 10 niños → sin incremento (precio base)
    { id: 'hasta20', add: 15000  },  // hasta 20 niños → +$15.000
    { id: 'hasta30', add: 30000  },  // hasta 30 niños → +$30.000
    { id: 'mas30',   add: 30000  },  // más de 30      → igual que hasta30 + $10k/niño extra
  ],
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
  // Cumpleaños compartido — recargo TOTAL según cantidad de festejados.
  // No se muestra en el selector (solo en el detalle de valores).
  festejados_recargo: { 1: 0, 2: 45000, 3: 95000 },
};


// ─────────────────────────────────────────────────────────────────────
// ④ ADICIONALES  (catálogo de servicios opcionales)
//
//  ⚠️ FUENTE ÚNICA: Catálogo ALCE KIDS 2026 (PDF de César).
//     Nombres y precios calzan 1:1 con la página "Valores Adicionales"
//     del PDF. Todos los valores incluyen traslado e instalación.
//
//  Precios por capacidad de niños:
//    Cada ítem tiene un campo  precios  con 4 valores:
//      hasta10 / hasta20 / hasta30 / mas30
//    (los ítems de precio fijo repiten el mismo valor en los 4)
//
//  Las FOTOS de cada grupo viven en /public/fotos/[carpeta]/foto-NN.webp
//  y su ORDEN debe calzar con el orden de itemIds del grupo (ver ⑤).
// ─────────────────────────────────────────────────────────────────────
export const CATEGORIAS_ADICIONALES = [

  // ── 1. INFLABLES ─────────────────────────────────────────────────
  {
    id: 'inflables',
    label: 'Inflables',
    emoji: '🏰',
    desc: 'El clásico que todos los niños adoran — traslado e instalación incluidos',
    seleccionMultiple: true,
    items: [
      {
        id:     'tobogan-premium',
        nombre: 'Tobogán Premium',
        precios: { hasta10: 75000, hasta20: 80000, hasta30: 85000, mas30: 85000 },
        emoji:  '🛝',
        desc:   'Inflable gigante con resbalín y zona de juegos · 5,0×3,5×4,0 m · 3 a 12 años · 6-8 niños a la vez',
      },
      {
        id:     'gran-castillo',
        nombre: 'Gran Castillo',
        precios: { hasta10: 75000, hasta20: 80000, hasta30: 85000, mas30: 85000 },
        emoji:  '🏰',
        desc:   'Castillo medieval gigante con gran tobogán y zona de juegos · 5,5×3,5×3,0 m · 2 a 12 años · 6-8 niños a la vez',
      },
      {
        id:     'tiburon-escalador',
        nombre: 'Tiburón Escalador',
        precios: { hasta10: 55000, hasta20: 60000, hasta30: 65000, mas30: 65000 },
        emoji:  '🦈',
        desc:   'Tobogán, zona de escalada, piscina de pelotas y pistola acuática · 5,2×3,9×3,2 m · 2 a 6 años',
      },
      {
        id:     'barco-pirata',
        nombre: 'Barco Pirata',
        precios: { hasta10: 55000, hasta20: 60000, hasta30: 65000, mas30: 65000 },
        emoji:  '🏴‍☠️',
        desc:   'Aventura pirata inflable con tobogán y zona de juegos',
      },
      {
        id:     'monkey-climb',
        nombre: 'Monkey Climb',
        precios: { hasta10: 55000, hasta20: 60000, hasta30: 65000, mas30: 65000 },
        emoji:  '🐒',
        desc:   'Zona de escalada y saltos para pequeños aventureros',
      },
      {
        id:     'castillo-avion',
        nombre: 'Castillo Avión',
        precios: { hasta10: 40000, hasta20: 45000, hasta30: 50000, mas30: 50000 },
        emoji:  '✈️',
        desc:   'Castillo inflable temático de avión, ideal para los más pequeños',
      },
      {
        id:     'castillo-futbolero',
        nombre: 'Castillo Futbolero',
        precios: { hasta10: 40000, hasta20: 45000, hasta30: 50000, mas30: 50000 },
        emoji:  '⚽',
        desc:   'Castillo inflable con temática de fútbol para mini cracks',
      },
    ],
  },

  // ── 2. ELÉCTRICOS ────────────────────────────────────────────────
  {
    id: 'electricos',
    label: 'Eléctricos',
    emoji: '⚡',
    desc: 'Vehículos eléctricos para recorrer la Autopista Gigante del jardín',
    seleccionMultiple: true,
    items: [
      {
        id:     'hoppy-jeep',
        nombre: 'Hoppy Jeep',
        precios: { hasta10: 35000, hasta20: 40000, hasta30: 45000, mas30: 45000 },
        emoji:  '🚙',
        desc:   'Jeep eléctrico para conducir por la autopista del jardín',
      },
      {
        id:     'funny-bugatti',
        nombre: 'Funny Bugatti',
        precios: { hasta10: 35000, hasta20: 40000, hasta30: 45000, mas30: 45000 },
        emoji:  '🏎️',
        desc:   'Auto deportivo eléctrico — el favorito de los mini pilotos',
      },
      {
        id:     'retro-excava',
        nombre: 'Retro Excava',
        precios: { hasta10: 35000, hasta20: 40000, hasta30: 45000, mas30: 45000 },
        emoji:  '🚜',
        desc:   'Retroexcavadora eléctrica para pequeños constructores',
      },
    ],
  },

  // ── 3. DEPORTIVOS ────────────────────────────────────────────────
  {
    id: 'deportivos',
    label: 'Deportivos',
    emoji: '🏓',
    desc: 'Juegos deportivos para niños y adultos — competencia para toda la familia',
    seleccionMultiple: true,
    items: [
      {
        id:     'racing-kart',
        nombre: 'Racing Kart',
        precios: { hasta10: 15000, hasta20: 20000, hasta30: 25000, mas30: 25000 },
        emoji:  '🏁',
        desc:   'Kart a pedales para correr por la autopista del jardín',
      },
      {
        id:     'tiggy-junior',
        nombre: 'Tiggy Junior',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '🎯',
        desc:   'Juego de puntería y destreza para los más chicos',
      },
      {
        id:     'air-hockey-junior',
        nombre: 'Air Hockey Junior',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '🥅',
        desc:   'Mesa de air hockey tamaño niños — ¡competencia asegurada!',
      },
      {
        id:     'tacataca-junior',
        nombre: 'Taca Taca Junior',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '⚽',
        desc:   'Mesa de futbolín a la medida de los niños',
      },
      {
        id:     'pingpong-junior',
        nombre: 'Ping Pong Junior',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '🏓',
        desc:   'Mesa de ping pong adaptada para los más chicos',
      },
      {
        id:     'tacataca-adultos',
        nombre: 'Taca Taca Adultos',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '⚽',
        desc:   'Futbolín tamaño completo para papás y niños grandes',
      },
      {
        id:     'pingpong-adultos',
        nombre: 'Ping Pong Adultos',
        precios: { hasta10: 25000, hasta20: 30000, hasta30: 35000, mas30: 35000 },
        emoji:  '🏓',
        desc:   'Mesa de ping pong reglamentaria para el torneo familiar',
      },
      {
        id:     'super-saltarina',
        nombre: 'Super Saltarina',
        precios: { hasta10: 70000, hasta20: 75000, hasta30: 80000, mas30: 80000 },
        emoji:  '🦘',
        desc:   'Cama elástica gigante para saltar sin parar toda la fiesta',
      },
    ],
  },

  // ── 4. DECORACIÓN ────────────────────────────────────────────────
  {
    id: 'decoracion',
    label: 'Decoración',
    emoji: '🎨',
    desc: 'Transforma el espacio — genérica o con el personaje favorito',
    seleccionMultiple: false,
    items: [
      {
        id:     'deco-generica-simple',
        nombre: 'Decoración Genérica Simple',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 },
        emoji:  '🎈',
        desc:   'Globos de colores y ambientación festiva del espacio',
      },
      {
        id:     'deco-tematica-simple',
        nombre: 'Decoración Temática Simple',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 },
        emoji:  '🦄',
        desc:   'Decoración con el personaje favorito de tu hij@',
      },
      {
        id:     'deco-generica-full',
        nombre: 'Decoración Genérica Full',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 },
        emoji:  '🎊',
        desc:   'Ambientación completa: globos, manteles y montaje del espacio',
      },
      {
        id:     'deco-tematica-full',
        nombre: 'Decoración Temática Full',
        precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 },
        emoji:  '✨',
        desc:   'La experiencia completa con tu personaje favorito: globos, manteles, número gigante y montaje',
      },
    ],
  },

  // ── 5. ANIMACIÓN ─────────────────────────────────────────────────
  //     Precios por tramo de niños (hasta 10 / 20 / 30) según catálogo 2026.
  {
    id: 'animacion',
    label: 'Animación',
    emoji: '🎭',
    desc: 'Shows profesionales que los niños recordarán para siempre',
    seleccionMultiple: true,
    items: [
      {
        id:     'animacion-full-juegos',
        nombre: 'Animación Full Juegos',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 },
        emoji:  '🎉',
        desc:   'Juegos dirigidos, concursos y baile durante toda la celebración',
      },
      {
        id:     'animacion-completa',
        nombre: 'Animación Completa',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 },
        emoji:  '🎪',
        desc:   'Show completo: juegos, títeres, concursos, baile y sorpresas',
      },
      {
        id:     'animacion-pack-guerrera',
        nombre: 'Animación Pack Guerrera',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 },
        emoji:  '🕺',
        desc:   'Show de baile K-pop con animadoras guerreras — el favorito de las niñas',
      },
      {
        id:     'animacion-huntrix',
        nombre: 'Animación Full Huntrix',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 },
        emoji:  '💜',
        desc:   'El show K-pop del momento: baile, música y personajes Huntrix',
      },
      {
        id:     'pintacaritas-globoflexia',
        nombre: 'Pintacaritas y Globoflexia',
        precios: { hasta10: 60000, hasta20: 70000, hasta30: 80000, mas30: 80000 },
        emoji:  '🎨',
        desc:   'Arte facial personalizado y figuras de globos para cada niño',
      },
      {
        id:     'animacion-personaje',
        nombre: 'Animación Personaje Favorito',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 },
        emoji:  '🦸',
        desc:   'El personaje favorito de tu hij@ anima la fiesta completa',
      },
      {
        id:     'animacion-spiderman',
        nombre: 'Animación Spiderman',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 },
        emoji:  '🕷️',
        desc:   'El héroe arácnido llega a la celebración con show completo',
      },
      {
        id:     'animacion-baby-shower',
        nombre: 'Animación Baby Shower',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 },
        emoji:  '🍼',
        desc:   'Animación especial para baby showers y celebraciones de espera',
      },
    ],
  },

  // ── 6. INCLUIDOS GRATIS ──────────────────────────────────────────
  {
    id: 'incluidos',
    label: 'Incluidos',
    emoji: '🎁',
    desc: 'Detalles sin costo que vienen con tu reserva',
    seleccionMultiple: true,
    items: [
      {
        id:     'invitacion-digital',
        nombre: 'Invitación Digital',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 },
        emoji:  '💌',
        desc:   'Diseño personalizado para compartir por WhatsApp. ¡Incluida GRATIS en tu reserva!',
        gratis: true,
      },
    ],
  },
];


// ─────────────────────────────────────────────────────────────────────
// ⑤ VITRINA  (presentación visual del catálogo — estructura de pantalla)
//    Cada grupo se muestra como tarjeta; su carpeta define las fichas
//    (/public/fotos/[carpeta]/foto-NN.webp — orden = orden de itemIds).
// ─────────────────────────────────────────────────────────────────────
export const BLOQUES_VITRINA = [

  // ── 1. INFLABLES ────────────────────────────────────────────────
  {
    id: 'b-inflables',
    titulo: 'INFLABLES',
    subTitulo: 'Traslado e instalación incluidos',
    grupos: [
      {
        id: 'g-inflables',
        nombre: 'Castillos Inflables',
        subNombre: '7 modelos · desde $40.000',
        carpeta: 'inflables',
        label: 'Castillos Inflables',
        seleccionMultiple: true,
        itemIds: [
          'tobogan-premium', 'gran-castillo', 'tiburon-escalador',
          'barco-pirata', 'monkey-climb', 'castillo-avion', 'castillo-futbolero',
        ],
      },
    ],
  },

  // ── 2. ELÉCTRICOS Y DEPORTIVOS ──────────────────────────────────
  {
    id: 'b-juegos',
    titulo: 'ELÉCTRICOS Y DEPORTIVOS',
    subTitulo: 'Para la Autopista Gigante y el torneo familiar',
    grupos: [
      {
        id: 'g-electricos',
        nombre: 'Vehículos Eléctricos',
        subNombre: 'Jeep · Bugatti · Retro Excava',
        carpeta: 'electricos',
        label: 'Vehículos Eléctricos',
        seleccionMultiple: true,
        itemIds: ['hoppy-jeep', 'funny-bugatti', 'retro-excava'],
      },
      {
        id: 'g-deportivos',
        nombre: 'Juegos Deportivos',
        subNombre: 'Para niños y adultos',
        carpeta: 'deportivos',
        label: 'Juegos Deportivos',
        seleccionMultiple: true,
        itemIds: [
          'racing-kart', 'tiggy-junior', 'air-hockey-junior',
          'tacataca-junior', 'pingpong-junior',
          'tacataca-adultos', 'pingpong-adultos', 'super-saltarina',
        ],
      },
    ],
  },

  // ── 3. DECORACIÓN ───────────────────────────────────────────────
  {
    id: 'b-decoracion',
    titulo: 'DECORACIÓN',
    grupos: [
      {
        id: 'g-deco',
        nombre: 'Decoración',
        subNombre: 'Genérica o temática · simple o full',
        carpeta: 'deco',
        label: 'Decoración del Espacio',
        seleccionMultiple: false,
        itemIds: [
          'deco-generica-simple', 'deco-tematica-simple',
          'deco-generica-full', 'deco-tematica-full',
        ],
      },
      {
        id: 'g-arco',
        nombre: 'Arco + Invitación',
        subNombre: 'Incluido en tu reserva',
        carpeta: 'arco',
        label: 'Arco + Invitación Digital',
        badge: 'INCLUIDO',
        badgeTipo: 'incluido',
        nota: 'El Arco Decorativo con el nombre de tu hij@ va incluido en el precio base. La Invitación Digital se agrega GRATIS al reservar.',
        seleccionMultiple: false,
        itemIds: ['invitacion-digital'],
      },
    ],
  },

  // ── 4. ANIMACIÓN ────────────────────────────────────────────────
  {
    id: 'b-animacion',
    titulo: 'ANIMACIÓN',
    subTitulo: 'Valores según cantidad de niños',
    grupos: [
      {
        id: 'g-shows',
        nombre: 'Shows de Animación',
        subNombre: 'Full Juegos · Completa · Guerrera · Huntrix',
        carpeta: 'animacion-shows',
        label: 'Shows de Animación',
        seleccionMultiple: false,
        itemIds: [
          'animacion-full-juegos', 'animacion-completa',
          'animacion-pack-guerrera', 'animacion-huntrix',
        ],
      },
      {
        id: 'g-personajes',
        nombre: 'Personajes',
        subNombre: 'Tu personaje favorito o Spiderman',
        carpeta: 'personajes',
        label: 'Animación con Personajes',
        seleccionMultiple: false,
        itemIds: ['animacion-personaje', 'animacion-spiderman'],
      },
      {
        id: 'g-pinta',
        nombre: 'Pintacaritas y Globoflexia',
        subNombre: 'Arte para cada niño',
        carpeta: 'pinta-caritas',
        label: 'Pintacaritas y Globoflexia',
        seleccionMultiple: false,
        itemIds: ['pintacaritas-globoflexia'],
      },
      {
        id: 'g-baby-shower',
        nombre: 'Baby Shower',
        subNombre: 'Celebración de espera',
        carpeta: 'baby-shower',
        label: 'Animación Baby Shower',
        seleccionMultiple: false,
        itemIds: ['animacion-baby-shower'],
      },
    ],
  },

  // ── 5. COMIDA ───────────────────────────────────────────────────
  {
    id: 'b-comida',
    titulo: 'COMIDA',
    subTitulo: 'Menús a tu medida — cotización sin compromiso',
    grupos: [
      {
        id: 'g-comida',
        nombre: 'Comida y Banquetería',
        subNombre: 'Menús para niños y adultos, armados a tu medida',
        carpeta: 'tortas',
        label: 'Comida y Banquetería',
        badge: 'COTIZACIÓN GRATIS',
        badgeTipo: 'cotizar',
        nota: 'Snacks, cóctel, tortas y más. Cuéntanos qué necesitas y te cotizamos sin compromiso por WhatsApp.',
        seleccionMultiple: false,
        itemIds: [],
      },
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
    ],
  },
];
