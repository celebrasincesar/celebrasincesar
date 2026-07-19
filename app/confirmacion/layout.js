// Formulario privado pre-evento — no debe aparecer en resultados de búsqueda.
// noindex (sin bloquear el crawl, para que Google pueda leer la directiva).
export const metadata = {
  title: 'Confirma tu celebración',
  robots: {
    index: false,
    follow: true,
  },
};

export default function ConfirmacionLayout({ children }) {
  return children;
}
