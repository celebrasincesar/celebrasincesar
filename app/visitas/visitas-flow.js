'use client';

// ══════════════════════════════════════════════════════════════════════
// FLUJO /visitas  ·  app/visitas/visitas-flow.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3A — VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A"
// (22-sep-2026, §9, §10, §13, §24): Fecha → Hora → Tus datos → Confirmar.
// No se pide cantidad de niños, sector, adicionales, dirección ni T&C —
// solo lo mínimo que pide el documento. Nunca se muestra "cupos
// restantes" ni "ocupado": los horarios se ofrecen igual sin importar
// cuántas otras visitas existan ahí (§24).
// ══════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NEGOCIO } from '../../data/master';

const WA = (texto) =>
  `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(texto)}`;

function fmtFechaCorta(fechaStr) {
  const d = new Date(`${fechaStr}T12:00:00`);
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const campoBase = 'mt-1 w-full rounded-xl px-3.5 py-2.5 text-sm outline-none';
const campoEstilo = { border: '1.5px solid rgba(21,101,192,0.15)' };

export default function VisitasFlow() {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState(null);
  const [datos, setDatos] = useState({
    nombreAdulto: '', whatsapp: '', email: '', nombreFestejado: '', edadFestejado: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  useEffect(() => {
    fetch('/api/visitas')
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { setError('No pudimos cargar los horarios disponibles.'); return; }
        setSlots(d.slots || []);
      })
      .catch(() => setError('No pudimos cargar los horarios disponibles.'));
  }, []);

  async function confirmar(e) {
    e.preventDefault();
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, hora, ...datos }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErrorEnvio((d.errores && d.errores[0]) || 'No pudimos agendar tu visita. Intenta de nuevo.');
        setEnviando(false);
        return;
      }
      setConfirmacion(d.visita);
    } catch {
      setErrorEnvio('No pudimos agendar tu visita. Intenta de nuevo.');
    }
    setEnviando(false);
  }

  if (confirmacion) {
    const link = `/visitas/gestionar?id=${confirmacion.codigo}&t=${confirmacion.t}`;
    const mensajeWa = `¡Hola! Agendé una visita a Alce Kids para ${fmtFechaCorta(confirmacion.fecha)} a las ${confirmacion.hora} y tengo una consulta.`;
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#F8FAFF' }}>
        <div className="max-w-md w-full bg-white rounded-2xl p-6 text-center" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-2xl font-black" style={{ color: '#0D1B3E' }}>Visita agendada ✓</h1>
          <p className="mt-3 font-bold" style={{ color: '#1565C0' }}>{fmtFechaCorta(confirmacion.fecha)}</p>
          <p className="text-lg font-black" style={{ color: '#0D1B3E' }}>{confirmacion.hora}</p>
          <p className="text-gray-500 text-sm mt-2">{NEGOCIO.direccion.completa}</p>
          <a href={NEGOCIO.mapa} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-bold underline" style={{ color: '#1565C0' }}>
            Ver ubicación
          </a>

          <div className="mt-6 space-y-3">
            <Link href={link}
              className="block w-full text-center text-white font-black py-3.5 rounded-2xl transition-transform hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg,#1565C0,#0D47A1)' }}>
              Gestionar mi visita
            </Link>
            <a href={WA(mensajeWa)} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center font-bold py-3 rounded-2xl"
              style={{ color: '#16a34a', border: '1.5px solid rgba(34,197,94,0.3)' }}>
              ¿Necesitas ayuda? Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: '#F8FAFF' }}>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(21,101,192,0.1)' }}>
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-alce.webp" alt="" className="w-7 h-7 rounded-xl object-cover" />
          <span className="font-black text-sm" style={{ color: '#1565C0' }}>Alce Kids</span>
        </Link>
      </header>

      <div className="max-w-md mx-auto px-4 py-8 pb-16">
        <div className="text-4xl mb-3">🎈</div>
        <h1 className="text-3xl font-black leading-tight" style={{ color: '#0D1B3E' }}>Conoce Alce Kids</h1>
        <p className="text-gray-500 mt-2">Agenda una visita para conocer nuestro espacio antes de reservar.</p>

        {error && <p className="mt-6 text-sm font-bold" style={{ color: '#EA580C' }}>{error}</p>}

        {!error && !slots && <p className="mt-6 text-gray-500 text-sm">Cargando horarios disponibles…</p>}

        {slots && slots.length === 0 && (
          <div className="mt-6 bg-white rounded-2xl p-5" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
            <p className="text-gray-600 text-sm">No hay horarios de autoagendamiento disponibles por ahora.</p>
            <a href={WA('¡Hola César! Me gustaría coordinar una visita a Alce Kids.')} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center text-white font-black py-3.5 rounded-2xl mt-4"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              Coordinar por WhatsApp
            </a>
          </div>
        )}

        {slots && slots.length > 0 && (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-gray-500 mt-8 mb-3">1. Elige el día</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s.fecha} type="button"
                  onClick={() => { setFecha(s.fecha); setHora(null); }}
                  className="text-sm font-bold px-4 py-2.5 rounded-xl transition-opacity"
                  style={fecha === s.fecha
                    ? { background: '#1565C0', color: 'white' }
                    : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                  {fmtFechaCorta(s.fecha)}
                </button>
              ))}
            </div>

            {fecha && (
              <>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mt-8 mb-3">2. Elige la hora</p>
                <div className="flex flex-wrap gap-2">
                  {(slots.find((s) => s.fecha === fecha)?.horarios || []).map((h) => (
                    <button key={h} type="button" onClick={() => setHora(h)}
                      className="text-sm font-bold px-4 py-2.5 rounded-xl"
                      style={hora === h
                        ? { background: '#1565C0', color: 'white' }
                        : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                      {h}
                    </button>
                  ))}
                </div>
              </>
            )}

            {fecha && hora && (
              <form onSubmit={confirmar} className="mt-8 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">3. Tus datos</p>

                <div>
                  <label className="text-xs font-bold text-gray-500">Nombre del adulto *</label>
                  <input required value={datos.nombreAdulto}
                    onChange={(e) => setDatos({ ...datos, nombreAdulto: e.target.value })}
                    className={campoBase} style={campoEstilo} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">WhatsApp *</label>
                  <input required value={datos.whatsapp}
                    onChange={(e) => setDatos({ ...datos, whatsapp: e.target.value })}
                    placeholder="+56 9 1234 5678"
                    className={campoBase} style={campoEstilo} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Email *</label>
                  <input required type="email" value={datos.email}
                    onChange={(e) => setDatos({ ...datos, email: e.target.value })}
                    className={campoBase} style={campoEstilo} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Nombre del festejado (opcional)</label>
                  <input value={datos.nombreFestejado}
                    onChange={(e) => setDatos({ ...datos, nombreFestejado: e.target.value })}
                    className={campoBase} style={campoEstilo} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Edad que cumplirá (opcional)</label>
                  <input value={datos.edadFestejado}
                    onChange={(e) => setDatos({ ...datos, edadFestejado: e.target.value })}
                    className={campoBase} style={campoEstilo} />
                </div>

                {errorEnvio && <p className="text-sm font-bold" style={{ color: '#dc2626' }}>{errorEnvio}</p>}

                <button type="submit" disabled={enviando}
                  className="block w-full text-center text-white font-black py-4 rounded-2xl transition-transform hover:scale-[1.01] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
                  {enviando ? 'Agendando…' : 'Confirmar visita'}
                </button>
              </form>
            )}
          </>
        )}

        <div className="mt-12 pt-6" style={{ borderTop: '1px solid rgba(21,101,192,0.12)' }}>
          <p className="text-sm text-gray-500 mb-3">¿Prefieres coordinar directamente?</p>
          <a href={WA('¡Hola César! Me gustaría coordinar una visita a Alce Kids.')} target="_blank" rel="noopener noreferrer"
            className="inline-block text-sm font-bold px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#166534' }}>
            Coordinar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
