// ══════════════════════════════════════════════════════════════════════
// QA DE VISITAS — PURO  ·  node scripts/qa-visitas.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba, sin Postgres ni Calendar, la única pieza pura del documento
// "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A" (22-sep-2026):
// validarSlotVisita() — §20 "Disponibilidad".
//
// Lo que necesita Postgres/Calendar (crearVisita(), disponibilidadVisitas(),
// concurrencia, visitaDesdeParams(), sincronizarCalendarioVisita()) se
// prueba en scripts/qa-visitas-integracion.mjs, mismo criterio que los
// bloques anteriores.
// ══════════════════════════════════════════════════════════════════════

import { register } from 'node:module';

register('./_resolver-sin-extension.mjs', import.meta.url);
const { validarSlotVisita } = await import('../lib/visitas.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Ancla arbitraria — nunca se asume a propósito qué día de la semana cae:
// se calculan los viernes/sábados/etc. relativos a esta fecha, igual de
// válido cualquier año en que se ejecute esta suite.
const HOY = new Date('2026-10-01T12:00:00.000Z');

function fechaStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function proximoDiaSemana(desde, diaSemana) {
  const d = new Date(desde);
  while (d.getDay() !== diaSemana) d.setDate(d.getDate() + 1);
  return d;
}
const VIERNES_BASE = proximoDiaSemana(HOY, 5);
const fechaViernes = (semanasOffset = 0) => {
  const d = new Date(VIERNES_BASE);
  d.setDate(d.getDate() + semanasOffset * 7);
  return fechaStr(d);
};
const MARTES_BASE = proximoDiaSemana(HOY, 2);
const fechaMartes = (semanasOffset = 0) => {
  const d = new Date(MARTES_BASE);
  d.setDate(d.getDate() + semanasOffset * 7);
  return fechaStr(d);
};

// ══════════════════════════════════════════════════════════════════════
// DÍAS — Fase 5 Bloque 2 (01-oct-2026): martes Y viernes; sábado/domingo/
// lunes/miércoles/jueves no.
// ══════════════════════════════════════════════════════════════════════
T('validarSlotVisita: viernes con horario válido → ok', () => {
  const r = validarSlotVisita(fechaViernes(1), '10:00', HOY);
  yes(r.ok, JSON.stringify(r));
});
T('validarSlotVisita: martes con horario válido → ok', () => {
  const r = validarSlotVisita(fechaMartes(1), '10:00', HOY);
  yes(r.ok, JSON.stringify(r));
});
T('validarSlotVisita: sábado → dia_no_disponible', () => {
  const sabado = fechaStr(proximoDiaSemana(HOY, 6));
  const r = validarSlotVisita(sabado, '10:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'dia_no_disponible');
});
T('validarSlotVisita: domingo → dia_no_disponible', () => {
  const domingo = fechaStr(proximoDiaSemana(HOY, 0));
  const r = validarSlotVisita(domingo, '10:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'dia_no_disponible');
});
for (const [nombre, dia] of [['lunes', 1], ['miércoles', 3], ['jueves', 4]]) {
  T(`validarSlotVisita: ${nombre} → dia_no_disponible`, () => {
    const f = fechaStr(proximoDiaSemana(HOY, dia));
    const r = validarSlotVisita(f, '10:00', HOY);
    eq(r.ok, false);
    eq(r.motivo, 'dia_no_disponible');
  });
}

// ══════════════════════════════════════════════════════════════════════
// HORARIOS — Fase 5 Bloque 2: solo 10:00 y 10:30 (ventana 10:00–11:00)
// ══════════════════════════════════════════════════════════════════════
for (const h of ['10:00', '10:30']) {
  T(`validarSlotVisita: viernes ${h} → ok`, () => {
    yes(validarSlotVisita(fechaViernes(1), h, HOY).ok);
  });
  T(`validarSlotVisita: martes ${h} → ok`, () => {
    yes(validarSlotVisita(fechaMartes(1), h, HOY).ok);
  });
}
T('validarSlotVisita: 11:00 ya NO está permitido (Fase 5 Bloque 2 redujo la ventana)', () => {
  const r = validarSlotVisita(fechaViernes(1), '11:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'horario_invalido');
});
T('validarSlotVisita: horario fuera de los permitidos → horario_invalido', () => {
  const r = validarSlotVisita(fechaViernes(1), '12:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'horario_invalido');
});
T('validarSlotVisita: horario de celebración (15:00) tampoco es un horario de visita válido', () => {
  const r = validarSlotVisita(fechaViernes(1), '15:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'horario_invalido');
});

// ══════════════════════════════════════════════════════════════════════
// HORIZONTE — 8 semanas (§3, §20)
// ══════════════════════════════════════════════════════════════════════
T('validarSlotVisita: dentro del horizonte (1 semana) → ok', () => {
  yes(validarSlotVisita(fechaViernes(1), '10:00', HOY).ok);
});
T('validarSlotVisita: muy fuera del horizonte (20 semanas) → fuera_de_horizonte', () => {
  const r = validarSlotVisita(fechaViernes(20), '10:00', HOY);
  eq(r.ok, false);
  eq(r.motivo, 'fuera_de_horizonte');
});

// ══════════════════════════════════════════════════════════════════════
// ANTICIPACIÓN MÍNIMA — 60 minutos (§3, §20)
// ══════════════════════════════════════════════════════════════════════
T('validarSlotVisita: a 20 minutos del horario → anticipacion_insuficiente', () => {
  const f = fechaViernes(1);
  const hoyMuyCerca = new Date(`${f}T09:40:00-03:00`);
  const r = validarSlotVisita(f, '10:00', hoyMuyCerca);
  eq(r.ok, false);
  eq(r.motivo, 'anticipacion_insuficiente');
});
T('validarSlotVisita: a exactamente 2 horas del horario → ok', () => {
  const f = fechaViernes(1);
  const hoyConMargen = new Date(`${f}T08:00:00-03:00`);
  yes(validarSlotVisita(f, '10:00', hoyConMargen).ok);
});

// ══════════════════════════════════════════════════════════════════════
// FECHA — formato y fecha ya pasada
// ══════════════════════════════════════════════════════════════════════
T('validarSlotVisita: fecha con formato inválido → fecha_invalida', () => {
  eq(validarSlotVisita('no-es-una-fecha', '10:00', HOY).motivo, 'fecha_invalida');
});
T('validarSlotVisita: fecha vacía → fecha_invalida', () => {
  eq(validarSlotVisita(null, '10:00', HOY).motivo, 'fecha_invalida');
});
T('validarSlotVisita: fecha ya pasada → fecha_pasada', () => {
  const f = fechaViernes(1);
  const hoyDespues = new Date(`${fechaViernes(2)}T09:00:00-03:00`);
  const r = validarSlotVisita(f, '10:00', hoyDespues);
  eq(r.ok, false);
  eq(r.motivo, 'fecha_pasada');
});

console.log(`\n  QA Visitas (puro) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
