import './globals.css';
import { Nunito } from 'next/font/google';
import { STATS } from '../data/stats';
import { FAQS } from '../data/faqs';

// ── Fuente auto-alojada en Vercel (elimina la llamada extra a Google Fonts)
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-nunito',
});

// ── SEO: metadatos completos para Google, WhatsApp y redes sociales ──────────
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata = {
  metadataBase: new URL('https://celebrasincesar.cl'),
  icons: {
    icon: [
      { url: '/logo-alce.webp', type: 'image/webp' },
    ],
    apple: [
      { url: '/logo-alce.webp', type: 'image/webp' },
    ],
    shortcut: '/logo-alce.webp',
  },
  title: {
    default: 'Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    template: '%s | Celebra Sin Cesar',
  },
  description:
    'Cumpleaños infantiles en Las Condes con libertad total: arriendas el jardín y lo armas a tu manera, sin paquetes obligatorios. Piscina de pelotas gigante, tobogán, granja y adultos ilimitados.',
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
    title: 'Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    description:
      'Arriendas el lugar y armas el cumpleaños a tu manera — sin paquetes obligatorios. Piscina de pelotas gigante, tobogán, granja y adultos ilimitados.',
    url: 'https://celebrasincesar.cl',
    siteName: 'Celebra Sin Cesar',
    locale: 'es_CL',
    type: 'website',
    images: [
      {
        url: '/infra-piscina.webp',
        width: 800,
        height: 600,
        alt: 'Piscina de pelotas gigante de Alce Kids — cumpleaños infantiles en Las Condes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    description:
      'Arriendas el jardín y armas el cumpleaños a tu manera — sin paquetes obligatorios. Reserva online.',
    images: ['/infra-piscina.webp'],
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
  name: 'Celebra Sin Cesar',
  alternateName: 'Alce Kids Las Condes',
  legalName: 'CELEBRA SIN CESAR SpA',
  description:
    'Jardín de celebraciones infantiles en Las Condes, Santiago, con libertad total para los papás: arriendas el espacio y lo armas a tu manera, sin paquetes obligatorios. Piscina de pelotas gigante, tobogán, granja de animales, salón climatizado y adultos ilimitados.',
  url: 'https://celebrasincesar.cl',
  telephone: '+56944356955',
  email: 'celebracionesalce@gmail.com',
  image: 'https://celebrasincesar.cl/infra-piscina.webp',
  sameAs: [
    'https://www.instagram.com/celebracionesalce/',
    'https://www.google.com/maps?cid=660114253320051799',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: STATS.rating,
    reviewCount: STATS.reseñas,
    bestRating: '5',
  },
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
      dayOfWeek: ['Friday', 'Saturday', 'Sunday'],
      opens: '11:00',
      closes: '18:30',
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

// ── Schema.org: FAQPage — habilita rich results de preguntas frecuentes en Google
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={nunito.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className={`${nunito.className} antialiased`}>{children}</body>
    </html>
  );
}
