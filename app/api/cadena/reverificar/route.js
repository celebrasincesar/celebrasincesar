// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/reverificar
// Acción "Reverificar estado Flow" del panel (§25). César la usa cuando un
// papá dice "ya pagué" y el pago sigue en PENDING: en vez de esperar al
// webhook, se le vuelve a preguntar a Flow ahora mismo.
//
// Busca por lo que César tenga a mano: el token de Flow, el commerceOrder,
// o el flowOrder. Con cualquiera de los tres se llega al mismo camino
// (procesarToken), que es idempotente — reverificar un pago ya acreditado
// no hace nada nuevo, solo confirma que sigue acreditado.
// ─────────────────────────────────────────────────────────────────────────────

import { pagoPorCommerceOrder } from '../../../../lib/reservas';
import { q1, dbConfigurada } from '../../../../lib/db';
import { procesarToken } from '../../../../lib/pagos-flow';
import { estadoPorFlowOrder, leerEstadoFlow, flowConfigurado } from '../../../../lib/flow';
import { json, texto, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada() || !flowConfigurado()) {
    return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);
  }

  const body = await cuerpoDe(req);
  const commerceOrder = texto(body?.commerceOrder, 60);
  const flowOrder = texto(body?.flowOrder, 40);

  let pago = null;

  if (commerceOrder) {
    pago = await pagoPorCommerceOrder(commerceOrder);
  } else if (flowOrder) {
    pago = await q1(`SELECT * FROM pago WHERE flow_order = $1`, [flowOrder]);
    if (!pago) {
      // El pago no está en la BD con ese flowOrder (puede que ni exista
      // acá): se consulta Flow igual para mostrarle a César qué dice Flow,
      // aunque no haya nada que acreditar.
      try {
        const crudo = await estadoPorFlowOrder(flowOrder);
        return json({ ok: true, encontradoEnBD: false, flow: leerEstadoFlow(crudo) });
      } catch (err) {
        return json({ ok: false, motivo: 'error_flow', error: err.message }, 502);
      }
    }
  }

  if (!pago) return json({ ok: false, motivo: 'pago_no_encontrado' }, 404);
  if (!pago.flow_token) return json({ ok: false, motivo: 'sin_token_flow' }, 400);

  try {
    const resultado = await procesarToken(pago.flow_token);
    return json({ ok: true, encontradoEnBD: true, resultado: resultado.resultado || resultado.motivo });
  } catch (err) {
    console.error('[cadena/reverificar] Error:', err.message);
    return json({ ok: false, motivo: 'error_servidor' }, 500);
  }
}
