import './globals.css';
import { Nunito } from 'next/font/google';
import { STATS } from '../data/stats';
import { FAQS } from '../data/faqs';
import { NEGOCIO } from '../data/master';
import Analytics from './analytics';

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
    default: 'Alce Kids · Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    template: '%s | Celebra Sin Cesar',
  },
  description:
    'Cumpleaños infantiles en Las Condes: arriendas el jardín y armas tu celebración a tu manera, sumando solo lo que necesitas. Piscina de pelotas gigante, tobogán, granja y adultos sin costo adicional.',
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
    title: 'Alce Kids · Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    description:
      'Arriendas el lugar y armas el cumpleaños a tu manera, sumando solo lo que necesitas. Piscina de pelotas gigante, tobogán, granja y adultos sin costo adicional.',
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
    title: 'Alce Kids · Celebra Sin Cesar | Cumpleaños Infantiles Las Condes',
    description:
      'Arriendas el jardín y armas el cumpleaños a tu manera, sumando solo lo que necesitas. Reserva online.',
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

// ── Schema.org (§BM, §BO) ─────────────────────────────────────────────────
// Nombre, dirección, teléfono y horarios salen de NEGOCIO (data/master.js) y
// las reseñas de STATS: cero datos escritos a mano acá. Si cambia el negocio,
// cambia el schema solo — que es justo lo que Google necesita para confiar.

const direccionSchema = {
  '@type': 'PostalAddress',
  streetAddress: NEGOCIO.direccion.calle,
  addressLocality: NEGOCIO.direccion.comuna,
  addressRegion: NEGOCIO.direccion.region,
  addressCountry: NEGOCIO.direccion.pais,
};

// La organización paraguas: Celebra Sin Cesar. Alce Kids es su recinto.
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${NEGOCIO.sitio}/#organizacion`,
  name: NEGOCIO.nombre,
  legalName: NEGOCIO.razonSocial,
  alternateName: NEGOCIO.venue,
  url: NEGOCIO.sitio,
  logo: `${NEGOCIO.sitio}/logo-celebra.webp`,
  email: NEGOCIO.email,
  telephone: NEGOCIO.telefonoE164,
  address: direccionSchema,
  sameAs: [NEGOCIO.instagram, NEGOCIO.mapa],
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['EventVenue', 'LocalBusiness'],
  '@id': `${NEGOCIO.sitio}/#recinto`,
  name: NEGOCIO.nombre,
  alternateName: `${NEGOCIO.venue} Las Condes`,
  legalName: NEGOCIO.razonSocial,
  parentOrganization: { '@id': `${NEGOCIO.sitio}/#organizacion` },
  description:
    `Recinto de ${NEGOCIO.superficieM2} m² para cumpleaños infantiles en ${NEGOCIO.direccion.comuna}, Santiago: ` +
    'piscina de pelotas gigante, tobogán, autopista, granja de animales, salón climatizado y adultos sin costo adicional. ' +
    'Arriendas el espacio y armas la celebración a tu manera.',
  url: NEGOCIO.sitio,
  telephone: NEGOCIO.telefonoE164,
  email: NEGOCIO.email,
  image: `${NEGOCIO.sitio}/infra-piscina.webp`,
  logo: `${NEGOCIO.sitio}/logo-alce.webp`,
  sameAs: [NEGOCIO.instagram, NEGOCIO.mapa],
  hasMap: NEGOCIO.mapa,
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: STATS.rating,
    reviewCount: STATS.reseñas,
    bestRating: '5',
  },
  address: direccionSchema,
  geo: {
    '@type': 'GeoCoordinates',
    latitude: NEGOCIO.direccion.lat,
    longitude: NEGOCIO.direccion.lng,
  },
  areaServed: ['Las Condes', 'Vitacura', 'Providencia', 'Lo Barnechea', 'La Reina']
    .map((name) => ({ '@type': 'City', name })),
  priceRange: '$$',
  currenciesAccepted: 'CLP',
  // Un bloque por turno: así Google entiende que son dos ventanas y no
  // una jornada continua de 11 a 18. El viernes tiene su propia tabla de
  // turnos (solo PM, horario distinto) — declararlo con NEGOCIO.diasSchema
  // completo diría que también abre AM los viernes, lo cual ya no es cierto
  // (documento "Autorización Fase 1A", 13-sep-2026, §11).
  openingHoursSpecification: [
    ...NEGOCIO.turnos.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: NEGOCIO.diasSchema.filter((d) => d !== 'Friday'),
      opens: t.desde,
      closes: t.hasta,
    })),
    ...NEGOCIO.turnosViernes.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Friday'],
      opens: t.desde,
      closes: t.hasta,
    })),
  ],
  amenityFeature: [
    'Piscina de pelotas gigante',
    'Tobogán gigante',
    'Autopista para autos eléctricos',
    'Granja con animales',
    'Salón climatizado',
    'Adultos sin costo adicional',
    'Uso exclusivo del sector contratado',
    'Estacionamiento',
  ].map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  audience: {
    '@type': 'PeopleAudience',
    suggestedMinAge: NEGOCIO.edades.min,
    suggestedMaxAge: NEGOCIO.edades.max,
  },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className={`${nunito.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
