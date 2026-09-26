// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET/POST /api/cadena/acciones-proximas
// Sección "Acciones próximas" de /cadena (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 3", 22-sep-2026, §16). Protegido por el middleware de /cadena, igual
// que el resto de app/api/cadena/* — sin candado propio.
//
// GET  → lista unificada T-21/T-14/T-7/T-4/T-2/T-1, ya ordenada 🔴→🟠→🟡 por
//        celebración más próxima (accionesProximas(), lib/ciclo-previo.js).
// POST → "Marcar gestionado" para una tarea T-7/T-4/T-1. Nunca implica que el
//        WhatsApp se envió — solo que César ya la gestionó a mano (§12).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { accionesProximas, marcarTareaGestionada } from '../../../../lib/ciclo-previo';
import { json, texto, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbConfigurada()) return json({ ok: true, acciones: [] });
  const acciones = await accionesProximas();
  return json({ ok: true, acciones });
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  const body = await cuerpoDe(req);
  const reservaId = Number(body?.reservaId);
  const milestone = texto(body?.milestone, 5).toUpperCase();

  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    return json({ ok: false, motivo: 'reserva_invalida' }, 400);
  }

  const resultado = await marcarTareaGestionada({ reservaId, milestone });
  if (!resultado.ok) {
    const status = resultado.motivo === 'tarea_no_creada' ? 404 : 400;
    return json(resultado, status);
  }
  return json(resultado);
}
