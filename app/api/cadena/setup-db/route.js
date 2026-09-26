// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: POST /api/cadena/setup-db
// Protegido por el middleware de /cadena — solo César, con sesión, puede
// llamarlo. Aplica el esquema de Postgres (lib/db.js). Es seguro llamarlo
// las veces que haga falta: cada sentencia es "IF NOT EXISTS" (§28.2).
//
// No hay UI de "crear proyecto Postgres": eso se hace una vez en Vercel
// Storage. Este botón es el paso de después — "ya tengo la base, ponle las
// tablas" — para no depender de una consola de SQL.
// ─────────────────────────────────────────────────────────────────────────────

import { migrar, dbConfigurada } from '../../../../lib/db';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!dbConfigurada()) {
    return json({ ok: false, motivo: 'sin_variable_conexion' }, 503);
  }
  try {
    const aplicadas = await migrar();
    return json({ ok: true, sentencias: aplicadas.length });
  } catch (err) {
    console.error('[cadena/setup-db] Error al migrar:', err.message);
    return json({ ok: false, motivo: 'error_sql', error: err.message }, 500);
  }
}

export async function GET() {
  return json({ ok: true, dbConfigurada: dbConfigurada() });
}
