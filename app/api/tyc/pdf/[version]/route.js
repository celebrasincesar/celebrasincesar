// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE: GET /api/tyc/pdf/[version]
// Sirve la copia conservable en PDF de una versión contractual (documento
// "No autorizo todavía el deploy...", 15-sep-2026, §9-10). Público —igual
// que /terminos— para que el cliente pueda revisar su copia sin depender
// de haber guardado el correo, y para que César la revise desde /cadena.
//
// No hay "versión vigente por defecto": el parámetro es siempre explícito,
// para que un link nunca cambie de contenido según cuándo se abra — el
// mismo link a "2026-09" sirve siempre exactamente ese PDF, aunque
// TYC_VERSION haya avanzado desde entonces.
// ─────────────────────────────────────────────────────────────────────────────

import { q1, dbConfigurada } from '../../../../../lib/db';
import { json } from '../../../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!dbConfigurada()) return json({ ok: false, motivo: 'pagos_no_disponibles' }, 503);

  // Next.js 15 (documento "Tu última entrega queda aprobada...", 21-sep-2026,
  // §4): `params` pasó a ser una Promise en los Route Handlers — sin este
  // `await`, `params.version` siempre habría sido `undefined` y esta ruta
  // habría respondido 400 para cualquier versión real.
  const { version: versionCruda } = await params;
  const version = String(versionCruda || '').slice(0, 40);
  if (!version) return json({ ok: false, motivo: 'version_invalida' }, 400);

  const fila = await q1(
    `SELECT pdf_bytes, pdf_sha256 FROM tyc_version WHERE version = $1`,
    [version]
  );
  if (!fila?.pdf_bytes) return json({ ok: false, motivo: 'pdf_no_encontrado' }, 404);

  return new Response(fila.pdf_bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Terminos-y-Condiciones-${version}.pdf"`,
      // Inmutable de verdad (mismo trigger que protege la fila): una vez
      // servido, este PDF para esta versión nunca cambia.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Contenido-Sha256': fila.pdf_sha256 || '',
    },
  });
}
