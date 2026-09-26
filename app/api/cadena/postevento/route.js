// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET/POST /api/cadena/postevento
// Sección "Postevento" de /cadena (documento "FASE 3B — POSTEVENTO —
// IMPLEMENTAR BLOQUE A", 24-sep-2026, §12-§13). Protegido por el middleware
// de /cadena igual que el resto de app/api/cadena/* — sin candado propio.
//
// GET  → tareas POSTEVENTO_TAREA_WHATSAPP_CREADA sin GESTIONADA. Sin enlace
//        directo de reseña configurado, no devuelve mensaje alguno.
// POST → "Marcar gestionado". Rechazado si falta el enlace de reseña. Nunca
//        implica que el WhatsApp se envió — solo que César lo gestionó.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { tareasPostevento, marcarPosteventoGestionado } from '../../../../lib/postevento';
import { json, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbConfigurada()) return json({ ok: true, linkConfigurado: false, tareas: [] });
  const { linkConfigurado, tareas } = await tareasPostevento();
  return json({ ok: true, linkConfigurado, tareas });
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  const body = await cuerpoDe(req);
  const reservaId = Number(body?.reservaId);
  if (!Number.isInteger(reservaId) || reservaId <= 0) {
    return json({ ok: false, motivo: 'reserva_invalida' }, 400);
  }

  const resultado = await marcarPosteventoGestionado({ reservaId });
  if (!resultado.ok) {
    const status = resultado.motivo === 'tarea_no_creada' ? 404 : 400;
    return json(resultado, status);
  }
  return json(resultado);
}
