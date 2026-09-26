// ══════════════════════════════════════════════════════════════════════
// QA DE MI CELEBRACIÓN  ·  node scripts/qa-mi-celebracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba, sin credenciales ni base de datos, la pieza pura de Mi
// Celebración (documento "FASE 2 — EXPERIENCIA CLIENTE END-TO-END",
// 21-sep-2026, "Criterio de cierre"):
//   · resumenMiCelebracion() — el resumen que ve el papá
//   · proximoPasoMiCelebracion() — el texto dinámico del próximo paso
//   · los candados de acceso (CODIGO_RESERVA, TOKEN_ACCESO, igualSeguro)
//
// Lo que sí necesita Postgres/Flow (el endpoint real, el pago BALANCE de
// verdad) se prueba contra Sandbox/Preview, no acá — mismo criterio que
// scripts/qa-pagos.mjs.
// ══════════════════════════════════════════════════════════════════════

import { register } from 'node:module';

register('./_resolver-sin-extension.mjs', import.meta.url);
const { resumenMiCelebracion, proximoPasoMiCelebracion } = await import('../lib/mi-celebracion.js');
const { estadoSaldo } = await import('../lib/reservas.js');

// CODIGO_RESERVA/TOKEN_ACCESO/igualSeguro viven en lib/validacion.js —
// puras, sin ninguna dependencia de 'next/server' — se importan directo
// de ahí, sin el truco de leer+evaluar lib/http.js a mano que este
// archivo usaba antes de que esas primitivas se separaran (documento
// "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A", 22-sep-2026).
const { CODIGO_RESERVA, TOKEN_ACCESO, igualSeguro } = await import('../lib/validacion.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// ── Fixture base: reserva firme, Recinto Completo, 11 a 20 niños, 2
// mayores de 6 (configuración VÁLIDA — Independiente exige hasta 10 niños
// y 0 mayores; con mayores o con 11+ niños siempre es Recinto Completo).
const AHORA = Date.now();
const horasDesdeAhora = (h) => new Date(AHORA + h * 3_600_000).toISOString().slice(0, 10);

const RESERVA_LEJOS = {
  id: 501, codigo: 'CSC-2026-000501', acceso_token: 'aaaa1111bbbb2222cccc3333dddd4444',
  cliente_nombre: 'Familia Rojas', cliente_email: 'rojas@example.com',
  fecha_evento: horasDesdeAhora(24 * 30), // 30 días
  hora_inicio: '15:00', hora_termino: '19:00',
  sector: 'completo', ninos: 15, mayores: 2,
  total: 400000, anticipo: 200000, saldo: 200000, pagado: 200000,
  estado: 'BALANCE_PENDING',
  snapshot: {
    ctx: { edadNino: 6, totalNinos: 17 },
    configuracion: { nombreNino: 'Antonia', edadNino: 6, tramoInvitados: '11a20', tramoMayores: '1a3', extras: [
      { id: 'inflable-tiburon', nombre: 'Inflable Tiburón', emoji: '🦈', gratis: false, precios: { hasta20: 55000 } },
      { id: 'cocina', nombre: 'Cocina Equipada', emoji: '🍳', gratis: true },
    ], cantNinos: 'hasta20' },
  },
};

T('resumenMiCelebracion: configuración válida — Recinto Completo con mayores de 6, nunca Independiente', () => {
  const r = resumenMiCelebracion(RESERVA_LEJOS);
  eq(r.sectorLabel, 'Recinto Completo');
  // Candado de regresión: Independiente + mayores de 6 sería una
  // configuración imposible (documento §1) — si algún día esta reserva
  // quedara marcada 'independiente' con mayores>0, es un bug de otro lado,
  // no de esta función — pero el resumen jamás debe mostrar esa mezcla.
  yes(!(r.sectorLabel === 'Sector Independiente' && RESERVA_LEJOS.mayores > 0), 'combinación imposible');
});

T('resumenMiCelebracion: festejado, fecha, horario, dirección y pagos exactos', () => {
  const r = resumenMiCelebracion(RESERVA_LEJOS);
  eq(r.codigo, 'CSC-2026-000501');
  eq(r.festejado, 'Antonia');
  eq(r.edad, 6);
  eq(r.horaInicio, '15:00');
  eq(r.horaTermino, '19:00');
  yes(r.direccion.includes('Talavera de la Reina'), 'la dirección debe salir de NEGOCIO, no de la reserva');
  eq(r.total, 400000);
  eq(r.pagado, 200000);
  eq(r.saldoPendiente, 200000);
});

T('resumenMiCelebracion: fecha en formato ISO real cuando fecha_evento llega como Date de Postgres, nunca String(fecha) local', () => {
  // Candado de regresión (bug real encontrado probando en vivo contra
  // Sandbox, 21-sep-2026): el driver de Postgres devuelve las columnas
  // DATE como objetos Date de JS. String(fecha).slice(0,10) daba
  // "Fri Sep 25" en vez de "2026-09-25" — mismo bug histórico que ya
  // rompió Calendar (ver scripts/qa-pagos.mjs). Un fixture con
  // fecha_evento como STRING no lo detecta: hay que probarlo con un
  // Date real.
  const r = resumenMiCelebracion({ ...RESERVA_LEJOS, fecha_evento: new Date('2026-09-25T00:00:00.000Z') });
  eq(r.fecha, '2026-09-25');
});

T('resumenMiCelebracion: adicionales e incluidos separados, el incluido gratis no se mezcla con lo contratado', () => {
  const r = resumenMiCelebracion(RESERVA_LEJOS);
  eq(r.adicionales.length, 1);
  eq(r.adicionales[0].nombre, 'Inflable Tiburón');
  eq(r.incluidos.length, 1);
  eq(r.incluidos[0].nombre, 'Cocina Equipada');
});

T('resumenMiCelebracion: reserva firme y lejos del evento → puede pagar saldo, próximo paso tranquilo', () => {
  const r = resumenMiCelebracion(RESERVA_LEJOS);
  eq(r.confirmada, true);
  eq(r.puedePagarSaldo, true);
  eq(r.proximoPaso.tipo, 'todo_ok');
  yes(r.proximoPaso.texto.includes('No tienes que hacer nada ahora'));
});

T('resumenMiCelebracion: saldo pendiente y evento dentro de 72h → próximo paso urgente con el monto', () => {
  const r = resumenMiCelebracion({ ...RESERVA_LEJOS, fecha_evento: horasDesdeAhora(48) });
  eq(r.proximoPaso.tipo, 'saldo_urgente');
  yes(r.proximoPaso.texto.includes('$200.000'), 'debe traer el monto exacto formateado');
  eq(r.puedePagarSaldo, true);
});

T('resumenMiCelebracion: saldo pagado completo → todo pagado, sin botón de pagar saldo', () => {
  const r = resumenMiCelebracion({ ...RESERVA_LEJOS, pagado: 400000, saldo: 0 });
  eq(r.saldoPendiente, 0);
  eq(r.puedePagarSaldo, false);
  eq(r.proximoPaso.tipo, 'todo_pagado');
});

T('resumenMiCelebracion: reserva NO firme (aún esperando el anticipo) → no disponible, no puede pagar saldo', () => {
  const r = resumenMiCelebracion({ ...RESERVA_LEJOS, estado: 'PENDING_PAYMENT', pagado: 0 });
  eq(r.confirmada, false);
  eq(r.puedePagarSaldo, false);
  eq(r.proximoPaso.tipo, 'no_disponible');
});

for (const estado of ['CANCELLED', 'REFUNDED', 'EXPIRED', 'PAYMENT_CONFLICT', 'PAYMENT_VERIFYING', 'DRAFT']) {
  T(`resumenMiCelebracion: estado '${estado}' nunca ofrece pagar saldo`, () => {
    const r = resumenMiCelebracion({ ...RESERVA_LEJOS, estado });
    eq(r.confirmada, false);
    eq(r.puedePagarSaldo, false);
  });
}

// ── Candado de regresión central del documento §4: "No quiero estados
// técnicos como PAID, BALANCE_PENDING, etc. visibles al cliente" — el
// único lugar donde puede aparecer el nombre técnico es `estadoTexto`
// (que ya lo traduce vía etiquetaReserva) y ese campo ni siquiera se
// renderiza en la pantalla; ninguna otra pieza del resumen puede
// contener el enum crudo.
T('resumenMiCelebracion: ningún campo salvo estadoTexto expone el nombre técnico del estado', () => {
  const ESTADOS = ['DRAFT', 'PENDING_PAYMENT', 'PAYMENT_VERIFYING', 'CONFIRMED', 'BALANCE_PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'COMPLETED', 'EXPIRED', 'PAYMENT_CONFLICT'];
  for (const estado of ESTADOS) {
    const r = resumenMiCelebracion({ ...RESERVA_LEJOS, estado });
    const { estadoTexto, ...resto } = r;
    const plano = JSON.stringify(resto);
    yes(!ESTADOS.some((e) => plano.includes(e)), `el estado '${estado}' no debe filtrarse fuera de estadoTexto (resto: ${plano})`);
  }
});

T('proximoPasoMiCelebracion: nunca antepone el tipo interno al texto (el tipo es solo para la UI, no se muestra)', () => {
  const saldo = estadoSaldo({ total: 100000, pagado: 0, fecha_evento: horasDesdeAhora(24 * 10) });
  const p = proximoPasoMiCelebracion({ estado: 'BALANCE_PENDING', saldo });
  yes(!p.texto.toUpperCase().includes('TODO_OK') && !p.texto.toUpperCase().includes('SALDO_URGENTE'));
});

// ══════════════════════════════════════════════════════════════════════
// CANDADOS DE ACCESO — mismo mecanismo que /api/pagos/flow/status
// ══════════════════════════════════════════════════════════════════════

T('CODIGO_RESERVA: rechaza cualquier formato que no sea CSC-AAAA-NNNNNN', () => {
  yes(CODIGO_RESERVA.test('CSC-2026-000501'));
  yes(!CODIGO_RESERVA.test('csc-2026-000501'), 'minúsculas no calzan (se normaliza a mayúsculas antes)');
  yes(!CODIGO_RESERVA.test('CSC-2026-0005'), 'código corto');
  yes(!CODIGO_RESERVA.test('CSC-2026-000501; DROP TABLE reserva;'), 'inyección no debe calzar');
});

T('TOKEN_ACCESO: exige exactamente 32 hex, rechaza tokens cortos, largos o con caracteres inválidos', () => {
  yes(TOKEN_ACCESO.test('aaaa1111bbbb2222cccc3333dddd4444'));
  yes(!TOKEN_ACCESO.test('aaaa1111'), 'token corto');
  yes(!TOKEN_ACCESO.test('aaaa1111bbbb2222cccc3333dddd44440000'), 'token largo');
  yes(!TOKEN_ACCESO.test('ZZZZ1111bbbb2222cccc3333dddd4444'), 'mayúsculas no son hex válido acá');
});

T('igualSeguro: un token que no coincide con el real de la reserva se rechaza', () => {
  const real = RESERVA_LEJOS.acceso_token;
  const falso = 'ffff1111bbbb2222cccc3333dddd4444';
  yes(igualSeguro(real, real), 'el token real siempre debe pasar');
  yes(!igualSeguro(real, falso), 'un token de otra reserva nunca debe pasar');
});

console.log(`\n${ok} pruebas OK`);
if (fallos.length) {
  console.log(`${fallos.length} FALLARON:\n`);
  fallos.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Todo OK.\n');
