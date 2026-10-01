// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/cambio-comercial
// Protegido por el middleware de /cadena. César modifica los adicionales
// de una reserva YA confirmada cuando el papá le pide agregar o cambiar
// algo por teléfono/WhatsApp en vez de hacerlo él mismo desde Mi
// Celebración (hallazgo real 30-sep-2026).
//
// Reutiliza EXACTAMENTE el mismo motor que /api/mi-celebracion/agregar-
// adicional: aplicarCambioComercial() (lib/cambio-comercial.js). No es un
// segundo camino con reglas propias — la única diferencia es quién manda
// la lista final de extras (el papá agrega uno a la vez; César manda acá
// la lista completa deseada, porque también puede quitar algo, cosa que
// el papá nunca puede hacer solo).
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo, configuracionVigente } from '../../../../lib/reservas';
import { aplicarCambioComercial } from '../../../../lib/cambio-comercial';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { IDS_DECORACION_TEMATICA } from '../../../../lib/pendientes-proveedor';
import { getItem, itemVisible, contextoDesde, CATEGORIA_DE_ITEM } from '../../../../data/reglas';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, CODIGO_RESERVA, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const codigo = texto(body?.reservationCode, 40).toUpperCase();
  const idsCrudos = Array.isArray(body?.extras) ? body.extras : null;
  const tematicaPropuesta = body?.tematica ? texto(body.tematica, 80) : '';

  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);
  if (!idsCrudos) return json({ ok: false, motivo: 'extras_invalidos' }, 400);

  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return json({ ok: false, motivo: 'reserva_no_encontrada' }, 404);

  const vigente = configuracionVigente(reserva);

  // Candado real: una reserva manual (+ Crear reserva manual) guarda un
  // total NEGOCIADO por César, fuera del motor de precios, y su snapshot
  // no tiene `.configuracion` anidada (ni fecha/hora adentro). Si se
  // dejara pasar, aplicarCambioComercial() recalcularía un total nuevo con
  // la tabla de precios vigente y pisaría en silencio el precio acordado.
  // Nunca se confía solo en que la pantalla no muestre el botón — se
  // rechaza acá también.
  if (!vigente?.configuracion) {
    return json({ ok: false, motivo: 'reserva_manual_no_editable' }, 400);
  }

  const config = vigente.configuracion;
  const ctx = vigente.ctx || contextoDesde(config);

  // Resuelve cada id contra el catálogo vigente y valida compatibilidad —
  // misma regla que ya usa el papá desde Mi Celebración (itemVisible):
  // nunca se deja una configuración que el armador jamás hubiera permitido
  // armar. Selección única por categoría (temática, sector de packs, etc.)
  // se colapsa quedándose con el último de cada categoría, igual que hace
  // el armador al tocar otro de la misma categoría.
  const porCategoria = new Map();
  const libres = [];
  for (const id of idsCrudos) {
    const itemId = texto(id, 60);
    const item = getItem(itemId);
    if (!item) return json({ ok: false, motivo: 'item_no_existe', item: itemId }, 400);
    if (!itemVisible(item, ctx)) return json({ ok: false, motivo: 'item_no_compatible', item: itemId }, 400);

    const categoria = CATEGORIA_DE_ITEM[itemId];
    if (categoria && categoria.seleccionMultiple === false) porCategoria.set(categoria.id, item);
    else libres.push(item);
  }
  const extrasFinales = [...libres, ...porCategoria.values()];

  const quedaTematica = extrasFinales.some((e) => IDS_DECORACION_TEMATICA.has(e.id));
  const tematicaFinal = !quedaTematica ? null : (tematicaPropuesta || config.tematica || null);
  if (quedaTematica && !tematicaFinal) {
    return json({ ok: false, motivo: 'falta_tematica' }, 400);
  }

  const resultado = await aplicarCambioComercial({
    reservaId: reserva.id,
    configuracionPropuesta: { extras: extrasFinales, tematica: tematicaFinal },
    motivo: 'editado_desde_cadena',
  });
  if (!resultado.ok) return json(resultado, 400);

  // Mismo criterio best-effort que el resto del proyecto: si falla el
  // Calendar, el cambio comercial YA quedó escrito — nunca se revierte.
  await sincronizarCalendario(reserva.id).catch((err) =>
    console.error('[cadena/cambio-comercial] Calendar falló:', err.message));

  return json({
    ok: true,
    totalAntes: resultado.totalAntes,
    totalDespues: resultado.totalDespues,
    diferencia: resultado.diferencia,
  });
}
