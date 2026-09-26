// ══════════════════════════════════════════════════════════════════════
// QA DE EMOJI  ·  node scripts/qa-emoji.mjs
// ──────────────────────────────────────────────────────────────────────
// Un emoji reciente no falla en el build ni en los tests: simplemente le
// llega al cliente como "?" o como un cuadrito, porque la fuente de su
// teléfono no lo tiene. Pasó con el resumen de WhatsApp (🧾, Unicode 11)
// y con el alce 🫎 (Unicode 15) de los mensajes de /cadena.
//
// Regla: nada posterior a Unicode 9 (2016). Con diez años de circulación
// están en cualquier teléfono, en WhatsApp Web y en WhatsApp Desktop, que
// es donde César lee los mensajes. Lo que falló era todo de 2018 o después.
//
// Si necesitas uno nuevo de verdad, agrégalo a PERMITIDOS con el motivo.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Bloques añadidos en Unicode 10 (2017) o después. Unicode 8 y 9 quedan
// fuera a propósito: el unicornio, el ciervo y el scooter llevan una década
// funcionando en todas partes.
const RANGOS_NUEVOS = [
  [0x1f6d5, 0x1f6df],   // Unicode 12-14 — aquí vivía el tobogán que se veía mal
  [0x1f7e0, 0x1f7eb],   // Unicode 12 — círculos y cuadrados de color
  [0x1f90c, 0x1f90f],   // Unicode 13-14
  [0x1f970, 0x1f97f],   // Unicode 11-12 — aquí vivía la cara de fiesta
  [0x1f998, 0x1f9ff],   // Unicode 10-11 — aquí vivía el recibo del resumen
  [0x1fa70, 0x1faff],   // Unicode 12-15 — aquí vivía el alce
];

// Excepciones deliberadas. Vacía a propósito: si algún día hace falta un
// emoji reciente, se anota aquí con el motivo y la fecha en que se revisó.
const PERMITIDOS = new Map([]);

const esNuevo = (cp) => RANGOS_NUEVOS.some(([a, b]) => cp >= a && cp <= b);

// Solo lo que se le sirve al cliente. Los .md son documentación interna —
// y 'cadena' también: /cadena y /api/cadena son el panel interno de César
// (noindex, nunca lo ve un cliente ni le llega por WhatsApp/SMS), así que
// un emoji "nuevo" ahí no corre el riesgo real que este script existe para
// atajar. Se excluye la carpeta entera en vez de silenciar cada emoji con
// PERMITIDOS, uno por uno, cada vez que el panel interno use uno nuevo.
const CARPETAS = ['app', 'data'];
const SALTAR = new Set(['node_modules', '.next', '.git', '.vercel', '.claude', 'cadena']);

const archivos = [];
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) archivos.push(p);
  }
};
for (const c of CARPETAS) recorrer(path.join(RAIZ, c));

const hallazgos = [];
for (const p of archivos) {
  const rel = path.relative(RAIZ, p).replace(/\\/g, '/');
  fs.readFileSync(p, 'utf8').split('\n').forEach((linea, i) => {
    for (const ch of linea) {
      const cp = ch.codePointAt(0);
      if (cp > 0xffff && esNuevo(cp) && !PERMITIDOS.has(cp)) {
        hallazgos.push({ rel, linea: i + 1, cp, texto: linea.trim().slice(0, 70) });
      }
    }
  });
}

console.log('\n  QA de emoji — celebrasincesar.cl');
console.log('  ' + '─'.repeat(58));
console.log(`  Archivos revisados: ${archivos.length}`);
if (!hallazgos.length) {
  console.log('  Sin emoji de riesgo: ninguno es posterior a 2016.\n');
  process.exit(0);
}
for (const h of hallazgos) {
  console.log(`  REVISAR  ${h.rel}:${h.linea}  U+${h.cp.toString(16).toUpperCase()}`);
  console.log(`           ${h.texto}`);
}
console.log('  ' + '─'.repeat(58));
console.log(`  ${hallazgos.length} emoji que pueden llegar como "?" al cliente\n`);
process.exit(1);
