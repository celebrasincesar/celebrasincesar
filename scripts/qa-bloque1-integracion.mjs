// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — BLOQUE 1 (Datos Finales + cambio comercial +
// pendientes con proveedor)  ·  node scripts/qa-bloque1-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Mismo patrón que scripts/qa-pagos-integracion.mjs: corre contra
// Postgres real (Sandbox/Preview), crea sus propias filas de prueba y las
// borra al terminar. Se salta solo si no hay base configurada.
//
// Documento "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026, §14: cubre los
// candados que no se pueden probar sin base de datos real (las 4 tablas
// nuevas), complementando scripts/qa-mi-celebracion.mjs (puro).
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
  console.log('\nQA de integración Bloque 1 — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q, q1 } = await import('../lib/db.js');
const { crearReserva, reservaPorCodigo, configuracionVigente, igualSeguro } = await import('../lib/reservas.js');
const { aplicarCambioComercial, historicoComercial } = await import('../lib/cambio-comercial.js');
const { guardarDatosFinales, datosFinalesVigentes, historicoDatosFinales } = await import('../lib/datos-finales.js');
const { pendientesDeReserva } = await import('../lib/pendientes-proveedor.js');
// igualSeguro vive en lib/validacion.js —pura, sin 'next/server'— se
// importa directo de ahí en vez del truco de leer+evaluar lib/http.js a
// mano (documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR
// BLOQUE A", 22-sep-2026).
const { igualSeguro: igualSeguroHttp } = await import('../lib/validacion.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Sábado base, muy lejos de cualquier reserva real. Cada reserva de
// prueba usa un sábado DISTINTO (+7 días cada vez) — el cerrojo de turno
// es único por fecha+turno, así que reutilizar la misma fecha entre tests
// haría que el segundo choque con "turno_ocupado" del primero, que nunca
// se libera (esta suite no paga ni expira holds, solo crea y borra).
const SABADO_BASE = new Date('2027-04-17T12:00:00.000Z');
let contadorFechas = 0;
function fechaPruebaSiguiente() {
  const d = new Date(SABADO_BASE.getTime() + contadorFechas * 7 * 86_400_000);
  contadorFechas++;
  return d.toISOString().slice(0, 10);
}

const CLIENTE = { nombre: 'QATEST Bloque1', email: 'qatest@celebrasincesar.cl', telefono: '+56900000001' };

const filasCreadas = [];
async function limpiar() {
  for (const codigo of filasCreadas) {
    await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
    // ON DELETE CASCADE en cambio_comercial/datos_finales_reserva/
    // pendiente_proveedor/pago limpia todo lo demás solo.
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
const ITEM_ANIMACION_2 = { id: 'animacion-completa', nombre: 'Animación Completa', emoji: '🎪', precios: { hasta10: 95000, hasta20: 110000, hasta30: 125000, mas30: 125000 } };
const ITEM_NORMAL = { id: 'tiburon-escalador', nombre: 'Tiburón Escalador', emoji: '🦈' };

try {

  // ══════════════════════════════════════════════════════════════════
  // SNAPSHOT / CONFIGURACIÓN VIGENTE
  // ══════════════════════════════════════════════════════════════════
  await T('Sin cambios comerciales, la vigente es exactamente la original', async () => {
    const reserva = await crearReservaPrueba();
    const original = typeof reserva.snapshot === 'string' ? JSON.parse(reserva.snapshot) : reserva.snapshot;
    const vigente = configuracionVigente(reserva);
    eq(JSON.stringify(vigente), JSON.stringify(original));
    eq(reserva.snapshot_vigente, null);
  });

  await T('Un cambio comercial nunca modifica reserva.snapshot (contratación original intacta)', async () => {
    const reserva = await crearReservaPrueba();
    const snapshotOriginalAntes = reserva.snapshot;

    const resultado = await aplicarCambioComercial({
      reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_NORMAL] }, motivo: 'test',
    });
    yes(resultado.ok, `aplicarCambioComercial falló: ${resultado.motivo} ${JSON.stringify(resultado.errores || '')}`);

    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    eq(JSON.stringify(reservaDespues.snapshot), JSON.stringify(snapshotOriginalAntes), 'snapshot original no debe cambiar ni un byte');
  });

  await T('Con un cambio aplicado, la vigente es snapshot_vigente, no la original', async () => {
    const reserva = await crearReservaPrueba();
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_NORMAL] }, motivo: 'test' });
    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    const vigente = configuracionVigente(reservaDespues);
    yes(vigente.configuracion.extras.some((e) => e.id === ITEM_NORMAL.id), 'la vigente debe traer el adicional agregado');
    const original = typeof reservaDespues.snapshot === 'string' ? JSON.parse(reservaDespues.snapshot) : reservaDespues.snapshot;
    yes(!original.configuracion.extras.some((e) => e.id === ITEM_NORMAL.id), 'la original NO debe traerlo');
  });

  // ══════════════════════════════════════════════════════════════════
  // TOTALES / SALDO
  // ══════════════════════════════════════════════════════════════════
  await T('Aumento actualiza el total correctamente y el saldo derivado sigue correcto', async () => {
    const reserva = await crearReservaPrueba();
    const totalAntes = reserva.total;
    const pagadoAntes = reserva.pagado;

    const resultado = await aplicarCambioComercial({
      reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_NORMAL] }, motivo: 'test',
    });
    yes(resultado.ok);
    eq(resultado.totalAntes, totalAntes);
    eq(resultado.diferencia, resultado.totalDespues - totalAntes);
    yes(resultado.totalDespues > totalAntes, 'agregar un adicional debe subir el total');

    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    eq(reservaDespues.total, resultado.totalDespues);
    eq(reservaDespues.pagado, pagadoAntes, 'un aumento NUNCA debe generar un pago automático');
    const saldoDerivado = reservaDespues.total - reservaDespues.pagado;
    yes(saldoDerivado === resultado.totalDespues - pagadoAntes, 'el saldo derivado (total-pagado) debe reflejar el aumento');
  });

  await T('El histórico queda registrado con antes/ahora/diferencia, append-only', async () => {
    const reserva = await crearReservaPrueba();
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_NORMAL] }, motivo: 'primero' });
    const historico = await historicoComercial(reserva.id);
    eq(historico.length, 1);
    eq(historico[0].diferencia, historico[0].total_despues - historico[0].total_antes);
  });

  // ══════════════════════════════════════════════════════════════════
  // DATOS FINALES
  // ══════════════════════════════════════════════════════════════════
  await T('Datos Finales: reducir asistentes NO cambia el precio ni la configuración comercial', async () => {
    const reserva = await crearReservaPrueba();
    const totalAntes = reserva.total;
    const ninosContratados = reserva.ninos;

    const resultado = await guardarDatosFinales({
      reservaId: reserva.id, ninosFinal: Math.max(0, ninosContratados - 3), mayoresFinal: 0,
      adultosAprox: 5, adultoResponsable: 'María Pérez', telefonoOperacional: '+56911111111', observacion: null,
    });
    yes(resultado.ok, JSON.stringify(resultado.errores));

    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    eq(reservaDespues.total, totalAntes);
    eq(reservaDespues.ninos, ninosContratados, 'reserva.ninos (contratado) nunca cambia por datos finales');
    eq(reservaDespues.snapshot_vigente, null, 'datos finales no toca snapshot_vigente');
  });

  await T('Datos Finales: mayores_final no puede superar ninos_final', async () => {
    const reserva = await crearReservaPrueba();
    const resultado = await guardarDatosFinales({
      reservaId: reserva.id, ninosFinal: 5, mayoresFinal: 8,
      adultosAprox: 3, adultoResponsable: 'X', telefonoOperacional: '+56900000000',
    });
    eq(resultado.ok, false);
    yes(resultado.errores.some((e) => e.includes('no pueden ser más')));
  });

  await T('Datos Finales: valores negativos se rechazan', async () => {
    const reserva = await crearReservaPrueba();
    const resultado = await guardarDatosFinales({
      reservaId: reserva.id, ninosFinal: -1, mayoresFinal: 0,
      adultosAprox: 2, adultoResponsable: 'X', telefonoOperacional: '+56900000000',
    });
    eq(resultado.ok, false);
  });

  await T('Datos Finales: doble confirmación conserva AMBAS filas (append-only, nunca UPDATE)', async () => {
    const reserva = await crearReservaPrueba();
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 10, mayoresFinal: 0, adultosAprox: 4, adultoResponsable: 'A', telefonoOperacional: '+56900000001' });
    await guardarDatosFinales({ reservaId: reserva.id, ninosFinal: 8, mayoresFinal: 0, adultosAprox: 3, adultoResponsable: 'B', telefonoOperacional: '+56900000002' });

    const historico = await historicoDatosFinales(reserva.id);
    eq(historico.length, 2, 'las dos confirmaciones deben seguir existiendo');
    const vigente = await datosFinalesVigentes(reserva.id);
    eq(vigente.ninos_final, 8, 'la vigente es la más reciente');
    eq(vigente.adulto_responsable, 'B');
  });

  // ══════════════════════════════════════════════════════════════════
  // DECORACIÓN TEMÁTICA
  // ══════════════════════════════════════════════════════════════════
  await T('Decoración temática sin temática: validarConfiguracion rechaza (candado servidor)', async () => {
    const r = await crearReserva({
      configuracion: {
        fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
        tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
        extras: [ITEM_DECO_TEMATICA], tematica: '', horasAdicionales: 0,
      },
      cliente: CLIENTE, aceptaTyc: true,
    });
    eq(r.ok, false);
    yes(r.errores.some((e) => e.includes('temática')));
  });

  await T('Decoración temática con temática: se crea el pendiente PENDIENTE con la temática correcta', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 1);
    eq(pendientes[0].tipo, 'decoracion_tematica');
    eq(pendientes[0].item_id, 'deco-tematica-full');
    eq(pendientes[0].detalle, 'Minnie');
    eq(pendientes[0].estado, 'PENDIENTE');
  });

  await T('proxima_revision se calcula con fechaISO(), nunca String(fecha) local (regresión: reserva.fecha_evento llega como Date real de Postgres)', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const [pendiente] = await pendientesDeReserva(reserva.id);
    yes(pendiente.proxima_revision != null, 'proxima_revision no debe quedar null — evento.getTime() NaN indica el bug String(fecha)');
    const revision = pendiente.proxima_revision instanceof Date
      ? pendiente.proxima_revision.toISOString().slice(0, 10)
      : String(pendiente.proxima_revision).slice(0, 10);
    yes(/^\d{4}-\d{2}-\d{2}$/.test(revision), `proxima_revision debe ser una fecha ISO real, obtuvo: ${revision}`);
  });

  await T('Cambio de temática (Minnie → Huntrix) resetea CONFIRMADO a PENDIENTE', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const [pendiente] = await pendientesDeReserva(reserva.id);
    await q(`UPDATE pendiente_proveedor SET estado = 'CONFIRMADO' WHERE id = $1`, [pendiente.id]);

    // Cambiar la temática vía un cambio comercial (mismos extras, tematica nueva).
    const resultado = await aplicarCambioComercial({
      reservaId: reserva.id,
      configuracionPropuesta: { extras: [ITEM_DECO_TEMATICA], tematica: 'Huntrix' },
      motivo: 'cambio_tematica',
    });
    yes(resultado.ok, JSON.stringify(resultado.errores));

    const [actualizado] = await pendientesDeReserva(reserva.id);
    eq(actualizado.estado, 'PENDIENTE', 'un CONFIRMADO nunca debe sobrevivir a un cambio de temática');
    eq(actualizado.detalle, 'Huntrix');
  });

  await T('Misma temática (sin cambio real): un CONFIRMADO existente se mantiene', async () => {
    const reserva = await crearReservaPrueba([ITEM_DECO_TEMATICA], 'Minnie');
    const [pendiente] = await pendientesDeReserva(reserva.id);
    await q(`UPDATE pendiente_proveedor SET estado = 'CONFIRMADO' WHERE id = $1`, [pendiente.id]);

    await aplicarCambioComercial({
      reservaId: reserva.id,
      configuracionPropuesta: { extras: [ITEM_DECO_TEMATICA, ITEM_NORMAL], tematica: 'Minnie' },
      motivo: 'agregar_otro_adicional',
    });

    const [actualizado] = (await pendientesDeReserva(reserva.id)).filter((p) => p.tipo === 'decoracion_tematica');
    eq(actualizado.estado, 'CONFIRMADO', 'agregar un adicional NO relacionado no debe resetear una decoración ya confirmada');
  });

  // ══════════════════════════════════════════════════════════════════
  // ANIMACIÓN
  // ══════════════════════════════════════════════════════════════════
  await T('Una animación agregada crea exactamente un pendiente', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 1);
    eq(pendientes[0].tipo, 'animacion');
    eq(pendientes[0].item_id, ITEM_ANIMACION_1.id);
  });

  await T('Dos animaciones distintas crean dos pendientes independientes', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1, ITEM_ANIMACION_2]);
    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 2);
    const ids = pendientes.map((p) => p.item_id).sort();
    eq(JSON.stringify(ids), JSON.stringify([ITEM_ANIMACION_1.id, ITEM_ANIMACION_2.id].sort()));
  });

  await T('El mismo ítem no se duplica (UNIQUE reserva_id+tipo+item_id, ON CONFLICT DO NOTHING)', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    // Vuelve a sincronizar con la MISMA configuración — no debe duplicar.
    const { sincronizarPendientesProveedor } = await import('../lib/pendientes-proveedor.js');
    await sincronizarPendientesProveedor({ reservaId: reserva.id, configuracion: { extras: [ITEM_ANIMACION_1] }, fechaEvento: reserva.fecha_evento });
    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 1);
  });

  // ══════════════════════════════════════════════════════════════════
  // RETIRO Y REACTIVACIÓN
  // ══════════════════════════════════════════════════════════════════
  await T('Retirar una animación de la configuración marca RETIRADO, nunca borra la fila', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    await aplicarCambioComercial({
      reservaId: reserva.id, configuracionPropuesta: { extras: [] }, motivo: 'quitar_animacion',
    });
    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 1, 'la fila debe seguir existiendo');
    eq(pendientes[0].estado, 'RETIRADO');
  });

  await T('Re-agregar un ítem RETIRADO lo reactiva como PENDIENTE (no CONFIRMADO heredado)', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    const [antes] = await pendientesDeReserva(reserva.id);
    await q(`UPDATE pendiente_proveedor SET estado = 'CONFIRMADO' WHERE id = $1`, [antes.id]);

    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [] }, motivo: 'quitar' });
    let [fila] = await pendientesDeReserva(reserva.id);
    eq(fila.estado, 'RETIRADO');

    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_ANIMACION_1] }, motivo: 'volver_a_agregar' });
    [fila] = await pendientesDeReserva(reserva.id);
    eq(fila.estado, 'PENDIENTE', 'debe pedir disponibilidad de nuevo, no heredar el CONFIRMADO anterior');
  });

  await T('pendientesProveedor de Mi Celebración nunca muestra RETIRADO (resumenMiCelebracion filtra)', async () => {
    const reserva = await crearReservaPrueba([ITEM_ANIMACION_1]);
    await aplicarCambioComercial({ reservaId: reserva.id, configuracionPropuesta: { extras: [] }, motivo: 'quitar' });
    const { resumenMiCelebracion } = await import('../lib/mi-celebracion.js');
    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    const pendientes = await pendientesDeReserva(reservaDespues.id);
    const resumen = resumenMiCelebracion(reservaDespues, { pendientes });
    eq(resumen.pendientesProveedor.length, 0, 'un pendiente RETIRADO no debe aparecer en la pantalla del cliente');
  });

  // ══════════════════════════════════════════════════════════════════
  // ADICIONAL POSTERIOR (reutiliza el motor comercial)
  // ══════════════════════════════════════════════════════════════════
  await T('Agregar un adicional posterior aumenta total/saldo sin crear una reserva nueva ni exigir pago', async () => {
    const reserva = await crearReservaPrueba();
    const conteoAntes = (await q(`SELECT count(*)::int AS n FROM reserva WHERE codigo = $1`, [reserva.codigo]))[0].n;
    const pagadoAntes = reserva.pagado;

    const resultado = await aplicarCambioComercial({
      reservaId: reserva.id, configuracionPropuesta: { extras: [ITEM_ANIMACION_1] }, motivo: 'adicional_posterior',
    });
    yes(resultado.ok);

    const conteoDespues = (await q(`SELECT count(*)::int AS n FROM reserva WHERE codigo = $1`, [reserva.codigo]))[0].n;
    eq(conteoDespues, conteoAntes, 'nunca debe crear una segunda fila de reserva');

    const reservaDespues = await reservaPorCodigo(reserva.codigo);
    eq(reservaDespues.pagado, pagadoAntes, 'agregar un adicional no genera pago automático');
    yes(reservaDespues.total > reserva.total);

    const pendientes = await pendientesDeReserva(reserva.id);
    eq(pendientes.length, 1, 'debe generar el pendiente de proveedor correspondiente');
  });

  // ══════════════════════════════════════════════════════════════════
  // SEGURIDAD — mismo modelo de autorización que ya usa Mi Celebración
  // ══════════════════════════════════════════════════════════════════
  await T('Token inválido nunca resuelve el acceso_token real de otra reserva', async () => {
    const reserva = await crearReservaPrueba();
    const tokenFalso = 'f'.repeat(32);
    yes(!igualSeguroHttp(reserva.acceso_token, tokenFalso));
  });

  await T('El acceso_token de una reserva jamás coincide con el de otra (aislamiento entre reservas)', async () => {
    const a = await crearReservaPrueba();
    const b = await crearReservaPrueba();
    yes(a.acceso_token !== b.acceso_token, 'dos reservas nunca deben compartir token');
    yes(!igualSeguroHttp(a.acceso_token, b.acceso_token));
    yes(!igualSeguroHttp(b.acceso_token, a.acceso_token));
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
