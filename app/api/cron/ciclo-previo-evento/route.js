// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cron/ciclo-previo-evento
// UN SOLO cron para todo el ciclo previo T-21..T-1 (documento "FASE 2B —
// IMPLEMENTAR BLOQUE 3", 22-sep-2026, §1) — nunca un cron separado por hito.
// Mismo patrón exacto que /api/cron/reintentar-email-contractual: CRON_SECRET
// vía Authorization Bearer, un fallo por reserva nunca detiene a las demás.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { ejecutarCicloPrevio } from '../../../../lib/ciclo-previo';
import { ejecutarPostevento } from '../../../../lib/postevento';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return json({ ok: false, motivo: 'cron_sin_configurar' }, 401);

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secreto}`) return json({ ok: false, motivo: 'no_autorizado' }, 401);

  if (!dbConfigurada()) return json({ ok: true, motivo: 'pagos_no_disponibles' });

  const resultado = await ejecutarCicloPrevio();

  // Postevento (T+1/T+2) en el mismo cron (documento "FASE 3B — POSTEVENTO",
  // §8): el ciclo previo ya terminó intacto; un fallo acá nunca lo afecta.
  let postevento;
  try {
    postevento = await ejecutarPostevento();
  } catch (err) {
    postevento = { ok: false, error: err.message };
  }

  return json({ ...resultado, postevento });
}
