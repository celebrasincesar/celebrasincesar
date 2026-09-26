'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LA CADENA — panel interno de César (noindex)
// Lee las reservas del calendario y muestra, por cada celebración, los
// mensajes de los eslabones 3/4/5 del ecosistema listos para disparar:
//   · 7 días antes  → confirmar adicionales + upsell (catálogo)
//   · 3 días antes  → formulario de confirmación (protección legal)
// (la reseña postevento vive ahora en el módulo <Postevento />)
// Cada acción: copiar el mensaje o abrirlo en WhatsApp (selector de chat).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { NEGOCIO } from '../../data/master';
import { ReservasPagos } from './reservas-pagos';
import { PendientesProveedor } from './pendientes-proveedor';
import { AccionesProximas } from './acciones-proximas';
import { ProximasVisitas } from './proximas-visitas';
import { Postevento } from './postevento';

const fmtFecha = (fechaStr) => {
  const d = new Date(fechaStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
};

const diasDesdeHoy = (fechaStr) => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaStr + 'T00:00:00');
  return Math.round((f - hoy) / 86400000);
};

// ── Mensajes de la cadena (eslabones 3, 4 y 5) ──────────────────────────────
const MSGS = {
  upsell: (fecha) =>
`¡Hola! 😊 Ya falta poquito para la celebración del ${fmtFecha(fecha)} 🎉

Te escribo para dejar confirmados los adicionales de la fiesta. ¿Confirmamos lo que ya elegiste?

Y si quieres sumar algo más para que quede increíble — inflables, animación, decoración o juegos — aquí está el catálogo completo con fotos y valores 👉 celebrasincesar.cl/catalogo

Lo que elijas lo dejamos instalado y listo para ese día 🙌`,

  // Mensaje conversacional temporal (documento "Autorización Fase 1A",
  // 13-sep-2026, §12): coordinación operacional por WhatsApp, NO un
  // formulario legal ni una aceptación contractual — eso sigue siendo
  // exclusivamente los T&C aceptados antes del pago. Se retiró el link
  // roto a /confirmacion (la página sigue existiendo, solo no se enlaza
  // desde acá porque no resuelve la reserva real de un cliente).
  formulario: (fecha) =>
`¡Hola! Ya está todo casi listo para el ${fmtFecha(fecha)} 🎉

Antes del gran día necesitamos que nos confirmes por acá: la cantidad final de niños, si hay alguna alergia o cuidado especial, quién será el adulto responsable durante el evento, y tu ok con el reglamento del recinto.

¿Me cuentas esos datos cuando puedas? Así el día de la celebración todo fluye perfecto 🙌`,
};

// ── Acción individual: copiar + abrir WhatsApp ──────────────────────────────
function Accion({ etiqueta, urgente, mensaje }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };
  return (
    <div className="flex items-center gap-2 flex-wrap py-2"
      style={{ borderTop: '1px solid rgba(21,101,192,0.08)' }}>
      <span className="text-sm font-bold flex-1 min-w-[150px]" style={{ color: urgente ? '#EA580C' : '#374151' }}>
        {urgente && <span className="text-xs font-black px-2 py-0.5 rounded-full mr-2"
          style={{ background: '#F97316', color: 'white' }}>HOY TOCA</span>}
        {etiqueta}
      </span>
      <button onClick={copiar}
        className="text-xs font-black px-3.5 py-2 rounded-xl transition-all active:scale-95"
        style={copiado
          ? { background: '#22c55e', color: 'white' }
          : { background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
        {copiado ? '✓ Copiado' : '📋 Copiar'}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs font-black px-3.5 py-2 rounded-xl text-white"
        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
        WhatsApp →
      </a>
    </div>
  );
}

// ── RESPUESTAS RÁPIDAS (§BH) ────────────────────────────────────────────────
// Cada pregunta frecuente tiene su página bonita. Acá se copia el mensaje con
// el link listo para pegar en WhatsApp: una sola fuente, cero copiar y pegar
// de precios o reglas a mano.
const RESPUESTAS_RAPIDAS = [
  { etiqueta: 'Qué incluye',   slug: 'incluye',        texto: 'Te dejo acá todo lo que incluye el arriendo, con detalle 👇' },
  { etiqueta: 'Valores',       slug: 'valores',        texto: 'Acá está cómo funcionan los valores según cuántos niños vienen 👇' },
  { etiqueta: 'Horarios',      slug: 'horarios',       texto: 'Estos son los días y horarios en que celebramos 👇' },
  { etiqueta: 'Adicionales',   slug: 'catalogo',       texto: 'Este es el catálogo completo de adicionales, con fotos y valores 👇' },
  { etiqueta: 'Inflables',     slug: 'catalogo/inflables', texto: 'Acá puedes ver todos nuestros inflables 👇' },
  { etiqueta: 'Animación',     slug: 'catalogo/animacion', texto: 'Acá están todos los shows y animaciones 👇' },
  { etiqueta: 'Mayores de 6',  slug: 'mayores-de-6',   texto: 'Te explico cómo funciona cuando vienen hermanos mayores de 6 👇' },
  { etiqueta: 'Lluvia',        slug: 'lluvia',         texto: 'Tranquila/o: si llueve reagendas sin costo. Te lo explico acá 👇' },
  { etiqueta: 'Cómo reservar', slug: 'como-reservar',  texto: 'Así funciona la reserva, paso a paso 👇' },
  { etiqueta: 'Visitar',       slug: 'visitar',        texto: 'Puedes venir a conocer el lugar antes de decidir 👇' },
  { etiqueta: 'Ubicación',     slug: 'ubicacion',      texto: 'Acá estamos, con el mapa para llegar 👇' },
  { etiqueta: 'Todas las dudas', slug: 'preguntas',    texto: 'Te dejo el centro de preguntas frecuentes 👇' },
];

function RespuestaRapida({ etiqueta, slug, texto }) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = `${texto}\n${NEGOCIO.sitio}/${slug}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };
  return (
    <button onClick={copiar}
      className="text-xs font-black px-3 py-2 rounded-xl transition-all active:scale-95"
      style={copiado
        ? { background: '#22c55e', color: 'white' }
        : { background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
      {copiado ? '✓ Copiado' : etiqueta}
    </button>
  );
}

function RespuestasRapidas() {
  return (
    <section className="bg-white rounded-3xl p-5 mb-8"
      style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      <h2 className="font-black text-lg" style={{ color: '#1565C0' }}>⚡ Respuestas rápidas</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">
        Toca una y queda copiado el mensaje con el link. Lo pegas en WhatsApp y listo.
      </p>
      <div className="flex flex-wrap gap-2">
        {RESPUESTAS_RAPIDAS.map((r) => <RespuestaRapida key={r.slug} {...r} />)}
      </div>
    </section>
  );
}

export default function CadenaPage() {
  const [reservas, setReservas] = useState(null); // null = cargando

  useEffect(() => {
    fetch('/api/cadena', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setReservas(d.reservas || []))
      .catch(() => setReservas([]));
  }, []);

  const proximas = (reservas || []).filter((r) => diasDesdeHoy(r.fecha) >= 0);

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: '#F8FAFF' }}>
      <div className="max-w-2xl mx-auto">
        <AccionesProximas />
        <Postevento />
        <PendientesProveedor />
        <ProximasVisitas />
        <ReservasPagos />
        <RespuestasRapidas />

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <img src="/logo-alce.webp" alt="" className="w-10 h-10 rounded-xl object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <h1 className="font-black text-xl leading-none" style={{ color: '#1565C0' }}>🔗 La Cadena</h1>
            <p className="text-xs text-gray-400 mt-1">Panel interno · un toque por eslabón · revísalo cada mañana</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-8 leading-relaxed">
          Los botones copian el mensaje o lo abren en WhatsApp para que elijas el chat del apoderado.
          <strong> Naranja = ese eslabón toca hoy.</strong>
        </p>

        {reservas === null && (
          <p className="text-sm text-gray-400 text-center py-10">Leyendo el calendario…</p>
        )}

        {reservas !== null && proximas.length === 0 && (
          <div className="rounded-2xl p-6 text-center text-sm text-gray-400"
            style={{ background: 'white', border: '1px solid rgba(21,101,192,0.1)' }}>
            No hay reservas próximas en el calendario (hasta +35 días).
            <br />Las reservas se detectan por eventos "RESERVADO AM" / "RESERVADO PM".
          </div>
        )}

        {/* ── Próximas celebraciones ── */}
        {proximas.length > 0 && (
          <>
            <h2 className="font-black text-sm uppercase tracking-widest mb-3" style={{ color: '#1565C0' }}>
              📅 Próximas celebraciones
            </h2>
            <div className="space-y-4 mb-10">
              {proximas.map((r) => {
                const diff = diasDesdeHoy(r.fecha);
                return (
                  <div key={`${r.fecha}-${r.turno}`} className="rounded-2xl p-5"
                    style={{ background: 'white', border: '1px solid rgba(21,101,192,0.12)', boxShadow: '0 2px 12px rgba(21,101,192,0.06)' }}>
                    <div className="flex items-baseline justify-between mb-1 gap-2 flex-wrap">
                      <p className="font-black text-base" style={{ color: '#0D1B3E' }}>
                        {fmtFecha(r.fecha)} · {r.turno}
                      </p>
                      <span className="text-xs font-bold text-gray-400">
                        {diff === 0 ? '🎉 ¡ES HOY!' : diff === 1 ? 'mañana' : `en ${diff} días`}
                      </span>
                    </div>
                    <Accion
                      etiqueta="1 · Confirmar adicionales + ofrecer más"
                      urgente={diff === 7}
                      mensaje={MSGS.upsell(r.fecha)}
                    />
                    <Accion
                      etiqueta="2 · Formulario de confirmación (protección)"
                      urgente={diff === 3}
                      mensaje={MSGS.formulario(r.fecha)}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* El bloque antiguo de reseñas (derivado de Google Calendar, sin
            persistencia ni dedupe) se retiró: el módulo Postevento de
            arriba lo reemplaza (documento "FASE 3B — POSTEVENTO", §2). */}

        <p className="text-center text-xs text-gray-300 mt-12">
          La Cadena · eslabones 3-4-5 del ecosistema · los eslabones 1-2 viven en
          Google/Ads y en los mensajes automáticos de WhatsApp Business (ver KIT)
        </p>
      </div>
    </main>
  );
}
