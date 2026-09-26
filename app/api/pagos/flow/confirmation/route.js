// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/pagos/flow/confirmation
// `urlConfirmation` de Flow (§13, §29). Flow llama a este endpoint por su
// cuenta, servidor a servidor, cuando el estado de un pago cambia —es la
// única notificación en la que SÍ se puede confiar, porque no depende de
// que el navegador del papá vuelva a la web.
//
// Lo único que trae el POST es `token`. No se le cree nada más al cuerpo
// del webhook: con el token se pregunta a Flow (procesarToken → getStatus)
// y de esa respuesta —nunca de esta— sale si hay plata o no (§1.11, §13.2).
//
// Responde 200 rápido y siempre, incluso ante error: Flow reintenta si no
// recibe 200, y esta ruta ya es idempotente, así que el reintento no hace
// daño (§29). Un 4xx/5xx aquí solo le pide a Flow que insista.
// ─────────────────────────────────────────────────────────────────────────────

import { procesarToken } from '../../../../../lib/pagos-flow';
import { json, texto, cuerpoDe } from '../../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await cuerpoDe(req);
  const token = texto(body?.token, 200);

  if (!token) return json({ ok: false, motivo: 'sin_token' }, 200);

  try {
    const resultado = await procesarToken(token);
    return json({ ok: true, resultado: resultado.resultado || resultado.motivo || 'procesado' }, 200);
  } catch (err) {
    // No se puede dejar caer una excepción: Flow reintentará igual, pero
    // el log deja rastro de que algo no quedó bien.
    console.error('[flow/confirmation] Error al procesar:', err.message);
    return json({ ok: false, motivo: 'error_servidor' }, 200);
  }
}
