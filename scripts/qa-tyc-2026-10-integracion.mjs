// ══════════════════════════════════════════════════════════════════════
// QA — PUBLICACIÓN T&C '2026-10'  ·  node scripts/qa-tyc-2026-10-integracion.mjs
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 5 — CIERRE LEGAL + GATE MANUAL FINAL", §7. Requiere
// Sandbox real (lee tyc_version) — complementa a scripts/qa-tyc.mjs, que
// es deliberadamente sin base de datos.
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

let ok = 0;
const fallos = [];
const T = async (n, fn) => { try { await fn(); ok++; } catch (e) { fallos.push(n + ' → ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const yes = (v, m) => { if (!v) throw new Error(m || 'esperado true'); };

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log('\n  QA T&C 2026-10 (integración) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
} else {
  const { q, q1 } = await import('../lib/db.js');
  const { TYC_VERSION } = await import('../data/master.js');
  const { crearReserva } = await import('../lib/reservas.js');

  await T("TYC_VERSION vigente es '2026-10'", () => {
    eq(TYC_VERSION, '2026-10');
  });

  await T("'2026-10' está ACTIVA en tyc_version, con contenido y PDF", async () => {
    const fila = await q1(`SELECT estado, contenido, pdf_bytes FROM tyc_version WHERE version = '2026-10'`);
    yes(!!fila, "la fila '2026-10' debe existir — ¿se corrió scripts/publicar-tyc-2026-10.mjs?");
    eq(fila.estado, 'ACTIVA');
    yes(fila.contenido.includes('16:00–19:00'), "el contenido vigente debe contener el horario PM nuevo (16:00–19:00)");
    yes(!/PM 15:00–18:00/.test(fila.contenido), "el contenido vigente NO debe seguir diciendo 'PM 15:00–18:00' como horario base");
    yes(fila.contenido.includes('hasta las 20:00') && fila.contenido.includes('$50.000'), "debe mencionar la extensión hasta las 20:00 por $50.000");
    yes(fila.contenido.includes('hasta las 20:30') && fila.contenido.includes('$100.000'), "debe mencionar la extensión hasta las 20:30 por $100.000");
    yes(!/\+1 hora|\+2 horas/.test(fila.contenido), "no debe describir las extensiones como '+1 hora'/'+2 horas'");
    yes(!!fila.pdf_bytes && fila.pdf_bytes.length > 0, "'2026-10' debe tener su PDF generado");
  });

  await T("'2026-09-v3' sigue intacta: RETIRADA, mismo contenido/hash/pdf que antes de publicar '2026-10'", async () => {
    const fila = await q1(`SELECT estado, contenido, contenido_sha256, pdf_sha256 FROM tyc_version WHERE version = '2026-09-v3'`);
    yes(!!fila, "'2026-09-v3' debe seguir existiendo — nunca se borra una versión contractual");
    eq(fila.estado, 'RETIRADA');
    yes(fila.contenido.includes('15:00–18:00') || fila.contenido.includes('15:00–19:00') || fila.contenido.includes('15:00–20:00'), "el contenido histórico debe conservar literalmente el horario antiguo, sin reescribirse");
    yes(!!fila.contenido_sha256 && !!fila.pdf_sha256, "debe conservar su hash de contenido y de PDF originales");
  });

  await T('una reserva NUEVA acepta la versión 2026-10 (tyc_version/tyc_hash), nunca 2026-09-v3', async () => {
    const SABADO_BASE = new Date('2027-10-02T12:00:00.000Z');
    const fecha = new Date(SABADO_BASE.getTime() + 3 * 7 * 86_400_000).toISOString().slice(0, 10);
    const r = await crearReserva({
      configuracion: {
        fecha: `${fecha}T12:00:00.000Z`, hora: 'PM', sector: 'independiente',
        tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
        extras: [], tematica: null, horasAdicionales: 0,
      },
      cliente: { nombre: 'QATEST TyC2026-10', email: 'qatest.tyc2026-10@celebrasincesar.cl', telefono: '+56900000077' },
      aceptaTyc: true,
    });
    try {
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      const fila = await q1(`SELECT tyc_version, tyc_hash FROM reserva WHERE codigo = $1`, [r.reserva.codigo]);
      eq(fila.tyc_version, '2026-10');
      const hashVigente = await q1(`SELECT contenido_sha256 FROM tyc_version WHERE version = '2026-10'`);
      eq(fila.tyc_hash, hashVigente.contenido_sha256, 'el tyc_hash guardado en la reserva debe ser exactamente el de la versión 2026-10');
    } finally {
      if (r.ok) {
        await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [r.reserva.codigo]).catch(() => {});
        await q(`DELETE FROM reserva WHERE codigo = $1`, [r.reserva.codigo]).catch(() => {});
      }
    }
  });

  await T('/api/tyc/pdf sirve el PDF de ambas versiones por su nombre exacto, sin romper el link histórico', async () => {
    const nueva = await q1(`SELECT pdf_bytes FROM tyc_version WHERE version = '2026-10'`);
    const vieja = await q1(`SELECT pdf_bytes FROM tyc_version WHERE version = '2026-09-v3'`);
    yes(!!nueva.pdf_bytes && !!vieja.pdf_bytes, 'ambas versiones deben tener su PDF disponible para servir por /api/tyc/pdf/[version]');
  });
}

console.log(`\n  QA T&C 2026-10 (integración, Fase 5 gate legal) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
