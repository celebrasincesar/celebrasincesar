// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/disponibilidad
// Lee eventos de Google Calendar y devuelve qué fechas/turnos están bloqueados.
//
// Convención de nombres en Google Calendar:
//   "RESERVADO AM…"  → bloquea el turno de mañana de esa fecha
//   "RESERVADO PM…"  → bloquea el turno de tarde de esa fecha
//   "CERRADO"        → bloquea el día completo
//   "BLOQUEADO"      → bloquea el día completo
//
// El título ya no es exactamente "RESERVADO AM": desde el documento
// "Quiero mejorar urgentemente la información operativa…" (09-sep-2026)
// lleva además el festejado y el código (lib/calendario.js, tituloEvento).
// Por eso se compara con el PREFIJO, no con igualdad exacta — sigue
// reconociendo el turno igual de bien.
//
// Desde que existen pagos por la web (§8), esto ya no es la única fuente:
// un papá puede estar EN ESTE MOMENTO pagando un turno cuyo evento de
// Calendar todavía no existe (el evento se crea recién con el pago
// confirmado, §16). Por eso, si hay base de datos configurada, se suman
// los turnos con HOLD vigente o ya firmes de `turno_hold` — el cerrojo
// real que impide la doble reserva — a lo que diga el calendario. Sin base
// de datos, el comportamiento es exactamente el de siempre.
//
// Respuesta: { blockedDates: string[], blockedAM: string[], blockedPM: string[] }
// Cada string tiene formato "YYYY-MM-DD" (zona horaria America/Santiago).
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { dbConfigurada } from '../../../lib/db';
import { barrerVencidos, turnosOcupados } from '../../../lib/reservas';
import { esViernes } from '../../../data/reglas';

export const dynamic = 'force-dynamic';

// ── Caché en memoria del servidor ───────────────────────────────────────
// Evita llamar a Google Calendar en cada request: guarda la última
// respuesta hasta 60 segundos. El primer visitante paga el costo; todos
// los que llegan después reciben la respuesta de inmediato.
let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 segundos

// Convierte una fecha ISO o "YYYY-MM-DD" a "YYYY-MM-DD" en hora de Santiago
function toFechaStr(dateOrDatetime) {
  if (!dateOrDatetime) return null;
  // Evento de día completo → ya viene como "YYYY-MM-DD"
  if (dateOrDatetime.length === 10) return dateOrDatetime;
  // Evento con hora → extraer la parte de fecha en Santiago
  const d = new Date(dateOrDatetime);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }); // "YYYY-MM-DD"
}

// ── Lo que dice Postgres AHORA MISMO ────────────────────────────────────
// Sin caché: un HOLD dura 15 minutos y una reserva pagada es definitiva,
// así que esto se lee fresco en cada visita. Es una tabla de a lo sumo un
// puñado de filas por día — el costo es insignificante — y es la pieza que
// evita mostrarle a un segundo papá un turno que el primero está pagando
// en este instante (§8).
async function turnosDesdePostgres() {
  if (!dbConfigurada()) return { blockedAM: [], blockedPM: [] };
  try {
    await barrerVencidos();
    const filas = await turnosOcupados({ dias: 120 });
    const blockedAM = [];
    const blockedPM = [];
    for (const f of filas) {
      const destino = f.turno === 'AM' ? blockedAM : f.turno === 'PM' ? blockedPM : null;
      if (destino && !destino.includes(f.fecha)) destino.push(f.fecha);
    }
    return { blockedAM, blockedPM };
  } catch (err) {
    console.error('[disponibilidad] Error al leer turnos de Postgres:', err.message);
    // Un error de Postgres no debe ocultar lo que sí sabe el calendario:
    // se sigue mostrando lo que Google reporta.
    return { blockedAM: [], blockedPM: [] };
  }
}

async function leerCalendario() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // Buscar eventos en los próximos 120 días
  const ahora = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 120);

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: ahora.toISOString(),
    timeMax: limite.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  const eventos = res.data.items || [];

  const blockedDates = [];
  const blockedAM    = [];
  const blockedPM    = [];

  for (const evento of eventos) {
    const titulo = (evento.summary || '').toUpperCase().trim();
    const fechaStr = toFechaStr(evento.start?.date || evento.start?.dateTime);
    if (!fechaStr) continue;

    if (titulo === 'CERRADO' || titulo === 'BLOQUEADO') {
      if (!blockedDates.includes(fechaStr)) blockedDates.push(fechaStr);
    } else if (titulo.startsWith('RESERVADO AM')) {
      if (!blockedAM.includes(fechaStr)) blockedAM.push(fechaStr);
    } else if (titulo.startsWith('RESERVADO PM')) {
      if (!blockedPM.includes(fechaStr)) blockedPM.push(fechaStr);
    }
  }

  return { blockedDates, blockedAM, blockedPM };
}

export async function GET() {
  const noCache = {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  };

  const sinCalendario = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY
    || !process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID === 'INGRESA_TU_CALENDAR_ID_AQUI';

  let base;
  let calendarError = false;

  if (sinCalendario) {
    // Sin credenciales de Calendar no podemos comprobar lo que ahí vive
    // (bloqueos manuales, reservas por WhatsApp de antes de esta versión).
    // Si además no hay base de datos, no hay NADA que decir: se dice la
    // verdad en vez de mostrar disponibilidad total (§sin_credenciales,
    // histórico de este endpoint).
    console.warn('[disponibilidad] Variables de entorno de Google Calendar no configuradas.');
    base = { blockedDates: [], blockedAM: [], blockedPM: [] };
    calendarError = !dbConfigurada();
  } else if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    base = _cache;
  } else {
    try {
      base = await leerCalendario();
      _cache = base;
      _cacheTime = Date.now();
    } catch (err) {
      console.error('[disponibilidad] Error al consultar Google Calendar:', err.message);
      // Error del calendario ≠ fecha libre. Si hay Postgres, igual se
      // responde con lo que Postgres sabe en vez de dejar reservar a
      // ciegas; sin Postgres, no hay nada confiable que ofrecer.
      base = _cache || { blockedDates: [], blockedAM: [], blockedPM: [] };
      calendarError = !dbConfigurada() && !_cache;
    }
  }

  if (calendarError) {
    return NextResponse.json(
      { ok: false, motivo: 'sin_credenciales', blockedDates: [], blockedAM: [], blockedPM: [] },
      { ...noCache, status: 503 }
    );
  }

  const desdePostgres = await turnosDesdePostgres();

  const blockedAM = Array.from(new Set([...base.blockedAM, ...desdePostgres.blockedAM]));
  const blockedPM = Array.from(new Set([...base.blockedPM, ...desdePostgres.blockedPM]));
  const blockedDates = Array.from(new Set(base.blockedDates));

  // Si los dos turnos de un día están reservados → tratar como CERRADO
  for (const f of blockedAM) {
    if (blockedPM.includes(f) && !blockedDates.includes(f)) blockedDates.push(f);
  }
  // Los viernes no existe turno AM — nunca va a aparecer en blockedAM, así
  // que la regla de arriba jamás cierra un viernes con el PM ya tomado.
  // Para viernes, el PM solo ya es suficiente para tratarlo como CERRADO
  // (documento "Autorización Fase 1A", 13-sep-2026, §10: un viernes AM no
  // está "ocupado", no se ofrece — pero un viernes con PM tomado sí está
  // completo, y el calendario debe reflejarlo igual que sáb/dom).
  for (const f of blockedPM) {
    if (esViernes(f) && !blockedDates.includes(f)) blockedDates.push(f);
  }

  return NextResponse.json({ ok: true, blockedDates, blockedAM, blockedPM }, noCache);
}
