'use client';

// ══════════════════════════════════════════════════════════════════════
// GESTIONAR MI VISITA  ·  app/visitas/gestionar/gestionar-visita.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B"
// (22-sep-2026, §3, §4, §6, §7): estado + fecha/hora/dirección, Reagendar
// visita, Cancelar visita (con confirmación simple), WhatsApp secundario.
// Sin cuenta, sin password — mismo token seguro del enlace (Bloque A).
// ══════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { NEGOCIO } from '../../../data/master';

function fmtFechaLarga(fechaStr) {
  const d = new Date(`${fechaStr}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtFechaCorta(fechaStr) {
  const d = new Date(`${fechaStr}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WA = (texto) =>
  `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(texto)}`;

const ETIQUETA_ESTADO = {
  AGENDADA: { texto: 'Agendada ✓', color: '#16a34a' },
  CANCELADA: { texto: 'Cancelada', color: '#dc2626' },
  REALIZADA: { texto: 'Realizada', color: '#1565C0' },
};

export default function GestionarVisita() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const t = params.get('t') || '';

  const [visita, setVisita] = useState(null);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('resumen'); // resumen | cancelar | reagendar

  const cargar = () => {
    if (!id || !t) { setError('Este enlace está incompleto.'); return; }
    fetch(`/api/visitas/gestionar?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setError('No pudimos encontrar esta visita.');
        else { setVisita(d.visita); setError(null); }
      })
      .catch(() => setError('No pudimos encontrar esta visita.'));
  };

  useEffect(cargar, [id, t]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#F8FAFF' }}>
      <div className="max-w-md w-full bg-white rounded-2xl p-6" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
        {error && <p className="text-sm font-bold text-center" style={{ color: '#dc2626' }}>{error}</p>}
        {!error && !visita && <p className="text-gray-400 text-sm text-center">Cargando…</p>}

        {visita && vista === 'resumen' && (
          <Resumen visita={visita} id={id} t={t} onReagendar={() => setVista('reagendar')} onCancelar={() => setVista('cancelar')} />
        )}
        {visita && vista === 'cancelar' && (
          <Cancelar visita={visita} id={id} t={t} onVolver={() => setVista('resumen')} onCancelada={() => { setVista('resumen'); cargar(); }} />
        )}
        {visita && vista === 'reagendar' && (
          <Reagendar visita={visita} id={id} t={t} onVolver={() => setVista('resumen')} onReagendada={() => { setVista('resumen'); cargar(); }} />
        )}
      </div>
    </main>
  );
}

function Resumen({ visita, id, t, onReagendar, onCancelar }) {
  const estado = ETIQUETA_ESTADO[visita.estado] || { texto: visita.estado, color: '#0D1B3E' };
  const puedeGestionar = visita.estado === 'AGENDADA';

  return (
    <div className="text-center">
      <div className="text-4xl mb-3">🎈</div>
      <h1 className="text-xl font-black" style={{ color: '#0D1B3E' }}>Tu visita a Alce Kids</h1>
      <p className="mt-2 text-sm font-black" style={{ color: estado.color }}>{estado.texto}</p>

      <p className="mt-3 font-bold" style={{ color: '#1565C0' }}>{fmtFechaLarga(visita.fecha)}</p>
      <p className="text-lg font-black" style={{ color: '#0D1B3E' }}>{visita.hora}</p>
      <p className="text-gray-500 text-sm mt-2">{NEGOCIO.direccion.completa}</p>
      {visita.nombreFestejado && <p className="text-gray-400 text-xs mt-3">Para {visita.nombreFestejado}</p>}

      <a href={NEGOCIO.mapa} target="_blank" rel="noopener noreferrer"
        className="inline-block mt-4 text-sm font-bold underline" style={{ color: '#1565C0' }}>
        Ver ubicación
      </a>

      {puedeGestionar && (
        <div className="mt-6 space-y-3">
          <button onClick={onReagendar}
            className="block w-full text-center font-black py-3 rounded-2xl"
            style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
            Reagendar visita
          </button>
          <button onClick={onCancelar}
            className="block w-full text-center font-black py-3 rounded-2xl"
            style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626' }}>
            Cancelar visita
          </button>
        </div>
      )}

      {visita.estado === 'CANCELADA' && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-3">Si quieres venir otro día, puedes agendar una nueva visita cuando quieras.</p>
          <Link href="/visitas"
            className="block w-full text-center text-white font-black py-3.5 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            Agendar otra visita
          </Link>
        </div>
      )}

      <a href={WA(`¡Hola! Tengo una consulta sobre mi visita (${visita.codigo}).`)}
        target="_blank" rel="noopener noreferrer"
        className="block w-full text-center font-bold py-3 rounded-2xl mt-6"
        style={{ color: '#16a34a', border: '1.5px solid rgba(34,197,94,0.3)' }}>
        ¿Necesitas ayuda? Escríbenos por WhatsApp
      </a>
    </div>
  );
}

function Cancelar({ visita, id, t, onVolver, onCancelada }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/visitas/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t }),
      });
      const d = await res.json();
      if (!d.ok) { setError('No pudimos cancelar tu visita. Intenta de nuevo.'); setEnviando(false); return; }
      setHecho(true);
    } catch {
      setError('No pudimos cancelar tu visita. Intenta de nuevo.');
    }
    setEnviando(false);
  };

  if (hecho) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-xl font-black" style={{ color: '#0D1B3E' }}>Visita cancelada</h1>
        <p className="text-sm text-gray-500 mt-3">Si quieres venir otro día, puedes agendar una nueva visita cuando quieras.</p>
        <div className="mt-6 space-y-3">
          <Link href="/visitas"
            className="block w-full text-center text-white font-black py-3.5 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
            Agendar otra visita
          </Link>
          <button onClick={onCancelada} className="block w-full text-center font-bold py-3 rounded-2xl"
            style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
            Volver al resumen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-black text-lg" style={{ color: '#0D1B3E' }}>
        ¿Quieres cancelar tu visita del {fmtFechaCorta(visita.fecha)} a las {visita.hora}?
      </p>
      {error && <p className="text-sm font-bold mt-3" style={{ color: '#dc2626' }}>{error}</p>}
      <div className="mt-6 space-y-3">
        <button onClick={confirmar} disabled={enviando}
          className="block w-full text-center text-white font-black py-3.5 rounded-2xl disabled:opacity-60"
          style={{ background: '#dc2626' }}>
          {enviando ? 'Cancelando…' : 'Sí, cancelar visita'}
        </button>
        <button onClick={onVolver} disabled={enviando}
          className="block w-full text-center font-bold py-3 rounded-2xl disabled:opacity-60"
          style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
          Volver
        </button>
      </div>
    </div>
  );
}

function Reagendar({ visita, id, t, onVolver, onReagendada }) {
  const [slots, setSlots] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/visitas')
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setErrorCarga('No pudimos cargar los horarios disponibles.'); return; }
        setSlots(d.slots || []);
      })
      .catch(() => setErrorCarga('No pudimos cargar los horarios disponibles.'));
  }, []);

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/visitas/reagendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t, fecha, hora }),
      });
      const d = await res.json();
      if (!d.ok) { setError((d.errores && d.errores[0]) || 'No pudimos reagendar tu visita. Intenta de nuevo.'); setEnviando(false); return; }
      onReagendada();
    } catch {
      setError('No pudimos reagendar tu visita. Intenta de nuevo.');
    }
    setEnviando(false);
  };

  return (
    <div>
      <p className="font-black text-lg text-center mb-1" style={{ color: '#0D1B3E' }}>Reagendar visita</p>
      <p className="text-xs text-gray-400 text-center mb-4">
        Actualmente: {fmtFechaCorta(visita.fecha)} · {visita.hora}
      </p>

      {errorCarga && <p className="text-sm font-bold text-center" style={{ color: '#EA580C' }}>{errorCarga}</p>}
      {!errorCarga && !slots && <p className="text-gray-400 text-sm text-center">Cargando horarios…</p>}

      {slots && slots.length > 0 && (
        <>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Elige el nuevo día</p>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s.fecha} type="button"
                onClick={() => { setFecha(s.fecha); setHora(null); }}
                className="text-sm font-bold px-3.5 py-2 rounded-xl"
                style={fecha === s.fecha ? { background: '#1565C0', color: 'white' } : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                {fmtFechaCorta(s.fecha)}
              </button>
            ))}
          </div>

          {fecha && (
            <>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mt-5 mb-2">Elige la nueva hora</p>
              <div className="flex flex-wrap gap-2">
                {(slots.find((s) => s.fecha === fecha)?.horarios || []).map((h) => (
                  <button key={h} type="button" onClick={() => setHora(h)}
                    className="text-sm font-bold px-3.5 py-2 rounded-xl"
                    style={hora === h ? { background: '#1565C0', color: 'white' } : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                    {h}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-sm font-bold mt-4" style={{ color: '#dc2626' }}>{error}</p>}

          <div className="mt-6 space-y-3">
            <button onClick={confirmar} disabled={!fecha || !hora || enviando}
              className="block w-full text-center text-white font-black py-3.5 rounded-2xl disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
              {enviando ? 'Reagendando…' : 'Confirmar nuevo horario'}
            </button>
            <button onClick={onVolver} disabled={enviando}
              className="block w-full text-center font-bold py-3 rounded-2xl disabled:opacity-60"
              style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
              Volver
            </button>
          </div>
        </>
      )}
    </div>
  );
}
