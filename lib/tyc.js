// ═════════════════════════════════════════════════════════════════════════
// VERSIONADO CONTRACTUAL DE T&C — Fase 1B (documento "Instrucción Maestra —
// Continuación", 14-sep-2026, §9-11)
// ─────────────────────────────────────────────────────────────────────────
// El "contenido íntegro" de una versión de T&C se extrae de forma
// DETERMINÍSTICA desde el JSX fuente de app/terminos/page.js — nunca a
// mano, nunca desde lo que renderizó un navegador (que puede variar en
// espacios en blanco entre ejecuciones). Mismo archivo fuente → mismo
// texto → mismo hash, siempre.
//
// Esto es lo que permite reconstruir con certeza la versión '2026-09'
// (recuperable): son las mismas 21 secciones que la versión vigente,
// salvo la Sección 9, que se reemplaza por su texto histórico exacto ya
// conservado en data/tyc-historico.js. Nunca se inventa ni se aproxima.
// ═════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_TERMINOS = path.join(RAIZ, 'app', 'terminos', 'page.js');

// Convierte un bloque JSX (el interior de un <Section>) a texto plano
// determinístico: cada <p> es un párrafo, cada <li> es un ítem con "- ",
// <strong> se aplana (el énfasis no forma parte del contenido para hash —
// el texto legal es el texto, no su tipografía), {' '} se vuelve espacio.
function jsxATexto(bloqueJsx) {
  const piezas = [];
  const regexPArrafoOItem = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = regexPArrafoOItem.exec(bloqueJsx))) {
    const [, tag, interior] = m;
    const MARCA_SALTO = '';
    let texto = interior
      .replace(/\{' '\}/g, ' ')
      .replace(/<br\s*\/?>/g, MARCA_SALTO)
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ') // colapsa saltos de línea de FORMATO del código fuente, no los <br/> reales (ya marcados)
      .split(MARCA_SALTO)
      .map((linea) => linea.trim())
      .filter(Boolean)
      .join('\n');
    if (!texto) continue;
    piezas.push(tag === 'li' ? `- ${texto}` : texto);
  }
  return piezas.join('\n');
}

// Extrae { numero, titulo, textoPlano } de cada <Section> del archivo, en
// el orden en que aparecen — ese orden es parte del contenido íntegro.
export function extraerSeccionesFuente(fuenteJsx) {
  const secciones = [];
  const regexSection = /<Section\s+num="(\d+)"\s+titulo="([^"]+)">([\s\S]*?)<\/Section>/g;
  let m;
  while ((m = regexSection.exec(fuenteJsx))) {
    const [, num, titulo, cuerpo] = m;
    secciones.push({ numero: Number(num), titulo, textoPlano: jsxATexto(cuerpo) });
  }
  return secciones;
}

// ── Mismo extractor, pero sobre HTML YA RENDERIDO (no JSX fuente) ──────
// Necesario para reconstruir una versión histórica de la que solo
// conservamos la página tal como la sirvió un deployment real, nunca su
// código fuente (documento "No autorizo todavía el deploy...", 15-sep-2026,
// §6). El marcado que produce Next.js para cada <Section> del componente es
// estable y determinístico: `<section class="mb-8"><h2 ...><span
// ...>NUM</span>TITULO</h2><div ...>CUERPO</div></section>` — mismo
// documento fuente, mismo HTML renderizado, siempre.
function textoDesdeInteriorHTML(interior) {
  const MARCA_SALTO = '';
  return interior
    // React deja comentarios <!-- --> como frontera de texto dinámico
    // (equivalente renderizado de un {' '} en el JSX) — se retiran antes de
    // tocar nada más para no dejar basura pegada a una palabra.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/g, MARCA_SALTO)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ').replace(/&aacute;/g, 'á')
    .replace(/\s+/g, ' ')
    .split(MARCA_SALTO)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .join('\n');
}

function jsxATextoHTML(bloqueHtml) {
  const piezas = [];
  const regexPArrafoOItem = /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = regexPArrafoOItem.exec(bloqueHtml))) {
    const [, tag, interior] = m;
    const texto = textoDesdeInteriorHTML(interior);
    if (!texto) continue;
    piezas.push(tag === 'li' ? `- ${texto}` : texto);
  }
  return piezas.join('\n');
}

export function extraerSeccionesHTML(html) {
  const secciones = [];
  const regexSection = /<section class="mb-8"><h2[^>]*><span[^>]*>(\d+)<\/span>([^<]+)<\/h2><div[^>]*>([\s\S]*?)<\/div><\/section>/g;
  let m;
  while ((m = regexSection.exec(html))) {
    const [, num, titulo, cuerpo] = m;
    secciones.push({ numero: Number(num), titulo: titulo.trim(), textoPlano: jsxATextoHTML(cuerpo) });
  }
  return secciones;
}

// Arma el documento íntegro (todas las secciones, en orden, tituladas) a
// partir del archivo fuente ACTUAL de app/terminos/page.js — esta es
// siempre la versión VIGENTE, nunca una histórica.
export function contenidoVigenteDesdeFuente() {
  const fuente = fs.readFileSync(RUTA_TERMINOS, 'utf8');
  const secciones = extraerSeccionesFuente(fuente);
  if (secciones.length === 0) {
    throw new Error('extraerSeccionesFuente() no encontró ninguna <Section> en app/terminos/page.js — ¿cambió el marcado?');
  }
  return documentoDesdeSecciones(secciones);
}

// Reconstruye el contenido de una versión histórica sustituyendo UNA
// sección por su texto ya conservado — nunca reconstruye una sección de
// la que no tengamos evidencia real (eso lo decide quien llama, pasando
// solo secciones con evidencia).
export function documentoDesdeSecciones(secciones) {
  return secciones
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((s) => `${s.numero}. ${s.titulo}\n\n${s.textoPlano}`)
    .join('\n\n---\n\n');
}

export function sha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

// Reconstruye el contenido íntegro de la versión '2026-09' (recuperable
// con certeza) desde la fuente PRIMARIA: el HTML completo que un
// deployment histórico real de Vercel sirvió para /terminos, conservado
// literal en data/tyc-historico.js (documento "No autorizo todavía el
// deploy...", 15-sep-2026, §6). Ya NO se reconstruye sustituyendo la
// Sección 9 sobre el JSX vigente — eso dependía de que ninguna otra
// cláusula hubiera cambiado, un supuesto que ahora no hace falta asumir
// porque existe la página real completa.
//
// Como defensa en profundidad, se exige que el texto de la Sección 9
// extraído de la página completa coincida EXACTAMENTE con el texto de
// seccion9_html (la otra copia literal, conservada independientemente
// antes del reemplazo) — dos fuentes separadas que deben decir lo mismo.
// Si no coinciden, o si la página no tiene las 21 secciones esperadas,
// esto falla en vez de continuar con un documento dudoso.
export async function contenido202609() {
  const { TYC_HISTORICO } = await import(pathToFileURL(path.join(RAIZ, 'data', 'tyc-historico.js')).href);
  const historico = TYC_HISTORICO['2026-09'];
  if (!historico?.pagina_html_completa) {
    throw new Error("No hay página histórica completa conservada para '2026-09' en data/tyc-historico.js — no se puede reconstruir sin evidencia.");
  }

  const secciones = extraerSeccionesHTML(historico.pagina_html_completa);
  if (secciones.length !== 21) {
    throw new Error(`La página histórica '2026-09' produjo ${secciones.length} secciones, se esperaban 21 — revisar el extractor o la fuente.`);
  }

  if (historico.seccion9_html) {
    const [seccion9Cruzada] = extraerSeccionesFuente(historico.seccion9_html);
    const seccion9DesdePagina = secciones.find((s) => s.numero === 9);
    if (!seccion9Cruzada || seccion9Cruzada.textoPlano !== seccion9DesdePagina?.textoPlano) {
      throw new Error("La Sección 9 extraída de pagina_html_completa no coincide con seccion9_html — las dos fuentes independientes deben decir lo mismo.");
    }
  }

  return documentoDesdeSecciones(secciones);
}
