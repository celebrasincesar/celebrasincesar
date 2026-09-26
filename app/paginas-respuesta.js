// ══════════════════════════════════════════════════════════════════════
// PÁGINAS-RESPUESTA — piezas compartidas
// ──────────────────────────────────────────────────────────────────────
// Son las páginas que César manda por WhatsApp cuando le preguntan algo:
// /incluye, /valores, /horarios, /mayores-de-6, /lluvia, /visitar,
// /ubicacion, /como-reservar y /preguntas.
//
// Reglas de estas páginas:
//   · cortas y mobile-first;
//   · un solo CTA relevante;
//   · NUNCA repiten un precio, un horario ni una regla a mano: todo sale
//     de data/master.js y data/reglas.js;
//   · son server components (cero JavaScript de cliente).
// ══════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { NEGOCIO } from '../data/master';

export const WA = (texto) =>
  `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(texto)}`;

// Todas las páginas-respuesta, en el orden del centro de preguntas.
export const RESPUESTAS = [
  { slug: 'incluye',       emoji: '✨', titulo: 'Qué incluye el arriendo',  resumen: 'Todo lo que viene en el precio, sin costos ocultos.' },
  { slug: 'valores',       emoji: '💰', titulo: 'Valores y tramos',          resumen: 'Cómo se calcula el valor de tu celebración.' },
  { slug: 'horarios',      emoji: '🕐', titulo: 'Días y horarios',           resumen: 'Cuándo celebramos y a qué hora puedes llegar.' },
  { slug: 'mayores-de-6',  emoji: '🎉', titulo: 'Vienen niños mayores de 6', resumen: 'Cómo preparamos entretención para los hermanos grandes.' },
  { slug: 'lluvia',        emoji: '🌧️', titulo: 'Si llueve',                 resumen: 'Qué pasa con tu reserva y tu anticipo.' },
  { slug: 'como-reservar', emoji: '📅', titulo: 'Cómo reservar',             resumen: 'El proceso completo, paso a paso.' },
  { slug: 'visitar',       emoji: '👀', titulo: 'Visitar el lugar',          resumen: 'Ven a conocerlo antes de decidir.' },
  { slug: 'ubicacion',     emoji: '📍', titulo: 'Dónde estamos',             resumen: 'Dirección, mapa y estacionamiento.' },
];

// Migas de pan en JSON-LD: le dicen a Google dónde vive cada página dentro
// del sitio y suelen mostrarse en el resultado de búsqueda (§BO).
export function migas(pasos) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: pasos.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.nombre,
      item: `${NEGOCIO.sitio}${p.ruta}`,
    })),
  };
}

// ── Marco común ───────────────────────────────────────────────────────
export function Pagina({ emoji, titulo, bajada, children, cta, slug }) {
  const ruta = slug ? [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Preguntas frecuentes', ruta: '/preguntas' },
    ...(slug === 'preguntas' ? [] : [{ nombre: titulo, ruta: `/${slug}` }]),
  ] : null;

  return (
    <main className="min-h-screen" style={{ background: '#F8FAFF' }}>
      {ruta && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(migas(ruta)) }}
        />
      )}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(21,101,192,0.1)' }}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-alce.webp" alt="" className="w-7 h-7 rounded-xl object-cover" />
          <span className="font-black text-sm" style={{ color: '#1565C0' }}>Alce Kids</span>
        </Link>
        <Link href="/armar" className="text-xs font-black px-3.5 py-2 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
          Armar mi celebración
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-16">
        <div className="text-4xl mb-3">{emoji}</div>
        <h1 className="text-3xl md:text-4xl font-black leading-tight" style={{ color: '#0D1B3E' }}>
          {titulo}
        </h1>
        {bajada && <p className="text-gray-500 mt-2 leading-relaxed">{bajada}</p>}

        <div className="mt-8 space-y-6">{children}</div>

        {cta && <div className="mt-10">{cta}</div>}

        <nav className="mt-12 pt-6" style={{ borderTop: '1px solid rgba(21,101,192,0.12)' }}>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
            Otras preguntas
          </p>
          <div className="flex flex-wrap gap-2">
            {RESPUESTAS.map((r) => (
              <Link key={r.slug} href={`/${r.slug}`}
                className="text-xs font-bold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-70"
                style={{ background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                {r.emoji} {r.titulo}
              </Link>
            ))}
            <Link href="/preguntas"
              className="text-xs font-bold px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(249,115,22,0.1)', color: '#C2410C' }}>
              Ver todas →
            </Link>
          </div>
        </nav>
      </div>
    </main>
  );
}

// ── Bloques reutilizables ─────────────────────────────────────────────
// Acentos con contraste legible sobre blanco (naranja/verde de marca puros no llegan a 4.5:1).
const ACENTO_LEGIBLE = { '#F97316': '#C2410C', '#16a34a': '#15803D' };

export function Tarjeta({ titulo, children, acento = '#1565C0' }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      {titulo && <p className="font-black mb-2" style={{ color: ACENTO_LEGIBLE[acento] || acento }}>{titulo}</p>}
      <div className="text-gray-600 text-sm leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

export function Checks({ items, color = '#22c55e' }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-sm text-gray-600">
          <span style={{ color }} className="flex-shrink-0">✓</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaArmar({ texto = 'Armar mi celebración', nota }) {
  return (
    <div>
      <Link href="/armar"
        className="block w-full text-center text-white font-black py-4 rounded-2xl transition-transform hover:scale-[1.01]"
        style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
        {texto} →
      </Link>
      {nota && <p className="text-xs text-gray-500 text-center mt-2.5">{nota}</p>}
    </div>
  );
}

export function CtaWhatsApp({ texto = 'Escríbenos por WhatsApp', mensaje, nota }) {
  return (
    <div>
      <a href={WA(mensaje)} target="_blank" rel="noopener noreferrer"
        className="block w-full text-center text-white font-black py-4 rounded-2xl transition-transform hover:scale-[1.01]"
        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
        {texto}
      </a>
      {nota && <p className="text-xs text-gray-500 text-center mt-2.5">{nota}</p>}
    </div>
  );
}

// Metadata consistente para todas: canonical propio y sin www (§BL).
export const metaRespuesta = (slug, title, description) => ({
  title,
  description,
  alternates: { canonical: `${NEGOCIO.sitio}/${slug}` },
  openGraph: {
    title: `${title} | ${NEGOCIO.nombre}`,
    description,
    url: `${NEGOCIO.sitio}/${slug}`,
  },
});
