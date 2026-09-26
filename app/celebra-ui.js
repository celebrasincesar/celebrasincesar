'use client';

// ══════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTIDOS — Celebra Sin Cesar
// ──────────────────────────────────────────────────────────────────
// Los alimentan las mismas fuentes de siempre (data/master.js,
// data/reglas.js, data/packs-mayores.js). Las tres experiencias
// —Home, /alce-kids y /armar— comparten estos objetos: no hay copias.
// ══════════════════════════════════════════════════════════════════

import { useState, useMemo, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PRECIOS_BASE, PRECIOS_EXTRAS, CATEGORIAS_ADICIONALES, BLOQUES_VITRINA, MULTIPLICADORES, TYC_VERSION, NEGOCIO } from '../data/master';
import { CATEGORIAS_PACK, COPY_MAYORES } from '../data/packs-mayores';
import {
  MAX_NINOS, MIN_NINOS, TRAMOS_MAYORES, contextoDesde, tramoDesdeTotal,
  ninosExtraDesdeTotal, puedeElegirSector, motivoRecintoCompleto, filtrarBloques, recomendados,
  packPara, opcionesPack, ramaActiva, packCompleto, itemsDelPack, precioPack,
  packEsReferencial, cotizacionEsReferencial, seleccionVacia, resumenPack, itemVisible, getItem,
  labelInvitados, labelMayores as labelMayoresReglas, horarioEfectivo, clp, valorMayores,
} from '../data/reglas';
import { buscarPromo } from '../data/promos';
import { CARRUSEL, VITRINA } from '../data/imagenes';
import { STATS, INSTAGRAM_STRIP_TEXT, RESEÑAS_CORTO, RESEÑAS_LARGO, RESEÑAS_LABEL, AÑOS_HISTORIA_LABEL, RESEÑA_ORIGEN_LABEL } from '../data/stats';
import { TESTIMONIOS, GOOGLE_REVIEWS_URL } from '../data/testimonios';
import { FAQS } from '../data/faqs';
import { BloqueSection, FichaCarrusel, scrollBehavior } from './adicionales-grid';

// ── Lookup rápido de items por ID (para resolver grupos de la vitrina)
export const ITEM_LOOKUP = Object.fromEntries(
  CATEGORIAS_ADICIONALES.flatMap((c) => c.items).map((item) => [item.id, item])
);
// Resuelve los itemIds de un grupo a objetos item completos
export function resolveGrupo(grupo) {
  return { ...grupo, items: (grupo.itemIds || []).map((id) => ITEM_LOOKUP[id]).filter(Boolean) };
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
export { clp };   // formato de peso chileno — vive en la capa de datos

export function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style={{ display: 'inline', verticalAlign: '-0.125em' }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// Resuelve el precio de un ítem según la capacidad de niños elegida.
// Si el ítem tiene `precios` (objeto por tier), usa ese tier.
// Fallback: campo `precio` legacy → 0.
export const getPrecio = (item, cantNinos) => {
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};

// ── Incrementos de precio: edad + cantidad (sistema lineal +$15k/escalón) ──
export const getAddEdad = (edadNino) => {
  if (!edadNino) return 0;
  const e = Number(edadNino);
  for (const r of MULTIPLICADORES.edad) {
    if (r.edades.includes(e)) return r.add;
  }
  return 0;
};
export const getAddCantidad = (cantNinos) => {
  const r = MULTIPLICADORES.cantidad.find((c) => c.id === cantNinos);
  return r ? r.add : 0;
};

// ── Descuento por código de promoción ────────────────────────────────────────
// Ítems (por id) que pertenecen a cada categoría, para saber a qué aplica una promo.
export const ITEMS_POR_CATEGORIA = Object.fromEntries(
  CATEGORIAS_ADICIONALES.map((c) => [c.id, new Set(c.items.map((i) => i.id))])
);
// Calcula el descuento de una promo sobre la selección del papá.
// porcentaje_item → % sobre el ítem elegible de MAYOR valor (el que más le conviene).
// Devuelve { monto, itemNombre, faltaItem }.
export function calcularDescuento(promo, extras, cantNinos) {
  if (!promo) return { monto: 0, itemNombre: null, faltaItem: false };
  if (promo.tipo === 'porcentaje_item') {
    const ids = ITEMS_POR_CATEGORIA[promo.categoria] || new Set();
    const elegibles = (extras || []).filter((e) => e && ids.has(e.id) && !e.gratis);
    if (elegibles.length === 0) return { monto: 0, itemNombre: null, faltaItem: true };
    const mejor = elegibles.reduce((a, b) => (getPrecio(b, cantNinos) > getPrecio(a, cantNinos) ? b : a));
    const monto = Math.round((getPrecio(mejor, cantNinos) * promo.valor) / 100);
    return { monto, itemNombre: mejor.nombre, faltaItem: false };
  }
  return { monto: 0, itemNombre: null, faltaItem: false };
}

// Recargo total del cumpleaños compartido según nº de festejados (1/2/3)
export const recargoFestejados = (n) => PRECIOS_EXTRAS.festejados_recargo?.[n] ?? 0;
// precio_final = base + add_edad + add_cantidad (solo si hay base válida)
export const aplicarMult = (base, edadNino, cantNinos) =>
  base === 0 ? 0 : base + getAddEdad(edadNino) + getAddCantidad(cantNinos);

// Cuenta las fechas reservables (Vie/Sáb/Dom) aún libres en un mes:
// futuras y no bloqueadas en Google Calendar. Base de la urgencia honesta.
export function contarFechasLibres(disponibilidad, anio, mes) {
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

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
// Días del calendario ahora internos al componente Calendario (Lun→Dom)

// ─────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────

export function Header({ onHome, variant = 'sitio' }) {
  // En el armador el papá ya está decidiendo: ofrecerle "agendar visita" en la
  // barra superior es una salida que compite con el paso que está dando (§P1-29).
  const esWizard = variant === 'wizard';
  // ALCE KIDS es protagonista dentro de la experiencia de celebración
  // (/alce-kids, /armar) — Celebra Sin Cesar queda como marca paraguas ahí,
  // igual que ya lo hace pago/resultado. La home (/) sigue mostrando Celebra
  // Sin Cesar como marca principal (documento "Fase de consolidación final",
  // 12-sep-2026, §8).
  const esCelebracion = variant === 'wizard' || variant === 'alce';
  return (
    <header className="sticky top-0 z-50" style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(21,101,192,0.1)', boxShadow: '0 1px 20px rgba(21,101,192,0.08)' }}>
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
        <button onClick={onHome} className="group flex-shrink-0 flex items-center gap-2">
          <img
            src={esCelebracion ? '/logo-alce.webp' : '/logo-celebra.webp'}
            alt={esCelebracion ? 'Alce Kids' : 'Celebra Sin Cesar'}
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
          {esCelebracion && (
            <span className="hidden sm:block text-[11px] font-bold leading-tight" style={{ color: '#9CA9C4' }}>
              Una experiencia de<br />Celebra Sin Cesar
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          {/* La visita presencial convierte ~100% — CTA siempre visible en desktop,
              salvo dentro del armador. Lleva a /visitar (documento "FASE 3A —
              VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B", 22-sep-2026,
              §15): desde ahí el cliente elige agendar solo o WhatsApp — ya
              no un wa.me directo. */}
          {!esWizard && (
            <Link
              href="/visitar"
              className="hidden md:flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full transition-all hover:scale-105"
              style={{ color: '#1565C0', border: '1.5px solid rgba(21,101,192,0.3)', background: 'rgba(21,101,192,0.05)' }}
            >
              📍 Agendar visita
            </Link>
          )}
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
export function HeroStatic({ onVerOpciones, onArmar }) {
  return (
    <section
      className="relative flex items-center justify-center overflow-hidden"
      style={{ height: 'calc(100vh - 72px)', maxHeight: 'calc(100svh - 72px)', minHeight: '520px' }}
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
        <div className="mb-4 md:mb-6">
          <img
            src="/logo-celebra.webp"
            alt="Celebra Sin Cesar"
            className="h-24 md:h-48 w-auto mx-auto"
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
          className="text-white/90 text-lg md:text-2xl font-black mb-2 leading-snug"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
        >
          Alce Kids · Cumpleaños infantiles en Las Condes que tu hijo siempre recordará
        </h1>
        <p
          className="text-white/65 text-sm md:text-base mb-4 md:mb-6 max-w-lg"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          <span className="text-white/90 font-bold">600 m²</span> para celebrar en familia: piscina de pelotas,
          tobogán, granja, salón climatizado y adultos sin costo adicional. Una celebración que
          <span className="text-white/90 font-bold"> adaptas a tu manera</span>.
        </p>
        <p className="text-white/80 text-sm md:text-base font-bold mb-4 md:mb-6 max-w-lg">
          Arma tu celebración, mira el precio al instante y reserva online.
        </p>

        {/* ── Franja de confianza — prueba social premium ── */}
        <div
          className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mb-5 md:mb-9 px-5 py-2.5 rounded-2xl"
          style={{ background: 'rgba(6,15,46,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 8px 28px rgba(0,0,0,0.28)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm tracking-tight" style={{ color: '#FBBF24', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>★★★★★</span>
            <span className="text-white font-black text-sm">{STATS.rating}</span>
            <span className="text-white/55 text-xs font-semibold hidden sm:inline">en Google</span>
          </div>
          <div className="w-px h-4 hidden sm:block" style={{ background: 'rgba(255,255,255,0.22)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{STATS.reseñas}+</span>
            <span className="text-white/55 text-xs font-semibold">reseñas en Google</span>
          </div>
          <div className="w-px h-4 hidden sm:block" style={{ background: 'rgba(255,255,255,0.22)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-sm">{STATS.añosHistoria}+ años</span>
            <span className="text-white/55 text-xs font-semibold">en Las Condes</span>
          </div>
        </div>

        {/* CTA principal — lleva al armador, que es a lo que el papá vino.
            "Ver cómo funciona" queda de apoyo, sin competir (§P1-30). */}
        <button
          onClick={onArmar}
          className="cta-pulso group flex items-center gap-3 font-black text-lg md:text-xl px-10 py-4 rounded-full transition-all duration-300 active:scale-95"
          style={{
            background: 'linear-gradient(90deg, #F97316 0%, #29B9E8 100%)',
            color: 'white',
            boxShadow:
              '0 8px 32px rgba(249,115,22,0.45), 0 2px 12px rgba(0,0,0,0.25)',
          }}
        >
          🎉 Ver disponibilidad y precio · sin compromiso
        </button>
        <button
          onClick={onVerOpciones}
          className="mt-3 text-sm font-bold text-white/70 hover:text-white transition-colors"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          Ver cómo funciona ↓
        </button>

        {/* CTA visita sin compromiso — SIEMPRE visible en la primera pantalla.
            Lleva a /visitar (agendar o WhatsApp), no directo a WhatsApp. */}
        <p className="text-white/45 text-xs mt-4">¿Primero quieres ver el lugar en persona?</p>
        <Link
          href="/visitar"
          className="text-white/80 text-sm font-bold hover:text-white transition-colors mt-1"
          style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          Conocer el lugar sin compromiso →
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// TESTIMONIOS — prueba social premium (reseñas reales desde data/testimonios.js)
// ─────────────────────────────────────────────
export function Testimonios() {
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
            {RESEÑAS_LABEL} de familias del sector oriente que ya celebraron con nosotros — y +{STATS.seguidores} nos siguen en Instagram.
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
                    <div className="text-white/35 text-xs mt-1">{RESEÑA_ORIGEN_LABEL}</div>
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
            {tieneQuotes ? `Ver las ${STATS.reseñas}+ reseñas en Google` : `Lee las ${STATS.reseñas}+ reseñas en Google`}
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
export function FAQ() {
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
export function ComoFuncionaCTA() {
  const pasos = [
    { n: '1', t: 'Elige tu fecha y horario', d: 'Ves la disponibilidad real al instante.' },
    { n: '2', t: 'Arma tu celebración', d: 'A tu manera: trae lo tuyo o suma adicionales.' },
    { n: '3', t: 'Paga el anticipo y reserva', d: 'Tu fecha queda confirmada al instante. Después completas los datos finales en Mi Celebración, tu página privada.' },
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
          <Link href="/visitar"
            className="font-bold text-sm px-6 py-4 rounded-full text-white/80 transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)' }}>
            O conoce el lugar sin compromiso →
          </Link>
        </div>
        <p className="text-white/40 text-sm mt-7">
          ¿Tu cumpleaños es más adelante?{' '}
          <a
            href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola! 😊 El cumple de mi hij@ es más adelante. ¿Me ayudan a ver disponibilidad y precios?')}`}
            target="_blank" rel="noopener noreferrer"
            className="font-bold transition-colors hover:text-white"
            style={{ color: '#29B9E8', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Consúltanos por WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TARJETA "PRÓXIMAMENTE" CON CAPTURA DE CORREO
// Lista de espera para Alce Arena / Alce Go. Guarda el correo vía /api/waitlist
// (Google Sheet) y mantiene WhatsApp como opción secundaria.
// ─────────────────────────────────────────────
export const EMAIL_RE_CLIENTE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function WaitlistCard({ emoji, titulo, subtitulo, desc, categoria, waMessage }) {
  const [email, setEmail]   = useState('');
  const [hp, setHp]         = useState(''); // honeypot antispam (oculto)
  const [status, setStatus] = useState('idle'); // idle | sending | ok | error

  const waHref = `https://wa.me/56944356955?text=${encodeURIComponent(waMessage)}`;

  const submit = async (e) => {
    e.preventDefault();
    if (status === 'sending' || status === 'ok') return;
    const val = email.trim();
    if (!EMAIL_RE_CLIENTE.test(val)) { setStatus('error'); return; }
    setStatus('sending');
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val, categoria, hp }),
      });
      const data = await r.json().catch(() => ({}));
      setStatus(data?.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-3xl relative overflow-hidden block transition-all duration-300 hover:-translate-y-1"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="absolute top-4 right-4 z-10 text-xs font-bold px-2.5 py-1 rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
        PRÓXIMAMENTE
      </div>
      <div className="px-8 pt-8 pb-2" style={{ filter: 'blur(0.5px) grayscale(0.6)', opacity: 0.45 }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="text-5xl">{emoji}</span>
        </div>
        <h2 className="text-2xl font-black text-white text-center mb-1">{titulo}</h2>
        <p className="text-white/50 font-bold text-center text-sm mb-3">{subtitulo}</p>
        <p className="text-white/40 text-sm text-center">{desc}</p>
      </div>

      <div className="px-8 pb-8 pt-3">
        {status === 'ok' ? (
          <div className="py-4 px-4 rounded-2xl text-center"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}>
            <p className="text-sm font-black" style={{ color: '#22c55e' }}>🔔 ¡Listo! Quedaste en la lista.</p>
            <p className="text-white/50 text-xs mt-1">Te avisamos por correo apenas abramos {titulo}.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="text-white/45 text-xs text-center mb-2 font-semibold">
              Déjanos tu correo y te avisamos apenas abra 👇
            </p>
            {/* Honeypot antispam — invisible para humanos */}
            <input
              type="text" name="empresa" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={hp} onChange={(e) => setHp(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />
            <input
              type="email" inputMode="email" autoComplete="email" required
              placeholder="tucorreo@ejemplo.cl"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
              className="w-full px-4 py-3 rounded-xl text-sm text-white mb-2 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${status === 'error' ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.14)'}`,
              }}
            />
            {status === 'error' && (
              <p className="text-xs mb-2 text-center" style={{ color: '#f87171' }}>
                Revisa el correo e inténtalo de nuevo.
              </p>
            )}
            <button
              type="submit" disabled={status === 'sending'}
              className="w-full py-3 rounded-2xl text-center text-sm font-black transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'rgba(41,185,232,0.14)', color: '#29B9E8', border: '1px solid rgba(41,185,232,0.35)' }}>
              {status === 'sending' ? 'Enviando…' : '🔔 Avísame cuando abra'}
            </button>
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs text-white/35 mt-3 transition-colors hover:text-white/70">
              o escríbeme por WhatsApp →
            </a>
          </form>
        )}
      </div>
    </div>
  );
}

export function CardInicio({ onSelect }) {
  const opcionesRef = useRef(null);

  const scrollToOpciones = () => {
    opcionesRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  };

  return (
    <div>
      {/* ── SECCIÓN HERO VIDEO ─────────────────── */}
      <HeroStatic onVerOpciones={scrollToOpciones} onArmar={() => onSelect('armar')} />

      {/* ── SECCIÓN OPCIONES ──────────────────── */}
      <div
        ref={opcionesRef}
        className="scroll-mt-16"
        style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 55%, #081529 100%)' }}
      >
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-20">

          {/* Encabezado — compacto en móvil: la tarjeta Alce Kids debe verse
               COMPLETA (hasta su botón) en la primera pantalla tras el tap */}
          <div className="text-center mb-6 md:mb-14">
            <div
              className="inline-flex items-center gap-2 font-bold text-xs px-4 py-1.5 rounded-full mb-3 md:mb-5"
              style={{ background: 'rgba(41,185,232,0.12)', color: '#29B9E8', border: '1px solid rgba(41,185,232,0.25)' }}
            >
              📍 Las Condes · Santiago de Chile
            </div>
            <h2 className="text-2xl md:text-5xl font-black leading-tight mb-2 md:mb-4 text-white">
              El cumpleaños que tu hijo
              <br />
              <span style={{ color: '#F97316' }}>nunca olvidará</span>
            </h2>
            <p className="text-white/45 text-sm md:text-base max-w-lg mx-auto">
              Elige tu opción, arma la celebración completa y confirma en minutos — sin llamadas, sin burocracia.
            </p>
          </div>

          {/* ── ALCE KIDS, sin competencia visual (§J) ────────────── */}
          <div className="max-w-md mx-auto">

            {/* ─ ALCE KIDS — PREMIUM FEATURED ─ */}
            <div
              className="rounded-3xl transition-all duration-300 hover:-translate-y-2 group relative overflow-hidden"
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

              {/* Contenido — compacto en móvil para que el CTA quede a la vista */}
              <div className="p-6 pt-11 md:p-8 md:pt-12">
                <div className="w-20 h-20 md:w-28 md:h-28 mx-auto mb-3 md:mb-5 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                  <img src="/logo-alce.webp" alt="Alce Kids" className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  <div style={{ display: 'none' }} className="w-full h-full rounded-2xl items-center justify-center text-5xl bg-blue-900">🦌</div>
                </div>

                <h2 className="text-2xl font-black text-center mb-1 text-white">Alce Kids</h2>
                <p className="font-bold text-center text-sm mb-1" style={{ color: '#29B9E8' }}>Recinto exclusivo · 0 a 6 años · Las Condes</p>
                <p className="text-white/40 text-xs text-center mb-3 md:mb-5">Talavera de la Reina 380 · cerca Metro Los Dominicos</p>

                {/* Mini features */}
                <div className="grid grid-cols-2 gap-1.5 mb-4 md:mb-6 text-xs">
                  {['🎱 Piscina de pelotas', '🎢 Gran tobogán', '🚗 Autopista kids', '🐰 Granja animales'].map((f) => (
                    <div key={f} className="px-2 py-1.5 rounded-lg text-white/55 font-semibold"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {f}
                    </div>
                  ))}
                </div>

                {/* Dos intenciones distintas, dos botones (§F): quien ya
                    decidió arma; quien todavía no, conoce el recinto. */}
                <button
                  onClick={() => onSelect('armar')}
                  className="w-full font-black py-3.5 rounded-2xl text-center text-white text-sm transition-transform hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(90deg, #F97316, #EA580C)', boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
                  Armar mi celebración →
                </button>
                <button
                  onClick={() => onSelect('alce')}
                  className="w-full font-bold py-3 mt-2.5 rounded-2xl text-center text-sm transition-colors"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(41,185,232,0.35)', color: '#29B9E8' }}>
                  Conocer Alce Kids
                </button>
              </div>
            </div>

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
              <span style={{ color: '#F97316' }}>Arma tu celebración a tu manera.</span>
            </h2>
            <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto mb-12">
              Trae lo tuyo o suma solo lo que necesites. Si vienen niños mayores de 6 años, el armador
              adapta automáticamente la entretención para que también tengan opciones apropiadas para su edad.
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: '🔓', title: 'Arma solo lo que necesitas', desc: 'Trae lo tuyo o déjalo en nuestras manos. La celebración se adapta a tu familia, número de invitados y edades.' },
                { icon: '🎒', title: 'Trae lo que quieras', desc: 'Tu torta, tu banquetería, tu decoración — sin costo extra por traer de afuera.' },
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
              { num: `${STATS.reseñas}+`, label: `Reseñas ⭐ ${STATS.rating} en Google`, color: '#F97316' },
              { num: `${STATS.añosHistoria}+`, label: 'Años en Las Condes', color: '#29B9E8' },
              { num: '$0', label: 'Adultos acompañantes', color: '#F97316' },
              { num: 'Vie · Sáb · Dom', label: 'Horarios según el día', color: '#29B9E8' },
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

      {/* ── PRÓXIMAMENTE — zona secundaria, no compite con lo reservable hoy ── */}
      <div style={{ background: 'linear-gradient(180deg, #0D1B3E 0%, #081529 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 pb-16">
          {/* ── LO QUE VIENE EN CELEBRA SIN CESAR (§J) ──────────────
               Alce Arena y Alce Go construyen la marca paraguas, pero hoy no
               están disponibles: viven abajo y en formato menor para que no
               compitan con lo único que sí se puede reservar. ── */}
          <div className="pt-14 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                Lo que viene en Celebra Sin Cesar
              </h2>
              <p className="text-white/40 text-sm mt-2 max-w-lg mx-auto">
                Todavía no están disponibles. Déjanos tu correo y te avisamos apenas abran.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <WaitlistCard
                emoji="🏟️"
                titulo="Alce Arena"
                subtitulo="Para los más grandes · 7+ años"
                desc="Deportes, gaming, inflables y autos eléctricos pensados para niños mayores."
                categoria="Alce Arena"
                waMessage="¡Hola! 🔔 Me interesa Alce Arena (celebraciones 7+ años). Avísenme cuando abra, por favor 😊"
              />
              <WaitlistCard
                emoji="🚚"
                titulo="Alce Go"
                subtitulo="Celebramos donde tú quieras"
                desc="Llevamos los inflables, autos eléctricos y juegos a tu casa o el lugar que elijas."
                categoria="Alce Go"
                waMessage="¡Hola! 🔔 Me interesa Alce Go (celebraciones a domicilio). Avísenme cuando abra, por favor 😊"
              />
            </div>
          </div>

        </div>
      </div>


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

export function Calendario({ fecha, onFecha, disponibilidad = { blockedDates: [], blockedAM: [], blockedPM: [] } }) {
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
                style={{ color: i >= 5 ? '#C2410C' : i === 4 ? '#0E7FA8' : '#6B7280' }}
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
                      ? { color: '#0E7FA8', cursor: 'pointer' }    // Viernes — cyan
                      : esDisponible
                      ? { color: '#C2410C', cursor: 'pointer' }    // Sáb + Dom — naranja
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
              <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>Viernes</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
              <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>Sábado · Domingo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Pasos({ actual, labels = ['Fecha', 'Festejado', 'Invitados', 'Incluye', 'Adicionales'] }) {
  const total = labels.length;
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
            {/* Línea conectora — angosta en móvil: con 6 pasos (cuando hay
                niños mayores de 6) la fila no cabe en pantallas de 375px */}
            {i < total - 1 && (
              <div
                className="h-0.5 w-4 sm:w-8 md:w-12 mx-0.5 sm:mx-1 mb-5 transition-all duration-300"
                style={{ background: i < actual ? '#1565C0' : '#E5E7EB' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// CAMPO DE CÓDIGO DE DESCUENTO (paso 4, antes de confirmar)
// ─────────────────────────────────────────────
export function CodigoDescuento({ codigoAplicado, promo, descuento, onAplicar }) {
  const [input, setInput] = useState(codigoAplicado || '');
  useEffect(() => { setInput(codigoAplicado || ''); }, [codigoAplicado]);

  const aplicado = !!(codigoAplicado && codigoAplicado.trim());
  const ok        = aplicado && promo && descuento.monto > 0;
  const faltaItem = aplicado && promo && descuento.faltaItem;
  const invalido  = aplicado && !promo;

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ border: '1px dashed #C7D2E8', background: '#F5F9FF' }}>
      <label className="block text-sm font-black mb-2" style={{ color: '#1565C0' }}>
        🎟️ ¿Tienes un código de descuento?
      </label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAplicar(input.trim()); } }}
          placeholder="Escribe tu código"
          className="flex-1 px-4 py-3 rounded-xl text-sm font-bold outline-none uppercase"
          style={{ border: `1px solid ${invalido ? '#f87171' : '#CBD5E1'}`, color: '#0F172A', background: 'white' }}
        />
        <button
          type="button"
          onClick={() => onAplicar(input.trim())}
          className="px-5 py-3 rounded-xl font-black text-sm text-white transition-all hover:scale-[1.03]"
          style={{ background: 'linear-gradient(135deg, #1565C0, #29B9E8)' }}>
          Aplicar
        </button>
      </div>

      {ok && (
        <p className="text-sm font-bold mt-2.5 flex items-center gap-2 flex-wrap" style={{ color: '#16a34a' }}>
          ✓ Código {codigoAplicado.trim().toUpperCase()} aplicado: −{clp(descuento.monto)} en {descuento.itemNombre}.
          <button type="button" onClick={() => onAplicar('')} className="underline font-bold" style={{ color: '#64748B' }}>
            Quitar
          </button>
        </p>
      )}
      {faltaItem && (
        <p className="text-sm font-semibold mt-2.5" style={{ color: '#EA580C' }}>
          Tu código da <strong>{promo.etiqueta}</strong>. Agrega un inflable arriba para aprovecharlo. 👆
        </p>
      )}
      {invalido && (
        <p className="text-sm font-semibold mt-2.5" style={{ color: '#dc2626' }}>
          Ese código no es válido o ya venció.
        </p>
      )}
    </div>
  );
}

// Datos del Pack Mayores listos para mostrar (o null si no corresponde).
// Vive acá para que resumen lateral, bottom sheet y WhatsApp digan lo mismo.
export function datosPack(estado) {
  const ctx = contextoDesde(estado);
  const pv = packPara(ctx);
  if (!pv || !estado.packMayores?.seleccion) return null;
  const seleccion = estado.packMayores.seleccion;
  return {
    pack: pv.pack,
    variante: pv.variante,
    precio: precioPack(pv.variante, seleccion, estado.cantNinos || 'hasta10'),
    items: resumenPack(pv.variante, seleccion),
    referencial: packEsReferencial(pv.variante),
    completo: packCompleto(pv.variante, seleccion),
  };
}

// Las etiquetas de invitados y mayores salen SIEMPRE del motor de reglas:
// así es imposible que se filtre a la pantalla el 2 o el 5 internos (§W).
export const labelMayores = labelMayoresReglas;

export function ResumenLateral({ estado, total, onWhatsApp, onModificar = null, descuento = null }) {
  const { fecha, hora, festejados, nombreNino, edadNino, cantNinos, sector, extras, usaCocina, packCelebra, horasAdicionales, ninosExtra, totalNinos } = estado;
  const horario = horarioEfectivo(hora, horasAdicionales, fecha);
  const ctxResumen = contextoDesde(estado);
  const valorHermanos = valorMayores(ctxResumen);
  const esReferencial = cotizacionEsReferencial(estado);
  const esSabado = fecha?.getDay() === 6;
  const pack = datosPack(estado);
  const mayoresTxt = labelMayores(estado);
  const anticipo = Math.round(total / 2);
  // El desglose no vive abierto: el resumen es compacto y el papá lo abre si
  // quiere. El precio sigue visible, pero deja de ser el protagonista (§AB).
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  // Precio base — tabla diferenciada viernes/domingo vs sábado + multiplicadores edad/cantidad
  const _baseRaw_lateral =
    sector === 'independiente'                         ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente) :
    (sector === 'completo' && cantNinos === 'hasta10') ? (esSabado ? PRECIOS_BASE.completo_10_sab  : PRECIOS_BASE.completo_10) :
    cantNinos === 'hasta20'                            ? (esSabado ? PRECIOS_BASE.completo_20_sab  : PRECIOS_BASE.completo_20) :
    (cantNinos === 'hasta30' || cantNinos === 'mas30') ? (esSabado ? PRECIOS_BASE.completo_30_sab  : PRECIOS_BASE.completo_30) : 0;
  // Los hermanos mayores van DENTRO del arriendo: se cobran sin desglosarse.
  const precioBase = aplicarMult(_baseRaw_lateral, edadNino, cantNinos) + valorHermanos;
  const precioBaseVisible = precioBase;

  const sectorLabel = sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';

  const cantNinosLabel = labelInvitados(estado) || '—';

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
              {hora}{horario ? ` · ${horario.texto}` : ''}
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
        {estado.tramoInvitados && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>👶 Niños</span>
            <span className="font-bold text-white">{cantNinosLabel}</span>
          </div>
        )}
        {mayoresTxt && (
          <div className="flex justify-between items-center">
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>👦 Mayores de 6</span>
            <span className="font-bold text-white">{mayoresTxt}</span>
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
          <button
            onClick={() => setDetalleAbierto((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest mb-3 relative transition-opacity hover:opacity-80"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            aria-expanded={detalleAbierto}
          >
            {detalleAbierto ? 'Ocultar detalle' : 'Ver detalle'}
            <span style={{ fontSize: '0.7rem' }}>{detalleAbierto ? '▲' : '▼'}</span>
          </button>
          <div className="space-y-2 text-sm relative" style={detalleAbierto ? undefined : { display: 'none' }}>

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

            {/* Pack para los hermanos mayores */}
            {pack && pack.items.length > 0 && (
              <div className="rounded-2xl px-3 py-2.5 my-1"
                style={{ background: 'rgba(41,185,232,0.08)', border: '1px solid rgba(41,185,232,0.22)' }}>
                <div className="flex justify-between items-center">
                  <span className="font-bold truncate pr-2" style={{ color: '#93C5FD' }}>
                    👦 {pack.pack.nombre}
                  </span>
                  <span className="font-black text-white flex-shrink-0">{clp(pack.precio)}</span>
                </div>
                {pack.items.map((i) => (
                  <div key={i.id} className="text-xs mt-1 pl-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    · {i.emoji} {i.nombre}
                  </div>
                ))}
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

            {/* Limpieza Profunda — siempre incluida */}
            <div className="flex justify-between items-center">
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>✨ Limpieza Profunda</span>
              <span className="font-bold" style={{ color: '#4ade80' }}>INCLUIDO</span>
            </div>

            {/* Horas adicionales contratadas */}
            {horario?.horas > 0 && (
              <div className="flex justify-between items-center">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  ⏰ {horario.horas} hora{horario.horas > 1 ? 's' : ''} adicional{horario.horas > 1 ? 'es' : ''}
                </span>
                <span className="font-bold text-white">{clp(horario.precioAdicional)}</span>
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

      {/* ── Descuento por código ── */}
      {descuento && descuento.monto > 0 && (
        <div className="mt-3 flex justify-between items-center relative">
          <span className="text-sm font-bold flex items-center gap-1" style={{ color: '#4ade80' }}>
            🎟️ Descuento {estado.codigo?.trim().toUpperCase()}
          </span>
          <span className="font-black text-sm" style={{ color: '#4ade80' }}>−{clp(descuento.monto)}</span>
        </div>
      )}

      {/* ── Total ── */}
      <div className="mt-5 pt-4 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="flex items-center justify-between">
          <span className="font-black text-sm uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {esReferencial ? 'Valor estimado' : 'Valor total'}
          </span>
          <span className="font-black text-3xl" style={{
            color: total > 0 ? '#F97316' : 'rgba(255,255,255,0.2)',
            textShadow: total > 0 ? '0 0 20px rgba(249,115,22,0.4)' : 'none',
          }}>
            {total > 0 ? clp(total) : '—'}
          </span>
        </div>
        {esReferencial && (
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Incluye el valor referencial de la entretención para los mayores.
          </p>
        )}
      </div>

      {/* ── Anticipo y saldo — el papá sabe exactamente cuánto transfiere hoy ── */}
      {total > 0 && (
        <div className="mt-3 rounded-2xl px-3.5 py-3 relative"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Anticipo para confirmar tu reserva (50%)</span>
            <span className="font-black text-white">{clp(anticipo)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Saldo · hasta 48 h antes</span>
            <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{clp(total - anticipo)}</span>
          </div>
        </div>
      )}

      {total > 0 && (
        <>
          {onWhatsApp && (
            <button
              onClick={onWhatsApp}
              className="w-full mt-4 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 relative"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
              }}
            >
              <WaIcon /> Solicitar reserva por WhatsApp
            </button>
          )}
          {onModificar && (
            <button
              onClick={onModificar}
              className="w-full mt-2 py-3 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] relative"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)' }}
            >
              ✏️ Modificar mi celebración
            </button>
          )}
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
export function BottomSheetResumen({ estado, total, onWhatsApp, onCerrar, onQuitarExtra, onModificar = null, descuento = null }) {
  const { fecha, hora, festejados, nombreNino, edadNino, cantNinos, sector, extras,
          usaCocina, packCelebra, horasAdicionales, ninosExtra, totalNinos } = estado;
  const horario = horarioEfectivo(hora, horasAdicionales, fecha);
  const ctxResumen = contextoDesde(estado);
  const valorHermanos = valorMayores(ctxResumen);
  const esReferencial = cotizacionEsReferencial(estado);
  const esSabado = fecha?.getDay() === 6;
  const pack = datosPack(estado);
  const mayoresTxt = labelMayores(estado);
  const anticipo = Math.round(total / 2);

  const _baseRaw_sheet =
    sector === 'independiente'                         ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente) :
    (sector === 'completo' && cantNinos === 'hasta10') ? (esSabado ? PRECIOS_BASE.completo_10_sab  : PRECIOS_BASE.completo_10) :
    cantNinos === 'hasta20'                            ? (esSabado ? PRECIOS_BASE.completo_20_sab  : PRECIOS_BASE.completo_20) :
    (cantNinos === 'hasta30' || cantNinos === 'mas30') ? (esSabado ? PRECIOS_BASE.completo_30_sab  : PRECIOS_BASE.completo_30) : 0;
  // Igual que en el resumen lateral: los mayores van dentro del arriendo.
  const precioBase = aplicarMult(_baseRaw_sheet, edadNino, cantNinos) + valorHermanos;

  const sectorLabel = sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';

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
                  <span className="font-bold text-white text-sm">{hora}{horario ? ` · ${horario.texto}` : ''}</span>
                </div>
              )}
              {nombreNino && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>🎂 Festejado</span>
                  <span className="font-bold text-white text-sm">{nombreNino}{edadNino ? ` · ${edadNino} años` : ''}</span>
                </div>
              )}
              {estado.tramoInvitados && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>👶 Niños</span>
                  <span className="font-bold text-white text-sm">{labelInvitados(estado)}</span>
                </div>
              )}
              {mayoresTxt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>👦 Mayores de 6</span>
                  <span className="font-bold text-white text-sm">{mayoresTxt}</span>
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

              {/* Pack para los hermanos mayores — no se quita acá: es obligatorio
                   mientras haya mayores de 6. Se edita en su propio paso. */}
              {pack && pack.items.length > 0 && (
                <div className="rounded-2xl px-3 py-2.5 my-1.5"
                  style={{ background: 'rgba(41,185,232,0.08)', border: '1px solid rgba(41,185,232,0.22)' }}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm truncate pr-2" style={{ color: '#93C5FD' }}>
                      👦 {pack.pack.nombre}
                    </span>
                    <span className="font-black text-white text-sm flex-shrink-0">{clp(pack.precio)}</span>
                  </div>
                  {pack.items.map((i) => (
                    <div key={i.id} className="text-xs mt-1 pl-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      · {i.emoji} {i.nombre}
                    </div>
                  ))}
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
                    {e.gratis ? 'INCLUIDO' : clp(getPrecio(e, cantNinos))}
                  </span>
                  <button
                    onClick={() => onQuitarExtra(e.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs transition-all active:scale-90"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.85)', border: '1px solid rgba(239,68,68,0.2)' }}
                    aria-label={`Quitar ${e.nombre}`}
                  >✕</button>
                </div>
              ))}

              {/* Limpieza Profunda — siempre incluida */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>✨ Limpieza Profunda</span>
                <span className="font-bold text-sm" style={{ color: '#4ade80' }}>INCLUIDO</span>
              </div>

              {/* Horas adicionales contratadas */}
              {horario?.horas > 0 && (
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    ⏰ {horario.horas} hora{horario.horas > 1 ? 's' : ''} adicional{horario.horas > 1 ? 'es' : ''}
                  </span>
                  <span className="font-bold text-white text-sm">{clp(horario.precioAdicional)}</span>
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
          {descuento && descuento.monto > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold flex items-center gap-1" style={{ color: '#4ade80' }}>
                🎟️ Descuento {estado.codigo?.trim().toUpperCase()}
              </span>
              <span className="font-black text-sm" style={{ color: '#4ade80' }}>−{clp(descuento.monto)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-black text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Total estimado
            </span>
            <span className="font-black text-3xl" style={{ color: '#F97316', textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>
              {clp(total)}
            </span>
          </div>
          {/* Anticipo y saldo — lo que realmente transfiere hoy */}
          <div className="rounded-2xl px-3.5 py-2.5 mb-3"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Anticipo para confirmar tu reserva (50%)</span>
              <span className="font-black text-white text-sm">{clp(anticipo)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Saldo · hasta 48 h antes</span>
              <span className="font-bold text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{clp(total - anticipo)}</span>
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {esReferencial
              ? 'Incluye el valor referencial de la entretención para los mayores · Si llueve, reagendas sin costo'
              : 'Si llueve, reagendas sin costo'}
          </p>
          {onWhatsApp && (
            <button
              onClick={onWhatsApp}
              className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
            >
              <WaIcon /> Solicitar reserva por WhatsApp
            </button>
          )}
          {onModificar && (
            <button
              onClick={onModificar}
              className="w-full mt-2 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)' }}
            >
              ✏️ Modificar mi celebración
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// MODAL CARRUSEL — Catálogo de Experiencias Premium
// Recibe `grupo` resuelto (con items[] ya completos)
// ─────────────────────────────────────────────
export function ModalCarrusel({ grupo, extras, cantNinos, onToggle, onCerrar }) {
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
export const INFRAS = [
  {
    emoji: '🎱', title: 'Piscina de Pelotas Gigante',
    desc: 'El favorito de todos. Una piscina enorme llena de pelotas de colores donde los niños pueden saltar, rodar y jugar por horas.',
    color: '#1565C0', imagen: '/infra-piscina.webp',
  },
  {
    emoji: '🎢', title: 'Gran Tobogán',
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
    emoji: '👨‍👩‍👧‍👦', title: 'Adultos sin costo',
    desc: 'Sin cobro extra por adultos. Trae abuelos, tíos y amigos. Cocina, baños y espacio para todos sin costo adicional.',
    color: '#F97316', imagen: '/infra-adultos.webp',
  },
  {
    emoji: '🎪', title: '2 Sectores Independientes',
    desc: 'Sector tobogán y sector piscina de pelotas. Puedes tomar un solo sector (hasta 10 niños) o el recinto completo, que es lo habitual.',
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
// ─────────────────────────────────────────────
// PASO MAYORES DE 6 — configuración de entretención
//
// La ESTRUCTURA del pack es obligatoria (la define data/packs-mayores.js),
// pero QUÉ producto entra en cada casilla lo elige siempre el papá. Nunca
// "te toca hockey + ping pong": siempre "elige 2 juegos deportivos".
// ─────────────────────────────────────────────
export function PickerPack({ categoria, cantidad, ctx, elegidos, onToggle, cantNinos }) {
  const meta = CATEGORIAS_PACK[categoria];
  const opciones = opcionesPack(categoria, ctx);
  const misElegidos = elegidos.filter((id) => opciones.some((o) => o.id === id));
  const completo = misElegidos.length >= cantidad;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="font-black text-sm text-gray-700">
          {meta.emoji} Elige {cantidad} {cantidad === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()}
        </p>
        <span className="text-xs font-black flex-shrink-0"
          style={{ color: completo ? '#16a34a' : '#F97316' }}>
          {misElegidos.length}/{cantidad}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-snug mb-3">{meta.ayuda}</p>

      <div className="grid grid-cols-2 gap-2.5">
        {opciones.map((op) => {
          const sel = misElegidos.includes(op.id);
          const precio = op.precios?.[cantNinos] ?? op.precios?.hasta10 ?? 0;
          return (
            <button
              key={op.id}
              onClick={() => onToggle(op, categoria, cantidad)}
              className="p-3 rounded-2xl text-left transition-all duration-150 active:scale-[0.97]"
              style={{
                border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                background: sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                boxShadow: sel ? '0 4px 14px rgba(21,101,192,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl leading-none">{op.emoji}</span>
                <span className="font-black text-xs leading-tight flex-1"
                  style={{ color: sel ? '#1565C0' : '#374151' }}>
                  {op.nombre}
                </span>
                {sel && <span className="text-xs font-black" style={{ color: '#1565C0' }}>✓</span>}
              </div>
              <div className="text-xs font-bold mt-1.5" style={{ color: sel ? '#1565C0' : '#9CA3AF' }}>
                {clp(precio)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PackMayoresPaso({ pack, variante, ctx, seleccion, onCambiarRama, onToggleItem, cantNinos }) {
  const precio = precioPack(variante, seleccion, cantNinos);
  const referencial = packEsReferencial(variante);
  const completo = packCompleto(variante, seleccion);

  return (
    <div>
      <h2 className="text-2xl font-black mb-1" style={{ color: '#1565C0' }}>🎉 {COPY_MAYORES.titulo.replace(' 🎉', '')}</h2>
      <p className="text-gray-400 mb-5 leading-relaxed">{COPY_MAYORES.texto}</p>

      {/* Qué pack corresponde y por qué */}
      <div className="rounded-2xl p-5 mb-6"
        style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '2px solid #93C5FD' }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="font-black text-lg" style={{ color: '#1E40AF' }}>{pack.nombre}</p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(21,101,192,0.12)', color: '#1E40AF' }}>
            Mayores: {labelMayoresReglas(ctx)} · {labelInvitados(ctx)}
          </span>
        </div>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#1D4ED8' }}>{pack.descripcion}</p>
      </div>

      {/* Requisitos — estructura obligatoria, contenido a elección */}
      {variante.requisitos.map((req) => {
        const rama = ramaActiva(req, seleccion);
        const elegidos = seleccion?.[req.id]?.items || [];
        return (
          <div key={req.id} className="rounded-2xl border-2 p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
            <p className="font-black text-gray-700">{req.titulo}</p>

            {/* Ramas: solo cuando hay más de una alternativa válida */}
            {req.ramas.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                {req.ramas.map((r) => {
                  const sel = rama?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => onCambiarRama(req.id, r.id)}
                      className="p-3 rounded-2xl text-left transition-all duration-150"
                      style={{
                        border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                        background: sel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : 'white',
                        boxShadow: sel ? '0 4px 14px rgba(249,115,22,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div className="font-black text-sm" style={{ color: sel ? '#EA580C' : '#374151' }}>{r.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-snug">{r.resumen}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pickers de la rama activa */}
            {rama
              ? rama.pide.map((p) => (
                  <PickerPack
                    key={`${req.id}-${p.categoria}`}
                    categoria={p.categoria}
                    cantidad={p.cantidad}
                    ctx={ctx}
                    elegidos={elegidos}
                    cantNinos={cantNinos}
                    onToggle={(item, categoria, cantidad) => onToggleItem(req.id, item, categoria, cantidad)}
                  />
                ))
              : (
                <p className="text-xs text-gray-400 mt-3">Elige una alternativa para continuar.</p>
              )}
          </div>
        );
      })}

      {/* Precio del pack */}
      <div className="rounded-2xl p-5 mb-2"
        style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', border: '2px solid #F97316' }}>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-black text-orange-900">Entretención para los mayores</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {referencial
                ? 'Valor de los juegos elegidos. Si armamos un precio de pack mejor, te lo avisamos al confirmar.'
                : 'Precio de pack — más conveniente que contratarlos por separado.'}
            </p>
          </div>
          <div className="font-black text-2xl text-orange-900 flex-shrink-0">{clp(precio)}</div>
        </div>
      </div>

      {/* Nota — sin párrafos legales, una línea clara */}
      <p className="text-xs text-gray-400 leading-relaxed mb-6 px-1">
        {COPY_MAYORES.nota} <a href="/terminos" className="font-bold underline" style={{ color: '#1565C0' }}>Ver términos</a>
      </p>

      {!completo && (
        <p className="text-sm font-bold mb-3 px-1" style={{ color: '#F97316' }}>
          Completa las elecciones de arriba para seguir.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// RECOMENDADOS PARA ESTA CELEBRACIÓN
// No es "aquí tienes el catálogo": es lo que mejor calza con la edad, la
// cantidad de niños y si vienen mayores. Sale del motor de reglas.
// ─────────────────────────────────────────────
export function Recomendados({ lista, cantNinos, onAdd, isAdded }) {
  if (!lista || lista.length === 0) return null;
  return (
    <div className="mt-6">
      <div className="mb-1">
        <h3 className="font-black text-xl tracking-tight" style={{ color: '#1565C0' }}>
          Recomendados para tu celebración
        </h3>
        <p className="text-xs font-semibold text-gray-400 mt-0.5">
          Elegidos según la edad del festejado, cuántos niños vienen y sus edades
        </p>
        <div className="h-0.5 w-10 rounded-full mt-1.5" style={{ background: '#F97316' }} />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 pt-4 -mx-1 px-1"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
        {lista.map(({ item, motivo }) => {
          const added = isAdded(item);
          const precio = item.precios?.[cantNinos] ?? item.precios?.hasta10 ?? 0;
          return (
            <div key={item.id}
              className="flex-shrink-0 rounded-2xl p-4 flex flex-col"
              style={{
                width: 'min(78vw, 250px)', scrollSnapAlign: 'start',
                background: 'white',
                border: added ? '2px solid #22c55e' : '2px solid rgba(21,101,192,0.12)',
                boxShadow: added ? '0 4px 18px rgba(34,197,94,0.18)' : '0 2px 12px rgba(21,101,192,0.06)',
              }}>
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">{item.emoji}</span>
                <p className="font-black text-sm leading-tight text-gray-800 flex-1">{item.nombre}</p>
              </div>
              <p className="text-xs text-gray-400 leading-snug mt-2 flex-1">{motivo}</p>
              <div className="flex items-center justify-between gap-2 mt-3">
                <span className="font-black text-sm" style={{ color: '#1565C0' }}>
                  {precio === 0 ? 'INCLUIDO' : clp(precio)}
                </span>
                <button
                  onClick={() => onAdd(item)}
                  className="px-3.5 py-2 rounded-xl font-black text-xs text-white transition-all active:scale-95"
                  style={{
                    background: added
                      ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                      : 'linear-gradient(135deg,#F97316,#EA580C)',
                  }}>
                  {added ? '✓ Agregado' : '+ Agregar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GaleriaInfra() {
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
    el.scrollBy({ left: dir * ancho * 3, behavior: scrollBehavior() });
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

export function PageAlce({ onIniciarWizard }) {
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
        style={{ minHeight: 'calc(100svh - 72px)' }}
      >
        {/* Fondo degradado base */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 45%, #0E6FA8 100%)' }} />
        {/* Foto ambiente de la celebración (ilustrativa). ART DIRECTION: vertical
            en móvil, 16:9 en desktop. */}
        <picture>
          <source media="(max-width: 767px)" srcSet="/hero-alce-movil.webp" />
          <img src="/hero-alce.webp" alt="" aria-hidden="true"
            fetchPriority="high" decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(1.14) saturate(1.4) contrast(1.06)' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </picture>
        {/* Overlay más liviano: se ve MÁS foto (alegre y viva); oscuro solo arriba
            y abajo para que texto y CTAs mantengan contraste. */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(6,15,46,0.66) 0%, rgba(6,15,46,0.36) 42%, rgba(6,15,46,0.44) 60%, rgba(6,15,46,0.80) 100%)' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 md:py-24 w-full"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.95)' }}>
          <div className="flex flex-col md:flex-row items-center gap-5 md:gap-12">

            {/* Logo Alce Kids — más chico en móvil para que todo quepa */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 md:w-44 md:h-44 rounded-3xl overflow-hidden relative"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(41,185,232,0.3)' }}>
                <Image src="/logo-alce.webp" alt="Alce Kids"
                  fill
                  className="object-cover"
                  sizes="176px"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            </div>

            {/* Texto + CTAs — compacto en móvil hasta el botón "Armar mi celebración" */}
            <div className="text-center md:text-left flex-1">
              {/* Badge ubicación */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black mb-3 md:mb-5"
                style={{ background: 'rgba(249,115,22,0.2)', color: '#FED7AA', border: '1px solid rgba(249,115,22,0.35)' }}>
                📍 Talavera de la Reina 380 · Las Condes
              </div>

              <h1 className="font-black text-white leading-none mb-2 md:mb-3"
                style={{ fontSize: 'clamp(2.75rem, 9vw, 5.5rem)' }}>
                Alce <span style={{ color: '#29B9E8' }}>Kids</span>
              </h1>
              <p className="font-black text-base md:text-xl mb-2" style={{ color: '#FED7AA' }}>
                El lugar de cumpleaños más especial del sector oriente
              </p>
              <p className="text-sm md:text-base mb-4 md:mb-8 max-w-lg font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {AÑOS_HISTORIA_LABEL} · Niños de 0 a 6 años
              </p>

              {/* Estrellas Google */}
              <div className="flex items-center gap-3 mb-5 md:mb-10 justify-center md:justify-start">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-xl md:text-2xl" style={{ color: '#FBBF24' }}>★</span>
                  ))}
                </div>
                <span className="font-black text-white text-xl md:text-2xl">{STATS.rating}</span>
                <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>· {RESEÑAS_LABEL}</span>
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
                <Link
                  href="/visitar"
                  className="font-bold px-9 py-4 rounded-2xl text-white text-base transition-all hover:scale-105 text-center"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)' }}
                >
                  👀 Visitar sin compromiso
                </Link>
              </div>

              {/* Diferenciador de libertad */}
              <p className="text-sm mt-4 md:mt-5 text-center md:text-left font-medium" style={{ color: 'rgba(255,255,255,0.82)' }}>
                🔓 <span className="font-bold text-white">Tu celebración, a tu manera:</span> trae todo por tu cuenta
                o contrata con nosotros solo lo que necesites.
              </p>
            </div>
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
              { num: `${STATS.reseñas}+`, label: `Reseñas ⭐ ${STATS.rating}`, sub: 'en Google', color: '#FBBF24' },
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
              🔓 Tu celebración, a tu manera
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-3" style={{ color: '#0D1B3E' }}>
              Tu celebración,<br />
              <span style={{ color: '#1565C0' }}>como tú la imaginas</span>
            </h2>
            <p className="text-gray-400 text-base max-w-lg mx-auto">
              Arriendas el espacio y desde ahí decides tú: trae lo tuyo, o suma solo lo que necesites.
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
                Trae tu propia comida, torta, decoración y animadores, sin costo extra por traer cosas de afuera.
                Durante tu horario el recinto es exclusivo para tu familia.
              </p>
              <ul className="space-y-2.5">
                {[
                  'Sin proveedor obligatorio',
                  'Cocina disponible para calentar',
                  'Personalizas solo lo que quieras',
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
              Arma solo lo que necesitas · Adultos sin costo adicional · Reserva con el 50%
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
                {['Piscina de pelotas O tobogán', 'Hasta 10 niños', 'Adultos sin costo adicional', '3 horas + 30 min para decorar'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#29B9E8' }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recinto Completo */}
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
                <span className="text-white/50 text-base font-bold">todo el jardín exclusivo, hasta 40 niños</span>
              </p>
              <ul className="space-y-2.5">
                {['Todo el recinto exclusivo para ti', 'Hasta 40 niños', 'Adultos acompañantes sin costo adicional, dentro del aforo autorizado del recinto', '3 horas + 30 min para decorar', 'Cocina y salón con AC incluido'].map((item) => (
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
              📊 Tu valor exacto depende de <strong className="text-white">tres cosas</strong>: el día
              (viernes, sábado o domingo), la <strong className="text-white">cantidad de niños</strong> y
              la <strong className="text-white">edad del festejado</strong>. Lo calculas al instante,
              sin compromiso y sin letra chica.
            </p>
            <button
              onClick={onIniciarWizard}
              className="font-black px-9 py-4 rounded-2xl text-white text-base transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(90deg, #F97316, #29B9E8)', boxShadow: '0 8px 28px rgba(249,115,22,0.4)' }}
            >
              📊 Calcular mi valor exacto →
            </button>
          </div>

          {/* Nota libertad */}
          <div className="flex justify-center mt-10 mb-4">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
              🔓 El precio es por el espacio — los adicionales los eliges tú según tu celebración
            </div>
          </div>
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Sujeto a disponibilidad · Reserva pagando el 50% del valor total de tu celebración.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RESEÑAS GOOGLE — 6 reseñas destacadas
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
                    <div className="text-gray-500 text-xs mt-0.5">{RESEÑA_ORIGEN_LABEL}</div>
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
              Ver las {STATS.reseñas}+ reseñas en Google →
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
                  sub: 'Vie PM 16:00–19:00 · Sáb/Dom AM 11:00–14:00 · PM 15:00–18:00', color: 'rgba(249,115,22,0.15)',
                },
                {
                  icon: <WaIcon />, title: '+56 9 4435 6955',
                  sub: 'WhatsApp', color: 'rgba(34,197,94,0.15)',
                },
                {
                  icon: '📧', title: NEGOCIO.email,
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
            Trae lo tuyo de afuera o déjalo en nuestras manos — tu celebración, a tu manera.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onIniciarWizard}
              className="font-black px-10 py-5 rounded-2xl text-white text-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: '#C2410C', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
            >
              🎉 Armar mi celebración →
            </button>
            <Link
              href="/visitar"
              className="font-bold px-10 py-5 rounded-2xl text-white text-lg transition-all hover:scale-105 text-center"
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)' }}
            >
              👀 Visitar sin compromiso
            </Link>
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
export function WhatsAppFab() {
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
export function Footer() {
  return (
    <footer style={{ background: '#0D1B3E' }} className="text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-black text-lg mb-3" style={{ color: '#29B9E8' }}>
            Celebra Sin Cesar
          </div>
          <p className="leading-relaxed text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
            La casa de cumpleaños más completa de Las Condes, Santiago. Niños de 0 a 6 años con {STATS.añosHistoria}+ años de historia familiar.
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
              aria-label="Escribir por WhatsApp"
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
          <div className="font-black mb-3" style={{ color: '#29B9E8' }}>Contacto</div>
          <div className="space-y-2">
            <a
              href="https://wa.me/56944356955"
              className="flex items-center gap-2 hover:text-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              <WaIcon /> WhatsApp +56 9 4435 6955
            </a>
            <a
              href={`mailto:${NEGOCIO.email}`}
              className="block text-xs hover:text-white transition-colors"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {NEGOCIO.email}
            </a>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Vie PM 16:00–19:00
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Sáb/Dom AM 11:00–14:00 · PM 15:00–18:00
            </p>
          </div>
          <div
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316' }}
          >
            ⭐ {STATS.rating} · {RESEÑAS_LABEL}
          </div>
        </div>
      </div>

      <div
        className="text-center py-4 text-xs"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        © 2026 CELEBRA SIN CESAR SpA · Alce Kids · Las Condes, Santiago
        {' · '}
        <a
          href="/terminos"
          className="hover:underline transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Términos y Condiciones
        </a>
        {' · '}
        <a
          href="/privacidad"
          className="hover:underline transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Política de Privacidad
        </a>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────
