// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — PAGO TARDÍO TRAS VENCER EL HOLD
// node scripts/qa-pagos-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// A diferencia de scripts/qa-pagos.mjs (puro JavaScript, sin base de
// datos), esto prueba lib/reservas.js contra un Postgres REAL: el cerrojo
// atómico del turno y la resolución de conflicto solo se pueden probar
// con transacciones de verdad.
//
// Se salta solo (exit 0, con aviso) si no hay POSTGRES_URL/DATABASE_URL
// configurada — así `npm run qa` sigue funcionando para cualquiera que no
// tenga la base a mano, igual que el resto del proyecto.
//
// Corre contra la base que esté configurada en .env.local (Preview de
// Sandbox mientras no exista Production). Crea sus propias filas de
// prueba con fechas muy lejanas y códigos con prefijo QATEST- para nunca
// chocar con reservas reales, y las borra al terminar — pase lo que pase.
//
// Casos (documento "Últimos ajustes antes de producción", 06-sep-2026):
//   Caso 1: Reserva A expira → Reserva B toma el turno → llega pago
//           tardío de A → A queda PAYMENT_CONFLICT, B conserva el turno.
//   Caso 2: Reserva A expira → nadie ocupa el turno → llega pago tardío
//           de A → A readquiere el turno de forma atómica y se confirma.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// lib/reservas.js y sus dependencias importan con rutas sin extensión
// ('./db', '../data/reglas') — válido para Next.js, no para Node suelto.
register('./_resolver-sin-extension.mjs', import.meta.url);

// ── Cargar .env.local a mano: un script node suelto no lo hace solo ────
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
  console.log('\nQA de integración (pago tardío) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q, q1 } = await import('../lib/db.js');
const {
  crearReserva, crearReservaManual, crearPagoPendiente, siguienteCommerceOrder,
  montoQueCorresponde, acreditarPago, tomarTurno, PAGO,
  registrarPagoManual, marcarBoletaEmitida, pagosPendientesBVE, fechaISO, pagosDeReserva,
} = await import('../lib/reservas.js');
const { notificarAdminPago, pagoYaNotificado, notificarClientePago, pagoClienteYaNotificado } = await import('../lib/notificaciones.js');
const { enviarEmailContractual, reservaYaTieneEmailContractual, reservasPendientesEmailContractual } = await import('../lib/email-contractual.js');
const { TYC_VERSION } = await import('../data/master.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Fecha de prueba bien lejana (sábado — Caso 1/Caso 2 usan turno AM, que
// desde Fase 1A ya no existe los viernes; el día de la semana es
// irrelevante para lo que estos dos casos prueban, así que se elige uno
// que no choque con la regla nueva) para no chocar nunca con una reserva
// real ni con las de QA manual de esta sesión.
const FECHA_PRUEBA = '2027-03-20'; // sábado
const CLIENTE = { nombre: 'QATEST Integración', email: 'qatest@celebrasincesar.cl', telefono: '+56900000000' };
const CONFIG_BASE = {
  fecha: `${FECHA_PRUEBA}T12:00:00.000Z`, sector: 'independiente',
  tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
  extras: [], horasAdicionales: 0,
};

const filasCreadas = []; // { tabla, columna, valor } para limpiar al final

async function crearReservaDePrueba(turno) {
  const r = await crearReserva({
    configuracion: { ...CONFIG_BASE, hora: turno }, cliente: CLIENTE, aceptaTyc: true,
  });
  if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
  filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
  const commerceOrder = await siguienteCommerceOrder(r.reserva.codigo, 'DEPOSIT');
  const pago = await crearPagoPendiente({
    reservaId: r.reserva.id, commerceOrder, tipo: 'DEPOSIT', monto: r.reserva.anticipo,
  });
  return { reserva: r.reserva, pago };
}

async function vencerHoldAhora(codigo) {
  // Simula "pasaron los 15 minutos": el hold ya venció.
  await q(`UPDATE turno_hold SET vence = now() - interval '1 minute' WHERE reserva_codigo = $1`, [codigo]);
  await q(`UPDATE reserva SET hold_vence = now() - interval '1 minute' WHERE codigo = $1`, [codigo]);
}

function estadoFlowFalso({ monto, flowOrder }) {
  return {
    pagado: true, medio: 'Webpay', medioTipo: null, cuotas: null, codigoAutorizacion: null,
    flowOrder, monto, estado: 'PAGADA', statusCrudo: 2, commerceOrder: null, fechaPago: null,
  };
}

const tributarioFalso = { estado: 'NOT_REQUIRED_VOUCHER', motivo: 'Prueba QA' };

async function limpiar() {
  // Reservas y sus dependientes (pago, pago_evento por FK ON DELETE CASCADE;
  // turno_hold no tiene FK, se borra aparte).
  const codigos = [...new Set(filasCreadas.filter((f) => f.tabla === 'reserva').map((f) => f.valor))];
  for (const codigo of codigos) {
    await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
    await q(`DELETE FROM reserva WHERE codigo = $1`, [codigo]).catch(() => {});
  }
}

try {
  // ══════════════════════════════════════════════════════════════════
  // TYC_VERSION — inmutabilidad real a nivel de DB (documento "Instrucción
  // Maestra — Continuación", 14-sep-2026, §9). No basta con que la
  // aplicación "no la edite": un trigger BEFORE UPDATE debe rechazar
  // cualquier intento de tocar version/contenido/hashes/pdf/publicado_en,
  // sin importar quién lo intente. Solo estado/retirado_en pueden cambiar.
  // ══════════════════════════════════════════════════════════════════
  await T('tyc_version: el trigger rechaza modificar el contenido de una versión ya publicada', async () => {
    await q(`DELETE FROM tyc_version WHERE version = 'QATEST-TRIGGER'`);
    await q(
      `INSERT INTO tyc_version (version, contenido, contenido_sha256) VALUES ($1, $2, $3)`,
      ['QATEST-TRIGGER', 'contenido original', 'hash-original']
    );
    try {
      let rechazado = false;
      try {
        await q(`UPDATE tyc_version SET contenido = 'contenido ALTERADO' WHERE version = 'QATEST-TRIGGER'`);
      } catch {
        rechazado = true;
      }
      yes(rechazado, 'el UPDATE de contenido debió ser rechazado por el trigger');

      // Lo único permitido: retirar una versión (estado/retirado_en).
      await q(`UPDATE tyc_version SET estado = 'RETIRADA', retirado_en = now() WHERE version = 'QATEST-TRIGGER'`);
      const fila = await q1(`SELECT contenido, estado FROM tyc_version WHERE version = 'QATEST-TRIGGER'`);
      eq(fila.contenido, 'contenido original', 'el contenido nunca debe cambiar, ni siquiera al retirar la versión');
      eq(fila.estado, 'RETIRADA', 'estado sí debe poder cambiar');
    } finally {
      await q(`DELETE FROM tyc_version WHERE version = 'QATEST-TRIGGER'`).catch(() => {});
    }
  });

  await T('tyc_hash: una reserva nueva guarda exactamente el hash de la versión ACTIVA — nunca se recalcula después', async () => {
    const activa = await q1(`SELECT contenido_sha256 FROM tyc_version WHERE version = $1 AND estado = 'ACTIVA'`, [TYC_VERSION]);
    if (!activa) {
      console.log(`  (omitido: no hay versión ACTIVA '${TYC_VERSION}' en tyc_version — correr scripts/poblar-tyc-version-inicial.mjs primero)`);
      return;
    }
    const r = await crearReservaDePrueba('PM');
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.tyc_hash, activa.contenido_sha256, 'la reserva debe guardar el mismo hash que la fila ACTIVA de tyc_version');
    eq(r.reserva.tyc_version, TYC_VERSION);
  });

  await T('tyc_hash: reservas históricas (creadas antes de que existiera esta columna) NO reciben backfill — quedan null', async () => {
    const historica = await q1(`SELECT tyc_hash, tyc_version FROM reserva WHERE tyc_version = '2026-08' LIMIT 1`);
    if (!historica) return; // el fixture puede no existir en todos los entornos: no es una falla de esta pieza
    eq(historica.tyc_hash, null, 'una reserva de antes de tyc_hash debe seguir sin hash — nunca se le asigna uno retroactivo');
  });

  // ══════════════════════════════════════════════════════════════════
  // CASO 1 — A expira, B toma el turno, pago tardío de A llega después.
  // ══════════════════════════════════════════════════════════════════
  await T('Caso 1: pago tardío con turno ya tomado por otra reserva → PAYMENT_CONFLICT, no le quita el turno a quien lo tiene', async () => {
    const a = await crearReservaDePrueba('AM');
    await vencerHoldAhora(a.reserva.codigo);

    const b = await crearReservaDePrueba('AM'); // debe poder tomar el mismo turno: A ya venció
    eq(b.reserva.fecha_evento ? true : false, true, 'B debió poder crear su reserva en el turno que A dejó libre al vencer');

    // Pago tardío de A llega recién ahora, con B ya instalado en el turno.
    const resultado = await acreditarPago({
      pagoId: a.pago.id,
      estadoFlow: estadoFlowFalso({ monto: a.pago.monto, flowOrder: 'QATEST-A-TARDE' }),
      tributario: tributarioFalso,
    });

    eq(resultado.reserva.estado, 'PAYMENT_CONFLICT', 'la reserva A debe quedar en PAYMENT_CONFLICT');
    eq(resultado.conflictoTurno, true, 'conflictoTurno debe ser true');

    const pagoA = await q1(`SELECT estado FROM pago WHERE id = $1`, [a.pago.id]);
    eq(pagoA.estado, PAGO.PAID, 'el pago de A debe quedar PAID igual — la plata entró y no hay reembolso automático');

    // B conserva el turno tal cual estaba: nunca se le quita.
    const holdTurno = await q1(
      `SELECT reserva_codigo, firme FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`,
      [FECHA_PRUEBA]
    );
    eq(holdTurno.reserva_codigo, b.reserva.codigo, 'el turno_hold debe seguir siendo de B, no de A');

    const eventoConflicto = await q1(
      `SELECT tipo FROM pago_evento WHERE reserva_id = $1 AND tipo = 'PAYMENT_SLOT_CONFLICT'`,
      [a.reserva.id]
    );
    eq(!!eventoConflicto, true, 'debe quedar registrado el evento PAYMENT_SLOT_CONFLICT para A (es la alerta administrativa: /cadena lo muestra en rojo)');

    // No debe crearse un evento de Calendar para A: el turno nunca fue suyo
    // de verdad al momento de confirmarse, y Calendar solo es espejo —
    // jamás debe reflejar una celebración que Postgres no reconoce como firme.
    const reservaA = await q1(`SELECT calendar_event_id FROM reserva WHERE id = $1`, [a.reserva.id]);
    eq(reservaA.calendar_event_id, null, 'A no debe tener calendar_event_id: nunca se le crea evento de Calendar en conflicto');

    // Repetir el callback (Flow reintentando la misma confirmación) no debe
    // producir NINGÚN efecto adicional: ni re-acreditar, ni duplicar el
    // evento de conflicto, ni cambiar el estado de A o el turno de B.
    const segundaVez = await acreditarPago({
      pagoId: a.pago.id,
      estadoFlow: estadoFlowFalso({ monto: a.pago.monto, flowOrder: 'QATEST-A-TARDE' }),
      tributario: tributarioFalso,
    });
    eq(segundaVez.nuevos, 0, 'un callback duplicado sobre un pago ya PAID no debe volver a acreditarse');

    const reservaADespues = await q1(`SELECT estado, calendar_event_id FROM reserva WHERE id = $1`, [a.reserva.id]);
    eq(reservaADespues.estado, 'PAYMENT_CONFLICT', 'A debe seguir en PAYMENT_CONFLICT tras el callback repetido — nunca cambia sola');
    eq(reservaADespues.calendar_event_id, null, 'el callback repetido tampoco debe crear Calendar para A');

    const conflictosDespues = await q(
      `SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = 'PAYMENT_SLOT_CONFLICT'`,
      [a.reserva.id]
    );
    eq(conflictosDespues.length, 1, 'el callback repetido no debe duplicar el evento PAYMENT_SLOT_CONFLICT');

    const holdTurnoDespues = await q1(
      `SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`,
      [FECHA_PRUEBA]
    );
    eq(holdTurnoDespues.reserva_codigo, b.reserva.codigo, 'B debe seguir intacta con su turno tras el callback repetido de A');
  });

  await limpiar();
  filasCreadas.length = 0;

  // ══════════════════════════════════════════════════════════════════
  // CASO 2 — A expira, nadie más lo toma, pago tardío de A llega después.
  // ══════════════════════════════════════════════════════════════════
  await T('Caso 2: pago tardío con turno todavía libre → readquiere atómicamente y confirma', async () => {
    const a = await crearReservaDePrueba('PM');
    await vencerHoldAhora(a.reserva.codigo);

    // Nadie tomó el turno. Llega el pago tardío.
    const resultado = await acreditarPago({
      pagoId: a.pago.id,
      estadoFlow: estadoFlowFalso({ monto: a.pago.monto, flowOrder: 'QATEST-A-SOLA' }),
      tributario: tributarioFalso,
    });

    eq(resultado.conflictoTurno, false, 'no debe haber conflicto: el turno seguía libre');
    eq(['CONFIRMED', 'BALANCE_PENDING', 'PAID'].includes(resultado.reserva.estado), true,
      `la reserva debe confirmarse (CONFIRMED/BALANCE_PENDING/PAID), no ${resultado.reserva.estado}`);

    const holdTurno = await q1(
      `SELECT reserva_codigo, firme FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'PM'`,
      [FECHA_PRUEBA]
    );
    eq(holdTurno.reserva_codigo, a.reserva.codigo, 'el turno debe quedar reasignado a A');
    eq(holdTurno.firme, true, 'el turno debe quedar firme tras la readquisición');
  });

  // ══════════════════════════════════════════════════════════════════
  // RESERVA MANUAL — cotizaciones cerradas por WhatsApp antes de este
  // sistema (documento "Mejora mínima para reservas antiguas/manuales",
  // 06-sep-2026). Mismo cerrojo de turno, mismo camino de pago; el total
  // NO pasa por el motor de precios.
  // ══════════════════════════════════════════════════════════════════════
  const FECHA_MANUAL = '2027-03-06'; // sábado — independiente de FECHA_PRUEBA
  let codigoManual = null; // capturado explícito: filasCreadas ya trae entradas de Caso 1/2

  await T('crearReservaManual: guarda el total/anticipo tal cual los escribe César, sin recalcular con el motor de precios', async () => {
    const r = await crearReservaManual({
      referencia: 'QATEST cotización antigua #1', nombreNino: 'Festejado QA', apoderado: 'Apoderado QA',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000001',
      fecha: FECHA_MANUAL, turno: 'AM', horasAdicionales: 0, tramoInvitados: '31a40', tramoMayores: '1a3',
      total: 987654, anticipo: 400000, notas: 'Incluye piñata (acordado antes del sistema de pagos)',
    });
    yes(r.ok, `crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    codigoManual = r.reserva.codigo;

    // 987.654 no es una cifra que el motor de precios produzca jamás — es
    // justo la prueba de que no se recalculó.
    eq(r.reserva.total, 987654);
    eq(r.reserva.anticipo, 400000);
    eq(r.reserva.saldo, 987654 - 400000, 'el saldo debe ser total - anticipo, calculado por el servidor');
    eq(r.reserva.estado, 'PENDING_PAYMENT');
    eq(r.reserva.sector, 'completo', 'tramo 31a40 nunca es Independiente, sin importar los mayores de 6');
    yes(r.reserva.notas.includes('Festejado QA'), 'las notas deben guardar el nombre del festejado para el evento de Calendar');
    yes(r.reserva.notas.includes('QATEST cotización antigua #1'), 'las notas deben guardar la referencia de la cotización');
    yes(r.reserva.notas.includes('31 a 40 niños'), 'las notas deben mostrar el TRAMO, no un número inventado');
  });

  await T('crearReservaManual: sector Independiente solo con tramo hasta10 y ningún mayor de 6', async () => {
    const r = await crearReservaManual({
      referencia: '', nombreNino: 'Festejado Independiente', apoderado: 'Apoderado QA 2',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000004',
      fecha: FECHA_MANUAL, turno: 'PM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 195000, anticipo: 97500, notas: '',
    });
    yes(r.ok, `crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.sector, 'independiente');
  });

  await T('crearReservaManual: toma el turno de forma atómica — un segundo intento en el mismo turno/fecha falla', async () => {
    const segundo = await crearReservaManual({
      referencia: '', nombreNino: 'Otro festejado', apoderado: 'Otro apoderado',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000002',
      fecha: FECHA_MANUAL, turno: 'AM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 150000, anticipo: 75000, notas: '',
    });
    eq(segundo.ok, false);
    eq(segundo.motivo, 'turno_ocupado');
  });

  await T('crearReservaManual: rechaza anticipo mayor que el total, sin tocar la base', async () => {
    const r = await crearReservaManual({
      referencia: '', nombreNino: 'X', apoderado: 'Y',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000003',
      fecha: FECHA_MANUAL, turno: 'PM', horasAdicionales: 2, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 100000, anticipo: 999999, notas: '',
    });
    eq(r.ok, false);
    eq(r.motivo, 'datos_invalidos');
  });

  await T('crearReservaManual: rechaza horas adicionales por sobre el máximo del turno (AM admite 1, no 2)', async () => {
    const r = await crearReservaManual({
      referencia: '', nombreNino: 'X', apoderado: 'Y',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000005',
      fecha: FECHA_MANUAL, turno: 'AM', horasAdicionales: 2, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 100000, anticipo: 50000, notas: '',
    });
    eq(r.ok, false);
    eq(r.motivo, 'datos_invalidos');
  });

  await T('crearReservaManual: el link de anticipo usa commerceOrder ...-DEP y el monto exacto del anticipo (sin llamar a Flow)', async () => {
    const reserva = await q1(`SELECT * FROM reserva WHERE codigo = $1`, [codigoManual]);
    const commerceOrder = await siguienteCommerceOrder(codigoManual, 'DEPOSIT');
    eq(commerceOrder, `${codigoManual}-DEP`);
    eq(montoQueCorresponde(reserva, 'DEPOSIT'), 400000, 'el monto del link debe ser el anticipo pendiente, igual que cualquier otra reserva');
  });

  // ══════════════════════════════════════════════════════════════════
  // GUARD SERVER-SIDE VIERNES (documento "Autorización Fase 1A",
  // 13-sep-2026, §4/§13): los dos entry points reales deben rechazar
  // viernes AM y viernes PM+2 aunque lleguen directo a la API, sin pasar
  // por el wizard — y crear con normalidad un viernes PM dentro de lo
  // permitido. Fecha fresca, distinta de todas las de arriba.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_VIERNES_GUARD = '2027-04-02'; // viernes
  const FECHA_VIERNES_GUARD2 = '2027-04-09'; // viernes — distinto del de arriba, para no chocar turno_hold con el PM+1 que también usa FECHA_VIERNES_GUARD
  const FECHA_VIERNES_GUARD3 = '2027-04-16'; // viernes — ídem, para crearReservaManual

  await T('crearReserva(): viernes AM rechazado server-side, con el mensaje semántico específico (no el genérico AM/PM)', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_VIERNES_GUARD}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, aceptaTyc: true,
    });
    eq(r.ok, false, 'debe rechazarse, nunca crear la reserva');
    yes(
      r.errores?.includes('Los viernes las celebraciones están disponibles únicamente en turno PM desde las 16:00.'),
      `debe traer el mensaje semántico específico: ${JSON.stringify(r.errores)}`
    );
  });

  await T('crearReservaManual(): viernes AM rechazado server-side, aunque lo intente cargar César a mano', async () => {
    const r = await crearReservaManual({
      referencia: 'QATEST viernes AM manual', nombreNino: 'X', apoderado: 'Y',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000009',
      fecha: FECHA_VIERNES_GUARD, turno: 'AM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 100000, anticipo: 50000, notas: '',
    });
    eq(r.ok, false);
    eq(r.motivo, 'datos_invalidos');
    yes(
      r.errores?.includes('Los viernes las celebraciones están disponibles únicamente en turno PM desde las 16:00.'),
      `debe traer el mensaje semántico específico: ${JSON.stringify(r.errores)}`
    );
  });

  // Fase 5 Bloque 1 (01-oct-2026): viernes PM ya no tiene un tope distinto
  // — las mismas 2 extensiones que sábado/domingo. Lo que antes probaba el
  // rechazo de "+2" ahora prueba justo lo contrario: que se acepta de
  // verdad, server-side, con el precio no lineal correcto ($100.000 por
  // 90 min, no $100.000 por "2 horas").
  await T('crearReserva(): viernes PM +2 YA NO se rechaza — se crea con 16:00–20:30 y $100.000', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_VIERNES_GUARD2}T12:00:00.000Z`, hora: 'PM', horasAdicionales: 2 },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.hora_inicio, '16:00');
    eq(r.reserva.hora_termino, '20:30');
    eq(r.reserva.turno, 'PM');
  });

  await T('crearReserva(): viernes PM +3 (nivel inexistente) SÍ se rechaza server-side — NO se acota en silencio', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_VIERNES_GUARD3}T12:00:00.000Z`, hora: 'PM', horasAdicionales: 3 },
      cliente: CLIENTE, aceptaTyc: true,
    });
    eq(r.ok, false, 'debe rechazarse, nunca crear la reserva con un nivel acotado en vez de la solicitud original');
    yes(r.errores?.some((e) => /máximo 2 nivel/.test(e)), `debe rechazar con el mensaje genérico de exceso: ${JSON.stringify(r.errores)}`);
  });

  // El "+3" de arriba se rechazó en FECHA_VIERNES_GUARD3 sin tomar el
  // turno (nunca se escribe nada en una petición rechazada) — por eso ese
  // mismo día sigue libre para esta prueba.
  await T('crearReservaManual(): viernes PM +2 YA NO se rechaza — mismo tope que sábado/domingo', async () => {
    const r = await crearReservaManual({
      referencia: '', nombreNino: 'X', apoderado: 'Y',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000010',
      fecha: FECHA_VIERNES_GUARD3, turno: 'PM', horasAdicionales: 2, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 100000, anticipo: 50000, notas: '',
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.hora_inicio, '16:00');
    eq(r.reserva.hora_termino, '20:30');
  });

  await T('crearReserva(): viernes PM +1 (dentro de lo permitido) se crea con normalidad — 16:00–20:00', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_VIERNES_GUARD}T12:00:00.000Z`, hora: 'PM', horasAdicionales: 1 },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.hora_inicio, '16:00');
    eq(r.reserva.hora_termino, '20:00');
    eq(r.reserva.turno, 'PM');
  });

  // ══════════════════════════════════════════════════════════════════
  // TYC_VERSION — corrección factual T&C (documento "Autorización Final —
  // Fase 1A + Corrección Factual Mínima T&C", 13-sep-2026, §9): una reserva
  // nueva debe guardar la versión NUEVA; una reserva ya existente (creada
  // antes de este cambio) debe conservar exactamente la versión con la que
  // se creó — nunca se hace backfill ni se toca lo ya guardado.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_TYC = '2027-05-08'; // sábado, fecha fresca sin relación con las anteriores

  await T('crearReserva(): una reserva nueva guarda la TYC_VERSION vigente actual', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.tyc_version, TYC_VERSION, `debe guardar exactamente la versión vigente en data/master.js`);
  });

  await T('crearReservaManual(): una reserva nueva también guarda la TYC_VERSION vigente actual', async () => {
    const r = await crearReservaManual({
      referencia: '', nombreNino: 'X', apoderado: 'Y',
      email: 'qatest@celebrasincesar.cl', telefono: '+56900000011',
      fecha: FECHA_TYC, turno: 'PM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 100000, anticipo: 50000, notas: '',
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.tyc_version, TYC_VERSION);
  });

  await T('Reserva histórica preexistente (CSC-2026-000005) conserva su tyc_version original — no hubo backfill', async () => {
    const historica = await q1(`SELECT tyc_version FROM reserva WHERE codigo = 'CSC-2026-000005'`);
    if (!historica) return; // fixture puede no existir en todos los entornos: no es una falla de esta corrección
    yes(historica.tyc_version !== TYC_VERSION, `una reserva creada antes de este cambio NO debe tener la versión nueva (${TYC_VERSION}) — tenía: ${historica.tyc_version}`);
  });

  // ══════════════════════════════════════════════════════════════════
  // CHECKBOX T&C — SEGURIDAD REAL (documento "No autorizo todavía el
  // deploy...", 15-sep-2026, §4/§5/§12): aceptaTyc:true dejó de estar
  // hardcodeado en el frontend, pero eso no basta — el servidor tiene que
  // exigir la aceptación de verdad y decidir él mismo, nunca el navegador,
  // qué versión/hash quedan asociados a la reserva.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_TYC_CHECKBOX = '2027-06-05'; // sábado, fecha fresca

  await T('crearReserva(): aceptaTyc ausente → rechazada, nunca se crea la reserva ni se toca el turno', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC_CHECKBOX}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, // sin aceptaTyc
    });
    eq(r.ok, false);
    eq(r.motivo, 'sin_tyc');
    const hold = await q1(`SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`, [FECHA_TYC_CHECKBOX]);
    eq(hold, null, 'sin aceptación no debe quedar ni un cerrojo de turno');
  });

  await T('crearReserva(): aceptaTyc = false → rechazada igual que si estuviera ausente', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC_CHECKBOX}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, aceptaTyc: false,
    });
    eq(r.ok, false);
    eq(r.motivo, 'sin_tyc');
  });

  await T('crearReserva(): un request manipulado que manda tycVersion/tycHash propios no puede imponerlos — el servidor decide los suyos', async () => {
    const r = await crearReserva({
      configuracion: {
        ...CONFIG_BASE, fecha: `${FECHA_TYC_CHECKBOX}T12:00:00.000Z`, hora: 'AM',
        // Un cliente manipulado podría intentar mandar esto dentro de
        // `configuracion` (que viaja completa al snapshot) para hacerse
        // pasar por una versión distinta de la que el servidor resolvió.
        tycVersion: 'FALSA-2099', tyc_hash: 'hash-inventado-por-el-cliente',
      },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.tyc_version, TYC_VERSION, 'la versión guardada es la que el servidor resolvió, nunca la que mandó el cliente');
    yes(r.reserva.tyc_hash !== 'hash-inventado-por-el-cliente', 'el hash guardado no puede ser el que mandó el cliente');
    const activa = await q1(`SELECT contenido_sha256 FROM tyc_version WHERE version = $1 AND estado = 'ACTIVA'`, [TYC_VERSION]);
    eq(r.reserva.tyc_hash, activa.contenido_sha256, 'el hash guardado es exactamente el de la fila ACTIVA en tyc_version');
  });

  await T('crearReserva(): aceptaTyc = true guarda tyc_aceptado con un timestamp real (no queda null)', async () => {
    const fila = await q1(`SELECT tyc_aceptado FROM reserva WHERE codigo = $1 ORDER BY id DESC LIMIT 1`, [filasCreadas.at(-1).valor]);
    yes(fila.tyc_aceptado != null, 'tyc_aceptado debe quedar con la marca de tiempo de la aceptación, nunca null cuando aceptaTyc=true');
  });

  // ══════════════════════════════════════════════════════════════════
  // FUENTE DEL HASH CONTRACTUAL — FALLA CERRADO (documento "No autorizo
  // todavía el deploy...", 15-sep-2026, §5): tycHashVigente() ya no puede
  // devolver un hash vacío ni dejar pasar un checkout si la versión
  // vigente (TYC_VERSION, data/master.js) no está en condiciones de
  // respaldar un contrato. Se prueba contra la fila REAL de tyc_version en
  // Sandbox, manipulándola temporalmente y restaurándola siempre en un
  // `finally` — nunca se le hace backfill a una fila con datos distintos.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_TYC_NO_EXISTE = '2027-06-12'; // sábado
  const FECHA_TYC_RETIRADA = '2027-06-19'; // sábado

  await T('tycHashVigente(): si TYC_VERSION no existe en tyc_version, crearReserva() se rechaza ANTES de tomar el turno', async () => {
    const original = await q1(`SELECT * FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
    if (!original) {
      console.log(`  (omitido: no hay fila '${TYC_VERSION}' en tyc_version que respaldar para esta prueba)`);
      return;
    }
    // DELETE, no UPDATE: el trigger de inmutabilidad solo protege contra
    // UPDATE — borrar y volver a insertar la MISMA fila (mismo contenido,
    // mismo hash, mismo publicado_en) es la única forma reversible de
    // simular "esta versión nunca existió" sin dejar el dato alterado.
    await q(`DELETE FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
    try {
      const r = await crearReserva({
        configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC_NO_EXISTE}T12:00:00.000Z`, hora: 'AM' },
        cliente: CLIENTE, aceptaTyc: true,
      });
      eq(r.ok, false, 'no debe crearse una reserva si la versión vigente no existe en tyc_version');
      eq(r.motivo, 'tyc_no_disponible');
      const hold = await q1(`SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`, [FECHA_TYC_NO_EXISTE]);
      eq(hold, null, 'no debe quedar un cerrojo huérfano: el rechazo ocurre antes de tomarTurno()');
    } finally {
      // pdf_bytes también se restaura — si se omitiera acá, esta prueba
      // dejaría el backfill de scripts/generar-pdf-tyc-version.mjs
      // silenciosamente vacío para el resto de la corrida (encontrado al
      // agregar las pruebas de PDF más abajo: fallaban por esto, no por el
      // PDF en sí).
      await q(
        `INSERT INTO tyc_version (version, contenido, contenido_sha256, pdf_url, pdf_sha256, pdf_bytes, publicado_en, retirado_en, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [original.version, original.contenido, original.contenido_sha256, original.pdf_url,
          original.pdf_sha256, original.pdf_bytes, original.publicado_en, original.retirado_en, original.estado]
      );
      const restaurada = await q1(`SELECT contenido_sha256, estado, pdf_sha256, length(pdf_bytes) AS pdf_len FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
      eq(restaurada?.contenido_sha256, original.contenido_sha256, 'la fila restaurada debe tener exactamente el mismo hash que antes de la prueba');
      eq(restaurada?.estado, original.estado, 'la fila restaurada debe volver exactamente al mismo estado que antes de la prueba');
      eq(restaurada?.pdf_sha256, original.pdf_sha256, 'el PDF de la fila restaurada debe ser exactamente el mismo que antes de la prueba');
    }
  });

  await T('tycHashVigente(): si TYC_VERSION está RETIRADA, crearReserva() se rechaza ANTES de tomar el turno', async () => {
    const original = await q1(`SELECT estado FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
    if (!original) {
      console.log(`  (omitido: no hay fila '${TYC_VERSION}' en tyc_version que respaldar para esta prueba)`);
      return;
    }
    await q(`UPDATE tyc_version SET estado = 'RETIRADA', retirado_en = now() WHERE version = $1`, [TYC_VERSION]);
    try {
      const r = await crearReserva({
        configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC_RETIRADA}T12:00:00.000Z`, hora: 'AM' },
        cliente: CLIENTE, aceptaTyc: true,
      });
      eq(r.ok, false, 'no debe crearse una reserva si la versión vigente está RETIRADA');
      eq(r.motivo, 'tyc_no_disponible');
      const hold = await q1(`SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`, [FECHA_TYC_RETIRADA]);
      eq(hold, null, 'no debe quedar un cerrojo huérfano: el rechazo ocurre antes de tomarTurno()');
    } finally {
      await q(`UPDATE tyc_version SET estado = 'ACTIVA', retirado_en = NULL WHERE version = $1`, [TYC_VERSION]);
      const restaurada = await q1(`SELECT estado, retirado_en FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
      eq(restaurada?.estado, 'ACTIVA', 'la fila debe volver a ACTIVA para no dejar Sandbox con el checkout roto');
      eq(restaurada?.retirado_en, null, 'retirado_en debe volver a null');
    }
  });

  await T('tycHashVigente(): después de las pruebas de falla, la fila ACTIVA original sigue disponible para contratar con normalidad', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_TYC_RETIRADA}T12:00:00.000Z`, hora: 'PM' },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse con normalidad tras restaurar tyc_version: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    eq(r.reserva.tyc_version, TYC_VERSION);
    yes(!!r.reserva.tyc_hash, 'debe volver a guardar un hash real, no null');
  });

  // ══════════════════════════════════════════════════════════════════
  // CONTROL OBLIGATORIO DE BVE (documento "Agregar control obligatorio de
  // BVE para pagos por transferencia", 07-sep-2026). Reserva nueva, propia
  // de este bloque, con anticipo y saldo pagados AMBOS por transferencia
  // directa BancoEstado — el caso exacto que el documento pide probar.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_BVE = '2027-03-27'; // sábado (usa turno AM), distinta de las anteriores
  let reservaBVE = null;
  let pagoDepositoId = null;
  let pagoSaldoId = null;

  await T('BVE: preparación — crea la reserva de prueba para este bloque', async () => {
    const r = await crearReservaManual({
      referencia: 'QATEST BVE', nombreNino: 'Festejado BVE', apoderado: 'Apoderado BVE',
      email: 'qatest.bve@celebrasincesar.cl', telefono: '+56900000006',
      fecha: FECHA_BVE, turno: 'AM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 200000, anticipo: 100000, notas: '',
    });
    yes(r.ok, `crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    reservaBVE = r.reserva;
  });

  await T('registrarPagoManual: transferencia BancoEstado → pago PAID pero tributario PENDING_BVE (nunca voucher)', async () => {
    const resultado = await registrarPagoManual({
      codigo: reservaBVE.codigo, tipo: 'DEPOSIT', medio: 'TRANSFERENCIA_BANCOESTADO',
      monto: 100000, fechaPago: '2026-09-07', referencia: 'QATEST transferencia anticipo',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    pagoDepositoId = resultado.pagoId;

    const pago = await q1(`SELECT * FROM pago WHERE id = $1`, [pagoDepositoId]);
    eq(pago.estado, PAGO.PAID, 'la plata ya está: el pago queda PAID de inmediato');
    eq(pago.tributario, 'PENDING_BVE', 'transferencia nunca es voucher — corresponde emitir BVE');
    eq(pago.proveedor, 'MANUAL', 'un pago registrado a mano no puede quedar marcado como si viniera de Flow');
    eq(resultado.reserva.estado, 'BALANCE_PENDING', 'con el anticipo cubierto y saldo pendiente, la reserva queda confirmada con saldo pendiente');
  });

  await T('registrarPagoManual: el saldo, también por transferencia, genera una SEGUNDA tarea BVE separada de la del anticipo', async () => {
    const resultado = await registrarPagoManual({
      codigo: reservaBVE.codigo, tipo: 'BALANCE', medio: 'TRANSFERENCIA_BANCOESTADO',
      monto: 100000, fechaPago: null, referencia: 'QATEST transferencia saldo',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    pagoSaldoId = resultado.pagoId;
    yes(pagoSaldoId !== pagoDepositoId, 'el saldo debe ser un pago (y una tarea BVE) distinto del anticipo');

    eq(resultado.reserva.estado, 'PAID', 'con el saldo cubierto, la reserva queda pagada completa');

    const pendientes = await pagosPendientesBVE();
    const idsPendientes = pendientes.map((p) => p.id);
    yes(idsPendientes.includes(pagoDepositoId), 'la tarea BVE del anticipo debe seguir pendiente');
    yes(idsPendientes.includes(pagoSaldoId), 'la tarea BVE del saldo debe existir por separado');
  });

  await T('registrarPagoManual: Súper Compraquí presencial deja voucher — no entra a boletas pendientes', async () => {
    // Reserva no puede recibir un tercer cobro por EXTRA sin que sea sobre el
    // total ya pagado: se prueba clasificando el medio directamente sobre un
    // pago EXTRA de $1 para no interferir con los montos ya verificados arriba.
    const resultado = await registrarPagoManual({
      codigo: reservaBVE.codigo, tipo: 'EXTRA', medio: 'SUPER_COMPRAQUI', monto: 5000, referencia: 'QATEST compraquí',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    const pago = await q1(`SELECT tributario FROM pago WHERE id = $1`, [resultado.pagoId]);
    eq(pago.tributario, 'NOT_REQUIRED_VOUCHER', 'Súper Compraquí deja voucher, igual que una tarjeta');
  });

  await T('acreditarPago: un callback duplicado sobre el mismo pago no crea una segunda tarea BVE', async () => {
    const antes = await pagosPendientesBVE();
    const nAntes = antes.filter((p) => p.id === pagoDepositoId).length;
    eq(nAntes, 1, 'antes del duplicado, la tarea BVE del anticipo debe existir exactamente una vez');

    // Mismo pagoId, mismo estadoFlow/tributario: simula que Flow (o quien
    // sea) reintenta la misma confirmación. acreditarPago es idempotente
    // por diseño (WHERE estado <> 'PAID'): la segunda vez no debe actualizar
    // nada ni, por lo tanto, duplicar la tarea tributaria.
    const resultado = await acreditarPago({
      pagoId: pagoDepositoId,
      estadoFlow: { flowOrder: null, medio: 'Transferencia BancoEstado (presencial)', medioTipo: 'TRANSFERENCIA_BANCOESTADO', cuotas: null, codigoAutorizacion: null, monto: 100000 },
      tributario: { estado: 'PENDING_BVE', motivo: 'Reintento QA' },
    });
    eq(resultado.nuevos, 0, 'un pago ya PAID no debe volver a acreditarse');

    const despues = await pagosPendientesBVE();
    const nDespues = despues.filter((p) => p.id === pagoDepositoId).length;
    eq(nDespues, 1, 'después del duplicado, sigue existiendo una sola tarea BVE para ese pago — nunca dos');
  });

  await T('marcarBoletaEmitida: guarda folio, fecha de emisión y observación; el pago pasa a ISSUED', async () => {
    const resultado = await marcarBoletaEmitida({
      pagoId: pagoDepositoId, folio: 'BVE-QA-001', fecha: '2026-09-08', observacion: 'Emitida en QA de integración',
    });
    yes(resultado.ok, `marcarBoletaEmitida falló: ${resultado.motivo}`);
    eq(resultado.pago.tributario, 'ISSUED');
    eq(resultado.pago.tributario_ref, 'BVE-QA-001');
    eq(resultado.pago.tributario_obs, 'Emitida en QA de integración');
    yes(resultado.pago.tributario_emitido != null, 'debe quedar guardada la fecha de emisión');
    // fechaISO() y no String(...).slice(0,10): un TIMESTAMPTZ puede volver
    // como objeto Date de JS, y String(unDate) da el formato local
    // ("Tue Sep 08 2026…"), no ISO — el mismo bug ya encontrado en Calendar.
    eq(fechaISO(resultado.pago.tributario_emitido), '2026-09-08', 'la fecha de emisión debe ser la que escribió César, no "ahora"');

    const evento = await q1(
      `SELECT tipo, referencia FROM pago_evento WHERE pago_id = $1 AND tipo = 'BOLETA_MARCADA_EMITIDA' ORDER BY id DESC LIMIT 1`,
      [pagoDepositoId]
    );
    yes(!!evento, 'debe quedar registrado el evento BOLETA_MARCADA_EMITIDA');
    eq(evento.referencia, 'BVE-QA-001');
  });

  await T('pendiente desaparece SOLO después de BVE_ISSUED: la del anticipo ya no sale, la del saldo sigue', async () => {
    const pendientes = await pagosPendientesBVE();
    const ids = pendientes.map((p) => p.id);
    eq(ids.includes(pagoDepositoId), false, 'la tarea recién marcada emitida no debe seguir en "pendientes"');
    yes(ids.includes(pagoSaldoId), 'la tarea del saldo, todavía no emitida, debe seguir apareciendo');
  });

  // ══════════════════════════════════════════════════════════════════
  // REGRESIÓN — documento "Bug a revisar antes de seguir", 07-sep-2026:
  // en Sandbox, César quiso registrar un pago manual de $50.000 y el
  // sistema guardó $82.500 (el saldo TEÓRICO de la reserva) porque el
  // formulario no tenía campo de monto para Anticipo/Saldo —solo para
  // Adicional— y montoQueCorresponde() decidía el monto en su lugar. El
  // dinero no se perdió (el pago existía, con el monto equivocado) ni se
  // borró al marcar la BVE emitida, pero registrar un hecho distinto del
  // que ocurrió es el problema real. Estas pruebas fijan el
  // comportamiento correcto para siempre.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_BUG = '2027-03-13'; // sábado, distinta de las anteriores
  let reservaBug = null;
  let pagoBugId = null;

  await T('REGRESIÓN bug 07-sep: preparación — reserva total $300.000, anticipo $150.000', async () => {
    const r = await crearReservaManual({
      referencia: 'QATEST regresión bug BVE', nombreNino: 'Festejado Bug', apoderado: 'Apoderado Bug',
      email: 'qatest.bug@celebrasincesar.cl', telefono: '+56900000007',
      fecha: FECHA_BUG, turno: 'AM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 300000, anticipo: 150000, notas: '',
    });
    yes(r.ok, `crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    reservaBug = r.reserva;
  });

  await T('REGRESIÓN bug 07-sep: el monto guardado es EXACTAMENTE el que escribe César, nunca "lo que debería faltar"', async () => {
    // $50.000 a propósito NO calza con el anticipo pendiente ($150.000):
    // es justo el caso real que expuso el bug — un monto que no coincide
    // con el teórico tiene que guardarse tal cual, no sustituirse.
    const resultado = await registrarPagoManual({
      codigo: reservaBug.codigo, tipo: 'DEPOSIT', medio: 'TRANSFERENCIA_BANCOESTADO',
      monto: 50000, fechaPago: null, referencia: 'QATEST monto real distinto del teórico',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    pagoBugId = resultado.pagoId;

    const pago = await q1(`SELECT monto FROM pago WHERE id = $1`, [pagoBugId]);
    eq(pago.monto, 50000, 'el monto guardado debe ser el que escribió César ($50.000), nunca el anticipo teórico ($150.000)');
    eq(resultado.reserva.pagado, 50000, 'reserva.pagado debe reflejar exactamente lo que se registró');
    eq(resultado.reserva.estado, 'CONFIRMED', 'con menos que el anticipo cubierto, la reserva no pasa a BALANCE_PENDING ni a PAID');
  });

  await T('REGRESIÓN bug 07-sep: marcarBoletaEmitida NUNCA borra ni oculta el pago — sigue en pagosDeReserva con su monto, medio y tipo', async () => {
    const emitida = await marcarBoletaEmitida({ pagoId: pagoBugId, folio: 'BVE-BUG-001', fecha: '2026-09-08', observacion: null });
    yes(emitida.ok, `marcarBoletaEmitida falló: ${emitida.motivo}`);

    const pagos = await pagosDeReserva(reservaBug.id);
    const pago = pagos.find((p) => p.id === pagoBugId);
    yes(!!pago, 'el pago debe seguir existiendo y visible en pagosDeReserva() después de marcarlo emitida — nunca se borra ni se oculta');
    eq(pago.monto, 50000, 'el monto no cambia al marcar la BVE emitida');
    eq(pago.tipo, 'DEPOSIT', 'el tipo no cambia al marcar la BVE emitida');
    eq(pago.medio, 'Transferencia a BancoEstado', 'el medio no cambia al marcar la BVE emitida');
    eq(pago.estado, PAGO.PAID, 'el pago sigue PAID: marcar la BVE es una obligación tributaria aparte, nunca revierte el pago');
    eq(pago.tributario, 'ISSUED');
    eq(pago.tributario_ref, 'BVE-BUG-001');
  });

  await T('REGRESIÓN: un sobrepago real no se recorta ni se oculta — se acredita completo y queda visible', async () => {
    // Saldo pendiente en este punto: 300.000 - 50.000 = 250.000. Se registra
    // un EXTRA de 280.000: sobrepasa el total en 30.000 a propósito.
    const resultado = await registrarPagoManual({
      codigo: reservaBug.codigo, tipo: 'EXTRA', medio: 'EFECTIVO',
      monto: 280000, fechaPago: null, referencia: 'QATEST sobrepago intencional',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    eq(resultado.reserva.pagado, 330000, 'un sobrepago se acredita completo — nunca se recorta en silencio al total');
    yes(resultado.reserva.pagado > resultado.reserva.total, 'reserva.pagado debe quedar visiblemente por sobre reserva.total');
    eq(resultado.reserva.estado, 'PAID', 'con el total ya superado, la reserva queda pagada completa igual');
  });

  // ══════════════════════════════════════════════════════════════════
  // EMAIL CONTRACTUAL (documento "No autorizo todavía el deploy...",
  // 15-sep-2026, §9/§13): PAGO APROBADO → RESERVA CONFIRMADA → INTENTO
  // EMAIL CONTRACTUAL. Mismo criterio de prueba que NOTIFICACIÓN más abajo:
  // sin SMTP configurado en este entorno, se prueba el camino "falla
  // callado" y la idempotencia simulando el evento de envío exitoso — sin
  // depender de mandar un correo real.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_EMAIL_CONTRACTUAL = '2027-07-03'; // sábado, fecha fresca
  let reservaEmailContractual = null;

  await T('EMAIL CONTRACTUAL: preparación — reserva de prueba con tyc_hash real', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_EMAIL_CONTRACTUAL}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `debió crearse: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    reservaEmailContractual = r.reserva;
    yes(!!reservaEmailContractual.tyc_hash, 'la reserva de prueba debe tener tyc_hash para poder probar el email contractual');
  });

  await T('EMAIL CONTRACTUAL: sin haberlo mandado todavía, reservaYaTieneEmailContractual() es false', async () => {
    eq(await reservaYaTieneEmailContractual(reservaEmailContractual.id), false);
  });

  await T('EMAIL CONTRACTUAL: sin SMTP configurado, falla callado — nunca lanza, nunca marca como enviado', async () => {
    const resultado = await enviarEmailContractual(reservaEmailContractual.id);
    eq(resultado.ok, true, 'un correo no configurado no es un error del sistema — mismo criterio que notificarAdminPago/notificarClientePago');
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'correo_no_configurado');
    eq(await reservaYaTieneEmailContractual(reservaEmailContractual.id), false, 'como no se mandó nada, no debe quedar marcado como enviado');
  });

  await T('EMAIL CONTRACTUAL: reserva histórica sin tyc_hash → se salta sin marcar error (nada que adjuntar con certeza)', async () => {
    const resultado = await enviarEmailContractual(-1); // id inexistente: cubre 'reserva_no_encontrada'
    eq(resultado.ok, false);
    eq(resultado.motivo, 'reserva_no_encontrada');

    const historica = await q1(`SELECT id FROM reserva WHERE tyc_version = '2026-08' OR tyc_hash IS NULL LIMIT 1`);
    if (!historica) return; // el fixture puede no existir en todos los entornos
    const r2 = await enviarEmailContractual(historica.id);
    eq(r2.ok, true);
    eq(r2.enviado, false);
    eq(r2.motivo, 'sin_tyc_hash');
  });

  await T('EMAIL CONTRACTUAL: si la versión guardada no coincide con tyc_version, se rechaza y queda evento FALLIDO — nunca adjunta el PDF equivocado', async () => {
    // Se simula una inconsistencia que tycHashVigente() (§5) ya debería
    // impedir en la creación: una reserva con tyc_version apuntando a una
    // versión que no existe. No se toca tyc_version (protegida por el
    // trigger) — se prueba con una reserva cuyo tyc_version se manipula
    // directo en Postgres para esta comprobación (la propia columna
    // reserva.tyc_version SÍ es mutable, a diferencia de tyc_version.*).
    await q(`UPDATE reserva SET tyc_version = 'VERSION-QUE-NO-EXISTE' WHERE id = $1`, [reservaEmailContractual.id]);
    try {
      const resultado = await enviarEmailContractual(reservaEmailContractual.id);
      eq(resultado.ok, false);
      eq(resultado.motivo, 'version_no_coincide');
      const evento = await q1(
        `SELECT tipo FROM pago_evento WHERE reserva_id = $1 AND tipo = 'CONTRACTUAL_EMAIL_FALLIDO' ORDER BY id DESC LIMIT 1`,
        [reservaEmailContractual.id]
      );
      yes(!!evento, 'debe quedar registrado el evento CONTRACTUAL_EMAIL_FALLIDO');
    } finally {
      await q(`UPDATE reserva SET tyc_version = $2 WHERE id = $1`, [reservaEmailContractual.id, TYC_VERSION]);
    }
  });

  await T('EMAIL CONTRACTUAL: aparece en reservasPendientesEmailContractual() mientras esté firme y sin enviar', async () => {
    // La reserva de prueba quedó en PENDING_PAYMENT (nunca se le acreditó
    // un pago en este bloque) — se confirma manualmente para probar el
    // listado de pendientes sin depender de acreditar un pago real acá.
    await q(`UPDATE reserva SET estado = 'CONFIRMED' WHERE id = $1`, [reservaEmailContractual.id]);
    const pendientes = await reservasPendientesEmailContractual();
    yes(pendientes.some((p) => p.id === reservaEmailContractual.id), 'debe aparecer como pendiente: es firme y no tiene el evento ENVIADO');
  });

  await T('EMAIL CONTRACTUAL: una vez registrado el evento de envío, ya no aparece como pendiente y un segundo intento no vuelve a intentar mandar', async () => {
    // Simula que el correo SÍ se mandó (sin depender de SMTP real), igual
    // que el bloque de NOTIFICACIÓN más abajo.
    await q(
      `INSERT INTO pago_evento (reserva_id, tipo, referencia) VALUES ($1, $2, $3)`,
      [reservaEmailContractual.id, 'CONTRACTUAL_EMAIL_ENVIADO', reservaEmailContractual.codigo]
    );
    eq(await reservaYaTieneEmailContractual(reservaEmailContractual.id), true);

    const pendientes = await reservasPendientesEmailContractual();
    yes(!pendientes.some((p) => p.id === reservaEmailContractual.id), 'ya no debe aparecer como pendiente');

    const resultado = await enviarEmailContractual(reservaEmailContractual.id);
    eq(resultado.ok, true);
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'ya_enviado', 'un webhook duplicado sobre una reserva ya confirmada no debe generar un segundo correo');
  });

  // ══════════════════════════════════════════════════════════════════
  // EMAIL CONTRACTUAL — DEPOSIT vs. BALANCE (documento "NO autorizo
  // todavía Production...", 15-sep-2026, §8): el correo contractual (T&C
  // + PDF) se manda UNA vez, cuando el ANTICIPO confirma la reserva por
  // primera vez. Cuando el SALDO se paga después, NO debe volver a
  // mandarse el mismo contrato completo — sigue existiendo exactamente 1
  // evento CONTRACTUAL_EMAIL_ENVIADO. La idempotencia es por RESERVA, no
  // por pago, así que esto ya lo garantiza reservaYaTieneEmailContractual()
  // — acá se prueba el escenario de negocio explícito, con dos pagos
  // reales (DEPOSIT y BALANCE) sobre la misma reserva.
  // ══════════════════════════════════════════════════════════════════
  const FECHA_DEPOSIT_BALANCE = '2027-07-24'; // sábado, fecha fresca

  await T('EMAIL CONTRACTUAL — DEPOSIT confirma → 1 email; BALANCE posterior → sigue siendo exactamente 1; webhook repetido → sigue siendo 1', async () => {
    const r = await crearReserva({
      configuracion: { ...CONFIG_BASE, fecha: `${FECHA_DEPOSIT_BALANCE}T12:00:00.000Z`, hora: 'AM' },
      cliente: CLIENTE, aceptaTyc: true,
    });
    yes(r.ok, `crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    const reserva = r.reserva;

    // DEPOSIT: pago real, acreditado de verdad (no simulado).
    const commerceDeposit = await siguienteCommerceOrder(reserva.codigo, 'DEPOSIT');
    const pagoDeposit = await crearPagoPendiente({
      reservaId: reserva.id, commerceOrder: commerceDeposit, tipo: 'DEPOSIT', monto: reserva.anticipo,
    });
    const acreditadoDeposit = await acreditarPago({
      pagoId: pagoDeposit.id,
      estadoFlow: estadoFlowFalso({ monto: reserva.anticipo, flowOrder: 'QATEST-DEPOSIT-BALANCE-DEP' }),
      tributario: tributarioFalso,
    });
    yes(['CONFIRMED', 'BALANCE_PENDING', 'PAID'].includes(acreditadoDeposit.reserva.estado), 'el anticipo debe confirmar la reserva');

    // Sin SMTP configurado, enviarEmailContractual() no manda nada de
    // verdad (mismo criterio que el resto de esta suite) — se simula el
    // envío exitoso del ANTICIPO exactamente como haría un entorno con
    // SMTP real, para poder probar la regla de negocio DEPOSIT→BALANCE.
    await q(
      `INSERT INTO pago_evento (reserva_id, tipo, referencia, detalle) VALUES ($1, $2, $3, $4::jsonb)`,
      [reserva.id, 'CONTRACTUAL_EMAIL_ENVIADO', reserva.codigo, JSON.stringify({ tyc_version: reserva.tyc_version, simulado: 'DEPOSIT' })]
    );
    const contarEventos = async () => {
      const filas = await q(`SELECT id FROM pago_evento WHERE reserva_id = $1 AND tipo = 'CONTRACTUAL_EMAIL_ENVIADO'`, [reserva.id]);
      return filas.length;
    };
    eq(await contarEventos(), 1, 'después del anticipo debe existir exactamente 1 evento de email contractual');

    // BALANCE: segundo pago real sobre la MISMA reserva.
    const saldo = reserva.total - reserva.anticipo;
    const commerceBalance = await siguienteCommerceOrder(reserva.codigo, 'BALANCE');
    const pagoBalance = await crearPagoPendiente({
      reservaId: reserva.id, commerceOrder: commerceBalance, tipo: 'BALANCE', monto: saldo,
    });
    const acreditadoBalance = await acreditarPago({
      pagoId: pagoBalance.id,
      estadoFlow: estadoFlowFalso({ monto: saldo, flowOrder: 'QATEST-DEPOSIT-BALANCE-BAL' }),
      tributario: tributarioFalso,
    });
    eq(acreditadoBalance.reserva.estado, 'PAID', 'con el saldo pagado la reserva queda completa');

    // El intento de email contractual tras el saldo debe reconocer que ya
    // se mandó y NO generar un segundo evento — es la llamada real que
    // haría lib/pagos-flow.js tras cualquier acreditación.
    const intento = await enviarEmailContractual(reserva.id);
    eq(intento.motivo, 'ya_enviado', 'el intento tras el saldo debe reconocer que el contrato ya se envió con el anticipo');
    eq(await contarEventos(), 1, 'tras pagar el saldo debe seguir existiendo exactamente 1 evento — nunca un segundo email contractual');

    // Webhook repetido del ANTICIPO (Flow reintentando la misma
    // confirmación) tampoco debe generar un segundo evento.
    await acreditarPago({
      pagoId: pagoDeposit.id,
      estadoFlow: estadoFlowFalso({ monto: reserva.anticipo, flowOrder: 'QATEST-DEPOSIT-BALANCE-DEP' }),
      tributario: tributarioFalso,
    });
    await enviarEmailContractual(reserva.id);
    eq(await contarEventos(), 1, 'un webhook repetido del anticipo tampoco debe duplicar el evento de email contractual');
  });

  await T('PDF CONTRACTUAL: cada versión en tyc_version trae su propio PDF, con su propio hash, distinto entre versiones', async () => {
    const filas = await q(`SELECT version, pdf_sha256, length(pdf_bytes) AS len FROM tyc_version WHERE version IN ($1, $2)`, ['2026-09', '2026-09-v2']);
    if (filas.length < 2) return; // requiere haber corrido scripts/generar-pdf-tyc-version.mjs
    for (const f of filas) {
      yes(f.pdf_sha256, `${f.version} debe tener pdf_sha256`);
      yes(f.len > 1000, `${f.version} debe tener un PDF de tamaño razonable, no vacío`);
    }
    yes(filas[0].pdf_sha256 !== filas[1].pdf_sha256, 'dos versiones con contenido distinto deben producir PDFs con hash distinto');
  });

  // ══════════════════════════════════════════════════════════════════
  // NOTIFICACIÓN AUTOMÁTICA A CÉSAR (documento "Sí, avanza…", 09-sep-2026,
  // §3): la garantía real contra duplicados no es el `if (nuevos > 0)` de
  // quien llama — es este chequeo en Postgres. Se prueba directo, sin
  // depender de tener SMTP configurado localmente (si no lo está,
  // notificarAdminPago() debe fallar CALLADO — nunca lanzar, nunca marcar
  // como enviado algo que no se mandó).
  // ══════════════════════════════════════════════════════════════════
  const FECHA_NOTIF = '2027-03-14'; // domingo, distinta de las anteriores
  let reservaNotif = null;
  let pagoNotifId = null;

  await T('NOTIFICACIÓN: preparación — reserva de prueba', async () => {
    const r = await crearReservaManual({
      referencia: 'QATEST notificación admin', nombreNino: 'Festejado Notif', apoderado: 'Apoderado Notif',
      email: 'qatest.notif@celebrasincesar.cl', telefono: '+56900000008',
      fecha: FECHA_NOTIF, turno: 'PM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
      total: 200000, anticipo: 100000, notas: '',
    });
    yes(r.ok, `crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    filasCreadas.push({ tabla: 'reserva', columna: 'codigo', valor: r.reserva.codigo });
    reservaNotif = r.reserva;

    const resultado = await registrarPagoManual({
      codigo: reservaNotif.codigo, tipo: 'DEPOSIT', medio: 'TRANSFERENCIA_BANCOESTADO',
      monto: 100000, fechaPago: null, referencia: 'QATEST',
    });
    yes(resultado.ok, `registrarPagoManual falló: ${resultado.motivo}`);
    pagoNotifId = resultado.pagoId;
  });

  await T('NOTIFICACIÓN: sin haberla mandado todavía, pagoYaNotificado() es false', async () => {
    eq(await pagoYaNotificado(pagoNotifId), false);
  });

  await T('NOTIFICACIÓN: sin SMTP configurado, falla callado — nunca lanza, nunca marca como enviado', async () => {
    const resultado = await notificarAdminPago(pagoNotifId);
    eq(resultado.ok, true, 'un correo no configurado no es un error del sistema — es un estado esperado, igual que el cron de BVE');
    eq(resultado.enviado, false);
    eq(await pagoYaNotificado(pagoNotifId), false, 'como no se mandó nada, no debe quedar marcado como notificado');
  });

  await T('NOTIFICACIÓN: una vez registrado el evento de envío, un segundo intento no vuelve a intentar mandar', async () => {
    // Simula que el correo SÍ se mandó (sin depender de tener SMTP real acá):
    // se deja la misma evidencia que dejaría notificarAdminPago() tras un
    // envío exitoso.
    await q(
      `INSERT INTO pago_evento (pago_id, reserva_id, tipo, referencia) VALUES ($1, $2, $3, $4)`,
      [pagoNotifId, reservaNotif.id, 'NOTIFICACION_ADMIN_EMAIL_ENVIADA', reservaNotif.codigo]
    );
    eq(await pagoYaNotificado(pagoNotifId), true);

    const resultado = await notificarAdminPago(pagoNotifId);
    eq(resultado.ok, true);
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'ya_notificado', 'con el evento ya registrado, ni siquiera debe llegar a comprobar si hay SMTP configurado');
  });

  await T('NOTIFICACIÓN: construirResumenReserva() con esta reserva real trae festejado, montos y medio correctos', async () => {
    const pago = await q1(`SELECT * FROM pago WHERE id = $1`, [pagoNotifId]);
    const reservaActual = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaNotif.id]);
    const { construirResumenReserva } = await import('../lib/resumen-reserva.js');
    const resumen = construirResumenReserva(reservaActual, pago);
    yes(resumen.asunto.includes('Festejado Notif'));
    yes(resumen.asunto.includes(reservaNotif.codigo));
    yes(resumen.texto.includes('Transferencia a BancoEstado'));
    yes(resumen.texto.includes('Pendiente emitir Boleta Electrónica'), 'transferencia BancoEstado es PENDING_BVE');
  });

  // ══════════════════════════════════════════════════════════════════
  // CORREO DE CONFIRMACIÓN AL CLIENTE (documento "Fase de consolidación
  // final", 12-sep-2026, §9): misma garantía persistente que el correo a
  // administración, en un evento aparte, y solo para el pago que confirma
  // la reserva (el anticipo) — nunca para un saldo o un extra.
  // ══════════════════════════════════════════════════════════════════
  await T('NOTIFICACIÓN CLIENTE: sin haberla mandado todavía, pagoClienteYaNotificado() es false', async () => {
    eq(await pagoClienteYaNotificado(pagoNotifId), false);
  });

  await T('NOTIFICACIÓN CLIENTE: sin SMTP configurado, falla callado — nunca lanza, nunca marca como enviado', async () => {
    const resultado = await notificarClientePago(pagoNotifId);
    eq(resultado.ok, true);
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'correo_no_configurado');
    eq(await pagoClienteYaNotificado(pagoNotifId), false);
  });

  await T('NOTIFICACIÓN CLIENTE: una vez registrado el evento de envío, un segundo intento no vuelve a intentar mandar', async () => {
    await q(
      `INSERT INTO pago_evento (pago_id, reserva_id, tipo, referencia) VALUES ($1, $2, $3, $4)`,
      [pagoNotifId, reservaNotif.id, 'NOTIFICACION_CLIENTE_EMAIL_ENVIADA', reservaNotif.codigo]
    );
    eq(await pagoClienteYaNotificado(pagoNotifId), true);
    // El evento del correo a ADMINISTRACIÓN (ya registrado antes en este
    // mismo pago) no debe interferir — son guardas independientes.
    eq(await pagoYaNotificado(pagoNotifId), true, 'ambas guardas conviven sobre el mismo pago sin pisarse');

    const resultado = await notificarClientePago(pagoNotifId);
    eq(resultado.ok, true);
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'ya_notificado');
  });

  await T('NOTIFICACIÓN CLIENTE: un saldo o un extra nunca disparan el correo de "ya está reservada" — solo el anticipo', async () => {
    const saldo = await registrarPagoManual({
      codigo: reservaNotif.codigo, tipo: 'BALANCE', medio: 'TRANSFERENCIA_BANCOESTADO',
      monto: 100000, fechaPago: null, referencia: 'QATEST saldo, no debe notificar al cliente',
    });
    yes(saldo.ok, `registrarPagoManual (saldo) falló: ${saldo.motivo}`);

    const resultado = await notificarClientePago(saldo.pagoId);
    eq(resultado.ok, true);
    eq(resultado.enviado, false);
    eq(resultado.motivo, 'no_es_anticipo');
  });

  await T('NOTIFICACIÓN CLIENTE: construirResumenCliente() con esta reserva real trae festejado y los tres CTA', async () => {
    const reservaActual = await q1(`SELECT * FROM reserva WHERE id = $1`, [reservaNotif.id]);
    const { construirResumenCliente } = await import('../lib/resumen-cliente.js');
    const resumen = construirResumenCliente(reservaActual);
    yes(resumen.asunto.includes('Festejado Notif'));
    yes(resumen.asunto.includes(reservaNotif.codigo));
    yes(resumen.texto.includes('Ver mi celebración'), 'debe incluir el CTA al enlace privado de Mi Celebración');
    yes(resumen.texto.includes(`/mi-celebracion?id=${reservaNotif.codigo}`), 'el enlace debe usar el código real de la reserva');
    yes(resumen.texto.includes(`t=${reservaActual.acceso_token}`), 'el enlace debe usar el acceso_token real de la reserva');
    yes(resumen.texto.includes('Coordinar por WhatsApp'));
    yes(resumen.texto.includes('Personalizar aún más mi celebración'));
    yes(resumen.html.includes('logo-alce.webp'));
  });

} finally {
  await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
}

console.log(`\n${ok} pruebas OK`);
if (fallos.length) {
  console.log(`${fallos.length} FALLARON:\n`);
  fallos.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Todo OK.\n');
