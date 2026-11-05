// ══════════════════════════════════════════════════════════════════════
// MODIFICAR UNA RESERVA YA CONFIRMADA  ·  lib/modificar-reserva.js
// ──────────────────────────────────────────────────────────────────────
// Pedido de César (08-oct-2026): "modificar fechas y características de
// reservas para yo hacerlo en el futuro y que se actualice en el resto de
// lugares". Desde el 04-nov-2026 es también el ÚNICO camino del panel para
// cambiar adicionales, temática y cargos libres ("Otro"): antes esos se
// aplicaban sueltos, sin vista previa ni aviso a la familia ("solo lo
// agrega y no se puede hacer nada"). Ahora cualquier cambio pasa por el
// mismo "Ver cómo queda → Aplicar", queda en el mismo histórico y puede
// avisarse por correo.
//
// Esta función cambia fecha, turno, extensión de horario, sector, tramo de
// niños, mayores, edad, festejados, nombre del festejado, adicionales,
// temática y cargos libres — y deja TODO consistente en una sola sentencia
// atómica (mismo patrón que aplicarCambioComercial/acreditarPago, porque el
// driver HTTP de Neon no tiene transacciones multi-sentencia):
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
//   'mantener'   → el total acordado no cambia por mover fecha o datos; la
//                  diferencia contra la tabla vigente queda como línea
//                  "Ajuste acordado" para que el desglose siga sumando el
//                  total. Los adicionales que se agregan o quitan SÍ suman o
//                  restan su precio de catálogo sobre ese total.
//   'recalcular' → el total pasa a ser el de la tabla de precios vigente.
// Los cargos libres suman siempre por fuera del motor. El anticipo ya
// pagado nunca se toca: el saldo sigue siendo total − pagado.
// ══════════════════════════════════════════════════════════════════════

import { q1 } from './db';
import {
  recalcular, validarConfiguracion, configuracionVigente, registrarEvento,
  barrerVencidos, fechaISO, ESTADOS_FIRMES,
} from './reservas';
import { sincronizarPendientesProveedor, IDS_DECORACION_TEMATICA } from './pendientes-proveedor';
import { validarTurnoFecha, horarioEfectivo, cantNinosDeTramo, clp } from '../data/reglas';
import { cargosLibresDe, sumaCargosLibres, normalizarCargosLibres, nombreCargoLibre } from './cargos-libres';
import { resolverExtras, extraManualDe } from './cambio-comercial';

// Adicionales (lista COMPLETA deseada de ids del catálogo: agregar y quitar
// son el mismo gesto), temática y cargos libres (lista completa deseada).
const CAMPOS_COMERCIALES = ['extras', 'tematica', 'cargosLibres'];
const CAMPOS_ARMADOR = [
  'fecha', 'hora', 'horasAdicionales', 'sector', 'tramoInvitados', 'totalNinos',
  'tramoMayores', 'mayoresAprox', 'edadNino', 'festejados', 'nombreNino', ...CAMPOS_COMERCIALES,
];
// Una reserva manual (total negociado, sin motor de precios) solo admite lo
// que no depende de la tabla de precios. Sus adicionales suman su precio de
// catálogo sobre el total negociado (mismo criterio que
// aplicarCambioComercialManual).
const CAMPOS_MANUAL = ['fecha', 'hora', 'horasAdicionales', 'nombreNino', ...CAMPOS_COMERCIALES];

const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const presente = (v) => v !== undefined && v !== null && v !== '';
const tieneDecoTematica = (lista) => (lista || []).some((e) => IDS_DECORACION_TEMATICA.has(e.id));

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

// Qué adicionales, "Otro" y temática cambiaron — para la vista previa del
// panel, la bitácora y el correo a la familia.
function resumenComercial({ extrasAntes, extrasDespues, cargosAntes, cargosDespues, tematicaAntes, tematicaDespues }) {
  const idsAntes = new Set(extrasAntes.map((e) => e.id));
  const idsDespues = new Set(extrasDespues.map((e) => e.id));
  const etiqueta = (c) => `${nombreCargoLibre(c)} (${clp(c.monto)})`;
  const restar = (a, b) => {
    const resto = [...b];
    return a.filter((x) => { const i = resto.indexOf(x); if (i === -1) return true; resto.splice(i, 1); return false; });
  };
  const otrosAntes = cargosAntes.map(etiqueta);
  const otrosDespues = cargosDespues.map(etiqueta);
  const tAntes = tematicaAntes || null;
  const tDespues = tematicaDespues || null;
  return {
    adicionales: {
      agregados: extrasDespues.filter((e) => !idsAntes.has(e.id)).map((e) => e.nombre),
      quitados: extrasAntes.filter((e) => !idsDespues.has(e.id)).map((e) => e.nombre),
    },
    otros: { agregados: restar(otrosDespues, otrosAntes), quitados: restar(otrosAntes, otrosDespues) },
    tematica: tAntes !== tDespues ? { antes: tAntes, despues: tDespues } : null,
  };
}

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
  const intento = Object.keys(cambios).filter((k) => presente(cambios[k]));
  const fuera = intento.filter((k) => !permitidos.includes(k));
  if (fuera.length) return { ok: false, motivo: 'campo_no_modificable', campos: fuera };
  if (presente(cambios.fecha) && !ISO_FECHA.test(String(cambios.fecha))) {
    return { ok: false, motivo: 'fecha_invalida', errores: ['La fecha debe venir como AAAA-MM-DD'] };
  }

  const cambiaExtras = presente(cambios.extras);
  const tematicaPedida = presente(cambios.tematica) ? String(cambios.tematica).replace(/\s+/g, ' ').trim().slice(0, 80) : null;
  const cargosAntes = cargosLibresDe(vigente);
  let cargosNuevos = cargosAntes;
  if (presente(cambios.cargosLibres)) {
    const norm = normalizarCargosLibres(cambios.cargosLibres);
    if (!norm.ok) return { ...norm, errores: ['Cada "Otro" necesita un monto entero entre $1 y $5.000.000'] };
    cargosNuevos = norm.cargos;
  }
  const sumaCargosNuevos = cargosNuevos.reduce((s, c) => s + c.monto, 0);

  const antes = {
    fecha: fechaISO(reserva.fecha_evento), turno: reserva.turno,
    horaInicio: reserva.hora_inicio, horaTermino: reserva.hora_termino, total: reserva.total,
  };

  let estadoNuevo; let precioNuevo; let horarioNuevo; let vigenteNuevo; let ninos; let mayores; let sector;
  let totalNuevo; let totalSegunTabla = null; let comercial;
  const avisosNormalizacion = [];

  if (esManual) {
    const fecha = cambios.fecha || antes.fecha;
    const turno = cambios.hora || reserva.turno;
    const horas = cambios.horasAdicionales !== undefined ? Number(cambios.horasAdicionales) : (vigente.horasAdicionales || 0);
    const v = validarTurnoFecha(turno, horas, fecha);
    if (!v.ok) return { ok: false, motivo: 'configuracion_invalida', errores: [v.mensaje] };
    horarioNuevo = resumenHorario(turno, fecha, horas);
    vigenteNuevo = { ...vigente, horasAdicionales: horas, ...(cambios.nombreNino ? { nombreNino: String(cambios.nombreNino).slice(0, 80) } : {}) };
    estadoNuevo = { fecha, hora: turno, horasAdicionales: horas };

    const extrasAntes = Array.isArray(vigente.extrasManual) ? vigente.extrasManual : [];
    let extrasManual = extrasAntes;
    if (cambiaExtras) {
      const res = resolverExtras(cambios.extras, null);
      if (!res.ok) return res;
      const cantNinos = cantNinosDeTramo(vigente.tramoInvitados);
      // Lo ya contratado conserva su precio congelado; solo lo nuevo toma
      // el de catálogo.
      extrasManual = res.items.map((it) => extrasAntes.find((e) => e.id === it.id) || extraManualDe(it, cantNinos));
    }
    let tematica = tematicaPedida || vigente.tematica || null;
    if (cambiaExtras && tieneDecoTematica(extrasAntes) && !tieneDecoTematica(extrasManual)) tematica = tematicaPedida || null;
    if (tieneDecoTematica(extrasManual) && !tematica) {
      return { ok: false, motivo: 'falta_tematica', errores: ['Falta indicar la temática de la decoración'] };
    }

    if (cambiaExtras || presente(cambios.cargosLibres) || tematicaPedida) {
      // Congela el total negociado la primera vez (igual que
      // aplicarCambioComercialManual / aplicarCargosLibres).
      const totalBase = Number.isInteger(vigente.totalBase) ? vigente.totalBase : reserva.total - sumaCargosLibres(vigente);
      vigenteNuevo = { ...vigenteNuevo, totalBase, extrasManual, tematica };
      if (cargosNuevos.length) vigenteNuevo.cargosLibres = cargosNuevos; else delete vigenteNuevo.cargosLibres;
      totalNuevo = totalBase + extrasManual.reduce((s, e) => s + (e.precio || 0), 0) + sumaCargosNuevos;
    } else {
      totalNuevo = reserva.total;
    }
    comercial = resumenComercial({
      extrasAntes, extrasDespues: extrasManual, cargosAntes, cargosDespues: cargosNuevos,
      tematicaAntes: vigente.tematica, tematicaDespues: vigenteNuevo.tematica,
    });
    precioNuevo = null; ninos = reserva.ninos; mayores = reserva.mayores; sector = reserva.sector;
  } else {
    const base = vigente.configuracion;
    const propuesta = { ...base };
    for (const k of permitidos) if (!CAMPOS_COMERCIALES.includes(k) && presente(cambios[k])) propuesta[k] = cambios[k];
    // Una nueva fecha viaja siempre como AAAA-MM-DD (el motor de precios la
    // lee a mediodía para que ninguna zona horaria corra el día).
    propuesta.fecha = String(propuesta.fecha).slice(0, 10);

    // Misma regla que crearReserva: turno+extensión+fecha se validan contra
    // lo que se PIDIÓ, antes de que normalizarConfiguracion pueda acotarlo
    // en silencio.
    const vTurno = validarTurnoFecha(propuesta.hora, propuesta.horasAdicionales || 0, propuesta.fecha);
    if (!vTurno.ok) return { ok: false, motivo: 'configuracion_invalida', errores: [vTurno.mensaje] };

    // Los adicionales nuevos se validan contra la celebración YA modificada
    // (ej. si en el mismo cambio sube la cantidad de niños).
    if (cambiaExtras) {
      const ctxPropuesta = recalcular({ ...propuesta, extras: [] }).ctx;
      const res = resolverExtras(cambios.extras, ctxPropuesta, new Set((base.extras || []).map((e) => e.id)));
      if (!res.ok) return res;
      propuesta.extras = res.items;
    }
    if (tematicaPedida) propuesta.tematica = tematicaPedida;
    else if (cambiaExtras && tieneDecoTematica(base.extras) && !tieneDecoTematica(propuesta.extras)) propuesta.tematica = null;

    const r = recalcular(propuesta);
    const errores = validarConfiguracion(r.estado, r.horario, { permitirFechaPasada: propuesta.fecha === antes.fecha });
    if (errores.length) return { ok: false, motivo: 'configuracion_invalida', errores };
    if (r.precio.total <= 0) return { ok: false, motivo: 'total_invalido', errores: ['El total calculado es cero'] };

    // Si el motor tuvo que corregir algo por su cuenta (ej. sector, o un
    // adicional que ya no calza con la celebración nueva), se avisa.
    for (const k of ['sector', 'horasAdicionales']) {
      if (propuesta[k] !== undefined && r.estado[k] !== propuesta[k]) avisosNormalizacion.push(`${k}: se ajustó a "${r.estado[k]}" por las reglas vigentes`);
    }
    for (const m of r.estado.cambios || []) if (/^Quitamos/.test(m)) avisosNormalizacion.push(m);

    estadoNuevo = r.estado;
    horarioNuevo = { horaInicio: r.horario?.horaInicio || null, horaTermino: r.horario?.horaTermino || null };

    // Con 'mantener', mover fecha o datos no cambia el total acordado, pero
    // agregar o quitar un adicional sí suma o resta su precio: la
    // diferencia se mide con la MISMA celebración nueva, con y sin el
    // cambio de adicionales. Los cargos libres suman por fuera del motor.
    let totalAcordado = reserva.total - sumaCargosLibres(vigente);
    if (cambiaExtras || tematicaPedida) {
      const sinCambioComercial = recalcular({ ...propuesta, extras: base.extras || [], tematica: base.tematica ?? null });
      totalAcordado += r.precio.total - sinCambioComercial.precio.total;
    }
    precioNuevo = aplicarPolitica(r.precio, totalAcordado, politicaPrecio);
    vigenteNuevo = { configuracion: r.estado, precio: precioNuevo, ctx: r.ctx, ...(cargosNuevos.length ? { cargosLibres: cargosNuevos } : {}) };
    totalNuevo = precioNuevo.total + sumaCargosNuevos;
    totalSegunTabla = (precioNuevo.totalCalculado ?? precioNuevo.total) + sumaCargosNuevos;
    comercial = resumenComercial({
      extrasAntes: base.extras || [], extrasDespues: r.estado.extras || [], cargosAntes, cargosDespues: cargosNuevos,
      tematicaAntes: base.tematica, tematicaDespues: r.estado.tematica,
    });
    ninos = r.ctx.totalNinos; mayores = r.ctx.cantidadMayores; sector = r.estado.sector;
  }

  if (!Number.isInteger(totalNuevo) || totalNuevo <= 0) return { ok: false, motivo: 'total_invalido', errores: ['El total calculado no es válido'] };

  const fechaNueva = String(estadoNuevo.fecha).slice(0, 10);
  const turnoNuevo = estadoNuevo.hora;
  const cambioDeTurno = fechaNueva !== antes.fecha || turnoNuevo !== antes.turno;

  const despues = { fecha: fechaNueva, turno: turnoNuevo, horaInicio: horarioNuevo.horaInicio, horaTermino: horarioNuevo.horaTermino, total: totalNuevo };
  const sinCambios = !cambioDeTurno && antes.horaInicio === despues.horaInicio && antes.horaTermino === despues.horaTermino
    && JSON.stringify(vigenteNuevo) === JSON.stringify(vigente);
  if (sinCambios) return { ok: false, motivo: 'sin_cambios' };

  if (simular) {
    return { ok: true, simulacion: true, antes, despues, totalSegunTabla, avisosNormalizacion, cambioDeTurno, esManual, comercial };
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
    detalle: { antes, despues, campos: intento, comercial, politicaPrecio: esManual ? 'manual' : politicaPrecio, avisar: !!avisar, motivo },
  });

  // Animación y decoración temática dependen de proveedores externos: la
  // lista de pendientes se rehace con lo que quedó contratado y la fecha nueva.
  const configProveedor = esManual
    ? (Array.isArray(vigenteNuevo.extrasManual) && (cambiaExtras || cambioDeTurno || tematicaPedida)
      ? { extras: vigenteNuevo.extrasManual, tematica: vigenteNuevo.tematica || null } : null)
    : estadoNuevo;
  if (configProveedor) {
    await sincronizarPendientesProveedor({ reservaId: reserva.id, configuracion: configProveedor, fechaEvento: fechaNueva })
      .catch((err) => console.error('[modificar-reserva] pendientes:', err.message));
  }

  return { ok: true, cambioId: fila.cambio_id, antes, despues, totalSegunTabla, avisosNormalizacion, cambioDeTurno, esManual, comercial, referencia: `cambio:${fila.cambio_id}` };
}
