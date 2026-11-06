// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/link-pago
// Protegido por el middleware de /cadena (misma sesión que el panel).
//
// César genera desde el panel un link de pago para una reserva que ya
// existe: el saldo (72 horas antes, §18), un adicional de última hora, o
// —si hace falta reintentar— el anticipo de nuevo. Copia el link y lo
// manda por WhatsApp (§17).
//
// El monto NUNCA lo escribe libremente para DEPOSIT/BALANCE: sale de la
// reserva (montoQueCorresponde). Solo en EXTRA se acepta un monto —es la
// única situación de la especificación donde el cobro no está prefijado
// por el armador (§4, §17).
// ─────────────────────────────────────────────────────────────────────────────

import {
  reservaPorCodigo, crearPagoPendiente, marcarPagoEnCheckout,
  siguienteCommerceOrder, montoQueCorresponde, festejadoDeReserva,
  retenerTurnoParaAnticipo, liberarTurno,
} from '../../../../lib/reservas';
import { crearPagoFlow, flowConfigurado } from '../../../../lib/flow';
import { dbConfigurada, esquemaListo } from '../../../../lib/db';
import { json, texto, CODIGO_RESERVA, cuerpoDe } from '../../../../lib/http';
import { NEGOCIO } from '../../../../data/master';

export const dynamic = 'force-dynamic';

const TIPOS = ['DEPOSIT', 'BALANCE', 'EXTRA'];
const TITULO = { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', EXTRA: 'Adicional' };

export async function POST(req) {
  if (!dbConfigurada() || !flowConfigurado() || !(await esquemaListo())) {
    return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);
  }

  const body = await cuerpoDe(req);
  const codigo = texto(body?.reservationCode, 40).toUpperCase();
  const tipo = texto(body?.tipo, 20).toUpperCase();

  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);
  if (!TIPOS.includes(tipo)) return json({ ok: false, motivo: 'tipo_invalido' }, 400);

  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return json({ ok: false, motivo: 'reserva_no_encontrada' }, 404);

  const monto = montoQueCorresponde(reserva, tipo, body?.monto);
  if (monto <= 0) {
    return json({ ok: false, motivo: tipo === 'EXTRA' ? 'monto_invalido' : 'nada_por_cobrar' }, 400);
  }

  const minutos = 60 * 24; // un link para mandar por WhatsApp vive más que el checkout en vivo

  // Anticipo de una reserva que perdió su HOLD (EXPIRED, o nunca pagada):
  // se vuelve a retener el turno por lo mismo que dura el link. Si otra
  // familia ya lo tomó, no se genera un link que terminaría en conflicto.
  let retencion = { aplica: false };
  if (tipo === 'DEPOSIT') {
    retencion = await retenerTurnoParaAnticipo({ reservaId: reserva.id, minutos });
    if (!retencion.tomado) return json({ ok: false, motivo: 'turno_ocupado' }, 409);
  }

  const commerceOrder = await siguienteCommerceOrder(codigo, tipo);
  const pago = await crearPagoPendiente({ reservaId: reserva.id, commerceOrder, tipo, monto, minutos });

  try {
    const flow = await crearPagoFlow({
      commerceOrder,
      subject: `${NEGOCIO.venue} · ${TITULO[tipo]} ${festejadoDeReserva(reserva) || reserva.cliente_nombre} · ${codigo}`,
      amount: monto,
      email: reserva.cliente_email,
      optional: { reservationCode: codigo, paymentType: tipo },
    });

    await marcarPagoEnCheckout({ pagoId: pago.id, flowOrder: flow.flowOrder, flowToken: flow.token });

    return json({ ok: true, checkoutUrl: flow.checkoutUrl, commerceOrder, monto });

  } catch (err) {
    console.error(`[cadena/link-pago] Flow falló para ${commerceOrder}: ${err.message}`);
    if (retencion.aplica) await liberarTurno(codigo);
    return json({ ok: false, motivo: 'error_flow' }, 502);
  }
}
