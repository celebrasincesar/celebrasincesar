// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/cargos-libres
// Protegido por el middleware de /cadena. César suma a una reserva un monto
// que no está en ninguna opción del catálogo (adicional "Otro", pedido del
// 15-oct-2026: ej. comida que el papá pidió aparte) sin justificarlo con un
// ítem. Recibe la lista COMPLETA deseada de cargos — agregar y quitar son el
// mismo gesto, igual que /api/cadena/cambio-comercial con los extras.
//
// El total sube (o baja) en la diferencia y el saldo se recalcula solo:
// saldo = total − pagado. Calendar se actualiza igual que en cualquier otro
// cambio comercial (best-effort: el cambio ya quedó escrito).
//
// Body: { reservationCode, cargos: [{ concepto?: string, monto: number }] }
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo } from '../../../../lib/reservas';
import { aplicarCargosLibres } from '../../../../lib/cambio-comercial';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, CODIGO_RESERVA, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const codigo = texto(body?.reservationCode, 40).toUpperCase();
  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);
  if (!Array.isArray(body?.cargos)) return json({ ok: false, motivo: 'cargos_invalidos' }, 400);

  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return json({ ok: false, motivo: 'reserva_no_encontrada' }, 404);

  const r = await aplicarCargosLibres({
    reservaId: reserva.id,
    cargos: body.cargos.map((c) => ({ concepto: texto(c?.concepto, 60), monto: c?.monto })),
    motivo: 'cargo_libre_desde_cadena',
  });
  if (!r.ok) return json(r, r.motivo === 'reserva_no_encontrada' ? 404 : 400);

  if (!r.sinCambios) {
    await sincronizarCalendario(reserva.id).catch((err) =>
      console.error('[cadena/cargos-libres] Calendar falló:', err.message));
  }

  return json({ ok: true, totalAntes: r.totalAntes, totalDespues: r.totalDespues, diferencia: r.diferencia, cargos: r.cargos });
}
