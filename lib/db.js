// ══════════════════════════════════════════════════════════════════════
// BASE DE DATOS  ·  lib/db.js
// ──────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE ESTE ARCHIVO
//
// Hasta ahora la web guardaba las cotizaciones en una Google Sheet y leía
// la disponibilidad del Google Calendar. Para cotizar está bien. Para
// cobrar, no: una planilla no sabe decir "este turno ya lo tomó otro papá
// hace tres segundos". Dos apoderados pagando el mismo sábado a la misma
// hora es una celebración que César tiene que devolver, y eso no se
// arregla con un aviso: se evita con una restricción de base de datos.
//
// Así que la fuente de verdad de reservas y pagos es Postgres (§1.9). El
// Google Calendar pasa a ser lo que siempre debió ser: un espejo para el
// teléfono de César (§1.10, §16). La planilla de cotizaciones sigue
// funcionando igual para las solicitudes que llegan por WhatsApp.
//
// SI NO HAY BASE DE DATOS, LA WEB NO SE CAE. `dbConfigurada()` es false,
// los endpoints de pago responden "pagos no disponibles" y el armador
// muestra el camino de siempre: solicitar por WhatsApp. Un deploy sin la
// variable de entorno no le quita a César el negocio que ya tiene.
//
// Driver: @neondatabase/serverless por HTTP. Sin conexiones que queden
// abiertas entre invocaciones, que es exactamente lo que se necesita en
// Vercel (§29). Todas las consultas van parametrizadas ($1, $2…): en este
// archivo no se concatena NUNCA un valor dentro del SQL.
// ══════════════════════════════════════════════════════════════════════

import { neon } from '@neondatabase/serverless';

// Vercel inyecta POSTGRES_URL al crear una base desde Storage; la
// integración de Neon usa DATABASE_URL. Se aceptan las dos para que César
// no tenga que configurar nada a mano.
function cadenaConexion(env = process.env) {
  return env.POSTGRES_URL || env.DATABASE_URL || env.POSTGRES_PRISMA_URL || '';
}

export function dbConfigurada(env = process.env) {
  return !!cadenaConexion(env);
}

let _sql = null;

// Una sola instancia por proceso: el driver HTTP no mantiene conexiones,
// pero tampoco hace falta reconstruirlo en cada request.
function cliente() {
  if (!_sql) {
    const url = cadenaConexion();
    if (!url) throw new Error('Base de datos no configurada (falta POSTGRES_URL / DATABASE_URL)');
    // El driver de Neon habla HTTP con `fetch()`, y Next.js parchea el
    // `fetch()` global con su propio cache de datos — hasta con
    // `dynamic = 'force-dynamic'` en la ruta, porque el parche actúa a
    // nivel de runtime, no de build. Sin este `cache: 'no-store'`, dos
    // consultas con el MISMO texto SQL pueden devolver la respuesta vieja
    // cacheada aunque la tabla haya cambiado entre medio (se detectó así:
    // esquemaListo() seguía viendo "faltan tablas" recién migradas, con
    // una consulta idéntica). Cualquier consulta a Postgres tiene que
    // pegarle a la base siempre, nunca a una respuesta guardada.
    _sql = neon(url, { fetchOptions: { cache: 'no-store' } });
  }
  return _sql;
}

// Consulta parametrizada. Devuelve las filas.
export async function q(texto, params = []) {
  return cliente().query(texto, params);
}

// Primera fila o null: el 90% de las consultas de este proyecto buscan
// exactamente un registro y `filas[0]` repetido en veinte lugares se
// olvida de comprobar el largo alguna vez.
export async function q1(texto, params = []) {
  const filas = await q(texto, params);
  return filas.length ? filas[0] : null;
}

// ══════════════════════════════════════════════════════════════════════
// ESQUEMA
//
// Cada sentencia es idempotente (IF NOT EXISTS): se puede aplicar mil
// veces sin romper nada, y así el mismo código sirve para crear la base y
// para actualizarla. Los nombres de estados son los de la especificación
// (§7) tal cual, para poder auditar el código contra el documento.
// ══════════════════════════════════════════════════════════════════════
export const SENTENCIAS_ESQUEMA = [

  // Correlativo legible de reservas: CSC-2026-000123. Una secuencia de
  // Postgres nunca entrega el mismo número dos veces, ni con dos papás
  // reservando en el mismo instante.
  `CREATE SEQUENCE IF NOT EXISTS reserva_numero START 1`,

  `CREATE TABLE IF NOT EXISTS reserva (
     id                BIGSERIAL PRIMARY KEY,
     codigo            TEXT        NOT NULL UNIQUE,
     creada            TIMESTAMPTZ NOT NULL DEFAULT now(),
     actualizada       TIMESTAMPTZ NOT NULL DEFAULT now(),

     cliente_nombre    TEXT        NOT NULL,
     cliente_email     TEXT        NOT NULL,
     cliente_telefono  TEXT        NOT NULL,

     fecha_evento      DATE        NOT NULL,
     turno             TEXT        NOT NULL CHECK (turno IN ('AM','PM')),
     hora_inicio       TEXT,
     hora_termino      TEXT,
     sector            TEXT        NOT NULL,
     ninos             INTEGER     NOT NULL DEFAULT 0,
     mayores           INTEGER     NOT NULL DEFAULT 0,

     -- La configuración completa del armador, tal como la armó el papá.
     -- Con esto el total se puede recalcular y auditar meses después.
     snapshot          JSONB       NOT NULL,

     total             INTEGER     NOT NULL,
     anticipo          INTEGER     NOT NULL,
     saldo             INTEGER     NOT NULL,
     pagado            INTEGER     NOT NULL DEFAULT 0,

     estado            TEXT        NOT NULL DEFAULT 'PENDING_PAYMENT',
     hold_vence        TIMESTAMPTZ,

     tyc_version       TEXT,
     tyc_aceptado      TIMESTAMPTZ,

     calendar_event_id TEXT,
     calendar_estado   TEXT        NOT NULL DEFAULT 'PENDIENTE',

     -- Llave del link privado del papá. El código de reserva viaja por
     -- WhatsApp y es corto: sin esta llave, adivinar un código no alcanza
     -- para ver los datos de nadie.
     acceso_token      TEXT        NOT NULL,
     notas             TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS reserva_fecha_idx ON reserva (fecha_evento, turno)`,
  `CREATE INDEX IF NOT EXISTS reserva_estado_idx ON reserva (estado)`,
  `CREATE INDEX IF NOT EXISTS reserva_email_idx ON reserva (lower(cliente_email))`,

  `CREATE TABLE IF NOT EXISTS pago (
     id                  BIGSERIAL PRIMARY KEY,
     reserva_id          BIGINT      NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,

     -- Referencia del comercio. UNIQUE es la pieza que hace imposible
     -- procesar dos veces el mismo cobro (§15.1).
     commerce_order      TEXT        NOT NULL UNIQUE,
     tipo                TEXT        NOT NULL CHECK (tipo IN ('DEPOSIT','BALANCE','EXTRA','REFUND')),
     proveedor           TEXT        NOT NULL DEFAULT 'FLOW',
     monto               INTEGER     NOT NULL,
     estado              TEXT        NOT NULL DEFAULT 'CREATED',

     flow_order          TEXT,
     flow_token          TEXT,
     medio               TEXT,
     medio_tipo          TEXT,
     cuotas              INTEGER,
     codigo_autorizacion TEXT,

     creado              TIMESTAMPTZ NOT NULL DEFAULT now(),
     confirmado          TIMESTAMPTZ,
     fallido             TIMESTAMPTZ,
     vence               TIMESTAMPTZ,

     tributario          TEXT        NOT NULL DEFAULT 'MANUAL_REVIEW',
     tributario_motivo   TEXT,
     tributario_ref      TEXT,
     tributario_emitido  TIMESTAMPTZ,

     -- Respuesta de Flow sin las llaves: sirve para reconciliar y para
     -- entender qué pasó si algo sale raro. Nunca datos de tarjeta (§22).
     bruto               JSONB
   )`,

  // Un flowOrder pertenece a un solo pago. Si Flow reintenta la
  // notificación, la segunda vez no puede crear un cobro paralelo (§15.2).
  `CREATE UNIQUE INDEX IF NOT EXISTS pago_flow_order_uk ON pago (flow_order) WHERE flow_order IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS pago_reserva_idx ON pago (reserva_id)`,
  `CREATE INDEX IF NOT EXISTS pago_token_idx ON pago (flow_token)`,
  `CREATE INDEX IF NOT EXISTS pago_tributario_idx ON pago (tributario)`,

  // Observación libre al marcar una BVE emitida (documento "Agregar control
  // obligatorio de BVE…", 07-sep-2026): folio y fecha ya vivían en
  // tributario_ref/tributario_emitido, pero no había dónde dejar una nota
  // ("emitida por error, se corrigió el 10", etc.).
  `ALTER TABLE pago ADD COLUMN IF NOT EXISTS tributario_obs TEXT`,

  // ── EL CERROJO DEL TURNO (§8) ────────────────────────────────────────
  // Una fila por fecha+turno, y la llave primaria hace el resto: dos
  // solicitudes simultáneas por el mismo sábado AM no pueden existir.
  // `firme` = la reserva ya pagó: el turno queda tomado para siempre.
  // `vence` = mientras el papá está en el checkout. Al vencer, se libera.
  //
  // El dueño se guarda como CÓDIGO de reserva y no como id con clave
  // foránea a propósito: el cerrojo se toma ANTES de escribir la reserva,
  // que es lo que evita dejar reservas basura cuando el turno ya estaba
  // tomado.
  `CREATE TABLE IF NOT EXISTS turno_hold (
     fecha_evento  DATE        NOT NULL,
     turno         TEXT        NOT NULL,
     reserva_codigo TEXT       NOT NULL,
     vence         TIMESTAMPTZ NOT NULL,
     firme         BOOLEAN     NOT NULL DEFAULT false,
     creado        TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (fecha_evento, turno)
   )`,

  // ── Bitácora (§6) ────────────────────────────────────────────────────
  // Todo lo que le pasa a un pago queda escrito. Cuando un papá reclame
  // "yo pagué" seis semanas después, esto es la respuesta.
  `CREATE TABLE IF NOT EXISTS pago_evento (
     id          BIGSERIAL PRIMARY KEY,
     pago_id     BIGINT REFERENCES pago(id) ON DELETE CASCADE,
     reserva_id  BIGINT,
     tipo        TEXT        NOT NULL,
     referencia  TEXT,
     creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
     detalle     JSONB
   )`,

  `CREATE INDEX IF NOT EXISTS pago_evento_pago_idx ON pago_evento (pago_id)`,

  // ── VERSIONADO CONTRACTUAL DE T&C (Fase 1B) ──────────────────────────
  // Una fila por versión PUBLICADA de los Términos y Condiciones. Una vez
  // creada, es inmutable de verdad — no solo "la aplicación no la toca":
  // el trigger de más abajo rechaza cualquier UPDATE que intente cambiar
  // su contenido, sin importar quién lo intente (aplicación, script,
  // consola SQL). Para un cambio de T&C, se crea una versión NUEVA.
  `CREATE TABLE IF NOT EXISTS tyc_version (
     id                BIGSERIAL   PRIMARY KEY,
     version           TEXT        NOT NULL UNIQUE,
     contenido         TEXT        NOT NULL,
     contenido_sha256  TEXT        NOT NULL,
     pdf_url           TEXT,
     pdf_sha256        TEXT,
     publicado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
     retirado_en       TIMESTAMPTZ,
     estado            TEXT        NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','RETIRADA')),
     created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  `CREATE INDEX IF NOT EXISTS tyc_version_estado_idx ON tyc_version (estado)`,

  // Solo estado/retirado_en pueden cambiar (al retirar una versión cuando
  // se publica la siguiente). version/contenido/hashes/pdf/publicado_en/
  // created_at quedan congelados desde el INSERT — RAISE EXCEPTION corta
  // cualquier intento, sea de la aplicación, de un script o de una
  // consola SQL conectada a mano. pdf_bytes está protegido igual que
  // pdf_sha256/pdf_url (documento "No autorizo todavía el deploy...",
  // 15-sep-2026, §9-10): el PDF se genera UNA VEZ, al publicar, junto con
  // el resto de la fila — nunca se reemplaza después.
  `CREATE OR REPLACE FUNCTION tyc_version_inmutable() RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.version          IS DISTINCT FROM OLD.version
        OR NEW.contenido         IS DISTINCT FROM OLD.contenido
        OR NEW.contenido_sha256  IS DISTINCT FROM OLD.contenido_sha256
        OR NEW.pdf_url           IS DISTINCT FROM OLD.pdf_url
        OR NEW.pdf_sha256        IS DISTINCT FROM OLD.pdf_sha256
        OR NEW.pdf_bytes         IS DISTINCT FROM OLD.pdf_bytes
        OR NEW.publicado_en      IS DISTINCT FROM OLD.publicado_en
        OR NEW.created_at        IS DISTINCT FROM OLD.created_at
     THEN
       RAISE EXCEPTION 'tyc_version es inmutable (id=%, version=%): no se puede modificar version/contenido/hash/pdf/publicado_en de una versión ya publicada. Para un cambio de T&C, crea una versión nueva.', OLD.id, OLD.version;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,

  `DROP TRIGGER IF EXISTS trg_tyc_version_inmutable ON tyc_version`,
  `CREATE TRIGGER trg_tyc_version_inmutable
     BEFORE UPDATE ON tyc_version
     FOR EACH ROW EXECUTE FUNCTION tyc_version_inmutable()`,

  // Evidencia redundante en la propia reserva (defensa en profundidad,
  // documento "Fase 1B", §4): aunque tyc_version ya es inmutable, cada
  // reserva guarda el hash del contenido que aceptó AL MOMENTO de
  // contratar — nunca se recalcula después a partir de la versión actual.
  `ALTER TABLE reserva ADD COLUMN IF NOT EXISTS tyc_hash TEXT`,

  // El PDF conservable de cada versión contractual (documento "No autorizo
  // todavía el deploy...", 15-sep-2026, §9-10): UN PDF POR VERSIÓN, nunca
  // uno por reserva. Se genera una sola vez, al publicar la versión, y
  // queda protegido por el mismo trigger de inmutabilidad que el resto de
  // la fila (arriba). pdf_sha256/pdf_url ya existían en el esquema sin
  // usarse — pdf_bytes es la única columna nueva.
  `ALTER TABLE tyc_version ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA`,

  // ── DATOS FINALES + CICLO PREVIO AL EVENTO — Bloque 1 (documento
  // "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026) ──────────────────────
  //
  // `reserva.snapshot` (arriba) queda EXACTAMENTE como está: la
  // contratación original, y sigue sin tocarse nunca — ningún UPDATE de
  // este bloque la toca. `snapshot_vigente` es la configuración comercial
  // VIGENTE (original + cambios posteriores aprobados): NULL mientras no
  // haya cambios, momento en que la vigente sigue siendo exactamente la
  // original (regla: `snapshot_vigente ?? snapshot`).
  `ALTER TABLE reserva ADD COLUMN IF NOT EXISTS snapshot_vigente JSONB`,

  // Histórico append-only de cambios comerciales: nunca se actualiza ni
  // se borra una fila ya escrita. `configuracion_despues` es la misma
  // forma que `reserva.snapshot`/`snapshot_vigente` — así `snapshot_vigente`
  // es simplemente una copia materializada del `configuracion_despues` del
  // último cambio, sin tener que recorrer esta tabla para saber "cuál es
  // la vigente ahora".
  `CREATE TABLE IF NOT EXISTS cambio_comercial (
     id                     BIGSERIAL   PRIMARY KEY,
     reserva_id             BIGINT      NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
     total_antes            INTEGER     NOT NULL,
     total_despues          INTEGER     NOT NULL,
     diferencia             INTEGER     NOT NULL,
     configuracion_despues  JSONB       NOT NULL,
     motivo                 TEXT,
     creado                 TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS cambio_comercial_reserva_idx ON cambio_comercial (reserva_id, creado)`,

  // Datos finales operacionales: cada confirmación es una fila nueva,
  // nunca se reemplaza la anterior (append-only, igual que arriba). La
  // vigente es la de `confirmado_en` más reciente por reserva. Los
  // candados de cantidades viven en la propia base (CHECK), no solo en
  // el servidor — igual que el trigger de inmutabilidad de tyc_version.
  `CREATE TABLE IF NOT EXISTS datos_finales_reserva (
     id                    BIGSERIAL   PRIMARY KEY,
     reserva_id            BIGINT      NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
     ninos_final           INTEGER     NOT NULL CHECK (ninos_final >= 0),
     -- "niños de 7 años o más" (mayores de 6): nunca puede superar el
     -- total final de niños.
     mayores_final         INTEGER     NOT NULL CHECK (mayores_final >= 0 AND mayores_final <= ninos_final),
     adultos_aprox         INTEGER     NOT NULL CHECK (adultos_aprox >= 0),
     adulto_responsable    TEXT        NOT NULL,
     telefono_operacional  TEXT        NOT NULL,
     observacion           TEXT        CHECK (observacion IS NULL OR length(observacion) <= 500),
     confirmado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS datos_finales_reserva_idx ON datos_finales_reserva (reserva_id, confirmado_en DESC)`,

  // Pendientes con proveedor (decoración temática / animación): genérica,
  // a propósito, para no crear una tabla nueva por cada tipo de proveedor
  // futuro. RETIRADO nunca borra la fila —queremos histórico— solo la
  // saca de cualquier alerta/bloqueo operacional futuro. La UNIQUE incluye
  // `item_id` (no solo reserva_id+tipo) porque una reserva puede tener más
  // de una animación distinta contratada a la vez, cada una con su propio
  // pendiente ante la agencia.
  `CREATE TABLE IF NOT EXISTS pendiente_proveedor (
     id                BIGSERIAL   PRIMARY KEY,
     reserva_id        BIGINT      NOT NULL REFERENCES reserva(id) ON DELETE CASCADE,
     tipo              TEXT        NOT NULL CHECK (tipo IN ('decoracion_tematica','animacion')),
     item_id           TEXT        NOT NULL,
     -- Copia de presentación para /cadena — NUNCA la fuente canónica.
     -- La fuente real de la temática es configuracion_vigente.tematica.
     detalle           TEXT,
     estado            TEXT        NOT NULL DEFAULT 'PENDIENTE'
       CHECK (estado IN ('PENDIENTE','REVISAR_DESPUES','CONFIRMADO','NO_DISPONIBLE','RETIRADO')),
     proxima_revision  DATE,
     actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (reserva_id, tipo, item_id)
   )`,
  `CREATE INDEX IF NOT EXISTS pendiente_proveedor_estado_idx ON pendiente_proveedor (estado)`,

  // ── VISITAS AUTOGESTIONADAS — Fase 3A Bloque A (documento "FASE 3A —
  // VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE A", 22-sep-2026) ────────
  //
  // Entidad TOTALMENTE independiente de `reserva`: nunca crea pago, nunca
  // crea turno_hold, nunca crea pago_evento (§7, §8). `reserva_id` es
  // nullable y solo se llenará más adelante si esta visita termina en una
  // reserva real (analítica de conversión, §12 del documento) — nunca se
  // fuerza a existir.
  //
  // A PROPÓSITO NO EXISTE `visita_hold` NI ninguna UNIQUE/PK sobre
  // (fecha_visita, hora_inicio): el documento es explícito y repetido en
  // que las visitas NO son exclusivas (§4, §8, §9, §16, §24) — varias
  // familias pueden compartir exactamente el mismo horario, y eso es
  // comportamiento correcto, no una condición de carrera a resolver. El
  // índice de abajo es solo para que las consultas por fecha no barran la
  // tabla entera — nunca impone unicidad.
  `CREATE SEQUENCE IF NOT EXISTS visita_numero START 1`,

  `CREATE TABLE IF NOT EXISTS visita (
     id                BIGSERIAL   PRIMARY KEY,
     codigo            TEXT        NOT NULL UNIQUE,
     fecha_visita      DATE        NOT NULL,
     hora_inicio       TEXT        NOT NULL,

     nombre_adulto     TEXT        NOT NULL,
     whatsapp          TEXT        NOT NULL,
     email             TEXT        NOT NULL,
     nombre_festejado  TEXT,
     edad_festejado    TEXT,

     estado            TEXT        NOT NULL DEFAULT 'AGENDADA'
       CHECK (estado IN ('AGENDADA','CANCELADA','REALIZADA')),

     -- Mismo mecanismo que reserva.acceso_token (§12: reutilizar el patrón
     -- de Mi Celebración) — link privado sin cuentas ni contraseñas.
     acceso_token      TEXT        NOT NULL,
     origen            TEXT        NOT NULL DEFAULT 'web',

     -- Para medir después visitas agendadas → visitas realizadas →
     -- reservas (§12) — sin FK ON DELETE CASCADE: borrar una reserva no
     -- debe poder borrar el histórico de que la visita existió.
     reserva_id        BIGINT      REFERENCES reserva(id) ON DELETE SET NULL,

     -- Evento INDEPENDIENTE del de celebraciones — nunca comparte
     -- calendar_event_id con reserva (§15).
     calendar_event_id TEXT,

     creada_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
     realizada_en      TIMESTAMPTZ
   )`,

  `CREATE INDEX IF NOT EXISTS visita_fecha_idx ON visita (fecha_visita, hora_inicio)`,
  `CREATE INDEX IF NOT EXISTS visita_estado_idx ON visita (estado)`,

  // ── POSTEVENTO — idempotencia atómica (documento "FASE 3B — POSTEVENTO —
  // MICROCERRAMIENTO DE IDEMPOTENCIA", 24-sep-2026) ───────────────────────
  // Como máximo UNA tarea CREADA y UNA GESTIONADA por reserva, garantizado
  // por Postgres (no por un SELECT previo ni por limpieza posterior). El
  // índice es PARCIAL a propósito: pago_evento sigue permitiendo repetir
  // cualquier otro tipo de evento. El INSERT usa ON CONFLICT DO NOTHING
  // (lib/postevento.js).
  `CREATE UNIQUE INDEX IF NOT EXISTS pago_evento_postevento_uk
     ON pago_evento (reserva_id, tipo)
     WHERE tipo IN ('POSTEVENTO_TAREA_WHATSAPP_CREADA', 'POSTEVENTO_TAREA_WHATSAPP_GESTIONADA')`,

  // Hallazgo real (30-sep-2026): la Invitación Digital no tenía NINGÚN
  // seguimiento — era un ítem gratis más dentro de `extras`, sin ninguna
  // tarea ni aviso que le dijera a César que había que mandarla. Un
  // timestamp nullable en la propia reserva basta: NULL = falta enviarla
  // (si la reserva la incluye), con fecha = ya se mandó. No se modela como
  // `pendiente_proveedor` (esa tabla es para tareas que dependen de un
  // TERCERO — decoración/animación — la invitación la hace César mismo,
  // sin depender de nadie, así que forzarla en ese motor sería un mal
  // encaje conceptual, no el mismo tipo de pendiente).
  `ALTER TABLE reserva ADD COLUMN IF NOT EXISTS invitacion_enviada_en TIMESTAMPTZ`,
];

// Aplica el esquema. Idempotente: se puede llamar cada vez que haga falta.
export async function migrar() {
  const aplicadas = [];
  for (const sentencia of SENTENCIAS_ESQUEMA) {
    await q(sentencia);
    aplicadas.push(sentencia.slice(0, 60).replace(/\s+/g, ' ').trim());
  }
  return aplicadas;
}

// ¿Está el esquema puesto? Se usa para avisar en el panel en vez de
// dejar que reviente una consulta con un error de Postgres en crudo.
export async function esquemaListo() {
  try {
    const fila = await q1(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('reserva','pago','turno_hold')`
    );
    return (fila?.n ?? 0) === 3;
  } catch {
    return false;
  }
}
