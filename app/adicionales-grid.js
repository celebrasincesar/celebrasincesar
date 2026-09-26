'use client';

import { useState, useRef, useEffect } from 'react';
import { CATEGORIAS_ADICIONALES, MARCA } from '../data/master';
import { VITRINA, CARRUSEL } from '../data/imagenes';

export const WA_BASE = `https://wa.me/${MARCA.whatsapp}`;

// Respeta la preferencia del sistema: si el usuario pidió menos movimiento,
// el salto es instantáneo (la navegación es lo crítico, la animación no).
export function scrollBehavior() {
  if (typeof window === 'undefined') return 'smooth';
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  } catch { return 'smooth'; }
}

export function clp(n) {
  if (n === 0) return 'SIN COSTO';
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
export function GrupoCard({ grupo, onTap, isMobile = true, seleccionado = false, permitirAddDirecto = false, onAddDirecto = null, cantNinos = 'hasta10', agregados = [] }) {
  const nombresAgregados = agregados.map((i) => i.nombre).join(' · ');
  const imgSrc = VITRINA[grupo.carpeta];
  const count = grupo.items.length;
  const precios = grupo.preciosPorFoto
    ? [...new Set(grupo.preciosPorFoto)].filter(Boolean)
    : grupo.items.map((i) => i.precios?.hasta10 ?? i.precio ?? 0).filter((p) => p > 0);
  const min = precios.length ? Math.min(...precios) : 0;
  const precioLabel = count === 0 ? 'INCLUIDO'
    : precios.length === 0 ? 'SIN COSTO'
    : `Desde ${clp(min)}`;
  const precioColor = precios.length === 0 ? '#4ade80' : '#FB923C';

  // Agregado directo: secciones de UNA sola opción en categorías marcadas
  // (Incluidos, Decoración) llevan botón "Agregar" en la propia tarjeta —
  // no hace falta entrar a la ficha. Las de varias opciones sí abren la ficha.
  const directo = permitirAddDirecto && count === 1 && typeof onAddDirecto === 'function';
  const itemDirecto = directo ? grupo.items[0] : null;
  const precioDirectoRaw = itemDirecto
    ? (itemDirecto.precios?.[cantNinos] ?? itemDirecto.precios?.hasta10 ?? itemDirecto.precio ?? 0)
    : 0;
  const precioDirectoLabel = precioDirectoRaw === 0 ? 'SIN COSTO' : clp(precioDirectoRaw);
  // Los incluidos no se "agregan": se dejan preparados. El precio sigue en $0,
  // pero el papá entiende que está pidiendo que lo tengamos listo, no comprando.
  const esGratis = directo && precioDirectoRaw === 0;
  const textoAccion = esGratis
    ? (seleccionado ? '✓ Lo dejamos listo' : 'Dejar preparado')
    : (seleccionado ? '✓ Agregado' : '+ Agregar');

  return (
    <button
      onClick={onTap}
      className="group relative overflow-hidden rounded-3xl text-left transition-all duration-200 active:scale-[0.97] hover:scale-[1.02]"
      style={{
        ...(isMobile ? { width: 'min(72vw, 260px)', flexShrink: 0, scrollSnapAlign: 'start' } : { width: '100%' }),
        aspectRatio: '1055 / 1491',
        background: '#060F2E',
        boxShadow: seleccionado
          ? '0 0 0 2.5px #22c55e, 0 8px 32px rgba(34,197,94,0.3)'
          : '0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={grupo.nombre}
          loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-15 text-8xl">🎪</div>
      )}

      {/* Degradado: oscuro ARRIBA (título + subtítulo legibles) y abajo (botón) */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(6,15,46,0.86) 0%, rgba(6,15,46,0.48) 22%, rgba(6,15,46,0.12) 44%, rgba(6,15,46,0.30) 64%, rgba(6,15,46,0.97) 100%)',
      }} />

      {/* Título + subtítulo ARRIBA — grandes y legibles sobre la foto (blanco fuerte + sombra) */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-3.5">
        {/* pr solo en el título (esquiva el badge "N opciones"); el subtítulo va
            debajo del badge → ancho completo para que quepa en 3 líneas. */}
        <p className={`font-black text-white leading-tight line-clamp-2 ${count > 1 ? 'pr-14' : ''}`}
          style={{ fontSize: '1.3rem', textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.95)' }}>
          {grupo.nombre}
        </p>
        <p className="font-semibold leading-snug mt-1 line-clamp-3"
          style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.96)', textShadow: '0 1px 5px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.95)' }}>
          {grupo.subNombre || grupo.nota}
        </p>
      </div>

      {count > 1 && (
        <div className="absolute top-3 right-3 rounded-xl px-2 py-1 font-bold text-white"
          style={{ fontSize: '0.6rem', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          {count} opciones
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
        {directo ? (
          // Botón Agregar directo — no abre la ficha (stopPropagation). Estado agregado
          // en el MISMO formato: "✓ Agregado" + precio, sin "quitar".
          <div
            onClick={(e) => { e.stopPropagation(); onAddDirecto(itemDirecto, grupo); }}
            className="flex flex-col items-center justify-center gap-0.5 w-full px-3 py-2 rounded-xl font-black text-white cursor-pointer transition-all active:scale-95"
            style={{
              background: seleccionado
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: seleccionado
                ? '0 4px 16px rgba(34,197,94,0.3)'
                : '0 4px 16px rgba(249,115,22,0.35)',
            }}>
            {/* Acción arriba y el precio (SIN COSTO en los incluidos) abajo */}
            <span style={{ fontSize: '0.8rem', lineHeight: 1.1 }}>{textoAccion}</span>
            <span style={{ fontSize: '0.95rem', lineHeight: 1.1, color: precioDirectoRaw === 0 ? '#bbf7d0' : 'rgba(255,255,255,0.95)' }}>
              {precioDirectoLabel}
            </span>
          </div>
        ) : seleccionado ? (
          // Multi-opción agregada: mismo diseño verde que Incluidos, con el/los nombre(s)
          <div className="w-full px-3.5 py-2 rounded-xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
            <span style={{ fontSize: '0.8rem' }}>✓ Agregado</span>
            {nombresAgregados && (
              <span className="block leading-snug line-clamp-2 mt-0.5 font-semibold"
                style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.95)' }}>
                {nombresAgregados}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs font-black" style={{ color: '#29B9E8' }}>
              {count === 1 ? 'Ver ficha →' : 'Ver opciones →'}
            </span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(41,185,232,0.2)', border: '1px solid rgba(41,185,232,0.3)' }}>
              <span className="text-white font-black" style={{ fontSize: '0.75rem' }}>›</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Tarjeta INCLUIDO / A COTIZAR (grupo sin ítems) ────────────────────────────
// badgeTipo 'cotizar' → tarjeta que abre WhatsApp para pedir cotización
export function IncludedCard({ grupo, isMobile = true, onCotizar = null, cotizado = false }) {
  const imgSrc = VITRINA[grupo.carpeta];
  const esCotizar = grupo.badgeTipo === 'cotizar';
  const waCotizar = `${WA_BASE}?text=${encodeURIComponent(
    `Hola! Estoy viendo el catálogo de Alce Kids y me gustaría cotizar *${grupo.nombre}* para mi celebración 😊`
  )}`;
  // CTA según contexto. En el WIZARD (onCotizar provisto) NO sale a WhatsApp:
  // marca "lo consulto al final" y la cotización viaja en el mensaje final,
  // así ningún botón hace perder lo ya avanzado del armado.
  // grupo.ctaLabel + grupo.href → tarjeta informativa que lleva a otra parte
  // del sitio (ej: Packs para Hermanos Mayores → /armar). No sale a WhatsApp
  // ni pide cotización: solo explica y deriva al armador.
  const cta = grupo.ctaLabel
    ? grupo.ctaLabel
    : !esCotizar
      ? null
      : onCotizar
        ? (cotizado ? '✓ Lo consulto al final' : '＋ Lo consulto al final')
        : 'Cotizar por WhatsApp →';
  const ctaColor = cotizado ? '#4ade80' : '#29B9E8';

  const inner = (
    <>
      {imgSrc && (
        <img src={imgSrc} alt={grupo.nombre} loading="lazy" decoding="async"
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
          {grupo.lead || (esCotizar ? 'Cotización sin compromiso' : 'Sin costo adicional')}
        </p>
        <p className="font-black text-white leading-tight mb-1" style={{ fontSize: '1rem' }}>
          {grupo.nombre}
        </p>
        <p className="leading-snug" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>
          {grupo.nota || grupo.subNombre}
        </p>
        {cta && (
          <p className="mt-3 text-xs font-black" style={{ color: ctaColor }}>
            {cta}
          </p>
        )}
      </div>
    </>
  );

  const estilo = {
    ...(isMobile ? { width: 'min(72vw, 260px)', flexShrink: 0, scrollSnapAlign: 'start' } : { width: '100%' }),
    aspectRatio: '1055 / 1491',
    background: '#060F2E',
    boxShadow: cotizado ? '0 0 0 3px #22c55e, 0 8px 32px rgba(0,0,0,0.35)' : '0 8px 32px rgba(0,0,0,0.35)',
  };

  // Tarjeta con destino propio dentro del sitio (packs para hermanos mayores)
  if (grupo.href) {
    return (
      <a href={grupo.href}
        className="relative overflow-hidden rounded-3xl block transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
        style={estilo}>
        {inner}
      </a>
    );
  }
  // Incluido gratis (no interactivo)
  if (!esCotizar) {
    return <div className="relative overflow-hidden rounded-3xl" style={estilo}>{inner}</div>;
  }
  // Wizard: botón que marca "lo consulto al final" SIN salir del armado
  if (onCotizar) {
    return (
      <button type="button" onClick={() => onCotizar(grupo)}
        className="relative overflow-hidden rounded-3xl block w-full text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
        style={estilo}>
        {inner}
      </button>
    );
  }
  // Catálogo (standalone): abre WhatsApp para cotizar
  return (
    <a href={waCotizar} target="_blank" rel="noopener noreferrer"
      className="relative overflow-hidden rounded-3xl block transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
      style={estilo}>
      {inner}
    </a>
  );
}

// ── Ficha a pantalla completa ─────────────────────────────────────────────────
// Modo catálogo (onAdd=null): botón azul "Reservar →" que lleva al wizard
// Modo wizard (onAdd provisto): botón naranja "Agregar" que agrega al carrito
// cantNinos: tramo de precios activo ('hasta10' | 'hasta20' | 'hasta30' | 'mas30')
export function FichaCarrusel({ grupo, onCerrar, onAdd = null, isAdded = null, cantNinos = 'hasta10', ownHistory = true }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);
  const panelRef = useRef(null);
  const focoPrevio = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Un diálogo a pantalla completa tiene que comportarse como tal (§BS):
  // el foco entra al abrirlo, no se escapa al fondo mientras está abierto,
  // Escape lo cierra y las flechas cambian de foto. Al cerrar, el foco
  // vuelve exactamente al elemento que lo abrió.
  useEffect(() => {
    focoPrevio.current = document.activeElement;
    const primero = panelRef.current?.querySelector('button, a[href]');
    primero?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
      if (e.key === 'ArrowRight') { next(); return; }
      if (e.key === 'ArrowLeft')  { prev(); return; }
      if (e.key !== 'Tab') return;
      const focos = panelRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focos?.length) return;
      const primerFoco = focos[0];
      const ultimoFoco = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primerFoco) {
        e.preventDefault(); ultimoFoco.focus();
      } else if (!e.shiftKey && document.activeElement === ultimoFoco) {
        e.preventDefault(); primerFoco.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      try { focoPrevio.current?.focus?.(); } catch {}
    };
  }); // sin deps: `cerrar`, `next` y `prev` se recrean en cada render

  useEffect(() => {
    if (!ownHistory) return; // en el wizard, el centinela ÚNICO del padre maneja el atrás
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
  const precioLabel = precioRaw === null ? null : (precioRaw === 0 ? 'SIN COSTO' : clp(precioRaw));
  const esGratis = precioRaw === 0;
  const estaAgregado = isAdded && item ? isAdded(item) : false;
  const puedAgregar = onAdd !== null && Boolean(item?.id);

  const waLink = `${WA_BASE}?text=${encodeURIComponent(
    `Hola! Vi el catálogo de Alce Kids y me interesa un *${grupo.nombre}* para mi celebración. ¿Está disponible? 🎉`
  )}`;
  const reservarHref = item?.id ? `/?addon=${item.id}` : waLink;

  const cerrar = () => { if (ownHistory) history.back(); else onCerrar(); };
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
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={grupo.nombre}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {imgSrc && (
        <img src={imgSrc} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: 'blur(22px) brightness(0.55) saturate(2.4)', transform: 'scale(1.14)' }} />
      )}

      <div className="relative flex-1 flex items-center justify-center min-h-0 px-3 pt-3">
        <button onClick={cerrar} aria-label="Cerrar"
          className="absolute top-2 left-3 z-20 w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-base"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span aria-hidden="true">✕</span>
        </button>

        {total > 1 && (
          <span className="absolute top-2 right-3 z-20 font-bold text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {idx + 1} / {total}
          </span>
        )}

        {total > 1 && (
          <>
            {/* 44x44: el mínimo táctil recomendado (§BS) */}
            <button onClick={prev} aria-label="Foto anterior"
              className="absolute left-0 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
              <span aria-hidden="true">‹</span>
            </button>
            <button onClick={next} aria-label="Foto siguiente"
              className="absolute right-0 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-2xl"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)' }}>
              <span aria-hidden="true">›</span>
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
            onClick={() => { const yaEstaba = estaAgregado; onAdd(item, grupo); if (!yaEstaba) cerrar(); }}
            className="flex items-center justify-between w-full px-5 py-4 rounded-2xl font-black text-white"
            style={{
              background: estaAgregado
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #F97316, #EA580C)',
              boxShadow: estaAgregado
                ? '0 4px 20px rgba(34,197,94,0.35)'
                : '0 4px 20px rgba(249,115,22,0.4)',
            }}>
            <span className="text-sm">
              {estaAgregado ? '✕ Quitar' : (esGratis ? 'Dejar preparado →' : '✓ Agregar →')}
            </span>
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

// ── Ficha PORTADA de categoría (no seleccionable): imagen branded + instrucción ──
export function PortadaCard({ grupo }) {
  const imgSrc = VITRINA[grupo.carpeta];
  return (
    <div className="relative overflow-hidden rounded-3xl"
      style={{ aspectRatio: '1055 / 1491', background: '#060F2E', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
      {imgSrc
        ? <img src={imgSrc} alt={grupo.nombre} className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 flex items-center justify-center opacity-15 text-8xl">🎪</div>}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(6,15,46,0.86) 0%, rgba(6,15,46,0.48) 22%, rgba(6,15,46,0.12) 44%, rgba(6,15,46,0.30) 64%, rgba(6,15,46,0.97) 100%)',
      }} />
      {/* Título + texto ARRIBA, igual que el resto de las fichas */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-3.5">
        <p className="font-black text-white leading-tight line-clamp-2"
          style={{ fontSize: '1.3rem', textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.95)' }}>
          {grupo.nombre}
        </p>
        <p className="font-semibold leading-snug mt-1 line-clamp-3"
          style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.96)', textShadow: '0 1px 5px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.95)' }}>
          {grupo.subNombre}
        </p>
      </div>
    </div>
  );
}

// ── Sección por bloque — grilla en todos los tamaños ─────────────────────────
// getSeleccionado(grupo): marca grupos con ítems en el carrito
// getAgregados(grupo): devuelve los ítems agregados del grupo (para mostrar sus nombres)
// `compacto` = la sección va dentro de un acordeón que ya pone el id y el
// título, así que aquí solo se pinta la grilla (§P1-26).
export function BloqueSection({ bloque, onTapGrupo, getSeleccionado = null, onAddDirecto = null, cantNinos = 'hasta10', getAgregados = null, onCotizar = null, getCotizado = null, compacto = false }) {
  const grupos = bloque.grupos.map(resolveGrupo);

  const renderCard = (grupo) => {
    if (grupo.portada) return <PortadaCard key={grupo.id} grupo={grupo} />;
    const seleccionado = getSeleccionado ? getSeleccionado(grupo) : false;
    const agregados = getAgregados ? getAgregados(grupo) : [];
    return grupo.items.length === 0
      ? <IncludedCard key={grupo.id} grupo={grupo} isMobile={false}
          onCotizar={onCotizar} cotizado={getCotizado ? getCotizado(grupo) : false} />
      : <GrupoCard key={grupo.id} grupo={grupo} onTap={() => onTapGrupo(grupo)} isMobile={false} seleccionado={seleccionado}
          permitirAddDirecto={!!bloque.addDirecto} onAddDirecto={onAddDirecto} cantNinos={cantNinos} agregados={agregados} />;
  };

  return (
    <section id={compacto ? undefined : bloque.id} className={compacto ? 'mb-3' : 'mb-12 scroll-mt-28'}>
      {!compacto && (
        <div className="mb-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="font-black text-xl md:text-2xl tracking-tight" style={{ color: '#1565C0' }}>
              {bloque.titulo}
            </h2>
            {bloque.subTitulo && (
              <span className="text-xs font-semibold text-gray-500">{bloque.subTitulo}</span>
            )}
          </div>
          <div className="h-0.5 w-10 rounded-full mt-1.5" style={{ background: '#F97316' }} />
        </div>
      )}

      {/* Grilla — 2 columnas en móvil, más en pantallas mayores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-5">
        {grupos.map((g) => renderCard(g))}
      </div>
    </section>
  );
}
