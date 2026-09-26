// ══════════════════════════════════════════════════════════════════════
// CORREO DE CONFIRMACIÓN AL CLIENTE  ·  lib/resumen-cliente.js
// ──────────────────────────────────────────────────────────────────────
// Puro: no toca Postgres ni la red — arma el asunto/texto/html a partir de
// una reserva y un pago que ya vienen leídos, usando detalleDeReserva()
// (el snapshot histórico) para todo lo que se contrató. Nunca recalcula
// nada con el catálogo o los precios vigentes. Mismo patrón que
// lib/resumen-reserva.js (el correo a administración), pero dirigido y
// tonalizado para el cliente que acaba de pagar (documento "Fase de
// consolidación final", 12-sep-2026, §9).
// ══════════════════════════════════════════════════════════════════════

import { detalleDeReserva, fechaISO } from './reservas';
import { tramoInvitadosPorId, tramoMayoresPorId } from '../data/reglas';
import { NEGOCIO } from '../data/master';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// Mismo cálculo que app/api/cadena/reservas/route.js: 48 horas antes del
// inicio real del evento. Se duplica acá a propósito —pura, sin
// dependencias— en vez de importar desde una ruta de API.
function fechaLimiteSaldo(reserva) {
  const inicio = new Date(`${fechaISO(reserva.fecha_evento)}T${reserva.hora_inicio || '00:00'}:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return new Date(inicio.getTime() - 48 * 3_600_000).toISOString();
}

export function construirResumenCliente(reserva) {
  const d = detalleDeReserva(reserva);
  const festejado = d.festejado || reserva.cliente_nombre;
  const saldo = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const ninosLabel = tramoInvitadosPorId(d.tramoInvitados)?.corto || `${reserva.ninos} niños`;
  const mayoresLabel = tramoMayoresPorId(d.tramoMayores)?.corto
    || (reserva.mayores ? `${reserva.mayores} mayores de 6` : 'Ninguno');
  const sectorLabel = reserva.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';
  const limiteSaldo = saldo > 0 ? fechaLimiteSaldo(reserva) : null;

  const waTexto = `¡Hola César! 👋 Ya reservé y pagué mi anticipo en ALCE KIDS. Mi código es ${reserva.codigo}.`;
  const waHref = `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(waTexto)}`;
  const catalogoHref = `${NEGOCIO.sitio}/catalogo`;
  // Enlace privado y permanente (documento "FASE 2 — EXPERIENCIA CLIENTE
  // END-TO-END", 21-sep-2026): mismo candado código+token que ya usa
  // /pago/resultado, nunca requiere crear cuenta ni contraseña.
  const miCelebracionHref = `${NEGOCIO.sitio}/mi-celebracion?id=${encodeURIComponent(reserva.codigo)}&t=${encodeURIComponent(reserva.acceso_token)}`;

  const asunto = `🎉 ¡La celebración de ${festejado} ya está reservada! · ${reserva.codigo}`;

  const lineas = [
    `🎉 ¡La celebración de ${festejado} ya está reservada!`,
    '',
    `🔖 Código: ${reserva.codigo}`,
    `🎂 ${festejado}${d.edad != null ? ` · ${d.edad} años` : ''}`,
    `📅 ${fmtFecha(fechaISO(reserva.fecha_evento))}`,
    `🕐 ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`,
    `🏡 ${sectorLabel}`,
    `👧 ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`,
    `👦 Mayores de 6: ${mayoresLabel}`,
  ];

  if (d.adicionales.length) {
    lineas.push('', '✨ ADICIONALES CONTRATADOS', ...d.adicionales.map((a) => `• ${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`));
  }

  lineas.push(
    '',
    '💰 PAGO',
    `Total: ${clp(reserva.total)}`,
    `Pagado: ${clp(reserva.pagado)}`,
    saldo > 0 ? `Saldo: ${clp(saldo)}` : 'Saldo: pagado completo',
  );
  if (limiteSaldo) lineas.push(`Fecha límite del saldo: ${fmtFecha(limiteSaldo)}`);

  lineas.push(
    '',
    '👉 Ver mi celebración: ' + miCelebracionHref,
    '💬 Coordinar por WhatsApp: ' + waHref,
    '✨ Personalizar aún más mi celebración: ' + catalogoHref,
  );

  const texto = lineas.join('\n');

  const filaHtml = (texto) => `<p style="margin:2px 0;color:#3A4A6B">${texto}</p>`;
  const listaHtml = (items) => items.map((i) => `<li>${i}</li>`).join('');

  const html = `
    <div style="font-family:'Nunito',sans-serif;color:#0D1B3E;max-width:520px;text-align:center">
      <img src="${NEGOCIO.sitio}/logo-alce.webp" alt="Alce Kids" style="height:56px;margin-bottom:18px" />
      <h2 style="color:#1565C0;margin-bottom:4px">🎉 ¡La celebración de ${festejado} ya está reservada!</h2>
      <p style="color:#16a34a;font-weight:bold;margin-top:0">✅ Anticipo recibido</p>
      <div style="text-align:left;background:#F8FAFF;border-radius:16px;padding:18px;margin:18px 0">
        ${filaHtml(`🔖 <b>${reserva.codigo}</b>`)}
        ${filaHtml(`🎂 ${festejado}${d.edad != null ? ` · ${d.edad} años` : ''}`)}
        ${filaHtml(`📅 ${fmtFecha(fechaISO(reserva.fecha_evento))}`)}
        ${filaHtml(`🕐 ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`)}
        ${filaHtml(`🏡 ${sectorLabel}`)}
        ${filaHtml(`👧 ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`)}
        ${filaHtml(`👦 Mayores de 6: ${mayoresLabel}`)}
        ${d.adicionales.length ? `<p style="margin:12px 0 2px"><b>✨ Adicionales contratados</b></p><ul style="margin:0">${listaHtml(d.adicionales.map((a) => `${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`))}</ul>` : ''}
        <p style="margin:12px 0 2px"><b>💰 Pago</b></p>
        ${filaHtml(`Total: ${clp(reserva.total)}`)}
        ${filaHtml(`Pagado: ${clp(reserva.pagado)}`)}
        ${filaHtml(saldo > 0 ? `Saldo: ${clp(saldo)}` : 'Saldo: pagado completo')}
        ${limiteSaldo ? filaHtml(`Fecha límite del saldo: ${fmtFecha(limiteSaldo)}`) : ''}
      </div>
      <a href="${miCelebracionHref}" style="display:block;background:linear-gradient(135deg,#1565C0,#1976D2);color:white;font-weight:bold;padding:14px;border-radius:16px;text-decoration:none;margin-bottom:10px">
        Ver mi celebración
      </a>
      <a href="${waHref}" style="display:block;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:bold;padding:14px;border-radius:16px;text-decoration:none;margin-bottom:10px">
        Coordinar mi celebración por WhatsApp
      </a>
      <a href="${catalogoHref}" style="display:block;color:#1565C0;font-weight:bold;padding:12px;border:1.5px solid rgba(21,101,192,0.25);border-radius:16px;text-decoration:none">
        Personalizar aún más mi celebración ✨
      </a>
      <p style="font-size:11px;color:#9CA9C4;margin-top:24px">ALCE KIDS · Una experiencia de Celebra Sin Cesar</p>
    </div>`;

  return { asunto, texto, html };
}
