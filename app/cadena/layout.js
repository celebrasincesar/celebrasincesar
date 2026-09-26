// Panel interno de César — jamás debe aparecer en buscadores.
export const metadata = {
  title: 'La Cadena · Panel interno',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CadenaLayout({ children }) {
  return children;
}
