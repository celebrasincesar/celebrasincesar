// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/pago-manual
// Protegido por el middleware de /cadena. Para cuando el papá paga fuera
// de Flow —transferencia directa a la cuenta BancoEstado, efectivo, o
// Súper Compraquí presencial— y César lo registra a mano (documento
// "Agregar control obligatorio de BVE…", 07-sep-2026, §7).
//
// EL MONTO SIEMPRE LO ESCRIBE CÉSAR, para los tres tipos — a propósito
// distinto de link-pago/montoQueCorresponde. Ahí el monto lo calcula el
// servidor porque es una CITACIÓN: le dice a Flow cuánto cobrar antes de
// que el papá pague, y no hay que confiar en un monto que venga del
// navegador (§22). Acá es al revés: la plata YA llegó, y este formulario
// no pide cuánto cobrar — deja constancia de cuánto llegó. Sustituirlo por
// "lo que la reserva debería tener pendiente" fue exactamente el bug real
// encontrado en Sandbox (documento "Bug a revisar antes de seguir",
// 07-sep-2026): César escribió $50.000 en el campo de referencia porque el
// monto real no tenía dónde ir, y el sistema registró en su lugar el saldo
// teórico ($82.500) sin que nadie lo pidiera ni lo viera.
//
// Sí se acota (máximo $5.000.000, igual que EXTRA en link-pago) como
// resguardo contra un error de tipeo, no contra el papá — quien escribe
// esto es César, autenticado, desde el panel (§22).
// ─────────────────────────────────────────────────────────────────────────────

import { reservaPorCodigo, registrarPagoManual } from '../../../../lib/reservas';
import { TRIBUTARIO_POR_MEDIO_MANUAL } from '../../../../lib/tributario';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { notificarAdminPago, notificarClientePago } from '../../../../lib/notificaciones';
import { enviarEmailContractual } from '../../../../lib/email-contractual';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, CODIGO_RESERVA, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

const TIPOS = ['DEPOSIT', 'BALANCE', 'EXTRA'];
const MONTO_MAXIMO = 5_000_000;

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);
  const codigo = texto(body?.reservationCode, 40).toUpperCase();
  const tipo = texto(body?.tipo, 20).toUpperCase();
  const medio = texto(body?.medio, 40).toUpperCase();
  const fecha = texto(body?.fecha, 20);
  const referencia = texto(body?.referencia, 200);
  const monto = Math.round(Number(body?.monto));

  if (!CODIGO_RESERVA.test(codigo)) return json({ ok: false, motivo: 'codigo_invalido' }, 400);
  if (!TIPOS.includes(tipo)) return json({ ok: false, motivo: 'tipo_invalido' }, 400);
  if (!TRIBUTARIO_POR_MEDIO_MANUAL[medio]) return json({ ok: false, motivo: 'medio_invalido' }, 400);
  if (!Number.isInteger(monto) || monto <= 0 || monto > MONTO_MAXIMO) {
    return json({ ok: false, motivo: 'monto_invalido' }, 400);
  }

  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return json({ ok: false, motivo: 'reserva_no_encontrada' }, 404);

  // No es un tope duro: un sobrepago real (el papá transfirió de más) no se
  // rechaza ni se recorta en silencio — se deja constancia y se avisa,
  // nunca se oculta (§23 del documento del bug).
  const saldoAntes = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const sobrepago = monto > saldoAntes ? monto - saldoAntes : 0;

  const resultado = await registrarPagoManual({
    codigo, tipo, medio, monto, fechaPago: fecha || null, referencia: referencia || null,
  });

  if (!resultado.ok) {
    return json(resultado, resultado.motivo === 'fecha_invalida' ? 400 : 400);
  }

  if (resultado.nuevos > 0 && !resultado.conflictoTurno) {
    await sincronizarCalendario(reserva.id).catch(() => {});
    await notificarAdminPago(resultado.pagoId).catch(() => {});
    await notificarClientePago(resultado.pagoId).catch(() => {});
    await enviarEmailContractual(reserva.id).catch(() => {});
  }

  return json({ ok: true, reserva: resultado.reserva, conflictoTurno: resultado.conflictoTurno, sobrepago });
}
