// ══════════════════════════════════════════════════════════════════════
// ADICIONALES DESDE EL CATÁLOGO DE LA FAMILIA  ·  lib/adicionales-reserva.js
// ──────────────────────────────────────────────────────────────────────
// Pedido de César (10-nov-2026): un link que él manda por WhatsApp abre el
// catálogo completo (fotos, fichas, precios) ya filtrado para ESA
// celebración; la familia elige uno o varios adicionales, ve el valor
// exacto antes de confirmar y, al confirmar, se actualiza todo: la
// reserva, el calendario, el panel y llega un correo a la familia y otro
// a César.
//
// No es un segundo motor: la propuesta se arma con las mismas reglas del
// armador (itemVisible, selección única por categoría, packs) y el total
// lo calcula aplicarCambioComercial() — el mismo camino de "agregar un
// adicional" de Mi Celebración, solo que con varios ítems a la vez y con
// una simulación previa sin escribir nada.
//
// Reservas manuales (cotización previa al sistema) quedan fuera: no tienen
// edad ni tramo estructurados para validar compatibilidad, y su total lo
// negoció César — esas se ven por WhatsApp.
// ══════════════════════════════════════════════════════════════════════

import { reservaEstaFirme, configuracionVigente, fechaISO, registrarEvento } from './reservas';
import { aplicarCambioComercial } from './cambio-comercial';
import { IDS_DECORACION_TEMATICA } from './pendientes-proveedor';
import { sincronizarCalendario } from './calendario';
import { enviarAvisosAdicionales } from './aviso-adicionales';
import {
  getItem, itemVisible, contextoDesde, CATEGORIA_DE_ITEM, packQueIncluye, sumarAdicional, materializarExtra,
} from '../data/reglas';

export const TIPO_ADICIONALES_AGREGADOS = 'ADICIONALES_AGREGADOS';
const MAX_ITEMS_PEDIDO = 20;

const hoySantiago = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

export const precioDeItem = (item, cantNinos) => {
  if (!item || item.gratis === true) return 0;
  return item.precios?.[cantNinos] ?? item.precios?.hasta10 ?? item.precio ?? 0;
};

// ¿Se le puede ofrecer el catálogo a esta reserva? Devuelve además lo que
// la pantalla necesita para filtrar (ctx, tramo de precios, lo contratado).
export function contextoAdicionales(reserva) {
  const vigente = configuracionVigente(reserva);
  const config = vigente?.configuracion || null;
  if (!reservaEstaFirme(reserva.estado)) return { puede: false, motivo: 'reserva_no_confirmada' };
  if (!config) return { puede: false, motivo: 'reserva_manual' };
  const fecha = reserva.fecha_evento ? fechaISO(reserva.fecha_evento) : null;
  // El mismo día ya no se alcanza a preparar nada: eso va por WhatsApp.
  if (!fecha || fecha <= hoySantiago()) return { puede: false, motivo: 'celebracion_cerrada' };
  const ctx = vigente.ctx || contextoDesde(config);
  return {
    puede: true,
    config,
    ctx,
    cantNinos: config.cantNinos || 'hasta10',
    extras: config.extras || [],
  };
}

// Pura: lista pedida por la familia → extras propuestos + qué se agrega y
// qué se reemplaza (decoración: una sola; packs: absorben sus sueltos).
export function armarPropuesta({ config, ctx, cantNinos, extras }, pedido, tematicaPedida = '') {
  if (!Array.isArray(pedido) || pedido.length === 0) return { ok: false, motivo: 'pedido_vacio' };
  if (pedido.length > MAX_ITEMS_PEDIDO) return { ok: false, motivo: 'pedido_muy_grande' };

  const contratados = new Map(extras.map((e) => [e.id, e]));
  let propuestos = [...extras];
  const vistos = new Set();

  for (const crudo of pedido) {
    const id = String(crudo?.id ?? crudo ?? '').trim().slice(0, 60);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const item = getItem(id);
    if (!item || item.activo === false) return { ok: false, motivo: 'item_no_existe', item: id };
    // Lo ya contratado no se vuelve a sumar (doble clic, link reabierto).
    if (contratados.has(id) || packQueIncluye(propuestos, id)) continue;

    if (item.comida) {
      const pedidoComida = materializarExtra({ id, sabores: crudo?.sabores });
      if (!pedidoComida) return { ok: false, motivo: 'comida_sin_unidades', item: id };
      propuestos.push(pedidoComida);
      continue;
    }

    if (!itemVisible(item, ctx)) return { ok: false, motivo: 'item_no_compatible', item: id };
    const categoria = CATEGORIA_DE_ITEM[id];
    if (categoria && categoria.seleccionMultiple === false) {
      propuestos = propuestos.filter((e) => CATEGORIA_DE_ITEM[e.id]?.id !== categoria.id);
    }
    propuestos = sumarAdicional(propuestos, item);
  }

  const idsFinales = new Set(propuestos.map((e) => e.id));
  const agregados = propuestos
    .filter((e) => !contratados.has(e.id))
    .map((e) => ({ id: e.id, nombre: e.nombre, emoji: e.emoji || null, precio: precioDeItem(e, cantNinos) }));
  const reemplazados = extras
    .filter((e) => !idsFinales.has(e.id))
    .map((e) => ({ id: e.id, nombre: e.nombre }));

  const quedaTematica = propuestos.some((e) => IDS_DECORACION_TEMATICA.has(e.id));
  const agregaTematica = agregados.some((e) => IDS_DECORACION_TEMATICA.has(e.id));
  const tematica = !quedaTematica ? null
    : agregaTematica ? String(tematicaPedida || '').trim().slice(0, 80)
      : (config.tematica || null);

  return { ok: true, extras: propuestos, agregados, reemplazados, requiereTematica: agregaTematica, tematica };
}

// Simula (confirmar = false) o aplica (confirmar = true) el pedido.
export async function procesarAdicionales(reserva, { pedido, tematica = '', confirmar = false }) {
  const base = contextoAdicionales(reserva);
  if (!base.puede) return { ok: false, motivo: base.motivo };

  const prop = armarPropuesta(base, pedido, tematica);
  if (!prop.ok) return prop;
  if (prop.agregados.length === 0) return { ok: true, sinCambios: true, totalAntes: reserva.total, totalDespues: reserva.total, diferencia: 0 };
  if (confirmar && prop.requiereTematica && !prop.tematica) return { ok: false, motivo: 'falta_tematica' };

  const resultado = await aplicarCambioComercial({
    reservaId: reserva.id,
    // En la simulación la temática todavía puede no estar escrita: el
    // valor no depende de ella, solo la validación.
    configuracionPropuesta: { extras: prop.extras, tematica: prop.tematica || (confirmar ? null : 'por definir') },
    motivo: `adicionales_familia:${prop.agregados.map((a) => a.id).join(',')}`.slice(0, 200),
    soloSimular: !confirmar,
  });
  if (!resultado.ok) return resultado;

  // Si al recalcular algo dejó de calzar, se le dice antes de confirmar.
  const avisos = resultado.estado?.cambios || [];
  const respuesta = {
    ok: true,
    agregados: prop.agregados,
    reemplazados: prop.reemplazados,
    requiereTematica: prop.requiereTematica,
    avisos,
    totalAntes: resultado.totalAntes,
    totalDespues: resultado.totalDespues,
    diferencia: resultado.diferencia,
    pagado: reserva.pagado,
    saldoDespues: Math.max(0, resultado.totalDespues - reserva.pagado),
  };
  if (!confirmar) return respuesta;

  const referencia = `cambio:${resultado.cambioId}`;
  const detalle = {
    agregados: prop.agregados, reemplazados: prop.reemplazados, tematica: prop.requiereTematica ? prop.tematica : null,
    totalAntes: resultado.totalAntes, totalDespues: resultado.totalDespues, diferencia: resultado.diferencia,
  };
  await registrarEvento({ reservaId: reserva.id, tipo: TIPO_ADICIONALES_AGREGADOS, referencia, detalle });

  // Acciones secundarias: un fallo acá nunca revierte lo ya aplicado. Los
  // correos que no salgan los reintenta el cron diario del ciclo previo.
  await sincronizarCalendario(reserva.id).catch(() => {});
  await enviarAvisosAdicionales({ reservaId: reserva.id, referencia, detalle }).catch((err) => {
    console.error(`[adicionales] correos de ${reserva.codigo}: ${err.message}`);
  });

  return respuesta;
}
