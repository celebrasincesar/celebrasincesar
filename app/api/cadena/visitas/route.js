// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET/POST /api/cadena/visitas
// Panel "Próximas visitas" de /cadena (documento "FASE 3A — VISITAS
// AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B", 22-sep-2026, §9-§11, §16).
// Protegido por el middleware de /cadena igual que el resto de
// app/api/cadena/* — sin candado propio.
//
// GET  → próximas visitas AGENDADA (visitasProximas(), lib/visitas.js),
//        agrupadas por fecha en el cliente. Nunca expone visitas
//        CANCELADA/REALIZADA/pasadas.
// POST → marcar una visita como REALIZADA. Nunca recibe más que el id: no
//        toca Calendar, reservas ni otras visitas (§11).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { visitasProximas, marcarVisitaRealizada } from '../../../../lib/visitas';
import { fechaISO } from '../../../../lib/reservas';
import { json, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbConfigurada()) return json({ ok: true, visitas: [] });
  const filas = await visitasProximas();
  return json({
    ok: true,
    visitas: filas.map((v) => ({
      id: v.id,
      codigo: v.codigo,
      fecha: fechaISO(v.fecha_visita),
      hora: v.hora_inicio,
      nombreAdulto: v.nombre_adulto,
      whatsapp: v.whatsapp,
      email: v.email,
      nombreFestejado: v.nombre_festejado,
      edadFestejado: v.edad_festejado,
      estado: v.estado,
    })),
  });
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  const body = await cuerpoDe(req);
  const visitaId = Number(body?.visitaId);
  if (!Number.isInteger(visitaId) || visitaId <= 0) {
    return json({ ok: false, motivo: 'visita_invalida' }, 400);
  }

  const resultado = await marcarVisitaRealizada(visitaId);
  if (!resultado.ok) {
    const status = resultado.motivo === 'visita_inexistente' ? 404 : 400;
    return json(resultado, status);
  }

  return json({
    ok: true,
    yaEstaba: resultado.yaEstaba,
    visita: { id: resultado.visita.id, estado: resultado.visita.estado },
  });
}
