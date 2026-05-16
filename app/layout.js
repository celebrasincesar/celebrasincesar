import './globals.css';

export const metadata = {
  title: 'Celebra Sin Cesar | Celebraciones Infantiles Las Condes',
  description: 'El mejor espacio para celebrar el cumpleaños de tu hijo en Las Condes, Santiago. Alce Kids: para niños de 0 a 6 años.',
  keywords: 'cumpleaños infantiles Las Condes, celebraciones niños Santiago, Alce Kids',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
