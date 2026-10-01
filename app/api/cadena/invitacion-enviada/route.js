// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/invitacion-enviada
// Protegido por el middleware de /cadena. César marca que ya mandó la
// Invitación Digital de una reserva (panel "Invitaciones digitales
// pendientes") — hallazgo real 30-sep-2026: antes esto no quedaba
// registrado en ningún lado, solo vivía en su memoria o en el chat de
// WhatsApp con el papá.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { marcarInvitacionEnviada } from '../../../../lib/reservas';
import { json, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const reservaId = Number(body?.reservaId);

  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    return json({ ok: false, motivo: 'reserva_invalida' }, 400);
  }

  const resultado = await marcarInvitacionEnviada({ reservaId });
  if (!resultado.ok) return json(resultado, 404);

  return json({ ok: true, reserva: resultado.reserva });
}
