'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { PRECIOS_BASE, PRECIOS_EXTRAS, CATEGORIAS_ADICIONALES, BLOQUES_VITRINA } from '../data/master';

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

// Resuelve el precio de un ítem según la capacidad de niños elegida.
// Si el ítem tiene `precios` (objeto por tier), usa ese tier.
// Fallback: campo `precio` legacy → 0.
const getPrecio = (item, cantNinos) => {
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};

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
            src="/logo-celebra.png"
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
          <span className="hidden md:block text-sm text-gray-500 font-semibold">📍 Las Condes, Santiago</span>
          <a
            href="https://wa.me/56944356955"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-sm font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 transition-all hover:scale-105 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }}
          >
            <span>💬</span> WhatsApp
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
//   foto-jardin-1.jpg, foto-jardin-2.jpg, foto-jardin-3.jpg → galería
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

      {/* Imagen estática de fondo — priority=true para LCP */}
      <Image
        src="/foto-home-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
        aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />

      {/* Overlay oscuro gradiente */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(13,43,110,0.65) 100%)',
        }}
      />

      {/* Contenido centrado */}
      <div className="relative z-10 text-center px-6 flex flex-col items-center">

        {/* Logo principal grande */}
        <div className="mb-6">
          <img
            src="/logo-celebra.png"
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

        {/* Tagline */}
        <p
          className="text-white/90 text-xl md:text-2xl font-black mb-2"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
        >
          Cumpleaños infantiles únicos en Las Condes
        </p>
        <p
          className="text-white/65 text-sm md:text-base mb-10 max-w-lg"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          Elige el espacio perfecto, arma la celebración y confirma en minutos.
          Sin complicaciones, con todo incluido.
        </p>

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
          Ver nuestras opciones de celebración
          <span className="text-xl transition-transform duration-300 group-hover:translate-y-1 inline-block">
            ↓
          </span>
        </button>

        {/* CTA visita sin compromiso */}
        <p className="text-white/45 text-xs mt-5">¿Primero quieres ver el lugar en persona?</p>
        <a
          href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría conocer el jardín Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/70 text-sm font-bold hover:text-white transition-colors mt-1"
          style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          Visitar el jardín sin compromiso →
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
              Elige tu espacio
              <br />
              <span style={{ color: '#F97316' }}>y celebra sin cesar</span>
            </h2>
            <p className="text-white/45 text-base max-w-lg mx-auto">
              Selecciona el espacio ideal para tu hijo. Cada espacio tiene su magia — arma tu celebración en minutos.
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
                <span className="text-xs font-black text-white/60 ml-1">5.0</span>
              </div>

              {/* Contenido */}
              <div className="p-8 pt-12">
                <div className="w-28 h-28 mx-auto mb-5 rounded-2xl overflow-hidden group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                  <img src="/logo-alce.png" alt="Alce Kids" className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                  <div style={{ display: 'none' }} className="w-full h-full rounded-2xl items-center justify-center text-5xl bg-blue-900">🦌</div>
                </div>

                <h2 className="text-2xl font-black text-center mb-1 text-white">Alce Kids</h2>
                <p className="font-bold text-center text-sm mb-1" style={{ color: '#29B9E8' }}>Jardín · 0 a 6 años · Las Condes</p>
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
                  Ver el jardín y armar mi celebración →
                </div>
              </div>
            </div>

            {/* ─ CASA +6 — PRÓXIMAMENTE ─ */}
            <div className="rounded-3xl relative overflow-hidden cursor-default"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="absolute top-4 right-4 z-10 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                PRÓXIMAMENTE
              </div>
              <div className="p-8" style={{ filter: 'blur(1px) grayscale(1)', opacity: 0.28 }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-5xl">🎮</span>
                </div>
                <h2 className="text-2xl font-black text-white text-center mb-1">Casa +6</h2>
                <p className="text-white/50 font-bold text-center text-sm mb-3">Espacio exclusivo · 6+ años</p>
                <p className="text-white/30 text-sm text-center mb-6">Gaming, realidad virtual y actividades para niños mayores.</p>
                <div className="py-3 rounded-2xl text-center text-white/30 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>Pronto disponible</div>
              </div>
            </div>

            {/* ─ A DOMICILIO — PRÓXIMAMENTE ─ */}
            <div className="rounded-3xl relative overflow-hidden cursor-default"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="absolute top-4 right-4 z-10 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                PRÓXIMAMENTE
              </div>
              <div className="p-8" style={{ filter: 'blur(1px) grayscale(1)', opacity: 0.28 }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-5xl">🏠</span>
                </div>
                <h2 className="text-2xl font-black text-white text-center mb-1">A Domicilio</h2>
                <p className="text-white/50 font-bold text-center text-sm mb-3">Celebramos en tu casa</p>
                <p className="text-white/30 text-sm text-center mb-6">Llevamos toda la experiencia Celebra Sin Cesar directamente a tu hogar.</p>
                <div className="py-3 rounded-2xl text-center text-white/30 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>Pronto disponible</div>
              </div>
            </div>
          </div>

          {/* Stats — números grandes con glow */}
          <div className="flex flex-wrap justify-center gap-12 mt-20 pt-14"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { num: '35', label: 'Reseñas ⭐ 5.0 en Google', color: '#F97316' },
              { num: '40+', label: 'Años de historia familiar', color: '#29B9E8' },
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

      {/* ── INSTAGRAM STRIP ──────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-white font-black text-xl mb-1.5">📸 Síguenos en Instagram</p>
            <p style={{ color: 'rgba(255,255,255,0.45)' }} className="text-sm">@celebracionesalce · +1.200 familias nos siguen · fotos reales del jardín</p>
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
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());

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
  const labels = ['Fecha', 'Festejado', 'Invitados', 'Adicionales', 'Resumen'];
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
  const { fecha, hora, nombreNino, edadNino, cantNinos, sector, extras, usaCocina, packCelebra, horaExtra, ninosExtra } = estado;
  const esSabado = fecha?.getDay() === 6;

  // Precio base — tabla diferenciada viernes/domingo vs sábado
  const precioBase =
    sector === 'independiente'                       ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente) :
    (sector === 'completo' && cantNinos === 'hasta10') ? (esSabado ? PRECIOS_BASE.completo_10_sab  : PRECIOS_BASE.completo_10) :
    cantNinos === 'hasta20'                          ? (esSabado ? PRECIOS_BASE.completo_20_sab  : PRECIOS_BASE.completo_20) :
    (cantNinos === 'hasta30' || cantNinos === 'mas30') ? (esSabado ? PRECIOS_BASE.completo_30_sab  : PRECIOS_BASE.completo_30) : 0;
  const precioBaseVisible = precioBase; // precio correcto ya incorporado

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
        <button
          onClick={onWhatsApp}
          className="w-full mt-4 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-105 relative"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
          }}
        >
          💬 Confirmar por WhatsApp
        </button>
      )}
    </div>
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

  // Al cambiar de ítem: resetear foto y precargar todas las URLs del nuevo ítem
  useEffect(() => {
    setFotoIdx(0);
    setFotoStates({});
    const item = items[indice];
    const urls = item?.imagenes?.length > 0
      ? item.imagenes
      : item?.imagen ? [item.imagen] : [];
    urls.forEach((url) => {
      const img = new window.Image();
      img.onload  = () => setFotoStates((p) => ({ ...p, [url]: true  }));
      img.onerror = () => setFotoStates((p) => ({ ...p, [url]: false }));
      img.src = url;
    });
  }, [indice, items]);

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

  // URLs crudas del ítem actual
  const allFotos = itemActual.imagenes?.length > 0
    ? itemActual.imagenes
    : itemActual.imagen ? [itemActual.imagen] : [];

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
              className="absolute left-2 z-20 w-11 h-11 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>
            <button
              onClick={() => setIndice((i) => (i + 1) % total)}
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
                {/* Imagen 16:9 — no crece tanto, deja espacio al panel de info */}
                <div
                  className="relative w-full"
                  style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, #0D2B6E, #1565C0)' }}
                >
                  <Image
                    src={isCentro ? (fotos[fotoIdxSafe] || item.imagen) : item.imagen}
                    alt={item.nombre}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 85vw, 33vw"
                    style={isCentro ? { filter: 'saturate(1.1) contrast(1.05) brightness(1.03)' } : {}}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />

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
    desc: 'El ícono del jardín. Una piscina enorme llena de pelotas de colores donde los niños pueden saltar, rodar y jugar por horas.',
    color: '#1565C0', imagen: '/infra-piscina.jpg',
  },
  {
    emoji: '🛝', title: 'Gran Tobogán',
    desc: 'Estructura de juegos colorida con tobogán, escaladores y zonas de exploración para los más atrevidos y curiosos.',
    color: '#F97316', imagen: '/infra-tobogan.jpg',
  },
  {
    emoji: '🚗', title: 'Autopista para Niños',
    desc: 'Circuito pintado en el piso con casita, semáforos y señales. Los niños manejan sus propios vehículos por el jardín.',
    color: '#29B9E8', imagen: '/infra-autopista.jpg',
  },
  {
    emoji: '🐰', title: 'Granja con Animales',
    desc: 'Conejos y amigos del campo que los niños pueden conocer de cerca. Una experiencia única e irrepetible en Las Condes.',
    color: '#22c55e', imagen: '/infra-granja.jpg',
  },
  {
    emoji: '⛱️', title: 'Pozo de Arena',
    desc: 'Un área de arena donde los pequeños pueden construir castillos, excavar y dejar volar la imaginación sin límites.',
    color: '#F59E0B', imagen: '/infra-arena.jpg',
  },
  {
    emoji: '🏠', title: 'Salón con Aire Acondicionado',
    desc: 'Salón principal amplio y techado con AC. Para la celebración, el pastel y la comodidad de todos los adultos.',
    color: '#8B5CF6', imagen: '/infra-salon.jpg',
  },
  {
    emoji: '🔒', title: 'Privacidad Total',
    desc: 'Cerramientos verdes y toldos para el sol. Tu fiesta es completamente privada, solo para tu familia e invitados.',
    color: '#1565C0', imagen: '/infra-privacidad.jpg',
  },
  {
    emoji: '👨‍👩‍👧‍👦', title: 'Adultos Ilimitados',
    desc: 'Sin cobro extra por adultos. Trae abuelos, tíos y amigos. Cocina, baños y espacio para todos sin costo adicional.',
    color: '#F97316', imagen: '/infra-adultos.jpg',
  },
  {
    emoji: '🎪', title: '2 Sectores Independientes',
    desc: 'Sector tobogán y sector piscina de pelotas. Arrienda uno solo (hasta 10 niños) o el jardín completo.',
    color: '#29B9E8', imagen: '/infra-sectores.jpg',
  },
  {
    emoji: '🎭', title: 'Escenario y Tarima',
    desc: 'Tarima elevada para shows de animadores, obras de teatro y el momento del cumpleaños. ¡Los niños se convierten en protagonistas del escenario!',
    color: '#EC4899', imagen: '/infra-escenario.jpg',
  },
  {
    emoji: '🌟', title: 'Área de Columpios',
    desc: 'Set de columpios seguros y coloridos para los más pequeños del jardín. El lugar favorito para mecerse, reír y descubrir la libertad.',
    color: '#F59E0B', imagen: '/infra-columpios.jpg',
  },
  {
    emoji: '🎡', title: 'Sillas Locas',
    desc: '¡El favorito absoluto que hace gritar a todos! Sillas giratorias de diversión extrema para los niños más aventureros y valientes del jardín.',
    color: '#EF4444', imagen: '/infra-sillas-locas.jpg',
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
              className="absolute left-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>

            <div className="w-full max-w-4xl rounded-3xl overflow-hidden relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#0D1B3E' }}>
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
  const waVisita = `https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Me gustaría visitar el jardín Alce Kids sin compromiso. ¿Cuándo podría pasar a conocerlo?')}`;
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
        {/* Foto de fondo (misma que el hero principal) */}
        <Image src="/foto-home-bg.jpg" alt="" fill aria-hidden="true"
          className="object-cover"
          sizes="100vw"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        {/* Overlay oscuro */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(6,15,46,0.88) 0%, rgba(13,43,110,0.7) 60%, rgba(14,111,168,0.55) 100%)' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="flex flex-col md:flex-row items-center gap-12">

            {/* Logo Alce Kids */}
            <div className="flex-shrink-0">
              <div className="w-44 h-44 rounded-3xl overflow-hidden relative"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(41,185,232,0.3)' }}>
                <Image src="/logo-alce.png" alt="Alce Kids"
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
                El jardín mágico para el cumpleaños más increíble
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
                <span className="font-black text-white text-2xl">5.0</span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>· 35 reseñas verificadas en Google</span>
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
              { num: '35', label: 'Reseñas ⭐ 5.0', sub: 'en Google Maps', color: '#FBBF24' },
              { num: '40+', label: 'Años de historia', sub: 'jardín familiar', color: '#29B9E8' },
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
              Cada rincón del jardín fue diseñado para que los niños no paren de reír
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
              className="absolute left-3 z-20 w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0"
              style={{ background: 'rgba(249,115,22,0.9)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
            >‹</button>

            {/* Imagen */}
            <div
              className="w-full max-w-4xl rounded-3xl overflow-hidden relative"
              style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#0D1B3E' }}>
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
          PRECIOS — Visión general transparente
      ══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-2">
              Precios <span style={{ color: '#F97316' }}>transparentes</span>
            </h2>
            <p className="text-base" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Sin letra chica · Adultos siempre incluidos · Reserva con el 50%
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Sector Independiente */}
            <div className="rounded-3xl p-8 relative overflow-hidden"
              style={{ background: 'rgba(41,185,232,0.07)', border: '1px solid rgba(41,185,232,0.28)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #29B9E8, transparent)' }} />
              <div className="text-xs font-black uppercase tracking-widest mb-5" style={{ color: '#29B9E8' }}>
                🏡 Sector Independiente
              </div>
              <div>
                <span className="font-black text-5xl text-white">$180k</span>
                <span className="text-white/40 text-sm ml-2">Vie · Dom</span>
              </div>
              <div className="mt-1 mb-6">
                <span className="font-black text-3xl text-white/70">$195k</span>
                <span className="text-white/40 text-sm ml-2">Sábado</span>
              </div>
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
              <div className="text-xs font-black uppercase tracking-widest mb-5" style={{ color: '#F97316' }}>
                🏰 Jardín Completo
              </div>
              <div>
                <span className="font-black text-5xl text-white">$225k</span>
                <span className="text-white/40 text-sm ml-2">Vie · Dom</span>
              </div>
              <div className="mt-1 mb-6">
                <span className="font-black text-3xl text-white/70">$265k</span>
                <span className="text-white/40 text-sm ml-2">Sábado · hasta 30 niños</span>
              </div>
              <ul className="space-y-2.5">
                {['Todo el jardín exclusivo para ti', 'Hasta 30 niños (+ extras a $10k c/u)', 'Adultos ilimitados sin costo', '3 horas + 30 min para decorar', 'Cocina y salón con AC incluido'].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="font-black flex-shrink-0" style={{ color: '#F97316' }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center mt-8 text-sm" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Precios referenciales · sujetos a disponibilidad · Reserva con el 50% del arriendo
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
            <p className="text-gray-400 text-base">35 reseñas verificadas · Promedio 5.0 en Google Maps</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                texto: 'Muchas gracias César, todo muy bonito. Los niños la pasaron increíble y el lugar es espectacular. Muy recomendado para toda la familia.',
                autor: 'Nicool H.', mes: 'Noviembre 2024', avatar: 'N',
              },
              {
                texto: 'Nos encantó celebrar con ustedes. Se agradece mucho la buena onda, la organización y que dejaran todo ordenado y limpio.',
                autor: 'Constanza M.', mes: 'Diciembre 2024', avatar: 'C',
              },
              {
                texto: 'El jardín es precioso. Cuando lo vimos en persona nos enamoramos. Los niños no querían irse. Definitivamente volvemos el próximo año.',
                autor: 'Francisca S.', mes: 'Abril 2025', avatar: 'F',
              },
              {
                texto: 'Excelente atención de César, muy detallista y pendiente de todo durante la fiesta. El jardín superó todas nuestras expectativas.',
                autor: 'Valentina R.', mes: 'Octubre 2024', avatar: 'V',
              },
              {
                texto: 'Arrendamos el jardín completo para el cumple de Matías y fue un éxito total. Los espacios son únicos, jamás habíamos visto algo así.',
                autor: 'Rodrigo P.', mes: 'Enero 2025', avatar: 'R',
              },
              {
                texto: 'Lugar hermoso, cómodo y con todo lo que los niños necesitan para pasarla bien. La piscina de pelotas gigante es espectacular!',
                autor: 'María José T.', mes: 'Marzo 2025', avatar: 'M',
              },
            ].map((t) => (
              <div
                key={t.autor}
                className="rounded-3xl p-6 relative transition-all hover:-translate-y-1 hover:shadow-xl"
                style={{ background: 'white', border: '1px solid rgba(21,101,192,0.09)', boxShadow: '0 4px 24px rgba(21,101,192,0.07)' }}
              >
                {/* Badge Google */}
                <div className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: '#4285F4', color: 'white' }}>G</div>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-sm" style={{ color: '#FBBF24' }}>★</span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1565C0, #29B9E8)' }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-black text-gray-800 text-sm">{t.autor}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{t.mes} · Google</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://maps.app.goo.gl/7AVak5cVXpFjpNh5A"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-bold text-sm px-7 py-3.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(21,101,192,0.07)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.2)' }}
            >
              Ver todas las 35 reseñas en Google Maps →
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
                Con <strong className="text-gray-700">24 a 48 horas de anticipación</strong>, te buscamos
                la próxima fecha disponible <strong className="text-gray-700">sin costo adicional</strong>.
                Sin letra chica, sin multas. Tu celebración se hace igual — solo en otro día.
              </p>
            </div>
            <div className="rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{ background: 'white', border: '1px solid rgba(249,115,22,0.12)', boxShadow: '0 4px 24px rgba(249,115,22,0.07)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl"
                style={{ background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' }}>🏠</div>
              <h3 className="font-black text-xl mb-3" style={{ color: '#0D1B3E' }}>Opción 2: Seguir adelante</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Habilitamos el <strong className="text-gray-700">salón techado con mesas, decoración y juegos
                cubiertos</strong>. Los niños quedan igual de fascinados — y los papás, tranquilos.
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
                  icon: '💬', title: '+56 9 4435 6955',
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
                  💬 Consultar por WhatsApp
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
          <p className="text-lg mb-10 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Elige tu fecha, arma tu celebración y confirma en minutos.<br />
            O visita el jardín primero — <em>quien lo ve, lo ama</em>.
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
// FOOTER
// ─────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#0D1B3E' }} className="text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8 text-sm">
        <div>
          <div className="font-black text-lg mb-3" style={{ color: '#29B9E8' }}>
            Celebra Sin César
          </div>
          <p className="leading-relaxed text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Cumpleaños infantiles únicos en Las Condes, Santiago. Niños de 0 a 6 años en el
            histórico Jardín Alce.
          </p>
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
              💬
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
              <span>💬</span> +56 9 4435 6955
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
            ⭐ 5.0 · 35 reseñas Google
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
        © 2026 Celebra Sin César · Jardín Alce Kids · Las Condes, Santiago
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────
export default function App() {
  const [vista, setVista] = useState('inicio'); // 'inicio' | 'alce' | 'wizard'
  const [paso, setPaso] = useState(0);

  // Scroll instantáneo al tope en cada cambio de paso o de vista
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [paso, vista]);

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

  const [grupoAbierto, setGrupoAbierto] = useState(null); // grupo resuelto activo

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
    if (estado.sector === 'independiente')
      t += _sab ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente;
    else if (estado.cantNinos === 'hasta10' && estado.sector === 'completo')
      t += _sab ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10;
    else if (estado.cantNinos === 'hasta20')
      t += _sab ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20;
    else if (estado.cantNinos === 'hasta30' || estado.cantNinos === 'mas30')
      t += _sab ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30;
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
    const sectorTexto = estado.sector === 'independiente' ? 'Sector Independiente' : 'Jardín Completo';

    const adicionales = [
      estado.packCelebra ? `• Pack Celebra Sin Cesar (Piñata + Decoración): ${clp(PRECIOS_EXTRAS.pack_celebra)}` : '',
      ...estado.extras.map((e) => `• ${e.nombre}: ${e.gratis ? 'INCLUIDO' : clp(e.precio)}`),
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
      ? `¡Hola César! Me gustaría visitar el jardín Alce Kids antes de reservar la celebración de ${nombre}. ¿Cuándo podría pasar a conocerlo sin compromiso?`
      : `¡Hola César! Me gustaría conocer el jardín Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?`;
    window.open(`https://wa.me/56944356955?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const irAlWizard = () => {
    setVista('wizard');
    setPaso(0);
  };

  // ── VISTA INICIO ──────────────────────────────
  if (vista === 'inicio') {
    return (
      <>
        <Header onHome={() => setVista('inicio')} />
        <CardInicio onSelect={(tipo) => tipo === 'alce' ? setVista('alce') : irAlWizard()} />
        <Footer />
      </>
    );
  }

  // ── VISTA ALCE KIDS ───────────────────────────
  if (vista === 'alce') {
    return (
      <>
        <Header onHome={() => setVista('inicio')} />
        <PageAlce onIniciarWizard={irAlWizard} />
        <Footer />
      </>
    );
  }

  // ── VISTA WIZARD ──────────────────────────────
  return (
    <>
      <Header onHome={() => setVista('inicio')} />
      <div className="max-w-6xl mx-auto px-4 py-8 pb-28 lg:pb-8">

        {/* Banner Alce Kids */}
        <div className="rounded-3xl p-5 mb-8 flex items-center gap-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 50%, #0E6FA8 100%)', boxShadow: '0 8px 40px rgba(13,43,110,0.35)' }}>
          <div className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(circle at 80% 50%, rgba(41,185,232,0.25) 0%, transparent 60%)' }} />
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 relative z-10"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <img src="/logo-alce.png" alt="Alce Kids" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <span style={{ display: 'none' }} className="text-3xl">🦌</span>
          </div>
          <div className="flex-1 relative z-10">
            <h2 className="text-white font-black text-2xl leading-none">Alce Kids</h2>
            <p className="text-blue-200/70 text-sm mt-0.5">Jardín Alce · Talavera de la Reina 380, Las Condes · 0 a 6 años</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xl">⭐ 5.0</span>
              <span className="text-blue-200/60 text-xs">· 35 reseñas</span>
            </div>
            <button
              onClick={() => setVista('alce')}
              className="text-xs font-bold px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(41,185,232,0.2)', color: '#93c5fd' }}
            >
              ← Ver info del jardín
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contenido principal */}
          <div className="lg:col-span-2">
            <Pasos actual={paso} total={5} />

            {/* ─── PASO 0: FECHA Y HORA ─── */}
            {paso === 0 && (
              <div>
                {/* ── Video — sin bordes, sin texto, sin overlays ── */}
                <div
                  className="overflow-hidden mb-7 aspect-video md:aspect-auto md:h-[450px]"
                  style={{ background: '#0D2B6E' }}
                >
                  <video
                    className="w-full h-full object-cover"
                    src="/video-home.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                  />
                </div>

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
                  onClick={() => setPaso(1)}
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
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>🎂 El festejado</h2>
                <p className="text-gray-400 mb-6">Queremos hacer su día inolvidable</p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">¿Cómo se llama el cumpleañero/a?</label>
                    <input
                      type="text"
                      value={estado.nombreNino}
                      onChange={(e) => set('nombreNino', e.target.value)}
                      placeholder="Ej: Sofía, Matías, Antonia..."
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
                    <label className="block text-sm font-black text-gray-600 mb-2">¿Cuántos años cumple?</label>
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
                        <p className="font-black text-amber-800">Aviso de Seguridad</p>
                        <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                          Para resguardar la seguridad de los más pequeños, es{' '}
                          <strong>obligatorio contratar un adicional de entretenimiento</strong>{' '}
                          para el grupo de niños mayores de 6 años. Lo encontrarás en el catálogo de adicionales (Animador +6 años).
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
                    onClick={() => setPaso(2)}
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
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <p className="text-green-700 font-bold text-sm">
                    <strong>¡Adultos ilimitados incluidos!</strong> No pagas extra por papás, apoderados ni familiares que acompañen.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { id: 'hasta10', label: 'Hasta 10 niños', tag: 'Sector Independiente disponible', precio: null },
                    { id: 'hasta20', label: 'Hasta 20 niños', tag: 'Jardín Completo',  precio: esSabado ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20 },
                    { id: 'hasta30', label: 'Hasta 30 niños', tag: 'Jardín Completo',  precio: esSabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30 },
                    { id: 'mas30',   label: 'Más de 30 niños', tag: '+$10.000 por niño extra', precio: esSabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30 },
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
                          desc: 'Un solo sector del jardín. Más íntimo y recogido.',
                          precio: esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente,
                          emoji: '🌳',
                        },
                        {
                          id: 'completo',
                          nombre: 'Jardín Completo',
                          desc: 'Acceso a todas las áreas. La experiencia completa.',
                          precio: esSabado ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10,
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
                    <p className="text-blue-700 font-bold text-sm">🏡 Jardín Completo — asignado automáticamente</p>
                    <p className="text-blue-500 text-xs mt-1">Para grupos de más de 10 niños, el Jardín Completo garantiza la mejor experiencia para todos.</p>
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
                    onClick={() => setPaso(3)}
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
                    onClick={() => setPaso(4)}
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
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>Arma tu celebración ideal</h2>
                <p className="text-gray-400 mb-6 text-sm">Todos los adicionales son opcionales. Toca cualquier cuadrado para ver las opciones.</p>

                {/* Pack Celebra Sin Cesar */}
                <div
                  className="rounded-2xl p-5 mb-10 border-2"
                  style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', borderColor: '#F97316' }}
                >
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
                          : { background: 'white', border: '2px solid #F97316', color: '#F97316' }}
                      >
                        {estado.packCelebra ? '✓ Agregado' : '+ Agregar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── VITRINA DE BLOQUES ────────────────────────────── */}
                {BLOQUES_VITRINA.map((bloque) => (
                  <div key={bloque.id} className="mb-10">
                    {/* Título del bloque */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h3
                          className="font-black text-xl tracking-tight"
                          style={{ color: '#1565C0' }}
                        >
                          {bloque.titulo}
                        </h3>
                        {bloque.subTitulo && (
                          <span className="text-xs font-semibold text-gray-400">
                            {bloque.subTitulo}
                          </span>
                        )}
                      </div>
                      <div className="h-0.5 w-10 rounded-full mt-1.5" style={{ background: '#F97316' }} />
                    </div>

                    {/* Grid 2×2 (mobile) → 4 columnas (desktop) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                      {bloque.grupos.map((grupoRaw) => {
                        const grupo = resolveGrupo(grupoRaw);
                        const esClickable = grupo.items.length > 0;
                        const selCount = grupo.items.filter((item) =>
                          estado.extras.some((e) => e.id === item.id)
                        ).length;

                        return (
                          <button
                            key={grupo.id}
                            onClick={() => esClickable && setGrupoAbierto(grupo)}
                            className="relative overflow-hidden rounded-2xl group transition-all duration-200"
                            style={{
                              aspectRatio: '1 / 1',
                              cursor: esClickable ? 'pointer' : 'default',
                              boxShadow: selCount > 0
                                ? '0 0 0 2.5px #F97316, 0 6px 20px rgba(249,115,22,0.22)'
                                : '0 2px 10px rgba(0,0,0,0.1)',
                            }}
                          >
                            {/* Gradient fallback (visible si no carga la foto) */}
                            <div
                              className="absolute inset-0"
                              style={{
                                background: selCount > 0
                                  ? 'linear-gradient(135deg,#0D2B6E,#1565C0)'
                                  : 'linear-gradient(135deg,#1a1f3c,#2d3561)',
                              }}
                            />
                            {/* Foto real */}
                            <Image
                              src={grupo.imagen}
                              alt={grupo.nombre}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              sizes="(max-width: 768px) 50vw, 25vw"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            {/* Overlay oscuro gradiente (inferior más oscuro) */}
                            <div
                              className="absolute inset-0"
                              style={{
                                background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.06) 100%)',
                              }}
                            />
                            {/* Badge de venue feature (top-left) */}
                            {grupo.badge && (
                              <div
                                className="absolute top-2 left-2 text-white text-xs font-black px-2 py-0.5 rounded-lg leading-tight shadow"
                                style={{
                                  background: grupo.badgeTipo === 'incluido'
                                    ? 'rgba(22,163,74,0.92)'
                                    : 'rgba(249,115,22,0.92)',
                                  maxWidth: 'calc(100% - 1rem)',
                                }}
                              >
                                {grupo.badge}
                              </div>
                            )}
                            {/* Contador de seleccionados (top-right) */}
                            {selCount > 0 && (
                              <div
                                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black shadow"
                                style={{ background: '#F97316' }}
                              >
                                {selCount}
                              </div>
                            )}
                            {/* Nombre + subNombre (abajo) */}
                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                              <div className="text-white font-black text-xs md:text-sm leading-tight">
                                {grupo.nombre}
                              </div>
                              {grupo.subNombre && (
                                <div className="text-white/60 text-xs leading-tight mt-0.5 hidden md:block">
                                  {grupo.subNombre}
                                </div>
                              )}
                            </div>
                            {/* Borde naranja en hover (solo clickeables) */}
                            {esClickable && (
                              <div
                                className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-400 transition-colors duration-200"
                              />
                            )}
                            {/* Icono de "no clickeable" (venue feature puro) */}
                            {!esClickable && (
                              <div
                                className="absolute inset-0 rounded-2xl border-2"
                                style={{ borderColor: 'rgba(34,197,94,0.5)' }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* ── FIN VITRINA ─────────────────────────────────── */}

                {/* Uso de cocina */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-700">🍳 ¿Usarán la cocina para cocinar?</p>
                      <p className="text-gray-400 text-xs mt-0.5">Se agrega automáticamente un cargo de Aseo Profundo</p>
                    </div>
                    <button
                      onClick={() => set('usaCocina', !estado.usaCocina)}
                      className={`w-14 h-7 rounded-full transition-colors relative flex-shrink-0 ${
                        estado.usaCocina ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-1 shadow transition-all ${
                        estado.usaCocina ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  {estado.usaCocina && (
                    <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-200">
                      <span className="text-gray-500">Cargo Aseo Profundo agregado</span>
                      <span className="font-black text-gray-800">{clp(PRECIOS_EXTRAS.aseo_profundo)}</span>
                    </div>
                  )}
                </div>

                {/* Notas especiales */}
                <div className="mb-4">
                  <label className="block font-black text-gray-700 text-sm mb-2">
                    📝 Notas especiales <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    value={estado.notas}
                    onChange={(e) => set('notas', e.target.value)}
                    placeholder="Ej: el cumpleañero es alérgico al maní, queremos decoración color verde menta, la abuela usa silla de ruedas..."
                    rows={3}
                    className="w-full border-2 border-gray-200 focus:border-blue-300 rounded-2xl px-4 py-3 text-sm outline-none transition-colors resize-none font-medium text-gray-700 bg-white"
                    style={{ lineHeight: '1.5' }}
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setPaso(3)}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    onClick={generarWhatsApp}
                    className="flex-1 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}
                  >
                    💬 Confirmar por WhatsApp
                  </button>
                </div>

                {/* Opción visita */}
                <div className="text-center mt-4">
                  <p className="text-gray-400 text-xs mb-1">¿Todavía no estás seguro/a?</p>
                  <button
                    onClick={generarWhatsAppVisita}
                    className="font-bold text-sm hover:underline transition-colors"
                    style={{ color: '#1565C0' }}
                  >
                    Prefiero conocer el jardín antes de reservar →
                  </button>
                </div>
              </div>
            )}
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

      {/* Barra inferior móvil */}
      {total > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between lg:hidden z-50"
          style={{
            background: 'linear-gradient(135deg, #060F2E 0%, #0D1B3E 100%)',
            borderTop: '1px solid rgba(41,185,232,0.2)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Total estimado</div>
            <div className="font-black text-2xl" style={{ color: '#F97316', textShadow: '0 0 16px rgba(249,115,22,0.4)' }}>{clp(total)}</div>
          </div>
          <button
            onClick={generarWhatsApp}
            className="text-white font-black py-3 px-6 rounded-2xl flex items-center gap-2 transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}
          >
            💬 Confirmar
          </button>
        </div>
      )}
    </>
  );
}
