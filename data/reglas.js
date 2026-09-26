// ══════════════════════════════════════════════════════════════════════
// MOTOR DE REGLAS — CELEBRA SIN CESAR
// ──────────────────────────────────────────────────────────────────────
// Único lugar donde vive la lógica de "qué se muestra y qué se puede
// vender según cómo será la celebración". Ninguna pantalla decide por su
// cuenta: todas preguntan acá.
//
// Entradas: tramo de invitados, edad del festejado, tramo de mayores de 6.
// Salidas:  tramo de precios del motor, qué adicionales se ofrecen, qué
//           pack de mayores corresponde y qué opciones son válidas en él.
// ══════════════════════════════════════════════════════════════════════

import { CATEGORIAS_ADICIONALES, NEGOCIO, PRECIOS_EXTRAS } from './master';
import { PACKS_MAYORES } from './packs-mayores';

// ── Límite duro del sistema ───────────────────────────────────────────
export const MAX_NINOS = 40;
export const MIN_NINOS = 1;

const acotar = (n, min, max) => Math.max(min, Math.min(max, Number(n) || min));

// Formato de peso chileno. Vive aqui para que lo puedan usar tanto los
// componentes de cliente como las paginas renderizadas en el servidor.
export const clp = (n) => `$${Number(n).toLocaleString('es-CL')}`;


// ═════════════════════════════════════════════════════════════════════
// HORARIO EFECTIVO — la única fuente de verdad sobre la duración
//
// La hora adicional NO es una consulta: se contrata al elegir el horario
// y se suma al total. Cada turno crece en una dirección distinta:
//   AM 11:00–14:00  →  +1 hora HACIA ATRÁS   →  10:00–14:00
//   PM 15:00–18:00  →  +1 / +2 HACIA ADELANTE → 15:00–19:00 / 15:00–20:00
//   Viernes PM 16:00–19:00 → +1 HACIA ADELANTE → 16:00–20:00 (§Fase 1A)
//
// Wizard, precio, resumen, Revisa, cotización, WhatsApp, /confirmacion y
// /cadena leen de aquí. Nunca se reconstruye un horario a mano.
//
// TODAS estas funciones toman un segundo/tercer parámetro `fecha`
// OPCIONAL: sin fecha se comportan exactamente igual que antes de esta
// fase (sáb/dom), así que ningún llamador existente se rompe. Con fecha,
// y si esa fecha cae viernes, resuelven contra `NEGOCIO.turnosViernes` en
// vez de `NEGOCIO.turnos` — es la única bifurcación "if viernes" de todo
// el proyecto; todo lo demás (frontend incluido) consume esta función,
// nunca reimplementa la regla (documento "Autorización Fase 1A",
// 13-sep-2026, §3).
// ═════════════════════════════════════════════════════════════════════

// Fecha "YYYY-MM-DD" (o Date) → ¿cae viernes? Mismo patrón ya probado que
// usa esSabado() en data/precios.js: se lee a mediodía para que ningún
// desfase de zona horaria corra el día calendario (§6 — America/Santiago,
// nunca UTC puro).
export function esViernes(fecha) {
  if (!fecha) return false;
  const d = fecha instanceof Date ? fecha : new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 5;
}

const tablaTurnos = (fecha) => (esViernes(fecha) ? NEGOCIO.turnosViernes : NEGOCIO.turnos);

export const turnoPorId = (id, fecha) => tablaTurnos(fecha).find((t) => t.id === id) || null;

// Cuántas horas se pueden contratar en ese turno (AM 1 · PM 2 · PM viernes 1).
export const maxHorasAdicionales = (turno, fecha) => turnoPorId(turno, fecha)?.maxAdicionales ?? 0;

const sumarHoras = (hhmm, horas) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(h + horas).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Calcula el horario efectivo para un turno+horas YA VALIDADOS. Sigue
// acotando internamente por seguridad de despliegue (una sesión vieja
// guardada con más horas de las que hoy correspondan no debe romper el
// render) — pero esto NUNCA es la puerta de entrada de una reserva nueva:
// esa puerta es validarTurnoFecha(), más abajo, que rechaza en vez de
// acotar (§2: "NO hacer clamp silencioso").
export function horarioEfectivo(turno, horasAdicionales = 0, fecha) {
  const t = turnoPorId(turno, fecha);
  if (!t) return null;
  const horas = acotar(horasAdicionales, 0, t.maxAdicionales);
  const horaInicio  = t.crece === 'atras'    ? sumarHoras(t.desde, -horas) : t.desde;
  const horaTermino = t.crece === 'adelante' ? sumarHoras(t.hasta,  horas) : t.hasta;
  return {
    turno: t.id,
    horas,
    horaInicio,
    horaTermino,
    texto: `${horaInicio}–${horaTermino}`,
    textoLargo: `${t.label} · ${horaInicio}–${horaTermino}`,
    precioAdicional: horas * PRECIOS_EXTRAS.hora_adicional,
  };
}

// ═════════════════════════════════════════════════════════════════════
// VALIDAR TURNO + FECHA — la puerta de entrada real (§2, §4, §5)
//
// A diferencia de horarioEfectivo(), esta función NUNCA transforma un
// valor inválido en uno válido: si el turno o las horas no corresponden
// a esa fecha, devuelve ok:false con un motivo y un mensaje semánticos —
// nunca acota en silencio. Es lo único que crearReserva() y
// crearReservaManual() usan antes de escribir en Postgres (§4): ningún
// entry point confía en lo que ya validó el wizard o el panel.
// ═════════════════════════════════════════════════════════════════════
export function validarTurnoFecha(turnoId, horasAdicionales, fecha) {
  const t = turnoPorId(turnoId, fecha);
  if (!t) {
    if (turnoId === 'AM' && esViernes(fecha)) {
      return {
        ok: false, motivo: 'viernes_sin_am',
        mensaje: 'Los viernes las celebraciones están disponibles únicamente en turno PM desde las 16:00.',
      };
    }
    return { ok: false, motivo: 'turno_invalido', mensaje: 'El turno debe ser AM o PM.' };
  }
  const horas = Number.isInteger(horasAdicionales) ? horasAdicionales : Number(horasAdicionales) || 0;
  if (horas < 0 || horas > t.maxAdicionales) {
    if (esViernes(fecha) && t.id === 'PM') {
      return { ok: false, motivo: 'viernes_exceso_horas', mensaje: 'Los viernes se permite máximo 1 hora adicional.' };
    }
    return { ok: false, motivo: 'exceso_horas', mensaje: `Este turno admite hasta ${t.maxAdicionales} hora(s) adicional(es).` };
  }
  return { ok: true, turno: t, horas };
}

// Sesiones guardadas antes del patch traen `horaExtra` booleano. Una hora
// extra siempre cabe en ambos turnos, así que true → 1 y false → 0. Si el
// estado ya viene con horas explícitas, ese valor manda.
export function migrarHoraExtra(estado = {}) {
  if (Number.isFinite(Number(estado.horasAdicionales))) return Number(estado.horasAdicionales);
  return estado.horaExtra === true ? 1 : 0;
}

// Todas las duraciones contratables de un turno, para pintar el selector.
export function opcionesHorario(turno, fecha) {
  const t = turnoPorId(turno, fecha);
  if (!t) return [];
  return Array.from({ length: t.maxAdicionales + 1 }, (_, horas) => horarioEfectivo(t.id, horas, fecha));
}


// ─────────────────────────────────────────────────────────────────────
// TRAMOS DE INVITADOS
//
// Al papá se le preguntan RANGOS, no un número exacto: nadie sabe cuántos
// niños van a llegar y pedir precisión convierte el armador en una
// calculadora. El número exacto solo se pide en 31-40, donde cada niño
// sobre 30 cambia el precio.
//
// `cantNinos` es el identificador que ya usa el motor de precios: este
// campo es el adaptador que evita reescribir la fórmula.
// ─────────────────────────────────────────────────────────────────────
export const TRAMOS_INVITADOS = [
  { id: 'hasta10', label: 'Hasta 10',  corto: 'hasta 10 niños',  min: 1,  max: 10, cantNinos: 'hasta10', pideExacto: false },
  { id: '11a20',   label: '11 a 20',   corto: '11 a 20 niños',   min: 11, max: 20, cantNinos: 'hasta20', pideExacto: false },
  { id: '21a30',   label: '21 a 30',   corto: '21 a 30 niños',   min: 21, max: 30, cantNinos: 'hasta30', pideExacto: false },
  { id: '31a40',   label: '31 a 40',   corto: '31 a 40 niños',   min: 31, max: 40, cantNinos: 'mas30',   pideExacto: true  },
];

export const tramoInvitadosPorId = (id) => TRAMOS_INVITADOS.find((t) => t.id === id) || null;

// Tramo que corresponde a una cantidad exacta (lo usa /confirmacion, que sí
// pregunta el número final, y el rescate de sesiones antiguas).
export const tramoInvitadosDesdeCantidad = (n) => {
  const c = Number(n) || 0;
  if (c <= 0) return null;
  return (TRAMOS_INVITADOS.find((t) => c >= t.min && c <= t.max) || TRAMOS_INVITADOS[3]).id;
};

// Adaptador tramo → motor de precios. La fórmula no se tocó.
export const cantNinosDeTramo = (tramoId) => tramoInvitadosPorId(tramoId)?.cantNinos ?? 'hasta10';

// Cuántos niños puede haber como máximo en un tramo (tope para los mayores).
export const maxNinosDeTramo = (tramoId) => tramoInvitadosPorId(tramoId)?.max ?? MAX_NINOS;

// Niños por sobre 30 (los que suman $10.000 c/u). Solo aplica a 31-40.
export const ninosExtraDesdeTotal = (total) => Math.max(0, (Number(total) || 0) - 30);

// Compatibilidad: convertir una cantidad exacta al tramo del motor de precios.
export const tramoDesdeTotal = (total) => cantNinosDeTramo(tramoInvitadosDesdeCantidad(total));


// ─────────────────────────────────────────────────────────────────────
// TRAMOS DE NIÑOS MAYORES DE 6
//
// Nunca se expone un número inventado: 1-3 se muestra como "1 a 3", no
// como "2". Solo el tramo superior (7+) tiene un número real porque el
// papá lo escribió.
// ─────────────────────────────────────────────────────────────────────
// Tramos 1-3/4-6/7+ (documento "No autorizo todavía el deploy...",
// 15-sep-2026, §2) — antes eran 1-3/4-7/8+. El tramo superior ahora
// empieza en 7, no en 8: es el único que pide el número real (ver más
// abajo, "Solo el tramo superior tiene un número real").
export const TRAMOS_MAYORES = [
  { id: 'no',   label: 'No',              corto: 'Ninguno',   min: 0, max: 0,  interno: 0 },
  { id: '1a3',  label: 'Sí, entre 1 y 3', corto: '1 a 3',     min: 1, max: 3,  interno: 2 },
  { id: '4a6',  label: 'Sí, entre 4 y 6', corto: '4 a 6',     min: 4, max: 6,  interno: 5 },
  { id: '7mas', label: 'Sí, 7 o más',     corto: '7 o más',   min: 7, max: 99, interno: 7 },
];

export const tramoMayoresPorId = (id) => TRAMOS_MAYORES.find((t) => t.id === id) || null;

export const tramoMayoresDesdeCantidad = (n) => {
  const c = Number(n) || 0;
  if (c <= 0) return 'no';
  if (c <= 3) return '1a3';
  if (c <= 6) return '4a6';
  return '7mas';
};

// ── Etiquetas oficiales ───────────────────────────────────────────────
// Función central obligatoria: wizard, resumen, cotización, WhatsApp,
// confirmación y /cadena muestran EXACTAMENTE esto. Así es imposible que
// se filtre a la pantalla el 2 o el 5 que se usan internamente.
// Acepta el estado del wizard o un contexto ya resuelto. Da igual cuál se
// le pase: nunca devuelve el 2 ni el 5 internos, que existen solo para
// dimensionar el pack. El papá eligió un rango y ve un rango (§W).
export function labelMayores(estado = {}) {
  const t = tramoMayoresPorId(estado.tramoMayores);
  if (!t) return null;
  if (t.id === 'no') return 'Ninguno';
  if (t.id === '7mas') {
    const n = Number(estado.mayoresAprox ?? estado.cantidadMayores) || 0;
    return n >= 7 ? `${n} aprox.` : '7 o más';
  }
  return t.corto;
}

// Misma idea que labelMayores: solo se muestra un número exacto en 31-40,
// que es el único tramo donde el papá realmente lo declaró.
export function labelInvitados(estado = {}) {
  const t = tramoInvitadosPorId(estado.tramoInvitados);
  if (!t) return null;
  const exacto = Number(estado.totalExacto ?? estado.totalNinos);
  if (t.pideExacto && exacto >= t.min) return `${exacto} niños`;
  return t.corto;
}


// ─────────────────────────────────────────────────────────────────────
// ATRIBUTOS DE REGLA DE CADA OPCIÓN (defaults)
// ─────────────────────────────────────────────────────────────────────
const DEFAULTS_ITEM = {
  activo: true,
  tamano: null,
  edad_min: 0,
  edad_max: 12,
  ninos_min: 1,
  ninos_max: MAX_NINOS,
  ocultar_si_mayores: false,
  apto_mayores: true,
  categoria_pack: null,
  apto_pack_mayores: false,
};

export const normalizarItem = (item) => ({ ...DEFAULTS_ITEM, ...item });

export const ITEMS = Object.fromEntries(
  CATEGORIAS_ADICIONALES.flatMap((c) => c.items).map((i) => [i.id, normalizarItem(i)])
);

export const getItem = (id) => ITEMS[id] || null;

// A qué categoría del catálogo pertenece cada opción, y si esa categoría
// filtra por edad. Una decoración o un servicio no tienen edad; un inflable sí.
export const CATEGORIA_DE_ITEM = Object.fromEntries(
  CATEGORIAS_ADICIONALES.flatMap((c) => c.items.map((i) => [i.id, c]))
);
export const filtraPorEdad = (itemId) => CATEGORIA_DE_ITEM[itemId]?.filtraPorEdad === true;

// ─────────────────────────────────────────────────────────────────────
// GRUPOS REALES DE LA CELEBRACIÓN
//
// La pregunta correcta no es "¿le sirve al festejado?" sino "¿le sirve a
// alguno de los grupos que queremos entretener?". Con hermanos mayores en
// la fiesta, un ping pong de adultos es pertinente aunque el festejado
// tenga 3 años; sin ellos, no lo es.
// ─────────────────────────────────────────────────────────────────────
export function gruposDeEdad(ctx) {
  const grupos = [];
  const edad = Number(ctx?.edadNino) || 0;
  grupos.push(edad > 0
    ? { nombre: 'festejado', min: edad, max: edad }
    : { nombre: 'pequeños', min: NEGOCIO.edades.min, max: NEGOCIO.edades.max });
  if (ctx?.hayMayores) {
    grupos.push({ nombre: 'mayores', min: NEGOCIO.edades.max + 1, max: 12 });
  }
  return grupos;
}

// ¿El rango etario del producto se cruza con algún grupo real?
export function sirveAAlgunGrupo(item, ctx) {
  return gruposDeEdad(ctx).some((g) => item.edad_min <= g.max && item.edad_max >= g.min);
}


// ─────────────────────────────────────────────────────────────────────
// SECTOR  (regla vigente — definida por César 2026-08-28)
//
//   El Sector Independiente SOLO se ofrece cuando se cumplen las DOS:
//     · hasta 10 invitados, Y
//     · ningún niño mayor de 6.
//   Cualquier otro caso → Recinto Completo.
//
// Por qué: desde 11 niños el sector chico queda estrecho, y la entretención
// de los mayores (inflable gigante, animación, mesas deportivas) se instala
// fuera del área de los más pequeños, así que necesita el recinto entero.
//
// Lo que no corresponde no se muestra deshabilitado: no se ofrece.
// ─────────────────────────────────────────────────────────────────────
export const puedeElegirSector = (totalNinos, edadNino, hayMayoresDe6 = false) => {
  const n = Number(totalNinos) || 0;
  if (n <= 0) return false;
  if (hayMayoresDe6) return false;
  return n <= 10;
};

// Por qué quedó asignado el Recinto Completo, para explicárselo al papá.
export const motivoRecintoCompleto = (totalNinos, edadNino, hayMayoresDe6 = false) => {
  if (hayMayoresDe6) return 'mayores';
  return 'cantidad';
};


// ─────────────────────────────────────────────────────────────────────
// CONTEXTO — la "foto" de la celebración que consumen todas las reglas
//
// Acepta tanto `tramoInvitados` (armador) como `totalNinos` exacto
// (/confirmacion, sesiones antiguas). Para las reglas de "hasta N niños"
// se usa el TOPE del tramo: un "11 a 20" puede ser 20.
// ─────────────────────────────────────────────────────────────────────
export function contextoDesde(estado = {}) {
  const tramoId = estado.tramoInvitados
    || (estado.totalNinos ? tramoInvitadosDesdeCantidad(estado.totalNinos) : null);
  const tramo = tramoInvitadosPorId(tramoId);

  const exacto = tramo?.pideExacto
    ? acotar(estado.totalNinos ?? tramo.min, tramo.min, tramo.max)
    : (Number(estado.totalNinos) || null);

  // Número con el que se evalúan las reglas de capacidad.
  const totalNinos = tramo ? (tramo.pideExacto ? exacto : tramo.max) : 0;

  const tm = tramoMayoresPorId(estado.tramoMayores);
  const hayMayores = !!tm && tm.id !== 'no';
  const cantidadMayores = !hayMayores
    ? 0
    : tm.id === '7mas'
      ? acotar(estado.mayoresAprox ?? tm.interno, 7, tramo ? tramo.max : MAX_NINOS)
      : tm.interno;

  return {
    tramoInvitados: tramo?.id ?? null,
    totalNinos,
    totalExacto: tramo?.pideExacto ? exacto : null,
    ninosExtra: tramo?.pideExacto ? ninosExtraDesdeTotal(exacto) : 0,
    edadNino: Number(estado.edadNino) || 0,
    tramoMayores: tm?.id ?? null,
    hayMayores,
    cantidadMayores,
    cantNinos: tramo ? tramo.cantNinos : 'hasta10',
  };
}


// ─────────────────────────────────────────────────────────────────────
// NORMALIZACIÓN — estados imposibles
//
// Se ejecuta cada vez que cambia el tramo, los mayores, la edad, el sector
// o el pack. Nunca puede quedar: más mayores que niños posibles, un sector
// incompatible, un pack de otra variante o adicionales que ya no aplican.
// Devuelve el estado corregido + `cambios` para avisarle al papá.
// ─────────────────────────────────────────────────────────────────────
export function normalizarConfiguracion(estado = {}) {
  const e = { ...estado };
  const cambios = [];

  const tramo = tramoInvitadosPorId(
    e.tramoInvitados || (e.totalNinos ? tramoInvitadosDesdeCantidad(e.totalNinos) : null)
  );
  if (tramo) e.tramoInvitados = tramo.id;

  // 1 · número exacto solo en 31-40, y siempre dentro del rango
  if (tramo?.pideExacto) {
    e.totalNinos = acotar(e.totalNinos ?? tramo.min, tramo.min, tramo.max);
  } else if (tramo) {
    e.totalNinos = null;
  }

  // 2 · tramo de precios y niños sobre 30 derivados del tramo
  e.cantNinos = tramo ? tramo.cantNinos : null;
  e.ninosExtra = tramo?.pideExacto ? ninosExtraDesdeTotal(e.totalNinos) : 0;

  // 3 · los mayores nunca superan lo que cabe en el tramo
  if (e.tramoMayores === '7mas' && tramo) {
    const tope = tramo.max;
    const antes = Number(e.mayoresAprox) || 7;
    e.mayoresAprox = acotar(antes, 7, tope);
    if (e.mayoresAprox !== antes) cambios.push('Ajustamos la cantidad de niños mayores al máximo posible para este número de invitados.');
  }
  if (e.tramoMayores && e.tramoMayores !== '7mas') e.mayoresAprox = null;

  // 3b · horas adicionales dentro de lo que permite el turno elegido (§P0-7)
  const horasAntes = migrarHoraExtra(e);
  delete e.horaExtra;
  e.horasAdicionales = acotar(horasAntes, 0, maxHorasAdicionales(e.hora, e.fecha));
  if (e.horasAdicionales !== horasAntes) {
    cambios.push('Ajustamos la duración: este horario no admite tantas horas adicionales.');
  }

  const ctx = contextoDesde(e);

  // 4 · sector coherente
  if (tramo && !puedeElegirSector(ctx.totalNinos, e.edadNino, ctx.hayMayores) && e.sector !== 'completo') {
    if (e.sector) cambios.push('Tu celebración pasa al Recinto Completo.');
    e.sector = 'completo';
  }

  // 5 · pack de mayores: debe corresponder al tramo y a la variante vigentes
  const pv = packPara(ctx);
  if (!pv) {
    if (e.packMayores) cambios.push('Ya no corresponde una configuración especial para niños mayores.');
    e.packMayores = null;
  } else if (!e.packMayores
      || e.packMayores.packId !== pv.pack.id
      || e.packMayores.varianteId !== pv.variante.id) {
    if (e.packMayores) cambios.push('Cambió la configuración de entretención para los mayores: vuelve a elegir.');
    e.packMayores = { packId: pv.pack.id, varianteId: pv.variante.id, seleccion: seleccionVacia(pv.variante) };
  }

  // 6 · adicionales que dejaron de corresponder
  const enPack = new Set(itemsDelPack(e.packMayores?.seleccion));
  if (Array.isArray(e.extras) && e.extras.length) {
    const fuera = e.extras.filter((x) => enPack.has(x.id) || !itemVisible(ITEMS[x.id] || x, ctx));
    if (fuera.length) {
      const ids = new Set(fuera.map((x) => x.id));
      e.extras = e.extras.filter((x) => !ids.has(x.id));
      cambios.push(fuera.length === 1
        ? `Quitamos ${fuera[0].nombre}: ya no corresponde para esta celebración.`
        : `Quitamos ${fuera.length} adicionales que ya no corresponden para esta celebración.`);
    }
  }

  return { ...e, cambios };
}


// ─────────────────────────────────────────────────────────────────────
// VISIBILIDAD DE UNA OPCIÓN
//
// Regla central: los inflables GIGANTES siempre pueden ofrecerse; los
// MEDIANOS y PEQUEÑOS solo con hasta 20 niños Y ningún mayor de 6.
// Se expresa con atributos, no con nombres de carpeta.
// Lo que no corresponde no se muestra deshabilitado: no se ofrece.
// ─────────────────────────────────────────────────────────────────────
export function itemVisible(itemRaw, ctx) {
  const item = normalizarItem(itemRaw);
  if (!item.activo) return false;
  // Catálogo público: sin celebración configurada se muestra todo (§38).
  if (!ctx || !ctx.totalNinos) return true;

  // 1 · tamaño: medianos y pequeños solo con ≤20 niños y sin mayores (§12)
  if (ctx.hayMayores && item.ocultar_si_mayores) return false;

  // 2 · capacidad declarada del producto
  if (ctx.totalNinos > item.ninos_max) return false;
  if (ctx.totalNinos < item.ninos_min) return false;

  // 3 · edad, solo donde la edad importa de verdad (§13, §14)
  if (filtraPorEdad(item.id) && !sirveAAlgunGrupo(item, ctx)) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────
// FILTRADO DE LA VITRINA COMPLETA
// ─────────────────────────────────────────────────────────────────────
export function filtrarBloques(bloques, ctx, excluirIds = []) {
  const excluir = new Set(excluirIds);
  return bloques
    .map((bloque) => {
      const grupos = bloque.grupos
        .map((g) => {
          if (!g.itemIds || g.itemIds.length === 0) return g;
          const itemIds = g.itemIds.filter(
            (id) => ITEMS[id] && !excluir.has(id) && itemVisible(ITEMS[id], ctx)
          );
          return { ...g, itemIds };
        })
        .filter((g) => g.portada || !g.itemIds || g.itemIds.length > 0 || g.badgeTipo === 'cotizar');

      const tieneContenido = grupos.some(
        (g) => (g.itemIds && g.itemIds.length > 0) || g.badgeTipo === 'cotizar'
      );
      return tieneContenido ? { ...bloque, grupos } : null;
    })
    .filter(Boolean);
}


// ─────────────────────────────────────────────────────────────────────
// RECOMENDADOS PARA ESTA CELEBRACIÓN
//
// Complementan, no repiten: si el Pack Mayores ya resolvió el inflable, la
// animación o los deportivos, esas categorías no se vuelven a priorizar.
// ─────────────────────────────────────────────────────────────────────
export function recomendados(ctx, yaElegidos = [], maximo = 4, opciones = {}) {
  if (!ctx || !ctx.totalNinos) return [];
  const fuera = new Set(yaElegidos);
  const cubiertas = new Set(opciones.categoriasCubiertas || []);
  const out = [];

  const push = (id, motivo) => {
    const item = ITEMS[id];
    if (!item || fuera.has(id) || out.some((r) => r.item.id === id)) return;
    if (!itemVisible(item, ctx)) return;
    if (item.categoria_pack && cubiertas.has(item.categoria_pack)) return;
    out.push({ item, motivo });
  };

  const { totalNinos, edadNino, hayMayores } = ctx;

  // 1 · el inflable que calza con el grupo (si el pack no puso uno)
  if (!cubiertas.has('inflable_gigante')) {
    if (totalNinos > 20 || hayMayores) {
      push('tobogan-premium', 'Rinde para todo el grupo y también sirve a los niños grandes');
    } else if (edadNino <= 3) {
      push('castillo-avion', 'Del tamaño justo para los más chiquititos');
    } else {
      push('tiburon-escalador', 'El favorito para grupos de hasta 20 niños');
    }
  }

  // 2 · decoración: siempre complementa, nunca la resuelve el pack
  push(totalNinos > 20 ? 'deco-tematica-full' : 'deco-tematica-simple',
    totalNinos > 20
      ? 'Montaje completo para que la mesa luzca con tantos invitados'
      : 'El personaje favorito, sin gastar de más');

  // 3 · pintacaritas: complemento clásico incluso con animación contratada
  push('pintacaritas-globoflexia', 'Entretiene mientras llegan los invitados y encanta a los más chicos');

  // 4 · animación, solo si el pack no puso una
  if (!cubiertas.has('animacion') && totalNinos > 10) {
    push('animacion-full-juegos', 'Con este número de niños, un animador ordena la fiesta');
  }

  // 5 · la Autopista Gigante siempre funciona con los más chicos
  push('funny-bugatti', 'La Autopista Gigante es lo que más recuerdan los niños');

  // 6 · un deportivo para los papás, si el pack no llenó ya esa categoría
  if (!cubiertas.has('deportivo')) {
    push('tacataca-adultos', 'Para que los papás también entren al torneo');
  }

  return out.slice(0, maximo);
}


// ─────────────────────────────────────────────────────────────────────
// ALTERNATIVAS A UN PRODUCTO QUE NO CORRESPONDE
//
// Cuando el papá eligió algo en el catálogo y después su configuración lo
// deja fuera (ej: un inflable mediano con 25 niños), no basta con no
// agregarlo: hay que explicarle por qué y ofrecerle el equivalente que sí
// sirve. Se buscan dentro de la MISMA categoría del catálogo.
// ─────────────────────────────────────────────────────────────────────
export function alternativasPara(itemId, ctx, maximo = 2) {
  const item = ITEMS[itemId];
  if (!item) return [];
  const categoria = CATEGORIAS_ADICIONALES.find((c) => c.items.some((i) => i.id === itemId));
  if (!categoria) return [];
  return categoria.items
    .map((i) => ITEMS[i.id])
    .filter((i) => i && i.id !== itemId && itemVisible(i, ctx))
    .slice(0, maximo);
}

// Por qué un producto quedó fuera, en palabras que el papá entienda.
export function motivoNoDisponible(itemId, ctx) {
  const item = ITEMS[itemId];
  if (!item || !ctx?.totalNinos) return null;
  if (ctx.hayMayores && item.ocultar_si_mayores) {
    return 'está pensado para niños de hasta 6 años y en tu celebración vienen invitados mayores';
  }
  if (ctx.totalNinos > item.ninos_max) {
    return `rinde bien hasta ${item.ninos_max} niños y tu celebración es más grande`;
  }
  if (ctx.totalNinos < item.ninos_min) {
    return `está pensado para grupos de al menos ${item.ninos_min} niños`;
  }
  return 'no corresponde para esta configuración';
}


// ══════════════════════════════════════════════════════════════════════
// PACKS PARA MAYORES DE 6
// ══════════════════════════════════════════════════════════════════════

export function packPara(ctx) {
  if (!ctx || !ctx.hayMayores || !ctx.totalNinos) return null;
  const pack = PACKS_MAYORES.find(
    (p) => ctx.cantidadMayores >= p.tramo_mayores_min && ctx.cantidadMayores <= p.tramo_mayores_max
  );
  if (!pack) return null;
  const variante = pack.variantes.find(
    (v) => ctx.totalNinos >= v.total_ninos_min && ctx.totalNinos <= v.total_ninos_max
  );
  if (!variante) return null;
  return { pack, variante };
}

export function opcionesPack(categoria, ctx) {
  return Object.values(ITEMS).filter(
    (i) => i.apto_pack_mayores && i.categoria_pack === categoria && i.activo && itemVisible(i, ctx)
  );
}

export const cantidadPedida = (rama, categoria) =>
  (rama?.pide || []).filter((p) => p.categoria === categoria).reduce((a, p) => a + p.cantidad, 0);

export function ramaActiva(requisito, seleccion) {
  if (!requisito) return null;
  if (requisito.ramas.length === 1) return requisito.ramas[0];
  const id = seleccion?.[requisito.id]?.rama;
  return requisito.ramas.find((r) => r.id === id) || null;
}

export function packCompleto(variante, seleccion) {
  if (!variante) return false;
  return variante.requisitos.every((req) => {
    const rama = ramaActiva(req, seleccion);
    if (!rama) return false;
    const elegidos = seleccion?.[req.id]?.items || [];
    return rama.pide.every((p) => {
      const n = elegidos.filter((id) => ITEMS[id]?.categoria_pack === p.categoria).length;
      return n === p.cantidad;
    });
  });
}

export function itemsDelPack(seleccion) {
  if (!seleccion) return [];
  return Object.values(seleccion).flatMap((r) => r?.items || []);
}

// Categorías que el pack ya resolvió — para no recomendar más de lo mismo.
export function categoriasCubiertasPorPack(variante, seleccion) {
  if (!variante) return [];
  const cubiertas = new Set();
  for (const req of variante.requisitos) {
    const rama = ramaActiva(req, seleccion);
    if (!rama) continue;
    const elegidos = seleccion?.[req.id]?.items || [];
    for (const p of rama.pide) {
      const n = elegidos.filter((id) => ITEMS[id]?.categoria_pack === p.categoria).length;
      if (n >= p.cantidad) cubiertas.add(p.categoria);
    }
  }
  return [...cubiertas];
}

// Precio del pack. Mientras `variante.precio` sea null es un VALOR
// REFERENCIAL (la suma de lo elegido), nunca un precio cerrado.
export function precioPack(variante, seleccion, cantNinos = 'hasta10') {
  if (!variante) return 0;
  if (variante.precio != null) return variante.precio;
  const suma = itemsDelPack(seleccion).reduce((acc, id) => {
    const it = ITEMS[id];
    if (!it) return acc;
    return acc + (it.precios?.[cantNinos] ?? it.precios?.hasta10 ?? it.precio ?? 0);
  }, 0);
  return Math.max(0, suma - (variante.descuento || 0));
}

export const packEsReferencial = (variante) => !!variante && variante.precio == null;


// ══════════════════════════════════════════════════════════════
// HERMANOS MAYORES
//
// Sumar niños mayores de 6 tiene un valor cerrado por tramo. No incluye
// productos: lo que elijan para entretenerse se cobra aparte, a precio de
// catálogo, como cualquier otro adicional.
//
// La entretención NO se configura por adelantado. El papá recorre el
// catálogo, agrega lo que le gusta, y recién al salir de Personaliza se
// comprueba si lo que ya eligió alcanza para los grandes. Si alcanza —y en
// la mayoría de los casos alcanza— no se entera de que existía una regla.
// ══════════════════════════════════════════════════════════════
export function valorMayores(ctx) {
  if (!ctx?.hayMayores) return 0;
  const tarifa = PRECIOS_EXTRAS.hermanos_mayores;
  const base = tarifa[ctx.tramoMayores] || 0;
  if (ctx.tramoMayores !== '7mas') return base;
  const sobre7 = Math.max(0, (Number(ctx.cantidadMayores) || 7) - 7);
  return base + sobre7 * tarifa.por_mayor_sobre_7;
}

// ¿Lo que ya está en el carro alcanza para entretener a los grandes?
//
// Devuelve los bloques que faltan, cada uno con las alternativas que los
// satisfacen. Un bloque con varias ramas se cumple con CUALQUIERA de ellas.
export function evaluarMayores(extras, ctx) {
  const pv = packPara(ctx);
  if (!pv) return { cumple: true, faltantes: [], variante: null };

  // Cuántos productos aptos hay ya elegidos, por categoría.
  const disponibles = { deportivo: 0, inflable_gigante: 0, animacion: 0 };
  for (const e of extras || []) {
    const item = ITEMS[e?.id] || e;
    if (item?.apto_pack_mayores && item.categoria_pack in disponibles) {
      disponibles[item.categoria_pack] += 1;
    }
  }

  // Los bloques fijos se resuelven primero: si un bloque de elección se
  // quedara con las mesas que otro necesita sí o sí, pediríamos de más.
  const porRamas = (a, b) => a.ramas.length - b.ramas.length;
  const faltantes = [];
  for (const req of [...pv.variante.requisitos].sort(porRamas)) {
    const alcanza = (rama) => rama.pide.every((p) => disponibles[p.categoria] >= p.cantidad);
    const rama = req.ramas.find(alcanza);
    if (rama) {
      for (const p of rama.pide) disponibles[p.categoria] -= p.cantidad;
      continue;
    }
    faltantes.push({
      id: req.id,
      titulo: req.titulo,
      opciones: req.ramas.map((r) => ({
        id: r.id,
        label: r.label,
        resumen: r.resumen,
        pide: r.pide.map((p) => ({
          categoria: p.categoria,
          cantidad: p.cantidad,
          faltan: Math.max(0, p.cantidad - disponibles[p.categoria]),
        })),
      })),
    });
  }
  return { cumple: faltantes.length === 0, faltantes, variante: pv.variante };
}

// ¿El valor que se le muestra al papá es un estimado o un total cerrado?
//
// Lo único que puede volver estimada una cotización es un pack de mayores sin
// precio cerrado y ya con productos elegidos. Las horas adicionales tienen
// precio fijo y se contratan al elegir el horario: NO la vuelven estimada
// (§P1-31, §P1-32). Pantalla, WhatsApp y planilla llaman siempre a esta función.
export function cotizacionEsReferencial() {
  // Todo tiene precio cerrado: arriendo, horas, adicionales y el valor de los
  // hermanos mayores. Ya no queda ningún componente por confirmar, así que la
  // web siempre puede decir "Valor total" (§P1-31).
  return false;
}

export function seleccionVacia(variante) {
  if (!variante) return {};
  return Object.fromEntries(
    variante.requisitos.map((req) => [
      req.id,
      { rama: req.ramas.length === 1 ? req.ramas[0].id : null, items: [] },
    ])
  );
}

export function resumenPack(variante, seleccion) {
  if (!variante) return [];
  return variante.requisitos.flatMap((req) => {
    const rama = ramaActiva(req, seleccion);
    const items = (seleccion?.[req.id]?.items || []).map((id) => ITEMS[id]).filter(Boolean);
    if (!items.length) return [];
    return items.map((i) => ({ id: i.id, nombre: i.nombre, emoji: i.emoji, rama: rama?.label || '' }));
  });
}
