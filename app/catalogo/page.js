'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useMemo } from 'react';
import { BLOQUES_VITRINA, MARCA } from '../../data/master';
import { clp, WaIcon, BloqueSection, FichaCarrusel } from '../adicionales-grid';

const WA_BASE = `https://wa.me/${MARCA.whatsapp}`;
const WA_GENERAL = `${WA_BASE}?text=${encodeURIComponent(
  'Hola! Estoy revisando el catálogo de Alce Kids y quiero consultar sobre opciones para mi celebración. ¿Me pueden orientar?'
)}`;

// Precio de un ítem según el tramo de niños activo (misma lógica que el wizard)
const getPrecio = (item, cantNinos) => {
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};

const TRAMOS = [
  { id: 'hasta10', label: 'Hasta 10 niños' },
  { id: 'hasta20', label: 'Hasta 20' },
  { id: 'hasta30', label: 'Hasta 30' },
];

function CatalogoCover() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="relative w-full overflow-hidden" style={{ background: '#060F2E' }}>
      <div className="relative mx-auto" style={{ maxWidth: '480px', aspectRatio: '1055 / 1491' }}>
        <img
          src="/fotos/catalogo-portada.webp"
          alt="Catálogo Alce Kids 2026"
          className="w-full h-full object-cover"
          onError={() => setVisible(false)}
        />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 75%, rgba(6,15,46,0.9) 100%)' }} />
      </div>
      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1">
        <span className="text-white/60 text-xs font-semibold tracking-widest uppercase">Explorar y elegir</span>
        <span className="text-white/50 text-lg">↓</span>
      </div>
    </div>
  );
}

export default function CatalogoPage() {
  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [activeId, setActiveId]         = useState(BLOQUES_VITRINA[0]?.id ?? '');
  const [extras, setExtras]             = useState([]);       // ítems elegidos
  const [cantNinos, setCantNinos]       = useState('hasta10'); // tramo de precios activo
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      for (let i = BLOQUES_VITRINA.length - 1; i >= 0; i--) {
        const el = document.getElementById(BLOQUES_VITRINA[i].id);
        if (el && el.getBoundingClientRect().top <= 150) {
          setActiveId(BLOQUES_VITRINA[i].id);
          return;
        }
      }
      setActiveId(BLOQUES_VITRINA[0]?.id ?? '');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Toggle de ítem — misma lógica que el wizard:
  // single-select quita los demás del grupo antes de agregar
  const toggleItem = (item, grupo) => {
    setExtras((prev) => {
      const yaEsta = prev.some((e) => e.id === item.id);
      if (yaEsta) return prev.filter((e) => e.id !== item.id);
      if (!grupo.seleccionMultiple) {
        const idsGrupo = grupo.items.map((i) => i.id);
        return [...prev.filter((e) => !idsGrupo.includes(e.id)), item];
      }
      return [...prev, item];
    });
  };

  const total = useMemo(
    () => extras.reduce((t, e) => t + getPrecio(e, cantNinos), 0),
    [extras, cantNinos]
  );

  // Mensaje de WhatsApp con la selección detallada (nombre + precio + total)
  const enviarSeleccion = () => {
    const tramoLabel = TRAMOS.find((t) => t.id === cantNinos)?.label ?? '';
    const lineas = extras.map((e) => {
      const p = getPrecio(e, cantNinos);
      return `• ${e.nombre}: ${p === 0 ? 'INCLUIDO' : clp(p)}`;
    });
    const msg =
`¡Hola César! Estuve revisando el catálogo de Alce Kids y me interesan estos adicionales:

${lineas.join('\n')}

Total adicionales: ${clp(total)}
(valores calculados para ${tramoLabel.toLowerCase()})

¿Están disponibles para mi fecha? 😊`;
    window.open(`${WA_BASE}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const haySeleccion = extras.length > 0;

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFF' }}>

      {/* HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(21,101,192,0.1)', boxShadow: '0 1px 20px rgba(21,101,192,0.07)' }}>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-black" style={{ color: '#1565C0' }}>
          ← Inicio
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 shadow">
            <img src="/logo-alce.webp" alt="Alce Kids" className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="font-black text-sm" style={{ color: '#1565C0' }}>Catálogo 2026</span>
        </div>
        <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer"
          className="text-xs font-black px-3 py-1.5 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 2px 10px rgba(34,197,94,0.3)' }}>
          <WaIcon />
        </a>
      </header>

      {/* PORTADA */}
      <CatalogoCover />

      {/* NAV CATEGORÍAS con flechas */}
      <div className="sticky z-40 flex items-center"
        style={{ top: '53px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '2px solid rgba(21,101,192,0.07)' }}>
        <button
          onClick={() => navRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
          aria-label="Categorías anteriores"
          className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg transition-opacity hover:opacity-70"
          style={{ color: '#1565C0' }}>
          ‹
        </button>
        <div ref={navRef} className="flex gap-1.5 px-2 py-2.5 overflow-x-auto flex-1"
          style={{ scrollbarWidth: 'none' }}>
          {BLOQUES_VITRINA.map((b) => (
            <button key={b.id} onClick={() => scrollTo(b.id)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all"
              style={activeId === b.id
                ? { background: '#1565C0', color: 'white', boxShadow: '0 2px 10px rgba(21,101,192,0.35)' }
                : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
              {b.titulo}
            </button>
          ))}
        </div>
        <button
          onClick={() => navRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
          aria-label="Más categorías"
          className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg transition-opacity hover:opacity-70"
          style={{ color: '#1565C0' }}>
          ›
        </button>
      </div>

      {/* CATÁLOGO */}
      <div className="max-w-3xl md:max-w-7xl mx-auto px-4 md:px-10 pt-5 pb-32">

        {/* Libertad total — el catálogo se envía directo a los papás:
            que nunca sientan que algo es obligatorio */}
        <div className="flex items-center gap-2.5 mb-3 px-3.5 py-3 rounded-2xl"
          style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)' }}>
          <span className="text-lg flex-shrink-0">🔓</span>
          <span className="text-xs font-bold leading-snug" style={{ color: '#9A3412' }}>
            Todo el catálogo es opcional. También puedes traer torta, comida y decoración
            por tu cuenta, sin recargo — libertad total para armar tu celebración.
          </span>
        </div>

        {/* Cómo funciona + selector de tramo de niños (afecta precios de animación) */}
        <div className="mb-6 px-3.5 py-3 rounded-2xl"
          style={{ background: 'rgba(21,101,192,0.06)', border: '1px solid rgba(21,101,192,0.1)' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-base">👆</span>
            <span className="text-xs font-semibold" style={{ color: '#1565C0' }}>
              Toca una categoría, elige lo que te guste y tu selección se va sumando abajo
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black mr-1" style={{ color: '#1565C0' }}>👶 Niños:</span>
            {TRAMOS.map((t) => (
              <button key={t.id} onClick={() => setCantNinos(t.id)}
                className="px-3 py-1 rounded-full text-xs font-black transition-all"
                style={cantNinos === t.id
                  ? { background: '#F97316', color: 'white', boxShadow: '0 2px 8px rgba(249,115,22,0.35)' }
                  : { background: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                {t.label}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-1">· la animación varía según cantidad</span>
          </div>
        </div>

        {BLOQUES_VITRINA.map((bloque) => (
          <BloqueSection
            key={bloque.id}
            bloque={bloque}
            onTapGrupo={setGrupoAbierto}
            getSeleccionado={(grupo) => grupo.items.some((i) => extras.some((e) => e.id === i.id))}
          />
        ))}

        {/* CTA final */}
        <div className="rounded-3xl overflow-hidden mt-4"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 100%)', boxShadow: '0 20px 60px rgba(6,15,46,0.4)' }}>
          <div className="relative p-7 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #29B9E8, transparent)' }} />
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="font-black text-white text-2xl mb-2 leading-tight">
              ¿Aún no tienes<br />tu fecha reservada?
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Reserva tu día y arma tu celebración completa — todo en minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/armar"
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
                🎉 Reservar mi fecha →
              </Link>
              <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                <WaIcon /> Consultar por WhatsApp
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM BAR — con selección: total en vivo + enviar por WhatsApp */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3"
        style={{ background: 'rgba(6,10,30,0.97)', backdropFilter: 'blur(14px)', borderTop: '1px solid rgba(41,185,232,0.12)', boxShadow: '0 -4px 30px rgba(0,0,0,0.45)' }}>
        {haySeleccion ? (
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full font-black text-white flex-shrink-0"
                  style={{ background: '#F97316', fontSize: '10px' }}>
                  {extras.length}
                </span>
                <span className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {extras.length === 1 ? 'adicional elegido' : 'adicionales elegidos'}
                </span>
              </div>
              <div className="font-black text-2xl leading-tight" style={{ color: '#F97316', textShadow: '0 0 16px rgba(249,115,22,0.4)' }}>
                {clp(total)}
              </div>
            </div>
            <button onClick={enviarSeleccion}
              className="text-white font-black py-3.5 px-5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}>
              <WaIcon /> Enviar mi selección
            </button>
          </div>
        ) : (
          <div className="max-w-sm mx-auto flex gap-2">
            <Link href="/armar"
              className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-2xl font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}>
              🎉 Reservar mi fecha
            </Link>
            <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer"
              aria-label="Consultar por WhatsApp"
              className="flex items-center justify-center px-5 py-3.5 rounded-2xl font-black text-white text-base"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
              <WaIcon />
            </a>
          </div>
        )}
      </div>

      {/* FICHA A PANTALLA COMPLETA — con selección (igual que el wizard) */}
      {grupoAbierto && (
        <FichaCarrusel
          grupo={grupoAbierto}
          onCerrar={() => setGrupoAbierto(null)}
          onAdd={toggleItem}
          isAdded={(item) => extras.some((e) => e.id === item.id)}
          cantNinos={cantNinos}
        />
      )}

    </div>
  );
}
