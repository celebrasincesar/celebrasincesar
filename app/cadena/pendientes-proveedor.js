'use client';

// ══════════════════════════════════════════════════════════════════════
// PENDIENTES CON PROVEEDOR — /cadena (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 2", 21-sep-2026, §1-§5)
// ──────────────────────────────────────────────────────────────────────
// Solo pendientes activos (PENDIENTE/REVISAR_DESPUES/NO_DISPONIBLE), ya
// ordenados 🔴→🟠→🟡 por el servidor (pendientesActivos(),
// lib/pendientes-proveedor.js) — este componente solo pinta y dispara las
// acciones contra POST /api/cadena/pendientes-proveedor.
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const AZUL = '#1565C0';

const COLOR_NIVEL = { rojo: '#DC2626', naranja: '#F97316', amarillo: '#CA8A04' };
const FONDO_NIVEL = { rojo: 'rgba(220,38,38,0.06)', naranja: 'rgba(249,115,22,0.06)', amarillo: 'rgba(202,138,4,0.06)' };
const BORDE_NIVEL = { rojo: 'rgba(220,38,38,0.2)', naranja: 'rgba(249,115,22,0.2)', amarillo: 'rgba(202,138,4,0.2)' };

const ETIQUETA_TIPO = { decoracion_tematica: '🎨 Decoración temática', animacion: '🎭 Animación' };
const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente de confirmar', REVISAR_DESPUES: 'Revisar más adelante',
  NO_DISPONIBLE: 'No disponible', CONFIRMADO: 'Confirmado',
};

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
};
const fmtFechaCorta = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
};
const hoyISO = () => new Date().toISOString().slice(0, 10);

export function PendientesProveedor() {
  const [pendientes, setPendientes] = useState(null); // null = cargando
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/cadena/pendientes-proveedor', { cache: 'no-store' });
      const j = await r.json();
      setPendientes(j?.ok ? j.pendientes : []);
    } catch {
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando && pendientes === null) {
    return (
      <Seccion>
        <p className="text-sm text-gray-400 text-center py-6">Cargando pendientes…</p>
      </Seccion>
    );
  }

  return (
    <Seccion>
      {(!pendientes || pendientes.length === 0) ? (
        <p className="text-sm text-gray-400 text-center py-6">No hay pendientes con proveedor activos. 🎉</p>
      ) : (
        <div className="space-y-3">
          {pendientes.map((p) => <TarjetaPendiente key={p.id} pendiente={p} onCambio={cargar} />)}
        </div>
      )}
    </Seccion>
  );
}

function Seccion({ children }) {
  return (
    <section className="bg-white rounded-3xl p-5 mb-8" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      <h2 className="font-black text-lg mb-1" style={{ color: AZUL }}>🔧 Pendientes con proveedor</h2>
      <p className="text-xs text-gray-400 mb-4">Decoración temática y animación que dependen de confirmar con un tercero.</p>
      {children}
    </section>
  );
}

function TarjetaPendiente({ pendiente: p, onCambio }) {
  const [enviando, setEnviando] = useState(false);
  const [fechaRevision, setFechaRevision] = useState(p.proximaRevision || hoyISO());
  const [aviso, setAviso] = useState('');

  const nivel = p.urgencia?.nivel || 'amarillo';

  const actualizar = async (estado, proximaRevision) => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/pendientes-proveedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendienteId: p.id, estado, proximaRevision: proximaRevision || null }),
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
    <div className="rounded-2xl p-4" style={{ background: FONDO_NIVEL[nivel], border: `1px solid ${BORDE_NIVEL[nivel]}` }}>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
        <div>
          <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>{ETIQUETA_TIPO[p.tipo] || p.tipo}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {p.festejado} · {fmtFecha(p.fechaEvento)} · {p.turno} · <span className="text-gray-400">{p.codigo}</span>
          </p>
          {p.detalle && <p className="text-xs font-bold mt-1" style={{ color: '#0D1B3E' }}>Tema: {p.detalle}</p>}
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: `${COLOR_NIVEL[nivel]}18`, color: COLOR_NIVEL[nivel] }}>
          {p.urgencia?.emoji} {ETIQUETA_ESTADO[p.estado] || p.estado}
        </span>
      </div>

      {p.estado === 'REVISAR_DESPUES' && p.proximaRevision && (
        <p className="text-xs text-gray-500 mt-1">Próxima revisión: <b>{fmtFechaCorta(p.proximaRevision)}</b></p>
      )}
      {p.estado === 'NO_DISPONIBLE' && (
        <p className="text-xs font-bold mt-1" style={{ color: '#DC2626' }}>⚠ Contactar cliente / buscar alternativa</p>
      )}

      <div className="flex gap-2 flex-wrap items-end mt-3 pt-3" style={{ borderTop: `1px dashed ${BORDE_NIVEL[nivel]}` }}>
        <button onClick={() => actualizar('CONFIRMADO', null)} disabled={enviando}
          className="text-xs font-black px-3 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: '#16a34a' }}>
          Confirmar
        </button>

        <label className="text-xs flex items-end gap-1.5">
          <span className="flex flex-col">
            <span className="text-[11px] text-gray-500 mb-0.5">{p.estado === 'REVISAR_DESPUES' ? 'Cambiar fecha' : 'Revisar más adelante'}</span>
            <input type="date" value={fechaRevision} onChange={(e) => setFechaRevision(e.target.value)}
              className="text-xs px-2.5 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }} />
          </span>
          <button onClick={() => actualizar('REVISAR_DESPUES', fechaRevision)} disabled={enviando || !fechaRevision}
            className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
            style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
            {p.estado === 'REVISAR_DESPUES' ? 'Guardar fecha' : 'Revisar más adelante'}
          </button>
        </label>

        <button onClick={() => actualizar('NO_DISPONIBLE', null)} disabled={enviando}
          className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
          No disponible
        </button>
      </div>
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}
