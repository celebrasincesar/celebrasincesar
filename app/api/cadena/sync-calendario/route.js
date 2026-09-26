// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/sync-calendario
// Reintento manual del espejo de Google Calendar para una reserva puntual
// (§16, §24): si el evento no se creó solo, César lo dispara desde el
// panel en vez de esperar a que un cron lo reintente.
// ─────────────────────────────────────────────────────────────────────────────

import { sincronizarCalendario } from '../../../../lib/calendario';
import { dbConfigurada } from '../../../../lib/db';
import { json, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const reservaId = Number(body?.reservaId);
  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    return json({ ok: false, motivo: 'reserva_invalida' }, 400);
  }
  const resultado = await sincronizarCalendario(reservaId);
  return json(resultado, resultado.ok ? 200 : 502);
}
