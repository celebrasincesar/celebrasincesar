// ══════════════════════════════════════════════════════════════════════
// CORREOS AL AGREGAR ADICIONALES DESDE EL CATÁLOGO  ·  lib/aviso-adicionales.js
// ──────────────────────────────────────────────────────────────────────
// Cuando la familia confirma adicionales desde su link (lib/adicionales-
// reserva.js) salen dos correos: uno a la familia con lo que agregó y su
// nuevo saldo, y uno a César con el detalle para preparar el evento.
//
// Idempotencia (mismo patrón que lib/aviso-cambio-reserva.js): cada correo
// tiene su evento de "enviado" con la misma referencia del cambio
// (`cambio:<id>`) y se registra SOLO después de que el SMTP lo aceptó. Lo
// que no alcanzó a salir lo reintenta el cron diario del ciclo previo.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { estadoSaldo, festejadoDeReserva, fechaISO } from './reservas';
import { linkMiCelebracion } from './ciclo-previo';
import { correoConfigurado, enviarCorreo } from './correo';
import { NEGOCIO } from '../data/master';
import { CATEGORIA_DE_ITEM, getItem } from '../data/reglas';

const TIPO_AGREGADOS = 'ADICIONALES_AGREGADOS';
const TIPO_FAMILIA_ENVIADO = 'ADICIONALES_FAMILIA_EMAIL_ENVIADO';
const TIPO_ADMIN_ENVIADO = 'ADICIONALES_ADMIN_EMAIL_ENVIADO';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtFecha = (f) => {
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const precioTxt = (p) => (p > 0 ? clp(p) : 'Incluido');

// Pura: sin red ni Postgres. `detalle` es el del evento ADICIONALES_AGREGADOS.
export function construirCorreoFamilia(reserva, detalle) {
  const festejado = festejadoDeReserva(reserva) || reserva.cliente_nombre;
  const nombre = (reserva.cliente_nombre || '').split(' ')[0] || reserva.cliente_nombre;
  const link = linkMiCelebracion(reserva);
  const saldo = estadoSaldo(reserva).pendiente;
  const { agregados = [], reemplazados = [], tematica } = detalle;

  const asunto = `Sumaste ${agregados.length === 1 ? 'un adicional' : 'adicionales'} a la celebración de ${festejado} ✨`;
  const texto = [
    `Hola, ${nombre}.`,
    '',
    `Quedó actualizada la celebración de ${festejado} en Alce Kids (${fmtFecha(fechaISO(reserva.fecha_evento))}). Agregaste:`,
    '',
    ...agregados.map((a) => `• ${a.nombre}: ${precioTxt(a.precio)}`),
    ...(reemplazados.length ? ['', `Reemplaza a: ${reemplazados.map((r) => r.nombre).join(', ')}.`] : []),
    ...(tematica ? ['', `Temática de la decoración: ${tematica}.`] : []),
    '',
    `Valor total: ${clp(detalle.totalDespues)} (antes ${clp(detalle.totalAntes)})`,
    `Pagado: ${clp(reserva.pagado)}`,
    saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo',
    '',
    `Puedes revisar todo y pagar el saldo en Mi Celebración: ${link}`,
    '',
    'Si quieres cambiar algo, respóndenos por WhatsApp y lo vemos juntos.',
    '',
    'Nos vemos pronto 💛',
    '',
    'Alce Kids',
  ].join('\n');

  const filas = agregados.map((a) => `
        <tr>
          <td style="padding:6px 0;color:#3A4A6B">${a.emoji ? `${esc(a.emoji)} ` : ''}${esc(a.nombre)}</td>
          <td style="padding:6px 0;text-align:right;font-weight:bold;color:#0D1B3E;white-space:nowrap">${precioTxt(a.precio)}</td>
        </tr>`).join('');
  const html = `
    <div style="font-family:'Nunito',sans-serif;color:#0D1B3E;max-width:520px;width:100%">
      <img src="${NEGOCIO.sitio}/logo-alce.webp" alt="${NEGOCIO.venue}" style="height:56px;margin-bottom:18px" />
      <h2 style="color:#1565C0;margin-bottom:4px">¡Listo, ya está en tu celebración! ✨</h2>
      <p style="color:#6B7280;margin-top:0">Hola, ${esc(nombre)}. Sumaste esto a la celebración de <b>${esc(festejado)}</b> · ${fmtFecha(fechaISO(reserva.fecha_evento))}:</p>
      <div style="background:#F8FAFF;border-radius:16px;padding:18px;margin:18px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>
        ${reemplazados.length ? `<p style="margin:10px 0 0;font-size:13px;color:#6B7280">Reemplaza a: ${esc(reemplazados.map((r) => r.nombre).join(', '))}.</p>` : ''}
        ${tematica ? `<p style="margin:10px 0 0;font-size:13px;color:#6B7280">🎨 Temática de la decoración: <b>${esc(tematica)}</b></p>` : ''}
        <div style="border-top:1px solid #E3ECFA;margin-top:14px;padding-top:12px;font-size:14px">
          <p style="margin:2px 0;color:#3A4A6B">Valor total: <b>${clp(detalle.totalDespues)}</b> <span style="color:#9CA9C4">(antes ${clp(detalle.totalAntes)})</span></p>
          <p style="margin:2px 0;color:#3A4A6B">Pagado: ${clp(reserva.pagado)}</p>
          <p style="margin:2px 0;color:${saldo > 0 ? '#C2410C' : '#16a34a'};font-weight:bold">${saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo'}</p>
        </div>
      </div>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1565C0;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">${saldo > 0 ? 'Ver Mi Celebración y pagar el saldo' : 'Ver Mi Celebración'}</a></p>
      <p style="font-size:12px;color:#6B7280">${NEGOCIO.direccion.completa}<br>Si quieres cambiar algo, respóndenos por WhatsApp y lo vemos juntos.</p>
      <p style="font-size:11px;color:#9CA9C4;margin-top:24px">${NEGOCIO.venue} · Una experiencia de ${NEGOCIO.nombre}</p>
    </div>`;

  return { asunto, texto, html };
}

// Para César: qué agregó, cuánto suma y qué hay que coordinar.
export function construirCorreoAdmin(reserva, detalle) {
  const festejado = festejadoDeReserva(reserva) || reserva.cliente_nombre;
  const saldo = estadoSaldo(reserva).pendiente;
  const { agregados = [], reemplazados = [], tematica } = detalle;
  const fecha = `${fmtFecha(fechaISO(reserva.fecha_evento))} · ${reserva.turno} ${reserva.hora_inicio || ''}–${reserva.hora_termino || ''}`;
  const asunto = `➕ ${festejado} sumó ${clp(detalle.diferencia)} en adicionales · ${reserva.codigo}`;
  const coordinar = agregados.some((a) => CATEGORIA_DE_ITEM[a.id]?.id === 'animacion' || a.id.startsWith('deco-tematica')
    || getItem(a.id)?.comida || String(CATEGORIA_DE_ITEM[a.id]?.id || '').startsWith('banq'))
    ? 'Incluye animación, decoración temática o comida: revisa el proveedor en el panel.'
    : null;

  const texto = [
    `${reserva.cliente_nombre} agregó adicionales desde su link del catálogo.`,
    '',
    `Reserva: ${reserva.codigo} · ${festejado}`,
    `Fecha: ${fecha}`,
    '',
    ...agregados.map((a) => `+ ${a.nombre}: ${precioTxt(a.precio)}`),
    ...reemplazados.map((r) => `− ${r.nombre} (reemplazado)`),
    ...(tematica ? [`Temática: ${tematica}`] : []),
    '',
    `Diferencia: ${clp(detalle.diferencia)}`,
    `Total: ${clp(detalle.totalAntes)} → ${clp(detalle.totalDespues)}`,
    `Pagado: ${clp(reserva.pagado)} · Saldo: ${clp(saldo)}`,
    ...(coordinar ? ['', coordinar] : []),
    '',
    `Panel: ${NEGOCIO.sitio}/cadena`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0D1B3E;max-width:560px">
      <h2 style="color:#1565C0;margin-bottom:4px">➕ Adicionales agregados por la familia</h2>
      <p style="margin-top:0;color:#6B7280">${esc(reserva.cliente_nombre)} · ${esc(reserva.cliente_telefono || '')}</p>
      <p style="margin:4px 0"><b>${esc(reserva.codigo)}</b> · ${esc(festejado)}<br>${esc(fecha)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">
        ${agregados.map((a) => `<tr><td style="padding:4px 0">+ ${esc(a.nombre)}</td><td style="text-align:right;font-weight:bold">${precioTxt(a.precio)}</td></tr>`).join('')}
        ${reemplazados.map((r) => `<tr><td style="padding:4px 0;color:#9CA9C4">− ${esc(r.nombre)} (reemplazado)</td><td></td></tr>`).join('')}
      </table>
      ${tematica ? `<p>🎨 Temática: <b>${esc(tematica)}</b></p>` : ''}
      <p style="margin:2px 0">Diferencia: <b>${clp(detalle.diferencia)}</b></p>
      <p style="margin:2px 0">Total: ${clp(detalle.totalAntes)} → <b>${clp(detalle.totalDespues)}</b></p>
      <p style="margin:2px 0">Pagado: ${clp(reserva.pagado)} · Saldo: <b>${clp(saldo)}</b></p>
      ${coordinar ? `<p style="background:#FFF7ED;border-radius:10px;padding:10px;color:#9A3412">${coordinar}</p>` : ''}
      <p><a href="${NEGOCIO.sitio}/cadena" style="color:#1565C0;font-weight:bold">Abrir el panel</a></p>
    </div>`;

  return { asunto, texto, html };
}

async function yaEnviado(reservaId, tipo, referencia) {
  const f = await q1(
    `SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = $2 AND referencia = $3 LIMIT 1`,
    [reservaId, tipo, referencia]
  );
  return !!f;
}

async function enviarUno({ reserva, tipo, referencia, para, correo }) {
  if (!para) return { enviado: false, motivo: 'sin_destinatario' };
  if (await yaEnviado(reserva.id, tipo, referencia)) return { enviado: false, motivo: 'ya_enviado' };
  await enviarCorreo({ to: para, subject: correo.asunto, text: correo.texto, html: correo.html });
  // Recién acá, con el SMTP ya confirmado — nunca antes.
  await q(
    `INSERT INTO pago_evento (reserva_id, tipo, referencia, detalle) VALUES ($1, $2, $3, $4::jsonb)`,
    [reserva.id, tipo, referencia, JSON.stringify({ a: para })]
  );
  return { enviado: true };
}

export async function enviarAvisosAdicionales({ reservaId, referencia, detalle }) {
  if (!correoConfigurado()) return { familia: 'correo_no_configurado', admin: 'correo_no_configurado' };
  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { familia: 'reserva_inexistente', admin: 'reserva_inexistente' };
  const d = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
  const admin = process.env.MAIL_TO_RESERVAS || process.env.MAIL_FROM_ADMIN || 'administracion@celebrasincesar.cl';

  const salida = {};
  for (const [clave, tipo, para, correo] of [
    ['familia', TIPO_FAMILIA_ENVIADO, reserva.cliente_email, construirCorreoFamilia(reserva, d)],
    ['admin', TIPO_ADMIN_ENVIADO, admin, construirCorreoAdmin(reserva, d)],
  ]) {
    try {
      salida[clave] = await enviarUno({ reserva, tipo, referencia, para, correo });
    } catch (err) {
      console.error(`[aviso-adicionales] ${clave} ${reserva.codigo}: ${err.message}`);
      salida[clave] = { enviado: false, motivo: 'error_envio' };
    }
  }
  return salida;
}

// Cron diario: correos de adicionales de los últimos 14 días que no
// alcanzaron a salir al momento de confirmar.
export async function ejecutarAvisosAdicionales() {
  const pendientes = await q(
    `SELECT e.reserva_id, e.referencia, e.detalle
       FROM pago_evento e
      WHERE e.tipo = $1
        AND e.creado > now() - interval '14 days'
        AND (NOT EXISTS (SELECT 1 FROM pago_evento x WHERE x.reserva_id = e.reserva_id AND x.tipo = $2 AND x.referencia = e.referencia)
          OR NOT EXISTS (SELECT 1 FROM pago_evento x WHERE x.reserva_id = e.reserva_id AND x.tipo = $3 AND x.referencia = e.referencia))
      ORDER BY e.id ASC
      LIMIT 100`,
    [TIPO_AGREGADOS, TIPO_FAMILIA_ENVIADO, TIPO_ADMIN_ENVIADO]
  );
  const resultados = [];
  for (const ev of pendientes) {
    try {
      resultados.push({ referencia: ev.referencia, ...(await enviarAvisosAdicionales({ reservaId: ev.reserva_id, referencia: ev.referencia, detalle: ev.detalle })) });
    } catch (err) {
      resultados.push({ referencia: ev.referencia, error: err.message });
    }
  }
  return { ok: true, procesados: pendientes.length, resultados };
}
