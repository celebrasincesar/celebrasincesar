// Página privada de resultado de un pago — no debe aparecer en buscadores.
export const metadata = {
  title: 'Tu reserva',
  robots: { index: false, follow: true },
};

export default function ResultadoPagoLayout({ children }) {
  return children;
}
