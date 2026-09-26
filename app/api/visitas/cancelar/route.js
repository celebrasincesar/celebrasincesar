// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/visitas/cancelar
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B"
// (22-sep-2026, §4, §5, §17, §18). Mismo candado que /api/visitas/gestionar:
// código+token, igualSeguro(), sin cuentas. Body: { id, t }.
//
// Al confirmar: actualiza la MISMA fila a CANCELADA (nunca la borra),
// elimina el evento de Calendar (best-effort) y manda el correo de
// cancelación (best-effort) — ninguno de los dos puede revertir la
// cancelación ya escrita en Postgres.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { visitaDesdeParams, leerIdYToken } from '../../../../lib/visita-auth';
import { cancelarVisita, enviarCancelacionVisita } from '../../../../lib/visitas';
import { eliminarEventoCalendarioVisita } from '../../../../lib/calendario-visita';
import { fechaISO } from '../../../../lib/reservas';
import { json, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`visitas-cancelar:${ipDe(req)}`, 10, 60_000)) {
    return json({ ok: false, motivo: 'demasiados_intentos' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);
  const visita = await visitaDesdeParams(id, t);
  if (!visita) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  const resultado = await cancelarVisita(visita);
  if (!resultado.ok) return json(resultado, 400);

  // Best-effort: ninguno de los dos puede revertir la cancelación ya
  // escrita en Postgres (§5, §8).
  await eliminarEventoCalendarioVisita(resultado.visita).catch((err) =>
    console.error('[api/visitas/cancelar] Calendar falló:', err.message));

  if (!resultado.yaCancelada) {
    try {
      await enviarCancelacionVisita(resultado.visita);
    } catch (err) {
      console.error('[api/visitas/cancelar] Correo de cancelación falló:', err.message);
    }
  }

  return json({
    ok: true,
    yaCancelada: resultado.yaCancelada,
    visita: {
      codigo: resultado.visita.codigo,
      fecha: fechaISO(resultado.visita.fecha_visita),
      hora: resultado.visita.hora_inicio,
      estado: resultado.visita.estado,
    },
  });
}
