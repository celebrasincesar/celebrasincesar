// ══════════════════════════════════════════════════════════════════════
// RESUMEN DE UNA RESERVA PARA EL CORREO A CÉSAR  ·  lib/resumen-reserva.js
// ──────────────────────────────────────────────────────────────────────
// Puro: no toca Postgres ni la red — arma el asunto/texto/html a partir de
// una reserva y un pago que ya vienen leídos, usando detalleDeReserva()
// (el snapshot histórico) para todo lo que se contrató. Nunca recalcula
// nada con el catálogo o los precios vigentes (documento "Sí, avanza…",
// 09-sep-2026, §3). Mismo patrón que lib/recordatorio-bve.js: se puede
// probar en scripts/qa-pagos.mjs sin credenciales ni red.
// ══════════════════════════════════════════════════════════════════════

import { detalleDeReserva, fechaISO } from './reservas';
import { tramoInvitadosPorId, tramoMayoresPorId } from '../data/reglas';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const ETIQUETA_TIPO_PAGO = { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', EXTRA: 'Adicional' };

// Bug real detectado 01-oct-2026: el asunto/encabezado estaba fijo en
// "Nueva reserva confirmada" para CUALQUIER pago — un saldo o un
// adicional mandaban el mismo titular que un anticipo, contradiciendo el
// cuerpo del correo (que sí decía "Saldo recibido" correctamente). César
// registró el saldo de Clemente por Súper Compraquí y le llegó un correo
// que parecía avisar una reserva nueva. El titular ahora sale del tipo de
// pago real, igual que ya hacía el cuerpo.
const TITULAR_POR_TIPO_PAGO = {
  DEPOSIT: { emoji: '🎉', texto: 'Nueva reserva confirmada' },
  BALANCE: { emoji: '💰', texto: 'Saldo recibido' },
  EXTRA: { emoji: '✨', texto: 'Adicional pagado' },
};
const titularPago = (tipo) => TITULAR_POR_TIPO_PAGO[tipo] || { emoji: '✅', texto: 'Pago recibido' };

const ETIQUETA_TRIBUTARIO = {
  NOT_REQUIRED_VOUCHER: 'Voucher electrónico — no requiere boleta',
  PENDING_BVE: '⚠️ Pendiente emitir Boleta Electrónica (BVE)',
  ISSUED: 'Boleta ya emitida',
  MANUAL_REVIEW: 'Medio de pago a revisar a mano',
  ERROR: 'Error al clasificar el medio de pago',
};

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export function construirResumenReserva(reserva, pago) {
  const d = detalleDeReserva(reserva);
  const festejado = d.festejado || reserva.cliente_nombre;
  const saldo = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const ninosLabel = tramoInvitadosPorId(d.tramoInvitados)?.corto || `${reserva.ninos} niños`;
  const mayoresLabel = tramoMayoresPorId(d.tramoMayores)?.corto
    || (reserva.mayores ? `${reserva.mayores} mayores de 6` : 'Ninguno');
  const sectorLabel = reserva.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';
  const tipoPagoLabel = ETIQUETA_TIPO_PAGO[pago.tipo] || pago.tipo;
  const tributarioLabel = ETIQUETA_TRIBUTARIO[pago.tributario] || pago.tributario || 'Sin clasificar';

  const titular = titularPago(pago.tipo);
  const asunto = `${titular.emoji} ${titular.texto} · ALCE KIDS · ${festejado} · ${reserva.codigo}`;

  const lineas = [
    `${titular.emoji} ${titular.texto.toUpperCase()} · ALCE KIDS`,
    '',
    `✅ ${tipoPagoLabel} recibido`,
    '',
    `🎂 ${festejado}${d.edad != null ? ` · ${d.edad} años` : ''}`,
    `🔖 ${reserva.codigo}`,
    `👤 ${reserva.cliente_nombre}`,
    `📞 ${reserva.cliente_telefono}`,
    `📅 ${fmtFecha(fechaISO(reserva.fecha_evento))}`,
    `🕐 ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`,
    `🏡 ${sectorLabel}`,
    `👧 ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`,
    `👦 Mayores de 6: ${mayoresLabel}`,
  ];

  // Pack Celebra Sin Cesar: se cobra pero no es un ítem del catálogo, así
  // que `d.adicionales` no lo trae — se agrega acá para que César lo vea.
  const lineasAdicionales = [
    ...(d.pack ? [`${d.pack.nombre}${d.pack.precio != null ? ` — ${clp(d.pack.precio)}` : ''} (${d.pack.incluye})`] : []),
    ...d.adicionales.map((a) => `${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`),
  ];
  if (lineasAdicionales.length) {
    lineas.push('', '✨ ADICIONALES CONTRATADOS', ...lineasAdicionales.map((t) => `• ${t}`));
  }
  if (d.incluidos.length) {
    lineas.push('', '✅ PREPARAR / INCLUIDOS', ...d.incluidos.map((i) => `• ${i.nombre}`));
  }

  lineas.push(
    '',
    '💰 PAGO',
    `Total: ${clp(reserva.total)}`,
    `Pagado: ${clp(reserva.pagado)}`,
    saldo > 0 ? `Saldo: ${clp(saldo)}` : 'Saldo: pagado completo',
    `Medio: ${pago.medio || pago.medio_tipo || 'no informado'}`,
    `Estado tributario: ${tributarioLabel}`,
  );

  const texto = lineas.join('\n');

  const filaHtml = (texto) => `<p style="margin:2px 0">${texto}</p>`;
  const listaHtml = (items) => items.map((i) => `<li>${i}</li>`).join('');

  const html = `
    <div style="font-family:sans-serif;color:#0D1B3E;max-width:520px">
      <h2 style="color:#1565C0;margin-bottom:4px">${titular.emoji} ${titular.texto} · ALCE KIDS</h2>
      <p style="color:#16a34a;font-weight:bold;margin-top:0">✅ ${tipoPagoLabel} recibido</p>
      ${filaHtml(`🎂 <b>${festejado}</b>${d.edad != null ? ` · ${d.edad} años` : ''}`)}
      ${filaHtml(`🔖 ${reserva.codigo}`)}
      ${filaHtml(`👤 ${reserva.cliente_nombre}`)}
      ${filaHtml(`📞 ${reserva.cliente_telefono}`)}
      ${filaHtml(`📅 ${fmtFecha(fechaISO(reserva.fecha_evento))}`)}
      ${filaHtml(`🕐 ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`)}
      ${filaHtml(`🏡 ${sectorLabel}`)}
      ${filaHtml(`👧 ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`)}
      ${filaHtml(`👦 Mayores de 6: ${mayoresLabel}`)}
      ${lineasAdicionales.length ? `<p style="margin:12px 0 2px"><b>✨ Adicionales contratados</b></p><ul style="margin:0">${listaHtml(lineasAdicionales)}</ul>` : ''}
      ${d.incluidos.length ? `<p style="margin:12px 0 2px"><b>✅ Preparar / incluidos</b></p><ul style="margin:0">${listaHtml(d.incluidos.map((i) => i.nombre))}</ul>` : ''}
      <p style="margin:12px 0 2px"><b>💰 Pago</b></p>
      ${filaHtml(`Total: ${clp(reserva.total)}`)}
      ${filaHtml(`Pagado: ${clp(reserva.pagado)}`)}
      ${filaHtml(saldo > 0 ? `Saldo: ${clp(saldo)}` : 'Saldo: pagado completo')}
      ${filaHtml(`Medio: ${pago.medio || pago.medio_tipo || 'no informado'}`)}
      ${filaHtml(`Estado tributario: ${tributarioLabel}`)}
    </div>`;

  return { asunto, texto, html };
}
