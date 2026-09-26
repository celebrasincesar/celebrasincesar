// ══════════════════════════════════════════════════════════════════════
// GENERAR/RELLENAR EL PDF DE CADA tyc_version  ·  UNA SOLA VEZ POR VERSIÓN
// node scripts/generar-pdf-tyc-version.mjs
// ──────────────────────────────────────────────────────────────────────
// UN PDF POR VERSIÓN CONTRACTUAL (documento "No autorizo todavía el
// deploy...", 15-sep-2026, §9-10). Para una versión NUEVA que se publique
// de ahora en adelante, el PDF se genera junto con el resto de la fila al
// insertarla (ver el flujo de publicación futuro). Este script es para
// las versiones que YA EXISTEN en la tabla sin su PDF —las dos que se
// poblaron en Fase 1B antes de que existiera esta pieza—: como el trigger
// de inmutabilidad bloquea UPDATE sobre pdf_bytes/pdf_sha256/pdf_url
// igual que sobre el resto de la fila, la única forma reversible de
// completarlas es DELETE + INSERT de la MISMA fila con el PDF agregado —
// nunca UPDATE, nunca tocar version/contenido/contenido_sha256 (se
// verifican idénticos antes y después de cada reinserción).
//
// Idempotente: una versión que YA tiene pdf_bytes no se toca.
//
// Corre contra la base de .env.local (Sandbox).
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
  console.log('\nGeneración de PDFs de tyc_version — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q, q1 } = await import('../lib/db.js');
const { generarPdfVersion } = await import('../lib/pdf-tyc.js');

const filas = await q(
  `SELECT id, version, contenido, contenido_sha256, pdf_url, pdf_sha256, pdf_bytes,
          publicado_en, retirado_en, estado
     FROM tyc_version ORDER BY id`
);

for (const fila of filas) {
  if (fila.pdf_bytes) {
    console.log(`· ${fila.version} ya tiene PDF (${fila.pdf_bytes.length} bytes, sha256=${fila.pdf_sha256?.slice(0, 16)}…) — no se toca.`);
    continue;
  }

  console.log(`→ Generando PDF para ${fila.version}…`);
  const { bytes, sha256 } = await generarPdfVersion({
    version: fila.version, contenido: fila.contenido, publicadoEn: fila.publicado_en,
  });
  const url = `/api/tyc/pdf/${encodeURIComponent(fila.version)}`;

  await q(`DELETE FROM tyc_version WHERE id = $1`, [fila.id]);
  await q(
    `INSERT INTO tyc_version
       (version, contenido, contenido_sha256, pdf_url, pdf_sha256, pdf_bytes, publicado_en, retirado_en, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9)`,
    [fila.version, fila.contenido, fila.contenido_sha256, url, sha256, bytes, fila.publicado_en, fila.retirado_en, fila.estado]
  );

  const verificacion = await q1(
    `SELECT contenido_sha256, pdf_sha256, length(pdf_bytes) AS pdf_len, estado
       FROM tyc_version WHERE version = $1`,
    [fila.version]
  );
  if (verificacion.contenido_sha256 !== fila.contenido_sha256) {
    throw new Error(`¡El contenido de ${fila.version} cambió al reinsertar! Antes: ${fila.contenido_sha256}, ahora: ${verificacion.contenido_sha256}`);
  }
  if (verificacion.estado !== fila.estado) {
    throw new Error(`¡El estado de ${fila.version} cambió al reinsertar! Antes: ${fila.estado}, ahora: ${verificacion.estado}`);
  }
  console.log(`✓ ${fila.version} — PDF de ${verificacion.pdf_len} bytes, sha256=${verificacion.pdf_sha256.slice(0, 16)}…, contenido_sha256 verificado sin cambios.`);
}

console.log('\n=== Estado final ===');
const final = await q(`SELECT version, estado, length(contenido) AS chars, length(pdf_bytes) AS pdf_bytes, pdf_sha256 FROM tyc_version ORDER BY publicado_en`);
console.table(final);
process.exit(0);
