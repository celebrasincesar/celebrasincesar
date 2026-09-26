// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/cadena
// Alimenta el panel interno /cadena con las reservas del Google Calendar:
// próximas (hasta +35 días) y recién celebradas (hasta -10 días, para pedir
// reseña). Expone SOLO fecha y turno — nunca títulos ni descripciones, para
// no filtrar datos personales de clientes.
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 60 segundos

function toFechaStr(dateOrDatetime) {
  if (!dateOrDatetime) return null;
  if (dateOrDatetime.length === 10) return dateOrDatetime;
  const d = new Date(dateOrDatetime);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

export async function GET() {
  const noCache = {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  };

  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return NextResponse.json(_cache, noCache);
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID === 'INGRESA_TU_CALENDAR_ID_AQUI') {
    return NextResponse.json({ reservas: [] }, noCache);
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const desde = new Date();
    desde.setDate(desde.getDate() - 10);
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + 35);

    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: desde.toISOString(),
      timeMax: hasta.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 200,
    });

    const reservas = [];
    for (const evento of res.data.items || []) {
      const titulo = (evento.summary || '').toUpperCase().trim();
      const fecha = toFechaStr(evento.start?.date || evento.start?.dateTime);
      if (!fecha) continue;
      // Prefijo, no igualdad exacta: el título ahora lleva festejado y
      // código además de "RESERVADO AM/PM" (lib/calendario.js, tituloEvento).
      if (titulo.startsWith('RESERVADO AM')) reservas.push({ fecha, turno: 'AM' });
      else if (titulo.startsWith('RESERVADO PM')) reservas.push({ fecha, turno: 'PM' });
    }
    reservas.sort((a, b) => a.fecha.localeCompare(b.fecha));

    _cache = { reservas };
    _cacheTime = Date.now();
    return NextResponse.json(_cache, noCache);
  } catch (err) {
    console.error('[cadena] Error al consultar Google Calendar:', err.message);
    return NextResponse.json({ reservas: [] }, noCache);
  }
}
