// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — BLOQUE 2 (pendientes en /cadena + Calendar
// enriquecido)  ·  node scripts/qa-bloque2-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Mismo patrón que scripts/qa-bloque1-integracion.mjs: corre contra
// Postgres real (Sandbox/Preview), crea sus propias filas de prueba y las
// borra al terminar. Se salta solo si no hay base configurada.
//
// Documento "FASE 2B — IMPLEMENTAR BLOQUE 2", 21-sep-2026, §17: cubre lo
// que no se puede probar sin base real — pendientesActivos(),
// actualizarPendienteProveedor() y el enriquecimiento que consume
// /api/cadena/reservas (datos_finales + pendientes_proveedor por fila).
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
  console.log('\nQA de integración Bloque 2 — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q } = await import('../lib/db.js');
const { crearReserva, reservaPorCodigo } = await import('../lib/reservas.js');
const { aplicarCambioComercial } = await import('../lib/cambio-comercial.js');
const { guardarDatosFinales, datosFinalesVigentes } = await import('../lib/datos-finales.js');
const { pendientesDeReserva, pendientesActivos, actualizarPendienteProveedor } = await import('../lib/pendientes-proveedor.js');
const { resumenOperacional, todoListoParaCelebrar } = await import('../lib/resumen-operacional.js');
const { sincronizarCalendario, metodoCalendar } = await import('../lib/calendario.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Mismo criterio que Bloque 1: un sábado distinto por reserva de prueba,
// bien lejos de cualquier reserva real, para que el cerrojo de turno nunca
// choque entre pruebas.
const SABADO_BASE = new Date('2027-06-05T12:00:00.000Z');
let contadorFechas = 0;
function fechaPruebaSiguiente() {
  const d = new Date(SABADO_BASE.getTime() + contadorFechas * 7 * 86_400_000);
  contadorFechas++;
  return d.toISOString().slice(0, 10);
}

const CLIENTE = { nombre: 'QATEST Bloque2', email: 'qatest@celebrasincesar.cl', telefono: '+56900000002' };

const filasCreadas = [];
async function limpiar() {
  for (const codigo of filasCreadas) {
    await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
    await q(`DELETE FROM reserva WHERE codigo = $1`, [codigo]).catch(() => {});
  }
}

async function crearReservaPrueba(extras = [], tematica = null) {
  const r = await crearReserva({
    configuracion: {
      fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
      tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
      extras, tematica, horasAdicionales: 0,
    },
    cliente: CLIENTE, aceptaTyc: true,
  });
  if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
  filasCreadas.push(r.reserva.codigo);
  return r.reserva;
}

const ITEM_DECO_TEMATICA = { id: 'deco-tematica-full', nombre: 'Temática Full', emoji: '✨', precios: { hasta10: 75000, hasta20: 75000, hasta30: 75000, mas30: 75000 } };
const ITEM_ANIMACION_1 = { id: 'animacion-huntrix', nombre: 'Animación Full Huntrix', emoji: '💜', precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 } };

try {

  // ══════════════════════════════════════════════════════════════════
  // pendientesActivos()
  // ══════════════════════════════════════════════════════════════════
  await T('pendientesActivos: PENDIENTE aparece activo, enriquecido con festejado/fecha/urgencia', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Huntrix');
    const activos = await pendientesActivos();
    const fila = activos.find((p) => p.reservaId === reserva.id);
    yes(fila, 'debe aparecer en la lista activa');
    eq(fila.codigo, reserva.codigo);
    eq(fila.detalle, 'Huntrix');
    eq(fila.estado, 'PENDIENTE');
    yes(fila.urgencia && ['rojo', 'naranja', 'amarillo'].includes(fila.urgencia.nivel));
  });

  await T('pendientesActivos: CONFIRMADO desaparece de la lista activa pero sigue en pendientesDeReserva (detalle)', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendiente] = await pendientesDeReserva(reserva.id);
    const r1 = await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'CONFIRMADO' });
    yes(r1.ok, JSON.stringify(r1));

    const activos = await pendientesActivos();
    yes(!activos.some((p) => p.id === pendiente.id), 'CONFIRMADO no debe ocupar la lista principal de pendientes');

    const detalle = await pendientesDeReserva(reserva.id);
    const filaDetalle = detalle.find((p) => p.id === pendiente.id);
    eq(filaDetalle.estado, 'CONFIRMADO', 'debe seguir visible en el detalle de la reserva');
  });

  await T('pendientesActivos: RETIRADO nunca aparece activo', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [] }, motivo: 'quitar_animacion' });
    const activos = await pendientesActivos();
    yes(!activos.some((p) => p.reservaId === reserva.id), 'un RETIRADO no debe aparecer en la lista activa');
  });

  await T('pendientesActivos: NO_DISPONIBLE queda visible y con urgencia roja (prioritario)', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendiente] = await pendientesDeReserva(reserva.id);
    await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'NO_DISPONIBLE' });

    const activos = await pendientesActivos();
    const fila = activos.find((p) => p.id === pendiente.id);
    yes(fila, 'NO_DISPONIBLE nunca debe ocultarse solo');
    eq(fila.urgencia.nivel, 'rojo');
  });

  // ══════════════════════════════════════════════════════════════════
  // actualizarPendienteProveedor() — endpoint admin (§14)
  // ══════════════════════════════════════════════════════════════════
  await T('actualizarPendienteProveedor: REVISAR_DESPUES conserva la fecha exacta que se le da', async () => {
    // Igual que fechaISO() en lib/reservas.js: proxima_revision vuelve como
    // Date de JS, y String(fecha) da el formato local, no ISO — el mismo
    // bug ya documentado, esta vez en la propia prueba, no en el código.
    const iso = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendiente] = await pendientesDeReserva(reserva.id);
    const r = await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'REVISAR_DESPUES', proximaRevision: '2027-08-15' });
    yes(r.ok, JSON.stringify(r));
    eq(iso(r.pendiente.proxima_revision), '2027-08-15');

    const [actualizado] = await pendientesDeReserva(reserva.id);
    eq(iso(actualizado.proxima_revision), '2027-08-15');
  });

  await T('actualizarPendienteProveedor: rechaza un estado inválido', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendiente] = await pendientesDeReserva(reserva.id);
    const r = await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'ESTADO_INVENTADO' });
    eq(r.ok, false);
    eq(r.motivo, 'estado_invalido');
  });

  await T('actualizarPendienteProveedor: REVISAR_DESPUES sin fecha válida se rechaza', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendiente] = await pendientesDeReserva(reserva.id);
    const r = await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'REVISAR_DESPUES', proximaRevision: null });
    eq(r.ok, false);
    eq(r.motivo, 'fecha_invalida');
  });

  await T('actualizarPendienteProveedor: un RETIRADO nunca se puede confirmar a mano mientras no vuelva a la configuración vigente', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [] }, motivo: 'quitar' });
    const [retirado] = await pendientesDeReserva(reserva.id);
    eq(retirado.estado, 'RETIRADO');

    const r = await actualizarPendienteProveedor({ pendienteId: retirado.id, estado: 'CONFIRMADO' });
    eq(r.ok, false);
    eq(r.motivo, 'retirado_no_editable');

    const [siguesRetirado] = await pendientesDeReserva(reserva.id);
    eq(siguesRetirado.estado, 'RETIRADO', 'el intento rechazado no debe haber cambiado nada');
  });

  await T('actualizarPendienteProveedor: no permite operar el pendiente de una reserva ajena (aislamiento por id, sin reservaId aparte)', async () => {
    const reservaA = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const reservaB = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [pendienteA] = await pendientesDeReserva(reservaA.id);
    const [pendienteB] = await pendientesDeReserva(reservaB.id);

    await actualizarPendienteProveedor({ pendienteId: pendienteA.id, estado: 'CONFIRMADO' });

    const [bDespues] = await pendientesDeReserva(reservaB.id);
    eq(bDespues.id, pendienteB.id);
    eq(bDespues.estado, 'PENDIENTE', 'actualizar el pendiente de A nunca debe tocar el de B');
  });

  await T('actualizarPendienteProveedor: pendiente inexistente devuelve motivo claro, no revienta', async () => {
    const r = await actualizarPendienteProveedor({ pendienteId: 999999999, estado: 'CONFIRMADO' });
    eq(r.ok, false);
    eq(r.motivo, 'pendiente_inexistente');
  });

  // ══════════════════════════════════════════════════════════════════
  // /cadena — enriquecimiento que consume app/api/cadena/reservas
  // (mismas lecturas: última fila de Datos Finales, pendientes sin
  // RETIRADO, configuración vigente, resumenOperacional/todoListo)
  // ══════════════════════════════════════════════════════════════════
  await T('/cadena: usa la ÚLTIMA fila de Datos Finales, nunca una anterior (doble confirmación)', async () => {
    const reserva = await crearReservaPrueba();
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 8, mayoresFinal: 0, adultosAprox: 4, adultoResponsable: 'Primera', telefonoOperacional: '+56911111111' });
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 9, mayoresFinal: 1, adultosAprox: 5, adultoResponsable: 'Segunda', telefonoOperacional: '+56922222222' });

    const vigente = await datosFinalesVigentes(reserva.id);
    eq(vigente.adulto_responsable, 'Segunda', 'debe ser la más reciente');

    const historico = await q(`SELECT count(*)::int AS n FROM datos_finales_reserva WHERE reserva_id = $1`, [reserva.id]);
    eq(historico[0].n, 2, 'ambas confirmaciones deben seguir existiendo en la base (histórico)');
  });

  await T('/cadena: resumenOperacional usa saldo derivado (total vigente - pagado), nunca reserva.saldo', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    const resumen = resumenOperacional({ reserva: reservaDespues, datosFinales: null, pendientes: [] });
    eq(resumen.pagos.total, reservaDespues.total);
    eq(resumen.pagos.pagado, reservaDespues.pagado);
    eq(resumen.pagos.saldo, reservaDespues.total - reservaDespues.pagado);
  });

  await T('/cadena: resumenOperacional refleja la configuración VIGENTE tras un cambio comercial, no la original', async () => {
    const reserva = await crearReservaPrueba();
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_ANIMACION_1] }, motivo: 'agregar_animacion' });
    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    const pendientes = await pendientesDeReserva(reservaDespues.id);
    const resumen = resumenOperacional({ reserva: reservaDespues, datosFinales: null, pendientes });
    yes(resumen.chips.some((c) => c.texto.includes('Animación')), 'debe reflejar la animación agregada después de crear la reserva');
  });

  await T('/cadena: Todo listo para celebrar 🎉 solo aparece cuando corresponde de verdad (integración completa)', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA, ITEM_ANIMACION_1], 'Minnie');
    // crearReservaPrueba() nunca paga de verdad — la reserva nace
    // PENDING_PAYMENT. "Reserva vigente" (§15) es un candado real y
    // aparte del de Datos Finales/proveedores; se fuerza acá a un estado
    // firme (igual que un anticipo ya acreditado) para poder probar el
    // resto de la regla sin correr un pago real de Flow en esta suite.
    await q(`UPDATE reserva SET estado = 'BALANCE_PENDING' WHERE id = $1`, [reserva.id]);
    let reservaActual = await reservaPorCodigo(reserva.codigo);
    let pendientes = await pendientesDeReserva(reservaActual.id);

    yes(!todoListoParaCelebrar({ reserva: reservaActual, datosFinales: null, pendientes }), 'sin Datos Finales todavía no puede estar listo');

    await guardarDatosFinales({ reservaId: reservaActual.id, ninosFinal: 10, mayoresFinal: 0, adultosAprox: 5, adultoResponsable: 'Resp', telefonoOperacional: '+56933333333' });
    const datosFinales = await datosFinalesVigentes(reservaActual.id);

    yes(!todoListoParaCelebrar({ reserva: reservaActual, datosFinales, pendientes }), 'con proveedores PENDIENTE todavía no puede estar listo');

    for (const p of pendientes) await actualizarPendienteProveedor({ pendienteId: p.id, estado: 'CONFIRMADO' });
    pendientes = await pendientesDeReserva(reservaActual.id);

    yes(todoListoParaCelebrar({ reserva: reservaActual, datosFinales, pendientes }), 'con Datos Finales + todos los proveedores confirmados, debe quedar listo');
  });

  // ══════════════════════════════════════════════════════════════════
  // CALENDAR — idempotencia (§17 "Calendar"). Nunca llama a Google de
  // verdad en este entorno: VERCEL_ENV no es 'production' acá, así que
  // sincronizarCalendario() siempre cae en la rama "preview_sin_escritura"
  // (o "sin_configurar" si faltan credenciales) — nunca lanza.
  // ══════════════════════════════════════════════════════════════════
  await T('sincronizarCalendario: nunca lanza y siempre devuelve {ok}, sin tocar Google fuera de Production', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const resultado = await sincronizarCalendario(reserva.id);
    yes(typeof resultado.ok === 'boolean');
    yes(['preview_sin_escritura', 'sin_configurar', undefined].includes(resultado.motivo), JSON.stringify(resultado));
  });

  await T('metodoCalendar: sigue siendo PUT tras confirmar Datos Finales dos veces, cambiar proveedor y aplicar un cambio comercial — nunca vuelve a POST', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    // Simula que ya existe un evento (como si Production ya lo hubiera creado).
    await q(`UPDATE reserva SET calendar_event_id = 'evt_fake_qa', calendar_estado = 'OK' WHERE id = $1`, [reserva.id]);

    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 9, mayoresFinal: 0, adultosAprox: 5, adultoResponsable: 'A', telefonoOperacional: '+56900000001' });
    let actual = await reservaPorCodigo(reserva.codigo);
    eq(metodoCalendar(actual), 'PUT', 'después de la 1ª confirmación de Datos Finales debe seguir siendo PUT');

    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 10, mayoresFinal: 1, adultosAprox: 6, adultoResponsable: 'B', telefonoOperacional: '+56900000002' });
    actual = await reservaPorCodigo(reserva.codigo);
    eq(metodoCalendar(actual), 'PUT', 'la 2ª confirmación también debe seguir siendo PUT — nunca un POST duplicado');

    const [pendiente] = await pendientesDeReserva(reserva.id);
    await actualizarPendienteProveedor({ pendienteId: pendiente.id, estado: 'CONFIRMADO' });
    actual = await reservaPorCodigo(reserva.codigo);
    eq(metodoCalendar(actual), 'PUT', 'cambiar el estado de un proveedor tampoco debe crear un evento nuevo');

    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_DECO_TEMATICA, ITEM_ANIMACION_1], tematica: 'Minnie' }, motivo: 'agregar_animacion' });
    actual = await reservaPorCodigo(reserva.codigo);
    eq(metodoCalendar(actual), 'PUT', 'un cambio comercial posterior tampoco debe crear un evento nuevo');
  });

} finally {
  await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
}

console.log(`\n  QA de integración Bloque 2 — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
