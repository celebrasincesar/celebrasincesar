// ══════════════════════════════════════════════════════════════════════
// QA DE INTEGRACIÓN — VISITAS  ·  node scripts/qa-visitas-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Mismo patrón que scripts/qa-bloque2-integracion.mjs: corre contra
// Postgres real (Sandbox/Preview), crea sus propias filas de prueba y las
// borra al terminar. Se salta solo si no hay base configurada.
//
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026, §20): cubre lo que no se puede probar sin base real —
// crearVisita(), y muy especialmente el candado de COINCIDENCIA: dos
// visitas al mismo viernes a la misma hora deben crearse AMBAS, sin que
// ninguna pise a la otra (§4, §8, §9, §16 — sin exclusividad de cupos).
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
  console.log('\nQA de integración Visitas — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q } = await import('../lib/db.js');
const { fechaISO } = await import('../lib/reservas.js');
const {
  crearVisita, visitaPorCodigo, visitaPorId, disponibilidadVisitas,
  cancelarVisita, reagendarVisita, marcarVisitaRealizada, visitasProximas,
} = await import('../lib/visitas.js');
const { visitaDesdeParams, leerIdYToken } = await import('../lib/visita-auth.js');
const { sincronizarCalendarioVisita, eliminarEventoCalendarioVisita } = await import('../lib/calendario-visita.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Un viernes real bien lejos de cualquier fecha real de negocio — no
// importa que quede fuera del horizonte comercial normal porque las
// pruebas pasan `hoy` explícito a validarSlotVisita/crearVisita a través
// de disponibilidadVisitas() cuando corresponde; crearVisita() valida con
// `hoy = new Date()` real, así que el viernes de prueba SÍ tiene que caer
// dentro del horizonte real de 8 semanas desde ahora.
function proximoViernesEnSemanas(semanas) {
  const d = new Date();
  d.setDate(d.getDate() + semanas * 7);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const codigosCreados = [];
async function limpiar() {
  for (const codigo of codigosCreados) {
    await q(`DELETE FROM visita WHERE codigo = $1`, [codigo]).catch(() => {});
  }
}

let contadorDatos = 0;
function datosPrueba() {
  contadorDatos++;
  return {
    nombreAdulto: `QATEST Visita ${contadorDatos}`,
    whatsapp: `+5690000${String(contadorDatos).padStart(4, '0')}`,
    email: `qatest-visita-${contadorDatos}@celebrasincesar.cl`,
    nombreFestejado: null,
    edadFestejado: null,
  };
}

try {

  // ══════════════════════════════════════════════════════════════════
  // crearVisita() — camino feliz e independencia de reserva/turno_hold
  // (§7, §8: nunca crea reserva, turno_hold ni pago_evento)
  // ══════════════════════════════════════════════════════════════════
  await T('crearVisita: crea la fila con estado AGENDADA, código y token propios', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    yes(r.ok, JSON.stringify(r));
    codigosCreados.push(r.visita.codigo);
    eq(r.visita.estado, 'AGENDADA');
    yes(/^VIS-\d{4}-\d{6}$/.test(r.visita.codigo), 'código debe seguir el formato VIS-YYYY-NNNNNN');
    yes(/^[a-f0-9]{32}$/.test(r.visita.acceso_token), 'token debe ser hex de 32 caracteres');
    eq(r.visita.reserva_id, null, 'una visita nueva nunca tiene reserva_id');
    eq(r.visita.calendar_event_id, null, 'el evento de Calendar se sincroniza aparte, no en el INSERT');
  });

  await T('crearVisita: nunca crea una fila en turno_hold (independencia total de celebraciones)', async () => {
    const fecha = proximoViernesEnSemanas(1);
    // Se compara antes/después: esa fecha puede tener un hold firme real de la
    // Sandbox (depende del día en que corre el QA); lo que importa es que crear
    // la visita no agregue ninguno.
    const antes = await q(`SELECT count(*)::int AS n FROM turno_hold WHERE fecha_evento = $1::date`, [fecha]);
    const r = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    yes(r.ok, JSON.stringify(r));
    codigosCreados.push(r.visita.codigo);
    const despues = await q(`SELECT count(*)::int AS n FROM turno_hold WHERE fecha_evento = $1::date`, [fecha]);
    eq(despues[0].n, antes[0].n, 'una visita no debe crear ningún turno_hold para esa fecha');
  });

  await T('crearVisita: rechaza datos inválidos (WhatsApp y email) sin escribir nada', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({
      fecha, hora: '10:00', nombreAdulto: 'Alguien', whatsapp: 'no-es-telefono', email: 'no-es-email',
    });
    eq(r.ok, false);
    eq(r.motivo, 'datos_invalidos');
    yes(r.errores.length >= 2, 'debe reportar ambos errores');
  });

  await T('crearVisita: rechaza un día que no es viernes', async () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1); // el próximo sábado
    const sabado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = await crearVisita({ fecha: sabado, hora: '10:00', ...datosPrueba() });
    eq(r.ok, false);
    eq(r.motivo, 'datos_invalidos');
  });

  // ══════════════════════════════════════════════════════════════════
  // COINCIDENCIA — el candado fundamental del documento (§20): dos (y
  // tres) visitas al MISMO viernes a la MISMA hora deben crearse todas,
  // con ids/códigos/tokens distintos, ninguna pisa a la otra.
  // ══════════════════════════════════════════════════════════════════
  await T('crearVisita: tres visitas simultáneas al mismo viernes+hora se crean TODAS, sin pisarse', async () => {
    const fecha = proximoViernesEnSemanas(2);
    const hora = '11:00';
    const [a, b, c] = await Promise.all([
      crearVisita({ fecha, hora, ...datosPrueba() }),
      crearVisita({ fecha, hora, ...datosPrueba() }),
      crearVisita({ fecha, hora, ...datosPrueba() }),
    ]);
    for (const r of [a, b, c]) yes(r.ok, JSON.stringify(r));
    codigosCreados.push(a.visita.codigo, b.visita.codigo, c.visita.codigo);

    const ids = new Set([a.visita.id, b.visita.id, c.visita.id]);
    const codigos = new Set([a.visita.codigo, b.visita.codigo, c.visita.codigo]);
    const tokens = new Set([a.visita.acceso_token, b.visita.acceso_token, c.visita.acceso_token]);
    eq(ids.size, 3, 'los tres ids deben ser distintos');
    eq(codigos.size, 3, 'los tres códigos deben ser distintos');
    eq(tokens.size, 3, 'los tres tokens deben ser distintos');
    for (const r of [a, b, c]) eq(r.visita.estado, 'AGENDADA');

    const filas = await q(
      `SELECT count(*)::int AS n FROM visita WHERE fecha_visita = $1::date AND hora_inicio = $2`,
      [fecha, hora]
    );
    eq(filas[0].n, 3, 'deben existir exactamente las tres filas, mismo día y hora');
  });

  // ══════════════════════════════════════════════════════════════════
  // ACCESO — mismo candado que Mi Celebración (§12): código+token,
  // aislamiento entre visitas.
  // ══════════════════════════════════════════════════════════════════
  await T('visitaDesdeParams: token correcto da acceso, token incorrecto no', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const { id, t } = leerIdYToken({ id: r.visita.codigo, t: r.visita.acceso_token });
    const conAcceso = await visitaDesdeParams(id, t);
    yes(conAcceso, 'el token correcto debe dar acceso');
    eq(conAcceso.codigo, r.visita.codigo);

    const tokenFalso = '0'.repeat(32);
    const sinAcceso = await visitaDesdeParams(id, tokenFalso);
    eq(sinAcceso, null, 'un token incorrecto nunca debe dar acceso');
  });

  await T('visitaDesdeParams: el token de una visita no sirve para acceder a otra', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const rA = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    const rB = await crearVisita({ fecha, hora: '11:00', ...datosPrueba() });
    codigosCreados.push(rA.visita.codigo, rB.visita.codigo);

    const cruzado = await visitaDesdeParams(rA.visita.codigo, rB.visita.acceso_token);
    eq(cruzado, null, 'el token de B nunca debe abrir la visita A');
  });

  // ══════════════════════════════════════════════════════════════════
  // CALENDAR — independencia y no-lanzar (§15, §16). VERCEL_ENV no es
  // 'production' en este entorno, así que siempre cae en
  // "preview_sin_escritura" o "sin_configurar" — nunca lanza, nunca
  // escribe en Google de verdad.
  // ══════════════════════════════════════════════════════════════════
  await T('sincronizarCalendarioVisita: nunca lanza y nunca escribe fuera de Production', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const resultado = await sincronizarCalendarioVisita(r.visita);
    yes(typeof resultado.ok === 'boolean');
    yes(['preview_sin_escritura', 'sin_configurar'].includes(resultado.motivo), JSON.stringify(resultado));
  });

  await T('sincronizarCalendarioVisita: dos visitas del mismo horario se sincronizan de forma independiente, cada una con su propio resultado', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const hora = '11:30';
    const a = await crearVisita({ fecha, hora, ...datosPrueba() });
    const b = await crearVisita({ fecha, hora, ...datosPrueba() });
    codigosCreados.push(a.visita.codigo, b.visita.codigo);

    const ra = await sincronizarCalendarioVisita(a.visita);
    const rb = await sincronizarCalendarioVisita(b.visita);
    yes(typeof ra.ok === 'boolean' && typeof rb.ok === 'boolean');
  });

  // ══════════════════════════════════════════════════════════════════
  // DISPONIBILIDAD — nunca refleja ocupación de otras visitas (§9, §16,
  // §24): un horario con varias visitas ya agendadas sigue ofreciéndose.
  // ══════════════════════════════════════════════════════════════════
  await T('disponibilidadVisitas: un horario con visitas ya agendadas sigue apareciendo disponible', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const hora = '10:00';
    const r = await crearVisita({ fecha, hora, ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const slots = await disponibilidadVisitas();
    const dia = slots.find((s) => s.fecha === fecha);
    yes(dia, 'la fecha con la visita ya agendada debe seguir en la lista');
    yes(dia.horarios.includes(hora), 'el horario con visitas ya agendadas debe seguir ofreciéndose');
  });

  await T('visitaPorCodigo: encuentra exactamente la visita creada', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);
    const encontrada = await visitaPorCodigo(r.visita.codigo);
    yes(encontrada);
    eq(encontrada.id, r.visita.id);
  });

  // ══════════════════════════════════════════════════════════════════
  // BLOQUE B — CANCELAR (documento "FASE 3A — VISITAS AUTOGESTIONADAS —
  // IMPLEMENTAR BLOQUE B", 22-sep-2026, §4, §18, §22)
  // ══════════════════════════════════════════════════════════════════
  await T('cancelarVisita: token válido cancela, conserva la fila, no toca otras visitas coincidentes', async () => {
    const fecha = proximoViernesEnSemanas(3);
    const hora = '10:00';
    const rA = await crearVisita({ fecha, hora, ...datosPrueba() });
    const rB = await crearVisita({ fecha, hora, ...datosPrueba() });
    codigosCreados.push(rA.visita.codigo, rB.visita.codigo);

    const resultado = await cancelarVisita(rA.visita);
    yes(resultado.ok, JSON.stringify(resultado));
    eq(resultado.visita.estado, 'CANCELADA');
    eq(resultado.yaCancelada, false);

    const enDB = await visitaPorId(rA.visita.id);
    yes(enDB, 'la fila debe seguir existiendo en la base (histórico)');
    eq(enDB.estado, 'CANCELADA');

    const otraSigueIgual = await visitaPorId(rB.visita.id);
    eq(otraSigueIgual.estado, 'AGENDADA', 'cancelar A nunca debe afectar a B, aunque coincidan en horario');
  });

  await T('cancelarVisita: token incorrecto no puede cancelar (visitaDesdeParams no encuentra acceso)', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);
    const tokenFalso = '1'.repeat(32);
    const sinAcceso = await visitaDesdeParams(r.visita.codigo, tokenFalso);
    eq(sinAcceso, null, 'sin acceso, nunca debe llegar a cancelarVisita()');
    const sigueIgual = await visitaPorId(r.visita.id);
    eq(sigueIgual.estado, 'AGENDADA', 'un intento sin acceso no debe cambiar nada');
  });

  await T('cancelarVisita: doble cancelación es estable — segunda vez responde yaCancelada, no error', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const primera = await cancelarVisita(r.visita);
    yes(primera.ok);
    eq(primera.yaCancelada, false);

    const segunda = await cancelarVisita(primera.visita);
    yes(segunda.ok, 'la segunda cancelación no debe fallar');
    eq(segunda.yaCancelada, true);
    eq(segunda.visita.estado, 'CANCELADA');
  });

  await T('visitasProximas: una visita CANCELADA desaparece de la lista de próximas', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '11:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    let proximas = await visitasProximas();
    yes(proximas.some((v) => v.id === r.visita.id), 'debe aparecer mientras está AGENDADA');

    await cancelarVisita(r.visita);
    proximas = await visitasProximas();
    yes(!proximas.some((v) => v.id === r.visita.id), 'no debe aparecer después de CANCELADA');
  });

  await T('eliminarEventoCalendarioVisita: nunca lanza al cancelar, fuera de Production', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '11:30', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);
    const cancelada = await cancelarVisita(r.visita);
    const resultado = await eliminarEventoCalendarioVisita(cancelada.visita);
    yes(typeof resultado.ok === 'boolean');
  });

  // ══════════════════════════════════════════════════════════════════
  // BLOQUE B — REAGENDAR (§6, §7, §18, §22)
  // ══════════════════════════════════════════════════════════════════
  await T('reagendarVisita: actualiza la MISMA fila — mismo id, código y token, cambia fecha/hora', async () => {
    const fechaOriginal = proximoViernesEnSemanas(1);
    const fechaNueva = proximoViernesEnSemanas(4);
    const r = await crearVisita({ fecha: fechaOriginal, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const resultado = await reagendarVisita(r.visita, { fecha: fechaNueva, hora: '11:30' });
    yes(resultado.ok, JSON.stringify(resultado));
    eq(resultado.sinCambios, false);
    eq(resultado.visita.id, r.visita.id, 'mismo id');
    eq(resultado.visita.codigo, r.visita.codigo, 'mismo código');
    eq(resultado.visita.acceso_token, r.visita.acceso_token, 'mismo token');
    eq(resultado.visita.estado, 'AGENDADA', 'sigue AGENDADA');
    eq(fechaISO(resultado.visita.fecha_visita), fechaNueva);
    eq(resultado.visita.hora_inicio, '11:30');

    const totalConEseCodigo = await q(`SELECT count(*)::int AS n FROM visita WHERE codigo = $1`, [r.visita.codigo]);
    eq(totalConEseCodigo[0].n, 1, 'reagendar nunca debe crear una segunda fila');
  });

  await T('reagendarVisita: puede reagendar hacia un horario donde ya existen otras visitas, sin conflicto', async () => {
    const fechaDestino = proximoViernesEnSemanas(5);
    const horaDestino = '10:00';
    const existente1 = await crearVisita({ fecha: fechaDestino, hora: horaDestino, ...datosPrueba() });
    const existente2 = await crearVisita({ fecha: fechaDestino, hora: horaDestino, ...datosPrueba() });
    const aMover = await crearVisita({ fecha: proximoViernesEnSemanas(1), hora: '10:30', ...datosPrueba() });
    codigosCreados.push(existente1.visita.codigo, existente2.visita.codigo, aMover.visita.codigo);

    const resultado = await reagendarVisita(aMover.visita, { fecha: fechaDestino, hora: horaDestino });
    yes(resultado.ok, JSON.stringify(resultado));
    eq(resultado.visita.estado, 'AGENDADA');

    const filas = await q(
      `SELECT count(*)::int AS n FROM visita WHERE fecha_visita = $1::date AND hora_inicio = $2 AND estado = 'AGENDADA'`,
      [fechaDestino, horaDestino]
    );
    eq(filas[0].n, 3, 'las tres visitas (dos originales + la reagendada) deben coexistir en ese horario');
  });

  await T('reagendarVisita: reagendar al mismo día/hora que ya tenía es idempotente — sin cambios, sin duplicar', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const resultado = await reagendarVisita(r.visita, { fecha, hora: '10:00' });
    yes(resultado.ok);
    eq(resultado.sinCambios, true);
    eq(resultado.visita.id, r.visita.id);
  });

  await T('reagendarVisita: respeta las mismas reglas de Bloque A — rechaza un día que no es viernes', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const d = new Date();
    d.setDate(d.getDate() + 14);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1); // el próximo domingo
    const domingo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const resultado = await reagendarVisita(r.visita, { fecha: domingo, hora: '10:00' });
    eq(resultado.ok, false);
    eq(resultado.motivo, 'dia_no_disponible');

    const sigueIgual = await visitaPorId(r.visita.id);
    eq(fechaISO(sigueIgual.fecha_visita), fecha, 'un reagendamiento rechazado no debe tocar la fecha original');
  });

  await T('reagendarVisita: una visita CANCELADA no se puede reagendar', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);
    const cancelada = await cancelarVisita(r.visita);

    const resultado = await reagendarVisita(cancelada.visita, { fecha: proximoViernesEnSemanas(2), hora: '10:00' });
    eq(resultado.ok, false);
    eq(resultado.motivo, 'no_se_puede_reagendar');
  });

  // ══════════════════════════════════════════════════════════════════
  // COINCIDENCIA EXTENDIDA (§24.B): A y B en viernes 10:00, reagendar C
  // también hacia ese mismo viernes 10:00 → las tres coexisten.
  // ══════════════════════════════════════════════════════════════════
  await T('Coincidencia extendida: A + B ya en viernes 10:00, reagendar C hacia el mismo horario — las tres existen', async () => {
    const fechaDestino = proximoViernesEnSemanas(6);
    const familiaA = await crearVisita({ fecha: fechaDestino, hora: '10:00', ...datosPrueba() });
    const familiaB = await crearVisita({ fecha: fechaDestino, hora: '10:00', ...datosPrueba() });
    const familiaC = await crearVisita({ fecha: proximoViernesEnSemanas(1), hora: '11:00', ...datosPrueba() });
    codigosCreados.push(familiaA.visita.codigo, familiaB.visita.codigo, familiaC.visita.codigo);

    const reagendaC = await reagendarVisita(familiaC.visita, { fecha: fechaDestino, hora: '10:00' });
    yes(reagendaC.ok, JSON.stringify(reagendaC));

    const filas = await q(
      `SELECT codigo FROM visita WHERE fecha_visita = $1::date AND hora_inicio = '10:00' AND estado = 'AGENDADA'
         AND codigo IN ($2, $3, $4)`,
      [fechaDestino, familiaA.visita.codigo, familiaB.visita.codigo, familiaC.visita.codigo]
    );
    eq(filas.length, 3, 'las tres familias deben coexistir AGENDADA en el mismo viernes 10:00');
  });

  // ══════════════════════════════════════════════════════════════════
  // MARCAR REALIZADA (§11, §18, §22)
  // ══════════════════════════════════════════════════════════════════
  await T('marcarVisitaRealizada: cambia estado, completa realizada_en, desaparece de próximas', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const resultado = await marcarVisitaRealizada(r.visita.id);
    yes(resultado.ok, JSON.stringify(resultado));
    eq(resultado.visita.estado, 'REALIZADA');
    yes(resultado.visita.realizada_en, 'realizada_en debe completarse');

    const proximas = await visitasProximas();
    yes(!proximas.some((v) => v.id === r.visita.id), 'una REALIZADA debe desaparecer de próximas visitas');
  });

  await T('marcarVisitaRealizada: doble click es estable — segunda vez responde yaEstaba, no duplica ni falla', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const r = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    codigosCreados.push(r.visita.codigo);

    const primera = await marcarVisitaRealizada(r.visita.id);
    yes(primera.ok);
    eq(primera.yaEstaba, false);

    const segunda = await marcarVisitaRealizada(r.visita.id);
    yes(segunda.ok, 'la segunda vez no debe fallar');
    eq(segunda.yaEstaba, true);
    eq(segunda.visita.estado, 'REALIZADA');
  });

  // ══════════════════════════════════════════════════════════════════
  // /CADENA — PRÓXIMAS VISITAS (§9, §12, §13): excluye CANCELADA y
  // REALIZADA, incluye AGENDADA futura, coincidentes como filas normales.
  // ══════════════════════════════════════════════════════════════════
  await T('visitasProximas: incluye AGENDADA futura, excluye CANCELADA y REALIZADA', async () => {
    const fecha = proximoViernesEnSemanas(1);
    const agendada = await crearVisita({ fecha, hora: '10:00', ...datosPrueba() });
    const paraCancelar = await crearVisita({ fecha, hora: '10:30', ...datosPrueba() });
    const paraRealizar = await crearVisita({ fecha, hora: '11:00', ...datosPrueba() });
    codigosCreados.push(agendada.visita.codigo, paraCancelar.visita.codigo, paraRealizar.visita.codigo);

    await cancelarVisita(paraCancelar.visita);
    await marcarVisitaRealizada(paraRealizar.visita.id);

    const proximas = await visitasProximas();
    const ids = proximas.map((v) => v.id);
    yes(ids.includes(agendada.visita.id), 'AGENDADA futura debe aparecer');
    yes(!ids.includes(paraCancelar.visita.id), 'CANCELADA no debe aparecer');
    yes(!ids.includes(paraRealizar.visita.id), 'REALIZADA no debe aparecer');
  });

} finally {
  await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
}

console.log(`\n  QA de integración Visitas — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
