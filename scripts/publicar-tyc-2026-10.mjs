// ══════════════════════════════════════════════════════════════════════
// PUBLICAR tyc_version '2026-10'  ·  UNA SOLA VEZ
// node scripts/publicar-tyc-2026-10.mjs
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 5 — CIERRE LEGAL + GATE MANUAL FINAL": nueva versión de
// T&C por el cambio de horario (Sección 9). Sigue el mismo flujo descrito
// en scripts/generar-pdf-tyc-version.mjs (§"flujo de publicación futuro"):
// el contenido y el PDF se insertan JUNTOS en una sola fila nueva, nunca
// por separado.
//
// '2026-09-v3' se retira con un UPDATE de solo estado/retirado_en — las
// únicas dos columnas que el trigger tyc_version_inmutable() permite
// tocar (lib/db.js). version/contenido/hashes/pdf/publicado_en quedan
// exactamente como se publicaron originalmente: las reservas que
// aceptaron '2026-09-v3' siguen viendo su mismo texto, su mismo hash, su
// mismo PDF — nunca se migran.
//
// Idempotente: si '2026-10' ya existe, no se reinserta. Si '2026-09-v3'
// ya está RETIRADA, no se vuelve a tocar.
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
  console.log('\nPublicación tyc_version 2026-10 — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q, q1 } = await import('../lib/db.js');
const { contenidoVigenteDesdeFuente, sha256 } = await import('../lib/tyc.js');
const { generarPdfVersion } = await import('../lib/pdf-tyc.js');
const { TYC_VERSION } = await import('../data/master.js');

const VERSION_ANTERIOR = '2026-09-v3';

if (TYC_VERSION !== '2026-10') {
  throw new Error(`data/master.js TYC_VERSION es '${TYC_VERSION}', se esperaba '2026-10' — ¿se revirtió el cambio? Este script no continúa con un estado inesperado.`);
}

// ── 1. Publicar '2026-10': contenido + PDF en la misma fila ────────────
const existente = await q1(`SELECT version FROM tyc_version WHERE version = $1`, [TYC_VERSION]);
if (existente) {
  console.log(`· ${TYC_VERSION} ya existe — no se toca (inmutable).`);
} else {
  const contenido = contenidoVigenteDesdeFuente();
  const hash = sha256(contenido);
  const publicadoEn = new Date().toISOString();
  const { bytes, sha256: pdfSha256 } = await generarPdfVersion({ version: TYC_VERSION, contenido, publicadoEn });
  const url = `/api/tyc/pdf/${encodeURIComponent(TYC_VERSION)}`;

  await q(
    `INSERT INTO tyc_version (version, contenido, contenido_sha256, pdf_url, pdf_sha256, pdf_bytes, estado, publicado_en)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVA', $7::timestamptz)`,
    [TYC_VERSION, contenido, hash, url, pdfSha256, bytes, publicadoEn]
  );
  console.log(`✓ ${TYC_VERSION} insertada — ${contenido.length} caracteres, contenido_sha256=${hash.slice(0, 16)}…, pdf=${bytes.length} bytes, pdf_sha256=${pdfSha256.slice(0, 16)}…`);
}

// ── 2. Retirar la versión anterior — SOLO estado/retirado_en ───────────
const anterior = await q1(
  `SELECT estado, contenido_sha256, pdf_sha256 FROM tyc_version WHERE version = $1`,
  [VERSION_ANTERIOR]
);
if (!anterior) {
  console.log(`· ${VERSION_ANTERIOR} no existe en tyc_version — nada que retirar (¿Sandbox sin poblar?).`);
} else if (anterior.estado === 'RETIRADA') {
  console.log(`· ${VERSION_ANTERIOR} ya está RETIRADA — no se toca.`);
} else {
  await q(
    `UPDATE tyc_version SET estado = 'RETIRADA', retirado_en = now() WHERE version = $1`,
    [VERSION_ANTERIOR]
  );
  const verificacion = await q1(
    `SELECT estado, contenido_sha256, pdf_sha256 FROM tyc_version WHERE version = $1`,
    [VERSION_ANTERIOR]
  );
  if (verificacion.contenido_sha256 !== anterior.contenido_sha256 || verificacion.pdf_sha256 !== anterior.pdf_sha256) {
    throw new Error(`¡El contenido o PDF de ${VERSION_ANTERIOR} cambió al retirarla! Esto no debería poder pasar (trigger de inmutabilidad).`);
  }
  if (verificacion.estado !== 'RETIRADA') {
    throw new Error(`${VERSION_ANTERIOR} no quedó RETIRADA tras el UPDATE.`);
  }
  console.log(`✓ ${VERSION_ANTERIOR} retirada — contenido_sha256 y pdf_sha256 verificados sin cambios.`);
}

console.log('\n=== Estado final de tyc_version ===');
const filas = await q(`SELECT version, estado, length(contenido) AS chars, length(pdf_bytes) AS pdf_bytes, publicado_en, retirado_en FROM tyc_version ORDER BY publicado_en`);
console.table(filas);
process.exit(0);
