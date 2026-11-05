// ══════════════════════════════════════════════════════════════════════
// ENCABEZADO POST-PAGO  ·  lib/encabezado-pago.js
// ──────────────────────────────────────────────────────────────────────
// Puro (sin Postgres ni red): lo usan la pantalla /pago/resultado y el
// correo que recibe la familia cuando César registra un saldo o adicional
// a mano — así los dos dicen exactamente lo mismo.
//
// El anticipo es lo que RESERVA la fecha; el saldo y los adicionales llegan
// sobre una celebración que ya estaba reservada, así que confirman el pago
// en vez de repetir "ya está reservada". Si el pago llega después del
// cumpleaños (cualquier tipo), se agradece y se cierra la cuenta.
// ══════════════════════════════════════════════════════════════════════

export function encabezadoPostPago({ tipo, saldoPendiente, festejado, yaCelebrada }) {
  if (yaCelebrada) {
    return saldoPendiente <= 0
      ? {
        icono: '💙',
        titulo: '¡Pago recibido, muchas gracias!',
        bajada: `La celebración de ${festejado} quedó totalmente pagada. Gracias por celebrar con nosotros 🎈`,
      }
      : {
        icono: '💙',
        titulo: '¡Pago recibido, muchas gracias!',
        bajada: `Quedó registrado en la celebración de ${festejado}.`,
      };
  }
  if (tipo === 'BALANCE' || tipo === 'EXTRA') {
    if (saldoPendiente <= 0) {
      return {
        icono: '✅',
        titulo: `¡Pago completo! La celebración de ${festejado} está 100% confirmada`,
        bajada: 'Ya no queda nada pendiente: solo falta celebrar 🎈',
      };
    }
    return {
      icono: '✅',
      titulo: '¡Pago recibido!',
      bajada: `Quedó registrado en la celebración de ${festejado}.`,
    };
  }
  return { icono: '🎉', titulo: `🎉 ¡La celebración de ${festejado} ya está reservada!`, bajada: null };
}
