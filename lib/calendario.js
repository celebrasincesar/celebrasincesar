// ══════════════════════════════════════════════════════════════════════
// ESPEJO EN GOOGLE CALENDAR  ·  lib/calendario.js
// ──────────────────────────────────────────────────────────────────────
// El calendario NO es la base de datos y NO es el cerrojo del turno
// (§1.10, §16, §30). Es el espejo operacional: lo que César mira en el
// teléfono el viernes en la mañana. La verdad está en Postgres.
//
// Por eso el evento se crea DESPUÉS de que el pago está confirmado, una
// sola vez, y si Google falla NO PASA NADA con la reserva: queda marcada
// para reintentar y el pago sigue siendo un pago. Nunca se revierte plata
// porque un calendario no respondió (§16).
//
// TÍTULO DEL EVENTO: empieza SIEMPRE con "RESERVADO AM" / "RESERVADO PM"
// porque /api/disponibilidad y /api/cadena (el listado de "La Cadena")
// reconocen el turno a partir de ese prefijo — es la señal que usan para
// saber qué está ocupado. Antes lo comparaban con `===` (exacto); desde el
// documento "Quiero mejorar urgentemente la información operativa…"
// (09-sep-2026) el título lleva además el festejado y el código —César
// necesita reconocer la celebración de un vistazo, sin abrir el panel—
// así que esos dos lugares pasaron a `startsWith('RESERVADO AM')` /
// `startsWith('RESERVADO PM')`: siguen reconociendo el turno igual de
// bien, ahora toleran el resto del título. Los datos completos del
// cliente van en la DESCRIPCIÓN, que esos endpoints no exponen: así César
// ve todo en su calendario sin que la web publique el teléfono de nadie.
//
// PERMISO NECESARIO: el service account tiene que tener compartido el
// calendario con permiso de "Hacer cambios en los eventos" (no solo
// lectura).
//
// SOLO PRODUCTION ESCRIBE EN EL CALENDARIO REAL (06-sep-2026). Preview y
// Sandbox usan el mismo GOOGLE_CALENDAR_ID —el calendario de verdad de
// las celebraciones— porque la disponibilidad necesita datos reales para
// probarse bien. Pero ESCRIBIR ahí desde Preview contaminó el calendario
// real con reservas de prueba y llegó a bloquear fechas reales en
// producción (encontrado en QA de esa misma sesión). Por eso
// sincronizarCalendario() nunca crea ni modifica un evento salvo que
// `VERCEL_ENV === 'production'`: la lectura (disponibilidad, en otro
// archivo) sigue igual en todos los ambientes, solo la escritura queda
// exclusiva de Production.
//
// POR QUÉ ESTO HABLA REST DIRECTO Y NO USA `googleapis` PARA ESCRIBIR:
// con el permiso de Editor ya otorgado, `calendar.events.insert()` de la
// librería `googleapis` (v171.4.0) seguía devolviendo 400 "Bad Request"
// sin ninguna razón útil en el error. La misma petición, con el mismo
// token, hecha con `fetch()` directo a la API REST, funcionó a la
// primera. No vale la pena perseguir un bug de la librería cuando la API
// documentada responde bien — encontrado y resuelto en QA, 06-sep-2026.
// La lectura de disponibilidad (otro archivo, otro scope) no se toca:
// esa nunca falló.
// ══════════════════════════════════════════════════════════════════════

import { google } from 'googleapis';
import { q, q1 } from './db';
import { registrarEvento, fechaISO, detalleDeReserva, festejadoDeReserva } from './reservas';
import { tramoInvitadosPorId } from '../data/reglas';
import { datosFinalesVigentes } from './datos-finales';
import { pendientesDeReserva } from './pendientes-proveedor';

const ZONA = 'America/Santiago';

export function calendarioConfigurado(env = process.env) {
  return !!(env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    && env.GOOGLE_PRIVATE_KEY
    && env.GOOGLE_CALENDAR_ID
    && env.GOOGLE_CALENDAR_ID !== 'INGRESA_TU_CALENDAR_ID_AQUI');
}

// `VERCEL_ENV` lo inyecta Vercel solo: 'production' | 'preview' |
// 'development'. Localmente (npm run dev) no existe, y por eso el default
// es "no escribir" — el mismo criterio de "por defecto denegar" que ya
// usa el resto del proyecto para pagos y disponibilidad.
export function escrituraCalendarHabilitada(env = process.env) {
  return env.VERCEL_ENV === 'production';
}

let _auth = null;
function clienteAuth() {
  if (!_auth) {
    _auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });
  }
  return _auth;
}

// POST/PUT directo a la API REST de Calendar. Lanza un error con el texto
// real que devolvió Google —no el genérico de la librería— si algo falla.
// Exportada (Fase 3A, Bloque A): lib/calendario-visita.js la reutiliza tal
// cual para el evento independiente de visitas — nunca reimplementa la
// llamada REST.
export async function peticionCalendar(metodo, ruta, cuerpo) {
  const { token } = await clienteAuth().getAccessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  if (!res.ok) {
    const err = new Error(`Google Calendar ${metodo} ${ruta}: HTTP ${res.status} ${texto.slice(0, 300)}`);
    err.status = res.status;
    err.cuerpoRespuesta = texto;
    throw err;
  }
  return texto ? JSON.parse(texto) : {};
}

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

// Pura, sin red ni Postgres: decide UPDATE o CREATE. Es la garantía entera
// de "1 reserva = 1 evento" (§4 del documento "Quiero mejorar urgentemente
// la información operativa…", 09-sep-2026) — si la reserva ya tiene
// `calendar_event_id`, SIEMPRE se actualiza ese mismo evento, nunca se crea
// uno nuevo. Se exporta para poder probarla directamente, sin mocks de
// Google ni tocar el gate de `escrituraCalendarHabilitada()`.
export function metodoCalendar(reserva) {
  return reserva.calendar_event_id ? 'PUT' : 'POST';
}

// Título del evento: el prefijo "RESERVADO AM/PM" es la señal que leen
// /api/disponibilidad y /api/cadena (ver nota arriba) — nunca se toca, ni
// siquiera en el Bloque 2 ("mantenerlo simple", documento "FASE 2B —
// IMPLEMENTAR BLOQUE 2", 21-sep-2026, §10): cambiar ese prefijo rompería
// silenciosamente la disponibilidad en vivo del sitio — se simplificó
// todo lo demás (se sacó "ALCE KIDS", se agregó 🎉) pero el prefijo que
// decide qué turno está ocupado no se toca jamás.
export function tituloEvento(reserva) {
  const festejado = festejadoDeReserva(reserva) || reserva.cliente_nombre;
  return `RESERVADO ${reserva.turno} · 🎉 ${festejado} · ${reserva.codigo}`;
}

const ETIQUETA_ESTADO_PENDIENTE = {
  PENDIENTE: 'PENDIENTE', REVISAR_DESPUES: 'REVISANDO', CONFIRMADO: 'CONFIRMADA', NO_DISPONIBLE: 'NO DISPONIBLE',
};

function fmtFechaLarga(valor) {
  const d = new Date(`${fechaISO(valor)}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtFechaHora(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fecha} · ${hora}`;
}

// Lo que César necesita leer de un toque, sin abrir el panel: la
// configuración VIGENTE (detalleDeReserva ya resuelve snapshot_vigente ??
// snapshot), los Datos Finales más recientes y el estado de cada pendiente
// con proveedor (documento "FASE 2B — IMPLEMENTAR BLOQUE 2", 21-sep-2026,
// §11). `datosFinales`/`pendientes` se pasan YA leídos — esta función
// sigue sin tocar Postgres, sincronizarCalendario() hace las lecturas.
//
// Se mantienen Festejado/Apoderado/Teléfono del papá (no estaban en el
// ejemplo del documento, pero son la información operativa que César
// necesita para llamar a alguien desde el calendario sin abrir el panel —
// ninguno de los dos está en la lista explícita de "No incluir" del
// documento, así que quitarlos habría sido una regresión real, no una
// simplificación).
export function descripcion(reserva, { datosFinales = null, pendientes = [] } = {}) {
  const saldo = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const d = detalleDeReserva(reserva);
  const festejado = d.festejado || reserva.cliente_nombre;
  // RETIRADO nunca debe aparecer como adicional activo ni como alerta acá
  // (mismo criterio que resumenMiCelebracion() y /cadena, §2).
  const activos = (pendientes || []).filter((p) => p.estado !== 'RETIRADO');

  const lineas = [
    '🎉 CELEBRACIÓN', '',
    `Código: ${reserva.codigo}`,
    `Festejado/a: ${festejado}${d.edad != null ? ` · ${d.edad} años` : ''}`,
    `Apoderado: ${reserva.cliente_nombre} · ${reserva.cliente_telefono}`,
    fmtFechaLarga(reserva.fecha_evento),
    `${reserva.hora_inicio || '—'}–${reserva.hora_termino || '—'}`,
    reserva.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo',
  ];

  // NO_DISPONIBLE requiere acción humana — se destaca arriba, cerca del
  // encabezado, para que no haya que leer toda la descripción para verlo
  // (documento §11: "Si un proveedor está NO_DISPONIBLE, hacerlo visible").
  const noDisponibles = activos.filter((p) => p.estado === 'NO_DISPONIBLE');
  if (noDisponibles.length) {
    lineas.push('', ...noDisponibles.map((p) => {
      const item = d.adicionales.find((a) => a.id === p.item_id);
      const nombre = p.tipo === 'decoracion_tematica'
        ? `Decoración temática — ${p.detalle || ''}`.trim()
        : (item?.nombre || p.item_id);
      return `⚠ ${nombre} — NO DISPONIBLE / resolver`;
    }));
  }

  lineas.push(
    '', 'ASISTENCIA',
    `Contratación vigente: ${tramoInvitadosPorId(d.tramoInvitados)?.corto || `${reserva.ninos} niños`}`,
    datosFinales ? `Final informada: ${datosFinales.ninos_final} niños` : 'Final informada: pendiente',
  );
  if (datosFinales) {
    lineas.push(`7+ años: ${datosFinales.mayores_final}`, `Adultos aprox.: ${datosFinales.adultos_aprox}`);
  }

  // El Pack Celebra Sin Cesar se cobra como línea del precio pero NO es un
  // ítem del catálogo (hallazgo real 06-oct-2026, CSC-2026-000012: $60.000
  // que no aparecían en ningún lado). Incluye decoración — hay que prepararlo.
  if (d.pack) {
    lineas.push('', '🎀 PACK CELEBRA SIN CESAR',
      `• ${d.pack.nombre}${d.pack.precio != null ? ` — ${clp(d.pack.precio)}` : ''}`,
      `  Incluye: ${d.pack.incluye}`,
      '  ⚠ Preparar decoración (piñata y arco de globos); temática no registrada');
  }

  if (d.adicionales.length) {
    lineas.push('', 'ADICIONALES', ...d.adicionales.map((a) => {
      // Un ítem sujeto a proveedor lleva su estado anotado; los demás
      // (inflables, juegos, banquetería) se muestran tal como siempre.
      const pendiente = activos.find((p) => p.item_id === a.id);
      if (!pendiente) return `• ${a.nombre}${a.precio != null ? ` — ${clp(a.precio)}` : ''}`;
      const nombre = pendiente.tipo === 'decoracion_tematica'
        ? `Decoración temática — ${pendiente.detalle || a.nombre}`
        : a.nombre;
      return `• ${nombre} — ${ETIQUETA_ESTADO_PENDIENTE[pendiente.estado] || pendiente.estado}`;
    }));
  }

  if (d.incluidos.length) {
    lineas.push('', '✅ PREPARAR / INCLUIDOS', ...d.incluidos.map((i) => i.nombre));
  }

  // Desglose línea por línea: para entender de un vistazo por qué el total
  // es el que es (arriendo abierto en base/niños/edad, cumpleaños compartido,
  // pack, adicionales), sin abrir el panel.
  if (d.desglose?.length) {
    lineas.push('', '🧾 DESGLOSE DEL TOTAL', ...d.desglose.map((l) => `${l.parte ? '   · ' : ''}${l.concepto}: ${clp(l.monto)}`));
  }

  lineas.push(
    '', 'PAGOS',
    `Total actualizado: ${clp(reserva.total)}`,
    `Pagado: ${clp(reserva.pagado)}`,
    saldo > 0 ? `Saldo: ${clp(saldo)}` : 'Pagada completa',
  );

  lineas.push('', 'DATOS FINALES');
  lineas.push(...(datosFinales ? ['Confirmados ✓', fmtFechaHora(datosFinales.confirmado_en)] : ['Pendientes']));

  if (datosFinales?.adulto_responsable) {
    lineas.push('', 'RESPONSABLE DEL DÍA', datosFinales.adulto_responsable, datosFinales.telefono_operacional || '');
  }

  // Reservas manuales (panel) guardan el nombre del festejado y la
  // referencia de la cotización en `notas` — sigue apareciendo tal cual.
  if (reserva.notas) lineas.push('', reserva.notas);

  return lineas.join('\n');
}

// Horario del evento en hora de Santiago. Si por algo faltara la hora, se
// usa el horario estándar del turno: un evento sin hora es un evento que
// no sirve para nada en el teléfono.
function rangoHorario(reserva) {
  const fecha = fechaISO(reserva.fecha_evento);
  // Fase 5 Bloque 1: el PM base pasó de 15:00–18:00 a 16:00–19:00. Este
  // fallback nunca debería dispararse para una reserva real (hora_inicio/
  // hora_termino siempre se escriben al crearla) — si alguna vez falta,
  // asume el horario base VIGENTE, no uno histórico.
  const inicio = reserva.hora_inicio || (reserva.turno === 'AM' ? '11:00' : '16:00');
  const termino = reserva.hora_termino || (reserva.turno === 'AM' ? '14:00' : '19:00');
  return {
    start: { dateTime: `${fecha}T${inicio}:00`, timeZone: ZONA },
    end: { dateTime: `${fecha}T${termino}:00`, timeZone: ZONA },
  };
}

// ══════════════════════════════════════════════════════════════════════
// SINCRONIZAR
//
// Idempotente por diseño: si la reserva ya tiene calendar_event_id, se
// ACTUALIZA ese evento en vez de crear otro. Dos notificaciones de Flow no
// pueden dejar dos celebraciones en el calendario de César (§15.3, §16).
//
// Nunca lanza: devuelve el resultado. Quien llama está en medio de un
// webhook de pago y no puede fallar por esto.
// ══════════════════════════════════════════════════════════════════════
export async function sincronizarCalendario(reservaId) {
  const reserva = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaId]);
  if (!reserva) return { ok: false, motivo: 'reserva_inexistente' };

  if (!calendarioConfigurado()) {
    await marcarEstado(reservaId, 'SIN_CONFIGURAR');
    return { ok: false, motivo: 'sin_configurar' };
  }

  if (!escrituraCalendarHabilitada()) {
    // No es un error: es la regla. El pago y la reserva siguen su curso
    // normal, solo que este ambiente no toca el calendario real.
    await marcarEstado(reservaId, 'PREVIEW');
    return { ok: true, motivo: 'preview_sin_escritura', eventId: null };
  }

  const [datosFinales, pendientes] = await Promise.all([
    datosFinalesVigentes(reservaId),
    pendientesDeReserva(reservaId),
  ]);

  const cuerpo = {
    summary: tituloEvento(reserva),
    description: descripcion(reserva, { datosFinales, pendientes }),
    ...rangoHorario(reserva),
  };

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  let eventId = reserva.calendar_event_id;

  try {
    if (metodoCalendar(reserva) === 'PUT') {
      await peticionCalendar(
        'PUT',
        `calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        cuerpo
      );
    } else {
      const creado = await peticionCalendar(
        'POST',
        `calendars/${encodeURIComponent(calendarId)}/events`,
        cuerpo
      );
      eventId = creado.id;
      await q(
        `UPDATE reserva SET calendar_event_id = $2, calendar_estado = 'OK', actualizada = now()
          WHERE id = $1 AND calendar_event_id IS NULL`,
        [reservaId, eventId]
      );
    }

    await marcarEstado(reservaId, 'OK');
    await registrarEvento({
      reservaId, tipo: 'CALENDARIO_SINCRONIZADO', referencia: eventId,
    });
    return { ok: true, eventId };

  } catch (err) {
    // El pago sigue pagado y la reserva confirmada. Solo el espejo quedó
    // atrasado, y el panel lo muestra para poder reintentar (§16, §24).
    console.error(`[calendario] Reserva ${reserva.codigo}: ${err.message}`);
    await marcarEstado(reservaId, 'ERROR');
    await registrarEvento({
      reservaId, tipo: 'CALENDARIO_ERROR', detalle: { error: err.message.slice(0, 300) },
    });
    return { ok: false, motivo: 'error_google', error: err.message };
  }
}

async function marcarEstado(reservaId, estado) {
  try {
    await q(`UPDATE reserva SET calendar_estado = $2 WHERE id = $1`, [reservaId, estado]);
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════
// BLOQUEOS DE DÍA COMPLETO (CERRADO/BLOQUEADO)  ·  Fase 3A Bloque A
// ──────────────────────────────────────────────────────────────────────
// Mismo convenio que ya usa /api/disponibilidad (César crea un evento
// titulado "CERRADO" o "BLOQUEADO" para cerrar un día completo) — el
// documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026, §5) pide reutilizar ese mecanismo, no crear un segundo
// sistema de blackouts. A propósito NO mira "RESERVADO AM/PM": una
// celebración nunca bloquea una visita (§16 del documento) — solo un
// bloqueo operacional explícito quita disponibilidad de visita.
// ══════════════════════════════════════════════════════════════════════
let _cacheBloqueos = null;
let _cacheBloqueosTime = 0;
const CACHE_BLOQUEOS_TTL = 30_000;

export async function diasBloqueadosCalendar(dias = 60) {
  if (!calendarioConfigurado()) return [];
  if (_cacheBloqueos && Date.now() - _cacheBloqueosTime < CACHE_BLOQUEOS_TTL) return _cacheBloqueos;

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const ahora = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);

    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: ahora.toISOString(),
      timeMax: limite.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });

    const bloqueados = new Set();
    for (const evento of res.data.items || []) {
      const titulo = (evento.summary || '').toUpperCase().trim();
      if (titulo !== 'CERRADO' && titulo !== 'BLOQUEADO') continue;
      const raw = evento.start?.date || evento.start?.dateTime;
      if (!raw) continue;
      const fechaStr = raw.length === 10 ? raw : new Date(raw).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
      bloqueados.add(fechaStr);
    }
    _cacheBloqueos = Array.from(bloqueados);
    _cacheBloqueosTime = Date.now();
    return _cacheBloqueos;
  } catch (err) {
    console.error('[calendario] Error al leer bloqueos:', err.message);
    return _cacheBloqueos || [];
  }
}

// Reservas confirmadas cuyo espejo quedó atrasado. Las muestra el panel
// con un botón para reintentar.
export async function calendariosPendientes() {
  return q(
    // 'PREVIEW' no entra: nunca se va a resolver solo porque este
    // ambiente no escribe en el calendario real, y listarlo como
    // "pendiente" sería ruido, no una alerta real.
    `SELECT id, codigo, fecha_evento, turno, calendar_estado
       FROM reserva
      WHERE estado IN ('CONFIRMED','BALANCE_PENDING','PAID')
        AND (calendar_event_id IS NULL OR calendar_estado NOT IN ('OK', 'PREVIEW'))
      ORDER BY fecha_evento`
  );
}

// ¿Qué eventos del calendario ya ocupan ese turno? Misma regla que
// /api/disponibilidad (el prefijo del título decide): "RESERVADO AM/PM…"
// bloquea ese turno, "CERRADO"/"BLOQUEADO" el día completo. Se usa antes
// de mover una reserva, para no encimarla sobre algo que César ya anotó a
// mano. `excluirEventId` es el evento de la propia reserva. Si el
// calendario no está configurado devuelve { verificado: false } — la ruta
// lo informa, nunca lo trata como "libre".
export async function eventosQueOcupanTurno({ fecha, turno, excluirEventId = null }) {
  if (!calendarioConfigurado()) return { verificado: false, eventos: [] };
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const d = new Date(`${fecha}T12:00:00Z`);
  const desde = new Date(d.getTime() - 36 * 3_600_000).toISOString();
  const hasta = new Date(d.getTime() + 36 * 3_600_000).toISOString();
  const r = await peticionCalendar(
    'GET',
    `calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&maxResults=100&timeMin=${encodeURIComponent(desde)}&timeMax=${encodeURIComponent(hasta)}`
  );
  const aFecha = (x) => (!x ? null : x.length === 10 ? x : new Date(x).toLocaleDateString('en-CA', { timeZone: ZONA }));
  const eventos = (r.items || []).filter((e) => {
    if (e.id === excluirEventId || e.status === 'cancelled') return false;
    if (aFecha(e.start?.date || e.start?.dateTime) !== fecha) return false;
    const t = (e.summary || '').toUpperCase().trim();
    return t === 'CERRADO' || t === 'BLOQUEADO' || t.startsWith(`RESERVADO ${turno}`);
  }).map((e) => ({ id: e.id, titulo: e.summary }));
  return { verificado: true, eventos };
}
