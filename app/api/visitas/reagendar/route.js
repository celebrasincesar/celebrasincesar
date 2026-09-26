// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/visitas/reagendar
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B"
// (22-sep-2026, §6, §7, §8, §17, §18). Mismo candado por código+token.
// Body: { id, t, fecha, hora }.
//
// Actualiza la MISMA fila (mismo código, mismo token) — nunca crea una
// visita nueva. Reutiliza exactamente las reglas de disponibilidad de
// Bloque A (lib/visitas.js: validarSlotVisita/diasBloqueadosCalendar) vía
// reagendarVisita() — nunca valida cuántas otras visitas hay en el
// destino, porque eso es irrelevante (§6).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { visitaDesdeParams, leerIdYToken } from '../../../../lib/visita-auth';
import { reagendarVisita, enviarReagendaVisita } from '../../../../lib/visitas';
import { sincronizarCalendarioVisita } from '../../../../lib/calendario-visita';
import { fechaISO } from '../../../../lib/reservas';
import { texto, json, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`visitas-reagendar:${ipDe(req)}`, 10, 60_000)) {
    return json({ ok: false, motivo: 'demasiados_intentos' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);
  const visita = await visitaDesdeParams(id, t);
  if (!visita) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  const fecha = texto(body?.fecha, 10);
  const hora = texto(body?.hora, 5);

  const resultado = await reagendarVisita(visita, { fecha, hora });
  if (!resultado.ok) return json(resultado, 400);

  if (!resultado.sinCambios) {
    // Best-effort: ninguno de los dos puede revertir el reagendamiento ya
    // escrito en Postgres (§8). Mismo evento, PUT — metodoCalendarVisita()
    // ya decide PUT porque calendar_event_id sigue siendo el mismo.
    await sincronizarCalendarioVisita(resultado.visita).catch((err) =>
      console.error('[api/visitas/reagendar] Calendar falló:', err.message));
    try {
      await enviarReagendaVisita(resultado.visita);
    } catch (err) {
      console.error('[api/visitas/reagendar] Correo de reagenda falló:', err.message);
    }
  }

  return json({
    ok: true,
    sinCambios: resultado.sinCambios,
    visita: {
      codigo: resultado.visita.codigo,
      fecha: fechaISO(resultado.visita.fecha_visita),
      hora: resultado.visita.hora_inicio,
      estado: resultado.visita.estado,
    },
  });
}
