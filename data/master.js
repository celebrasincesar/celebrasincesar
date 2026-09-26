// ══════════════════════════════════════════════════════════════════════
// MASTER CONFIG — CELEBRA SIN CESAR
// ──────────────────────────────────────────────────────────────────────
// Cambia aquí precios, textos e imágenes sin tocar ningún otro archivo.
//
// ÍNDICE:
//   ① MARCA           → nombre del negocio, WhatsApp, reseñas Google
//   ② PRECIOS JARDÍN  → arriendo según día y capacidad
//   ③ PRECIOS EXTRAS  → pack, hora adicional y niños extra
//   ④ ADICIONALES     → catálogo de Opciones (Categoría → Sección → Opción)
//   ⑤ VITRINA         → cómo se muestran (Categoría = bloque, Sección = ficha)
//
// ESTRUCTURA (definida por César en el Word 2026-07):
//   CATEGORÍA  → título (bloque). Ej: "Inflables".
//   SECCIÓN    → ficha con foto en pantalla (grupo/carpeta). Ej: "Gigante".
//   OPCIÓN     → item dentro del carrusel de esa sección. Ej: "Tobogán Premium".
//   • Si la sección NO tiene opciones (Incluidos, Decoración) se agrega
//     directo desde la ficha, sin abrir carrusel.
//   • Solo la ANIMACIÓN varía de precio según la cantidad de niños; el
//     resto son precios planos (mismo valor en los 4 tramos).
// ══════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────
// ① MARCA
// ─────────────────────────────────────────────────────────────────────
export const MARCA = {
  nombre:         'Celebra Sin Cesar',
  venue:          'ALCE Kids',
  ubicacion:      'Talavera de la Reina, Las Condes, Santiago',
  whatsapp:       '56944356955',       // sin el +, sin espacios
  google_rating:  '5.0',              // debe coincidir con STATS (lo verifica qa-ux-publico)
  google_reviews: '45',               // idem: mínimo verificable, se muestra como "45+"
  colores: {
    azul:    '#1565C0',
    naranja: '#F97316',
    cyan:    '#29B9E8',
  },
};


// ─────────────────────────────────────────────────────────────────────
// ①B  FICHA OPERATIVA — fuente única de nombre, dirección, teléfono,
//     horarios y políticas. La usan las páginas-respuesta, el schema
//     JSON-LD y los mensajes. No repetir estos datos en ningún otro lado
//     (§BM: consistencia absoluta de NAP para el SEO local).
// ─────────────────────────────────────────────────────────────────────
export const NEGOCIO = {
  nombre:        'Celebra Sin Cesar',
  venue:         'Alce Kids',
  razonSocial:   'CELEBRA SIN CESAR SpA',
  sitio:         'https://celebrasincesar.cl',
  telefono:      '+56 9 4435 6955',
  telefonoE164:  '+56944356955',
  email:         'administracion@celebrasincesar.cl',
  instagram:     'https://www.instagram.com/celebracionesalce/',
  mapa:          'https://www.google.com/maps?cid=660114253320051799',

  direccion: {
    calle:   'Talavera de la Reina 380',
    comuna:  'Las Condes',
    region:  'Región Metropolitana',
    pais:    'CL',
    completa: 'Talavera de la Reina 380, Las Condes, Santiago',
    lat: -33.4103966,
    lng: -70.5469409,
  },

  // Horarios oficiales. Cualquier otro horario en la web es un error.
  dias: ['Viernes', 'Sábado', 'Domingo'],
  diasSchema: ['Friday', 'Saturday', 'Sunday'],
  // Los dos turnos y cuánto se puede estirar cada uno. La hora adicional NO
  // es una consulta: es parte del producto y se contrata al elegir el horario.
  //   AM crece HACIA ATRÁS  (10:00–14:00), máximo 1 hora.
  //   PM crece HACIA ADELANTE (15:00–19:00 / 15:00–20:00), máximo 2 horas.
  turnos: [
    { id: 'AM', label: 'AM', desde: '11:00', hasta: '14:00', maxAdicionales: 1, crece: 'atras' },
    { id: 'PM', label: 'PM', desde: '15:00', hasta: '18:00', maxAdicionales: 2, crece: 'adelante' },
  ],
  // Viernes tiene su propia tabla de turnos — NO existe AM, y el PM tiene
  // su propio bloque base y su propio tope de horas adicionales (documento
  // "Autorización Fase 1A", 13-sep-2026, §1). Mismo `id:'PM'` que sáb/dom
  // a propósito: sigue siendo el turno "PM" en reserva.turno, Calendar,
  // tributario y snapshot — solo cambia CUÁL tabla resuelve sus horarios.
  // El precio base NO cambia (§1: "NO crear tarifa viernes especial") —
  // eso vive en data/precios.js y no se toca acá.
  turnosViernes: [
    { id: 'PM', label: 'PM', desde: '16:00', hasta: '19:00', maxAdicionales: 1, crece: 'adelante' },
  ],
  preparacion: 'Puedes llegar 30 minutos antes de tu horario para decorar. Están incluidos y no se descuentan de tu celebración.',

  // Política de pago (§D)
  anticipoPorcentaje: 50,
  saldoVence: 'hasta 48 horas antes del evento',
  // Minutos que se retiene el turno mientras el papá paga (§8). Vive acá
  // —no en lib/reservas.js— para que la pantalla de confirmación previa al
  // pago (cliente, "Nueva fase — experiencia de marca…", 08-sep-2026) pueda
  // mostrar el mismo número real sin importar código de servidor (Postgres,
  // env vars) en el bundle del navegador. lib/reservas.js lee este mismo
  // valor: un solo lugar, nunca dos números que puedan desincronizarse.
  holdMinutos: 15,

  // Política de lluvia — texto ya publicado en la web, mantenido como fuente única.
  lluvia: 'Si llueve, reagendas sin costo y tu anticipo queda 100% vigente. Nunca pierdes tu reserva.',

  edades: { min: 0, max: 6 },
  superficieM2: 600,

  // Configuración comercial de Visitas Autogestionadas (documento "FASE 3A
  // — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A", 22-sep-2026, §3).
  // Único lugar del código donde viven días/horarios/duración/anticipación/
  // horizonte de visitas — nada de esto se repite ni se hardcodea en otro
  // archivo. SIN exclusividad de cupos a propósito (§4, §8): no existe
  // "capacidad máxima" en este objeto porque no existe ese input comercial
  // todavía — cuando exista, se agrega ACÁ, no en lib/visitas.js.
  visitas: {
    dias: ['Viernes'],
    diasSchema: ['Friday'],
    horarios: ['10:00', '10:30', '11:00', '11:30'],
    duracionMinutos: 20,
    anticipacionMinMinutos: 60,
    horizonteSemanas: 8,
  },

  // Postevento (documento "FASE 3B — POSTEVENTO", 24-sep-2026). Enlace
  // directo OFICIAL de "escribir reseña", obtenido desde "Pedir reseñas" del
  // Google Business Profile de Alce Kids (Bloque B, §1). Es un concepto
  // distinto de NEGOCIO.mapa / GOOGLE_REVIEWS_URL (ficha/ubicación en Maps):
  // todo el código de postevento usa EXCLUSIVAMENTE este campo. Si alguna
  // vez vuelve a ser null, /cadena avisa y no habilita acciones.
  postevento: {
    googleReviewUrl: 'https://g.page/r/CVdcUHxqMikJEBM/review',
  },
};

// Defensa anti-avalancha del postevento (§6): antes de esta fecha
// operacional (Chile) nunca se crean tareas postevento, además de la
// ventana estrecha T+1/T+2 de lib/postevento.js.
export const POSTEVENTO_ACTIVO_DESDE = '2026-09-24';


// Versión vigente de los Términos y Condiciones. Queda asociada a cada
// cotización/reserva para saber qué texto aceptó el cliente. Al publicar
// un T&C nuevo, subir esta fecha (o agregar un sufijo -v2, -v3... si el
// cambio ocurre dentro del mismo mes, como este). El texto de la versión
// reemplazada queda congelado en data/tyc-historico.js — nunca se
// sobrescribe, nunca se borra.
//
// '2026-09' → '2026-09-v2' el 13-sep-2026: corrección factual mínima de
// la parte horaria de la Sección 9 ("Horarios y puntualidad") — el texto
// anterior no distinguía el bloque de viernes de la regla operativa nueva.
// Ninguna otra cláusula cambió. Ver data/tyc-historico.js.
//
// '2026-09-v2' → '2026-09-v3' el 21-sep-2026 (documento "AUTORIZO EL PASO
// A PRODUCTION...", §19-20): incorpora el derecho a retracto (nueva
// sección 11, Ley 19.496 art. 3° bis + Decreto 52/2024) y las correcciones
// contractuales de Fase 1B (secciones 3, 4, 5, 6, 10, 12, 19, 20). Ver
// data/tyc-propuesta-2026-09-v3.js para el detalle completo del diff.
export const TYC_VERSION = '2026-09-v3';

// ══════════════════════════════════════════════════════════════════
// DECLARACIONES DE /confirmacion
//
// Un solo texto por declaración. Lo que el apoderado lee en pantalla, lo que
// marca en el checkbox y lo que viaja en el WhatsApp son literalmente la misma
// cadena: si difirieran, el valor probatorio del registro se cae.
//
// `condicional: 'mayores'` = solo se exige cuando asisten niños mayores de 6.
// ══════════════════════════════════════════════════════════════════
export const DECLARACIONES = [
  {
    id: 'declaraSupervision',
    titulo: 'Supervisión activa',
    texto: 'Los niños estarán acompañados y supervisados en todo momento por sus padres, tutores o adultos responsables. Alce Kids no presta servicio de guardería.',
  },
  {
    id: 'declaraReglamento',
    titulo: 'Uso correcto',
    texto: 'Conocemos el reglamento del recinto y los juegos se usarán como corresponde, según su diseño y el rango de edad indicado (0 a 6 años).',
  },
  {
    id: 'declaraMayores',
    condicional: 'mayores',
    titulo: 'Niños mayores de 6 años',
    texto: 'Conozco que los juegos permanentes del jardín están diseñados para niños de 0 a 6 años. Me comprometo a informar esta regla a los adultos responsables de los niños mayores y a colaborar activamente con el personal del recinto para que no utilicen dichos juegos.',
  },
  {
    id: 'acepta',
    titulo: 'Términos y veracidad',
    texto: 'Los datos que entregué son veraces, y leí y acepto los Términos y Condiciones de Alce Kids (celebrasincesar.cl/terminos), incluido el reglamento del recinto.',
  },
];


// ─────────────────────────────────────────────────────────────────────
// ② PRECIOS JARDÍN  (arriendo base según día y capacidad)
//    Formato: número sin puntos ni signos  →  180000 = $180.000
//    precio_final = PRECIOS_BASE + add_edad + add_cantidad (ver ②B)
// ─────────────────────────────────────────────────────────────────────
export const PRECIOS_BASE = {

  // ── Viernes y Domingo ──────────────────────────────────────────
  //  PRECIOS BASE = rango mínimo (1-3 años, hasta 10 niños).
  //  La diferencia entre tramos de niños la aplican los add_cantidad,
  //  por eso completo_10 = completo_20 = completo_30 (misma base).
  independiente:     150000,  // $150.000 · Sector Independiente · base
  completo_10:       195000,  // $195.000 · Recinto Completo      · base
  completo_20:       195000,  // igual base — add_cantidad(+$25k) da $220.000
  completo_30:       195000,  // igual base — add_cantidad(+$50k) da $245.000

  // ── Sábado (+$15.000 sobre la base de cada sector) ─────────────
  independiente_sab: 165000,  // $165.000 · Sector Independiente
  completo_10_sab:   210000,  // $210.000 · Recinto Completo
  completo_20_sab:   210000,  // igual base sábado
  completo_30_sab:   210000,  // igual base sábado

  completo_mas: 290000,       // legacy — no usar
};


// ─────────────────────────────────────────────────────────────────────
// ② B  INCREMENTOS DE PRECIO  (edad del cumpleañero + cantidad de niños)
//
//  precio_final = PRECIOS_BASE[key]  +  add_edad  +  add_cantidad
//
//  Verificado 1:1 contra la tabla de arriendo de César (jul-2026):
//    · Edad:     cada año sobre 3 suma +$15.000  (0 / 15 / 30 / 45k)
//    · Cantidad: hasta10 +0 · hasta20 +25k · hasta30 +50k · +30 +50k
//                (el tramo +30 usa la misma base que hasta30 y suma
//                 $10.000 por cada niño sobre 30 — ver nino_extra)
//
//  Ejemplos (Vie-Dom, Recinto Completo, base 195.000):
//    1-3 años · 20 niños = 195 + 0  + 25 = 220.000  ✓
//    6 años   · 30 niños = 195 + 45 + 50 = 290.000  ✓
//    1-3 años · Independiente 20 niños = 150 + 0 + 25 = 175.000  ✓
// ─────────────────────────────────────────────────────────────────────
export const MULTIPLICADORES = {

  // ── Edad del cumpleañero ────────────────────────────────────────────
  edad: [
    { edades: [1, 2, 3], add: 0      },  // 1-3 años → base
    { edades: [4],        add: 15000  },  // 4 años   → +$15.000
    { edades: [5],        add: 30000  },  // 5 años   → +$30.000
    { edades: [6],        add: 45000  },  // 6 años   → +$45.000
  ],

  // ── Cantidad de niños ───────────────────────────────────────────────
  cantidad: [
    { id: 'hasta10', add: 0      },  // hasta 10 niños → base
    { id: 'hasta20', add: 25000  },  // hasta 20 niños → +$25.000
    { id: 'hasta30', add: 50000  },  // hasta 30 niños → +$50.000
    // El último tramo sube $15.000 por sí mismo y ADEMÁS cobra $10.000 por
    // cada niño sobre 30. Así el salto a 31 niños vuelve a ser de $25.000,
    // igual que los anteriores: antes subía $0 y el único cargo era el niño.
    { id: 'mas30',   add: 65000  },  // 31 a 40 niños  → +$65.000 + $10k por niño sobre 30
  ],
};


// ─────────────────────────────────────────────────────────────────────
// ③ PRECIOS EXTRAS  (servicios adicionales fijos del wizard)
// ─────────────────────────────────────────────────────────────────────
export const PRECIOS_EXTRAS = {
  pack_celebra:   60000,  // $60.000 · Pack Celebra Sin Cesar (Piñata + Decoración)
  aseo_profundo:  30000,  // legacy — la Limpieza Profunda hoy va SIEMPRE incluida gratis
  hora_adicional: 50000,  // $50.000 · Hora extra (4 horas en total)

  // Sumar hermanos mayores a la celebración. Es un valor por tramo, cerrado:
  // no incluye productos — la entretención que elijan se cobra aparte, a
  // precio de catálogo. Sobre 8 mayores se suma por cada uno.
  // OJO: al papá esto NUNCA se le presenta como "recargo" (decisión de César).
  // Tramos '4a6'/'7mas': re-etiquetados desde '4a7'/'8mas' (documento
  // "No autorizo todavía el deploy...", 15-sep-2026, §2) — el corte entre
  // tramo medio y tramo alto bajó de 8 a 7. Los montos base ($60.000 /
  // $80.000) y el recargo marginal ($10.000) se HEREDAN sin cambio, solo
  // se movió el punto donde empieza cada uno — decisión explícita, no
  // improvisada: ver informe de entrega para la consecuencia económica
  // exacta (alguien con 8 mayores paga $10.000 más que antes, porque el
  // recargo ahora se cuenta desde 7 en vez de desde 8).
  hermanos_mayores: { '1a3': 30000, '4a6': 60000, '7mas': 80000, por_mayor_sobre_7: 10000 },
  nino_extra:     10000,  // $10.000 · Por cada niño adicional sobre 30
  // Cumpleaños compartido — recargo TOTAL según cantidad de festejados.
  festejados_recargo: { 1: 0, 2: 45000, 3: 95000 },
};


// ─────────────────────────────────────────────────────────────────────
// ④ ADICIONALES  (catálogo de Opciones)
//
//  Cada OPCIÓN (item) tiene precios con 4 tramos: hasta10 / hasta20 /
//  hasta30 / mas30. Precio PLANO = mismo valor en los 4 (todo menos
//  animación). ANIMACIÓN = valores reales por tramo (tabla de César).
//
//  Las FOTOS viven en /public/fotos/[carpeta]/foto-NN.webp (orden =
//  orden de itemIds del grupo) y la ficha en /public/fotos/vitrina/[carpeta].webp
//  Formato de imagen: WebP portrait 1055×1491 (ver nota al final).
//
// ─── ATRIBUTOS DE REGLA (nuevo · 2026-08) ────────────────────────────
//  Cada opción puede declarar atributos que el motor de reglas
//  (data/reglas.js) usa para decidir SI SE MUESTRA y SI SIRVE PARA LOS
//  PACKS DE MAYORES. Ninguna pantalla tiene reglas propias: todas
//  preguntan por estos campos.
//
//  Campo                Default   Significado
//  ───────────────────  ────────  ───────────────────────────────────────
//  activo               true      false = no se muestra en ninguna parte
//  tamano               null      'gigante' | 'mediano' | 'pequeno'
//  edad_min / edad_max  0 / 12    edades para las que está pensado. Un rango
//                                 0-99 = se ofrece siempre (mesas de adultos)
//  ninos_min            1         mínimo de niños totales para ofrecerlo
//  ninos_max            40        máximo de niños totales para ofrecerlo
//  ocultar_si_mayores   false     true = se oculta si viene 1+ mayor de 6
//  apto_mayores         true      sirve para entretener a mayores de 6
//  categoria_pack       null      'deportivo' | 'inflable_gigante' | 'animacion'
//  apto_pack_mayores    false     true = elegible dentro de un Pack Mayores
//
//  SOLO se escriben los campos que se apartan del default.
// ─────────────────────────────────────────────────────────────────────
export const CATEGORIAS_ADICIONALES = [

  // ── CATEGORÍA 1 · INCLUIDOS (gratis, opt-in para planificar) ─────────
  {
    id: 'incluidos', label: 'Incluidos', emoji: '🎁', filtraPorEdad: false,
    desc: 'Detalles sin costo que sumas a tu reserva para que lo dejemos todo listo',
    seleccionMultiple: true,
    items: [
      { id: 'inc-cocina', nombre: 'Cocina Equipada',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '🍳',
        desc: 'Refrigera torta y bebidas y muévete con comodidad. Sin costo — súmala a tu reserva.' },
      { id: 'inc-parlantes', nombre: 'Parlantes Bluetooth',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '🔊',
        desc: 'Conecta tu celular y pon tu playlist favorita. Sistema de sonido incluido, sin costo.' },
      { id: 'inc-ruedas', nombre: 'Ruedas Libres',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '🛴',
        desc: 'Trae bici, patín o scooter y aprovecha la Autopista Gigante. Hasta 3 en total.' },
      { id: 'inc-mesas', nombre: 'Mesas Extra',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '🍴',
        desc: 'Suma 2 mesas grandes plegables para comida y decoración. Mesas y sillas de niños ya incluidas.' },
      { id: 'inc-zanahoria', nombre: 'Zanahoria para los Conejitos',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '🥕',
        desc: 'Los niños alimentan a los conejitos del jardín con zanahoria y lechuga. Un clásico que encanta.' },
      // Invitación digital — perk siempre incluido (no seleccionable)
      { id: 'invitacion-digital', nombre: 'Invitación Digital',
        precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 }, gratis: true, emoji: '💌',
        desc: 'Diseño personalizado con el nombre de tu hij@ para compartir por WhatsApp. Incluida GRATIS.' },
    ],
  },

  // ── CATEGORÍA 2 · INFLABLES (carrusel · precio plano) ────────────────
  //  GIGANTES  → siempre visibles (cualquier cantidad de niños, con o sin
  //              mayores de 6). Son los únicos aptos para Pack Mayores.
  //  MEDIANOS y PEQUEÑOS → solo hasta 20 niños Y sin mayores de 6.
  {
    id: 'inflables', label: 'Inflables', emoji: '🏰', filtraPorEdad: true,
    desc: 'Traslado, instalación y electricidad incluidos en todos nuestros inflables',
    seleccionMultiple: true,
    items: [
      { id: 'tobogan-premium', nombre: 'Tobogán Premium',
        precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 }, emoji: '🎢',
        desc: 'Inflable gigante con resbalín y zona de juegos. El favorito indiscutido.',
        tamano: 'gigante', edad_min: 2, edad_max: 12,
        categoria_pack: 'inflable_gigante', apto_pack_mayores: true },
      { id: 'gran-castillo', nombre: 'Gran Castillo',
        precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 }, emoji: '🏰',
        desc: 'Castillo medieval gigante con gran tobogán y amplia zona de saltos.',
        tamano: 'gigante', edad_min: 2, edad_max: 12,
        categoria_pack: 'inflable_gigante', apto_pack_mayores: true },
      { id: 'super-saltarina', nombre: 'Súper Saltarina',
        precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 }, emoji: '🎈',
        desc: 'Cama elástica inflable gigante para saltar sin parar toda la fiesta.',
        tamano: 'gigante', edad_min: 2, edad_max: 12,
        categoria_pack: 'inflable_gigante', apto_pack_mayores: true },
      { id: 'tiburon-escalador', nombre: 'Tiburón Escalador',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 }, emoji: '🦈',
        desc: 'Tobogán, muro de escalada y pistola acuática. Aventura marina asegurada.',
        tamano: 'mediano', edad_min: 1, edad_max: 6,
        ninos_max: 20, ocultar_si_mayores: true, apto_mayores: false },
      { id: 'barco-pirata', nombre: 'Barco Pirata',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 }, emoji: '🏴‍☠️',
        desc: 'Aventura pirata inflable con tobogán y zona de juegos.',
        tamano: 'mediano', edad_min: 1, edad_max: 6,
        ninos_max: 20, ocultar_si_mayores: true, apto_mayores: false },
      { id: 'monkey-climb', nombre: 'Monkey Climb',
        precios: { hasta10: 55000, hasta20: 55000, hasta30: 55000, mas30: 55000 }, emoji: '🐒',
        desc: 'Zona de escalada y saltos para pequeños aventureros.',
        tamano: 'mediano', edad_min: 1, edad_max: 6,
        ninos_max: 20, ocultar_si_mayores: true, apto_mayores: false },
      { id: 'castillo-avion', nombre: 'Castillo Avión',
        precios: { hasta10: 40000, hasta20: 40000, hasta30: 40000, mas30: 40000 }, emoji: '✈️',
        desc: 'Castillo inflable temático de avión, ideal para los más pequeños.',
        tamano: 'pequeno', edad_min: 0, edad_max: 5,
        ninos_max: 20, ocultar_si_mayores: true, apto_mayores: false },
      { id: 'castillo-futbolero', nombre: 'Castillo Futbolero',
        precios: { hasta10: 40000, hasta20: 40000, hasta30: 40000, mas30: 40000 }, emoji: '⚽',
        desc: 'Castillo inflable con temática de fútbol para mini cracks.',
        tamano: 'pequeno', edad_min: 0, edad_max: 5,
        ninos_max: 20, ocultar_si_mayores: true, apto_mayores: false },
    ],
  },

  // ── CATEGORÍA 3 · JUEGOS (carrusel · precio plano) ───────────────────
  //  DEPORTIVOS para Pack Mayores = Mini Deportivos + Súper Recreativos
  //  (decisión de César 2026-08: ambos grupos cuentan como "deportivo").
  //  Los AUTOS ELÉCTRICOS son para los más chicos: no entran a los packs.
  {
    id: 'juegos', label: 'Juegos', emoji: '🎮', filtraPorEdad: true,
    desc: 'Autos eléctricos y juegos deportivos para la Autopista Gigante y el torneo familiar',
    seleccionMultiple: true,
    items: [
      // Los autos eléctricos son para pilotos chicos: se ofrecen solo cuando
      // todos los invitados tienen hasta 5 años (sin mayores de 6 y con el
      // festejado dentro del rango). Con niños grandes en la fiesta quedan
      // fuera — no rinden y se convierten en un problema de convivencia.
      { id: 'hoppy-jeep', nombre: 'Hoppy Jeep',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 }, emoji: '🚙',
        desc: 'Jeep eléctrico para recorrer la Autopista Gigante del jardín.',
        edad_min: 1, edad_max: 5, apto_mayores: false, ocultar_si_mayores: true },
      { id: 'funny-bugatti', nombre: 'Funny Bugatti',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 }, emoji: '🏎️',
        desc: 'Auto deportivo eléctrico — el favorito de los mini pilotos.',
        edad_min: 1, edad_max: 5, apto_mayores: false, ocultar_si_mayores: true },
      { id: 'retro-excava', nombre: 'Retro Excava',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 }, emoji: '🚜',
        desc: 'Retroexcavadora eléctrica para pequeños constructores.',
        edad_min: 1, edad_max: 5, apto_mayores: false, ocultar_si_mayores: true },
      // Kart a pedales: entretenido como adicional, pero no es un juego de
      // competencia que resuelva a un grupo de niños grandes → no cuenta
      // para el deportivo obligatorio del Pack Mayores (decisión de César).
      { id: 'racing-kart', nombre: 'Racing Kart',
        precios: { hasta10: 15000, hasta20: 15000, hasta30: 15000, mas30: 15000 }, emoji: '🏁',
        desc: 'Kart a pedales para correr por la autopista del jardín.',
        edad_min: 3, edad_max: 10, categoria_pack: 'deportivo', apto_pack_mayores: false },
      // "Juego de puntería para los más chicos": su propio rango técnico no
      // sirve para entretener a los mayores → fuera del Pack Mayores.
      { id: 'tiggy-junior', nombre: 'Tiggy Junior',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '🎯',
        desc: 'Juego de puntería y destreza para los más chicos.',
        edad_min: 3, edad_max: 8, categoria_pack: 'deportivo', apto_pack_mayores: false },
      { id: 'hockey-junior', nombre: 'Hockey Junior',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '🏒',
        desc: 'Mesa de hockey tamaño niños — ¡competencia asegurada!',
        edad_min: 3, edad_max: 12, categoria_pack: 'deportivo', apto_pack_mayores: true },
      { id: 'tacataca-junior', nombre: 'Taca Taca Junior',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '⚽',
        desc: 'Mesa de futbolín a la medida de los niños.',
        edad_min: 3, edad_max: 12, categoria_pack: 'deportivo', apto_pack_mayores: true },
      { id: 'pingpong-junior', nombre: 'Ping Pong Junior',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '🏓',
        desc: 'Mesa de ping pong adaptada para los más chicos.',
        edad_min: 3, edad_max: 12, categoria_pack: 'deportivo', apto_pack_mayores: true },
      // Las mesas tamaño adulto se ofrecen SIEMPRE (edad 0-99): aunque el
      // festejado sea chico, los papás y tíos juegan igual. Nunca se filtran
      // por edad — decisión de negocio, no supuesto del sistema.
      { id: 'tacataca-adultos', nombre: 'Taca Taca Adultos',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '⚽',
        desc: 'Futbolín tamaño completo para papás y niños grandes.',
        edad_min: 0, edad_max: 99, categoria_pack: 'deportivo', apto_pack_mayores: true },
      { id: 'pingpong-adultos', nombre: 'Ping Pong Adultos',
        precios: { hasta10: 25000, hasta20: 25000, hasta30: 25000, mas30: 25000 }, emoji: '🏓',
        desc: 'Mesa de ping pong reglamentaria para el torneo familiar.',
        edad_min: 0, edad_max: 99, categoria_pack: 'deportivo', apto_pack_mayores: true },
    ],
  },

  // ── CATEGORÍA 4 · DECORACIÓN (sin carrusel · precio plano) ───────────
  {
    id: 'decoracion', label: 'Decoración', emoji: '🎨', filtraPorEdad: false,
    desc: 'Transforma el espacio — genérica o con el personaje favorito, simple o full',
    seleccionMultiple: false,
    items: [
      { id: 'deco-generica-simple', nombre: 'Genérica Simple',
        precios: { hasta10: 35000, hasta20: 35000, hasta30: 35000, mas30: 35000 }, emoji: '🎈',
        desc: 'Arco de globos y banderines de colores clásicos.', edad_max: 99 },
      { id: 'deco-tematica-simple', nombre: 'Temática Simple',
        precios: { hasta10: 50000, hasta20: 50000, hasta30: 50000, mas30: 50000 }, emoji: '🦄',
        desc: 'Arco de globos y banderines del personaje que elijas.', edad_max: 99 },
      { id: 'deco-generica-full', nombre: 'Genérica Full',
        precios: { hasta10: 60000, hasta20: 60000, hasta30: 60000, mas30: 60000 }, emoji: '🎊',
        desc: 'Arco, banderines, número de edad, mantel, vasos, platos, servilletas y fondo de celebración.', edad_max: 99 },
      { id: 'deco-tematica-full', nombre: 'Temática Full',
        precios: { hasta10: 75000, hasta20: 75000, hasta30: 75000, mas30: 75000 }, emoji: '✨',
        desc: 'Todo el montaje Full con el personaje favorito: arco, mantelería, número gigante y fondo temático.', edad_max: 99 },
    ],
  },

  // ── CATEGORÍA 5 · ANIMACIÓN (carrusel · precio POR CANTIDAD de niños) ─
  //  Pintacaritas y Globoflexia = la más básica → NO entra a los Packs
  //  Mayores (decisión de César 2026-08). Las otras 7 sí.
  {
    id: 'animacion', label: 'Animación', emoji: '🎭', filtraPorEdad: true,
    desc: 'Shows profesionales que los niños recordarán para siempre — valor según cantidad de niños',
    seleccionMultiple: true,
    items: [
      // Es la animación más barata del catálogo: fija el "desde $65.000"
      // que se comunica por WhatsApp (confirmado por César 2026-08-29).
      { id: 'pintacaritas-globoflexia', nombre: 'Pintacaritas y Globoflexia',
        precios: { hasta10: 65000, hasta20: 70000, hasta30: 80000, mas30: 90000 }, emoji: '🎨',
        desc: 'Arte facial personalizado y figuras de globos para cada niño.',
        edad_min: 2, edad_max: 10, categoria_pack: null, apto_pack_mayores: false },
      { id: 'animacion-full-juegos', nombre: 'Animación Full Juegos',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 }, emoji: '🎉',
        desc: 'Juegos dirigidos, concursos y baile durante toda la celebración.',
        edad_min: 3, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      { id: 'animacion-completa', nombre: 'Animación Completa',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 }, emoji: '🎪',
        desc: 'Show completo: juegos, títeres, concursos, baile y sorpresas.',
        edad_min: 3, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      { id: 'animacion-pack-guerrera', nombre: 'Animación Pack Guerrera',
        precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 }, emoji: '🕺',
        desc: 'Show de baile con animadoras guerreras — el favorito de las niñas.',
        edad_min: 3, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      { id: 'animacion-huntrix', nombre: 'Animación Full Huntrix',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 }, emoji: '💜',
        desc: 'El show K-pop del momento: baile, música y personajes Huntrix.',
        edad_min: 4, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      { id: 'animacion-personaje', nombre: 'Animación Personaje Favorito',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 }, emoji: '👑',
        desc: 'El personaje favorito de tu hij@ anima la fiesta completa.',
        edad_min: 2, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      { id: 'animacion-spiderman', nombre: 'Animación Spiderman',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 }, emoji: '🕷️',
        desc: 'El héroe arácnido llega a la celebración con show completo.',
        edad_min: 2, edad_max: 14, categoria_pack: 'animacion', apto_pack_mayores: true },
      // Baby shower: es otro tipo de evento, no entretención para niños
      // mayores de 6 → nunca puede satisfacer la animación del Pack Mayores.
      { id: 'animacion-baby-shower', nombre: 'Animación Baby Shower',
        precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 }, emoji: '🍼',
        desc: 'Animación especial para baby showers y celebraciones de espera.',
        edad_min: 0, edad_max: 99, categoria_pack: null, apto_pack_mayores: false },
    ],
  },
];


// ─────────────────────────────────────────────────────────────────────
// ⑤ VITRINA  (CATEGORÍA = bloque · SECCIÓN = ficha con foto)
//    Cada sección apunta a su carpeta de fotos (/public/fotos/[carpeta]).
//    · itemIds con 1+ opciones → abre carrusel.
//    · itemIds con 1 opción    → ficha directa (Decoración / Incluidos).
//    · itemIds vacío           → tarjeta INCLUIDO / COTIZAR (sin agregar).
//    · slug                    → URL compartible /catalogo/[slug]
// ─────────────────────────────────────────────────────────────────────
export const BLOQUES_VITRINA = [

  // ── CATEGORÍA 1 · INCLUIDOS ──────────────────────────────────────
  {
    id: 'b-incluidos', titulo: 'INCLUIDOS', slug: 'incluidos',
    subTitulo: 'Sin costo — súmalos para dejarlo todo listo',
    addDirecto: true, // secciones de 1 opción: botón Agregar en la tarjeta, sin entrar
    grupos: [
      { id: 'g-inc-cocina', nombre: 'Cocina', subNombre: 'Refrigera y muévete con mayor comodidad.',
        carpeta: 'inc-cocina', seleccionMultiple: false, itemIds: ['inc-cocina'] },
      { id: 'g-inc-parlantes', nombre: 'Parlantes', subNombre: '2 parlantes vinculados. Tu playlist en ambos patios.',
        carpeta: 'inc-parlantes', seleccionMultiple: false, itemIds: ['inc-parlantes'] },
      { id: 'g-inc-ruedas', nombre: 'Ruedas', subNombre: 'Trae su transporte favorito. Máximo 3 unidades.',
        carpeta: 'inc-ruedas', seleccionMultiple: false, itemIds: ['inc-ruedas'] },
      { id: 'g-inc-mesas', nombre: 'Mesas', subNombre: '2 mesas plegable XL. Mesas y sillas de niños según la capacidad del recinto.',
        carpeta: 'inc-mesas', seleccionMultiple: false, itemIds: ['inc-mesas'] },
      { id: 'g-inc-zanahoria', nombre: 'Zanahoria', subNombre: 'Alimenta a los conejitos del jardín y disfruta el tour.',
        carpeta: 'inc-zanahoria', seleccionMultiple: false, itemIds: ['inc-zanahoria'] },
      // Limpieza Profunda: NO va como tarjeta — queda solo en el detalle del presupuesto
      // (resumen lateral, bottom sheet y mensaje WhatsApp, líneas hardcodeadas).
      { id: 'g-inc-invitacion', nombre: 'Invitación', subNombre: 'Tarjeta de invitación digital con la temática elegida.',
        carpeta: 'inc-invitacion', badge: 'GRATIS', badgeTipo: 'incluido',
        nota: 'Invitación digital personalizada para compartir por WhatsApp. Incluida GRATIS al reservar.',
        seleccionMultiple: false, itemIds: ['invitacion-digital'] },
    ],
  },

  // ── CATEGORÍA 2 · INFLABLES ──────────────────────────────────────
  {
    id: 'b-inflables', titulo: 'INFLABLES', slug: 'inflables',
    subTitulo: 'Traslado, instalación y electricidad incluidos',
    grupos: [
      // Ficha PORTADA (no seleccionable): imagen branded + instrucción de la categoría
      { id: 'g-infl-portada', portada: true, nombre: 'Elige tu Inflable',
        subNombre: 'Tu opción favorita por n° de invitados. Puedes elegir más de uno.',
        carpeta: 'infl-portada', itemIds: [] },
      { id: 'g-infl-gigante', nombre: 'Inflable Gigante', subNombre: 'El más grande del jardín: tobogán alto y harto espacio para saltar.',
        carpeta: 'infl-gigante', seleccionMultiple: true,
        itemIds: ['tobogan-premium', 'gran-castillo', 'super-saltarina'] },
      { id: 'g-infl-mediano', nombre: 'Inflable Mediano', subNombre: 'Seguridad y comodidad en variados y atractivos diseños.',
        carpeta: 'infl-mediano', seleccionMultiple: true,
        itemIds: ['tiburon-escalador', 'barco-pirata', 'monkey-climb'] },
      { id: 'g-infl-pequeno', nombre: 'Inflable Pequeño', subNombre: 'Para los más pequeños con máxima energía y control.',
        carpeta: 'infl-pequeno', seleccionMultiple: true,
        itemIds: ['castillo-avion', 'castillo-futbolero'] },
    ],
  },

  // ── CATEGORÍA 3 · JUEGOS ─────────────────────────────────────────
  {
    id: 'b-juegos', titulo: 'JUEGOS', slug: 'juegos',
    subTitulo: 'Para la Autopista Gigante y el torneo familiar',
    grupos: [
      { id: 'g-juegos-portada', portada: true, nombre: 'Entretención Asegurada',
        subNombre: 'Mesas de competencia y juegos para la Autopista Gigante',
        carpeta: 'juegos-portada', itemIds: [] },
      { id: 'g-elec-autos', nombre: 'Autos Eléctricos', subNombre: 'Una experiencia única para nuestros pequeños pilotos.',
        carpeta: 'elec-autos', seleccionMultiple: true,
        itemIds: ['hoppy-jeep', 'funny-bugatti', 'retro-excava'] },
      { id: 'g-dep-mini', nombre: 'Mini Deportivos', subNombre: 'Los mejores torneos para desarrollar una competencia sana.',
        carpeta: 'dep-mini', seleccionMultiple: true,
        itemIds: ['racing-kart', 'tiggy-junior', 'hockey-junior', 'tacataca-junior', 'pingpong-junior'] },
      { id: 'g-dep-recreativos', nombre: 'Súper Recreativos', subNombre: 'Para que los adultos no se queden fuera de la diversión.',
        carpeta: 'dep-recreativos', seleccionMultiple: true,
        itemIds: ['tacataca-adultos', 'pingpong-adultos'] },
    ],
  },

  // ── CATEGORÍA 4 · DECORACIÓN ─────────────────────────────────────
  {
    id: 'b-decoracion', titulo: 'DECORACIÓN', slug: 'decoracion',
    subTitulo: 'Genérica o temática · simple o full',
    addDirecto: true, // secciones de 1 opción: botón Agregar en la tarjeta, sin entrar
    grupos: [
      { id: 'g-deco-gen-simple', nombre: 'Genérica Simple', subNombre: 'Arco de globos y banderines clásicos',
        carpeta: 'deco-gen-simple', seleccionMultiple: false, itemIds: ['deco-generica-simple'] },
      { id: 'g-deco-tem-simple', nombre: 'Temática Simple', subNombre: 'Globos y banderines del personaje',
        carpeta: 'deco-tem-simple', seleccionMultiple: false, itemIds: ['deco-tematica-simple'] },
      { id: 'g-deco-gen-full', nombre: 'Genérica Full', subNombre: 'Montaje completo de mesa y ambiente',
        carpeta: 'deco-gen-full', seleccionMultiple: false, itemIds: ['deco-generica-full'] },
      { id: 'g-deco-tem-full', nombre: 'Temática Full', subNombre: 'Montaje completo con el personaje favorito',
        carpeta: 'deco-tem-full', seleccionMultiple: false, itemIds: ['deco-tematica-full'] },
    ],
  },

  // ── CATEGORÍA 5 · ANIMACIÓN ──────────────────────────────────────
  {
    id: 'b-animacion', titulo: 'ANIMACIÓN', slug: 'animacion',
    subTitulo: 'Valor según cantidad de niños',
    grupos: [
      { id: 'g-anim-pintaglobo', nombre: 'Animación Pintaglobo', subNombre: 'Pintacaritas y globoflexia para cada niño',
        carpeta: 'anim-pintaglobo', seleccionMultiple: false, itemIds: ['pintacaritas-globoflexia'] },
      { id: 'g-anim-full', nombre: 'Animación Full', subNombre: 'Full Juegos · Completa · Pack Guerrera',
        carpeta: 'anim-full', seleccionMultiple: false,
        itemIds: ['animacion-full-juegos', 'animacion-completa', 'animacion-pack-guerrera'] },
      { id: 'g-anim-vip', nombre: 'Animación VIP', subNombre: 'Huntrix · Personaje · Spiderman · Baby Shower',
        carpeta: 'anim-vip', seleccionMultiple: false,
        itemIds: ['animacion-huntrix', 'animacion-personaje', 'animacion-spiderman', 'animacion-baby-shower'] },
    ],
  },

  // ── CATEGORÍA 6 · BANQUETERÍA NIÑOS (próximamente · cotizar) ──────
  {
    id: 'b-banq-ninos', titulo: 'BANQUETERÍA NIÑOS', slug: 'banqueteria-ninos',
    subTitulo: 'Menús pensados para los más chicos',
    grupos: [
      { id: 'g-banq-carrito', nombre: 'Carrito', subNombre: 'Mini sándwich recién hechos',
        carpeta: 'banq-ninos-carrito', badge: 'COTIZAR', badgeTipo: 'cotizar',
        nota: 'Mini hamburguesas, mini lomitos, mini mechadas y mini completos — todos con salsas y agregados. Cuéntanos y te cotizamos sin compromiso.',
        seleccionMultiple: false, itemIds: [] },
      { id: 'g-banq-coctel-ninos', nombre: 'Cóctel Niños', subNombre: 'Snacks y dulces para la mesa',
        carpeta: 'banq-ninos-coctel', badge: 'COTIZAR', badgeTipo: 'cotizar',
        nota: 'Armamos el cóctel infantil a tu medida. Cuéntanos qué te imaginas y lo cotizamos sin compromiso.',
        seleccionMultiple: false, itemIds: [] },
    ],
  },

  // ── CATEGORÍA 7 · BANQUETERÍA ADULTOS (próximamente · cotizar) ────
  {
    id: 'b-banq-adultos', titulo: 'BANQUETERÍA ADULTOS', slug: 'banqueteria-adultos',
    subTitulo: 'Para que los grandes también disfruten',
    grupos: [
      { id: 'g-banq-adultos', nombre: 'Banquetería Adultos', subNombre: 'Cóctel, sándwich y más',
        carpeta: 'banq-adultos', badge: 'COTIZAR', badgeTipo: 'cotizar',
        nota: 'Todos nuestros sándwich van con salsas además de los agregados. Armamos el menú de adultos a tu medida — cotización sin compromiso.',
        seleccionMultiple: false, itemIds: [] },
    ],
  },

  // ── CATEGORÍA 8 · VIDEO JUEGOS +7 (próximamente · cotizar) ────────
  {
    id: 'b-videojuegos', titulo: 'VIDEO JUEGOS +7', slug: 'videojuegos',
    subTitulo: 'Un espacio propio para los hermanos mayores',
    grupos: [
      { id: 'g-videojuegos', nombre: 'Sala de Consola', subNombre: 'Con autorización de los papás',
        carpeta: 'videojuegos', badge: '+7 AÑOS', badgeTipo: 'cotizar',
        nota: 'Con autorización de los papás, habilitamos una sala con consola para que los mayores de 7 años tengan su propio espacio. Consúltanos disponibilidad.',
        seleccionMultiple: false, itemIds: [] },
    ],
  },

  // ── CATEGORÍA 9 · PACKS PARA HERMANOS MAYORES ────────────────────
  //  Ya no es "próximamente": los packs existen y el armador los asigna solo.
  //  Esta tarjeta NO muestra precios (los definitivos están pendientes) —
  //  explica la lógica y deriva a /armar, que es donde se configuran.
  {
    id: 'b-packs', titulo: 'PACKS PARA HERMANOS MAYORES', slug: 'packs',
    subTitulo: 'Entretención adecuada cuando vienen niños mayores de 6',
    grupos: [
      { id: 'g-packs', nombre: 'Packs para Hermanos Mayores',
        subNombre: 'El armador los arma automáticamente según tu celebración',
        carpeta: 'packs', badge: 'MAYORES DE 6', badgeTipo: 'cotizar',
        lead: 'Se arma en el armador',
        ctaLabel: 'Armar mi celebración →',
        href: '/armar',
        nota: '¿Vendrán niños mayores de 6 años? Al armar tu celebración te mostraremos automáticamente una combinación de entretención adecuada según cuántos sean y el número total de invitados.',
        seleccionMultiple: false, itemIds: [] },
    ],
  },
];
