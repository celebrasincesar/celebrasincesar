// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET/POST /api/cadena/pendientes-proveedor
// Panel "Pendientes con proveedor" de /cadena (documento "FASE 2B —
// IMPLEMENTAR BLOQUE 2", 21-sep-2026, §1/§14). Protegido por el middleware
// de /cadena igual que el resto de app/api/cadena/* — sin candado propio.
//
// GET  → lista solo los pendientes ACTIVOS (PENDIENTE/REVISAR_DESPUES/
//        NO_DISPONIBLE), enriquecidos con fecha/festejado/urgencia y
//        ordenados 🔴 → 🟠 → 🟡, por celebración más próxima dentro de
//        cada grupo (pendientesActivos(), lib/pendientes-proveedor.js).
// POST → cambia el estado (y opcionalmente proxima_revision) de UN
//        pendiente por su id. Nunca recibe un reservaId aparte: es
//        estructuralmente imposible operar el pendiente de otra reserva.
//        Un RETIRADO nunca se puede "confirmar" a mano (§14) — solo
//        sincronizarPendientesProveedor() puede sacarlo de RETIRADO,
//        cuando el adicional vuelve a la configuración vigente.
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { pendientesActivos, actualizarPendienteProveedor } from '../../../../lib/pendientes-proveedor';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { json, texto, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbConfigurada()) return json({ ok: true, pendientes: [] });
  const pendientes = await pendientesActivos();
  return json({ ok: true, pendientes });
}

const ESTADOS_VALIDOS = ['PENDIENTE', 'REVISAR_DESPUES', 'CONFIRMADO', 'NO_DISPONIBLE'];

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  const body = await cuerpoDe(req);
  const pendienteId = Number(body?.pendienteId);
  const estado = texto(body?.estado, 20).toUpperCase();
  const proximaRevision = body?.proximaRevision ? texto(body.proximaRevision, 10) : null;

  if (!Number.isInteger(pendienteId) || pendienteId <= 0) {
    return json({ ok: false, motivo: 'pendiente_invalido' }, 400);
  }
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return json({ ok: false, motivo: 'estado_invalido' }, 400);
  }

  const resultado = await actualizarPendienteProveedor({ pendienteId, estado, proximaRevision });
  if (!resultado.ok) {
    const status = resultado.motivo === 'pendiente_inexistente' ? 404 : 400;
    return json(resultado, status);
  }

  // El espejo se actualiza después de un cambio de estado de proveedor
  // (documento §12) — nunca bloquea ni revierte el cambio si Google falla.
  await sincronizarCalendario(resultado.pendiente.reserva_id).catch(() => {});

  return json({ ok: true, pendiente: resultado.pendiente });
}
