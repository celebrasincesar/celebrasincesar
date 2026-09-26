// ══════════════════════════════════════════════════════════════════════
// QA DE BLOQUE 3 — PURO  ·  node scripts/qa-bloque3.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba, sin Postgres, las piezas puras del documento "FASE 2B —
// IMPLEMENTAR BLOQUE 3" (22-sep-2026):
//   · tareasAplicables() — §13, reglas de última hora
//   · diasHastaEvento() / diasEntreCreacionYEvento() — §2, candado de fechas
//   · horaPreparacion() — §10, hora de ingreso real
//   · mensajeT7()/mensajeT4()/mensajeT1() — textos exactos, saldo condicional
//   · motivosPendientesT2() — §8
//
// Lo que necesita Postgres (ejecutarCicloPrevio(), marcarTareaGestionada(),
// accionesProximas()) se prueba en scripts/qa-bloque3-integracion.mjs.
// ══════════════════════════════════════════════════════════════════════

import { register } from 'node:module';

register('./_resolver-sin-extension.mjs', import.meta.url);
const {
  tareasAplicables, diasHastaEvento, diasEntreCreacionYEvento, horaPreparacion,
  linkMiCelebracion, mensajeT7, mensajeT4, mensajeT1, motivosPendientesT2,
} = await import('../lib/ciclo-previo.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

const HOY = new Date('2027-01-01T12:00:00.000Z');
const fechaEnDias = (dias) => new Date(HOY.getTime() + dias * 86_400_000).toISOString().slice(0, 10);

const reservaConGap = (diasGap, diasRestantesHoy) => ({
  fecha_evento: fechaEnDias(diasRestantesHoy),
  creada: new Date(`${fechaEnDias(diasRestantesHoy - diasGap)}T09:00:00.000Z`),
});

// ══════════════════════════════════════════════════════════════════════
// FECHAS — candado del documento (§2): siempre con un Date real, nunca
// String(fecha). El propio fixture usa objetos Date de verdad, como
// devuelve el driver de Postgres, para no poder ocultar el bug.
// ══════════════════════════════════════════════════════════════════════
T('diasHastaEvento: con un Date real de Postgres, cuenta los días exactos sin desplazamiento de huso horario', () => {
  const r = { fecha_evento: new Date('2027-01-15T00:00:00.000Z') };
  eq(diasHastaEvento(r, new Date('2027-01-10T00:00:00.000Z')), 5);
  eq(diasHastaEvento(r, new Date('2027-01-15T00:00:00.000Z')), 0);
  eq(diasHastaEvento(r, new Date('2027-01-20T00:00:00.000Z')), -5);
});

T('diasEntreCreacionYEvento: mide la ventana real de la reserva, no la fecha actual', () => {
  const r = { fecha_evento: new Date('2027-02-01T00:00:00.000Z'), creada: new Date('2027-01-01T00:00:00.000Z') };
  eq(diasEntreCreacionYEvento(r), 31);
});

// ══════════════════════════════════════════════════════════════════════
// tareasAplicables() — §13, reglas de última hora
// ══════════════════════════════════════════════════════════════════════
T('tareasAplicables: ciclo normal (creada >6 días antes) — T7 a los 7 días, T4 a los 4, T1 al día antes', () => {
  const r = reservaConGap(30, 7);
  eq(tareasAplicables(r, HOY), { t7: true, t4: false, t1: false });
});
T('tareasAplicables: ciclo normal — T4 aparece cuando faltan 4 días', () => {
  const r = reservaConGap(30, 4);
  eq(tareasAplicables(r, HOY), { t7: true, t4: true, t1: false });
});
T('tareasAplicables: ciclo normal — T1 aparece cuando falta 1 día', () => {
  const r = reservaConGap(30, 1);
  eq(tareasAplicables(r, HOY), { t7: true, t4: true, t1: true });
});
T('tareasAplicables: gap 5-6 días — NUNCA T7, T4 sigue el criterio normal de "faltan ≤4"', () => {
  const r5faltan5 = reservaConGap(5, 5);
  eq(tareasAplicables(r5faltan5, HOY).t7, false);
  eq(tareasAplicables(r5faltan5, HOY).t4, false, 'todavía faltan 5, T4 recién a partir de 4');
  const r5faltan4 = reservaConGap(5, 4);
  eq(tareasAplicables(r5faltan4, HOY), { t7: false, t4: true, t1: false });
});
T('tareasAplicables: gap 2-4 días — dispara T4 de inmediato, nunca T7', () => {
  const r = reservaConGap(3, 3);
  eq(tareasAplicables(r, HOY), { t7: false, t4: true, t1: false });
});
T('tareasAplicables: gap 1 día — solo T1, nunca T7 ni T4', () => {
  const r = reservaConGap(1, 1);
  eq(tareasAplicables(r, HOY), { t7: false, t4: false, t1: true });
});
T('tareasAplicables: gap 0 (mismo día) — ninguna tarea histórica, solo alerta en vivo (fuera de esta función)', () => {
  const r = reservaConGap(0, 0);
  eq(tareasAplicables(r, HOY), { t7: false, t4: false, t1: false });
});

// ══════════════════════════════════════════════════════════════════════
// horaPreparacion() — 30 min antes de la hora de inicio REAL persistida
// ══════════════════════════════════════════════════════════════════════
T('horaPreparacion: resta 30 minutos a la hora de inicio real', () => {
  eq(horaPreparacion({ hora_inicio: '15:00' }), '14:30');
  eq(horaPreparacion({ hora_inicio: '11:00' }), '10:30');
});
T('horaPreparacion: cruza la medianoche hacia atrás sin romperse', () => {
  eq(horaPreparacion({ hora_inicio: '00:15' }), '23:45');
});
T('horaPreparacion: sin hora_inicio, devuelve null en vez de inventar una hora', () => {
  eq(horaPreparacion({ hora_inicio: null }), null);
});

// ══════════════════════════════════════════════════════════════════════
// Mensajes — texto exacto, link, saldo condicional (§6)
// ══════════════════════════════════════════════════════════════════════
const RESERVA_BASE = {
  codigo: 'CSC-2026-000999', acceso_token: 'a'.repeat(32),
  hora_inicio: '15:00', hora_termino: '18:00', total: 300000, pagado: 150000,
};

T('linkMiCelebracion: código+token, mismo patrón que lib/resumen-cliente.js', () => {
  const link = linkMiCelebracion(RESERVA_BASE);
  yes(link.startsWith('https://celebrasincesar.cl/mi-celebracion?id=CSC-2026-000999&t='));
  yes(link.includes(RESERVA_BASE.acceso_token));
});

T('mensajeT7: con saldo pendiente, menciona "si quieres, adelantar tu saldo pendiente" con lenguaje sugerente', () => {
  const msg = mensajeT7(RESERVA_BASE, 'Antonia');
  yes(msg.includes('Falta una semana para el cumpleaños de Antonia'));
  yes(msg.includes('si quieres, adelantar tu saldo pendiente'));
  yes(!msg.toLowerCase().includes('debes'), 'nunca debe sonar a cobranza');
  yes(!msg.toLowerCase().includes('urgente'));
  yes(msg.includes(linkMiCelebracion(RESERVA_BASE)));
});
T('mensajeT7: sin saldo (pagado = total), NUNCA menciona el saldo', () => {
  const msg = mensajeT7({ ...RESERVA_BASE, pagado: RESERVA_BASE.total }, 'Antonia');
  yes(!msg.toLowerCase().includes('saldo'));
});

T('mensajeT4: texto exacto, sin mención de saldo ni de proveedor', () => {
  const msg = mensajeT4(RESERVA_BASE, 'Lucas');
  yes(msg.includes('Ya falta poquito para el cumpleaños de Lucas'));
  yes(msg.includes('Confirma la cantidad final de invitados'));
  yes(!msg.toLowerCase().includes('saldo'));
});

T('mensajeT1: variante "listo" trae horario real, hora de preparación derivada y dirección', () => {
  const msg = mensajeT1(RESERVA_BASE, 'Sofía', true);
  yes(msg.includes('Tu celebración está lista.'));
  yes(msg.includes('15:00–18:00'));
  yes(msg.includes('14:30'), 'la hora de preparación debe ser hora_inicio - 30min, nunca una hora fija');
  yes(msg.includes('Talavera de la Reina 380, Las Condes'));
});
T('mensajeT1: variante "pendiente" NUNCA dice "Tu celebración está lista" y no expone detalles internos del proveedor', () => {
  const msg = mensajeT1(RESERVA_BASE, 'Sofía', false);
  yes(!msg.includes('Tu celebración está lista.'));
  yes(msg.includes('necesitamos cerrar un detalle'));
  yes(!msg.toLowerCase().includes('proveedor'), 'nunca alarmar con detalles internos del proveedor (§11)');
  yes(!msg.toLowerCase().includes('animación') && !msg.toLowerCase().includes('decoración'));
});

// ══════════════════════════════════════════════════════════════════════
// motivosPendientesT2() — §8: nunca el saldo económico por sí solo
// ══════════════════════════════════════════════════════════════════════
T('motivosPendientesT2: sin nada pendiente, lista vacía', () => {
  eq(motivosPendientesT2({ reserva: {}, datosFinales: { x: 1 }, pendientes: [] }), []);
});
T('motivosPendientesT2: sin Datos Finales, aparece el motivo', () => {
  const motivos = motivosPendientesT2({ reserva: {}, datosFinales: null, pendientes: [] });
  yes(motivos.includes('Datos Finales sin confirmar'));
});
T('motivosPendientesT2: un proveedor PENDIENTE aparece, uno CONFIRMADO no', () => {
  const motivos = motivosPendientesT2({
    reserva: {}, datosFinales: { x: 1 },
    pendientes: [{ tipo: 'animacion', estado: 'PENDIENTE' }, { tipo: 'decoracion_tematica', estado: 'CONFIRMADO' }],
  });
  eq(motivos.length, 1);
  yes(motivos[0].includes('Animación'));
});
T('motivosPendientesT2: NO_DISPONIBLE se distingue de un simple pendiente', () => {
  const motivos = motivosPendientesT2({
    reserva: {}, datosFinales: { x: 1 }, pendientes: [{ tipo: 'animacion', estado: 'NO_DISPONIBLE' }],
  });
  yes(motivos[0].toLowerCase().includes('no disponible'));
});
T('motivosPendientesT2: un RETIRADO nunca aparece como motivo', () => {
  const motivos = motivosPendientesT2({
    reserva: {}, datosFinales: { x: 1 }, pendientes: [{ tipo: 'decoracion_tematica', estado: 'RETIRADO' }],
  });
  eq(motivos, []);
});

console.log(`\n  QA Bloque 3 (puro) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
