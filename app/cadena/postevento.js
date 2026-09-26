'use client';

// ══════════════════════════════════════════════════════════════════════
// POSTEVENTO — /cadena (documento "FASE 3B — POSTEVENTO — IMPLEMENTAR
// BLOQUE A", 24-sep-2026, §12-§14)
// ──────────────────────────────────────────────────────────────────────
// Tareas CREADA sin GESTIONADA, ya filtradas por el servidor. Sin enlace
// directo de reseña configurado solo se muestra el aviso: ni mensaje, ni
// WhatsApp, ni "Marcar gestionado". Abrir WhatsApp / copiar NO gestionan:
// solo el botón explícito crea el evento.
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const AZUL = '#1565C0';

const fmtFecha = (f) => {
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
};

const cuando = (dias) => (dias === 1 ? 'celebrado ayer' : `celebrado hace ${dias} días`);

export function Postevento() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/cadena/postevento', { cache: 'no-store' });
      const j = await r.json();
      setDatos(j?.ok ? j : { linkConfigurado: false, tareas: [] });
    } catch {
      setDatos({ linkConfigurado: false, tareas: [] });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <section className="bg-white rounded-3xl p-5 mb-8" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      <h2 className="font-black text-lg mb-1" style={{ color: AZUL }}>🎉 Postevento</h2>
      <p className="text-xs text-gray-400 mb-4">Agradecer y pedir reseña al día siguiente de cada celebración.</p>

      {cargando && datos === null && <p className="text-sm text-gray-400 text-center py-6">Cargando postevento…</p>}

      {datos && datos.tareas.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No hay tareas de postevento pendientes.</p>
      )}

      {datos && datos.tareas.length > 0 && (
        <div className="space-y-2.5">
          {datos.tareas.map((t) => (
            <TarjetaPostevento key={t.reservaId} tarea={t} linkConfigurado={datos.linkConfigurado} onCambio={cargar} />
          ))}
        </div>
      )}
    </section>
  );
}

function TarjetaPostevento({ tarea: t, linkConfigurado, onCambio }) {
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(t.mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };

  const marcarGestionado = async () => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/postevento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: t.reservaId }),
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

  const telefono = String(t.telefono || '').replace(/[^\d]/g, '');

  return (
    <div className="rounded-2xl p-3.5" style={{ background: 'rgba(21,101,192,0.04)', border: '1px solid rgba(21,101,192,0.12)' }}>
      <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>🎉 {t.festejado} · {cuando(t.diasDesdeEvento)}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {fmtFecha(t.fechaEvento)} · {t.codigo}{t.telefono ? ` · ${t.telefono}` : ''}
      </p>

      {!linkConfigurado && (
        <p className="text-xs font-bold mt-2" style={{ color: '#DC2626' }}>
          Falta configurar enlace directo de reseña Google.
        </p>
      )}

      {linkConfigurado && t.mensaje && (
        <div className="flex gap-2 flex-wrap items-center mt-2.5 pt-2.5" style={{ borderTop: '1px dashed rgba(21,101,192,0.2)' }}>
          <a href={`https://wa.me/${telefono}?text=${encodeURIComponent(t.mensaje)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-black px-3 py-2 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
            Abrir WhatsApp
          </a>
          <button onClick={copiar}
            className="text-xs font-black px-3 py-2 rounded-xl transition-all active:scale-95"
            style={copiado ? { background: '#22c55e', color: 'white' } : { background: 'rgba(21,101,192,0.08)', color: AZUL }}>
            {copiado ? '✓ Copiado' : '📋 Copiar mensaje'}
          </button>
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
