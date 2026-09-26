// ══════════════════════════════════════════════════════════════════════
// CLIENTE FLOW  ·  lib/flow.js
// ──────────────────────────────────────────────────────────────────────
// Único lugar del proyecto que le habla a Flow. Todo lo demás pide pagos
// a través de estas funciones, y por eso la firma HMAC existe una sola vez
// (§10 de la especificación): una segunda copia es una copia que algún día
// se va a desincronizar y a firmar mal.
//
// REGLA QUE NO SE NEGOCIA: este archivo NUNCA se importa desde un
// componente de cliente. `apiKey` y `secretKey` viven solo en el servidor
// y jamás se prefijan con NEXT_PUBLIC_ (§9, §22). Si alguna vez este import
// aparece en un archivo con 'use client', las llaves de César quedan
// publicadas en el bundle que descarga cualquier visitante.
//
// No depende de ningún otro módulo del proyecto —solo de node:crypto— para
// que scripts/qa-pagos.mjs pueda probar la firma sin credenciales y sin
// levantar Next.
// ══════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';

// ── Entornos oficiales (verificados en la documentación de Flow) ───────
export const FLOW_SANDBOX = 'https://sandbox.flow.cl/api';
export const FLOW_PRODUCCION = 'https://www.flow.cl/api';

// paymentMethod = 9 → "todos los medios de pago habilitados para el
// comercio". No se elige el medio desde la web: lo elige el papá en el
// checkout de Flow, con los medios que la cuenta de César tenga activos
// (débito, crédito, prepago, transferencia). Y las cuotas que aparezcan
// son las que ofrece SU banco: CELEBRA SIN CESAR SPA no financia cuotas
// sin interés (§1.6, §1.7).
export const TODOS_LOS_MEDIOS = 9;

// Estados que devuelve Flow en `status` de payment/getStatus.
export const FLOW_ESTADO = {
  1: 'PENDIENTE',
  2: 'PAGADA',
  3: 'RECHAZADA',
  4: 'ANULADA',
};

// ── Configuración leída del entorno ───────────────────────────────────
// FLOW_ENV decide la URL cuando no se entrega FLOW_API_URL explícita, así
// pasar de sandbox a producción es cambiar UNA variable en Vercel (§9).
export function configFlow(env = process.env) {
  const entorno = (env.FLOW_ENV || 'sandbox').toLowerCase();
  const apiUrl = env.FLOW_API_URL
    || (entorno === 'production' || entorno === 'produccion' ? FLOW_PRODUCCION : FLOW_SANDBOX);
  return {
    entorno,
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey: env.FLOW_API_KEY || '',
    secretKey: env.FLOW_SECRET_KEY || '',
    urlConfirmation: env.FLOW_CONFIRMATION_URL || '',
    urlReturn: env.FLOW_RETURN_URL || '',
  };
}

// ¿Se puede cobrar? Sin las cuatro piezas no se intenta: es mejor que el
// papá vea "pago no disponible, coordina por WhatsApp" que un error de Flow.
export function flowConfigurado(env = process.env) {
  const c = configFlow(env);
  return !!(c.apiKey && c.secretKey && c.urlConfirmation && c.urlReturn);
}

// ══════════════════════════════════════════════════════════════════════
// FIRMA  (§10)
//   1. tomar todos los parámetros menos `s`
//   2. ordenar las claves alfabéticamente
//   3. concatenar clave1+valor1+clave2+valor2+…
//   4. HMAC-SHA256 con la secretKey
//   5. enviar el hex digest como `s`
//
// Los parámetros undefined/null se descartan ANTES de ordenar: un campo
// vacío que se firma pero no se envía (o al revés) rompe la firma y Flow
// responde con un error genérico dificilísimo de diagnosticar.
// ══════════════════════════════════════════════════════════════════════
export function flowSign(params, secretKey) {
  if (!secretKey) throw new Error('flowSign: falta secretKey');
  const claves = Object.keys(params)
    .filter((k) => k !== 's' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  const cadena = claves.map((k) => k + String(params[k])).join('');
  return crypto.createHmac('sha256', secretKey).update(cadena, 'utf8').digest('hex');
}

// Los parámetros firmados y los enviados tienen que ser exactamente los
// mismos: se limpian una sola vez y se usa el resultado para las dos cosas.
function limpiar(params) {
  const salida = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    salida[k] = String(v);
  }
  return salida;
}

// ── Llamadas HTTP ─────────────────────────────────────────────────────
// Flow responde JSON. Un HTTP != 2xx trae el motivo en el cuerpo: se
// propaga en el mensaje del error porque sin eso depurar es adivinar.
async function pedir(url, opciones, servicio) {
  let res;
  try {
    res = await fetch(url, { ...opciones, cache: 'no-store' });
  } catch (err) {
    throw new Error(`Flow ${servicio}: no se pudo conectar (${err.message})`);
  }
  const cuerpo = await res.text();
  let json = null;
  try { json = JSON.parse(cuerpo); } catch {}
  if (!res.ok) {
    const detalle = json?.message || cuerpo.slice(0, 300);
    throw new Error(`Flow ${servicio}: HTTP ${res.status} ${detalle}`);
  }
  if (!json) throw new Error(`Flow ${servicio}: respuesta no es JSON`);
  return json;
}

async function flowPost(servicio, params, cfg) {
  const limpios = limpiar({ ...params, apiKey: cfg.apiKey });
  const cuerpo = new URLSearchParams({ ...limpios, s: flowSign(limpios, cfg.secretKey) });
  return pedir(
    `${cfg.apiUrl}/${servicio}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
    },
    servicio
  );
}

async function flowGet(servicio, params, cfg) {
  const limpios = limpiar({ ...params, apiKey: cfg.apiKey });
  const query = new URLSearchParams({ ...limpios, s: flowSign(limpios, cfg.secretKey) });
  return pedir(`${cfg.apiUrl}/${servicio}?${query.toString()}`, { method: 'GET' }, servicio);
}

// ══════════════════════════════════════════════════════════════════════
// CREAR UNA ORDEN DE PAGO  (§11)
//
// Devuelve { checkoutUrl, token, flowOrder }. El checkout se arma como
// url + "?token=" + token, tal como indica la documentación de Flow.
//
// `amount` va como entero: en CLP no existen decimales y mandar 325000.0
// hace que Flow rechace la orden.
// ══════════════════════════════════════════════════════════════════════
export async function crearPagoFlow({
  commerceOrder,
  subject,
  amount,
  email,
  timeout,
  optional,
  env = process.env,
}) {
  const cfg = configFlow(env);
  if (!cfg.apiKey || !cfg.secretKey) throw new Error('Flow no está configurado en el servidor');

  const monto = Math.round(Number(amount));
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido para Flow');

  const res = await flowPost('payment/create', {
    commerceOrder,
    subject: String(subject).slice(0, 255),
    currency: 'CLP',
    amount: monto,
    email,
    paymentMethod: TODOS_LOS_MEDIOS,
    urlConfirmation: cfg.urlConfirmation,
    urlReturn: cfg.urlReturn,
    // `optional` viaja hasta Flow y vuelve en getStatus. Solo referencias
    // públicas —código de reserva y tipo de pago—: nunca un token, un
    // email ni nada que sirva para suplantar a alguien (§11, §22).
    optional: optional ? JSON.stringify(optional) : undefined,
    // El timeout de Flow se coordina con el HOLD local: si el papá no paga
    // dentro de la ventana, la orden muere y el turno se libera (§8).
    timeout: timeout || undefined,
  }, cfg);

  if (!res.url || !res.token) {
    throw new Error('Flow payment/create no devolvió url y token');
  }

  return {
    checkoutUrl: `${res.url}?token=${res.token}`,
    token: res.token,
    flowOrder: res.flowOrder != null ? String(res.flowOrder) : null,
  };
}

// ══════════════════════════════════════════════════════════════════════
// CONSULTAR EL ESTADO  (§13)
//
// La ÚNICA fuente de verdad sobre si un pago se hizo. Ni el retorno del
// navegador ni el cuerpo del webhook sirven para eso: del webhook se toma
// el token y con el token se pregunta acá, servidor a servidor (§30).
// ══════════════════════════════════════════════════════════════════════
export async function estadoPagoFlow(token, env = process.env) {
  return flowGet('payment/getStatus', { token }, configFlow(env));
}

// Reverificación desde el panel cuando lo que se tiene a mano no es el
// token sino la referencia del comercio o el número de orden de Flow (§25).
export async function estadoPorCommerceId(commerceId, env = process.env) {
  return flowGet('payment/getStatusByCommerceId', { commerceId }, configFlow(env));
}

export async function estadoPorFlowOrder(flowOrder, env = process.env) {
  return flowGet('payment/getStatusByFlowOrder', { flowOrder }, configFlow(env));
}

// ── Lectura del estado de Flow en términos del negocio ────────────────
// Traduce la respuesta cruda a lo único que le importa al resto del
// sistema. `pagado` es true SOLO con status 2: cualquier otra cosa —y
// cualquier cosa que no se entienda— no es un pago.
export function leerEstadoFlow(respuesta) {
  const status = Number(respuesta?.status);
  const pd = respuesta?.paymentData || {};
  return {
    pagado: status === 2,
    pendiente: status === 1,
    rechazado: status === 3 || status === 4,
    estado: FLOW_ESTADO[status] || 'DESCONOCIDO',
    statusCrudo: Number.isFinite(status) ? status : null,
    commerceOrder: respuesta?.commerceOrder ?? null,
    flowOrder: respuesta?.flowOrder != null ? String(respuesta.flowOrder) : null,
    // Lo que Flow informa del medio real usado. De acá sale la clasificación
    // tributaria: una tarjeta y una transferencia NO se tratan igual (§19).
    medio: pd.media ?? null,
    medioTipo: pd.mediaType ?? null,
    // Flow no siempre informa las cuotas; cuando lo hace, se guardan para
    // que el panel pueda mostrarlas. El comercio no las financia.
    cuotas: pd.installments != null ? Number(pd.installments) : null,
    codigoAutorizacion: pd.authorizationCode ?? pd.conversionRate ?? null,
    // El monto que Flow dice haber cobrado. Se compara contra el de la BD:
    // si no calza, el pago no se acredita solo (§13.4).
    monto: respuesta?.amount != null ? Math.round(Number(respuesta.amount)) : null,
    fechaPago: pd.date ?? null,
    optional: respuesta?.optional ?? null,
  };
}
