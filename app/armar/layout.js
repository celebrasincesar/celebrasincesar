// /armar es una herramienta transaccional, no contenido para buscadores:
// noindex con canonical propio (§BK, §BL). La autoridad SEO vive en Home,
// /alce-kids, el catálogo y las páginas-respuesta.
export const metadata = {
  title: 'Arma tu celebración',
  description: 'Elige fecha, cuéntanos cómo será el cumpleaños y arma tu celebración en minutos.',
  alternates: { canonical: 'https://celebrasincesar.cl/armar' },
  robots: { index: false, follow: true },
};

export default function ArmarLayout({ children }) {
  return children;
}
