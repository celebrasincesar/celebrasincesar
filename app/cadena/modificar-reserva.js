'use client';

// Modificar fecha, turno, horario o características de una reserva ya
// confirmada (pedido de César, 08-oct-2026). Siempre primero "Ver cómo
// queda" (simula en el servidor, sin escribir) y recién después "Aplicar":
// al aplicar se actualizan base de datos, disponibilidad de la web, Google
// Calendar y —si se marca— el correo a la familia
// (/api/cadena/modificar-reserva).

import { useState, useEffect, useMemo } from 'react';
import { clp, opcionesHorario, TRAMOS_INVITADOS, TRAMOS_MAYORES } from '../../data/reglas';

const AZUL = '#1565C0';
const CAMPO = 'text-xs px-3 py-2 rounded-xl w-full';
const BORDE = { border: '1.5px solid #E5E7EB' };
const NUMERICOS = ['horasAdicionales', 'totalNinos', 'edadNino', 'festejados'];
const CAMPOS_MANUAL = ['fecha', 'hora', 'horasAdicionales', 'nombreNino'];

function Rotulo({ t, children }) {
  return (
    <label className="text-xs block">
      <span className="block text-[11px] text-gray-500 mb-0.5">{t}</span>
      {children}
    </label>
  );
}

export function ModificarReserva({ reserva: r, onCambio }) {
  const d = r.detalle || {};
  const esManual = !!r.esManual;

  const inicial = useMemo(() => ({
    fecha: String(r.fecha_evento || '').slice(0, 10),
    hora: r.turno,
    horasAdicionales: String(d.horasAdicionales ?? 0),
    sector: r.sector || 'completo',
    tramoInvitados: d.tramoInvitados || '',
    totalNinos: String(d.totalNinos ?? ''),
    tramoMayores: d.tramoMayores || 'no',
    edadNino: String(d.edad ?? ''),
    festejados: String(d.festejados ?? 1),
    nombreNino: d.festejado || '',
  }), [r.fecha_evento, r.turno, r.sector, d.horasAdicionales, d.tramoInvitados, d.totalNinos, d.tramoMayores, d.edad, d.festejados, d.festejado]);

  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(inicial);
  const [politica, setPolitica] = useState('mantener');
  const [avisar, setAvisar] = useState(false);
  const [confirmarCal, setConfirmarCal] = useState(false);
  const [sim, setSim] = useState(null);
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => { setF(inicial); setSim(null); }, [inicial]);

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setSim(null); setAviso(''); setConfirmarCal(false); };
  const opcionesExt = opcionesHorario(f.hora, f.fecha) || [];

  const cambios = () => {
    const c = {};
    for (const k of Object.keys(inicial)) {
      if (esManual && !CAMPOS_MANUAL.includes(k)) continue;
      if (f[k] === inicial[k] || f[k] === '') continue;
      c[k] = NUMERICOS.includes(k) ? Number(f[k]) : f[k];
    }
    // Cambiar fecha o turno obliga a mandar la extensión explícita: el
    // servidor nunca acota en silencio.
    if ((c.hora || c.fecha) && c.horasAdicionales === undefined) c.horasAdicionales = Number(f.horasAdicionales);
    return c;
  };
  const sinCambios = Object.keys(cambios()).length === 0;

  const llamar = async (simular) => {
    setTrabajando(true);
    setAviso('');
    try {
      const res = await fetch('/api/cadena/modificar-reserva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationCode: r.codigo, cambios: cambios(), politicaPrecio: politica, avisar, simular, confirmarCalendario: confirmarCal }),
      });
      const j = await res.json();
      if (j.ok && simular) {
        setSim(j);
      } else if (j.ok) {
        setSim(null);
        onCambio();
        setAviso(`✓ Listo: reserva, disponibilidad de la web y calendario actualizados.${avisar ? ' Aviso a la familia en camino.' : ''}`);
      } else if (j.motivo === 'calendario_ocupado') {
        setSim({ ...j, ok: true, calendario: { eventos: j.eventos } });
        setAviso('El calendario ya tiene otro evento ocupando ese turno. Revísalo y confirma si igual quieres moverla.');
      } else {
        setAviso(`No se pudo (${j.errores?.[0] || j.motivo || 'error'}).`);
      }
    } catch {
      setAviso('No se pudo conectar con el servidor.');
    } finally {
      setTrabajando(false);
    }
  };

  const eventosOcupan = sim?.calendario?.eventos || [];
  const calOcupado = eventosOcupan.length > 0;

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs font-black px-3 py-2 rounded-xl" style={{ background: 'rgba(13,27,62,0.06)', color: '#0D1B3E' }}>
        Cambiar fecha, horario o datos de esta reserva
      </button>
    );
  }

  return (
    <div>
      {esManual && <p className="text-[11px] text-gray-400 mb-2">Reserva manual: el total negociado no cambia; se puede mover fecha, turno, duración y nombre.</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Rotulo t="Fecha"><input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} className={CAMPO} style={BORDE} /></Rotulo>
        <Rotulo t="Turno">
          <select value={f.hora} onChange={(e) => { set('hora', e.target.value); setF((p) => ({ ...p, hora: e.target.value, horasAdicionales: '0' })); }} className={CAMPO} style={BORDE}>
            <option value="AM">Mañana (AM)</option>
            <option value="PM">Tarde (PM)</option>
          </select>
        </Rotulo>
        <Rotulo t="Duración">
          <select value={f.horasAdicionales} onChange={(e) => set('horasAdicionales', e.target.value)} className={CAMPO} style={BORDE}>
            {opcionesExt.map((op) => (
              <option key={op.horas} value={String(op.horas)}>{op.texto}{op.horas > 0 ? ` · ${op.etiquetaExtension}` : ''}</option>
            ))}
          </select>
        </Rotulo>
        <Rotulo t="Festejado/a"><input value={f.nombreNino} onChange={(e) => set('nombreNino', e.target.value)} className={CAMPO} style={BORDE} /></Rotulo>
        {!esManual && (
          <>
            <Rotulo t="Sector">
              <select value={f.sector} onChange={(e) => set('sector', e.target.value)} className={CAMPO} style={BORDE}>
                <option value="completo">Recinto Completo</option>
                <option value="independiente">Sector Independiente</option>
              </select>
            </Rotulo>
            <Rotulo t="Cantidad de niños">
              <select value={f.tramoInvitados} onChange={(e) => set('tramoInvitados', e.target.value)} className={CAMPO} style={BORDE}>
                {TRAMOS_INVITADOS.map((t) => <option key={t.id} value={t.id}>{t.corto}</option>)}
              </select>
            </Rotulo>
            {f.tramoInvitados === '31a40' && (
              <Rotulo t="Total exacto (31 a 40)"><input type="number" min="31" max="40" value={f.totalNinos} onChange={(e) => set('totalNinos', e.target.value)} className={CAMPO} style={BORDE} /></Rotulo>
            )}
            <Rotulo t="Mayores de 6">
              <select value={f.tramoMayores} onChange={(e) => set('tramoMayores', e.target.value)} className={CAMPO} style={BORDE}>
                {TRAMOS_MAYORES.map((t) => <option key={t.id} value={t.id}>{t.corto}</option>)}
              </select>
            </Rotulo>
            <Rotulo t="Edad del festejado"><input type="number" min="1" max="12" value={f.edadNino} onChange={(e) => set('edadNino', e.target.value)} className={CAMPO} style={BORDE} /></Rotulo>
            <Rotulo t="Festejados">
              <select value={f.festejados} onChange={(e) => set('festejados', e.target.value)} className={CAMPO} style={BORDE}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </Rotulo>
          </>
        )}
      </div>

      {!esManual && (
        <div className="flex gap-4 flex-wrap mt-3 text-xs" style={{ color: '#374151' }}>
          <label className="flex items-center gap-1.5"><input type="radio" checked={politica === 'mantener'} onChange={() => { setPolitica('mantener'); setSim(null); }} /> Mantener el total acordado ({clp(r.total)})</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={politica === 'recalcular'} onChange={() => { setPolitica('recalcular'); setSim(null); }} /> Recalcular con los precios vigentes</label>
        </div>
      )}
      <label className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#374151' }}>
        <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} /> Avisar a la familia por correo ({r.cliente_email || 'sin email'})
      </label>

      {sim?.despues && (
        <div className="mt-3 rounded-xl p-3 text-xs" style={{ background: '#F0F7FF', border: '1px solid rgba(21,101,192,0.15)', color: '#0D1B3E' }}>
          <p className="font-black mb-1">Así quedaría</p>
          <p>Antes: {String(sim.antes?.fecha || r.fecha_evento).slice(0, 10)} · {sim.antes?.horaInicio || r.hora_inicio}–{sim.antes?.horaTermino || r.hora_termino} ({sim.antes?.turno || r.turno})</p>
          <p>Después: <b>{sim.despues.fecha} · {sim.despues.horaInicio}–{sim.despues.horaTermino} ({sim.despues.turno})</b></p>
          <p>Total: {clp(r.total)} → <b>{clp(sim.despues.total)}</b>{sim.totalSegunTabla != null && sim.totalSegunTabla !== sim.despues.total ? ` (según tabla vigente: ${clp(sim.totalSegunTabla)})` : ''}</p>
          {(sim.avisosNormalizacion || []).map((a) => <p key={a} className="text-amber-700">⚠ {a}</p>)}
          {calOcupado && (
            <div className="mt-2 p-2 rounded-lg" style={{ background: '#FEF3C7', color: '#92400E' }}>
              <p className="font-black">⚠ El calendario ya tiene otro evento en ese turno:</p>
              {eventosOcupan.map((e) => <p key={e.id}>• {e.titulo}</p>)}
              <label className="flex items-center gap-1.5 mt-1"><input type="checkbox" checked={confirmarCal} onChange={(e) => setConfirmarCal(e.target.checked)} /> Confirmo moverla igual (ese evento lo reviso yo)</label>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap mt-3">
        <button onClick={() => llamar(true)} disabled={trabajando || sinCambios}
          className="text-xs font-black px-3.5 py-2 rounded-xl disabled:opacity-50" style={{ background: 'rgba(21,101,192,0.08)', color: AZUL }}>
          {trabajando ? 'Calculando…' : 'Ver cómo queda'}
        </button>
        <button onClick={() => llamar(false)} disabled={trabajando || !sim?.despues || (calOcupado && !confirmarCal)}
          className="text-xs font-black px-3.5 py-2 rounded-xl text-white disabled:opacity-50" style={{ background: AZUL }}>
          Aplicar cambios
        </button>
        <button onClick={() => { setAbierto(false); setF(inicial); setSim(null); setAviso(''); }} className="text-xs font-black px-3 py-2 rounded-xl text-gray-500">Cerrar</button>
      </div>
      {aviso && <p className="text-xs mt-2" style={{ color: aviso.startsWith('✓') ? '#16a34a' : '#DC2626' }}>{aviso}</p>}
    </div>
  );
}
