// ══════════════════════════════════════════════════════════════════════
// QA DE INVARIANTES DE UI DEL CHECKOUT  ·  node scripts/qa-checkout-ux.mjs
// ──────────────────────────────────────────────────────────────────────
// Análisis estático (grep sobre el código fuente, sin levantar navegador)
// para candados de UI que un cambio futuro podría romper sin que ningún
// otro QA lo note — porque son de forma, no de lógica de negocio.
//
// Primer candado (documento "NO autorizo todavía Production...",
// 15-sep-2026, §3): debe existir EXACTAMENTE UN checkbox de tipo
// `type="checkbox"` en todo el árbol de /armar — la aceptación
// contractual real, en <ConfirmarReserva>. El checkbox cosmético de
// <ModalPago> (que nunca llegaba al servidor) se eliminó a propósito;
// este test evita que alguien lo reintroduzca sin darse cuenta, o que se
// agregue un segundo checkbox de T&C en cualquier otro punto del flujo.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_ARMAR = path.join(RAIZ, 'app', 'armar');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => {
  try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

function archivosJS(dir) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...archivosJS(ruta));
    else if (entrada.name.endsWith('.js')) salida.push(ruta);
  }
  return salida;
}

const archivos = archivosJS(DIR_ARMAR);

T('existe exactamente UN checkbox (type="checkbox") en todo /armar — la aceptación contractual real', () => {
  let total = 0;
  const encontrados = [];
  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    const m = contenido.match(/type=["']checkbox["']/g);
    if (m) {
      total += m.length;
      encontrados.push(`${path.relative(RAIZ, archivo)} (${m.length})`);
    }
  }
  eq(total, 1, `checkboxes encontrados: ${JSON.stringify(encontrados)}`);
});

T('el checkbox contractual vive en confirmar-reserva.js, no en pago-checkout.js (ModalPago)', () => {
  const modal = fs.readFileSync(path.join(DIR_ARMAR, 'pago-checkout.js'), 'utf8');
  const confirmar = fs.readFileSync(path.join(DIR_ARMAR, 'confirmar-reserva.js'), 'utf8');
  yes(!/type=["']checkbox["']/.test(modal), 'pago-checkout.js (ModalPago) no debe tener checkbox — es cosmético/duplicado si aparece');
  yes(/type=["']checkbox["']/.test(confirmar), 'confirmar-reserva.js debe seguir teniendo el checkbox real');
});

T('el checkbox contractual está desmarcado por defecto (useState(false))', () => {
  const confirmar = fs.readFileSync(path.join(DIR_ARMAR, 'confirmar-reserva.js'), 'utf8');
  yes(/aceptaTyc.*=.*useState\(false\)/.test(confirmar), 'aceptaTyc debe iniciar en false');
});

T('el checkbox contractual menciona expresamente la exclusión del derecho a retracto', () => {
  const confirmar = fs.readFileSync(path.join(DIR_ARMAR, 'confirmar-reserva.js'), 'utf8');
  yes(confirmar.includes('exclusión del derecho a retracto'), 'debe mencionar la exclusión de retracto en el texto del checkbox');
});

T('el checkbox contractual enlaza a Términos y Condiciones y a Política de Privacidad', () => {
  const confirmar = fs.readFileSync(path.join(DIR_ARMAR, 'confirmar-reserva.js'), 'utf8');
  yes(confirmar.includes('href="/terminos"'), 'debe enlazar a /terminos');
  yes(confirmar.includes('href="/privacidad"'), 'debe enlazar a /privacidad');
});

T('el botón de pago queda disabled cuando aceptaTyc es false', () => {
  const confirmar = fs.readFileSync(path.join(DIR_ARMAR, 'confirmar-reserva.js'), 'utf8');
  yes(/disabled=\{[^}]*!aceptaTyc[^}]*\}/.test(confirmar), 'el botón de pago debe depender de aceptaTyc');
});

console.log('\n  QA UX del checkout (candados estáticos) — celebrasincesar.cl');
console.log('  ' + '─'.repeat(52));
if (fallos.length) {
  for (const f of fallos) console.log('  FALLA  ' + f);
  console.log('  ' + '─'.repeat(52));
}
console.log('  ' + ok + ' OK · ' + fallos.length + ' fallas\n');
process.exit(fallos.length ? 1 : 0);
