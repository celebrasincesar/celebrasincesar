// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/pagos/flow/status?id=CSC-2026-000123&t=<token>
// Sondeo seguro para /pago/resultado mientras un pago asíncrono (una
// transferencia) sigue "verificando" (§14). Cada llamada vuelve a
// preguntarle a Flow su estado real — no lee una copia vieja — así que el
// papá ve la reserva confirmarse sola apenas Flow la confirma, sin tener
// que recargar la página a mano.
//
// Solo devuelve lo que el papá necesita para su propia reserva, y solo si
// entrega el mismo par código+token del link privado (§22, §25): el mismo
// candado que ya usa /api/cotizacion.
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo, pagosDeReserva, etiquetaReserva, estadoSaldo, detalleDeReserva, fechaISO } from '../../../../../lib/reservas';
import { procesarToken } from '../../../../../lib/pagos-flow';
import { igualSeguro, json, texto, CODIGO_RESERVA, TOKEN_ACCESO, demasiadasPeticiones, ipDe } from '../../../../../lib/http';
import { dbConfigurada } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`status:${ipDe(req)}`, 30, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const params = new URL(req.url).searchParams;
  const id = texto(params.get('id'), 40).toUpperCase();
  const token = texto(params.get('t'), 64);

  if (!CODIGO_RESERVA.test(id) || !TOKEN_ACCESO.test(token)) {
    return json({ ok: false, motivo: 'parametros_invalidos' }, 400);
  }

  const reserva = await reservaPorCodigo(id);
  if (!reserva || !igualSeguro(reserva.acceso_token, token)) {
    return json({ ok: false, motivo: 'sin_acceso' }, 403);
  }

  // Si hay un pago todavía verificándose, se vuelve a preguntar a Flow
  // antes de responder: es lo que hace que el sondeo sirva de algo.
  const pagos = await pagosDeReserva(reserva.id);
  const enCurso = pagos.find((p) => p.estado === 'PENDING' && p.flow_token);
  if (enCurso) {
    await procesarToken(enCurso.flow_token).catch(() => {});
  }

  const actual = enCurso ? await reservaPorCodigo(id) : reserva;
  const saldo = estadoSaldo(actual);

  // Todo lo que la pantalla post-pago necesita para mostrar la celebración
  // real —festejado, adicionales, tramos— sale de detalleDeReserva(), que
  // lee el snapshot histórico y nunca recalcula con el catálogo vigente
  // (documento "Quiero mejorar urgentemente la información operativa…",
  // 09-sep-2026). `adicionales` y `incluidos` ya vienen separados por
  // `gratis` — antes esta ruta los mandaba todos mezclados en un solo
  // `extras`, así que los chips de "adicionales contratados" del papá
  // podían mostrar también los incluidos gratis (Cocina Equipada, etc.).
  const snap = typeof actual.snapshot === 'string' ? JSON.parse(actual.snapshot) : actual.snapshot;
  const config = snap?.configuracion || null; // null en reservas manuales
  const d = detalleDeReserva(actual);

  return json({
    ok: true,
    reservationCode: actual.codigo,
    estado: actual.estado,
    estadoTexto: etiquetaReserva(actual.estado),
    total: actual.total,
    pagado: actual.pagado,
    saldoPendiente: saldo.pendiente,

    festejado: d.festejado,
    edadNino: d.edad,
    fecha: fechaISO(actual.fecha_evento),
    turno: actual.turno,
    horaInicio: actual.hora_inicio,
    horaTermino: actual.hora_termino,
    sector: actual.sector,
    tramoInvitados: d.tramoInvitados,
    tramoMayores: d.tramoMayores,
    // Tramo de PRECIO (hasta10/hasta20/hasta30/mas30) — no es lo mismo que
    // tramoInvitados: lo usa getPrecio() para mostrar el valor real de cada
    // adicional sugerido, el mismo que ya usó el motor de precios (§3).
    cantNinos: config?.cantNinos || null,
    // Adicionales realmente contratados (pagados) — para los chips y para
    // el WhatsApp post-pago. Los incluidos gratis van aparte.
    adicionales: d.adicionales,
    incluidos: d.incluidos,
    // Compat: algunos consumidores todavía leen `extras` para excluir del
    // upsell lo que ya se tiene (pagado o gratis, da igual: no se vuelve a
    // ofrecer ninguno de los dos).
    extras: [...d.adicionales, ...d.incluidos],
    ctx: snap?.ctx || null, // ya calculado al crear la reserva (contextoDesde)
  });
}
