// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/mi-celebracion?id=CSC-2026-000123&t=<token>
// El enlace privado y permanente de "Mi Celebración" (documento "FASE 2 —
// EXPERIENCIA CLIENTE END-TO-END", 21-sep-2026). Mismo candado que ya usa
// /api/pagos/flow/status (código+token, igualSeguro, rate limit) — este
// archivo no inventa un mecanismo de acceso nuevo, solo lo reutiliza fuera
// del contexto de "acabo de pagar".
//
// GET  → resumen de la reserva para la pantalla (armado en
//        lib/mi-celebracion.js, puro, probado sin base de datos) —
//        incluye Datos Finales vigentes y pendientes con proveedor
//        activos (documento "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026).
// POST → genera el link de pago del SALDO reutilizando exactamente el
//        mismo motor que ya usa César desde /cadena (montoQueCorresponde,
//        siguienteCommerceOrder, crearPagoPendiente, crearPagoFlow) — nunca
//        una reserva nueva, nunca otro motor de pago. Solo BALANCE: nunca
//        DEPOSIT ni EXTRA desde acá.
// ─────────────────────────────────────────────────────────────────────────────

import {
  reservaEstaFirme, festejadoDeReserva,
  crearPagoPendiente, marcarPagoEnCheckout, siguienteCommerceOrder, montoQueCorresponde,
} from '../../../lib/reservas';
import { resumenMiCelebracion } from '../../../lib/mi-celebracion';
import { reservaDesdeParams, leerIdYToken } from '../../../lib/mi-celebracion-auth';
import { datosFinalesVigentes } from '../../../lib/datos-finales';
import { pendientesDeReserva } from '../../../lib/pendientes-proveedor';
import { crearPagoFlow, flowConfigurado } from '../../../lib/flow';
import { NEGOCIO } from '../../../data/master';
import { dbConfigurada, esquemaListo } from '../../../lib/db';
import { json, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`mi-celebracion:${ipDe(req)}`, 30, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const { id, t } = leerIdYToken(Object.fromEntries(new URL(req.url).searchParams));
  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  const [datosFinales, pendientes] = await Promise.all([
    datosFinalesVigentes(reserva.id),
    pendientesDeReserva(reserva.id),
  ]);

  return json(resumenMiCelebracion(reserva, { datosFinales, pendientes }));
}

export async function POST(req) {
  if (!dbConfigurada() || !flowConfigurado() || !(await esquemaListo())) {
    return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);
  }

  if (demasiadasPeticiones(`mi-celebracion-pagar:${ipDe(req)}`, 6, 60_000)) {
    return json({ ok: false, motivo: 'demasiados_intentos' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);

  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  if (!reservaEstaFirme(reserva.estado)) {
    return json({ ok: false, motivo: 'reserva_no_confirmada' }, 400);
  }

  const monto = montoQueCorresponde(reserva, 'BALANCE');
  if (monto <= 0) return json({ ok: false, motivo: 'nada_por_cobrar' }, 400);

  const commerceOrder = await siguienteCommerceOrder(reserva.codigo, 'BALANCE');
  const pago = await crearPagoPendiente({
    reservaId: reserva.id, commerceOrder, tipo: 'BALANCE', monto,
  });

  try {
    const flow = await crearPagoFlow({
      commerceOrder,
      subject: `${NEGOCIO.venue} · Saldo ${festejadoDeReserva(reserva) || reserva.cliente_nombre} · ${reserva.codigo}`,
      amount: monto,
      email: reserva.cliente_email,
      optional: { reservationCode: reserva.codigo, paymentType: 'BALANCE' },
    });

    await marcarPagoEnCheckout({ pagoId: pago.id, flowOrder: flow.flowOrder, flowToken: flow.token });

    return json({ ok: true, checkoutUrl: flow.checkoutUrl, monto });

  } catch (err) {
    console.error(`[mi-celebracion] Flow falló para ${commerceOrder}: ${err.message}`);
    return json({ ok: false, motivo: 'error_flow' }, 502);
  }
}
