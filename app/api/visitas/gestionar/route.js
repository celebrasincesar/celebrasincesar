// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/visitas/gestionar?id=VIS-2026-000123&t=<token>
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026, §13). Solo lectura en Bloque A — cancelar/reagendar
// quedan para Bloque B (§17, §19). Mismo candado que /api/mi-celebracion:
// código+token, igualSeguro(), sin filtrar si el código existe o no.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { visitaDesdeParams, leerIdYToken } from '../../../../lib/visita-auth';
import { fechaISO } from '../../../../lib/reservas';
import { json, demasiadasPeticiones, ipDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`visitas-gestionar:${ipDe(req)}`, 30, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const { id, t } = leerIdYToken(Object.fromEntries(new URL(req.url).searchParams));
  const visita = await visitaDesdeParams(id, t);
  if (!visita) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  return json({
    ok: true,
    visita: {
      codigo: visita.codigo,
      fecha: fechaISO(visita.fecha_visita),
      hora: visita.hora_inicio,
      estado: visita.estado,
      nombreAdulto: visita.nombre_adulto,
      nombreFestejado: visita.nombre_festejado,
    },
  });
}
