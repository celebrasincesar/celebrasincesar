// ══════════════════════════════════════════════════════════════════════
// CICLO PREVIO AL EVENTO  ·  lib/ciclo-previo.js
// ──────────────────────────────────────────────────────────────────────
// T-21 → T-14 → T-7 → T-4 → T-2 → T-1 (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 3", 22-sep-2026). NO existe API de WhatsApp: el sistema PREPARA
// una tarea (texto + link), César la envía a mano. Nunca se registra un
// evento "enviado" — solo "tarea creada" (T7_TAREA_WHATSAPP_CREADA, etc.)
// y "tarea gestionada" (cuando César confirma que ya la manejó), ambos en
// pago_evento vía registrarEvento(), mismo mecanismo que ya usa el correo
// contractual — nunca una tabla nueva para esto.
//
// T-21 (decoración) y T-14 (animación) NO generan pago_evento: son
// puramente derivados de pendiente_proveedor + urgenciaPendiente() (§9 del
// documento: "Esta lógica ya existe... No crear un segundo cálculo de
// urgencia"). T-2 tampoco genera evento — es un chequeo operacional en
// vivo, igual que "Todo listo para celebrar" del Bloque 2.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { fechaISO, estadoSaldo, registrarEvento } from './reservas';
import { datosFinalesVigentes } from './datos-finales';
import { pendientesDeReserva, urgenciaPendiente, NIVEL_URGENCIA, PESO_URGENCIA } from './pendientes-proveedor';
import { todoListoParaCelebrar, pendienteBloqueaListo } from './resumen-operacional';
import { NEGOCIO } from '../data/master';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

// ── Tipos de evento (pago_evento.tipo) — exactos del documento §12 ─────
export const TIPO_EVENTO = {
  T7_CREADA: 'T7_TAREA_WHATSAPP_CREADA',
  T7_GESTIONADA: 'T7_TAREA_WHATSAPP_GESTIONADA',
  T4_CREADA: 'T4_TAREA_WHATSAPP_CREADA',
  T4_GESTIONADA: 'T4_TAREA_WHATSAPP_GESTIONADA',
  T1_CREADA: 'T1_TAREA_WHATSAPP_CREADA',
  T1_GESTIONADA: 'T1_TAREA_WHATSAPP_GESTIONADA',
};
const MILESTONES = ['T7', 'T4', 'T1'];

// ══════════════════════════════════════════════════════════════════════
// FECHAS — candado del documento (§2): jamás String(fecha). Siempre
// fechaISO() + ancla a mediodía, el mismo patrón ya usado en
// lib/pendientes-proveedor.js y lib/resumen-operacional.js.
// ══════════════════════════════════════════════════════════════════════
function aMediodia(valor) {
  return new Date(`${fechaISO(valor)}T12:00:00`);
}

// Días de `desde` a `hasta` (positivo si `hasta` es futuro respecto de `desde`).
function diasEntre(desde, hasta) {
  return Math.round((aMediodia(hasta).getTime() - aMediodia(desde).getTime()) / 86_400_000);
}

// Cuántos días faltan HOY para el evento (puede ser 0 o negativo si ya pasó).
export function diasHastaEvento(reserva, hoy = new Date()) {
  return diasEntre(hoy, reserva.fecha_evento);
}

// Ventana real que tuvo la reserva entre creación y evento — decide qué
// hitos tienen sentido para una reserva de última hora (§13).
export function diasEntreCreacionYEvento(reserva) {
  return diasEntre(reserva.creada, reserva.fecha_evento);
}

// ══════════════════════════════════════════════════════════════════════
// QUÉ HITOS CORRESPONDEN HOY  (§13, reglas de última hora)
// ──────────────────────────────────────────────────────────────────────
// Pura: dado el `gap` (creación→evento) y lo que falta HOY, decide qué
// tareas YA deberían existir. No decide si YA existen (eso lo resuelve la
// consulta a pago_evento) ni si además se cumplen otras condiciones (T-4
// exige Datos Finales faltantes; eso se filtra aparte).
// ══════════════════════════════════════════════════════════════════════
export function tareasAplicables(reserva, hoy = new Date()) {
  const restante = diasHastaEvento(reserva, hoy);
  const gap = diasEntreCreacionYEvento(reserva);
  const resultado = { t7: false, t4: false, t1: false };

  if (gap <= 0) {
    // Reserva creada el mismo día del evento: sin secuencia histórica,
    // solo la alerta operacional en vivo (§13, "mismo día").
    return resultado;
  }
  if (gap === 1) {
    // "NO crear T-7 ni T-4. Generar T-1."
    resultado.t1 = restante <= 1;
    return resultado;
  }
  if (gap >= 2 && gap <= 4) {
    // "generar directamente tarea equivalente a T-4 ... No crear T-7."
    // El gap ya es ≤4, así que el equivalente T-4 corresponde de inmediato.
    resultado.t4 = true;
    resultado.t1 = restante <= 1;
    return resultado;
  }
  if (gap >= 5 && gap <= 6) {
    // "NO generar T-7 con texto 'falta una semana'. Esperar T-4."
    resultado.t4 = restante <= 4;
    resultado.t1 = restante <= 1;
    return resultado;
  }
  // gap > 6: ciclo normal completo.
  resultado.t7 = restante <= 7;
  resultado.t4 = restante <= 4;
  resultado.t1 = restante <= 1;
  return resultado;
}

// ══════════════════════════════════════════════════════════════════════
// LINK Y HORA DE PREPARACIÓN
// ══════════════════════════════════════════════════════════════════════

// Mismo patrón exacto que lib/resumen-cliente.js — código+token, nunca
// requiere cuenta ni contraseña.
export function linkMiCelebracion(reserva) {
  return `${NEGOCIO.sitio}/mi-celebracion?id=${encodeURIComponent(reserva.codigo)}&t=${encodeURIComponent(reserva.acceso_token)}`;
}

// 30 minutos de cortesía antes del horario contratado (mismo número que
// NEGOCIO.preparacion, data/master.js) — se resta sobre hora_inicio REAL
// ya persistida en la reserva (incluye horas adicionales si las hubo),
// nunca se recalcula contra el turno base.
const MINUTOS_PREPARACION = 30;
export function horaPreparacion(reserva) {
  if (!reserva.hora_inicio) return null;
  const [h, m] = reserva.hora_inicio.split(':').map(Number);
  const total = h * 60 + m - MINUTOS_PREPARACION;
  const hh = String(Math.floor(((total % 1440) + 1440) % 1440 / 60)).padStart(2, '0');
  const mm = String(((total % 60) + 60) % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ══════════════════════════════════════════════════════════════════════
// TEXTOS — exactos del documento, con las variables sustituidas. El saldo
// (§6) nunca es cobranza: solo se menciona si hay saldo > 0, y con
// lenguaje sugerente ("si quieres"), nunca "debes"/"urgente"/alertas.
// ══════════════════════════════════════════════════════════════════════
export function mensajeT7(reserva, festejado) {
  const link = linkMiCelebracion(reserva);
  const { pendiente } = estadoSaldo(reserva);
  const accion = pendiente > 0
    ? 'Desde Mi Celebración puedes revisar lo contratado, actualizar asistentes, agregar algo más o, si quieres, adelantar tu saldo pendiente.'
    : 'Desde Mi Celebración puedes revisar lo contratado, actualizar asistentes o agregar algo más.';
  return `🎉 ¡Falta una semana para el cumpleaños de ${festejado}!

Ya tenemos todo avanzando para su celebración.

${accion}

${link}

Más cerca de la fecha te pediremos confirmar los últimos detalles.`;
}

export function mensajeT4(reserva, festejado) {
  const link = linkMiCelebracion(reserva);
  return `🎈 ¡Ya falta poquito para el cumpleaños de ${festejado}!

Queremos dejar todo preparado para su celebración.

Confirma la cantidad final de invitados y los últimos detalles aquí:

${link}

Son solo unos minutos.`;
}

export function mensajeT1(reserva, festejado, listo) {
  const link = linkMiCelebracion(reserva);
  if (listo) {
    const horario = reserva.hora_inicio && reserva.hora_termino ? `${reserva.hora_inicio}–${reserva.hora_termino}` : '—';
    const prep = horaPreparacion(reserva) || '—';
    return `🎉 ¡Mañana celebramos a ${festejado}!

Tu celebración está lista.

🕒 Horario: ${horario}
📍 ${NEGOCIO.direccion.calle}, ${NEGOCIO.direccion.comuna}

Puedes ingresar desde ${prep} para preparar.

Si necesitas revisar cualquier detalle:

${link}

¡Nos vemos mañana! 🥳`;
  }
  return `🎉 ¡Mañana celebramos a ${festejado}!

Antes de mañana necesitamos cerrar un detalle de tu celebración.

Puedes revisarlo aquí:

${link}

Si necesitas ayuda, escríbenos por WhatsApp.`;
}

function festejadoDe(reserva) {
  const snap = reserva.snapshot_vigente ?? reserva.snapshot;
  const s = typeof snap === 'string' ? JSON.parse(snap) : snap;
  return s?.nombreNino || s?.configuracion?.nombreNino || reserva.cliente_nombre;
}

// ══════════════════════════════════════════════════════════════════════
// CRON — ejecutarCicloPrevio()
// ──────────────────────────────────────────────────────────────────────
// Recorre reservas firmes con evento en una ventana razonable (próximos
// 30 días — nada de esto aplica más allá) y crea, idempotentemente, la
// tarea CREADA que corresponda según tareasAplicables(). Un fallo por
// reserva nunca detiene a las demás (mismo patrón que
// reintentar-email-contractual).
// ══════════════════════════════════════════════════════════════════════
// `hoy`: override solo para pruebas — la ventana real de producción usa
// siempre "ahora" de verdad. Parametrizado en vez de `now()` en SQL para
// que una prueba pueda simular tanto la fecha del evento como el "hoy" de
// forma consistente, sin depender de la fecha real del día en que corre.
export async function reservasParaCicloPrevio(hoy = new Date()) {
  const desde = fechaISO(hoy);
  const hasta = fechaISO(new Date(hoy.getTime() + 30 * 86_400_000));
  return q(
    `SELECT id, codigo, cliente_nombre, cliente_telefono, fecha_evento, turno,
            hora_inicio, hora_termino, sector, total, pagado, estado,
            creada, snapshot, snapshot_vigente, acceso_token
       FROM reserva
      WHERE estado IN ('CONFIRMED', 'BALANCE_PENDING', 'PAID')
        AND fecha_evento >= $1::date
        AND fecha_evento <= $2::date
      ORDER BY fecha_evento ASC
      LIMIT 300`,
    [desde, hasta]
  );
}

export async function tareaYaCreada(reservaId, tipoCreada) {
  const fila = await q1(
    `SELECT 1 FROM pago_evento WHERE reserva_id = $1 AND tipo = $2 LIMIT 1`,
    [reservaId, tipoCreada]
  );
  return !!fila;
}

async function crearTareaSiCorresponde(reserva, milestone, datosFinales) {
  const tipoCreada = TIPO_EVENTO[`${milestone}_CREADA`];
  if (await tareaYaCreada(reserva.id, tipoCreada)) return { creada: false, motivo: 'ya_existia' };

  // T-4 solo si todavía NO existen Datos Finales vigentes (§7) — la
  // condición se evalúa en el momento de crear, no después.
  if (milestone === 'T4' && datosFinales) return { creada: false, motivo: 'datos_finales_ya_confirmados' };

  await registrarEvento({ reservaId: reserva.id, tipo: tipoCreada, referencia: reserva.codigo });
  return { creada: true };
}

// `hoy`: override solo para pruebas (mismo patrón que urgenciaPendiente()/
// pendienteBloqueaListo() — por defecto siempre "ahora" real). El negocio
// solo opera viernes/sábado/domingo (NEGOCIO.dias), así que una prueba no
// puede simplemente usar "hoy real + N días" como fecha del evento (cae
// en un día no reservable la mayoría de las veces) — en cambio usa una
// fecha de evento real y reservable, y simula "hoy" de forma independiente
// para poner a prueba cada umbral exacto.
export async function ejecutarCicloPrevio(hoy = new Date()) {
  const reservas = await reservasParaCicloPrevio(hoy);
  const resultados = [];

  for (const reserva of reservas) {
    try {
      const aplicables = tareasAplicables(reserva, hoy);
      const datosFinales = await datosFinalesVigentes(reserva.id);
      const creadas = [];

      for (const milestone of MILESTONES) {
        const clave = milestone.toLowerCase(); // 't7' | 't4' | 't1'
        if (!aplicables[clave]) continue;
        const resultado = await crearTareaSiCorresponde(reserva, milestone, datosFinales);
        if (resultado.creada) creadas.push(milestone);
      }

      resultados.push({ codigo: reserva.codigo, creadas });
    } catch (err) {
      resultados.push({ codigo: reserva.codigo, error: err.message });
    }
  }

  return { ok: true, procesadas: reservas.length, resultados };
}

// ══════════════════════════════════════════════════════════════════════
// MARCAR GESTIONADO  ·  endpoint admin de /cadena (§12)
// ──────────────────────────────────────────────────────────────────────
// Abrir WhatsApp o copiar el texto NUNCA implica que se envió — solo
// "gestionada" cuando César lo confirma a mano. Idempotente: si ya está
// marcada, no duplica el evento.
// ══════════════════════════════════════════════════════════════════════
export async function marcarTareaGestionada({ reservaId, milestone }) {
  if (!MILESTONES.includes(milestone)) return { ok: false, motivo: 'hito_invalido' };
  const tipoCreada = TIPO_EVENTO[`${milestone}_CREADA`];
  const tipoGestionada = TIPO_EVENTO[`${milestone}_GESTIONADA`];

  const creada = await tareaYaCreada(reservaId, tipoCreada);
  if (!creada) return { ok: false, motivo: 'tarea_no_creada' };

  const yaGestionada = await tareaYaCreada(reservaId, tipoGestionada);
  if (yaGestionada) return { ok: true, yaEstaba: true };

  await registrarEvento({ reservaId, tipo: tipoGestionada });
  return { ok: true, yaEstaba: false };
}

// ══════════════════════════════════════════════════════════════════════
// T-2 — CONTROL INTERNO  (§8): no WhatsApp, solo un chequeo en vivo. Se
// reutiliza pendienteBloqueaListo()/todoListoParaCelebrar() — el mismo
// criterio de "algo pendiente crítico" del Bloque 2, nunca un cálculo
// nuevo. El saldo económico nunca entra acá (§8, igual que §15/Bloque 2).
// ══════════════════════════════════════════════════════════════════════
export function motivosPendientesT2({ reserva, datosFinales, pendientes }, hoy = new Date()) {
  const motivos = [];
  if (!datosFinales) motivos.push('Datos Finales sin confirmar');
  for (const p of (pendientes || []).filter((x) => x.estado !== 'RETIRADO')) {
    if (pendienteBloqueaListo(p, hoy)) {
      const etiqueta = p.tipo === 'decoracion_tematica' ? 'Decoración pendiente' : 'Animación pendiente';
      motivos.push(p.estado === 'NO_DISPONIBLE' ? `${etiqueta.split(' ')[0]} no disponible` : etiqueta);
    }
  }
  return motivos;
}

// ══════════════════════════════════════════════════════════════════════
// ACCIONES PRÓXIMAS  ·  /cadena, nueva sección (§16)
// ──────────────────────────────────────────────────────────────────────
// Une, en una sola lista ordenada 🔴→🟠→🟡 (y por fecha dentro de cada
// grupo), TODO lo accionable de cara al evento: T-21/T-14 (informativos,
// ya accionables en "Pendientes con proveedor"), T-7/T-4/T-1 (tareas de
// WhatsApp con CTA), y T-2 (alerta interna). No inventa un segundo
// cálculo de urgencia en ningún caso — siempre reutiliza
// urgenciaPendiente() y pendienteBloqueaListo().
// ══════════════════════════════════════════════════════════════════════
export async function accionesProximas(hoy = new Date()) {
  const reservas = await reservasParaCicloPrevio(hoy);
  const acciones = [];

  // Eventos de tareas WhatsApp de TODAS las reservas relevantes, en un
  // solo viaje — evita N consultas por reserva.
  const ids = reservas.map((r) => r.id);
  const eventosPorReserva = new Map();
  if (ids.length) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const filas = await q(
      `SELECT reserva_id, tipo FROM pago_evento
        WHERE reserva_id IN (${placeholders})
          AND tipo IN ('T7_TAREA_WHATSAPP_CREADA','T7_TAREA_WHATSAPP_GESTIONADA',
                       'T4_TAREA_WHATSAPP_CREADA','T4_TAREA_WHATSAPP_GESTIONADA',
                       'T1_TAREA_WHATSAPP_CREADA','T1_TAREA_WHATSAPP_GESTIONADA')`,
      ids
    );
    for (const f of filas) {
      if (!eventosPorReserva.has(f.reserva_id)) eventosPorReserva.set(f.reserva_id, new Set());
      eventosPorReserva.get(f.reserva_id).add(f.tipo);
    }
  }

  for (const reserva of reservas) {
    const festejado = festejadoDe(reserva);
    const restante = diasHastaEvento(reserva, hoy);
    const fechaEvento = fechaISO(reserva.fecha_evento);
    const eventos = eventosPorReserva.get(reserva.id) || new Set();
    const datosFinales = await datosFinalesVigentes(reserva.id);
    const pendientes = await pendientesDeReserva(reserva.id);

    // T-21 / T-14 — informativos, ya accionables arriba en "Pendientes con
    // proveedor" (§16: no duplicar los botones acá).
    for (const p of pendientes.filter((x) => x.estado !== 'RETIRADO' && x.estado !== 'CONFIRMADO')) {
      const urgencia = urgenciaPendiente({
        tipo: p.tipo, estado: p.estado, fechaEvento: reserva.fecha_evento, proximaRevision: p.proxima_revision,
      }, hoy);
      acciones.push({
        tipo: p.tipo === 'decoracion_tematica' ? 'T21' : 'T14',
        nivel: urgencia.nivel, emoji: urgencia.emoji,
        codigo: reserva.codigo, festejado, fechaEvento, diasRestantes: restante,
        titulo: p.tipo === 'decoracion_tematica' ? 'Revisar decoración temática' : 'Consultar animación con agencia',
        detalle: p.detalle || null,
        accionable: false,
      });
    }

    // T-7 / T-4 / T-1 — tareas de WhatsApp con CTA.
    for (const milestone of MILESTONES) {
      const tipoCreada = TIPO_EVENTO[`${milestone}_CREADA`];
      const tipoGestionada = TIPO_EVENTO[`${milestone}_GESTIONADA`];
      if (!eventos.has(tipoCreada) || eventos.has(tipoGestionada)) continue;
      // Obsolescencia (§15/§7): T-4 deja de tener sentido si el cliente
      // confirmó Datos Finales por su cuenta después de crearse la tarea.
      if (milestone === 'T4' && datosFinales) continue;

      const mensaje = milestone === 'T7' ? mensajeT7(reserva, festejado)
        : milestone === 'T4' ? mensajeT4(reserva, festejado)
        : mensajeT1(reserva, festejado, todoListoParaCelebrar({ reserva, datosFinales, pendientes }, hoy));

      const nivel = restante <= 1 ? NIVEL_URGENCIA.ROJO : restante <= 3 ? NIVEL_URGENCIA.NARANJA : NIVEL_URGENCIA.AMARILLO;
      acciones.push({
        tipo: milestone, nivel, emoji: { rojo: '🔴', naranja: '🟠', amarillo: '🟡' }[nivel],
        codigo: reserva.codigo, festejado, fechaEvento, diasRestantes: restante,
        titulo: milestone === 'T7' ? 'WhatsApp T-7 pendiente' : milestone === 'T4' ? 'Confirmar Datos Finales' : 'WhatsApp T-1 pendiente',
        mensaje,
        accionable: true, reservaId: reserva.id, milestone,
      });
    }

    // T-2 — control interno, solo si falta ≤2 días y hay algo real pendiente (§8).
    if (restante <= 2 && restante >= 0) {
      const motivos = motivosPendientesT2({ reserva, datosFinales, pendientes });
      if (motivos.length) {
        acciones.push({
          tipo: 'T2', nivel: NIVEL_URGENCIA.ROJO, emoji: '🔴',
          codigo: reserva.codigo, festejado, fechaEvento, diasRestantes: restante,
          titulo: '⚠ Revisar antes de la celebración',
          detalle: motivos.join(' · '),
          accionable: false,
        });
      }
    }
  }

  acciones.sort((a, b) => PESO_URGENCIA[a.nivel] - PESO_URGENCIA[b.nivel] || new Date(a.fechaEvento) - new Date(b.fechaEvento));
  return acciones;
}
