// ══════════════════════════════════════════════════════════════════════
// generate-images.mjs
// Lee /public/fotos/ y genera data/imagenes.js automáticamente.
// Se ejecuta antes de cada build (ver package.json → "prebuild").
//
// CÓMO AGREGAR FOTOS:
//   Carrusel → suelta el archivo en  /public/fotos/[categoria]/
//   Vitrina  → suelta el archivo en  /public/fotos/vitrina/[categoria].webp
//
// NO toques este script ni data/imagenes.js — se autogeneran solos.
// ══════════════════════════════════════════════════════════════════════

import { readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root    = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fotosDir = path.join(root, 'public', 'fotos');

const carrusel = {};
const vitrina  = {};

if (existsSync(fotosDir)) {
  for (const entry of readdirSync(fotosDir)) {
    const entryPath = path.join(fotosDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    if (entry === 'vitrina') {
      // Una imagen por categoría: nombre-del-archivo = nombre de la categoría
      for (const file of readdirSync(entryPath)) {
        if (!/\.(webp|jpg|jpeg|png)$/i.test(file)) continue;
        const key = path.parse(file).name;           // 'animacion' de 'animacion.webp'
        vitrina[key] = `/fotos/vitrina/${file}`;
      }
    } else {
      // Todas las fotos de esta carpeta van al carrusel de esa categoría
      const fotos = readdirSync(entryPath)
        .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f))
        .sort()
        .map(f => `/fotos/${entry}/${f}`);
      if (fotos.length > 0) carrusel[entry] = fotos;
    }
  }
}

const out = `// AUTO-GENERADO por scripts/generate-images.mjs — no editar manualmente.
// Para agregar fotos al carrusel: /public/fotos/[categoria]/foto.webp
// Para la imagen de vitrina:      /public/fotos/vitrina/[categoria].webp
// Se regenera en cada deploy (npm run build).

export const CARRUSEL = ${JSON.stringify(carrusel, null, 2)};

export const VITRINA = ${JSON.stringify(vitrina, null, 2)};
`;

writeFileSync(path.join(root, 'data', 'imagenes.js'), out, 'utf8');

const resumen = Object.entries(carrusel).map(([k, v]) => `  ${k}: ${v.length} foto${v.length !== 1 ? 's' : ''}`).join('\n');
console.log(`\n✅ data/imagenes.js generado`);
console.log(`   Vitrina:  ${Object.keys(vitrina).length} imágenes`);
console.log(`   Carrusel:\n${resumen || '  (ninguna aún)'}\n`);
