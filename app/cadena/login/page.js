'use client';

// Puerta del panel interno. Solo pide la contraseña; no muestra ningún dato
// de reservas hasta que la sesión existe.

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const sinConfigurar = params.get('config') === '1';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e?.preventDefault();
    if (!password || cargando) return;
    setCargando(true);
    setError('');
    try {
      const r = await fetch('/api/cadena/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (j.ok) {
        router.replace('/cadena');
        router.refresh();
      } else {
        setError(j.error || 'No pudimos validar la contraseña.');
      }
    } catch {
      setError('No pudimos conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#060F2E,#0D1B3E)' }}>
      <form onSubmit={entrar} className="w-full max-w-sm rounded-3xl p-7"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(41,185,232,0.2)' }}>
        <h1 className="font-black text-xl mb-1" style={{ color: '#29B9E8' }}>🔒 La Cadena</h1>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Panel interno de Celebra Sin Cesar.
        </p>

        {sinConfigurar && (
          <div className="rounded-2xl p-4 mb-5 text-sm leading-relaxed"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', color: '#FDBA74' }}>
            El panel todavía no tiene contraseña configurada. Hay que definir
            <span className="font-black"> CADENA_PASSWORD</span> y
            <span className="font-black"> CADENA_SECRET</span> en las variables de entorno
            (.env.local y Vercel) para poder entrar.
          </div>
        )}

        <label className="block text-xs font-black mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-2xl px-4 py-3 font-semibold outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
        />

        {error && (
          <p className="text-sm mt-3 font-bold" style={{ color: '#FCA5A5' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!password || cargando}
          className="w-full mt-5 font-black py-3.5 rounded-2xl text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)' }}
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

export default function CadenaLogin() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  );
}
