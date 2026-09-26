'use client';

import Link from 'next/link';

// Botones del final de Términos:
//  • "Volver" replica el botón atrás del celular (history.back) → vuelve a la
//    página desde donde llegaste (el formulario), preservando sus datos.
//  • "Quiero contratar adicionales" lleva al último paso del wizard (adicionales),
//    vía el parámetro ?ir=adicionales que page.js interpreta.
export default function VolverButtons() {
  const volver = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/confirmacion'; // fallback si no hay historial previo
  };

  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch">
      <button
        onClick={volver}
        className="inline-flex items-center justify-center gap-2 font-black py-3 px-8 rounded-2xl transition-all hover:scale-[1.03]"
        style={{
          background: '#fff',
          color: '#1565C0',
          border: '2px solid #1565C0',
        }}
      >
        ← Volver al formulario
      </button>
      <Link
        href="/armar?ir=adicionales"
        className="inline-flex items-center justify-center gap-2 font-black py-3 px-8 rounded-2xl text-white transition-all hover:scale-[1.03]"
        style={{
          background: 'linear-gradient(135deg,#F97316,#EA580C)',
          boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
        }}
      >
        Quiero contratar adicionales →
      </Link>
    </div>
  );
}
