// ══════════════════════════════════════════════════════════════════════
// PDF CONSERVABLE DE UNA VERSIÓN CONTRACTUAL  ·  lib/pdf-tyc.js
// ──────────────────────────────────────────────────────────────────────
// UN PDF POR VERSIÓN de T&C, nunca uno por reserva (documento "No autorizo
// todavía el deploy...", 15-sep-2026, §9-10). Se genera UNA SOLA VEZ, al
// publicar la versión (o, para las dos versiones ya publicadas antes de
// que existiera esta arquitectura, en el backfill de
// scripts/generar-pdf-tyc-version.mjs) — nunca durante un pago.
//
// La fuente es el `contenido` YA CANÓNICO y hasheado de tyc_version — el
// mismo texto exacto que sha256() ya usó para contenido_sha256. El PDF no
// vuelve a decidir qué dice el contrato, solo lo tipografía: reproducible,
// conservable, inmutable (protegido por el mismo trigger que el resto de
// la fila — ver lib/db.js), y hasheable con el mismo sha256() de siempre.
//
// Librería: @react-pdf/renderer (revisado primero qué ya existía en el
// proyecto — nada: no había ninguna capacidad de PDF. Se eligió por ser
// puro JavaScript —sin binarios nativos ni Chromium headless, que hubiera
// sido justo la "infraestructura compleja" que no correspondía agregar en
// un entorno serverless— y por tipografiar párrafos/listas con paginación
// automática, que es exactamente la forma del documento).
// ══════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const estilos = StyleSheet.create({
  pagina: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#111827' },
  titulo: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitulo: { fontSize: 9, color: '#6B7280', marginBottom: 18 },
  seccionTitulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1565C0', marginTop: 14, marginBottom: 6 },
  parrafo: { marginBottom: 6, lineHeight: 1.4, textAlign: 'justify' },
  item: { marginBottom: 4, marginLeft: 10, lineHeight: 1.4, textAlign: 'justify' },
  pie: {
    position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#9CA3AF',
    textAlign: 'center', borderTop: '0.5 solid #E5E7EB', paddingTop: 6,
  },
  numeroPagina: { position: 'absolute', bottom: 24, right: 48, fontSize: 8, color: '#9CA3AF' },
});

// Divide el `contenido` canónico (formato de documentoDesdeSecciones():
// "N. Titulo\n\ntexto" unidas por "\n\n---\n\n") de vuelta en secciones
// estructuradas — el PDF nunca vuelve a tocar la fuente JSX/HTML, solo el
// texto ya inmutable que quedó guardado en tyc_version.contenido.
export function parseSeccionesDesdeContenido(contenido) {
  return contenido.split('\n\n---\n\n').map((bloque) => {
    const m = bloque.match(/^(\d+)\.\s(.+?)\n\n([\s\S]*)$/);
    if (!m) throw new Error(`No se pudo parsear un bloque de contenido para el PDF: "${bloque.slice(0, 60)}..."`);
    const [, numero, titulo, cuerpo] = m;
    // Cada línea del cuerpo es un párrafo o, si empieza con "- ", un ítem
    // de lista — mismo convenio que jsxATexto()/jsxATextoHTML() usan al
    // producir este texto.
    const lineas = cuerpo.split('\n').filter(Boolean);
    return { numero: Number(numero), titulo, lineas };
  });
}

function DocumentoTyc({ version, secciones, publicadoEn }) {
  const fechaTexto = publicadoEn
    ? new Date(publicadoEn).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santiago' })
    : null;
  // creationDate FIJA (§10 "reproducible"): sin esto, @react-pdf/renderer
  // usa `new Date()` por defecto — el PDF y su /ID interno (que pdfkit
  // deriva de CreationDate, ver PDFSecurity.generateFileID) cambiarían en
  // cada generación aunque el contenido fuera idéntico, y el sha256 nunca
  // sería estable. Se usa publicadoEn (o una fecha fija si no hay) para
  // que la fecha del PDF además tenga sentido semántico.
  const fechaCreacion = publicadoEn ? new Date(publicadoEn) : new Date('2026-01-01T00:00:00-03:00');
  return React.createElement(
    Document,
    {
      title: `Términos y Condiciones — versión ${version}`,
      author: 'Alce Kids · Celebra Sin Cesar SpA',
      creationDate: fechaCreacion,
    },
    React.createElement(
      Page,
      { size: 'A4', style: estilos.pagina },
      React.createElement(Text, { style: estilos.titulo }, 'Términos y Condiciones de Uso'),
      React.createElement(
        Text,
        { style: estilos.subtitulo },
        `Alce Kids · Celebra Sin Cesar SpA · Versión ${version}` + (fechaTexto ? ` · Publicada el ${fechaTexto}` : '')
      ),
      ...secciones.flatMap((s) => [
        React.createElement(Text, { key: `t${s.numero}`, style: estilos.seccionTitulo }, `${s.numero}. ${s.titulo}`),
        ...s.lineas.map((linea, i) => React.createElement(
          Text,
          { key: `${s.numero}-${i}`, style: linea.startsWith('- ') ? estilos.item : estilos.parrafo },
          linea
        )),
      ]),
      React.createElement(
        Text,
        { style: estilos.pie, fixed: true },
        'Alce Kids · CELEBRA SIN CESAR SpA · Talavera de la Reina 380, Las Condes, Santiago, Chile'
      ),
      React.createElement(
        Text,
        { style: estilos.numeroPagina, render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`, fixed: true }
      )
    )
  );
}

// Genera el PDF de una versión contractual desde su contenido canónico.
// Devuelve { bytes, sha256 } — el hash es del PDF resultante, no del
// contenido de texto (ese ya tiene el suyo en contenido_sha256).
export async function generarPdfVersion({ version, contenido, publicadoEn }) {
  const secciones = parseSeccionesDesdeContenido(contenido);
  const bytes = await renderToBuffer(
    React.createElement(DocumentoTyc, { version, secciones, publicadoEn })
  );
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  return { bytes, sha256: hash };
}
