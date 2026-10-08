// ══════════════════════════════════════════════════════════════════════
// AVISO A LA FAMILIA POR CAMBIO EN SU RESERVA  ·  lib/aviso-cambio-reserva.js
// ──────────────────────────────────────────────────────────────────────
// Cuando César modifica fecha/horario/características de una reserva desde
// /cadena (lib/modificar-reserva.js) y marca "avisar a la familia", sale
// este correo — mismo estilo que la confirmación contractual, y SIEMPRE con
// el link a Mi Celebración (el papá ve ahí la fecha nueva y su saldo real).
//
// Idempotencia (mismo patrón que lib/saldo-recordatorio.js y
// lib/notificaciones.js): el evento 'AVISO_CAMBIO_ENVIADO' se registra SOLO
// después de que enviarCorreo() resuelve sin lanzar (SMTP real confirmado).
// Si falla, no se registra nada: el cron diario lo reintenta solo (mismo
// cron del ciclo previo — no se crea uno nuevo). Un cambio = un aviso: la
// referencia es el id del histórico (`cambio:<id>`).
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { estadoSaldo, festejadoDeReserva } from './reservas';
import { linkMiCelebracion } from './ciclo-previo';
import { correoConfigurado, enviarCorreo } from './correo';
import { NEGOCIO } from '../data/master';

export const TIPO_MODIFICADA = 'RESERVA_MODIFICADA';
export const TIPO_AVISO_ENVIADO = 'AVISO_CAMBIO_ENVIADO';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const fmtFecha = (f) => {
  const d = new Date(`${String(f).slice(0, 10)}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const turnoTxt = (t) => (t === 'AM' ? 'mañana' : 'tarde');
const rango = (x) => `${x.horaInicio || '—'}–${x.horaTermino || '—'}`;

const ETIQUETA_CAMPO = {
  sector: 'el sector', tramoInvitados: 'la cantidad de niños', totalNinos: 'la cantidad de niños',
  tramoMayores: 'los niños mayores de 6', mayoresAprox: 'los niños mayores de 6', edadNino: 'la edad del festejado',
  festejados: 'la cantidad de festejados', nombreNino: 'el nombre del festejado',
};

// Pura: sin red ni Postgres. `detalle` es el de la bitácora RESERVA_MODIFICADA.
export function construirAvisoCambio(reserva, detalle) {
  const { antes, despues, campos = [] } = detalle;
  const festejado = festejadoDeReserva(reserva) || reserva.cliente_nombre;
  const nombre = (reserva.cliente_nombre || '').split(' ')[0] || reserva.cliente_nombre;
  const link = linkMiCelebracion(reserva);
  const saldo = estadoSaldo(reserva).pendiente;

  const cambioFecha = antes.fecha !== despues.fecha;
  const cambioHorario = antes.turno !== despues.turno || rango(antes) !== rango(despues);
  const otros = [...new Set(campos.map((c) => ETIQUETA_CAMPO[c]).filter(Boolean))];

  const asunto = cambioFecha || cambioHorario
    ? 'Actualizamos la fecha y hora de tu celebración en Alce Kids 📅'
    : 'Actualizamos los detalles de tu celebración en Alce Kids ✨';

  const lineasCambio = [];
  if (cambioFecha) lineasCambio.push(`Fecha: antes ${fmtFecha(antes.fecha)} → ahora ${fmtFecha(despues.fecha)}`);
  if (cambioHorario) lineasCambio.push(`Horario: antes ${rango(antes)} (${turnoTxt(antes.turno)}) → ahora ${rango(despues)} (${turnoTxt(despues.turno)})`);
  if (otros.length) lineasCambio.push(`También actualizamos: ${otros.join(', ')}.`);

  const totalCambio = antes.total !== despues.total;
  const lineaValor = totalCambio
    ? `Valor total: ${clp(despues.total)} (antes ${clp(antes.total)})`
    : `Valor total: ${clp(despues.total)} — se mantiene tal como lo acordamos.`;

  const texto = [
    `Hola, ${nombre}.`,
    '',
    `Dejamos actualizada la celebración de ${festejado} en Alce Kids:`,
    '',
    ...lineasCambio,
    '',
    lineaValor,
    saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo',
    '',
    `Todo el detalle está en Mi Celebración: ${link}`,
    '',
    `Dirección: ${NEGOCIO.direccion.completa}`,
    '',
    'Si algo no calza, respóndenos por WhatsApp y lo vemos juntos.',
    '',
    'Nos vemos pronto 💛',
    '',
    'Alce Kids',
  ].join('\n');

  const fila = (t) => `<p style="margin:2px 0;color:#3A4A6B">${t}</p>`;
  const html = `
    <div style="font-family:'Nunito',sans-serif;color:#0D1B3E;max-width:520px">
      <img src="${NEGOCIO.sitio}/logo-alce.webp" alt="${NEGOCIO.venue}" style="height:56px;margin-bottom:18px" />
      <h2 style="color:#1565C0;margin-bottom:4px">Actualizamos tu celebración 📅</h2>
      <p style="color:#6B7280;margin-top:0">Hola, ${nombre}. Estos son los cambios en la celebración de <b>${festejado}</b>:</p>
      <div style="background:#F8FAFF;border-radius:16px;padding:18px;margin:18px 0">
        ${cambioFecha ? fila(`📅 <b>Fecha</b><br><span style="text-decoration:line-through;color:#9CA9C4">${fmtFecha(antes.fecha)}</span><br><b style="color:#1565C0">${fmtFecha(despues.fecha)}</b>`) : ''}
        ${cambioHorario ? fila(`🕐 <b>Horario</b><br><span style="text-decoration:line-through;color:#9CA9C4">${rango(antes)} (${turnoTxt(antes.turno)})</span><br><b style="color:#1565C0">${rango(despues)} (${turnoTxt(despues.turno)})</b>`) : ''}
        ${otros.length ? fila(`✨ También actualizamos: ${otros.join(', ')}.`) : ''}
        <p style="margin:12px 0 2px"><b>Valor</b></p>
        ${fila(lineaValor)}
        ${fila(saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo')}
      </div>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1565C0;color:#fff;border-radius:12px;text-decoration:none;font-weight:bold">Ver Mi Celebración</a></p>
      <p style="font-size:12px;color:#6B7280">${NEGOCIO.direccion.completa}<br>Si algo no calza, respóndenos por WhatsApp y lo vemos juntos.</p>
      <p style="font-size:11px;color:#9CA9C4;margin-top:24px">${NEGOCIO.venue} · Una experiencia de ${NEGOCIO.nombre}</p>
    </div>`;

  return { asunto, texto, html };
}

export async function avisoCambioYaEnviado(reservaId, referencia) {
  const f = await q1(
    `SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = $2 AND referencia = $3 LIMIT 1`,
    [reservaId, TIPO_AVISO_ENVIADO, referencia]
  );
  return !!f;
}

// Un evento RESERVA_MODIFICADA ya leído → manda el correo si corresponde.
export async function enviarAvisoCambio(evento) {
  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [evento.reserva_id]);
  if (!reserva) return { enviado: false, motivo: 'reserva_inexistente' };
  if (!reserva.cliente_email) return { enviado: false, motivo: 'sin_email' };
  if (await avisoCambioYaEnviado(reserva.id, evento.referencia)) return { enviado: false, motivo: 'ya_enviado' };
  if (!correoConfigurado()) return { enviado: false, motivo: 'correo_no_configurado' };

  const detalle = typeof evento.detalle === 'string' ? JSON.parse(evento.detalle) : evento.detalle;
  const { asunto, texto, html } = construirAvisoCambio(reserva, detalle);

  try {
    await enviarCorreo({ to: reserva.cliente_email, subject: asunto, text: texto, html });
  } catch (err) {
    console.error(`[aviso-cambio] Falló el envío para ${reserva.codigo}: ${err.message}`);
    return { enviado: false, motivo: 'error_envio' };
  }

  // Recién acá, con el SMTP ya confirmado — nunca antes.
  await q(
    `INSERT INTO pago_evento (reserva_id, tipo, referencia, detalle) VALUES ($1, $2, $3, $4::jsonb)`,
    [reserva.id, TIPO_AVISO_ENVIADO, evento.referencia, JSON.stringify({ a: reserva.cliente_email })]
  );
  return { enviado: true };
}

// Para el cron diario (y para el envío inmediato desde la ruta): todos los
// cambios con "avisar" marcado que todavía no tienen su correo confirmado.
export async function ejecutarAvisosCambio() {
  const pendientes = await q(
    `SELECT e.id, e.reserva_id, e.referencia, e.detalle
       FROM pago_evento e
      WHERE e.tipo = $1
        AND (e.detalle->>'avisar') = 'true'
        AND e.creado > now() - interval '14 days'
        AND NOT EXISTS (
          SELECT 1 FROM pago_evento x
           WHERE x.reserva_id = e.reserva_id AND x.tipo = $2 AND x.referencia = e.referencia
        )
      ORDER BY e.id ASC
      LIMIT 100`,
    [TIPO_MODIFICADA, TIPO_AVISO_ENVIADO]
  );
  const resultados = [];
  for (const ev of pendientes) {
    try {
      resultados.push({ referencia: ev.referencia, ...(await enviarAvisoCambio(ev)) });
    } catch (err) {
      resultados.push({ referencia: ev.referencia, error: err.message });
    }
  }
  return { ok: true, procesados: pendientes.length, resultados };
}
