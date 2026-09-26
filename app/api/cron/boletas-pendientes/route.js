// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/cron/boletas-pendientes
// Vercel Cron la llama una vez al día (vercel.json). Si hay pagos
// PENDING_BVE, manda el resumen a administracion@celebrasincesar.cl; si no
// hay ninguno, no manda nada (documento "Agregar control obligatorio de
// BVE…", 07-sep-2026, §5: "no enviar nuevo recordatorio una vez marcada
// como emitida" — una vez emitida, ya no aparece en la lista, así que deja
// de mandarse sola, sin lógica extra para "no repetir").
//
// Protegida con CRON_SECRET: Vercel manda `Authorization: Bearer
// $CRON_SECRET` automáticamente en cada disparo cuando esa variable existe
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Sin la variable configurada, o con un valor que no calza, se rechaza —
// es un correo real al buzón real del negocio, no un endpoint que cualquiera
// en internet debería poder disparar (denegar por defecto, igual que
// /cadena y que la escritura en Calendar).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada } from '../../../../lib/db';
import { pagosPendientesBVE, registrarEvento } from '../../../../lib/reservas';
import { construirResumenBVE } from '../../../../lib/recordatorio-bve';
import { correoConfigurado, enviarCorreo } from '../../../../lib/correo';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return json({ ok: false, motivo: 'cron_sin_configurar' }, 401);

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secreto}`) return json({ ok: false, motivo: 'no_autorizado' }, 401);

  if (!dbConfigurada()) return json({ ok: true, enviado: false, motivo: 'pagos_no_disponibles' });

  const pendientes = await pagosPendientesBVE();
  if (pendientes.length === 0) {
    return json({ ok: true, enviado: false, pendientes: 0 });
  }

  if (!correoConfigurado()) {
    console.error(`[cron/boletas-pendientes] ${pendientes.length} boleta(s) pendiente(s) pero el correo no está configurado (falta ZOHO_SMTP_HOST/USER/PASSWORD)`);
    return json({ ok: true, enviado: false, motivo: 'correo_no_configurado', pendientes: pendientes.length });
  }

  const resumen = construirResumenBVE(pendientes);
  const destinatario = process.env.MAIL_TO_BVE || process.env.MAIL_FROM_ADMIN || 'administracion@celebrasincesar.cl';

  try {
    await enviarCorreo({ to: destinatario, subject: resumen.asunto, text: resumen.texto, html: resumen.html });
  } catch (err) {
    console.error(`[cron/boletas-pendientes] Falló el envío: ${err.message}`);
    return json({ ok: false, motivo: 'error_correo', pendientes: pendientes.length }, 502);
  }

  await registrarEvento({
    tipo: 'RECORDATORIO_BVE_ENVIADO',
    referencia: destinatario,
    detalle: { pendientes: pendientes.length, codigos: pendientes.map((p) => p.codigo) },
  });

  return json({ ok: true, enviado: true, pendientes: pendientes.length });
}
