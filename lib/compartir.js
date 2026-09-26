// ══════════════════════════════════════════════════════════════════════
// COMPARTIR ALCE KIDS  ·  lib/compartir.js
// ──────────────────────────────────────────────────────────────────────
// Documento "FASE 3B — POSTEVENTO — IMPLEMENTAR BLOQUE B" (24-sep-2026,
// §8-§10, §14). Puro y sin dependencias de servidor: lo usa la página
// /mi-celebracion en el navegador. El contenido compartible es SOLO marca +
// URL pública (NEGOCIO.sitio): nunca el enlace seguro de Mi Celebración, el
// código de reserva, el festejado, la fecha ni ningún dato personal.
// Compartir NO es dejar una reseña, y aquí no se registra nada.
// ══════════════════════════════════════════════════════════════════════

import { NEGOCIO } from '../data/master';

export const TEXTO_COMPARTIR = 'Celebramos en Alce Kids y nos encantó 🎈 Te dejo el lugar por si estás buscando dónde celebrar.';

export function contenidoCompartir() {
  return { title: 'Alce Kids', text: TEXTO_COMPARTIR, url: NEGOCIO.sitio };
}

// "…dónde celebrar: {URL_PUBLICA}" — mismo contenido que Web Share, en un
// solo texto para WhatsApp/portapapeles.
export function mensajeFallbackCompartir(contenido = contenidoCompartir()) {
  return `${contenido.text.replace(/\.$/, '')}: ${contenido.url}`;
}

export function urlWhatsAppCompartir(contenido = contenidoCompartir()) {
  return `https://wa.me/?text=${encodeURIComponent(mensajeFallbackCompartir(contenido))}`;
}

// `nav`: navigator (inyectable para probar). Con Web Share API la usa; si
// no existe —o falla por algo distinto a que el usuario cancele— devuelve
// el fallback (WhatsApp + copiar).
export async function compartirAlceKids({ nav, contenido = contenidoCompartir() } = {}) {
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share(contenido);
      return { via: 'web_share', ok: true };
    } catch (err) {
      if (err && err.name === 'AbortError') return { via: 'web_share', ok: false, cancelado: true };
    }
  }
  return {
    via: 'fallback',
    ok: true,
    whatsappUrl: urlWhatsAppCompartir(contenido),
    mensaje: mensajeFallbackCompartir(contenido),
  };
}
