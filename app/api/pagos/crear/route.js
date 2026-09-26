// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/pagos/crear
// El papá terminó el armador y tocó "Reservar y pagar". Acá es donde la
// celebración deja de ser una simulación en el navegador y pasa a ser una
// reserva real:
//
//   1. recalcular el total en el servidor (nunca se confía en el que
//      manda el navegador — §22)
//   2. validar la configuración con las mismas reglas del armador
//   3. tomar el turno de forma atómica (§8) — esto es lo que impide la
//      doble reserva, no una consulta previa de disponibilidad
//   4. crear la reserva en Postgres
//   5. crear la orden de pago en Flow (el anticipo, tipo DEPOSIT)
//   6. devolver la URL de checkout
//
// Si el paso 5 falla, el turno se libera: no queda una reserva fantasma
// bloqueando un sábado que nadie va a pagar.
// ─────────────────────────────────────────────────────────────────────────────

import {
  crearReserva, crearPagoPendiente, marcarPagoEnCheckout,
  siguienteCommerceOrder, montoQueCorresponde, liberarTurno, MINUTOS_HOLD,
} from '../../../../lib/reservas';
import { crearPagoFlow, flowConfigurado } from '../../../../lib/flow';
import { dbConfigurada, esquemaListo } from '../../../../lib/db';
import {
  json, texto, EMAIL, normalizarTelefono, telefonoValido,
  demasiadasPeticiones, ipDe, cuerpoDe,
} from '../../../../lib/http';
import { NEGOCIO } from '../../../../data/master';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada() || !flowConfigurado()) {
    return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);
  }
  if (!(await esquemaListo())) {
    return json({ ok: false, motivo: 'esquema_no_listo' }, 503);
  }

  if (demasiadasPeticiones(`crear:${ipDe(req)}`, 8, 60_000)) {
    return json({ ok: false, motivo: 'demasiados_intentos' }, 429);
  }

  const body = await cuerpoDe(req);

  const nombre = texto(body?.cliente?.nombre, 120);
  // Solo para el subject que ve el papá en Flow (§4, "Nueva fase — experiencia
  // de marca…", 08-sep-2026): Alce Kids primero, festejado si lo escribió.
  // No sustituye ni valida nada — la reserva se crea igual con `configuracion`.
  const festejado = texto(body?.configuracion?.nombreNino, 60) || nombre;
  const email = texto(body?.cliente?.email, 160).toLowerCase();
  const telefono = normalizarTelefono(body?.cliente?.telefono);

  if (!nombre) return json({ ok: false, motivo: 'falta_nombre' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, motivo: 'email_invalido' }, 400);
  if (!telefonoValido(telefono)) return json({ ok: false, motivo: 'telefono_invalido' }, 400);

  const configuracion = body?.configuracion;
  if (!configuracion || typeof configuracion !== 'object') {
    return json({ ok: false, motivo: 'falta_configuracion' }, 400);
  }

  let resultado;
  try {
    resultado = await crearReserva({
      configuracion,
      cliente: { nombre, email, telefono },
      aceptaTyc: body?.aceptaTyc === true,
    });
  } catch (err) {
    console.error('[pagos/crear] Error al crear la reserva:', err.message);
    return json({ ok: false, motivo: 'error_servidor' }, 500);
  }

  if (!resultado.ok) {
    const status = resultado.motivo === 'turno_ocupado' ? 409
      : resultado.motivo === 'tyc_no_disponible' ? 503 : 400;
    return json(resultado, status);
  }

  const reserva = resultado.reserva;
  const monto = montoQueCorresponde(reserva, 'DEPOSIT');
  if (monto <= 0) {
    await liberarTurno(reserva.codigo);
    return json({ ok: false, motivo: 'monto_invalido' }, 400);
  }

  const commerceOrder = await siguienteCommerceOrder(reserva.codigo, 'DEPOSIT');
  const pago = await crearPagoPendiente({
    reservaId: reserva.id, commerceOrder, tipo: 'DEPOSIT', monto,
  });

  try {
    const flow = await crearPagoFlow({
      commerceOrder,
      subject: `${NEGOCIO.venue} · Anticipo ${festejado} · ${reserva.codigo}`,
      amount: monto,
      email,
      timeout: MINUTOS_HOLD * 60,
      optional: { reservationCode: reserva.codigo, paymentType: 'DEPOSIT' },
    });

    await marcarPagoEnCheckout({ pagoId: pago.id, flowOrder: flow.flowOrder, flowToken: flow.token });

    return json({
      ok: true,
      reservationCode: reserva.codigo,
      accessToken: reserva.acceso_token,
      checkoutUrl: flow.checkoutUrl,
      monto,
    });

  } catch (err) {
    // No se pudo abrir el checkout: se libera el turno para no dejarlo
    // bloqueado por una reserva que nunca va a poder pagarse (§24).
    console.error(`[pagos/crear] Flow falló para ${reserva.codigo}: ${err.message}`);
    await liberarTurno(reserva.codigo);
    return json({ ok: false, motivo: 'error_flow' }, 502);
  }
}
