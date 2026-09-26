// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: /api/pagos/estado
// ¿Se puede pagar por la web ahora mismo?
//
// El armador pregunta esto antes de pintar el botón. Si la respuesta es no
// —porque falta la base de datos, faltan las credenciales de Flow, o César
// todavía no habilitó su cuenta— el botón de pago NO aparece y el papá ve
// el camino de siempre: solicitar por WhatsApp. Nunca se le ofrece pagar
// para después mostrarle un error.
//
// Devuelve solo booleanos. Ni una llave, ni una URL de Flow, ni el nombre
// del entorno: esto lo lee cualquiera (§22).
// ─────────────────────────────────────────────────────────────────────────────

import { dbConfigurada, esquemaListo } from '../../../../lib/db';
import { flowConfigurado } from '../../../../lib/flow';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const bd = dbConfigurada();
  const flow = flowConfigurado();
  const esquema = bd ? await esquemaListo() : false;

  return json({
    pagosHabilitados: bd && flow && esquema,
    // Detalle por pieza: sirve para que el panel diga QUÉ falta en vez de
    // un "no funciona" que no ayuda a nadie.
    piezas: { baseDatos: bd, esquema, flow },
  });
}
