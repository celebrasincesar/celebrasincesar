'use client';

// ══════════════════════════════════════════════════════════════════════
// MODAL DE PAGO — /armar
// ──────────────────────────────────────────────────────────────────────
// Lo mínimo antes de mostrar la confirmación previa al pago: nombre,
// email y teléfono. Nada de tarjeta ni datos bancarios — eso lo pide Flow
// en su propio checkout, nunca esta web (§1.8, §22).
//
// UN SOLO checkbox contractual en todo el recorrido (documento "NO
// autorizo todavía Production...", 15-sep-2026, §3): este modal YA NO
// pide aceptar los T&C — ese checkbox vivía acá de forma cosmética (no
// viajaba a onContinuar, nunca llegaba al servidor) y duplicaba, sin
// agregar evidencia real, el checkbox de <ConfirmarReserva> que sí es el
// que se envía en `aceptaTyc` y el único que el servidor exige. La
// aceptación contractual real vive únicamente ahí, inmediatamente antes
// del botón de pago.
//
// Este modal YA NO llama a /api/pagos/crear: solo junta los datos de
// contacto y se los entrega a <ConfirmarReserva> (confirmar-reserva.js),
// que es quien dispara esa llamada al tocar su propio CTA (documento
// "Nueva fase — experiencia de marca…", 08-sep-2026). La reserva se sigue
// creando exactamente igual que antes — solo cambió el momento.
// ══════════════════════════════════════════════════════════════════════

import { useState } from 'react';

const AZUL = '#1565C0';

export function ModalPago({ estado, onCerrar, onIrWhatsApp, onContinuar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');

  const puedeEnviar = nombre.trim().length > 1 && email.trim() && telefono.trim();

  const continuar = () => {
    if (!puedeEnviar) return;
    onContinuar({ nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(6,15,46,0.55)' }}
      onClick={onCerrar}>
      <div className="bg-white w-full lg:max-w-md rounded-t-3xl lg:rounded-3xl p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-start justify-between mb-1">
          <h2 className="font-black text-xl" style={{ color: AZUL }}>Reservar y pagar</h2>
          <button onClick={onCerrar} className="text-gray-400 text-2xl leading-none px-1" aria-label="Cerrar">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Con estos datos armamos el resumen de tu celebración antes de pagar.
        </p>

        <div className="space-y-3 mb-6">
          <Campo label="Tu nombre" value={nombre} onChange={setNombre} placeholder="Nombre y apellido" autoComplete="name" />
          <Campo label="Email" value={email} onChange={setEmail} placeholder="tucorreo@ejemplo.com" type="email" autoComplete="email" />
          <Campo label="Teléfono" value={telefono} onChange={setTelefono} placeholder="+56 9 1234 5678" type="tel" autoComplete="tel" />
        </div>

        <button onClick={continuar} disabled={!puedeEnviar}
          className="w-full font-black text-white py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}>
          Continuar
        </button>

        <button onClick={onIrWhatsApp} className="w-full text-center text-sm font-bold mt-4" style={{ color: '#6B7280' }}>
          Prefiero coordinar por WhatsApp
        </button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text', autoComplete }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none"
        style={{ border: '2px solid #E5E7EB' }}
      />
    </label>
  );
}
