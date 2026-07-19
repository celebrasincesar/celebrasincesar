'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { PRECIOS_BASE, PRECIOS_EXTRAS, CATEGORIAS_ADICIONALES, BLOQUES_VITRINA, MULTIPLICADORES } from '../data/master';
import { CARRUSEL, VITRINA } from '../data/imagenes';
import { STATS, INSTAGRAM_STRIP_TEXT, RESEÑAS_CORTO, RESEÑAS_LARGO } from '../data/stats';
import { TESTIMONIOS, GOOGLE_REVIEWS_URL } from '../data/testimonios';
import { FAQS } from '../data/faqs';
import { BloqueSection, FichaCarrusel } from './adicionales-grid';

// ── Lookup rápido de items por ID (para resolver grupos de la vitrina)
const ITEM_LOOKUP = Object.fromEntries(
  CATEGORIAS_ADICIONALES.flatMap((c) => c.items).map((item) => [item.id, item])
);
// Resuelve los itemIds de un grupo a objetos item completos
function resolveGrupo(grupo) {
  return { ...grupo, items: (grupo.itemIds || []).map((id) => ITEM_LOOKUP[id]).filter(Boolean) };
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
const clp = (n) => `$${n.toLocaleString('es-CL')}`;

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style={{ display: 'inline', verticalAlign: '-0.125em' }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// Resuelve el precio de un ítem según la capacidad de niños elegida.
// Si el ítem tiene `precios` (objeto por tier), usa ese tier.
// Fallback: campo `precio` legacy → 0.
const getPrecio = (item, cantNinos) => {
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};

// ── Incrementos de precio: edad + cantidad (sistema lineal +$15k/escalón) ──
const getAddEdad = (edadNino) => {
  if (!edadNino) return 0;
  const e = Number(edadNino);
  for (const r of MULTIPLICADORES.edad) {
    if (r.edades.includes(e)) return r.add;
  }
  return 0;
};
const getAddCantidad = (cantNinos) => {
  const r = MULTIPLICADORES.cantidad.find((c) => c.id === cantNinos);
  return r ? r.add : 0;
};

// Recargo total del cumpleaños compartido según nº de festejados (1/2/3)
const recargoFestejados = (n) => PRECIOS_EXTRAS.festejados_recargo?.[n] ?? 0;
// precio_final = base + add_edad + add_cantidad (solo si hay base válida)
const aplicarMult = (base, edadNino, cantNinos) =>
  base === 0 ? 0 : base + getAddEdad(edadNino) + getAddCantidad(cantNinos);

// Cuenta las fechas reservables (Vie/Sáb/Dom) aún libres en un mes:
// futuras y no bloqueadas en Google Calendar. Base de la urgencia honesta.
function contarFechasLibres(disponibilidad, anio, mes) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const blocked = disponibilidad?.blockedDates || [];
  let libres = 0;
  for (let dia = 1; dia <= diasMes; dia++) {
    const f = new Date(anio, mes, dia);
    const dow = f.getDay();
    if (!(dow === 0 || dow === 5 || dow === 6)) continue; // solo Vie/Sáb/Dom
    if (f < hoy) continue;
    const str = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (blocked.includes(str)) continue;
    libres++;
  }
  return libres;
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
// Días del calendario ahora internos al componente Calendario (Lun→Dom)

// ─────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────

function Header({ onHome }) {
  return (
    <header className="sticky top-0 z-50" style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(21,101,192,0.1)', boxShadow: '0 1px 20px rgba(21,101,192,0.08)' }}>
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <button onClick={onHome} className="group flex-shrink-0">
          <img
            src="/logo-celebra.webp"
            alt="Celebra Sin Cesar"
            className="h-14 w-auto group-hover:scale-105 transition-transform duration-200"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{display:'none'}} className="items-center gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow"
              style={{background:'linear-gradient(135deg,#1565C0,#29B9E8)'}}>
              <span className="text-xl">🐦</span>
            </div>
            <div className="leading-none">
              <div className="font-black text-lg" style={{color:'#F97316'}}>Celebra</div>
              <div className="font-black text-lg -mt-1" style={{color:'#29B9E8'}}>sin cesar</div>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-3">
          {/* La visita presencial convierte ~100% — CTA siempre visible en desktop */}
          <a
            href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría agendar una visita para conocer Alce Kids sin compromiso. ¿Qué día de esta semana te acomoda?')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full transition-all hover:scale-105"
            style={{ color: '#1565C0', border: '1.5px solid rgba(21,101,192,0.3)', background: 'rgba(21,101,192,0.05)' }}
          >
            📍 Agendar visita
          </a>
          <a
            href="https://wa.me/56944356955"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-sm font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 transition-all hover:scale-105 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}
          >
            <WaIcon /> WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// HERO VIDEO — sección de impacto
// Archivos genéricos en /public:
//   video-home.mp4   → video de fondo del hero
//   logo-celebra.png → logo principal
//   logo-alce.png    → logo Alce Kids
//   foto-jardin-1.webp, foto-jardin-2.webp, foto-jardin-3.webp → galería
// ─────────────────────────────────────────────
function HeroStatic({ onVerOpciones }) {
  return (
    <section
      className="relative flex items-center justify-center overflow-hidden"
      style={{ height: 'calc(100vh - 72px)', minHeight: '600px' }}
    >
      {/* Gradient fallback — siempre visible detrás de la foto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #0D2B6E 0%, #1565C0 45%, #0E6FA8 70%, #0D2B6E 100%)',
        }}
      />

      {/* Imagen de fondo — niños en la piscina de pelotas (celebración real,
          caras difuminadas = publicable). ART DIRECTION: vertical en móvil
          (se aprecia la escena completa), horizontal 16:9 en desktop.
          <picture> descarga SOLO la versión que corresponde al dispositivo. */}
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero-celebracion-movil.webp" />
        <img
          src="/hero-celebracion.webp"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </picture>

      {/* Overlay oscuro gradiente — contraste para logo y texto sobre la foto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(6,15,46,0.55) 0%, rgba(6,15,46,0.45) 40%, rgba(13,43,110,0.82) 100%)',
        }}
      />

      {/* Contenido centrado */}
      <div className="relative z-10 text-center px-6 flex flex-col items-center">

        {/* Logo principal grande */}
        <div className="mb-6">
          <img
            src="/logo-celebra.webp"
            alt="Celebra Sin Cesar"
            className="h-36 md:h-48 w-auto mx-auto"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            style={{
              filter:
                'drop-shadow(0 8px 32px rgba(0,0,0,0.45)) drop-shadow(0 2px 12px rgba(0,0,0,0.3))',
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          {/* Fallback si no existe el archivo */}
          <div style={{ display: 'none' }} className="flex-col items-center justify-center gap-3">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-2xl"
              style={{ background: 'linear-gradient(135deg,#F97316,#29B9E8)' }}
            >
              <span className="text-6xl">🐦</span>
            </div>
            <div className="mt-2 leading-none">
              <div className="font-black text-5xl md:text-6xl" style={{ color: '#F97316', textShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                Celebra
              </div>
              <div className="font-black text-5xl md:text-6xl -mt-2" style={{ color: '#29B9E8', textShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                sin cesar
              </div>
            </div>
          </div>
        </div>

        {/* Tagline — h1 de la home (único en la página, clave para SEO) */}
        <h1
          className="text-white/90 text-xl md:text-2xl font-black mb-2"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
        >
          Cumpleaños infantiles en Las Condes que tu hijo siempre recordará
        </h1>
        <p
          className="text-white/65 text-sm md:text-base mb-6 max-w-lg"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          La casa de cumpleaños más completa de Las Condes. Piscina de pelotas, tobogán, granja, adultos ilimitados —
          y <span className="text-white/90 font-bold">libertad total</span>: lo armas a tu manera, sin paquetes obligatorios.
        </p>

        {/* ── Franja de confianza — prueba social premium ── */}
        <div
          className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mb-9 px-5 py-2.5 rounded-2xl"
          style={{ background: 'rgba(6,15,46,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 8px 28px rgba(0,0,0,0.28)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm tracking-tight" style={{ color: '#FBBF24', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>★★★★★</span>
            <span className="text-white font-black text-sm">{STATS.rating}</span>
            <span className="text-white/55 text-xs font-semibold hidden sm:inline">en Google</span>
          </div>
          <div className="w-px h-4 hidden sm:block" style={{ background: 'rgba(255,255,255,0.22)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{STATS.reseñas}</span>
            <span className="text-white/55 text-xs font-semibold">reseñas reales</span>
          </div>
          <div className="w-px h-4 hidden sm:block" style={{ background: 'rgba(255,255,255,0.22)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{STATS.añosHistoria} años</span>
            <span className="text-white/55 text-xs font-semibold">en Las Condes</span>
          </div>
        </div>

        {/* Botón CTA */}
        <button
          onClick={onVerOpciones}
          className="group flex items-center gap-3 font-black text-base md:text-lg px-8 py-4 rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(90deg, #F97316 0%, #29B9E8 100%)',
            color: 'white',
            boxShadow:
              '0 8px 32px rgba(249,115,22,0.4), 0 2px 12px rgba(0,0,0,0.25)',
          }}
        >
          Ver cómo funciona ↓
        </button>

        {/* CTA visita sin compromiso */}
        <p className="text-white/45 text-xs mt-5">¿Primero quieres ver el lugar en persona?</p>
        <a
          href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría conocer Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/70 text-sm font-bold hover:text-white transition-colors mt-1"
          style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          Conocer el lugar sin compromiso →
        </a>
      </div>

      {/* Indicador de scroll animado */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce opacity-60">
        <div className="w-6 h-10 border-2 border-white/60 rounded-full flex justify-center pt-2">
          <div className="w-1.5 h-3 bg-white/80 rounded-full" />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// TESTIMONIOS — prueba social premium (reseñas reales desde data/testimonios.js)
// ─────────────────────────────────────────────
function Testimonios() {
  const tieneQuotes = TESTIMONIOS.length > 0;
  return (
    <div style={{ background: 'linear-gradient(160deg, #081529 0%, #0D1B3E 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 py-20">

        {/* Encabezado */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <span style={{ color: '#FBBF24', letterSpacing: '0.05em' }}>★★★★★</span>
            <span className="text-white font-black text-sm">{STATS.rating}</span>
            <span className="text-white/50 text-xs font-semibold">en Google</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
            Lo que dicen <span style={{ color: '#F97316' }}>las familias</span>
          </h2>
          <p className="text-white/45 text-base max-w-xl mx-auto">
            {STATS.reseñas} reseñas verificadas de familias del sector oriente que ya celebraron con nosotros — y +{STATS.seguidores} nos siguen en Instagram.
          </p>
        </div>

        {/* Tarjetas de reseñas reales (aparecen al llenar data/testimonios.js) */}
        {tieneQuotes && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12 max-w-5xl mx-auto">
            {TESTIMONIOS.slice(0, 6).map((t, i) => (
              <div key={i} className="rounded-3xl p-6 flex flex-col"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="mb-3 text-sm" style={{ color: '#FBBF24', letterSpacing: '0.08em' }}>
                  {'★'.repeat(t.estrellas || 5)}
                </div>
                <p className="text-white/80 text-sm leading-relaxed flex-1 mb-5">“{t.texto}”</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#29B9E8)' }}>
                    {(t.nombre || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm leading-none">{t.nombre}</div>
                    <div className="text-white/35 text-xs mt-1">Reseña verificada · Google</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA a Google */}
        <div className="flex justify-center">
          <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 font-black px-7 py-4 rounded-full text-white text-sm transition-all hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)' }}>
            <span style={{ color: '#FBBF24' }}>★</span>
            {tieneQuotes ? `Ver las ${STATS.reseñas} reseñas en Google` : `Lee las ${STATS.reseñas} reseñas reales en Google`}
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PREGUNTAS FRECUENTES — desactiva objeciones, refuerza la libertad
// Datos en data/faqs.js (compartidos con el schema FAQPage de layout.js)
// ─────────────────────────────────────────────
function FAQ() {
  const [abierto, setAbierto] = useState(0);
  return (
    <div id="faq" className="scroll-mt-20" style={{ background: 'linear-gradient(180deg, #0D1B3E 0%, #081529 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
            Preguntas <span style={{ color: '#F97316' }}>frecuentes</span>
          </h2>
          <p className="text-white/45 text-base">Todo claro antes de reservar — sin letra chica.</p>
        </div>
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const open = abierto === i;
            return (
              <div key={i} className="rounded-2xl overflow-hidden transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${open ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                <button onClick={() => setAbierto(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                  <span className="text-white font-black text-base leading-snug">{f.q}</span>
                  <span className="text-2xl flex-shrink-0 font-black transition-transform duration-300"
                    style={{ color: '#F97316', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {open && (
                  <div className="px-6 pb-5 -mt-1">
                    <p className="text-white/55 text-sm leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CÓMO FUNCIONA + CIERRE — 3 pasos y doble CTA (reservar / visitar)
// ─────────────────────────────────────────────
function ComoFuncionaCTA() {
  const waVisita = `https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría conocer Alce Kids sin compromiso antes de reservar. ¿Cuándo puedo pasar a visitarlo?')}`;
  const pasos = [
    { n: '1', t: 'Elige tu fecha y horario', d: 'Ves la disponibilidad real al instante.' },
    { n: '2', t: 'Arma tu celebración', d: 'A tu manera: trae lo tuyo o suma adicionales.' },
    { n: '3', t: 'Confirma por WhatsApp', d: 'Coordinas todo directo con César. Listo.' },
  ];
  return (
    <div style={{ background: 'linear-gradient(160deg, #081529 0%, #0D2B6E 100%)' }}>
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight">
          Reservar es <span style={{ color: '#F97316' }}>así de simple</span>
        </h2>
        <p className="text-white/45 text-base mb-12">Tres pasos, menos de dos minutos.</p>
        <div className="grid md:grid-cols-3 gap-5 mb-14">
          {pasos.map((p) => (
            <div key={p.n} className="rounded-3xl p-7"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl mb-4 mx-auto"
                style={{ background: 'linear-gradient(135deg,#1565C0,#29B9E8)', boxShadow: '0 4px 16px rgba(21,101,192,0.4)' }}>
                {p.n}
              </div>
              <h3 className="text-white font-black text-lg mb-1.5">{p.t}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a href="/armar"
            className="font-black text-base px-8 py-4 rounded-full text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(90deg, #F97316, #29B9E8)', boxShadow: '0 8px 28px rgba(249,115,22,0.4)' }}>
            ✨ Armar mi celebración →
          </a>
          <a href={waVisita} target="_blank" rel="noopener noreferrer"
            className="font-bold text-sm px-6 py-4 rounded-full text-white/80 transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)' }}>
            O conoce el lugar sin compromiso →
          </a>
        </div>
        <p className="text-white/40 text-sm mt-7">
          ¿El cumpleaños es más adelante?{' '}
          <a
            href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola! 😊 El cumple de mi hij@ es más adelante, pero me gustaría apartar la fecha con anticipación. ¿Me avisan cuando se acerque?')}`}
            target="_blank" rel="noopener noreferrer"
            className="font-bold transition-colors hover:text-white"
            style={{ color: '#29B9E8', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Apártalo con anticipación 🔔
          </a>
        </p>
      </div>
    </div>
  );
}

function CardInicio({ onSelect }) {
  const opcionesRef = useRef(null);

  const scrollToOpciones = () => {
    opcionesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* ── SECCIÓN HERO VIDEO ─────────────────── */}
      <HeroStatic onVerOpciones={scrollToOpciones} />

      {/* ── SECCIÓN OPCIONES ──────────────────── */}
      <div
        ref={opcionesRef}
        className="scroll-mt-20"
        style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 55%, #081529 100%)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-20">

          {/* Encabezado */}
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 font-bold text-xs px-4 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(41,185,232,0.12)', color: '#29B9E8', border: '1px solid rgba(41,185,232,0.25)' }}
            >
              📍 Las Condes · Santiago de Chile
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight mb-4 text-white">
              El cumpleaños que tu hijo
              <br />
              <span style={{ color: '#F97316' }}>nunca olvidará</span>
            </h2>
            <p className="text-white/45 text-base max-w-lg mx-auto">
              Elige tu opción, arma la celebración completa y confirma en minutos — sin llamadas, sin burocracia.
            </p>
          </div>

          {/* ── GRID DE TARJETAS ────────────────── */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">

            {/* ─ ALCE KIDS — PREMIUM FEATURED ─ */}
            <div
              onClick={() => onSelect('alce')}
              className="rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-2 group relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(21,101,192,0.35) 0%, rgba(41,185,232,0.12) 100%)',
                border: '1px solid rgba(41,185,232,0.4)',
                boxShadow: '0 0 60px rgba(41,185,232,0.12), 0 24px 64px rgba(0,0,0,0.55)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(249,115,22,0.6)';
                e.currentTarget.style.boxShadow = '0 0 80px rgba(249,115,22,0.18), 0 24px 64px rgba(0,0,0,0.65)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(41,185,232,0.4)';
                e.currentTarget.style.boxShadow = '0 0 60px rgba(41,185,232,0.12), 0 24px 64px rgba(0,0,0,0.55)';
              }}
            >
              {/* Glow hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% -10%, rgba(249,115,22,0.1) 0%, transparent 65%)' }} />

              {/* Badge DISPONIBLE */}
              <div className="absolute top-4 right-4 text-xs font-black px-2.5 py-1 rounded-full shadow-lg"
                style={{ background: 'rgba(34,197,94,0.9)', color: 'white' }}>
                ✓ DISPONIBLE
              </div>

              {/* Stars Google */}
              <div className="absolute top-4 left-4 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-xs" style={{ color: '#FBBF24' }}>★</span>
                ))}
                <span className="text-xs font-black text-white/60 ml-1">{STATS.rating}</span>
              </div>

              {/* Contenido */}
              <div className="p-8 pt-12">
                <div className="w-28 h-28 mx-auto mb-5 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                  <img src="/logo-alce.webp" alt="Alce Kids" className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  <div style={{ display: 'none' }} className="w-full h-full rounded-2xl items-center justify-center text-5xl bg-blue-900">🦌</div>
                </div>

                <h2 className="text-2xl font-black text-center mb-1 text-white">Alce Kids</h2>
                <p className="font-bold text-center text-sm mb-1" style={{ color: '#29B9E8' }}>Recinto exclusivo · 0 a 6 años · Las Condes</p>
                <p className="text-white/40 text-xs text-center mb-5">Talavera de la Reina 380 · cerca Metro Los Dominicos</p>

                {/* Mini features */}
                <div className="grid grid-cols-2 gap-1.5 mb-6 text-xs">
                  {['🎱 Piscina de pelotas', '🛝 Gran tobogán', '🚗 Autopista kids', '🐰 Granja animales'].map((f) => (
                    <div key={f} className="px-2 py-1.5 rounded-lg text-white/55 font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {f}
                    </div>
                  ))}
                </div>

                <div className="font-black py-3.5 rounded-2xl text-center text-white text-sm group-hover:scale-[1.02] transition-transform"
                  style={{ background: 'linear-gradient(90deg, #1565C0, #29B9E8)', boxShadow: '0 4px 20px rgba(21,101,192,0.4)' }}>
                  Ver el recinto y armar mi celebración →
                </div>
              </div>
            </div>

            {/* ─ ALCE ARENA (7+) — PRÓXIMAMENTE + WAITLIST ─ */}
            <a
              href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola! 🔔 Me interesa Alce Arena (celebraciones 7+ años). Avísenme cuando abra, por favor 😊')}`}
              target="_blank" rel="noopener noreferrer"
              className="rounded-3xl relative overflow-hidden block transition-all duration-300 hover:-translate-y-1 group"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="absolute top-4 right-4 z-10 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                PRÓXIMAMENTE
              </div>
              <div className="px-8 pt-8 pb-2" style={{ filter: 'blur(0.5px) grayscale(0.6)', opacity: 0.45 }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-5xl">🏟️</span>
                </div>
                <h2 className="text-2xl font-black text-white text-center mb-1">Alce Arena</h2>
                <p className="text-white/50 font-bold text-center text-sm mb-3">Para los más grandes · 7+ años</p>
                <p className="text-white/40 text-sm text-center">Deportes, gaming, inflables y autos eléctricos pensados para niños mayores.</p>
              </div>
              <div className="px-8 pb-8 pt-3">
                <div className="py-3 rounded-2xl text-center text-sm font-black transition-all group-hover:scale-[1.02]"
                  style={{ background: 'rgba(41,185,232,0.12)', color: '#29B9E8', border: '1px solid rgba(41,185,232,0.3)' }}>
                  🔔 Avísame cuando abra
                </div>
              </div>
            </a>

            {/* ─ ALCE GO (a domicilio) — PRÓXIMAMENTE + WAITLIST ─ */}
            <a
              href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola! 🔔 Me interesa Alce Go (celebraciones a domicilio). Avísenme cuando abra, por favor 😊')}`}
              target="_blank" rel="noopener noreferrer"
              className="rounded-3xl relative overflow-hidden block transition-all duration-300 hover:-translate-y-1 group"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="absolute top-4 right-4 z-10 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                PRÓXIMAMENTE
              </div>
              <div className="px-8 pt-8 pb-2" style={{ filter: 'blur(0.5px) grayscale(0.6)', opacity: 0.45 }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-5xl">🚚</span>
                </div>
                <h2 className="text-2xl font-black text-white text-center mb-1">Alce Go</h2>
                <p className="text-white/50 font-bold text-center text-sm mb-3">Celebramos donde tú quieras</p>
                <p className="text-white/40 text-sm text-center">Llevamos los inflables, autos eléctricos y juegos a tu casa o el lugar que elijas.</p>
              </div>
              <div className="px-8 pb-8 pt-3">
                <div className="py-3 rounded-2xl text-center text-sm font-black transition-all group-hover:scale-[1.02]"
                  style={{ background: 'rgba(41,185,232,0.12)', color: '#29B9E8', border: '1px solid rgba(41,185,232,0.3)' }}>
                  🔔 Avísame cuando abra
                </div>
              </div>
            </a>
          </div>

          {/* ── Libertad — diferenciación premium ── */}
          <div className="mt-20 mb-2 max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 font-bold text-xs px-4 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.25)' }}>
              🔓 La diferencia Alce Kids
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
              Arriendas el lugar.
              <br />
              <span style={{ color: '#F97316' }}>El cumpleaños lo armas tú.</span>
            </h2>
            <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto mb-12">
              Aquí no hay paquetes obligatorios ni combos cerrados. Reservas el espacio completo y lo celebras a tu manera:
              trae tu torta, tu decoración y tu comida — o lo organizamos nosotros por ti. Tú tienes el control.
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: '🔓', title: 'Sin paquetes obligatorios', desc: 'Pagas por el espacio, no por un combo que no elegiste.' },
                { icon: '🎒', title: 'Trae lo que quieras', desc: 'Tu torta, tu banquetería, tu decoración — sin recargo por traer de afuera.' },
                { icon: '🎀', title: 'O lo armamos por ti', desc: '¿Prefieres no preocuparte de nada? Eliges adicionales y lo dejamos todo listo.' },
              ].map((p) => (
                <div key={p.title} className="rounded-3xl p-7 text-left"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-3xl mb-3">{p.icon}</div>
                  <h3 className="text-white font-black text-lg mb-1.5">{p.title}</h3>
                  <p className="text-white/45 text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats — números grandes con glow */}
          <div className="flex flex-wrap justify-center gap-12 mt-16 pt-14"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { num: String(STATS.reseñas), label: `Reseñas ⭐ ${STATS.rating} en Google`, color: '#F97316' },
              { num: `${STATS.añosHistoria}+`, label: 'Años en Las Condes', color: '#29B9E8' },
              { num: '100%', label: 'Adultos incluidos siempre', color: '#F97316' },
              { num: 'Vie · Sáb · Dom', label: 'Horario AM y PM disponible', color: '#29B9E8' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-4xl font-black mb-1.5" style={{ color: s.color, textShadow: `0 0 28px ${s.color}66` }}>
                  {s.num}
                </div>
                <div className="text-white/35 text-sm font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TESTIMONIOS — prueba social ──────────────────────── */}
      <Testimonios />

      {/* ── PREGUNTAS FRECUENTES ─────────────────────────────── */}
      <FAQ />

      {/* ── CÓMO FUNCIONA + CIERRE ───────────────────────────── */}
      <ComoFuncionaCTA />

      {/* ── INSTAGRAM STRIP ──────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-white font-black text-xl mb-1.5">📸 Síguenos en Instagram</p>
            <p style={{ color: 'rgba(255,255,255,0.45)' }} className="text-sm">{INSTAGRAM_STRIP_TEXT}</p>
          </div>
          <a
            href="https://www.instagram.com/celebracionesalce/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black px-8 py-3.5 rounded-full text-white text-sm transition-all hover:scale-105 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F97316, #29B9E8)', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}
          >
            Ver galería de celebraciones →
          </a>
        </div>
      </div>

    </div>
  );
}

function Calendario({ fecha, onFecha, disponibilidad = { blockedDates: [], blockedAM: [], blockedPM: [] } }) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  // Apertura inteligente: si al mes actual ya no le quedan fechas reservables
  // (Vie/Sáb/Dom futuras), abre el calendario directo en el mes siguiente.
  const inicio = (() => {
    let im = hoy.getMonth(), iy = hoy.getFullYear();
    const diasMes = new Date(iy, im + 1, 0).getDate();
    let libres = 0;
    for (let d = hoy.getDate(); d <= diasMes; d++) {
      const dow = new Date(iy, im, d).getDay();
      if (dow === 0 || dow === 5 || dow === 6) libres++;
    }
    if (libres === 0) { im++; if (im > 11) { im = 0; iy++; } }
    return { im, iy };
  })();
  const [mes, setMes] = useState(inicio.im);
  const [anio, setAnio] = useState(inicio.iy);

  // Semana empieza el LUNES: Sun=0→6, Mon=1→0, Tue=2→1 … Sat=6→5
  const primerDia = new Date(anio, mes, 1).getDay();
  const primerDiaOffset = (primerDia + 6) % 7;
  const diasMes = new Date(anio, mes + 1, 0).getDate();

  const prev = () => {
    if (mes === 0) { setMes(11); setAnio((y) => y - 1); }
    else setMes((m) => m - 1);
  };
  const next = () => {
    if (mes === 11) { setMes(0); setAnio((y) => y + 1); }
    else setMes((m) => m + 1);
  };

  // Lun Mar Mié Jue Vie | Sáb Dom (fin de semana juntos al final)
  const CABECERAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="w-full max-w-xs select-none">

      {/* ── Espirales decorativas (estilo agenda de eventos) ── */}
      <div className="flex justify-around px-5">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="relative flex flex-col items-center"
          >
            {/* Tallo de la espiral */}
            <div
              className="w-0.5 h-2 rounded-full"
              style={{ background: '#29B9E8', opacity: 0.5 }}
            />
            {/* Círculo de la espiral */}
            <div
              className="w-3.5 h-3.5 rounded-full border-2 -mt-0.5"
              style={{
                borderColor: '#29B9E8',
                background: 'white',
                boxShadow: '0 1px 3px rgba(41,185,232,0.25)',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Cuerpo de la agenda ── */}
      <div
        className="bg-white rounded-2xl rounded-tl-none rounded-tr-none border-2 shadow-lg overflow-hidden"
        style={{
          borderColor: '#CBE9F8',
          borderTopColor: '#29B9E8',
          borderTopWidth: '3px',
        }}
      >
        {/* Franja superior de color (encuaderna las espirales) */}
        <div
          className="h-1.5 w-full"
          style={{ background: 'linear-gradient(90deg,#1565C0,#29B9E8)' }}
        />

        <div className="px-4 pt-3 pb-4">
          {/* Navegación mes/año */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prev}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-700 font-bold text-lg transition-colors"
            >
              ‹
            </button>
            <span className="font-black text-blue-900 text-sm tracking-wide">
              {MESES[mes]} {anio}
            </span>
            <button
              onClick={next}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-50 text-blue-700 font-bold text-lg transition-colors"
            >
              ›
            </button>
          </div>

          {/* Cabeceras de día: Lun→Vie normal, Sáb+Dom en naranja */}
          <div className="grid grid-cols-7 mb-1.5">
            {CABECERAS.map((d, i) => (
              <div
                key={d}
                className="text-center text-xs font-black py-0.5"
                style={{ color: i >= 5 ? '#F97316' : i === 4 ? '#29B9E8' : '#9CA3AF' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {/* Celdas vacías hasta el primer día */}
            {Array.from({ length: primerDiaOffset }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {/* Días del mes */}
            {Array.from({ length: diasMes }).map((_, i) => {
              const dia = i + 1;
              const f = new Date(anio, mes, dia);
              const dow = f.getDay(); // 0=Dom, 5=Vie, 6=Sáb
              const esDisponible = dow === 0 || dow === 5 || dow === 6;
              const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const diaCerrado = disponibilidad.blockedDates.includes(fechaStr);
              const bloqueado = !esDisponible || f < hoy || diaCerrado;
              const seleccionado = fecha && f.toDateString() === fecha.toDateString();

              return (
                <button
                  key={dia}
                  disabled={bloqueado}
                  onClick={() => onFecha(f)}
                  className="w-full aspect-square rounded-lg text-xs font-bold transition-all"
                  style={
                    seleccionado
                      ? {
                          background: 'linear-gradient(135deg,#1565C0,#29B9E8)',
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(21,101,192,0.35)',
                        }
                      : diaCerrado
                      ? { color: '#FCA5A5', cursor: 'not-allowed', textDecoration: 'line-through' } // CERRADO/BLOQUEADO — tachado
                      : bloqueado
                      ? { color: '#E5E7EB', cursor: 'not-allowed' }
                      : dow === 5
                      ? { color: '#29B9E8', cursor: 'pointer' }    // Viernes — cyan
                      : esDisponible
                      ? { color: '#F97316', cursor: 'pointer' }    // Sáb + Dom — naranja
                      : { color: '#D1D5DB', cursor: 'not-allowed' }
                  }
                  onMouseEnter={(e) => {
                    if (!bloqueado && !seleccionado)
                      e.currentTarget.style.background = '#FFF7ED';
                  }}
                  onMouseLeave={(e) => {
                    if (!bloqueado && !seleccionado)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#29B9E8' }} />
              <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Viernes</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
              <span className="text-xs font-semibold" style={{ color: '#9CA3AF' }}>Sábado · Domingo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pasos({ actual, total }) {
  const labels = ['Fecha', 'Festejado', 'Invitados', 'Adicionales', 'Confirmar'];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {Array.from({ length: total }).map((_, i) => {
        const done    = i < actual;
        const current = i === actual;
        return (
          <div key={i} className="flex items-center">
            {/* Círculo numerado */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300"
                style={{
                  background: done ? '#1565C0' : current ? '#F97316' : '#E5E7EB',
                  color:      done ? 'white'    : current ? 'white'   : '#9CA3AF',
                  boxShadow:  current ? '0 0 0 4px rgba(249,115,22,0.2)' : 'none',
                  transform:  current ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className="text-xs font-bold hidden md:block"
                style={{ color: current ? '#F97316' : done ? '#1565C0' : '#D1D5DB' }}
              >
                {labels[i]}
              </span>
            </div>
            {/* Línea conectora */}
            {i < total - 1 && (
              <div
                className="h-0.5 w-8 md:w-12 mx-1 mb-5 transition-all duration-300"
                style={{ background: i < actual ? '#1565C0' : '#E5E7EB' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResumenLateral({ estado, total, onWhatsApp }) {
  const { fecha, hora, festejados, nombreNino, edadNino, cantNinos, sector, extras, usaCocina, packCelebra, horaExtra, ninosExtra } = estado;
  const esSabado = fecha?.getDay() === 6;

  // Precio base — tabla diferenciada viernes/domingo vs sábado + multiplicadores edad/cantidad
  const _baseRaw_lateral =
    sector === 'independiente'                         ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente) :
    (sector === 'completo' && cantNinos === 'hasta10') ? (esSabado ? PRECIOS_BASE.completo_10_sab  : PRECIOS_BASE.completo_10) :
    cantNinos === 'hasta20'                            ? (esSabado ? PRECIOS_BASE.completo_20_sab  : PRECIOS_BASE.completo_20) :
    (cantNinos === 'hasta30' || cantNinos === 'mas30') ? (esSabado ? PRECIOS_BASE.completo_30_sab  : PRECIOS_BASE.completo_30) : 0;
  const precioBase = aplicarMult(_baseRaw_lateral, edadNino, cantNinos);
  const precioBaseVisible = precioBase;

  const sectorLabel = sector === 'independiente' ? 'Sector Independiente' : 'Jardín Completo';

  const cantNinosLabel =
    cantNinos === 'hasta10' ? 'Hasta 10' :
    cantNinos === 'hasta20' ? 'Hasta 20' :
    cantNinos === 'hasta30' ? 'Hasta 30' :
    cantNinos === 'mas30'   ? `30 + ${ninosExtra || 1}` : '—';

  return (
    <div className="rounded-3xl p-5 sticky top-24 overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 60%, #081529 100%)',
        border: '1px solid rgba(41,185,232,0.2)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
      }}>
      {/* Subtle glow */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, #29B9E8 0%, transparent 70%)' }} />

      <h3 className="font-black text-lg mb-0.5 relative" style={{ color: '#29B9E8' }}>
        📋 Tu celebración
      </h3>
      <p className="text-xs mb-4 relative" style={{ color: 'rgba(255,255,255,0.35)' }}>Se actualiza en tiempo real</p>

      {/* ── Info de la reserva ── */}
      <div className="space-y-2.5 text-sm relative">
        {fecha && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>📅 Fecha</span>
            <span className="font-bold text-white">
              {fecha.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
        {hora && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>🕐 Horario</span>
            <span className="font-bold text-white">
              {hora === 'AM' ? 'AM · 11:00-14:00' : 'PM · 15:30-18:30'}
            </span>
          </div>
        )}
        {nombreNino && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>🎂 Festejado</span>
            <span className="font-bold text-white">
              {nombreNino}{edadNino ? ` · ${edadNino} años` : ''}
            </span>
          </div>
        )}
        {cantNinos && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>👶 Niños</span>
            <span className="font-bold text-white">{cantNinosLabel}</span>
          </div>
        )}
        {sector && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>🏡 Sector</span>
            <span className="font-bold" style={{ color: '#29B9E8' }}>{sectorLabel}</span>
          </div>
        )}
      </div>

      {/* ── Desglose de precios ── */}
      {precioBase > 0 && (
        <>
          <div className="my-4 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          <p className="text-xs font-black uppercase tracking-widest mb-3 relative"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Desglose
          </p>
          <div className="space-y-2 text-sm relative">

            {/* Base */}
            <div className="flex justify-between items-center">
              <span className="truncate pr-2" style={{ color: 'rgba(255,255,255,0.6)' }}>🏡 {sectorLabel}</span>
              <span className="font-bold text-white flex-shrink-0">{clp(precioBaseVisible)}</span>
            </div>

            {/* Cumpleaños compartido */}
            {festejados > 1 && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>👯 Festejados ({festejados})</span>
                <span className="font-bold text-white">{clp(recargoFestejados(festejados))}</span>
              </div>
            )}

            {/* Pack */}
            {packCelebra && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>🎉 Pack Celebra</span>
                <span className="font-bold text-white">{clp(PRECIOS_EXTRAS.pack_celebra)}</span>
              </div>
            )}

            {/* Extras seleccionados */}
            {extras.map((e) => (
              <div key={e.id} className="flex justify-between items-center">
                <span className="truncate pr-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {e.emoji} {e.nombre}
                </span>
                <span
                  className="font-bold flex-shrink-0"
                  style={{ color: e.gratis ? '#4ade80' : 'white' }}
                >
                  {e.gratis ? 'INCLUIDO' : clp(getPrecio(e, cantNinos))}
                </span>
              </div>
            ))}

            {/* Aseo profundo */}
            {usaCocina && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>🧹 Aseo profundo</span>
                <span className="font-bold text-white">{clp(PRECIOS_EXTRAS.aseo_profundo)}</span>
              </div>
            )}

            {/* Hora adicional */}
            {horaExtra && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>⏰ Hora adicional</span>
                <span className="font-bold text-white">{clp(PRECIOS_EXTRAS.hora_adicional)}</span>
              </div>
            )}

            {/* Niños adicionales sobre 30 */}
            {cantNinos === 'mas30' && ninosExtra > 0 && (
              <div className="flex justify-between items-center">
                <span className="truncate pr-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  👶 Niños adicionales ({ninosExtra})
                </span>
                <span className="font-bold text-white flex-shrink-0">
                  {clp(ninosExtra * PRECIOS_EXTRAS.nino_extra)}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Total ── */}
      <div className="mt-5 pt-4 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between">
          <span className="font-black text-sm uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Total Est.</span>
          <span className="font-black text-3xl" style={{
            color: total > 0 ? '#F97316' : 'rgba(255,255,255,0.2)',
            textShadow: total > 0 ? '0 0 20px rgba(249,115,22,0.4)' : 'none',
          }}>
            {total > 0 ? clp(total) : '—'}
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Precio referencial · sujeto a disponibilidad</p>
      </div>

      {total > 0 && (
        <>
          <button
            onClick={onWhatsApp}
            className="w-full mt-4 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 relative"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
            }}
          >
            <WaIcon /> Confirmar por WhatsApp
          </button>
          {/* Confianza en el momento de decisión — política real de reagendamiento */}
          <p className="text-xs mt-2.5 text-center relative" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Reservas con el 50% · Si llueve, reagendas sin costo
          </p>
        </>
      )}

      {/* ── Prueba social en el momento de decisión ── */}
      {total > 0 && TESTIMONIOS.length > 0 && (
        <div className="mt-4 pt-4 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-1.5 text-xs" style={{ color: '#FBBF24', letterSpacing: '0.08em' }}>★★★★★</div>
          <p className="text-xs leading-relaxed mb-2 line-clamp-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            “{TESTIMONIOS[1].texto}”
          </p>
          <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
            — {TESTIMONIOS[1].nombre} · reseña real en Google
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BOTTOM SHEET MÓVIL — Resumen completo de la celebración
// Mismo contenido que ResumenLateral pero en drawer desde abajo.
// Cada extra tiene × para quitarlo sin salir del flujo.
// ─────────────────────────────────────────────
function BottomSheetResumen({ estado, total, onWhatsApp, onCerrar, onQuitarExtra }) {
  const { fecha, hora, festejados, nombreNino, edadNino, cantNinos, sector, extras,
          usaCocina, packCelebra, horaExtra, ninosExtra } = estado;
  const esSabado = fecha?.getDay() === 6;

  const _baseRaw_sheet =
    sector === 'independiente'                         ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente) :
    (sector === 'completo' && cantNinos === 'hasta10') ? (esSabado ? PRECIOS_BASE.completo_10_sab  : PRECIOS_BASE.completo_10) :
    cantNinos === 'hasta20'                            ? (esSabado ? PRECIOS_BASE.completo_20_sab  : PRECIOS_BASE.completo_20) :
    (cantNinos === 'hasta30' || cantNinos === 'mas30') ? (esSabado ? PRECIOS_BASE.completo_30_sab  : PRECIOS_BASE.completo_30) : 0;
  const precioBase = aplicarMult(_baseRaw_sheet, edadNino, cantNinos);

  const sectorLabel = sector === 'independiente' ? 'Sector Independiente' : 'Jardín Completo';

  return (
    <>
      {/* Overlay oscuro — cierra al tocar fuera */}
      <div
        className="fixed inset-0 z-[110] lg:hidden"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        onClick={onCerrar}
      />

      {/* Sheet — sube desde abajo */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[120] lg:hidden flex flex-col rounded-t-3xl"
        style={{
          background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 60%, #081529 100%)',
          border: '1px solid rgba(41,185,232,0.2)',
          borderBottom: 'none',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.55)',
          maxHeight: '84vh',
        }}
      >
        {/* Pill handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
          <div>
            <h3 className="font-black text-base leading-tight" style={{ color: '#29B9E8' }}>📋 Tu celebración</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Se actualiza en tiempo real</p>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
          >✕</button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-0">

          {/* Info de reserva */}
          {(fecha || hora || nombreNino || sector) && (
            <div className="space-y-2.5 pb-4 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {fecha && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>📅 Fecha</span>
                  <span className="font-bold text-white text-sm">
                    {fecha.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}
              {hora && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>🕐 Horario</span>
                  <span className="font-bold text-white text-sm">{hora === 'AM' ? 'AM · 11:00–14:00' : 'PM · 15:30–18:30'}</span>
                </div>
              )}
              {nombreNino && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>🎂 Festejado</span>
                  <span className="font-bold text-white text-sm">{nombreNino}{edadNino ? ` · ${edadNino} años` : ''}</span>
                </div>
              )}
              {sector && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>🏡 Sector</span>
                  <span className="font-bold text-sm" style={{ color: '#29B9E8' }}>{sectorLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* Desglose de precios */}
          {precioBase > 0 && (
            <>
              <p className="text-xs font-black uppercase tracking-widest pt-3 pb-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}>Desglose</p>

              {/* Base */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm truncate pr-2" style={{ color: 'rgba(255,255,255,0.6)' }}>🏡 {sectorLabel}</span>
                <span className="font-bold text-white text-sm flex-shrink-0">{clp(precioBase)}</span>
              </div>

              {/* Cumpleaños compartido */}
              {festejados > 1 && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>👯 Festejados ({festejados})</span>
                  <span className="font-bold text-white text-sm">{clp(recargoFestejados(festejados))}</span>
                </div>
              )}

              {/* Pack */}
              {packCelebra && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>🎉 Pack Celebra</span>
                  <span className="font-bold text-white text-sm">{clp(PRECIOS_EXTRAS.pack_celebra)}</span>
                </div>
              )}

              {/* Extras — cada uno con × para quitar */}
              {extras.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 py-2 px-2.5 rounded-2xl my-1"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-sm flex-1 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {e.emoji} {e.nombre}
                  </span>
                  <span
                    className="font-bold text-sm flex-shrink-0"
                    style={{ color: e.gratis ? '#4ade80' : 'white' }}
                  >
                    {e.gratis ? 'GRATIS' : clp(getPrecio(e, cantNinos))}
                  </span>
                  <button
                    onClick={() => onQuitarExtra(e.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs transition-all active:scale-90"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.2)' }}
                    aria-label={`Quitar ${e.nombre}`}
                  >✕</button>
                </div>
              ))}

              {/* Aseo profundo */}
              {usaCocina && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>🧹 Aseo profundo</span>
                  <span className="font-bold text-white text-sm">{clp(PRECIOS_EXTRAS.aseo_profundo)}</span>
                </div>
              )}

              {/* Hora adicional */}
              {horaExtra && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>⏰ Hora adicional</span>
                  <span className="font-bold text-white text-sm">{clp(PRECIOS_EXTRAS.hora_adicional)}</span>
                </div>
              )}

              {/* Niños adicionales */}
              {cantNinos === 'mas30' && ninosExtra > 0 && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm truncate pr-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    👶 Niños adicionales ({ninosExtra})
                  </span>
                  <span className="font-bold text-white text-sm flex-shrink-0">
                    {clp(ninosExtra * PRECIOS_EXTRAS.nino_extra)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer pegado — total + CTA */}
        <div
          className="flex-shrink-0 px-5 pt-4 pb-8"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(4,8,24,0.6)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-black text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Total estimado
            </span>
            <span className="font-black text-3xl" style={{ color: '#F97316', textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
              {clp(total)}
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Precio referencial · Reservas con el 50% · Si llueve, reagendas sin costo
          </p>
          <button
            onClick={onWhatsApp}
            className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
          >
            <WaIcon /> Confirmar por WhatsApp
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// MODAL CARRUSEL — Catálogo de Experiencias Premium
// Recibe `grupo` resuelto (con items[] ya completos)
// ─────────────────────────────────────────────
function ModalCarrusel({ grupo, extras, cantNinos, onToggle, onCerrar }) {
  const items = grupo.items;
  const total = items.length;
  const [indice, setIndice] = useState(0);
  const [fotoIdx, setFotoIdx] = useState(0);
  // url → true (cargó) | false (error) | undefined (pendiente)
  const [fotoStates, setFotoStates] = useState({});

  // Precargar fotos del grupo al montar (las fotos son del grupo, no del ítem)
  useEffect(() => {
    setFotoIdx(0);
    setFotoStates({});
    const urls = CARRUSEL[grupo.carpeta] || [];
    urls.forEach((url) => {
      const img = new window.Image();
      img.onload  = () => setFotoStates((p) => ({ ...p, [url]: true  }));
      img.onerror = () => setFotoStates((p) => ({ ...p, [url]: false }));
      img.src = url;
    });
  }, [grupo.carpeta]);

  // Navegación por teclado
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  setIndice((i) => (i - 1 + total) % total);
      if (e.key === 'ArrowRight') setIndice((i) => (i + 1) % total);
      if (e.key === 'Escape')     onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onCerrar]);

  if (!items.length) return null;

  const itemActual = items[indice];
  const estaSeleccionado = extras.some((e) => e.id === itemActual.id);

  // Fotos del grupo (carpeta) — compartidas por todos los ítems del grupo
  const allFotos = CARRUSEL[grupo.carpeta] || [];

  // Solo fotos que cargaron correctamente (filtra rutas inexistentes).
  // Mientras precarga (estado undefined) las incluye provisoriamente.
  const fotos = allFotos.filter((url) => fotoStates[url] !== false);
  const totalFotos = fotos.length;

  // Índice seguro: nunca sale del rango de fotos válidas
  const fotoIdxSafe = totalFotos > 0 ? Math.min(fotoIdx, totalFotos - 1) : 0;

  const handleSeleccionar = () => {
    onToggle(itemActual, grupo);
    if (!grupo.seleccionMultiple) onCerrar();
  };

  const mostrarLaterales = total > 1;
  const offsets = mostrarLaterales ? [-1, 0, 1] : [0];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'rgba(6,10,30,0.97)', backdropFilter: 'blur(20px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >

      {/* ══ HEADER — título del grupo + botón cerrar ══ */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex-1 pr-4 min-w-0">
          <h2 className="text-white font-black text-xl leading-tight truncate">{grupo.label}</h2>
          {grupo.nota && (
            <p className="text-white/40 text-xs mt-0.5 leading-snug">{grupo.nota}</p>
          )}
        </div>
        <button
          onClick={onCerrar}
          className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg text-white flex-shrink-0 transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* ── Highlights ── */}
      {grupo.highlights && grupo.highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-2 flex-shrink-0">
          {grupo.highlights.map((h) => (
            <span
              key={h.texto}
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: h.tipo === 'gratis' ? 'rgba(34,197,94,0.18)' : 'rgba(41,185,232,0.14)',
                color:      h.tipo === 'gratis' ? '#86efac'              : '#7dd3fc',
                border:     h.tipo === 'gratis' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(41,185,232,0.2)',
              }}
            >
              {h.texto}
            </span>
          ))}
        </div>
      )}

      {/* ══ ZONA IMAGEN — ocupa el espacio disponible, SIN info dentro ══
           La imagen tiene ratio 16/9 para dejar más aire y
           no competir con el panel de info que vive FUERA del card.       */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden px-2 min-h-0">

        {/* Flechas de navegación */}
        {mostrarLaterales && (
          <>
            <button
              onClick={() => setIndice((i) => (i - 1 + total) % total)}
              aria-label="Opción anterior"
              className="absolute left-2 z-20 w-11 h-11 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>
            <button
              onClick={() => setIndice((i) => (i + 1) % total)}
              aria-label="Opción siguiente"
              className="absolute right-2 z-20 w-11 h-11 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >›</button>
          </>
        )}

        <div className="flex items-center justify-center w-full gap-2 h-full">
          {offsets.map((offset) => {
            const idx = (indice + offset + total) % total;
            const item = items[idx];
            const isCentro = offset === 0;
            const seleccionado = extras.some((e) => e.id === item.id);

            return (
              <div
                key={`${idx}-${offset}`}
                onClick={() => { if (!isCentro) setIndice(idx); }}
                className="relative rounded-2xl overflow-hidden transition-all duration-300 flex-shrink-0"
                style={{
                  width:    isCentro ? '82%'  : '8%',
                  maxWidth: isCentro ? '560px' : '70px',
                  opacity:  isCentro ? 1 : 0.15,
                  filter:   isCentro ? 'none' : 'brightness(0.25) saturate(0)',
                  transform:isCentro ? 'scale(1)' : 'scale(0.9) translateY(8px)',
                  cursor:   isCentro ? 'default' : 'pointer',
                  boxShadow: isCentro && seleccionado
                    ? '0 0 0 3px #F97316, 0 0 60px rgba(249,115,22,0.45), 0 20px 50px rgba(0,0,0,0.8)'
                    : isCentro
                    ? '0 0 40px rgba(21,101,192,0.35), 0 20px 50px rgba(0,0,0,0.75)'
                    : 'none',
                }}
              >
                {/* Imagen 1:1 — cuadrada, inmersiva en móvil y elegante en escritorio */}
                <div
                  className="relative w-full"
                  style={{ aspectRatio: '1/1', background: 'linear-gradient(135deg, #0D2B6E, #1565C0)' }}
                >
                  {(() => {
                    const src = isCentro
                      ? (fotos[fotoIdxSafe] || VITRINA[grupo.carpeta])
                      : (VITRINA[grupo.carpeta] || fotos[0]);
                    return src ? (
                      <Image
                        src={src}
                        alt={item.nombre}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 82vw, 560px"
                        style={isCentro ? { filter: 'saturate(1.1) contrast(1.05) brightness(1.03)' } : {}}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null;
                  })()}

                  {/* ── Flechas de navegación entre fotos del ítem (solo card central) ── */}
                  {isCentro && totalFotos > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFotoIdx((f) => (f - 1 + totalFotos) % totalFotos); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center font-black text-lg text-white transition-all hover:scale-110 active:scale-95"
                        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.18)' }}
                      >‹</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFotoIdx((f) => (f + 1) % totalFotos); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center font-black text-lg text-white transition-all hover:scale-110 active:scale-95"
                        style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.18)' }}
                      >›</button>
                    </>
                  )}

                  {/* ── Contador de fotos (N/Total) — esquina sup. izq. ── */}
                  {isCentro && totalFotos > 1 && !item.gratis && (
                    <div
                      className="absolute top-3 left-3 z-20 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        color: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(6px)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {fotoIdxSafe + 1} / {totalFotos}
                    </div>
                  )}

                  {/* ── Dots de foto — barra inferior de la imagen ── */}
                  {isCentro && totalFotos > 1 && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20 pointer-events-none">
                      {fotos.map((_, fi) => (
                        <div
                          key={fi}
                          className="rounded-full transition-all duration-200"
                          style={{
                            width:      fi === fotoIdxSafe ? '14px' : '5px',
                            height:     '5px',
                            background: fi === fotoIdxSafe ? 'white' : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Badge ✓ seleccionado */}
                  {isCentro && seleccionado && (
                    <div
                      className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-base shadow-xl z-20"
                      style={{ background: '#F97316', boxShadow: '0 0 0 3px rgba(249,115,22,0.3)' }}
                    >✓</div>
                  )}
                  {/* Badge INCLUIDO */}
                  {isCentro && item.gratis && (
                    <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg z-20">
                      INCLUIDO
                    </div>
                  )}
                  {/* Gradiente inferior para transición visual hacia el panel */}
                  {isCentro && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-10"
                      style={{ background: 'linear-gradient(to bottom, transparent, rgba(6,10,30,0.6))' }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ BOTTOM PANEL UNIFICADO ══════════════════════════════
           3 zonas → 1 bloque compacto. Dots dentro de la fila del
           nombre, precio alineado a la derecha, desc acotada a 2
           líneas, botones en la misma fila del precio.
           Resultado: ~130 px fijos vs los ~200 px anteriores.
      ════════════════════════════════════════════════════════ */}
      <div
        className="flex-shrink-0"
        style={{
          background: 'rgba(6,10,30,1)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="max-w-[560px] mx-auto px-5 pt-3 pb-5">

          {/* ─ Fila A: Nombre (izq) + Precio (der) ─ */}
          <div className="flex items-start justify-between gap-4 mb-1.5">

            {/* Nombre + dots debajo */}
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-base leading-tight">
                {itemActual.nombre}
              </p>
              {/* Dots — inline, integrados bajo el nombre */}
              {total > 1 && (
                <div className="flex gap-1 mt-2">
                  {items.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIndice(i)}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width:      i === indice ? '18px' : '6px',
                        background: i === indice ? '#F97316' : 'rgba(255,255,255,0.2)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Precio — grande, llamativo, alineado arriba-derecha */}
            <div
              className="font-black leading-none flex-shrink-0 pt-0.5"
              style={{
                fontSize: '1.6rem',
                color: itemActual.gratis ? '#86efac' : '#F97316',
                textShadow: itemActual.gratis
                  ? '0 0 20px rgba(134,239,172,0.4)'
                  : '0 0 20px rgba(249,115,22,0.4)',
              }}
            >
              {itemActual.gratis ? 'INCLUIDO' : clp(getPrecio(itemActual, cantNinos))}
            </div>
          </div>

          {/* ─ Fila B: Descripción — máx 2 líneas, siempre completa ─ */}
          {itemActual.desc && (
            <p
              className="text-xs leading-relaxed mb-3"
              style={{
                color: 'rgba(255,255,255,0.42)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {itemActual.desc}
            </p>
          )}

          {/* ─ Fila C: Botones en una sola fila ─ */}
          <div className="flex gap-2.5">

            {/* Cerrar / Listo — botón secundario compacto */}
            <button
              onClick={onCerrar}
              className="px-4 py-3 rounded-xl font-bold text-xs flex-shrink-0 transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {grupo.seleccionMultiple ? 'Listo ✓' : 'Cerrar'}
            </button>

            {/* CTA principal — Seleccionar / Quitar */}
            {estaSeleccionado ? (
              <button
                onClick={() => onToggle(itemActual, grupo)}
                className="flex-1 py-3 rounded-xl font-black text-xs transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  border: '1.5px solid rgba(239,68,68,0.4)',
                  color: '#FCA5A5',
                  background: 'rgba(239,68,68,0.07)',
                }}
              >
                ✕ Quitar este adicional
              </button>
            ) : (
              <button
                onClick={handleSeleccionar}
                className="flex-1 py-3 rounded-xl font-black text-xs text-white transition-all hover:scale-[1.01] active:scale-95"
                style={{
                  background: itemActual.gratis
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : 'linear-gradient(90deg, #1565C0, #F97316)',
                  boxShadow: itemActual.gratis
                    ? '0 3px 14px rgba(34,197,94,0.3)'
                    : '0 3px 14px rgba(249,115,22,0.3)',
                }}
              >
                {itemActual.gratis
                  ? '✓ Agregar · INCLUIDO'
                  : `✓ Seleccionar · ${clp(getPrecio(itemActual, cantNinos))}`}
              </button>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE ALCE KIDS — Página intermedia con info completa
// Se muestra al hacer clic en "Alce Kids" desde la landing
// ─────────────────────────────────────────────
// ─── Datos de infraestructura — usados en el grid y en el lightbox ───
const INFRAS = [
  {
    emoji: '🎱', title: 'Piscina de Pelotas Gigante',
    desc: 'El favorito de todos. Una piscina enorme llena de pelotas de colores donde los niños pueden saltar, rodar y jugar por horas.',
    color: '#1565C0', imagen: '/infra-piscina.webp',
  },
  {
    emoji: '🛝', title: 'Gran Tobogán',
    desc: 'Estructura de juegos colorida con tobogán, escaladores y zonas de exploración para los más atrevidos y curiosos.',
    color: '#F97316', imagen: '/infra-tobogan.webp',
  },
  {
    emoji: '🚗', title: 'Autopista para Niños',
    desc: 'Circuito pintado en el piso con casita, semáforos y señales. Los niños manejan sus propios vehículos como conductores de verdad.',
    color: '#29B9E8', imagen: '/infra-autopista.webp',
  },
  {
    emoji: '🐰', title: 'Granja con Animales',
    desc: 'Conejos y amigos del campo que los niños pueden conocer de cerca. Una experiencia única e irrepetible en Las Condes.',
    color: '#22c55e', imagen: '/infra-granja.webp',
  },
  {
    emoji: '⛱️', title: 'Pozo de Arena',
    desc: 'Un área de arena donde los pequeños pueden construir castillos, excavar y dejar volar la imaginación sin límites.',
    color: '#F59E0B', imagen: '/infra-arena.webp',
  },
  {
    emoji: '🏠', title: 'Salón con Aire Acondicionado',
    desc: 'Salón principal amplio y techado con AC. Para la celebración, el pastel y la comodidad de todos los adultos.',
    color: '#8B5CF6', imagen: '/infra-salon.webp',
  },
  {
    emoji: '🔒', title: 'Privacidad Total',
    desc: 'Cerramientos verdes y toldos para el sol. Tu fiesta es completamente privada, solo para tu familia e invitados.',
    color: '#1565C0', imagen: '/infra-privacidad.webp',
  },
  {
    emoji: '👨‍👩‍👧‍👦', title: 'Adultos Ilimitados',
    desc: 'Sin cobro extra por adultos. Trae abuelos, tíos y amigos. Cocina, baños y espacio para todos sin costo adicional.',
    color: '#F97316', imagen: '/infra-adultos.webp',
  },
  {
    emoji: '🎪', title: '2 Sectores Independientes',
    desc: 'Sector tobogán y sector piscina de pelotas. Elige un solo sector (hasta 10 niños) o el recinto completo para grupos grandes.',
    color: '#29B9E8', imagen: '/infra-sectores.webp',
  },
  {
    emoji: '🎭', title: 'Escenario y Tarima',
    desc: 'Tarima elevada para shows de animadores, obras de teatro y el momento del cumpleaños. ¡Los niños se convierten en protagonistas del escenario!',
    color: '#EC4899', imagen: '/infra-escenario.webp',
  },
  {
    emoji: '🌟', title: 'Área de Columpios',
    desc: 'Set de columpios seguros y coloridos para los más pequeños. El rincón favorito para mecerse, reír y descubrir la libertad.',
    color: '#F59E0B', imagen: '/infra-columpios.webp',
  },
  {
    emoji: '🎡', title: 'Sillas Locas',
    desc: '¡El favorito absoluto que hace gritar a todos! Sillas giratorias de diversión extrema para los niños más aventureros y valientes de la fiesta.',
    color: '#EF4444', imagen: '/infra-sillas-locas.webp',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GALERÍA INFRAESTRUCTURA — grid 3×3 interactivo + lightbox premium
// Reutilizable en PageAlce (paso de info) y en el wizard (paso 3 showroom).
// ─────────────────────────────────────────────────────────────────────────────
function GaleriaInfra() {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const scrollRef = useRef(null);

  // Teclado para el lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx((i) => (i - 1 + INFRAS.length) % INFRAS.length);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i + 1) % INFRAS.length);
      if (e.key === 'Escape')     setLightboxIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx]);

  // Scroll el strip 3 fotos hacia un lado
  const desplazar = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const item = el.querySelector('[data-infra-item]');
    const ancho = item ? item.offsetWidth + 8 : el.clientWidth / 3; // gap ~8px
    el.scrollBy({ left: dir * ancho * 3, behavior: 'smooth' });
  };

  return (
    <>
      {/* ── Carrusel horizontal ── */}
      <div className="relative">

        {/* Flecha izquierda */}
        <button
          onClick={() => desplazar(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center font-black text-base text-white transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(21,101,192,0.88)', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
        >‹</button>

        {/* Strip scrollable — 3 fotos visibles */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto mx-9"
          style={{
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {INFRAS.map((f, idx) => (
            <div
              key={f.title}
              data-infra-item="1"
              onClick={() => setLightboxIdx(idx)}
              className="group relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0"
              style={{
                width: 'calc(33.333% - 6px)',
                aspectRatio: '4/3',
                scrollSnapAlign: 'start',
                background: '#0D1B3E',
              }}
            >
              <Image
                src={f.imagen} alt={f.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="34vw"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />

              {/* Gradiente oscuro inferior */}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, transparent 35%, rgba(6,10,30,0.85) 100%)' }} />

              {/* Línea de color superior */}
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: f.color }} />

              {/* Emoji + título al pie */}
              <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2">
                <div className="flex items-center gap-1">
                  <span style={{ fontSize: '0.85rem' }}>{f.emoji}</span>
                  <span className="text-white font-black leading-tight" style={{ fontSize: '0.6rem' }}>{f.title}</span>
                </div>
              </div>

              {/* Ícono lupa al hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{ background: 'rgba(21,101,192,0.15)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)' }}>
                  ⊕
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Flecha derecha */}
        <button
          onClick={() => desplazar(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center font-black text-base text-white transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(21,101,192,0.88)', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
        >›</button>
      </div>

      {/* ── Lightbox fullscreen ── */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[300] flex flex-col"
          style={{ background: 'rgba(6,10,30,0.97)', backdropFilter: 'blur(24px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxIdx(null); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <span className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              {lightboxIdx + 1} / {INFRAS.length}
            </span>
            <button
              onClick={() => setLightboxIdx(null)}
              className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >✕</button>
          </div>

          {/* Imagen principal */}
          <div className="flex-1 flex items-center justify-center relative px-4 min-h-0">
            <button
              onClick={() => setLightboxIdx((i) => (i - 1 + INFRAS.length) % INFRAS.length)}
              aria-label="Foto anterior"
              className="absolute left-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>

            <div className="w-full max-w-4xl rounded-3xl overflow-hidden relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full aspect-[4/3] md:aspect-video" style={{ background: '#0D1B3E' }}>
                <Image
                  key={lightboxIdx}
                  src={INFRAS[lightboxIdx].imagen}
                  alt={INFRAS[lightboxIdx].title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                  style={{ filter: 'saturate(1.08) contrast(1.04)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-24"
                  style={{ background: 'linear-gradient(to bottom, transparent, rgba(6,10,30,0.55))' }} />
                <div className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: INFRAS[lightboxIdx].color }} />
              </div>
            </div>

            <button
              onClick={() => setLightboxIdx((i) => (i + 1) % INFRAS.length)}
              aria-label="Foto siguiente"
              className="absolute right-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >›</button>
          </div>

          {/* Panel inferior */}
          <div className="flex-shrink-0 max-w-4xl mx-auto w-full px-5 pt-5 pb-7">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {INFRAS[lightboxIdx].emoji}
              </div>
              <h3 className="font-black text-white text-lg leading-tight">{INFRAS[lightboxIdx].title}</h3>
            </div>
            <p className="text-sm leading-relaxed mb-5 pl-14" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {INFRAS[lightboxIdx].desc}
            </p>
            {/* Dots */}
            <div className="flex justify-center gap-1.5">
              {INFRAS.map((_, i) => (
                <button key={i} onClick={() => setLightboxIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      i === lightboxIdx ? '22px' : '6px',
                    height:     '6px',
                    background: i === lightboxIdx ? INFRAS[lightboxIdx].color : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PageAlce({ onIniciarWizard }) {
  const waVisita = `https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría conocer el espacio Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?')}`;
  const [lightboxIdx, setLightboxIdx] = useState(null);

  // Teclado para el lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx((i) => (i - 1 + INFRAS.length) % INFRAS.length);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i + 1) % INFRAS.length);
      if (e.key === 'Escape')     setLightboxIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx]);

  return (
    <div>

      {/* ══════════════════════════════════════════
          HERO — Logo + tagline + CTAs principales
      ══════════════════════════════════════════ */}
      <section
        className="relative flex items-center overflow-hidden"
        style={{ minHeight: '88vh' }}
      >
        {/* Fondo degradado base */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 45%, #0E6FA8 100%)' }} />
        {/* Foto de fondo — aérea del recinto completo (vista amplia) */}
        <Image src="/hero-aerea-recinto.webp" alt="" fill priority aria-hidden="true"
          className="object-cover"
          sizes="100vw"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        {/* Overlay oscuro */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(6,15,46,0.9) 0%, rgba(13,43,110,0.72) 55%, rgba(14,111,168,0.5) 100%)' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="flex flex-col md:flex-row items-center gap-12">

            {/* Logo Alce Kids */}
            <div className="flex-shrink-0">
              <div className="w-44 h-44 rounded-3xl overflow-hidden relative"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(41,185,232,0.3)' }}>
                <Image src="/logo-alce.webp" alt="Alce Kids"
                  fill
                  className="object-cover"
                  sizes="176px"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            </div>

            {/* Texto + CTAs */}
            <div className="text-center md:text-left flex-1">
              {/* Badge ubicación */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black mb-5"
                style={{ background: 'rgba(249,115,22,0.2)', color: '#FED7AA', border: '1px solid rgba(249,115,22,0.35)' }}>
                📍 Talavera de la Reina 380 · Las Condes, Santiago
              </div>

              <h1 className="font-black text-white leading-none mb-3"
                style={{ fontSize: 'clamp(3rem, 8vw, 5.5rem)' }}>
                Alce <span style={{ color: '#29B9E8' }}>Kids</span>
              </h1>
              <p className="font-black text-xl mb-2" style={{ color: '#FED7AA' }}>
                El lugar de cumpleaños más especial del sector oriente
              </p>
              <p className="text-base mb-8 max-w-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                40 años de historia familiar · Niños de 0 a 6 años · Las Condes, Santiago de Chile
              </p>

              {/* Estrellas Google */}
              <div className="flex items-center gap-3 mb-10 justify-center md:justify-start">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-2xl" style={{ color: '#FBBF24' }}>★</span>
                  ))}
                </div>
                <span className="font-black text-white text-2xl">{STATS.rating}</span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>· {STATS.reseñas} reseñas verificadas en Google</span>
              </div>

              {/* Botones CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button
                  onClick={onIniciarWizard}
                  className="font-black px-9 py-4 rounded-2xl text-white text-base transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(90deg, #F97316, #F59E0B)', boxShadow: '0 8px 32px rgba(249,115,22,0.5)' }}
                >
                  🎉 Armar mi celebración →
                </button>
                <a
                  href={waVisita}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold px-9 py-4 rounded-2xl text-white text-base transition-all hover:scale-105 text-center"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)' }}
                >
                  👀 Visitar sin compromiso
                </a>
              </div>

              {/* Diferenciador de libertad — visible desde el primer pantallazo */}
              <p className="text-sm mt-5 text-center md:text-left" style={{ color: 'rgba(255,255,255,0.55)' }}>
                🔓 <span className="font-bold text-white/75">Libertad total:</span> trae todo por tu cuenta
                o contrata con nosotros — sin paquetes obligatorios, sin amarres.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce opacity-50">
          <div className="w-5 h-9 border-2 border-white/40 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2.5 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS RÁPIDOS — 4 números de impacto
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: String(STATS.reseñas), label: `Reseñas ⭐ ${STATS.rating}`, sub: 'en Google Maps', color: '#FBBF24' },
              { num: `${STATS.añosHistoria}+`, label: 'Años de historia', sub: 'en Las Condes', color: '#29B9E8' },
              { num: '0–6', label: 'Años de edad', sub: 'bienvenidos', color: '#F97316' },
              { num: '100%', label: 'Adultos incluidos', sub: 'sin cargo extra', color: '#86efac' },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center py-5 px-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-3xl font-black mb-1"
                  style={{ color: s.color, textShadow: `0 0 20px ${s.color}55` }}>
                  {s.num}
                </div>
                <div className="font-black text-white text-sm">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          INFRAESTRUCTURA — 12 características del jardín
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(180deg, #F0F7FF 0%, #ffffff 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.18)' }}>
              ✨ Todo incluido en el arriendo
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#0D1B3E' }}>
              Un mundo de aventuras<br />
              <span style={{ color: '#1565C0' }}>esperando a tu hijo</span>
            </h2>
            <p className="text-gray-400 text-base max-w-sm mx-auto">
              Cada rincón del espacio fue diseñado para que los niños no paren de reír
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {INFRAS.map((f, idx) => (
              <div
                key={f.title}
                onClick={() => setLightboxIdx(idx)}
                className="group rounded-3xl overflow-hidden relative transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer"
                style={{ aspectRatio: '4/3', background: '#0D1B3E' }}
              >
                {/* ── Foto de fondo — cubre todo el recuadro ── */}
                <Image
                  src={f.imagen}
                  alt={f.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />

                {/* ── Gradiente oscuro: transparente arriba → oscuro abajo ── */}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 35%, rgba(6,15,46,0.78) 75%, rgba(6,15,46,0.95) 100%)' }}
                />

                {/* ── Línea de color del área en la parte superior ── */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: f.color }}
                />

                {/* ── Badge emoji — esquina superior izquierda ── */}
                <div
                  className="absolute top-4 left-4 w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.22)' }}
                >
                  {f.emoji}
                </div>

                {/* ── Texto sobre el gradiente inferior ── */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-black text-white text-sm leading-tight mb-1.5">
                    {f.title}
                  </h3>
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: 'rgba(255,255,255,0.62)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          LIGHTBOX — Carrusel grande al pinchar recuadro
      ══════════════════════════════════════════ */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: 'rgba(6,10,30,0.97)', backdropFilter: 'blur(24px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxIdx(null); }}
        >
          {/* ── Header: contador + botón cerrar ── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-black px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                {lightboxIdx + 1} / {INFRAS.length}
              </span>
            </div>
            <button
              onClick={() => setLightboxIdx(null)}
              className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >✕</button>
          </div>

          {/* ── Imagen principal ── */}
          <div className="flex-1 flex items-center justify-center relative px-4 min-h-0">

            {/* Flecha izquierda */}
            <button
              onClick={() => setLightboxIdx((i) => (i - 1 + INFRAS.length) % INFRAS.length)}
              aria-label="Foto anterior"
              className="absolute left-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>

            {/* Imagen */}
            <div
              className="w-full max-w-4xl rounded-3xl overflow-hidden relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              <div className="relative w-full aspect-[4/3] md:aspect-video" style={{ background: '#0D1B3E' }}>
                <Image
                  key={lightboxIdx}
                  src={INFRAS[lightboxIdx].imagen}
                  alt={INFRAS[lightboxIdx].title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 896px"
                  style={{ filter: 'saturate(1.08) contrast(1.04)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                {/* Gradiente inferior */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-24"
                  style={{ background: 'linear-gradient(to bottom, transparent, rgba(6,10,30,0.55))' }}
                />
                {/* Badge color del área */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: INFRAS[lightboxIdx].color }}
                />
              </div>
            </div>

            {/* Flecha derecha */}
            <button
              onClick={() => setLightboxIdx((i) => (i + 1) % INFRAS.length)}
              aria-label="Foto siguiente"
              className="absolute right-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >›</button>
          </div>

          {/* ── Panel inferior: emoji + título + descripción + dots ── */}
          <div className="flex-shrink-0 max-w-4xl mx-auto w-full px-5 pt-5 pb-7">
            {/* Emoji + título */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {INFRAS[lightboxIdx].emoji}
              </div>
              <h3 className="font-black text-white text-lg leading-tight">
                {INFRAS[lightboxIdx].title}
              </h3>
            </div>

            {/* Descripción */}
            <p className="text-sm leading-relaxed mb-5 pl-14" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {INFRAS[lightboxIdx].desc}
            </p>

            {/* Dots de navegación */}
            <div className="flex justify-center gap-1.5">
              {INFRAS.map((inf, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      i === lightboxIdx ? '22px' : '6px',
                    height:     '6px',
                    background: i === lightboxIdx ? INFRAS[lightboxIdx].color : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TU MANERA — Flexibilidad total
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(180deg, #F8FBFF 0%, #EFF6FF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.18)' }}>
              🔓 Sin paquetes ni obligaciones
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#0D1B3E' }}>
              Tu celebración,<br />
              <span style={{ color: '#1565C0' }}>como tú la imaginas</span>
            </h2>
            <p className="text-gray-400 text-base max-w-lg mx-auto">
              Arriendas el espacio — y desde ahí, decides tú. Sin que nadie te obligue a comprar nada.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Card 1 — Lo organizo yo */}
            <div className="rounded-3xl p-8"
              style={{ background: 'white', border: '1px solid rgba(21,101,192,0.12)', boxShadow: '0 4px 24px rgba(21,101,192,0.07)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
                style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>🎒</div>
              <h3 className="font-black text-xl mb-3" style={{ color: '#0D1B3E' }}>Lo organizo yo</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-5">
                Trae tu propia comida, torta, decoración y animadores — sin restricciones ni permisos especiales.
                El espacio es tuyo y lo usas como quieras.
              </p>
              <ul className="space-y-2.5">
                {[
                  'Sin proveedor obligatorio',
                  'Cocina disponible para calentar',
                  'Libertad total para personalizar',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(55,65,81,0.8)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#1565C0' }}>✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card 2 — Me relajo y disfruto */}
            <div className="rounded-3xl p-8 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '1px solid rgba(249,115,22,0.28)', boxShadow: '0 4px 24px rgba(249,115,22,0.08)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #F97316, transparent)' }} />
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl relative"
                style={{ background: 'linear-gradient(135deg, #FFF7ED, #FED7AA)' }}>🛋️</div>
              <h3 className="font-black text-xl mb-3 relative" style={{ color: '#0D1B3E' }}>Me relajo y disfruto</h3>
              <p className="text-sm leading-relaxed mb-5 relative" style={{ color: 'rgba(124,45,18,0.75)' }}>
                Elige entre nuestros servicios opcionales de animación, decoración y más.
                Llegas con los niños y disfrutas — nosotros nos encargamos del resto.
              </p>
              <ul className="space-y-2.5 relative">
                {[
                  'Animadores profesionales',
                  'Decoración temática lista',
                  'Todo coordinado sin estrés',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(124,45,18,0.8)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#F97316' }}>✓</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center mt-8 text-sm text-gray-400 max-w-md mx-auto">
            También puedes combinar ambas opciones — traer lo que ya tienes y contratar solo lo que te falta. Sin presiones.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PRECIOS — Visión general transparente
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-2">
              Precios <span style={{ color: '#F97316' }}>claros y sin sorpresas</span>
            </h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Sin paquetes obligatorios · Adultos siempre incluidos · Reserva con el 50%
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Sector Independiente — sin cifras: el valor exacto se calcula en el wizard */}
            <div className="rounded-3xl p-8 relative overflow-hidden"
              style={{ background: 'rgba(41,185,232,0.07)', border: '1px solid rgba(41,185,232,0.28)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #29B9E8, transparent)' }} />
              <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#29B9E8' }}>
                🏡 Sector Independiente
              </div>
              <p className="font-black text-2xl text-white mb-6 leading-tight">
                Más íntimo y privado<br />
                <span className="text-white/50 text-base font-bold">para grupos de hasta 10 niños</span>
              </p>
              <ul className="space-y-2.5">
                {['Piscina de pelotas O tobogán', 'Hasta 10 niños', 'Adultos ilimitados sin costo', '3 horas + 30 min para decorar'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#29B9E8' }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Jardín Completo */}
            <div className="rounded-3xl p-8 relative overflow-hidden"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.38)' }}>
              <div className="absolute top-4 right-4 text-xs font-black px-3 py-1 rounded-full"
                style={{ background: '#F97316', color: 'white' }}>⭐ POPULAR</div>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #F97316, transparent)' }} />
              <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#F97316' }}>
                🏰 Recinto Completo
              </div>
              <p className="font-black text-2xl text-white mb-6 leading-tight">
                La experiencia completa<br />
                <span className="text-white/50 text-base font-bold">todo el jardín exclusivo, hasta 30 niños y más</span>
              </p>
              <ul className="space-y-2.5">
                {['Todo el recinto exclusivo para ti', 'Hasta 30 niños (+ extras)', 'Adultos ilimitados sin costo', '3 horas + 30 min para decorar', 'Cocina y salón con AC incluido'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#F97316' }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Cómo se calcula el valor + CTA calculadora */}
          <div className="max-w-2xl mx-auto text-center mt-10">
            <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
              🧮 Tu valor exacto depende de <strong className="text-white">tres cosas</strong>: el día
              (viernes, sábado o domingo), la <strong className="text-white">cantidad de niños</strong> y
              la <strong className="text-white">edad del festejado</strong>. Lo calculas al instante,
              sin compromiso y sin letra chica.
            </p>
            <button
              onClick={onIniciarWizard}
              className="font-black px-9 py-4 rounded-2xl text-white text-base transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(90deg, #F97316, #29B9E8)', boxShadow: '0 8px 28px rgba(249,115,22,0.4)' }}
            >
              🧮 Calcular mi valor exacto →
            </button>
          </div>

          {/* Nota libertad */}
          <div className="flex justify-center mt-10 mb-4">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
              🔓 El precio es por el espacio — los servicios adicionales son siempre opcionales
            </div>
          </div>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Sujeto a disponibilidad · Reserva con el 50% del arriendo
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RESEÑAS GOOGLE — 6 reseñas verificadas
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #F0F7FF 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <div className="flex justify-center gap-1 mb-5">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-3xl" style={{ color: '#FBBF24' }}>★</span>
              ))}
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-2" style={{ color: '#0D1B3E' }}>
              Lo que dicen las familias
            </h2>
            <p className="text-gray-400 text-base">{RESEÑAS_CORTO}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Reseñas REALES desde data/testimonios.js — fuente única de verdad */}
            {TESTIMONIOS.slice(0, 6).map((t) => (
              <div
                key={t.nombre}
                className="rounded-3xl p-6 relative transition-all hover:-translate-y-1 hover:shadow-xl"
                style={{ background: 'white', border: '1px solid rgba(21,101,192,0.09)', boxShadow: '0 4px 24px rgba(21,101,192,0.07)' }}
              >
                {/* Badge Google */}
                <div className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: '#4285F4', color: 'white' }}>G</div>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.estrellas || 5)].map((_, i) => (
                    <span key={i} className="text-sm" style={{ color: '#FBBF24' }}>★</span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1565C0, #29B9E8)' }}>
                    {(t.nombre || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="font-black text-gray-800 text-sm">{t.nombre}</div>
                    <div className="text-gray-400 text-xs mt-0.5">Reseña verificada · Google</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href={GOOGLE_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-bold text-sm px-7 py-3.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(21,101,192,0.07)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.2)' }}
            >
              Ver todas las {STATS.reseñas} reseñas en Google Maps →
            </a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          FAQ LLUVIA — Respuesta para invierno
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(180deg, #F0F7FF 0%, #EFF8FF 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <div className="text-5xl mb-4">☔</div>
            <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: '#0D1B3E' }}>
              ¿Qué pasa si llueve ese día?
            </h2>
            <p className="text-gray-400 text-base max-w-md mx-auto">
              La pregunta que más nos hacen en invierno — aquí la respuesta completa
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{ background: 'white', border: '1px solid rgba(21,101,192,0.12)', boxShadow: '0 4px 24px rgba(21,101,192,0.07)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
                style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>📅</div>
              <h3 className="font-black text-xl mb-3" style={{ color: '#0D1B3E' }}>Opción 1: Cambiar la fecha</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Avisándonos con anticipación, te buscamos la próxima fecha disponible{' '}
                <strong className="text-gray-700">sin costo adicional</strong>.
                Sin letra chica, sin multas. Tu celebración se hace igual — solo en otro día.
              </p>
            </div>
            <div className="rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{ background: 'white', border: '1px solid rgba(249,115,22,0.12)', boxShadow: '0 4px 24px rgba(249,115,22,0.07)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
                style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' }}>🏠</div>
              <h3 className="font-black text-xl mb-3" style={{ color: '#0D1B3E' }}>Opción 2: Seguir adelante</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Si prefieres no moverla, el <strong className="text-gray-700">salón techado y climatizado</strong> recibe
                la torta, la comida y a todos cómodos, y preparamos el resto del espacio lo mejor posible.
                Tú decides con total transparencia — nunca te obligamos.
              </p>
            </div>
          </div>
          <div className="text-center mt-8 text-sm text-gray-400 font-medium">
            En cualquiera de los dos casos, te acompañamos. Nunca quedas sin opciones. ✓
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          UBICACIÓN — Dirección, horarios, mapa
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-2">
              📍 Dónde encontrarnos
            </h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Fácil acceso desde toda la zona oriente de Santiago
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-start">

            {/* Info de contacto */}
            <div className="space-y-6">
              {[
                {
                  icon: '📍', title: 'Talavera de la Reina 380',
                  sub: 'Las Condes, Santiago de Chile', color: 'rgba(41,185,232,0.15)',
                  href: 'https://www.google.com/maps/place/Celebraciones+de+cumplea%C3%B1os+infantiles+Alce/@-33.4103966,-70.5469409,17z/data=!3m1!4b1!4m6!3m5!1s0x9662cffa12a16607:0x929326a7c505c57!8m2!3d-33.4103966!4d-70.5469409!16s%2Fg%2F11y0fd4d9w',
                },
                {
                  icon: '🚇', title: 'Cerca de Metro Los Dominicos',
                  sub: 'Línea 1 · fácil acceso en auto, taxi o Uber', color: 'rgba(41,185,232,0.15)',
                },
                {
                  icon: '🕐', title: 'Viernes · Sábado · Domingo',
                  sub: 'AM 11:00–14:00 · PM 15:30–18:30', color: 'rgba(249,115,22,0.15)',
                },
                {
                  icon: <WaIcon />, title: '+56 9 4435 6955',
                  sub: 'WhatsApp · respuesta rápida garantizada', color: 'rgba(34,197,94,0.15)',
                },
                {
                  icon: '📧', title: 'celebracionesalce@gmail.com',
                  sub: 'Para consultas y presupuestos detallados', color: 'rgba(41,185,232,0.12)',
                },
              ].map((item) => {
                const inner = (
                  <>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: item.color }}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-black text-white text-base">{item.title}</p>
                      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.sub}</p>
                    </div>
                  </>
                );
                return item.href ? (
                  <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-4 hover:opacity-80 transition-opacity">
                    {inner}
                  </a>
                ) : (
                  <div key={item.title} className="flex items-start gap-4">{inner}</div>
                );
              })}

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <a
                  href="https://www.google.com/maps/place/Celebraciones+de+cumplea%C3%B1os+infantiles+Alce/@-33.4103966,-70.5469409,17z/data=!3m1!4b1!4m6!3m5!1s0x9662cffa12a16607:0x929326a7c505c57!8m2!3d-33.4103966!4d-70.5469409!16s%2Fg%2F11y0fd4d9w"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-black px-6 py-3.5 rounded-2xl text-white text-sm transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #1565C0, #29B9E8)', boxShadow: '0 4px 20px rgba(41,185,232,0.35)' }}
                >
                  📍 Cómo llegar →
                </a>
                <a
                  href="https://wa.me/56944356955"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-black px-6 py-3.5 rounded-2xl text-white text-sm transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
                >
                  <WaIcon /> Consultar por WhatsApp
                </a>
              </div>
            </div>

            {/* Mapa embed */}
            <div className="rounded-3xl overflow-hidden shadow-2xl"
              style={{ border: '1px solid rgba(41,185,232,0.2)', height: '340px' }}>
              <iframe
                src="https://maps.google.com/maps?q=Celebraciones+de+cumplea%C3%B1os+infantiles+Alce,+Las+Condes,+Santiago&t=m&z=17&ie=UTF8&iwloc=B&output=embed"
                width="100%"
                height="340"
                style={{ border: 0, display: 'block', filter: 'invert(92%) hue-rotate(180deg) saturate(1.2) contrast(0.85)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación Alce Kids"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          CTA FINAL — Cierre poderoso
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg, #1565C0 0%, #0E6FA8 50%, #29B9E8 100%)' }}>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            ¿Listo para la celebración<br />más increíble?
          </h2>
          <p className="text-lg mb-4 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Elige tu fecha, arma tu celebración y confirma en minutos.<br />
            O visita el lugar primero — <em>quien lo ve, lo reserva</em>.
          </p>
          <p className="text-sm mb-10 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Trae lo tuyo de afuera o déjalo en nuestras manos — tú decides, sin obligaciones.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onIniciarWizard}
              className="font-black px-10 py-5 rounded-2xl text-white text-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: '#F97316', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
            >
              🎉 Armar mi celebración →
            </button>
            <a
              href={waVisita}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold px-10 py-5 rounded-2xl text-white text-lg transition-all hover:scale-105 text-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)' }}
            >
              👀 Visitar sin compromiso
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// FAB WHATSAPP — botón flotante persistente (solo vistas de navegación;
// el wizard ya tiene su propia barra inferior de confirmación)
// Aparece tras pasar el hero para no competir con sus CTAs.
// ─────────────────────────────────────────────
function WhatsAppFab() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <a
      href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Estoy viendo la web de Alce Kids y tengo una consulta 😊')}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl transition-all duration-300 hover:scale-110 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        boxShadow: '0 8px 28px rgba(34,197,94,0.45), 0 2px 8px rgba(0,0,0,0.25)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <WaIcon />
    </a>
  );
}

// ─────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#0D1B3E' }} className="text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-black text-lg mb-3" style={{ color: '#29B9E8' }}>
            Celebra Sin Cesar
          </div>
          <p className="leading-relaxed text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            La casa de cumpleaños más completa de Las Condes, Santiago. Niños de 0 a 6 años con 40 años de historia familiar.
          </p>
          <div className="mt-4 space-y-1.5 text-sm">
            {[
              { href: '/armar', label: '✨ Armar mi celebración' },
              { href: '/catalogo', label: '📖 Catálogo de adicionales' },
              { href: '/#faq', label: '❓ Preguntas frecuentes' },
            ].map((l) => (
              <a key={l.href} href={l.href}
                className="block font-bold transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.55)' }}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <a
              href="https://www.instagram.com/celebracionesalce/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm hover:opacity-80 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#F97316,#29B9E8)' }}
            >
              📷
            </a>
            <a
              href="https://wa.me/56944356955"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-sm hover:bg-green-500 transition-colors"
            >
              <WaIcon />
            </a>
          </div>
        </div>

        <div>
          <div className="font-black mb-3" style={{ color: '#F97316' }}>📍 Dónde estamos</div>
          <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Talavera de la Reina 380<br />
            Las Condes, Santiago<br />
            Cerca de Metro Los Dominicos
          </p>
          <a
            href="https://maps.app.goo.gl/7AVak5cVXpFjpNh5A"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
            style={{ background: 'rgba(41,185,232,0.15)', color: '#29B9E8' }}
          >
            Ver en Google Maps →
          </a>
        </div>

        <div>
          <div className="font-black mb-3" style={{ color: '#29B9E8' }}>📞 Contacto</div>
          <div className="space-y-2">
            <a
              href="https://wa.me/56944356955"
              className="flex items-center gap-2 hover:text-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              <WaIcon /> +56 9 4435 6955
            </a>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Vie · Sáb · Dom
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              AM 11:00–14:00 · PM 15:30–18:30
            </p>
          </div>
          <div
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}
          >
            ⭐ {STATS.rating} · {STATS.reseñas} reseñas Google
          </div>
        </div>
      </div>

      <div
        className="text-center py-4 text-xs"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.22)',
        }}
      >
        © 2026 CELEBRA SIN CESAR SpA · Alce Kids · Las Condes, Santiago
        {' · '}
        <a
          href="/terminos"
          className="hover:underline transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Términos y Condiciones
        </a>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────
export default function App() {
  const pathname = usePathname();
  const [vista, setVista] = useState(pathname === '/armar' ? 'wizard' : 'inicio'); // 'inicio' | 'alce' | 'wizard'
  const [paso, setPaso] = useState(0);

  // Scroll instantáneo al tope en cada cambio de paso o de vista
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setActivoBloqueId(BLOQUES_VITRINA[0]?.id ?? '');
  }, [paso, vista]);

  // Tracking de sección activa en paso 4 (igual que /catalogo)
  useEffect(() => {
    if (paso !== 4) return;
    const onScroll = () => {
      for (let i = BLOQUES_VITRINA.length - 1; i >= 0; i--) {
        const el = document.getElementById(BLOQUES_VITRINA[i].id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActivoBloqueId(BLOQUES_VITRINA[i].id);
          return;
        }
      }
      setActivoBloqueId(BLOQUES_VITRINA[0]?.id ?? '');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [paso]);

  // ── Disponibilidad real desde Google Calendar ──────────────────────────────
  const [disponibilidad, setDisponibilidad] = useState({
    blockedDates: [],
    blockedAM: [],
    blockedPM: [],
  });
  // Fetch cada vez que el usuario llega al Paso 0 del wizard.
  // Sin skeleton: el calendario aparece de inmediato con lo que haya,
  // y se actualiza en silencio cuando llega la respuesta de Google Calendar.
  // El servidor cachea 30 s → respuesta rápida sin golpear la API en cada clic.
  useEffect(() => {
    if (vista !== 'wizard' || paso !== 0) return;
    fetch('/api/disponibilidad', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setDisponibilidad(data))
      .catch(() => {}); // fallo silencioso: todo aparece disponible
  }, [vista, paso]);

  const [estado, setEstado] = useState({
    fecha: null,
    hora: null,
    festejados: 1,        // cumpleaños compartido: 2-3 festejados con recargo
    nombreNino: '',
    edadNino: null,
    ninosMayores: null,
    cantNinos: null,
    sector: null,
    packCelebra: false,
    extras: [],
    usaCocina: false,
    notas: '',
    horaExtra: false,
    ninosExtra: 0,
  });

  const set = (campo, valor) => setEstado((p) => ({ ...p, [campo]: valor }));

  // ── Persistencia del wizard — el carrito nunca se pierde ─────────────────
  // Si el papá abandona a medio camino y vuelve (hasta 7 días después),
  // retoma exactamente donde quedó. Los extras se re-validan contra el
  // catálogo vigente (precios/ítems frescos, nunca datos obsoletos).
  const [retomado, setRetomado] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('alce-wizard-v1');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s.ts || Date.now() - s.ts > 7 * 24 * 3600 * 1000) return;
      const fecha = s.fecha ? new Date(s.fecha) : null;
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const fechaValida = fecha && !isNaN(fecha) && fecha >= hoy ? fecha : null;
      const extras = (s.extras || []).map((e) => ITEM_LOOKUP[e?.id]).filter(Boolean);
      const hayAvance = fechaValida || s.nombreNino || extras.length > 0;
      if (!hayAvance) return;
      setEstado((p) => ({
        ...p,
        fecha: fechaValida,
        hora: fechaValida ? (s.hora ?? null) : null,
        festejados: s.festejados || 1,
        nombreNino: s.nombreNino || '',
        edadNino: s.edadNino ?? null,
        ninosMayores: s.ninosMayores ?? null,
        cantNinos: s.cantNinos ?? null,
        sector: s.sector ?? null,
        packCelebra: !!s.packCelebra,
        extras,
        usaCocina: !!s.usaCocina,
        notas: s.notas || '',
        horaExtra: !!s.horaExtra,
        ninosExtra: s.ninosExtra || 0,
      }));
      if (pathname === '/armar' && typeof s.paso === 'number' && s.paso > 0) {
        setPaso(s.paso);
        setRetomado(true);
        setTimeout(() => setRetomado(false), 5000);
      }
    } catch {} // storage corrupto o bloqueado: se parte de cero, sin romper nada
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const { fecha, ...rest } = estado;
      localStorage.setItem('alce-wizard-v1', JSON.stringify({
        ...rest,
        fecha: fecha ? fecha.toISOString() : null,
        paso,
        ts: Date.now(),
      }));
    } catch {}
  }, [estado, paso]);

  const [grupoAbierto, setGrupoAbierto] = useState(null); // grupo resuelto activo
  const [grupoFicha, setGrupoFicha] = useState(null); // FichaCarrusel paso 4
  const [sheetAbierto, setSheetAbierto] = useState(false); // bottom sheet móvil
  const [activoBloqueId, setActivoBloqueId] = useState(BLOQUES_VITRINA[0]?.id ?? '');
  const navCatRef = useRef(null);

  // ── Botón "atrás" del celular: retrocede DENTRO de la página ──────────────
  // Patrón centinela (no pelea con el router de Next): una entrada neutra en
  // el historial intercepta el pop; retrocedemos paso/vista internamente y
  // re-armamos el centinela. Con una ficha abierta, su propio handler la
  // cierra y aquí lo ignoramos. En vista inicio, el atrás sale del sitio
  // normalmente (no atrapamos al usuario).
  const navRef = useRef({ vista, paso });
  useEffect(() => { navRef.current = { vista, paso }; }, [vista, paso]);
  const fichaAbiertaRef = useRef(false);
  useEffect(() => {
    fichaAbiertaRef.current = grupoFicha !== null || grupoAbierto !== null;
  }, [grupoFicha, grupoAbierto]);

  useEffect(() => {
    history.pushState(null, ''); // centinela inicial
    const onPop = () => {
      if (fichaAbiertaRef.current) return; // ese atrás cerró una ficha
      const { vista: v, paso: p } = navRef.current;
      if (v === 'wizard' && p > 0) {
        setPaso(p - 1);
        history.pushState(null, ''); // re-armar centinela
      } else if (v !== 'inicio') {
        setVista('inicio');
        setPaso(0);
        history.pushState(null, '');
      }
      // v === 'inicio': no se re-arma → el siguiente atrás sale del sitio
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quitar un extra por id (para el bottom sheet)
  const quitarExtra = (itemId) =>
    setEstado((p) => ({ ...p, extras: p.extras.filter((e) => e.id !== itemId) }));

  // Toggle de ítem dentro del modal
  // - single-select: quita todos los de este grupo antes de agregar
  // - multi-select: toggle normal
  const toggleItemModal = (item, grupo) => {
    setEstado((p) => {
      const yaEsta = p.extras.some((e) => e.id === item.id);
      if (yaEsta) {
        return { ...p, extras: p.extras.filter((e) => e.id !== item.id) };
      }
      if (!grupo.seleccionMultiple) {
        const idsGrupo = grupo.items.map((i) => i.id);
        return {
          ...p,
          extras: [...p.extras.filter((e) => !idsGrupo.includes(e.id)), item],
        };
      }
      return { ...p, extras: [...p.extras, item] };
    });
  };

  // Precio correcto según día — sábado tiene tabla propia
  const esSabado = estado.fecha?.getDay() === 6;

  const total = useMemo(() => {
    let t = 0;
    const _sab = estado.fecha?.getDay() === 6;
    let _baseRaw_total = 0;
    if (estado.sector === 'independiente')
      _baseRaw_total = _sab ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente;
    else if (estado.cantNinos === 'hasta10' && estado.sector === 'completo')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10;
    else if (estado.cantNinos === 'hasta20')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20;
    else if (estado.cantNinos === 'hasta30' || estado.cantNinos === 'mas30')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30;
    t += aplicarMult(_baseRaw_total, estado.edadNino, estado.cantNinos);
    t += recargoFestejados(estado.festejados);
    if (estado.packCelebra) t += PRECIOS_EXTRAS.pack_celebra;
    estado.extras.forEach((e) => (t += getPrecio(e, estado.cantNinos)));
    if (estado.usaCocina) t += PRECIOS_EXTRAS.aseo_profundo;
    if (estado.horaExtra) t += PRECIOS_EXTRAS.hora_adicional;
    if (estado.cantNinos === 'mas30') t += (estado.ninosExtra || 1) * PRECIOS_EXTRAS.nino_extra;
    return t;
  }, [estado]);

  const generarWhatsApp = () => {
    const fechaTexto = estado.fecha?.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const horarioTexto = estado.hora === 'AM' ? 'AM (11:00 - 14:00)' : 'PM (15:30 - 18:30)';
    const cantNinosTexto =
      estado.cantNinos === 'hasta10' ? 'hasta 10' :
      estado.cantNinos === 'hasta20' ? 'hasta 20' :
      estado.cantNinos === 'hasta30' ? 'hasta 30' :
      `30 + ${estado.ninosExtra || 1}`;
    const sectorTexto = estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';

    const adicionales = [
      estado.festejados > 1
        ? `• Cumpleaños compartido (${estado.festejados} festejados): ${clp(recargoFestejados(estado.festejados))}`
        : '',
      estado.packCelebra ? `• Pack Celebra Sin Cesar (Piñata + Decoración): ${clp(PRECIOS_EXTRAS.pack_celebra)}` : '',
      ...estado.extras.map((e) => `• ${e.nombre}: ${e.gratis ? 'INCLUIDO' : clp(getPrecio(e, estado.cantNinos))}`),
      estado.usaCocina ? `• Aseo Profundo: ${clp(PRECIOS_EXTRAS.aseo_profundo)}` : '',
      estado.horaExtra ? `• Hora adicional (4 hrs total): ${clp(PRECIOS_EXTRAS.hora_adicional)}` : '',
      (estado.cantNinos === 'mas30' && estado.ninosExtra > 0)
        ? `• Niños adicionales (${estado.ninosExtra}): ${clp(estado.ninosExtra * PRECIOS_EXTRAS.nino_extra)}`
        : '',
    ].filter(Boolean);

    const adicionalesTexto = adicionales.length > 0
      ? adicionales.join('\n')
      : 'Sin adicionales';

    const notasLinea = estado.notas?.trim()
      ? `\n📝 Notas: ${estado.notas.trim()}`
      : '';

    const msg =
`¡Hola César! Quiero reservar en ALCE Kids para el día ${fechaTexto} en horario ${horarioTexto}.

Somos ${cantNinosTexto} niños para el cumple de ${estado.nombreNino}${estado.edadNino ? ` (${estado.edadNino} años)` : ''}.
🏡 Sector: ${sectorTexto}

Adicionales seleccionados:
${adicionalesTexto}

El total estimado es ${clp(total)}.${notasLinea}

¿Está disponible?`;

    window.open(`https://wa.me/56944356955?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const generarWhatsAppVisita = () => {
    const nombre = estado.nombreNino;
    const msg = nombre
      ? `¡Hola César! Me gustaría conocer el espacio Alce Kids antes de reservar la celebración de ${nombre}. ¿Cuándo podría pasar a visitarlo sin compromiso?`
      : `¡Hola César! Me gustaría conocer el espacio Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?`;
    window.open(`https://wa.me/56944356955?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const irAlWizard = () => {
    setVista('wizard');
    setPaso(0);
  };

  const abrirAlce = () => setVista('alce');
  const irInicio = () => setVista('inicio');
  const irAPaso = (n) => setPaso(n);

  // ── VISTA INICIO ──────────────────────────────
  if (vista === 'inicio') {
    return (
      <>
        <Header onHome={irInicio} />
        <CardInicio onSelect={(tipo) => tipo === 'alce' ? abrirAlce() : irAlWizard()} />
        <Footer />
        <WhatsAppFab />
      </>
    );
  }

  // ── VISTA ALCE KIDS ───────────────────────────
  if (vista === 'alce') {
    return (
      <>
        <Header onHome={irInicio} />
        <PageAlce onIniciarWizard={irAlWizard} />
        <Footer />
        <WhatsAppFab />
      </>
    );
  }

  // ── VISTA WIZARD ──────────────────────────────
  return (
    <>
      <Header onHome={irInicio} />
      <div className="max-w-6xl mx-auto px-4 py-8 pb-28 lg:pb-8">

        {/* Banner Alce Kids */}
        <div className="rounded-3xl p-5 mb-8 flex items-center gap-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 50%, #0E6FA8 100%)', boxShadow: '0 8px 40px rgba(13,43,110,0.35)' }}>
          <div className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(circle at 80% 50%, rgba(41,185,232,0.25) 0%, transparent 60%)' }} />
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 relative z-10"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <img src="/logo-alce.webp" alt="Alce Kids" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <span style={{ display: 'none' }} className="text-3xl">🦌</span>
          </div>
          <div className="flex-1 relative z-10">
            <h2 className="text-white font-black text-2xl leading-none">Alce Kids</h2>
            <p className="text-blue-200/70 text-sm mt-0.5">Recinto exclusivo · Talavera de la Reina 380, Las Condes · 0 a 6 años</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xl">⭐ {STATS.rating}</span>
              <span className="text-blue-200/60 text-xs">· {STATS.reseñas} reseñas</span>
            </div>
            <button
              onClick={abrirAlce}
              className="text-xs font-bold px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(41,185,232,0.2)', color: '#93c5fd' }}
            >
              ← Ver el recinto
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 min-w-0">
          {/* Contenido principal */}
          <div className="lg:col-span-2 min-w-0">
            <Pasos actual={paso} total={5} />

            {/* ─── PASO 0: FECHA Y HORA ─── */}
            {paso === 0 && (
              <div>
                {/* ── Video — sin bordes, sin texto, sin overlays.
                     aspect-video SIEMPRE (= proporción nativa del archivo):
                     el alto fijo de antes recortaba los costados en desktop ── */}
                <div
                  className="overflow-hidden mb-7 aspect-video"
                  style={{ background: '#0D2B6E' }}
                >
                  <video
                    className="w-full h-full object-cover"
                    src="/video-home.mp4"
                    poster="/infra-piscina.webp"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>

                {/* ── Urgencia honesta — fechas libres reales del mes ── */}
                {(() => {
                  const ahora = new Date();
                  const libresEste = contarFechasLibres(disponibilidad, ahora.getFullYear(), ahora.getMonth());
                  const nextM = ahora.getMonth() === 11 ? 0 : ahora.getMonth() + 1;
                  const nextY = ahora.getMonth() === 11 ? ahora.getFullYear() + 1 : ahora.getFullYear();
                  const libresProx = contarFechasLibres(disponibilidad, nextY, nextM);
                  const usarProx = libresEste === 0;
                  const n = usarProx ? libresProx : libresEste;
                  const mesNombre = MESES[usarProx ? nextM : ahora.getMonth()];
                  if (n === 0) return null; // sin data o sin cupos: no inventamos nada
                  const pocas = n <= 4;
                  return (
                    <div
                      className="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl"
                      style={{
                        background: pocas
                          ? 'linear-gradient(135deg,#FFF1E6,#FFE4CC)'
                          : 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                        border: `1.5px solid ${pocas ? 'rgba(249,115,22,0.35)' : 'rgba(21,101,192,0.2)'}`,
                      }}
                    >
                      <span className="text-xl flex-shrink-0">{pocas ? '🔥' : '📅'}</span>
                      <p className="text-sm font-bold leading-snug" style={{ color: pocas ? '#9A3412' : '#1E40AF' }}>
                        {pocas
                          ? <>{n === 1 ? 'Queda' : 'Quedan'} <span className="font-black">solo {n} {n === 1 ? 'fecha libre' : 'fechas libres'}</span> en {mesNombre} — los fines de semana se agendan rápido.</>
                          : <><span className="font-black">{n} fechas libres</span> en {mesNombre}. Los fines de semana del sector oriente se reservan con semanas de anticipación.</>}
                      </p>
                    </div>
                  );
                })()}

                {/* ── Tranquilidad de invierno — responde la objeción #1 de mayo-agosto
                     en el momento exacto de la decisión (elegir fecha) ── */}
                {(() => {
                  const mes = new Date().getMonth(); // 4=may … 7=ago
                  if (mes < 4 || mes > 7) return null;
                  return (
                    <div
                      className="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg,#EFF8FF,#E0F2FE)', border: '1.5px solid rgba(14,165,233,0.3)' }}
                    >
                      <span className="text-xl flex-shrink-0">🌧️</span>
                      <p className="text-sm font-bold leading-snug" style={{ color: '#0369A1' }}>
                        ¿Reservando en invierno? Tranquilidad total: si llueve,{' '}
                        <span className="font-black">reagendas sin costo</span> y tu anticipo queda 100% vigente.
                        Nunca pierdes tu reserva.
                      </p>
                    </div>
                  );
                })()}

                {/* ── Dos columnas: Calendario | Horario ── */}
                <div className="grid md:grid-cols-2 gap-6 items-start">

                  {/* Columna izquierda — Calendario */}
                  <div>
                    <p className="text-gray-400 text-xs mb-3 font-semibold tracking-wide uppercase">Viernes · Sábados · Domingos</p>
                    <Calendario
                      fecha={estado.fecha}
                      onFecha={(f) => { set('fecha', f); set('hora', null); }}
                      disponibilidad={disponibilidad}
                    />
                  </div>

                  {/* Columna derecha — Horario */}
                  <div>
                    <p className="text-gray-400 text-xs mb-3 font-semibold tracking-wide uppercase">🕐 Bloque horario</p>

                    {estado.fecha ? (
                      <>
                        {/* Slots AM / PM */}
                        {(() => {
                          const fs = estado.fecha
                            ? `${estado.fecha.getFullYear()}-${String(estado.fecha.getMonth() + 1).padStart(2, '0')}-${String(estado.fecha.getDate()).padStart(2, '0')}`
                            : null;
                          const amReservado = fs && disponibilidad.blockedAM.includes(fs);
                          const pmReservado = fs && disponibilidad.blockedPM.includes(fs);
                          return (
                            <div className="space-y-3 mb-5">
                              {[
                                { id: 'AM', label: 'Mañana · AM', hora: '11:00 — 14:00', emoji: '🌅', reservado: amReservado },
                                { id: 'PM', label: 'Tarde · PM',  hora: '15:30 — 18:30', emoji: '🌇', reservado: pmReservado },
                              ].map((slot) => {
                                const sel = estado.hora === slot.id;
                                return (
                                  <button
                                    key={slot.id}
                                    disabled={slot.reservado}
                                    onClick={() => !slot.reservado && set('hora', slot.id)}
                                    className="w-full p-4 rounded-2xl text-left transition-all duration-200"
                                    style={{
                                      border: slot.reservado ? '2px solid #F3F4F6' :
                                              sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                                      background: slot.reservado ? '#F9FAFB' :
                                                  sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                                      boxShadow: sel ? '0 4px 16px rgba(21,101,192,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                                      transform: sel ? 'scale(1.02)' : 'scale(1)',
                                      cursor: slot.reservado ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`text-2xl ${slot.reservado ? 'opacity-30' : ''}`}>{slot.emoji}</div>
                                      <div className="flex-1">
                                        <div className="font-black text-sm"
                                          style={{ color: slot.reservado ? '#D1D5DB' : sel ? '#1565C0' : '#1e293b',
                                                   textDecoration: slot.reservado ? 'line-through' : 'none' }}>
                                          {slot.label}
                                        </div>
                                        <div className="text-xs mt-0.5"
                                          style={{ color: slot.reservado ? '#D1D5DB' : '#6B7280',
                                                   textDecoration: slot.reservado ? 'line-through' : 'none' }}>
                                          {slot.hora}
                                        </div>
                                      </div>
                                      {slot.reservado && (
                                        <span className="text-xs font-black text-red-400 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                          Reservado
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Imagen "elige tu horario" — solo antes de elegir turno */}
                        {!estado.hora && (
                          <div className="flex justify-center mb-3">
                            <img
                              src="/elige-tu-horario.png"
                              alt="Elige tu horario"
                              className="w-full max-w-[260px]"
                              style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.18))' }}
                            />
                          </div>
                        )}

                        {/* Info duración estándar — siempre visible */}
                        <div
                          className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5 border"
                          style={{ background: '#EFF8FF', borderColor: '#BAE6FD' }}
                        >
                          <span className="text-lg">⏱️</span>
                          <div>
                            <p className="font-black text-xs" style={{ color: '#0369A1' }}>
                              3 horas incluidas + 30 min de cortesía
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#0EA5E9' }}>
                              Adultos ilimitados sin cargo adicional
                            </p>
                          </div>
                        </div>

                        {/* Imagen "¡Buena elección!" — solo cuando ya eligió horario */}
                        {estado.hora && (
                          <div className="flex justify-center">
                            <img
                              src="/buena-eleccion.png"
                              alt="¡Buena elección! ahora al siguiente paso"
                              className="w-full max-w-[300px]"
                              style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.2))' }}
                            />
                          </div>
                        )}

                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <img
                          src="/elige-tu-fecha.png"
                          alt="Elige tu fecha - Alce Kids"
                          className="w-full max-w-[280px] mx-auto"
                          style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.18))' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  disabled={!estado.fecha || !estado.hora}
                  onClick={() => irAPaso(1)}
                  className="mt-8 w-full text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                >
                  Siguiente →
                </button>
              </div>
            )}

            {/* ─── PASO 1: EL FESTEJADO ─── */}
            {paso === 1 && (
              <div>
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>🎂 {estado.festejados > 1 ? 'Los festejados' : 'El festejado'}</h2>
                <p className="text-gray-400 mb-6">Queremos hacer su día inolvidable</p>

                <div className="space-y-5">
                  {/* ── Cumpleaños compartido — 1 a 3 festejados ── */}
                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">¿Cuántos cumpleañeros celebran?</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((n) => {
                        const sel = estado.festejados === n;
                        return (
                          <button
                            key={n}
                            onClick={() => set('festejados', n)}
                            className="py-3.5 px-2 rounded-2xl transition-all duration-200 text-center"
                            style={{
                              border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : 'white',
                              boxShadow: sel ? '0 4px 14px rgba(249,115,22,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div className="font-black text-base" style={{ color: sel ? '#EA580C' : '#6B7280' }}>
                              {n === 1 ? '1 festejado' : `${n} festejados`}
                            </div>
                            <div className="text-xs font-bold mt-0.5" style={{ color: sel ? '#F97316' : '#9CA3AF' }}>
                              {n === 1 ? 'Clásico' : 'Compartido'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {estado.festejados > 1 && (
                      <p className="text-xs mt-2 font-semibold leading-relaxed" style={{ color: '#F97316' }}>
                        🎉 Cumpleaños compartido (hermanos, mellizos o amigos): incluye arco decorativo
                        con el nombre de cada festejado y su propio momento de torta y cumpleaños feliz.
                        El recargo se suma automáticamente en el detalle de valores.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">
                      {estado.festejados > 1 ? '¿Cómo se llaman los cumpleañeros?' : '¿Cómo se llama el cumpleañero/a?'}
                    </label>
                    <input
                      type="text"
                      value={estado.nombreNino}
                      onChange={(e) => set('nombreNino', e.target.value)}
                      placeholder={estado.festejados > 1 ? 'Ej: Sofía y Matías' : 'Ej: Sofía, Matías, Antonia...'}
                      className="w-full rounded-2xl px-5 py-4 text-lg outline-none transition-all font-semibold"
                      style={{
                        border: '2px solid #E5E7EB',
                        background: '#FAFBFF',
                        color: '#1e293b',
                      }}
                      onFocus={(e) => { e.target.style.border = '2px solid #1565C0'; e.target.style.boxShadow = '0 0 0 4px rgba(21,101,192,0.08)'; }}
                      onBlur={(e)  => { e.target.style.border = '2px solid #E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">
                      {estado.festejados > 1 ? '¿Cuántos años cumple el mayor de los festejados?' : '¿Cuántos años cumple?'}
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((edad) => {
                        const sel = estado.edadNino === edad;
                        return (
                          <button
                            key={edad}
                            onClick={() => set('edadNino', edad)}
                            className="py-4 rounded-2xl font-black text-xl transition-all duration-200"
                            style={{
                              border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : 'white',
                              color: sel ? '#EA580C' : '#6B7280',
                              boxShadow: sel ? '0 4px 14px rgba(249,115,22,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                              transform: sel ? 'scale(1.08)' : 'scale(1)',
                            }}
                          >
                            {edad}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs mt-2 font-semibold" style={{ color: '#29B9E8' }}>* Alce Kids celebra a niños hasta los 6 años</p>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-3">¿Habrá niños mayores de 6 años en la celebración?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { val: true,  label: 'Sí, habrá mayores de 6' },
                        { val: false, label: 'No, todos son hasta 6 años' },
                      ].map((opt) => {
                        const sel = estado.ninosMayores === opt.val;
                        return (
                          <button
                            key={String(opt.val)}
                            onClick={() => set('ninosMayores', opt.val)}
                            className="py-4 px-3 rounded-2xl font-bold text-sm transition-all duration-200"
                            style={{
                              border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                              color: sel ? '#1565C0' : '#6B7280',
                              boxShadow: sel ? '0 4px 14px rgba(21,101,192,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {estado.ninosMayores === true && (
                    <div className="rounded-2xl p-4 flex gap-3"
                      style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: '2px solid #FCD34D' }}>
                      <span className="text-2xl flex-shrink-0">⚠️</span>
                      <div>
                        <p className="font-black text-amber-800">Importante — juegos para su edad</p>
                        <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                          Los juegos del jardín están diseñados y dimensionados para niños de{' '}
                          <strong>hasta 6 años</strong>, por lo que los mayores no pueden usarlos —
                          es por la seguridad de todos. Te pedimos que{' '}
                          <strong>tú te encargues de que los más grandes jueguen con lo que es
                          para ellos</strong>: en el paso de adicionales encontrarás{' '}
                          <strong>inflables aptos hasta 12 años</strong>, taca taca, ping pong y
                          animación pensados justamente para ellos.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setPaso(0)}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    disabled={!estado.nombreNino || !estado.edadNino || estado.ninosMayores === null}
                    onClick={() => irAPaso(2)}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 2: CAPACIDAD ─── */}
            {paso === 2 && (
              <div>
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>👨‍👩‍👧‍👦 Capacidad e invitados</h2>
                <p className="text-gray-400 mb-4">¿Cuántos niños asistirán?</p>

                {/* Banner adultos */}
                <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '1.5px solid rgba(21,101,192,0.2)' }}>
                  <span className="text-2xl">🎉</span>
                  <p className="font-bold text-sm" style={{ color: '#1E40AF' }}>
                    <strong>¡Adultos ilimitados incluidos!</strong> No pagas extra por papás, apoderados ni familiares que acompañen.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { id: 'hasta10', label: 'Hasta 10 niños', tag: 'Sector Independiente disponible', precio: null },
                    { id: 'hasta20', label: 'Hasta 20 niños', tag: 'Recinto Completo',  precio: aplicarMult(esSabado ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20, estado.edadNino, 'hasta20') },
                    { id: 'hasta30', label: 'Hasta 30 niños', tag: 'Recinto Completo',  precio: aplicarMult(esSabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30, estado.edadNino, 'hasta30') },
                    { id: 'mas30',   label: 'Más de 30 niños', tag: '+$10.000 por niño extra', precio: aplicarMult(esSabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30, estado.edadNino, 'mas30') },
                  ].map((op) => {
                    const sel = estado.cantNinos === op.id;
                    return (
                      <button
                        key={op.id}
                        onClick={() => {
                          set('cantNinos', op.id);
                          if (op.id !== 'hasta10') set('sector', 'completo');
                          else set('sector', null);
                          set('ninosExtra', op.id === 'mas30' ? 1 : 0);
                        }}
                        className="p-4 rounded-2xl text-left transition-all duration-200"
                        style={{
                          border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                          background: sel ? 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' : 'white',
                          boxShadow: sel ? '0 4px 20px rgba(21,101,192,0.18)' : '0 1px 4px rgba(0,0,0,0.04)',
                          transform: sel ? 'scale(1.02)' : 'scale(1)',
                        }}
                      >
                        <div className="font-black text-gray-800 text-sm">{op.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5 mb-2.5">{op.tag}</div>
                        {op.precio
                          ? <div className="font-black text-lg" style={{ color: sel ? '#1565C0' : '#374151' }}>{clp(op.precio)}</div>
                          : <div className="text-xs font-bold" style={{ color: '#29B9E8' }}>Ver opciones →</div>
                        }
                      </button>
                    );
                  })}
                </div>

                {/* Selector de sector — solo para hasta10 */}
                {estado.cantNinos === 'hasta10' && (
                  <div className="mb-4">
                    <h3 className="font-black text-gray-700 mb-3">¿Qué sector prefieres?</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        {
                          id: 'independiente',
                          nombre: 'Sector Independiente',
                          desc: 'Un solo sector del recinto. Más íntimo y privado.',
                          precio: aplicarMult(esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente, estado.edadNino, 'hasta10'),
                          emoji: '🌳',
                        },
                        {
                          id: 'completo',
                          nombre: 'Recinto Completo',
                          desc: 'Acceso a todas las áreas. La experiencia completa.',
                          precio: aplicarMult(esSabado ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10, estado.edadNino, 'hasta10'),
                          emoji: '🏡',
                        },
                      ].map((s) => {
                        const sel = estado.sector === s.id;
                        return (
                        <button
                          key={s.id}
                          onClick={() => set('sector', s.id)}
                          className="p-5 rounded-2xl text-left transition-all duration-200"
                          style={{
                            border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                            background: sel ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' : 'white',
                            boxShadow: sel ? '0 4px 20px rgba(249,115,22,0.18)' : '0 1px 4px rgba(0,0,0,0.04)',
                            transform: sel ? 'scale(1.02)' : 'scale(1)',
                          }}
                        >
                          <div className="text-3xl mb-2">{s.emoji}</div>
                          <div className="font-black text-gray-800 text-sm">{s.nombre}</div>
                          <div className="text-gray-400 text-xs mt-1 mb-3">{s.desc}</div>
                          <div className="font-black text-lg" style={{ color: sel ? '#F97316' : '#1565C0' }}>{clp(s.precio)}</div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {estado.cantNinos && estado.cantNinos !== 'hasta10' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                    <p className="text-blue-700 font-bold text-sm">🏡 Recinto Completo — asignado automáticamente</p>
                    <p className="text-blue-500 text-xs mt-1">Para grupos de más de 10 niños, el Recinto Completo garantiza la mejor experiencia para todos.</p>
                  </div>
                )}

                {/* ── Contador niños extra — solo cuando "Más de 30" ── */}
                {estado.cantNinos === 'mas30' && (
                  <div
                    className="rounded-2xl border-2 p-5 mb-4"
                    style={{ background: 'linear-gradient(135deg,#EFF8FF,#FFF7ED)', borderColor: '#BAE6FD' }}
                  >
                    <p className="font-black text-gray-800 text-sm mb-0.5">
                      👶 Niños adicionales sobre los 30
                    </p>
                    <p className="text-gray-400 text-xs mb-4">
                      Mínimo 1 · Cada niño adicional suma{' '}
                      <span className="font-black" style={{ color: '#F97316' }}>$10.000</span> al total
                    </p>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        onClick={() => set('ninosExtra', Math.max(1, (estado.ninosExtra || 1) - 1))}
                        disabled={(estado.ninosExtra || 1) <= 1}
                        className="w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-all shadow-sm"
                        style={{
                          background: (estado.ninosExtra || 1) > 1 ? '#1565C0' : '#F3F4F6',
                          color: (estado.ninosExtra || 1) > 1 ? 'white' : '#D1D5DB',
                        }}
                      >
                        −
                      </button>
                      <div className="text-center min-w-[80px]">
                        <div className="font-black text-4xl leading-none" style={{ color: '#1565C0' }}>
                          {estado.ninosExtra || 0}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          niño{(estado.ninosExtra || 1) !== 1 ? 's' : ''} adicional{(estado.ninosExtra || 1) !== 1 ? 'es' : ''}
                        </div>
                        <div className="text-xs font-black mt-1" style={{ color: '#F97316' }}>
                          +{clp((estado.ninosExtra || 1) * PRECIOS_EXTRAS.nino_extra)}
                        </div>
                      </div>
                      <button
                        onClick={() => set('ninosExtra', Math.min(10, (estado.ninosExtra || 1) + 1))}
                        className="w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-all shadow-sm text-white"
                        style={{ background: '#F97316' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Hora Adicional ── */}
                <div
                  className="rounded-2xl border-2 p-4 transition-all mt-4"
                  style={{
                    borderColor: estado.horaExtra ? '#F97316' : '#E5E7EB',
                    background: estado.horaExtra ? '#FFF7ED' : 'white',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-black text-gray-800 text-sm">⏰ Hora Adicional</p>
                      <p className="text-gray-400 text-xs mt-0.5 leading-snug">
                        Extiende tu celebración 1 hora más
                      </p>
                      <p className="font-black text-sm mt-1.5" style={{ color: '#F97316' }}>
                        +{clp(PRECIOS_EXTRAS.hora_adicional)}
                      </p>
                    </div>
                    <button
                      onClick={() => set('horaExtra', !estado.horaExtra)}
                      className="w-14 h-7 rounded-full relative flex-shrink-0 mt-1 transition-colors"
                      style={{ background: estado.horaExtra ? '#F97316' : '#E5E7EB' }}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full absolute top-1 shadow transition-all ${
                          estado.horaExtra ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  {estado.horaExtra && (
                    <div className="mt-2 pt-2 border-t border-orange-200">
                      <p className="text-xs font-bold text-orange-700">
                        ✓ Hora adicional agregada — 4 horas total
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setPaso(1)}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    disabled={!estado.cantNinos || !estado.sector}
                    onClick={() => irAPaso(3)}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                  >
                    Ver qué incluye →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 3: QUÉ INCLUYE (SHOWROOM) ─── */}
            {paso === 3 && (
              <div>
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>✨ Todo lo que incluye tu reserva</h2>
                <p className="text-gray-400 mb-6">Sin costos ocultos. Esto viene incluido en el precio base.</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                  {[
                    { emoji: '🎵', nombre: 'Parlantes BT',     desc: 'Conecta tu smartphone y pon tu playlist' },
                    { emoji: '❄️', nombre: 'Climatización',    desc: 'Aire acondicionado para máximo confort' },
                    { emoji: '🍳', nombre: 'Cocina de apoyo',  desc: 'Para calentar y preparar (no cocinar)*' },
                    { emoji: '🎀', nombre: 'Arco decorativo',  desc: 'Con el nombre de tu hijo incluido' },
                    { emoji: '🅿️', nombre: '3 Estacionamientos', desc: 'Exclusivos para tu celebración' },
                    { emoji: '🚿', nombre: 'Baños completos',  desc: 'Diferenciados adultos y niños' },
                    { emoji: '🌿', nombre: 'Privacidad total', desc: 'Cerramientos verdes + toldos contra el sol' },
                    { emoji: '👨‍👩‍👧', nombre: 'Adultos ilimitados', desc: '¡Sin cargo extra por adultos!' },
                    { emoji: '🐰', nombre: 'Granja con conejos', desc: 'Experiencia única que los niños adoran' },
                  ].map((item) => (
                    <div
                      key={item.nombre}
                      className="bg-white border border-blue-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="text-4xl mb-2">{item.emoji}</div>
                      <div className="font-black text-gray-800 text-sm">{item.nombre}</div>
                      <div className="text-gray-400 text-xs mt-1 leading-tight">{item.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Galería interactiva */}
                <h3 className="font-black text-gray-700 mb-3">📸 Nuestro espacio — toca cualquier foto para verla en grande</h3>
                <div className="mb-6">
                  <GaleriaInfra />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setPaso(2)}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    onClick={() => irAPaso(4)}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}
                  >
                    Ver adicionales →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 4: ADICIONALES ─── */}
            {paso === 4 && (
              <div>
                {/* Nav categorías sticky */}
                <div className="sticky z-40 flex items-center"
                  style={{ top: '72px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '2px solid rgba(21,101,192,0.07)' }}>
                  <button onClick={() => navCatRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg"
                    style={{ color: '#1565C0' }}>‹</button>
                  <div ref={navCatRef} className="flex gap-1.5 px-2 py-2.5 overflow-x-auto flex-1 min-w-0"
                    style={{ scrollbarWidth: 'none' }}>
                    {BLOQUES_VITRINA.map((b) => (
                      <button key={b.id}
                        onClick={() => {
                          setActivoBloqueId(b.id);
                          document.getElementById(b.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all"
                        style={activoBloqueId === b.id
                          ? { background: '#1565C0', color: 'white', boxShadow: '0 2px 10px rgba(21,101,192,0.35)' }
                          : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                        {b.titulo}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => navCatRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg"
                    style={{ color: '#1565C0' }}>›</button>
                </div>

                {/* ── Libertad total — quita la presión de venta en el momento del upsell.
                     Diferenciador clave: nada es obligatorio, pueden traer todo de afuera ── */}
                <div className="rounded-2xl px-4 py-3 mt-5 flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#F0F9FF,#EFF6FF)', border: '1.5px solid rgba(21,101,192,0.18)' }}>
                  <span className="text-xl flex-shrink-0">🔓</span>
                  <p className="text-sm font-bold leading-snug" style={{ color: '#1E40AF' }}>
                    Todo lo de esta sección es <span className="font-black">100% opcional</span>.
                    Puedes traer tu torta, comida y decoración por tu cuenta sin ningún recargo —
                    o dejar que lo armemos nosotros. Tú tienes la libertad.
                  </p>
                </div>

                {/* Pack Celebra Sin Cesar */}
                <div className="rounded-2xl p-5 mt-5 mb-6 border-2"
                  style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', borderColor: '#F97316' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-black text-orange-900 text-base leading-tight">Pack Celebra Sin Cesar</h3>
                        <span className="bg-orange-500 text-white text-xs font-black px-2 py-0.5 rounded-full">POPULAR</span>
                      </div>
                      <p className="text-orange-700 text-sm leading-snug">Piñata temática · Decoración básica por sexo · Arco de globos</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-orange-900 text-xl">{clp(PRECIOS_EXTRAS.pack_celebra)}</div>
                      <button
                        onClick={() => set('packCelebra', !estado.packCelebra)}
                        className="mt-2 px-4 py-2 rounded-xl font-black text-sm transition-all"
                        style={estado.packCelebra
                          ? { background: '#F97316', color: 'white' }
                          : { background: 'white', border: '2px solid #F97316', color: '#F97316' }}>
                        {estado.packCelebra ? '✓ Agregado' : '+ Agregar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vitrina de bloques */}
                {BLOQUES_VITRINA.map((bloque) => (
                  <BloqueSection
                    key={bloque.id}
                    bloque={bloque}
                    onTapGrupo={setGrupoFicha}
                    getSeleccionado={(grupo) => grupo.items.some(i => estado.extras.some(e => e.id === i.id))}
                  />
                ))}

                {/* Botones volver + confirmar */}
                <div className="flex gap-3 mt-6 mb-4">
                  <button onClick={() => setPaso(3)}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button onClick={generarWhatsApp}
                    className="flex-1 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}>
                    <WaIcon /> Confirmar por WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* ── Rescate humano + visita — visible en TODOS los pasos del wizard.
                 El papá que se complica con el sistema o prefiere ver antes de
                 decidir tiene siempre una salida cálida, sin perder el lead ── */}
            <div className="mt-10 pt-6 text-center" style={{ borderTop: '1px solid rgba(21,101,192,0.1)' }}>
              <p className="text-sm text-gray-400 leading-relaxed max-w-md mx-auto">
                ¿Te complica el sistema o prefieres armarlo conversando?
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center mt-3">
                <a
                  href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Estoy armando mi celebración en la web pero prefiero que me ayudes tú directamente 😊')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-black px-5 py-2.5 rounded-full transition-all hover:scale-105"
                  style={{ color: '#16a34a', border: '1.5px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.06)' }}
                >
                  <WaIcon /> Te ayudo por WhatsApp
                </a>
                <a
                  href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Antes de reservar me gustaría visitar el jardín sin compromiso. ¿Qué día te acomoda para coordinar?')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:scale-105"
                  style={{ color: '#1565C0', border: '1.5px solid rgba(21,101,192,0.25)', background: 'rgba(21,101,192,0.05)' }}
                >
                  📍 Visitar antes de decidir
                </a>
                <a
                  href="/#faq"
                  className="inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:scale-105"
                  style={{ color: '#6B7280', border: '1.5px solid #E5E7EB', background: 'white' }}
                >
                  ❓ Dudas frecuentes
                </a>
              </div>
            </div>
          </div>

          {/* ─── SIDEBAR RESUMEN ─── */}
          <div className="hidden lg:block">
            <ResumenLateral estado={estado} total={total} onWhatsApp={generarWhatsApp} />
          </div>
        </div>
      </div>

      {/* Modal carrusel del grupo seleccionado */}
      {grupoAbierto && (
        <ModalCarrusel
          grupo={grupoAbierto}
          extras={estado.extras}
          cantNinos={estado.cantNinos}
          onToggle={toggleItemModal}
          onCerrar={() => setGrupoAbierto(null)}
        />
      )}

      {/* FichaCarrusel paso 4 — misma lógica que /catalogo pero con botón Agregar */}
      {grupoFicha && (
        <FichaCarrusel
          grupo={grupoFicha}
          onCerrar={() => setGrupoFicha(null)}
          onAdd={(item, grupo) => toggleItemModal(item, grupo)}
          isAdded={(item) => estado.extras.some(e => e.id === item.id)}
          cantNinos={estado.cantNinos || 'hasta10'}
        />
      )}

      {/* Barra inferior móvil — toca para ver el desglose completo */}
      {total > 0 && !sheetAbierto && (
        <div
          onClick={() => setSheetAbierto(true)}
          className="fixed bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between lg:hidden z-50 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #060F2E 0%, #0D1B3E 100%)',
            borderTop: '1px solid rgba(41,185,232,0.2)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div>
            {/* Conteo + indicador "Ver detalle" */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full font-black text-white"
                style={{ background: '#F97316', fontSize: '10px' }}
              >
                {estado.extras.length + (estado.packCelebra ? 1 : 0)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                seleccionados · <span style={{ color: '#29B9E8' }}>Ver detalle ↑</span>
              </span>
            </div>
            <div className="font-black text-2xl" style={{ color: '#F97316', textShadow: '0 0 16px rgba(249,115,22,0.4)' }}>
              {clp(total)}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); generarWhatsApp(); }}
            className="text-white font-black py-3 px-6 rounded-2xl flex items-center gap-2 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}
          >
            <WaIcon /> Confirmar
          </button>
        </div>
      )}

      {/* Bottom sheet móvil — resumen completo */}
      {sheetAbierto && (
        <BottomSheetResumen
          estado={estado}
          total={total}
          onWhatsApp={generarWhatsApp}
          onCerrar={() => setSheetAbierto(false)}
          onQuitarExtra={quitarExtra}
        />
      )}

      {/* Toast — celebración retomada desde donde quedó (persistencia) */}
      {retomado && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] px-5 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap"
          style={{
            background: 'rgba(6,15,46,0.96)',
            border: '1px solid rgba(41,185,232,0.4)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ✨ Retomamos tu celebración donde la dejaste
        </div>
      )}
    </>
  );
}
