// ══════════════════════════════════════════════════════════════════════
// QA DE BLOQUE 2 — PURO  ·  node scripts/qa-bloque2.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba, sin Postgres, las piezas puras del documento "FASE 2B —
// IMPLEMENTAR BLOQUE 2" (21-sep-2026):
//   · urgenciaPendiente() — §3, la urgencia derivada (nunca un campo manual)
//   · pendienteBloqueaListo() / todoListoParaCelebrar() — §15
//
// Lo que necesita Postgres (pendientesActivos(), actualizarPendienteProveedor(),
// el enriquecimiento de /api/cadena/reservas) se prueba en
// scripts/qa-bloque2-integracion.mjs, mismo criterio que Bloque 1.
// ══════════════════════════════════════════════════════════════════════

import { register } from 'node:module';

register('./_resolver-sin-extension.mjs', import.meta.url);
const { urgenciaPendiente, NIVEL_URGENCIA } = await import('../lib/pendientes-proveedor.js');
const { todoListoParaCelebrar, pendienteBloqueaListo, resumenOperacional } = await import('../lib/resumen-operacional.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Ancla siempre a mediodía, como el resto del proyecto (fechaISO + 'T12:00:00').
const HOY = new Date('2026-10-01T12:00:00.000Z');
const fechaEnDias = (dias) => new Date(HOY.getTime() + dias * 86_400_000).toISOString().slice(0, 10);

// ══════════════════════════════════════════════════════════════════════
// URGENCIA — decoración temática (§3: T-21, T-7)
// ══════════════════════════════════════════════════════════════════════
T('urgenciaPendiente: decoración PENDIENTE a más de 21 días → 🟡 amarillo', () => {
  const u = urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'PENDIENTE', fechaEvento: fechaEnDias(22) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.AMARILLO);
});
T('urgenciaPendiente: decoración PENDIENTE a exactamente 21 días → 🟠 naranja', () => {
  const u = urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'PENDIENTE', fechaEvento: fechaEnDias(21) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.NARANJA);
});
T('urgenciaPendiente: decoración PENDIENTE a 8 días → 🟠 naranja (todavía no roja)', () => {
  const u = urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'PENDIENTE', fechaEvento: fechaEnDias(8) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.NARANJA);
});
T('urgenciaPendiente: decoración PENDIENTE a exactamente 7 días → 🔴 roja', () => {
  const u = urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'PENDIENTE', fechaEvento: fechaEnDias(7) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.ROJO);
});
T('urgenciaPendiente: decoración PENDIENTE a 1 día → 🔴 roja', () => {
  const u = urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'PENDIENTE', fechaEvento: fechaEnDias(1) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.ROJO);
});

// ══════════════════════════════════════════════════════════════════════
// URGENCIA — animación (§3: T-14, T-7) — misma escalera, ventana distinta
// ══════════════════════════════════════════════════════════════════════
T('urgenciaPendiente: animación PENDIENTE a más de 14 días → 🟡 amarillo', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'PENDIENTE', fechaEvento: fechaEnDias(15) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.AMARILLO);
});
T('urgenciaPendiente: animación PENDIENTE a exactamente 14 días → 🟠 naranja', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'PENDIENTE', fechaEvento: fechaEnDias(14) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.NARANJA);
});
T('urgenciaPendiente: animación PENDIENTE a exactamente 7 días → 🔴 roja', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'PENDIENTE', fechaEvento: fechaEnDias(7) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.ROJO);
});

// ══════════════════════════════════════════════════════════════════════
// URGENCIA — REVISAR_DESPUES (§3: futura/hoy/vencida) y NO_DISPONIBLE
// ══════════════════════════════════════════════════════════════════════
T('urgenciaPendiente: REVISAR_DESPUES con proxima_revision futura → 🟡 amarillo', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'REVISAR_DESPUES', proximaRevision: fechaEnDias(5) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.AMARILLO);
});
T('urgenciaPendiente: REVISAR_DESPUES con proxima_revision HOY → 🟠 naranja', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'REVISAR_DESPUES', proximaRevision: fechaEnDias(0) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.NARANJA);
});
T('urgenciaPendiente: REVISAR_DESPUES con proxima_revision vencida (ayer) → 🔴 roja / atrasado', () => {
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'REVISAR_DESPUES', proximaRevision: fechaEnDias(-1) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.ROJO);
});
T('urgenciaPendiente: NO_DISPONIBLE siempre es 🔴 roja, sin importar la fecha del evento', () => {
  eq(urgenciaPendiente({ tipo: 'decoracion_tematica', estado: 'NO_DISPONIBLE', fechaEvento: fechaEnDias(60) }, HOY).nivel, NIVEL_URGENCIA.ROJO);
  eq(urgenciaPendiente({ tipo: 'animacion', estado: 'NO_DISPONIBLE', fechaEvento: fechaEnDias(1) }, HOY).nivel, NIVEL_URGENCIA.ROJO);
});
T('urgenciaPendiente: PENDIENTE nunca mira proxima_revision, solo la fecha del evento', () => {
  // Aunque proximaRevision esté vencida, PENDIENTE solo mira fechaEvento (§3: "nunca proxima_revision" en este estado).
  const u = urgenciaPendiente({ tipo: 'animacion', estado: 'PENDIENTE', fechaEvento: fechaEnDias(30), proximaRevision: fechaEnDias(-10) }, HOY);
  eq(u.nivel, NIVEL_URGENCIA.AMARILLO);
});

// ══════════════════════════════════════════════════════════════════════
// TODO LISTO PARA CELEBRAR 🎉  (§15)
// ══════════════════════════════════════════════════════════════════════
const RESERVA_FIRME = { estado: 'BALANCE_PENDING', total: 300000, pagado: 100000 };
const DATOS_FINALES_OK = { ninos_final: 10, mayores_final: 0, adultos_aprox: 6 };

T('todoListoParaCelebrar: sin Datos Finales → false', () => {
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: null, pendientes: [] }), false);
});
T('todoListoParaCelebrar: reserva no firme (PENDING_PAYMENT) → false, aunque el resto esté OK', () => {
  eq(todoListoParaCelebrar({ reserva: { ...RESERVA_FIRME, estado: 'PENDING_PAYMENT' }, datosFinales: DATOS_FINALES_OK, pendientes: [] }), false);
});
T('todoListoParaCelebrar: un proveedor PENDIENTE → false', () => {
  const pendientes = [{ tipo: 'decoracion_tematica', estado: 'PENDIENTE' }];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), false);
});
T('todoListoParaCelebrar: un proveedor NO_DISPONIBLE → false', () => {
  const pendientes = [{ tipo: 'animacion', estado: 'NO_DISPONIBLE' }];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), false);
});
T('todoListoParaCelebrar: REVISAR_DESPUES vencido → false', () => {
  const pendientes = [{ tipo: 'animacion', estado: 'REVISAR_DESPUES', proxima_revision: '2020-01-01' }];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), false);
});
T('todoListoParaCelebrar: REVISAR_DESPUES con fecha futura NO bloquea (§15: solo "vencido" bloquea)', () => {
  const pendientes = [{ tipo: 'animacion', estado: 'REVISAR_DESPUES', proxima_revision: '2099-01-01' }];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), true);
});
T('todoListoParaCelebrar: todos CONFIRMADOS + Datos Finales confirmados → true', () => {
  const pendientes = [
    { tipo: 'decoracion_tematica', estado: 'CONFIRMADO' },
    { tipo: 'animacion', estado: 'CONFIRMADO' },
  ];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), true);
});
T('todoListoParaCelebrar: un RETIRADO nunca bloquea, aunque nunca se haya confirmado', () => {
  const pendientes = [{ tipo: 'decoracion_tematica', estado: 'RETIRADO' }];
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes }), true);
});
T('todoListoParaCelebrar: saldo pendiente por sí solo NUNCA vuelve false (no se exige pago inmediato en este bloque)', () => {
  const conSaldoAlto = { ...RESERVA_FIRME, total: 900000, pagado: 100000 };
  eq(todoListoParaCelebrar({ reserva: conSaldoAlto, datosFinales: DATOS_FINALES_OK, pendientes: [] }), true);
});
T('todoListoParaCelebrar: sin ningún pendiente con proveedor (celebración sin decoración/animación) → true', () => {
  eq(todoListoParaCelebrar({ reserva: RESERVA_FIRME, datosFinales: DATOS_FINALES_OK, pendientes: [] }), true);
});

T('pendienteBloqueaListo: tolera tanto proxima_revision (snake_case, DB) como proximaRevision (camelCase, API)', () => {
  eq(pendienteBloqueaListo({ estado: 'REVISAR_DESPUES', proxima_revision: '2020-01-01' }), true);
  eq(pendienteBloqueaListo({ estado: 'REVISAR_DESPUES', proximaRevision: '2020-01-01' }), true);
  eq(pendienteBloqueaListo({ estado: 'REVISAR_DESPUES', proximaRevision: '2099-01-01' }), false);
});

// ══════════════════════════════════════════════════════════════════════
// resumenOperacional() — chips (regresión E2E, 21-sep-2026): un
// NO_DISPONIBLE se mostraba en 🟡 igual que un simple "pendiente" — debe
// quedar 🔴 crítico, la misma severidad que urgenciaPendiente() ya le da
// en la sección "Pendientes con proveedor".
// ══════════════════════════════════════════════════════════════════════
T('resumenOperacional: un proveedor NO_DISPONIBLE produce un chip nivel "critico" (🔴), nunca "alerta" (🟡)', () => {
  const resumen = resumenOperacional({
    reserva: RESERVA_FIRME,
    datosFinales: DATOS_FINALES_OK,
    pendientes: [{ tipo: 'animacion', estado: 'NO_DISPONIBLE' }],
  });
  const chip = resumen.chips.find((c) => c.texto.includes('Animación'));
  yes(chip, 'debe existir un chip de Animación');
  eq(chip.nivel, 'critico');
});

T('resumenOperacional: un proveedor PENDIENTE produce un chip nivel "alerta" (🟡), no "critico"', () => {
  const resumen = resumenOperacional({
    reserva: RESERVA_FIRME,
    datosFinales: DATOS_FINALES_OK,
    pendientes: [{ tipo: 'decoracion_tematica', estado: 'PENDIENTE' }],
  });
  const chip = resumen.chips.find((c) => c.texto.includes('Decoración'));
  eq(chip.nivel, 'alerta');
});

T('resumenOperacional: todos CONFIRMADOS produce un chip nivel "ok" (🟢)', () => {
  const resumen = resumenOperacional({
    reserva: RESERVA_FIRME,
    datosFinales: DATOS_FINALES_OK,
    pendientes: [{ tipo: 'animacion', estado: 'CONFIRMADO' }],
  });
  const chip = resumen.chips.find((c) => c.texto.includes('Animación'));
  eq(chip.nivel, 'ok');
});

console.log(`\n  QA Bloque 2 (puro) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
