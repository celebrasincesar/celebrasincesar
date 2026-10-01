'use client';

// ══════════════════════════════════════════════════════════════════════
// CONFIRMACIÓN PREVIA AL PAGO — /armar
// ──────────────────────────────────────────────────────────────────────
// Documento "Nueva fase — experiencia de marca y marketing…" (08-sep-2026),
// mockup v2 aprobado. Se muestra DESPUÉS de que ModalPago recoge nombre/
// email/teléfono/TyC y ANTES de tocar Flow: es la única pieza nueva del
// flujo. La creación de la reserva y de la orden de pago siguen siendo
// EXACTAMENTE la misma llamada a /api/pagos/crear que ya existía —lo único
// que cambia es CUÁNDO se dispara (al tocar el CTA de esta pantalla, no al
// cerrar el modal). Cero cambios en firma HMAC, callbacks, HOLD, Postgres
// ni Calendar (§4 del documento).
//
// Todos los datos que se muestran salen de `estado` (la configuración real
// del armador) y de `total`/`anticipo`/`ctx`, que wizard.js ya calculaba
// para el resumen lateral — nada se inventa ni se vuelve a pedir.
// ══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { clp } from '../celebra-ui';
import { horarioEfectivo, labelInvitados, labelMayores } from '../../data/reglas';
import { NEGOCIO, MARCA } from '../../data/master';
import { EVENTOS, track, propsCelebracion } from '../../data/analytics';

const AZUL = '#1565C0';
const NARANJA = '#F97316';
const NAVY = '#0D1B3E';

const MOTIVOS = {
  turno_ocupado: 'Justo en este momento otra familia está reservando este mismo horario. Elige otra fecha o turno.',
  configuracion_invalida: 'Faltan datos de tu celebración. Vuelve atrás y revisa que todo esté completo.',
  total_invalido: 'No pudimos calcular el valor de tu celebración. Escríbenos por WhatsApp y lo resolvemos.',
  monto_invalido: 'No pudimos calcular el valor de tu celebración. Escríbenos por WhatsApp y lo resolvemos.',
  falta_nombre: 'Ingresa tu nombre.',
  email_invalido: 'El correo no parece válido.',
  telefono_invalido: 'El teléfono no parece válido — inclúyelo con o sin el +56.',
  sin_tyc: 'Falta aceptar los Términos y Condiciones.',
  tyc_no_disponible: 'No pudimos verificar los Términos y Condiciones vigentes. Escríbenos por WhatsApp y coordinamos igual.',
  pagos_no_disponibles: 'El pago por la web no está disponible en este momento. Escríbenos por WhatsApp y coordinamos igual.',
  demasiados_intentos: 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.',
  error_flow: 'No pudimos abrir la pasarela de pago. Inténtalo de nuevo en un momento.',
  error_servidor: 'Algo no funcionó de nuestro lado. Inténtalo de nuevo en un momento.',
};

const fmtFecha = (d) => {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function ConfirmarReserva({ estado, total, anticipo, cliente, onCerrar, onIrWhatsApp }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Hallazgo real de Fase 1B (documento "Instrucción Maestra — Continuación",
  // 14-sep-2026, §12): hasta ahora NO existía ningún checkbox de T&C acá —
  // `aceptaTyc` se enviaba hardcodeado en `true`, sin que el papá marcara
  // nada. Se agrega el checkbox real, con el aviso de retracto en el mismo
  // lugar/momento que el precio (Decreto 52) — ver nota de despliegue en el
  // informe: esto activa recién cuando también se publique la nueva versión
  // de T&C con la cláusula de retracto, nunca antes ni por separado.
  const [aceptaTyc, setAceptaTyc] = useState(false);
  // `enviando` (estado de React) recién se refleja en el DOM en el próximo
  // render — dos clics en el MISMO tick siguen viendo el `enviando` viejo
  // (closure) y ambos pasarían el "if (enviando) return". Un ref cambia de
  // valor al instante y lo ven todas las llamadas, así que es la única
  // guarda que de verdad corta un doble clic sincrónico (verificado con un
  // triple-clic programático en Sandbox: sin el ref, /api/pagos/crear se
  // llamaba 3 veces — el cerrojo de turno de Postgres seguía impidiendo la
  // doble reserva, pero igual eran 3 invocaciones desperdiciadas).
  const enviandoRef = useRef(false);

  useEffect(() => {
    track(EVENTOS.checkoutReached, propsCelebracion(estado, {}, { anticipo, total }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saldo = Math.max(0, total - anticipo);
  const horario = horarioEfectivo(estado.hora, estado.horasAdicionales || 0, estado.fecha);
  const sectorLabel = estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';
  const invitadosLabel = labelInvitados(estado);
  const mayoresLabel = estado.tramoMayores && estado.tramoMayores !== 'no' ? labelMayores(estado) : null;
  const extras = (estado.extras || []).filter((e) => !e.gratis);

  // Guarda contra doble clic / doble Flow: mientras `enviando` es true el
  // botón queda disabled (abajo) y esta función corta cualquier segundo
  // intento que igual llegara a dispararse (doble tap táctil, Enter + clic).
  const confirmar = async () => {
    if (enviandoRef.current || !aceptaTyc) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError('');
    track(EVENTOS.flowStarted, propsCelebracion(estado, {}, { anticipo, total }));
    try {
      const res = await fetch('/api/pagos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente, configuracion: estado, aceptaTyc }),
      });
      const j = await res.json();
      if (j.ok && j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return; // se sale de la página: no hace falta reabrir el botón
      }
      // Cuando el servidor manda el motivo semántico exacto (errores[0]),
      // se muestra ese texto en vez del genérico de MOTIVOS — evita que un
      // papá se quede sin saber QUÉ falta (bug real 28-sep-2026: veía
      // "revisa que todo esté completo" sin ninguna pista de qué revisar).
      const motivoEspecifico = j.motivo === 'configuracion_invalida' && j.errores?.[0];
      setError(motivoEspecifico || MOTIVOS[j.motivo] || 'No pudimos iniciar el pago. Inténtalo de nuevo.');
      enviandoRef.current = false;
      setEnviando(false);
    } catch {
      setError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto" style={{ background: 'linear-gradient(180deg,#F3F9FF 0%, #FFFFFF 38%)' }}>
      <div className="max-w-lg mx-auto px-5 pt-8 pb-10 md:pt-12">

        <button onClick={onCerrar} aria-label="Volver"
          className="mb-5 text-sm font-bold flex items-center gap-1.5" style={{ color: '#6B7A99' }}>
          ‹ Volver
        </button>

        {/* Header con logo protagonista */}
        <div className="text-center mb-2" style={{ background: 'radial-gradient(120% 140% at 50% -10%, #EAF5FF 0%, transparent 62%)', padding: '10px 0 14px' }}>
          <img src="/logo-alce.webp" alt="Alce Kids" className="h-16 md:h-14 w-auto mx-auto mb-2"
            style={{ filter: 'drop-shadow(0 8px 18px rgba(21,101,192,0.18))' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="text-xs font-black uppercase tracking-wide" style={{ color: AZUL }}>
            Las Condes · Cumpleaños infantiles
          </div>
        </div>

        <div className="text-center mt-1">
          <h1 className="text-[27px] md:text-2xl font-black leading-tight" style={{ color: NAVY }}>Revisa tu celebración 🎉</h1>
          <p className="text-base md:text-sm mt-2" style={{ color: '#6B7A99' }}>
            Confírmala y listo — abrimos tu pago seguro con estos datos.
          </p>
        </div>

        {/* Identidad de la celebración */}
        <div className="mt-5 rounded-3xl overflow-hidden bg-white" style={{ border: '1px solid rgba(21,101,192,0.12)', boxShadow: '0 14px 34px -22px rgba(21,101,192,0.4)' }}>
          <FilaIdentidad emoji="🎂" k="Festejad@" v={`${estado.nombreNino || '—'}${estado.edadNino ? ` · ${estado.edadNino} años` : ''}`} />
          <FilaIdentidad emoji="📅" k="Fecha" v={fmtFecha(estado.fecha)} />
          <FilaIdentidad emoji="🕒" k="Horario" v={horario?.textoLargo || '—'} />
          <FilaIdentidad emoji="📍" k="Sector" v={sectorLabel} ultima />
        </div>

        {/* Detalles secundarios */}
        <div className="mt-5">
          <div className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: '#6B7A99' }}>
            {extras.length > 0 ? 'Adicionales elegidos' : 'Tu celebración'}
          </div>
          {extras.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extras.map((e) => (
                <span key={e.id} className="text-sm md:text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
                  {e.emoji ? `${e.emoji} ` : ''}{e.nombre}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-4 flex-wrap mt-2.5 text-sm md:text-xs" style={{ color: '#6B7A99' }}>
            {invitadosLabel && <span>Invitados <b style={{ color: NAVY }}>{invitadosLabel}</b></span>}
            {mayoresLabel && <span>Mayores de 6 <b style={{ color: NAVY }}>{mayoresLabel}</b></span>}
          </div>
        </div>

        {/* Economía — el anticipo es el número más grande */}
        <div className="mt-5 rounded-3xl text-center px-5 py-6 md:py-5" style={{ background: 'linear-gradient(160deg,#FFF7ED 0%,#FFFFFF 60%)', border: '1.5px solid rgba(249,115,22,0.22)' }}>
          <div className="text-sm md:text-xs font-bold" style={{ color: '#6B7A99' }}>
            Valor total de tu celebración: <b style={{ color: '#3E4C6B' }}>{clp(total)}</b>
          </div>
          <div className="text-sm md:text-xs font-black uppercase tracking-wide mt-3.5" style={{ color: '#EA580C' }}>
            Anticipo a pagar hoy
          </div>
          <div className="font-black leading-none mt-1" style={{ fontSize: 50, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>
            {clp(anticipo)}
          </div>
          <div className="text-sm md:text-xs mt-3.5" style={{ color: '#6B7A99' }}>
            Saldo posterior: <b style={{ color: '#3E4C6B' }}>{clp(saldo)}</b> · hasta 48h antes
          </div>
        </div>

        {/* Aviso de retracto — mismo lugar/momento que el precio (Decreto 52),
            informativo, nunca alarmista. Fase 1B, documento "Instrucción
            Maestra — Continuación", 14-sep-2026, §12. */}
        <div className="mt-5 rounded-2xl px-4 py-3.5 text-sm md:text-xs" style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1E40AF' }}>
          ℹ️ Este servicio no tiene <b>derecho a retracto</b> (Ley N° 19.496). Tu reserva queda
          confirmada apenas pagas — revisa nuestra{' '}
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline font-bold">política de cancelación</a>.
        </div>

        <label className="mt-3.5 flex items-start gap-2.5 text-sm md:text-xs cursor-pointer" style={{ color: '#3E4C6B' }}>
          <input
            type="checkbox"
            checked={aceptaTyc}
            onChange={(e) => setAceptaTyc(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ width: 18, height: 18, accentColor: AZUL }}
          />
          <span>
            He leído y acepto los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline font-bold" style={{ color: AZUL }}>
              Términos y Condiciones
            </a>{' '}y la{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline font-bold" style={{ color: AZUL }}>
              Política de Privacidad
            </a>, incluyendo la exclusión del derecho a retracto informada arriba.
          </span>
        </label>

        <button onClick={confirmar} disabled={enviando || !aceptaTyc}
          className="w-full font-black text-white py-5 md:py-4 rounded-2xl mt-4 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)`, fontSize: 18, boxShadow: '0 18px 36px -14px rgba(21,101,192,0.55)' }}>
          {enviando ? 'Abriendo pago seguro…' : `Pagar ${clp(anticipo)} y reservar`}
        </button>

        <div className="text-center mt-3">
          <p className="text-sm md:text-xs font-bold" style={{ color: '#9CA9C4' }}>🔒 Pago seguro procesado por Flow</p>
          <p className="text-sm md:text-xs mt-1" style={{ color: '#9CA9C4' }}>
            Tu horario queda retenido durante {NEGOCIO.holdMinutos} minutos mientras completas el pago.
          </p>
        </div>

        {error && (
          <div className="mt-4 text-sm font-bold rounded-xl p-3.5 text-center" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {/* Confianza secundaria — discreta, no compite con el CTA */}
        <div className="flex gap-2.5 mt-6 flex-wrap" style={{ opacity: 0.82 }}>
          <div className="flex-1 min-w-[150px] rounded-2xl px-3.5 py-3" style={{ background: '#F1F6FD' }}>
            <p className="text-sm md:text-[11px] font-black" style={{ color: '#3E4C6B' }}>
              <span style={{ color: '#F5A623', letterSpacing: 1 }}>★★★★★</span> {MARCA.google_rating}
            </p>
            <p className="text-sm md:text-[11px]" style={{ color: '#6B7A99' }}>{MARCA.google_reviews}+ reseñas en Google</p>
          </div>
          <div className="flex-1 min-w-[150px] rounded-2xl px-3.5 py-3" style={{ background: '#F1F6FD' }}>
            <p className="text-sm md:text-[11px] font-black" style={{ color: '#3E4C6B' }}>☔ Política de lluvia</p>
            <p className="text-sm md:text-[11px] leading-snug" style={{ color: '#6B7A99' }}>{NEGOCIO.lluvia}</p>
          </div>
        </div>

        <div className="text-center mt-6 pt-4" style={{ borderTop: '1px solid #E6ECF7' }}>
          <span className="text-xs font-bold" style={{ color: '#9CA9C4' }}>ALCE KIDS · Una experiencia de Celebra Sin Cesar</span>
        </div>

        <button onClick={onIrWhatsApp} className="w-full text-center text-sm font-bold mt-5" style={{ color: '#6B7280' }}>
          Prefiero coordinar por WhatsApp
        </button>
      </div>
    </div>
  );
}

function FilaIdentidad({ emoji, k, v, ultima }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 md:px-4.5 md:py-3.5" style={ultima ? {} : { borderBottom: '1px solid #E6ECF7' }}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(21,101,192,0.08)' }}>{emoji}</div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: '#6B7A99' }}>{k}</div>
        <div className="text-base font-black" style={{ color: NAVY }}>{v}</div>
      </div>
    </div>
  );
}
