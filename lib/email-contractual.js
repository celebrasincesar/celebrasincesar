// ══════════════════════════════════════════════════════════════════════
// EMAIL CONTRACTUAL  ·  lib/email-contractual.js
// ──────────────────────────────────────────────────────────────────────
// PAGO APROBADO → RESERVA CONFIRMADA → INTENTO EMAIL CONTRACTUAL
// (documento "No autorizo todavía el deploy...", 15-sep-2026, §9). Mismo
// patrón exacto que lib/notificaciones.js (notificarAdminPago/
// notificarClientePago) — se reutiliza deliberadamente, no se inventa un
// mecanismo nuevo:
//
//   1. La reserva/pago NUNCA se revierten porque esto falle — se llama
//      DESPUÉS de que acreditarPago() ya confirmó todo, y un fallo acá
//      solo deja un evento FALLIDO para reintentar (ver
//      contractualEmailsPendientes(), usada por el cron de reintento).
//   2. Idempotente por RESERVA, no por pago: el evento ENVIADO se busca
//      por reserva_id, así que un segundo pago sobre la misma reserva
//      (el saldo) o un webhook duplicado nunca generan un segundo correo.
//   3. El evento ENVIADO se registra SOLO después de que enviarCorreo()
//      resuelve sin lanzar (confirmación real del SMTP) — nunca antes.
//
// La versión y el hash que van en el correo son SIEMPRE los que ya quedó
// guardados en la reserva (reserva.tyc_version/tyc_hash) al crearla — este
// archivo no vuelve a decidir cuál es "la vigente", solo adjunta el PDF
// que corresponde EXACTAMENTE a esos dos valores, con una comprobación
// cruzada contra tyc_version antes de mandar nada (§9: "el correo debe
// contener... una copia conservable de los T&C EXACTAMENTE
// correspondientes a reserva.tyc_version + reserva.tyc_hash").
// ══════════════════════════════════════════════════════════════════════

import { q1 } from './db';
import { registrarEvento, ESTADOS_FIRMES } from './reservas';
import { correoConfigurado, enviarCorreo } from './correo';
import { construirResumenContractual } from './resumen-contractual';

const TIPO_ENVIADO = 'CONTRACTUAL_EMAIL_ENVIADO';
const TIPO_FALLIDO = 'CONTRACTUAL_EMAIL_FALLIDO';

export async function reservaYaTieneEmailContractual(reservaId) {
  const fila = await q1(
    `SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = $2 LIMIT 1`,
    [reservaId, TIPO_ENVIADO]
  );
  return !!fila;
}

export async function enviarEmailContractual(reservaId) {
  if (await reservaYaTieneEmailContractual(reservaId)) {
    return { ok: true, enviado: false, motivo: 'ya_enviado' };
  }

  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { ok: false, enviado: false, motivo: 'reserva_no_encontrada' };

  // Reservas históricas, creadas antes de que existiera tyc_hash: no hay
  // nada que adjuntar con certeza, y no se inventa (mismo criterio de
  // §5/§6 en todo lo demás de esta ronda). No es un error — simplemente
  // no aplica.
  if (!reserva.tyc_version || !reserva.tyc_hash) {
    return { ok: true, enviado: false, motivo: 'sin_tyc_hash' };
  }

  // Verificación cruzada ANTES del chequeo de SMTP: es una comprobación de
  // integridad de datos, no de si hoy se puede mandar correo — una
  // inconsistencia de versión tiene que reportarse (y quedar registrada
  // para auditoría) sin importar si el correo está configurado en este
  // entorno o no. La versión guardada en la reserva tiene que seguir
  // existiendo en tyc_version y su hash tiene que coincidir EXACTAMENTE
  // con el que se guardó al contratar. Si no calza —una inconsistencia
  // que no debería poder pasar dado tycHashVigente() (§5)—, se falla de
  // forma segura en vez de mandar el PDF equivocado.
  const version = await q1(
    `SELECT pdf_bytes, pdf_sha256, contenido_sha256 FROM tyc_version WHERE version = $1`,
    [reserva.tyc_version]
  );
  if (!version || version.contenido_sha256 !== reserva.tyc_hash) {
    await registrarEvento({
      reservaId, tipo: TIPO_FALLIDO, referencia: reserva.codigo,
      detalle: { motivo: 'version_no_coincide', tyc_version: reserva.tyc_version },
    });
    return { ok: false, enviado: false, motivo: 'version_no_coincide' };
  }

  if (!correoConfigurado()) {
    return { ok: true, enviado: false, motivo: 'correo_no_configurado' };
  }

  if (!version.pdf_bytes) {
    await registrarEvento({
      reservaId, tipo: TIPO_FALLIDO, referencia: reserva.codigo,
      detalle: { motivo: 'pdf_no_generado', tyc_version: reserva.tyc_version },
    });
    return { ok: false, enviado: false, motivo: 'pdf_no_disponible' };
  }

  const resumen = construirResumenContractual(reserva);

  try {
    await enviarCorreo({
      to: reserva.cliente_email,
      subject: resumen.asunto,
      text: resumen.texto,
      html: resumen.html,
      attachments: [{
        filename: `Terminos-y-Condiciones-${reserva.tyc_version}.pdf`,
        content: version.pdf_bytes,
        contentType: 'application/pdf',
      }],
    });
  } catch (err) {
    await registrarEvento({
      reservaId, tipo: TIPO_FALLIDO, referencia: reserva.codigo,
      detalle: { motivo: 'error_envio', error: String(err?.message || err).slice(0, 300) },
    });
    return { ok: false, enviado: false, motivo: 'error_envio' };
  }

  await registrarEvento({
    reservaId, tipo: TIPO_ENVIADO, referencia: reserva.codigo,
    detalle: { tyc_version: reserva.tyc_version, tyc_hash: reserva.tyc_hash, pdf_sha256: version.pdf_sha256 },
  });
  return { ok: true, enviado: true };
}

// ══════════════════════════════════════════════════════════════════════
// RETRY — reservas ya firmes que aún no tienen el email contractual
// entregado (documento "No autorizo todavía el deploy...", 15-sep-2026,
// §9: "Implementar retry idempotente siguiendo patrones existentes del
// proyecto"). Mismo patrón que pagosPendientesBVE() en lib/reservas.js:
// una consulta que lista pendientes, sin estado propio — el cron/panel
// que la usa decide cuándo reintentar.
// ══════════════════════════════════════════════════════════════════════
export async function reservasPendientesEmailContractual() {
  const { q } = await import('./db');
  // Mismo estilo que barrerVencidos() (lib/reservas.js): IN explícito con
  // un placeholder por valor — no se introduce el patrón `= ANY($1)` con
  // un array como parámetro, que no tiene precedente probado en este
  // driver (@neondatabase/serverless por HTTP).
  return q(
    `SELECT r.id, r.codigo, r.cliente_nombre, r.cliente_email, r.tyc_version, r.creada
       FROM reserva r
      WHERE r.estado IN ($1, $2, $3, $4)
        AND r.tyc_version IS NOT NULL AND r.tyc_hash IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM pago_evento pe
           WHERE pe.reserva_id = r.id AND pe.tipo = $5
        )
      ORDER BY r.creada ASC
      LIMIT 100`,
    [...ESTADOS_FIRMES, TIPO_ENVIADO]
  );
}
