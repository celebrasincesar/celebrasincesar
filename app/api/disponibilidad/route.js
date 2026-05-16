// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/disponibilidad
// Lee eventos de Google Calendar y devuelve qué fechas/turnos están bloqueados.
//
// Convención de nombres en Google Calendar:
//   "RESERVADO AM"   → bloquea el turno de mañana de esa fecha
//   "RESERVADO PM"   → bloquea el turno de tarde de esa fecha
//   "CERRADO"        → bloquea el día completo
//   "BLOQUEADO"      → bloquea el día completo
//
// Respuesta: { blockedDates: string[], blockedAM: string[], blockedPM: string[] }
// Cada string tiene formato "YYYY-MM-DD" (zona horaria America/Santiago).
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import { NextResponse } from 'next/server';

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

export async function GET() {
  const noCache = {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  };

  // ── Servir desde caché si está vigente ──────────────────────────────
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return NextResponse.json(_cache, noCache);
  }

  // Fallback seguro: si faltan credenciales, no bloqueamos nada
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID === 'INGRESA_TU_CALENDAR_ID_AQUI') {
    console.warn('[disponibilidad] Variables de entorno de Google Calendar no configuradas.');
    return NextResponse.json({ blockedDates: [], blockedAM: [], blockedPM: [] }, noCache);
  }

  try {
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
      } else if (titulo === 'RESERVADO AM') {
        if (!blockedAM.includes(fechaStr)) blockedAM.push(fechaStr);
      } else if (titulo === 'RESERVADO PM') {
        if (!blockedPM.includes(fechaStr)) blockedPM.push(fechaStr);
      }
    }

    // Si los dos turnos de un día están reservados → tratar como CERRADO
    for (const f of blockedAM) {
      if (blockedPM.includes(f) && !blockedDates.includes(f)) {
        blockedDates.push(f);
      }
    }

    // Guardar en caché del servidor antes de responder
    _cache     = { blockedDates, blockedAM, blockedPM };
    _cacheTime = Date.now();

    return NextResponse.json(_cache, noCache);

  } catch (err) {
    console.error('[disponibilidad] Error al consultar Google Calendar:', err.message);
    // En caso de error no bloqueamos ninguna fecha — el wizard sigue funcionando
    return NextResponse.json({ blockedDates: [], blockedAM: [], blockedPM: [] }, noCache);
  }
}
