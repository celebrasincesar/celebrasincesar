// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/visitas
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026).
//
// GET  → disponibilidad de visitas (fecha+horarios) para el selector de
//        /visitas. Nunca refleja ocupación de otras visitas (§9, §16).
// POST → crea la visita. Best-effort de Calendar y correo después de
//        insertar: ninguno de los dos puede deshacer la visita ya creada
//        (§14: "si falla el email, la visita NO se cancela").
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../lib/db';
import { disponibilidadVisitas, crearVisita, enviarConfirmacionVisita, notificarVisitaAdmin } from '../../../lib/visitas';
import { sincronizarCalendarioVisita } from '../../../lib/calendario-visita';
import { fechaISO } from '../../../lib/reservas';
import { json, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`visitas-disp:${ipDe(req)}`, 30, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const slots = await disponibilidadVisitas();
  return json({ ok: true, slots });
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`visitas-crear:${ipDe(req)}`, 6, 60_000)) {
    return json({ ok: false, motivo: 'demasiados_intentos' }, 429);
  }

  const body = await cuerpoDe(req);
  const resultado = await crearVisita(body);
  if (!resultado.ok) return json(resultado, 400);

  const { visita } = resultado;

  // Ninguno de los dos puede revertir la visita ya escrita en Postgres —
  // la base de datos es la fuente de verdad (§14).
  await sincronizarCalendarioVisita(visita).catch((err) =>
    console.error('[api/visitas] Calendar de visita falló:', err.message));

  try {
    await enviarConfirmacionVisita(visita);
  } catch (err) {
    console.error('[api/visitas] Correo de confirmación falló:', err.message);
  }

  try {
    await notificarVisitaAdmin(visita);
  } catch (err) {
    console.error('[api/visitas] Aviso a administración falló:', err.message);
  }

  return json({
    ok: true,
    visita: {
      codigo: visita.codigo,
      t: visita.acceso_token,
      fecha: fechaISO(visita.fecha_visita),
      hora: visita.hora_inicio,
    },
  });
}
