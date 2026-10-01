// ══════════════════════════════════════════════════════════════════════
// ANALÍTICA DEL EMBUDO  (§BT)
// ──────────────────────────────────────────────────────────────────────
// Una sola función para medir todo el recorrido del papá por el armador.
//
// Cómo funciona:
//   · Si existe NEXT_PUBLIC_GA_ID, el layout carga Google Analytics 4 y
//     los eventos viajan por gtag().
//   · Si existe un Google Tag Manager, también se empujan a dataLayer.
//   · Si no hay ninguno configurado, `track()` no hace absolutamente nada
//     y no rompe: la web funciona igual, simplemente no se mide.
//
// QUÉ NO SE ENVÍA NUNCA (§BT):
//   nombres, teléfonos, correos, la fecha exacta ni el número de cotización.
//   Solo viajan datos agregados —tramo, sector, si hay pack, total— que
//   sirven para entender el embudo sin identificar a nadie.
// ══════════════════════════════════════════════════════════════════════

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

// Eventos del embudo, en el orden en que ocurren.
export const EVENTOS = {
  wizardStarted:        'wizard_started',
  dateSelected:         'date_selected',
  birthdayCompleted:    'birthday_completed',
  guestRangeSelected:   'guest_range_selected',
  olderChildrenSelected:'older_children_selected',
  sectorSelected:       'sector_selected',
  personalizationStarted:'personalization_started',
  olderPackStarted:     'older_pack_started',
  olderPackCompleted:   'older_pack_completed',
  recommendationAdded:  'recommendation_added',
  extraAdded:           'extra_added',
  reviewReached:        'review_reached',
  summaryOpened:        'summary_opened',
  whatsappRequestClicked:'whatsapp_request_clicked',
  // Fase 5 — Bloque 8: resto del embudo, desde el checkout hasta el
  // postevento. Mismas reglas (§BT): nunca nombre, email, teléfono, fecha,
  // código de reserva ni ningún identificador privado.
  checkoutReached:      'checkout_reached',
  flowStarted:          'flow_started',
  paymentApproved:      'payment_approved',
  visitCreated:         'visit_created',
  miCelebracionOpened:  'mi_celebracion_opened',
  balancePayClicked:    'balance_pay_clicked',
  balancePaid:          'balance_paid',
  reviewClicked:        'review_clicked',
  shareClicked:         'share_clicked',
};

// Campos que jamás deben salir del navegador, por si alguien los pasa sin querer.
const PROHIBIDOS = new Set([
  'nombre', 'nombreNino', 'telefono', 'email', 'correo', 'fecha', 'id',
  'idCotizacion', 'notas', 'adultoResponsable',
]);

function limpiar(props = {}) {
  const salida = {};
  for (const [k, v] of Object.entries(props)) {
    if (PROHIBIDOS.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    salida[k] = typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : v;
  }
  return salida;
}

export function track(evento, props = {}) {
  if (typeof window === 'undefined' || !evento) return;
  const datos = limpiar(props);
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', evento, datos);
    }
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: evento, ...datos });
    }
  } catch {} // medir nunca puede romper la experiencia
}

// Propiedades estándar de una celebración, ya anonimizadas. Se adjuntan a
// los eventos importantes para poder segmentar el embudo.
export function propsCelebracion(estado = {}, ctx = {}, extras = {}) {
  return {
    tramo: estado.tramoInvitados || null,
    mayores: estado.tramoMayores || null,
    sector: estado.sector || null,
    edad_festejado: estado.edadNino || null,
    festejados: estado.festejados || 1,
    con_pack: !!estado.packMayores,
    n_adicionales: (estado.extras || []).filter((e) => !e.gratis).length,
    ...extras,
  };
}
