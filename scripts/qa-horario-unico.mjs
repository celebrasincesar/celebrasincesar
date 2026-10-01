// ══════════════════════════════════════════════════════════════════════
// QA — FASE 5 BLOQUE 1: HORARIO ÚNICO Y SIMPLE  ·  node scripts/qa-horario-unico.mjs
// ──────────────────────────────────────────────────────────────────────
// Las reglas del horario nuevo (PM unificado 16:00–19:00, extensiones no
// lineales) ya están cubiertas en scripts/qa-reglas.mjs. Este archivo
// cubre lo que esa suite no puede: que una reserva YA EXISTENTE con su
// horario antiguo (ej. sábado/domingo 15:00–18:00) nunca se toca ni se
// reinterpreta cuando se cambia la plantilla, ni siquiera al aplicar un
// cambio comercial sobre ella.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let ok = 0;
const fallos = [];
const T = async (n, fn) => { try { await fn(); ok++; } catch (e) { fallos.push(n + ' → ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const yes = (v, m) => { if (!v) throw new Error(m || 'esperado true'); };

// ── A. ESTÁTICO ───────────────────────────────────────────────────────
await T('aplicarCambioComercial() nunca escribe hora_inicio/hora_termino — solo total/snapshot_vigente', () => {
  const f = leer('lib/cambio-comercial.js');
  const bloque = f.slice(f.indexOf('UPDATE reserva'), f.indexOf('RETURNING id, total, snapshot_vigente') + 40);
  yes(!/hora_inicio|hora_termino/.test(bloque), 'un cambio comercial jamás debe recalcular el horario de una reserva ya creada');
});

await T('disponibilidad sigue bloqueando por (fecha, turno) — nunca por rango de horas específico', () => {
  // Confirma que el modelo de cupos sigue siendo grueso (AM/PM por fecha):
  // así una reserva histórica 15:00–18:00 y una plantilla nueva 16:00–19:00
  // son ambas simplemente "PM" ese día — se excluyen entre sí sin que haga
  // falta ningún cálculo de solape de minutos.
  const f = leer('app/api/disponibilidad/route.js');
  yes(f.includes("f.turno === 'AM' ? blockedAM : f.turno === 'PM' ? blockedPM"), 'el agrupamiento debe seguir siendo por turno, no por hora exacta');
});

await T('data/master.js documenta que esta tabla no migra reservas existentes', () => {
  yes(leer('data/master.js').includes('esta tabla NO modifica ni reinterpreta ninguna reserva ya existente') || leer('data/master.js').includes('esta tabla define\n  // el horario para reservas NUEVAS'));
});

// ── B. INTEGRACIÓN (Sandbox real) ────────────────────────────────────
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
  console.log('\n  QA horario único (integración) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
} else {
  const { q } = await import('../lib/db.js');
  const { crearReserva, reservaPorCodigo } = await import('../lib/reservas.js');
  const { aplicarCambioComercial } = await import('../lib/cambio-comercial.js');

  const SABADO_BASE = new Date('2027-09-04T12:00:00.000Z');
  let n = 0;
  const fecha = () => { const d = new Date(SABADO_BASE.getTime() + (n++) * 7 * 86_400_000); return d.toISOString().slice(0, 10); };
  const CLIENTE = { nombre: 'QATEST HorarioUnico', email: 'qatest.horario@celebrasincesar.cl', telefono: '+56900000066' };
  const codigos = [];
  async function limpiar() {
    for (const c of codigos) {
      await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [c]).catch(() => {});
      await q(`DELETE FROM cambio_comercial WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM pendiente_proveedor WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM reserva WHERE codigo = $1`, [c]).catch(() => {});
    }
  }

  try {
    await T('reservas existentes preservadas: una reserva "histórica" (15:00–18:00 simulado) no cambia aunque se le aplique un cambio comercial después de que la plantilla ya diga 16:00–19:00', async () => {
      const r = await crearReserva({
        configuracion: {
          fecha: `${fecha()}T12:00:00.000Z`, hora: 'PM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      codigos.push(r.reserva.codigo);

      // Simula que esta reserva es de ANTES del Bloque 1 (PM 15:00–18:00),
      // tal como quedaría escrita de verdad una reserva histórica real.
      await q(`UPDATE reserva SET hora_inicio = '15:00', hora_termino = '18:00', estado = 'CONFIRMED' WHERE id = $1`, [r.reserva.id]);

      let actual = await reservaPorCodigo(r.reserva.codigo);
      eq(actual.hora_inicio, '15:00');
      eq(actual.hora_termino, '18:00');

      // Un cambio comercial (agregar un adicional) corre con la plantilla
      // NUEVA vigente (PM 16:00–19:00) — pero nunca debe tocar las horas ya
      // escritas de esta reserva.
      const cambio = await aplicarCambioComercial({
        reservaId: r.reserva.id,
        configuracionPropuesta: { extras: [{ id: 'tobogan-premium', nombre: 'Tobogán Premium', precios: { hasta10: 70000, hasta20: 70000, hasta30: 70000, mas30: 70000 } }] },
        motivo: 'qa_horario_unico',
      });
      yes(cambio.ok, JSON.stringify(cambio));

      actual = await reservaPorCodigo(r.reserva.codigo);
      eq(actual.hora_inicio, '15:00', 'el horario histórico NO debe migrar al nuevo template');
      eq(actual.hora_termino, '18:00', 'el horario histórico NO debe migrar al nuevo template');
    });

    await T('una reserva NUEVA sí recibe el horario unificado 16:00–19:00 como PM base', async () => {
      const r = await crearReserva({
        configuracion: {
          fecha: `${fecha()}T12:00:00.000Z`, hora: 'PM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      codigos.push(r.reserva.codigo);
      eq(r.reserva.hora_inicio, '16:00');
      eq(r.reserva.hora_termino, '19:00');
    });

  } finally {
    await limpiar().catch((e) => console.error('limpieza falló:', e.message));
  }
}

console.log(`\n  QA horario único (Fase 5 Bloque 1) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
