// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/waitlist
// Recibe un correo (lista de espera Alce Arena / Alce Go, o cumple lejano) y lo
// escribe como una fila nueva en una Google Sheet, reusando el MISMO service
// account que ya lee el Google Calendar (solo se agrega el scope de Sheets).
//
// Body JSON: { email: string, categoria?: string, nota?: string, hp?: string }
//   - email      correo del interesado (obligatorio, validado)
//   - categoria  "Alce Arena" | "Alce Go" | "Cumple lejano" | ...
//   - nota       texto libre opcional (ej. mes de cumpleaños)
//   - hp         honeypot antispam: si viene con texto, se descarta en silencio
//
// Fila escrita: [ fecha (Santiago) | categoría | correo | nota ]
//
// SETUP (lo hace César una sola vez):
//   1. Crear una Google Sheet nueva. Fila 1 sugerida: Fecha | Categoría | Correo | Nota
//   2. Compartirla (rol Editor) con el email del service account
//      (GOOGLE_SERVICE_ACCOUNT_EMAIL de .env.local).
//   3. Copiar el ID de la planilla (el tramo entre /d/ y /edit de la URL) y
//      ponerlo en GOOGLE_WAITLIST_SHEET_ID (.env.local + variables de Vercel).
// ─────────────────────────────────────────────────────────────────────────────

import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Validación de correo sencilla y estricta (sin espacios, con dominio y TLD)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const email = String(body?.email || '').trim().toLowerCase();
  const categoria = String(body?.categoria || 'Lista de espera').trim().slice(0, 60);
  const nota = String(body?.nota || '').trim().slice(0, 200);
  const honeypot = String(body?.hp || '').trim();

  // Honeypot: los bots rellenan campos ocultos → respondemos ok pero no guardamos
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!email || !EMAIL_RE.test(email) || email.length > 120) {
    return NextResponse.json({ ok: false, error: 'Correo inválido' }, { status: 400 });
  }

  // Fallback seguro: si falta configuración, no rompemos la experiencia del usuario.
  // Registramos en el log del servidor para no perder el lead mientras se configura.
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_PRIVATE_KEY ||
    !process.env.GOOGLE_WAITLIST_SHEET_ID
  ) {
    console.warn(`[waitlist] Sheet no configurada. Lead sin guardar → categoria="${categoria}" email="${email}" nota="${nota}"`);
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const fecha = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    // Rango sin nombre de hoja → apunta a la primera hoja de la planilla.
    // Se puede fijar una pestaña con GOOGLE_WAITLIST_SHEET_TAB (ej. "Leads").
    const tab = process.env.GOOGLE_WAITLIST_SHEET_TAB;
    const range = tab ? `${tab}!A:D` : 'A:D';

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_WAITLIST_SHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[fecha, categoria, email, nota]] },
    });

    return NextResponse.json({ ok: true, stored: true });
  } catch (err) {
    // No perdemos el lead: queda en el log aunque falle la escritura.
    console.error(`[waitlist] Error al escribir en la Sheet: ${err.message} | lead: ${categoria} / ${email} / ${nota}`);
    // Respondemos ok al usuario para no mostrar error por un problema nuestro.
    return NextResponse.json({ ok: true, stored: false });
  }
}
