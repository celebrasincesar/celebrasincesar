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

  const { estado, precio, horario, ctx } = recalcular(propuesta);
  const errores = validarConfiguracion(estado, horario);
  if (errores.length) return { ok: false, motivo: 'configuracion_invalida', errores };

  const totalAntes = reserva.total;
  const totalDespues = precio.total;
  const diferencia = totalDespues - totalAntes;

  const configuracionDespues = { configuracion: estado, precio, ctx };
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
  const totalDespues = totalBase + extrasManual.reduce((s, e) => s + e.precio, 0);
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

// Histórico completo de cambios de una reserva, más antiguo primero —
// para "Contratado vs. vigente" y para auditoría.
export async function historicoComercial(reservaId) {
  return q(
    `SELECT id, total_antes, total_despues, diferencia, motivo, creado
       FROM cambio_comercial WHERE reserva_id = $1 ORDER BY creado`,
    [reservaId]
  );
}
