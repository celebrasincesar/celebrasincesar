import { NEGOCIO } from '../data/master';

// ══════════════════════════════════════════════════════════════════════
// robots.txt  (§BP)
// ──────────────────────────────────────────────────────────────────────
// Lo generamos desde código para que el dominio salga de una sola fuente
// y no se desincronice con el sitemap.
//
// Criterio: se abre TODO el contenido público a todos los rastreadores,
// incluidos los de IA (OAI-SearchBot de ChatGPT, PerplexityBot, etc.).
// Que Alce Kids aparezca cuando alguien le pregunta a una IA por
// cumpleaños en Las Condes es exactamente lo que queremos.
//
// Se cierra solo lo que no es contenido:
//   /api/          → endpoints
//   /confirmacion  → formulario privado pre-evento
//   /cadena        → panel interno (además exige contraseña)
//
// /armar NO se bloquea (§P1-36): con Disallow, Google no puede leer su
// `noindex` ni seguir sus enlaces, y termina indexando la URL a ciegas. Se
// deja rastreable con `noindex, follow` y fuera del sitemap: es la forma
// correcta de mantener una herramienta transaccional fuera de resultados.
//
// NO se bloquea ningún buscador legítimo. Si alguna vez hay que frenar un
// scraper abusivo, se agrega acá con su nombre y el motivo.
// ══════════════════════════════════════════════════════════════════════

const PRIVADAS = ['/api/', '/confirmacion', '/cadena'];

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVADAS,
      },
    ],
    sitemap: `${NEGOCIO.sitio}/sitemap.xml`,
    host: NEGOCIO.sitio,
  };
}
