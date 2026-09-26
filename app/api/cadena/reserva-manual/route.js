// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/reserva-manual
// Protegido por el middleware de /cadena. Para cotizaciones que César ya
// cerró por WhatsApp ANTES de que existiera el sistema de pagos: crea una
// reserva real en Postgres, con el turno tomado de forma atómica igual
// que cualquier otra, y queda PENDING_PAYMENT lista para generar el link
// de anticipo desde /api/cadena/link-pago —el mismo endpoint que usan
// todas las reservas, no hay una ruta de pago aparte para estas.
//
// El total/anticipo NO se recalculan con el motor de precios: son un
// precio que César ya negoció y puede no calzar con la tabla vigente. Es
// la única excepción a "nunca confiar en un monto que no calculó el
// servidor" en todo el proyecto, y está bien: quien lo escribe es César,
// autenticado, desde el panel — no un papá desde el navegador (§22).
// ─────────────────────────────────────────────────────────────────────────────

import { crearReservaManual } from '../../../../lib/reservas';
import { dbConfigurada } from '../../../../lib/db';
import { json, texto, EMAIL, normalizarTelefono, telefonoValido, cuerpoDe } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  const body = await cuerpoDe(req);

  const apoderado = texto(body?.apoderado, 120);
  const nombreNino = texto(body?.nombreNino, 120);
  const email = texto(body?.email, 160).toLowerCase();
  const telefono = normalizarTelefono(body?.telefono);
  const referencia = texto(body?.referencia, 200);
  const notas = texto(body?.notas, 1000);
  const fecha = texto(body?.fecha, 20);
  const turno = texto(body?.turno, 4).toUpperCase();
  const horasAdicionales = Number.isInteger(Number(body?.horasAdicionales)) ? Number(body.horasAdicionales) : 0;
  const tramoInvitados = texto(body?.tramoInvitados, 20);
  const tramoMayores = texto(body?.tramoMayores, 20);
  const total = Math.round(Number(body?.total));
  const anticipo = Math.round(Number(body?.anticipo));

  if (!apoderado) return json({ ok: false, motivo: 'falta_apoderado' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, motivo: 'email_invalido' }, 400);
  if (!telefonoValido(telefono)) return json({ ok: false, motivo: 'telefono_invalido' }, 400);

  const resultado = await crearReservaManual({
    referencia, nombreNino, apoderado, email, telefono,
    fecha, turno, horasAdicionales, tramoInvitados, tramoMayores, total, anticipo, notas,
  });

  if (!resultado.ok) {
    const status = resultado.motivo === 'turno_ocupado' ? 409
      : resultado.motivo === 'datos_invalidos' ? 400
      : resultado.motivo === 'tyc_no_disponible' ? 503 : 500;
    return json(resultado, status);
  }

  return json({ ok: true, reserva: resultado.reserva });
}
