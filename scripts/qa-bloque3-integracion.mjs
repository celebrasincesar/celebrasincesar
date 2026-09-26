// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — BLOQUE 3 (ciclo previo al evento)
// node scripts/qa-bloque3-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Mismo patrón que scripts/qa-bloque2-integracion.mjs: corre contra
// Postgres real (Sandbox/Preview), crea sus propias filas de prueba y las
// borra al terminar. Se salta solo si no hay base configurada.
//
// Documento "FASE 2B — IMPLEMENTAR BLOQUE 3", 22-sep-2026, §21: cron
// (a través de ejecutarCicloPrevio(), no la ruta HTTP — mismo criterio
// que el resto del proyecto: las rutas nunca se prueban con QA, solo la
// lógica que llaman), idempotencia, T-7/T-4/T-1, última hora,
// obsolescencia.
//
// NEGOCIO.dias es solo viernes/sábado/domingo — "hoy real + N días" casi
// nunca cae en una fecha reservable. Por eso cada prueba usa una fecha de
// evento REAL y reservable (un sábado lejano, uno distinto por prueba,
// mismo criterio que Bloque 1/2) y un "hoy" SIMULADO calculado aparte
// (fechaEvento − diasEvento), pasado explícitamente a ejecutarCicloPrevio()/
// accionesProximas() — ambas aceptan `hoy` para esto exacto.
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
  console.log('\nQA de integración Bloque 3 — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q } = await import('../lib/db.js');
const { crearReserva, reservaPorCodigo } = await import('../lib/reservas.js');
const { guardarDatosFinales } = await import('../lib/datos-finales.js');
const {
  ejecutarCicloPrevio, marcarTareaGestionada, accionesProximas, TIPO_EVENTO,
} = await import('../lib/ciclo-previo.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Sábado bien lejano, distinto por prueba — mismo criterio que Bloque 1/2:
// nunca choca con datos reales ni con otra corrida de esta misma suite.
const SABADO_BASE = new Date('2028-03-04T12:00:00.000Z');
let contadorFechas = 0;
function fechaEventoSiguiente() {
  const d = new Date(SABADO_BASE.getTime() + contadorFechas * 7 * 86_400_000);
  contadorFechas++;
  return d;
}

const CLIENTE = { nombre: 'QATEST Bloque3', email: 'qatest@celebrasincesar.cl', telefono: '+56900000003' };

const filasCreadas = [];
async function limpiar() {
  for (const codigo of filasCreadas) {
    await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
    await q(`DELETE FROM reserva WHERE codigo = $1`, [codigo]).catch(() => {});
  }
}

// `diasEvento`: cuántos días debe faltar, EN EL "HOY" SIMULADO devuelto,
// para el evento — el valor real que cada prueba pone a prueba.
// `diasCreacion`: el gap real creación→evento (reserva.creada se fija en
// consecuencia). Devuelve { reserva, hoy } — `hoy` es lo que hay que
// pasarle a ejecutarCicloPrevio(hoy)/accionesProximas(hoy) en esa prueba.
async function crearReservaPrueba({ diasEvento, diasCreacion = 40 }) {
  const fechaEvento = fechaEventoSiguiente();
  const fechaISOEvento = fechaEvento.toISOString().slice(0, 10);
  const r = await crearReserva({
    configuracion: {
      fecha: `${fechaISOEvento}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
      tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
      extras: [], tematica: null, horasAdicionales: 0,
    },
    cliente: CLIENTE, aceptaTyc: true,
  });
  if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
  filasCreadas.push(r.reserva.codigo);

  const creada = new Date(fechaEvento.getTime() - diasCreacion * 86_400_000);
  await q(`UPDATE reserva SET estado = 'BALANCE_PENDING', pagado = $2, creada = $3 WHERE id = $1`,
    [r.reserva.id, Math.round(r.reserva.anticipo), creada.toISOString()]);

  const hoy = new Date(fechaEvento.getTime() - diasEvento * 86_400_000);
  const reserva = await reservaPorCodigo(r.reserva.codigo);
  return { reserva, hoy };
}

async function eventosDe(reservaId) {
  const filas = await q(`SELECT tipo FROM pago_evento WHERE reserva_id = $1 ORDER BY id`, [reservaId]);
  return filas.map((f) => f.tipo);
}

try {

  // ══════════════════════════════════════════════════════════════════
  // CICLO NORMAL — T7/T4/T1 en el momento correcto
  // ══════════════════════════════════════════════════════════════════
  await T('ejecutarCicloPrevio: reserva a 7 días (ciclo normal) crea T7_TAREA_WHATSAPP_CREADA exactamente una vez', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 7 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.filter((t) => t === TIPO_EVENTO.T7_CREADA).length, 1);
    eq(eventos.includes(TIPO_EVENTO.T4_CREADA), false, 'a 7 días todavía no corresponde T4');
  });

  await T('ejecutarCicloPrevio: reserva a 4 días crea T7 Y T4 (ambos umbrales ya se cruzaron)', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 4 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    yes(eventos.includes(TIPO_EVENTO.T7_CREADA));
    yes(eventos.includes(TIPO_EVENTO.T4_CREADA));
    eq(eventos.includes(TIPO_EVENTO.T1_CREADA), false);
  });

  await T('ejecutarCicloPrevio: T4 NO se crea si Datos Finales ya están confirmados', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 4 });
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 8, mayoresFinal: 0, adultosAprox: 4, adultoResponsable: 'X', telefonoOperacional: '+56900000000' });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.includes(TIPO_EVENTO.T4_CREADA), false, 'Datos Finales ya confirmados: no debe crear la tarea (§7)');
  });

  await T('ejecutarCicloPrevio: reserva a 1 día crea T1', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 1 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    yes(eventos.includes(TIPO_EVENTO.T1_CREADA));
  });

  // ══════════════════════════════════════════════════════════════════
  // IDEMPOTENCIA — correr el cron varias veces nunca duplica
  // ══════════════════════════════════════════════════════════════════
  await T('ejecutarCicloPrevio: correr el cron 2 y 5 veces el mismo "hoy" NO duplica ningún evento', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 1 });
    for (let i = 0; i < 5; i++) await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.filter((t) => t === TIPO_EVENTO.T1_CREADA).length, 1, 'nunca más de una tarea T1_CREADA aunque el cron corra 5 veces');
  });

  // ══════════════════════════════════════════════════════════════════
  // RESERVAS DE ÚLTIMA HORA (§13)
  // ══════════════════════════════════════════════════════════════════
  await T('Última hora: reserva creada 5 días antes del evento (faltan 5) NUNCA recibe T7', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 5, diasCreacion: 5 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.includes(TIPO_EVENTO.T7_CREADA), false);
  });

  await T('Última hora: reserva creada 3 días antes del evento recibe el equivalente T4 de inmediato, nunca T7', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 3, diasCreacion: 3 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.includes(TIPO_EVENTO.T7_CREADA), false);
    yes(eventos.includes(TIPO_EVENTO.T4_CREADA));
  });

  await T('Última hora: reserva creada 1 día antes del evento (falta 1) recibe T1, nunca T7 ni T4', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 1, diasCreacion: 1 });
    await ejecutarCicloPrevio(hoy);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.includes(TIPO_EVENTO.T7_CREADA), false);
    eq(eventos.includes(TIPO_EVENTO.T4_CREADA), false);
    yes(eventos.includes(TIPO_EVENTO.T1_CREADA));
  });

  await T('Última hora: reserva creada el mismo día del evento no genera NINGUNA tarea de ciclo previo', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 0, diasCreacion: 0 });
    await ejecutarCicloPrevio(hoy);
    const eventos = (await eventosDe(reserva.id)).filter((t) => t.startsWith('T7_') || t.startsWith('T4_') || t.startsWith('T1_'));
    eq(eventos.length, 0, 'sin secuencia histórica el mismo día (§13) — RESERVA_CREADA no cuenta, no es del ciclo previo');
  });

  // ══════════════════════════════════════════════════════════════════
  // MARCAR GESTIONADO (§12)
  // ══════════════════════════════════════════════════════════════════
  await T('marcarTareaGestionada: no se puede gestionar una tarea que nunca se creó', async () => {
    const { reserva } = await crearReservaPrueba({ diasEvento: 20 });
    const r = await marcarTareaGestionada({ reservaId: reserva.id, milestone: 'T7' });
    eq(r.ok, false);
    eq(r.motivo, 'tarea_no_creada');
  });

  await T('marcarTareaGestionada: registra T7_TAREA_WHATSAPP_GESTIONADA, nunca WHATSAPP_ENVIADO', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 7 });
    await ejecutarCicloPrevio(hoy);
    const r = await marcarTareaGestionada({ reservaId: reserva.id, milestone: 'T7' });
    yes(r.ok);
    const eventos = await eventosDe(reserva.id);
    yes(eventos.includes(TIPO_EVENTO.T7_GESTIONADA));
    yes(!eventos.some((t) => t.includes('ENVIADO')), 'nunca debe existir un evento que afirme un envío (no hay API de WhatsApp)');
  });

  await T('marcarTareaGestionada: llamarlo dos veces no duplica el evento GESTIONADA', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 7 });
    await ejecutarCicloPrevio(hoy);
    await marcarTareaGestionada({ reservaId: reserva.id, milestone: 'T7' });
    const r2 = await marcarTareaGestionada({ reservaId: reserva.id, milestone: 'T7' });
    yes(r2.ok);
    eq(r2.yaEstaba, true);
    const eventos = await eventosDe(reserva.id);
    eq(eventos.filter((t) => t === TIPO_EVENTO.T7_GESTIONADA).length, 1);
  });

  // ══════════════════════════════════════════════════════════════════
  // ACCIONES PRÓXIMAS (§16) — obsolescencia y contenido
  // ══════════════════════════════════════════════════════════════════
  await T('accionesProximas: una tarea T4 creada queda obsoleta (deja de listarse) si el cliente confirma Datos Finales después', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 4 });
    await ejecutarCicloPrevio(hoy);
    let acciones = await accionesProximas(hoy);
    yes(acciones.some((a) => a.codigo === reserva.codigo && a.tipo === 'T4'), 'debe aparecer antes de confirmar Datos Finales');

    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 9, mayoresFinal: 0, adultosAprox: 5, adultoResponsable: 'Y', telefonoOperacional: '+56900000000' });
    acciones = await accionesProximas(hoy);
    yes(!acciones.some((a) => a.codigo === reserva.codigo && a.tipo === 'T4'), 'debe desaparecer solo, sin marcar gestionado (§7/§15)');
  });

  await T('accionesProximas: una tarea gestionada no vuelve a aparecer', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 7 });
    await ejecutarCicloPrevio(hoy);
    await marcarTareaGestionada({ reservaId: reserva.id, milestone: 'T7' });
    const acciones = await accionesProximas(hoy);
    yes(!acciones.some((a) => a.codigo === reserva.codigo && a.tipo === 'T7'));
  });

  await T('accionesProximas: T1 usa el texto "lista" cuando no hay pendientes críticos', async () => {
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 1 });
    // Sin extras (sin decoración/animación) y con Datos Finales confirmados
    // — nada bloquea "todo listo" (mismo criterio que Bloque 2, §17).
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 10, mayoresFinal: 0, adultosAprox: 5, adultoResponsable: 'Z', telefonoOperacional: '+56900000000' });
    await ejecutarCicloPrevio(hoy);
    const acciones = await accionesProximas(hoy);
    const t1 = acciones.find((a) => a.codigo === reserva.codigo && a.tipo === 'T1');
    yes(t1, 'debe existir la acción T1');
    yes(t1.mensaje.includes('Tu celebración está lista.'));
  });

  await T('accionesProximas: T1 usa la variante de acción pendiente cuando faltan Datos Finales', async () => {
    // gap=1 evita que T7/T4 se creen y "compitan" — deja el caso limpio.
    const { reserva, hoy } = await crearReservaPrueba({ diasEvento: 1, diasCreacion: 1 });
    await ejecutarCicloPrevio(hoy);
    const acciones = await accionesProximas(hoy);
    const t1 = acciones.find((a) => a.codigo === reserva.codigo && a.tipo === 'T1');
    yes(t1, 'debe existir la acción T1');
    yes(!t1.mensaje.includes('Tu celebración está lista.'));
    yes(t1.mensaje.includes('necesitamos cerrar un detalle'));
  });

  await T('accionesProximas: ordena 🔴 → 🟠 → 🟡, y por fecha dentro de cada grupo', async () => {
    // Domingo de un fin de semana (AM) y el viernes de la semana
    // siguiente (PM, único turno que existe un viernes) — 5 días de
    // diferencia real, ambos días hábiles del negocio, para lograr una
    // urgencia genuinamente distinta (🔴 vs 🟡) sin caer en un día no
    // reservable (lunes a jueves no existen para este negocio).
    const sabado = fechaEventoSiguiente();
    const fechaEventoUrgente = new Date(sabado.getTime() + 1 * 86_400_000); // domingo
    const fechaEventoTranquila = new Date(fechaEventoUrgente.getTime() + 5 * 86_400_000); // viernes siguiente
    const hoySimulado = new Date(fechaEventoUrgente.getTime() - 1 * 86_400_000);

    const crear = async (fechaEvento, hora, diasCreacion) => {
      const fechaISOEvento = fechaEvento.toISOString().slice(0, 10);
      const r = await crearReserva({
        configuracion: {
          fecha: `${fechaISOEvento}T12:00:00.000Z`, hora, sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
      filasCreadas.push(r.reserva.codigo);
      const creada = new Date(fechaEvento.getTime() - diasCreacion * 86_400_000);
      await q(`UPDATE reserva SET estado = 'BALANCE_PENDING', pagado = $2, creada = $3 WHERE id = $1`,
        [r.reserva.id, Math.round(r.reserva.anticipo), creada.toISOString()]);
      return reservaPorCodigo(r.reserva.codigo);
    };

    const urgente = await crear(fechaEventoUrgente, 'AM', 40); // faltará 1 día del hoySimulado → T1, rojo
    const tranquila = await crear(fechaEventoTranquila, 'PM', 40); // faltarán 6 días → T7, amarillo

    await ejecutarCicloPrevio(hoySimulado);
    const acciones = await accionesProximas(hoySimulado);

    const iUrgente = acciones.findIndex((a) => a.codigo === urgente.codigo);
    const iTranquila = acciones.findIndex((a) => a.codigo === tranquila.codigo);
    yes(iUrgente !== -1 && iTranquila !== -1, 'ambas acciones deben aparecer en la lista');
    yes(iUrgente < iTranquila, 'la más urgente (🔴, T1 a 1 día) debe listarse antes que la más tranquila (🟡/🟠, T7 a 7 días)');

    const PESO = { rojo: 0, naranja: 1, amarillo: 2 };
    for (let i = 1; i < acciones.length; i++) {
      yes(PESO[acciones[i - 1].nivel] <= PESO[acciones[i].nivel], `orden de urgencia roto en índice ${i}`);
    }
  });

} finally {
  await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
}

console.log(`\n  QA de integración Bloque 3 — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
