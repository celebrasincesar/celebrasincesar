// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cadena/flow-ping
// Protegido por el middleware de /cadena (misma sesión que el panel).
//
// La "PRIMERA PRUEBA" del documento de continuación (Fase Sandbox, §3):
// antes de tocar el wizard, la base de datos o el HOLD de turnos, hay que
// confirmar UNA cosa aislada — que este servidor puede firmar
// correctamente, hablarle a Flow Sandbox, y que Flow responde con
// `url` + `token` + `flowOrder`. Nada más.
//
// Por eso esta ruta NO toca Postgres, NO crea una reserva ni un HOLD:
// crea una orden Flow de $1.000 con un commerceOrder que se identifica a
// sí mismo como una prueba (prefijo SANDBOX-PING-), y devuelve el
// checkoutUrl para abrirlo a mano. Si esto falla, el problema está en la
// firma, las credenciales o las URLs de callback — no en la lógica de
// reservas, que todavía no entra en juego.
//
// De pura precaución también rechaza correr si FLOW_ENV apunta a
// producción: esta ruta es exclusivamente para probar Sandbox (§7 del
// documento: "NO pasar a Flow Producción todavía").
// ─────────────────────────────────────────────────────────────────────────────

import { crearPagoFlow, flowConfigurado, configFlow } from '../../../../lib/flow';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = configFlow();

  if (cfg.entorno === 'production' || cfg.entorno === 'produccion') {
    return json({
      ok: false,
      motivo: 'entorno_produccion',
      mensaje: 'FLOW_ENV está en producción. Esta ruta es solo para probar Sandbox — no se ejecuta.',
    }, 403);
  }

  if (!flowConfigurado()) {
    return json({
      ok: false,
      motivo: 'flow_no_configurado',
      mensaje: 'Faltan variables de Flow (FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_CONFIRMATION_URL o FLOW_RETURN_URL).',
      piezas: {
        apiKey: !!cfg.apiKey,
        secretKey: !!cfg.secretKey,
        urlConfirmation: !!cfg.urlConfirmation,
        urlReturn: !!cfg.urlReturn,
      },
    }, 503);
  }

  const commerceOrder = `SANDBOX-PING-${Date.now()}`;

  try {
    const flow = await crearPagoFlow({
      commerceOrder,
      subject: 'Prueba de conexión — Flow Sandbox (Celebra Sin Cesar)',
      amount: 1000,
      // Flow Sandbox valida el correo con algo más estricto que un regex
      // de formato (la primera prueba con "sandbox-ping@..." la rechazó
      // con "not valid" pese a tener formato correcto). Se usa el buzón
      // real del negocio para no depender de adivinar qué exige Flow.
      email: 'administracion@celebrasincesar.cl',
      timeout: 600,
      optional: { tipo: 'PING_DIAGNOSTICO' },
    });

    return json({
      ok: true,
      entorno: cfg.entorno,
      apiUrl: cfg.apiUrl,
      commerceOrder,
      flowOrder: flow.flowOrder,
      token: flow.token,
      checkoutUrl: flow.checkoutUrl,
      mensaje: 'Flow firmó y devolvió la orden correctamente. Abre checkoutUrl para ver el checkout Sandbox.',
    });
  } catch (err) {
    console.error('[cadena/flow-ping] Error contra Flow:', err.message);
    return json({
      ok: false,
      motivo: 'error_flow',
      entorno: cfg.entorno,
      apiUrl: cfg.apiUrl,
      error: err.message,
    }, 502);
  }
}
