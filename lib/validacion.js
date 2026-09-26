// ══════════════════════════════════════════════════════════════════════
// PRIMITIVAS DE VALIDACIÓN Y SANEADO  ·  lib/validacion.js
// ──────────────────────────────────────────────────────────────────────
// Funciones puras, sin ninguna dependencia de Next.js — a propósito, para
// que tanto las rutas /api (vía lib/http.js, que las reexporta tal cual)
// como los archivos que scripts/qa-*.mjs necesita poder importar en Node
// suelto (lib/visitas.js, lib/visita-auth.js) puedan usarlas sin arrastrar
// 'next/server', que Node no resuelve fuera del build de Next — mismo
// motivo ya documentado en el encabezado de lib/mi-celebracion-auth.js.
// ══════════════════════════════════════════════════════════════════════

export const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export const CODIGO_RESERVA = /^CSC-\d{4}-\d{6}$/;
export const TOKEN_ACCESO = /^[a-f0-9]{32}$/;
// Deliberadamente permisivo: validar direcciones de correo con una
// expresión estricta rechaza correos válidos y no atrapa los inválidos.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Teléfono chileno tolerante: se escribe como se quiera y se guarda
// normalizado.
export function normalizarTelefono(v) {
  const solo = String(v ?? '').replace(/[^\d+]/g, '');
  if (!solo) return '';
  if (solo.startsWith('+')) return solo.slice(0, 16);
  if (solo.startsWith('56')) return `+${solo}`.slice(0, 16);
  if (solo.length === 9) return `+56${solo}`;
  if (solo.length === 8) return `+569${solo}`;
  return solo.slice(0, 16);
}

export const telefonoValido = (v) => /^\+?\d{8,15}$/.test(String(v ?? ''));

// Comparación en tiempo constante: el tiempo de respuesta no dice cuántos
// caracteres del token se adivinaron bien.
export function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
