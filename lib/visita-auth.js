// ══════════════════════════════════════════════════════════════════════
// AUTORIZACIÓN DE VISITAS  ·  lib/visita-auth.js
// ──────────────────────────────────────────────────────────────────────
// Clon exacto de lib/mi-celebracion-auth.js (documento "FASE 3A — VISITAS
// AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A", 22-sep-2026, §12): código+token,
// igualSeguro(), sin filtrar si el código existe o no, sin cuentas ni
// contraseñas. Separado de lib/visitas.js por el mismo motivo que el
// original está separado de lib/reservas.js: lib/http.js importa
// `NextResponse` de 'next/server', que scripts/qa-*.mjs no puede resolver
// en Node suelto.
// ══════════════════════════════════════════════════════════════════════

import { visitaPorCodigo } from './visitas';
import { texto, TOKEN_ACCESO, igualSeguro } from './validacion';

export const CODIGO_VISITA = /^VIS-\d{4}-\d{6}$/;

export async function visitaDesdeParams(id, t) {
  if (!CODIGO_VISITA.test(id) || !TOKEN_ACCESO.test(t)) return null;
  const visita = await visitaPorCodigo(id);
  if (!visita || !igualSeguro(visita.acceso_token, t)) return null;
  return visita;
}

export function leerIdYToken(fuente) {
  return {
    id: texto(fuente?.id, 40).toUpperCase(),
    t: texto(fuente?.t, 64),
  };
}
