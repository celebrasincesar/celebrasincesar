// ══════════════════════════════════════════════════════════════════════
// VISITAS AUTOGESTIONADAS  ·  lib/visitas.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026). Una visita es una entidad TOTALMENTE independiente de
// una reserva de celebración: nunca crea `reserva`, nunca crea
// `turno_hold`, nunca crea `pago_evento` (§7). El único punto de contacto
// futuro es `visita.reserva_id`, que queda NULL hasta que (si acaso)
// alguien reserve después de haber visitado.
//
// REGLA COMERCIAL DEFINITIVA (§4, §8, §9, §16, §24): las visitas NO
// compiten por cupo. Varias familias pueden agendar exactamente el mismo
// viernes a la misma hora — es comportamiento correcto, no un conflicto.
// Por eso esta función NUNCA hace un `SELECT` para ver si "ya hay alguien
// a esa hora": eso sería inventar una capacidad máxima que no existe.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import { NEGOCIO } from '../data/master';
import { esViernes } from '../data/reglas';
import { texto, EMAIL, telefonoValido, normalizarTelefono } from './validacion';
import { tokenAleatorio, fechaISO } from './reservas';
import { diasBloqueadosCalendar } from './calendario';
import { enviarCorreo, correoConfigurado } from './correo';

export const ESTADOS_VISITA = ['AGENDADA', 'CANCELADA', 'REALIZADA'];

// ══════════════════════════════════════════════════════════════════════
// CÓDIGO DE VISITA  ·  VIS-2026-000123 — mismo mecanismo que
// nuevoCodigoReserva() en lib/reservas.js: una secuencia de Postgres,
// nunca se repite ni con dos familias agendando en el mismo segundo.
// ══════════════════════════════════════════════════════════════════════
export async function nuevoCodigoVisita() {
  const fila = await q1(
    `SELECT 'VIS-' || to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY')
         || '-' || lpad(nextval('visita_numero')::text, 6, '0') AS codigo`
  );
  return fila.codigo;
}

// ══════════════════════════════════════════════════════════════════════
// REGLAS DE DISPONIBILIDAD — puras, sin Postgres ni Calendar (§3, §5, §11)
//
// Solo decide "esta fecha+hora es una que el negocio ofrece", nunca "está
// ocupada": no existe esa segunda pregunta para visitas (§9, §11: "NO
// validar ¿Existe otra visita a esa hora? porque eso es irrelevante").
// El único motivo real para que un horario deje de ofrecerse, además de
// estas reglas, es un bloqueo operacional en Calendar — eso se revisa
// aparte, en disponibilidadVisitas()/crearVisita(), porque necesita red.
// ══════════════════════════════════════════════════════════════════════
export function validarSlotVisita(fecha, hora, hoy = new Date()) {
  const { horarios, horizonteSemanas, anticipacionMinMinutos } = NEGOCIO.visitas;

  const fechaStr = String(fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return { ok: false, motivo: 'fecha_invalida', mensaje: 'La fecha no es válida' };
  }
  const d = new Date(`${fechaStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, motivo: 'fecha_invalida', mensaje: 'La fecha no es válida' };
  }

  if (!esViernes(fechaStr)) {
    return { ok: false, motivo: 'dia_no_disponible', mensaje: 'Las visitas autoagendadas están disponibles solo los viernes. Coordina por WhatsApp para otro día.' };
  }

  if (!horarios.includes(hora)) {
    return { ok: false, motivo: 'horario_invalido', mensaje: 'Ese horario no está disponible para visitas.' };
  }

  const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (d < hoyMedianoche) {
    return { ok: false, motivo: 'fecha_pasada', mensaje: 'Esa fecha ya pasó.' };
  }

  const limite = new Date(hoyMedianoche);
  limite.setDate(limite.getDate() + horizonteSemanas * 7);
  if (d > limite) {
    return { ok: false, motivo: 'fuera_de_horizonte', mensaje: 'Esa fecha está fuera del horizonte de agendamiento disponible.' };
  }

  // Anticipación mínima: acá sí importa la hora exacta, no solo el día —
  // se ancla a America/Santiago con un offset fijo (-03:00), mismo
  // supuesto que ya usa el resto del proyecto para Google Calendar
  // (lib/calendario.js, rangoHorario): el país no cambia de huso horario.
  const slot = new Date(`${fechaStr}T${hora}:00-03:00`);
  if (Number.isNaN(slot.getTime())) {
    return { ok: false, motivo: 'horario_invalido', mensaje: 'Ese horario no es válido.' };
  }
  if (slot.getTime() - hoy.getTime() < anticipacionMinMinutos * 60_000) {
    return { ok: false, motivo: 'anticipacion_insuficiente', mensaje: 'Ese horario ya está muy próximo para autoagendar. Coordina por WhatsApp.' };
  }

  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════
// DISPONIBILIDAD PARA LA PANTALLA  (§9, §16)
//
// Enumera cada viernes dentro del horizonte y, para cada uno, los
// horarios que las reglas puras permiten — filtrando solo por fecha
// bloqueada en Calendar (CERRADO/BLOQUEADO), NUNCA por si ya hay otra
// visita agendada ahí. Ver tres visitas a las 10:00 en Calendar NO
// significa que la cuarta no se pueda ofrecer (§16).
// ══════════════════════════════════════════════════════════════════════
export async function disponibilidadVisitas(hoy = new Date()) {
  const { horarios, horizonteSemanas } = NEGOCIO.visitas;

  const bloqueados = await diasBloqueadosCalendar(horizonteSemanas * 7 + 7).catch(() => []);
  const bloqueadosSet = new Set(bloqueados);

  const cursor = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const limite = new Date(cursor);
  limite.setDate(limite.getDate() + horizonteSemanas * 7);

  const slots = [];
  for (const d = new Date(cursor); d <= limite; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 5) continue; // viernes
    const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (bloqueadosSet.has(fechaStr)) continue;

    const horariosDisponibles = horarios.filter((h) => validarSlotVisita(fechaStr, h, hoy).ok);
    if (horariosDisponibles.length) slots.push({ fecha: fechaStr, horarios: horariosDisponibles });
  }
  return slots;
}

// ══════════════════════════════════════════════════════════════════════
// CREAR LA VISITA  (§7, §10, §11)
//
// Validación server-side completa, IGUAL que crearReserva() nunca confía
// en lo que ya validó la pantalla (§11: "No confiar exclusivamente en
// UI"). A propósito no hay cerrojo ni comprobación de ocupación: la única
// pregunta es "¿esta fecha+hora la ofrece el negocio ahora mismo?", nunca
// "¿ya la tomó alguien?".
// ══════════════════════════════════════════════════════════════════════
export async function crearVisita({ fecha, hora, nombreAdulto, whatsapp, email, nombreFestejado, edadFestejado }) {
  const errores = [];

  const nombre = texto(nombreAdulto, 100).trim();
  if (!nombre) errores.push('Falta el nombre del adulto');

  const telNormalizado = normalizarTelefono(whatsapp);
  if (!telefonoValido(telNormalizado)) errores.push('El WhatsApp no es válido');

  const correo = texto(email, 200).trim().toLowerCase();
  if (!EMAIL.test(correo)) errores.push('El email no es válido');

  const festejado = texto(nombreFestejado, 100).trim() || null;
  const edad = texto(edadFestejado, 10).trim() || null;

  const fechaStr = String(fecha ?? '').slice(0, 10);
  const horaStr = texto(hora, 5).trim();

  const v = validarSlotVisita(fechaStr, horaStr);
  if (!v.ok) errores.push(v.mensaje);

  if (errores.length) return { ok: false, motivo: 'datos_invalidos', errores };

  // Único motivo real, además de las reglas puras, para negar el
  // horario: un bloqueo operacional explícito en Calendar (§5, §6).
  const bloqueados = await diasBloqueadosCalendar(NEGOCIO.visitas.horizonteSemanas * 7 + 7).catch(() => []);
  if (bloqueados.includes(fechaStr)) {
    return { ok: false, motivo: 'fecha_bloqueada', errores: ['Esa fecha no está disponible para visitas. Coordina por WhatsApp.'] };
  }

  const codigo = await nuevoCodigoVisita();
  const accesoToken = tokenAleatorio();

  const visita = await q1(
    `INSERT INTO visita (
       codigo, fecha_visita, hora_inicio, nombre_adulto, whatsapp, email,
       nombre_festejado, edad_festejado, estado, acceso_token, origen
     ) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [codigo, fechaStr, horaStr, nombre, telNormalizado, correo, festejado, edad, 'AGENDADA', accesoToken, 'web']
  );

  return { ok: true, visita };
}

export async function visitaPorCodigo(codigo) {
  return q1(`SELECT * FROM visita WHERE codigo = $1`, [codigo]);
}

export async function visitaPorId(id) {
  return q1(`SELECT * FROM visita WHERE id = $1`, [id]);
}

// ══════════════════════════════════════════════════════════════════════
// CANCELAR  (documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR
// BLOQUE B", 22-sep-2026, §4, §18)
//
// Actualiza la MISMA fila — nunca la borra (histórico). Idempotente ante
// doble click/reintento (§18): la segunda vez no encuentra una fila en
// AGENDADA para actualizar, así que no falla — relee el estado actual y
// devuelve `yaCancelada: true` en vez de un error. No existe hold que
// liberar (§4: "no existe hold que liberar") porque nunca existió uno.
// ══════════════════════════════════════════════════════════════════════
export async function cancelarVisita(visita) {
  if (visita.estado === 'CANCELADA') {
    return { ok: true, visita, yaCancelada: true };
  }
  if (visita.estado !== 'AGENDADA') {
    // Una visita REALIZADA ya ocurrió — cancelarla no tiene sentido de
    // negocio y no es uno de los casos que pide el documento.
    return { ok: false, motivo: 'no_se_puede_cancelar', estado: visita.estado };
  }

  const actualizada = await q1(
    `UPDATE visita SET estado = 'CANCELADA' WHERE id = $1 AND estado = 'AGENDADA' RETURNING *`,
    [visita.id]
  );
  if (actualizada) return { ok: true, visita: actualizada, yaCancelada: false };

  // El estado cambió entre la lectura y el UPDATE (doble click simultáneo,
  // dos pestañas) — se relee y se responde de forma estable, nunca un error.
  const actual = await visitaPorId(visita.id);
  return { ok: true, visita: actual, yaCancelada: actual?.estado === 'CANCELADA' };
}

// ══════════════════════════════════════════════════════════════════════
// REAGENDAR  (§6, §7, §18)
//
// Actualiza la MISMA fila: mismo codigo, mismo acceso_token, mismo id —
// nunca crea una visita nueva. Reutiliza EXACTAMENTE validarSlotVisita()
// y diasBloqueadosCalendar() de Bloque A — ningún motor paralelo (§6). NO
// valida cuántas otras visitas hay en el horario destino: eso es
// irrelevante (§6: "No validar cantidad de otras visitas"). Idempotente
// si el destino es el mismo día+hora que ya tenía (§7, §18): no genera un
// UPDATE innecesario ni lo trata como error.
// ══════════════════════════════════════════════════════════════════════
export async function reagendarVisita(visita, { fecha, hora }) {
  if (visita.estado !== 'AGENDADA') {
    return { ok: false, motivo: 'no_se_puede_reagendar', estado: visita.estado };
  }

  const fechaStr = String(fecha ?? '').slice(0, 10);
  const horaStr = texto(hora, 5).trim();

  const v = validarSlotVisita(fechaStr, horaStr);
  if (!v.ok) return { ok: false, motivo: v.motivo, errores: [v.mensaje] };

  const bloqueados = await diasBloqueadosCalendar(NEGOCIO.visitas.horizonteSemanas * 7 + 7).catch(() => []);
  if (bloqueados.includes(fechaStr)) {
    return { ok: false, motivo: 'fecha_bloqueada', errores: ['Esa fecha no está disponible para visitas. Coordina por WhatsApp.'] };
  }

  // Mismo día+hora que ya tenía: sin cambios, misma visita, no se toca la fila.
  if (fechaISO(visita.fecha_visita) === fechaStr && visita.hora_inicio === horaStr) {
    return { ok: true, visita, sinCambios: true };
  }

  const actualizada = await q1(
    `UPDATE visita SET fecha_visita = $2::date, hora_inicio = $3
      WHERE id = $1 AND estado = 'AGENDADA' RETURNING *`,
    [visita.id, fechaStr, horaStr]
  );
  if (actualizada) return { ok: true, visita: actualizada, sinCambios: false };

  const actual = await visitaPorId(visita.id);
  return { ok: false, motivo: 'no_se_puede_reagendar', estado: actual?.estado };
}

// ══════════════════════════════════════════════════════════════════════
// MARCAR REALIZADA  (admin /cadena, §11, §18)
//
// Idempotente: la segunda vez no encuentra fila en AGENDADA, relee y
// responde `yaEstaba: true` sin duplicar nada ni fallar. Nunca toca
// Calendar, reservas ni otras visitas (§11).
// ══════════════════════════════════════════════════════════════════════
export async function marcarVisitaRealizada(visitaId) {
  const actualizada = await q1(
    `UPDATE visita SET estado = 'REALIZADA', realizada_en = now()
      WHERE id = $1 AND estado = 'AGENDADA' RETURNING *`,
    [visitaId]
  );
  if (actualizada) return { ok: true, visita: actualizada, yaEstaba: false };

  const actual = await visitaPorId(visitaId);
  if (!actual) return { ok: false, motivo: 'visita_inexistente' };
  if (actual.estado === 'REALIZADA') return { ok: true, visita: actual, yaEstaba: true };
  return { ok: false, motivo: 'estado_invalido', estado: actual.estado };
}

// ══════════════════════════════════════════════════════════════════════
// PRÓXIMAS VISITAS  (panel /cadena, §9, §12, §13)
//
// Solo AGENDADA, desde ahora mismo hacia adelante — nunca CANCELADA
// (§12), nunca REALIZADA (§11: "deja de aparecer"), y nunca una AGENDADA
// cuya hora ya pasó hoy mismo (§13: sin inventar un estado NO_SHOW, la
// consulta simplemente deja de traerla). Las coincidentes se devuelven
// como filas independientes, sin agrupar como conflicto (§9).
// ══════════════════════════════════════════════════════════════════════
export async function visitasProximas() {
  return q(
    `SELECT * FROM visita
      WHERE estado = 'AGENDADA'
        AND (
          fecha_visita > (now() AT TIME ZONE 'America/Santiago')::date
          OR (
            fecha_visita = (now() AT TIME ZONE 'America/Santiago')::date
            AND hora_inicio >= to_char(now() AT TIME ZONE 'America/Santiago', 'HH24:MI')
          )
        )
      ORDER BY fecha_visita ASC, hora_inicio ASC, id ASC`
  );
}

// ══════════════════════════════════════════════════════════════════════
// CORREO DE CONFIRMACIÓN  (§14)
// Este NO es un correo contractual — reutiliza enviarCorreo() de
// lib/correo.js tal cual (Zoho, mismo remitente que boletas-pendientes).
// Si falla, quien llama (app/api/visitas) NO deshace la visita: la base
// de datos es la fuente de verdad, el correo es best-effort (§14).
// ══════════════════════════════════════════════════════════════════════
function fmtFechaLargaVisita(valor) {
  const d = new Date(`${fechaISO(valor)}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function enviarConfirmacionVisita(visita) {
  if (!correoConfigurado()) return { ok: false, motivo: 'correo_no_configurado' };

  const fechaLarga = fmtFechaLargaVisita(visita.fecha_visita);
  const link = `${NEGOCIO.sitio}/visitas/gestionar?id=${visita.codigo}&t=${visita.acceso_token}`;

  const textoPlano = [
    'Tu visita a Alce Kids está agendada',
    '',
    fechaLarga,
    visita.hora_inicio,
    NEGOCIO.direccion.completa,
    '',
    'Gestionar mi visita',
    link,
  ].join('\n');

  const html = `
    <p>Tu visita a Alce Kids está agendada</p>
    <p><strong>${fechaLarga}</strong><br>${visita.hora_inicio}<br>${NEGOCIO.direccion.completa}</p>
    <p><a href="${link}">Gestionar mi visita</a></p>
  `;

  await enviarCorreo({
    to: visita.email,
    subject: 'Tu visita a Alce Kids está agendada 🎈',
    text: textoPlano,
    html,
  });

  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════
// CORREO DE REAGENDA  (§8) — best-effort, mismo criterio que arriba: un
// fallo de SMTP nunca revierte el reagendamiento ya escrito en Postgres.
// ══════════════════════════════════════════════════════════════════════
export async function enviarReagendaVisita(visita) {
  if (!correoConfigurado()) return { ok: false, motivo: 'correo_no_configurado' };

  const fechaLarga = fmtFechaLargaVisita(visita.fecha_visita);
  const link = `${NEGOCIO.sitio}/visitas/gestionar?id=${visita.codigo}&t=${visita.acceso_token}`;

  const textoPlano = [
    'Tu visita a Alce Kids fue reagendada',
    '',
    fechaLarga,
    visita.hora_inicio,
    NEGOCIO.direccion.completa,
    '',
    'Gestionar mi visita',
    link,
  ].join('\n');

  const html = `
    <p>Tu visita a Alce Kids fue reagendada</p>
    <p><strong>${fechaLarga}</strong><br>${visita.hora_inicio}<br>${NEGOCIO.direccion.completa}</p>
    <p><a href="${link}">Gestionar mi visita</a></p>
  `;

  await enviarCorreo({
    to: visita.email,
    subject: 'Tu visita a Alce Kids fue reagendada 🎈',
    text: textoPlano,
    html,
  });

  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════
// CORREO DE CANCELACIÓN  (§8) — mismo criterio best-effort.
// ══════════════════════════════════════════════════════════════════════
export async function enviarCancelacionVisita(visita) {
  if (!correoConfigurado()) return { ok: false, motivo: 'correo_no_configurado' };

  const textoPlano = [
    'Tu visita fue cancelada correctamente.',
    '',
    'Si quieres venir otro día, puedes agendar una nueva visita cuando quieras.',
    `${NEGOCIO.sitio}/visitas`,
  ].join('\n');

  const html = `
    <p>Tu visita fue cancelada correctamente.</p>
    <p>Si quieres venir otro día, puedes agendar una nueva visita cuando quieras.</p>
    <p><a href="${NEGOCIO.sitio}/visitas">Agendar otra visita</a></p>
  `;

  await enviarCorreo({
    to: visita.email,
    subject: 'Tu visita a Alce Kids fue cancelada',
    text: textoPlano,
    html,
  });

  return { ok: true };
}
