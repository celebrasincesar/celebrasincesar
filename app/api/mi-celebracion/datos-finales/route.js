// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/mi-celebracion/datos-finales
// Confirmar Datos Finales operacionales (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 1", 21-sep-2026, §6). Append-only: NUNCA toca reserva.ninos,
// reserva.mayores, reserva.total, reserva.snapshot ni snapshot_vigente —
// eso es la contratación, esto es solo información para preparar el día.
// Sin checkbox contractual, sin T&C nuevos: la aceptación ya ocurrió al
// reservar.
// ─────────────────────────────────────────────────────────────────────────────

import { reservaEstaFirme } from '../../../../lib/reservas';
import { reservaDesdeParams, leerIdYToken } from '../../../../lib/mi-celebracion-auth';
import { guardarDatosFinales } from '../../../../lib/datos-finales';
import { sincronizarCalendario } from '../../../../lib/calendario';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, demasiadasPeticiones, ipDe, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

function entero(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'no_disponible' }, 503);

  if (demasiadasPeticiones(`mi-celebracion-datos-finales:${ipDe(req)}`, 10, 60_000)) {
    return json({ ok: false, motivo: 'demasiadas_peticiones' }, 429);
  }

  const body = await cuerpoDe(req);
  const { id, t } = leerIdYToken(body);

  const reserva = await reservaDesdeParams(id, t);
  if (!reserva) return json({ ok: false, motivo: 'sin_acceso' }, 403);

  if (!reservaEstaFirme(reserva.estado)) {
    return json({ ok: false, motivo: 'reserva_no_confirmada' }, 400);
  }

  const resultado = await guardarDatosFinales({
    reservaId: reserva.id,
    ninosFinal: entero(body?.ninosFinal),
    mayoresFinal: entero(body?.mayoresFinal),
    adultosAprox: entero(body?.adultosAprox),
    adultoResponsable: texto(body?.adultoResponsable, 120),
    telefonoOperacional: texto(body?.telefonoOperacional, 40),
    observacion: body?.observacion ? texto(body.observacion, 500) : null,
  });

  if (!resultado.ok) return json(resultado, 400);

  // El espejo se actualiza después de confirmar Datos Finales (documento
  // "FASE 2B — IMPLEMENTAR BLOQUE 2", 21-sep-2026, §12) — nunca bloquea ni
  // revierte la confirmación si Google falla (§13, Postgres manda).
  await sincronizarCalendario(reserva.id).catch(() => {});

  return json({ ok: true, confirmadoEn: resultado.datosFinales.confirmado_en });
}
