// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/pagos/flow/return
// `urlReturn` de Flow (§14, §29). El navegador del papá vuelve acá por
// POST —no por GET, Flow lo hace siempre por POST— cuando sale del
// checkout, haya pagado o no.
//
// Que el navegador haya vuelto NO prueba que el pago se hizo (§1.11, §14):
// para medios asíncronos (transferencia) el papá puede volver antes de que
// Flow termine de confirmar. Por eso este endpoint hace lo mismo que la
// confirmación —vuelve a preguntarle a Flow por el token— y solo después
// redirige a una página GET propia que el navegador sí puede refrescar
// sin volver a POSTear nada.
//
// Nunca se pone nada sensible en la URL de destino: el código de reserva
// es público por diseño (viaja por WhatsApp) y el token de acceso es lo
// mismo que ya usa /confirmacion — no una llave nueva (§14).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { procesarToken } from '../../../../../lib/pagos-flow';
import { texto, cuerpoDe } from '../../../../../lib/http';

export const dynamic = 'force-dynamic';

function destino(req, params) {
  const url = new URL('/pago/resultado', req.url);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return url;
}

export async function POST(req) {
  const body = await cuerpoDe(req);
  const token = texto(body?.token, 200);

  if (!token) {
    return NextResponse.redirect(destino(req, { motivo: 'sin_token' }), 303);
  }

  try {
    const resultado = await procesarToken(token);
    const reserva = resultado.reserva;
    return NextResponse.redirect(
      destino(req, {
        id: reserva?.codigo,
        t: reserva?.acceso_token,
        r: resultado.resultado || resultado.motivo,
      }),
      303
    );
  } catch (err) {
    console.error('[flow/return] Error al procesar:', err.message);
    return NextResponse.redirect(destino(req, { motivo: 'error' }), 303);
  }
}

// Por si alguien abre el link a mano (o Flow cambiara a GET algún día):
// mismo comportamiento, sin token no hay nada que verificar.
export async function GET(req) {
  const token = texto(new URL(req.url).searchParams.get('token'), 200);
  if (!token) return NextResponse.redirect(destino(req, { motivo: 'sin_token' }), 303);
  try {
    const resultado = await procesarToken(token);
    const reserva = resultado.reserva;
    return NextResponse.redirect(
      destino(req, { id: reserva?.codigo, t: reserva?.acceso_token, r: resultado.resultado || resultado.motivo }),
      303
    );
  } catch {
    return NextResponse.redirect(destino(req, { motivo: 'error' }), 303);
  }
}
