'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MAX_NINOS, contextoDesde, packPara, tramoMayoresDesdeCantidad,
  tramoInvitadosDesdeCantidad,
} from '../../data/reglas';
import { DECLARACIONES } from '../../data/master';

// El enlace a los T&C se muestra clickeable sin alterar ni una letra del texto
// legal: se parte la cadena por la URL y se envuelve solo esa parte.
const URL_TYC = 'celebrasincesar.cl/terminos';
function TextoLegal({ texto }) {
  const i = texto.indexOf(URL_TYC);
  if (i === -1) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <a href="/terminos" target="_blank" rel="noopener noreferrer"
        className="underline font-bold" style={{ color: '#1565C0' }}>{URL_TYC}</a>
      {texto.slice(i + URL_TYC.length)}
    </>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={null}>
      <Confirmacion />
    </Suspense>
  );
}

function Confirmacion() {
  const [form, setForm] = useState({
    nombre: '',
    fechaCelebracion: '',
    totalNinos: '',    // total de niños que asistirán (incluye a los mayores de 6)
    ninosMayores: '',  // de ese total, cuántos superan los 6 años
    alergias: '',
    adultoResponsable: '',
    declaraSupervision: false,
    declaraReglamento: false,
    declaraMayores: false, // solo se exige si asisten niños mayores de 6
    reconoceCambio: false, // se exige solo si el cambio de cantidad altera el pack
    acepta: false,
    autorizaFotos: false, // opt-in — imagen de menores requiere consentimiento expreso
  });
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ── De dónde sale la reserva que se está confirmando ────────────────────
  // 1º  /confirmacion?id=CSC-… → se busca en la cotización central del servidor.
  //     Así funciona aunque el papá abra el link en otro teléfono.
  // 2º  Si no hay id (o el servidor aún no está configurado), se usa la copia
  //     local del navegador, que sigue existiendo como respaldo.
  const params = useSearchParams();
  const idBuscado = (params.get('id') || '').trim().toUpperCase();
  const tokenBuscado = (params.get('t') || '').trim();
  const [cotizacion, setCotizacion] = useState(null);
  const [origen, setOrigen] = useState('cargando'); // 'central' | 'local' | 'ninguna'

  useEffect(() => {
    let vivo = true;
    const local = () => {
      try {
        const arr = JSON.parse(localStorage.getItem('alce-cotizaciones') || '[]');
        if (Array.isArray(arr) && arr[0]) {
          if (vivo) { setCotizacion(arr[0]); setOrigen('local'); }
          return true;
        }
      } catch {}
      if (vivo) setOrigen('ninguna');
      return false;
    };

    // Sin llave no se pide nada al servidor: se usa la copia del navegador.
    if (!idBuscado || !tokenBuscado) { local(); return () => { vivo = false; }; }

    fetch(`/api/cotizacion?id=${encodeURIComponent(idBuscado)}&t=${encodeURIComponent(tokenBuscado)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (j.ok && j.cotizacion) {
          const c = j.cotizacion;
          setCotizacion({
            id: c.id,
            festejado: { nombre: c.festejado, edad: Number(c.edad) || null },
            // packId es el identificador real del pack, no su nombre: comparar
            // nombres daba siempre "cambió el pack" (§P0-20).
            pack: c.packNombre
              ? { nombre: c.packNombre, varianteId: c.varianteId || null, packId: c.packId || null }
              : null,
            invitados: { etiqueta: c.invitados, etiquetaMayores: c.mayores },
          });
          setOrigen('central');
          // Precarga lo que ya sabemos: el papá solo confirma o corrige.
          setForm((p) => ({ ...p, fechaCelebracion: p.fechaCelebracion }));
        } else {
          local();
        }
      })
      .catch(() => { if (vivo) local(); });
    return () => { vivo = false; };
  }, [idBuscado, tokenBuscado]);

  // Se pregunta el TOTAL y cuántos de ellos son mayores de 6. Los de hasta 6
  // se derivan: así nunca hay dos números que puedan contradecirse (§P0-21).
  const totalFinal   = Number(form.totalNinos) || 0;
  const mayoresFinal = Number(form.ninosMayores) || 0;
  const hasta6Final  = Math.max(0, totalFinal - mayoresFinal);
  const tramoFinal   = tramoMayoresDesdeCantidad(mayoresFinal);
  const hayMayores   = mayoresFinal > 0;

  // Errores de cantidad que hay que atajar antes de dar por confirmada la
  // celebración: no se puede declarar más mayores que niños ni pasar el tope.
  const errorCantidad =
    form.totalNinos === '' ? ''
    : totalFinal < 1
      ? 'Indica cuántos niños asistirán en total (al menos 1).'
    : totalFinal > MAX_NINOS
      ? `Con ${totalFinal} niños superamos nuestro máximo de ${MAX_NINOS}. Escríbenos y lo vemos caso a caso.`
    : mayoresFinal > totalFinal
      ? 'Los niños mayores de 6 son parte del total: no pueden ser más que la cantidad total de niños.'
      : '';

  // Las declaraciones que corresponden a esta celebración concreta.
  const declaraciones = DECLARACIONES.filter(
    (d) => d.condicional !== 'mayores' || hayMayores
  );

  // Qué pack corresponde con los números FINALES (mismo motor que el wizard)
  const packFinal = useMemo(
    () => packPara(contextoDesde({
      tramoInvitados: totalFinal ? tramoInvitadosDesdeCantidad(totalFinal) : null,
      totalNinos: totalFinal,
      tramoMayores: tramoFinal,
      mayoresAprox: mayoresFinal,
      edadNino: cotizacion?.festejado?.edad,
    })),
    [totalFinal, tramoFinal, mayoresFinal, cotizacion]
  );

  // ¿El pack reservado dejó de corresponder? (ej: reservó con 2 mayores → Pack 1,
  // y en la confirmación declara 6 → ahora corresponde Pack 2)
  const packReservadoId = cotizacion?.pack?.packId || null;
  const packAhoraId     = packFinal?.pack.id || null;
  // Filas antiguas de la planilla no guardaban packId. Sin ese dato no se
  // puede afirmar que el pack cambió, y avisar en falso es peor que callar.
  const packConocido = !cotizacion?.pack || !!packReservadoId;
  const packCambio = !!cotizacion && totalFinal > 0 && packConocido && (
    packReservadoId !== packAhoraId ||
    (cotizacion.pack && packFinal && cotizacion.pack.varianteId !== packFinal.variante.id)
  );

  const handleEnviar = () => {
    if (!form.nombre.trim()) { setError('Por favor ingresa tu nombre.'); return; }
    if (!form.fechaCelebracion) { setError('Por favor indica la fecha.'); return; }
    if (!form.totalNinos || isNaN(Number(form.totalNinos))) { setError('Indica cuántos niños asistirán en total.'); return; }
    if (errorCantidad) { setError(errorCantidad); return; }
    if (!form.adultoResponsable.trim()) { setError('Indica quién será el adulto responsable durante el evento (puedes ser tú).'); return; }
    const faltan = declaraciones.filter((d) => !form[d.id]);
    if (faltan.length) {
      setError(`Para confirmar necesitamos las ${declaraciones.length} declaraciones marcadas — son el ok formal de tu celebración.`);
      return;
    }
    // Si la cantidad cambió tanto que ya corresponde otra configuración, no se
    // cierra en silencio: el papá tiene que reconocerlo antes de enviar (§BB).
    if (packCambio && !form.reconoceCambio) {
      setError('La cantidad de invitados cambió. Marca la casilla para que ajustemos la configuración antes del evento.');
      return;
    }
    setError('');

    const mayores = `\n• De ellos, mayores de 6 años: ${mayoresFinal}`;
    const referencia = cotizacion?.id ? `\n• N° de cotización: ${cotizacion.id}` : '';
    // Si el pack de mayores dejó de corresponder, viaja en el mensaje para que
    // César lo ajuste antes del evento (todavía no es automático).
    const packLinea = packCambio
      ? `\n\n⚠️ REVISAR ENTRETENCIÓN MAYORES: reservado ${cotizacion?.pack?.nombre || 'sin pack'}` +
        ` → con ${mayoresFinal} mayores ahora corresponde ${packFinal ? packFinal.pack.nombre : 'ningún pack'}.`
      : '';
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
      `• Niños en total: ${totalFinal} (hasta 6 años: ${hasta6Final})` +
      mayores +
      alergias +
      referencia +
      `\n• Adulto responsable presente durante el evento: ${form.adultoResponsable.trim()}` +
      packLinea +
      (packCambio && form.reconoceCambio
        ? `\n• Reconozco el cambio de cantidad y que ajustaremos la configuración antes del evento.`
        : '') +
      `\n\n` +
      `DECLARO EXPRESAMENTE:\n` +
      declaraciones.map((d) => `✔ ${d.titulo}: ${d.texto}`).join('\n') + `\n\n` +
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
          <img src="/logo-alce.webp" alt="Alce Kids"
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
          <img src="/logo-alce.webp" alt="Alce Kids"
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

          {/* Asistentes — se pregunta el total y cuántos son mayores de 6 */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              ¿Cuántos niños asistirán <span style={{ color: '#1565C0' }}>en total</span>?
            </label>
            <p className="text-xs text-gray-400 mb-2">Confirma la cantidad final — puede haber cambiado desde la reserva</p>
            <input
              type="number"
              min="1" max={MAX_NINOS}
              value={form.totalNinos}
              onChange={(e) => set('totalNinos', e.target.value)}
              placeholder="Ej: 15"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
          </div>

          {/* De ese total, cuántos superan los 6 años */}
          <div>
            <label className="block text-sm font-black text-gray-600 mb-1">
              De ellos, ¿cuántos son <span style={{ color: '#1565C0' }}>mayores de 6 años</span>?
            </label>
            <p className="text-xs text-gray-400 mb-2 leading-relaxed">
              Los juegos permanentes del jardín están diseñados para niños de 0 a 6 años. Tu celebración
              contempla una configuración de entretención para los mayores informados al reservar.
              Confirma aquí la cantidad final; si cambió, ajustaremos la configuración antes del evento.
            </p>
            <input
              type="number"
              min="0" max={MAX_NINOS}
              value={form.ninosMayores}
              onChange={(e) => set('ninosMayores', e.target.value)}
              placeholder="0 si no hay"
              className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none border-2 border-gray-200 focus:border-blue-400 transition-colors"
              style={{ color: '#1e293b' }}
            />
            {totalFinal > 0 && !errorCantidad && (
              <p className="text-xs font-bold mt-2" style={{ color: '#1565C0' }}>
                {totalFinal} niños en total · {hasta6Final} de hasta 6 años · {mayoresFinal} mayores de 6
              </p>
            )}
            {errorCantidad && (
              <p className="text-xs font-bold mt-2 text-red-500">{errorCantidad}</p>
            )}
          </div>

          {/* ── Su pack de mayores ya no calza con los números finales ──
               No es un reproche: es avisarle a tiempo para que los niños
               grandes tengan lo que corresponde el día del evento. ── */}
          {packCambio && (
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', border: '2px solid #F97316' }}>
              <p className="font-black text-sm" style={{ color: '#9A3412' }}>
                🎉 Cambió la cantidad de niños grandes
              </p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#B45309' }}>
                {packAhoraId
                  ? <>Al reservar quedamos con <strong>{cotizacion.pack?.nombre || 'sin pack para mayores'}</strong> y
                     ahora con {mayoresFinal} {mayoresFinal === 1 ? 'niño mayor' : 'niños mayores'} corresponde{' '}
                     <strong>{packFinal.pack.nombre}</strong>. Lo revisamos contigo por WhatsApp y ajustamos
                     la entretención — sin sorpresas el día del cumpleaños.</>
                  : <>Al reservar quedamos con <strong>{cotizacion.pack?.nombre}</strong> y ahora no vienen niños
                     mayores de 6. Lo ajustamos por WhatsApp.</>}
              </p>
              <label className="flex items-start gap-3 cursor-pointer mt-3 pt-3"
                style={{ borderTop: '1px solid rgba(249,115,22,0.25)' }}>
                <input
                  type="checkbox"
                  checked={form.reconoceCambio}
                  onChange={(e) => set('reconoceCambio', e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs leading-relaxed" style={{ color: '#9A3412' }}>
                  <strong>Entiendo que la cantidad de invitados cambió</strong> y que necesitamos ajustar
                  la configuración para mantener la celebración adecuada. Lo coordinamos antes del evento.
                </span>
              </label>
            </div>
          )}

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
              🔒 Esta información se utiliza únicamente para coordinar y cuidar la celebración.
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
               El texto sale de DECLARACIONES (data/master.js): lo que se lee
               aquí, lo que se marca y lo que viaja por WhatsApp son la misma
               cadena, letra por letra. */}
          <div className="rounded-2xl p-4 space-y-3.5"
            style={{ background: '#F8FAFF', border: '1.5px solid rgba(21,101,192,0.15)' }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#1565C0' }}>
              Tu ok formal — {declaraciones.length} declaraciones
            </p>

            {declaraciones.map((d) => {
              const esMayores = d.condicional === 'mayores';
              return (
                <label
                  key={d.id}
                  className={`flex items-start gap-3 cursor-pointer${esMayores ? ' rounded-xl p-2.5 -m-2.5' : ''}`}
                  style={esMayores ? { background: 'rgba(245,158,11,0.07)' } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={!!form[d.id]}
                    onChange={(e) => set(d.id, e.target.checked)}
                    className={`mt-1 w-5 h-5 cursor-pointer flex-shrink-0 ${esMayores ? 'accent-amber-500' : 'accent-blue-600'}`}
                  />
                  <span className="text-sm text-gray-500 leading-relaxed">
                    <strong className="text-gray-700">{d.titulo}:</strong>{' '}
                    <TextoLegal texto={d.texto} />
                  </span>
                </label>
              );
            })}
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
