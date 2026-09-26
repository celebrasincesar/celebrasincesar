// ══════════════════════════════════════════════════════════════════════
// CORREO CONTRACTUAL  ·  lib/resumen-contractual.js
// ──────────────────────────────────────────────────────────────────────
// El correo que deja constancia formal de lo contratado (documento "No
// autorizo todavía el deploy...", 15-sep-2026, §9): ficha completa de la
// reserva + referencia a la versión de T&C que el contratante aceptó. El
// PDF de esos T&C se adjunta aparte (lib/email-contractual.js) — este
// archivo solo arma el asunto/texto/html, igual que lib/resumen-cliente.js
// (el correo de "ya está reservada") y lib/resumen-reserva.js (el correo a
// administración). Puro: no toca Postgres ni la red.
// ══════════════════════════════════════════════════════════════════════

import { detalleDeReserva, fechaISO } from './reservas';
import { tramoInvitadosPorId, tramoMayoresPorId } from '../data/reglas';
import { PACKS_MAYORES } from '../data/packs-mayores';
import { NEGOCIO } from '../data/master';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

function fechaLimiteSaldo(reserva) {
  const inicio = new Date(`${fechaISO(reserva.fecha_evento)}T${reserva.hora_inicio || '00:00'}:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return new Date(inicio.getTime() - 48 * 3_600_000).toISOString();
}

// El pack de mayores no vive en detalleDeReserva() (esa función es la que
// usa /cadena para la vista general) — se lee directo del snapshot acá,
// solo para este correo, igual de "nunca se recalcula con el catálogo
// vigente": si el pack ya no existiera hoy, el nombre guardado en su
// momento sigue siendo el correcto para lo que esta reserva contrató.
export function packDesdeSnapshot(reserva) {
  const snap = typeof reserva?.snapshot === 'string' ? JSON.parse(reserva.snapshot) : reserva?.snapshot;
  const pm = snap?.configuracion?.packMayores;
  if (!pm?.packId) return null;
  return PACKS_MAYORES.find((p) => p.id === pm.packId)?.nombre || pm.packId;
}

// ── WEB vs. MANUAL — nunca la misma frase (documento "Continúa desde tu
// última entrega...", 21-sep-2026, §2/§13) ─────────────────────────────
// `reserva.tyc_aceptado` es la única fuente de verdad de si hubo una
// aceptación ELECTRÓNICA real: lo pone crearReserva() (checkout web, con
// el checkbox marcado) y NUNCA lo pone crearReservaManual() (reserva que
// César arma desde /cadena a partir de una negociación por WhatsApp — ver
// lib/reservas.js). Nunca se le puede decir a un cliente de una reserva
// manual "aceptaste estos T&C": el sistema no tiene esa evidencia, y
// afirmarlo sería fabricar un hecho que no ocurrió. El PDF adjunto es el
// mismo documento en ambos casos —es la copia de las condiciones
// asociadas a la reserva—, pero el TEXTO que lo acompaña no puede
// convertir ese envío en una aceptación retroactiva.
function esAceptacionElectronica(reserva) {
  return !!reserva.tyc_aceptado;
}

export function construirResumenContractual(reserva) {
  const d = detalleDeReserva(reserva);
  const festejado = d.festejado || reserva.cliente_nombre;
  const saldo = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const ninosLabel = tramoInvitadosPorId(d.tramoInvitados)?.corto || `${reserva.ninos} niños`;
  const mayoresLabel = tramoMayoresPorId(d.tramoMayores)?.corto
    || (reserva.mayores ? `${reserva.mayores} mayores de 6` : 'Ninguno');
  const sectorLabel = reserva.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';
  const limiteSaldo = saldo > 0 ? fechaLimiteSaldo(reserva) : null;
  const pack = packDesdeSnapshot(reserva);
  const aceptoElectronicamente = esAceptacionElectronica(reserva);

  const asunto = aceptoElectronicamente
    ? `📄 Confirmación contractual · ${festejado} · ${reserva.codigo}`
    : `📄 Resumen y condiciones de tu reserva · ${festejado} · ${reserva.codigo}`;

  const encabezado = aceptoElectronicamente
    ? `Confirmación contractual de tu celebración en ${NEGOCIO.venue}`
    : `Te enviamos el resumen de tu reserva y las condiciones aplicables a la celebración coordinada con ${NEGOCIO.venue}`;

  const lineas = [
    encabezado,
    '',
    `Código de reserva: ${reserva.codigo}`,
    `Contratante: ${reserva.cliente_nombre}`,
    `Festejado: ${festejado}`,
    `Fecha: ${fmtFecha(fechaISO(reserva.fecha_evento))}`,
    `Horario: ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`,
    `Sector: ${sectorLabel}`,
    `Niños: ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`,
    `Mayores de 6: ${mayoresLabel}`,
  ];
  if (pack) lineas.push(`Pack de entretención: ${pack}`);
  if (d.adicionales.length) {
    lineas.push('', 'Adicionales contratados:', ...d.adicionales.map((a) => `- ${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`));
  }
  lineas.push(
    '',
    `Total: ${clp(reserva.total)}`,
    `Anticipo pagado: ${clp(Math.min(reserva.pagado || 0, reserva.total || 0))}`,
    saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo',
  );
  if (limiteSaldo) lineas.push(`Vencimiento del saldo: ${fmtFecha(limiteSaldo)}`);
  lineas.push(
    '',
    `Dirección: ${NEGOCIO.direccion.completa}`,
    `Contacto: ${NEGOCIO.telefono}`,
    '',
    aceptoElectronicamente
      ? `Esta confirmación corresponde a la versión ${reserva.tyc_version} de nuestros Términos y Condiciones, que aceptaste al reservar. Va adjunta en PDF a este correo — consérvala junto con esta confirmación.`
      : `Adjuntamos en PDF la versión ${reserva.tyc_version} de nuestros Términos y Condiciones — las condiciones asociadas a tu reserva. Consérvala junto con este resumen.`,
  );

  const texto = lineas.join('\n');

  const filaHtml = (t) => `<p style="margin:2px 0;color:#3A4A6B">${t}</p>`;
  const listaHtml = (items) => items.map((i) => `<li>${i}</li>`).join('');

  const html = `
    <div style="font-family:'Nunito',sans-serif;color:#0D1B3E;max-width:520px">
      <img src="${NEGOCIO.sitio}/logo-alce.webp" alt="${NEGOCIO.venue}" style="height:56px;margin-bottom:18px" />
      <h2 style="color:#1565C0;margin-bottom:4px">${encabezado}</h2>
      <p style="color:#6B7280;margin-top:0">Consérvala junto con el PDF de Términos y Condiciones adjunto.</p>
      <div style="background:#F8FAFF;border-radius:16px;padding:18px;margin:18px 0">
        ${filaHtml(`Código: <b>${reserva.codigo}</b>`)}
        ${filaHtml(`Contratante: ${reserva.cliente_nombre}`)}
        ${filaHtml(`Festejado: ${festejado}`)}
        ${filaHtml(`Fecha: ${fmtFecha(fechaISO(reserva.fecha_evento))}`)}
        ${filaHtml(`Horario: ${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`)}
        ${filaHtml(`Sector: ${sectorLabel}`)}
        ${filaHtml(`Niños: ${ninosLabel}${d.totalNinos != null ? ` · total ${d.totalNinos}` : ''}`)}
        ${filaHtml(`Mayores de 6: ${mayoresLabel}`)}
        ${pack ? filaHtml(`Pack de entretención: ${pack}`) : ''}
        ${d.adicionales.length ? `<p style="margin:12px 0 2px"><b>Adicionales contratados</b></p><ul style="margin:0">${listaHtml(d.adicionales.map((a) => `${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`))}</ul>` : ''}
        <p style="margin:12px 0 2px"><b>Pago</b></p>
        ${filaHtml(`Total: ${clp(reserva.total)}`)}
        ${filaHtml(`Anticipo pagado: ${clp(Math.min(reserva.pagado || 0, reserva.total || 0))}`)}
        ${filaHtml(saldo > 0 ? `Saldo pendiente: ${clp(saldo)}` : 'Saldo: pagado completo')}
        ${limiteSaldo ? filaHtml(`Vencimiento del saldo: ${fmtFecha(limiteSaldo)}`) : ''}
        <p style="margin:12px 0 2px"><b>Datos del recinto</b></p>
        ${filaHtml(NEGOCIO.direccion.completa)}
        ${filaHtml(`Contacto: ${NEGOCIO.telefono}`)}
      </div>
      <p style="font-size:12px;color:#6B7280">
        ${aceptoElectronicamente
          ? `Esta confirmación corresponde a la versión <b>${reserva.tyc_version}</b> de nuestros Términos y Condiciones, que aceptaste al reservar. Va adjunta en PDF a este correo.`
          : `Adjuntamos en PDF la versión <b>${reserva.tyc_version}</b> de nuestros Términos y Condiciones — las condiciones asociadas a tu reserva.`}
      </p>
      <p style="font-size:11px;color:#9CA9C4;margin-top:24px">${NEGOCIO.venue} · Una experiencia de ${NEGOCIO.nombre}</p>
    </div>`;

  return { asunto, texto, html };
}
