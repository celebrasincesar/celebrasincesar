// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/boleta-emitida
// Panel "Boletas SII pendientes" (§4 del documento "Agregar control
// obligatorio de BVE…", 07-sep-2026): César emitió la Boleta Electrónica a
// mano en el sitio del SII para un pago PENDING_BVE y acá deja constancia
// —folio, fecha de emisión y una observación opcional— de que ya está hecho.
//
// Esto NUNCA bloquea ni desbloquea una reserva: solo cambia el estado
// tributario de un pago que ya estaba confirmado (§6).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { marcarBoletaEmitida } from '../../../../lib/reservas';
import { json, texto, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const pagoId = Number(body?.pagoId);
  const folio = texto(body?.folio, 60);
  const fecha = texto(body?.fecha, 20);
  const observacion = texto(body?.observacion, 500);

  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return json({ ok: false, motivo: 'pago_invalido' }, 400);
  }

  const resultado = await marcarBoletaEmitida({
    pagoId, folio: folio || null, fecha: fecha || null, observacion: observacion || null,
  });

  if (!resultado.ok) {
    const status = resultado.motivo === 'fecha_invalida' ? 400 : 404;
    return json(resultado, status);
  }

  return json({ ok: true, pago: resultado.pago });
}
