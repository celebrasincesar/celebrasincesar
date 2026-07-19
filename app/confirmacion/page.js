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
    adultoResponsable: '',
    declaraSupervision: false,
    declaraReglamento: false,
    declaraMayores: false, // solo se exige si asisten niños mayores de 6
    acepta: false,
    autorizaFotos: false, // opt-in — imagen de menores requiere consentimiento expreso
  });
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleEnviar = () => {
    if (!form.nombre.trim()) { setError('Por favor ingresa tu nombre.'); return; }
    if (!form.fechaCelebracion) { setError('Por favor indica la fecha.'); return; }
    if (!form.ninosHasta6 || isNaN(Number(form.ninosHasta6))) { setError('Indica cuántos niños de hasta 6 años asistirán.'); return; }
    if (!form.adultoResponsable.trim()) { setError('Indica quién será el adulto responsable durante el evento (puedes ser tú).'); return; }
    if (!form.declaraSupervision || !form.declaraReglamento || !form.acepta) {
      setError('Para confirmar necesitamos las tres declaraciones marcadas — son el ok formal de tu celebración.');
      return;
    }
    const hayMayores = Number(form.ninosMayores) > 0;
    if (hayMayores && !form.declaraMayores) {
      setError('Como asistirán niños mayores de 6 años, necesitamos también esa declaración marcada.');
      return;
    }
    setError('');

    const mayores = form.ninosMayores ? `\n• Niños mayores de 6 años: ${form.ninosMayores}` : '';
    const alergias = form.alergias.trim() ? `\n• Alergias / necesidades especiales: ${form.alergias.trim()}` : '';

    const fecha = new Date(form.fechaCelebracion + 'T12:00:00');
    const fechaTexto = fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

    // Las declaraciones viajan dentro del mensaje: queda constancia escrita y
    // fechada, enviada desde el teléfono del propio apoderado.
    const msg = encodeURIComponent(
      `✅ Confirmación de celebración — Alce Kids\n\n` +
      `Hola! Confirmo los datos para nuestra celebración:\n\n` +
      `• Apoderado contratante: ${form.nombre.trim()}\n` +
      `• Fecha: ${fechaTexto}\n` +
      `• Niños (hasta 6 años): ${form.ninosHasta6}` +
      mayores +
      alergias +
      `\n• Adulto responsable presente durante el evento: ${form.adultoResponsable.trim()}\n\n` +
      `DECLARO EXPRESAMENTE:\n` +
      `✔ Los menores estarán bajo supervisión activa y permanente de sus padres, tutores o adultos responsables durante todo el evento.\n` +
      `✔ Conozco el reglamento del recinto y me comprometo a que los juegos e instalaciones se usen de forma correcta, conforme a su diseño y al rango de edad indicado (0 a 6 años).\n` +
      (hayMayores
        ? `✔ ME HAGO RESPONSABLE de que los niños mayores de 6 años que asistan NO usen los juegos ni la infraestructura del jardín (piscina de pelotas, tobogán y estructuras, diseñados para 0 a 6 años). Yo me encargo de que jueguen solo con lo apto para su edad y de mantenerlos bajo mi supervisión directa.\n`
        : '') +
      `✔ Los datos entregados son veraces y acepto los Términos y Condiciones de Alce Kids (celebrasincesar.cl/terminos), que declaro haber leído.\n\n` +
      `📸 Fotos con fines promocionales: ${form.autorizaFotos ? 'SÍ autorizo (revocable cuando quiera)' : 'NO autorizo'}`
    );

    window.open(`https://wa.me/56944356955?text=${msg}`, '_blank');
    setEnviado(true);
  };

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg,#F0F7FF,#EFF6FF)' }}>
        <div className="max-w-md w-full text-center">
          <img src="/logo-celebra.webp" alt="Celebra Sin Cesar"
            className="h-14 w-auto mx-auto mb-5"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
          <img src="/logo-celebra.webp" alt="Celebra Sin Cesar"
            className="h-16 w-auto mx-auto mb-5"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="inline-flex items-center gap-2 font-bold text-xs px-4 py-1.5 rounded-full mb-3"
            style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.18)' }}>
            🎂 Último paso
          </div>
          <h1 className="text-2xl md:text-3xl font-black" style={{ color: '#1565C0' }}>
            Confirma tu celebración
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Menos de 2 minutos · tu ok formal antes de celebrar
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
              Los juegos del jardín están diseñados para niños de hasta 6 años, así que los mayores
              acompañan pero no los usan — es por la seguridad de todos. Para que disfruten igual,
              puedes sumar inflables aptos hasta 12 años, juegos deportivos o animación desde el catálogo.
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
            <p className="text-xs text-gray-300 mt-1.5">
              🔒 Esta información de salud se usa solo para cuidar a los asistentes durante el
              evento, no se comparte y se elimina después de la celebración.
            </p>
          </div>

          {/* Adulto responsable del evento */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              ¿Quién será el <span style={{ color: '#1565C0' }}>adulto responsable</span> presente durante todo el evento?
            </label>
            <p className="text-xs text-gray-400 mb-2">Puedes ser tú mismo/a — escribe el nombre completo</p>
            <input
              type="text"
              value={form.adultoResponsable}
              onChange={(e) => set('adultoResponsable', e.target.value)}
              placeholder="Ej: Carolina Martínez (yo misma)"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* ── Declaraciones expresas — el ok formal ──
               Checkboxes específicos (no genéricos): mucho mayor valor probatorio.
               Viajan dentro del mensaje de WhatsApp con fecha y desde el teléfono
               del apoderado. */}
          <div className="rounded-2xl p-4 space-y-3.5"
            style={{ background: '#F8FAFF', border: '1.5px solid rgba(21,101,192,0.15)' }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#1565C0' }}>
              Tu ok formal — {Number(form.ninosMayores) > 0 ? '4' : '3'} declaraciones
            </p>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.declaraSupervision}
                onChange={(e) => set('declaraSupervision', e.target.checked)}
                className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Supervisión activa:</strong> los niños estarán
                acompañados y supervisados en todo momento por sus padres, tutores o adultos
                responsables. Alce Kids no presta servicio de guardería.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.declaraReglamento}
                onChange={(e) => set('declaraReglamento', e.target.checked)}
                className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Uso correcto:</strong> conocemos el reglamento
                del recinto y los juegos se usarán como corresponde, según su diseño y el rango
                de edad indicado (0 a 6 años).
              </span>
            </label>

            {/* Declaración condicional — solo si asisten mayores de 6 años */}
            {Number(form.ninosMayores) > 0 && (
              <label className="flex items-start gap-3 cursor-pointer rounded-xl p-2.5 -m-2.5"
                style={{ background: 'rgba(245,158,11,0.07)' }}>
                <input
                  type="checkbox"
                  checked={form.declaraMayores}
                  onChange={(e) => set('declaraMayores', e.target.checked)}
                  className="mt-1 w-5 h-5 accent-amber-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-sm text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">Mayores de 6 años — quedan a mi cargo:</strong>{' '}
                  los juegos del jardín (piscina de pelotas, tobogán y estructuras) están hechos
                  para 0 a 6 años. <strong className="text-gray-700">Yo me encargo</strong> de que
                  los niños mayores no los usen y jueguen solo con lo apto para su edad. Para que
                  lo pasen increíble puedo sumar inflables (hasta 12 años), deportivos o animación.
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acepta}
                onChange={(e) => set('acepta', e.target.checked)}
                className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-gray-500 leading-relaxed">
                <strong className="text-gray-700">Términos y veracidad:</strong> los datos que
                entregué son veraces y leí y acepto los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer"
                  className="underline font-bold" style={{ color: '#1565C0' }}>
                  Términos y Condiciones
                </a>{' '}
                de Alce Kids, incluyendo el reglamento del recinto.
              </span>
            </label>
          </div>

          {/* Autorización de fotos — OPCIONAL y opt-in (imagen de menores) */}
          <label className="flex items-start gap-3 cursor-pointer rounded-2xl p-4"
            style={{ background: 'rgba(249,115,22,0.05)', border: '1.5px solid rgba(249,115,22,0.18)' }}>
            <input
              type="checkbox"
              checked={form.autorizaFotos}
              onChange={(e) => set('autorizaFotos', e.target.checked)}
              className="mt-1 w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-gray-500 leading-relaxed">
              <strong className="text-gray-700">📸 Opcional:</strong> autorizo a Alce Kids a usar
              fotos de nuestra celebración en sus redes y sitio web. Aplica solo a mi imagen y la
              de los niños a mi cargo, y puedo revocarla cuando quiera.
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
