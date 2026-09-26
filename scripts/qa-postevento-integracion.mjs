// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — POSTEVENTO  ·  node scripts/qa-postevento-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE A" (24-sep-2026),
// §17/§19. Mismo patrón que scripts/qa-bloque3-integracion.mjs: Postgres
// real (Sandbox/Preview), evento en un sábado lejano y reservable, y un
// "hoy" simulado (fechaEvento + N días) inyectado a las funciones.
// El enlace de reseña de los tests se INYECTA por parámetro: nunca se
// guarda como configuración real.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);

function cargarEnvLocal() {
  const ruta = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, clave, valorCrudo] = m;
    if (process.env[clave]) continue;
    process.env[clave] = valorCrudo.replace(/^"(.*)"$/, '$1');
  }
}
cargarEnvLocal();

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log('\nQA de integración Postevento — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q } = await import('../lib/db.js');
const { crearReserva, reservaPorCodigo } = await import('../lib/reservas.js');
const {
  ejecutarPostevento, marcarPosteventoGestionado, tareasPostevento, registrarEventoUnico, TIPO_EVENTO_POSTEVENTO,
} = await import('../lib/postevento.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

const URL_QA = 'https://example.test/qa-resena';

// Sábado bien lejano, distinto por prueba (nunca choca con datos reales).
const SABADO_BASE = new Date('2028-09-02T12:00:00.000Z');
let contadorFechas = 0;
function fechaEventoSiguiente() {
  const d = new Date(SABADO_BASE.getTime() + contadorFechas * 7 * 86_400_000);
  contadorFechas++;
  return d;
}

const CLIENTE = { nombre: 'QATEST Postevento', email: 'qatest@celebrasincesar.cl', telefono: '+56900000004' };

const filasCreadas = [];
async function limpiar() {
  for (const codigo of filasCreadas) {
    // pago_evento.reserva_id no es FK: se borran los eventos de prueba a mano.
    await q(`DELETE FROM pago_evento WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [codigo]).catch(() => {});
    await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
    await q(`DELETE FROM reserva WHERE codigo = $1`, [codigo]).catch(() => {});
  }
}

// `diasDesde`: cuántos días pasaron desde el evento en el "hoy" simulado
// devuelto (negativo = evento futuro).
async function crearReservaPrueba({ diasDesde, estado = 'BALANCE_PENDING' }) {
  const fechaEvento = fechaEventoSiguiente();
  const fechaISOEvento = fechaEvento.toISOString().slice(0, 10);
  const r = await crearReserva({
    configuracion: {
      fecha: `${fechaISOEvento}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
      tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
      extras: [], tematica: null, horasAdicionales: 0, nombreNino: 'Antonia QA',
    },
    cliente: CLIENTE, aceptaTyc: true,
  });
  if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
  filasCreadas.push(r.reserva.codigo);
  await q(`UPDATE reserva SET estado = $2, pagado = $3 WHERE id = $1`, [r.reserva.id, estado, Math.round(r.reserva.anticipo)]);

  const hoy = new Date(fechaEvento.getTime() + diasDesde * 86_400_000);
  const reserva = await reservaPorCodigo(r.reserva.codigo);
  return { reserva, hoy };
}

async function eventosDe(reservaId) {
  const filas = await q(`SELECT tipo FROM pago_evento WHERE reserva_id = $1 ORDER BY id`, [reservaId]);
  return filas.map((f) => f.tipo);
}
const cuenta = (eventos, tipo) => eventos.filter((t) => t === tipo).length;

try {

  // ── Ventana T+1 / T+2 ──────────────────────────────────────────────────
  await T('T+1: evento ayer → una tarea CREADA', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1);
  });

  await T('T+2: evento hace 2 días sin tarea previa → crea (recuperación)', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 2 });
    await ejecutarPostevento(hoy);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1);
  });

  await T('T+0, T+3 y futuro: no crean tarea', async () => {
    for (const diasDesde of [0, 3, -1]) {
      const { reserva, hoy } = await crearReservaPrueba({ diasDesde });
      await ejecutarPostevento(hoy);
      eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 0, `diasDesde=${diasDesde}`);
    }
  });

  await T('Anti-avalancha: celebraciones de hace 7, 30 y 60 días → cero tareas', async () => {
    for (const diasDesde of [7, 30, 60]) {
      const { reserva, hoy } = await crearReservaPrueba({ diasDesde });
      await ejecutarPostevento(hoy);
      eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 0, `diasDesde=${diasDesde}`);
    }
  });

  // ── Estados y activación ──────────────────────────────────────────────
  await T('Reservas CANCELLED / EXPIRED / REFUNDED en T+1 no crean tarea', async () => {
    for (const estado of ['CANCELLED', 'EXPIRED', 'REFUNDED']) {
      const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1, estado });
      await ejecutarPostevento(hoy);
      eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 0, estado);
    }
  });

  await T('Activación: con POSTEVENTO_ACTIVO_DESDE posterior a hoy no se crea nada', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy, { activoDesde: '2999-01-01' });
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 0);
  });

  // ── Idempotencia ───────────────────────────────────────────────────────
  await T('Idempotencia: cron 1, 2 y 5 veces → una sola fila CREADA', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1, 'tras 1 corrida');
    await ejecutarPostevento(hoy);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1, 'tras 2 corridas');
    for (let i = 0; i < 3; i++) await ejecutarPostevento(hoy);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1, 'tras 5 corridas');
  });

  await T('Idempotencia: T+1 creada y luego corrida en T+2 → sigue habiendo una sola CREADA', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    await ejecutarPostevento(new Date(hoy.getTime() + 86_400_000));
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1);
  });

  // ── Lista /cadena y enlace ausente ─────────────────────────────────────
  await T('Sin enlace de reseña (inyectado null): la tarea existe, sin mensaje, y no se puede gestionar', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);

    const lista = await tareasPostevento(hoy, { googleReviewUrl: null });
    eq(lista.linkConfigurado, false);
    const tarea = lista.tareas.find((t) => t.reservaId === reserva.id);
    yes(tarea, 'la tarea debe aparecer');
    eq(tarea.mensaje, null, 'sin enlace no hay mensaje');
    eq(tarea.diasDesdeEvento, 1);

    const r = await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: null });
    eq(r.ok, false);
    eq(r.motivo, 'link_resena_no_configurado');
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 0, 'no se registra gestión falsa');
  });

  await T('Con la configuración real (Bloque B): enlace oficial, mensaje con el enlace y Marcar gestionado habilitado; abrir/copiar no registran nada', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);

    const lista = await tareasPostevento(hoy); // sin inyección: NEGOCIO.postevento.googleReviewUrl
    eq(lista.linkConfigurado, true);
    const tarea = lista.tareas.find((t) => t.reservaId === reserva.id);
    yes(tarea.mensaje.includes('https://g.page/r/CVdcUHxqMikJEBM/review'));
    yes(!tarea.mensaje.includes('google.com/maps'), 'nunca el URL de Maps');

    // Leer la lista (lo que hace la pantalla al abrir WhatsApp/copiar) no crea eventos.
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 0);

    const r = await marcarPosteventoGestionado({ reservaId: reserva.id });
    yes(r.ok);
    const r2 = await marcarPosteventoGestionado({ reservaId: reserva.id });
    eq(r2.yaEstaba, true);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 1);
    const despues = await tareasPostevento(hoy);
    yes(!despues.tareas.some((t) => t.reservaId === reserva.id), 'gestionada desaparece');
  });

  await T('Sin festejado real: el mensaje usa la variante natural (no el nombre del apoderado ni "undefined")', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await q(`UPDATE reserva SET snapshot = '{}'::jsonb, snapshot_vigente = NULL WHERE id = $1`, [reserva.id]);
    await ejecutarPostevento(hoy);
    const lista = await tareasPostevento(hoy);
    const tarea = lista.tareas.find((t) => t.reservaId === reserva.id);
    yes(tarea.mensaje.includes('Esperamos que hayan disfrutado mucho su celebración en Alce Kids.'));
    yes(!/undefined|QATEST/.test(tarea.mensaje));
  });

  await T('Con enlace inyectado: el mensaje incluye la URL y el festejado; gestionar saca la tarea de la lista', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);

    const lista = await tareasPostevento(hoy, { googleReviewUrl: URL_QA });
    eq(lista.linkConfigurado, true);
    const tarea = lista.tareas.find((t) => t.reservaId === reserva.id);
    yes(tarea.mensaje.includes(URL_QA));
    yes(tarea.mensaje.includes(tarea.festejado));

    const r = await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA });
    yes(r.ok);
    eq(r.yaEstaba, false);

    const despues = await tareasPostevento(hoy, { googleReviewUrl: URL_QA });
    yes(!despues.tareas.some((t) => t.reservaId === reserva.id), 'gestionada desaparece de la lista activa');
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1, 'el histórico se conserva');
  });

  await T('Marcar gestionado dos veces → una sola fila GESTIONADA', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    const a = await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA });
    const b = await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA });
    yes(a.ok && b.ok);
    eq(b.yaEstaba, true);
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 1);
  });

  // ── CONCURRENCIA REAL (microcerramiento de idempotencia): cada intento
  // es una petición HTTP independiente a Postgres (driver de Neon), lanzada
  // a la vez con Promise.all — no un loop secuencial. La garantía es el
  // índice UNIQUE parcial pago_evento_postevento_uk + ON CONFLICT DO NOTHING.
  const N = 20;

  await T('Índice UNIQUE parcial existe y es parcial (solo los dos tipos de postevento)', async () => {
    const [ix] = await q(`SELECT indexdef FROM pg_indexes WHERE indexname = 'pago_evento_postevento_uk'`);
    yes(ix, 'falta pago_evento_postevento_uk');
    yes(/UNIQUE/.test(ix.indexdef) && /reserva_id, tipo/.test(ix.indexdef));
    yes(ix.indexdef.includes('POSTEVENTO_TAREA_WHATSAPP_CREADA') && ix.indexdef.includes('POSTEVENTO_TAREA_WHATSAPP_GESTIONADA'));
  });

  await T(`${N} INSERT concurrentes de POSTEVENTO_TAREA_WHATSAPP_CREADA (sin SELECT previo) → 1 fila`, async () => {
    const { reserva } = await crearReservaPrueba({ diasDesde: 1 });
    const rs = await Promise.all(Array.from({ length: N }, () =>
      registrarEventoUnico({ reservaId: reserva.id, tipo: TIPO_EVENTO_POSTEVENTO.CREADA, referencia: reserva.codigo })));
    eq(rs.filter((r) => r.insertado).length, 1, 'solo una petición inserta');
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1);
  });

  await T(`${N} INSERT concurrentes de POSTEVENTO_TAREA_WHATSAPP_GESTIONADA (sin SELECT previo) → 1 fila`, async () => {
    const { reserva } = await crearReservaPrueba({ diasDesde: 1 });
    const rs = await Promise.all(Array.from({ length: N }, () =>
      registrarEventoUnico({ reservaId: reserva.id, tipo: TIPO_EVENTO_POSTEVENTO.GESTIONADA })));
    eq(rs.filter((r) => r.insertado).length, 1, 'solo una petición inserta');
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 1);
  });

  await T(`${N} cron concurrentes (ejecutarPostevento) sobre la misma reserva → 1 CREADA`, async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await Promise.all(Array.from({ length: N }, () => ejecutarPostevento(hoy)));
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.CREADA), 1);
  });

  await T(`${N} "Marcar gestionado" concurrentes (flujo completo) → 1 GESTIONADA y una sola respuesta yaEstaba:false`, async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    const rs = await Promise.all(Array.from({ length: N }, () =>
      marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA })));
    for (const r of rs) yes(r.ok);
    eq(rs.filter((r) => r.yaEstaba === false).length, 1, 'exactamente una gestión "nueva"');
    eq(cuenta(await eventosDe(reserva.id), TIPO_EVENTO_POSTEVENTO.GESTIONADA), 1);
  });

  await T('Un error real de escritura NO se traga como "ya existía" (solo el conflicto de unicidad es idempotencia)', async () => {
    let lanzo = false;
    try {
      await registrarEventoUnico({ reservaId: 'no-es-un-numero', tipo: TIPO_EVENTO_POSTEVENTO.CREADA });
    } catch { lanzo = true; }
    yes(lanzo, 'un fallo de escritura debe propagarse, no devolver {insertado:false}');
    const { reserva } = await crearReservaPrueba({ diasDesde: 1 });
    await registrarEventoUnico({ reservaId: reserva.id, tipo: TIPO_EVENTO_POSTEVENTO.GESTIONADA });
    const dup = await registrarEventoUnico({ reservaId: reserva.id, tipo: TIPO_EVENTO_POSTEVENTO.GESTIONADA });
    eq(dup.insertado, false, 'el conflicto válido sí es idempotencia');
  });

  await T('El índice es parcial: otros tipos de pago_evento siguen pudiendo repetirse por reserva', async () => {
    const { reserva } = await crearReservaPrueba({ diasDesde: 1 });
    for (let i = 0; i < 3; i++) {
      await q(`INSERT INTO pago_evento (reserva_id, tipo) VALUES ($1, 'QA_TIPO_REPETIBLE')`, [reserva.id]);
    }
    eq(cuenta(await eventosDe(reserva.id), 'QA_TIPO_REPETIBLE'), 3);
  });

  await T('Marcar gestionado sin tarea creada → tarea_no_creada, sin evento', async () => {
    const { reserva } = await crearReservaPrueba({ diasDesde: 5 });
    const r = await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA });
    eq(r.ok, false);
    eq(r.motivo, 'tarea_no_creada');
    const eventos = await eventosDe(reserva.id); // incluye RESERVA_CREADA, propio de crearReserva
    eq(eventos.filter((t) => t.startsWith('POSTEVENTO_')).length, 0);
  });

  // ── WhatsApp nunca "enviado" ───────────────────────────────────────────
  await T('Ningún evento de postevento afirma enviado / entregado / reseña realizada', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasDesde: 1 });
    await ejecutarPostevento(hoy);
    await marcarPosteventoGestionado({ reservaId: reserva.id, googleReviewUrl: URL_QA });
    const eventos = await eventosDe(reserva.id);
    yes(eventos.length > 0);
    for (const tipo of eventos) yes(!/ENVIADO|ENTREGADO|REALIZADA/.test(tipo), tipo);
  });

} finally {
  await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
}

console.log(`\n  QA de integración Postevento — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
