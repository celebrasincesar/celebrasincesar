// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/cadena/login
// Recibe la contraseña del panel, la compara con CADENA_PASSWORD y, si calza,
// deja la cookie de sesión firmada que valida el middleware.
//
// La cookie es httpOnly + sameSite=lax + secure en producción: no se puede leer
// desde JavaScript ni viaja a otros sitios.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { COOKIE, firmar, igualSeguro } from '../../../../middleware';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Freno simple a la fuerza bruta: recuerda los intentos recientes por IP.
const intentos = new Map();
const VENTANA = 10 * 60 * 1000; // 10 minutos
const MAX_INTENTOS = 8;

function demasiadosIntentos(ip) {
  const ahora = Date.now();
  const previos = (intentos.get(ip) || []).filter((t) => ahora - t < VENTANA);
  intentos.set(ip, previos);
  return previos.length >= MAX_INTENTOS;
}

function anotarIntento(ip) {
  const previos = intentos.get(ip) || [];
  previos.push(Date.now());
  intentos.set(ip, previos);
}

export async function POST(req) {
  const secreto = process.env.CADENA_SECRET;
  const password = process.env.CADENA_PASSWORD;
  if (!secreto || !password) {
    return NextResponse.json(
      { ok: false, error: 'El panel todavía no tiene contraseña configurada en el servidor.' },
      { status: 503 }
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
  if (demasiadosIntentos(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Espera unos minutos.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  const entregada = String(body?.password ?? '');
  if (!igualSeguro(entregada, password)) {
    anotarIntento(ip);
    return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await firmar('cadena-ok', secreto), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 horas
  });
  return res;
}

// Cerrar sesión
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
