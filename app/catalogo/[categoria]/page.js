import { notFound } from 'next/navigation';
import { BLOQUES_VITRINA, NEGOCIO } from '../../../data/master';
import CatalogoCliente from '../catalogo-cliente';

// ──────────────────────────────────────────────────────────────────────
// LINKS DIRECTOS POR CATEGORÍA — /catalogo/inflables, /catalogo/animacion…
//
// Son URLs reales (bonitas, compartibles por WhatsApp e indexables), pero
// NO son un catálogo aparte: renderizan el MISMO componente y los MISMOS
// datos que /catalogo, solo que posicionado en esa sección.
// ──────────────────────────────────────────────────────────────────────

// `deportivos` es alias de JUEGOS: es como los papás lo piden por WhatsApp.
const ALIAS = { deportivos: 'b-juegos' };

const SLUGS = {
  ...Object.fromEntries(BLOQUES_VITRINA.filter((b) => b.slug).map((b) => [b.slug, b.id])),
  ...ALIAS,
};

const META = {
  incluidos: {
    titulo: 'Qué Incluye tu Reserva',
    desc: 'Todo lo que viene sin costo en tu celebración en Alce Kids: cocina equipada, parlantes, mesas extra, la granja de conejitos y la invitación digital.',
  },
  inflables: {
    titulo: 'Inflables para Cumpleaños',
    desc: 'Inflables gigantes, medianos y pequeños para tu cumpleaños infantil en Las Condes. Traslado, instalación y electricidad incluidos.',
  },
  juegos: {
    titulo: 'Juegos y Autos Eléctricos',
    desc: 'Autos eléctricos para la Autopista Gigante, mini deportivos y mesas de taca taca y ping pong para el torneo familiar.',
  },
  deportivos: {
    titulo: 'Juegos Deportivos para Cumpleaños',
    desc: 'Taca taca, ping pong, hockey y karts — tamaño junior y tamaño adulto. Ideales cuando vienen niños mayores de 6 años.',
  },
  decoracion: {
    titulo: 'Decoración de Cumpleaños',
    desc: 'Decoración genérica o temática con el personaje favorito, simple o full: arco de globos, banderines, mantelería y fondo de celebración.',
  },
  animacion: {
    titulo: 'Animación y Shows Infantiles',
    desc: 'Pintacaritas, globoflexia, animación full juegos, personajes favoritos y shows temáticos. Valor según la cantidad de niños.',
  },
  'banqueteria-ninos': {
    titulo: 'Banquetería para Niños',
    desc: 'Carrito de mini sándwich y cóctel infantil a la medida de tu celebración. Cotización sin compromiso.',
  },
  'banqueteria-adultos': {
    titulo: 'Banquetería para Adultos',
    desc: 'Cóctel y sándwich para que los grandes también disfruten la celebración. Cotización sin compromiso.',
  },
  videojuegos: {
    titulo: 'Sala de Video Juegos +7',
    desc: 'Un espacio con consola para que los hermanos e invitados mayores de 7 años tengan su propio panorama durante la celebración.',
  },
  packs: {
    titulo: 'Packs para Hermanos Mayores',
    desc: '¿Vendrán niños mayores de 6 años? Al armar tu celebración te mostramos automáticamente una combinación de entretención adecuada según cuántos sean y el número total de invitados.',
  },
};

export function generateStaticParams() {
  return Object.keys(SLUGS).map((categoria) => ({ categoria }));
}

export function generateMetadata({ params }) {
  const meta = META[params.categoria];
  if (!meta) return {};
  const url = `https://celebrasincesar.cl/catalogo/${params.categoria}`;
  return {
    title: `${meta.titulo} | Alce Kids`,
    description: meta.desc,
    alternates: { canonical: url },
    openGraph: {
      title: `${meta.titulo} | Celebra Sin Cesar`,
      description: meta.desc,
      url,
      images: [{ url: '/fotos/catalogo-portada.webp', width: 1055, height: 1491 }],
    },
  };
}

export default function CatalogoCategoriaPage({ params }) {
  if (!SLUGS[params.categoria]) notFound();
  const meta = META[params.categoria];

  // Inicio → Catálogo → Categoría (§BO)
  const migas = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: NEGOCIO.sitio },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${NEGOCIO.sitio}/catalogo` },
      { '@type': 'ListItem', position: 3, name: meta?.titulo || params.categoria, item: `${NEGOCIO.sitio}/catalogo/${params.categoria}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(migas) }} />
      <CatalogoCliente categoriaInicial={params.categoria} />
    </>
  );
}
