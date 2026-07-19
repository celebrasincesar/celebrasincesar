// Metadata propia para /catalogo: página indexada en el sitemap (priority 0.8)
// que antes heredaba el título genérico de la home. Apunta a búsquedas de
// adicionales/entretención para cumpleaños infantiles.
export const metadata = {
  title: 'Catálogo de Adicionales: Inflables, Shows y Más',
  description:
    'Catálogo de adicionales para tu cumpleaños infantil en Las Condes: juegos inflables, animación y shows, personajes, juegos deportivos, autos eléctricos y baby shower. Precios transparentes por tramo de niños.',
  alternates: {
    canonical: 'https://celebrasincesar.cl/catalogo',
  },
  openGraph: {
    title: 'Catálogo de Adicionales | Celebra Sin Cesar',
    description:
      'Inflables, animación, personajes, deportivos y autos eléctricos para armar tu cumpleaños a tu manera.',
    url: 'https://celebrasincesar.cl/catalogo',
    images: [{ url: '/fotos/catalogo-portada.webp', width: 1055, height: 1491 }],
  },
};

export default function CatalogoLayout({ children }) {
  return children;
}
