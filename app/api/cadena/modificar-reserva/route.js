// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/modificar-reserva
// Protegido por el middleware de /cadena. César cambia fecha, turno,
// horario o características de una reserva YA confirmada (08-oct-2026) y
// todo se actualiza junto: base de datos, cerrojo del turno (que es lo que
// la web usa para mostrar disponibilidad), Google Calendar y —si lo pide—
// el aviso por correo a la familia.
//
// Body: { reservationCode, cambios, politicaPrecio: 'mantener'|'recalcular',
//         avisar, simular, confirmarCalendario }
//   simular → calcula y valida SIN escribir (el panel muestra cómo queda).
//   confirmarCalendario → César acepta mover aunque el calendario ya tenga
//   OTRO evento ocupando ese turno (ej. un bloqueo que anotó a mano).
// ─────────────────────────────────────────────────────────────────────────────

import { modificarReserva } from '../../../../lib/modificar-reserva';
import { reservaPorCodigo } from '../../../../lib/reservas';
import { sincronizarCalendario, eventosQueOcupanTurno } from '../../../../lib/calendario';
import { ejecutarAvisosCambio } from '../../../../lib/aviso-cambio-reserva';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, CODIGO_RESERVA, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const codigo = texto(body?.reservationCode, 40).toUpperCase();
  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);

  const cambios = body?.cambios && typeof body.cambios === 'object' && !Array.isArray(body.cambios) ? body.cambios : null;
  if (!cambios) return json({ ok: false, motivo: 'cambios_invalidos' }, 400);
  const politicaPrecio = body?.politicaPrecio === 'recalcular' ? 'recalcular' : 'mantener';
  const avisar = body?.avisar === true;
  const simular = body?.simular === true;
  const confirmarCalendario = body?.confirmarCalendario === true;

  const base = { codigo, cambios, politicaPrecio, avisar };

  // 1 · Validar y calcular sin escribir.
  const previa = await modificarReserva({ ...base, simular: true });
  if (!previa.ok) return json(previa, previa.motivo === 'reserva_no_encontrada' ? 404 : 400);

  // 2 · Si cambia de turno, ¿el calendario ya lo ocupa con OTRO evento?
  let calendario = { verificado: false, eventos: [] };
  if (previa.cambioDeTurno) {
    const reserva = await reservaPorCodigo(codigo);
    try {
      calendario = await eventosQueOcupanTurno({
        fecha: previa.despues.fecha, turno: previa.despues.turno, excluirEventId: reserva?.calendar_event_id || null,
      });
    } catch (err) {
      console.error('[cadena/modificar-reserva] No se pudo leer el calendario:', err.message);
      calendario = { verificado: false, eventos: [], error: true };
    }
  }

  if (simular) return json({ ...previa, calendario });

  if (previa.cambioDeTurno && calendario.eventos.length && !confirmarCalendario) {
    return json({ ok: false, motivo: 'calendario_ocupado', eventos: calendario.eventos, despues: previa.despues }, 409);
  }

  // 3 · Aplicar (atómico: si el turno nuevo ya es de otra reserva, no cambia nada).
  const r = await modificarReserva({ ...base, simular: false });
  if (!r.ok) return json(r, r.motivo === 'turno_ocupado' ? 409 : 400);

  // 4 · Mismo criterio best-effort del resto del proyecto: el cambio ya
  // quedó escrito; si Google falla se informa, nunca se revierte.
  const reserva = await reservaPorCodigo(codigo);
  const cal = await sincronizarCalendario(reserva.id).catch((err) => ({ ok: false, motivo: err.message }));

  // 5 · Aviso a la familia (si falla, el cron diario lo reintenta).
  let aviso = null;
  if (avisar) aviso = await ejecutarAvisosCambio().catch((err) => ({ ok: false, error: err.message }));

  return json({
    ok: true, antes: r.antes, despues: r.despues, totalSegunTabla: r.totalSegunTabla,
    avisosNormalizacion: r.avisosNormalizacion, calendario: cal, aviso,
  });
}
