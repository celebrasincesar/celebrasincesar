// ─────────────────────────────────────────────────────────────────────────────
// STATS CENTRALIZADOS — Fuente única de verdad
//
// Actualiza SOLO este archivo cuando cambien los números del negocio.
// La web lee desde aquí → al hacer deploy, se actualiza en todos los lugares.
//
// Última actualización: Septiembre 2026 (Fase 4A)
// ─────────────────────────────────────────────────────────────────────────────

export const STATS = {
  // ── Google ────────────────────────────────────────────────────────────────
  reseñas: 45,                   // Mínimo verificable de reseñas en Google (se muestra como "45+")
  rating: '5.0',                 // Calificación promedio (string para mostrar exacto)

  // ── Negocio ───────────────────────────────────────────────────────────────
  añosHistoria: 40,              // Años de historia familiar en Las Condes (se muestra como "40+")
  edadMin: 0,                    // Edad mínima (niños)
  edadMax: 6,                    // Edad máxima (niños)

  // ── Instagram ─────────────────────────────────────────────────────────────
  seguidores: '1.400',           // Seguidores actuales en Instagram (@celebracionesalce)
  handle: '@celebracionesalce',  // Handle de Instagram
};

// ── Textos derivados (no editar: se generan desde STATS) ────────────────────

// Etiqueta única de reputación — usar SIEMPRE esta en toda la web
export const RESEÑAS_LABEL = `${STATS.reseñas}+ reseñas en Google`;

// Etiqueta de trayectoria
export const AÑOS_HISTORIA_LABEL = `${STATS.añosHistoria}+ años de historia familiar en Las Condes`;

// Texto de cada reseña individual
export const RESEÑA_ORIGEN_LABEL = 'Reseña en Google';

// Texto del strip de Instagram (home)
export const INSTAGRAM_STRIP_TEXT =
  `${STATS.handle} · +${STATS.seguidores} familias del sector oriente · fotos reales del recinto`;

// Texto de reseñas corto (para badges y subtítulos)
export const RESEÑAS_CORTO = `${RESEÑAS_LABEL} · Promedio ${STATS.rating}`;

// Texto de reseñas largo (para encabezados de sección)
export const RESEÑAS_LARGO = RESEÑAS_LABEL;
