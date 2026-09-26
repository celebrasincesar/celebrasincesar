// ══════════════════════════════════════════════════════════════════════
// AUTORIZACIÓN DE MI CELEBRACIÓN  ·  lib/mi-celebracion-auth.js
// ──────────────────────────────────────────────────────────────────────
// Mismo candado que ya usa /api/pagos/flow/status: código+token,
// igualSeguro(), sin filtrar si el código existe o no. Separado en su
// propio archivo (y no en lib/reservas.js) a propósito: lib/http.js
// importa `NextResponse` de 'next/server', que scripts/qa-*.mjs no puede
// resolver en Node suelto — si esto viviera en lib/reservas.js, cualquier
// script de QA que ya importa de ahí (fechaISO, detalleDeReserva, etc.)
// dejaría de poder correr fuera de Next.
// ══════════════════════════════════════════════════════════════════════

import { reservaPorCodigo } from './reservas';
import { texto, CODIGO_RESERVA, TOKEN_ACCESO, igualSeguro } from './http';

export async function reservaDesdeParams(id, t) {
  if (!CODIGO_RESERVA.test(id) || !TOKEN_ACCESO.test(t)) return null;
  const reserva = await reservaPorCodigo(id);
  if (!reserva || !igualSeguro(reserva.acceso_token, t)) return null;
  return reserva;
}

export function leerIdYToken(fuente) {
  return {
    id: texto(fuente?.id, 40).toUpperCase(),
    t: texto(fuente?.t, 64),
  };
}
