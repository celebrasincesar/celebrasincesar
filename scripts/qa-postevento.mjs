// ══════════════════════════════════════════════════════════════════════
// QA DE POSTEVENTO — PURO  ·  node scripts/qa-postevento.mjs
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE A" (24-sep-2026),
// §17: T+1/T+2, T+0/T+3, futuro, estados, activación, anti-avalancha,
// timezone, mensaje/enlace, eventos permitidos, legacy retirado.
// Lo que necesita Postgres va en scripts/qa-postevento-integracion.mjs.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);

const {
  diasDesdeEvento, postEventoAplicable, mensajePostevento, linkResenaValido,
  fechaOperacionalChile, TIPO_EVENTO_POSTEVENTO, ESTADOS_POSTEVENTO,
} = await import('../lib/postevento.js');
const { NEGOCIO, POSTEVENTO_ACTIVO_DESDE } = await import('../data/master.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

// Sábado 5-jun-2027; mediodía UTC = 08:00 en Chile (mismo día).
const EVENTO = '2027-06-05';
const reserva = (extra = {}) => ({ fecha_evento: EVENTO, estado: 'BALANCE_PENDING', ...extra });
const hoyMasDias = (n) => new Date(new Date(`${EVENTO}T12:00:00.000Z`).getTime() + n * 86_400_000);

// ── Días desde el evento ────────────────────────────────────────────────
T('diasDesdeEvento: ayer=1, hoy=0, anteayer=2, mañana=-1', () => {
  eq(diasDesdeEvento(EVENTO, hoyMasDias(1)), 1);
  eq(diasDesdeEvento(EVENTO, hoyMasDias(0)), 0);
  eq(diasDesdeEvento(EVENTO, hoyMasDias(2)), 2);
  eq(diasDesdeEvento(EVENTO, hoyMasDias(-1)), -1);
});
T('diasDesdeEvento: acepta fecha_evento como Date de Postgres (no String(fecha))', () => {
  eq(diasDesdeEvento(new Date('2027-06-05T00:00:00.000Z'), hoyMasDias(1)), 1);
});

// ── Ventana T+1 / T+2 ────────────────────────────────────────────────────
T('T+1: evento ayer → aplica', () => { yes(postEventoAplicable(reserva(), hoyMasDias(1)).aplica); });
T('T+2: evento hace 2 días → aplica (recuperación)', () => { yes(postEventoAplicable(reserva(), hoyMasDias(2)).aplica); });
T('T+0: evento hoy → no aplica', () => { eq(postEventoAplicable(reserva(), hoyMasDias(0)).aplica, false); });
T('T+3: evento hace 3 días → no aplica', () => { eq(postEventoAplicable(reserva(), hoyMasDias(3)).aplica, false); });
T('Futuro: evento mañana → no aplica', () => { eq(postEventoAplicable(reserva(), hoyMasDias(-1)).aplica, false); });
for (const dias of [7, 30, 60]) {
  T(`Anti-avalancha: celebración de hace ${dias} días → cero tareas`, () => {
    eq(postEventoAplicable(reserva(), hoyMasDias(dias)).aplica, false);
  });
}

// ── Estados reales ───────────────────────────────────────────────────────
for (const estado of ['CANCELLED', 'EXPIRED', 'REFUNDED', 'PENDING_PAYMENT', 'DRAFT', 'PAYMENT_VERIFYING', 'PAYMENT_CONFLICT']) {
  T(`Estado ${estado} no crea tarea`, () => { eq(postEventoAplicable(reserva({ estado }), hoyMasDias(1)).aplica, false); });
}
for (const estado of ['CONFIRMED', 'BALANCE_PENDING', 'PAID', 'COMPLETED']) {
  T(`Estado ${estado} sí es elegible`, () => { yes(postEventoAplicable(reserva({ estado }), hoyMasDias(1)).aplica); });
}
T('ESTADOS_POSTEVENTO son solo los firmes reales (sin enums nuevos)', () => {
  eq(ESTADOS_POSTEVENTO.join(','), 'CONFIRMED,BALANCE_PENDING,PAID,COMPLETED');
});

// ── Activación ───────────────────────────────────────────────────────────
T('POSTEVENTO_ACTIVO_DESDE inicial = 2026-09-24', () => { eq(POSTEVENTO_ACTIVO_DESDE, '2026-09-24'); });
T('hoy < POSTEVENTO_ACTIVO_DESDE → no crea, aunque sea T+1', () => {
  const r = postEventoAplicable({ fecha_evento: '2026-09-19', estado: 'PAID' }, new Date('2026-09-20T15:00:00.000Z'));
  eq(r.aplica, false);
  eq(r.motivo, 'antes_de_activacion');
});
T('hoy = POSTEVENTO_ACTIVO_DESDE con evento ayer → sí crea', () => {
  yes(postEventoAplicable({ fecha_evento: '2026-09-23', estado: 'PAID' }, new Date('2026-09-24T15:00:00.000Z')).aplica);
});

// ── Timezone (patrón mediodía + fecha operacional Chile) ────────────────
T('Timezone invierno: sábado 22:30 Chile (ya domingo en UTC) sigue siendo T+0, no T+1', () => {
  const hoy = new Date('2027-06-06T02:30:00.000Z'); // 5-jun 22:30 en Chile (UTC-4)
  eq(fechaOperacionalChile(hoy), '2027-06-05');
  eq(postEventoAplicable(reserva(), hoy).aplica, false);
});
T('Timezone verano: sábado 23:30 Chile (ya domingo en UTC) sigue siendo T+0', () => {
  const hoy = new Date('2027-01-10T02:30:00.000Z'); // 9-ene 23:30 en Chile (UTC-3)
  eq(fechaOperacionalChile(hoy), '2027-01-09');
  eq(postEventoAplicable({ fecha_evento: '2027-01-09', estado: 'PAID' }, hoy).aplica, false);
});
T('Cambio de día: domingo 11:00 Chile (cron) → T+1 del sábado', () => {
  yes(postEventoAplicable(reserva(), new Date('2027-06-06T15:00:00.000Z')).aplica);
});
T('Viernes: evento viernes → sábado T+1, domingo T+2, lunes T+3 (no)', () => {
  const viernes = { fecha_evento: '2027-06-04', estado: 'PAID' };
  yes(postEventoAplicable(viernes, new Date('2027-06-05T15:00:00.000Z')).aplica);
  yes(postEventoAplicable(viernes, new Date('2027-06-06T15:00:00.000Z')).aplica);
  eq(postEventoAplicable(viernes, new Date('2027-06-07T15:00:00.000Z')).aplica, false);
});

// ── Enlace de reseña y mensaje ──────────────────────────────────────────
const URL_QA = 'https://example.test/qa-resena';
T('Config real (Bloque B): googleReviewUrl es el enlace oficial y NO el URL de Maps', () => {
  eq(NEGOCIO.postevento.googleReviewUrl, 'https://g.page/r/CVdcUHxqMikJEBM/review');
  yes(NEGOCIO.postevento.googleReviewUrl !== NEGOCIO.mapa);
});
T('linkResenaValido: rechaza null, vacío, http y esquemas raros', () => {
  for (const v of [null, undefined, '', '   ', 'http://x.test/r', 'javascript:alert(1)', 'sin esquema']) {
    eq(linkResenaValido(v), false, `valor ${JSON.stringify(v)}`);
  }
  eq(linkResenaValido(URL_QA), true);
});
T('mensajePostevento: sin enlace válido devuelve null (nunca URL falsa)', () => {
  eq(mensajePostevento('Antonia', null), null);
  eq(mensajePostevento('Antonia', 'http://inseguro.test/r'), null);
});
T('mensajePostevento: con URL inyectada incluye festejado y URL, texto exacto del documento', () => {
  const m = mensajePostevento('Antonia', URL_QA);
  eq(m, `🎉 ¡Gracias por celebrar con nosotros!

Esperamos que Antonia y su familia hayan disfrutado mucho su celebración en Alce Kids.

Si te gustó la experiencia, nos ayudaría muchísimo que dejaras una reseña en Google:

${URL_QA}

Gracias por confiar en nosotros 💛

Alce Kids`);
});
T('mensajePostevento: sin promociones ni descuentos', () => {
  const m = mensajePostevento('Antonia', URL_QA).toLowerCase();
  for (const palabra of ['descuento', 'promo', 'oferta', '%']) yes(!m.includes(palabra), palabra);
});

// ── Eventos permitidos ───────────────────────────────────────────────────
T('Solo existen POSTEVENTO_TAREA_WHATSAPP_CREADA y _GESTIONADA (nada de enviado/entregado/reseña realizada)', () => {
  eq(TIPO_EVENTO_POSTEVENTO.CREADA, 'POSTEVENTO_TAREA_WHATSAPP_CREADA');
  eq(TIPO_EVENTO_POSTEVENTO.GESTIONADA, 'POSTEVENTO_TAREA_WHATSAPP_GESTIONADA');
  eq(Object.keys(TIPO_EVENTO_POSTEVENTO).length, 2);
  const fuente = fs.readFileSync(path.join(RAIZ, 'lib/postevento.js'), 'utf8');
  for (const prohibido of ['WHATSAPP_ENVIADO', 'WHATSAPP_ENTREGADO', 'RESEÑA_REALIZADA']) {
    yes(!fuente.includes(prohibido), prohibido);
  }
});

T('Postgres es la fuente de verdad: postevento no importa ni usa Google Calendar', () => {
  for (const rel of ['lib/postevento.js', 'app/api/cadena/postevento/route.js', 'app/cadena/postevento.js']) {
    const fuente = fs.readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\/\/.*$/gm, '');
    yes(!/calendario|googleapis|calendar/i.test(fuente), `${rel} referencia Calendar`);
  }
});

// ── Legacy retirado, cron único ──────────────────────────────────────────
T('Legacy: /cadena ya no tiene "Recién celebradas — pedir reseña" ni MSGS.resena ni GOOGLE_REVIEWS_URL', () => {
  const pagina = fs.readFileSync(path.join(RAIZ, 'app/cadena/page.js'), 'utf8');
  yes(!pagina.includes('Recién celebradas'), 'bloque legacy sigue presente');
  yes(!pagina.includes('MSGS.resena'), 'mensaje legacy sigue presente');
  yes(!pagina.includes('GOOGLE_REVIEWS_URL'), 'URL de Maps sigue usada para reseñas');
  yes(pagina.includes('<Postevento />'), 'falta el nuevo módulo');
});
T('Cron: el mismo endpoint procesa ciclo previo y postevento; vercel.json sigue con 3 crons', () => {
  const ruta = fs.readFileSync(path.join(RAIZ, 'app/api/cron/ciclo-previo-evento/route.js'), 'utf8');
  yes(ruta.includes('ejecutarCicloPrevio') && ruta.includes('ejecutarPostevento'));
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  eq(vercel.crons.length, 3);
});

console.log(`\n  QA Postevento (puro) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
