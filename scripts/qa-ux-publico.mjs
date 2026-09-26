// ══════════════════════════════════════════════════════════════════════
// QA UX PÚBLICA — PURO  ·  node scripts/qa-ux-publico.mjs
// Fase 4A (25-sep-2026): consistencia comercial, contacto único, reseñas,
// privacidad con Visitas y rutas privadas no indexables.
// ══════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const { NEGOCIO, MARCA } = await import('../data/master.js');
const { STATS, RESEÑAS_LABEL } = await import('../data/stats.js');
const { FAQS } = await import('../data/faqs.js');

let ok = 0; const fallos = [];
const T = (n, fn) => { try { fn(); ok++; } catch (e) { fallos.push(n + ' → ' + e.message); } };
const yes = (v, m) => { if (!v) throw new Error(m || 'esperado true'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) archivos(rel, out);
    else if (/\.js$/.test(e.name)) out.push(rel);
  }
  return out;
}
const PUBLICOS = [...archivos('app'), ...archivos('data')].filter((f) => !f.startsWith('app/cadena') && !f.startsWith('app/api'));

T('Viernes nunca tiene bloque AM', () => {
  eq(NEGOCIO.turnosViernes.some((t) => Number(String(t.desde || '').slice(0, 2)) < 12), false);
  for (const f of PUBLICOS) yes(!/AM y PM disponible/.test(leer(f)), f);
});
T('Máximo de niños = 40 y ninguna copia pública dice "hasta 30 niños"', () => {
  const tramos = leer('data/master.js');
  yes(/max|40/.test(tramos));
  for (const f of PUBLICOS) yes(!/hasta 30 niños/i.test(leer(f).replace(/\/\/.*$/gm, '')), f);
});
T('Anticipo = 50% y /alce-kids habla del 50% del valor total', () => {
  eq(NEGOCIO.anticipoPorcentaje, 50);
  yes(leer('app/celebra-ui.js').includes('50% del valor total'));
});
T('Contacto corporativo único: sin gmail en la web pública', () => {
  eq(NEGOCIO.email, 'administracion@celebrasincesar.cl');
  for (const f of PUBLICOS) yes(!/@gmail\.com/.test(leer(f)), f);
});
T('Etiqueta de reputación centralizada: 45+ y sin "verificadas"', () => {
  eq(RESEÑAS_LABEL, '45+ reseñas en Google');
  eq(MARCA.google_reviews, String(STATS.reseñas));
  for (const f of PUBLICOS) yes(!/rese(ñ|n)as verificadas|Reseña verificada/.test(leer(f)), f);
});
T('Sin promesa "respuesta rápida garantizada"', () => {
  for (const f of PUBLICOS) yes(!/respuesta r[aá]pida garantizada/i.test(leer(f)), f);
});
T('Sin "coordinamos los detalles por WhatsApp" (el flujo real es Mi Celebración)', () => {
  for (const f of PUBLICOS) yes(!/coordinamos (los )?detalles (directo )?(con César )?por WhatsApp/i.test(leer(f)), f);
  yes(FAQS.some((x) => /Mi Celebración/.test(x.a)));
});
T('FAQ de pago no promete cuotas sin interés', () => {
  const p = FAQS.find((x) => /pagar/i.test(x.q));
  yes(p, 'falta FAQ de pago');
  yes(!/sin inter[eé]s/i.test(p.a));
});
T('Postevento: enlace de reseña es el oficial /review', () => {
  yes(NEGOCIO.postevento.googleReviewUrl.endsWith('/review'));
});
T('Privacidad menciona Visitas y sube de versión', () => {
  const p = leer('app/privacidad/page.js');
  yes(/visita/i.test(p));
  yes(!/PRIVACIDAD_VERSION = '2026-09';/.test(p));
});
T('Rutas privadas por token llevan noindex', () => {
  for (const rel of ['app/mi-celebracion/layout.js', 'app/pago/resultado/layout.js', 'app/visitas/gestionar/page.js']) {
    yes(/index:\s*false/.test(leer(rel)), rel);
  }
  yes(/'\/cadena'/.test(leer('app/robots.js')));
});
T('Sitemap incluye /visitas y no incluye rutas privadas', () => {
  const s = leer('app/sitemap.js');
  yes(s.includes("'/visitas'"));
  for (const p of ["'/mi-celebracion", "'/cadena", "'/pago", "'/confirmacion"]) yes(!s.includes(`url(${p}`), p);
});
T('Home: lockup Alce Kids y "Próximamente" después de Cómo funciona', () => {
  const ui = leer('app/celebra-ui.js');
  yes(ui.indexOf('<ComoFuncionaCTA />') < ui.indexOf('titulo="Alce Arena"'));
  yes(ui.includes('Ver disponibilidad y precio · sin compromiso'));
  yes(leer('app/layout.js').includes("default: 'Alce Kids"));
});

T('Gate 4A: "Recinto Completo" único, temática visible en resumen/WhatsApp y enlaces WhatsApp solo-icono con nombre accesible', () => {
  for (const f of PUBLICOS) yes(!/Jardín Completo/.test(leer(f)), f);
  const w = leer('app/armar/wizard.js');
  yes(w.includes("['Temática', estado.tematica.trim()]") && w.includes('tematicaLinea'));
  yes(leer('app/catalogo/catalogo-cliente.js').includes('aria-label="Consultar por WhatsApp"'));
  yes(leer('app/celebra-ui.js').includes('aria-label="Escribir por WhatsApp"'));
});

T('Performance /armar: ilustraciones livianas (webp ≤120 KB) y con dimensiones; sin los PNG de >1 MB', () => {
  const w = leer('app/armar/wizard.js');
  for (const n of ['elige-tu-fecha', 'elige-tu-horario', 'buena-eleccion']) {
    yes(!w.includes(`/${n}.png`), `${n}.png sigue referenciado`);
    yes(w.includes(`/${n}.webp`), `${n}.webp no referenciado`);
    yes(fs.statSync(path.join(RAIZ, `public/${n}.webp`)).size <= 120 * 1024, `${n}.webp pesa demasiado`);
  }
});

console.log(`\n  QA UX pública — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  process.exit(1);
} else console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
