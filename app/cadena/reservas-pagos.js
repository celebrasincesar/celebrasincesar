'use client';

// ══════════════════════════════════════════════════════════════════════
// PANEL DE RESERVAS Y PAGOS — /cadena
// ──────────────────────────────────────────────────────────────────────
// La vista mínima de la especificación (§21): reserva, fecha, turno,
// cliente, total, pagado, saldo, estado, estado tributario. Más las tres
// acciones que César necesita para el día a día:
//   · generar un link de pago (saldo o adicional) para mandar por WhatsApp
//   · marcar una boleta como emitida cuando la hace a mano en el SII
//   · reverificar el estado de un pago contra Flow, sin esperar el webhook
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { clp, opcionesHorario, TRAMOS_MAYORES, ITEMS, CATEGORIA_DE_ITEM } from '../../data/reglas';
import { NEGOCIO } from '../../data/master';
import { ModificarReserva } from './modificar-reserva';

const AZUL = '#1565C0';

// Nomenclatura UX (documento "Quiero mejorar urgentemente la información
// operativa…", 09-sep-2026, §4): "Confirmada" y "Confirmada · saldo
// pendiente" eran dos etiquetas distintas para lo que al papá y a César les
// importa igual — el anticipo ya está pagado. Se unifican en una sola
// etiqueta visible; los estados internos CONFIRMED/BALANCE_PENDING no
// cambian en ningún otro lado del sistema, solo el texto que se muestra acá.
const ETIQUETA_ESTADO = {
  DRAFT: 'Borrador', PENDING_PAYMENT: 'Esperando anticipo', PAYMENT_VERIFYING: 'Verificando pago',
  CONFIRMED: 'Anticipo pagado · saldo pendiente', BALANCE_PENDING: 'Anticipo pagado · saldo pendiente',
  PAID: 'Pagada completa',
  CANCELLED: 'Cancelada', REFUNDED: 'Devuelta', COMPLETED: 'Celebrada', EXPIRED: 'Expirada',
  // Pago tardío: el turno ya era de otra reserva vigente. Requiere que
  // César lo resuelva a mano (reagendar o devolver) — nunca se automatiza.
  PAYMENT_CONFLICT: '⚠ Pago recibido — turno en conflicto',
};

// Filtros del panel: agrupan estados internos bajo una etiqueta clara sin
// cambiar la máquina de estados (§4). "Esperando anticipo" agrupa
// PENDING_PAYMENT y PAYMENT_VERIFYING (el papá todavía no tiene el turno
// asegurado); "Anticipo pagado" agrupa CONFIRMED y BALANCE_PENDING (el
// turno ya es suyo, falta o no el saldo).
const FILTROS = [
  { id: 'todas', label: 'Todas', estados: null },
  { id: 'esperando', label: 'Esperando anticipo', estados: ['PENDING_PAYMENT', 'PAYMENT_VERIFYING'] },
  { id: 'anticipo', label: 'Anticipo pagado · saldo pendiente', estados: ['CONFIRMED', 'BALANCE_PENDING'] },
  { id: 'completa', label: 'Pagada completa', estados: ['PAID'] },
];
// Mismos 4 estados que ESTADOS_FIRMES en lib/reservas.js — el turno ya es
// del papá de verdad. Se repite acá a propósito (el panel es 'use client',
// no importa lib/reservas.js) para decidir cuándo mostrar el aviso de
// confirmación contractual pendiente (documento "No autorizo todavía el
// deploy...", 15-sep-2026, §9).
const ESTADOS_FIRMES_PANEL = ['CONFIRMED', 'BALANCE_PENDING', 'PAID', 'COMPLETED'];

const COLOR_ESTADO = {
  CONFIRMED: '#16a34a', BALANCE_PENDING: '#F97316', PAID: '#16a34a',
  PENDING_PAYMENT: '#9CA3AF', PAYMENT_VERIFYING: '#1565C0',
  CANCELLED: '#DC2626', REFUNDED: '#DC2626', EXPIRED: '#9CA3AF', COMPLETED: '#6B7280',
  PAYMENT_CONFLICT: '#DC2626',
};
const ETIQUETA_TRIBUTARIO = {
  NOT_REQUIRED_VOUCHER: 'Voucher OK', PENDING_BVE: 'Falta boleta',
  ISSUED: 'Boleta emitida', MANUAL_REVIEW: 'Revisar a mano', ERROR: 'Error',
};

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtFechaLarga = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Bloques con etiqueta de la ficha completa de una reserva (documento
// "Quiero mejorar urgentemente la información operativa…", 09-sep-2026).
function FichaSeccion({ titulo, children }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>{titulo}</p>
      {children}
    </div>
  );
}
function FichaGrid({ children }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>;
}
function FichaDato({ k, v, color }) {
  return (
    <div className="text-xs">
      <span className="text-gray-400">{k}: </span>
      <b style={{ color: color || '#374151' }}>{v}</b>
    </div>
  );
}

export function ReservasPagos() {
  const [estadoPagos, setEstadoPagos] = useState(null); // /api/pagos/estado
  const [reservas, setReservas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [migrando, setMigrando] = useState(false);
  const [avisoDb, setAvisoDb] = useState('');
  const [modalManualAbierto, setModalManualAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rEstado, rReservas] = await Promise.all([
        fetch('/api/pagos/estado', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/cadena/reservas', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);
      setEstadoPagos(rEstado);
      setReservas(rReservas?.ok ? rReservas.reservas : []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const inicializarDb = async () => {
    setMigrando(true);
    setAvisoDb('');
    try {
      const r = await fetch('/api/cadena/setup-db', { method: 'POST' });
      const j = await r.json();
      setAvisoDb(j.ok ? `Listo: ${j.sentencias} sentencias aplicadas.` : `No se pudo: ${j.motivo || j.error || 'error desconocido'}`);
      if (j.ok) cargar();
    } catch {
      setAvisoDb('No se pudo conectar con el servidor.');
    } finally {
      setMigrando(false);
    }
  };

  if (cargando && !reservas) {
    return <SeccionPagos><p className="text-sm text-gray-400 text-center py-6">Cargando reservas y pagos…</p></SeccionPagos>;
  }

  // ── Pagos por la web todavía no disponibles ──────────────────────────
  if (estadoPagos && !estadoPagos.pagosHabilitados) {
    const piezas = estadoPagos.piezas || {};
    return (
      <SeccionPagos>
        <p className="text-sm text-gray-500 mb-3">
          El pago por la web todavía no está activo. Falta:
        </p>
        <ul className="text-sm space-y-1 mb-4">
          <li>{piezas.baseDatos ? '✅' : '⬜️'} Base de datos conectada (variable POSTGRES_URL / DATABASE_URL)</li>
          <li>{piezas.baseDatos && piezas.esquema ? '✅' : '⬜️'} Tablas creadas</li>
          <li>{piezas.flow ? '✅' : '⬜️'} Credenciales de Flow (FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_CONFIRMATION_URL, FLOW_RETURN_URL)</li>
        </ul>
        <div className="flex gap-2 flex-wrap">
          {piezas.baseDatos && !piezas.esquema && (
            <button onClick={inicializarDb} disabled={migrando}
              className="text-sm font-black px-4 py-2.5 rounded-xl text-white disabled:opacity-50"
              style={{ background: AZUL }}>
              {migrando ? 'Creando tablas…' : 'Crear tablas de reservas y pagos'}
            </button>
          )}
          {piezas.flow && <BotonFlowPing />}
        </div>
        {avisoDb && <p className="text-xs mt-2 text-gray-500">{avisoDb}</p>}
        <p className="text-xs text-gray-400 mt-4">
          Mientras tanto, las reservas siguen funcionando por WhatsApp, tal como hasta ahora.
        </p>
      </SeccionPagos>
    );
  }

  const estadosFiltro = FILTROS.find((f) => f.id === filtro)?.estados || null;
  const lista = (reservas || []).filter((r) => !estadosFiltro || estadosFiltro.includes(r.estado));
  const boletasPendientes = (reservas || [])
    .flatMap((r) => (r.pagos || []).filter((p) => p.tributario === 'PENDING_BVE').map((p) => ({ ...p, reserva: r })));
  // Hallazgo real 30-sep-2026: antes de esto, una invitación solicitada no
  // dejaba ningún rastro. Mismo criterio de "pendiente real" que las
  // boletas — se calcula en el servidor (necesitaInvitacion), acá solo se
  // filtra y se pinta.
  const invitacionesPendientes = (reservas || []).filter((r) => r.necesitaInvitacion);

  return (
    <>
      {(boletasPendientes.length > 0 || invitacionesPendientes.length > 0) && (
        <div className="flex gap-2 flex-wrap mb-4">
          {boletasPendientes.length > 0 && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: '#FEF3E2', border: '1.5px solid #FDBA74' }}>
              <span className="font-black text-sm" style={{ color: '#C2410C' }}>
                📋 {boletasPendientes.length} boleta{boletasPendientes.length === 1 ? '' : 's'} SII pendiente{boletasPendientes.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
          {invitacionesPendientes.length > 0 && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2"
              style={{ background: '#FCE7F3', border: '1.5px solid #F9A8D4' }}>
              <span className="font-black text-sm" style={{ color: '#BE185D' }}>
                💌 {invitacionesPendientes.length} {invitacionesPendientes.length === 1 ? 'invitación digital pendiente' : 'invitaciones digitales pendientes'}
              </span>
            </div>
          )}
        </div>
      )}

      {boletasPendientes.length > 0 && (
        <SeccionPagos titulo="📋 Boletas SII pendientes">
          <div className="space-y-3">
            {boletasPendientes.map((p) => (
              <FilaBoletaPendiente key={p.id} pago={p} onListo={cargar} />
            ))}
          </div>
        </SeccionPagos>
      )}

      {invitacionesPendientes.length > 0 && (
        <SeccionPagos titulo="💌 Invitaciones digitales pendientes">
          <div className="space-y-3">
            {invitacionesPendientes.map((r) => (
              <FilaInvitacionPendiente key={r.id} reserva={r} onListo={cargar} />
            ))}
          </div>
        </SeccionPagos>
      )}

      <SeccionPagos titulo="💳 Reservas y pagos">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className="text-xs font-black px-3 py-1.5 rounded-full transition-all"
                style={filtro === f.id
                  ? { background: AZUL, color: 'white' }
                  : { background: 'rgba(21,101,192,0.08)', color: AZUL }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setModalManualAbierto(true)}
            className="text-xs font-black px-3.5 py-2 rounded-full text-white whitespace-nowrap"
            style={{ background: '#0D1B3E' }}>
            + Crear reserva manual
          </button>
        </div>

        {lista.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No hay reservas en este filtro.</p>
        )}

        <div className="space-y-3">
          {lista.map((r) => <FilaReserva key={r.id} reserva={r} onCambio={cargar} />)}
        </div>
      </SeccionPagos>

      {modalManualAbierto && (
        <ModalReservaManual
          onCerrar={() => setModalManualAbierto(false)}
          onCreada={() => { setModalManualAbierto(false); cargar(); }}
        />
      )}
    </>
  );
}

function SeccionPagos({ titulo, children }) {
  return (
    <section className="bg-white rounded-3xl p-5 mb-8" style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
      {titulo && <h2 className="font-black text-lg mb-4" style={{ color: AZUL }}>{titulo}</h2>}
      {children}
    </section>
  );
}

const MEDIOS_MANUALES = [
  { id: 'TRANSFERENCIA_BANCOESTADO', label: 'Transferencia BancoEstado' },
  { id: 'EFECTIVO', label: 'Efectivo' },
  { id: 'SUPER_COMPRAQUI', label: 'Súper Compraquí (presencial)' },
];

// ── Resumen operacional (documento "FASE 2B — IMPLEMENTAR BLOQUE 2",
// 21-sep-2026, §6/§15): "¿qué hay que preparar y qué falta resolver?" en
// un vistazo — nunca duplica la ficha administrativa completa, que sigue
// más abajo. `r.resumenOperacional` ya viene calculado por el servidor
// (lib/resumen-operacional.js), este componente solo lo pinta.
const EMOJI_CHIP = { ok: '🟢', alerta: '🟡', critico: '🔴' };
const FONDO_CHIP = { ok: 'rgba(34,197,94,0.1)', alerta: 'rgba(249,115,22,0.1)', critico: 'rgba(220,38,38,0.1)' };
const COLOR_CHIP = { ok: '#166534', alerta: '#C2410C', critico: '#DC2626' };
const ETIQUETA_TIPO_PENDIENTE = { decoracion_tematica: '🎨 Decoración', animacion: '🎭 Animación' };
const ETIQUETA_ESTADO_PENDIENTE_DETALLE = {
  PENDIENTE: 'Pendiente', REVISAR_DESPUES: 'Revisar más adelante', CONFIRMADO: 'Confirmado ✓', NO_DISPONIBLE: 'No disponible ⚠',
};
const COLOR_ESTADO_PENDIENTE = { CONFIRMADO: '#16a34a', NO_DISPONIBLE: '#DC2626' };

function ResumenOperacional({ r }) {
  const resumen = r.resumenOperacional;
  if (!resumen) return null;
  const { chips, asistencia, responsable, todoListo } = resumen;

  return (
    <FichaSeccion titulo="📋 Resumen operacional">
      {todoListo && (
        <div className="rounded-xl px-3 py-2 mb-2 text-sm font-black text-center" style={{ background: 'rgba(34,197,94,0.1)', color: '#166534' }}>
          Todo listo para celebrar 🎉
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map((c, i) => (
          <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: FONDO_CHIP[c.nivel], color: COLOR_CHIP[c.nivel] }}>
            {EMOJI_CHIP[c.nivel]} {c.texto}
          </span>
        ))}
      </div>

      <FichaGrid>
        {asistencia.contratacionVigente && <FichaDato k="Contratación vigente" v={asistencia.contratacionVigente} />}
        {asistencia.finalInformada != null && <FichaDato k="Final informada" v={`${asistencia.finalInformada} niños`} />}
        {asistencia.sieteMas != null && <FichaDato k="Niños de 7+ años" v={`${asistencia.sieteMas}`} />}
        {asistencia.adultosAprox != null && <FichaDato k="Adultos aprox." v={`${asistencia.adultosAprox}`} />}
      </FichaGrid>

      {responsable && (
        <div className="mt-2 text-xs" style={{ color: '#374151' }}>
          <span className="text-gray-400">Responsable del día: </span>
          <b>{responsable.nombre}</b> · {responsable.telefono}
        </div>
      )}

      {(r.pendientesProveedor || []).length > 0 && (
        <div className="space-y-1 mt-3 pt-3" style={{ borderTop: '1px dashed rgba(21,101,192,0.15)' }}>
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Pendientes con proveedor</p>
          {r.pendientesProveedor.map((p) => (
            <div key={p.id} className="text-xs flex items-center justify-between gap-2 flex-wrap">
              <span className="text-gray-600">
                {ETIQUETA_TIPO_PENDIENTE[p.tipo] || p.tipo}{p.detalle ? ` — ${p.detalle}` : ''}
              </span>
              <span className="font-bold" style={{ color: COLOR_ESTADO_PENDIENTE[p.estado] || '#CA8A04' }}>
                {ETIQUETA_ESTADO_PENDIENTE_DETALLE[p.estado] || p.estado}
              </span>
            </div>
          ))}
        </div>
      )}
    </FichaSeccion>
  );
}

function FilaReserva({ reserva: r, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [manualAbierto, setManualAbierto] = useState(false);

  const saldo = Math.max(0, (r.total || 0) - (r.pagado || 0));
  const sobrepago = Math.max(0, (r.pagado || 0) - (r.total || 0));

  const generarLink = async (tipo) => {
    setGenerando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/link-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: r.codigo, tipo }),
      });
      const j = await res.json();
      if (j.ok && j.checkoutUrl) {
        await navigator.clipboard.writeText(j.checkoutUrl).catch(() => {});
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      } else {
        setAviso(j.motivo === 'nada_por_cobrar' ? 'No hay saldo por cobrar.' : `No se pudo generar el link (${j.motivo || 'error'}).`);
      }
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setGenerando(false);
    }
  };

  const d = r.detalle || {};
  const tramoNinosLabel = TRAMOS_NINOS_MANUAL.find((t) => t.id === d.tramoInvitados)?.label || d.tramoInvitados;
  const tramoMayoresLabel = TRAMOS_MAYORES_MANUAL.find((t) => t.id === d.tramoMayores)?.label || d.tramoMayores;

  return (
    <div className="rounded-2xl p-4" style={{ background: '#F8FAFF', border: '1px solid rgba(21,101,192,0.1)' }}>
      <button onClick={() => setAbierto((v) => !v)} className="w-full text-left">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>{r.codigo} · {r.cliente_nombre}</p>
            <p className="text-xs text-gray-400">{fmtFecha(r.fecha_evento)} · {r.turno}{d.festejado ? ` · ${d.festejado}` : ''}</p>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: `${COLOR_ESTADO[r.estado] || '#9CA3AF'}18`, color: COLOR_ESTADO[r.estado] || '#6B7280' }}>
            {ETIQUETA_ESTADO[r.estado] || r.estado}
          </span>
        </div>
        <div className="flex gap-4 mt-2 text-xs flex-wrap items-center">
          <span className="text-gray-400">Total <b className="text-gray-700">{clp(r.total)}</b></span>
          <span className="text-gray-400">Pagado <b style={{ color: '#16a34a' }}>{clp(r.pagado)}</b></span>
          {/* Saldo pendiente es un estado normal, no una alarma (Fase 5
              Bloque 3) — mismo tono informativo que el resto de la fila. */}
          {saldo > 0 && <span className="text-gray-400">Saldo <b style={{ color: AZUL }}>{clp(saldo)}</b></span>}
          {sobrepago > 0 && (
            <span className="font-black px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>
              ⚠ Sobrepago {clp(sobrepago)}
            </span>
          )}
          {ESTADOS_FIRMES_PANEL.includes(r.estado) && !r.contractual_email_enviado && (
            <span
              className="font-black px-2 py-0.5 rounded-full"
              style={{ background: '#FEF3C7', color: '#92400E' }}
              title="El correo con la ficha de la reserva y el PDF de T&C todavía no se entregó — se reintenta automáticamente"
            >
              ⏳ Confirmación contractual pendiente de entrega
            </span>
          )}
          <span className="ml-auto font-black" style={{ color: AZUL }}>{abierto ? 'Ocultar detalle ▴' : 'Ver detalle ▾'}</span>
        </div>
      </button>

      {abierto && (
        <div className="mt-3 pt-3 space-y-4" style={{ borderTop: '1px solid rgba(21,101,192,0.1)' }}>

          <ResumenOperacional r={r} />

          <DesgloseCompleto r={r} d={d} tramoNinosLabel={tramoNinosLabel} tramoMayoresLabel={tramoMayoresLabel} />

          <FichaSeccion titulo="🎉 Celebración">
            <FichaGrid>
              <FichaDato k="Código" v={r.codigo} />
              <FichaDato k="Estado" v={ETIQUETA_ESTADO[r.estado] || r.estado} />
              <FichaDato k="Fecha" v={fmtFechaLarga(r.fecha_evento)} />
              <FichaDato k="Turno" v={r.turno} />
              <FichaDato k="Horario efectivo" v={r.hora_inicio && r.hora_termino ? `${r.hora_inicio}–${r.hora_termino}` : '—'} />
              <FichaDato k="Sector" v={r.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo'} />
              <FichaDato k="Festejado/a" v={d.festejado || '—'} />
              <FichaDato k="Edad" v={d.edad != null ? `${d.edad} años` : '—'} />
              <FichaDato k="Tramo de niños" v={tramoNinosLabel || '—'} />
              {d.totalNinos != null && <FichaDato k="Total niños" v={`${d.totalNinos}`} />}
              <FichaDato k="Mayores de 6" v={tramoMayoresLabel || '—'} />
            </FichaGrid>
          </FichaSeccion>

          <FichaSeccion titulo="👤 Apoderado">
            <FichaGrid>
              <FichaDato k="Nombre" v={r.cliente_nombre} />
              <FichaDato k="Teléfono" v={r.cliente_telefono} />
              <FichaDato k="Email" v={r.cliente_email} />
            </FichaGrid>
          </FichaSeccion>

          {(d.adicionales?.length > 0 || d.pack) && (
            <FichaSeccion titulo="✨ Adicionales contratados">
              <ul className="space-y-1">
                {d.pack && (
                  <li className="text-xs flex justify-between gap-2" style={{ color: '#374151' }}>
                    <span>🎀 {d.pack.nombre} <span className="text-gray-400">({d.pack.incluye})</span></span>
                    {d.pack.precio != null && <b>{clp(d.pack.precio)}</b>}
                  </li>
                )}
                {d.adicionales.map((a) => (
                  <li key={a.id} className="text-xs flex justify-between gap-2" style={{ color: '#374151' }}>
                    <span>{a.emoji ? `${a.emoji} ` : ''}{a.nombre}</span>
                    {a.precio != null && <b>{clp(a.precio)}</b>}
                  </li>
                ))}
              </ul>
            </FichaSeccion>
          )}

          {d.incluidos?.length > 0 && (
            <FichaSeccion titulo="✅ Incluidos / preparar">
              <ul className="flex flex-wrap gap-1.5">
                {d.incluidos.map((i) => (
                  <li key={i.id} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
                    {i.emoji ? `${i.emoji} ` : ''}{i.nombre}
                  </li>
                ))}
              </ul>
            </FichaSeccion>
          )}

          <FichaSeccion titulo="✏️ Editar adicionales">
            {r.esManual && (
              <p className="text-[11px] text-gray-400 mb-2">
                Reserva cargada manualmente: el total negociado se mantiene como base y cada adicional se
                suma a su precio de catálogo (según el tramo de niños).
              </p>
            )}
            <EditorAdicionales reserva={r} onCambio={onCambio} />
          </FichaSeccion>

          {ESTADOS_FIRMES_PANEL.includes(r.estado) && (
            <FichaSeccion titulo="🛠 Modificar fecha y datos">
              <ModificarReserva reserva={r} onCambio={onCambio} />
            </FichaSeccion>
          )}

          <FichaSeccion titulo="💰 Pago">
            <FichaGrid>
              <FichaDato k="Total" v={clp(r.total)} />
              <FichaDato k="Anticipo" v={clp(r.anticipo)} />
              <FichaDato k="Pagado" v={clp(r.pagado)} color="#16a34a" />
              <FichaDato k="Saldo" v={clp(saldo)} color={saldo > 0 ? AZUL : undefined} />
              {r.saldoVenceEn && <FichaDato k="Fecha límite del saldo" v={fmtFecha(r.saldoVenceEn)} />}
            </FichaGrid>

            {(r.pagos || []).length > 0 && (
              <div className="space-y-1.5 mt-3 pt-3" style={{ borderTop: '1px dashed rgba(21,101,192,0.15)' }}>
                <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Historial de pagos</p>
                {r.pagos.map((p) => (
                  <div key={p.id} className="text-xs flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-gray-500">
                      {ETIQUETA_TIPO_PAGO[p.tipo] || p.tipo} · <b className="text-gray-700">{clp(p.monto)}</b> · {fmtFecha(p.confirmado)} · {p.estado}
                      {p.medio ? ` · ${p.medio}` : ''}
                      {p.tributarioRef ? ` · folio ${p.tributarioRef}` : ''}
                    </span>
                    <span className="font-bold" style={{ color: p.tributario === 'PENDING_BVE' ? '#F97316' : '#6B7280' }}>
                      {ETIQUETA_TRIBUTARIO[p.tributario] || p.tributario}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FichaSeccion>

          <div className="flex gap-2 flex-wrap">
            {saldo > 0 && (
              <button onClick={() => generarLink('BALANCE')} disabled={generando}
                className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
                style={{ background: copiado ? '#22c55e' : 'rgba(21,101,192,0.08)', color: copiado ? 'white' : AZUL }}>
                {copiado ? '✓ Link copiado' : 'Generar link de saldo'}
              </button>
            )}
            {/* Fase 5 Bloque 3: solo copia el texto — César decide cuándo
                (o si) lo manda. Nunca se envía solo ni se marca como
                enviado — esto es ayuda, no cobranza automática. */}
            {saldo > 0 && <BotonCopiarMensajeSaldo reserva={r} festejado={d.festejado} saldo={saldo} />}
            <button onClick={() => generarLink('EXTRA')} disabled={generando}
              className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
              style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
              Link de adicional
            </button>
            <button onClick={() => setManualAbierto((v) => !v)}
              className="text-xs font-black px-3 py-2 rounded-xl"
              style={{ background: 'rgba(13,27,62,0.06)', color: '#0D1B3E' }}>
              {manualAbierto ? 'Cerrar' : '+ Registrar pago manual'}
            </button>
          </div>
          {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}

          {manualAbierto && (
            <FormPagoManual reserva={r} onRegistrado={() => { setManualAbierto(false); onCambio(); }} />
          )}
        </div>
      )}
    </div>
  );
}

const IDS_TEMATICA_EDITOR = new Set(['deco-tematica-simple', 'deco-tematica-full']);

// "¿Qué contrató y por qué paga lo que paga?" (pedido de César, 02-oct-2026,
// reserva CSC-2026-000023): datos contratados al inicio + CADA línea del
// precio —arriendo abierto en base/recargo por niños/recargo por edad,
// cumpleaños compartido con su número de festejados, cada adicional— y una
// fila de cuadre contra el total real (descuentos o ajustes).
function DesgloseCompleto({ r, d, tramoNinosLabel, tramoMayoresLabel }) {
  const lineas = d.desglose;
  const chips = [
    d.festejados ? `${d.festejados} festejado${d.festejados > 1 ? 's' : ''}` : null,
    tramoNinosLabel ? `Niños: ${tramoNinosLabel}${d.ninosSobre30 > 0 ? ` (+${d.ninosSobre30} sobre 30)` : ''}` : null,
    tramoMayoresLabel ? `Mayores de 6: ${tramoMayoresLabel}` : null,
    d.edad != null ? `Edad ${d.edad} años` : null,
    r.sector ? (r.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo') : null,
    r.hora_inicio && r.hora_termino ? `${r.hora_inicio}–${r.hora_termino}` : null,
  ].filter(Boolean);

  if (!lineas) {
    return (
      <FichaSeccion titulo="🧾 Desglose completo">
        <p className="text-xs text-gray-400">
          Esta reserva no guardó un desglose línea por línea (reserva manual o anterior al motor de precios).
          Total acordado: <b>{clp(r.total)}</b>.
        </p>
      </FichaSeccion>
    );
  }

  const suma = lineas.filter((l) => !l.parte).reduce((s, l) => s + l.monto, 0);
  const ajuste = r.total - suma;

  return (
    <FichaSeccion titulo="🧾 Desglose completo">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c) => (
            <span key={c} className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>{c}</span>
          ))}
        </div>
      )}
      <ul className="space-y-1">
        {lineas.map((l, i) => (
          <li key={i} className="text-xs flex justify-between gap-2"
            style={{ color: l.parte ? '#6B7280' : '#374151', paddingLeft: l.parte ? 14 : 0, fontWeight: l.encabezado ? 800 : 400 }}>
            <span>{l.parte ? '↳ ' : ''}{l.concepto}</span>
            <b style={{ fontWeight: l.parte ? 500 : 800 }}>{clp(l.monto)}</b>
          </li>
        ))}
        {ajuste !== 0 && (
          <li className="text-xs flex justify-between gap-2" style={{ color: '#9A3412' }}>
            <span>Descuento / ajuste</span><b>{ajuste < 0 ? '−' : '+'}{clp(Math.abs(ajuste))}</b>
          </li>
        )}
        <li className="text-xs flex justify-between gap-2 pt-1.5 mt-1" style={{ borderTop: '1px solid rgba(21,101,192,0.15)', color: '#0D1B3E' }}>
          <b>TOTAL</b><b>{clp(r.total)}</b>
        </li>
      </ul>
    </FichaSeccion>
  );
}

// Editor de adicionales de una reserva YA confirmada (hallazgo real
// 30-sep-2026): cuando el papá le pide a César por teléfono agregar o
// quitar algo, en vez de hacerlo él mismo desde Mi Celebración. Llama a
// /api/cadena/cambio-comercial, que reutiliza el mismo motor
// (aplicarCambioComercial) que ya usa el papá — nunca un segundo camino
// de reglas propio. Cada acción (agregar o quitar) se aplica de
// inmediato, una a la vez, igual que ya hace Mi Celebración.
function EditorAdicionales({ reserva: r, onCambio }) {
  const d = r.detalle || {};
  const [tematicaTexto, setTematicaTexto] = useState(d.tematica || '');
  const [porAgregar, setPorAgregar] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [aviso, setAviso] = useState('');

  // La temática vigente puede cambiar tras aplicar un cambio (onCambio
  // recarga las reservas) — sin esto, el campo se quedaría mostrando lo
  // que había al abrir la ficha, no lo que quedó guardado.
  useEffect(() => { setTematicaTexto(d.tematica || ''); }, [d.tematica]);

  const idsActuales = [
    ...(d.adicionales || []).map((a) => a.id),
    ...(d.incluidos || []).map((i) => i.id),
  ];

  const disponibles = Object.values(ITEMS)
    .filter((it) => !idsActuales.includes(it.id))
    .sort((a, b) =>
      (CATEGORIA_DE_ITEM[a.id]?.label || '').localeCompare(CATEGORIA_DE_ITEM[b.id]?.label || '')
      || a.nombre.localeCompare(b.nombre));

  const aplicar = async (idsNuevos, tematicaParaEnviar) => {
    setAplicando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/cambio-comercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: r.codigo, extras: idsNuevos, tematica: tematicaParaEnviar || undefined }),
      });
      const j = await res.json();
      if (j.ok) onCambio();
      else setAviso(`No se pudo aplicar (${j.motivo || 'error'}).`);
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setAplicando(false);
    }
  };

  const agregar = () => {
    if (!porAgregar) return;
    if (IDS_TEMATICA_EDITOR.has(porAgregar) && !tematicaTexto.trim()) {
      setAviso('Escribe la temática antes de agregarla.');
      return;
    }
    aplicar([...idsActuales, porAgregar], tematicaTexto.trim() || null);
    setPorAgregar('');
  };

  const quitar = (id) => aplicar(idsActuales.filter((x) => x !== id), tematicaTexto.trim() || null);

  return (
    <div>
      {idsActuales.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {idsActuales.map((id) => {
            const item = ITEMS[id];
            return (
              <span key={id} className="text-xs font-bold pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5"
                style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
                {item?.emoji ? `${item.emoji} ` : ''}{item?.nombre || id}
                <button onClick={() => quitar(id)} disabled={aplicando} aria-label={`Quitar ${item?.nombre || id}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] disabled:opacity-50"
                  style={{ background: 'rgba(21,101,192,0.18)' }}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-end">
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Agregar ítem</span>
          <select value={porAgregar} onChange={(e) => setPorAgregar(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }}>
            <option value="">Elegir…</option>
            {disponibles.map((it) => (
              <option key={it.id} value={it.id}>
                {CATEGORIA_DE_ITEM[it.id]?.label ? `${CATEGORIA_DE_ITEM[it.id].label} · ` : ''}{it.nombre}{it.gratis ? ' (gratis)' : ''}
              </option>
            ))}
          </select>
        </label>
        {IDS_TEMATICA_EDITOR.has(porAgregar) && (
          <label className="text-xs">
            <span className="block text-[11px] text-gray-500 mb-0.5">Temática</span>
            <input value={tematicaTexto} onChange={(e) => setTematicaTexto(e.target.value)} placeholder="Ej: Bluey"
              className="text-xs px-3 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }} />
          </label>
        )}
        <button onClick={agregar} disabled={!porAgregar || aplicando}
          className="text-xs font-black px-3.5 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: AZUL }}>
          {aplicando ? 'Aplicando…' : '+ Agregar'}
        </button>
      </div>
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}

// "Copiar mensaje de saldo" (Fase 5 Bloque 3, §364): mismo texto exacto
// del documento, con el nombre, festejado y el link PRIVADO de Mi
// Celebración (nunca una URL de Flow estática — ahí el saldo se calcula
// vigente, incluso si el papá agregó algo después). Solo copia al
// portapapeles: César decide cuándo mandarlo, no se envía nada solo ni se
// registra como enviado.
function BotonCopiarMensajeSaldo({ reserva: r, festejado, saldo }) {
  const [copiado, setCopiado] = useState(false);
  const nombre = (r.cliente_nombre || '').split(' ')[0] || r.cliente_nombre;
  const link = `${NEGOCIO.sitio}/mi-celebracion?id=${encodeURIComponent(r.codigo)}&t=${encodeURIComponent(r.acceso_token || '')}`;
  const mensaje = `Hola, ${nombre} 😊 Ya se acerca la celebración de ${festejado || r.cliente_nombre}. Te dejo también tu enlace de Mi Celebración por si quieres revisar los detalles o dejar pagado el saldo antes de venir: ${link}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {}
  };

  return (
    <button onClick={copiar} disabled={!r.acceso_token}
      className="text-xs font-black px-3 py-2 rounded-xl disabled:opacity-50"
      style={{ background: copiado ? '#22c55e' : 'rgba(21,101,192,0.08)', color: copiado ? 'white' : AZUL }}>
      {copiado ? '✓ Mensaje copiado' : 'Copiar mensaje de saldo'}
    </button>
  );
}

// Pago recibido fuera de Flow (transferencia directa a BancoEstado,
// efectivo, Súper Compraquí presencial) y registrado a mano por César
// (§7 del documento "Agregar control obligatorio de BVE…", 07-sep-2026).
//
// El monto SIEMPRE se escribe libre, para los tres conceptos — nunca lo
// calcula el servidor acá (a diferencia del link de pago de Flow, §22):
// esto es un registro de lo que YA llegó, no una citación de cuánto cobrar.
// Se sugiere un valor de partida (lo que la reserva tiene pendiente) para
// no partir de $0, pero César lo puede cambiar libremente — y si el monto
// que deja supera lo pendiente, se avisa como sobrepago antes de mandarlo,
// nunca se recorta ni se oculta solo (documento "Bug a revisar antes de
// seguir", 07-sep-2026, encontrado cuando el campo de monto no existía
// para Anticipo/Saldo y el sistema usaba el saldo teórico en su lugar).
function FormPagoManual({ reserva, onRegistrado }) {
  const [tipo, setTipo] = useState('BALANCE');
  const [medio, setMedio] = useState('TRANSFERENCIA_BANCOESTADO');
  const [monto, setMonto] = useState(String(Math.max(0, (reserva.total || 0) - (reserva.pagado || 0)) || ''));
  const [fecha, setFecha] = useState(hoyISO());
  const [referencia, setReferencia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [confirmarSobrepago, setConfirmarSobrepago] = useState(false);

  const saldoPendiente = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  const montoNum = Math.round(Number(monto) || 0);
  const excedeSaldo = montoNum > 0 && montoNum > saldoPendiente;

  const cambiarTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setConfirmarSobrepago(false);
    if (nuevoTipo !== 'EXTRA') {
      const anticipoPendiente = Math.max(0, (reserva.anticipo || 0) - (reserva.pagado || 0));
      setMonto(String((nuevoTipo === 'DEPOSIT' ? anticipoPendiente : saldoPendiente) || ''));
    }
  };

  const registrar = async () => {
    if (excedeSaldo && !confirmarSobrepago) {
      setConfirmarSobrepago(true);
      return;
    }
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/pago-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: reserva.codigo, tipo, medio, fecha, referencia, monto: montoNum }),
      });
      const j = await res.json();
      if (j.ok) onRegistrado();
      else setAviso(`No se pudo registrar (${j.motivo || 'error'}).`);
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-3 pt-3 rounded-xl p-3" style={{ background: '#F8FAFF', border: '1px dashed rgba(13,27,62,0.15)' }}>
      <div className="flex gap-2 flex-wrap items-end">
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Concepto</span>
          <select value={tipo} onChange={(e) => cambiarTipo(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }}>
            <option value="DEPOSIT">Anticipo</option>
            <option value="BALANCE">Saldo</option>
            <option value="EXTRA">Adicional</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Medio</span>
          <select value={medio} onChange={(e) => setMedio(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }}>
            {MEDIOS_MANUALES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Monto recibido</span>
          <input type="number" value={monto}
            onChange={(e) => { setMonto(e.target.value); setConfirmarSobrepago(false); }} placeholder="50000"
            className="text-xs px-2.5 py-2 rounded-xl w-28" style={{ border: `1.5px solid ${excedeSaldo ? '#FCA5A5' : '#E5E7EB'}` }} />
        </label>
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Fecha del pago</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }} />
        </label>
        <label className="text-xs flex-1 min-w-[120px]">
          <span className="block text-[11px] text-gray-500 mb-0.5">Referencia (opcional)</span>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej: comprobante N°123"
            className="text-xs px-2.5 py-2 rounded-xl w-full" style={{ border: '1.5px solid #E5E7EB' }} />
        </label>
        <button onClick={registrar} disabled={enviando || !montoNum}
          className="text-xs font-black px-3.5 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: confirmarSobrepago ? '#DC2626' : '#0D1B3E' }}>
          {enviando ? 'Registrando…' : confirmarSobrepago ? 'Sí, es sobrepago — registrar igual' : 'Registrar pago'}
        </button>
      </div>
      {excedeSaldo && (
        <p className="text-xs mt-2 font-bold" style={{ color: '#DC2626' }}>
          ⚠ {clp(montoNum)} supera lo pendiente ({clp(saldoPendiente)}) por {clp(montoNum - saldoPendiente)}.
          {!confirmarSobrepago && ' Vuelve a tocar "Registrar pago" para confirmar el sobrepago.'}
        </p>
      )}
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}

const ETIQUETA_TIPO_PAGO = { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', EXTRA: 'Adicional' };
const hoyISO = () => new Date().toISOString().slice(0, 10);

function FilaBoletaPendiente({ pago, onListo }) {
  const [folio, setFolio] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [observacion, setObservacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const r = pago.reserva;

  const marcarEmitida = async () => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/boleta-emitida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoId: pago.id, folio, fecha, observacion }),
      });
      const j = await res.json();
      if (j.ok) onListo();
      else setAviso(`No se pudo guardar (${j.motivo || 'error'}).`);
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)' }}>
      <div className="mb-2">
        <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>
          {r.codigo} · {[r.festejado, r.cliente_nombre].filter(Boolean).join(' — ')}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {ETIQUETA_TIPO_PAGO[pago.tipo] || pago.tipo} · <b>{clp(pago.monto)}</b> · {pago.medio || pago.medioTipo || 'medio no informado'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Celebración {fmtFecha(r.fecha_evento)} · Pagado {fmtFecha(pago.confirmado)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {r.cliente_email} · {r.cliente_telefono}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {pago.flowOrder ? `flowOrder ${pago.flowOrder} · ` : ''}commerceOrder {pago.commerceOrder}
        </p>
        <p className="text-xs font-bold mt-1" style={{ color: '#EA580C' }}>⚠️ BVE pendiente</p>
      </div>

      <div className="flex gap-2 flex-wrap items-end pt-2" style={{ borderTop: '1px solid rgba(249,115,22,0.18)' }}>
        <a href="https://www.sii.cl" target="_blank" rel="noopener noreferrer"
          className="text-xs font-black px-3 py-2 rounded-xl"
          style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
          Abrir sitio del SII ↗
        </a>
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">N° folio</span>
          <input value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Opcional"
            className="text-xs px-3 py-2 rounded-xl w-28" style={{ border: '1.5px solid #E5E7EB' }} />
        </label>
        <label className="text-xs">
          <span className="block text-[11px] text-gray-500 mb-0.5">Fecha de emisión</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl" style={{ border: '1.5px solid #E5E7EB' }} />
        </label>
        <label className="text-xs flex-1 min-w-[140px]">
          <span className="block text-[11px] text-gray-500 mb-0.5">Observación (opcional)</span>
          <input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Ej: emitida con 1 día de atraso"
            className="text-xs px-3 py-2 rounded-xl w-full" style={{ border: '1.5px solid #E5E7EB' }} />
        </label>
        <button onClick={marcarEmitida} disabled={enviando}
          className="text-xs font-black px-3.5 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: '#F97316' }}>
          {enviando ? 'Guardando…' : 'Marcar BVE emitida'}
        </button>
      </div>
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}

// Tarjeta de "Invitaciones digitales pendientes" (hallazgo real
// 30-sep-2026, §ver lib/reservas.js invitacionesPendientes): mismo
// formato visual que las boletas SII pendientes, pero sin campos — acá
// solo hay una acción, "ya la mandé".
function FilaInvitacionPendiente({ reserva: r, onListo }) {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const d = r.detalle || {};

  const marcarEnviada = async () => {
    setEnviando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/invitacion-enviada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: r.id }),
      });
      const j = await res.json();
      if (j.ok) onListo();
      else setAviso(`No se pudo guardar (${j.motivo || 'error'}).`);
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  const waHref = `https://wa.me/${(r.cliente_telefono || '').replace(/[^\d]/g, '')}`;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(219,39,119,0.06)', border: '1px solid rgba(219,39,119,0.18)' }}>
      <p className="font-black text-sm" style={{ color: '#0D1B3E' }}>
        {r.codigo} · {[d.festejado, r.cliente_nombre].filter(Boolean).join(' — ')}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        Celebración {fmtFecha(r.fecha_evento)} · {r.cliente_telefono} · {r.cliente_email}
      </p>
      <p className="text-xs font-bold mt-1" style={{ color: '#BE185D' }}>💌 Invitación digital por mandar</p>

      <div className="flex gap-2 flex-wrap items-center pt-2 mt-2" style={{ borderTop: '1px solid rgba(219,39,119,0.18)' }}>
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          className="text-xs font-black px-3 py-2 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
          Abrir WhatsApp ↗
        </a>
        <button onClick={marcarEnviada} disabled={enviando}
          className="text-xs font-black px-3.5 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: '#DB2777' }}>
          {enviando ? 'Guardando…' : 'Marcar enviada'}
        </button>
      </div>
      {aviso && <p className="text-xs text-red-500 mt-2">{aviso}</p>}
    </div>
  );
}

// ── "Primera prueba" de la Fase Sandbox ──────────────────────────────
// Crea UNA orden Flow de $1.000 sin tocar Postgres ni ninguna reserva
// (/api/cadena/flow-ping): sirve para confirmar que la firma y las
// credenciales funcionan antes de probar el flujo completo.
function BotonFlowPing() {
  const [estado, setEstado] = useState('idle'); // idle | cargando | ok | error
  const [resultado, setResultado] = useState(null);

  const probar = async () => {
    setEstado('cargando');
    setResultado(null);
    try {
      const r = await fetch('/api/cadena/flow-ping', { cache: 'no-store' });
      const j = await r.json();
      setResultado(j);
      setEstado(j.ok ? 'ok' : 'error');
    } catch (e) {
      setResultado({ error: e.message });
      setEstado('error');
    }
  };

  return (
    <div>
      <button onClick={probar} disabled={estado === 'cargando'}
        className="text-sm font-black px-4 py-2.5 rounded-xl text-white disabled:opacity-50"
        style={{ background: '#16a34a' }}>
        {estado === 'cargando' ? 'Probando conexión…' : '🔌 Probar conexión con Flow (Sandbox)'}
      </button>

      {estado === 'ok' && resultado && (
        <div className="mt-3 text-xs rounded-xl p-3 space-y-1" style={{ background: 'rgba(34,197,94,0.08)', color: '#166534' }}>
          <p className="font-black">✓ Flow respondió correctamente ({resultado.entorno})</p>
          <p>commerceOrder: {resultado.commerceOrder}</p>
          <p>flowOrder: {resultado.flowOrder}</p>
          <a href={resultado.checkoutUrl} target="_blank" rel="noopener noreferrer"
            className="underline font-bold block mt-1" style={{ color: AZUL }}>
            Abrir checkout de prueba →
          </a>
        </div>
      )}

      {estado === 'error' && resultado && (
        <div className="mt-3 text-xs rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#991B1B' }}>
          <p className="font-black">✗ {resultado.mensaje || 'No se pudo conectar con Flow'}</p>
          {resultado.error && <p className="mt-1">{resultado.error}</p>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// RESERVA MANUAL — para cotizaciones que César ya cerró por WhatsApp
// antes de que existiera el sistema de pagos (documento "Mejora mínima
// para reservas antiguas/manuales", 06-sep-2026). Crea una reserva real
// en Postgres —mismo cerrojo de turno que cualquier otra— y deja listo el
// link de anticipo para copiar y mandar.
// ══════════════════════════════════════════════════════════════════════

// Combinaciones turno+hora-adicional que ofrece data/reglas.js para la fecha
// elegida — no una lista fija: los viernes no tienen AM y el PM admite un
// máximo distinto (documento "Autorización Fase 1A", 13-sep-2026, §9). El
// formulario manual no inventa un horario nuevo ni mantiene su propia tabla,
// consume la misma fuente de verdad que el armador público.
// `op.texto` ya trae el rango horario exacto resultante (ej. "16:00–20:30")
// — ahí vive el dato real; "op.horas" acá es solo el NIVEL de extensión,
// no una cantidad de horas literal (Fase 5 Bloque 1), así que no se
// nombra en el label para no decir "+2 horas" cuando son 90 minutos.
const horaLabel = (op) =>
  op.horas === 0
    ? `${op.turno} · ${op.texto}`
    : `${op.turno} · ${op.texto}${op.precioAdicional ? ` (+${clp(op.precioAdicional)})` : ''}`;

const horariosManualParaFecha = (fecha) =>
  !fecha ? [] : [...opcionesHorario('AM', fecha), ...opcionesHorario('PM', fecha)]
    .map((op) => ({ turno: op.turno, horasAdicionales: op.horas, label: horaLabel(op) }));

// Mismos tramos/categorías que TRAMOS_INVITADOS y TRAMOS_MAYORES de
// data/reglas.js — una sola fuente de verdad; si el negocio cambia estos
// tramos algún día, el formulario manual los sigue sin que nadie se acuerde
// de tocar dos lugares (documento "Ajuste formulario…", 06-sep-2026).
const TRAMOS_NINOS_MANUAL = [
  { id: 'hasta10', label: 'Hasta 10 niños' },
  { id: '11a20', label: '11 a 20 niños' },
  { id: '21a30', label: '21 a 30 niños' },
  { id: '31a40', label: '31 a 40 niños' },
];
const TRAMOS_MAYORES_MANUAL = TRAMOS_MAYORES.map((t) => ({ id: t.id, label: t.corto }));

// Misma regla que puedeElegirSector() de data/reglas.js: Independiente
// solo con "hasta 10" y ningún mayor de 6 — el formulario no deja elegir
// una combinación inválida, la calcula sola.
const sectorDesdeTramos = (tramoInvitados, tramoMayores) =>
  tramoInvitados === 'hasta10' && tramoMayores === 'no' ? 'independiente' : 'completo';

const CAMPOS_INICIALES = {
  referencia: '', apoderado: '', nombreNino: '', email: '', telefono: '',
  fecha: '', horarioIdx: 0, tramoInvitados: 'hasta10', tramoMayores: 'no',
  total: '', anticipo: '', notas: '',
};

function ModalReservaManual({ onCerrar, onCreada }) {
  const [form, setForm] = useState(CAMPOS_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null); // { codigo } tras crear
  const [link, setLink] = useState(null); // { checkoutUrl, ... } tras generar

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  // Cambiar la fecha puede dejar el horario elegido fuera de rango (ej: PM+2
  // seleccionado y se cambia a un viernes, que solo admite hasta PM+1) — se
  // vuelve a 0 para nunca dejar seleccionado un horario que ya no existe.
  const setFecha = (e) => setForm((f) => ({ ...f, fecha: e.target.value, horarioIdx: 0 }));

  const totalNum = Number(form.total) || 0;
  const anticipoNum = Number(form.anticipo) || 0;
  const saldoNum = Math.max(0, totalNum - anticipoNum);
  const horariosDisponibles = useMemo(() => horariosManualParaFecha(form.fecha), [form.fecha]);
  const horarioElegido = horariosDisponibles[Number(form.horarioIdx)] || horariosDisponibles[0] || null;
  const sectorAutomatico = sectorDesdeTramos(form.tramoInvitados, form.tramoMayores);

  const crear = async () => {
    setError('');
    if (!form.apoderado.trim() || !form.nombreNino.trim()) return setError('Falta el nombre del apoderado o del festejado.');
    if (!form.fecha) return setError('Falta la fecha.');
    if (!horarioElegido) return setError('Falta el horario.');
    if (!totalNum || !anticipoNum) return setError('Falta el total o el anticipo.');
    if (anticipoNum > totalNum) return setError('El anticipo no puede ser mayor que el total.');

    setEnviando(true);
    try {
      const res = await fetch('/api/cadena/reserva-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: form.referencia, apoderado: form.apoderado, nombreNino: form.nombreNino,
          email: form.email, telefono: form.telefono, fecha: form.fecha, notas: form.notas,
          turno: horarioElegido.turno, horasAdicionales: horarioElegido.horasAdicionales,
          tramoInvitados: form.tramoInvitados, tramoMayores: form.tramoMayores,
          total: totalNum, anticipo: anticipoNum,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setCreada(j.reserva);
      } else {
        setError(
          j.motivo === 'turno_ocupado' ? 'Ese turno ya está tomado por otra reserva.'
          : j.errores?.join(' · ') || `No se pudo crear (${j.motivo || 'error'}).`
        );
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  const generarLink = async () => {
    setEnviando(true);
    setError('');
    try {
      const res = await fetch('/api/cadena/link-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: creada.codigo, tipo: 'DEPOSIT' }),
      });
      const j = await res.json();
      if (j.ok) {
        setLink(j);
        await navigator.clipboard.writeText(j.checkoutUrl).catch(() => {});
      } else {
        setError(`No se pudo generar el link (${j.motivo || 'error'}).`);
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ background: 'rgba(6,15,46,0.55)' }}
      onClick={creada ? undefined : onCerrar}>
      <div className="bg-white w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {!creada ? (
          <>
            <div className="flex items-start justify-between mb-1">
              <h2 className="font-black text-xl" style={{ color: AZUL }}>+ Crear reserva manual</h2>
              <button onClick={onCerrar} className="text-gray-400 text-2xl leading-none px-1" aria-label="Cerrar">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Para cotizaciones ya cerradas por WhatsApp antes de este sistema. El total y el anticipo se guardan
              tal cual los escribas — no se recalculan.
            </p>

            <div className="space-y-3">
              <Campo label="Código de cotización / referencia (opcional)" value={form.referencia} onChange={set('referencia')} placeholder="Ej: cotización WhatsApp 12-ago" />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Apoderado" value={form.apoderado} onChange={set('apoderado')} placeholder="Nombre y apellido" />
                <Campo label="Festejado/a" value={form.nombreNino} onChange={set('nombreNino')} placeholder="Nombre del niño" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Email" value={form.email} onChange={set('email')} type="email" placeholder="correo@ejemplo.com" />
                <Campo label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Fecha" value={form.fecha} onChange={setFecha} type="date" />
                <label className="block">
                  <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>Horario contratado</span>
                  <select value={form.horarioIdx} onChange={set('horarioIdx')} disabled={!horariosDisponibles.length}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" style={{ border: '2px solid #E5E7EB' }}>
                    {horariosDisponibles.length
                      ? horariosDisponibles.map((h, i) => <option key={i} value={i}>{h.label}</option>)
                      : <option>Elige una fecha primero</option>}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>Niños</span>
                  <select value={form.tramoInvitados} onChange={set('tramoInvitados')} className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" style={{ border: '2px solid #E5E7EB' }}>
                    {TRAMOS_NINOS_MANUAL.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>Mayores de 6</span>
                  <select value={form.tramoMayores} onChange={set('tramoMayores')} className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" style={{ border: '2px solid #E5E7EB' }}>
                    {TRAMOS_MAYORES_MANUAL.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: 'rgba(21,101,192,0.06)', color: AZUL }}>
                Sector: {sectorAutomatico === 'independiente' ? 'Independiente' : 'Recinto Completo'}
                <span className="block text-xs font-normal mt-0.5" style={{ color: '#6B7280' }}>
                  Se calcula solo — Independiente solo aplica con "Hasta 10" y ningún mayor de 6.
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Campo label="Total" value={form.total} onChange={set('total')} type="number" placeholder="350000" />
                <Campo label="Anticipo" value={form.anticipo} onChange={set('anticipo')} type="number" placeholder="175000" />
                <label className="block">
                  <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>Saldo (automático)</span>
                  <div className="w-full rounded-xl px-4 py-3 text-sm font-black" style={{ border: '2px solid #E5E7EB', background: '#F8FAFF', color: '#F97316' }}>
                    {saldoNum.toLocaleString('es-CL')}
                  </div>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>Resumen / adicionales (opcional)</span>
                <textarea value={form.notas} onChange={set('notas')} rows={2} placeholder="Ej: incluye piñata y pack fotografía"
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none resize-none" style={{ border: '2px solid #E5E7EB' }} />
              </label>
            </div>

            {error && (
              <div className="mt-4 text-sm font-bold rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button onClick={crear} disabled={enviando}
              className="w-full mt-5 font-black text-white py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: AZUL }}>
              {enviando ? 'Creando…' : 'Crear reserva'}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-black text-xl mb-1" style={{ color: '#16a34a' }}>✓ Reserva creada</h2>
            <p className="text-sm text-gray-500 mb-4">
              {creada.codigo} · turno tomado y en espera de pago.
            </p>

            {!link ? (
              <button onClick={generarLink} disabled={enviando}
                className="w-full font-black text-white py-4 rounded-2xl disabled:opacity-40"
                style={{ background: AZUL }}>
                {enviando ? 'Generando…' : 'Generar link de anticipo'}
              </button>
            ) : (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.08)' }}>
                <p className="text-sm font-black mb-1" style={{ color: '#166534' }}>✓ Link copiado — pégalo en WhatsApp</p>
                <p className="text-xs text-gray-500 break-all">{link.checkoutUrl}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm font-bold rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <button onClick={onCreada} className="w-full text-center text-sm font-bold mt-4" style={{ color: '#6B7280' }}>
              Listo, volver al panel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold mb-1" style={{ color: '#6B7280' }}>{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" style={{ border: '2px solid #E5E7EB' }} />
    </label>
  );
}
