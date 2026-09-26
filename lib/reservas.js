// ══════════════════════════════════════════════════════════════════════
// RESERVAS Y PAGOS  ·  lib/reservas.js
// ──────────────────────────────────────────────────────────────────────
// Toda la lógica de negocio del cobro vive acá. Las rutas de /api son
// carcasas delgadas: validan lo que llega, llaman a una de estas funciones
// y devuelven JSON. Así las reglas se leen en un solo archivo y no
// repartidas en siete endpoints.
//
// Dos ideas sostienen todo lo demás:
//
// 1 · EL TURNO SE TOMA ANTES DE PAGAR (§8). Primero se pone el cerrojo,
//     después se manda al papá al checkout. Al revés —cobrar y después
//     bloquear— es exactamente cómo se venden dos veces el mismo sábado.
//
// 2 · ACREDITAR UN PAGO ES IDEMPOTENTE (§15). Flow puede notificar dos
//     veces, el papá puede refrescar la página de resultado, Vercel puede
//     reintentar la función. Nada de eso puede sumar el anticipo dos veces
//     ni crear dos eventos en el calendario. La garantía no es "ojalá no
//     pase": es un UPDATE condicional que solo la primera vez devuelve
//     fila.
// ══════════════════════════════════════════════════════════════════════

import { q, q1 } from './db';
import {
  normalizarConfiguracion, horarioEfectivo, turnoPorId, validarTurnoFecha, contextoDesde,
  tramoInvitadosPorId, tramoMayoresPorId,
} from '../data/reglas';
import { calcularTotal } from '../data/precios';
import { buscarPromo } from '../data/promos';
import { NEGOCIO, TYC_VERSION } from '../data/master';
import {
  classifyTaxTreatment, TRIBUTARIO, TRIBUTARIO_POR_MEDIO_MANUAL, ETIQUETA_MEDIO_MANUAL,
} from './tributario';
// sincronizarPendientesProveedor() importa de este archivo (recalcular no
// hace falta, solo el tipo de dato) — sin ciclo: pendientes-proveedor.js
// no importa nada de reservas.js.
import { sincronizarPendientesProveedor, IDS_DECORACION_TEMATICA } from './pendientes-proveedor';

// Convierte una columna DATE de Postgres a "YYYY-MM-DD" de forma
// confiable. El driver de Neon devuelve estas columnas como objetos
// `Date` de JS, y `String(unaFecha)` en un Date da el formato local
// ("Thu Nov 12 2026 21:00:00 GMT-0300…"), NO un ISO — un día completo
// corrido además, por el huso horario. Encontrado en QA (06-sep-2026):
// Google Calendar rechazaba todos los eventos con "Bad Request" porque
// `rangoHorario()` armaba un `dateTime` con esa fecha corrida
// ("Thu Nov 12T11:00:00", inválido); estadoSaldo() tenía el mismo bug,
// silencioso, en el cálculo de si tocaba avisar el saldo 72h antes.
export function fechaISO(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

// Cuánto se le retiene el turno al papá mientras paga. El timeout de Flow
// usa el mismo horizonte para que las dos ventanas mueran juntas (§8).
// El valor vive en NEGOCIO.holdMinutos (data/master.js) para que el
// cliente (la pantalla de confirmación previa al pago) pueda mostrar el
// mismo número sin importar este archivo, que trae Postgres.
export const MINUTOS_HOLD = NEGOCIO.holdMinutos;

// Estados de reserva (§7)
export const RESERVA = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_VERIFYING: 'PAYMENT_VERIFYING',
  CONFIRMED: 'CONFIRMED',
  BALANCE_PENDING: 'BALANCE_PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  // El dinero llegó, pero el turno ya era de otra reserva cuando llegó
  // (pago tardío después de que el HOLD venció y alguien más lo tomó).
  // Nunca se le quita el turno a quien ya lo tiene: esta reserva queda acá,
  // a la espera de que César la resuelva a mano (reagendar o devolver).
  PAYMENT_CONFLICT: 'PAYMENT_CONFLICT',
};

// Estados de pago (§7)
export const PAGO = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  REFUNDED: 'REFUNDED',
};

// La reserva ya es de César: el turno está tomado de verdad.
export const ESTADOS_FIRMES = [
  RESERVA.CONFIRMED, RESERVA.BALANCE_PENDING, RESERVA.PAID, RESERVA.COMPLETED,
];

const SUFIJO = { DEPOSIT: 'DEP', BALANCE: 'BAL', EXTRA: 'EXT', REFUND: 'REF' };

// ══════════════════════════════════════════════════════════════════════
// CÓDIGO DE RESERVA  ·  CSC-2026-000123  (§5)
// El número lo entrega una secuencia de Postgres: nunca se repite, ni con
// dos papás reservando en el mismo segundo. El año se toma en hora de
// Santiago, no en UTC, para que una reserva de las 22:00 del 31 de
// diciembre no salga con el año siguiente.
// ══════════════════════════════════════════════════════════════════════
export async function nuevoCodigoReserva() {
  const fila = await q1(
    `SELECT 'CSC-' || to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY')
         || '-' || lpad(nextval('reserva_numero')::text, 6, '0') AS codigo`
  );
  return fila.codigo;
}

// ── Hash de la versión de T&C vigente (Fase 1B, §4/§5/§10) ──────────────
// FALLA CERRADO, no abierto (documento "No autorizo todavía el deploy...",
// 15-sep-2026, §5). El diseño anterior atrapaba cualquier error y devolvía
// null; una reserva se creaba igual con tyc_hash vacío. Eso ya no puede
// pasar: si la versión vigente (TYC_VERSION, data/master.js) no existe en
// tyc_version, no está ACTIVA, o no tiene contenido_sha256, esta función
// LANZA TycIndisponibleError — nunca devuelve un hash vacío. Quien llama
// (crearReserva/crearReservaManual) atrapa específicamente ese error y
// rechaza la reserva ANTES de tomar el turno; cualquier otro error (ej. la
// base caída) también se propaga tal cual, sin swallow: si no se puede
// verificar el contrato vigente, la reserva no debe ni empezar a existir.
export class TycIndisponibleError extends Error {
  constructor(motivo) {
    super(`Versión de T&C "${TYC_VERSION}" no disponible para contratar: ${motivo}`);
    this.name = 'TycIndisponibleError';
    this.motivo = motivo;
  }
}

export async function tycHashVigente() {
  const fila = await q1(
    `SELECT estado, contenido_sha256 FROM tyc_version WHERE version = $1`,
    [TYC_VERSION]
  );
  if (!fila) throw new TycIndisponibleError(`la versión '${TYC_VERSION}' no existe en tyc_version`);
  if (fila.estado !== 'ACTIVA') throw new TycIndisponibleError(`la versión '${TYC_VERSION}' está ${fila.estado}, no ACTIVA`);
  if (!fila.contenido_sha256) throw new TycIndisponibleError(`la versión '${TYC_VERSION}' no tiene contenido_sha256`);
  return fila.contenido_sha256;
}

// ══════════════════════════════════════════════════════════════════════
// EL CERROJO DEL TURNO  (§8)
//
// Una sola sentencia. El INSERT gana o pierde: no hay ventana entre
// "consulté si estaba libre" y "lo tomé", que es donde se cuelan las dos
// reservas del mismo turno.
//
// El ON CONFLICT solo sobrescribe si el cerrojo que estaba es un cerrojo
// MUERTO (venció y no era firme) o si es del mismo dueño que vuelve a
// intentar. Contra una reserva pagada no se puede: `firme` la protege.
// ══════════════════════════════════════════════════════════════════════
export async function tomarTurno({ fecha, turno, codigo, minutos = MINUTOS_HOLD }) {
  const filas = await q(
    `INSERT INTO turno_hold (fecha_evento, turno, reserva_codigo, vence)
     VALUES ($1::date, $2, $3, now() + ($4 || ' minutes')::interval)
     ON CONFLICT (fecha_evento, turno) DO UPDATE
       SET reserva_codigo = EXCLUDED.reserva_codigo,
           vence          = EXCLUDED.vence,
           creado         = now()
       WHERE turno_hold.firme = false
         AND (turno_hold.vence < now() OR turno_hold.reserva_codigo = EXCLUDED.reserva_codigo)
     RETURNING reserva_codigo, vence`,
    [fecha, turno, codigo, String(minutos)]
  );
  // Sin fila devuelta, el turno ya era de otro. No se escribe nada más:
  // por eso el cerrojo va antes de crear la reserva y no después.
  return filas.length ? { tomado: true, vence: filas[0].vence } : { tomado: false, vence: null };
}

// Suelta el turno. Se usa al cancelar y cuando falla la creación del pago.
export async function liberarTurno(codigo) {
  await q(`DELETE FROM turno_hold WHERE reserva_codigo = $1 AND firme = false`, [codigo]);
}

// ══════════════════════════════════════════════════════════════════════
// BARRIDO DE VENCIDOS
//
// No hay cron: se barre al leer disponibilidad y al abrir el panel. En
// serverless eso es más confiable que una tarea programada, y el costo es
// una sentencia sobre una tabla diminuta.
//
// Los cerrojos vencidos NO se borran: se deja que el siguiente INSERT los
// sobrescriba. Si se borraran, un pago que llega tarde por un turno que
// nadie más tomó parecería un conflicto cuando no lo es.
// ══════════════════════════════════════════════════════════════════════
export async function barrerVencidos() {
  const fila = await q1(
    `WITH vencidas AS (
       UPDATE reserva
          SET estado = $1, actualizada = now()
        WHERE estado IN ($2, $3, $4)
          AND hold_vence IS NOT NULL
          AND hold_vence < now()
        RETURNING id
     ), pagos_muertos AS (
       UPDATE pago
          SET estado = $5
        WHERE estado IN ($6, $7)
          AND reserva_id IN (SELECT id FROM vencidas)
        RETURNING id
     )
     SELECT (SELECT count(*) FROM vencidas)::int      AS reservas,
            (SELECT count(*) FROM pagos_muertos)::int AS pagos`,
    // PAYMENT_VERIFYING entra a este barrido igual que PENDING_PAYMENT: un
    // papá que volvió del checkout antes de que Flow confirmara (§14) y
    // después simplemente abandonó se queda con la reserva en
    // "verificando" para siempre si no se incluye acá — el turno YA está
    // libre de todos modos (turnosOcupados() decide solo por `vence`, no
    // por este estado), pero el panel seguía mostrando una reserva viva
    // que ya no lo era. Encontrado en QA de la Fase Sandbox.
    [RESERVA.EXPIRED, RESERVA.PENDING_PAYMENT, RESERVA.DRAFT, RESERVA.PAYMENT_VERIFYING,
      PAGO.EXPIRED, PAGO.CREATED, PAGO.PENDING]
  );
  return { reservas: fila?.reservas ?? 0, pagos: fila?.pagos ?? 0 };
}

// ══════════════════════════════════════════════════════════════════════
// TURNOS OCUPADOS
// Lo que /api/disponibilidad necesita para que el calendario del armador
// no ofrezca un turno que ya está tomado o retenido en este instante.
// ══════════════════════════════════════════════════════════════════════
export async function turnosOcupados({ dias = 150 } = {}) {
  // El `::int` en `$1::int` no es cosmético: sin él, Postgres recibe un
  // parámetro sin tipo ("unknown") y `date + unknown` es una operación
  // ambigua — "operator is not unique", error 42725. La consulta entera
  // fallaba SIEMPRE, en silencio, porque turnosDesdePostgres() atrapa el
  // error y devuelve listas vacías para no tumbar el calendario si Postgres
  // tiene un problema puntual. El efecto real: la disponibilidad que veía
  // el papá nunca consideró los HOLD ni las reservas ya pagadas, solo
  // Google Calendar — el cerrojo atómico seguía impidiendo la doble
  // reserva al momento de pagar, pero el calendario podía mostrar como
  // libre una fecha que ya no lo estaba. Encontrado en QA de la Fase
  // Sandbox (06-sep-2026) comparando `turno_hold` directamente contra lo
  // que devolvía /api/disponibilidad.
  return q(
    `SELECT to_char(fecha_evento, 'YYYY-MM-DD') AS fecha, turno, firme
       FROM turno_hold
      WHERE fecha_evento >= (now() AT TIME ZONE 'America/Santiago')::date
        AND fecha_evento <= ((now() AT TIME ZONE 'America/Santiago')::date + $1::int)
        AND (firme = true OR vence > now())`,
    [dias]
  );
}

// ══════════════════════════════════════════════════════════════════════
// RECÁLCULO SERVIDOR DEL TOTAL  (§22)
//
// El navegador manda la CONFIGURACIÓN, no el precio. Acá se normaliza con
// las mismas reglas del armador (sector obligatorio, packs, adicionales
// que ya no aplican) y se recalcula el total. Si el papá manipuló el monto
// en el navegador, ese monto simplemente no se usa: se ignora.
// ══════════════════════════════════════════════════════════════════════
export function recalcular(configuracion) {
  const estado = normalizarConfiguracion({
    ...configuracion,
    // Las fechas viajan como "YYYY-MM-DD": el motor de precios las lee a
    // mediodía para que ninguna zona horaria corra el día ni el precio.
    fecha: configuracion.fecha || null,
  });
  const promo = configuracion.codigo ? buscarPromo(configuracion.codigo) : null;
  const precio = calcularTotal(estado, promo);
  const horario = horarioEfectivo(estado.hora, estado.horasAdicionales || 0, estado.fecha);
  // El contexto trae los números con los que razonan las reglas: cuántos
  // niños se están contando de verdad y cuántos de ellos son mayores de 6.
  // Son los que se guardan en la reserva, no los campos crudos del
  // formulario (que en los tramos cerrados vienen en null).
  const ctx = contextoDesde(estado);
  return { estado, precio, horario, ctx };
}

// ── Validaciones que tienen que pasar ANTES de tocar plata ────────────
// El armador ya valida todo esto en pantalla; acá se vuelve a validar
// porque un endpoint público no puede confiar en que la petición vino de
// la pantalla (§3, §22).
export function validarConfiguracion(estado, horario) {
  const errores = [];

  if (!estado.fecha) errores.push('Falta la fecha de la celebración');
  if (!estado.sector) errores.push('Falta el sector');
  if (!estado.tramoInvitados) errores.push('Falta la cantidad de invitados');
  if (!estado.edadNino) errores.push('Falta la edad del festejado');

  // Decoración temática sin temática es exactamente el hueco que el
  // documento "FASE 2B — IMPLEMENTAR BLOQUE 1" (21-sep-2026, §7/§9) pide
  // cerrar en el servidor, no solo en el wizard: nunca puede existir un
  // camino (inicial o posterior) que la deje sin definir.
  const tieneTematica = (estado.extras || []).some((e) => IDS_DECORACION_TEMATICA.has(e.id));
  if (tieneTematica && !String(estado.tematica || '').trim()) {
    errores.push('Falta indicar la temática de la decoración');
  }

  // Solo se celebra viernes, sábado y domingo (§3).
  if (estado.fecha) {
    const d = new Date(`${String(estado.fecha).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) errores.push('La fecha no es válida');
    else if (![5, 6, 0].includes(d.getDay())) {
      errores.push('Solo celebramos viernes, sábado y domingo');
    } else {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (d < hoy) errores.push('La fecha ya pasó');

      // Turno + horas adicionales, validados JUNTOS contra esa fecha —
      // nunca se acota en silencio (documento "Autorización Fase 1A",
      // 13-sep-2026, §2, §4): un viernes AM o un viernes +2 se rechaza
      // acá, con un mensaje semántico, antes de que exista un `horario`
      // que alguien pudiera confundir con uno válido.
      const v = validarTurnoFecha(estado.hora, estado.horasAdicionales, estado.fecha);
      if (!v.ok) errores.push(v.mensaje);
    }
  }

  return errores;
}

// ══════════════════════════════════════════════════════════════════════
// CREAR LA RESERVA
//
// Orden deliberado (§8):
//   1. recalcular y validar en el servidor
//   2. pedir el código correlativo
//   3. TOMAR EL TURNO  ← si acá se pierde, no se escribió nada
//   4. escribir la reserva
//
// Devuelve { ok, reserva } o { ok:false, motivo:'turno_ocupado' }.
// ══════════════════════════════════════════════════════════════════════
export async function crearReserva({ configuracion, cliente, aceptaTyc }) {
  // Validar turno+horas+fecha contra la entrada CRUDA del cliente, antes de
  // normalizar. recalcular() → normalizarConfiguracion() acota horasAdicionales
  // al máximo del turno (pensado para migrar una sesión vieja de localStorage,
  // ej. PM+2 guardado y el cliente cambia a AM), pero ese acotamiento no puede
  // ser la autoridad de seguridad: si se validara solo el estado ya normalizado,
  // un viernes PM+2 llegaría acotado a PM+1 y jamás se rechazaría — exactamente
  // el "clamp silencioso" que el servidor no debe hacer (documento "Autorización
  // Fase 1A", 13-sep-2026, §2). Por eso se valida acá, contra lo que el cliente
  // pidió de verdad, antes de que nada lo corrija.
  if (configuracion?.fecha && configuracion?.hora) {
    const vTurno = validarTurnoFecha(configuracion.hora, configuracion.horasAdicionales || 0, configuracion.fecha);
    if (!vTurno.ok) return { ok: false, motivo: 'configuracion_invalida', errores: [vTurno.mensaje] };
  }

  const { estado, precio, horario, ctx } = recalcular(configuracion);
  const errores = validarConfiguracion(estado, horario);
  if (errores.length) return { ok: false, motivo: 'configuracion_invalida', errores };

  if (precio.total <= 0) return { ok: false, motivo: 'total_invalido', errores: ['El total es cero'] };
  if (!aceptaTyc) return { ok: false, motivo: 'sin_tyc', errores: ['Falta aceptar los Términos y Condiciones'] };

  // El hash contractual se resuelve ANTES de pedir código o tomar el
  // turno: si la versión vigente no está disponible para contratar, la
  // reserva no debe ni empezar a existir (§5). El navegador solo declaró
  // la INTENCIÓN de aceptar (aceptaTyc=true); la versión y el hash que
  // quedan asociados a la reserva los decide el servidor acá, nunca lo que
  // mande la petición.
  let tycHash;
  try {
    tycHash = await tycHashVigente();
  } catch (err) {
    if (err instanceof TycIndisponibleError) {
      return { ok: false, motivo: 'tyc_no_disponible', errores: [err.message] };
    }
    throw err;
  }

  const fecha = String(estado.fecha).slice(0, 10);
  const turno = estado.hora;

  const codigo = await nuevoCodigoReserva();

  const cerrojo = await tomarTurno({ fecha, turno, codigo });
  if (!cerrojo.tomado) return { ok: false, motivo: 'turno_ocupado' };

  const accesoToken = tokenAleatorio();

  let reserva;
  try {
    reserva = await q1(
      `INSERT INTO reserva (
         codigo, cliente_nombre, cliente_email, cliente_telefono,
         fecha_evento, turno, hora_inicio, hora_termino, sector,
         ninos, mayores, snapshot,
         total, anticipo, saldo, estado, hold_vence,
         tyc_version, tyc_aceptado, acceso_token, tyc_hash
       ) VALUES (
         $1, $2, $3, $4,
         $5::date, $6, $7, $8, $9,
         $10, $11, $12::jsonb,
         $13, $14, $15, $16, $17::timestamptz,
         $18, now(), $19, $20
       ) RETURNING *`,
      [
        codigo, cliente.nombre, cliente.email, cliente.telefono,
        fecha, turno, horario?.horaInicio || null, horario?.horaTermino || null, estado.sector,
        ctx.totalNinos, ctx.cantidadMayores, JSON.stringify({ configuracion: estado, precio, ctx }),
        precio.total, precio.anticipo, precio.saldo, RESERVA.PENDING_PAYMENT, cerrojo.vence,
        TYC_VERSION, accesoToken, tycHash,
      ]
    );
  } catch (err) {
    // Si la reserva no se pudo escribir, el turno no queda secuestrado.
    await liberarTurno(codigo).catch(() => {});
    throw err;
  }

  await registrarEvento({
    reservaId: reserva.id,
    tipo: 'RESERVA_CREADA',
    referencia: codigo,
    detalle: { total: precio.total, anticipo: precio.anticipo, fecha, turno },
  });

  // Mismo código que corre tras un cambio comercial posterior (documento
  // "FASE 2B — IMPLEMENTAR BLOQUE 1", §10): si la reserva nace con
  // decoración temática o animación, el pendiente aparece desde el
  // primer segundo, sin depender de que nadie lo dispare a mano.
  await sincronizarPendientesProveedor({
    reservaId: reserva.id,
    configuracion: estado,
    fechaEvento: reserva.fecha_evento,
  });

  return { ok: true, reserva };
}

// Misma regla vigente que el armador (data/reglas.js, puedeElegirSector):
// Independiente solo con tramo "hasta10" Y ningún mayor de 6. Cualquier
// otra combinación → Recinto Completo. Se recalcula siempre en el
// servidor —nunca se confía en un `sector` que mande el formulario— para
// que no exista forma de guardar una combinación inválida (documento
// "Ajuste formulario Crear reserva manual", 06-sep-2026).
function sectorDesdeTramos(tramoInvitados, tramoMayores) {
  return tramoInvitados === 'hasta10' && tramoMayores === 'no' ? 'independiente' : 'completo';
}

// ══════════════════════════════════════════════════════════════════════
// RESERVA MANUAL (panel, §21 del documento "Mejora mínima…", 06-sep-2026;
// ajustada a tramos/categorías comerciales el mismo día)
//
// Para cotizaciones que César ya cerró por WhatsApp ANTES de que existiera
// este sistema de pagos. No es el wizard: el total/anticipo NO se
// recalculan con calcularTotal() —pueden ser un precio ya negociado que
// no calza con la tabla vigente— se toman tal cual los escribe César, con
// la única regla dura de que anticipo + saldo = total.
//
// Niños y mayores de 6 se guardan como TRAMO/categoría —igual que la web—
// no como una cantidad exacta inventada: "Hasta 20" o "1 a 3", nunca "17".
// El horario acepta las horas adicionales reales que se contrataron
// (mismo horarioEfectivo() del armador, mismos topes por turno), y el
// sector se calcula solo con la regla vigente — no lo elige el formulario.
//
// Después de creada, la reserva es una reserva CUALQUIERA: el mismo link
// de Flow (/api/cadena/link-pago), la misma acreditación, el mismo
// Calendar. No hay una segunda ruta de pago para "reservas manuales".
//
// Esto NUNCA toca Google Calendar: no busca ni modifica el evento antiguo
// que ya existe ahí de cuando se cotizó a mano. Es una fila nueva e
// independiente en Postgres — el evento de Calendar para ESTA reserva
// recién se crea cuando el pago se acredite, como cualquier otra.
// ══════════════════════════════════════════════════════════════════════
export async function crearReservaManual({
  referencia, nombreNino, apoderado, email, telefono,
  fecha, turno, horasAdicionales, tramoInvitados, tramoMayores, total, anticipo, notas,
}) {
  const errores = [];
  if (!apoderado?.trim()) errores.push('Falta el nombre del apoderado');
  if (!nombreNino?.trim()) errores.push('Falta el nombre del festejado');

  // La fecha se valida y normaliza PRIMERO — el turno se valida CONTRA esa
  // fecha, nunca antes de conocerla (documento "Autorización Fase 1A",
  // 13-sep-2026, §4, §9): un viernes AM cargado a mano desde /cadena tiene
  // que rechazarse acá igual que si viniera del wizard público.
  const fechaStr = String(fecha).slice(0, 10);
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaStr) && !Number.isNaN(new Date(`${fechaStr}T12:00:00`).getTime());
  let horas = 0;
  if (!fechaValida) {
    errores.push('La fecha no es válida');
  } else {
    const d = new Date(`${fechaStr}T12:00:00`);
    // Mismo horario del negocio que el armador (§3): viernes, sábado,
    // domingo — el recinto no abre otros días, sea reserva manual o no.
    if (![5, 6, 0].includes(d.getDay())) {
      errores.push('Solo se celebra viernes, sábado y domingo');
    } else {
      const v = validarTurnoFecha(turno, horasAdicionales, fechaStr);
      if (!v.ok) errores.push(v.mensaje);
      else horas = v.horas;
    }
  }

  const tramoNinos = tramoInvitadosPorId(tramoInvitados);
  if (!tramoNinos) errores.push('El tramo de niños no es válido');

  const tramoMay = tramoMayoresPorId(tramoMayores);
  if (!tramoMay) errores.push('El tramo de mayores de 6 no es válido');

  if (!Number.isInteger(total) || total <= 0) errores.push('El total debe ser un número mayor a 0');
  if (!Number.isInteger(anticipo) || anticipo <= 0 || anticipo > total) errores.push('El anticipo debe ser mayor a 0 y no mayor que el total');

  if (errores.length) return { ok: false, motivo: 'datos_invalidos', errores };

  // Mismo criterio que crearReserva() (§5): se resuelve antes de tomar el
  // turno, para no dejar un cerrojo huérfano si la versión vigente no está
  // disponible para contratar.
  let tycHash;
  try {
    tycHash = await tycHashVigente();
  } catch (err) {
    if (err instanceof TycIndisponibleError) {
      return { ok: false, motivo: 'tyc_no_disponible', errores: [err.message] };
    }
    throw err;
  }

  const sector = sectorDesdeTramos(tramoInvitados, tramoMayores);
  const saldo = total - anticipo;
  const horario = horarioEfectivo(turno, horas, fechaStr);
  const codigo = await nuevoCodigoReserva();

  const cerrojo = await tomarTurno({ fecha: fechaStr, turno, codigo });
  if (!cerrojo.tomado) return { ok: false, motivo: 'turno_ocupado' };

  const accesoToken = tokenAleatorio();
  const notasCompletas = [
    `Festejado: ${nombreNino.trim()}`,
    `Niños: ${tramoNinos.corto}`,
    `Mayores de 6: ${tramoMay.corto}`,
    referencia?.trim() ? `Referencia/cotización: ${referencia.trim()}` : null,
    'Reserva creada manualmente en el panel (cotización previa al sistema de pagos).',
    notas?.trim() || null,
  ].filter(Boolean).join('\n');

  let reserva;
  try {
    reserva = await q1(
      `INSERT INTO reserva (
         codigo, cliente_nombre, cliente_email, cliente_telefono,
         fecha_evento, turno, hora_inicio, hora_termino, sector,
         ninos, mayores, snapshot,
         total, anticipo, saldo, estado, hold_vence,
         tyc_version, acceso_token, notas, tyc_hash
       ) VALUES (
         $1, $2, $3, $4,
         $5::date, $6, $7, $8, $9,
         $10, $11, $12::jsonb,
         $13, $14, $15, $16, $17::timestamptz,
         $18, $19, $20, $21
       ) RETURNING *`,
      [
        codigo, apoderado.trim(), email, telefono,
        fechaStr, turno, horario?.horaInicio || null, horario?.horaTermino || null, sector,
        // `ninos`/`mayores` son columnas NUMÉRICAS que el resto del sistema
        // ya espera (Calendar, panel) — se llenan con el tope del tramo y
        // el número "interno" que el propio armador usa para lo mismo
        // (TRAMOS_MAYORES.interno), nunca un número que el papá no dio.
        // El texto que SE MUESTRA (notas, más abajo) usa el tramo, no esto.
        tramoNinos.max, tramoMay.interno,
        JSON.stringify({ manual: true, nombreNino: nombreNino.trim(), tramoInvitados, tramoMayores, horasAdicionales: horas }),
        total, anticipo, saldo, RESERVA.PENDING_PAYMENT, cerrojo.vence,
        TYC_VERSION, accesoToken, notasCompletas, tycHash,
      ]
    );
  } catch (err) {
    await liberarTurno(codigo).catch(() => {});
    throw err;
  }

  await registrarEvento({
    reservaId: reserva.id,
    tipo: 'RESERVA_MANUAL_CREADA',
    referencia: codigo,
    detalle: {
      total, anticipo, fecha: fechaStr, turno, horasAdicionales: horas,
      tramoInvitados, tramoMayores, festejado: nombreNino.trim(),
    },
  });

  return { ok: true, reserva };
}

// ══════════════════════════════════════════════════════════════════════
// COMMERCE ORDER  (§5)
//
// El feliz: CSC-2026-000123-DEP y CSC-2026-000123-BAL. Si un intento
// falló y el papá vuelve a intentar, no se puede reusar la misma
// referencia (es UNIQUE, y reusarla sería justo el bug que UNIQUE
// previene): se numera el intento — -DEP-02, -DEP-03.
// ══════════════════════════════════════════════════════════════════════
export async function siguienteCommerceOrder(codigo, tipo) {
  const sufijo = SUFIJO[tipo] || 'EXT';
  const fila = await q1(
    `SELECT count(*)::int AS n FROM pago p
       JOIN reserva r ON r.id = p.reserva_id
      WHERE r.codigo = $1 AND p.tipo = $2`,
    [codigo, tipo]
  );
  const n = fila?.n ?? 0;
  return n === 0 ? `${codigo}-${sufijo}` : `${codigo}-${sufijo}-${String(n + 1).padStart(2, '0')}`;
}

// ── Cuánto corresponde cobrar en este pago ────────────────────────────
// El monto lo decide el servidor a partir de la reserva, nunca la
// petición: el anticipo es lo que falte del anticipo y el saldo es lo que
// falte del total (§22).
export function montoQueCorresponde(reserva, tipo, montoPedido = null) {
  if (tipo === 'DEPOSIT') return Math.max(0, reserva.anticipo - reserva.pagado);
  if (tipo === 'BALANCE') return Math.max(0, reserva.total - reserva.pagado);
  if (tipo === 'EXTRA') {
    // Los adicionales de última hora son el único caso donde el monto lo
    // pone César a mano desde el panel. Va acotado para que un dedo en el
    // teclado no genere un cobro absurdo.
    const monto = Math.round(Number(montoPedido) || 0);
    return monto > 0 && monto <= 5_000_000 ? monto : 0;
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════════════
// REGISTRAR UN PAGO PENDIENTE
// Se escribe antes de mandar al papá al checkout: si Flow contesta y la
// web se cayó en el medio, el pago existe y la notificación lo encuentra.
// ══════════════════════════════════════════════════════════════════════
export async function crearPagoPendiente({ reservaId, commerceOrder, tipo, monto, minutos = MINUTOS_HOLD, proveedor = 'FLOW' }) {
  return q1(
    `INSERT INTO pago (reserva_id, commerce_order, tipo, monto, estado, vence, proveedor)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' minutes')::interval, $7)
     RETURNING *`,
    [reservaId, commerceOrder, tipo, monto, PAGO.CREATED, String(minutos), proveedor]
  );
}

// Guarda lo que devolvió Flow al crear la orden y deja el pago PENDING.
export async function marcarPagoEnCheckout({ pagoId, flowOrder, flowToken }) {
  return q1(
    `UPDATE pago
        SET estado = $2, flow_order = $3, flow_token = $4
      WHERE id = $1
      RETURNING *`,
    [pagoId, PAGO.PENDING, flowOrder, flowToken]
  );
}

// ══════════════════════════════════════════════════════════════════════
// ACREDITAR UN PAGO  (§13, §15)
//
// La sentencia completa en un solo viaje: el pago queda pagado, se intenta
// asegurar el turno de forma atómica, y la reserva avanza según lo que
// haya pasado con el turno. Las tres cosas van en el mismo WITH para que
// no exista una ventana donde el pago ya esté acreditado pero el turno
// todavía no se sepa.
//
// Pago que llega tarde — HOLD ya vencido (documento "Últimos ajustes antes
// de producción", 06-sep-2026). Tres casos, en este orden de prioridad:
//
//   1. El turno TODAVÍA es de esta reserva (nadie más lo tomó, venció o
//      no) → se firma y la reserva se confirma normal. Cubre tanto "sigue
//      siendo suyo" como "el HOLD venció pero el turno seguía libre":
//      en ambos casos la fila de turno_hold sigue teniendo el código de
//      ESTA reserva, así que el INSERT...ON CONFLICT de más abajo la
//      reconoce como propia y la reafirma sin pedirle permiso a nadie.
//   2. El turno estaba libre de verdad (otra reserva lo tuvo y también
//      venció, sin firmar) → se readquiere de forma atómica, mismo INSERT.
//   3. El turno es de OTRA reserva que sigue vigente (firme, o su propio
//      HOLD no ha vencido) → el INSERT no lo toca. El pago queda PAID
//      igual (la plata entró y no hay reembolso automático), pero la
//      reserva pasa a PAYMENT_CONFLICT en vez de confirmarse: nunca se le
//      quita el turno a quien ya lo tiene. No se crea evento de Calendar.
//
// La idempotencia sigue en el `WHERE p.estado <> 'PAID'` del primer CTE:
// la segunda notificación de Flow no devuelve fila, así que no se vuelve a
// sumar el anticipo, no se vuelve a intentar el turno y quien llamó sabe
// —por `nuevos = 0`— que no debe repetir el correo ni el calendario.
// ══════════════════════════════════════════════════════════════════════
export async function acreditarPago({ pagoId, estadoFlow, tributario, confirmadoEn = null }) {
  const fila = await q1(
    `WITH acreditado AS (
       UPDATE pago
          SET estado              = $2,
              confirmado          = COALESCE($11::timestamptz, now()),
              flow_order          = COALESCE($3, flow_order),
              medio               = $4,
              medio_tipo          = $5,
              cuotas              = $6,
              codigo_autorizacion = $7,
              tributario          = $8,
              tributario_motivo   = $9,
              bruto               = $10::jsonb
        WHERE id = $1 AND estado <> $2
        RETURNING id, reserva_id, monto, tipo
     ), objetivo AS (
       SELECT r.id, r.codigo, r.fecha_evento, r.turno, r.total, r.anticipo, r.pagado
         FROM reserva r JOIN acreditado a ON a.reserva_id = r.id
     ), turno_asegurado AS (
       -- Mismo patrón atómico que tomarTurno(): toma la fila si es propia,
       -- o si está genuinamente libre (no firme y vencida). Si es de otra
       -- reserva vigente, el WHERE no matchea y no se inserta/actualiza
       -- nada — nunca se le quita el turno a quien lo tiene.
       INSERT INTO turno_hold (fecha_evento, turno, reserva_codigo, vence, firme)
       SELECT o.fecha_evento, o.turno, o.codigo, now() + interval '5 years', true
         FROM objetivo o
       ON CONFLICT (fecha_evento, turno) DO UPDATE
         SET reserva_codigo = EXCLUDED.reserva_codigo,
             vence          = EXCLUDED.vence,
             firme          = true,
             creado         = now()
         WHERE turno_hold.reserva_codigo = EXCLUDED.reserva_codigo
            OR (turno_hold.firme = false AND turno_hold.vence < now())
       RETURNING 1
     ), reserva_act AS (
       UPDATE reserva r
          SET pagado      = r.pagado + a.monto,
              actualizada = now(),
              hold_vence  = NULL,
              estado      = CASE
                WHEN (SELECT count(*) FROM turno_asegurado) = 0 THEN 'PAYMENT_CONFLICT'
                WHEN r.pagado + a.monto >= r.total    THEN 'PAID'
                WHEN r.pagado + a.monto >= r.anticipo THEN 'BALANCE_PENDING'
                ELSE 'CONFIRMED'
              END
         FROM acreditado a
        WHERE r.id = a.reserva_id
        RETURNING r.id, r.codigo, r.fecha_evento, r.turno, r.estado, r.pagado, r.total
     )
     SELECT (SELECT count(*) FROM acreditado)::int        AS nuevos,
            (SELECT count(*) FROM turno_asegurado)::int   AS turno_asegurado,
            (SELECT row_to_json(r) FROM reserva_act r)    AS reserva`,
    [
      pagoId, PAGO.PAID, estadoFlow.flowOrder, estadoFlow.medio, estadoFlow.medioTipo,
      estadoFlow.cuotas, estadoFlow.codigoAutorizacion,
      tributario.estado, tributario.motivo, JSON.stringify(limpiarBruto(estadoFlow)),
      confirmadoEn,
    ]
  );

  const nuevos = fila?.nuevos ?? 0;

  if (nuevos > 0) {
    await registrarEvento({
      pagoId,
      reservaId: fila.reserva?.id ?? null,
      tipo: 'PAGO_ACREDITADO',
      referencia: estadoFlow.flowOrder,
      detalle: { medio: estadoFlow.medio, monto: estadoFlow.monto, tributario: tributario.estado },
    });

    // Pago tardío: el turno ya era de otra reserva vigente cuando este
    // dinero llegó. César reagenda o devuelve a mano — no se automatiza
    // ningún reembolso, y no se crea el evento de Calendar para no pisar
    // la celebración de quien sí tiene el turno (§24).
    if ((fila.turno_asegurado ?? 0) === 0) {
      await registrarEvento({
        pagoId,
        reservaId: fila.reserva?.id ?? null,
        tipo: 'PAYMENT_SLOT_CONFLICT',
        referencia: fila.reserva?.codigo ?? null,
        detalle: { aviso: 'El turno ya era de otra reserva vigente cuando este pago llegó — requiere revisión manual' },
      });
    }
  }

  return {
    nuevos,
    reserva: fila?.reserva ?? null,
    conflictoTurno: nuevos > 0 && (fila?.turno_asegurado ?? 0) === 0,
  };
}

// ══════════════════════════════════════════════════════════════════════
// PAGO REGISTRADO A MANO  (documento "Agregar control obligatorio de BVE
// para pagos por transferencia", 07-sep-2026, §7)
//
// Para cuando el papá deposita directo en la cuenta BancoEstado de César
// —o paga en efectivo, o en Súper Compraquí— sin pasar por el checkout de
// Flow. No hay "Flow que confirme": César ve la plata (en la cartola, en
// la mano) y dice "esto ya está pagado". El resto de la máquina —cerrojo
// de turno, transición de estado de la reserva, clasificación tributaria—
// es EXACTAMENTE la misma que un pago de Flow: acreditarPago() no sabe ni
// le importa si el pago vino de un webhook o de acá.
//
// El medio decide la obligación tributaria de inmediato, sin adivinar
// (TRIBUTARIO_POR_MEDIO_MANUAL, lib/tributario.js): Súper Compraquí deja
// voucher, transferencia BancoEstado y efectivo no —hay que emitir la BVE—
// y por eso entran solas a la sección "Boletas pendientes" del panel.
//
// `monto` es SIEMPRE lo que César escribe, para los tres tipos — a
// propósito NO se recalcula con montoQueCorresponde() como en link-pago.
// Ahí el monto lo pone el servidor porque es una citación (le dice a Flow
// cuánto cobrar antes de que exista el pago); acá la plata ya llegó y esta
// función deja constancia de cuánto, no de cuánto "debería" ser. Sustituir
// el monto real por el teórico fue exactamente el bug encontrado en
// Sandbox el 07-sep-2026 (documento "Bug a revisar antes de seguir"):
// César quiso registrar $50.000 y, al no haber campo de monto para
// DEPOSIT/BALANCE, el sistema usó el saldo pendiente ($82.500) sin que
// nadie lo pidiera. Un sobrepago (monto > lo que faltaba) no se recorta
// ni se oculta: se acredita completo y queda visible en `reserva.pagado`.
// ══════════════════════════════════════════════════════════════════════
export async function registrarPagoManual({ codigo, tipo, medio, monto, fechaPago = null, referencia = null }) {
  const reserva = await reservaPorCodigo(codigo);
  if (!reserva) return { ok: false, motivo: 'reserva_no_encontrada' };

  if (!['DEPOSIT', 'BALANCE', 'EXTRA'].includes(tipo)) return { ok: false, motivo: 'tipo_invalido' };
  if (!TRIBUTARIO_POR_MEDIO_MANUAL[medio]) return { ok: false, motivo: 'medio_invalido' };
  // El monto es un HECHO (cuánto llegó de verdad), no un cálculo — a
  // propósito no se recalcula con montoQueCorresponde() como si fuera un
  // link de Flow. El único resguardo es un tope contra un error de tipeo,
  // igual que el de EXTRA en link-pago (§22), nunca un recorte silencioso
  // de un sobrepago real (documento "Bug a revisar antes de seguir…", 07-sep-2026).
  if (!Number.isInteger(monto) || monto <= 0 || monto > 5_000_000) return { ok: false, motivo: 'monto_invalido' };

  let fechaConfirmado = null;
  if (fechaPago) {
    const d = new Date(fechaPago);
    if (Number.isNaN(d.getTime())) return { ok: false, motivo: 'fecha_invalida' };
    fechaConfirmado = d.toISOString();
  }

  const commerceOrder = await siguienteCommerceOrder(codigo, tipo);
  const pago = await crearPagoPendiente({
    reservaId: reserva.id, commerceOrder, tipo, monto, minutos: 30, proveedor: 'MANUAL',
  });

  const etiquetaMedio = ETIQUETA_MEDIO_MANUAL[medio];
  const tributario = {
    estado: TRIBUTARIO_POR_MEDIO_MANUAL[medio],
    motivo: `Pago manual registrado por César — ${etiquetaMedio}`
      + (referencia?.trim() ? ` (${referencia.trim()})` : ''),
  };
  const estadoFlow = {
    flowOrder: null, medio: etiquetaMedio, medioTipo: medio,
    cuotas: null, codigoAutorizacion: null, monto,
  };

  const resultado = await acreditarPago({ pagoId: pago.id, estadoFlow, tributario, confirmadoEn: fechaConfirmado });

  await registrarEvento({
    pagoId: pago.id, reservaId: reserva.id, tipo: 'PAGO_MANUAL_REGISTRADO',
    referencia: codigo, detalle: { tipo, medio, monto, fechaPago: fechaConfirmado, referencia },
  });

  return { ok: true, pagoId: pago.id, commerceOrder, ...resultado };
}

// Pago que Flow reporta rechazado o anulado. La reserva NO se cancela: el
// papá puede reintentar con otro medio mientras el turno siga retenido.
export async function marcarPagoFallido({ pagoId, estadoFlow }) {
  const pago = await q1(
    `UPDATE pago
        SET estado = $2, fallido = now(), flow_order = COALESCE($3, flow_order),
            medio = $4, medio_tipo = $5, bruto = $6::jsonb
      WHERE id = $1 AND estado NOT IN ($2, $7)
      RETURNING *`,
    [pagoId, PAGO.FAILED, estadoFlow.flowOrder, estadoFlow.medio, estadoFlow.medioTipo,
      JSON.stringify(limpiarBruto(estadoFlow)), PAGO.PAID]
  );
  if (pago) {
    await registrarEvento({
      pagoId, reservaId: pago.reserva_id, tipo: 'PAGO_RECHAZADO',
      referencia: estadoFlow.flowOrder, detalle: { estado: estadoFlow.estado },
    });
  }
  return pago;
}

// Flow todavía no resolvió (transferencia en curso). No se asume rechazo
// jamás: se deja constancia de que está en verificación (§24).
export async function marcarEnVerificacion({ pagoId, reservaId }) {
  await q(
    `UPDATE reserva SET estado = $2, actualizada = now()
      WHERE id = $1 AND estado = $3`,
    [reservaId, RESERVA.PAYMENT_VERIFYING, RESERVA.PENDING_PAYMENT]
  );
  await registrarEvento({ pagoId, reservaId, tipo: 'PAGO_EN_VERIFICACION' });
}

// ══════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN TRIBUTARIA
// Se calcula al acreditar. Un error de clasificación no puede impedir que
// la reserva quede confirmada: cae en MANUAL_REVIEW y sigue (§24).
// ══════════════════════════════════════════════════════════════════════
export function clasificarSinFallar(estadoFlow) {
  try {
    return classifyTaxTreatment(estadoFlow);
  } catch (err) {
    return { estado: TRIBUTARIO.MANUAL_REVIEW, motivo: `Error al clasificar: ${err.message}` };
  }
}

// ── Bitácora ──────────────────────────────────────────────────────────
export async function registrarEvento({ pagoId = null, reservaId = null, tipo, referencia = null, detalle = null }) {
  try {
    await q(
      `INSERT INTO pago_evento (pago_id, reserva_id, tipo, referencia, detalle)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [pagoId, reservaId, tipo, referencia, detalle ? JSON.stringify(detalle) : null]
    );
  } catch (err) {
    // La bitácora no puede voltear una operación de plata.
    console.error(`[reservas] No se pudo registrar el evento ${tipo}: ${err.message}`);
  }
}

// Bitácora completa de una reserva (todo lo que le pasó a sus pagos, en
// orden). El panel la usa para mostrar el historial; también es la
// evidencia de auditoría cuando alguien pregunta "¿qué pasó con este pago?".
export async function eventosDeReserva(reservaId) {
  return q(
    `SELECT id, pago_id, tipo, referencia, detalle, creado
       FROM pago_evento WHERE reserva_id = $1 ORDER BY id ASC`,
    [reservaId]
  );
}

// ── Lecturas ──────────────────────────────────────────────────────────
export async function reservaPorCodigo(codigo) {
  return q1(`SELECT * FROM reserva WHERE codigo = $1`, [codigo]);
}

export async function pagoPorToken(token) {
  return q1(`SELECT * FROM pago WHERE flow_token = $1 ORDER BY id DESC LIMIT 1`, [token]);
}

export async function pagoPorCommerceOrder(commerceOrder) {
  return q1(`SELECT * FROM pago WHERE commerce_order = $1`, [commerceOrder]);
}

export async function pagosDeReserva(reservaId) {
  return q(`SELECT * FROM pago WHERE reserva_id = $1 ORDER BY id`, [reservaId]);
}

// ══════════════════════════════════════════════════════════════════════
// BOLETAS SII PENDIENTES  (documento "Agregar control obligatorio de BVE…",
// 07-sep-2026, §2-§3)
//
// Todo pago PAID cuyo medio no deja voucher electrónico. Trae la
// identificación completa que pide el documento —quién pagó, cuánto,
// cuándo y por qué concepto— en una sola fila, para el panel y para el
// correo recordatorio diario (lib/correo.js, /api/cron/boletas-pendientes).
// El festejado no es una columna propia de `reserva`: vive en el snapshot
// (wizard) o directo en el snapshot de la reserva manual — se lee de los
// dos lugares posibles con COALESCE, nunca se inventa.
// ══════════════════════════════════════════════════════════════════════
export async function pagosPendientesBVE() {
  return q(
    `SELECT p.id, p.tipo, p.monto, p.medio, p.medio_tipo, p.proveedor,
            p.commerce_order, p.flow_order, p.confirmado,
            p.tributario, p.tributario_motivo,
            r.codigo, r.cliente_nombre, r.cliente_email, r.cliente_telefono,
            r.fecha_evento, r.estado AS reserva_estado,
            COALESCE(r.snapshot->>'nombreNino', r.snapshot->'configuracion'->>'nombreNino') AS festejado
       FROM pago p JOIN reserva r ON r.id = p.reserva_id
      WHERE p.tributario = $1
      ORDER BY p.confirmado ASC NULLS LAST, p.id ASC`,
    [TRIBUTARIO.PENDING_BVE]
  );
}

// ══════════════════════════════════════════════════════════════════════
// MARCAR UNA BVE COMO EMITIDA  (§4)
// César la emitió a mano en el sitio del SII y deja constancia acá: folio,
// fecha de emisión (puede ser distinta de "ahora" — a veces la emite un
// día después) y una observación opcional. Nunca toca el pago (PAID), la
// reserva (CONFIRMED/BALANCE_PENDING/PAID) ni el Calendar: es una
// obligación tributaria aparte (§6).
// ══════════════════════════════════════════════════════════════════════
export async function marcarBoletaEmitida({ pagoId, folio = null, fecha = null, observacion = null }) {
  let fechaEmision = null;
  if (fecha) {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return { ok: false, motivo: 'fecha_invalida' };
    fechaEmision = d.toISOString();
  }

  const pago = await q1(
    `UPDATE pago
        SET tributario = $2, tributario_ref = $3, tributario_obs = $4,
            tributario_emitido = COALESCE($5::timestamptz, now())
      WHERE id = $1 AND estado = 'PAID'
      RETURNING *`,
    [pagoId, TRIBUTARIO.ISSUED, folio || null, observacion || null, fechaEmision]
  );
  if (!pago) return { ok: false, motivo: 'pago_no_encontrado_o_no_pagado' };

  await registrarEvento({
    pagoId: pago.id, reservaId: pago.reserva_id, tipo: 'BOLETA_MARCADA_EMITIDA',
    referencia: folio || null, detalle: { folio: folio || null, fecha: fechaEmision, observacion: observacion || null },
  });

  return { ok: true, pago };
}

// ── Utilidades ────────────────────────────────────────────────────────

// Token de 32 hex para el link privado del papá.
export function tokenAleatorio() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN VIGENTE  (documento "FASE 2B — IMPLEMENTAR BLOQUE 1",
// 21-sep-2026, §13): el ÚNICO lugar del código que decide
// `snapshot_vigente ?? snapshot`. Todo lo que necesite conocer la
// contratación VIGENTE (con cambios comerciales posteriores aplicados, si
// los hay) pasa por acá — nunca un COALESCE suelto en otro archivo.
//
// `reserva.snapshot` (la contratación ORIGINAL) sigue disponible tal cual
// para quien explícitamente la necesite — esta función nunca la
// sobrescribe ni la oculta, solo decide cuál mostrar por defecto.
// ══════════════════════════════════════════════════════════════════════
function parseSnap(valor) {
  if (!valor) return null;
  return typeof valor === 'string' ? JSON.parse(valor) : valor;
}

export function configuracionVigente(reserva) {
  return parseSnap(reserva?.snapshot_vigente) ?? parseSnap(reserva?.snapshot);
}

// Nombre del festejado, sin importar si la reserva viene del armador
// (snapshot.configuracion.nombreNino) o es manual (snapshot.nombreNino) —
// documento "Nueva fase — experiencia de marca…", 08-sep-2026: el subject
// de Flow y la pantalla post-pago necesitan el mismo dato, del mismo lugar,
// sin volver a preguntarlo. Lee la configuración VIGENTE (§13 del
// documento de Bloque 1): un cambio comercial nunca debería cambiar quién
// es el festejado, pero si algún día lo hiciera, todo el sistema debe ver
// lo mismo desde un solo lugar.
export function festejadoDeReserva(reserva) {
  const snap = configuracionVigente(reserva);
  return snap?.nombreNino || snap?.configuracion?.nombreNino || null;
}

// ══════════════════════════════════════════════════════════════════════
// DETALLE DE UNA RESERVA  (documento "Quiero mejorar urgentemente la
// información operativa…", 09-sep-2026; actualizado por "FASE 2B —
// IMPLEMENTAR BLOQUE 1", 21-sep-2026, §13)
//
// Todo lo que el panel, el Calendar y Mi Celebración necesitan para
// mostrar la celebración completa sale de ACÁ, y ACÁ sale única y
// exclusivamente de la configuración VIGENTE (configuracionVigente(),
// arriba) — nunca de data/master.js ni de ningún precio o catálogo
// vigente-del-sitio. Es la fotografía de lo que el papá contrató HOY
// (original + cambios comerciales aprobados): si el catálogo cambia
// después (un adicional sube de precio, se retira del catálogo), esta
// reserva sigue mostrando lo que de verdad contrató y pagó.
//
// `extras` ya trae los dos mundos mezclados —adicionales pagados e
// incluidos gratis— distinguidos por `gratis === true`; acá se separan
// para que cada pantalla los muestre en su propia sección.
// ══════════════════════════════════════════════════════════════════════
export function detalleDeReserva(reserva) {
  const snap = configuracionVigente(reserva);
  const config = snap?.configuracion || null;
  const extras = config?.extras || [];
  const cantNinos = config?.cantNinos || null;

  return {
    festejado: snap?.nombreNino || config?.nombreNino || null,
    edad: config?.edadNino ?? null,
    tramoInvitados: config?.tramoInvitados || snap?.tramoInvitados || null,
    tramoMayores: config?.tramoMayores || snap?.tramoMayores || null,
    totalNinos: snap?.ctx?.totalNinos ?? null,
    horasAdicionales: config?.horasAdicionales ?? snap?.horasAdicionales ?? null,
    // Precio histórico: el que quedó guardado en el propio ítem al
    // reservar (`e.precios[cantNinos]`), nunca uno recalculado ahora.
    adicionales: extras.filter((e) => e.gratis !== true).map((e) => ({
      id: e.id, nombre: e.nombre, emoji: e.emoji || null,
      precio: cantNinos && e.precios ? (e.precios[cantNinos] ?? null) : null,
    })),
    incluidos: extras.filter((e) => e.gratis === true).map((e) => ({
      id: e.id, nombre: e.nombre, emoji: e.emoji || null,
    })),
    // Desglose línea por línea tal como el motor de precios lo calculó al
    // crear la reserva (snapshot.precio.lineas) — incluye el arriendo base,
    // que `adicionales` no trae por no ser un extra.
    lineas: Array.isArray(snap?.precio?.lineas) ? snap.precio.lineas : null,
  };
}

// Lo que se guarda de la respuesta de Flow. Se copia campo por campo a
// propósito: guardar el objeto completo es cómo terminan datos que no se
// deben guardar dentro de una base de datos (§22).
function limpiarBruto(estadoFlow) {
  return {
    estado: estadoFlow.estado,
    statusCrudo: estadoFlow.statusCrudo,
    commerceOrder: estadoFlow.commerceOrder,
    flowOrder: estadoFlow.flowOrder,
    medio: estadoFlow.medio,
    medioTipo: estadoFlow.medioTipo,
    cuotas: estadoFlow.cuotas,
    monto: estadoFlow.monto,
    fechaPago: estadoFlow.fechaPago,
  };
}

// Etiqueta para el papá y para el panel. La reserva con saldo pendiente
// está CONFIRMADA: al papá no se le dice "pendiente" cuando ya pagó su
// anticipo y la fecha es suya (§14).
export function etiquetaReserva(estado) {
  return {
    DRAFT: 'Borrador',
    PENDING_PAYMENT: 'Esperando pago',
    PAYMENT_VERIFYING: 'Verificando pago',
    CONFIRMED: 'Confirmada',
    BALANCE_PENDING: 'Confirmada · saldo pendiente',
    PAID: 'Pagada completa',
    CANCELLED: 'Cancelada',
    REFUNDED: 'Devuelta',
    COMPLETED: 'Celebrada',
    EXPIRED: 'Expirada',
    PAYMENT_CONFLICT: 'Pago recibido — turno en conflicto',
  }[estado] || estado;
}

export const reservaEstaFirme = (estado) => ESTADOS_FIRMES.includes(estado);

// Saldo pendiente y si ya toca pedirlo (§18): 72 horas antes del evento.
export function estadoSaldo(reserva) {
  const pendiente = Math.max(0, (reserva.total || 0) - (reserva.pagado || 0));
  if (!pendiente) return { pendiente: 0, toca: false, horas: null };
  const evento = new Date(`${fechaISO(reserva.fecha_evento)}T12:00:00`);
  const horas = Math.round((evento - Date.now()) / 3_600_000);
  return { pendiente, toca: horas <= 72, horas };
}

export { NEGOCIO };
