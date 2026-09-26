import { BLOQUES_VITRINA, NEGOCIO } from '../data/master';
import { RESPUESTAS } from './paginas-respuesta';

// Categorías compartibles del catálogo — mismas URLs que se mandan por WhatsApp.
const CATEGORIAS = [
  ...BLOQUES_VITRINA.filter((b) => b.slug).map((b) => b.slug),
  'deportivos', // alias de /catalogo/juegos
];

const url = (ruta) => `${NEGOCIO.sitio}${ruta}`;

export default function sitemap() {
  const ahora = new Date();
  return [
    { url: url(''),            lastModified: ahora, changeFrequency: 'weekly',  priority: 1 },
    { url: url('/alce-kids'),  lastModified: ahora, changeFrequency: 'weekly',  priority: 0.9 },
    { url: url('/catalogo'),   lastModified: ahora, changeFrequency: 'weekly',  priority: 0.8 },

    // Páginas-respuesta: contenido útil y específico, el que mejor responde
    // a las búsquedas reales de los papás.
    ...RESPUESTAS.map((r) => ({
      url: url(`/${r.slug}`), lastModified: ahora, changeFrequency: 'monthly', priority: 0.7,
    })),
    { url: url('/preguntas'),  lastModified: ahora, changeFrequency: 'monthly', priority: 0.7 },
    { url: url('/visitas'),    lastModified: ahora, changeFrequency: 'monthly', priority: 0.7 },

    ...CATEGORIAS.map((slug) => ({
      url: url(`/catalogo/${slug}`), lastModified: ahora, changeFrequency: 'weekly', priority: 0.6,
    })),

    { url: url('/terminos'),   lastModified: ahora, changeFrequency: 'monthly', priority: 0.3 },
    { url: url('/privacidad'), lastModified: ahora, changeFrequency: 'monthly', priority: 0.3 },

    // Fuera a propósito (§BQ): /armar y /confirmacion son transaccionales,
    // /cadena es privada y las APIs no son contenido. Las páginas por token
    // (/mi-celebracion, /pago/resultado, /visitas/gestionar) llevan noindex.
  ];
}
