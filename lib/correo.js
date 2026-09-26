// ══════════════════════════════════════════════════════════════════════
// ENVÍO DE CORREO  ·  lib/correo.js
// ──────────────────────────────────────────────────────────────────────
// Único lugar del proyecto que manda correo. Hoy lo usa el recordatorio
// diario de BVE (/api/cron/boletas-pendientes); cualquier otro aviso por
// correo que se agregue después pasa por acá.
//
// SMTP de Zoho Mail (administracion@celebrasincesar.cl, ver memoria de
// sesión "mail-corporativo-celebrasincesar"), con una contraseña de
// aplicación —nunca la contraseña de la cuenta— que César genera desde
// Zoho y pone directo en Vercel. Igual que con las llaves de Flow: esa
// contraseña nunca pasa por este chat (§22).
//
// SIN correo configurado, nada se cae: correoConfigurado() es false y
// quien llama decide qué hacer (el cron deja constancia y no manda nada).
// ══════════════════════════════════════════════════════════════════════

import nodemailer from 'nodemailer';

export function correoConfigurado(env = process.env) {
  return !!(env.ZOHO_SMTP_HOST && env.ZOHO_SMTP_USER && env.ZOHO_SMTP_PASSWORD);
}

let _transportador = null;
function transportador() {
  if (!_transportador) {
    const puerto = Number(process.env.ZOHO_SMTP_PORT || 465);
    _transportador = nodemailer.createTransport({
      host: process.env.ZOHO_SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASSWORD },
    });
  }
  return _transportador;
}

export async function enviarCorreo({ to, subject, text, html, attachments }) {
  if (!correoConfigurado()) throw new Error('Correo no configurado (falta ZOHO_SMTP_HOST/ZOHO_SMTP_USER/ZOHO_SMTP_PASSWORD)');
  const nombre = process.env.MAIL_FROM_NAME || 'Celebra Sin Cesar';
  const remitente = process.env.MAIL_FROM_ADMIN || process.env.ZOHO_SMTP_USER;
  return transportador().sendMail({ from: `${nombre} <${remitente}>`, to, subject, text, html, attachments });
}
