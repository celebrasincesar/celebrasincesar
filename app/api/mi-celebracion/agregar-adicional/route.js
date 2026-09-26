// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/mi-celebracion/agregar-adicional
// Agregar un adicional compatible después de reservar (documento
// "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026, §8/§9). Reutiliza el
// catálogo existente, itemVisible() y el motor de cambio comercial — no
// es un segundo wizard, no es un segundo motor de precios.
//
// Si el ítem agregado es decoración temática, exige la misma temática y
// el mismo aviso que en la reserva inicial — nunca puede quedar sin
// definir por venir de un camino distinto (§9: "no puede existir un
// camino alternativo").
// ─────────────────────────────────────────────────────────────────────────────

import { reservaEstaFirme, configuracionVigente } from '../../../../lib/reservas';
import { reservaDesdeParams, leerIdYToken } from '../../../../lib/mi-celebracion-auth';
import { aplicarCambioComercial } from '../../../../lib/cambio-comercial';
import { IDS_DECORACION_TEMATICA } from '../../../../lib/pendientes-proveedor';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { getItem, itemVisible, contextoDesde, CATEGORIA_DE_ITEM } from '../../../../data/reglas';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`mi-celebracion-adicional:${ipDe(req)}`, 10, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);
  const itemId = texto(body?.itemId, 60);
  const tematicaPropuesta = body?.tematica ? texto(body.tematica, 80) : '';

  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  if (!reservaEstaFirme(reserva.estado)) {
    return json({ ok: false, motivo: 'reserva_no_confirmada' }, 400);
  }

  const item = getItem(itemId);
  if (!item) return json({ ok: false, motivo: 'item_no_existe' }, 400);

  const vigente = configuracionVigente(reserva);
  const config = vigente?.configuracion || {};
  const ctx = vigente?.ctx || contextoDesde(config);

  if (!itemVisible(item, ctx)) {
    return json({ ok: false, motivo: 'item_no_compatible' }, 400);
  }

  const extrasActuales = config.extras || [];

  // Idempotente: si ya estaba agregado, no se abre un cambio comercial
  // vacío por un doble clic.
  if (extrasActuales.some((e) => e.id === itemId)) {
    return json({ ok: true, sinCambios: true, totalDespues: reserva.total });
  }

  // Mismo comportamiento que el wizard (toggleItemModal): una categoría de
  // selección única reemplaza lo que ya hubiera de esa categoría en vez de
  // acumularlo — evita, por ejemplo, dos decoraciones a la vez.
  const categoria = CATEGORIA_DE_ITEM[itemId];
  const extrasSinReemplazo = categoria && categoria.seleccionMultiple === false
    ? extrasActuales.filter((e) => CATEGORIA_DE_ITEM[e.id]?.id !== categoria.id)
    : extrasActuales;

  const extrasNuevos = [...extrasSinReemplazo, item];

  // La temática es canónica dentro de la configuración (nunca en otra
  // parte, documento §2): si el ítem agregado es de decoración temática,
  // se usa la que llegó en esta petición; si no, se conserva la vigente —
  // salvo que ya no quede ningún ítem de temática en la lista final, caso
  // en que no corresponde conservar un valor huérfano.
  const quedaTematica = extrasNuevos.some((e) => IDS_DECORACION_TEMATICA.has(e.id));
  const tematica = !quedaTematica
    ? null
    : IDS_DECORACION_TEMATICA.has(itemId)
      ? tematicaPropuesta
      : (config.tematica || null);

  const resultado = await aplicarCambioComercial({
    reservaId: reserva.id,
    configuracionPropuesta: { extras: extrasNuevos, tematica },
    motivo: `adicional_agregado:${itemId}`,
  });

  if (!resultado.ok) return json(resultado, 400);

  // Mismo criterio que Datos Finales: el espejo se actualiza después de un
  // cambio comercial aplicado (documento "FASE 2B — IMPLEMENTAR BLOQUE 2",
  // 21-sep-2026, §12), nunca bloquea ni revierte el cambio si falla (§13).
  await sincronizarCalendario(reserva.id).catch(() => {});

  return json({
    ok: true,
    totalAntes: resultado.totalAntes,
    totalDespues: resultado.totalDespues,
    diferencia: resultado.diferencia,
  });
}
