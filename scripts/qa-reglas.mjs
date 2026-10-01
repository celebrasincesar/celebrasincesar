// ══════════════════════════════════════════════════════════════════════
// RED DE REGRESIÓN DEL MOTOR DE REGLAS  ·  node scripts/qa-reglas.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba data/master.js + data/packs-mayores.js + data/reglas.js sin React
// ni navegador. Es la red que protege la lógica de negocio mientras se
// refactorizan las pantallas: si un cambio de UI rompe una regla, esto lo
// detecta antes de abrir el navegador.
//
// Los tres archivos de datos son ESM y el proyecto es CommonJS, así que se
// cargan concatenados en un módulo data: URL (master no importa nada,
// packs tampoco, reglas importa a los otros dos).
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ORDEN = ['data/master.js', 'data/packs-mayores.js', 'data/reglas.js'];
const fuente = ORDEN.map((rel) =>
  fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/^\s*import\s[^;]+;\s*$/gm, '')
).join('\n');

let R;
try {
  R = await import('data:text/javascript;base64,' + Buffer.from(fuente).toString('base64'));
} catch (e) {
  console.error('\n  No se pudo cargar la capa de datos: ' + e.message + '\n');
  process.exit(1);
}

// ── mini framework ────────────────────────────────────────────────────
let ok = 0;
const fallos = [];
const T = (nombre, fn) => {
  try {
    fn();
    ok++;
  } catch (e) {
    fallos.push(nombre + ' → ' + e.message);
  }
};
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + 'esperado ' + B + ', obtenido ' + A);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };
const no = (v, msg) => { if (v) throw new Error(msg || 'esperado false'); };

const ctx = (o) => R.contextoDesde({ edadNino: 5, ...o });
const conf = (total, tramoMayores, mayoresAprox) =>
  ctx({ totalNinos: total, tramoMayores, mayoresAprox });

// ══════════════════════════════════════════════════════════════════════
// 1 · TRAMOS Y LÍMITES  (§D, §T, casos 9-11)
// ══════════════════════════════════════════════════════════════════════
T('MAX_NINOS es 40', () => eq(R.MAX_NINOS, 40));

T('adaptador tramo → cantNinos del motor de precios', () => {
  eq(R.tramoDesdeTotal(1), 'hasta10');
  eq(R.tramoDesdeTotal(10), 'hasta10');
  eq(R.tramoDesdeTotal(11), 'hasta20');
  eq(R.tramoDesdeTotal(20), 'hasta20');
  eq(R.tramoDesdeTotal(21), 'hasta30');
  eq(R.tramoDesdeTotal(30), 'hasta30');
  eq(R.tramoDesdeTotal(31), 'mas30');
  eq(R.tramoDesdeTotal(40), 'mas30');
});

T('niños sobre 30 solo existen desde 31', () => {
  eq(R.ninosExtraDesdeTotal(30), 0);
  eq(R.ninosExtraDesdeTotal(31), 1);
  eq(R.ninosExtraDesdeTotal(40), 10);
});

// ══════════════════════════════════════════════════════════════════════
// 2 · MAYORES: NUNCA EXPONER 2 NI 5  (§W, casos 18-20)
// ══════════════════════════════════════════════════════════════════════
T('tramos de mayores tienen las 4 opciones de la spec', () => {
  eq(R.TRAMOS_MAYORES.map((t) => t.id), ['no', '1a3', '4a6', '7mas']);
});

T('tramo de mayores desde una cantidad exacta', () => {
  eq(R.tramoMayoresDesdeCantidad(0), 'no');
  eq(R.tramoMayoresDesdeCantidad(3), '1a3');
  eq(R.tramoMayoresDesdeCantidad(4), '4a6');
  eq(R.tramoMayoresDesdeCantidad(6), '4a6');
  eq(R.tramoMayoresDesdeCantidad(7), '7mas');
  eq(R.tramoMayoresDesdeCantidad(8), '7mas');
});

// ══════════════════════════════════════════════════════════════════════
// 3 · INFLABLES  (§AJ, casos 28-30)
// ══════════════════════════════════════════════════════════════════════
const visibles = (c) => Object.values(R.ITEMS).filter((i) => R.itemVisible(i, c)).map((i) => i.id);
const GIGANTES = ['tobogan-premium', 'gran-castillo', 'super-saltarina'];
const MEDIANOS = ['tiburon-escalador', 'barco-pirata', 'monkey-climb'];
const PEQUENOS = ['castillo-avion', 'castillo-futbolero'];

T('gigantes visibles siempre', () => {
  for (const c of [conf(10, 'no'), conf(20, '1a3'), conf(40, 'no'), conf(40, '7mas', 12)]) {
    for (const g of GIGANTES) yes(visibles(c).includes(g), 'falta ' + g);
  }
});

T('medianos y pequeños solo con ≤20 y cero mayores', () => {
  const permitido = visibles(conf(20, 'no'));
  for (const m of [...MEDIANOS, ...PEQUENOS]) yes(permitido.includes(m), 'falta ' + m);
  for (const c of [conf(21, 'no'), conf(20, '1a3'), conf(10, '1a3'), conf(40, '4a6')]) {
    for (const m of [...MEDIANOS, ...PEQUENOS]) no(visibles(c).includes(m), 'no debía verse ' + m);
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4 · MATRIZ DE PACKS  (§AE, casos 1-8)
// ══════════════════════════════════════════════════════════════════════
const pide = (total, tramo, aprox) => {
  const pv = R.packPara(conf(total, tramo, aprox));
  if (!pv) return null;
  const cuenta = { deportivo: 0, inflable_gigante: 0, animacion: 0, ramas: 0 };
  for (const req of pv.variante.requisitos) {
    if (req.ramas.length > 1) cuenta.ramas++;
    const rama = req.ramas[0];
    for (const p of rama.pide) cuenta[p.categoria] += p.cantidad;
  }
  return { pack: pv.pack.id, variante: pv.variante.id, cuenta };
};

T('sin mayores no hay pack', () => {
  eq(R.packPara(conf(10, 'no')), null);
  eq(R.packPara(conf(40, 'no')), null);
});

T('1-3 mayores → Pack 1', () => {
  eq(pide(20, '1a3').pack, 'PACK_MAYORES_1');
  eq(pide(20, '1a3').variante, 'v-hasta20');
  eq(pide(21, '1a3').variante, 'v-21a40');
});

T('4-6 mayores → Pack 2 con 2 o 3 deportivos según tramo', () => {
  eq(pide(20, '4a6').pack, 'PACK_MAYORES_2');
  eq(pide(20, '4a6').cuenta.deportivo, 2);
  eq(pide(21, '4a6').cuenta.deportivo, 3);
});

T('7+ mayores → Pack 3 con gigante y animación obligatorios', () => {
  const a = pide(20, '7mas', 7), b = pide(21, '7mas', 7);
  eq(a.pack, 'PACK_MAYORES_3');
  eq(a.cuenta.inflable_gigante, 1);
  eq(a.cuenta.animacion, 1);
  eq(a.cuenta.deportivo, 2);
  eq(b.cuenta.deportivo, 3);
  eq(a.cuenta.ramas, 0, 'el pack 3 no ofrece alternativas');
});

// ── FRONTERA 6/7/8 mayores (documento "No autorizo todavía el deploy...",
// 15-sep-2026, §2): el corte entre tramo medio y tramo alto está en 7, no
// en 8. Se prueba el mismo caso con ≤20 y >20 invitados. ──
T('FRONTERA · exactamente 6 mayores queda en el tramo medio (Pack 2)', () => {
  eq(R.tramoMayoresDesdeCantidad(6), '4a6');
  const a = pide(20, '4a6', 6), b = pide(21, '4a6', 6);
  eq(a.pack, 'PACK_MAYORES_2');
  eq(a.cuenta.deportivo, 2);
  eq(b.pack, 'PACK_MAYORES_2');
  eq(b.cuenta.deportivo, 3);
});

T('FRONTERA · exactamente 7 mayores sube al tramo superior (Pack 3)', () => {
  eq(R.tramoMayoresDesdeCantidad(7), '7mas');
  const a = pide(20, '7mas', 7), b = pide(21, '7mas', 7);
  eq(a.pack, 'PACK_MAYORES_3');
  eq(a.cuenta.inflable_gigante, 1);
  eq(a.cuenta.animacion, 1);
  eq(a.cuenta.deportivo, 2);
  eq(b.pack, 'PACK_MAYORES_3');
  eq(b.cuenta.deportivo, 3);
});

T('FRONTERA · 8 mayores sigue en el tramo superior (Pack 3)', () => {
  eq(R.tramoMayoresDesdeCantidad(8), '7mas');
  const a = pide(20, '7mas', 8), b = pide(21, '7mas', 8);
  eq(a.pack, 'PACK_MAYORES_3');
  eq(b.pack, 'PACK_MAYORES_3');
});

T('Pack 1 hasta 20 ofrece 3 alternativas excluyentes', () => {
  const pv = R.packPara(conf(15, '1a3'));
  eq(pv.variante.requisitos.length, 1);
  eq(pv.variante.requisitos[0].ramas.map((r) => r.id), ['dos-deportivos', 'inflable', 'animacion']);
});

// ══════════════════════════════════════════════════════════════════════
// 5 · PRODUCTOS APTOS PARA EL PACK  (§AL, casos 26-27)
// ══════════════════════════════════════════════════════════════════════
T('Baby Shower no satisface la animación del pack', () => {
  const i = R.getItem('animacion-baby-shower');
  no(i.apto_pack_mayores, 'Baby Shower no debe ser apto');
  eq(i.categoria_pack, null);
});

T('Racing Kart no satisface el deportivo obligatorio', () => {
  no(R.getItem('racing-kart').apto_pack_mayores);
});

T('Tiggy Junior no satisface el deportivo obligatorio', () => {
  no(R.getItem('tiggy-junior').apto_pack_mayores);
});

T('quedan deportivos suficientes para el pack más exigente (3)', () => {
  const deps = R.opcionesPack('deportivo', conf(25, '7mas', 7));
  yes(deps.length >= 3, 'solo hay ' + deps.length + ' deportivos aptos');
});

T('las opciones del pack son siempre visibles en su contexto', () => {
  for (const cat of ['deportivo', 'inflable_gigante', 'animacion']) {
    for (const c of [conf(15, '7mas', 7), conf(40, '7mas', 12)]) {
      yes(R.opcionesPack(cat, c).length > 0, 'sin opciones de ' + cat);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════
// 6 · SECTOR  (§Y + regla de mayores)
// ══════════════════════════════════════════════════════════════════════
T('solo hasta 10 invitados permite elegir sector, en cualquier edad', () => {
  for (const edad of [1, 3, 4, 5, 6]) {
    yes(R.puedeElegirSector(10, edad, false), '10 niños · ' + edad + ' años');
  }
});

T('desde 11 invitados el Sector Independiente no se ofrece', () => {
  no(R.puedeElegirSector(11, 3, false));
  no(R.puedeElegirSector(20, 3, false));
  no(R.puedeElegirSector(21, 3, false));
  no(R.puedeElegirSector(40, 3, false));
  eq(R.motivoRecintoCompleto(20, 3, false), 'cantidad');
});

T('con mayores de 6 no se ofrece Sector Independiente', () => {
  no(R.puedeElegirSector(10, 3, true));
  no(R.puedeElegirSector(20, 5, true));
  eq(R.motivoRecintoCompleto(10, 3, true), 'mayores');
});

// ══════════════════════════════════════════════════════════════════════
// 7 · COMPLETITUD DEL PACK  (§AG)
// ══════════════════════════════════════════════════════════════════════
T('un pack a medio llenar no se da por completo', () => {
  const pv = R.packPara(conf(25, '4a6'));
  const sel = R.seleccionVacia(pv.variante);
  no(R.packCompleto(pv.variante, sel), 'vacío no puede estar completo');
  sel['r-config'] = { rama: 'inflable', items: ['tobogan-premium'] };
  sel['r-deportivos'] = { rama: 'unica', items: ['hockey-junior'] };
  no(R.packCompleto(pv.variante, sel), 'faltan 2 deportivos');
  sel['r-deportivos'].items.push('tacataca-junior', 'pingpong-junior');
  yes(R.packCompleto(pv.variante, sel), 'debería estar completo');
});

T('el precio del pack es la suma de lo elegido mientras no haya precio fijo', () => {
  const pv = R.packPara(conf(25, '4a6'));
  const sel = {
    'r-config': { rama: 'inflable', items: ['tobogan-premium'] },
    'r-deportivos': { rama: 'unica', items: ['hockey-junior', 'tacataca-junior', 'pingpong-junior'] },
  };
  yes(R.packEsReferencial(pv.variante), 'aún no hay precio cerrado');
  eq(R.precioPack(pv.variante, sel, 'hasta30'), 70000 + 25000 * 3);
});

// ══════════════════════════════════════════════════════════════════════
// 8 · RECOMENDACIONES COMPLEMENTARIAS  (§AQ, casos 14-16)
// ══════════════════════════════════════════════════════════════════════
T('no se recomienda una categoría que el pack ya resolvió', () => {
  const c = conf(25, '4a6');
  const enPack = ['tobogan-premium', 'hockey-junior', 'tacataca-junior', 'pingpong-junior'];
  const recs = R.recomendados(c, enPack, 6, { categoriasCubiertas: ['inflable_gigante', 'deportivo'] });
  for (const r of recs) {
    no(r.item.categoria_pack === 'inflable_gigante', 'recomendó otro inflable gigante: ' + r.item.id);
    no(r.item.categoria_pack === 'deportivo', 'recomendó otro deportivo: ' + r.item.id);
  }
  yes(recs.length > 0, 'debería quedar algo complementario que recomendar');
});

T('las recomendaciones nunca incluyen algo no visible ni ya elegido', () => {
  const c = conf(25, '4a6');
  for (const r of R.recomendados(c, ['tobogan-premium'])) {
    yes(R.itemVisible(r.item, c), r.item.id + ' no es visible');
    no(r.item.id === 'tobogan-premium', 'recomendó algo ya elegido');
  }
});

// ══════════════════════════════════════════════════════════════════════
// 9 · VITRINA FILTRADA  (§AJ + doble cobro)
// ══════════════════════════════════════════════════════════════════════
T('lo comprometido en el pack sale de la vitrina', () => {
  const c = conf(25, '4a6');
  const bloques = R.filtrarBloques(R.BLOQUES_VITRINA, c, ['tobogan-premium']);
  const ids = bloques.flatMap((b) => b.grupos.flatMap((g) => g.itemIds || []));
  no(ids.includes('tobogan-premium'), 'el inflable del pack no debe volver a ofrecerse');
  yes(ids.includes('gran-castillo'), 'los otros gigantes siguen disponibles');
});

T('un bloque sin opciones válidas desaparece entero', () => {
  const bloques = R.filtrarBloques(R.BLOQUES_VITRINA, conf(25, '4a6'));
  const infl = bloques.find((b) => b.id === 'b-inflables');
  const secciones = infl.grupos.filter((g) => !g.portada).map((g) => g.id);
  eq(secciones, ['g-infl-gigante'], 'solo debe quedar la sección de gigantes');
});

// ══════════════════════════════════════════════════════════════════════
// 10 · NORMALIZACIÓN DE ESTADOS IMPOSIBLES  (§X, casos 12-13, 21)
// ══════════════════════════════════════════════════════════════════════
T('normalizar: los mayores nunca superan el total posible del tramo', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: 'hasta10', tramoMayores: '7mas', mayoresAprox: 25, edadNino: 5 });
  yes(e.mayoresAprox <= 10, 'quedó ' + e.mayoresAprox + ' mayores con tope 10');
});

T('normalizar: bajar el tramo obliga a revisar el pack', () => {
  const e = R.normalizarConfiguracion({
    tramoInvitados: '11a20', tramoMayores: '4a6', edadNino: 5,
    packMayores: { packId: 'PACK_MAYORES_2', varianteId: 'v-21a40', seleccion: {} },
  });
  eq(e.packMayores.varianteId, 'v-hasta20', 'debe cambiar de variante');
});

T('normalizar: quitar los mayores borra el pack', () => {
  const e = R.normalizarConfiguracion({
    tramoInvitados: '11a20', tramoMayores: 'no', edadNino: 5,
    packMayores: { packId: 'PACK_MAYORES_2', varianteId: 'v-hasta20', seleccion: {} },
  });
  eq(e.packMayores, null);
});

T('normalizar: con mayores el sector queda en completo', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: 'hasta10', tramoMayores: '1a3', sector: 'independiente', edadNino: 5 });
  eq(e.sector, 'completo');
});

T('normalizar: pasar de "hasta 10" a "11 a 20" fuerza recinto completo', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: '11a20', tramoMayores: 'no', sector: 'independiente', edadNino: 5 });
  eq(e.sector, 'completo');
  yes(e.cambios.some((c) => c.includes('Recinto Completo')), 'debe avisar el cambio de sector');
});

T('normalizar: más de 20 niños fuerza recinto completo', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: '21a30', tramoMayores: 'no', sector: 'independiente', edadNino: 5 });
  eq(e.sector, 'completo');
});

T('normalizar: 31-40 conserva el número exacto dentro del rango', () => {
  eq(R.normalizarConfiguracion({ tramoInvitados: '31a40', totalNinos: 55, tramoMayores: 'no' }).totalNinos, 40);
  eq(R.normalizarConfiguracion({ tramoInvitados: '31a40', totalNinos: 12, tramoMayores: 'no' }).totalNinos, 31);
});


// ══════════════════════════════════════════════════════════════════════
// PATCH FINAL — QA SECTOR (casos 1-7)
// ══════════════════════════════════════════════════════════════════════
const sector = (n, may) => R.puedeElegirSector(n, 5, may > 0);

T('QA1-2 · hasta 10 niños sin mayores permite Independiente', () => {
  yes(sector(8, 0), '8 niños');
  yes(sector(10, 0), '10 niños');
});

T('QA3 · 10 niños + 1 mayor obliga Recinto Completo', () => {
  no(sector(10, 1));
  eq(R.motivoRecintoCompleto(10, 5, true), 'mayores');
});

T('QA4-5 · desde 11 niños obliga Recinto Completo', () => {
  no(sector(11, 0));
  no(sector(20, 0));
  eq(R.motivoRecintoCompleto(11, 5, false), 'cantidad');
});

T('QA6 · 8 niños + 3 mayores obliga Recinto Completo', () => no(sector(8, 3)));
T('QA7 · 40 niños obliga Recinto Completo', () => no(sector(40, 0)));

// ══════════════════════════════════════════════════════════════════════
// PATCH FINAL — QA HORARIOS (casos 8-21)
// ══════════════════════════════════════════════════════════════════════
T('QA8 · AM sin horas: 11:00-14:00 y $0', () => {
  const h = R.horarioEfectivo('AM', 0);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['11:00', '14:00', 0]);
});

T('QA9 · AM +1 crece HACIA ATRÁS: 10:00-14:00 y $50.000', () => {
  const h = R.horarioEfectivo('AM', 1);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['10:00', '14:00', 50000]);
  eq(h.texto, '10:00–14:00');
});

T('QA10 · AM +2 es imposible: se acota a 1', () => {
  eq(R.maxHorasAdicionales('AM'), 1);
  eq(R.horarioEfectivo('AM', 2).horas, 1);
  eq(R.horarioEfectivo('AM', 2).horaInicio, '10:00');
});

T('QA11 · PM sin horas: 16:00-19:00 y $0 (Fase 5 Bloque 1: PM unificado)', () => {
  const h = R.horarioEfectivo('PM', 0);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '19:00', 0]);
});

T('QA12 · PM +1 crece HACIA ADELANTE: 16:00-20:00 y $50.000 (60 min)', () => {
  const h = R.horarioEfectivo('PM', 1);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '20:00', 50000]);
  eq(h.etiquetaExtension, 'Extensión hasta las 20:00');
});

T('QA13 · PM +2: 16:00-20:30 y $100.000 — NO lineal (90 min, no 120)', () => {
  const h = R.horarioEfectivo('PM', 2);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '20:30', 100000]);
  eq(h.etiquetaExtension, 'Extensión hasta las 20:30');
});

T('QA14 · PM +3 es imposible: se acota a 2', () => {
  eq(R.maxHorasAdicionales('PM'), 2);
  eq(R.horarioEfectivo('PM', 3).horas, 2);
});

T('QA15 · pasar de PM +2 a AM normaliza a 1', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: 'hasta10', tramoMayores: 'no', hora: 'AM', horasAdicionales: 2 });
  eq(e.horasAdicionales, 1);
  yes(e.cambios.some((c) => c.includes('hora')), 'debe avisar el ajuste de duración');
});

T('AM +1 se conserva al pasar a PM', () => {
  const e = R.normalizarConfiguracion({ tramoInvitados: 'hasta10', tramoMayores: 'no', hora: 'PM', horasAdicionales: 1 });
  eq(e.horasAdicionales, 1);
});

T('migración: horaExtra true se convierte en 1 hora', () => {
  eq(R.migrarHoraExtra({ horaExtra: true, hora: 'AM' }), 1);
  eq(R.migrarHoraExtra({ horaExtra: true, hora: 'PM' }), 1);
  eq(R.migrarHoraExtra({ horaExtra: false, hora: 'PM' }), 0);
  eq(R.migrarHoraExtra({ horasAdicionales: 2, hora: 'PM' }), 2);
});

T('el selector ofrece exactamente las duraciones contratables', () => {
  eq(R.opcionesHorario('AM').map((o) => o.texto), ['11:00–14:00', '10:00–14:00']);
  eq(R.opcionesHorario('PM').map((o) => o.texto), ['16:00–19:00', '16:00–20:00', '16:00–20:30']);
});

// ══════════════════════════════════════════════════════════════════════
// FASE 1A — REGLA VIERNES (documento "Autorización Fase 1A", 13-sep-2026)
// Fechas verificadas: 2026-09-18 = viernes, 2026-09-19 = sábado,
// 2026-09-20 = domingo, 2026-09-17 = jueves (día previo al viernes usado
// para el test de zona horaria).
// ══════════════════════════════════════════════════════════════════════
const VIERNES = '2026-09-18';
const SABADO  = '2026-09-19';
const DOMINGO = '2026-09-20';
const JUEVES  = '2026-09-17';

T('esViernes() reconoce viernes/sábado/domingo/jueves sin desvío de zona horaria', () => {
  yes(R.esViernes(VIERNES), 'debe reconocer el viernes');
  no(R.esViernes(SABADO), 'sábado no es viernes');
  no(R.esViernes(DOMINGO), 'domingo no es viernes');
  no(R.esViernes(JUEVES), 'jueves no es viernes — nunca debe "adelantarse" a viernes por UTC');
});

T('viernes: no existe turno AM — turnoPorId devuelve null', () => {
  eq(R.turnoPorId('AM', VIERNES), null);
  yes(R.turnoPorId('PM', VIERNES), 'PM sí existe los viernes');
});

T('viernes: validarTurnoFecha rechaza AM con mensaje específico (no el genérico AM/PM)', () => {
  const v = R.validarTurnoFecha('AM', 0, VIERNES);
  no(v.ok);
  eq(v.motivo, 'viernes_sin_am');
  eq(v.mensaje, 'Los viernes las celebraciones están disponibles únicamente en turno PM desde las 16:00.');
});

T('viernes PM base: 16:00–19:00 y $0', () => {
  const h = R.horarioEfectivo('PM', 0, VIERNES);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '19:00', 0]);
});

T('viernes PM +1: 16:00–20:00 y $50.000', () => {
  const h = R.horarioEfectivo('PM', 1, VIERNES);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '20:00', 50000]);
});

T('Fase 5 Bloque 1: viernes PM +2 ya NO se rechaza — mismas 2 extensiones que sábado/domingo', () => {
  const v = R.validarTurnoFecha('PM', 2, VIERNES);
  yes(v.ok);
  const h = R.horarioEfectivo('PM', 2, VIERNES);
  eq([h.horaInicio, h.horaTermino, h.precioAdicional], ['16:00', '20:30', 100000]);
});

T('maxHorasAdicionales(PM, viernes) es 2 — igual que sábado/domingo (Fase 5 Bloque 1)', () => {
  eq(R.maxHorasAdicionales('PM', VIERNES), 2);
});

T('el selector de viernes ofrece PM base, PM+1 y PM+2 — igual que sábado/domingo', () => {
  eq(R.opcionesHorario('AM', VIERNES), []);
  eq(R.opcionesHorario('PM', VIERNES).map((o) => o.texto), ['16:00–19:00', '16:00–20:00', '16:00–20:30']);
});

T('validarTurnoFecha: un nivel fuera de rango da el motivo genérico "exceso_horas"', () => {
  const v = R.validarTurnoFecha('AM', 2, SABADO);
  no(v.ok);
  eq(v.motivo, 'exceso_horas');
});

T('sábado sin regresión: AM y PM siguen igual con fecha explícita (Fase 5 Bloque 1: PM 16:00–20:30)', () => {
  eq(R.horarioEfectivo('AM', 0, SABADO).texto, '11:00–14:00');
  eq(R.horarioEfectivo('AM', 1, SABADO).texto, '10:00–14:00');
  eq(R.horarioEfectivo('PM', 2, SABADO).texto, '16:00–20:30');
  eq(R.maxHorasAdicionales('AM', SABADO), 1);
  eq(R.maxHorasAdicionales('PM', SABADO), 2);
  yes(R.validarTurnoFecha('AM', 0, SABADO).ok);
  yes(R.validarTurnoFecha('PM', 2, SABADO).ok);
});

T('domingo sin regresión: AM y PM siguen igual con fecha explícita (Fase 5 Bloque 1: PM 16:00–20:30)', () => {
  eq(R.horarioEfectivo('AM', 0, DOMINGO).texto, '11:00–14:00');
  eq(R.horarioEfectivo('PM', 2, DOMINGO).texto, '16:00–20:30');
  eq(R.maxHorasAdicionales('AM', DOMINGO), 1);
  eq(R.maxHorasAdicionales('PM', DOMINGO), 2);
  yes(R.validarTurnoFecha('AM', 0, DOMINGO).ok);
  yes(R.validarTurnoFecha('PM', 2, DOMINGO).ok);
});

T('validarTurnoFecha: turno inexistente conserva el mensaje genérico fuera de viernes', () => {
  const v = R.validarTurnoFecha('XX', 0, SABADO);
  no(v.ok);
  eq(v.motivo, 'turno_invalido');
  eq(v.mensaje, 'El turno debe ser AM o PM.');
});

T('llamadas sin fecha (compatibilidad hacia atrás) siguen resolviendo la tabla estándar', () => {
  // El fixture histórico CSC-2026-000005/Clemente (scripts/qa-pagos.mjs) no
  // se toca acá: su hora_inicio/hora_termino es texto ya guardado en el
  // snapshot, nunca se recalcula con horarioEfectivo — y su fecha real
  // (2026-09-27) es domingo, no viernes, así que tampoco lo alcanza esta
  // regla aunque se recalculara.
  eq(R.horarioEfectivo('AM', 0).texto, '11:00–14:00');
  eq(R.horarioEfectivo('PM', 2).texto, '16:00–20:30');
});

// ══════════════════════════════════════════════════════════════════════
// PATCH FINAL — QA PRODUCTOS (casos 22-34)
// ══════════════════════════════════════════════════════════════════════
const ve = (id, c) => R.itemVisible(R.getItem(id), c);
const conEdad = (edad, total, tramoMayores, aprox) =>
  R.contextoDesde({ edadNino: edad, totalNinos: total, tramoMayores, mayoresAprox: aprox });

T('QA22-23 · medianos y pequeños se ocultan sobre 20 niños', () => {
  no(ve('castillo-avion', conEdad(3, 30, 'no')), 'pequeño con 30');
  no(ve('tiburon-escalador', conEdad(5, 21, 'no')), 'mediano con 21');
});

T('QA24-25 · medianos y pequeños se ocultan con cualquier mayor', () => {
  no(ve('castillo-avion', conEdad(3, 10, '1a3')));
  no(ve('tiburon-escalador', conEdad(5, 10, '1a3')));
});

T('QA26 · pequeño de edad_max 5 con festejado de 6 y sin mayores: oculto', () => {
  eq(R.getItem('castillo-avion').edad_max, 5);
  no(ve('castillo-avion', conEdad(6, 8, 'no')));
});

T('QA27 · pequeño compatible con 8 niños y sin mayores: visible', () => {
  yes(ve('castillo-avion', conEdad(4, 8, 'no')));
});

T('QA28-29 · gigante compatible se muestra con 30 niños y con mayores', () => {
  yes(ve('tobogan-premium', conEdad(5, 30, 'no')));
  yes(ve('tobogan-premium', conEdad(5, 30, '4a6')));
});

T('QA30 · deportivo de mayores con festejado de 3 Y mayores presentes: visible', () => {
  yes(ve('pingpong-adultos', conEdad(3, 20, '1a3')), 'sirve al grupo de los mayores');
});

// QA31 del patch decía que un deportivo de adultos no debía ofrecerse sin
// mayores presentes. César corrigió esa regla: las mesas tamaño adulto se
// ofrecen SIEMPRE, porque los papás y tíos juegan igual. El test refleja la
// regla vigente del negocio, no la del borrador.
T('las mesas tamaño adulto se ofrecen en todas las celebraciones', () => {
  for (const id of ['pingpong-adultos', 'tacataca-adultos']) {
    for (const c of [conEdad(1, 8, 'no'), conEdad(3, 20, 'no'), conEdad(5, 40, 'no'),
                     conEdad(6, 30, '4a6'), conEdad(2, 25, '7mas', 10)]) {
      yes(ve(id, c), id + ' debe verse siempre');
    }
  }
});

T('las mesas tamaño adulto siguen sirviendo al pack de mayores', () => {
  const opciones = R.opcionesPack('deportivo', conEdad(5, 25, '7mas', 7)).map((i) => i.id);
  yes(opciones.includes('pingpong-adultos'));
  yes(opciones.includes('tacataca-adultos'));
});

// ── Autos eléctricos: solo si todos los invitados tienen hasta 5 años ──
const ELECTRICOS = ['hoppy-jeep', 'funny-bugatti', 'retro-excava'];

T('los autos eléctricos se ofrecen con festejado de hasta 5 y sin mayores', () => {
  for (const id of ELECTRICOS) {
    for (const edad of [1, 3, 5]) {
      yes(ve(id, conEdad(edad, 20, 'no')), id + ' con festejado de ' + edad);
    }
  }
});

T('los autos eléctricos desaparecen si viene algún mayor de 6', () => {
  for (const id of ELECTRICOS) {
    for (const tramo of ['1a3', '4a6', '7mas']) {
      no(ve(id, conEdad(3, 20, tramo, 8)), id + ' no corresponde con mayores');
    }
  }
});

T('los autos eléctricos desaparecen si el festejado ya cumple 6', () => {
  for (const id of ELECTRICOS) no(ve(id, conEdad(6, 15, 'no')), id + ' con festejado de 6');
});

T('ningún auto eléctrico se recomienda cuando no corresponde', () => {
  for (const c of [conEdad(3, 20, '4a6'), conEdad(6, 15, 'no')]) {
    const recs = R.recomendados(c).map((r) => r.item.id);
    for (const id of ELECTRICOS) no(recs.includes(id), id + ' no debería recomendarse');
  }
});

T('QA32 · nada incompatible llega a Recomendados', () => {
  for (const c of [conEdad(6, 30, '4a6'), conEdad(3, 8, 'no'), conEdad(5, 40, '7mas', 10)]) {
    for (const r of R.recomendados(c, [], 6)) {
      yes(R.itemVisible(r.item, c), r.item.id + ' no debería recomendarse');
    }
  }
});

T('QA33 · nada incompatible llega como opción de Pack', () => {
  for (const c of [conEdad(3, 25, '4a6'), conEdad(6, 40, '7mas', 12)]) {
    for (const cat of ['deportivo', 'inflable_gigante', 'animacion']) {
      for (const op of R.opcionesPack(cat, c)) {
        yes(R.itemVisible(op, c), op.id + ' no debería ofrecerse en el pack');
      }
    }
  }
});

T('QA34 · la vitrina filtrada nunca contiene un producto invisible', () => {
  const c = conEdad(6, 30, '4a6');
  const ids = R.filtrarBloques(R.BLOQUES_VITRINA ?? [], c).flatMap((b) => b.grupos.flatMap((g) => g.itemIds || []));
  for (const id of ids) yes(R.itemVisible(R.getItem(id), c), id + ' no debería estar en la vitrina');
});

T('§14 · decoración y servicios NO se filtran por edad', () => {
  for (const c of [conEdad(1, 8, 'no'), conEdad(6, 40, '7mas', 10)]) {
    yes(ve('deco-tematica-full', c), 'decoración siempre disponible');
    yes(ve('inc-cocina', c), 'servicios incluidos siempre disponibles');
  }
});

// ══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// PATCH FINAL — VALOR TOTAL VS ESTIMADO (QA58-59, §P1-31, §P1-32)
// ═══════════════════════════════════════════════════════════════════
T('QA58 · sin pack de mayores el valor es TOTAL, no estimado', () => {
  no(R.cotizacionEsReferencial({ edadNino: 4, tramoInvitados: 'hasta10', tramoMayores: 'no' }));
});

T('QA32/P1-32 · las horas adicionales NO vuelven estimada la cotización', () => {
  for (const h of [0, 1, 2]) {
    no(R.cotizacionEsReferencial({
      edadNino: 4, tramoInvitados: 'hasta10', tramoMayores: 'no', hora: 'PM', horasAdicionales: h,
    }), h + ' horas no pueden volverla estimada');
  }
});

T('QA59 · con precios cerrados en todo, nunca hay valor estimado', () => {
  // El pack dejó de tener precio propio: los productos se cobran a precio de
  // catálogo y los mayores tienen tarifa cerrada. No queda nada por confirmar.
  no(R.cotizacionEsReferencial({ edadNino: 5, tramoInvitados: '11a20', tramoMayores: '4a6' }));
  no(R.cotizacionEsReferencial({ edadNino: 5, tramoInvitados: '31a40', totalNinos: 40, tramoMayores: '7mas', mayoresAprox: 15 }));
});

// ═══════════════════════════════════════════════════════════════════
// HERMANOS MAYORES — VALOR POR TRAMO
// ═══════════════════════════════════════════════════════════════════
const ctxMay = (tramoMayores, tramoInvitados = '11a20', aprox = null) =>
  R.contextoDesde({ edadNino: 5, tramoInvitados, tramoMayores, mayoresAprox: aprox });

T('sin mayores no se cobra nada por ellos', () => {
  eq(R.valorMayores(ctxMay('no')), 0);
  eq(R.valorMayores(R.contextoDesde({ edadNino: 5, tramoInvitados: '11a20' })), 0);
});

T('cada tramo tiene su valor cerrado', () => {
  eq(R.valorMayores(ctxMay('1a3')), 30000);
  eq(R.valorMayores(ctxMay('4a6')), 60000);
  eq(R.valorMayores(ctxMay('7mas', '31a40', 7)), 80000, '7 mayores es la base del tramo, sin recargo');
});

T('sobre 7 mayores se suma $10.000 por cada uno (ancla movida de 8 a 7, §2)', () => {
  eq(R.valorMayores(ctxMay('7mas', '31a40', 8)), 90000);
  eq(R.valorMayores(ctxMay('7mas', '31a40', 9)), 100000);
  eq(R.valorMayores(ctxMay('7mas', '31a40', 12)), 130000);
  eq(R.valorMayores(ctxMay('7mas', '31a40', 20)), 210000);
});

T('FRONTERA DE PRECIO · 6 mayores paga la tarifa cerrada del tramo medio', () => {
  eq(R.valorMayores(ctxMay('4a6', '11a20', 6)), 60000);
});

T('FRONTERA DE PRECIO · 7 mayores entra al tramo alto sin recargo (es la base)', () => {
  eq(R.valorMayores(ctxMay('7mas', '11a20', 7)), 80000);
});

T('FRONTERA DE PRECIO · 8 mayores paga el recargo — consecuencia económica reportada en §2', () => {
  eq(R.valorMayores(ctxMay('7mas', '11a20', 8)), 90000);
});

T('el valor no depende de cuántos niños hay en total', () => {
  for (const inv of ['hasta10', '11a20', '21a30']) {
    eq(R.valorMayores(ctxMay('4a6', inv)), 60000, inv);
  }
});

// ═══════════════════════════════════════════════════════════════════
// HERMANOS MAYORES — LA REGLA SE EVALÚA CONTRA LO YA ELEGIDO
// ═══════════════════════════════════════════════════════════════════
const extras = (...ids) => ids.map((id) => ({ id }));

T('sin mayores no hay nada que cumplir', () => {
  yes(R.evaluarMayores([], ctxMay('no')).cumple);
  yes(R.evaluarMayores(extras('deco-tematica-full'), ctxMay('no')).cumple);
});

T('1 a 3 mayores: basta una de las tres alternativas', () => {
  const c = ctxMay('1a3', '11a20');
  no(R.evaluarMayores([], c).cumple, 'sin nada elegido no se cumple');
  yes(R.evaluarMayores(extras('hockey-junior', 'tacataca-junior'), c).cumple, '2 deportivos');
  yes(R.evaluarMayores(extras('tobogan-premium'), c).cumple, '1 inflable gigante');
  yes(R.evaluarMayores(extras('animacion-completa'), c).cumple, '1 animaci\u00f3n');
  no(R.evaluarMayores(extras('hockey-junior'), c).cumple, '1 solo deportivo no alcanza');
});

T('4 a 6 mayores con 21-30 niños: actividad central MAS 3 deportivos', () => {
  const c = ctxMay('4a6', '21a30');
  no(R.evaluarMayores(extras('tobogan-premium'), c).cumple, 'falta n las mesas');
  no(R.evaluarMayores(extras('hockey-junior', 'tacataca-junior', 'pingpong-junior'), c).cumple, 'falta la actividad central');
  yes(R.evaluarMayores(extras('tobogan-premium', 'hockey-junior', 'tacataca-junior', 'pingpong-junior'), c).cumple);
  yes(R.evaluarMayores(extras('animacion-completa', 'hockey-junior', 'tacataca-junior', 'pingpong-junior'), c).cumple);
});

T('7 o más: inflable gigante Y animación Y deportivos', () => {
  const c = ctxMay('7mas', '21a30', 7);
  yes(R.evaluarMayores(extras('tobogan-premium', 'animacion-completa',
    'hockey-junior', 'tacataca-junior', 'pingpong-junior'), c).cumple);
  no(R.evaluarMayores(extras('tobogan-premium', 'hockey-junior', 'tacataca-junior', 'pingpong-junior'), c).cumple,
    'sin animaci\u00f3n no se cumple');
});

T('un bloque fijo no se queda sin mesas por culpa de uno de elección', () => {
  // Pack 1 con 21-40 pide 1 deportivo fijo MÁS (inflable o animación).
  // Con 1 deportivo y 1 inflable debe bastar: el inflable resuelve el bloque
  // de elección y la mesa el bloque fijo.
  const c = ctxMay('1a3', '21a30');
  yes(R.evaluarMayores(extras('hockey-junior', 'tobogan-premium'), c).cumple);
  no(R.evaluarMayores(extras('hockey-junior'), c).cumple, 'falta la actividad central');
});

T('lo que falta se informa con sus alternativas', () => {
  const r = R.evaluarMayores([], ctxMay('4a6', '11a20'));
  no(r.cumple);
  eq(r.faltantes.length, 2, 'faltan los dos bloques');
  const central = r.faltantes.find((f) => f.opciones.length > 1);
  yes(central, 'el bloque de actividad central ofrece alternativas');
  eq(central.opciones.map((o) => o.id).sort(), ['animacion', 'inflable']);
  for (const o of central.opciones) yes(o.pide[0].faltan > 0, 'debe decir cu\u00e1ntos faltan');
});

T('un producto no apto para mayores no sirve para cumplir la regla', () => {
  const c = ctxMay('1a3', '11a20');
  // Baby Shower y Racing Kart existen, pero no entretienen a un niño grande.
  no(R.evaluarMayores(extras('animacion-baby-shower'), c).cumple);
  no(R.evaluarMayores(extras('racing-kart', 'tiggy-junior'), c).cumple);
});

// ═══════════════════════════════════════════════════════════════════
// PATCH FINAL — DECLARACIONES: UNA SOLA FUENTE (QA41, §P0-22)
// ═══════════════════════════════════════════════════════════════════
T('QA41 · las declaraciones existen como fuente única y bien formadas', () => {
  yes(Array.isArray(R.DECLARACIONES) && R.DECLARACIONES.length === 4, 'deben ser 4');
  for (const d of R.DECLARACIONES) {
    yes(d.id && d.titulo && d.texto, 'declaración incompleta: ' + d.id);
  }
  const condicionales = R.DECLARACIONES.filter((d) => d.condicional === 'mayores');
  eq(condicionales.length, 1, 'solo la de mayores es condicional');
  eq(condicionales[0].id, 'declaraMayores');
});

T('QA41 · la declaración de mayores ya no traslada la culpa al apoderado', () => {
  const t = R.DECLARACIONES.find((d) => d.id === 'declaraMayores').texto.toLowerCase();
  for (const prohibido of ['me hago responsable', 'yo me encargo', 'supervisi\u00f3n directa']) {
    no(t.includes(prohibido), 'sigue diciendo "' + prohibido + '"');
  }
  yes(t.includes('colaborar activamente'), 'debe comprometer colaboración, no responsabilidad exclusiva');
});


// ═══════════════════════════════════════════════════════════════════
// EL RANGO ELEGIDO SE MANTIENE COMO RANGO (§W)
//
// El motor usa 2 y 5 para dimensionar el pack cuando el papá dice "entre 1
// y 3" o "entre 4 y 6". Son números internos: si aparecen en pantalla, le
// estamos atribuyendo una cantidad exacta que nunca declaró.
// ═══════════════════════════════════════════════════════════════════
T('la etiqueta de mayores nunca muestra el 2 ni el 5 internos', () => {
  for (const tramo of ['1a3', '4a6']) {
    const desdeEstado = R.labelMayores({ tramoMayores: tramo });
    const desdeContexto = R.labelMayores(R.contextoDesde({ tramoInvitados: '11a20', tramoMayores: tramo, edadNino: 5 }));
    for (const etiqueta of [desdeEstado, desdeContexto]) {
      no(/^\s*[25]\s/.test(etiqueta), tramo + ' expone un exacto: ' + etiqueta);
      yes(etiqueta.includes('a'), tramo + ' debe seguir siendo un rango: ' + etiqueta);
    }
    eq(desdeEstado, desdeContexto, 'estado y contexto deben rotular igual');
  }
  eq(R.labelMayores({ tramoMayores: '1a3' }), '1 a 3');
  eq(R.labelMayores({ tramoMayores: '4a6' }), '4 a 6');
});

T('con 7 o más sí se muestra lo que el papá declaró', () => {
  eq(R.labelMayores({ tramoMayores: '7mas' }), '7 o más');
  eq(R.labelMayores({ tramoMayores: '7mas', mayoresAprox: 12 }), '12 aprox.');
  // Desde el contexto llega como cantidadMayores y debe rotular igual.
  const ctx8 = R.contextoDesde({ tramoInvitados: '31a40', totalNinos: 40, tramoMayores: '7mas', mayoresAprox: 12, edadNino: 5 });
  eq(R.labelMayores(ctx8), '12 aprox.');
});

T('la etiqueta de invitados solo da un exacto en 31-40', () => {
  for (const [tramo, esperado] of [['hasta10', 'hasta 10 ni\u00f1os'], ['11a20', '11 a 20 ni\u00f1os'], ['21a30', '21 a 30 ni\u00f1os']]) {
    const ctx = R.contextoDesde({ tramoInvitados: tramo, tramoMayores: 'no', edadNino: 5 });
    eq(R.labelInvitados(ctx), esperado, tramo + ' no puede mostrar un exacto');
  }
  const ctx40 = R.contextoDesde({ tramoInvitados: '31a40', totalNinos: 34, tramoMayores: 'no', edadNino: 5 });
  eq(R.labelInvitados(ctx40), '34 ni\u00f1os', 'en 31-40 el pap\u00e1 s\u00ed declar\u00f3 el n\u00famero');
});

T('el tope del tramo tampoco se presenta como cantidad exacta', () => {
  // ctx.totalNinos vale 30 para "21 a 30" porque es el peor caso de capacidad,
  // pero eso es cálculo interno: la etiqueta debe seguir diciendo el rango.
  const ctx = R.contextoDesde({ tramoInvitados: '21a30', tramoMayores: '4a6', edadNino: 5 });
  eq(ctx.totalNinos, 30, 'internamente se dimensiona con el tope');
  eq(ctx.cantidadMayores, 5, 'internamente el pack se dimensiona con 5');
  eq(R.labelInvitados(ctx), '21 a 30 ni\u00f1os');
  eq(R.labelMayores(ctx), '4 a 6');
});


// ═══════════════════════════════════════════════════════════════════
// LA ESCALERA DE TRAMOS SUBE PAREJO
//
// Cada salto de tramo vale $25.000. El último tramo tenía un defecto: subía
// $0 propios y lo único que se cobraba era el niño número 31, así que pasar
// de 30 a 31 niños costaba $10.000 en vez de $25.000.
// ═══════════════════════════════════════════════════════════════════
const addCantidad = (id) => R.MULTIPLICADORES.cantidad.find((c) => c.id === id).add;
const arriendo = (totalNinos) => {
  const tramo = R.tramoDesdeTotal(totalNinos);
  return R.PRECIOS_BASE.completo_10
    + addCantidad(tramo)
    + R.ninosExtraDesdeTotal(totalNinos) * R.PRECIOS_EXTRAS.nino_extra;
};

T('cada salto de tramo cuesta $25.000, incluido el último', () => {
  eq(arriendo(20) - arriendo(10), 25000, 'de hasta 10 a 11-20');
  eq(arriendo(30) - arriendo(20), 25000, 'de 11-20 a 21-30');
  eq(arriendo(31) - arriendo(30), 25000, 'de 21-30 a 31 — antes valía solo $10.000');
});

T('sobre 30 niños cada uno suma $10.000 encima del tramo', () => {
  eq(R.PRECIOS_EXTRAS.nino_extra, 10000);
  eq(arriendo(32) - arriendo(31), 10000);
  eq(arriendo(40) - arriendo(31), 90000, 'del 31 al 40 son 9 ni\u00f1os m\u00e1s');
});

T('el último tramo aporta $15.000 propios, además del cobro por niño', () => {
  eq(addCantidad('mas30') - addCantidad('hasta30'), 15000);
});


// RESULTADO
// ══════════════════════════════════════════════════════════════════════
console.log('\n  QA motor de reglas — celebrasincesar.cl');
console.log('  ' + '─'.repeat(52));
if (fallos.length) {
  for (const f of fallos) console.log('  FALLA  ' + f);
  console.log('  ' + '─'.repeat(52));
}
console.log('  ' + ok + ' OK · ' + fallos.length + ' fallas\n');
process.exit(fallos.length ? 1 : 0);
