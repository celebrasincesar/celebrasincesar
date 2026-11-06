'use client';

// Modificar fecha, turno, horario, características o adicionales de una
// reserva ya confirmada (pedido de César, 08-oct-2026; adicionales y "Otro"
// se sumaron acá el 04-nov-2026 para que cualquier cambio tenga vista
// previa, quede registrado y se pueda avisar). Siempre primero "Ver cómo
// queda" (simula en el servidor, sin escribir) y recién después "Aplicar":
// al aplicar se actualizan base de datos, disponibilidad de la web, Google
// Calendar y —si se marca— el correo a la familia
// (/api/cadena/modificar-reserva).

import { useState, useEffect, useMemo } from 'react';
import { clp, opcionesHorario, TRAMOS_INVITADOS, TRAMOS_MAYORES, ITEMS, CATEGORIA_DE_ITEM } from '../../data/reglas';

const AZUL = '#1565C0';
const CAMPO = 'text-xs px-3 py-2 rounded-xl w-full';
const BORDE = { border: '1.5px solid #E5E7EB' };
const NUMERICOS = ['horasAdicionales', 'totalNinos', 'edadNino', 'festejados'];
const CAMPOS_MANUAL = ['fecha', 'hora', 'horasAdicionales', 'nombreNino', 'extras', 'tematica', 'cargosLibres'];
const IDS_TEMATICA = new Set(['deco-tematica-simple', 'deco-tematica-full']);
const CHIP = { background: 'rgba(21,101,192,0.08)', color: AZUL };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Rotulo({ t, children }) {
  return (
    <label className="text-xs block">
      <span className="block text-[11px] text-gray-500 mb-0.5">{t}</span>
      {children}
    </label>
  );
}

function Chip({ texto, onQuitar }) {
  return (
    <span className="text-xs font-bold pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5" style={CHIP}>
      {texto}
      <button onClick={onQuitar} aria-label={`Quitar ${texto}`}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(21,101,192,0.18)' }}>×</button>
    </span>
  );
}

const nombreOtro = (c) => (c.concepto ? `Otro: ${c.concepto}` : 'Otro');

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
    // Adicionales del catálogo (pagados e incluidos), ordenados para que
    // quitar y volver a poner lo mismo no cuente como cambio.
    extras: [
      ...(d.adicionales || []).filter((a) => !a.cargoLibre).map((a) => a.id),
      ...(d.incluidos || []).map((i) => i.id),
    ].sort(),
    tematica: d.tematica || '',
    cargosLibres: (d.cargosLibres || []).map((c) => ({ concepto: c.concepto === 'Otro' ? '' : c.concepto, monto: c.monto })),
  }), [r.fecha_evento, r.turno, r.sector, d.horasAdicionales, d.tramoInvitados, d.totalNinos, d.tramoMayores, d.edad, d.festejados, d.festejado, d.adicionales, d.incluidos, d.tematica, d.cargosLibres]);

  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(inicial);
  const [politica, setPolitica] = useState('mantener');
  const [avisar, setAvisar] = useState(false);
  const [confirmarCal, setConfirmarCal] = useState(false);
  const [sim, setSim] = useState(null);
  const [aviso, setAviso] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [porAgregar, setPorAgregar] = useState('');
  const [otroMonto, setOtroMonto] = useState('');
  const [otroGlosa, setOtroGlosa] = useState('');

  useEffect(() => { setF(inicial); setSim(null); }, [inicial]);

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setSim(null); setAviso(''); setConfirmarCal(false); };
  const opcionesExt = opcionesHorario(f.hora, f.fecha) || [];

  // La comida (Pizzas) no va en esta lista: lleva sabores y cantidades.
  // Para comida pedida aparte está "Otro" con su monto.
  const disponibles = Object.values(ITEMS)
    .filter((it) => !f.extras.includes(it.id) && !it.comida)
    .sort((a, b) =>
      (CATEGORIA_DE_ITEM[a.id]?.label || '').localeCompare(CATEGORIA_DE_ITEM[b.id]?.label || '')
      || a.nombre.localeCompare(b.nombre));
  const pideTematica = f.extras.some((id) => IDS_TEMATICA.has(id));
  const otroMontoNum = Math.round(Number(otroMonto) || 0);

  const agregarItem = () => {
    if (!porAgregar) return;
    set('extras', [...f.extras, porAgregar].sort());
    setPorAgregar('');
  };
  const agregarOtro = () => {
    if (otroMontoNum <= 0) return;
    set('cargosLibres', [...f.cargosLibres, { concepto: otroGlosa.trim(), monto: otroMontoNum }]);
    setOtroMonto(''); setOtroGlosa('');
  };

  const cambios = () => {
    const c = {};
    for (const k of Object.keys(inicial)) {
      if (esManual && !CAMPOS_MANUAL.includes(k)) continue;
      if (igual(f[k], inicial[k]) || f[k] === '') continue;
      c[k] = NUMERICOS.includes(k) ? Number(f[k]) : f[k];
    }
    // Cambiar fecha o turno obliga a mandar la extensión explícita: el
    // servidor nunca acota en silencio.
    if ((c.hora || c.fecha) && c.horasAdicionales === undefined) c.horasAdicionales = Number(f.horasAdicionales);
    return c;
  };
  const sinCambios = Object.keys(cambios()).length === 0;

  const llamar = async (simular) => {
    if (!simular && pideTematica && !f.tematica.trim()) { setAviso('Escribe la temática de la decoración.'); return; }
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
      } else if (j.motivo === 'item_requiere_detalle') {
        setAviso(`${ITEMS[j.item]?.nombre || j.item} se pide con sabores desde el catálogo; aquí usa "Otro" con el monto.`);
      } else if (j.motivo === 'item_no_compatible') {
        setAviso(`${ITEMS[j.item]?.nombre || j.item} no corresponde para esta celebración (edad, niños o mayores de 6).`);
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
  const com = sim?.comercial;
  const masComercial = [...(com?.adicionales?.agregados || []), ...(com?.otros?.agregados || [])];
  const menosComercial = [...(com?.adicionales?.quitados || []), ...(com?.otros?.quitados || [])];

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs font-black px-3 py-2 rounded-xl" style={{ background: 'rgba(13,27,62,0.06)', color: '#0D1B3E' }}>
        Cambiar fecha, horario, datos o adicionales de esta reserva
      </button>
    );
  }

  return (
    <div>
      {esManual && (
        <p className="text-[11px] text-gray-400 mb-2">
          Reserva manual: el total negociado se mantiene como base; cada adicional suma su precio de catálogo y cada
          "Otro" su monto. Se puede mover fecha, turno, duración y nombre.
        </p>
      )}
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

      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(21,101,192,0.2)' }}>
        <p className="text-[11px] font-black text-gray-500 mb-1.5">Adicionales</p>
        {f.extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {f.extras.map((id) => {
              const item = ITEMS[id];
              return <Chip key={id} texto={`${item?.emoji ? `${item.emoji} ` : ''}${item?.nombre || id}`} onQuitar={() => set('extras', f.extras.filter((x) => x !== id))} />;
            })}
          </div>
        )}
        <div className="flex gap-2 flex-wrap items-end">
          <Rotulo t="Agregar ítem">
            <select value={porAgregar} onChange={(e) => setPorAgregar(e.target.value)} className="text-xs px-3 py-2 rounded-xl" style={BORDE}>
              <option value="">Elegir…</option>
              {disponibles.map((it) => (
                <option key={it.id} value={it.id}>
                  {CATEGORIA_DE_ITEM[it.id]?.label ? `${CATEGORIA_DE_ITEM[it.id].label} · ` : ''}{it.nombre}{it.gratis ? ' (gratis)' : ''}
                </option>
              ))}
            </select>
          </Rotulo>
          <button onClick={agregarItem} disabled={!porAgregar}
            className="text-xs font-black px-3.5 py-2 rounded-xl disabled:opacity-50" style={CHIP}>
            + Agregar
          </button>
          {pideTematica && (
            <Rotulo t="Temática de la decoración">
              <input value={f.tematica} onChange={(e) => set('tematica', e.target.value)} placeholder="Ej: Bluey" maxLength={80}
                className="text-xs px-3 py-2 rounded-xl" style={BORDE} />
            </Rotulo>
          )}
        </div>

        <p className="text-[11px] font-black text-gray-500 mt-3 mb-1.5">Otro (monto libre, fuera del catálogo)</p>
        {f.cargosLibres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {f.cargosLibres.map((c, i) => (
              <Chip key={i} texto={`${nombreOtro(c)} · ${clp(c.monto)}`} onQuitar={() => set('cargosLibres', f.cargosLibres.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap items-end">
          <Rotulo t="Monto ($)">
            <input type="number" min="1" step="1" inputMode="numeric" value={otroMonto} onChange={(e) => setOtroMonto(e.target.value)}
              placeholder="Ej: 30000" className="text-xs px-3 py-2 rounded-xl w-32" style={BORDE} />
          </Rotulo>
          <Rotulo t="Glosa (opcional)">
            <input value={otroGlosa} onChange={(e) => setOtroGlosa(e.target.value)} maxLength={60}
              placeholder="Ej: comida extra" className="text-xs px-3 py-2 rounded-xl" style={BORDE} />
          </Rotulo>
          <button onClick={agregarOtro} disabled={otroMontoNum <= 0}
            className="text-xs font-black px-3.5 py-2 rounded-xl disabled:opacity-50" style={CHIP}>
            + Agregar Otro
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Nada se guarda hasta "Aplicar cambios".</p>
      </div>

      {!esManual && (
        <div className="flex gap-4 flex-wrap mt-3 text-xs" style={{ color: '#374151' }}>
          <label className="flex items-center gap-1.5"><input type="radio" checked={politica === 'mantener'} onChange={() => { setPolitica('mantener'); setSim(null); }} /> Mantener el total acordado ({clp(r.total)}); los adicionales suman o restan su precio</label>
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
          {masComercial.length > 0 && <p>Se agrega: <b>{masComercial.join(', ')}</b></p>}
          {menosComercial.length > 0 && <p>Se quita: <b>{menosComercial.join(', ')}</b></p>}
          {com?.tematica && <p>Temática: {com.tematica.antes || '—'} → <b>{com.tematica.despues || '—'}</b></p>}
          <p>Total: {clp(r.total)} → <b>{clp(sim.despues.total)}</b>{sim.totalSegunTabla != null && sim.totalSegunTabla !== sim.despues.total ? ` (según tabla vigente: ${clp(sim.totalSegunTabla)})` : ''} · saldo → <b>{clp(Math.max(0, sim.despues.total - (r.pagado || 0)))}</b></p>
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
