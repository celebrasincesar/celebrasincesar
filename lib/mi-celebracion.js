// ══════════════════════════════════════════════════════════════════════
// MI CELEBRACIÓN — armado del resumen  ·  lib/mi-celebracion.js
// ──────────────────────────────────────────────────────────────────────
// Puro: no toca Postgres ni la red — arma la respuesta de
// /api/mi-celebracion a partir de una `reserva` ya leída, igual que
// lib/resumen-cliente.js y lib/resumen-contractual.js. Separado del route
// handler para poder probarlo sin base de datos (documento "FASE 2 —
// EXPERIENCIA CLIENTE END-TO-END", 21-sep-2026, "Criterio de cierre").
//
// Todo el texto de "próximo paso" vive acá — es el único lugar que decide
// qué le decimos al papá. El estado técnico de la reserva (PAID,
// BALANCE_PENDING, etc.) NUNCA sale de esta función hacia afuera.
// ══════════════════════════════════════════════════════════════════════

import { detalleDeReserva, etiquetaReserva, estadoSaldo, reservaEstaFirme, festejadoDeReserva, fechaISO } from './reservas';
import { packDesdeSnapshot } from './resumen-contractual';
import { tramoInvitadosPorId, tramoMayoresPorId } from '../data/reglas';
import { NEGOCIO } from '../data/master';
import { estadoPostevento, linkResenaValido } from './postevento';

const clp = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

export function proximoPasoMiCelebracion({ estado, saldo }) {
  if (!reservaEstaFirme(estado)) {
    return {
      tipo: 'no_disponible',
      titulo: 'Escríbenos para revisar tu reserva',
      texto: 'No encontramos una reserva confirmada activa con este enlace. Escríbenos por WhatsApp con tu código y lo revisamos al tiro.',
    };
  }
  if (saldo.pendiente > 0 && saldo.toca) {
    return {
      tipo: 'saldo_urgente',
      titulo: 'Tu próximo paso',
      texto: `Tienes un saldo pendiente de ${clp(saldo.pendiente)}.`,
    };
  }
  if (saldo.pendiente > 0) {
    return {
      tipo: 'todo_ok',
      titulo: 'Todo bien por ahora ✓',
      texto: 'Tu fecha está reservada. No tienes que hacer nada ahora. Más cerca de la celebración te contactaremos para confirmar los últimos detalles.',
    };
  }
  // Fase siguiente (no implementada todavía, documento §"Datos finales"):
  // cuando exista reserva.datos_finales_en, acá se agrega la rama
  // 'confirmar_datos' → "Confirma los últimos detalles" → CTA "Confirmar datos".
  return {
    tipo: 'todo_pagado',
    titulo: 'Todo pagado ✓',
    texto: 'Tu celebración está confirmada y pagada.',
  };
}

// `datosFinales` (fila de datos_finales_reserva o null) y `pendientes`
// (filas de pendiente_proveedor) se pasan YA leídos, igual que `reserva`
// — esta función sigue sin tocar Postgres, la ruta hace las tres lecturas
// y las junta acá (documento "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026).
// `hoy`: override solo para pruebas (por defecto, ahora).
export function resumenMiCelebracion(reserva, { datosFinales = null, pendientes = [], hoy = new Date() } = {}) {
  const d = detalleDeReserva(reserva);
  const saldo = estadoSaldo(reserva);

  // Postevento (documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE B",
  // §5-§7): desde T+1 la celebración ya ocurrió, así que este estado
  // REEMPLAZA como experiencia principal a cualquier paso previo al evento
  // (Datos Finales, proveedores, "mañana celebramos"). Los datos económicos
  // siguen en el resumen, pero no impiden este estado.
  const post = estadoPostevento(reserva, hoy);
  const resenaUrl = post.activo && linkResenaValido(NEGOCIO.postevento.googleReviewUrl)
    ? NEGOCIO.postevento.googleReviewUrl
    : null;
  const proximoPaso = post.activo
    ? {
      tipo: 'postevento',
      titulo: '¡Gracias por celebrar con nosotros! 🎉',
      texto: 'Esperamos que lo hayan pasado increíble en Alce Kids. Gracias por confiar en nosotros para una celebración tan especial.',
    }
    : proximoPasoMiCelebracion({ estado: reserva.estado, saldo });
  const sectorLabel = reserva.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';
  const ninosLabel = tramoInvitadosPorId(d.tramoInvitados)?.corto || (reserva.ninos ? `${reserva.ninos} niños` : null);
  const mayoresLabel = tramoMayoresPorId(d.tramoMayores)?.corto
    || (reserva.mayores ? `${reserva.mayores} mayores de 6` : 'Ninguno');

  return {
    ok: true,
    codigo: reserva.codigo,
    confirmada: reservaEstaFirme(reserva.estado),
    estadoTexto: etiquetaReserva(reserva.estado),
    festejado: festejadoDeReserva(reserva) || reserva.cliente_nombre,
    edad: d.edad,
    // fechaISO(), nunca String(): el driver de Postgres devuelve DATE como
    // un objeto Date de JS, y String(fecha) da el formato local ("Fri Sep
    // 25 2026…"), no ISO — el mismo bug que ya rompió Calendar (§ arriba).
    fecha: reserva.fecha_evento ? fechaISO(reserva.fecha_evento) : null,
    horaInicio: reserva.hora_inicio,
    horaTermino: reserva.hora_termino,
    direccion: NEGOCIO.direccion.completa,
    sectorLabel,
    ninosLabel,
    mayoresLabel,
    pack: packDesdeSnapshot(reserva),
    adicionales: d.adicionales,
    incluidos: d.incluidos,
    // Para que "Agregar un adicional" sepa qué ocultar/deshabilitar sin
    // tener que volver a pedir la configuración cruda.
    extrasIds: [...d.adicionales, ...d.incluidos].map((x) => x.id),
    total: reserva.total,
    pagado: reserva.pagado,
    saldoPendiente: saldo.pendiente,
    puedePagarSaldo: reservaEstaFirme(reserva.estado) && saldo.pendiente > 0,
    proximoPaso,
    postevento: { activo: post.activo, resenaUrl },
    telefono: NEGOCIO.telefono,
    telefonoE164: NEGOCIO.telefonoE164,

    // ── Contratado vs. informado (documento §5) — dos fuentes distintas,
    // nunca se mezclan: `contratado` sale de la contratación (reserva.ninos/
    // mayores, jamás tocados por una reducción operacional); `datosFinales`
    // es la última confirmación, o null si todavía no se confirmó nada.
    contratado: { ninos: reserva.ninos, mayores: reserva.mayores },
    datosFinales: datosFinales ? {
      ninosFinal: datosFinales.ninos_final,
      mayoresFinal: datosFinales.mayores_final,
      adultosAprox: datosFinales.adultos_aprox,
      adultoResponsable: datosFinales.adulto_responsable,
      telefonoOperacional: datosFinales.telefono_operacional,
      observacion: datosFinales.observacion,
      confirmadoEn: datosFinales.confirmado_en instanceof Date
        ? datosFinales.confirmado_en.toISOString()
        : datosFinales.confirmado_en,
    } : null,

    // Solo lo activo — RETIRADO ya no debe aparecer como algo por resolver
    // (documento §10.C). El histórico completo queda en la tabla, para
    // /cadena y auditoría, no para esta pantalla.
    pendientesProveedor: (pendientes || [])
      .filter((p) => p.estado !== 'RETIRADO')
      .map((p) => ({ tipo: p.tipo, itemId: p.item_id, detalle: p.detalle, estado: p.estado })),
  };
}
