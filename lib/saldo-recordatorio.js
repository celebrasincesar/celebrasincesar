// ══════════════════════════════════════════════════════════════════════
// RECORDATORIO SUAVE DE SALDO  ·  lib/saldo-recordatorio.js
// ──────────────────────────────────────────────────────────────────────
// Fase 5 Bloque 3 (01-oct-2026): "facilitar el pago, nunca presionarlo".
// Un único correo, una sola vez por reserva, a T-7 del evento (con catch-up
// hasta T-6 si el cron no alcanzó a correr justo el día). Reutiliza el
// MISMO cron del ciclo previo (/api/cron/ciclo-previo-evento) — no se crea
// un cron nuevo. El link SIEMPRE es a Mi Celebración, nunca una URL de
// Flow estática: el saldo que ve el papá ahí es el vigente de verdad,
// incluso si agregó algo después de este correo.
//
// Idempotencia: mismo patrón que lib/notificaciones.js
// (notificarAdminPago/pagoClienteYaNotificado) — se consulta ANTES de
// mandar, se registra el evento SOLO después de que enviarCorreo()
// resuelve sin lanzar (confirmación real de SMTP). Si el envío falla, no
// se registra nada: el próximo barrido del cron reintenta solo.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { fechaISO, estadoSaldo, registrarEvento, ESTADOS_FIRMES, festejadoDeReserva } from './reservas';
import { linkMiCelebracion } from './ciclo-previo';
import { correoConfigurado, enviarCorreo } from './correo';
import { NEGOCIO } from '../data/master';

export const TIPO_EVENTO_SALDO = 'SALDO_T7_EMAIL_ENVIADO';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function aMediodia(valor) {
  return new Date(`${fechaISO(valor)}T12:00:00`);
}
function diasHastaEvento(reserva, hoy) {
  return Math.round((aMediodia(reserva.fecha_evento).getTime() - aMediodia(hoy).getTime()) / 86_400_000);
}

export async function saldoEmailYaEnviado(reservaId) {
  const fila = await q1(
    `SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = $2 LIMIT 1`,
    [reservaId, TIPO_EVENTO_SALDO]
  );
  return !!fila;
}

// Reservas candidatas: firmes, entre T-7 y T-6 (ventana angosta a
// propósito — nunca se manda "tarde" fuera de esa ventana, ni se hace
// backfill de reservas que ya pasaron ese punto sin haberlo recibido).
async function reservasCandidatasSaldoT7(hoy) {
  const hoyStr = fechaISO(hoy);
  const placeholders = ESTADOS_FIRMES.map((_, i) => `$${i + 1}`).join(', ');
  return q(
    `SELECT id, codigo, cliente_nombre, cliente_email, cliente_telefono,
            fecha_evento, total, pagado, estado, acceso_token, snapshot, snapshot_vigente
       FROM reserva
      WHERE estado IN (${placeholders})
        AND fecha_evento BETWEEN ($${ESTADOS_FIRMES.length + 1}::date + 6) AND ($${ESTADOS_FIRMES.length + 1}::date + 7)
      ORDER BY fecha_evento ASC
      LIMIT 300`,
    [...ESTADOS_FIRMES, hoyStr]
  );
}

// ¿Hay un pago de SALDO verificándose ahora mismo para esta reserva? Si
// el papá ya está a mitad de una transferencia, no tiene sentido mandarle
// "puedes pagar tu saldo" — se ve igual de raro que pedirle algo que ya
// está haciendo.
async function tieneSaldoVerificandose(reservaId) {
  const fila = await q1(
    `SELECT 1 FROM pago WHERE reserva_id = $1 AND tipo = 'BALANCE' AND estado = 'PENDING' LIMIT 1`,
    [reservaId]
  );
  return !!fila;
}

function construirCorreoSaldo(reserva, saldo) {
  const festejado = festejadoDeReserva(reserva) || reserva.cliente_nombre;
  const nombre = (reserva.cliente_nombre || '').split(' ')[0] || reserva.cliente_nombre;
  const link = linkMiCelebracion(reserva);

  const asunto = 'Tu celebración en Alce Kids se acerca 🎉';

  const texto = [
    `Hola, ${nombre}.`,
    '',
    `Ya falta poquito para la celebración de ${festejado} en Alce Kids 🎈`,
    '',
    'Puedes entrar a Mi Celebración para revisar todos los detalles y dejar todo preparado con tranquilidad.',
    '',
    `Saldo actual: ${clp(saldo)}`,
    '',
    'Si quieres dejarlo pagado con anticipación, puedes hacerlo fácilmente desde ahí. Si prefieres hacerlo más adelante, no necesitas hacer nada ahora.',
    '',
    `Ver Mi Celebración: ${link}`,
    '',
    'Nos vemos pronto 💛',
    '',
    'Alce Kids',
  ].join('\n');

  const html = `
    <p>Hola, ${nombre}.</p>
    <p>Ya falta poquito para la celebración de <b>${festejado}</b> en Alce Kids 🎈</p>
    <p>Puedes entrar a Mi Celebración para revisar todos los detalles y dejar todo preparado con tranquilidad.</p>
    <p><b>Saldo actual: ${clp(saldo)}</b></p>
    <p>Si quieres dejarlo pagado con anticipación, puedes hacerlo fácilmente desde ahí. Si prefieres hacerlo más adelante, no necesitas hacer nada ahora.</p>
    <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1565C0;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">Ver Mi Celebración</a></p>
    <p>Nos vemos pronto 💛<br>Alce Kids</p>
  `;

  return { asunto, texto, html };
}

// Reserva YA leída de reservasCandidatasSaldoT7 (o cualquier fuente
// equivalente) → intenta mandar el correo si corresponde. Devuelve el
// motivo exacto cuando no aplica, para que el cron lo reporte.
export async function enviarRecordatorioSaldoSiCorresponde(reserva, hoy = new Date()) {
  const dias = diasHastaEvento(reserva, hoy);
  if (dias > 7 || dias < 6) return { enviado: false, motivo: 'fuera_de_ventana', dias };

  const saldo = estadoSaldo(reserva).pendiente;
  if (saldo <= 0) return { enviado: false, motivo: 'sin_saldo' };

  if (!reserva.cliente_email) return { enviado: false, motivo: 'sin_email' };

  if (await saldoEmailYaEnviado(reserva.id)) return { enviado: false, motivo: 'ya_enviado' };

  if (await tieneSaldoVerificandose(reserva.id)) return { enviado: false, motivo: 'saldo_verificandose' };

  if (!correoConfigurado()) return { enviado: false, motivo: 'correo_no_configurado' };

  const { asunto, texto, html } = construirCorreoSaldo(reserva, saldo);

  try {
    await enviarCorreo({ to: reserva.cliente_email, subject: asunto, text: texto, html });
  } catch (err) {
    console.error(`[saldo-recordatorio] Falló el envío para ${reserva.codigo}: ${err.message}`);
    return { enviado: false, motivo: 'error_envio' };
  }

  // Recién acá, con el SMTP ya confirmado — nunca antes.
  await registrarEvento({ reservaId: reserva.id, tipo: TIPO_EVENTO_SALDO, referencia: reserva.codigo });
  return { enviado: true };
}

// ══════════════════════════════════════════════════════════════════════
// CRON — se llama desde el mismo /api/cron/ciclo-previo-evento que ya
// existe, igual que ejecutarPostevento(). Un fallo por reserva nunca
// detiene a las demás.
// ══════════════════════════════════════════════════════════════════════
export async function ejecutarRecordatoriosSaldo(hoy = new Date()) {
  const reservas = await reservasCandidatasSaldoT7(hoy);
  const resultados = [];
  for (const reserva of reservas) {
    try {
      const r = await enviarRecordatorioSaldoSiCorresponde(reserva, hoy);
      resultados.push({ codigo: reserva.codigo, ...r });
    } catch (err) {
      resultados.push({ codigo: reserva.codigo, error: err.message });
    }
  }
  return { ok: true, procesadas: reservas.length, resultados };
}

export { construirCorreoSaldo };
