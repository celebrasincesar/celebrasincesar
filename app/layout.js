import './globals.css';
import { Nunito } from 'next/font/google';

// ── Fuente auto-alojada en Vercel (elimina la llamada extra a Google Fonts)
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-nunito',
});

// ── SEO: metadatos completos para Google, WhatsApp y redes sociales ──────────
export const metadata = {
  metadataBase: new URL('https://celebrasincesar.cl'),
  title: {
    default: 'Celebra Sin César | Cumpleaños Infantiles Las Condes',
    template: '%s | Celebra Sin César',
  },
  description:
    'El jardín más completo para cumpleaños infantiles en Las Condes. Piscina de pelotas gigante, tobogán, granja de animales, salón A/C y adultos ilimitados. ¡Reserva online en minutos!',
  keywords: [
    'cumpleaños infantiles Las Condes',
    'fiestas infantiles sector oriente Santiago',
    'jardín cumpleaños niños Las Condes',
    'celebraciones infantiles Vitacura',
    'cumpleaños niños Providencia',
    'piscina de pelotas cumpleaños Santiago',
    'Alce Kids',
    'celebra sin cesar',
    'cumpleaños niños Lo Barnechea',
  ],
  openGraph: {
    title: 'Celebra Sin César | Cumpleaños Infantiles Las Condes',
    description:
      'Piscina de pelotas gigante, tobogán, granja de animales y más. Adultos ilimitados, privacidad total. Reserva online.',
    url: 'https://celebrasincesar.cl',
    siteName: 'Celebra Sin César',
    locale: 'es_CL',
    type: 'website',
    images: [
      {
        url: '/logo-celebra.png',
        width: 1200,
        height: 630,
        alt: 'Celebra Sin César - Cumpleaños Infantiles Las Condes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Celebra Sin César | Cumpleaños Infantiles Las Condes',
    description:
      'El jardín más completo para cumpleaños de niños en Las Condes. Reserva online.',
    images: ['/logo-celebra.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://celebrasincesar.cl',
  },
  verification: {
    google: 'JarfBZN5S6AN9rRQu8YmaUesPlcqJazlXWttsJBl22A',
  },
  other: {
    'geo.region': 'CL-RM',
    'geo.placename': 'Las Condes, Santiago, Chile',
    'geo.position': '-33.4103966;-70.5469409',
    'ICBM': '-33.4103966, -70.5469409',
  },
};

// ── Schema.org: LocalBusiness — crucial para aparecer en Google Maps y búsquedas locales ──
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['EventVenue', 'LocalBusiness'],
  name: 'Celebra Sin César',
  alternateName: 'Alce Kids Las Condes',
  description:
    'Jardín de celebraciones infantiles en Las Condes, Santiago. Piscina de pelotas gigante, tobogán, granja de animales, salón climatizado y adultos ilimitados.',
  url: 'https://celebrasincesar.cl',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Talavera de la Reina 380',
    addressLocality: 'Las Condes',
    addressRegion: 'Región Metropolitana',
    addressCountry: 'CL',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -33.4103966,
    longitude: -70.5469409,
  },
  areaServed: [
    { '@type': 'City', name: 'Las Condes' },
    { '@type': 'City', name: 'Vitacura' },
    { '@type': 'City', name: 'Providencia' },
    { '@type': 'City', name: 'Lo Barnechea' },
    { '@type': 'City', name: 'La Reina' },
  ],
  priceRange: '$$',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Saturday', 'Sunday'],
      opens: '10:00',
      closes: '20:00',
    },
  ],
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Piscina de Pelotas Gigante', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Tobogán Gigante', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Granja con Animales', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Salón Climatizado', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Adultos Ilimitados', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Privacidad Total', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Estacionamiento', value: true },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={nunito.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className={`${nunito.className} antialiased`}>{children}</body>
    </html>
  );
}
