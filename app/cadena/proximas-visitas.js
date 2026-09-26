'use client';

// ══════════════════════════════════════════════════════════════════════
// PRÓXIMAS VISITAS — /cadena (documento "FASE 3A — VISITAS AUTOGESTIONADAS
// — IMPLEMENTAR BLOQUE B", 22-sep-2026, §9-§11)
// ──────────────────────────────────────────────────────────────────────
// Solo AGENDADA desde hoy hacia adelante, ya filtrado por el servidor
// (visitasProximas(), lib/visitas.js) — este componente solo agrupa por
// fecha y pinta. Las visitas coincidentes (mismo día+hora) se muestran
// como filas normales, nunca como un conflicto (§9).
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const AZUL = '#1565C0';

const fmtFechaGrupo = (f) => {
  const d = new Date(`${f}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const waLink = (visita) => {
  const texto = `¡Hola ${visita.nombreAdulto}! Te escribo por tu visita agendada a Alce Kids.`;
  return `https://wa.me/${(visita.whatsapp || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(texto)}`;
};

export function ProximasVisitas() {
  const [visitas, setVisitas] = useState(null); // null = cargando
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/cadena/visitas', { cache: 'no-store' });
      const j = await r.json();
      setVisitas(j?.ok ? j.visitas : []);
    } catch {
      setVisitas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const grupos = [];
  if (visitas) {
    const porFecha = new Map();
    for (const v of visitas) {
      if (!porFecha.has(v.fecha)) porFecha.set(v.fecha, []);
      porFecha.get(v.fecha).push(v);
    }
    for (const [fecha, filas] of porFecha) grupos.push({ fecha, filas });
  }

  return (
    <section className="bg-white rounded-3xl p-5 mb-8" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      <h2 className="font-black text-lg mb-1" style={{ color: AZUL }}>👋 Próximas visitas</h2>
      <p className="text-xs text-gray-400 mb-4">Visitas autoagendadas desde la web. Coincidir en el mismo horario es normal.</p>

      {cargando && visitas === null && (
        <p className="text-sm text-gray-400 text-center py-6">Cargando visitas…</p>
      )}

      {visitas && visitas.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No hay visitas agendadas próximamente.</p>
      )}

      {grupos.length > 0 && (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.fecha}>
              <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#9CA9C4' }}>
                {fmtFechaGrupo(g.fecha)}
              </p>
              <div className="space-y-2">
                {g.filas.map((v) => <FilaVisita key={v.id} visita={v} onCambio={cargar} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FilaVisita({ visita: v, onCambio }) {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const marcarRealizada = async () => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitaId: v.id }),
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
    <div className="rounded-2xl p-3.5" style={{ background: 'rgba(21,101,192,0.04)', border: '1px solid rgba(21,101,192,0.1)' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>
            {v.hora} · {v.nombreAdulto}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {v.whatsapp} · {v.email}
            {v.nombreFestejado && <> · {v.nombreFestejado}{v.edadFestejado ? ` (${v.edadFestejado} años)` : ''}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={waLink(v)} target="_blank" rel="noopener noreferrer"
            className="text-xs font-black px-3 py-2 rounded-xl text-white whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
            WhatsApp
          </a>
          <button onClick={marcarRealizada} disabled={enviando}
            className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap"
            style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
            Marcar realizada
          </button>
        </div>
      </div>
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}
