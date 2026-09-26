// ══════════════════════════════════════════════════════════════════════
// POBLAMIENTO INICIAL DE tyc_version — script de UNA SOLA VEZ
// node scripts/poblar-tyc-version-inicial.mjs
// ──────────────────────────────────────────────────────────────────────
// Puebla la tabla con las 2 versiones que tenemos con certeza al momento
// de crear el versionado contractual (documento "Instrucción Maestra —
// Continuación", 14-sep-2026, §9-11):
//
//   '2026-09-v2' (vigente) — extraída determinísticamente del archivo
//   fuente actual de app/terminos/page.js.
//
//   '2026-09' (recuperable con certeza) — las mismas 21 secciones,
//   sustituyendo solo la Sección 9 por su texto histórico exacto ya
//   conservado en data/tyc-historico.js.
//
// NUNCA se inserta '2026-08': no hay ningún deployment de Vercel (~40
// revisados) cuyo T&C coincida con ese identificador — sigue siendo
// "legado sin evidencia recuperable con certeza" para las reservas
// antiguas que lo referencian. No se le asigna contenido.
//
// Idempotente: si una versión ya existe en la tabla, no se vuelve a
// insertar (y el trigger de inmutabilidad impediría modificarla de
// todas formas). Correr de nuevo no duplica ni rompe nada.
//
// Corre contra la base de .env.local (Sandbox). Requiere que el esquema
// ya esté migrado (tabla tyc_version + trigger + reserva.tyc_hash) —
// ver lib/db.js `migrar()`.
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
  console.log('\nPoblamiento tyc_version — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
  process.exit(0);
}

const { q, q1 } = await import('../lib/db.js');
const { contenidoVigenteDesdeFuente, contenido202609, sha256 } = await import('../lib/tyc.js');
const { TYC_VERSION } = await import('../data/master.js');

async function publicarSiNoExiste(version, contenido, publicadoEn, retiradoEn) {
  const existente = await q1(`SELECT version FROM tyc_version WHERE version = $1`, [version]);
  if (existente) {
    console.log(`· ${version} ya existe — no se toca (inmutable).`);
    return;
  }
  const hash = sha256(contenido);
  await q(
    `INSERT INTO tyc_version (version, contenido, contenido_sha256, estado, publicado_en, retirado_en)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)`,
    [version, contenido, hash, version === TYC_VERSION ? 'ACTIVA' : 'RETIRADA', publicadoEn, retiradoEn || null]
  );
  console.log(`✓ ${version} insertada — ${contenido.length} caracteres, sha256=${hash.slice(0, 16)}…, publicado_en=${publicadoEn}`);
}

// '2026-09-v2': fecha real de publicación conocida con certeza (13-sep-2026,
// Fase 1A — deploy de la corrección factual de horarios). Se usa esa fecha real.
//
// '2026-09': sabemos con certeza que quedó RETIRADA el 13-sep-2026
// (data/tyc-historico.js: reemplazada_el) — esa fecha real sí se usa en
// retirado_en. Pero NO sabemos con certeza cuándo se publicó originalmente
// (no hay evidencia recuperable de eso) — inventar una fecha ahí sería
// exactamente lo que no debemos hacer. publicado_en queda como el momento
// real en que esta fila se registró en la tabla (reconstrucción), nunca
// como una fecha de publicación original que no podemos probar.
const vigente = contenidoVigenteDesdeFuente();
await publicarSiNoExiste(TYC_VERSION, vigente, '2026-09-13T12:00:00-03:00', null);

const anterior = await contenido202609();
await publicarSiNoExiste('2026-09', anterior, new Date().toISOString(), '2026-09-13T12:00:00-03:00');

console.log('\n=== Estado final de tyc_version ===');
const filas = await q(`SELECT version, estado, length(contenido) AS chars, contenido_sha256, publicado_en, retirado_en FROM tyc_version ORDER BY publicado_en`);
console.table(filas);
console.log('\n2026-08 NO se insertó — sigue como "legado sin evidencia recuperable", tal como corresponde.');
process.exit(0);
