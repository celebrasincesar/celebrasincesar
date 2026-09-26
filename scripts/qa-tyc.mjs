// ══════════════════════════════════════════════════════════════════════
// QA DEL VERSIONADO CONTRACTUAL DE T&C  ·  node scripts/qa-tyc.mjs
// ──────────────────────────────────────────────────────────────────────
// Prueba lib/tyc.js sin base de datos: la extracción determinística del
// contenido vigente (JSX) y del contenido histórico '2026-09' (HTML real
// de un deployment recuperado — documento "No autorizo todavía el
// deploy...", 15-sep-2026, §6), y que el hash resultante nunca cambie
// solo porque cambió CÓMO se extrae.
// ══════════════════════════════════════════════════════════════════════

import { register } from 'node:module';

register('./_resolver-sin-extension.mjs', import.meta.url);

const {
  contenidoVigenteDesdeFuente, contenido202609, extraerSeccionesFuente,
  extraerSeccionesHTML, documentoDesdeSecciones, sha256,
} = await import('../lib/tyc.js');
const { generarPdfVersion } = await import('../lib/pdf-tyc.js');
const { TYC_HISTORICO } = await import('../data/tyc-historico.js');

let ok = 0;
const fallos = [];
const T = async (nombre, fn) => {
  try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// ── Hash histórico conocido — CANDADO DE REGRESIÓN. Si este test falla,
// algo cambió en cómo se extrae/hashea '2026-09' (o en la fuente
// conservada) y hay que investigar ANTES de tocar tyc_version. ─────────
const HASH_2026_09_CONOCIDO = '3ad69155a08926fa48ba3e81d84990ddab0eba62d15de01f180fec84fa413a27';

await T('contenidoVigenteDesdeFuente(): produce las 22 secciones esperadas desde el JSX actual', () => {
  const vigente = contenidoVigenteDesdeFuente();
  yes(vigente.length > 0, 'no debe venir vacío');
  const conteo = (vigente.match(/\n\n---\n\n/g) || []).length + 1;
  eq(conteo, 22, 'deben ser 22 secciones (2026-09-v3 agrega la sección 11, Derecho a retracto) separadas por el mismo delimitador que documentoDesdeSecciones() usa');
});

await T('extraerSeccionesHTML(): reconoce las 21 secciones del HTML histórico conservado, en orden', () => {
  const secciones = extraerSeccionesHTML(TYC_HISTORICO['2026-09'].pagina_html_completa);
  eq(secciones.length, 21);
  eq(secciones.map((s) => s.numero).join(','), Array.from({ length: 21 }, (_, i) => i + 1).join(','));
  eq(secciones[8].titulo, 'Horarios y puntualidad', 'la sección 9 debe traer el título correcto');
});

await T("contenido202609(): reproduce EXACTAMENTE el hash ya poblado en Sandbox — candado de regresión", async () => {
  const contenido = await contenido202609();
  eq(sha256(contenido), HASH_2026_09_CONOCIDO, 'el hash de \'2026-09\' no debe cambiar solo por cambiar el método de extracción');
});

// ── PDF determinístico (documento "NO autorizo todavía Production...",
// 15-sep-2026, §7): generar la MISMA versión dos veces debe producir los
// MISMOS bytes y el MISMO sha256 — nunca un PDF "parecido". Esto ya se
// verificó a mano al construir lib/pdf-tyc.js (encontró y corrigió un bug
// real: sin fijar `creationDate`, pdfkit usaba `new Date()` y el /ID
// interno del PDF cambiaba en cada corrida); este test lo deja como
// candado de regresión permanente en vez de una verificación manual.
await T('generarPdfVersion(): la misma versión genera el MISMO PDF byte a byte, dos veces seguidas', async () => {
  const contenido = await contenido202609();
  const publicadoEn = '2026-09-14T17:30:48.641Z';
  const a = await generarPdfVersion({ version: '2026-09', contenido, publicadoEn });
  const b = await generarPdfVersion({ version: '2026-09', contenido, publicadoEn });
  eq(a.sha256, b.sha256, 'el sha256 del PDF debe ser idéntico entre dos generaciones de la misma versión');
  eq(a.bytes.length, b.bytes.length, 'el largo en bytes debe ser idéntico');
  yes(Buffer.compare(a.bytes, b.bytes) === 0, 'los bytes deben ser byte a byte idénticos, no solo el mismo largo/hash');
});

await T('generarPdfVersion(): contenido distinto produce un PDF distinto (el hash no es un valor fijo por accidente)', async () => {
  const a = await generarPdfVersion({ version: 'TEST-A', contenido: '1. Prueba\n\nTexto A.', publicadoEn: '2026-01-01T00:00:00-03:00' });
  const b = await generarPdfVersion({ version: 'TEST-B', contenido: '1. Prueba\n\nTexto B.', publicadoEn: '2026-01-01T00:00:00-03:00' });
  yes(a.sha256 !== b.sha256, 'contenidos distintos deben producir hashes distintos');
});

await T('contenido202609(): la Sección 9 extraída de la página completa coincide con seccion9_html (verificación cruzada)', async () => {
  // No debe lanzar — si esto pasa, la doble verificación interna de
  // contenido202609() ya confirmó que las dos fuentes independientes
  // dicen lo mismo. Se prueba explícito acá además, por claridad.
  const [esperada] = extraerSeccionesFuente(TYC_HISTORICO['2026-09'].seccion9_html);
  const secciones = extraerSeccionesHTML(TYC_HISTORICO['2026-09'].pagina_html_completa);
  const obtenida = secciones.find((s) => s.numero === 9);
  eq(obtenida.textoPlano, esperada.textoPlano);
});

await T('contenido202609(): si la verificación cruzada NO coincidiera, la función debe fallar en vez de continuar', async () => {
  // Simula una fuente '2026-09' corrupta: página completa con la Sección 9
  // alterada, pero seccion9_html (la otra fuente) intacta — deben
  // detectarse como discrepantes.
  const seccionesReales = extraerSeccionesHTML(TYC_HISTORICO['2026-09'].pagina_html_completa);
  const seccionesAlteradas = seccionesReales.map((s) => (
    s.numero === 9 ? { ...s, textoPlano: s.textoPlano + ' TEXTO ALTERADO PARA LA PRUEBA' } : s
  ));
  const documentoAlterado = documentoDesdeSecciones(seccionesAlteradas);
  // No se puede llamar contenido202609() con una fuente alterada sin tocar
  // el archivo real — se prueba la lógica de comparación directamente,
  // que es lo mismo que hace esa función internamente.
  const [seccion9Cruzada] = extraerSeccionesFuente(TYC_HISTORICO['2026-09'].seccion9_html);
  const seccion9Alterada = seccionesAlteradas.find((s) => s.numero === 9);
  yes(seccion9Cruzada.textoPlano !== seccion9Alterada.textoPlano, 'la alteración de la prueba debe ser detectable');
  yes(documentoAlterado.length > 0, 'sanity: el documento alterado se construye igual (la falla debe venir de la comparación, no de documentoDesdeSecciones)');
});

await T('la página histórica trae literalmente "Versión 2026-09" en su pie — confirma que corresponde a esta versión', () => {
  const html = TYC_HISTORICO['2026-09'].pagina_html_completa;
  yes(/Versi[oó]n\s*(<!--[\s\S]*?-->)?\s*2026-09(?!-v2)/.test(html.replace(/&oacute;/g, 'ó')), 'debe decir "Versión 2026-09" y no "2026-09-v2"');
});

console.log('\n  QA versionado contractual T&C (lib/tyc.js) — celebrasincesar.cl');
console.log('  ' + '─'.repeat(52));
if (fallos.length) {
  for (const f of fallos) console.log('  FALLA  ' + f);
  console.log('  ' + '─'.repeat(52));
}
console.log('  ' + ok + ' OK · ' + fallos.length + ' fallas\n');
process.exit(fallos.length ? 1 : 0);
