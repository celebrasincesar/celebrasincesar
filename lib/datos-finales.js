// ══════════════════════════════════════════════════════════════════════
// DATOS FINALES OPERACIONALES  ·  lib/datos-finales.js
// ──────────────────────────────────────────────────────────────────────
// Información final informada cerca del evento — asistencia real,
// responsable, teléfono del día (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 1", 21-sep-2026). Append-only: cada confirmación es una fila
// nueva, nunca se reemplaza la anterior. NUNCA toca `reserva.total`,
// `reserva.ninos`, `reserva.mayores`, `reserva.snapshot` ni
// `reserva.snapshot_vigente` — una reducción de asistentes es solo
// información operacional, no un cambio comercial.
//
// Los candados de cantidades ya viven en la propia base (CHECK de la
// tabla) — acá se validan ADEMÁS en el servidor para devolver un mensaje
// claro antes de que Postgres rechace el INSERT (mismo criterio que
// validarConfiguracion(): la base es la autoridad final, el servidor solo
// evita un error crudo).
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';

export function validarDatosFinales({ ninosFinal, mayoresFinal, adultosAprox, adultoResponsable, telefonoOperacional, observacion }) {
  const errores = [];

  if (!Number.isInteger(ninosFinal) || ninosFinal < 0) errores.push('La cantidad de niños debe ser un número válido, 0 o más.');
  if (!Number.isInteger(mayoresFinal) || mayoresFinal < 0) errores.push('La cantidad de niños de 7 años o más debe ser un número válido, 0 o más.');
  if (Number.isInteger(ninosFinal) && Number.isInteger(mayoresFinal) && mayoresFinal > ninosFinal) {
    errores.push('Los niños de 7 años o más no pueden ser más que el total de niños.');
  }
  if (!Number.isInteger(adultosAprox) || adultosAprox < 0) errores.push('La cantidad de adultos debe ser un número válido, 0 o más.');
  if (!adultoResponsable || !adultoResponsable.trim()) errores.push('Falta el nombre del adulto responsable.');
  if (!telefonoOperacional || !telefonoOperacional.trim()) errores.push('Falta el teléfono de contacto del día.');
  if (observacion && observacion.length > 500) errores.push('La observación no puede superar los 500 caracteres.');

  return errores;
}

export async function guardarDatosFinales({ reservaId, ninosFinal, mayoresFinal, adultosAprox, adultoResponsable, telefonoOperacional, observacion }) {
  const errores = validarDatosFinales({ ninosFinal, mayoresFinal, adultosAprox, adultoResponsable, telefonoOperacional, observacion });
  if (errores.length) return { ok: false, motivo: 'datos_invalidos', errores };

  const fila = await q1(
    `INSERT INTO datos_finales_reserva
       (reserva_id, ninos_final, mayores_final, adultos_aprox, adulto_responsable, telefono_operacional, observacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [reservaId, ninosFinal, mayoresFinal, adultosAprox, adultoResponsable.trim(), telefonoOperacional.trim(), observacion?.trim() || null]
  );

  return { ok: true, datosFinales: fila };
}

// La vigente = la fila más reciente por confirmado_en. null si nunca se
// confirmó nada — Mi Celebración y /cadena deben distinguir "sin
// confirmar todavía" de "confirmó 0 niños".
export async function datosFinalesVigentes(reservaId) {
  return q1(
    `SELECT * FROM datos_finales_reserva
      WHERE reserva_id = $1 ORDER BY confirmado_en DESC LIMIT 1`,
    [reservaId]
  );
}

// Histórico completo, más reciente primero — para auditoría (nunca se
// pierde una versión anterior aunque el papá corrija los datos).
export async function historicoDatosFinales(reservaId) {
  return q(
    `SELECT * FROM datos_finales_reserva WHERE reserva_id = $1 ORDER BY confirmado_en DESC`,
    [reservaId]
  );
}
