// Página privada por token — no debe aparecer en buscadores (mismo
// criterio que /pago/resultado).
export const metadata = {
  title: 'Mi Celebración',
  robots: { index: false, follow: true },
};

export default function MiCelebracionLayout({ children }) {
  return children;
}
