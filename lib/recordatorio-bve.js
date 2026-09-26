// ══════════════════════════════════════════════════════════════════════
// RESUMEN DEL CORREO RECORDATORIO DE BVE  ·  lib/recordatorio-bve.js
// ──────────────────────────────────────────────────────────────────────
// Construye el asunto/texto/html del correo diario a administracion@ (§5
// del documento "Agregar control obligatorio de BVE…", 07-sep-2026). Puro:
// no toca la base de datos ni manda nada — solo arma el contenido a partir
// de la lista que ya devolvió pagosPendientesBVE(). Así se puede probar en
// scripts/qa-pagos.mjs sin credenciales, igual que classifyTaxTreatment().
// ══════════════════════════════════════════════════════════════════════

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const fmtFecha = (f) => {
  if (!f) return '—';
  const d = new Date(String(f).slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ETIQUETA_TIPO = { DEPOSIT: 'Anticipo', BALANCE: 'Saldo', EXTRA: 'Adicional' };

export function construirResumenBVE(pendientes) {
  const n = pendientes.length;
  const asunto = `📋 ${n} boleta${n === 1 ? '' : 's'} SII pendiente${n === 1 ? '' : 's'} — Celebra Sin Cesar`;

  const lineas = pendientes.map((p) => {
    const quien = [p.festejado, p.cliente_nombre].filter(Boolean).join(' — ');
    return `• ${p.codigo} · ${quien}\n`
      + `  ${ETIQUETA_TIPO[p.tipo] || p.tipo}: ${clp(p.monto)} · ${p.medio || p.medio_tipo || 'medio no informado'}\n`
      + `  Pagado: ${fmtFecha(p.confirmado)} · Evento: ${fmtFecha(p.fecha_evento)}\n`
      + `  ${p.cliente_email} · ${p.cliente_telefono}`;
  });

  const texto = [
    `Hay ${n} boleta${n === 1 ? '' : 's'} de venta electrónica pendiente${n === 1 ? '' : 's'} de emitir en el SII.`,
    '',
    ...lineas,
    '',
    'Emítelas y márcalas como "emitida" en el panel: celebrasincesar.cl/cadena',
  ].join('\n');

  const filas = pendientes.map((p) => {
    const quien = [p.festejado, p.cliente_nombre].filter(Boolean).join(' — ');
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee"><b>${p.codigo}</b><br>${quien}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${ETIQUETA_TIPO[p.tipo] || p.tipo}<br>${clp(p.monto)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${p.medio || p.medio_tipo || '—'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${fmtFecha(p.confirmado)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${p.cliente_email}<br>${p.cliente_telefono}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;color:#0D1B3E">
      <h2 style="color:#1565C0">📋 ${n} boleta${n === 1 ? '' : 's'} SII pendiente${n === 1 ? '' : 's'}</h2>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr style="text-align:left;color:#6B7280">
            <th style="padding:8px">Reserva</th><th style="padding:8px">Concepto</th>
            <th style="padding:8px">Medio</th><th style="padding:8px">Pagado</th><th style="padding:8px">Contacto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="margin-top:16px;font-size:13px">
        Emítelas y márcalas como "emitida" en
        <a href="https://celebrasincesar.cl/cadena">celebrasincesar.cl/cadena</a>.
      </p>
    </div>`;

  return { asunto, texto, html };
}
