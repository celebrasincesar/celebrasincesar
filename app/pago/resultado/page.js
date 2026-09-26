'use client';

// ══════════════════════════════════════════════════════════════════════
// /pago/resultado — página GET propia a la que Flow redirige (§14)
// ──────────────────────────────────────────────────────────────────────
// Ni el webhook (`urlConfirmation`) ni el retorno del navegador
// (`urlReturn`) terminan acá directamente: los dos ya HICIERON la consulta
// real a Flow del lado del servidor (procesarToken) y esta página solo
// LEE el resultado guardado — nunca decide por sí misma si el pago se
// hizo.
//
// Para medios asíncronos (transferencia) el papá puede llegar antes de
// que Flow termine de confirmar: por eso, mientras la reserva siga en
// "verificando", esta página sondea /api/pagos/flow/status cada pocos
// segundos en vez de dejar al papá mirando una rueda girando para
// siempre sin explicación.
// ══════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clp, recomendados, tramoInvitadosPorId, tramoMayoresPorId } from '../../../data/reglas';
import { NEGOCIO, BLOQUES_VITRINA } from '../../../data/master';
import { CARRUSEL } from '../../../data/imagenes';
import { getPrecio } from '../../celebra-ui';

const AZUL = '#1565C0';
const NARANJA = '#F97316';
const NAVY = '#0D1B3E';

// Ubica la foto real de un ítem recorriendo BLOQUES_VITRINA: las fotos
// viven por CARPETA de grupo, en el mismo orden que `itemIds` (§ ④
// data/master.js) — no hay una foto por ítem suelta en ningún otro lado.
function fotoDeItem(itemId) {
  for (const bloque of BLOQUES_VITRINA) {
    for (const grupo of bloque.grupos || []) {
      const idx = (grupo.itemIds || []).indexOf(itemId);
      if (idx >= 0) return (CARRUSEL[grupo.carpeta] || [])[idx] || null;
    }
  }
  return null;
}

export default function ResultadoPagoPage() {
  return (
    <Suspense fallback={null}>
      <ResultadoPago />
    </Suspense>
  );
}

// Estados que ya son definitivos: dejar de sondear en cuanto se llega a
// cualquiera de estos, sea bueno o malo.
const ESTADOS_FINALES = new Set([
  'CONFIRMED', 'BALANCE_PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'COMPLETED', 'EXPIRED',
  'PAYMENT_CONFLICT',
]);

function ResultadoPago() {
  const params = useSearchParams();
  const id = (params.get('id') || '').trim().toUpperCase();
  const token = (params.get('t') || '').trim();
  const resultadoInicial = (params.get('r') || '').trim();
  const motivo = (params.get('motivo') || '').trim();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [intentos, setIntentos] = useState(0);
  const detenido = useRef(false);

  useEffect(() => {
    if (!id || !token) { setCargando(false); return; }

    let vivo = true;
    const consultar = async () => {
      try {
        const r = await fetch(`/api/pagos/flow/status?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (j.ok) setDatos(j);
        setCargando(false);
      } catch {
        if (vivo) setCargando(false);
      }
    };

    consultar();

    // Sondeo: cada 4 segundos, hasta 45 intentos (3 minutos) o hasta que
    // el estado quede definitivo. Un papá esperando una transferencia no
    // debería tener que refrescar la página a mano (§14).
    const intervalo = setInterval(() => {
      if (detenido.current) return;
      setIntentos((n) => n + 1);
      consultar();
    }, 4000);

    return () => { vivo = false; clearInterval(intervalo); };
  }, [id, token]);

  useEffect(() => {
    if (datos?.estado && ESTADOS_FINALES.has(datos.estado)) detenido.current = true;
    if (intentos >= 45) detenido.current = true;
  }, [datos, intentos]);

  const irWhatsApp = (texto) =>
    `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(texto)}`;

  // ── Sin parámetros: alguien abrió el link a mano ────────────────────
  if (!id || !token) {
    return (
      <Envoltorio>
        <IconoEstado tipo="info" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Reserva no encontrada</h1>
        <p className="text-gray-500 mb-6">
          Este link no trae los datos de una reserva. Si venías de pagar, revisa el link
          completo que te compartimos o escríbenos y lo resolvemos al tiro.
        </p>
        <BotonWhatsApp href={irWhatsApp('¡Hola César! Llegué a la página de resultado de pago pero no encontró mi reserva. ¿Me ayudas?')} />
      </Envoltorio>
    );
  }

  if (cargando && !datos) {
    return (
      <Envoltorio>
        <IconoEstado tipo="cargando" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Un momento…</h1>
        <p className="text-gray-500">Estamos revisando tu reserva {id}.</p>
      </Envoltorio>
    );
  }

  if (!datos) {
    return (
      <Envoltorio>
        <IconoEstado tipo="error" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>No pudimos leer tu reserva</h1>
        <p className="text-gray-500 mb-6">
          {motivo === 'sin_acceso'
            ? 'El link no coincide con ninguna reserva activa.'
            : 'Puede ser un problema momentáneo. Escríbenos con tu código de reserva y lo revisamos al tiro.'}
        </p>
        <p className="font-black mb-6" style={{ color: '#374151' }}>Código: {id}</p>
        <BotonWhatsApp href={irWhatsApp(`¡Hola César! No pude ver el resultado de mi pago para la reserva ${id}. ¿Me ayudas?`)} />
      </Envoltorio>
    );
  }

  const { estado, estadoTexto, total, pagado, saldoPendiente } = datos;
  const confirmada = ['CONFIRMED', 'BALANCE_PENDING', 'PAID'].includes(estado);
  const verificando = estado === 'PAYMENT_VERIFYING' || estado === 'PENDING_PAYMENT';
  const expirada = estado === 'EXPIRED';
  const conflicto = estado === 'PAYMENT_CONFLICT';
  const rechazada = resultadoInicial === 'rechazado' && !confirmada && !conflicto;

  // ── Pagado y confirmado ──────────────────────────────────────────────
  if (confirmada) {
    const festejado = datos.festejado || 'tu hij@';
    const extrasIds = (datos.extras || []).map((e) => e.id);
    const sugerencias = datos.ctx ? recomendados(datos.ctx, extrasIds, 4) : [];
    const mensajeWhatsApp = mensajePostPago({ id, datos, festejado });

    return (
      <Envoltorio ancho="max-w-lg">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4"
          style={{ background: 'radial-gradient(circle at 35% 30%, rgba(34,197,94,0.22), rgba(34,197,94,0.06))' }}>
          🎉
        </div>
        <h1 className="text-[26px] md:text-3xl font-black mb-2 leading-tight" style={{ color: NAVY }}>
          🎉 ¡La celebración de {festejado} ya está reservada!
        </h1>
        <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg mt-1" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)', fontFamily: 'ui-monospace,monospace' }}>
          {id}
        </span>

        {/* Fecha+horario / pagado / saldo — visibles de inmediato */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-6 text-left">
          <StatTile emoji="📅" k="Fecha y horario" v={fmtFechaHorario(datos)} />
          <StatTile emoji="✅" k="Pagado" v={clp(pagado)} color="#16a34a" />
          <StatTile emoji="⏳" k="Saldo pendiente" v={saldoPendiente > 0 ? clp(saldoPendiente) : 'Pagado completo'} color={NARANJA} />
        </div>

        {datos.adicionales?.length > 0 && (
          <div className="mt-6 text-left">
            <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: '#6B7A99' }}>Adicionales contratados</p>
            <div className="flex flex-wrap gap-2">
              {datos.adicionales.map((a) => (
                <span key={a.id} className="text-sm md:text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
                  {a.emoji ? `${a.emoji} ` : ''}{a.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {saldoPendiente > 0 && (
          <div className="mt-5 text-sm text-left rounded-xl p-3.5" style={{ background: 'rgba(41,185,232,0.08)', borderLeft: '3px solid #29B9E8', color: '#6B7A99' }}>
            Te avisaremos por WhatsApp para pagar el saldo {NEGOCIO.saldoVence}.
          </div>
        )}

        <Link href={`/mi-celebracion?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`}
          className="block w-full text-center font-black text-white py-4 md:py-3.5 rounded-2xl mt-6"
          style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)`, fontSize: 16 }}>
          Ver mi celebración
        </Link>
        <BotonWhatsApp href={irWhatsApp(mensajeWhatsApp)} texto="Coordinar mi celebración por WhatsApp" />
        <Link href="/catalogo"
          className="block w-full text-center font-black py-3 rounded-2xl mt-3 text-sm"
          style={{ color: AZUL, border: '1.5px solid rgba(21,101,192,0.25)' }}>
          Personalizar aún más mi celebración ✨
        </Link>

        {sugerencias.length > 0 && (
          <div className="mt-9 text-center">
            <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#EA580C' }}>Para completar la fiesta</p>
            <h3 className="text-lg font-black mt-1" style={{ color: NAVY }}>Combina increíble con lo que ya elegiste</h3>
            <p className="text-xs mt-1 mb-4" style={{ color: '#6B7A99' }}>
              Seleccionado para {festejado} — solo lo que aplica a tu celebración.
            </p>
            <div className="grid grid-cols-2 gap-3 text-left">
              {sugerencias.map(({ item }) => (
                <TarjetaUpsell key={item.id} item={item} codigo={id} festejado={festejado} cantNinos={datos.cantNinos} irWhatsApp={irWhatsApp} />
              ))}
            </div>
          </div>
        )}
      </Envoltorio>
    );
  }

  // ── Pago recibido, pero el turno ya lo tomó otra reserva ────────────
  // Pasa muy rara vez: el HOLD venció mientras el papá pagaba, y otra
  // familia agarró el mismo horario justo antes de que el pago llegara.
  // El dinero SÍ entró — nunca se le dice al papá que falló — y César lo
  // contacta personalmente para reagendar o devolver. Nunca "reserva
  // confirmada": el turno es de la otra familia.
  if (conflicto) {
    return (
      <Envoltorio>
        <IconoEstado tipo="info" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Recibimos tu pago</h1>
        <p className="text-gray-500 mb-6">
          Justo en este momento el horario que elegiste quedó tomado por otra familia.
          Tu pago se recibió igual — te vamos a escribir personalmente para coordinar
          una nueva fecha o resolverlo contigo.
        </p>
        <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: '#F8FAFF', border: '1px solid rgba(21,101,192,0.12)' }}>
          <Fila k="Código de reserva" v={id} />
          <Fila k="Pagado" v={clp(pagado)} destacado />
        </div>
        <BotonWhatsApp href={irWhatsApp(`¡Hola César! Pagué la reserva ${id} pero me aparece que el horario quedó tomado. ¿Me ayudas a coordinarlo?`)} />
      </Envoltorio>
    );
  }

  // ── En verificación (transferencia u otro medio asíncrono) ─────────
  if (verificando) {
    return (
      <Envoltorio>
        <IconoEstado tipo="cargando" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Estamos verificando tu pago</h1>
        <p className="text-gray-500 mb-6">
          Tu reserva se confirmará automáticamente apenas recibamos la confirmación del banco.
          Esto puede tardar unos minutos — no cierres esta página, o vuelve a abrir este mismo link más tarde.
        </p>
        <p className="text-xs mb-6" style={{ color: 'rgba(0,0,0,0.4)' }}>Código: {id}</p>
        <BotonWhatsApp href={irWhatsApp(`¡Hola César! Mi pago para la reserva ${id} sigue en verificación. ¿Puedes revisarlo?`)} />
      </Envoltorio>
    );
  }

  // ── Expirada: el hold se venció antes de completar el pago ─────────
  if (expirada) {
    return (
      <Envoltorio>
        <IconoEstado tipo="info" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>El tiempo para pagar se agotó</h1>
        <p className="text-gray-500 mb-6">
          Retuvimos tu turno por unos minutos, pero venció antes de completar el pago.
          Si el horario sigue disponible, puedes volver a intentarlo.
        </p>
        <Link href="/armar"
          className="inline-block font-black text-white py-3 px-8 rounded-2xl"
          style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}>
          Volver a armar mi celebración
        </Link>
      </Envoltorio>
    );
  }

  // ── Rechazado ─────────────────────────────────────────────────────
  return (
    <Envoltorio>
      <IconoEstado tipo="error" />
      <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>El pago no se pudo completar</h1>
      <p className="text-gray-500 mb-6">
        {rechazada
          ? 'Tu banco o medio de pago rechazó la transacción. Puedes intentarlo de nuevo con otro medio.'
          : 'No pudimos confirmar tu pago. Escríbenos con tu código de reserva y lo resolvemos.'}
      </p>
      <p className="text-xs mb-6" style={{ color: 'rgba(0,0,0,0.4)' }}>Código: {id}</p>
      <BotonWhatsApp href={irWhatsApp(`¡Hola César! Mi pago para la reserva ${id} no se completó. ¿Me ayudas a reintentarlo?`)} />
    </Envoltorio>
  );
}

function Envoltorio({ children, ancho = 'max-w-md' }) {
  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-10"
      style={{ fontFamily: 'var(--font-nunito,Nunito,sans-serif)', background: 'linear-gradient(180deg,#F3F9FF 0%,#FFFFFF 38%)' }}>
      <div className={`${ancho} w-full text-center`}>
        <img src="/logo-alce.webp" alt="Alce Kids" className="h-16 w-auto mx-auto mb-6"
          style={{ filter: 'drop-shadow(0 8px 18px rgba(21,101,192,0.18))' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        {children}
        <p className="text-xs font-bold mt-8" style={{ color: '#9CA9C4' }}>
          ALCE KIDS · Una experiencia de Celebra Sin Cesar
        </p>
      </div>
    </main>
  );
}

function IconoEstado({ tipo }) {
  const mapa = {
    ok:       { emoji: '🎉', bg: 'rgba(34,197,94,0.12)' },
    cargando: { emoji: '⏳', bg: 'rgba(21,101,192,0.10)' },
    error:    { emoji: '⚠️', bg: 'rgba(239,68,68,0.10)' },
    info:     { emoji: 'ℹ️', bg: 'rgba(249,115,22,0.10)' },
  };
  const { emoji, bg } = mapa[tipo] || mapa.info;
  return (
    <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5" style={{ background: bg }}>
      {emoji}
    </div>
  );
}

function Fila({ k, v, destacado = false }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 text-sm">
      <span className="text-gray-400">{k}</span>
      <span className="font-black" style={{ color: destacado ? NARANJA : '#374151' }}>{v}</span>
    </div>
  );
}

function BotonWhatsApp({ href, texto = 'Escribir por WhatsApp' }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 w-full font-black text-white py-4 md:py-3.5 rounded-2xl mt-6"
      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', fontSize: 16 }}>
      {texto}
    </a>
  );
}

// "17 oct · 15:00–19:00" — a partir de los mismos datos crudos que ya
// guarda la reserva (fecha_evento, hora_inicio, hora_termino), nunca
// recalculados con otra fuente.
function fmtFechaHorario(datos) {
  if (!datos.fecha) return '—';
  const d = new Date(`${datos.fecha}T12:00:00`);
  const fecha = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  const horario = datos.horaInicio && datos.horaTermino ? ` · ${datos.horaInicio}–${datos.horaTermino}` : '';
  return `${fecha}${horario}`;
}

// "domingo 27 de septiembre" — sin año, como se habla por WhatsApp.
function fmtFechaHablada(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Mensaje de WhatsApp post-pago (documento "Quiero mejorar urgentemente la
// información operativa…", 09-sep-2026, §5): los servicios PAGADOS que el
// cliente contrató, en un formato que él mismo puede leer — nunca los
// incluidos/preparar internos, esos solo importan para César (/cadena y
// Calendar). Todo sale de lo que ya devolvió /api/pagos/flow/status, que a
// su vez sale del snapshot histórico — nada se inventa ni se recalcula acá.
function mensajePostPago({ id, datos, festejado }) {
  const ninosLabel = tramoInvitadosPorId(datos.tramoInvitados)?.corto || null;
  const mayoresLabel = tramoMayoresPorId(datos.tramoMayores)?.corto || null;
  const sectorLabel = datos.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';

  const lineas = [
    '¡Hola César! 👋 Ya reservé y pagué mi anticipo en ALCE KIDS.',
    '',
    `🎉 Reserva: ${id}`,
    `🎂 ${festejado}${datos.edadNino != null ? ` · ${datos.edadNino} años` : ''}`,
    `📅 ${fmtFechaHablada(datos.fecha)} · ${datos.horaInicio || ''}–${datos.horaTermino || ''}`,
    `🏡 ${sectorLabel}`,
    ninosLabel ? `👧 ${ninosLabel}` : null,
    mayoresLabel && mayoresLabel !== 'Ninguno' ? `👦 Mayores de 6: ${mayoresLabel}` : null,
  ].filter((l) => l !== null);

  if (datos.adicionales?.length > 0) {
    lineas.push('', '✨ Adicionales contratados:', ...datos.adicionales.map((a) => `• ${a.nombre}`));
  }

  lineas.push(
    '',
    `💰 Total: ${clp(datos.total)}`,
    `✅ Pagado: ${clp(datos.pagado)}`,
    `💵 Saldo: ${clp(datos.saldoPendiente)}`,
    '',
    'Quedo atento/a a cualquier indicación.',
  );

  return lineas.join('\n');
}

function StatTile({ emoji, k, v, color }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3 md:block md:text-center"
      style={{ background: '#FFFFFF', border: '1px solid rgba(21,101,192,0.12)' }}>
      <span className="text-xl md:block md:mb-1">{emoji}</span>
      <div>
        <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: '#6B7A99' }}>{k}</div>
        <div className="text-base font-black" style={{ color: color || NAVY }}>{v}</div>
      </div>
    </div>
  );
}

// Tarjeta de upsell con foto real, nombre, precio y CTA propio que abre
// WhatsApp con el código de reserva, el festejado y el producto ya
// escritos (documento "Nueva fase — experiencia de marca…", 08-sep-2026, §3).
function TarjetaUpsell({ item, codigo, festejado, cantNinos, irWhatsApp }) {
  const foto = fotoDeItem(item.id);
  const precio = getPrecio(item, cantNinos);
  const mensaje = `¡Hola! Vi que puedo agregar "${item.nombre}" a mi celebración Alce Kids ${codigo} (${festejado}). ¿Cómo lo sumamos?`;
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: '#fff', border: '1px solid rgba(21,101,192,0.12)', boxShadow: '0 10px 26px -18px rgba(21,101,192,0.35)' }}>
      {foto ? (
        <img src={foto} alt={item.nombre} className="w-full object-cover" style={{ aspectRatio: '4/5' }} />
      ) : (
        <div className="w-full flex items-center justify-center text-3xl" style={{ aspectRatio: '4/5', background: '#F1F6FD' }}>{item.emoji}</div>
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="text-sm font-black leading-tight" style={{ color: NAVY }}>{item.nombre}</div>
        {precio != null && <div className="text-sm font-black" style={{ color: AZUL }}>{clp(precio)}</div>}
        <a href={irWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer"
          className="mt-auto text-center text-xs font-black text-white py-2.5 rounded-xl"
          style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}>
          Quiero agregarlo
        </a>
      </div>
    </div>
  );
}
