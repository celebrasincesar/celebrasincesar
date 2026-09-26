// ══════════════════════════════════════════════════════════════════════
// POSTEVENTO  ·  lib/postevento.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE A" (24-sep-2026).
// T+1 (con recuperación T+2) después de una celebración real: el sistema
// PREPARA una tarea de WhatsApp para César pidiendo la reseña. NO existe
// API de WhatsApp: jamás se registra "enviado"/"entregado"/"reseña
// realizada" — solo CREADA y GESTIONADA en pago_evento (INSERT atómico),
// el mismo mecanismo del ciclo previo (lib/ciclo-previo.js). Sin tabla ni
// cron nuevos. Postgres decide si una celebración ocurrió (fecha_evento de
// la reserva) — nunca Google Calendar.
// ══════════════════════════════════════════════════════════════════════

import { q } from './db';
import { fechaISO, festejadoDeReserva, ESTADOS_FIRMES } from './reservas';
import { tareaYaCreada } from './ciclo-previo';
import { NEGOCIO, POSTEVENTO_ACTIVO_DESDE } from '../data/master';

export const TIPO_EVENTO_POSTEVENTO = {
  CREADA: 'POSTEVENTO_TAREA_WHATSAPP_CREADA',
  GESTIONADA: 'POSTEVENTO_TAREA_WHATSAPP_GESTIONADA',
};

// Estados reales que cuentan como celebración que sí ocurrió (§7): los
// firmes. Cancelada/expirada/reembolsada/pendiente de pago quedan fuera.
export const ESTADOS_POSTEVENTO = ESTADOS_FIRMES;

// ══════════════════════════════════════════════════════════════════════
// FECHAS — mismo patrón que lib/ciclo-previo.js: fechaISO() + ancla a
// mediodía, `hoy` inyectable. Único añadido: "hoy" se toma como fecha
// operacional de Chile (America/Santiago) y no como fecha UTC, para que a
// las 22:00 de Chile (ya "mañana" en UTC) no se adelante un día el T+1.
// ══════════════════════════════════════════════════════════════════════
const aMediodia = (valor) => new Date(`${fechaISO(valor)}T12:00:00`);

export function fechaOperacionalChile(hoy = new Date()) {
  if (typeof hoy === 'string') return hoy.slice(0, 10);
  return hoy.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

// Días transcurridos desde el evento: 1 = ayer, 0 = hoy, negativo = futuro.
export function diasDesdeEvento(fechaEvento, hoy = new Date()) {
  const diferencia = aMediodia(fechaOperacionalChile(hoy)).getTime() - aMediodia(fechaEvento).getTime();
  return Math.round(diferencia / 86_400_000);
}

function restarDias(fechaStr, dias) {
  return fechaISO(new Date(aMediodia(fechaStr).getTime() - dias * 86_400_000));
}

// Pura: ¿corresponde crear la tarea postevento HOY para esta reserva?
// (no decide si ya existe — eso lo resuelve pago_evento).
export function postEventoAplicable(reserva, hoy = new Date(), activoDesde = POSTEVENTO_ACTIVO_DESDE) {
  if (!reserva?.fecha_evento) return { aplica: false, motivo: 'sin_fecha' };
  if (!ESTADOS_POSTEVENTO.includes(reserva.estado)) return { aplica: false, motivo: 'estado_no_elegible' };
  if (fechaOperacionalChile(hoy) < activoDesde) return { aplica: false, motivo: 'antes_de_activacion' };
  const dias = diasDesdeEvento(reserva.fecha_evento, hoy);
  if (dias !== 1 && dias !== 2) return { aplica: false, motivo: 'fuera_de_ventana', dias };
  return { aplica: true, dias };
}

// ══════════════════════════════════════════════════════════════════════
// ESTADO POSTEVENTO PARA MI CELEBRACIÓN (Bloque B, §5-§7)
// Desde T+1 en adelante, SIN fecha de expiración (el cliente puede volver a
// dejar la reseña cuando quiera) y solo para celebraciones válidas (mismos
// estados reales que la tarea). No depende de POSTEVENTO_ACTIVO_DESDE: esa
// defensa es contra generar tareas/mensajes históricos, no contra mostrar
// un agradecimiento.
// ══════════════════════════════════════════════════════════════════════
export function estadoPostevento(reserva, hoy = new Date()) {
  if (!reserva?.fecha_evento || !ESTADOS_POSTEVENTO.includes(reserva.estado)) return { activo: false };
  const dias = diasDesdeEvento(reserva.fecha_evento, hoy);
  return dias >= 1 ? { activo: true, diasDesdeEvento: dias } : { activo: false };
}

// ══════════════════════════════════════════════════════════════════════
// LINK DE RESEÑA Y MENSAJE (§9-§11)
// Sin enlace directo válido NO hay mensaje: nunca se arma texto con una
// URL falsa o de Maps.
// ══════════════════════════════════════════════════════════════════════
export function linkResenaValido(url) {
  return typeof url === 'string' && /^https:\/\/\S+$/.test(url.trim());
}

// Un nombre de festejado usable en el texto (nunca "undefined" ni vacío).
export function nombreFestejadoValido(nombre) {
  if (typeof nombre !== 'string') return false;
  const limpio = nombre.trim().toLowerCase();
  return limpio !== '' && limpio !== 'undefined' && limpio !== 'null';
}

export function mensajePostevento(festejado, googleReviewUrl = NEGOCIO.postevento.googleReviewUrl) {
  if (!linkResenaValido(googleReviewUrl)) return null;
  const esperamos = nombreFestejadoValido(festejado)
    ? `Esperamos que ${festejado.trim()} y su familia hayan disfrutado mucho su celebración en Alce Kids.`
    : 'Esperamos que hayan disfrutado mucho su celebración en Alce Kids.';
  return `🎉 ¡Gracias por celebrar con nosotros!

${esperamos}

Si te gustó la experiencia, nos ayudaría muchísimo que dejaras una reseña en Google:

${googleReviewUrl.trim()}

Gracias por confiar en nosotros 💛

Alce Kids`;
}

// Para mostrar en /cadena: si no hay festejado, el nombre del cliente.
const festejadoDe = (reserva) => festejadoDeReserva(reserva) || reserva.cliente_nombre;

// ══════════════════════════════════════════════════════════════════════
// CRON — ejecutarPostevento()
// Ventana estrecha por diseño: solo celebraciones de ayer y anteayer
// (T+1, T+2). Nunca se consulta más atrás → sin backfill histórico.
// ══════════════════════════════════════════════════════════════════════
export async function reservasParaPostevento(hoy = new Date()) {
  const hoyChile = fechaOperacionalChile(hoy);
  const desde = restarDias(hoyChile, 2);
  const hasta = restarDias(hoyChile, 1);
  const placeholders = ESTADOS_POSTEVENTO.map((_, i) => `$${i + 3}`).join(', ');
  return q(
    `SELECT id, codigo, cliente_nombre, cliente_telefono, fecha_evento, estado,
            snapshot, snapshot_vigente
       FROM reserva
      WHERE estado IN (${placeholders})
        AND fecha_evento >= $1::date
        AND fecha_evento <= $2::date
      ORDER BY fecha_evento ASC
      LIMIT 300`,
    [desde, hasta, ...ESTADOS_POSTEVENTO]
  );
}

// INSERT atómico apoyado en el índice UNIQUE parcial pago_evento_postevento_uk
// (lib/db.js): con 2, 5 o 20 peticiones simultáneas, Postgres deja una sola
// fila y las demás reciben `insertado: false`. Los SELECT previos
// (tareaYaCreada) son solo una optimización. A propósito NO usa
// registrarEvento(): ese helper traga los errores, y acá un fallo real de
// escritura no puede pasar por "ya existía".
export async function registrarEventoUnico({ reservaId, tipo, referencia = null }) {
  const filas = await q(
    `INSERT INTO pago_evento (reserva_id, tipo, referencia)
     VALUES ($1, $2, $3)
     ON CONFLICT (reserva_id, tipo)
       WHERE tipo IN ('POSTEVENTO_TAREA_WHATSAPP_CREADA', 'POSTEVENTO_TAREA_WHATSAPP_GESTIONADA')
     DO NOTHING
     RETURNING id`,
    [reservaId, tipo, referencia]
  );
  return { insertado: filas.length > 0 };
}

export async function ejecutarPostevento(hoy = new Date(), { activoDesde = POSTEVENTO_ACTIVO_DESDE } = {}) {
  const reservas = await reservasParaPostevento(hoy);
  const resultados = [];

  for (const reserva of reservas) {
    try {
      const { aplica, motivo } = postEventoAplicable(reserva, hoy, activoDesde);
      if (!aplica) { resultados.push({ codigo: reserva.codigo, creada: false, motivo }); continue; }
      if (await tareaYaCreada(reserva.id, TIPO_EVENTO_POSTEVENTO.CREADA)) {
        resultados.push({ codigo: reserva.codigo, creada: false, motivo: 'ya_existia' });
        continue;
      }
      const { insertado } = await registrarEventoUnico({ reservaId: reserva.id, tipo: TIPO_EVENTO_POSTEVENTO.CREADA, referencia: reserva.codigo });
      resultados.push(insertado ? { codigo: reserva.codigo, creada: true } : { codigo: reserva.codigo, creada: false, motivo: 'ya_existia' });
    } catch (err) {
      resultados.push({ codigo: reserva.codigo, error: err.message });
    }
  }

  return { ok: true, procesadas: reservas.length, resultados };
}

// ══════════════════════════════════════════════════════════════════════
// LISTA PARA /cadena — tareas CREADA sin GESTIONADA (§12)
// Con link inválido no se devuelve mensaje alguno (§11).
// ══════════════════════════════════════════════════════════════════════
export async function tareasPostevento(hoy = new Date(), { googleReviewUrl = NEGOCIO.postevento.googleReviewUrl } = {}) {
  const filas = await q(
    `SELECT r.id, r.codigo, r.cliente_nombre, r.cliente_telefono, r.fecha_evento,
            r.snapshot, r.snapshot_vigente
       FROM pago_evento c
       JOIN reserva r ON r.id = c.reserva_id
      WHERE c.tipo = $1
        AND NOT EXISTS (
          SELECT 1 FROM pago_evento g WHERE g.reserva_id = c.reserva_id AND g.tipo = $2
        )
      ORDER BY r.fecha_evento DESC, r.id DESC`,
    [TIPO_EVENTO_POSTEVENTO.CREADA, TIPO_EVENTO_POSTEVENTO.GESTIONADA]
  );

  const linkConfigurado = linkResenaValido(googleReviewUrl);
  const tareas = filas.map((r) => {
    const festejado = festejadoDe(r);
    return {
      reservaId: r.id,
      codigo: r.codigo,
      festejado,
      fechaEvento: fechaISO(r.fecha_evento),
      diasDesdeEvento: diasDesdeEvento(r.fecha_evento, hoy),
      telefono: r.cliente_telefono,
      // El texto usa SOLO el festejado real: sin él, variante natural (nunca
      // el nombre del apoderado como si fuera el del cumpleañero).
      mensaje: linkConfigurado ? mensajePostevento(festejadoDeReserva(r), googleReviewUrl) : null,
    };
  });

  return { linkConfigurado, tareas };
}

// ══════════════════════════════════════════════════════════════════════
// MARCAR GESTIONADO (§13-§14)
// Solo este botón crea el evento — abrir WhatsApp o copiar nunca lo hacen.
// Sin link configurado se rechaza también en servidor (§11). Idempotente.
// ══════════════════════════════════════════════════════════════════════
export async function marcarPosteventoGestionado({ reservaId, googleReviewUrl = NEGOCIO.postevento.googleReviewUrl }) {
  if (!linkResenaValido(googleReviewUrl)) return { ok: false, motivo: 'link_resena_no_configurado' };
  if (!(await tareaYaCreada(reservaId, TIPO_EVENTO_POSTEVENTO.CREADA))) return { ok: false, motivo: 'tarea_no_creada' };
  if (await tareaYaCreada(reservaId, TIPO_EVENTO_POSTEVENTO.GESTIONADA)) return { ok: true, yaEstaba: true };

  const { insertado } = await registrarEventoUnico({ reservaId, tipo: TIPO_EVENTO_POSTEVENTO.GESTIONADA });
  return { ok: true, yaEstaba: !insertado };
}
