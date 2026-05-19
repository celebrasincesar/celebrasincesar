'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ConfirmacionPage() {
  const [form, setForm] = useState({
    nombre: '',
    fechaCelebracion: '',
    ninosHasta6: '',
    ninosMayores: '',
    alergias: '',
    acepta: false,
  });
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleEnviar = () => {
    if (!form.nombre.trim()) { setError('Por favor ingresa tu nombre.'); return; }
    if (!form.fechaCelebracion) { setError('Por favor indica la fecha.'); return; }
    if (!form.ninosHasta6 || isNaN(Number(form.ninosHasta6))) { setError('Indica cuántos niños de hasta 6 años asistirán.'); return; }
    if (!form.acepta) { setError('Debes aceptar el reglamento para continuar.'); return; }
    setError('');

    const mayores = form.ninosMayores ? `\n• Niños mayores de 6 años: ${form.ninosMayores}` : '';
    const alergias = form.alergias.trim() ? `\n• Alergias / necesidades especiales: ${form.alergias.trim()}` : '';

    const fecha = new Date(form.fechaCelebracion + 'T12:00:00');
    const fechaTexto = fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    const msg = encodeURIComponent(
      `✅ Confirmación de celebración — Alce Kids\n\n` +
      `Hola! Confirmo los datos para nuestra celebración:\n\n` +
      `• Apoderado: ${form.nombre.trim()}\n` +
      `• Fecha: ${fechaTexto}\n` +
      `• Niños (hasta 6 años): ${form.ninosHasta6}` +
      mayores +
      alergias +
      `\n\n✔ Declaro haber leído y aceptado los Términos y Condiciones de Alce Kids (celebrasincesar.cl/terminos).`
    );

    window.open(`https://wa.me/56944356955?text=${msg}`, '_blank');
    setEnviado(true);
  };

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg,#F0F7FF,#EFF6FF)' }}>
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-black mb-2" style={{ color: '#1565C0' }}>
            ¡Todo confirmado!
          </h1>
          <p className="text-gray-500 mb-6">
            Se abrió WhatsApp con el resumen. Envíalo y listo — te respondemos
            a la brevedad para dejarlo todo coordinado.
          </p>
          <Link href="/"
            className="inline-block font-black text-white py-3 px-8 rounded-2xl"
            style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)' }}>
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10"
      style={{ fontFamily: 'var(--font-nunito,Nunito,sans-serif)', background: 'linear-gradient(135deg,#F0F7FF,#EFF6FF)' }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎂</div>
          <h1 className="text-2xl font-black" style={{ color: '#1565C0' }}>
            Confirmación de celebración
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Solo 3 preguntas · menos de 1 minuto
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-7 space-y-6"
          style={{ boxShadow: '0 8px 32px rgba(21,101,192,0.10)' }}>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-2">
              Tu nombre completo
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej: Carolina Martínez"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-2">
              Fecha de la celebración
            </label>
            <input
              type="date"
              value={form.fechaCelebracion}
              onChange={(e) => set('fechaCelebracion', e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* Asistentes */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              ¿Cuántos niños de <span style={{ color: '#1565C0' }}>hasta 6 años</span> asistirán?
            </label>
            <p className="text-xs text-gray-400 mb-2">Confirma la cantidad final — puede haber cambiado desde la reserva</p>
            <input
              type="number"
              min="1" max="40"
              value={form.ninosHasta6}
              onChange={(e) => set('ninosHasta6', e.target.value)}
              placeholder="Ej: 12"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* Niños mayores (opcional) */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              ¿Vendrán niños mayores de 6 años? <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Los juegos están diseñados para niños de hasta 6 años — los mayores pueden asistir, pero su acceso a la infraestructura será limitado. Para que disfruten igual, te recomendamos contratar adicionales como animación, inflables o juegos deportivos pensados para ellos.
            </p>
            <input
              type="number"
              min="0"
              value={form.ninosMayores}
              onChange={(e) => set('ninosMayores', e.target.value)}
              placeholder="0 si no hay"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* Alergias (opcional) */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              ¿Alergias o algo que debamos saber? <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={form.alergias}
              onChange={(e) => set('alergias', e.target.value)}
              placeholder="Ej: Sofía es alérgica al maní · la abuela usa silla de ruedas"
              rows={2}
              className="w-full rounded-2xl px-4 py-3 text-sm font-medium outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors resize-none"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* Aceptación T&C */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.acepta}
              onChange={(e) => set('acepta', e.target.checked)}
              className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-500 leading-relaxed">
              Leí y acepto los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer"
                className="underline font-bold" style={{ color: '#1565C0' }}>
                Términos y Condiciones
              </a>{' '}
              de Alce Kids, incluyendo el reglamento del recinto.
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-sm font-bold text-red-500 text-center">{error}</p>
          )}

          {/* Botón */}
          <button
            onClick={handleEnviar}
            className="w-full text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-100"
            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
          >
            💬 Confirmar por WhatsApp
          </button>

          <p className="text-xs text-center text-gray-300">
            Se abrirá WhatsApp con el resumen listo para enviar
          </p>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-sm font-bold hover:underline" style={{ color: '#1565C0' }}>
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
