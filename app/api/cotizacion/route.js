// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/cotizacion
// Persistencia central de las cotizaciones que salen del armador.
//
// Hasta ahora la única copia vivía en el localStorage del papá: si cambiaba de
// teléfono o limpiaba el navegador, la solicitud desaparecía y César se quedaba
// solo con el mensaje de WhatsApp. Ahora cada solicitud queda también en una
// Google Sheet de César, escrita desde el servidor con el MISMO service account
// que ya lee el calendario (solo se agrega el scope de Sheets).
//
//   POST /api/cotizacion        → guarda una cotización nueva
//   GET  /api/cotizacion?id=... → la recupera (la usa /confirmacion)
//
// SETUP (lo hace César una sola vez):
//   1. Crear una Google Sheet nueva para las cotizaciones.
//   2. Compartirla con rol EDITOR con el email del service account
//      (GOOGLE_SERVICE_ACCOUNT_EMAIL de .env.local).
//   3. Copiar el ID de la planilla (el tramo entre /d/ y /edit de la URL) en
//      GOOGLE_COTIZACIONES_SHEET_ID (.env.local + variables de Vercel).
//   La fila 1 con los títulos la escribe sola la primera vez.
//
// Mientras no esté configurada, NO se rompe nada: el armador sigue guardando en
// localStorage y el papá envía su WhatsApp igual. La respuesta lo dice con
// `stored: false` para que quede claro que aún no hay copia central.
//
// Las credenciales viven solo en el servidor: al cliente nunca se le expone nada.
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import {
  COLUMNAS, RANGO, RANGO_CABECERA, ID_VALIDO, texto,
  aFila, filaVigente, filaAutorizada, aCotizacion,
} from './planilla';

export const dynamic = 'force-dynamic';

const configurada = () =>
  !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
     process.env.GOOGLE_PRIVATE_KEY &&
     process.env.GOOGLE_COTIZACIONES_SHEET_ID);

function cliente() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

const ahora = () => new Date().toLocaleString('es-CL', {
  timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short',
});

// Asegura la fila de titulos la primera vez (no molesta si ya existe).
async function asegurarCabecera(sheets, spreadsheetId) {
  const actual = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGO_CABECERA });
  if (actual.data.values?.[0]?.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [COLUMNAS] },
  });
}

export async function POST(req) {
  let cot;
  try {
    cot = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalido' }, { status: 400 });
  }

  const id = texto(cot?.id, 40);
  if (!ID_VALIDO.test(id)) {
    return NextResponse.json({ ok: false, error: 'ID invalido' }, { status: 400 });
  }

  if (!configurada()) {
    // Nunca bloquea al papa: su solicitud sale igual por WhatsApp.
    console.warn(`[cotizacion] Sheet no configurada. Cotizacion ${id} sin copia central.`);
    return NextResponse.json({ ok: true, stored: false, motivo: 'sin_configurar' });
  }

  try {
    const sheets = cliente();
    const spreadsheetId = process.env.GOOGLE_COTIZACIONES_SHEET_ID;
    await asegurarCabecera(sheets, spreadsheetId);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: RANGO,
      // RAW: un ID como CSC-2026-0012 o un texto que parta con "=" no pueden
      // reinterpretarse como formula ni como fecha.
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [aFila(cot, ahora())] },
    });
    return NextResponse.json({ ok: true, stored: true });
  } catch (err) {
    console.error(`[cotizacion] No se pudo guardar ${id}: ${err.message}`);
    // La solicitud del papa no depende de esto.
    return NextResponse.json({ ok: true, stored: false, motivo: 'error_sheet' });
  }
}

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const id = texto(params.get('id'), 40);
  const token = texto(params.get('t'), 64);
  if (!ID_VALIDO.test(id)) {
    return NextResponse.json({ ok: false, error: 'ID invalido' }, { status: 400 });
  }
  if (!configurada()) {
    return NextResponse.json({ ok: false, motivo: 'sin_configurar' }, { status: 503 });
  }

  try {
    const sheets = cliente();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_COTIZACIONES_SHEET_ID,
      range: RANGO,
    });
    const fila = filaVigente(res.data.values, id);
    if (!fila) return NextResponse.json({ ok: false, motivo: 'no_encontrada' }, { status: 404 });
    if (!filaAutorizada(fila, token)) {
      return NextResponse.json({ ok: false, motivo: 'sin_acceso' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, cotizacion: aCotizacion(fila) });
  } catch (err) {
    console.error(`[cotizacion] No se pudo leer ${id}: ${err.message}`);
    return NextResponse.json({ ok: false, motivo: 'error_sheet' }, { status: 503 });
  }
}
