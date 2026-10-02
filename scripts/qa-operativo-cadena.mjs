// ══════════════════════════════════════════════════════════════════════
// QA — 3 HUECOS OPERATIVOS DE /CADENA  ·  node scripts/qa-operativo-cadena.mjs
// ──────────────────────────────────────────────────────────────────────
// Hallazgos reales de César (30-sep-2026), cada uno con su fix:
//   1. Una visita nueva nunca le avisaba a él (solo al papá + Calendar).
//   2. La Invitación Digital no tenía ningún seguimiento — si un papá la
//      pedía, no quedaba rastro en ningún lado.
//   3. No podía agregar/quitar adicionales de una reserva ya confirmada
//      desde /cadena cuando el papá se lo pedía por teléfono.
//
// Sección A: estática (sin base de datos) — confirma que el código real
// tiene el wiring esperado, no una intención sin conectar.
// Sección B: integración (Sandbox real) — se salta si no hay
// POSTGRES_URL/DATABASE_URL, mismo criterio que el resto del proyecto.
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
const T = async (nombre, fn) => { try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => { if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// ── A. ESTÁTICO ─────────────────────────────────────────────────────────

await T('Visita nueva: lib/visitas.js exporta notificarVisitaAdmin y app/api/visitas la llama', () => {
  yes(leer('lib/visitas.js').includes('export async function notificarVisitaAdmin'));
  const ruta = leer('app/api/visitas/route.js');
  yes(ruta.includes('notificarVisitaAdmin'), 'la ruta debe importarla');
  yes(/await notificarVisitaAdmin\(visita\)/.test(ruta), 'la ruta debe llamarla tras crear la visita');
});

await T('Invitación Digital: columna de seguimiento migrada y funciones exportadas', () => {
  yes(leer('lib/db.js').includes("ALTER TABLE reserva ADD COLUMN IF NOT EXISTS invitacion_enviada_en TIMESTAMPTZ"));
  const reservas = leer('lib/reservas.js');
  yes(reservas.includes('export async function invitacionesPendientes'));
  yes(reservas.includes('export async function marcarInvitacionEnviada'));
  yes(reservas.includes("tematica: config?.tematica || null"), 'detalleDeReserva debe exponer la temática vigente');
});

await T('Invitación Digital: ruta admin existe, y /api/cadena/reservas expone necesitaInvitacion', () => {
  yes(leer('app/api/cadena/invitacion-enviada/route.js').includes('marcarInvitacionEnviada'));
  const ruta = leer('app/api/cadena/reservas/route.js');
  yes(ruta.includes('necesitaInvitacion'));
  yes(ruta.includes('invitacion-digital'));
});

await T('Invitación Digital: /cadena tiene la sección y la tarjeta con "Marcar enviada"', () => {
  const panel = leer('app/cadena/reservas-pagos.js');
  yes(panel.includes('Invitaciones digitales pendientes'));
  yes(panel.includes('function FilaInvitacionPendiente'));
  yes(panel.includes('/api/cadena/invitacion-enviada'));
});

await T('Editar adicionales: la ruta admin reutiliza aplicarCambioComercial (no un segundo motor)', () => {
  const ruta = leer('app/api/cadena/cambio-comercial/route.js');
  yes(ruta.includes("from '../../../../lib/cambio-comercial'"));
  yes(ruta.includes('aplicarCambioComercial'));
  yes(ruta.includes('itemVisible'), 'debe validar compatibilidad con la misma regla que Mi Celebración');
});

await T('Editar adicionales: una reserva manual usa su propio camino ADITIVO — nunca recalcula con el motor de precios', () => {
  const ruta = leer('app/api/cadena/cambio-comercial/route.js');
  yes(ruta.includes('aplicarCambioComercialManual'));
  yes(ruta.includes('esManual'));
  const motor = leer('lib/cambio-comercial.js');
  const bloque = motor.slice(motor.indexOf('export async function aplicarCambioComercialManual'), motor.indexOf('export async function historicoComercial'));
  yes(!/recalcular\(/.test(bloque), 'el camino manual jamás debe llamar a recalcular() — pisaría el total negociado');
  yes(bloque.includes('totalBase'));
});

await T('Editar adicionales: /cadena tiene el editor con agregar/quitar por ítem', () => {
  const panel = leer('app/cadena/reservas-pagos.js');
  yes(panel.includes('function EditorAdicionales'));
  yes(panel.includes('/api/cadena/cambio-comercial'));
});

// ── B. INTEGRACIÓN (Sandbox real) ────────────────────────────────────────

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
  console.log('\n  QA operativo /cadena (integración) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
} else {
  const { q } = await import('../lib/db.js');
  const { crearReserva, reservaPorCodigo, invitacionesPendientes, marcarInvitacionEnviada } = await import('../lib/reservas.js');
  const { configuracionVigente } = await import('../lib/reservas.js');
  const { crearReservaManual } = await import('../lib/reservas.js');

  const SABADO_BASE = new Date('2027-07-03T12:00:00.000Z');
  let contadorFechas = 0;
  const fechaPruebaSiguiente = () => {
    const d = new Date(SABADO_BASE.getTime() + contadorFechas * 7 * 86_400_000);
    contadorFechas++;
    return d.toISOString().slice(0, 10);
  };
  const CLIENTE = { nombre: 'QATEST Operativo', email: 'qatest.operativo@celebrasincesar.cl', telefono: '+56900000099' };

  const filasCreadas = [];
  async function limpiar() {
    for (const codigo of filasCreadas) {
      await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [codigo]).catch(() => {});
      await q(`DELETE FROM reserva WHERE codigo = $1`, [codigo]).catch(() => {});
    }
  }

  const ITEM_INVITACION = { id: 'invitacion-digital', nombre: 'Invitación Digital', emoji: '💌', gratis: true, precios: { hasta10: 0, hasta20: 0, hasta30: 0, mas30: 0 } };

  try {
    await T('invitacionesPendientes(): una reserva firme con invitación incluida aparece, y desaparece tras marcarla enviada (idempotente)', async () => {
      const r = await crearReserva({
        configuracion: {
          fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [ITEM_INVITACION], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
      filasCreadas.push(r.reserva.codigo);

      // Todavía no es firme (PENDING_PAYMENT recién creada): no debe aparecer.
      let pendientes = await invitacionesPendientes();
      yes(!pendientes.some((p) => p.codigo === r.reserva.codigo), 'no debe aparecer antes de ser firme');

      await q(`UPDATE reserva SET estado = 'CONFIRMED' WHERE id = $1`, [r.reserva.id]);

      pendientes = await invitacionesPendientes();
      yes(pendientes.some((p) => p.codigo === r.reserva.codigo), 'debe aparecer ya confirmada, con la invitación incluida');

      const marcada = await marcarInvitacionEnviada({ reservaId: r.reserva.id });
      yes(marcada.ok);

      pendientes = await invitacionesPendientes();
      yes(!pendientes.some((p) => p.codigo === r.reserva.codigo), 'debe desaparecer apenas se marca enviada');

      const segundaVez = await marcarInvitacionEnviada({ reservaId: r.reserva.id });
      eq(segundaVez.ok, false, 'no se puede marcar enviada dos veces la misma reserva');
    });

    await T('invitacionesPendientes(): una reserva firme SIN la invitación incluida nunca aparece', async () => {
      const r = await crearReserva({
        configuracion: {
          fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      filasCreadas.push(r.reserva.codigo);
      await q(`UPDATE reserva SET estado = 'CONFIRMED' WHERE id = $1`, [r.reserva.id]);

      const pendientes = await invitacionesPendientes();
      yes(!pendientes.some((p) => p.codigo === r.reserva.codigo));
    });

    await T('Editar adicionales: una reserva del armador SÍ tiene configuracion vigente anidada (el editor puede operar)', async () => {
      const r = await crearReserva({
        configuracion: {
          fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      filasCreadas.push(r.reserva.codigo);

      const actual = await reservaPorCodigo(r.reserva.codigo);
      const vigente = configuracionVigente(actual);
      yes(!!vigente?.configuracion, 'una reserva del armador debe tener .configuracion anidada — la misma condición que usa la ruta admin para permitir el editor');
    });

    await T('Editar adicionales en reserva MANUAL: el total negociado queda de base y cada adicional se suma (agregar, agregar otro, quitar todo)', async () => {
      const { aplicarCambioComercialManual } = await import('../lib/cambio-comercial.js');
      const { detalleDeReserva } = await import('../lib/reservas.js');
      const r = await crearReservaManual({
        referencia: 'QA operativo', nombreNino: 'QA Manual', apoderado: CLIENTE.nombre,
        email: CLIENTE.email, telefono: CLIENTE.telefono,
        fecha: fechaPruebaSiguiente(), turno: 'AM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
        total: 200000, anticipo: 100000, notas: '',
      });
      if (!r.ok) throw new Error(`crearReservaManual falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
      filasCreadas.push(r.reserva.codigo);

      const actual0 = await reservaPorCodigo(r.reserva.codigo);
      yes(!configuracionVigente(actual0)?.configuracion, 'una reserva manual sigue sin .configuracion anidada (el motor de precios nunca la toca)');

      const A = { id: 'tobogan-premium', nombre: 'Tobogán Premium', emoji: '🎢', precios: { hasta10: 70000, hasta20: 80000, hasta30: 90000, mas30: 100000 } };
      const B = { id: 'pintacaritas', nombre: 'Pintacaritas', emoji: '🎨', precios: { hasta10: 30000, hasta20: 30000, hasta30: 30000, mas30: 30000 } };

      let c = await aplicarCambioComercialManual({ reservaId: r.reserva.id, items: [A], tematica: null, motivo: 'qa' });
      yes(c.ok, JSON.stringify(c));
      eq(c.totalDespues, 270000, 'base negociada 200.000 + 70.000');
      let actual = await reservaPorCodigo(r.reserva.codigo);
      eq(actual.total, 270000);
      yes(configuracionVigente(actual).manual === true, 'sigue siendo manual tras el cambio');
      let det = detalleDeReserva(actual);
      eq(det.adicionales.length, 1);
      eq(det.adicionales[0].precio, 70000);

      c = await aplicarCambioComercialManual({ reservaId: r.reserva.id, items: [A, B], tematica: null, motivo: 'qa' });
      eq(c.totalDespues, 300000, 'se suma sobre la BASE, no sobre el total anterior (sin acumular dos veces)');

      c = await aplicarCambioComercialManual({ reservaId: r.reserva.id, items: [], tematica: null, motivo: 'qa' });
      eq(c.totalDespues, 200000, 'sin adicionales vuelve exactamente al total negociado');
      actual = await reservaPorCodigo(r.reserva.codigo);
      eq(actual.total, 200000);
      yes(!JSON.parse(typeof actual.snapshot === 'string' ? actual.snapshot : JSON.stringify(actual.snapshot)).extrasManual, 'el snapshot original nunca se toca');
    });

    await T('Editar adicionales en reserva MANUAL: una reserva del armador es rechazada por el camino manual', async () => {
      const { aplicarCambioComercialManual } = await import('../lib/cambio-comercial.js');
      const r = await crearReserva({
        configuracion: {
          fecha: `${fechaPruebaSiguiente()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente',
          tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no',
          extras: [], tematica: null, horasAdicionales: 0,
        },
        cliente: CLIENTE, aceptaTyc: true,
      });
      if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo}`);
      filasCreadas.push(r.reserva.codigo);
      const c = await aplicarCambioComercialManual({ reservaId: r.reserva.id, items: [], tematica: null, motivo: 'qa' });
      eq(c.ok, false);
      eq(c.motivo, 'reserva_no_es_manual');
    });

  } finally {
    await limpiar().catch((e) => console.error('Aviso: la limpieza de filas de prueba falló:', e.message));
  }
}

console.log(`\n  QA operativo /cadena (3 hallazgos reales, 30-sep-2026) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
