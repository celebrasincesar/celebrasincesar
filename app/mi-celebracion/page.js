'use client';

// ══════════════════════════════════════════════════════════════════════
// /mi-celebracion — el enlace privado y permanente del papá (documento
// "FASE 2 — EXPERIENCIA CLIENTE END-TO-END", 21-sep-2026; Datos Finales +
// adicionales posteriores agregados por "FASE 2B — IMPLEMENTAR BLOQUE 1",
// 21-sep-2026).
// ──────────────────────────────────────────────────────────────────────
// Mobile-first, pocos elementos, cero jerga técnica ni estados internos:
// todo el texto que se ve acá ya viene redactado por el servidor
// (/api/mi-celebracion) — esta página solo lo distribuye en pantalla.
// ══════════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { NEGOCIO, CATEGORIAS_ADICIONALES } from '../../data/master';
import { compartirAlceKids } from '../../lib/compartir';
import { EVENTOS, track } from '../../data/analytics';

const AZUL = '#1565C0';
const NARANJA = '#F97316';
const NAVY = '#0D1B3E';
const VERDE = '#16a34a';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00`);
  return capitalizar(d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }));
}

function fmtFechaHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) + ' · '
    + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// Mismos dos ids que lib/pendientes-proveedor.js#IDS_DECORACION_TEMATICA
// — no se importa ese archivo acá porque arrastra el driver de Postgres.
const IDS_DECORACION_TEMATICA = new Set(['deco-tematica-simple', 'deco-tematica-full']);

// Categorías que tiene sentido ofrecer para agregar después de reservar
// (documento §8) — el servidor (itemVisible()) es la autoridad final de
// qué es compatible; acá solo se ofrece una lista razonable.
const CATEGORIAS_OFRECIDAS = ['inflables', 'juegos', 'decoracion', 'animacion'];

export default function MiCelebracionPage() {
  return (
    <Suspense fallback={null}>
      <MiCelebracion />
    </Suspense>
  );
}

function MiCelebracion() {
  const params = useSearchParams();
  const id = (params.get('id') || '').trim().toUpperCase();
  const t = (params.get('t') || '').trim();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState('');
  const pagandoRef = useRef(false);

  const cargar = async () => {
    try {
      const r = await fetch(`/api/mi-celebracion?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`, { cache: 'no-store' });
      const j = await r.json();
      setDatos(j.ok ? j : null);
      if (j.ok) track(EVENTOS.miCelebracionOpened);
    } catch {
      setDatos(null);
    }
  };

  useEffect(() => {
    if (!id || !t) { setCargando(false); return; }
    let vivo = true;
    (async () => {
      await cargar();
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, t]);

  const irWhatsApp = (texto) =>
    `https://wa.me/${NEGOCIO.telefonoE164.replace('+', '')}?text=${encodeURIComponent(texto)}`;

  const pagarSaldo = async () => {
    if (pagandoRef.current) return;
    pagandoRef.current = true;
    setPagando(true);
    setErrorPago('');
    track(EVENTOS.balancePayClicked);
    try {
      const r = await fetch('/api/mi-celebracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, t }),
      });
      const j = await r.json();
      if (j.ok && j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return;
      }
      setErrorPago(
        j.motivo === 'saldo_verificandose'
          ? 'Ya estamos verificando un pago de tu saldo — no necesitas volver a pagar.'
          : 'No pudimos iniciar el pago del saldo. Inténtalo de nuevo o escríbenos por WhatsApp.'
      );
      pagandoRef.current = false;
      setPagando(false);
    } catch {
      setErrorPago('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
      pagandoRef.current = false;
      setPagando(false);
    }
  };

  if (!id || !t) {
    return (
      <Envoltorio>
        <Icono emoji="ℹ️" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Enlace incompleto</h1>
        <p className="text-gray-500 mb-6">
          Este link no trae los datos de tu celebración. Revisa el enlace completo que te
          compartimos por WhatsApp o correo, o escríbenos y lo resolvemos al tiro.
        </p>
        <BotonWhatsApp href={irWhatsApp('¡Hola! Quiero ver mi celebración pero el link no me funciona. ¿Me ayudas?')} />
      </Envoltorio>
    );
  }

  if (cargando) {
    return (
      <Envoltorio>
        <Icono emoji="⏳" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>Un momento…</h1>
        <p className="text-gray-500">Estamos cargando tu celebración.</p>
      </Envoltorio>
    );
  }

  if (!datos) {
    return (
      <Envoltorio>
        <Icono emoji="⚠️" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>No pudimos encontrar tu celebración</h1>
        <p className="text-gray-500 mb-6">
          El enlace no coincide con ninguna reserva activa. Escríbenos con tu código de reserva
          y lo revisamos al tiro.
        </p>
        <BotonWhatsApp href={irWhatsApp('¡Hola! Entré a Mi Celebración pero no encontró mi reserva. ¿Me ayudas?')} />
      </Envoltorio>
    );
  }

  if (!datos.confirmada) {
    return (
      <Envoltorio>
        <Icono emoji="ℹ️" />
        <h1 className="text-2xl font-black mb-2" style={{ color: AZUL }}>{datos.proximoPaso.titulo}</h1>
        <p className="text-gray-500 mb-6">{datos.proximoPaso.texto}</p>
        <p className="text-xs mb-6" style={{ color: 'rgba(0,0,0,0.4)' }}>Código: {datos.codigo}</p>
        <BotonWhatsApp href={irWhatsApp(`¡Hola! Tengo una duda sobre mi reserva ${datos.codigo}. ¿Me ayudas?`)} />
      </Envoltorio>
    );
  }

  const {
    festejado, edad, fecha, horaInicio, horaTermino, direccion,
    sectorLabel, ninosLabel, mayoresLabel, adicionales, incluidos, extrasIds,
    total, pagado, saldoPendiente, saldoVerificando, puedePagarSaldo, proximoPaso, codigo,
    contratado, datosFinales, pendientesProveedor, postevento,
  } = datos;
  const enPostevento = !!postevento?.activo;

  const botonSaldo = (
    <button
      onClick={pagarSaldo}
      disabled={pagando}
      className="w-full font-black text-white py-3.5 rounded-2xl mt-3 disabled:opacity-60"
      style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}
    >
      {pagando ? 'Abriendo pago seguro…' : '💳 Pagar saldo'}
    </button>
  );

  return (
    <Envoltorio ancho="max-w-lg">
      {enPostevento ? (
        <BloquePostevento titulo={proximoPaso.titulo} texto={proximoPaso.texto} resenaUrl={postevento.resenaUrl} />
      ) : (
        <>
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4"
            style={{ background: 'radial-gradient(circle at 35% 30%, rgba(34,197,94,0.22), rgba(34,197,94,0.06))' }}>
            🎉
          </div>
          <h1 className="text-[26px] md:text-3xl font-black mb-1 leading-tight" style={{ color: NAVY }}>
            Celebración de {festejado}{edad != null ? ` · ${edad} años` : ''}
          </h1>
          <p className="font-black mb-1" style={{ color: VERDE }}>Reserva confirmada ✓</p>
        </>
      )}
      <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg mt-1" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)', fontFamily: 'ui-monospace,monospace' }}>
        {codigo}
      </span>

      <div className="mt-5 text-left rounded-2xl p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(21,101,192,0.12)' }}>
        <p className="font-black" style={{ color: NAVY }}>{fmtFecha(fecha)}</p>
        {horaInicio && horaTermino && (
          <p className="text-sm" style={{ color: '#6B7A99' }}>{horaInicio}–{horaTermino}</p>
        )}
        <p className="text-sm mt-1" style={{ color: '#6B7A99' }}>{direccion}</p>
      </div>

      {/* PAGOS — Fase 5 Bloque 3 "saldo amable": nunca presiona, solo
          facilita. Tres estados posibles, mutuamente excluyentes. */}
      <Seccion titulo="Pagos">
        <Fila k="Total" v={clp(total)} />
        <Fila k="Pagado" v={clp(pagado)} color={VERDE} />
        {saldoVerificando ? (
          <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: 'rgba(21,101,192,0.06)', color: AZUL }}>
            ⏳ Estamos verificando tu pago. No necesitas volver a pagar.
          </div>
        ) : saldoPendiente > 0 ? (
          <>
            <Fila k="Saldo pendiente" v={clp(saldoPendiente)} color={NARANJA} />
            <p className="text-sm mt-2" style={{ color: '#6B7A99' }}>
              Si quieres dejar todo listo, puedes pagar tu saldo desde aquí cuando te acomode.
            </p>
            {puedePagarSaldo && botonSaldo}
          </>
        ) : (
          <div className="mt-3 rounded-xl p-3 text-sm font-bold" style={{ background: 'rgba(34,197,94,0.08)', color: VERDE }}>
            Pagos al día ✓
            <span className="block font-normal mt-0.5" style={{ color: '#6B7A99' }}>
              Tu celebración no tiene saldo pendiente.
            </span>
          </div>
        )}
        {errorPago && <p className="text-sm mt-2" style={{ color: '#DC2626' }}>{errorPago}</p>}
      </Seccion>

      {/* TU CELEBRACIÓN */}
      <Seccion titulo="Tu celebración">
        <p className="text-sm font-bold" style={{ color: '#374151' }}>{sectorLabel}</p>
        {ninosLabel && <p className="text-sm" style={{ color: '#374151' }}>{ninosLabel}</p>}
        {mayoresLabel && mayoresLabel !== 'Ninguno' && (
          <p className="text-sm" style={{ color: '#374151' }}>{mayoresLabel}</p>
        )}
        {[...(incluidos || []), ...(adicionales || [])].length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[...(incluidos || []), ...(adicionales || [])].map((a) => (
              <span key={a.id} className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
                {a.emoji ? `${a.emoji} ` : ''}{a.nombre}
              </span>
            ))}
          </div>
        )}
        {!enPostevento && pendientesProveedor?.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(21,101,192,0.08)' }}>
            {pendientesProveedor.map((p) => (
              <p key={`${p.tipo}:${p.itemId}`} className="text-xs" style={{ color: '#6B7A99' }}>
                {p.tipo === 'decoracion_tematica' ? `Decoración temática${p.detalle ? ` — ${p.detalle}` : ''}` : 'Animación'}
                {' · '}
                <span style={{ color: p.estado === 'CONFIRMADO' ? VERDE : NARANJA, fontWeight: 700 }}>
                  {p.estado === 'CONFIRMADO' ? 'Confirmada ✓' : 'Disponibilidad por confirmar'}
                </span>
              </p>
            ))}
          </div>
        )}
      </Seccion>

      {/* Desde T+1 la celebración ya ocurrió: el estado postevento de arriba
          reemplaza el próximo paso y las acciones previas al evento. */}
      {!enPostevento && (
        <>
          {/* PRÓXIMO PASO */}
          <Seccion titulo="Próximo paso">
            <p className="font-black mb-1" style={{ color: proximoPaso.tipo === 'saldo_urgente' ? NARANJA : VERDE }}>
              {proximoPaso.titulo}
            </p>
            <p className="text-sm" style={{ color: '#6B7A99' }}>{proximoPaso.texto}</p>
            {proximoPaso.tipo === 'saldo_urgente' && puedePagarSaldo && botonSaldo}
          </Seccion>

          {/* DATOS FINALES */}
          <SeccionDatosFinales
            codigo={codigo} idParam={id} tParam={t}
            contratado={contratado} datosFinales={datosFinales}
            onGuardado={cargar}
          />

          {/* AGREGAR ADICIONAL */}
          <SeccionAgregarAdicional
            idParam={id} tParam={t} extrasIds={extrasIds || []}
            onAgregado={cargar}
          />
        </>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: '#9CA9C4' }}>¿Necesitas ayuda?</p>
        <BotonWhatsApp href={irWhatsApp(`¡Hola! Tengo una consulta sobre mi celebración ${codigo} (${festejado}).`)} texto="Hablar por WhatsApp" />
      </div>
    </Envoltorio>
  );
}

// ── Postevento (documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE B",
// 24-sep-2026, §5-§10). Reseña y compartir son acciones DISTINTAS: la
// reseña abre el enlace directo de Google que entrega el servidor; compartir
// solo comparte información pública de Alce Kids (lib/compartir.js), nunca
// este enlace seguro ni datos de la reserva. Fase 5, Bloque 8: ambos clics
// registran un evento anónimo (sin reseñaUrl, sin código de reserva).
function BloquePostevento({ titulo, texto, resenaUrl }) {
  const [fallback, setFallback] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const compartir = async () => {
    track(EVENTOS.shareClicked);
    const r = await compartirAlceKids({ nav: typeof navigator !== 'undefined' ? navigator : null });
    if (r.via === 'fallback') setFallback(r);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(fallback.mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };

  return (
    <div>
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4"
        style={{ background: 'radial-gradient(circle at 35% 30%, rgba(249,115,22,0.22), rgba(249,115,22,0.06))' }}>
        🎉
      </div>
      <h1 className="text-[26px] md:text-3xl font-black mb-2 leading-tight" style={{ color: NAVY }}>{titulo}</h1>
      <p className="text-sm mb-5" style={{ color: '#6B7A99' }}>{texto}</p>

      {resenaUrl && (
        <a href={resenaUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => track(EVENTOS.reviewClicked)}
          className="block w-full font-black text-white py-4 rounded-2xl mb-3 text-center"
          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', fontSize: 16, boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
          ⭐ Dejar una reseña en Google
        </a>
      )}
      <button onClick={compartir}
        className="block w-full font-black py-3.5 rounded-2xl text-center"
        style={{ background: 'rgba(21,101,192,0.08)', color: AZUL, fontSize: 15 }}>
        Compartir Alce Kids
      </button>

      {fallback && (
        <div className="mt-3 rounded-2xl p-3 text-left" style={{ background: '#F8FAFF', border: '1px solid rgba(21,101,192,0.12)' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#6B7A99' }}>{fallback.mensaje}</p>
          <div className="flex gap-2 flex-wrap">
            <a href={fallback.whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs font-black px-3 py-2.5 rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
              Compartir por WhatsApp
            </a>
            <button onClick={copiar} className="text-xs font-black px-3 py-2.5 rounded-xl"
              style={copiado ? { background: '#22c55e', color: 'white' } : { background: 'rgba(21,101,192,0.08)', color: AZUL }}>
              {copiado ? '✓ Copiado' : 'Copiar mensaje'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confirmar Datos Finales (documento "FASE 2B — IMPLEMENTAR BLOQUE 1",
// 21-sep-2026, §6) — sin checkbox contractual, sin T&C nuevos, sin
// alergias/salud/fotografías. Cada confirmación exitosa es un INSERT
// nuevo del lado del servidor: acá simplemente se vuelve a cargar el
// resumen para mostrar la confirmación más reciente.
function SeccionDatosFinales({ codigo, idParam, tParam, contratado, datosFinales, onGuardado }) {
  const [editando, setEditando] = useState(!datosFinales);
  const [ninosFinal, setNinosFinal] = useState(datosFinales?.ninosFinal ?? contratado?.ninos ?? 0);
  const [mayoresFinal, setMayoresFinal] = useState(datosFinales?.mayoresFinal ?? contratado?.mayores ?? 0);
  const [adultosAprox, setAdultosAprox] = useState(datosFinales?.adultosAprox ?? '');
  const [adultoResponsable, setAdultoResponsable] = useState(datosFinales?.adultoResponsable ?? '');
  const [telefonoOperacional, setTelefonoOperacional] = useState(datosFinales?.telefonoOperacional ?? '');
  const [observacion, setObservacion] = useState(datosFinales?.observacion ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const enviandoRef = useRef(false);

  const confirmar = async () => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError('');
    try {
      const r = await fetch('/api/mi-celebracion/datos-finales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: idParam, t: tParam,
          ninosFinal: Number(ninosFinal), mayoresFinal: Number(mayoresFinal),
          adultosAprox: Number(adultosAprox), adultoResponsable, telefonoOperacional, observacion,
        }),
      });
      const j = await r.json();
      if (j.ok) {
        setEditando(false);
        await onGuardado();
      } else {
        setError((j.errores && j.errores[0]) || 'No pudimos guardar los datos. Revisa e inténtalo de nuevo.');
      }
    } catch {
      setError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (!editando && datosFinales) {
    return (
      <Seccion titulo="Datos finales">
        <p className="font-black mb-1" style={{ color: VERDE }}>Datos finales confirmados ✓</p>
        <p className="text-xs mb-2" style={{ color: '#9CA9C4' }}>{fmtFechaHora(datosFinales.confirmadoEn)}</p>
        <Fila k="Niños" v={datosFinales.ninosFinal} />
        <Fila k="De 7 años o más" v={datosFinales.mayoresFinal} />
        <Fila k="Adultos aprox." v={datosFinales.adultosAprox} />
        <Fila k="Responsable" v={datosFinales.adultoResponsable} />
        <Fila k="Teléfono del día" v={datosFinales.telefonoOperacional} />
        {datosFinales.observacion && <p className="text-sm mt-2" style={{ color: '#6B7A99' }}>{datosFinales.observacion}</p>}
        <button onClick={() => setEditando(true)}
          className="text-xs font-black mt-3" style={{ color: AZUL }}>
          Actualizar datos finales
        </button>
      </Seccion>
    );
  }

  return (
    <Seccion titulo="Confirmar datos finales">
      <p className="text-sm mb-3" style={{ color: '#6B7A99' }}>
        Al confirmar, guardaremos estos datos como la información final informada para preparar tu celebración.
      </p>
      <Campo label="Niños que asistirán">
        <input type="number" min="0" value={ninosFinal} onChange={(e) => setNinosFinal(e.target.value)} style={estiloCampo} />
      </Campo>
      <Campo label="De ellos, niños de 7 años o más">
        <input type="number" min="0" value={mayoresFinal} onChange={(e) => setMayoresFinal(e.target.value)} style={estiloCampo} />
      </Campo>
      <Campo label="Adultos aproximados">
        <input type="number" min="0" value={adultosAprox} onChange={(e) => setAdultosAprox(e.target.value)} style={estiloCampo} />
      </Campo>
      <Campo label="Adulto responsable">
        <input type="text" value={adultoResponsable} onChange={(e) => setAdultoResponsable(e.target.value)} style={estiloCampo} />
      </Campo>
      <Campo label="Teléfono de contacto del día">
        <input type="tel" value={telefonoOperacional} onChange={(e) => setTelefonoOperacional(e.target.value)} style={estiloCampo} />
      </Campo>
      <Campo label="Observación operacional (opcional)">
        <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={500} rows={2} style={estiloCampo} />
      </Campo>
      {error && <p className="text-sm mb-2" style={{ color: '#DC2626' }}>{error}</p>}
      <button onClick={confirmar} disabled={enviando}
        className="w-full font-black text-white py-3.5 rounded-2xl mt-2 disabled:opacity-60"
        style={{ background: `linear-gradient(135deg,${AZUL},#1976D2)` }}>
        {enviando ? 'Guardando…' : 'Confirmar datos finales'}
      </button>
    </Seccion>
  );
}

const estiloCampo = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1.5px solid rgba(21,101,192,0.18)', fontSize: '14px',
};

function Campo({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-bold mb-1" style={{ color: '#6B7A99' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Agregar un adicional después de reservar (documento §8) — reutiliza
// el catálogo tal cual (data/master.js), sin duplicarlo ni recalcular
// nada acá: el servidor (itemVisible() + motor de precios) decide si
// corresponde y cuánto cuesta.
function SeccionAgregarAdicional({ idParam, tParam, extrasIds, onAgregado }) {
  const [abierta, setAbierta] = useState(false);
  const [agregando, setAgregando] = useState(null);
  const [tematicaPendiente, setTematicaPendiente] = useState(null); // itemId que pide temática
  const [tematicaTexto, setTematicaTexto] = useState('');
  const [error, setError] = useState('');
  const [ultimoDiff, setUltimoDiff] = useState(null);

  const categorias = CATEGORIAS_ADICIONALES.filter((c) => CATEGORIAS_OFRECIDAS.includes(c.id));

  const enviar = async (itemId, tematica) => {
    setAgregando(itemId);
    setError('');
    try {
      const r = await fetch('/api/mi-celebracion/agregar-adicional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idParam, t: tParam, itemId, tematica }),
      });
      const j = await r.json();
      if (j.ok) {
        setUltimoDiff(j.sinCambios ? null : j.diferencia);
        setTematicaPendiente(null);
        setTematicaTexto('');
        await onAgregado();
      } else {
        setError(j.errores?.[0] || 'No pudimos agregarlo. Puede que ya no esté disponible para tu celebración.');
      }
    } catch {
      setError('No pudimos conectarnos. Inténtalo de nuevo.');
    } finally {
      setAgregando(null);
    }
  };

  const clickAgregar = (item) => {
    if (IDS_DECORACION_TEMATICA.has(item.id)) {
      setTematicaPendiente(item.id);
      return;
    }
    enviar(item.id, null);
  };

  return (
    <Seccion titulo="Agregar un adicional">
      {!abierta ? (
        <button onClick={() => setAbierta(true)} className="text-sm font-black" style={{ color: AZUL }}>
          ✨ Ver adicionales disponibles
        </button>
      ) : (
        <div>
          {ultimoDiff != null && (
            <p className="text-sm mb-2 font-bold" style={{ color: VERDE }}>
              Agregado — se sumó {clp(ultimoDiff)} a tu total.
            </p>
          )}
          {error && <p className="text-sm mb-2" style={{ color: '#DC2626' }}>{error}</p>}
          {categorias.map((cat) => (
            <div key={cat.id} className="mb-3">
              <p className="text-xs font-black uppercase tracking-wide mb-1.5" style={{ color: '#9CA9C4' }}>
                {cat.emoji} {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.filter((i) => !extrasIds.includes(i.id)).map((item) => (
                  <button key={item.id}
                    onClick={() => clickAgregar(item)}
                    disabled={agregando === item.id}
                    className="text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50"
                    style={{ color: AZUL, background: 'rgba(21,101,192,0.08)' }}>
                    {agregando === item.id ? 'Agregando…' : `+ ${item.emoji || ''} ${item.nombre}`}
                  </button>
                ))}
              </div>
              {tematicaPendiente && cat.items.some((i) => i.id === tematicaPendiente) && (
                <div className="rounded-xl p-3 mt-2" style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                  <label className="block text-xs font-black mb-1.5" style={{ color: '#9A3412' }}>
                    ¿Qué temática quieres para la celebración?
                  </label>
                  <input type="text" value={tematicaTexto} onChange={(e) => setTematicaTexto(e.target.value)}
                    placeholder="Ej.: Minnie, dinosaurios, fútbol, princesas, Stitch..."
                    className="w-full px-3 py-2 rounded-lg text-sm mb-2" style={{ border: '1.5px solid #FED7AA' }} />
                  <p className="text-xs mb-2" style={{ color: '#9A3412' }}>
                    La temática está sujeta a disponibilidad de materiales y proveedores. Algunas
                    temáticas muy específicas pueden requerir hasta 3 semanas de anticipación. Si
                    necesitamos proponerte una alternativa, te contactaremos.
                  </p>
                  <button
                    onClick={() => enviar(tematicaPendiente, tematicaTexto)}
                    disabled={!tematicaTexto.trim() || agregando === tematicaPendiente}
                    className="text-xs font-black px-3 py-2 rounded-lg text-white disabled:opacity-50"
                    style={{ background: '#EA580C' }}>
                    Confirmar temática y agregar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Seccion>
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

function Icono({ emoji }) {
  return (
    <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5" style={{ background: 'rgba(21,101,192,0.10)' }}>
      {emoji}
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div className="mt-4 text-left rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(21,101,192,0.12)' }}>
      <p className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: '#6B7A99' }}>{titulo}</p>
      {children}
    </div>
  );
}

function Fila({ k, v, color }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1 text-sm">
      <span style={{ color: '#6B7280' }}>{k}</span>
      <span className="font-black" style={{ color: color || '#374151' }}>{v}</span>
    </div>
  );
}

function BotonWhatsApp({ href, texto = 'Hablar por WhatsApp' }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 w-full font-black text-white py-4 md:py-3.5 rounded-2xl"
      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', fontSize: 16 }}>
      {texto}
    </a>
  );
}
