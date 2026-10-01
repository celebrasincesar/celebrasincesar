// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cadena/reservas
// Protegido por el middleware de /cadena. Alimenta la vista de reservas
// del panel (§21): reserva, fecha, turno, cliente, total, pagado, saldo,
// estado, estado tributario.
//
// Antes de leer, se barren los cerrojos vencidos (§8): así el panel nunca
// muestra un turno "ocupado" que en realidad ya se liberó solo.
// ─────────────────────────────────────────────────────────────────────────────

import { q, dbConfigurada } from '../../../../lib/db';
import { barrerVencidos, detalleDeReserva, configuracionVigente, fechaISO, ESTADOS_FIRMES } from '../../../../lib/reservas';
import { resumenOperacional } from '../../../../lib/resumen-operacional';
import { json, texto } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

// 48 horas antes del inicio real del evento (NEGOCIO.saldoVence). Solo
// aritmética de fechas sobre datos ya guardados de la reserva — nunca toca
// precios, tributario ni conciliación.
function fechaLimiteSaldo(r) {
  const inicio = new Date(`${fechaISO(r.fecha_evento)}T${r.hora_inicio || '00:00'}:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  return new Date(inicio.getTime() - 48 * 3_600_000).toISOString();
}

export async function GET(req) {
  // Sin base de datos no hay reservas por la web que mostrar todavía —no
  // es un error, es el estado normal antes de configurar los pagos. El
  // panel ya explica esto con la tarjeta de /api/pagos/estado; esta ruta
  // solo tiene que no reventar con un 500 mientras tanto.
  if (!dbConfigurada()) return json({ ok: true, reservas: [] });

  await barrerVencidos().catch(() => {});

  const params = new URL(req.url).searchParams;
  const filtro = texto(params.get('estado'), 30);
  const soloBoletasPendientes = params.get('boletas') === '1';

  const condiciones = [];
  const valores = [];

  if (filtro) {
    valores.push(filtro);
    condiciones.push(`r.estado = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const filas = await q(
    `SELECT
       r.id, r.codigo, r.fecha_evento, r.turno, r.hora_inicio, r.hora_termino, r.cliente_nombre,
       r.cliente_email, r.cliente_telefono, r.sector, r.ninos, r.mayores,
       r.total, r.anticipo, r.saldo, r.pagado, r.estado, r.invitacion_enviada_en, r.acceso_token,
       r.calendar_estado, r.creada, r.snapshot, r.snapshot_vigente, r.tyc_version, r.tyc_hash,
       COALESCE(
         (SELECT json_agg(json_build_object(
            'id', p.id, 'tipo', p.tipo, 'estado', p.estado, 'monto', p.monto,
            'commerceOrder', p.commerce_order, 'flowOrder', p.flow_order,
            'medio', p.medio, 'medioTipo', p.medio_tipo, 'cuotas', p.cuotas,
            'tributario', p.tributario, 'tributarioRef', p.tributario_ref,
            'tributarioObs', p.tributario_obs, 'tributarioEmitido', p.tributario_emitido,
            'confirmado', p.confirmado
          ) ORDER BY p.id)
          FROM pago p WHERE p.reserva_id = r.id),
         '[]'
       ) AS pagos,
       -- Confirmación contractual (documento "No autorizo todavía el
       -- deploy...", 15-sep-2026, §9): true solo si ya existe el evento de
       -- envío exitoso — un intento FALLIDO no cuenta como entregado.
       EXISTS (
         SELECT 1 FROM pago_evento pe
          WHERE pe.reserva_id = r.id AND pe.tipo = 'CONTRACTUAL_EMAIL_ENVIADO'
       ) AS contractual_email_enviado,
       -- Datos Finales: SOLO la última fila vigente (documento "FASE 2B —
       -- IMPLEMENTAR BLOQUE 2", 21-sep-2026, §7) — el histórico completo
       -- sigue en la tabla para auditoría, nunca llega acá.
       (SELECT row_to_json(df) FROM (
          SELECT ninos_final, mayores_final, adultos_aprox, adulto_responsable,
                 telefono_operacional, observacion, confirmado_en
            FROM datos_finales_reserva
           WHERE reserva_id = r.id
           ORDER BY confirmado_en DESC
           LIMIT 1
        ) df) AS datos_finales,
       -- Pendientes con proveedor, sin RETIRADO (§2: nunca aparece como
       -- activo) — CONFIRMADO sí viaja, para el detalle de la reserva.
       COALESCE(
         (SELECT json_agg(json_build_object(
            'id', pp.id, 'tipo', pp.tipo, 'itemId', pp.item_id, 'detalle', pp.detalle,
            'estado', pp.estado, 'proximaRevision', pp.proxima_revision
          ) ORDER BY pp.id)
          FROM pendiente_proveedor pp
          WHERE pp.reserva_id = r.id AND pp.estado <> 'RETIRADO'),
         '[]'
       ) AS pendientes_proveedor
     FROM reserva r
     ${where}
     ORDER BY r.fecha_evento DESC, r.id DESC
     LIMIT 300`,
    valores
  );

  // El detalle histórico sale SIEMPRE de la configuración VIGENTE
  // (detalleDeReserva ya resuelve snapshot_vigente ?? snapshot) — nunca se
  // recalcula con el catálogo vigente-del-sitio. El snapshot crudo no sale
  // de acá: el panel consume `detalle`, ya extraído, nunca el JSON entero.
  const reservas = filas.map((r) => {
    const { snapshot, snapshot_vigente, datos_finales, pendientes_proveedor, invitacion_enviada_en, ...resto } = r;
    const detalle = detalleDeReserva(r);
    return {
      ...resto,
      festejado: detalle.festejado,
      detalle,
      // Invitación Digital (hallazgo real 30-sep-2026, §ver lib/reservas.js
      // invitacionesPendientes): solo importa en reservas firmes — una
      // reserva PENDING_PAYMENT/EXPIRED no tiene nada que "enviar" todavía.
      invitacionEnviadaEn: invitacion_enviada_en || null,
      necesitaInvitacion: ESTADOS_FIRMES.includes(r.estado) && !invitacion_enviada_en
        && detalle.incluidos.some((i) => i.id === 'invitacion-digital'),
      // Una reserva manual (+ Crear reserva manual) tiene un total
      // negociado fuera del motor de precios — el editor de adicionales
      // (cambio comercial) no aplica: recalcularía y pisaría ese precio.
      // configuracionVigente() ya resuelve JSONB-como-string vs objeto;
      // nunca se lee `snapshot`/`snapshot_vigente` crudo para esto.
      esManual: !!configuracionVigente(r)?.manual,
      // Política vigente (NEGOCIO.saldoVence, §D): 48 horas antes del
      // evento. Es aritmética sobre la fecha real, no un precio — no toca
      // el motor de precios ni la conciliación.
      saldoVenceEn: r.saldo > 0 ? fechaLimiteSaldo(r) : null,
      datosFinales: datos_finales || null,
      pendientesProveedor: pendientes_proveedor || [],
      // "¿Qué falta resolver?" en un vistazo (documento §6/§15) — calculado
      // UNA vez acá, el panel solo lo pinta.
      resumenOperacional: resumenOperacional({
        reserva: r,
        datosFinales: datos_finales || null,
        pendientes: pendientes_proveedor || [],
      }),
    };
  });

  const filtradas = soloBoletasPendientes
    ? reservas.filter((r) => (r.pagos || []).some((p) => p.tributario === 'PENDING_BVE'))
    : reservas;

  return json({ ok: true, reservas: filtradas });
}
