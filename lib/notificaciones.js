// ══════════════════════════════════════════════════════════════════════
// NOTIFICACIÓN A CÉSAR AL ACREDITAR UN PAGO  ·  lib/notificaciones.js
// ──────────────────────────────────────────────────────────────────────
// Acción secundaria, igual que sincronizarCalendario() (lib/calendario.js):
// vive en su propio archivo, se llama DESPUÉS de que acreditarPago() ya
// confirmó el pago, y un fallo acá jamás revierte ni bloquea nada de eso
// (documento "Sí, avanza…", 09-sep-2026, §3).
//
// IDEMPOTENCIA — no basta con el `if (nuevos > 0)` de quien llama:
//   1. Antes de mandar, se comprueba en Postgres si YA existe un evento
//      NOTIFICACION_ADMIN_EMAIL_ENVIADA para ESTE pago. Si existe, no se
//      manda de nuevo — sin importar cuántas veces Flow repita el webhook
//      ni desde qué proceso se llame.
//   2. El evento se registra SOLO después de que enviarCorreo() resuelve
//      sin lanzar — eso es la confirmación real de que Zoho lo aceptó
//      (un 250 OK del SMTP). Si el envío falla, se registra un evento de
//      ERROR aparte (para que quede rastro y se pueda reintentar) pero
//      nunca el de ENVIADO: un correo que no se mandó no puede marcarse
//      como mandado.
// ══════════════════════════════════════════════════════════════════════

import { q1 } from './db';
import { registrarEvento } from './reservas';
import { correoConfigurado, enviarCorreo } from './correo';
import { construirResumenReserva } from './resumen-reserva';
import { construirResumenCliente } from './resumen-cliente';

const TIPO_ENVIADO = 'NOTIFICACION_ADMIN_EMAIL_ENVIADA';
const TIPO_ERROR = 'NOTIFICACION_ADMIN_EMAIL_ERROR';

const TIPO_ENVIADO_CLIENTE = 'NOTIFICACION_CLIENTE_EMAIL_ENVIADA';
const TIPO_ERROR_CLIENTE = 'NOTIFICACION_CLIENTE_EMAIL_ERROR';

export async function pagoYaNotificado(pagoId) {
  const fila = await q1(
    `SELECT id FROM pago_evento WHERE pago_id = $1 AND tipo = $2 LIMIT 1`,
    [pagoId, TIPO_ENVIADO]
  );
  return !!fila;
}

export async function notificarAdminPago(pagoId) {
  if (await pagoYaNotificado(pagoId)) {
    return { ok: true, enviado: false, motivo: 'ya_notificado' };
  }

  if (!correoConfigurado()) {
    return { ok: true, enviado: false, motivo: 'correo_no_configurado' };
  }

  const pago = await q1(`SELECT * FROM pago WHERE id = $1`, [pagoId]);
  if (!pago) return { ok: false, enviado: false, motivo: 'pago_no_encontrado' };

  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [pago.reserva_id]);
  if (!reserva) return { ok: false, enviado: false, motivo: 'reserva_no_encontrada' };

  const resumen = construirResumenReserva(reserva, pago);
  const destinatario = process.env.MAIL_TO_RESERVAS || process.env.MAIL_FROM_ADMIN || 'administracion@celebrasincesar.cl';

  try {
    await enviarCorreo({ to: destinatario, subject: resumen.asunto, text: resumen.texto, html: resumen.html });
  } catch (err) {
    await registrarEvento({
      pagoId, reservaId: reserva.id, tipo: TIPO_ERROR,
      referencia: reserva.codigo, detalle: { error: String(err?.message || err).slice(0, 300) },
    });
    return { ok: false, enviado: false, motivo: 'error_envio' };
  }

  await registrarEvento({ pagoId, reservaId: reserva.id, tipo: TIPO_ENVIADO, referencia: reserva.codigo });
  return { ok: true, enviado: true };
}

// ══════════════════════════════════════════════════════════════════════
// CORREO DE CONFIRMACIÓN AL CLIENTE  (documento "Fase de consolidación
// final", 12-sep-2026, §9)
// ──────────────────────────────────────────────────────────────────────
// Mismo mecanismo de idempotencia que notificarAdminPago(), en un evento
// aparte (TIPO_ENVIADO_CLIENTE) para que un reintento del correo a
// administración nunca se confunda con uno del correo al cliente y
// viceversa. Solo aplica al ANTICIPO (pago.tipo === 'DEPOSIT'): es el pago
// que confirma la reserva — un saldo o un extra no vuelve a mandar "ya
// está reservada".
// ══════════════════════════════════════════════════════════════════════
export async function pagoClienteYaNotificado(pagoId) {
  const fila = await q1(
    `SELECT id FROM pago_evento WHERE pago_id = $1 AND tipo = $2 LIMIT 1`,
    [pagoId, TIPO_ENVIADO_CLIENTE]
  );
  return !!fila;
}

export async function notificarClientePago(pagoId) {
  if (await pagoClienteYaNotificado(pagoId)) {
    return { ok: true, enviado: false, motivo: 'ya_notificado' };
  }

  // Las reglas de negocio (¿aplica este pago?) se resuelven antes que la
  // disponibilidad del SMTP: así "no es anticipo" o "sin email" se pueden
  // comprobar igual aunque el correo todavía no esté configurado en este
  // ambiente (ver QA de integración, que corre sin SMTP local).
  const pago = await q1(`SELECT * FROM pago WHERE id = $1`, [pagoId]);
  if (!pago) return { ok: false, enviado: false, motivo: 'pago_no_encontrado' };

  if (pago.tipo !== 'DEPOSIT') {
    return { ok: true, enviado: false, motivo: 'no_es_anticipo' };
  }

  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [pago.reserva_id]);
  if (!reserva) return { ok: false, enviado: false, motivo: 'reserva_no_encontrada' };

  if (!reserva.cliente_email) {
    return { ok: true, enviado: false, motivo: 'sin_email_cliente' };
  }

  if (!correoConfigurado()) {
    return { ok: true, enviado: false, motivo: 'correo_no_configurado' };
  }

  const resumen = construirResumenCliente(reserva);

  try {
    await enviarCorreo({ to: reserva.cliente_email, subject: resumen.asunto, text: resumen.texto, html: resumen.html });
  } catch (err) {
    await registrarEvento({
      pagoId, reservaId: reserva.id, tipo: TIPO_ERROR_CLIENTE,
      referencia: reserva.codigo, detalle: { error: String(err?.message || err).slice(0, 300) },
    });
    return { ok: false, enviado: false, motivo: 'error_envio' };
  }

  await registrarEvento({ pagoId, reservaId: reserva.id, tipo: TIPO_ENVIADO_CLIENTE, referencia: reserva.codigo });
  return { ok: true, enviado: true };
}
