// ══════════════════════════════════════════════════════════════════════
// UTILIDADES DE LOS ENDPOINTS  ·  lib/http.js
// ──────────────────────────────────────────────────────────────────────
// Cosas que hacen todos los endpoints de pago y que no vale la pena
// escribir seis veces: limitar la frecuencia, sanear texto, comparar
// tokens sin filtrar información por el tiempo que tarda.
// ══════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

// Primitivas puras de saneado/validación: viven en lib/validacion.js (sin
// dependencia de Next.js) y se reexportan acá tal cual, para no romper a
// nadie que ya las importa desde './http' (documento "FASE 3A — VISITAS
// AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A", 22-sep-2026: lib/visitas.js y
// lib/visita-auth.js necesitan poder importarlas sin arrastrar
// 'next/server' a scripts/qa-*.mjs).
export {
  texto, CODIGO_RESERVA, TOKEN_ACCESO, EMAIL, normalizarTelefono, telefonoValido, igualSeguro,
} from './validacion';

export const SIN_CACHE = {
  headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
};

export const json = (cuerpo, status = 200) =>
  NextResponse.json(cuerpo, { status, ...SIN_CACHE });

// ── Freno de frecuencia (§22) ─────────────────────────────────────────
// Memoria del proceso. En serverless cada instancia lleva su propia
// cuenta, así que no es una muralla: es un freno que evita que alguien
// genere cien órdenes en Flow desde una pestaña. El cerrojo del turno y
// el UNIQUE de commerce_order son la defensa de verdad.
const golpes = new Map();

export function demasiadasPeticiones(clave, maximo = 10, ventanaMs = 60_000) {
  const ahora = Date.now();
  const previos = (golpes.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= maximo) {
    golpes.set(clave, previos);
    return true;
  }
  previos.push(ahora);
  golpes.set(clave, previos);
  // La memoria no puede crecer para siempre en una instancia de larga vida.
  if (golpes.size > 500) {
    for (const [k, v] of golpes) if (!v.some((t) => ahora - t < ventanaMs)) golpes.delete(k);
  }
  return false;
}

export const ipDe = (req) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';

// Lee el cuerpo venga como venga. Flow manda formularios
// (x-www-form-urlencoded); el frontend manda JSON.
export async function cuerpoDe(req) {
  const tipo = req.headers.get('content-type') || '';
  try {
    if (tipo.includes('application/json')) return await req.json();
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}
