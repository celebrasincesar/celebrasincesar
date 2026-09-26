// ══════════════════════════════════════════════════════════════════════
// PACKS PARA NIÑOS MAYORES DE 6 — CONFIGURACIÓN
// ──────────────────────────────────────────────────────────────────────
// Alce Kids está diseñado para niños de 0 a 6 años. Cuando vienen hermanos
// o invitados MAYORES de 6, la web arma automáticamente una configuración
// mínima de entretención pensada para ellos.
//
// NO es un recargo ni una multa: es la solución para que todos disfruten.
// Contratar un pack NO habilita a los mayores de 6 a usar la infraestructura
// fija 0-6 del jardín (piscina de pelotas, tobogán, estructuras).
//
// ── CÓMO SE ELIGE EL PACK ────────────────────────────────────────────
//   tramo de mayores  →  qué pack corresponde
//     1 a 3 mayores   →  PACK_MAYORES_1
//     4 a 6 mayores   →  PACK_MAYORES_2
//     7 o más         →  PACK_MAYORES_3
//   Dentro del pack, la VARIANTE depende del total de niños:
//     hasta 20 niños  ·  21 a 40 niños
//
// ── CÓMO SE LEE UNA VARIANTE ─────────────────────────────────────────
//   requisitos = [ bloque, bloque, ... ]   (todos obligatorios)
//   bloque     = { id, ramas: [...] }
//     · 1 rama   → configuración fija (no se elige, solo se rellena)
//     · 2+ ramas → el cliente elige UNA rama y luego la rellena
//   rama       = { id, label, pide: [{ categoria, cantidad }] }
//
//   La ESTRUCTURA es obligatoria; QUÉ producto entra en cada casilla lo
//   elige siempre el cliente entre las opciones válidas.
//
// ── PRECIOS ──────────────────────────────────────────────────────────
//   precio: null  →  mientras César no fije el valor, el pack cobra la
//                    SUMA de los productos elegidos (precio referencial).
//   precio: 120000 → valor cerrado del pack, sin importar qué elija.
//   descuento: 15000 → se resta de la suma cuando precio es null.
// ══════════════════════════════════════════════════════════════════════


// ── Categorías de producto que participan de los packs ────────────────
// El campo `categoria_pack` de cada opción en data/master.js apunta acá.
export const CATEGORIAS_PACK = {
  deportivo: {
    id: 'deportivo',
    label: 'Juego deportivo',
    plural: 'Juegos deportivos',
    emoji: '🏓',
    // Texto sin ambigüedad — decisión de César: cuentan AMBOS grupos.
    ayuda: 'Mesas y juegos de competencia: Mini Deportivos (hockey, taca taca, ping pong, tiggy y kart, tamaño niños) y Súper Recreativos (taca taca y ping pong tamaño adulto). Cualquiera de los dos grupos cuenta como juego deportivo.',
  },
  inflable_gigante: {
    id: 'inflable_gigante',
    label: 'Inflable gigante',
    plural: 'Inflables gigantes',
    emoji: '🏰',
    ayuda: 'Solo los inflables gigantes son aptos para niños mayores de 6 (Tobogán Premium, Gran Castillo y Súper Saltarina). Los medianos y pequeños están hechos para los más chicos.',
  },
  animacion: {
    id: 'animacion',
    label: 'Animación',
    plural: 'Animaciones',
    emoji: '🎭',
    ayuda: 'Shows con animador profesional que funcionan con niños grandes. La Animación Pintaglobo no entra en los packs porque está pensada para los más pequeños.',
  },
};


// ── Los 3 packs ───────────────────────────────────────────────────────
export const PACKS_MAYORES = [

  // ────────────────────────────────────────────────────────────────
  // PACK 1 · 1 a 3 niños mayores de 6
  // ────────────────────────────────────────────────────────────────
  {
    id: 'PACK_MAYORES_1',
    nombre: 'Entretención Hermanos Mayores',
    descripcion: 'Vienen pocos niños grandes: con una alternativa bien elegida quedan felices toda la tarde.',
    tramo_mayores_min: 1,
    tramo_mayores_max: 3,
    variantes: [
      {
        id: 'v-hasta20',
        total_ninos_min: 1,
        total_ninos_max: 20,
        precio: null,      // ← César define el valor cerrado del pack
        descuento: 0,
        requisitos: [
          {
            id: 'r-config',
            titulo: 'Elige la entretención para los mayores',
            ramas: [
              { id: 'dos-deportivos', label: '2 juegos deportivos',
                resumen: 'Dos mesas de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 2 }] },
              { id: 'inflable', label: '1 inflable gigante',
                resumen: 'Un inflable apto para niños grandes',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
              { id: 'animacion', label: '1 animación',
                resumen: 'Un show con animador profesional',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
        ],
      },
      {
        id: 'v-21a40',
        total_ninos_min: 21,
        total_ninos_max: 40,
        precio: null,
        descuento: 0,
        requisitos: [
          {
            id: 'r-deportivo',
            titulo: 'Tu juego deportivo',
            ramas: [
              { id: 'unica', label: '1 juego deportivo',
                resumen: 'Una mesa de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-config',
            titulo: 'Y además elige una de estas',
            ramas: [
              { id: 'inflable', label: '1 inflable gigante',
                resumen: 'Un inflable apto para niños grandes',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
              { id: 'animacion', label: '1 animación',
                resumen: 'Un show con animador profesional',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PACK 2 · 4 a 7 niños mayores de 6
  // ────────────────────────────────────────────────────────────────
  {
    id: 'PACK_MAYORES_2',
    nombre: 'Entretención Grupo Mayor',
    descripcion: 'Ya son un grupo: necesitan una actividad central y mesas para turnarse sin esperas.',
    tramo_mayores_min: 4,
    tramo_mayores_max: 6,
    variantes: [
      {
        id: 'v-hasta20',
        total_ninos_min: 1,
        total_ninos_max: 20,
        precio: null,
        descuento: 0,
        requisitos: [
          {
            id: 'r-config',
            titulo: 'Elige la actividad central',
            ramas: [
              { id: 'inflable', label: '1 inflable gigante',
                resumen: 'Un inflable apto para niños grandes',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
              { id: 'animacion', label: '1 animación',
                resumen: 'Un show con animador profesional',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-deportivos',
            titulo: 'Más tus juegos deportivos',
            ramas: [
              { id: 'unica', label: '2 juegos deportivos',
                resumen: 'Dos mesas de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 2 }] },
            ],
          },
        ],
      },
      {
        id: 'v-21a40',
        total_ninos_min: 21,
        total_ninos_max: 40,
        precio: null,
        descuento: 0,
        requisitos: [
          {
            id: 'r-config',
            titulo: 'Elige la actividad central',
            ramas: [
              { id: 'inflable', label: '1 inflable gigante',
                resumen: 'Un inflable apto para niños grandes',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
              { id: 'animacion', label: '1 animación',
                resumen: 'Un show con animador profesional',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-deportivos',
            titulo: 'Más tus juegos deportivos',
            ramas: [
              { id: 'unica', label: '3 juegos deportivos',
                resumen: 'Tres mesas de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 3 }] },
            ],
          },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // PACK 3 · 8 o más niños mayores de 6
  // ────────────────────────────────────────────────────────────────
  {
    id: 'PACK_MAYORES_3',
    nombre: 'Entretención Doble Fiesta',
    descripcion: 'Son prácticamente dos fiestas en paralelo: los grandes necesitan inflable, animación y mesas propias.',
    tramo_mayores_min: 7,
    tramo_mayores_max: 99,
    variantes: [
      {
        id: 'v-hasta20',
        total_ninos_min: 1,
        total_ninos_max: 20,
        precio: null,
        descuento: 0,
        requisitos: [
          {
            id: 'r-inflable',
            titulo: 'Tu inflable gigante',
            ramas: [
              { id: 'unica', label: '1 inflable gigante',
                resumen: 'Incluido en este pack — elige cuál',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-animacion',
            titulo: 'Tu animación',
            ramas: [
              { id: 'unica', label: '1 animación',
                resumen: 'Incluida en este pack — elige cuál',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-deportivos',
            titulo: 'Tus juegos deportivos',
            ramas: [
              { id: 'unica', label: '2 juegos deportivos',
                resumen: 'Dos mesas de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 2 }] },
            ],
          },
        ],
      },
      {
        id: 'v-21a40',
        total_ninos_min: 21,
        total_ninos_max: 40,
        precio: null,
        descuento: 0,
        requisitos: [
          {
            id: 'r-inflable',
            titulo: 'Tu inflable gigante',
            ramas: [
              { id: 'unica', label: '1 inflable gigante',
                resumen: 'Incluido en este pack — elige cuál',
                pide: [{ categoria: 'inflable_gigante', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-animacion',
            titulo: 'Tu animación',
            ramas: [
              { id: 'unica', label: '1 animación',
                resumen: 'Incluida en este pack — elige cuál',
                pide: [{ categoria: 'animacion', cantidad: 1 }] },
            ],
          },
          {
            id: 'r-deportivos',
            titulo: 'Tus juegos deportivos',
            ramas: [
              { id: 'unica', label: '3 juegos deportivos',
                resumen: 'Tres mesas de competencia a elección',
                pide: [{ categoria: 'deportivo', cantidad: 3 }] },
            ],
          },
        ],
      },
    ],
  },
];


// ── Mensaje comercial que ve el papá (nunca legal, nunca punitivo) ────
export const COPY_MAYORES = {
  titulo: 'También pensamos en los hermanos mayores 🎉',
  texto:
    'Alce Kids está especialmente diseñado para niños pequeños. Cuando vienen hermanos o ' +
    'invitados mayores, incorporamos alternativas de entretención especialmente pensadas para ' +
    'ellos para que todos puedan disfrutar la celebración.',
  nota:
    'Los juegos fijos del jardín (piscina de pelotas, tobogán y estructuras) quedan reservados ' +
    'para los niños de 0 a 6 años. Es nuestra forma de cuidar la seguridad de todos.',
};
