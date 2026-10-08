// ══════════════════════════════════════════════════════════════════════
// QA — MODIFICAR UNA RESERVA (fecha, turno, características) y aviso por
// correo  ·  node scripts/qa-modificar-reserva.mjs   (pedido 08-oct-2026)
// Integración contra Sandbox real; sin base de datos solo corre la parte pura.
// ══════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
register('./_resolver-sin-extension.mjs', import.meta.url);
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

let ok = 0;
const fallos = [];
const T = async (n, fn) => { try { await fn(); ok++; } catch (e) { fallos.push(n + ' → ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ': ' : '') + `esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const yes = (v, m) => { if (!v) throw new Error(m || 'esperado true'); };

// ── A. PURO / ESTÁTICO ───────────────────────────────────────────────
await T('el aviso por correo: asunto, fechas antes/ahora, valor que se mantiene y link a Mi Celebración (nunca Flow)', async () => {
  const { construirAvisoCambio } = await import('../lib/aviso-cambio-reserva.js');
  const reserva = { codigo: 'CSC-2026-000999', acceso_token: 'abc123', cliente_nombre: 'Carlos Villagrán', total: 605000, pagado: 267500, snapshot: { configuracion: { nombreNino: 'Pedro' } } };
  const detalle = {
    antes: { fecha: '2026-10-31', turno: 'PM', horaInicio: '16:00', horaTermino: '19:00', total: 605000 },
    despues: { fecha: '2026-11-08', turno: 'AM', horaInicio: '11:00', horaTermino: '14:00', total: 605000 },
    campos: ['fecha', 'hora'],
  };
  const { asunto, texto, html } = construirAvisoCambio(reserva, detalle);
  yes(/fecha y hora/.test(asunto), asunto);
  yes(texto.includes('31 de octubre') && texto.includes('8 de noviembre'), 'debe decir fecha antes y ahora');
  yes(texto.includes('11:00–14:00') && texto.includes('16:00–19:00'), 'debe decir horario antes y ahora');
  yes(texto.includes('se mantiene'), 'si el total no cambia, lo dice');
  yes(texto.includes('Saldo pendiente: $337.500'), 'saldo real = total − pagado');
  yes(texto.includes('/mi-celebracion?id=CSC-2026-000999&t=abc123') && !/flow\.cl/i.test(texto + html), 'link a Mi Celebración, nunca Flow');
  yes(html.includes('Ver Mi Celebración'));
});

await T('la ruta valida simulación → calendario → aplicar, y el cron reintenta los avisos', () => {
  const ruta = leer('app/api/cadena/modificar-reserva/route.js');
  yes(ruta.includes('simular: true') && ruta.includes('calendario_ocupado') && ruta.includes('sincronizarCalendario'));
  yes(leer('app/api/cron/ciclo-previo-evento/route.js').includes('ejecutarAvisosCambio'));
  const lib = leer('lib/aviso-cambio-reserva.js');
  yes(lib.indexOf('await enviarCorreo(') < lib.indexOf('TIPO_AVISO_ENVIADO, evento.referencia'), 'el evento ENVIADO se registra después del SMTP');
});

// ── B. INTEGRACIÓN ───────────────────────────────────────────────────
function cargarEnvLocal() {
  const ruta = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, clave, valorCrudo] = m;
    if (process.env[clave]) continue;
    process.env[clave] = valorCrudo.replace(/^"(.*)"$/, '$1');
  }
}
cargarEnvLocal();

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log('\n  QA modificar reserva (integración) — omitido: no hay POSTGRES_URL/DATABASE_URL configurada.\n');
} else {
  const { q, q1 } = await import('../lib/db.js');
  const { crearReserva, crearReservaManual, reservaPorCodigo, configuracionVigente, detalleDeReserva, fechaISO } = await import('../lib/reservas.js');
  const { modificarReserva } = await import('../lib/modificar-reserva.js');
  const { ejecutarAvisosCambio } = await import('../lib/aviso-cambio-reserva.js');

  const BASE = new Date('2028-03-04T12:00:00.000Z'); // un sábado
  let n = 0;
  const ymd = (d) => d.toISOString().slice(0, 10);
  const sabado = () => new Date(BASE.getTime() + (n++) * 7 * 86_400_000);
  const dia = (d, mas) => ymd(new Date(d.getTime() + mas * 86_400_000));
  const CLIENTE = { nombre: 'QATEST Modificar', email: 'qatest.modificar@celebrasincesar.cl', telefono: '+56900000044' };
  const codigos = [];

  async function limpiar() {
    for (const c of codigos) {
      await q(`DELETE FROM pago_evento WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM cambio_comercial WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM pendiente_proveedor WHERE reserva_id = (SELECT id FROM reserva WHERE codigo = $1)`, [c]).catch(() => {});
      await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1`, [c]).catch(() => {});
      await q(`DELETE FROM reserva WHERE codigo = $1`, [c]).catch(() => {});
    }
  }
  // Reserva firme (confirmada + cerrojo firme), como la que existe en Production.
  async function firme(fechaSabado, hora = 'PM', extra = {}) {
    const r = await crearReserva({
      configuracion: { fecha: `${ymd(fechaSabado)}T12:00:00.000Z`, hora, sector: 'completo', tramoInvitados: '11a20', edadNino: 6, festejados: 1, tramoMayores: 'no', extras: [], tematica: null, horasAdicionales: 0, ...extra },
      cliente: CLIENTE, aceptaTyc: true,
    });
    if (!r.ok) throw new Error(`crearReserva falló: ${r.motivo} ${JSON.stringify(r.errores || '')}`);
    codigos.push(r.reserva.codigo);
    await q(`UPDATE reserva SET estado = 'CONFIRMED', pagado = $2 WHERE id = $1`, [r.reserva.id, Math.round(r.reserva.total / 2)]);
    await q(`UPDATE turno_hold SET firme = true, vence = now() + interval '5 years' WHERE reserva_codigo = $1`, [r.reserva.codigo]);
    return reservaPorCodigo(r.reserva.codigo);
  }

  try {
    await T('mover sábado PM → domingo AM manteniendo el precio: columnas, cerrojo, snapshot vigente, histórico y bitácora', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      const totalAntes = r.total;
      const domingo = dia(sab, 1);
      const res = await modificarReserva({ codigo: r.codigo, cambios: { fecha: domingo, hora: 'AM' }, politicaPrecio: 'mantener', avisar: true });
      yes(res.ok, JSON.stringify(res));
      const a = await reservaPorCodigo(r.codigo);
      eq(fechaISO(a.fecha_evento), domingo, 'la fecha de la reserva es la nueva');
      eq(a.turno, 'AM'); eq(a.hora_inicio, '11:00'); eq(a.hora_termino, '14:00');
      eq(a.total, totalAntes, 'el precio acordado se mantiene');
      const vig = configuracionVigente(a);
      eq(String(vig.configuracion.fecha).slice(0, 10), domingo);
      eq(vig.configuracion.hora, 'AM');
      const suma = vig.precio.lineas.reduce((s, l) => s + l.monto, 0);
      eq(suma, a.total, 'las líneas del desglose deben sumar el total (incluye el "Ajuste acordado")');
      yes(vig.precio.lineas.some((l) => /Ajuste acordado/.test(l.concepto)), 'domingo es más barato: la diferencia queda como ajuste acordado');
      // el contrato original NO se toca
      const orig = typeof a.snapshot === 'string' ? JSON.parse(a.snapshot) : a.snapshot;
      eq(orig.configuracion.hora, 'PM', 'el snapshot original queda intacto');
      // cerrojo: el viejo se libera, el nuevo es firme
      const viejo = await q(`SELECT 1 FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'PM'`, [ymd(sab)]);
      eq(viejo.length, 0, 'el turno viejo debe quedar libre');
      const nuevo = await q1(`SELECT firme, reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'AM'`, [domingo]);
      eq(nuevo.reserva_codigo, r.codigo); eq(nuevo.firme, true);
      const cc = await q(`SELECT total_antes, total_despues FROM cambio_comercial WHERE reserva_id = $1`, [r.id]);
      eq(cc.length, 1); eq(cc[0].total_antes, cc[0].total_despues);
      const ev = await q(`SELECT detalle FROM pago_evento WHERE reserva_id = $1 AND tipo = 'RESERVA_MODIFICADA'`, [r.id]);
      eq(ev.length, 1); eq((typeof ev[0].detalle === 'string' ? JSON.parse(ev[0].detalle) : ev[0].detalle).avisar, true);
      // el detalle (panel/calendario) muestra el desglose sin descuadres
      const d = detalleDeReserva(a);
      yes(d.desglose.some((l) => /Ajuste acordado/.test(l.concepto)));
    });

    await T('política "recalcular": el total pasa a ser el de la tabla vigente (sábado más caro que domingo)', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      const res = await modificarReserva({ codigo: r.codigo, cambios: { fecha: dia(sab, 1), hora: 'AM' }, politicaPrecio: 'recalcular' });
      yes(res.ok, JSON.stringify(res));
      const a = await reservaPorCodigo(r.codigo);
      yes(a.total < r.total, `domingo debe costar menos que sábado (${a.total} vs ${r.total})`);
      eq(a.total, res.totalSegunTabla);
    });

    await T('simular no escribe nada', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      const res = await modificarReserva({ codigo: r.codigo, cambios: { fecha: dia(sab, 1), hora: 'AM' }, simular: true });
      yes(res.ok && res.simulacion);
      const a = await reservaPorCodigo(r.codigo);
      eq(a.turno, 'PM'); eq(a.hora_inicio, '16:00');
      eq((await q(`SELECT 1 FROM cambio_comercial WHERE reserva_id = $1`, [r.id])).length, 0);
    });

    await T('turno ya ocupado por OTRA reserva: se rechaza y no cambia NADA (ni cerrojo ni datos)', async () => {
      const sabA = sabado(); const sabB = sabado();
      const a = await firme(sabA, 'PM');
      const b = await firme(sabB, 'PM');
      const res = await modificarReserva({ codigo: a.codigo, cambios: { fecha: ymd(sabB), hora: 'PM' } });
      eq(res.ok, false); eq(res.motivo, 'turno_ocupado');
      const aDespues = await reservaPorCodigo(a.codigo);
      eq(aDespues.turno, 'PM'); eq(aDespues.hora_inicio, '16:00');
      eq((await q(`SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'PM'`, [ymd(sabB)]))[0].reserva_codigo, b.codigo, 'el cerrojo de la otra reserva queda intacto');
      eq((await q(`SELECT reserva_codigo FROM turno_hold WHERE fecha_evento = $1::date AND turno = 'PM'`, [ymd(sabA)]))[0].reserva_codigo, a.codigo, 'y el de esta también');
    });

    await T('reglas: viernes AM, campos no permitidos y fechas inválidas se rechazan con motivo claro', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      const viernesAM = await modificarReserva({ codigo: r.codigo, cambios: { fecha: dia(sab, -1), hora: 'AM' } });
      eq(viernesAM.ok, false); eq(viernesAM.motivo, 'configuracion_invalida');
      const campo = await modificarReserva({ codigo: r.codigo, cambios: { extras: [] } });
      eq(campo.motivo, 'campo_no_modificable');
      const fecha = await modificarReserva({ codigo: r.codigo, cambios: { fecha: '31/10/2026' } });
      eq(fecha.motivo, 'fecha_invalida');
      const lunes = await modificarReserva({ codigo: r.codigo, cambios: { fecha: dia(sab, 2) } });
      eq(lunes.ok, false, 'un lunes no se celebra');
    });

    await T('cambiar características (niños y festejados) recalcula con el motor y deja todo consistente', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      const res = await modificarReserva({ codigo: r.codigo, cambios: { tramoInvitados: '21a30', festejados: 2 }, politicaPrecio: 'recalcular' });
      yes(res.ok, JSON.stringify(res));
      const a = await reservaPorCodigo(r.codigo);
      yes(a.total > r.total, 'más niños y cumpleaños compartido cuestan más');
      eq(a.ninos, 30);
      const vig = configuracionVigente(a);
      eq(vig.configuracion.festejados, 2);
      eq(vig.precio.lineas.reduce((s, l) => s + l.monto, 0), a.total);
    });

    await T('reserva MANUAL: se puede mover (fecha/turno) y el total negociado nunca cambia', async () => {
      const sab = sabado();
      const r = await crearReservaManual({
        referencia: 'QA mover', nombreNino: 'QA Manual', apoderado: CLIENTE.nombre, email: CLIENTE.email, telefono: CLIENTE.telefono,
        fecha: ymd(sab), turno: 'PM', horasAdicionales: 0, tramoInvitados: 'hasta10', tramoMayores: 'no', total: 333000, anticipo: 100000, notas: '',
      });
      if (!r.ok) throw new Error(JSON.stringify(r));
      codigos.push(r.reserva.codigo);
      await q(`UPDATE reserva SET estado = 'CONFIRMED' WHERE id = $1`, [r.reserva.id]);
      await q(`UPDATE turno_hold SET firme = true, vence = now() + interval '5 years' WHERE reserva_codigo = $1`, [r.reserva.codigo]);
      const res = await modificarReserva({ codigo: r.reserva.codigo, cambios: { fecha: dia(sab, 1), hora: 'AM' } });
      yes(res.ok, JSON.stringify(res));
      const a = await reservaPorCodigo(r.reserva.codigo);
      eq(a.turno, 'AM'); eq(a.hora_inicio, '11:00'); eq(a.total, 333000);
      yes(configuracionVigente(a).manual === true, 'sigue siendo manual');
      const bad = await modificarReserva({ codigo: r.reserva.codigo, cambios: { sector: 'independiente' } });
      eq(bad.motivo, 'campo_no_modificable', 'una manual no admite cambios que dependen de la tabla de precios');
    });

    await T('aviso: se detecta pendiente, y SIN SMTP configurado nunca se registra un envío falso', async () => {
      const sab = sabado();
      const r = await firme(sab, 'PM');
      yes((await modificarReserva({ codigo: r.codigo, cambios: { fecha: dia(sab, 1), hora: 'AM' }, avisar: true })).ok);
      const res = await ejecutarAvisosCambio();
      const mio = res.resultados.find((x) => x.referencia?.startsWith('cambio:'));
      yes(res.procesados >= 1 && mio, 'el cambio con avisar debe quedar como pendiente');
      if (mio.enviado) {
        eq((await q(`SELECT count(*)::int AS n FROM pago_evento WHERE reserva_id = $1 AND tipo = 'AVISO_CAMBIO_ENVIADO'`, [r.id]))[0].n, 1);
        const otra = await ejecutarAvisosCambio();
        yes(!otra.resultados.some((x) => x.enviado), 'idempotente: no se reenvía');
      } else {
        yes(['correo_no_configurado', 'error_envio'].includes(mio.motivo), JSON.stringify(mio));
        eq((await q(`SELECT count(*)::int AS n FROM pago_evento WHERE reserva_id = $1 AND tipo = 'AVISO_CAMBIO_ENVIADO'`, [r.id]))[0].n, 0, 'sin SMTP no hay evento ENVIADO');
      }
    });
  } finally {
    await limpiar().catch((e) => console.error('limpieza falló:', e.message));
  }
}

console.log(`\n  QA modificar reserva (08-oct-2026) — celebrasincesar.cl\n  ${'─'.repeat(54)}`);
if (fallos.length) {
  console.log(`  ${ok} OK · ${fallos.length} fallas\n`);
  for (const f of fallos) console.log(`  ✗ ${f}`);
  console.log('');
  process.exit(1);
} else {
  console.log(`  ${ok} pruebas OK\n  Todo OK.\n`);
}
