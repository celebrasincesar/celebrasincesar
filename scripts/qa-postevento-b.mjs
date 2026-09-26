// ══════════════════════════════════════════════════════════════════════
// QA DE POSTEVENTO BLOQUE B — PURO  ·  node scripts/qa-postevento-b.mjs
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE B" (24-sep-2026),
// §17-§19: enlace oficial de reseña, estado postevento de Mi Celebración
// (futuro / T+0 / T+1 / T+30 / cancelada), variante sin festejado,
// Compartir (Web Share + fallback) y privacidad del contenido compartido.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);

const { resumenMiCelebracion } = await import('../lib/mi-celebracion.js');
const { mensajePostevento, nombreFestejadoValido, estadoPostevento } = await import('../lib/postevento.js');
const {
  contenidoCompartir, mensajeFallbackCompartir, urlWhatsAppCompartir, compartirAlceKids, TEXTO_COMPARTIR,
} = await import('../lib/compartir.js');
const { NEGOCIO } = await import('../data/master.js');

let ok = 0;
const fallos = [];
const T = (nombre, fn) => { try { fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const TA = async (nombre, fn) => { try { await fn(); ok++; } catch (e) { fallos.push(nombre + ' → ' + e.message); } };
const eq = (a, b, msg) => {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
};
const yes = (v, msg) => { if (!v) throw new Error(msg || 'esperado true'); };

const URL_OFICIAL = 'https://g.page/r/CVdcUHxqMikJEBM/review';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// ── Enlace oficial (§17) ────────────────────────────────────────────────
T('NEGOCIO.postevento.googleReviewUrl es literalmente el enlace oficial', () => {
  eq(NEGOCIO.postevento.googleReviewUrl, URL_OFICIAL);
});
T('El enlace de reseña NO es NEGOCIO.mapa ni el GOOGLE_REVIEWS_URL legacy, y ambos siguen intactos', () => {
  const legacy = leer('data/testimonios.js');
  yes(legacy.includes("'https://www.google.com/maps?cid=660114253320051799'"), 'GOOGLE_REVIEWS_URL legacy debe seguir igual');
  yes(NEGOCIO.postevento.googleReviewUrl !== NEGOCIO.mapa);
  eq(NEGOCIO.mapa, 'https://www.google.com/maps?cid=660114253320051799');
});
T('Ningún componente/lib de postevento usa NEGOCIO.mapa ni GOOGLE_REVIEWS_URL', () => {
  for (const rel of ['lib/postevento.js', 'lib/compartir.js', 'app/cadena/postevento.js',
    'app/api/cadena/postevento/route.js', 'app/mi-celebracion/page.js', 'lib/mi-celebracion.js']) {
    const fuente = leer(rel);
    yes(!/NEGOCIO\.mapa/.test(fuente), `${rel} usa NEGOCIO.mapa`);
    yes(!/GOOGLE_REVIEWS_URL/.test(fuente), `${rel} usa GOOGLE_REVIEWS_URL`);
  }
});
T('/cadena (mensaje) y Mi Celebración (CTA) toman el enlace de NEGOCIO.postevento.googleReviewUrl', () => {
  yes(leer('lib/postevento.js').includes('NEGOCIO.postevento.googleReviewUrl'));
  yes(leer('lib/mi-celebracion.js').includes('NEGOCIO.postevento.googleReviewUrl'));
  yes(leer('app/mi-celebracion/page.js').includes('postevento.resenaUrl'), 'la página usa el enlace que entrega el servidor');
});
T('Mensaje WhatsApp definitivo con el enlace oficial (texto exacto)', () => {
  eq(mensajePostevento('Antonia'), `🎉 ¡Gracias por celebrar con nosotros!

Esperamos que Antonia y su familia hayan disfrutado mucho su celebración en Alce Kids.

Si te gustó la experiencia, nos ayudaría muchísimo que dejaras una reseña en Google:

${URL_OFICIAL}

Gracias por confiar en nosotros 💛

Alce Kids`);
});
T('Sin nombre de festejado válido: variante natural, nunca "undefined"', () => {
  for (const nombre of [undefined, null, '', '   ', 'undefined', 'null']) {
    eq(nombreFestejadoValido(nombre), false);
    const m = mensajePostevento(nombre);
    yes(m.includes('Esperamos que hayan disfrutado mucho su celebración en Alce Kids.'), `variante para ${JSON.stringify(nombre)}`);
    yes(!/undefined|null|\{FESTEJADO\}/.test(m), 'texto roto');
  }
});

// ── Mi Celebración postevento (§18) ──────────────────────────────────────
const RESERVA = (extra = {}) => ({
  id: 601, codigo: 'CSC-2026-000601', acceso_token: 'aaaa1111bbbb2222cccc3333dddd4444',
  cliente_nombre: 'Familia Rojas', cliente_email: 'rojas@example.com', cliente_telefono: '+56911111111',
  fecha_evento: '2027-06-05', hora_inicio: '15:00', hora_termino: '19:00',
  sector: 'completo', ninos: 15, mayores: 2, total: 400000, anticipo: 200000, pagado: 200000,
  estado: 'BALANCE_PENDING',
  snapshot: { ctx: { edadNino: 6, totalNinos: 17 }, configuracion: { nombreNino: 'Antonia', edadNino: 6, tramoInvitados: '11a20', tramoMayores: '1a3', extras: [] } },
  ...extra,
});
const hoyMasDias = (n) => new Date(new Date('2027-06-05T12:00:00.000Z').getTime() + n * 86_400_000);
const resumen = (reserva, dias) => resumenMiCelebracion(reserva, { hoy: hoyMasDias(dias) });

T('Evento futuro: no aparece postevento', () => {
  const r = resumen(RESERVA(), -3);
  eq(r.postevento.activo, false);
  yes(r.proximoPaso.tipo !== 'postevento');
});
T('T+0: todavía no aparece', () => { eq(resumen(RESERVA(), 0).postevento.activo, false); });
T('T+1: aparece con el título, texto y enlace oficial', () => {
  const r = resumen(RESERVA(), 1);
  eq(r.postevento.activo, true);
  eq(r.postevento.resenaUrl, URL_OFICIAL);
  eq(r.proximoPaso.tipo, 'postevento');
  eq(r.proximoPaso.titulo, '¡Gracias por celebrar con nosotros! 🎉');
  eq(r.proximoPaso.texto, 'Esperamos que lo hayan pasado increíble en Alce Kids. Gracias por confiar en nosotros para una celebración tan especial.');
});
T('T+30: el estado postevento sigue accesible (sin expiración)', () => {
  const r = resumen(RESERVA(), 30);
  eq(r.postevento.activo, true);
  eq(r.postevento.resenaUrl, URL_OFICIAL);
});
T('Prioridad: en T+1 reemplaza saldo/Datos Finales/pasos previos aunque haya saldo pendiente', () => {
  const r = resumen(RESERVA({ pagado: 200000 }), 1); // saldo pendiente 200.000
  eq(r.saldoPendiente, 200000, 'los datos económicos siguen visibles');
  eq(r.proximoPaso.tipo, 'postevento', 'el saldo no impide el estado postevento');
});
for (const estado of ['CANCELLED', 'EXPIRED', 'REFUNDED', 'PENDING_PAYMENT']) {
  T(`Reserva ${estado}: no muestra postevento`, () => {
    const r = resumen(RESERVA({ estado }), 5);
    eq(r.postevento.activo, false);
    eq(r.postevento.resenaUrl, null);
    yes(r.proximoPaso.tipo !== 'postevento');
  });
}
T('Reserva sin nombre de festejado: la respuesta no contiene "undefined"', () => {
  const r = resumen(RESERVA({ snapshot: { ctx: {}, configuracion: {} } }), 1);
  yes(!JSON.stringify(r).includes('undefined'));
});
T('estadoPostevento acepta fecha_evento como Date de Postgres', () => {
  eq(estadoPostevento({ fecha_evento: new Date('2027-06-05T00:00:00.000Z'), estado: 'PAID' }, hoyMasDias(1)).activo, true);
});
T('La página no muestra pasos previos al evento en postevento (Datos Finales / adicionales / próximo paso)', () => {
  const pagina = leer('app/mi-celebracion/page.js');
  yes(/\{!enPostevento && \(\s*<>[\s\S]*SeccionDatosFinales[\s\S]*SeccionAgregarAdicional/.test(pagina));
});

// ── Compartir (§8-§10, §14, §19) ─────────────────────────────────────────
const C = contenidoCompartir();
T('Contenido compartible: título, texto y URL pública oficiales', () => {
  eq(C.title, 'Alce Kids');
  eq(C.text, 'Celebramos en Alce Kids y nos encantó 🎈 Te dejo el lugar por si estás buscando dónde celebrar.');
  eq(C.text, TEXTO_COMPARTIR);
  eq(C.url, NEGOCIO.sitio);
});
T('Privacidad: el contenido compartido no incluye token, código, festejado, fecha ni datos personales', () => {
  const todo = JSON.stringify(C) + mensajeFallbackCompartir(C) + urlWhatsAppCompartir(C);
  const r = resumen(RESERVA(), 1);
  for (const privado of [
    'CSC-', 'mi-celebracion', 'acceso_token', '?t=', '&t=', 'aaaa1111bbbb2222cccc3333dddd4444',
    'Antonia', 'Rojas', '+569', 'example.com', '2027', r.codigo,
  ]) {
    yes(!todo.includes(privado), `contiene "${privado}"`);
  }
  yes(!/mi-celebracion/.test(C.url));
});
T('Compartir es independiente de la reseña: no incluye el enlace de Google', () => {
  yes(!JSON.stringify(C).includes('g.page'));
  yes(!mensajeFallbackCompartir(C).includes('g.page'));
});
T('Fallback: mismo contenido en un solo texto + URL de WhatsApp', () => {
  eq(mensajeFallbackCompartir(C), `Celebramos en Alce Kids y nos encantó 🎈 Te dejo el lugar por si estás buscando dónde celebrar: ${NEGOCIO.sitio}`);
  eq(urlWhatsAppCompartir(C), `https://wa.me/?text=${encodeURIComponent(mensajeFallbackCompartir(C))}`);
});

await TA('Web Share disponible: se llama navigator.share con title/text/url exactos', async () => {
  let recibido = null;
  const r = await compartirAlceKids({ nav: { share: async (d) => { recibido = d; } } });
  eq(r.via, 'web_share');
  eq(recibido.title, 'Alce Kids');
  eq(recibido.text, C.text);
  eq(recibido.url, NEGOCIO.sitio);
  eq(Object.keys(recibido).sort().join(','), 'text,title,url');
});
await TA('Web Share no disponible: fallback funcional', async () => {
  const r = await compartirAlceKids({ nav: {} });
  eq(r.via, 'fallback');
  eq(r.mensaje, mensajeFallbackCompartir(C));
  yes(r.whatsappUrl.startsWith('https://wa.me/?text='));
  const sinNav = await compartirAlceKids({ nav: null });
  eq(sinNav.via, 'fallback');
});
await TA('Usuario cancela el diálogo de compartir: no se fuerza el fallback', async () => {
  const err = Object.assign(new Error('cancelado'), { name: 'AbortError' });
  const r = await compartirAlceKids({ nav: { share: async () => { throw err; } } });
  eq(r.via, 'web_share');
  eq(r.cancelado, true);
});
await TA('Web Share falla por otro motivo: cae al fallback', async () => {
  const r = await compartirAlceKids({ nav: { share: async () => { throw new Error('no soportado'); } } });
  eq(r.via, 'fallback');
});

// ── Alcance del bloque ───────────────────────────────────────────────────
T('Sin email postevento, sin eventos nuevos y sin "reseña realizada"', () => {
  for (const rel of ['lib/postevento.js', 'lib/compartir.js', 'lib/mi-celebracion.js', 'app/mi-celebracion/page.js']) {
    const fuente = leer(rel);
    yes(!/enviarCorreo|lib\/correo|\.\/correo/.test(fuente), `${rel} toca correo`);
    yes(!/RESE(Ñ|N)A_REALIZADA|WHATSAPP_ENVIADO|WHATSAPP_ENTREGADO/.test(fuente), `${rel} registra eventos sin evidencia`);
  }
});

console.log(`\n  QA Postevento Bloque B (puro) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
