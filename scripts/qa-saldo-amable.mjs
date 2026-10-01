// ══════════════════════════════════════════════════════════════════════
// QA — FASE 5 BLOQUE 3: SALDO AMABLE  ·  node scripts/qa-saldo-amable.mjs
// ──────────────────────────────────────────────────────────────────────
// "Facilitar el pago, nunca presionarlo." Cubre: elegibilidad real del
// correo T-7 (con catch-up a T-6), idempotencia, el guard de "pago
// verificándose" tanto en Mi Celebración como en el correo, y que el
// cron reutilizado sigue siendo UNO SOLO (sin cron nuevo en vercel.json).
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

// ── A. ESTÁTICO ─────────────────────────────────────────────────────────
await T('vercel.json sigue con exactamente 3 crons — no se creó un cron nuevo', () => {
  const vercel = JSON.parse(leer('vercel.json'));
  eq(vercel.crons.length, 3);
});

await T('el cron existente (ciclo-previo-evento) es el que ahora también manda el recordatorio de saldo', () => {
  const ruta = leer('app/api/cron/ciclo-previo-evento/route.js');
  yes(ruta.includes('ejecutarRecordatoriosSaldo'));
});

await T('el correo nunca lleva una URL de Flow estática — siempre el link privado de Mi Celebración', () => {
  const f = leer('lib/saldo-recordatorio.js');
  yes(f.includes('linkMiCelebracion'));
  yes(!/flow\.cl|pagos\/crear|checkoutUrl/.test(f));
});

await T('el registro del evento SALDO_T7_EMAIL_ENVIADO ocurre DESPUÉS de enviarCorreo, nunca antes (sin falso positivo si falla SMTP)', () => {
  const f = leer('lib/saldo-recordatorio.js');
  const iEnvio = f.indexOf('await enviarCorreo(');
  const iRegistro = f.indexOf('await registrarEvento(');
  yes(iEnvio > -1 && iRegistro > -1 && iEnvio < iRegistro, 'enviarCorreo debe ir antes que registrarEvento en el código fuente');
});

await T('Mi Celebración: el POST de pagar saldo rechaza server-side si ya hay un BALANCE verificándose', () => {
  const ruta = leer('app/api/mi-celebracion/route.js');
  yes(ruta.includes("saldo_verificandose"));
  yes(/p\.tipo === 'BALANCE' && p\.estado === 'PENDING'/.test(ruta));
});

await T('/cadena: el saldo pendiente ya no usa el color de alarma (#F97316) — es un estado normal', () => {
  const panel = leer('app/cadena/reservas-pagos.js');
  yes(!/Saldo[\s\S]{0,40}#F97316/.test(panel.replace(/\r?\n/g, ' ')));
  yes(panel.includes('BotonCopiarMensajeSaldo'));
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
  console.log('\n  QA saldo amable (integración) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
} else {
  const { q } = await import('../lib/db.js');
  const { crearReserva, reservaPorCodigo, pagosDeReserva, crearPagoPendiente, marcarPagoEnCheckout, siguienteCommerceOrder } = await import('../lib/reservas.js');
  const { enviarRecordatorioSaldoSiCorresponde, saldoEmailYaEnviado } = await import('../lib/saldo-recordatorio.js');
  const { resumenMiCelebracion } = await import('../lib/mi-celebracion.js');

  const CLIENTE = { nombre: 'QATEST Saldo Amable', email: 'qatest.saldo@celebrasincesar.cl', telefono: '+56900000055' };
  // Sábado bien lejos de cualquier fecha real, un slot distinto por
  // llamada — el DÍA de la reserva en sí es irrelevante para estas
  // pruebas (lo único que le importa a enviarRecordatorioSaldoSiCorresponde
  // es fecha_evento vs "hoy"), así que se fuerza directo por SQL después
  // de crear la reserva, para controlar el T-N exacto sin pelear con las
  // reglas de día de la semana.
  const SABADO_BASE = new Date('2027-11-06T12:00:00.000Z');
  let n = 0;
  const slotFecha = () => { const d = new Date(SABADO_BASE.getTime() + (n++) * 7 * 86_400_000); return d.toISOString().slice(0, 10); };

  const codigos = [];
  async function limpiar() {
    for (const c of codigos) {
      await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [c]).catch(() => {});
      await q(`DELETE FROM pago WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM reserva WHERE codigo = $1`, [c]).catch(() => {});
    }
  }

  // Crea una reserva CONFIRMED con saldo pendiente, y fuerza fecha_evento
  // a quedar exactamente a `diasHastaEvento` días del "hoy" de prueba.
  async function reservaConSaldo(diasHastaEvento, hoy) {
    const r = await crearReserva({
      configuracion: { fecha: `${slotFecha()}T12:00:00.000Z`, hora: 'AM', sector: 'independiente', tramoInvitados: 'hasta10', edadNino: 4, festejados: 1, tramoMayores: 'no', extras: [], tematica: null, horasAdicionales: 0 },
      cliente: CLIENTE, aceptaTyc: true,
    });
    if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    codigos.push(r.reserva.codigo);
    const fechaObjetivo = new Date(hoy.getTime() + diasHastaEvento * 86_400_000).toISOString().slice(0, 10);
    await q(`UPDATE reserva SET estado = 'CONFIRMED', pagado = $2, fecha_evento = $3::date WHERE id = $1`, [r.reserva.id, Math.round(r.reserva.total / 2), fechaObjetivo]);
    return reservaPorCodigo(r.reserva.codigo);
  }

  try {
    await T('enviarRecordatorioSaldoSiCorresponde: a T-7 exacto, con saldo y correo, SÍ se envía', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(7, hoy);
      const resultado = await enviarRecordatorioSaldoSiCorresponde(reserva, hoy);
      // correo puede no estar configurado en este entorno — ambos resultados son válidos, nunca error_envio silencioso sin motivo
      yes(resultado.enviado === true || resultado.motivo === 'correo_no_configurado', JSON.stringify(resultado));
    });

    await T('enviarRecordatorioSaldoSiCorresponde: a T-10 (fuera de ventana) NO se envía', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(10, hoy);
      const resultado = await enviarRecordatorioSaldoSiCorresponde(reserva, hoy);
      eq(resultado.enviado, false);
      eq(resultado.motivo, 'fuera_de_ventana');
    });

    await T('enviarRecordatorioSaldoSiCorresponde: a T-2 (ya pasó la ventana) NO se envía — nunca backfill tardío', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(2, hoy);
      const resultado = await enviarRecordatorioSaldoSiCorresponde(reserva, hoy);
      eq(resultado.enviado, false);
      eq(resultado.motivo, 'fuera_de_ventana');
    });

    await T('enviarRecordatorioSaldoSiCorresponde: con saldo = 0 NO se envía', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(7, hoy);
      await q(`UPDATE reserva SET pagado = total WHERE id = $1`, [reserva.id]);
      const actual = await reservaPorCodigo(reserva.codigo);
      const resultado = await enviarRecordatorioSaldoSiCorresponde(actual, hoy);
      eq(resultado.enviado, false);
      eq(resultado.motivo, 'sin_saldo');
    });

    await T('enviarRecordatorioSaldoSiCorresponde: idempotente — una vez enviado (simulado), no se reenvía en T-6', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(7, hoy);
      await q(`INSERT INTO pago_evento (reserva_id, tipo, referencia) VALUES ($1, 'SALDO_T7_EMAIL_ENVIADO', $2)`, [reserva.id, reserva.codigo]);
      yes(await saldoEmailYaEnviado(reserva.id));
      const manana = new Date(hoy.getTime() + 86_400_000); // ahora está a T-6
      const resultado = await enviarRecordatorioSaldoSiCorresponde(reserva, manana);
      eq(resultado.enviado, false);
      eq(resultado.motivo, 'ya_enviado');
    });

    await T('enviarRecordatorioSaldoSiCorresponde: con un BALANCE ya PENDING (verificándose), NO se envía', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(7, hoy);
      const commerceOrder = await siguienteCommerceOrder(reserva.codigo, 'BALANCE');
      const pago = await crearPagoPendiente({ reservaId: reserva.id, commerceOrder, tipo: 'BALANCE', monto: 1000 });
      await marcarPagoEnCheckout({ pagoId: pago.id, flowOrder: 'qa-order', flowToken: 'qa-token' });
      const resultado = await enviarRecordatorioSaldoSiCorresponde(reserva, hoy);
      eq(resultado.enviado, false);
      eq(resultado.motivo, 'saldo_verificandose');
    });

    await T('resumenMiCelebracion: con un BALANCE PENDING, saldoVerificando=true y puedePagarSaldo=false (no invita a pagar de nuevo)', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(30, hoy); // fuera de ventana de correo, no interesa acá
      const commerceOrder = await siguienteCommerceOrder(reserva.codigo, 'BALANCE');
      const pago = await crearPagoPendiente({ reservaId: reserva.id, commerceOrder, tipo: 'BALANCE', monto: 1000 });
      await marcarPagoEnCheckout({ pagoId: pago.id, flowOrder: 'qa-order-2', flowToken: 'qa-token-2' });
      const pagos = await pagosDeReserva(reserva.id);
      const resumen = resumenMiCelebracion(reserva, { pagos });
      eq(resumen.saldoVerificando, true);
      eq(resumen.puedePagarSaldo, false);
    });

    await T('resumenMiCelebracion: sin pagos pendientes, saldoVerificando=false y puedePagarSaldo=true si hay saldo', async () => {
      const hoy = new Date();
      const reserva = await reservaConSaldo(30, hoy);
      const resumen = resumenMiCelebracion(reserva, { pagos: [] });
      eq(resumen.saldoVerificando, false);
      yes(resumen.puedePagarSaldo);
    });

  } finally {
    await limpiar().catch((e) => console.error('limpieza falló:', e.message));
  }
}

console.log(`\n  QA saldo amable (Fase 5 Bloque 3) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
