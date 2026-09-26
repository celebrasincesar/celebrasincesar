// ══════════════════════════════════════════════════════════════════════
// MOTOR DE PRECIOS  ·  data/precios.js
// ──────────────────────────────────────────────────────────────────────
// Hasta ahora el total de una celebración se calculaba DENTRO del armador
// (app/armar/wizard.js). Servía mientras la web solo mandaba un WhatsApp:
// el número lo leía César y lo revisaba con la tabla en la mano.
//
// Con pagos por la web ese número deja de ser informativo y pasa a ser
// PLATA. Y un total que solo existe en el navegador es un total que el
// navegador puede editar: quien abra las herramientas de desarrollo podría
// pedir un checkout de $1.000 por una celebración de $650.000.
//
// Por eso el cálculo vive acá: es JavaScript puro —sin React, sin `window`—
// y lo importan LOS DOS lados. El armador para mostrar, el servidor para
// cobrar. La cifra que se le cobra al papá la recalcula siempre el servidor
// desde la configuración; nunca la recibe del cliente (§22 de la
// especificación de pagos).
//
// No hay ni un monto escrito a mano en este archivo: todo sale de
// data/master.js, igual que antes. `scripts/qa-precios.mjs` sigue siendo la
// auditoría de las cifras y `scripts/qa-cotizacion.mjs` la de la forma.
// ══════════════════════════════════════════════════════════════════════

import {
  PRECIOS_BASE, PRECIOS_EXTRAS, MULTIPLICADORES, CATEGORIAS_ADICIONALES, NEGOCIO,
} from './master';
import { contextoDesde, valorMayores, getItem } from './reglas';

// ── Precio de un adicional según el tramo de niños ────────────────────
// Los ítems con `precios` cobran por tramo (animación); el resto es plano.
export const getPrecio = (item, cantNinos) => {
  if (!item) return 0;
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};

// ── Incrementos del arriendo: edad del festejado + cantidad de niños ──
export const getAddEdad = (edadNino) => {
  if (!edadNino) return 0;
  const e = Number(edadNino);
  for (const r of MULTIPLICADORES.edad) if (r.edades.includes(e)) return r.add;
  return 0;
};

export const getAddCantidad = (cantNinos) => {
  const r = MULTIPLICADORES.cantidad.find((c) => c.id === cantNinos);
  return r ? r.add : 0;
};

// precio_final = base + add_edad + add_cantidad (solo si hay base válida)
export const aplicarMult = (base, edadNino, cantNinos) =>
  base === 0 ? 0 : base + getAddEdad(edadNino) + getAddCantidad(cantNinos);

// Recargo total del cumpleaños compartido según nº de festejados (1/2/3)
export const recargoFestejados = (n) => PRECIOS_EXTRAS.festejados_recargo?.[n] ?? 0;

// ── Descuento por código de promoción ─────────────────────────────────
export const ITEMS_POR_CATEGORIA = Object.fromEntries(
  CATEGORIAS_ADICIONALES.map((c) => [c.id, new Set(c.items.map((i) => i.id))])
);

// porcentaje_item → % sobre el ítem elegible de MAYOR valor (el que más le
// conviene al papá). Devuelve { monto, itemNombre, faltaItem }.
export function calcularDescuento(promo, extras, cantNinos) {
  if (!promo) return { monto: 0, itemNombre: null, faltaItem: false };
  if (promo.tipo === 'porcentaje_item') {
    const ids = ITEMS_POR_CATEGORIA[promo.categoria] || new Set();
    const elegibles = (extras || []).filter((e) => e && ids.has(e.id) && !e.gratis);
    if (elegibles.length === 0) return { monto: 0, itemNombre: null, faltaItem: true };
    const mejor = elegibles.reduce((a, b) => (getPrecio(b, cantNinos) > getPrecio(a, cantNinos) ? b : a));
    const monto = Math.round((getPrecio(mejor, cantNinos) * promo.valor) / 100);
    return { monto, itemNombre: mejor.nombre, faltaItem: false };
  }
  return { monto: 0, itemNombre: null, faltaItem: false };
}

// ── Base del arriendo según sector, día y tramo ───────────────────────
// El sábado tiene su propia base. La diferencia entre tramos de niños la
// aplica add_cantidad, por eso completo_10 = completo_20 = completo_30.
export function baseArriendo({ sector, cantNinos, sabado }) {
  if (sector === 'independiente') {
    return sabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente;
  }
  if (cantNinos === 'hasta10' && sector === 'completo') {
    return sabado ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10;
  }
  if (cantNinos === 'hasta20') {
    return sabado ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20;
  }
  if (cantNinos === 'hasta30' || cantNinos === 'mas30') {
    return sabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30;
  }
  return 0;
}

// ¿Cae sábado? Acepta Date (armador) o "YYYY-MM-DD" (servidor).
// El string se lee a mediodía para que ningún desfase de zona horaria
// corra la fecha un día y con ella el precio.
export function esSabado(fecha) {
  if (!fecha) return false;
  const d = fecha instanceof Date ? fecha : new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 6;
}

// ══════════════════════════════════════════════════════════════════════
// TOTAL DE UNA CELEBRACIÓN
//
// Recibe el estado del armador (ya pasado por normalizarConfiguracion) y
// devuelve el desglose completo. `extras` puede venir como objetos-ítem
// (armador) o como IDs (snapshot guardado): se resuelven con getItem().
//
// El desglose no es decorativo: es lo que muestra el panel y lo que permite
// explicarle a un papá —o al SII— de dónde salió cada peso.
// ══════════════════════════════════════════════════════════════════════
export function calcularTotal(estado = {}, promo = null) {
  const ctx = contextoDesde(estado);
  const cantNinos = estado.cantNinos || ctx.cantNinos;
  const sabado = esSabado(estado.fecha);

  // Los extras se normalizan a ítems del catálogo. Un ID que ya no existe
  // se descarta: no se cobra algo que la web no puede entregar.
  const extras = (estado.extras || [])
    .map((e) => (typeof e === 'string' ? getItem(e) : (getItem(e?.id) || e)))
    .filter(Boolean);

  const lineas = [];
  const sumar = (concepto, monto) => {
    if (monto > 0) lineas.push({ concepto, monto });
    return monto;
  };

  let total = 0;

  total += sumar(
    `Arriendo ${estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo'}`,
    aplicarMult(baseArriendo({ sector: estado.sector, cantNinos, sabado }), estado.edadNino, cantNinos)
  );

  total += sumar('Cumpleaños compartido', recargoFestejados(estado.festejados));

  if (estado.packCelebra) total += sumar('Pack Celebra Sin Cesar', PRECIOS_EXTRAS.pack_celebra);

  for (const e of extras) {
    const monto = getPrecio(e, cantNinos);
    if (monto > 0) total += sumar(e.nombre || e.id, monto);
  }

  if (estado.usaCocina) total += sumar('Aseo profundo', PRECIOS_EXTRAS.aseo_profundo);

  // Horas adicionales: se contratan al elegir el horario, no se consultan.
  const horas = Number(estado.horasAdicionales) || 0;
  if (horas > 0) {
    total += sumar(
      `${horas} hora${horas > 1 ? 's' : ''} adicional${horas > 1 ? 'es' : ''}`,
      horas * PRECIOS_EXTRAS.hora_adicional
    );
  }

  if (cantNinos === 'mas30') {
    const sobre30 = Number(estado.ninosExtra) || 0;
    if (sobre30 > 0) {
      total += sumar(`${sobre30} niño${sobre30 > 1 ? 's' : ''} sobre 30`, sobre30 * PRECIOS_EXTRAS.nino_extra);
    }
  }

  // Sumar hermanos mayores tiene un valor cerrado por tramo. Su entretención
  // ya viene contada arriba, como cualquier otro adicional.
  total += sumar('Niños mayores de 6', valorMayores(ctx));

  const bruto = total;
  const descuento = calcularDescuento(promo, extras, cantNinos);
  const neto = Math.max(0, bruto - descuento.monto);

  // Anticipo del 50%: se redondea el anticipo y el saldo sale por resta, así
  // anticipo + saldo == total SIEMPRE, sin un peso perdido en el camino.
  const anticipo = Math.round((neto * NEGOCIO.anticipoPorcentaje) / 100);

  return {
    bruto,
    descuento: descuento.monto,
    descuentoItem: descuento.itemNombre,
    total: neto,
    anticipo,
    saldo: neto - anticipo,
    lineas,
    cantNinos,
    esSabado: sabado,
  };
}
