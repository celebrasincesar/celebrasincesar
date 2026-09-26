// ══════════════════════════════════════════════════════════════════════
// PENDIENTES CON PROVEEDOR  ·  lib/pendientes-proveedor.js
// ──────────────────────────────────────────────────────────────────────
// Decoración temática y animación dependen de terceros (materiales/
// proveedor, agencia externa) — nunca se asume disponibilidad automática
// (documento "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026).
//
// UNA sola función central, sincronizarPendientesProveedor(), se llama
// desde los DOS únicos lugares que pueden cambiar la configuración
// vigente: crearReserva() y aplicarCambioComercial(). Nunca hay un
// tercer camino que pueda agregar un adicional sin que a César le
// aparezca el pendiente — es estructuralmente imposible que diverjan
// porque es el mismo código.
//
// Compara la configuración vigente contra los pendientes YA existentes:
//   A. ítem nuevo sujeto a proveedor            → crea PENDIENTE
//   B. ítem todavía presente, sin cambios       → mantiene su estado
//   C. ítem que ya no está en la configuración  → pasa a RETIRADO (nunca
//      se borra la fila — queremos histórico)
//   D. ítem RETIRADO que vuelve a aparecer       → reactiva como PENDIENTE
//      (la disponibilidad hay que confirmarla de nuevo)
//   E. decoración temática cuya TEMÁTICA cambió  → resetea a PENDIENTE
//      aunque estuviera CONFIRMADO — una confirmación de "Minnie" no
//      sirve para "Huntrix" (candado explícito del documento)
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { CATEGORIA_DE_ITEM } from '../data/reglas';

// Igual que fechaISO() en lib/reservas.js: el driver de Postgres devuelve
// columnas DATE como objetos Date de JS, y String(fecha) da el formato
// local ("Fri Oct 10 2026…"), no ISO. Duplicado acá (en vez de importar
// desde reservas.js) para no crear un import circular con el módulo que
// llama a sincronizarPendientesProveedor().
function fechaISO(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

const IDS_DECORACION_TEMATICA = new Set(['deco-tematica-simple', 'deco-tematica-full']);

// `CATEGORIA_DE_ITEM` ya existe en data/reglas.js (id → categoría del
// catálogo completa) — se reutiliza tal cual en vez de reconstruir el
// mismo lookup por segunda vez. Si mañana se agrega o quita una animación
// del catálogo, esto se ajusta solo.
function tipoProveedorDe(itemId) {
  if (IDS_DECORACION_TEMATICA.has(itemId)) return 'decoracion_tematica';
  if (CATEGORIA_DE_ITEM[itemId]?.id === 'animacion') return 'animacion';
  return null;
}

// { itemId, tipo: 'decoracion_tematica' | 'animacion' } por cada ítem de
// `extras` que corresponde a un proveedor externo. Los demás adicionales
// (inflables, mesas, banquetería) no generan pendiente — Alce Kids los
// entrega directamente, sin depender de nadie más.
function itemsConProveedor(extras) {
  return (extras || [])
    .map((e) => {
      const tipo = tipoProveedorDe(e.id);
      return tipo ? { itemId: e.id, tipo } : null;
    })
    .filter(Boolean);
}

// T-21 si falta más de 21 días; si ya quedan 21 o menos, hoy mismo (el
// pendiente nace ya "vence hoy" — la prioridad real la calcula el cron
// del Bloque 2 comparando esta fecha contra hoy, acá solo se deja
// calculada). Animación usa el mismo criterio con T-14 (documento §12:
// "deja correctamente calculable/preparado" — el envío de avisos llega en
// el Bloque 2/3, no acá).
function proximaRevisionInicial(tipo, fechaEvento) {
  const evento = new Date(`${fechaISO(fechaEvento)}T12:00:00`);
  if (Number.isNaN(evento.getTime())) return null;
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const diasHastaEvento = Math.round((evento - hoy) / 86_400_000);
  const ventana = tipo === 'decoracion_tematica' ? 21 : 14;
  const objetivo = diasHastaEvento > ventana
    ? new Date(evento.getTime() - ventana * 86_400_000)
    : hoy;
  return objetivo.toISOString().slice(0, 10);
}

// La temática es SIEMPRE la de configuracion.tematica (fuente canónica,
// documento §2) — nunca se le pregunta a `detalle` de una fila existente.
function tematicaCanonica(configuracion) {
  return (configuracion?.tematica || '').trim() || null;
}

export async function sincronizarPendientesProveedor({ reservaId, configuracion, fechaEvento }) {
  const detectados = itemsConProveedor(configuracion?.extras);
  const tematica = tematicaCanonica(configuracion);

  const existentes = await q(
    `SELECT id, tipo, item_id, detalle, estado FROM pendiente_proveedor WHERE reserva_id = $1`,
    [reservaId]
  );
  const porClave = new Map(existentes.map((p) => [`${p.tipo}:${p.item_id}`, p]));
  const clavesDetectadas = new Set(detectados.map((d) => `${d.tipo}:${d.itemId}`));

  const resultado = { creados: [], reactivados: [], reseteados: [], retirados: [], sinCambio: [] };

  // A / D / E — todo lo que está presente ahora en la configuración.
  for (const { itemId, tipo } of detectados) {
    const clave = `${tipo}:${itemId}`;
    const previo = porClave.get(clave);
    const detalle = tipo === 'decoracion_tematica' ? tematica : null;
    const proximaRevision = proximaRevisionInicial(tipo, fechaEvento);

    if (!previo) {
      // A — nunca existió: nace PENDIENTE.
      await q1(
        `INSERT INTO pendiente_proveedor (reserva_id, tipo, item_id, detalle, estado, proxima_revision)
         VALUES ($1, $2, $3, $4, 'PENDIENTE', $5::date)
         ON CONFLICT (reserva_id, tipo, item_id) DO NOTHING
         RETURNING id`,
        [reservaId, tipo, itemId, detalle, proximaRevision]
      );
      resultado.creados.push(clave);
      continue;
    }

    if (previo.estado === 'RETIRADO') {
      // D — vuelve a aparecer tras haber sido retirado: la disponibilidad
      // hay que confirmarla de nuevo, sin importar si antes ya se había
      // confirmado.
      await q(
        `UPDATE pendiente_proveedor
            SET estado = 'PENDIENTE', detalle = $2, proxima_revision = $3::date, actualizado_en = now()
          WHERE id = $1`,
        [previo.id, detalle, proximaRevision]
      );
      resultado.reactivados.push(clave);
      continue;
    }

    if (tipo === 'decoracion_tematica' && (previo.detalle || null) !== detalle) {
      // E — cambió la temática: una confirmación anterior no sirve para
      // la nueva. Se resetea SIEMPRE, incluso si estaba CONFIRMADO.
      await q(
        `UPDATE pendiente_proveedor
            SET estado = 'PENDIENTE', detalle = $2, proxima_revision = $3::date, actualizado_en = now()
          WHERE id = $1`,
        [previo.id, detalle, proximaRevision]
      );
      resultado.reseteados.push(clave);
      continue;
    }

    // B — sigue presente, sin cambios relevantes: se mantiene tal cual.
    resultado.sinCambio.push(clave);
  }

  // C — lo que tenía pendiente activo y ya no está en la configuración.
  for (const previo of existentes) {
    const clave = `${previo.tipo}:${previo.item_id}`;
    if (clavesDetectadas.has(clave) || previo.estado === 'RETIRADO') continue;
    await q(
      `UPDATE pendiente_proveedor SET estado = 'RETIRADO', actualizado_en = now() WHERE id = $1`,
      [previo.id]
    );
    resultado.retirados.push(clave);
  }

  return resultado;
}

export async function pendientesDeReserva(reservaId) {
  return q(
    `SELECT id, tipo, item_id, detalle, estado, proxima_revision, actualizado_en
       FROM pendiente_proveedor WHERE reserva_id = $1 ORDER BY tipo, item_id`,
    [reservaId]
  );
}

// ══════════════════════════════════════════════════════════════════════
// URGENCIA  (documento "FASE 2B — IMPLEMENTAR BLOQUE 2", §3)
// ──────────────────────────────────────────────────────────────────────
// Nunca se guarda un campo manual de "urgencia" — se deriva siempre de
// tipo/estado/fecha del evento/proxima_revision/hoy, pura, sin red, para
// que /cadena y el Calendar (§NO_DISPONIBLE) lean exactamente lo mismo.
// ══════════════════════════════════════════════════════════════════════
export const NIVEL_URGENCIA = { ROJO: 'rojo', NARANJA: 'naranja', AMARILLO: 'amarillo' };
const EMOJI_URGENCIA = { rojo: '🔴', naranja: '🟠', amarillo: '🟡' };
export const PESO_URGENCIA = { rojo: 0, naranja: 1, amarillo: 2 };

function diasEntre(desde, hasta) {
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
}

export function urgenciaPendiente({ tipo, estado, fechaEvento, proximaRevision }, ahora = new Date()) {
  const hoy = new Date(ahora); hoy.setHours(12, 0, 0, 0);
  let nivel;

  if (estado === 'NO_DISPONIBLE') {
    // Siempre roja: requiere una acción humana, nunca se oculta sola (§2).
    nivel = NIVEL_URGENCIA.ROJO;
  } else if (estado === 'REVISAR_DESPUES') {
    if (!proximaRevision) {
      nivel = NIVEL_URGENCIA.AMARILLO;
    } else {
      const revision = new Date(`${fechaISO(proximaRevision)}T12:00:00`);
      const dias = diasEntre(hoy, revision);
      nivel = dias > 0 ? NIVEL_URGENCIA.AMARILLO : dias === 0 ? NIVEL_URGENCIA.NARANJA : NIVEL_URGENCIA.ROJO;
    }
  } else {
    // PENDIENTE (§3): la urgencia mira los días que faltan para el EVENTO,
    // nunca proxima_revision — ese campo es solo informativo en este estado.
    const evento = new Date(`${fechaISO(fechaEvento)}T12:00:00`);
    const diasHastaEvento = diasEntre(hoy, evento);
    const ventana = tipo === 'decoracion_tematica' ? 21 : 14;
    nivel = diasHastaEvento > ventana ? NIVEL_URGENCIA.AMARILLO
      : diasHastaEvento > 7 ? NIVEL_URGENCIA.NARANJA
      : NIVEL_URGENCIA.ROJO;
  }

  return { nivel, emoji: EMOJI_URGENCIA[nivel] };
}

// Mismo truco que fechaISO() más arriba: se evita importar festejadoDeReserva
// de lib/reservas.js (que a su vez importa de este archivo) duplicando
// localmente el mínimo necesario en vez de crear un ciclo de imports.
function parseSnap(valor) {
  if (!valor) return null;
  return typeof valor === 'string' ? JSON.parse(valor) : valor;
}
function festejadoDe(fila) {
  const snap = parseSnap(fila.snapshot_vigente) ?? parseSnap(fila.snapshot);
  return snap?.nombreNino || snap?.configuracion?.nombreNino || fila.cliente_nombre;
}

// ══════════════════════════════════════════════════════════════════════
// PENDIENTES ACTIVOS  ·  /cadena "Pendientes con proveedor" (§1)
// ──────────────────────────────────────────────────────────────────────
// Solo PENDIENTE / REVISAR_DESPUES / NO_DISPONIBLE — CONFIRMADO no ocupa
// la lista principal (sigue visible en el detalle de la reserva) y
// RETIRADO nunca aparece como activo (§2). Ordenado 🔴 → 🟠 → 🟡 y, dentro
// de cada grupo, por celebración más próxima (§3).
// ══════════════════════════════════════════════════════════════════════
export async function pendientesActivos() {
  const filas = await q(
    `SELECT p.id, p.reserva_id, p.tipo, p.item_id, p.detalle, p.estado, p.proxima_revision,
            r.codigo, r.fecha_evento, r.turno, r.cliente_nombre, r.snapshot, r.snapshot_vigente
       FROM pendiente_proveedor p
       JOIN reserva r ON r.id = p.reserva_id
      WHERE p.estado IN ('PENDIENTE', 'REVISAR_DESPUES', 'NO_DISPONIBLE')`
  );

  const enriquecidas = filas.map((f) => {
    const fechaEvento = fechaISO(f.fecha_evento);
    const proximaRevision = f.proxima_revision ? fechaISO(f.proxima_revision) : null;
    return {
      id: f.id,
      reservaId: f.reserva_id,
      codigo: f.codigo,
      festejado: festejadoDe(f),
      fechaEvento,
      turno: f.turno,
      tipo: f.tipo,
      itemId: f.item_id,
      detalle: f.detalle,
      estado: f.estado,
      proximaRevision,
      urgencia: urgenciaPendiente({ tipo: f.tipo, estado: f.estado, fechaEvento, proximaRevision }),
    };
  });

  enriquecidas.sort((a, b) =>
    PESO_URGENCIA[a.urgencia.nivel] - PESO_URGENCIA[b.urgencia.nivel]
    || new Date(a.fechaEvento) - new Date(b.fechaEvento));

  return enriquecidas;
}

const ESTADOS_ADMIN_PERMITIDOS = new Set(['PENDIENTE', 'REVISAR_DESPUES', 'CONFIRMADO', 'NO_DISPONIBLE']);

// ══════════════════════════════════════════════════════════════════════
// ACTUALIZAR UN PENDIENTE  ·  endpoint admin de /cadena (§14)
// ──────────────────────────────────────────────────────────────────────
// Solo toma `pendienteId` — nunca un `reservaId` aparte — así es
// estructuralmente imposible operar el pendiente de una reserva
// equivocada: la reserva sale siempre de la propia fila. Un RETIRADO
// nunca se puede "confirmar" a mano mientras el adicional no vuelva a la
// configuración vigente (eso solo lo decide sincronizarPendientesProveedor,
// nunca este endpoint) — candado explícito del documento.
// ══════════════════════════════════════════════════════════════════════
export async function actualizarPendienteProveedor({ pendienteId, estado, proximaRevision }) {
  const previo = await q1(`SELECT id, estado FROM pendiente_proveedor WHERE id = $1`, [pendienteId]);
  if (!previo) return { ok: false, motivo: 'pendiente_inexistente' };
  if (previo.estado === 'RETIRADO') return { ok: false, motivo: 'retirado_no_editable' };
  if (!ESTADOS_ADMIN_PERMITIDOS.has(estado)) return { ok: false, motivo: 'estado_invalido' };

  let proximaRevisionFinal = null;
  if (estado === 'REVISAR_DESPUES') {
    const valida = proximaRevision && !Number.isNaN(new Date(`${proximaRevision}T12:00:00`).getTime());
    if (!valida) return { ok: false, motivo: 'fecha_invalida' };
    proximaRevisionFinal = proximaRevision;
  }

  const fila = await q1(
    `UPDATE pendiente_proveedor
        SET estado = $2, proxima_revision = $3::date, actualizado_en = now()
      WHERE id = $1
      RETURNING id, reserva_id, tipo, item_id, detalle, estado, proxima_revision`,
    [pendienteId, estado, proximaRevisionFinal]
  );
  return { ok: true, pendiente: fila };
}

// Exportadas para QA/depuración — puras, sin red.
export { itemsConProveedor, proximaRevisionInicial, tematicaCanonica, tipoProveedorDe, IDS_DECORACION_TEMATICA };
