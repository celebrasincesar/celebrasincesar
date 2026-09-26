// ══════════════════════════════════════════════════════════════════════
// PROCESAR UN PAGO DE FLOW  ·  lib/pagos-flow.js
// ──────────────────────────────────────────────────────────────────────
// Cuatro caminos distintos terminan preguntándose lo mismo —"¿este pago
// se hizo o no?"— y tienen que responderlo IGUAL:
//
//   · el webhook de Flow (urlConfirmation)
//   · el retorno del navegador (urlReturn)
//   · el sondeo del frontend mientras espera
//   · la reverificación manual desde el panel
//
// Si cada uno tuviera su propia lógica, tarde o temprano dos de ellos
// discreparían sobre una reserva pagada. Así que la lógica está una sola
// vez, acá, y es idempotente: llamarla cuatro veces para el mismo pago
// deja exactamente el mismo resultado que llamarla una (§13, §15).
//
// La regla de oro: el token viene del navegador o del webhook, pero el
// ESTADO se le pregunta a Flow servidor a servidor. Nada de lo que llegue
// en la petición se toma como prueba de que hay plata (§1.11, §30).
// ══════════════════════════════════════════════════════════════════════

import { estadoPagoFlow, leerEstadoFlow } from './flow';
import {
  acreditarPago, marcarPagoFallido, marcarEnVerificacion, clasificarSinFallar,
  pagoPorToken, registrarEvento, liberarTurno, PAGO,
} from './reservas';
import { q1 } from './db';
import { sincronizarCalendario } from './calendario';
import { notificarAdminPago, notificarClientePago } from './notificaciones';
import { enviarEmailContractual } from './email-contractual';

// ══════════════════════════════════════════════════════════════════════
// procesarToken(token)
//
// Devuelve { ok, resultado, reserva, pago } donde `resultado` es uno de:
//   'acreditado'    → primera vez que se confirma: se hicieron las
//                      acciones secundarias (calendario)
//   'ya_acreditado' → estaba pagado: no se repitió nada
//   'pendiente'     → medio asíncrono en curso
//   'rechazado'     → Flow lo rechazó o se anuló
//   'desconocido'   → no se pudo leer el estado; NO se asume rechazo
// ══════════════════════════════════════════════════════════════════════
export async function procesarToken(token) {
  if (!token || typeof token !== 'string' || token.length > 200) {
    return { ok: false, motivo: 'token_invalido' };
  }

  const pago = await pagoPorToken(token);
  if (!pago) {
    // Un token que no reconocemos no se procesa, pero se deja anotado:
    // si esto aparece en los logs, algo se creó fuera de este flujo.
    console.error('[flow] Token desconocido recibido en confirmación');
    return { ok: false, motivo: 'pago_desconocido' };
  }

  let crudo;
  try {
    crudo = await estadoPagoFlow(token);
  } catch (err) {
    // Flow no contestó. NO es un rechazo: se deja en verificación y se
    // vuelve a preguntar después (§24).
    console.error(`[flow] getStatus falló para ${pago.commerce_order}: ${err.message}`);
    await marcarEnVerificacion({ pagoId: pago.id, reservaId: pago.reserva_id });
    return { ok: false, motivo: 'flow_sin_respuesta', pago, resultado: 'desconocido' };
  }

  const estado = leerEstadoFlow(crudo);

  // ── Verificaciones antes de acreditar (§13.4) ───────────────────────
  // Que Flow diga "pagada" no basta: tiene que ser ESTA orden y por ESTE
  // monto. Si no calza, no se acredita solo: queda para revisión.
  if (estado.commerceOrder && estado.commerceOrder !== pago.commerce_order) {
    await registrarEvento({
      pagoId: pago.id, reservaId: pago.reserva_id, tipo: 'CONFLICTO_REFERENCIA',
      referencia: estado.commerceOrder,
      detalle: { esperado: pago.commerce_order, recibido: estado.commerceOrder },
    });
    return { ok: false, motivo: 'referencia_no_calza', pago, resultado: 'desconocido' };
  }

  if (estado.pagado && estado.monto != null && estado.monto !== pago.monto) {
    await registrarEvento({
      pagoId: pago.id, reservaId: pago.reserva_id, tipo: 'CONFLICTO_MONTO',
      referencia: estado.flowOrder,
      detalle: { esperado: pago.monto, informado: estado.monto },
    });
    return { ok: false, motivo: 'monto_no_calza', pago, resultado: 'desconocido' };
  }

  // ── Pagado ──────────────────────────────────────────────────────────
  if (estado.pagado) {
    const tributario = clasificarSinFallar(estado);
    const { nuevos, conflictoTurno } = await acreditarPago({
      pagoId: pago.id, estadoFlow: estado, tributario,
    });

    if (nuevos > 0 && !conflictoTurno) {
      // Acciones secundarias: si fallan, el pago sigue acreditado (§13).
      await sincronizarCalendario(pago.reserva_id).catch(() => {});
      await notificarAdminPago(pago.id).catch(() => {});
      await notificarClientePago(pago.id).catch(() => {});
      await enviarEmailContractual(pago.reserva_id).catch(() => {});
    }

    // Se relee siempre la fila completa: el CTE de acreditarPago solo
    // devuelve las columnas que necesita para decidir el estado, y quien
    // llama (la página de resultado, el panel) necesita el registro entero
    // —incluido el token de acceso— sin tener que saber esa diferencia.
    return {
      ok: true,
      resultado: nuevos > 0 ? 'acreditado' : 'ya_acreditado',
      conflictoTurno,
      pago,
      reserva: await reservaDePago(pago.reserva_id),
      tributario,
    };
  }

  // ── Pendiente: medio asíncrono todavía en curso ─────────────────────
  if (estado.pendiente) {
    if (pago.estado !== PAGO.PAID) {
      await marcarEnVerificacion({ pagoId: pago.id, reservaId: pago.reserva_id });
    }
    return { ok: true, resultado: 'pendiente', pago, reserva: await reservaDePago(pago.reserva_id) };
  }

  // ── Rechazado o anulado ─────────────────────────────────────────────
  // No hay flujo de "reintentar esta misma reserva": el papá que reintenta
  // vuelve a /armar y genera una reserva nueva. Dejar el HOLD vivo hasta
  // que expire solo (15 min) no ayuda a nadie a retomar el intento y sí
  // bloquea el turno sin necesidad — por eso se libera de inmediato, igual
  // que cuando falla la creación del pago en Flow (§24).
  if (estado.rechazado) {
    const pagoActualizado = await marcarPagoFallido({ pagoId: pago.id, estadoFlow: estado });
    const reserva = await reservaDePago(pago.reserva_id);
    if (reserva?.codigo) await liberarTurno(reserva.codigo).catch(() => {});
    return { ok: true, resultado: 'rechazado', pago: pagoActualizado || pago, reserva };
  }

  return { ok: false, motivo: 'estado_no_reconocido', pago, resultado: 'desconocido' };
}

async function reservaDePago(reservaId) {
  return q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
}
