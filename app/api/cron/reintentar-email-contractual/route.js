// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cron/reintentar-email-contractual
// Vercel Cron la llama una vez al día (vercel.json). Mismo patrón que
// /api/cron/boletas-pendientes: protegida con CRON_SECRET, no revienta si
// no hay nada pendiente, deniega por defecto sin la variable configurada.
//
// Reintenta el email contractual (documento "No autorizo todavía el
// deploy...", 15-sep-2026, §9) para toda reserva firme (CONFIRMED/
// BALANCE_PENDING/PAID/COMPLETED) con tyc_version/tyc_hash que todavía no
// tiene el evento CONTRACTUAL_EMAIL_ENVIADO — sea porque el primer intento
// falló (SMTP caído, versión inconsistente) o porque nunca se intentó
// (una reserva antigua, o un pago manual anterior a esta pieza).
// enviarEmailContractual() ya es idempotente por reserva: llamarla acá de
// nuevo para una que sí se mandó no hace nada.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { reservasPendientesEmailContractual, enviarEmailContractual } from '../../../../lib/email-contractual';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return json({ ok: false, motivo: 'cron_sin_configurar' }, 401);

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secreto}`) return json({ ok: false, motivo: 'no_autorizado' }, 401);

  if (!dbConfigurada()) return json({ ok: true, motivo: 'pagos_no_disponibles' });

  const pendientes = await reservasPendientesEmailContractual();
  if (pendientes.length === 0) {
    return json({ ok: true, pendientes: 0, reintentados: 0, enviados: 0 });
  }

  let enviados = 0;
  const resultados = [];
  for (const r of pendientes) {
    const resultado = await enviarEmailContractual(r.id).catch((err) => ({ ok: false, enviado: false, motivo: 'error_inesperado', error: err.message }));
    if (resultado.enviado) enviados++;
    resultados.push({ codigo: r.codigo, ...resultado });
  }

  return json({ ok: true, pendientes: pendientes.length, reintentados: pendientes.length, enviados, detalle: resultados });
}
