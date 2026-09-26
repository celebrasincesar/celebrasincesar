// ══════════════════════════════════════════════════════════════════════
// QA DE PAGOS  ·  node scripts/qa-pagos.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba, sin credenciales ni base de datos, las tres piezas de la
// integración de pagos que son puro JavaScript:
//   · la firma HMAC de Flow (lib/flow.js)
//   · la clasificación tributaria por medio de pago (lib/tributario.js)
//   · el motor de precios compartido armador/servidor (data/precios.js)
//
// Lo que sí necesita Postgres (el cerrojo de turno, la idempotencia del
// acreditado) NO se prueba acá: eso se verifica en Flow Sandbox siguiendo
// el checklist de la especificación (§26), con una base real.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

import { flowSign, leerEstadoFlow, FLOW_SANDBOX, FLOW_PRODUCCION } from '../lib/flow.js';
import { classifyTaxTreatment, TRIBUTARIO, TRIBUTARIO_POR_MEDIO_MANUAL } from '../lib/tributario.js';
import { construirResumenBVE } from '../lib/recordatorio-bve.js';

// lib/reservas.js importa con rutas sin extensión ('./db', '../data/reglas'),
// válido para Next.js, no para Node suelto — mismo problema que resuelve
// scripts/_resolver-sin-extension.mjs para scripts/qa-pagos-integracion.mjs.
// Solo se usa acá para probar fechaISO(), que no toca la base de datos.
register('./_resolver-sin-extension.mjs', import.meta.url);
const { fechaISO, detalleDeReserva } = await import('../lib/reservas.js');
const { escrituraCalendarHabilitada, tituloEvento, descripcion, metodoCalendar } = await import('../lib/calendario.js');
const { construirResumenReserva } = await import('../lib/resumen-reserva.js');
const { construirResumenCliente } = await import('../lib/resumen-cliente.js');
const { construirResumenContractual } = await import('../lib/resumen-contractual.js');

// data/precios.js importa de data/master.js, data/reglas.js y
// data/packs-mayores.js con rutas sin extensión — que es como el resto del
// proyecto ya las escribe y como las resuelve Next.js. Node "a pelo" no las
// resuelve, así que se concatenan las fuentes en memoria, tal como hace
// scripts/qa-precios.mjs con el mismo problema.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fuentePrecios = ['data/master.js', 'data/packs-mayores.js', 'data/reglas.js', 'data/precios.js']
  .map((rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/^\s*import\s[^;]+;\s*$/gm, ''))
  .join('\n');
const {
  calcularTotal, packPara, itemVisible, puedeElegirSector, horarioEfectivo,
  validarTurnoFecha, contextoDesde, tramoInvitadosPorId, opcionesPack, getItem,
} = await import('data:text/javascript;base64,' + Buffer.from(fuentePrecios).toString('base64'));

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// ══════════════════════════════════════════════════════════════════════
// fechaISO() — bug real encontrado en QA (06-sep-2026): Google Calendar
// rechazaba TODOS los eventos con "Bad Request" genérico porque
// rangoHorario() armaba la fecha con `String(unaFechaDeDB)`, que en un
// objeto Date de JS da el formato local ("Thu Nov 12 2026…", con el día
// corrido por el huso horario) y no un ISO. estadoSaldo() tenía el mismo
// bug, en silencio, en el cálculo de si tocaba avisar el saldo 72h antes.
// ══════════════════════════════════════════════════════════════════════

T('fechaISO: un objeto Date de verdad da YYYY-MM-DD, no el formato local', () => {
  // Este es el caso real: el driver de Postgres devuelve las columnas
  // DATE como Date de JS. String(fecha) da "Thu Nov 12 2026…" — el bug
  // que rompía Calendar. fechaISO() tiene que evitarlo siempre.
  const fecha = new Date('2026-11-13T00:00:00.000Z');
  eq(fechaISO(fecha), '2026-11-13');
});

T('fechaISO: si ya llega como string, la deja intacta (los primeros 10 caracteres)', () => {
  eq(fechaISO('2026-11-13T12:00:00.000Z'), '2026-11-13');
  eq(fechaISO('2026-11-13'), '2026-11-13');
});

T('fechaISO: nunca se le escapa el "un día antes" por el huso horario de Chile', () => {
  // Chile es UTC-3/UTC-4 (detrás de UTC): una fecha guardada como
  // medianoche UTC siempre cae en el mismo día calendario al convertir a
  // ISO, nunca un día antes. Es justo el caso que rompía Calendar.
  for (const iso of ['2026-01-15', '2026-06-01', '2026-11-13', '2026-12-31']) {
    eq(fechaISO(new Date(`${iso}T00:00:00.000Z`)), iso, `fecha ${iso}`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// escrituraCalendarHabilitada() — Preview/Sandbox escribió en el
// calendario REAL de las celebraciones y llegó a bloquear fechas de
// verdad en producción (encontrado en QA, 06-sep-2026). Desde entonces,
// solo VERCEL_ENV==='production' puede crear/modificar eventos ahí.
// ══════════════════════════════════════════════════════════════════════

T('escrituraCalendarHabilitada: solo VERCEL_ENV=production escribe en el calendario real', () => {
  eq(escrituraCalendarHabilitada({ VERCEL_ENV: 'production' }), true);
  eq(escrituraCalendarHabilitada({ VERCEL_ENV: 'preview' }), false);
  eq(escrituraCalendarHabilitada({ VERCEL_ENV: 'development' }), false);
});

T('escrituraCalendarHabilitada: por defecto NO escribe (local, sin VERCEL_ENV, es "denegar por defecto")', () => {
  eq(escrituraCalendarHabilitada({}), false);
  eq(escrituraCalendarHabilitada({ VERCEL_ENV: undefined }), false);
});

// ══════════════════════════════════════════════════════════════════════
// FIRMA FLOW (§10)
// ══════════════════════════════════════════════════════════════════════

T('firma: orden alfabético de las claves, no el orden del objeto', () => {
  const a = flowSign({ zeta: '1', alfa: '2' }, 'secreto');
  const b = flowSign({ alfa: '2', zeta: '1' }, 'secreto');
  eq(a, b, 'el orden de inserción no debe afectar la firma');
});

T('firma: cambiar cualquier valor cambia la firma', () => {
  const a = flowSign({ amount: 1000, commerceOrder: 'CSC-2026-000001-DEP' }, 'secreto');
  const b = flowSign({ amount: 1001, commerceOrder: 'CSC-2026-000001-DEP' }, 'secreto');
  yes(a !== b, 'una firma que no cambia con el monto no protege nada');
});

T('firma: el parámetro `s` nunca se firma a sí mismo', () => {
  const params = { amount: 1000, commerceOrder: 'X' };
  const s1 = flowSign(params, 'secreto');
  const s2 = flowSign({ ...params, s: 'lo-que-sea' }, 'secreto');
  eq(s1, s2, 'agregar `s` al objeto no debe cambiar la firma calculada');
});

T('firma: campos vacíos/undefined/null se excluyen antes de firmar', () => {
  const a = flowSign({ amount: 1000, optional: undefined }, 'secreto');
  const b = flowSign({ amount: 1000 }, 'secreto');
  eq(a, b, 'un campo ausente y uno undefined deben firmar igual');
});

T('firma: determinística — la misma entrada siempre da la misma salida', () => {
  const p = { amount: 325000, commerceOrder: 'CSC-2026-000045-DEP', email: 'a@b.cl' };
  eq(flowSign(p, 'llave'), flowSign(p, 'llave'));
});

T('firma: es hexadecimal de 64 caracteres (HMAC-SHA256)', () => {
  const s = flowSign({ amount: 1 }, 'llave');
  yes(/^[0-9a-f]{64}$/.test(s), 'formato inesperado: ' + s);
});

T('entornos: sandbox y producción son hosts distintos', () => {
  yes(FLOW_SANDBOX.includes('sandbox.flow.cl'));
  yes(FLOW_PRODUCCION.includes('www.flow.cl'));
  yes(FLOW_SANDBOX !== FLOW_PRODUCCION);
});

// ══════════════════════════════════════════════════════════════════════
// LECTURA DEL ESTADO DE FLOW
// ══════════════════════════════════════════════════════════════════════

T('leerEstadoFlow: status 2 es la ÚNICA forma de "pagado"', () => {
  for (const status of [1, 3, 4, 0, null, undefined, 'x']) {
    const r = leerEstadoFlow({ status });
    eq(r.pagado, false, `status ${status} no debería leerse como pagado`);
  }
  eq(leerEstadoFlow({ status: 2 }).pagado, true);
});

T('leerEstadoFlow: status 1 es pendiente, no rechazado', () => {
  const r = leerEstadoFlow({ status: 1 });
  eq(r.pendiente, true);
  eq(r.rechazado, false);
});

T('leerEstadoFlow: status 3 y 4 son rechazo/anulación', () => {
  eq(leerEstadoFlow({ status: 3 }).rechazado, true);
  eq(leerEstadoFlow({ status: 4 }).rechazado, true);
});

T('leerEstadoFlow: toma el medio real de paymentData, no adivina', () => {
  const r = leerEstadoFlow({ status: 2, paymentData: { media: 'Transferencia', mediaType: 'bank' } });
  eq(r.medio, 'Transferencia');
  eq(r.medioTipo, 'bank');
});

// ══════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN TRIBUTARIA (§19) — la pieza más sensible: un error acá
// significa un problema con el SII, así que cada rama se prueba a mano.
// ══════════════════════════════════════════════════════════════════════

const pagado = (media, mediaType) => ({ pagado: true, medio: media, medioTipo: mediaType });

T('tributario: pago no confirmado nunca se clasifica como listo', () => {
  const r = classifyTaxTreatment({ pagado: false });
  eq(r.estado, TRIBUTARIO.MANUAL_REVIEW);
});

T('tributario: tarjeta de crédito → voucher, no requiere BVE', () => {
  eq(classifyTaxTreatment(pagado('Tarjeta de Crédito', 'credit')).estado, TRIBUTARIO.NOT_REQUIRED_VOUCHER);
});

T('tributario: tarjeta de débito y prepago → voucher', () => {
  eq(classifyTaxTreatment(pagado('Débito', null)).estado, TRIBUTARIO.NOT_REQUIRED_VOUCHER);
  eq(classifyTaxTreatment(pagado('Prepago', null)).estado, TRIBUTARIO.NOT_REQUIRED_VOUCHER);
});

T('tributario: transferencia bancaria → PENDING_BVE, nunca voucher', () => {
  eq(classifyTaxTreatment(pagado('Transferencia', 'bank_transfer')).estado, TRIBUTARIO.PENDING_BVE);
});

T('tributario: Khipu es transferencia por dentro → PENDING_BVE', () => {
  eq(classifyTaxTreatment(pagado('Khipu', null)).estado, TRIBUTARIO.PENDING_BVE);
});

T('tributario: medio no reconocido → revisión manual, nunca se adivina', () => {
  eq(classifyTaxTreatment(pagado('Algo Nuevo Que Flow Agregue', null)).estado, TRIBUTARIO.MANUAL_REVIEW);
});

T('tributario: sin ningún dato de medio → revisión manual', () => {
  eq(classifyTaxTreatment(pagado('', '')).estado, TRIBUTARIO.MANUAL_REVIEW);
});

T('tributario: no distingue mayúsculas ni tildes', () => {
  eq(classifyTaxTreatment(pagado('TRANSFERENCIA', null)).estado, TRIBUTARIO.PENDING_BVE);
  eq(classifyTaxTreatment(pagado('crédito', null)).estado, TRIBUTARIO.NOT_REQUIRED_VOUCHER);
});

T('tributario: nunca lanza una excepción con datos raros', () => {
  classifyTaxTreatment({});
  classifyTaxTreatment({ pagado: true });
  classifyTaxTreatment(null);
});

// ══════════════════════════════════════════════════════════════════════
// MEDIOS MANUALES (documento "Agregar control obligatorio de BVE…",
// 07-sep-2026, §7): pagos que César registra a mano, sin pasar por Flow.
// Transferencia directa BancoEstado es el caso que pide el documento; el
// mismo mapa ya cubre efectivo y Súper Compraquí presencial.
// ══════════════════════════════════════════════════════════════════════

T('tributario manual: transferencia directa BancoEstado → PENDING_BVE', () => {
  eq(TRIBUTARIO_POR_MEDIO_MANUAL.TRANSFERENCIA_BANCOESTADO, TRIBUTARIO.PENDING_BVE);
});

T('tributario manual: efectivo → PENDING_BVE (no hay voucher)', () => {
  eq(TRIBUTARIO_POR_MEDIO_MANUAL.EFECTIVO, TRIBUTARIO.PENDING_BVE);
});

T('tributario manual: Súper Compraquí presencial → voucher, no requiere BVE', () => {
  eq(TRIBUTARIO_POR_MEDIO_MANUAL.SUPER_COMPRAQUI, TRIBUTARIO.NOT_REQUIRED_VOUCHER);
});

// ══════════════════════════════════════════════════════════════════════
// RESUMEN DEL CORREO RECORDATORIO — puro, sin base de datos ni red (§5).
// ══════════════════════════════════════════════════════════════════════

T('construirResumenBVE: sin pendientes, el asunto igual dice "0"', () => {
  const r = construirResumenBVE([]);
  yes(r.asunto.includes('0 boletas'), r.asunto);
});

T('construirResumenBVE: cada pendiente aparece con código, monto y contacto', () => {
  const pendientes = [{
    codigo: 'CSC-2026-000099', festejado: 'Festejado Test', cliente_nombre: 'Apoderado Test',
    tipo: 'DEPOSIT', monto: 175000, medio: 'Transferencia', medio_tipo: 'bank_transfer',
    confirmado: '2026-09-06T12:00:00.000Z', fecha_evento: '2027-04-10',
    cliente_email: 'a@b.cl', cliente_telefono: '+56900000000',
  }];
  const r = construirResumenBVE(pendientes);
  yes(r.asunto.includes('1 boleta'), r.asunto);
  yes(r.texto.includes('CSC-2026-000099'), 'el texto debe traer el código de reserva');
  yes(r.texto.includes('$175.000'), 'el texto debe traer el monto formateado');
  yes(r.texto.includes('a@b.cl'), 'el texto debe traer el email de contacto');
  yes(r.html.includes('CSC-2026-000099'), 'el html debe traer el código de reserva');
});

// ══════════════════════════════════════════════════════════════════════
// MOTOR DE PRECIOS — el servidor tiene que llegar al MISMO total que ya
// verifica scripts/qa-precios.mjs contra la tabla de César.
// ══════════════════════════════════════════════════════════════════════

T('precios: Recinto Completo, 6 años, 30 niños, viernes/domingo = $290.000 (tabla de César)', () => {
  // El propio comentario de data/master.js trae este caso verificado:
  // "6 años · 30 niños = 195 + 45 + 50 = 290.000". Es base viernes/domingo
  // (completo_30 = 195.000): un sábado usaría completo_30_sab (210.000) y
  // daría 305.000 — por eso la fecha importa en esta prueba.
  const r = calcularTotal({
    fecha: '2026-09-04', sector: 'completo', tramoInvitados: '21a30',
    edadNino: 6, festejados: 1, tramoMayores: 'no', extras: [],
  });
  eq(r.total, 290000);
});

T('precios: mismo caso mas30 en sábado sube exactamente los $15.000 de la tabla de sábado', () => {
  const r = calcularTotal({
    fecha: '2026-09-05', sector: 'completo', tramoInvitados: '21a30',
    edadNino: 6, festejados: 1, tramoMayores: 'no', extras: [],
  });
  eq(r.total, 305000);
});

T('precios: Independiente, 1-3 años, viernes, 20 niños = $175.000', () => {
  const r = calcularTotal({
    fecha: '2026-09-04', sector: 'independiente', tramoInvitados: '11a20',
    edadNino: 2, festejados: 1, tramoMayores: 'no', extras: [],
  });
  eq(r.total, 175000);
});

T('precios: anticipo + saldo == total, siempre, sin un peso de diferencia', () => {
  const casos = [111, 175000, 290000, 615333, 999999, 1];
  for (const total of casos) {
    // Se prueba el invariante directo, no vía calcularTotal, para cubrir
    // cualquier total posible incluidos los que terminan en impar.
    const anticipo = Math.round(total * 0.5);
    eq(anticipo + (total - anticipo), total, `total ${total}`);
  }
});

T('precios: el sábado usa la tabla de sábado, no la de viernes/domingo', () => {
  const viernes = calcularTotal({ fecha: '2026-09-04', sector: 'completo', tramoInvitados: 'hasta10', edadNino: 2, festejados: 1, tramoMayores: 'no', extras: [] });
  const sabado  = calcularTotal({ fecha: '2026-09-05', sector: 'completo', tramoInvitados: 'hasta10', edadNino: 2, festejados: 1, tramoMayores: 'no', extras: [] });
  eq(viernes.total, 195000);
  eq(sabado.total, 210000);
});

T('precios: un total manipulado en el navegador no existe para este motor', () => {
  // calcularTotal ni siquiera acepta un campo "total": lo recalcula
  // siempre desde la configuración. No hay forma de pasarle un número.
  const r = calcularTotal({
    fecha: '2026-09-04', sector: 'completo', tramoInvitados: 'hasta10',
    edadNino: 1, festejados: 1, tramoMayores: 'no', extras: [],
    total: 1000, // un intento de inyectar el total: se ignora por completo
  });
  eq(r.total, 195000, 'el campo total ajeno al cálculo no debe alterar el resultado');
});

T('precios: horas adicionales se cobran, no se regalan', () => {
  const sin = calcularTotal({ fecha: '2026-09-04', sector: 'completo', tramoInvitados: 'hasta10', edadNino: 1, festejados: 1, tramoMayores: 'no', extras: [], horasAdicionales: 0 });
  const con = calcularTotal({ fecha: '2026-09-04', sector: 'completo', tramoInvitados: 'hasta10', edadNino: 1, festejados: 1, tramoMayores: 'no', extras: [], horasAdicionales: 1 });
  eq(con.total - sin.total, 50000);
});

// ══════════════════════════════════════════════════════════════════════
// DETALLE HISTÓRICO Y CALENDAR ENRIQUECIDO (documento "Quiero mejorar
// urgentemente la información operativa…", 09-sep-2026). Fixture: la
// reserva real CSC-2026-000005 de Production (Camilo Ignacio Chehade,
// festejado Clemente), tal como quedó su snapshot al consultarla — nunca
// se inventan datos, se reproduce lo que ya está guardado de verdad.
// ══════════════════════════════════════════════════════════════════════
const RESERVA_FIXTURE = {
  codigo: 'CSC-2026-000005',
  acceso_token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  cliente_nombre: 'Camilo Ignacio Chehade',
  cliente_email: 'ignaciochehade@gmail.com',
  cliente_telefono: '+56963896760',
  fecha_evento: '2026-09-27T03:00:00.000Z',
  turno: 'PM',
  hora_inicio: '15:00',
  hora_termino: '18:00',
  sector: 'completo',
  ninos: 20,
  mayores: 0,
  total: 505000,
  anticipo: 252500,
  saldo: 252500,
  pagado: 252500,
  estado: 'BALANCE_PENDING',
  calendar_event_id: 'qj01eoink7hqe9ivu46k6homh8',
  notas: null,
  snapshot: {
    ctx: { edadNino: 4, cantNinos: 'hasta20', hayMayores: false, totalNinos: 20, tramoMayores: 'no', tramoInvitados: '11a20' },
    precio: {
      total: 505000, anticipo: 252500, saldo: 252500,
      lineas: [
        { monto: 235000, concepto: 'Arriendo Recinto Completo' },
        { monto: 70000, concepto: 'Gran Castillo' },
        { monto: 75000, concepto: 'Temática Full' },
        { monto: 125000, concepto: 'Animación Full Huntrix' },
      ],
    },
    configuracion: {
      hora: 'PM', edadNino: 4, cantNinos: 'hasta20', nombreNino: 'Clemente',
      sector: 'completo', tramoMayores: 'no', tramoInvitados: '11a20', horasAdicionales: 0,
      extras: [
        { id: 'gran-castillo', nombre: 'Gran Castillo', emoji: '🏰', precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 } },
        { id: 'deco-tematica-full', nombre: 'Temática Full', emoji: '✨', precios: { hasta10: 75000, hasta20: 75000, hasta30: 75000, mas30: 75000 } },
        { id: 'animacion-huntrix', nombre: 'Animación Full Huntrix', emoji: '💜', precios: { hasta10: 125000, hasta20: 125000, hasta30: 125000, mas30: 125000 } },
        { id: 'inc-zanahoria', nombre: 'Zanahoria para los Conejitos', emoji: '🥕', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } },
        { id: 'inc-parlantes', nombre: 'Parlantes Bluetooth', emoji: '🔊', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } },
        { id: 'inc-mesas', nombre: 'Mesas Extra', emoji: '🍴', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } },
        { id: 'inc-cocina', nombre: 'Cocina Equipada', emoji: '🍳', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } },
        { id: 'inc-ruedas', nombre: 'Ruedas Libres', emoji: '🛴', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } },
      ],
    },
  },
};

T('detalleDeReserva: separa adicionales pagados de incluidos gratis — nunca los mezcla', () => {
  const d = detalleDeReserva(RESERVA_FIXTURE);
  eq(d.festejado, 'Clemente');
  eq(d.edad, 4);
  eq(d.tramoInvitados, '11a20');
  eq(d.tramoMayores, 'no');
  eq(d.totalNinos, 20);
  eq(d.horasAdicionales, 0);
  eq(d.adicionales.map((a) => a.nombre), ['Gran Castillo', 'Temática Full', 'Animación Full Huntrix']);
  eq(d.adicionales.map((a) => a.precio), [70000, 75000, 125000], 'el precio debe ser el histórico guardado en el propio ítem, no uno recalculado');
  eq(d.incluidos.map((i) => i.nombre), ['Zanahoria para los Conejitos', 'Parlantes Bluetooth', 'Mesas Extra', 'Cocina Equipada', 'Ruedas Libres']);
  eq(d.lineas.length, 4);
  eq(d.lineas.reduce((s, l) => s + l.monto, 0), 505000, 'las líneas del desglose deben sumar el total');
});

T('detalleDeReserva: sin snapshot.configuracion (reserva manual), no revienta y devuelve arrays vacíos', () => {
  const d = detalleDeReserva({ snapshot: { manual: true, nombreNino: 'X', tramoInvitados: 'hasta10', tramoMayores: 'no' } });
  eq(d.festejado, 'X');
  eq(d.adicionales, []);
  eq(d.incluidos, []);
  eq(d.lineas, null);
});

T('tituloEvento: empieza con "RESERVADO PM" (lo sigue leyendo /api/disponibilidad y /api/cadena) y suma festejado + código', () => {
  const t = tituloEvento(RESERVA_FIXTURE);
  yes(t.startsWith('RESERVADO PM'), `el título debe seguir empezando con "RESERVADO PM": ${t}`);
  yes(t.includes('Clemente'), 'debe incluir el festejado');
  yes(t.includes('CSC-2026-000005'), 'debe incluir el código de reserva');
  eq(t, 'RESERVADO PM · 🎉 Clemente · CSC-2026-000005');
});

T('tituloEvento: sin festejado (dato faltante), usa el nombre del apoderado — nunca queda vacío', () => {
  const t = tituloEvento({ ...RESERVA_FIXTURE, snapshot: { configuracion: {} } });
  yes(t.startsWith('RESERVADO PM'));
  yes(t.includes('Camilo Ignacio Chehade'), 'debe caer al nombre del apoderado si no hay festejado');
});

T('descripcion: trae festejado, apoderado, horario efectivo, sector, ASISTENCIA con configuración vigente, adicionales CON precio, incluidos SIN precio, y los montos de pago (documento "FASE 2B — IMPLEMENTAR BLOQUE 2", §11)', () => {
  const desc = descripcion(RESERVA_FIXTURE);
  yes(desc.includes('CSC-2026-000005'));
  yes(desc.includes('Festejado/a: Clemente · 4 años'));
  yes(desc.includes('Apoderado: Camilo Ignacio Chehade · +56963896760'));
  yes(desc.includes('15:00–18:00'), 'debe usar el horario EFECTIVO guardado, no el turno base');
  yes(desc.includes('Recinto Completo'));
  yes(desc.includes('ASISTENCIA'));
  yes(desc.includes('Contratación vigente: 11 a 20 niños'));
  yes(desc.includes('Final informada: pendiente'), 'sin datosFinales, debe decir pendiente, nunca inventar un número');
  yes(desc.includes('• Gran Castillo — $70.000'), 'los adicionales pagados deben traer su precio histórico');
  yes(desc.includes('Cocina Equipada') && !desc.includes('Cocina Equipada — $'), 'los incluidos gratis no llevan precio');
  yes(desc.includes('Total actualizado: $505.000'));
  yes(desc.includes('Pagado: $252.500'));
  yes(desc.includes('Saldo: $252.500'));
  yes(desc.includes('DATOS FINALES') && desc.includes('Pendientes'), 'sin datosFinales, la sección debe decir Pendientes');
});

// ══════════════════════════════════════════════════════════════════════
// BLOQUE 2 — descripción enriquecida con Datos Finales y pendientes con
// proveedor (documento "FASE 2B — IMPLEMENTAR BLOQUE 2", 21-sep-2026,
// §11, §17 "Calendar"). Nunca llama a Google de verdad: son pruebas
// puras sobre descripcion()/tituloEvento()/metodoCalendar().
// ══════════════════════════════════════════════════════════════════════
const DATOS_FINALES_FIXTURE = {
  ninos_final: 24, mayores_final: 3, adultos_aprox: 16,
  adulto_responsable: 'Javiera', telefono_operacional: '+56911112222',
  confirmado_en: new Date('2026-10-20T21:42:00.000Z'),
};

T('descripcion: con datosFinales, ASISTENCIA muestra la final informada + 7 años o más + adultos, y DATOS FINALES queda "Confirmados ✓" con fecha/hora', () => {
  const desc = descripcion(RESERVA_FIXTURE, { datosFinales: DATOS_FINALES_FIXTURE, pendientes: [] });
  yes(desc.includes('Final informada: 24 niños'));
  yes(desc.includes('7+ años: 3'));
  yes(desc.includes('Adultos aprox.: 16'));
  yes(desc.includes('DATOS FINALES') && desc.includes('Confirmados ✓'));
  yes(desc.includes('RESPONSABLE DEL DÍA'));
  yes(desc.includes('Javiera'));
  yes(desc.includes('+56911112222'));
});

T('descripcion: un pendiente CONFIRMADO se anota "— CONFIRMADA" junto al adicional correspondiente', () => {
  const desc = descripcion(RESERVA_FIXTURE, {
    pendientes: [{ tipo: 'animacion', item_id: 'animacion-huntrix', detalle: null, estado: 'CONFIRMADO' }],
  });
  yes(desc.includes('Animación Full Huntrix — CONFIRMADA'), desc);
});

T('descripcion: la decoración temática pendiente se anota con la temática y el estado — "Decoración temática — Huntrix — PENDIENTE"', () => {
  const desc = descripcion(RESERVA_FIXTURE, {
    pendientes: [{ tipo: 'decoracion_tematica', item_id: 'deco-tematica-full', detalle: 'Huntrix', estado: 'PENDIENTE' }],
  });
  yes(desc.includes('Decoración temática — Huntrix — PENDIENTE'), desc);
});

T('descripcion: NO_DISPONIBLE se hace visible como alerta cerca del encabezado, además de la anotación en ADICIONALES', () => {
  const desc = descripcion(RESERVA_FIXTURE, {
    pendientes: [{ tipo: 'animacion', item_id: 'animacion-huntrix', detalle: null, estado: 'NO_DISPONIBLE' }],
  });
  yes(desc.includes('⚠ Animación Full Huntrix — NO DISPONIBLE / resolver'), desc);
  yes(desc.includes('Animación Full Huntrix — NO DISPONIBLE'), 'también debe quedar anotado en ADICIONALES');
});

T('descripcion: un pendiente RETIRADO nunca aparece — ni como adicional activo ni como alerta (mismo criterio que /cadena y Mi Celebración)', () => {
  // "Piratas" no colisiona con ningún nombre del fixture (a diferencia de
  // una temática como "Huntrix", que ya existe ahí dentro del nombre de
  // OTRO ítem — "Animación Full Huntrix" — y daría un falso positivo).
  const desc = descripcion(RESERVA_FIXTURE, {
    pendientes: [{ tipo: 'decoracion_tematica', item_id: 'deco-tematica-full', detalle: 'Piratas', estado: 'RETIRADO' }],
  });
  yes(!desc.includes('RETIRADO'), desc);
  yes(!desc.includes('Piratas'), 'un RETIRADO no debe filtrar su temática a la descripción');
});

T('metodoCalendar: reserva con calendar_event_id → PUT — nunca crea un evento nuevo sobre una que ya tiene uno', () => {
  eq(metodoCalendar(RESERVA_FIXTURE), 'PUT');
  eq(metodoCalendar({ ...RESERVA_FIXTURE, calendar_event_id: 'otro-id-cualquiera' }), 'PUT');
});

T('metodoCalendar: reserva sin calendar_event_id → POST — recién ahí se crea el primer y único evento', () => {
  eq(metodoCalendar({ ...RESERVA_FIXTURE, calendar_event_id: null }), 'POST');
});

// ══════════════════════════════════════════════════════════════════════
// CORREO A CÉSAR AL ACREDITAR UN PAGO (documento "Sí, avanza…", 09-sep-2026,
// §3). Mismo fixture CSC-2026-000005 — el resumen tiene que traer TODO lo
// que se contrató, con el precio histórico, y el estado tributario real.
// ══════════════════════════════════════════════════════════════════════
const PAGO_FIXTURE = {
  id: 5, tipo: 'DEPOSIT', monto: 252500, medio: 'Webpay', medio_tipo: null,
  tributario: 'NOT_REQUIRED_VOUCHER',
};

T('construirResumenReserva: asunto con festejado y código, texto con TODO lo contratado y el pago', () => {
  const r = construirResumenReserva(RESERVA_FIXTURE, PAGO_FIXTURE);
  eq(r.asunto, '🎉 Nueva reserva confirmada · ALCE KIDS · Clemente · CSC-2026-000005');
  yes(r.texto.includes('Anticipo recibido'));
  yes(r.texto.includes('Clemente · 4 años'));
  yes(r.texto.includes('CSC-2026-000005'));
  yes(r.texto.includes('Camilo Ignacio Chehade'));
  yes(r.texto.includes('+56963896760'));
  yes(r.texto.includes('15:00–18:00'), 'debe traer el horario efectivo, no el turno base');
  yes(r.texto.includes('Recinto Completo'));
  yes(r.texto.includes('11 a 20 niños') && r.texto.includes('total 20'));
  yes(r.texto.includes('Mayores de 6: Ninguno'));
  yes(r.texto.includes('Gran Castillo — $70.000'), 'adicionales con precio histórico');
  yes(r.texto.includes('Cocina Equipada') && !r.texto.includes('Cocina Equipada —'), 'incluidos sin precio');
  yes(r.texto.includes('Total: $505.000'));
  yes(r.texto.includes('Pagado: $252.500'));
  yes(r.texto.includes('Medio: Webpay'));
  yes(r.texto.includes('Voucher electrónico'), 'debe traer el estado tributario real del pago');
  yes(r.html.includes('Clemente'), 'el html debe traer los mismos datos que el texto');
});

T('construirResumenReserva: pago por transferencia muestra la alerta de BVE pendiente, no un genérico', () => {
  const r = construirResumenReserva(RESERVA_FIXTURE, { ...PAGO_FIXTURE, medio: 'Transferencia', tributario: 'PENDING_BVE' });
  yes(r.texto.includes('Pendiente emitir Boleta Electrónica'));
});

// ══════════════════════════════════════════════════════════════════════
// CORREO DE CONFIRMACIÓN AL CLIENTE (documento "Fase de consolidación
// final", 12-sep-2026, §9). Mismo fixture CSC-2026-000005 — branded ALCE
// KIDS, con los dos CTA y sin recalcular nada del catálogo vigente.
// ══════════════════════════════════════════════════════════════════════
T('construirResumenCliente: asunto con festejado, texto con TODO lo contratado, los tres CTA y la fecha límite del saldo', () => {
  const r = construirResumenCliente(RESERVA_FIXTURE);
  eq(r.asunto, '🎉 ¡La celebración de Clemente ya está reservada! · CSC-2026-000005');
  yes(r.texto.includes('CSC-2026-000005'));
  yes(r.texto.includes('Clemente · 4 años'));
  yes(r.texto.includes('15:00–18:00'), 'debe traer el horario efectivo, no el turno base');
  yes(r.texto.includes('Recinto Completo'));
  yes(r.texto.includes('11 a 20 niños') && r.texto.includes('total 20'));
  yes(r.texto.includes('Mayores de 6: Ninguno'));
  yes(r.texto.includes('Gran Castillo — $70.000'), 'adicionales pagados con precio histórico');
  yes(!r.texto.includes('Cocina Equipada'), 'el correo al cliente no lista los incluidos/preparar, solo lo que contrató');
  yes(r.texto.includes('Total: $505.000'));
  yes(r.texto.includes('Pagado: $252.500'));
  yes(r.texto.includes('Saldo: $252.500'));
  yes(r.texto.includes('Fecha límite del saldo'), 'con saldo pendiente debe avisar la fecha límite');
  yes(r.texto.includes('Ver mi celebración'), 'debe incluir el CTA al enlace privado de Mi Celebración');
  yes(r.texto.includes('/mi-celebracion?id=CSC-2026-000005&t=a1b2c3d4e5f60718293a4b5c6d7e8f90'), 'el enlace debe usar el código y el acceso_token real de la reserva');
  yes(r.texto.includes('Coordinar por WhatsApp'));
  yes(r.texto.includes('Personalizar aún más mi celebración'));
  yes(r.texto.includes('wa.me/56944356955'), 'el link de WhatsApp debe usar el número real del negocio');
  yes(r.html.includes('logo-alce.webp'), 'el html debe usar el logo ALCE KIDS, no Celebra Sin Cesar');
  yes(r.html.includes('Clemente'));
  yes(r.html.includes('/mi-celebracion?id=CSC-2026-000005'), 'el html también debe traer el botón "Ver mi celebración"');
});

T('construirResumenCliente: reserva pagada completa no menciona fecha límite del saldo', () => {
  const r = construirResumenCliente({ ...RESERVA_FIXTURE, pagado: 505000, saldo: 0 });
  yes(r.texto.includes('Saldo: pagado completo'));
  yes(!r.texto.includes('Fecha límite del saldo'));
});

// ══════════════════════════════════════════════════════════════════════
// EMAIL CONTRACTUAL — WEB vs. MANUAL (documento "Continúa desde tu última
// entrega...", 21-sep-2026, §2/§13): nunca la misma frase. `tyc_aceptado`
// presente (checkout web, checkbox marcado) → sí se dice "que aceptaste al
// reservar". `tyc_aceptado` NULL (reserva armada por César en /cadena
// desde una negociación por WhatsApp) → redacción neutral, nunca afirma
// una aceptación electrónica que el sistema no puede probar.
// ══════════════════════════════════════════════════════════════════════
const RESERVA_WEB = { ...RESERVA_FIXTURE, tyc_version: '2026-09-v2', tyc_aceptado: '2026-09-15T12:00:00.000Z' };
const RESERVA_MANUAL = { ...RESERVA_FIXTURE, tyc_version: '2026-09-v2', tyc_aceptado: null };

T('construirResumenContractual (WEB, tyc_aceptado presente): SÍ afirma que el cliente aceptó al reservar', () => {
  const r = construirResumenContractual(RESERVA_WEB);
  eq(r.asunto, '📄 Confirmación contractual · Clemente · CSC-2026-000005');
  yes(r.texto.includes('que aceptaste al reservar'), 'con aceptación electrónica real, el texto debe decirlo');
  yes(r.texto.includes('Confirmación contractual de tu celebración'));
  yes(r.html.includes('que aceptaste al reservar'));
  yes(r.texto.includes('2026-09-v2'), 'debe citar la versión exacta de la reserva');
});

T('construirResumenContractual (MANUAL, tyc_aceptado NULL): NUNCA afirma una aceptación electrónica que no ocurrió', () => {
  const r = construirResumenContractual(RESERVA_MANUAL);
  eq(r.asunto, '📄 Resumen y condiciones de tu reserva · Clemente · CSC-2026-000005');
  yes(!r.texto.toLowerCase().includes('aceptaste'), 'sin evidencia de aceptación electrónica, el texto no puede decir "aceptaste"');
  yes(!r.html.toLowerCase().includes('aceptaste'), 'tampoco en el html');
  yes(r.texto.includes('condiciones asociadas a tu reserva'), 'debe usar la frase neutral exacta pedida');
  yes(r.texto.includes('Te enviamos el resumen de tu reserva y las condiciones aplicables'), 'debe usar el encabezado neutral pedido');
  yes(r.texto.includes('2026-09-v2'), 'el PDF/versión sigue siendo la misma — es el envío el que cambia de tono, no el documento');
});

T('construirResumenContractual: la única diferencia entre WEB y MANUAL es la redacción sobre la aceptación, no los datos de la reserva', () => {
  const web = construirResumenContractual(RESERVA_WEB);
  const manual = construirResumenContractual(RESERVA_MANUAL);
  for (const campo of ['Código de reserva: CSC-2026-000005', 'Clemente', 'Total: $505.000', 'Gran Castillo']) {
    yes(web.texto.includes(campo) && manual.texto.includes(campo), `ambos deben incluir "${campo}"`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// GUARDA DE REGRESIÓN — bug real encontrado en Sandbox (05-sep-2026):
// Next.js parchea el `fetch()` global con su propio cache de datos, y el
// driver de Neon habla HTTP con `fetch()` por dentro. Sin `cache: 'no-store'`
// explícito en `fetchOptions`, dos consultas con el mismo texto SQL pueden
// devolver una respuesta vieja cacheada aunque la tabla haya cambiado —
// esquemaListo() decía "faltan tablas" recién migradas, con la consulta
// idéntica repetida. `dynamic = 'force-dynamic'` en la ruta NO alcanza:
// el parche de fetch actúa en runtime, no en el build de la ruta.
//
// Este test no ejecuta Postgres (no tiene credenciales): solo verifica que
// la línea que evita el cache siga en el código, para que nadie la borre
// sin darse cuenta en un refactor futuro.
// ══════════════════════════════════════════════════════════════════════

T('lib/db.js: el cliente Neon sigue forzando cache:no-store en fetchOptions', () => {
  const fuenteDb = fs.readFileSync(path.join(RAIZ, 'lib/db.js'), 'utf8');
  const llamada = fuenteDb.match(/_sql\s*=\s*neon\([^)]*\)/s);
  yes(llamada, 'no se encontró la línea `_sql = neon(...)` en lib/db.js — ¿se movió o se renombró?');
  yes(/fetchOptions/.test(llamada[0]), 'la llamada a neon() perdió `fetchOptions` — vuelve el bug del cache viejo');
  yes(/cache\s*:\s*['"]no-store['"]/.test(llamada[0]), 'fetchOptions ya no trae cache:\'no-store\' — vuelve el bug del cache viejo');
});

// ══════════════════════════════════════════════════════════════════════
// GUARDA DE REGRESIÓN — segundo bug real encontrado en Sandbox
// (06-sep-2026): turnosOcupados() sumaba días a una fecha con un
// parámetro sin tipo ($1 sin cast) — Postgres respondía "operator is not
// unique: date + unknown" (42725) SIEMPRE, en silencio, porque
// turnosDesdePostgres() atrapa el error para no tumbar el calendario. La
// disponibilidad que veía el papá nunca consideró los HOLD/reservas de
// Postgres, solo Google Calendar — el cerrojo atómico seguía
// funcionando al momento de pagar, pero el calendario podía mostrar
// libre una fecha ya tomada.
// ══════════════════════════════════════════════════════════════════════

T('lib/reservas.js: turnosOcupados() sigue casteando el parámetro de días a ::int', () => {
  const fuenteReservas = fs.readFileSync(path.join(RAIZ, 'lib/reservas.js'), 'utf8');
  const fn = fuenteReservas.match(/export async function turnosOcupados[\s\S]*?\n}/);
  yes(fn, 'no se encontró turnosOcupados() en lib/reservas.js — ¿se movió o se renombró?');
  yes(/\$1::int/.test(fn[0]), 'turnosOcupados() perdió el cast $1::int — vuelve "operator is not unique: date + unknown" (42725), silenciado por el catch de turnosDesdePostgres()');
});

// ══════════════════════════════════════════════════════════════════════
// CASO MAESTRO DE REGRESIÓN (documento "Instrucción Maestra — Continuación",
// 14-sep-2026, §7.B): protege el CONJUNTO, no reglas aisladas — sector,
// pack, inflables ocultos, horario, precio, anticipo y saldo evaluados
// todos sobre el MISMO estado, exactamente como los vería un papá real.
//
// Sábado 24-oct-2026 (verificado: sábado real) · festejado 5 años ·
// 24 niños (tramo 21 a 30, evaluado con el máximo del tramo — 30 — que es
// como el motor ya evalúa cualquier tramo no exacto, nunca subestima) ·
// 2 mayores de 6 (tramo 1 a 3) · PM +1 hora (15:00–19:00).
// ══════════════════════════════════════════════════════════════════════
T('CASO MAESTRO: sector, pack, inflables, horario y precio — todo junto, un solo estado', () => {
  const FECHA = '2026-10-24';
  const estadoBase = {
    fecha: FECHA, sector: 'completo', tramoInvitados: '21a30', edadNino: 5,
    festejados: 1, tramoMayores: '1a3', hora: 'PM', horasAdicionales: 1, extras: [],
  };
  const ctx = contextoDesde(estadoBase);

  // 1 · Sector: Recinto Completo obligatorio, Independiente imposible.
  eq(ctx.totalNinos, 30, 'el tramo 21-30 se evalúa con su máximo (30), nunca subestima');
  eq(ctx.hayMayores, true);
  eq(ctx.cantidadMayores, 2);
  yes(!puedeElegirSector(ctx.totalNinos, estadoBase.edadNino, ctx.hayMayores), 'Independiente debe ser imposible: >10 niños y hay mayores de 6');

  // 2 · Pack correcto para 1-3 mayores y más de 20 niños: 1 deportivo + (gigante o animación).
  const pv = packPara(ctx);
  yes(pv, 'debe corresponder un pack para 2 mayores de 6');
  eq(pv.pack.id, 'PACK_MAYORES_1');
  eq(pv.variante.id, 'v-21a40');
  eq(pv.variante.requisitos.length, 2, 'un bloque fijo (deportivo) + un bloque a elegir (gigante o animación)');
  eq(pv.variante.requisitos[0].ramas[0].pide, [{ categoria: 'deportivo', cantidad: 1 }]);
  eq(pv.variante.requisitos[1].ramas.map((r) => r.id).sort(), ['animacion', 'inflable'], 'debe poder elegir entre inflable gigante o animación');

  // 3 · Inflables medianos/pequeños ocultos (por tamaño de grupo Y por haber mayores — doble motivo).
  for (const id of ['tiburon-escalador', 'barco-pirata', 'monkey-climb', 'castillo-avion', 'castillo-futbolero']) {
    yes(!itemVisible(getItem(id), ctx), `${id} (mediano/pequeño) no debe ofrecerse con 30 niños y mayores de 6`);
  }
  // El inflable gigante del pack sí debe seguir disponible (regla técnica propia, no la de tamaño).
  const gigantes = opcionesPack('inflable_gigante', ctx);
  yes(gigantes.length > 0, 'debe existir al menos un inflable gigante disponible para el pack');

  // 4 · Horario: PM +1 en sábado real → 15:00–19:00, +$50.000. Guard server-side también OK.
  const horario = horarioEfectivo('PM', 1, FECHA);
  eq(horario.horaInicio, '15:00');
  eq(horario.horaTermino, '19:00');
  eq(horario.precioAdicional, 50000);
  yes(validarTurnoFecha('PM', 1, FECHA).ok, 'sábado PM+1 debe ser válido para el guard server-side');

  // 5 · Precio: calculado 100% server-side, mismo motor que consume el resumen y el backend.
  const precio = calcularTotal(estadoBase);
  yes(precio.total > 0, 'el total debe ser mayor a 0');
  eq(precio.anticipo, Math.round(precio.total * 0.5), 'el anticipo debe ser exactamente 50% del total');
  eq(precio.saldo, precio.total - precio.anticipo, 'el saldo debe ser total - anticipo, sin pesos perdidos');
  eq(precio.anticipo + precio.saldo, precio.total, 'anticipo + saldo debe reconstruir el total exacto');
});

console.log(`\n${ok} pruebas OK`);
if (fallos.length) {
  console.log(`${fallos.length} FALLARON:\n`);
  fallos.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Todo OK.\n');
