// ══════════════════════════════════════════════════════════════════════
// CARGOS LIBRES ("Otro")  ·  lib/cargos-libres.js
// ──────────────────────────────────────────────────────────────────────
// Pedido de César, 15-oct-2026: poder sumar a una reserva un monto que NO
// está en ninguna opción del catálogo (ej. comida que el papá pidió aparte)
// sin tener que justificarlo con un ítem. Se registra como un adicional
// llamado "Otro" con el monto que César escriba.
//
// Viven en `snapshot_vigente.cargosLibres` (la contratación original
// `snapshot` nunca se toca) y SUMAN al total por fuera del motor de
// precios, así sobreviven a cualquier recálculo posterior:
//
//   reserva.total = (total del motor o total negociado) + Σ cargosLibres
//   saldo         = reserva.total − pagado          (sin tocar `saldo`)
//
// Este archivo es PURO (sin base de datos) para que lo puedan importar
// reservas.js, cambio-comercial.js y modificar-reserva.js sin ciclos. La
// escritura atómica vive en cambio-comercial.js (aplicarCargosLibres).
// ══════════════════════════════════════════════════════════════════════

export const MAX_CARGOS_LIBRES = 10;
export const MONTO_MAX_CARGO = 5_000_000; // mismo tope que el link de adicional
export const CONCEPTO_BASE = 'Otro';

// Los cargos vigentes de una configuración, ya normalizados. Devuelve []
// si no hay ninguno o si lo guardado no es válido.
export function cargosLibresDe(vigente) {
  const lista = Array.isArray(vigente?.cargosLibres) ? vigente.cargosLibres : [];
  return lista
    .filter((c) => Number.isInteger(c?.monto) && c.monto > 0)
    .map((c, i) => ({ id: c.id || `otro-${i + 1}`, concepto: c.concepto || CONCEPTO_BASE, monto: c.monto }));
}

export function sumaCargosLibres(vigente) {
  return cargosLibresDe(vigente).reduce((s, c) => s + c.monto, 0);
}

// Valida lo que manda el panel: lista COMPLETA deseada (igual que los
// extras, así se puede agregar y quitar con el mismo gesto). Cada cargo
// lleva un concepto opcional (por defecto "Otro") y un monto entero > 0.
export function normalizarCargosLibres(crudo) {
  if (!Array.isArray(crudo)) return { ok: false, motivo: 'cargos_invalidos' };
  if (crudo.length > MAX_CARGOS_LIBRES) return { ok: false, motivo: 'demasiados_cargos' };
  const cargos = [];
  for (const [i, c] of crudo.entries()) {
    const monto = Number(c?.monto);
    if (!Number.isInteger(monto) || monto <= 0 || monto > MONTO_MAX_CARGO) {
      return { ok: false, motivo: 'monto_invalido', indice: i };
    }
    const concepto = String(c?.concepto ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || CONCEPTO_BASE;
    cargos.push({ id: `otro-${i + 1}`, concepto, monto });
  }
  return { ok: true, cargos };
}

// Nombre con el que el cargo aparece en listas (calendario, panel, correos).
export const nombreCargoLibre = (c) => (c.concepto && c.concepto !== CONCEPTO_BASE ? `Otro: ${c.concepto}` : CONCEPTO_BASE);
