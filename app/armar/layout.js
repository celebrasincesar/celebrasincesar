// /armar renderiza el mismo componente que la home (entra directo al wizard).
// Canonical hacia la home: evita que Google lo trate como contenido duplicado
// y consolida toda la autoridad SEO en celebrasincesar.cl
export const metadata = {
  title: 'Arma tu celebración',
  alternates: {
    canonical: 'https://celebrasincesar.cl',
  },
};

export default function ArmarLayout({ children }) {
  return children;
}
