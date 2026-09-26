// ══════════════════════════════════════════════════════════════════════
// AUDITORÍA DE PRECIOS  ·  node scripts/qa-precios.mjs
// ──────────────────────────────────────────────────────────────────────
// Busca CUALQUIER cifra en pesos escrita a mano en el proyecto y la
// contrasta con el motor (data/master.js). El objetivo es simple: que no
// exista una sola incongruencia entre lo que cobra la web, lo que dicen
// las páginas y lo que dicen los documentos internos de César.
//
// Falla si encuentra un monto que el motor no reconoce.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fuente = ['data/master.js', 'data/packs-mayores.js', 'data/reglas.js']
  .map((rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/^\s*import\s[^;]+;\s*$/gm, ''))
  .join('\n');
const M = await import('data:text/javascript;base64,' + Buffer.from(fuente).toString('base64'));

// ── Todos los montos que el motor considera válidos ───────────────────
const validos = new Set();
const add = (n) => { if (n > 0) validos.add(n); };

const B = M.PRECIOS_BASE, E = M.PRECIOS_EXTRAS, MU = M.MULTIPLICADORES;
const addsCantidad = MU.cantidad.map((c) => c.add);
const addsEdad = MU.edad.map((e) => e.add);

// bases y todas sus combinaciones reales de tramo + edad
for (const base of [B.independiente, B.independiente_sab, B.completo_10, B.completo_10_sab]) {
  for (const ac of addsCantidad) for (const ae of addsEdad) add(base + ac + ae);
}
// extras fijos y los incrementos, que también se comunican por separado
add(E.nino_extra); add(E.pack_celebra);
// Horas adicionales: cada duracion contratable tiene su propio valor cerrado
// ($50.000 la hora AM, $50.000 o $100.000 en PM). Sale del motor, no a mano.
for (const turno of M.NEGOCIO.turnos) {
  for (const op of M.opcionesHorario(turno.id)) add(op.precioAdicional);
}
addsEdad.forEach(add); addsCantidad.forEach(add);
Object.values(E.festejados_recargo || {}).forEach(add);
// todos los adicionales del catálogo, en sus 4 tramos
for (const item of Object.values(M.ITEMS)) {
  Object.values(item.precios || {}).forEach(add);
}
// niños sobre 30: base + n*10.000
for (const base of [B.completo_30, B.completo_30_sab]) {
  for (const ae of addsEdad) for (let n = 1; n <= 10; n++) add(base + 50000 + ae + n * E.nino_extra);
}

// ── Dónde buscar ──────────────────────────────────────────────────────
const ARCHIVOS = [
  'data/INFO_NEGOCIO.md', 'PLAYBOOK-VENTAS.md', 'KIT-WHATSAPP-LANZAMIENTO.md',
  // SISTEMA-SEGUIMIENTO y SISTEMA-RESENAS quedan fuera: sus cifras son costos
  // de herramientas de WhatsApp, no precios que pague un papá.
];
// En el código, cualquier monto literal fuera de master.js es sospechoso.
const CODIGO = ['app/celebra-ui.js', 'app/armar/wizard.js', 'app/paginas-respuesta.js',
  'app/catalogo/catalogo-cliente.js', 'app/terminos/page.js'];

const MONTO = /\$\s?(\d{1,3}(?:\.\d{3})+)/g;
const aNumero = (s) => Number(s.replace(/\./g, ''));

const hallazgos = [];

for (const rel of [...ARCHIVOS, ...CODIGO]) {
  const p = path.join(RAIZ, rel);
  if (!fs.existsSync(p)) continue;
  const texto = fs.readFileSync(p, 'utf8');
  texto.split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(MONTO)) {
      const valor = aNumero(m[1]);
      if (validos.has(valor)) continue;
      hallazgos.push({ rel, linea: i + 1, valor: m[0], texto: linea.trim().slice(0, 90) });
    }
  });
}

console.log('\n  Auditoría de precios — celebrasincesar.cl');
console.log('  ' + '─'.repeat(58));
console.log('  Montos válidos según el motor: ' + validos.size);
if (hallazgos.length === 0) {
  console.log('  Sin incongruencias: ningún precio escrito a mano contradice al motor.\n');
  process.exit(0);
}
for (const h of hallazgos) {
  console.log(`  REVISAR  ${h.rel}:${h.linea}  ${h.valor}`);
  console.log(`           ${h.texto}`);
}
console.log('  ' + '─'.repeat(58));
console.log('  ' + hallazgos.length + ' monto(s) que el motor no reconoce\n');
process.exit(1);
