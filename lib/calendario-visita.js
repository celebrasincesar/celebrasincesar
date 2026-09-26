// ══════════════════════════════════════════════════════════════════════
// CALENDAR DE VISITAS  ·  lib/calendario-visita.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026, §15-§16). Evento TOTALMENTE independiente del de
// celebraciones: nunca usa sincronizarCalendario(reservaId) ni toca
// `reserva`. Reutiliza las utilidades de lib/calendario.js (auth REST,
// gate de ambiente) tal cual — no reimplementa la llamada a Google.
//
// Varias visitas al mismo horario son varios eventos INDEPENDIENTES: el
// sistema nunca interpreta ver dos o tres eventos de visita a la misma
// hora como un conflicto (§16) — cada visita guarda su propio
// calendar_event_id.
// ══════════════════════════════════════════════════════════════════════

import { q } from './db';
import { calendarioConfigurado, escrituraCalendarHabilitada, peticionCalendar } from './calendario';
import { fechaISO } from './reservas';
import { NEGOCIO } from '../data/master';

function tituloVisita(visita) {
  return `👋 Visita Alce Kids · ${visita.nombre_adulto}`;
}

// Descripción mínima tal como pide §15: nombre, WhatsApp, email, festejado
// y edad si existen, origen — nada más.
function descripcionVisita(visita) {
  const lineas = [
    `Nombre: ${visita.nombre_adulto}`,
    `WhatsApp: ${visita.whatsapp}`,
    `Email: ${visita.email}`,
  ];
  if (visita.nombre_festejado) {
    lineas.push(`Festejado: ${visita.nombre_festejado}${visita.edad_festejado ? `, ${visita.edad_festejado} años` : ''}`);
  }
  lineas.push(`Origen: ${visita.origen === 'web' ? 'Web' : visita.origen}`);
  return lineas.join('\n');
}

function sumarMinutos(hhmm, minutos) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function rangoHorarioVisita(visita) {
  const fecha = fechaISO(visita.fecha_visita);
  const inicio = visita.hora_inicio;
  const termino = sumarMinutos(inicio, NEGOCIO.visitas.duracionMinutos);
  return {
    start: { dateTime: `${fecha}T${inicio}:00`, timeZone: 'America/Santiago' },
    end: { dateTime: `${fecha}T${termino}:00`, timeZone: 'America/Santiago' },
  };
}

// Pura, igual que metodoCalendar() en lib/calendario.js: si la visita ya
// tiene calendar_event_id, SIEMPRE se actualiza ese mismo evento.
export const metodoCalendarVisita = (visita) => (visita.calendar_event_id ? 'PUT' : 'POST');

// Nunca lanza — igual criterio que sincronizarCalendario(): quien llama
// (app/api/visitas) está en medio de responderle al cliente y no puede
// fallar por esto.
export async function sincronizarCalendarioVisita(visita) {
  if (!calendarioConfigurado()) return { ok: false, motivo: 'sin_configurar' };

  if (!escrituraCalendarHabilitada()) {
    // Mismo gate que celebraciones (§15, criterio ya vigente en
    // lib/calendario.js): Preview y Sandbox no escriben en el Calendar
    // real, para no contaminarlo con visitas de prueba.
    return { ok: true, motivo: 'preview_sin_escritura', eventId: null };
  }

  const cuerpo = {
    summary: tituloVisita(visita),
    description: descripcionVisita(visita),
    ...rangoHorarioVisita(visita),
  };

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  let eventId = visita.calendar_event_id;

  try {
    if (metodoCalendarVisita(visita) === 'PUT') {
      await peticionCalendar(
        'PUT',
        `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        cuerpo
      );
    } else {
      const creado = await peticionCalendar(
        'POST',
        `calendars/${encodeURIComponent(calendarId)}/events`,
        cuerpo
      );
      eventId = creado.id;
      await q(
        `UPDATE visita SET calendar_event_id = $2 WHERE id = $1 AND calendar_event_id IS NULL`,
        [visita.id, eventId]
      );
    }
    return { ok: true, eventId };
  } catch (err) {
    console.error(`[calendario-visita] Visita ${visita.codigo}: ${err.message}`);
    return { ok: false, motivo: 'error_google', error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════
// ELIMINAR EL EVENTO AL CANCELAR  (documento "FASE 3A — VISITAS
// AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B", 22-sep-2026, §5)
//
// Decisión funcional del documento: Postgres conserva el histórico
// (estado CANCELADA), pero Calendar debe representar solo la operación
// FUTURA — el evento se borra, no se acumula. Nunca lanza; si Google
// falla, la visita sigue CANCELADA en Postgres (§5: "no revertir
// cancelación"). Un 404/410 (el evento ya no existe — doble click, o
// alguien lo borró a mano) se trata como éxito, no como error.
// ══════════════════════════════════════════════════════════════════════
export async function eliminarEventoCalendarioVisita(visita) {
  if (!calendarioConfigurado()) return { ok: false, motivo: 'sin_configurar' };
  if (!escrituraCalendarHabilitada()) return { ok: true, motivo: 'preview_sin_escritura' };
  if (!visita.calendar_event_id) return { ok: true, motivo: 'sin_evento' };

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  try {
    await peticionCalendar(
      'DELETE',
      `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(visita.calendar_event_id)}`
    );
    return { ok: true };
  } catch (err) {
    if (err.status === 404 || err.status === 410) return { ok: true, motivo: 'ya_no_existia' };
    console.error(`[calendario-visita] Eliminar evento de visita ${visita.codigo}: ${err.message}`);
    return { ok: false, motivo: 'error_google', error: err.message };
  }
}
