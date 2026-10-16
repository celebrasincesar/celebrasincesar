// ══════════════════════════════════════════════════════════════════════
// CAMBIO COMERCIAL  ·  lib/cambio-comercial.js
// ──────────────────────────────────────────────────────────────────────
// Único camino para modificar la configuración comercial DESPUÉS de
// creada la reserva (documento "FASE 2B — IMPLEMENTAR BLOQUE 1",
// 21-sep-2026). Reutiliza exactamente el mismo motor que crearReserva():
// recalcular() → validarConfiguracion() → calcularTotal() (dentro de
// recalcular). No se inventa un segundo motor de precios.
//
// `reserva.snapshot` (la contratación original) NUNCA se toca acá. Lo
// único que cambia es `reserva.total` y `reserva.snapshot_vigente`, y
// ambos cambian ATÓMICAMENTE junto con el INSERT del histórico —mismo
// patrón de una sola sentencia WITH que ya usa acreditarPago() para que
// el driver HTTP de Neon (sin transacciones multi-sentencia) garantice
// que las tres cosas ocurren juntas o ninguna ocurre.
//
// `reserva.saldo` (la columna persistida) NUNCA se toca ni se lee acá:
// el saldo sigue siendo, como ya lo era, `total - pagado` calculado por
// estadoSaldo()/montoQueCorresponde() — una sola fuente de verdad.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { recalcular, validarConfiguracion, configuracionVigente, registrarEvento } from './reservas';
import { sincronizarPendientesProveedor } from './pendientes-proveedor';
import { cantNinosDeTramo } from '../data/reglas';
import { cargosLibresDe, sumaCargosLibres, normalizarCargosLibres } from './cargos-libres';

export async function aplicarCambioComercial({ reservaId, configuracionPropuesta, motivo }) {
  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { ok: false, motivo: 'reserva_no_encontrada' };

  // Fecha/turno/horas NUNCA cambian desde acá (Bloque 1: solo adicionales
  // y datos operacionales) — se preservan de la configuración vigente,
  // nunca de lo que mande el cliente, para que validarConfiguracion() siga
  // validando exactamente el mismo turno ya contratado.
  const vigenteActual = configuracionVigente(reserva);
  const configBase = vigenteActual?.configuracion || {};
  const propuesta = {
    ...configBase,
    ...configuracionPropuesta,
    fecha: configBase.fecha,
    hora: configBase.hora,
    horasAdicionales: configBase.horasAdicionales,
  };

  const recalculado = recalcular(propuesta);
  const { estado, horario, ctx } = recalculado;
  let { precio } = recalculado;
  const errores = validarConfiguracion(estado, horario);
  if (errores.length) return { ok: false, motivo: 'configuracion_invalida', errores };

  // Un total que se acordó MANTENER al mover la reserva (modificar-reserva,
  // política 'mantener') no debe perderse al agregar un adicional: el
  // "Ajuste acordado" sigue siendo parte del total contratado.
  const previo = vigenteActual?.precio;
  if (previo?.politica === 'mantener' && Number.isInteger(previo.totalCalculado)) {
    const ajuste = previo.total - previo.totalCalculado;
    if (ajuste !== 0) {
      precio = {
        ...precio, totalCalculado: precio.total, total: precio.total + ajuste, politica: 'mantener',
        lineas: [...(precio.lineas || []), { concepto: 'Ajuste acordado (se mantiene el valor original)', monto: ajuste }],
      };
    }
  }

  // Los cargos libres ("Otro") suman por fuera del motor y se conservan.
  const cargosLibres = cargosLibresDe(vigenteActual);

  const totalAntes = reserva.total;
  const totalDespues = precio.total + sumaCargosLibres(vigenteActual);
  const diferencia = totalDespues - totalAntes;

  const configuracionDespues = { configuracion: estado, precio, ctx, ...(cargosLibres.length ? { cargosLibres } : {}) };
  const configuracionDespuesJSON = JSON.stringify(configuracionDespues);

  // Atómico en una sola sentencia (mismo patrón que acreditarPago()):
  // el histórico y el estado vigente de la reserva cambian juntos o no
  // cambia ninguno de los dos.
  const fila = await q1(
    `WITH cambio AS (
       INSERT INTO cambio_comercial (reserva_id, total_antes, total_despues, diferencia, configuracion_despues, motivo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, creado
     ), reserva_act AS (
       UPDATE reserva
          SET total = $3, snapshot_vigente = $5::jsonb, actualizada = now()
        WHERE id = $1
        RETURNING id, total, snapshot_vigente
     )
     SELECT (SELECT id FROM cambio) AS cambio_id,
            (SELECT creado FROM cambio) AS creado,
            (SELECT row_to_json(r) FROM reserva_act r) AS reserva`,
    [reservaId, totalAntes, totalDespues, diferencia, configuracionDespuesJSON, motivo || null]
  );

  await registrarEvento({
    reservaId,
    tipo: 'CAMBIO_COMERCIAL_APLICADO',
    referencia: reserva.codigo,
    detalle: { totalAntes, totalDespues, diferencia, motivo: motivo || null },
  });

  // Mismo código, sea que el ítem se haya agregado al crear la reserva o
  // acá — sincronizarPendientesProveedor() es la única función que puede
  // crear/actualizar pendientes, así que nunca puede haber un camino que
  // agregue un adicional sin que el pendiente aparezca.
  await sincronizarPendientesProveedor({
    reservaId,
    configuracion: estado,
    fechaEvento: reserva.fecha_evento,
  });

  return {
    ok: true,
    cambioId: fila.cambio_id,
    totalAntes,
    totalDespues,
    diferencia,
    reserva: fila.reserva,
  };
}

// ══════════════════════════════════════════════════════════════════════
// CAMBIO COMERCIAL EN RESERVA MANUAL (+ Crear reserva manual)
// ──────────────────────────────────────────────────────────────────────
// Una reserva manual tiene un total NEGOCIADO por César, fuera del motor
// de precios — por eso no pasa por recalcular() (pisaría ese precio). Acá
// el cambio es ADITIVO: `totalBase` (el total negociado, que se congela la
// primera vez que se edita) nunca cambia; el total vigente es
// totalBase + el precio de catálogo de cada adicional contratado después.
// Mismo patrón atómico (histórico + reserva en una sola sentencia) y mismo
// sincronizarPendientesProveedor() que el camino normal.
// ══════════════════════════════════════════════════════════════════════
export async function aplicarCambioComercialManual({ reservaId, items, tematica, motivo }) {
  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { ok: false, motivo: 'reserva_no_encontrada' };

  const vigenteActual = configuracionVigente(reserva);
  if (!vigenteActual?.manual) return { ok: false, motivo: 'reserva_no_es_manual' };

  const cantNinos = cantNinosDeTramo(vigenteActual.tramoInvitados);
  const totalBase = Number.isInteger(vigenteActual.totalBase) ? vigenteActual.totalBase : reserva.total;

  const extrasManual = items.map((it) => ({
    id: it.id,
    nombre: it.nombre,
    emoji: it.emoji || null,
    gratis: it.gratis === true,
    precio: it.gratis === true ? 0 : (it.precios?.[cantNinos] ?? it.precios?.hasta10 ?? it.precio ?? 0),
  }));

  const totalAntes = reserva.total;
  const totalDespues = totalBase + extrasManual.reduce((s, e) => s + e.precio, 0) + sumaCargosLibres(vigenteActual);
  const diferencia = totalDespues - totalAntes;

  const configuracionDespues = {
    ...vigenteActual,
    totalBase,
    extrasManual,
    tematica: tematica || null,
  };
  const configuracionDespuesJSON = JSON.stringify(configuracionDespues);

  const fila = await q1(
    `WITH cambio AS (
       INSERT INTO cambio_comercial (reserva_id, total_antes, total_despues, diferencia, configuracion_despues, motivo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, creado
     ), reserva_act AS (
       UPDATE reserva
          SET total = $3, snapshot_vigente = $5::jsonb, actualizada = now()
        WHERE id = $1
        RETURNING id, total, snapshot_vigente
     )
     SELECT (SELECT id FROM cambio) AS cambio_id,
            (SELECT creado FROM cambio) AS creado,
            (SELECT row_to_json(r) FROM reserva_act r) AS reserva`,
    [reservaId, totalAntes, totalDespues, diferencia, configuracionDespuesJSON, motivo || null]
  );

  await registrarEvento({
    reservaId,
    tipo: 'CAMBIO_COMERCIAL_APLICADO',
    referencia: reserva.codigo,
    detalle: { totalAntes, totalDespues, diferencia, motivo: motivo || null, manual: true },
  });

  await sincronizarPendientesProveedor({
    reservaId,
    configuracion: { extras: extrasManual, tematica: tematica || null },
    fechaEvento: reserva.fecha_evento,
  });

  return { ok: true, cambioId: fila.cambio_id, totalAntes, totalDespues, diferencia, reserva: fila.reserva };
}

// ══════════════════════════════════════════════════════════════════════
// CARGOS LIBRES ("Otro")  — ver lib/cargos-libres.js
// ──────────────────────────────────────────────────────────────────────
// César recibe la lista COMPLETA deseada de cargos (agregar y quitar son
// el mismo gesto). El total nuevo es la base —lo que valía la reserva sin
// cargos libres— más la suma de los cargos. El saldo no se toca: sigue
// siendo total − pagado. Mismo patrón atómico y mismo histórico que el
// resto de los cambios comerciales.
// ══════════════════════════════════════════════════════════════════════
export async function aplicarCargosLibres({ reservaId, cargos, motivo }) {
  const norm = normalizarCargosLibres(cargos);
  if (!norm.ok) return norm;

  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { ok: false, motivo: 'reserva_no_encontrada' };

  const vigente = configuracionVigente(reserva);
  const esManual = !!vigente?.manual && !vigente?.configuracion;
  if (!esManual && !vigente?.configuracion) return { ok: false, motivo: 'reserva_no_editable' };

  const sumaActual = sumaCargosLibres(vigente);
  let vigenteNuevo;
  let base;
  if (esManual) {
    // Congela el total negociado la primera vez (igual que los adicionales
    // manuales) y deja `extrasManual` presente para que el detalle de la
    // reserva use la rama manual aditiva.
    base = Number.isInteger(vigente.totalBase) ? vigente.totalBase : reserva.total - sumaActual;
    vigenteNuevo = { ...vigente, totalBase: base, extrasManual: Array.isArray(vigente.extrasManual) ? vigente.extrasManual : [], cargosLibres: norm.cargos };
    // Si ya había adicionales manuales, el total base los incluye aparte.
    base += (vigenteNuevo.extrasManual || []).reduce((s, e) => s + (e.precio || 0), 0);
  } else {
    base = Number.isInteger(vigente.precio?.total) ? vigente.precio.total : reserva.total - sumaActual;
    vigenteNuevo = { ...vigente, cargosLibres: norm.cargos };
  }
  if (!norm.cargos.length) delete vigenteNuevo.cargosLibres;

  const totalAntes = reserva.total;
  const totalDespues = base + norm.cargos.reduce((s, c) => s + c.monto, 0);
  const diferencia = totalDespues - totalAntes;
  if (diferencia === 0 && sumaActual === norm.cargos.reduce((s, c) => s + c.monto, 0)
      && JSON.stringify(cargosLibresDe(vigente)) === JSON.stringify(norm.cargos)) {
    return { ok: true, sinCambios: true, totalAntes, totalDespues, diferencia: 0, cargos: norm.cargos };
  }

  const fila = await q1(
    `WITH cambio AS (
       INSERT INTO cambio_comercial (reserva_id, total_antes, total_despues, diferencia, configuracion_despues, motivo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, creado
     ), reserva_act AS (
       UPDATE reserva
          SET total = $3, snapshot_vigente = $5::jsonb, actualizada = now()
        WHERE id = $1
        RETURNING id, total
     )
     SELECT (SELECT id FROM cambio) AS cambio_id,
            (SELECT row_to_json(r) FROM reserva_act r) AS reserva`,
    [reservaId, totalAntes, totalDespues, diferencia, JSON.stringify(vigenteNuevo), motivo || 'cargo_libre_desde_cadena']
  );

  await registrarEvento({
    reservaId,
    tipo: 'CAMBIO_COMERCIAL_APLICADO',
    referencia: reserva.codigo,
    detalle: { totalAntes, totalDespues, diferencia, motivo: motivo || 'cargo_libre_desde_cadena', cargosLibres: norm.cargos, manual: esManual },
  });

  return { ok: true, cambioId: fila.cambio_id, totalAntes, totalDespues, diferencia, cargos: norm.cargos };
}

// Histórico completo de cambios de una reserva, más antiguo primero —
// para "Contratado vs. vigente" y para auditoría.
export async function historicoComercial(reservaId) {
  return q(
    `SELECT id, total_antes, total_despues, diferencia, motivo, creado
       FROM cambio_comercial WHERE reserva_id = $1 ORDER BY creado`,
    [reservaId]
  );
}
