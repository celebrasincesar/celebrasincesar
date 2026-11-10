// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/mi-celebracion/adicionales?id=CSC-2026-000123&t=<token>
// El catálogo de adicionales de UNA reserva (pedido de César, 10-nov-2026):
// César manda el link por WhatsApp y la familia agrega desde el catálogo.
// Mismo candado código+token que Mi Celebración (lib/mi-celebracion-auth).
//
// GET  → lo que la pantalla necesita para filtrar el catálogo: contexto de
//        la celebración (edades, niños), tramo de precios y lo ya contratado.
// POST → { pedido: [{ id, sabores? }], tematica?, confirmar }
//        confirmar=false: simula y devuelve el valor exacto, sin escribir.
//        confirmar=true:  aplica, sincroniza calendario y manda los correos
//        (lib/adicionales-reserva.js).
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo, festejadoDeReserva, fechaISO, estadoSaldo } from '../../../../lib/reservas';
import { reservaDesdeParams, leerIdYToken } from '../../../../lib/mi-celebracion-auth';
import { contextoAdicionales, procesarAdicionales, precioDeItem } from '../../../../lib/adicionales-reserva';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

function vista(reserva) {
  const base = contextoAdicionales(reserva);
  const saldo = estadoSaldo(reserva).pendiente;
  return {
    ok: true,
    codigo: reserva.codigo,
    festejado: festejadoDeReserva(reserva) || reserva.cliente_nombre,
    nombre: (reserva.cliente_nombre || '').split(' ')[0] || reserva.cliente_nombre,
    fecha: reserva.fecha_evento ? fechaISO(reserva.fecha_evento) : null,
    turno: reserva.turno,
    horaInicio: reserva.hora_inicio,
    horaTermino: reserva.hora_termino,
    total: reserva.total,
    pagado: reserva.pagado,
    saldo,
    puede: base.puede,
    motivo: base.puede ? null : base.motivo,
    ...(base.puede ? {
      ctx: base.ctx,
      cantNinos: base.cantNinos,
      tematica: base.config.tematica || null,
      contratados: base.extras.map((e) => ({
        id: e.id, nombre: e.nombre, emoji: e.emoji || null, gratis: e.gratis === true, precio: precioDeItem(e, base.cantNinos),
      })),
    } : {}),
  };
}

export async function GET(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);
  if (demasiadasPeticiones(`mi-celebracion-catalogo:${ipDe(req)}`, 30, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }
  const { id, t } = leerIdYToken(Object.fromEntries(new URL(req.url).searchParams));
  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);
  return json(vista(reserva));
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);
  if (demasiadasPeticiones(`mi-celebracion-catalogo-post:${ipDe(req)}`, 20, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);
  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  const pedido = Array.isArray(body?.pedido)
    ? body.pedido.map((p) => ({ id: texto(p?.id, 60), ...(p?.sabores && typeof p.sabores === 'object' ? { sabores: p.sabores } : {}) }))
    : null;
  const tematica = body?.tematica ? texto(body.tematica, 80) : '';
  const confirmar = body?.confirmar === true;

  const resultado = await procesarAdicionales(reserva, { pedido, tematica, confirmar });
  if (!resultado.ok) return json(resultado, 400);

  // Tras confirmar se devuelve la reserva fresca para que la pantalla
  // muestre el total y el saldo reales.
  if (confirmar && !resultado.sinCambios) {
    const fresca = await reservaPorCodigo(reserva.codigo);
    return json({ ...resultado, reserva: vista(fresca) });
  }
  return json(resultado);
}
