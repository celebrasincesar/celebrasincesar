'use client';

// ══════════════════════════════════════════════════════════════════════
// ACCIONES PRÓXIMAS — /cadena (documento "FASE 2B — IMPLEMENTAR BLOQUE 3",
// 22-sep-2026, §16)
// ──────────────────────────────────────────────────────────────────────
// Lista unificada T-21/T-14/T-7/T-4/T-2/T-1, ya ordenada por el servidor
// (accionesProximas(), lib/ciclo-previo.js). Las entradas T-21/T-14/T-2
// son informativas (la acción real vive en "Pendientes con proveedor" o
// en el detalle de la reserva); T-7/T-4/T-1 traen CTA de WhatsApp.
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const AZUL = '#1565C0';
const COLOR_NIVEL = { rojo: '#DC2626', naranja: '#F97316', amarillo: '#CA8A04' };
const FONDO_NIVEL = { rojo: 'rgba(220,38,38,0.06)', naranja: 'rgba(249,115,22,0.06)', amarillo: 'rgba(202,138,4,0.06)' };
const BORDE_NIVEL = { rojo: 'rgba(220,38,38,0.2)', naranja: 'rgba(249,115,22,0.2)', amarillo: 'rgba(202,138,4,0.2)' };

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
};

export function AccionesProximas() {
  const [acciones, setAcciones] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/cadena/acciones-proximas', { cache: 'no-store' });
      const j = await r.json();
      setAcciones(j?.ok ? j.acciones : []);
    } catch {
      setAcciones([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando && acciones === null) {
    return (
      <Seccion>
        <p className="text-sm text-gray-400 text-center py-6">Cargando acciones próximas…</p>
      </Seccion>
    );
  }

  return (
    <Seccion>
      {(!acciones || acciones.length === 0) ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin acciones próximas por ahora. 🎉</p>
      ) : (
        <div className="space-y-2.5">
          {acciones.map((a, i) => <TarjetaAccion key={i} accion={a} onCambio={cargar} />)}
        </div>
      )}
    </Seccion>
  );
}

function Seccion({ children }) {
  return (
    <section className="bg-white rounded-3xl p-5 mb-8" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      <h2 className="font-black text-lg mb-1" style={{ color: AZUL }}>📆 Acciones próximas</h2>
      <p className="text-xs text-gray-400 mb-4">Todo lo que se acerca, de un vistazo — decoración, animación y mensajes preparados.</p>
      {children}
    </section>
  );
}

const ETIQUETA_TIPO = { T21: '🎨', T14: '🎭', T7: '💬', T4: '💬', T2: '⚠', T1: '💬' };

function TarjetaAccion({ accion: a, onCambio }) {
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(a.mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };

  const marcarGestionado = async () => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/acciones-proximas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: a.reservaId, milestone: a.milestone }),
      });
      const j = await res.json();
      if (j.ok) onCambio();
      else setAviso(`No se pudo actualizar (${j.motivo || 'error'}).`);
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl p-3.5" style={{ background: FONDO_NIVEL[a.nivel], border: `1px solid ${BORDE_NIVEL[a.nivel]}` }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>
            {a.emoji} {ETIQUETA_TIPO[a.tipo]} {a.titulo}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {a.festejado} · {a.codigo} · {fmtFecha(a.fechaEvento)} · faltan {a.diasRestantes} día{a.diasRestantes === 1 ? '' : 's'}
          </p>
          {a.detalle && <p className="text-xs mt-1" style={{ color: COLOR_NIVEL[a.nivel] }}>{a.detalle}</p>}
        </div>
      </div>

      {a.accionable && (
        <div className="flex gap-2 flex-wrap items-center mt-2.5 pt-2.5" style={{ borderTop: `1px dashed ${BORDE_NIVEL[a.nivel]}` }}>
          <button onClick={copiar}
            className="text-xs font-black px-3 py-2 rounded-xl transition-all active:scale-95"
            style={copiado ? { background: '#22c55e', color: 'white' } : { background: 'rgba(21,101,192,0.08)', color: AZUL }}>
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(a.mensaje)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-black px-3 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
            WhatsApp →
          </a>
          <button onClick={marcarGestionado} disabled={enviando}
            className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
            style={{ background: 'rgba(13,27,62,0.06)', color: '#0D1B3E' }}>
            {enviando ? 'Guardando…' : '✓ Marcar gestionado'}
          </button>
        </div>
      )}
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}
