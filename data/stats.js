// ─────────────────────────────────────────────────────────────────────────────
// STATS CENTRALIZADOS — Fuente única de verdad
//
// Actualiza SOLO este archivo cuando cambien los números del negocio.
// La web lee desde aquí → al hacer deploy, se actualiza en todos los lugares.
//
// Última actualización: Mayo 2026
// ─────────────────────────────────────────────────────────────────────────────

export const STATS = {
  // ── Google Maps ───────────────────────────────────────────────────────────
  reseñas: 35,                   // Número total de reseñas verificadas en Google
  rating: '5.0',                 // Calificación promedio (string para mostrar exacto)

  // ── Negocio ───────────────────────────────────────────────────────────────
  añosHistoria: 40,              // Años de historia familiar en Las Condes
  edadMin: 0,                    // Edad mínima (niños)
  edadMax: 6,                    // Edad máxima (niños)

  // ── Instagram ─────────────────────────────────────────────────────────────
  seguidores: '1.400',           // Seguidores actuales en Instagram (@celebracionesalce)
  handle: '@celebracionesalce',  // Handle de Instagram

  // ── Textos derivados (se generan automáticamente, no editar) ──────────────
  // Estos se usan directamente en la web como textos completos
};

// Texto del strip de Instagram (home)
export const INSTAGRAM_STRIP_TEXT =
  `${STATS.handle} · +${STATS.seguidores} familias del sector oriente · fotos reales del recinto`;

// Texto de reseñas corto (para badges y subtítulos)
export const RESEÑAS_CORTO =
  `${STATS.reseñas} reseñas verificadas · Promedio ${STATS.rating} en Google Maps`;

// Texto de reseñas largo (para encabezados de sección)
export const RESEÑAS_LARGO =
  `${STATS.reseñas} reseñas verificadas en Google Maps`;
