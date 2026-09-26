// ══════════════════════════════════════════════════════════════════════
// QA DE LA PLANILLA DE COTIZACIONES  ·  node scripts/qa-cotizacion.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba las reglas del patch que antes solo se podían verificar leyendo
// código: qué se escribe, qué versión se devuelve y quién puede leerla.
//
// No necesita credenciales ni planilla: `app/api/cotizacion/planilla.js`
// es JavaScript puro, sin googleapis ni Next.
// ══════════════════════════════════════════════════════════════════════

import {
  COLUMNAS, COL, RANGO, aFila, filaVigente, filaAutorizada, aCotizacion,
} from '../app/api/cotizacion/planilla.js';

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };
const no = (v, msg) => { if (v) throw new Error(msg || 'esperado false'); };

// Una cotización como la que envía el armador.
const cot = (extra = {}) => ({
  id: 'CSC-2026-AB12CD',
  accessToken: 'a'.repeat(32),
  evento: {
    fechaTexto: 'viernes, 11 de septiembre de 2026',
    horario: 'PM', horasAdicionales: 2,
    horaInicioReal: '15:00', horaTerminoReal: '20:00',
    horarioTexto: 'PM · 15:00–20:00', sector: 'Recinto Completo',
  },
  festejado: { nombre: 'Sofía', edad: 5, festejados: 1 },
  invitados: { etiqueta: '21 a 30 niños', etiquetaMayores: '4 a 7' },
  pack: {
    packId: 'PACK_MAYORES_2', nombre: 'Entretención Grupo Mayor',
    varianteId: 'v-21a40', elecciones: ['animacion-completa', 'hockey-junior'],
  },
  total: 650000, anticipo: 325000, saldo: 325000, esEstimado: true,
  tycVersion: '2026-08',
  ...extra,
});

// ══════════════════════════════════════════════════════════════════════
// FORMA DE LA PLANILLA
// ══════════════════════════════════════════════════════════════════════
T('la fila tiene exactamente una celda por columna', () => {
  eq(aFila(cot(), 'hoy').length, COLUMNAS.length);
  eq(COLUMNAS.length, 30, 'el rango ' + RANGO + ' cubre 30 columnas');
});

T('las columnas nuevas van al final: las filas antiguas siguen calzando', () => {
  eq(COLUMNAS.slice(0, 27).at(-1), 'Versión T&C');
  eq(COLUMNAS.slice(27), ['Horario real', 'Pack ID', 'Token']);
});

// ══════════════════════════════════════════════════════════════════════
// QA35-36 · packId
// ══════════════════════════════════════════════════════════════════════
T('QA35 · packId se guarda en su propia columna, separado del nombre', () => {
  const f = aFila(cot(), 'hoy');
  eq(f[COL['Pack ID']], 'PACK_MAYORES_2');
  eq(f[COL['Pack']], 'Entretención Grupo Mayor');
});

T('QA36 · packId se recupera idéntico', () => {
  const c = aCotizacion(aFila(cot(), 'hoy'));
  eq(c.packId, 'PACK_MAYORES_2');
  eq(c.varianteId, 'v-21a40');
  eq(c.elecciones, ['animacion-completa', 'hockey-junior']);
});

T('el horario real viaja de ida y de vuelta', () => {
  const c = aCotizacion(aFila(cot(), 'hoy'));
  eq(c.horarioTexto, 'PM · 15:00–20:00');
  eq(c.horasAdicionales, 2);
});

T('una cotización sin pack no inventa uno', () => {
  const c = aCotizacion(aFila(cot({ pack: null }), 'hoy'));
  eq(c.packId, null);
  eq(c.packNombre, null);
  eq(c.elecciones, []);
});

// ══════════════════════════════════════════════════════════════════════
// QA42-43 · token de acceso
// ══════════════════════════════════════════════════════════════════════
const fila = aFila(cot(), 'hoy');

T('QA42 · sin token no se entrega la cotización', () => {
  no(filaAutorizada(fila, ''));
  no(filaAutorizada(fila, null));
  no(filaAutorizada(fila, undefined));
});

T('QA42 · con token equivocado tampoco', () => {
  no(filaAutorizada(fila, 'b'.repeat(32)), 'token distinto del mismo largo');
  no(filaAutorizada(fila, 'a'.repeat(31)), 'prefijo correcto pero corto');
  no(filaAutorizada(fila, 'a'.repeat(33)), 'token más largo');
});

T('QA43 · con el token correcto sí', () => {
  yes(filaAutorizada(fila, 'a'.repeat(32)));
});

T('una fila antigua sin token guardado no se entrega a nadie', () => {
  const vieja = aFila(cot({ accessToken: null }), 'hoy');
  no(filaAutorizada(vieja, ''));
  no(filaAutorizada(vieja, 'a'.repeat(32)));
});

// ══════════════════════════════════════════════════════════════════════
// QA44 · nada se reinterpreta como fórmula
// ══════════════════════════════════════════════════════════════════════
T('QA44 · un campo que empieza con = se guarda tal cual', () => {
  const f = aFila(cot({ festejado: { nombre: '=1+1', edad: 5, festejados: 1 } }), 'hoy');
  eq(f[COL['Festejado']], '=1+1', 'el valor no se toca: RAW lo guarda como texto');
});

// ══════════════════════════════════════════════════════════════════════
// QA45 · versiones de la cotización
// ══════════════════════════════════════════════════════════════════════
T('QA45 · se devuelve la versión más reciente, no la primera', () => {
  const v1 = aFila(cot({ total: 500000 }), 'lunes');
  const v2 = aFila(cot({ total: 650000 }), 'martes');
  const otra = aFila(cot({ id: 'CSC-2026-ZZ99ZZ' }), 'martes');
  const filas = [COLUMNAS, v1, otra, v2];
  eq(filaVigente(filas, 'CSC-2026-AB12CD')[COL['Total']], '650000');
});

T('QA45 · un ID que no está devuelve null, no la fila equivocada', () => {
  eq(filaVigente([COLUMNAS, fila], 'CSC-2026-NADA00'), null);
  eq(filaVigente([], 'CSC-2026-AB12CD'), null);
  eq(filaVigente(undefined, 'CSC-2026-AB12CD'), null);
});

// ══════════════════════════════════════════════════════════════════════
console.log('\n  QA planilla de cotizaciones — celebrasincesar.cl');
console.log('  ' + '─'.repeat(52));
for (const f of fallos) console.log('  FALLA  ' + f);
console.log('  ' + '─'.repeat(52));
console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
process.exit(fallos.length ? 1 : 0);
