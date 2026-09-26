// ─────────────────────────────────────────────────────────────────────────────
// FORMA DE LA PLANILLA DE COTIZACIONES
//
// Todo lo que decide QUÉ se escribe y QUÉ se devuelve vive acá, sin googleapis
// ni Next: la ruta solo se encarga de hablar con Google. Así estas reglas
// —el orden de las columnas, la fila vigente, la comparación del token— se
// pueden probar de verdad en `scripts/qa-cotizacion.mjs`, sin credenciales.
// ─────────────────────────────────────────────────────────────────────────────

// El orden NO se altera nunca: las columnas nuevas se agregan al final para
// que las filas ya escritas en la planilla de César sigan calzando.
export const COLUMNAS = [
  'ID', 'Creada', 'Estado', 'Fecha evento', 'Horario', 'Sector',
  'Festejado', 'Edad', 'Festejados',
  'Invitados', 'Total exacto', 'Mayores de 6', 'Mayores exacto',
  'Pack', 'Variante', 'Elecciones del pack',
  'Dejar preparado', 'Adicionales', 'Por cotizar',
  'Pack Celebra', 'Horas adicionales', 'Código',
  'Total', 'Es estimado', 'Anticipo', 'Saldo', 'Versión T&C',
  'Horario real', 'Pack ID', 'Token',
];

// Índices con nombre: leer fila[28] no le dice nada a nadie dentro de seis meses.
export const COL = Object.fromEntries(COLUMNAS.map((c, i) => [c, i]));

export const RANGO = 'A:AD';        // 30 columnas
export const RANGO_CABECERA = 'A1:AD1';

export const ID_VALIDO = /^CSC-\d{4}-[A-Z0-9]{4,10}$/;

export const texto = (v, max = 300) => String(v ?? '').trim().slice(0, max);
export const lista = (v) =>
  (Array.isArray(v) ? v.map((x) => texto(x, 80)).join(', ').slice(0, 500) : '');

// Convierte el cuerpo recibido en la fila que se escribe en la planilla.
export function aFila(c, creada) {
  const inv = c.invitados || {};
  const pack = c.pack || null;
  return [
    texto(c.id, 40),
    texto(creada, 40),
    texto(c.estadoSolicitud || 'enviada_whatsapp', 40),
    texto(c.evento?.fechaTexto || c.evento?.fecha, 60),
    texto(c.evento?.horario, 10),
    texto(c.evento?.sector, 20),
    texto(c.festejado?.nombre, 80),
    texto(c.festejado?.edad, 10),
    texto(c.festejado?.festejados, 5),
    texto(inv.etiqueta, 40),
    texto(inv.totalExacto, 10),
    texto(inv.etiquetaMayores, 40),
    texto(inv.mayoresExacto, 10),
    texto(pack?.nombre, 80),
    texto(pack?.varianteId, 30),
    lista(pack?.elecciones),
    lista(c.preparados),
    lista(c.adicionales),
    lista(c.cotizar),
    c.packCelebra ? 'Sí' : '',
    texto(c.evento?.horasAdicionales ?? 0, 3),
    texto(c.codigo, 30),
    texto(c.total, 15),
    c.esEstimado ? 'Estimado' : 'Cerrado',
    texto(c.anticipo, 15),
    texto(c.saldo, 15),
    texto(c.tycVersion, 20),
    texto(c.evento?.horarioTexto, 40),
    texto(pack?.packId, 40),
    texto(c.accessToken, 64),
  ];
}

// La última fila con ese ID es la versión vigente: si la cotización se reenvió
// corregida, se devuelve la corregida y no la primera (§P0-25).
export function filaVigente(filas, id) {
  const coincidencias = (filas || []).filter((f) => f[COL['ID']] === id);
  return coincidencias.length ? coincidencias[coincidencias.length - 1] : null;
}

// Comparación en tiempo constante: el largo del token no filtra por dónde falla.
export function tokenIgual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// La cotización guarda el nombre del festejado y los datos del evento: no se
// entrega solo con adivinar el ID (§P0-23).
export const filaAutorizada = (fila, token) => {
  const guardado = texto(fila?.[COL['Token']], 64);
  return !!guardado && tokenIgual(guardado, texto(token, 64));
};

// Solo lo que /confirmacion necesita para precargar el formulario.
export function aCotizacion(fila) {
  const val = (nombre) => fila[COL[nombre]] || null;
  return {
    id: val('ID'),
    fechaEvento: val('Fecha evento'),
    horario: val('Horario'),
    horarioTexto: val('Horario real'),
    horasAdicionales: Number(fila[COL['Horas adicionales']]) || 0,
    festejado: val('Festejado'),
    edad: val('Edad'),
    invitados: val('Invitados'),
    totalExacto: val('Total exacto'),
    mayores: val('Mayores de 6'),
    mayoresExacto: val('Mayores exacto'),
    packId: val('Pack ID'),
    packNombre: val('Pack'),
    varianteId: val('Variante'),
    elecciones: (val('Elecciones del pack') || '').split(', ').filter(Boolean),
    total: val('Total'),
    tycVersion: val('Versión T&C'),
  };
}
