// ─────────────────────────────────────────────────────────────────────────────
// PROTECCIÓN DE /cadena Y /api/cadena  (§BE)
//
// `noindex` no es seguridad: solo pide a los buscadores que no publiquen la
// URL. Cualquiera que la escriba entraba igual y veía la agenda de César.
// Ahora hace falta una sesión real.
//
// Cómo funciona:
//   · /cadena/login pide la contraseña y la manda al servidor.
//   · El servidor la compara con CADENA_PASSWORD y, si calza, deja una cookie
//     httpOnly firmada con HMAC-SHA256 usando CADENA_SECRET.
//   · Este middleware recalcula la firma en cada request. Sin cookie válida:
//     /cadena redirige al login y /api/cadena responde 401.
//
// La contraseña NUNCA está en el código: vive en variables de entorno.
// Si faltan las variables, el acceso se DENIEGA (nunca al revés).
//
// Variables a configurar en .env.local y en Vercel:
//   CADENA_PASSWORD=<la que elija César>
//   CADENA_SECRET=<cadena larga y aleatoria, distinta de la contraseña>
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

export const COOKIE = 'cadena_sesion';

// HMAC-SHA256 con Web Crypto: funciona igual en el middleware (Edge) y en la
// route handler que crea la cookie, así ambos generan exactamente el mismo valor.
export async function firmar(valor, secreto) {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(valor));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparación en tiempo constante: no filtra información por cuánto demora.
export function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // La puerta no puede estar detrás de la cerradura: el login y su endpoint
  // tienen que ser alcanzables sin sesión.
  if (pathname === '/cadena/login' || pathname === '/api/cadena/login') {
    return NextResponse.next();
  }

  const esApi = pathname.startsWith('/api/cadena');

  const secreto = process.env.CADENA_SECRET;
  const password = process.env.CADENA_PASSWORD;

  const rechazar = (motivo) => {
    if (esApi) {
      return NextResponse.json({ ok: false, error: motivo }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/cadena/login';
    url.search = motivo === 'sin_configurar' ? '?config=1' : '';
    return NextResponse.redirect(url);
  };

  // Sin configuración no se abre la puerta: se cierra.
  if (!secreto || !password) return rechazar('sin_configurar');

  const cookie = req.cookies.get(COOKIE)?.value;
  if (!cookie) return rechazar('sin_sesion');

  const esperada = await firmar('cadena-ok', secreto);
  if (!igualSeguro(cookie, esperada)) return rechazar('sesion_invalida');

  return NextResponse.next();
}

// Solo el panel y su API. El login queda fuera, y el resto del sitio intacto:
// /armar, /catalogo, /api/disponibilidad y /api/cotizacion siguen públicos.
export const config = {
  matcher: ['/cadena', '/cadena/:path*', '/api/cadena', '/api/cadena/:path*'],
};
