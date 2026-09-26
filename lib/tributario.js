// ══════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN TRIBUTARIA DE UN PAGO  ·  lib/tributario.js
// ──────────────────────────────────────────────────────────────────────
// CELEBRA SIN CESAR SPA ya declaró ante el SII el modelo:
//   «No emito Boleta de Ventas y Servicios cuando recibo un pago
//    electrónico» — el voucher hace de comprobante.
//
// Eso NO significa que todo pago que pase por Flow quede cubierto. Flow es
// una pasarela: por dentro puede haber una tarjeta (voucher, cubierto) o
// una transferencia bancaria (no hay voucher: hay que emitir la BVE). Por
// eso la clasificación NUNCA mira el proveedor, mira el MEDIO REAL que
// informa Flow al consultar el estado del pago (§19).
//
// Y cuando el medio no se puede identificar con certeza, no se adivina:
// queda en REVISIÓN MANUAL. Equivocarse hacia "no hay que emitir nada" es
// una diferencia con el SII; equivocarse hacia "revísalo" es un minuto de
// César en el panel.
//
// Nada de esto bloquea al papá: la reserva se confirma con el pago, la
// tarea tributaria se resuelve después (§20).
//
// Sin dependencias del proyecto a propósito: scripts/qa-pagos.mjs prueba
// esta tabla caso por caso sin necesidad de credenciales ni de Next.
// ══════════════════════════════════════════════════════════════════════

// Estados posibles (§6). Se usan los nombres de la especificación tal
// cual para que el código se pueda auditar línea a línea contra el
// documento; las etiquetas en castellano viven abajo, para el panel.
export const TRIBUTARIO = {
  NOT_REQUIRED_VOUCHER: 'NOT_REQUIRED_VOUCHER',
  PENDING_BVE: 'PENDING_BVE',
  ISSUED: 'ISSUED',
  ERROR: 'ERROR',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
};

export const ETIQUETA_TRIBUTARIA = {
  NOT_REQUIRED_VOUCHER: 'Voucher — no requiere boleta',
  PENDING_BVE: 'Falta emitir boleta',
  ISSUED: 'Boleta emitida',
  ERROR: 'Error al clasificar',
  MANUAL_REVIEW: 'Revisar a mano',
};

// Quita tildes y baja a minúsculas: Flow escribe "Tarjeta de Crédito" y
// otras veces "TARJETA DE CREDITO". No se va a decidir un tema tributario
// por una tilde.
// NFD separa la letra de su tilde y \p{Diacritic} borra la tilde suelta,
// sin rangos de códigos crípticos que un editor pueda estropear.
const normalizar = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

// ── Medios que SÍ dejan voucher electrónico ───────────────────────────
// Tarjetas (crédito, débito, prepago) y las billeteras que operan como
// tarjeta. Estos quedan cubiertos por el modelo declarado al SII.
const CON_VOUCHER = [
  'tarjeta', 'credito', 'debito', 'prepago', 'redcompra',
  'webpay', 'onepay', 'mach', 'klap', 'chek', 'visa', 'mastercard', 'amex',
];

// ── Medios que NO dejan voucher: hay que emitir la BVE ────────────────
// Transferencia bancaria (incluido Khipu, que es transferencia por dentro)
// y los pagos en caja/efectivo. Servipag y Multicaja son caja: se recauda
// plata, no se pasa una tarjeta.
const SIN_VOUCHER = [
  'transferencia', 'transfer', 'khipu', 'efectivo', 'cash',
  'servipag', 'multicaja', 'caja vecina', 'cajavecina', 'deposito',
];

const contiene = (texto, agujas) => agujas.some((a) => texto.includes(a));

// ══════════════════════════════════════════════════════════════════════
// classifyTaxTreatment(estadoFlow)
//
// Recibe el estado ya leído de Flow (leerEstadoFlow) y devuelve el estado
// tributario del pago más el motivo, que se guarda para poder explicar
// después por qué se clasificó así.
// ══════════════════════════════════════════════════════════════════════
export function classifyTaxTreatment(estadoFlow) {
  // `= {}` como default de parámetro no cubre un `null` explícito —solo
  // `undefined`— y este es un dato que puede venir de fuera (una respuesta
  // de Flow incompleta, un evento viejo releído). El default en el cuerpo
  // sí cubre los dos casos.
  estadoFlow = estadoFlow || {};
  // Un pago que no está pagado no genera obligación tributaria todavía.
  if (!estadoFlow.pagado) {
    return { estado: TRIBUTARIO.MANUAL_REVIEW, motivo: 'El pago no está confirmado' };
  }

  const medio = normalizar(estadoFlow.medio);
  const tipo = normalizar(estadoFlow.medioTipo);
  const junto = `${medio} ${tipo}`.trim();

  if (!junto) {
    return {
      estado: TRIBUTARIO.MANUAL_REVIEW,
      motivo: 'Flow no informó el medio de pago',
    };
  }

  // El orden importa: "transferencia" se evalúa primero porque algunos
  // medios mezclan palabras (una glosa como "transferencia con tarjeta"
  // tiene que caer del lado seguro, el que sí emite boleta).
  if (contiene(junto, SIN_VOUCHER)) {
    return {
      estado: TRIBUTARIO.PENDING_BVE,
      motivo: `Medio sin voucher (${estadoFlow.medio || tipo}): corresponde emitir Boleta Electrónica`,
    };
  }

  if (contiene(junto, CON_VOUCHER)) {
    return {
      estado: TRIBUTARIO.NOT_REQUIRED_VOUCHER,
      motivo: `Pago electrónico con voucher (${estadoFlow.medio || tipo})`,
    };
  }

  return {
    estado: TRIBUTARIO.MANUAL_REVIEW,
    motivo: `Medio no reconocido: "${estadoFlow.medio || estadoFlow.medioTipo}"`,
  };
}

// ── Medios que no pasan por Flow ──────────────────────────────────────
// El panel los usa cuando César registra un pago a mano. Súper Compraquí
// deja voucher; transferencia directa a BancoEstado y efectivo, no (§19).
export const TRIBUTARIO_POR_MEDIO_MANUAL = {
  SUPER_COMPRAQUI: TRIBUTARIO.NOT_REQUIRED_VOUCHER,
  TRANSFERENCIA_BANCOESTADO: TRIBUTARIO.PENDING_BVE,
  EFECTIVO: TRIBUTARIO.PENDING_BVE,
};

export const ETIQUETA_MEDIO_MANUAL = {
  SUPER_COMPRAQUI: 'Súper Compraquí (presencial)',
  TRANSFERENCIA_BANCOESTADO: 'Transferencia a BancoEstado',
  EFECTIVO: 'Efectivo',
};
