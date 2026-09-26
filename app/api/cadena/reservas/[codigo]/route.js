// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cadena/reservas/[codigo]
// Detalle completo de una reserva para el panel (§21): snapshot del
// armador, todos los pagos, el estado del calendario, T&C.
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo, pagosDeReserva, eventosDeReserva } from '../../../../../lib/reservas';
import { dbConfigurada } from '../../../../../lib/db';
import { json, texto, CODIGO_RESERVA } from '../../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  // Next.js 15: `params` pasó a ser una Promise en los Route Handlers — ver
  // nota en app/api/tyc/pdf/[version]/route.js.
  const { codigo: codigoCrudo } = await params;
  const codigo = texto(codigoCrudo, 40).toUpperCase();
  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);

  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return json({ ok: false, motivo: 'no_encontrada' }, 404);

  const [pagos, eventos] = await Promise.all([
    pagosDeReserva(reserva.id),
    eventosDeReserva(reserva.id),
  ]);

  return json({ ok: true, reserva, pagos, eventos });
}
