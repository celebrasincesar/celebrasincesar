// /alce-kids concentra la autoridad SEO del recinto: es la página que
// responde "cómo es el lugar" y la que se comparte por WhatsApp.
export const metadata = {
  title: 'Alce Kids — El Recinto en Las Condes',
  description:
    '600 m² para celebrar cumpleaños infantiles en Las Condes: piscina de pelotas gigante, tobogán, autopista, granja con conejos, salón climatizado y estacionamientos. Conoce el recinto y agenda tu visita.',
  alternates: { canonical: 'https://celebrasincesar.cl/alce-kids' },
  openGraph: {
    title: 'Alce Kids — Cumpleaños Infantiles en Las Condes',
    description:
      '600 m² de recinto exclusivo para tu celebración: juegos para niños de 0 a 6 años, granja, salón climatizado y adultos sin costo adicional.',
    url: 'https://celebrasincesar.cl/alce-kids',
    images: [{ url: '/infra-piscina.webp', width: 800, height: 600 }],
  },
};

export default function AlceKidsLayout({ children }) {
  return children;
}
