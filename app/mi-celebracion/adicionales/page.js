'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /mi-celebracion/adicionales?id=CSC-2026-000123&t=<token>
// El catálogo completo, ya filtrado para UNA celebración (pedido de César,
// 10-nov-2026). Mismas tarjetas, fichas y fotos que /catalogo; la familia
// elige, ve el valor EXACTO calculado por el servidor y confirma. Al
// confirmar se actualiza la reserva, el calendario y el panel, y llega un
// correo a la familia y a César (lib/adicionales-reserva.js).
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BLOQUES_VITRINA, MARCA } from '../../../data/master';
import { filtrarBloques, sumarAdicional, materializarExtra, ITEMS } from '../../../data/reglas';
import { BloqueSection, FichaCarrusel, WaIcon, scrollBehavior } from '../../adicionales-grid';

const AZUL = '#1565C0';
const NARANJA = '#F97316';
const NAVY = '#0D1B3E';
const VERDE = '#16a34a';
const WA_BASE = `https://wa.me/${MARCA.whatsapp}`;

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const getPrecio = (item, cantNinos) => {
  if (item.gratis) return 0;
  if (item.precios) return item.precios[cantNinos] ?? item.precios.hasta10 ?? 0;
  return item.precio ?? 0;
};
function fmtFecha(fecha) {
  if (!fecha) return '';
  const s = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MENSAJE_ERROR = {
  item_no_compatible: 'Uno de los adicionales no corresponde para las edades o la cantidad de niños de tu celebración.',
  item_no_existe: 'Uno de los adicionales ya no está disponible.',
  comida_sin_unidades: 'Elige al menos una unidad de la comida que quieres sumar.',
  falta_tematica: 'Cuéntanos qué temática quieres para la decoración.',
  celebracion_cerrada: 'Tu celebración ya está muy cerca: para sumar algo, escríbenos por WhatsApp.',
  reserva_no_confirmada: 'Tu reserva todavía no está confirmada.',
  demasiadas_peticiones: 'Espera un momento y vuelve a intentarlo.',
};

export default function AdicionalesReservaPage() {
  return (
    <Suspense fallback={null}>
      <AdicionalesReserva />
    </Suspense>
  );
}

function AdicionalesReserva() {
  const params = useSearchParams();
  const id = (params.get('id') || '').trim().toUpperCase();
  const t = (params.get('t') || '').trim();
  const linkMiCelebracion = `/mi-celebracion?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;

  const [datos, setDatos] = useState(null);
  const [extras, setExtras] = useState([]);
  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [activeId, setActiveId] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [listo, setListo] = useState(null); // respuesta al confirmar
  const navRef = useRef(null);

  const cargar = async () => {
    try {
      const r = await fetch(`/api/mi-celebracion/adicionales?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`, { cache: 'no-store' });
      setDatos(await r.json());
    } catch {
      setDatos({ ok: false, motivo: 'sin_conexion' });
    }
  };
  useEffect(() => { cargar(); }, [id, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // Catálogo filtrado con las mismas reglas del armador; lo ya contratado
  // no se ofrece. Fuera las tarjetas informativas (incluidos, portadas):
  // acá solo se muestra lo que se puede sumar o cotizar.
  const bloques = useMemo(() => {
    if (!datos?.puede) return [];
    const contratados = (datos.contratados || []).map((c) => c.id);
    return filtrarBloques(BLOQUES_VITRINA, datos.ctx, contratados)
      .map((b) => ({ ...b, grupos: b.grupos.filter((g) => (g.itemIds && g.itemIds.length > 0) || g.badgeTipo === 'cotizar') }))
      .filter((b) => b.grupos.some((g) => g.itemIds && g.itemIds.length > 0))
      // Los incluidos sin costo ya se ven en Mi Celebración: acá, solo lo que suma.
      .filter((b) => b.grupos.some((g) => (g.itemIds || []).some((i) => !ITEMS[i]?.gratis)));
  }, [datos]);

  useEffect(() => {
    if (!bloques.length) return;
    setActiveId(bloques[0].id);
    const onScroll = () => {
      for (let i = bloques.length - 1; i >= 0; i--) {
        const el = document.getElementById(bloques[i].id);
        if (el && el.getBoundingClientRect().top <= 150) { setActiveId(bloques[i].id); return; }
      }
      setActiveId(bloques[0].id);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [bloques]);

  const cantNinos = datos?.cantNinos || 'hasta10';

  // Misma lógica de selección que el catálogo y el armador.
  const toggleItem = (item, grupo) => {
    setExtras((prev) => {
      if (prev.some((e) => e.id === item.id)) return prev.filter((e) => e.id !== item.id);
      if (grupo && !grupo.seleccionMultiple) {
        const idsGrupo = grupo.items.map((i) => i.id);
        return sumarAdicional(prev.filter((e) => !idsGrupo.includes(e.id)), item);
      }
      return sumarAdicional(prev, item);
    });
  };
  const setComida = (item, sabores) => {
    const pedido = materializarExtra({ id: item.id, sabores });
    setExtras((prev) => {
      if (!pedido) return prev.filter((e) => e.id !== item.id);
      return prev.some((e) => e.id === item.id) ? prev.map((e) => (e.id === item.id ? pedido : e)) : [...prev, pedido];
    });
  };
  const estimado = extras.reduce((s, e) => s + getPrecio(e, cantNinos), 0);

  if (!datos) return <Centro><p className="text-sm" style={{ color: '#6B7A99' }}>Cargando tu catálogo…</p></Centro>;

  if (!datos.ok) {
    return (
      <Centro>
        <p className="text-4xl mb-3">🔒</p>
        <h1 className="font-black text-xl mb-2" style={{ color: NAVY }}>No pudimos abrir este link</h1>
        <p className="text-sm mb-5" style={{ color: '#6B7A99' }}>Revisa que esté completo o pídenos uno nuevo por WhatsApp.</p>
        <BotonWa href={WA_BASE} texto="Escribir por WhatsApp" />
      </Centro>
    );
  }

  if (listo) {
    return (
      <Centro>
        <p className="text-5xl mb-3">🎉</p>
        <h1 className="font-black text-2xl mb-2" style={{ color: NAVY }}>¡Listo, ya está en la celebración de {datos.festejado}!</h1>
        <div className="text-left rounded-2xl p-4 my-5" style={{ background: '#FFFFFF', border: '1px solid rgba(21,101,192,0.12)' }}>
          {listo.agregados.map((a) => (
            <div key={a.id} className="flex justify-between gap-3 py-1 text-sm">
              <span style={{ color: '#374151' }}>{a.emoji ? `${a.emoji} ` : ''}{a.nombre}</span>
              <b style={{ color: NAVY }}>{a.precio > 0 ? clp(a.precio) : 'Incluido'}</b>
            </div>
          ))}
          <div className="mt-2 pt-2 text-sm" style={{ borderTop: '1px solid #E3ECFA' }}>
            <Fila k="Valor total" v={clp(listo.totalDespues)} />
            <Fila k="Pagado" v={clp(listo.pagado)} />
            <Fila k="Saldo pendiente" v={clp(listo.saldoDespues)} color={listo.saldoDespues > 0 ? '#C2410C' : VERDE} />
          </div>
        </div>
        <p className="text-sm mb-5" style={{ color: '#6B7A99' }}>Te enviamos el detalle a tu correo. Puedes pagar el saldo ahora o más adelante desde Mi Celebración.</p>
        {listo.saldoDespues > 0 && <BotonPagar id={id} t={t} saldo={listo.saldoDespues} />}
        <a href={linkMiCelebracion} className="block w-full font-black py-3.5 rounded-2xl mt-3" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
          Ver Mi Celebración
        </a>
      </Centro>
    );
  }

  if (!datos.puede) {
    const msg = datos.motivo === 'reserva_no_confirmada'
      ? 'Tu reserva todavía no está confirmada. Apenas pagues el anticipo podrás sumar adicionales desde acá.'
      : 'Para sumar adicionales a esta celebración, escríbenos por WhatsApp y lo dejamos listo contigo.';
    return (
      <Centro>
        <p className="text-4xl mb-3">💬</p>
        <h1 className="font-black text-xl mb-2" style={{ color: NAVY }}>Adicionales para {datos.festejado}</h1>
        <p className="text-sm mb-5" style={{ color: '#6B7A99' }}>{msg}</p>
        <BotonWa href={`${WA_BASE}?text=${encodeURIComponent(`Hola César! Quiero sumar adicionales a la celebración de ${datos.festejado} (${datos.codigo}).`)}`} texto="Escribir por WhatsApp" />
        <a href={linkMiCelebracion} className="block text-sm font-black mt-4" style={{ color: AZUL }}>Ver Mi Celebración</a>
      </Centro>
    );
  }

  const contratadosPagados = (datos.contratados || []).filter((c) => !c.gratis);

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFF', fontFamily: 'var(--font-nunito,Nunito,sans-serif)' }}>
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(21,101,192,0.1)' }}>
        <a href={linkMiCelebracion} className="text-sm font-black flex-shrink-0" style={{ color: AZUL }}>← Mi Celebración</a>
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo-alce.webp" alt="Alce Kids" className="w-7 h-7 rounded-xl object-cover flex-shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <span className="font-black text-sm truncate" style={{ color: AZUL }}>Adicionales</span>
        </div>
      </header>

      <div className="max-w-3xl md:max-w-7xl mx-auto px-4 md:px-10 pt-5">
        <div className="rounded-3xl p-5 mb-4" style={{ background: 'linear-gradient(135deg,#060F2E 0%,#0D2B6E 100%)' }}>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#29B9E8' }}>Tu celebración</p>
          <h1 className="font-black text-white text-2xl leading-tight">Suma adicionales para {datos.festejado} 🎈</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {fmtFecha(datos.fecha)} · {datos.horaInicio}–{datos.horaTermino} · {datos.codigo}
          </p>
          {contratadosPagados.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Ya tienes contratado:</p>
              <div className="flex flex-wrap gap-1.5">
                {contratadosPagados.map((c) => (
                  <span key={c.id} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                    ✓ {c.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5 mb-3 px-3.5 py-3 rounded-2xl"
          style={{ background: 'rgba(21,101,192,0.06)', border: '1px solid rgba(21,101,192,0.1)' }}>
          <span className="text-lg flex-shrink-0">👆</span>
          <span className="text-xs font-semibold leading-snug" style={{ color: AZUL }}>
            Solo ves lo que corresponde para tu celebración, con sus precios. Elige lo que quieras: antes de confirmar
            te mostramos el valor exacto y tu nuevo saldo.
          </span>
        </div>
      </div>

      <div className="sticky z-40 flex items-center" style={{ top: '53px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '2px solid rgba(21,101,192,0.07)' }}>
        <div ref={navRef} className="flex gap-1.5 px-3 py-2.5 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
          {bloques.map((b) => (
            <button key={b.id}
              onClick={() => { setActiveId(b.id); document.getElementById(b.id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black"
              style={activeId === b.id ? { background: AZUL, color: 'white' } : { background: 'rgba(21,101,192,0.07)', color: AZUL }}>
              {b.titulo}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl md:max-w-7xl mx-auto px-4 md:px-10 pt-5 pb-36">
        {bloques.map((bloque) => (
          <BloqueSection
            key={bloque.id}
            bloque={bloque}
            onTapGrupo={setGrupoAbierto}
            getSeleccionado={(grupo) => grupo.items.some((i) => extras.some((e) => e.id === i.id))}
            getAgregados={(grupo) => grupo.items.map((i) => extras.find((e) => e.id === i.id)).filter(Boolean)}
            onAddDirecto={toggleItem}
            cantNinos={cantNinos}
          />
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3"
        style={{ background: 'rgba(6,10,30,0.97)', backdropFilter: 'blur(14px)', boxShadow: '0 -4px 30px rgba(0,0,0,0.45)' }}>
        {extras.length > 0 ? (
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {extras.length} {extras.length === 1 ? 'adicional elegido' : 'adicionales elegidos'}
              </span>
              <div className="font-black text-2xl leading-tight" style={{ color: NARANJA }}>+{clp(estimado)}</div>
            </div>
            <button onClick={() => setRevisando(true)}
              className="text-white font-black py-3.5 px-5 rounded-2xl flex-shrink-0 active:scale-95"
              style={{ background: `linear-gradient(135deg,${NARANJA},#EA580C)` }}>
              Revisar y agregar →
            </button>
          </div>
        ) : (
          <p className="max-w-lg mx-auto text-center text-xs font-semibold py-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Toca una categoría y elige lo que quieras sumar 🎉
          </p>
        )}
      </div>

      {grupoAbierto && (
        <FichaCarrusel
          grupo={grupoAbierto}
          onCerrar={() => setGrupoAbierto(null)}
          onAdd={toggleItem}
          isAdded={(item) => extras.some((e) => e.id === item.id)}
          getExtra={(item) => extras.find((e) => e.id === item.id)}
          onComida={setComida}
          cantNinos={cantNinos}
        />
      )}

      {revisando && (
        <Revision id={id} t={t} extras={extras} datos={datos}
          onCerrar={() => setRevisando(false)}
          onListo={(r) => { setRevisando(false); setListo(r); window.scrollTo(0, 0); }} />
      )}
    </div>
  );
}

// Resumen antes de confirmar: el valor lo calcula el servidor (simulación),
// nunca la pantalla — incluye reemplazos de decoración y packs.
function Revision({ id, t, extras, datos, onCerrar, onListo }) {
  const [sim, setSim] = useState(null);
  // Si pasa de una temática a otra (Simple → Full), parte con la que ya tenía.
  const [tematica, setTematica] = useState(datos.tematica || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const pedido = extras.map((e) => (e.comida ? { id: e.id, sabores: e.sabores } : { id: e.id }));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    (async () => {
      try {
        const r = await fetch('/api/mi-celebracion/adicionales', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, t, pedido, confirmar: false }),
        });
        setSim(await r.json());
      } catch {
        setSim({ ok: false, motivo: 'sin_conexion' });
      }
    })();
    return () => { document.body.style.overflow = ''; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    if (sim?.requiereTematica && !tematica.trim()) return setError(MENSAJE_ERROR.falta_tematica);
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/mi-celebracion/adicionales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t, pedido, tematica, confirmar: true }),
      });
      const j = await r.json();
      if (j.ok) onListo(j);
      else setError(MENSAJE_ERROR[j.motivo] || j.errores?.[0] || 'No pudimos agregarlo. Inténtalo de nuevo o escríbenos por WhatsApp.');
    } catch {
      setError('No pudimos conectarnos. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" style={{ background: 'rgba(6,15,46,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !enviando) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Revisar adicionales"
        className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-lg" style={{ color: NAVY }}>Revisa antes de agregar</h2>
          <button onClick={onCerrar} disabled={enviando} aria-label="Cerrar" className="text-2xl leading-none" style={{ color: '#9CA9C4' }}>×</button>
        </div>

        {!sim && <p className="text-sm py-6 text-center" style={{ color: '#6B7A99' }}>Calculando el valor exacto…</p>}

        {sim && !sim.ok && (
          <p className="text-sm mb-3" style={{ color: '#DC2626' }}>
            {MENSAJE_ERROR[sim.motivo] || sim.errores?.[0] || 'No pudimos calcular el valor. Inténtalo de nuevo.'}
          </p>
        )}

        {sim?.ok && sim.sinCambios && (
          <p className="text-sm mb-3" style={{ color: '#6B7A99' }}>Todo lo que elegiste ya está en tu celebración.</p>
        )}

        {sim?.ok && !sim.sinCambios && (
          <>
            <div className="rounded-2xl p-4 mb-3" style={{ background: '#F8FAFF' }}>
              {sim.agregados.map((a) => (
                <div key={a.id} className="flex justify-between gap-3 py-1 text-sm">
                  <span style={{ color: '#374151' }}>{a.emoji ? `${a.emoji} ` : ''}{a.nombre}</span>
                  <b style={{ color: NAVY }} className="whitespace-nowrap">{a.precio > 0 ? clp(a.precio) : 'Incluido'}</b>
                </div>
              ))}
              {sim.reemplazados.length > 0 && (
                <p className="text-xs mt-2" style={{ color: '#9A3412' }}>
                  Reemplaza a lo que tenías: {sim.reemplazados.map((r) => r.nombre).join(', ')}.
                </p>
              )}
              {sim.avisos?.map((a) => <p key={a} className="text-xs mt-2" style={{ color: '#9A3412' }}>{a}</p>)}
            </div>

            {sim.requiereTematica && (
              <div className="rounded-2xl p-3 mb-3" style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                <label className="block text-xs font-black mb-1.5" style={{ color: '#9A3412' }}>¿Qué temática quieres para la decoración?</label>
                <input type="text" value={tematica} onChange={(e) => setTematica(e.target.value)} maxLength={80}
                  placeholder="Ej.: Minnie, dinosaurios, fútbol, Stitch…"
                  className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1.5px solid #FED7AA' }} />
                <p className="text-xs mt-1.5" style={{ color: '#9A3412' }}>
                  Sujeta a disponibilidad de materiales. Si necesitamos proponerte una alternativa, te contactamos.
                </p>
              </div>
            )}

            <div className="text-sm mb-4 px-1">
              <Fila k="Valor actual" v={clp(sim.totalAntes)} />
              <Fila k="Se suma" v={`+${clp(sim.diferencia)}`} color={NARANJA} />
              <Fila k="Nuevo valor total" v={clp(sim.totalDespues)} />
              <Fila k="Ya pagado" v={clp(sim.pagado)} />
              <Fila k="Nuevo saldo" v={clp(sim.saldoDespues)} color="#C2410C" />
            </div>
          </>
        )}

        {error && <p className="text-sm mb-3" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex flex-col gap-2">
          {sim?.ok && !sim.sinCambios && (
            <button onClick={confirmar} disabled={enviando}
              className="w-full font-black text-white py-3.5 rounded-2xl disabled:opacity-60"
              style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}>
              {enviando ? 'Agregando…' : 'Confirmar y agregar a mi celebración'}
            </button>
          )}
          <button onClick={onCerrar} disabled={enviando} className="w-full font-black py-3 rounded-2xl" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
            Seguir eligiendo
          </button>
        </div>
        <p className="text-xs text-center mt-3" style={{ color: '#9CA9C4' }}>
          Confirmar no cobra nada: el saldo lo pagas cuando quieras desde Mi Celebración.
        </p>
      </div>
    </div>
  );
}

function BotonPagar({ id, t, saldo }) {
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState('');
  const pagar = async () => {
    setPagando(true);
    setError('');
    try {
      const r = await fetch('/api/mi-celebracion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t }),
      });
      const j = await r.json();
      if (j.ok && j.checkoutUrl) { window.location.href = j.checkoutUrl; return; }
      setError('No pudimos abrir el pago. Puedes hacerlo desde Mi Celebración.');
    } catch {
      setError('No pudimos conectarnos. Inténtalo de nuevo.');
    }
    setPagando(false);
  };
  return (
    <>
      <button onClick={pagar} disabled={pagando}
        className="w-full font-black text-white py-4 rounded-2xl disabled:opacity-60"
        style={{ background: `linear-gradient(135deg,${NARANJA},#EA580C)` }}>
        {pagando ? 'Abriendo el pago…' : `Pagar el saldo ahora · ${clp(saldo)}`}
      </button>
      {error && <p className="text-sm mt-2" style={{ color: '#DC2626' }}>{error}</p>}
    </>
  );
}

function Centro({ children }) {
  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-10"
      style={{ fontFamily: 'var(--font-nunito,Nunito,sans-serif)', background: 'linear-gradient(180deg,#F3F9FF 0%,#FFFFFF 38%)' }}>
      <div className="max-w-md w-full text-center">
        <img src="/logo-alce.webp" alt="Alce Kids" className="h-16 w-auto mx-auto mb-6"
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        {children}
        <p className="text-xs font-bold mt-8" style={{ color: '#9CA9C4' }}>ALCE KIDS · Una experiencia de Celebra Sin Cesar</p>
      </div>
    </main>
  );
}

function Fila({ k, v, color }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1">
      <span style={{ color: '#6B7280' }}>{k}</span>
      <span className="font-black" style={{ color: color || '#374151' }}>{v}</span>
    </div>
  );
}

function BotonWa({ href, texto }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 w-full font-black text-white py-4 rounded-2xl"
      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
      <WaIcon /> {texto}
    </a>
  );
}
