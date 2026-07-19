'use client';

import { useState, useRef, useEffect } from 'react';
import { CATEGORIAS_ADICIONALES, MARCA } from '../data/master';
import { VITRINA, CARRUSEL } from '../data/imagenes';

export const WA_BASE = `https://wa.me/${MARCA.whatsapp}`;

export function clp(n) {
  if (n === 0) return 'GRATIS';
  return `$${n.toLocaleString('es-CL')}`;
}

export function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" style={{ display: 'inline', verticalAlign: '-0.125em' }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export const ITEM_LOOKUP = Object.fromEntries(
  CATEGORIAS_ADICIONALES.flatMap((c) => c.items).map((item) => [item.id, item])
);

export function resolveGrupo(g) {
  return { ...g, items: (g.itemIds || []).map((id) => ITEM_LOOKUP[id]).filter(Boolean) };
}

// ── Tarjeta de CATEGORÍA (grupo) ──────────────────────────────────────────────
// seleccionado: true cuando algún ítem del grupo está en el carrito (modo wizard)
export function GrupoCard({ grupo, onTap, isMobile = true, seleccionado = false }) {
  const imgSrc = VITRINA[grupo.carpeta];
  const count = grupo.items.length;
  const precios = grupo.preciosPorFoto
    ? [...new Set(grupo.preciosPorFoto)].filter(Boolean)
    : grupo.items.map((i) => i.precios?.hasta10 ?? i.precio ?? 0).filter((p) => p > 0);
  const min = precios.length ? Math.min(...precios) : 0;
  const precioLabel = count === 0 ? 'INCLUIDO'
    : precios.length === 0 ? 'GRATIS'
    : `Desde ${clp(min)}`;
  const precioColor = precios.length === 0 ? '#4ade80' : '#FB923C';

  return (
    <button
      onClick={onTap}
      className="group relative overflow-hidden rounded-3xl text-left transition-all duration-200 active:scale-[0.97] hover:scale-[1.02]"
      style={{
        ...(isMobile ? { width: 'min(72vw, 260px)', flexShrink: 0, scrollSnapAlign: 'start' } : { width: '100%' }),
        aspectRatio: '1055 / 1491',
        background: '#060F2E',
        boxShadow: seleccionado
          ? '0 0 0 2.5px #F97316, 0 8px 32px rgba(249,115,22,0.3)'
          : '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={grupo.nombre}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-15 text-8xl">🎪</div>
      )}

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(6,15,46,0.05) 0%, rgba(6,15,46,0.28) 45%, rgba(6,15,46,0.97) 100%)',
      }} />

      {grupo.badge && (
        <div className="absolute top-3 left-3 rounded-xl px-2.5 py-1 font-black text-white"
          style={{
            fontSize: '0.6rem', letterSpacing: '0.05em',
            background: grupo.badgeTipo === 'incluido' ? 'rgba(34,197,94,0.9)' : 'rgba(249,115,22,0.9)',
          }}>
          {grupo.badge}
        </div>
      )}

      {count > 1 && (
        <div className="absolute top-3 right-3 rounded-xl px-2 py-1 font-bold text-white"
          style={{ fontSize: '0.6rem', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          {count} opciones
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
        {seleccionado && (
          <p className="font-black mb-0.5" style={{ fontSize: '1.15rem', color: '#F97316', lineHeight: 1 }}>
            ✓ Agregado
          </p>
        )}
        <p className="font-black text-white leading-tight mb-1" style={{ fontSize: '1rem' }}>
          {grupo.nombre}
        </p>
        <p className="leading-snug line-clamp-2" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
          {grupo.subNombre || grupo.nota}
        </p>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-xs font-black" style={{ color: seleccionado ? '#F97316' : '#29B9E8' }}>
            {seleccionado ? 'Ver / cambiar →' : count === 1 ? 'Ver ficha →' : 'Ver opciones →'}
          </span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: seleccionado ? 'rgba(249,115,22,0.2)' : 'rgba(41,185,232,0.2)',
              border: `1px solid ${seleccionado ? 'rgba(249,115,22,0.3)' : 'rgba(41,185,232,0.3)'}`,
            }}>
            <span className="text-white font-black" style={{ fontSize: '0.75rem' }}>›</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Tarjeta INCLUIDO / A COTIZAR (grupo sin ítems) ────────────────────────────
// badgeTipo 'cotizar' → tarjeta que abre WhatsApp para pedir cotización
export function IncludedCard({ grupo, isMobile = true }) {
  const imgSrc = VITRINA[grupo.carpeta];
  const esCotizar = grupo.badgeTipo === 'cotizar';
  const waCotizar = `${WA_BASE}?text=${encodeURIComponent(
    `Hola! Estoy viendo el catálogo de Alce Kids y me gustaría cotizar *${grupo.nombre}* para mi celebración 😊`
  )}`;

  const inner = (
    <>
      {imgSrc && (
        <img src={imgSrc} alt={grupo.nombre}
          className="absolute inset-0 w-full h-full object-cover opacity-50" />
      )}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(6,15,46,0.2) 0%, rgba(6,15,46,0.98) 100%)',
      }} />
      <div className="absolute top-3 left-3 rounded-xl px-2.5 py-1 font-black text-white"
        style={{
          fontSize: '0.6rem', letterSpacing: '0.05em',
          background: esCotizar ? 'rgba(249,115,22,0.9)' : 'rgba(34,197,94,0.9)',
        }}>
        {esCotizar ? (grupo.badge || 'A COTIZAR') : '✓ INCLUIDO'}
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5">
        <p className="font-black mb-1" style={{ fontSize: '1rem', color: esCotizar ? '#FB923C' : '#4ade80', lineHeight: 1 }}>
          {esCotizar ? 'Cotización sin compromiso' : 'Sin costo adicional'}
        </p>
        <p className="font-black text-white leading-tight mb-1" style={{ fontSize: '1rem' }}>
          {grupo.nombre}
        </p>
        <p className="leading-snug" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
          {grupo.nota || grupo.subNombre}
        </p>
        {esCotizar && (
          <p className="mt-3 text-xs font-black" style={{ color: '#29B9E8' }}>
            Cotizar por WhatsApp →
          </p>
        )}
      </div>
    </>
  );

  const estilo = {
    ...(isMobile ? { width: 'min(72vw, 260px)', flexShrink: 0, scrollSnapAlign: 'start' } : { width: '100%' }),
    aspectRatio: '1055 / 1491',
    background: '#060F2E',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  };

  return esCotizar ? (
    <a href={waCotizar} target="_blank" rel="noopener noreferrer"
      className="relative overflow-hidden rounded-3xl block transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
      style={estilo}>
      {inner}
    </a>
  ) : (
    <div className="relative overflow-hidden rounded-3xl" style={estilo}>
      {inner}
    </div>
  );
}

// ── Ficha a pantalla completa ─────────────────────────────────────────────────
// Modo catálogo (onAdd=null): botón azul "Reservar →" que lleva al wizard
// Modo wizard (onAdd provisto): botón naranja "Agregar" que agrega al carrito
// cantNinos: tramo de precios activo ('hasta10' | 'hasta20' | 'hasta30' | 'mas30')
export function FichaCarrusel({ grupo, onCerrar, onAdd = null, isAdded = null, cantNinos = 'hasta10' }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    history.pushState(null, '');
    const onPop = () => onCerrar();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items   = grupo.items;
  const imgs    = CARRUSEL[grupo.carpeta] || [];
  const vitrina = VITRINA[grupo.carpeta] || null;
  const total   = imgs.length || items.length;
  const imgSrc  = imgs[idx] || vitrina;
  const item    = items[idx];
  const precioRaw = grupo.preciosPorFoto?.[idx] ?? (item ? (item.precios?.[cantNinos] ?? item.precios?.hasta10 ?? item.precio ?? 0) : null);
  const precioLabel = precioRaw === null ? null : (precioRaw === 0 ? 'GRATIS' : clp(precioRaw));
  const esGratis = precioRaw === 0;
  const estaAgregado = isAdded && item ? isAdded(item) : false;
  const puedAgregar = onAdd !== null && Boolean(item?.id);

  const waLink = `${WA_BASE}?text=${encodeURIComponent(
    `Hola! Vi el catálogo de Alce Kids y me interesa un *${grupo.nombre}* para mi celebración. ¿Está disponible? 🎉`
  )}`;
  const reservarHref = item?.id ? `/?addon=${item.id}` : waLink;

  const cerrar = () => history.back();
  const prev   = () => setIdx((i) => (i - 1 + total) % total);
  const next   = () => setIdx((i) => (i + 1) % total);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div className="fixed inset-0 z-[900] flex flex-col"
      style={{ background: '#0a0f28' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {imgSrc && (
        <img src={imgSrc} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: 'blur(22px) brightness(0.55) saturate(2.4)', transform: 'scale(1.14)' }} />
      )}

      <div className="relative flex-1 flex items-center justify-center min-h-0 px-3 pt-3">
        <button onClick={cerrar}
          className="absolute top-2 left-3 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-base"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
          ✕
        </button>

        {total > 1 && (
          <span className="absolute top-2 right-3 z-20 font-bold text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {idx + 1} / {total}
          </span>
        )}

        {total > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-0 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
              ‹
            </button>
            <button onClick={next}
              className="absolute right-0 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
              ›
            </button>
          </>
        )}

        {imgSrc ? (
          <div style={{
            position: 'relative', width: 'auto', maxWidth: '100%', maxHeight: '100%',
            aspectRatio: '520 / 735', borderRadius: '1rem', overflow: 'hidden',
            boxShadow: '0 0 60px rgba(255,255,255,0.08), 0 12px 48px rgba(0,0,0,0.5)',
          }}>
            <img src={imgSrc} alt={item?.nombre || grupo.nombre}
              className="w-full h-full object-contain"
              style={{ filter: 'brightness(1.06) saturate(1.1)' }} />
          </div>
        ) : (
          <div className="text-9xl opacity-20">{item?.emoji || '🎉'}</div>
        )}
      </div>

      <div className="relative px-4 pt-3 pb-8 flex-shrink-0">
        {total > 1 && (
          <div className="absolute -top-1 left-0 right-0 flex justify-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className="rounded-full transition-all duration-200"
                style={{ height: '5px', width: i === idx ? '18px' : '5px', background: i === idx ? '#F97316' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}

        {puedAgregar ? (
          <button
            onClick={() => { onAdd(item, grupo); if (!grupo.seleccionMultiple) cerrar(); }}
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl font-black text-white"
            style={{
              background: estaAgregado
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: estaAgregado
                ? '0 4px 20px rgba(34,197,94,0.35)'
                : '0 4px 20px rgba(249,115,22,0.4)',
            }}>
            <span className="text-sm">{estaAgregado ? '✕ Quitar' : '✓ Agregar →'}</span>
            {precioLabel !== null && (
              <span style={{ fontSize: '1.25rem', color: esGratis ? '#86efac' : 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
                {precioLabel}
              </span>
            )}
          </button>
        ) : onAdd !== null ? (
          <a href={waLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
            <WaIcon /> Consultar disponibilidad
          </a>
        ) : (
          <a href={reservarHref}
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #1565C0, #29B9E8)', boxShadow: '0 4px 20px rgba(21,101,192,0.4)' }}>
            <span className="text-sm">🎉 Reservar →</span>
            {precioLabel !== null && (
              <span style={{ fontSize: '1.25rem', color: esGratis ? '#86efac' : 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
                {precioLabel}
              </span>
            )}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Sección por bloque — grilla en todos los tamaños ─────────────────────────
// getSeleccionado(grupo): función opcional para marcar grupos con ítems en el carrito
export function BloqueSection({ bloque, onTapGrupo, getSeleccionado = null }) {
  const grupos = bloque.grupos.map(resolveGrupo);

  const renderCard = (grupo) => {
    const seleccionado = getSeleccionado ? getSeleccionado(grupo) : false;
    return grupo.items.length === 0
      ? <IncludedCard key={grupo.id} grupo={grupo} isMobile={false} />
      : <GrupoCard key={grupo.id} grupo={grupo} onTap={() => onTapGrupo(grupo)} isMobile={false} seleccionado={seleccionado} />;
  };

  return (
    <section id={bloque.id} className="mb-12 scroll-mt-28">
      <div className="mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-black text-xl md:text-2xl tracking-tight" style={{ color: '#1565C0' }}>
            {bloque.titulo}
          </h2>
          {bloque.subTitulo && (
            <span className="text-xs font-semibold text-gray-400">{bloque.subTitulo}</span>
          )}
        </div>
        <div className="h-0.5 w-10 rounded-full mt-1.5" style={{ background: '#F97316' }} />
      </div>

      {/* Grilla — 2 columnas en móvil, más en pantallas mayores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-5">
        {grupos.map((g) => renderCard(g))}
      </div>
    </section>
  );
}
