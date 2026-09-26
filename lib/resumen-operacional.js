// ══════════════════════════════════════════════════════════════════════
// RESUMEN OPERACIONAL DE LA CELEBRACIÓN  ·  lib/resumen-operacional.js
// ──────────────────────────────────────────────────────────────────────
// Puro: no toca Postgres — arma el resumen compacto que /cadena muestra
// dentro del detalle de cada reserva (documento "FASE 2B — IMPLEMENTAR
// BLOQUE 2", 21-sep-2026, §6) y decide "Todo listo para celebrar 🎉"
// (§15). El caller (la ruta de /api/cadena/reservas) ya leyó reserva,
// datosFinales y pendientes — esta función solo los combina.
// ══════════════════════════════════════════════════════════════════════

import { reservaEstaFirme, configuracionVigente, detalleDeReserva, estadoSaldo, fechaISO } from './reservas';
import { tramoInvitadosPorId } from '../data/reglas';

// "Vencido" es estrictamente antes de hoy — igual que 🔴 en
// urgenciaPendiente() (lib/pendientes-proveedor.js): proxima_revision ===
// hoy es "🟠 corresponde revisar", no un bloqueo todavía.
export function pendienteBloqueaListo(p, ahora = new Date()) {
  if (p.estado === 'PENDIENTE' || p.estado === 'NO_DISPONIBLE') return true;
  if (p.estado === 'REVISAR_DESPUES') {
    const raw = p.proxima_revision ?? p.proximaRevision;
    if (!raw) return true; // sin fecha: no se puede confirmar que no esté vencido, bloquea por defecto.
    const hoy = new Date(ahora); hoy.setHours(12, 0, 0, 0);
    const revision = new Date(`${fechaISO(raw)}T12:00:00`);
    return revision.getTime() < hoy.getTime();
  }
  return false; // CONFIRMADO y RETIRADO nunca bloquean (§15).
}

// Regla exacta del documento (§15): reserva vigente + Datos Finales
// confirmados + ningún pendiente activo crítico. El saldo económico NUNCA
// entra acá — la lógica comercial de este bloque no exige pago inmediato.
export function todoListoParaCelebrar({ reserva, datosFinales, pendientes }, hoy = new Date()) {
  if (!reservaEstaFirme(reserva?.estado)) return false;
  if (!datosFinales) return false;
  const activos = (pendientes || []).filter((p) => p.estado !== 'RETIRADO');
  return !activos.some((p) => pendienteBloqueaListo(p, hoy));
}

// `nivel`: 'ok' (🟢) / 'alerta' (🟡, pendiente de resolver normal) /
// 'critico' (🔴, NO_DISPONIBLE — requiere acción humana, se destaca más
// que un simple "pendiente", mismo criterio de severidad que
// urgenciaPendiente() en lib/pendientes-proveedor.js).
function etiquetaGrupoPendientes(filas) {
  if (!filas.length) return null;
  if (filas.some((p) => p.estado === 'NO_DISPONIBLE')) return { nivel: 'critico', texto: 'no disponible' };
  if (filas.every((p) => p.estado === 'CONFIRMADO')) return { nivel: 'ok', texto: 'confirmada' };
  return { nivel: 'alerta', texto: 'pendiente' };
}

// El objeto compacto que pinta la sección "📋 Resumen operacional" dentro
// del detalle de una reserva en /cadena — nunca duplica la ficha
// administrativa completa (§6), solo responde "¿qué falta resolver?".
export function resumenOperacional({ reserva, datosFinales, pendientes }) {
  const activos = (pendientes || []).filter((p) => p.estado !== 'RETIRADO');
  const d = detalleDeReserva(reserva);
  const saldo = estadoSaldo(reserva).pendiente;

  const deco = etiquetaGrupoPendientes(activos.filter((p) => p.tipo === 'decoracion_tematica'));
  const animacion = etiquetaGrupoPendientes(activos.filter((p) => p.tipo === 'animacion'));
  const firme = reservaEstaFirme(reserva.estado);

  const chips = [
    { nivel: firme ? 'ok' : 'alerta', texto: firme ? 'Reserva confirmada' : 'Reserva no confirmada' },
    { nivel: datosFinales ? 'ok' : 'alerta', texto: datosFinales ? 'Datos finales confirmados' : 'Datos finales pendientes' },
  ];
  if (deco) chips.push({ nivel: deco.nivel, texto: `Decoración ${deco.texto}` });
  if (animacion) chips.push({ nivel: animacion.nivel, texto: `Animación ${animacion.texto}` });

  return {
    chips,
    asistencia: {
      contratacionVigente: tramoInvitadosPorId(d.tramoInvitados)?.corto || null,
      finalInformada: datosFinales ? datosFinales.ninos_final : null,
      sieteMas: datosFinales ? datosFinales.mayores_final : null,
      adultosAprox: datosFinales ? datosFinales.adultos_aprox : null,
    },
    pagos: { total: reserva.total, pagado: reserva.pagado, saldo },
    responsable: datosFinales
      ? { nombre: datosFinales.adulto_responsable, telefono: datosFinales.telefono_operacional }
      : null,
    todoListo: todoListoParaCelebrar({ reserva, datosFinales, pendientes }),
  };
}
