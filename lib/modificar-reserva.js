// ══════════════════════════════════════════════════════════════════════
// MODIFICAR UNA RESERVA YA CONFIRMADA  ·  lib/modificar-reserva.js
// ──────────────────────────────────────────────────────────────────────
// Pedido de César (08-oct-2026): "modificar fechas y características de
// reservas para yo hacerlo en el futuro y que se actualice en el resto de
// lugares". Hasta hoy el único cambio posible era el de adicionales
// (lib/cambio-comercial.js), que a propósito NUNCA toca fecha/turno/horas.
//
// Esta función cambia fecha, turno, extensión de horario, sector, tramo de
// niños, mayores, edad, festejados y nombre del festejado — y deja TODO
// consistente en una sola sentencia atómica (mismo patrón que
// aplicarCambioComercial/acreditarPago, porque el driver HTTP de Neon no
// tiene transacciones multi-sentencia):
//   · reserva: fecha_evento, turno, hora_inicio/termino, sector, niños,
//     total y snapshot_vigente (la contratación ORIGINAL `snapshot` jamás
//     se toca);
//   · turno_hold: el cerrojo FIRME se mueve al turno nuevo (o falla entero
//     si ese turno ya es de otra reserva);
//   · cambio_comercial: histórico append-only con total antes/después.
// Después (best-effort, fuera de la sentencia): pendientes de proveedor,
// bitácora y —desde la ruta— Google Calendar y el aviso a la familia.
//
// PRECIO: dos políticas explícitas, nunca implícitas.
//   'mantener'   → el total acordado no cambia; la diferencia contra lo que
//                  daría la tabla vigente queda como línea "Ajuste acordado"
//                  para que el desglose siga sumando el total.
//   'recalcular' → el total pasa a ser el de la tabla de precios vigente.
// El anticipo ya pagado nunca se toca: el saldo sigue siendo total − pagado.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import {
  recalcular, validarConfiguracion, configuracionVigente, registrarEvento,
  barrerVencidos, fechaISO, ESTADOS_FIRMES,
} from './reservas';
import { sincronizarPendientesProveedor } from './pendientes-proveedor';
import { validarTurnoFecha, horarioEfectivo } from '../data/reglas';

// Lo único que se puede cambiar en una reserva del armador. Los adicionales
// tienen su propio camino (cambio-comercial) y la temática también.
const CAMPOS_ARMADOR = [
  'fecha', 'hora', 'horasAdicionales', 'sector', 'tramoInvitados', 'totalNinos',
  'tramoMayores', 'mayoresAprox', 'edadNino', 'festejados', 'nombreNino',
];
// Una reserva manual (total negociado, sin motor de precios) solo admite lo
// que no depende de la tabla de precios.
const CAMPOS_MANUAL = ['fecha', 'hora', 'horasAdicionales', 'nombreNino'];

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function camposModificables(esManual) {
  return esManual ? CAMPOS_MANUAL : CAMPOS_ARMADOR;
}

function aplicarPolitica(precio, totalActual, politica) {
  if (politica !== 'mantener') return { ...precio, politica: 'recalcular' };
  const ajuste = totalActual - precio.total;
  const lineas = ajuste !== 0
    ? [...(precio.lineas || []), { concepto: 'Ajuste acordado (se mantiene el valor original)', monto: ajuste }]
    : precio.lineas;
  return { ...precio, totalCalculado: precio.total, total: totalActual, lineas, politica: 'mantener' };
}

const resumenHorario = (turno, fecha, horas) => {
  const h = horarioEfectivo(turno, horas || 0, fecha);
  return { horaInicio: h?.horaInicio || null, horaTermino: h?.horaTermino || null };
};

// `simular: true` calcula y valida sin escribir nada: es lo que usa el
// panel para mostrar cómo queda antes de aplicar.
export async function modificarReserva({ codigo, cambios = {}, politicaPrecio = 'mantener', avisar = false, motivo = null, simular = false }) {
  const reserva = await q1(`SELECT * FROM reserva WHERE codigo = $1`, [String(codigo || '').toUpperCase()]);
  if (!reserva) return { ok: false, motivo: 'reserva_no_encontrada' };
  if (!ESTADOS_FIRMES.includes(reserva.estado)) return { ok: false, motivo: 'reserva_no_firme' };

  const vigente = configuracionVigente(reserva);
  const esManual = !!vigente?.manual && !vigente?.configuracion;
  if (!esManual && !vigente?.configuracion) return { ok: false, motivo: 'reserva_no_editable' };

  const permitidos = camposModificables(esManual);
  const intento = Object.keys(cambios).filter((k) => cambios[k] !== undefined && cambios[k] !== null && cambios[k] !== '');
  const fuera = intento.filter((k) => !permitidos.includes(k));
  if (fuera.length) return { ok: false, motivo: 'campo_no_modificable', campos: fuera };
  if (cambios.fecha !== undefined && cambios.fecha !== null && !ISO_FECHA.test(String(cambios.fecha))) {
    return { ok: false, motivo: 'fecha_invalida', errores: ['La fecha debe venir como AAAA-MM-DD'] };
  }

  const antes = {
    fecha: fechaISO(reserva.fecha_evento), turno: reserva.turno,
    horaInicio: reserva.hora_inicio, horaTermino: reserva.hora_termino, total: reserva.total,
  };

  let estadoNuevo; let precioNuevo; let ctxNuevo; let horarioNuevo; let vigenteNuevo; let ninos; let mayores; let sector;
  let avisosNormalizacion = [];

  if (esManual) {
    const fecha = cambios.fecha || antes.fecha;
    const turno = cambios.hora || reserva.turno;
    const horas = cambios.horasAdicionales !== undefined ? Number(cambios.horasAdicionales) : (vigente.horasAdicionales || 0);
    const v = validarTurnoFecha(turno, horas, fecha);
    if (!v.ok) return { ok: false, motivo: 'configuracion_invalida', errores: [v.mensaje] };
    horarioNuevo = resumenHorario(turno, fecha, horas);
    vigenteNuevo = { ...vigente, horasAdicionales: horas, ...(cambios.nombreNino ? { nombreNino: String(cambios.nombreNino).slice(0, 80) } : {}) };
    estadoNuevo = { fecha, hora: turno, horasAdicionales: horas };
    precioNuevo = null; ninos = reserva.ninos; mayores = reserva.mayores; sector = reserva.sector;
  } else {
    const base = vigente.configuracion;
    const propuesta = { ...base };
    for (const k of permitidos) if (cambios[k] !== undefined && cambios[k] !== null && cambios[k] !== '') propuesta[k] = cambios[k];
    // Una nueva fecha viaja siempre como AAAA-MM-DD (el motor de precios la
    // lee a mediodía para que ninguna zona horaria corra el día).
    propuesta.fecha = String(propuesta.fecha).slice(0, 10);

    // Misma regla que crearReserva: turno+extensión+fecha se validan contra
    // lo que se PIDIÓ, antes de que normalizarConfiguracion pueda acotarlo
    // en silencio.
    const vTurno = validarTurnoFecha(propuesta.hora, propuesta.horasAdicionales || 0, propuesta.fecha);
    if (!vTurno.ok) return { ok: false, motivo: 'configuracion_invalida', errores: [vTurno.mensaje] };

    const r = recalcular(propuesta);
    const errores = validarConfiguracion(r.estado, r.horario);
    if (errores.length) return { ok: false, motivo: 'configuracion_invalida', errores };
    if (r.precio.total <= 0) return { ok: false, motivo: 'total_invalido', errores: ['El total calculado es cero'] };

    // Si el motor tuvo que corregir algo por su cuenta (ej. sector), se avisa.
    for (const k of ['sector', 'horasAdicionales']) {
      if (propuesta[k] !== undefined && r.estado[k] !== propuesta[k]) avisosNormalizacion.push(`${k}: se ajustó a "${r.estado[k]}" por las reglas vigentes`);
    }

    estadoNuevo = r.estado; ctxNuevo = r.ctx; horarioNuevo = { horaInicio: r.horario?.horaInicio || null, horaTermino: r.horario?.horaTermino || null };
    precioNuevo = aplicarPolitica(r.precio, reserva.total, politicaPrecio);
    vigenteNuevo = { configuracion: r.estado, precio: precioNuevo, ctx: r.ctx };
    ninos = r.ctx.totalNinos; mayores = r.ctx.cantidadMayores; sector = r.estado.sector;
  }

  const fechaNueva = String(estadoNuevo.fecha).slice(0, 10);
  const turnoNuevo = estadoNuevo.hora;
  const totalNuevo = esManual ? reserva.total : precioNuevo.total;
  const cambioDeTurno = fechaNueva !== antes.fecha || turnoNuevo !== antes.turno;

  const despues = { fecha: fechaNueva, turno: turnoNuevo, horaInicio: horarioNuevo.horaInicio, horaTermino: horarioNuevo.horaTermino, total: totalNuevo };
  const sinCambios = !cambioDeTurno && antes.horaInicio === despues.horaInicio && antes.horaTermino === despues.horaTermino
    && JSON.stringify(vigenteNuevo) === JSON.stringify(vigente);
  if (sinCambios) return { ok: false, motivo: 'sin_cambios' };

  const totalSegunTabla = esManual ? null : (precioNuevo.totalCalculado ?? precioNuevo.total);
  if (simular) {
    return { ok: true, simulacion: true, antes, despues, totalSegunTabla, avisosNormalizacion, cambioDeTurno, esManual };
  }

  // Cerrojos vencidos fuera, para que uno viejo no se confunda con "ocupado".
  if (cambioDeTurno) await barrerVencidos().catch(() => {});

  const configJSON = JSON.stringify(vigenteNuevo);
  const diferencia = totalNuevo - antes.total;
  const etiquetaMotivo = `modificacion:${intento.join(',') || 'sin_campos'}${motivo ? ` · ${motivo}` : ''}`.slice(0, 200);

  let fila;
  if (cambioDeTurno) {
    fila = await q1(
      `WITH nuevo AS (
         INSERT INTO turno_hold (fecha_evento, turno, reserva_codigo, vence, firme)
         VALUES ($2::date, $3, $4, now() + interval '5 years', true)
         ON CONFLICT (fecha_evento, turno) DO NOTHING
         RETURNING reserva_codigo
       ), cambio AS (
         INSERT INTO cambio_comercial (reserva_id, total_antes, total_despues, diferencia, configuracion_despues, motivo)
         SELECT $1, $5, $6, $7, $8::jsonb, $9 WHERE EXISTS (SELECT 1 FROM nuevo)
         RETURNING id
       ), act AS (
         UPDATE reserva
            SET fecha_evento = $2::date, turno = $3, hora_inicio = $10, hora_termino = $11,
                sector = $12, ninos = $13, mayores = $14, total = $6,
                snapshot_vigente = $8::jsonb, actualizada = now()
          WHERE id = $1 AND EXISTS (SELECT 1 FROM nuevo)
          RETURNING id
       ), viejo AS (
         DELETE FROM turno_hold
          WHERE reserva_codigo = $4 AND firme = true
            AND NOT (fecha_evento = $2::date AND turno = $3)
            AND EXISTS (SELECT 1 FROM act)
          RETURNING 1
       )
       SELECT (SELECT id FROM cambio) AS cambio_id, (SELECT count(*)::int FROM act) AS n_act`,
      [reserva.id, fechaNueva, turnoNuevo, reserva.codigo, antes.total, totalNuevo, diferencia,
        configJSON, etiquetaMotivo, despues.horaInicio, despues.horaTermino, sector, ninos, mayores]
    );
  } else {
    fila = await q1(
      `WITH cambio AS (
         INSERT INTO cambio_comercial (reserva_id, total_antes, total_despues, diferencia, configuracion_despues, motivo)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING id
       ), act AS (
         UPDATE reserva
            SET hora_inicio = $7, hora_termino = $8, sector = $9, ninos = $10, mayores = $11,
                total = $3, snapshot_vigente = $5::jsonb, actualizada = now()
          WHERE id = $1
          RETURNING id
       )
       SELECT (SELECT id FROM cambio) AS cambio_id, (SELECT count(*)::int FROM act) AS n_act`,
      [reserva.id, antes.total, totalNuevo, diferencia, configJSON, etiquetaMotivo,
        despues.horaInicio, despues.horaTermino, sector, ninos, mayores]
    );
  }

  if (!fila || !fila.n_act) return { ok: false, motivo: 'turno_ocupado' };

  await registrarEvento({
    reservaId: reserva.id,
    tipo: 'RESERVA_MODIFICADA',
    referencia: `cambio:${fila.cambio_id}`,
    detalle: { antes, despues, campos: intento, politicaPrecio: esManual ? 'manual' : politicaPrecio, avisar: !!avisar, motivo },
  });

  if (!esManual) {
    await sincronizarPendientesProveedor({ reservaId: reserva.id, configuracion: estadoNuevo, fechaEvento: fechaNueva })
      .catch((err) => console.error('[modificar-reserva] pendientes:', err.message));
  }

  return { ok: true, cambioId: fila.cambio_id, antes, despues, totalSegunTabla, avisosNormalizacion, cambioDeTurno, esManual, referencia: `cambio:${fila.cambio_id}` };
}
