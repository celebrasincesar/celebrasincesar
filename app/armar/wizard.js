'use client';

import { BLOQUES_VITRINA, PRECIOS_BASE, PRECIOS_EXTRAS, TYC_VERSION, NEGOCIO } from '../../data/master';
import { COPY_MAYORES, CATEGORIAS_PACK } from '../../data/packs-mayores';
import { buscarPromo } from '../../data/promos';
import {
  MAX_NINOS, TRAMOS_INVITADOS, TRAMOS_MAYORES, cantNinosDeTramo, categoriasCubiertasPorPack,
  contextoDesde, filtrarBloques, getItem, itemsDelPack, labelInvitados, labelMayores,
  maxNinosDeTramo, motivoRecintoCompleto, normalizarConfiguracion, packCompleto,
  packEsReferencial, packPara, precioPack, puedeElegirSector, recomendados, resumenPack,
  cotizacionEsReferencial,
  seleccionVacia, tramoInvitadosPorId, alternativasPara, motivoNoDisponible, itemVisible,
  horarioEfectivo, opcionesHorario, maxHorasAdicionales, migrarHoraExtra, turnoPorId,
  valorMayores, evaluarMayores, opcionesPack,
} from '../../data/reglas';
import { STATS } from '../../data/stats';
import { EVENTOS, track, propsCelebracion } from '../../data/analytics';
import { BloqueSection, FichaCarrusel, scrollBehavior } from '../adicionales-grid';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ITEM_LOOKUP,
  resolveGrupo,
  clp,
  WaIcon,
  getPrecio,
  calcularDescuento,
  recargoFestejados,
  aplicarMult,
  contarFechasLibres,
  MESES,
  Header,
  Calendario,
  Pasos,
  CodigoDescuento,
  ResumenLateral,
  BottomSheetResumen,
  ModalCarrusel,
  PackMayoresPaso,
  Recomendados,
  GaleriaInfra,
  Footer,
} from '../celebra-ui';
import { ModalPago } from './pago-checkout';
import { ConfirmarReserva } from './confirmar-reserva';

// ══════════════════════════════════════════════════════════════════
// ARMADOR DE CELEBRACIONES — /armar
// ──────────────────────────────────────────────────────────────────
// Herramienta transaccional: abre directo en "¿Cuándo quieres
// celebrar?". El recorrido largo del recinto vive en /alce-kids.
// ══════════════════════════════════════════════════════════════════
export default function CelebrationWizard() {
  const router = useRouter();
  // /armar es transaccional: abre en "¿Cuándo quieres celebrar?". El recorrido
  // largo del recinto (video, fotos, granja, testimonios) vive en /alce-kids.
  const [paso, setPaso] = useState(0);

  // Embudo (§BT): solo datos agregados, nunca nombres ni fechas exactas.
  useEffect(() => { track(EVENTOS.wizardStarted); }, []);

  // Scroll instantáneo al tope en cada cambio de paso o de vista
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setActivoBloqueId(bloquesAdicionales[0]?.id ?? '');
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disponibilidad real desde Google Calendar ──────────────────────────────
  const [disponibilidad, setDisponibilidad] = useState({
    blockedDates: [],
    blockedAM: [],
    blockedPM: [],
  });
  // 'cargando' | 'ok' | 'error' — nunca se asume disponibilidad (§O)
  const [estadoDisponibilidad, setEstadoDisponibilidad] = useState('cargando');
  // Fetch cada vez que el usuario llega al Paso 0 del wizard.
  // Sin skeleton: el calendario aparece de inmediato con lo que haya,
  // y se actualiza en silencio cuando llega la respuesta de Google Calendar.
  // El servidor cachea 30 s → respuesta rápida sin golpear la API en cada clic.
  useEffect(() => {
    if (paso !== 0) return;
    let vivo = true;
    setEstadoDisponibilidad('cargando');
    fetch('/api/disponibilidad', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!vivo) return;
        if (data && data.ok) {
          setDisponibilidad(data);
          setEstadoDisponibilidad('ok');
        } else {
          setEstadoDisponibilidad('error');
        }
      })
      .catch(() => { if (vivo) setEstadoDisponibilidad('error'); });
    return () => { vivo = false; };
  }, [paso]);

  const [estado, setEstado] = useState({
    fecha: null,
    hora: null,
    festejados: 1,        // cumpleaños compartido: 2-3 festejados con recargo
    nombreNino: '',
    edadNino: null,
    // Solo obligatoria si extras incluye 'deco-tematica-simple'/'-full'
    // (documento "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026, §7). Es la
    // fuente canónica de la temática — nunca se guarda en otro lado.
    tematica: '',
    // ── Invitados ──────────────────────────────────────────────────
    // Se pregunta por TRAMOS, no por número exacto: nadie sabe cuántos niños
    // van a llegar y pedir precisión convierte el armador en una calculadora.
    tramoInvitados: null,    // 'hasta10' | '11a20' | '21a30' | '31a40'
    totalNinos: null,        // número exacto — SOLO se pide en 31 a 40
    tramoMayores: null,      // 'no' | '1a3' | '4a6' | '7mas'
    mayoresAprox: null,      // número exacto cuando el tramo es '7mas'
    // cantNinos y ninosExtra los deriva normalizarConfiguracion() desde el
    // tramo. La fórmula de precios no se tocó: sigue recibiendo cantNinos.
    cantNinos: null,
    ninosExtra: 0,
    // ── Pack para niños mayores de 6 ───────────────────────────────
    packMayores: null,       // { packId, varianteId, seleccion: {...} }
    idCotizacion: null,      // CSC-AAAA-XXXXXX — se genera al enviar
    tokenCotizacion: null,   // llave del link privado de /confirmacion
    // Productos que el papá eligió en /catalogo antes de configurar nada.
    // Se resuelven cuando el armador ya sabe cómo será la celebración (§AT).
    pendientes: [],
    sector: null,
    packCelebra: false,
    extras: [],
    cotizar: [],          // categorías "A COTIZAR" (banquetería/comida) marcadas → viajan en el mensaje final
    codigo: '',           // código de descuento aplicado
    usaCocina: false,
    notas: '',
    horasAdicionales: 0,   // 0 | 1 | 2 - contratadas, no consultadas
  });

  const set = (campo, valor) => setEstado((p) => ({ ...p, [campo]: valor }));

  // ── ¿Se puede pagar por la web ahora mismo? ─────────────────────────
  // Se pregunta una sola vez, al entrar al armador. Si la respuesta es no
  // —falta la base de datos, faltan credenciales de Flow, César no
  // habilitó su cuenta— el botón de pago no aparece nunca: el papá solo
  // ve el camino de siempre, WhatsApp. Nunca se ofrece un pago para
  // después mostrar un error (documento de especificación de pagos, §0).
  const [pagosHabilitados, setPagosHabilitados] = useState(false);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  // null hasta que ModalPago junta nombre/email/teléfono: recién ahí se
  // muestra la confirmación previa al pago (§1 del documento "Nueva fase —
  // experiencia de marca…", 08-sep-2026).
  const [clienteContacto, setClienteContacto] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/pagos/estado')
      .then((r) => r.json())
      .then((j) => { if (vivo) setPagosHabilitados(!!j.pagosHabilitados); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // ── Contexto de reglas: la "foto" de la celebración que consumen los filtros ──
  const ctx = useMemo(() => contextoDesde(estado), [estado]);
  const hayMayores = ctx.hayMayores;
  // Decoración temática obligatoria (documento "FASE 2B — IMPLEMENTAR
  // BLOQUE 1", 21-sep-2026, §7) — mismos dos ids que
  // lib/pendientes-proveedor.js#IDS_DECORACION_TEMATICA (no se importa
  // ese archivo acá: arrastraría el driver de Postgres al bundle del
  // cliente).
  const tieneDecoTematica = estado.extras.some((e) => e.id === 'deco-tematica-simple' || e.id === 'deco-tematica-full');
  const faltaTematica = tieneDecoTematica && !estado.tematica.trim();
  // Horario real de la celebracion (turno + horas contratadas). Precio,
  // resumen, Revisa, cotizacion y WhatsApp leen de aqui y de ningun otro lado.
  const horario = useMemo(
    () => horarioEfectivo(estado.hora, estado.horasAdicionales, estado.fecha),
    [estado.hora, estado.horasAdicionales, estado.fecha]
  );
  const packActual = useMemo(() => packPara(ctx), [ctx]);
  // Tramo elegido y tope de mayores que cabe dentro de ese tramo (§V).
  const tramoActual = useMemo(() => tramoInvitadosPorId(estado.tramoInvitados), [estado.tramoInvitados]);
  const topeMayores = useMemo(() => maxNinosDeTramo(estado.tramoInvitados), [estado.tramoInvitados]);

  // ── Vitrina personalizada ──────────────────────────────────────────────
  // Una sola fuente (data/master.js) filtrada por el motor de reglas:
  //   · se ocultan los inflables medianos/pequeños cuando no corresponden
  //   · INCLUIDOS se muestra en el paso "Qué incluye", no en Adicionales
  //
  // Ya no se esconde nada por el pack de mayores: su entretención son
  // adicionales normales del catálogo, que el papá agrega cuando quiere.
  const categoriasCubiertas = [];
  const bloquesFiltrados = useMemo(() => filtrarBloques(BLOQUES_VITRINA, ctx, []), [ctx]);
  const bloqueIncluidos = useMemo(() => bloquesFiltrados.find((b) => b.id === 'b-incluidos') || null, [bloquesFiltrados]);
  const bloquesAdicionales = useMemo(() => bloquesFiltrados.filter((b) => b.id !== 'b-incluidos'), [bloquesFiltrados]);
  const listaRecomendados = useMemo(
    () => recomendados(ctx, estado.extras.map((e) => e.id), 4, { categoriasCubiertas }),
    [ctx, estado.extras]
  );

  // Tracking de la sección activa en el paso de Adicionales (igual que /catalogo).
  // Va DESPUÉS de bloquesAdicionales: su array de dependencias se evalúa
  // durante el render, no puede leer una const declarada más abajo.
  useEffect(() => {
    if (paso !== 3) return;
    const onScroll = () => {
      for (let i = bloquesAdicionales.length - 1; i >= 0; i--) {
        const el = document.getElementById(bloquesAdicionales[i].id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActivoBloqueId(bloquesAdicionales[i].id);
          return;
        }
      }
      setActivoBloqueId(bloquesAdicionales[0]?.id ?? '');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [paso, bloquesAdicionales]);

  // Elegir tramo de invitados. Todo lo demás (tramo de precios, niños sobre
  // 30, sector, pack) lo recalcula normalizarConfiguracion().
  const aplicarTramo = (tramoId) => setEstado((p) => {
    const t = tramoInvitadosPorId(tramoId);
    if (!t) return p;
    return {
      ...p,
      tramoInvitados: t.id,
      totalNinos: t.pideExacto ? (p.totalNinos && p.totalNinos >= t.min && p.totalNinos <= t.max ? p.totalNinos : t.min) : null,
      cantNinos: t.cantNinos,
    };
  });

  // Número exacto — solo en 31 a 40, donde cada niño sobre 30 cambia el precio.
  const aplicarExacto = (n) => setEstado((p) => {
    const t = tramoInvitadosPorId(p.tramoInvitados);
    if (!t?.pideExacto) return p;
    return { ...p, totalNinos: Math.max(t.min, Math.min(t.max, Number(n) || t.min)) };
  });

  // ── NORMALIZACIÓN CENTRAL (§X) ─────────────────────────────────────────
  // Un solo lugar impide los estados imposibles. Se ejecuta cuando cambia el
  // tramo, los mayores, la edad, el sector o el pack, y corrige: mayores que
  // no caben en el tramo, sector incompatible, pack de otra variante y
  // adicionales que dejaron de corresponder. Si algo se quita, se avisa.
  const [avisoFiltro, setAvisoFiltro] = useState('');
  useEffect(() => {
    if (!estado.tramoInvitados) return;
    const n = normalizarConfiguracion(estado);
    const distinto =
      n.sector !== estado.sector ||
      n.cantNinos !== estado.cantNinos ||
      n.ninosExtra !== estado.ninosExtra ||
      n.totalNinos !== estado.totalNinos ||
      n.mayoresAprox !== estado.mayoresAprox ||
      (n.extras?.length ?? 0) !== (estado.extras?.length ?? 0) ||
      JSON.stringify(n.packMayores) !== JSON.stringify(estado.packMayores);
    if (!distinto) return;
    const { cambios, ...limpio } = n;
    setEstado((p) => ({ ...p, ...limpio }));
    if (cambios.length) setAvisoFiltro(cambios[0]);
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // El aviso se retira solo; no bloquea nada.
  useEffect(() => {
    if (!avisoFiltro) return;
    const t = setTimeout(() => setAvisoFiltro(''), 6000);
    return () => clearTimeout(t);
  }, [avisoFiltro]);

  // Cambiar de alternativa dentro de un requisito: se limpian las elecciones
  // de esa casilla porque las categorías válidas cambiaron.
  const cambiarRamaPack = (reqId, ramaId) => setEstado((p) => {
    if (!p.packMayores) return p;
    if (p.packMayores.seleccion[reqId]?.rama === ramaId) return p;
    return {
      ...p,
      packMayores: {
        ...p.packMayores,
        seleccion: { ...p.packMayores.seleccion, [reqId]: { rama: ramaId, items: [] } },
      },
    };
  });

  // Elegir/quitar un producto dentro de una casilla del pack.
  // Al llegar al tope de esa categoría se reemplaza el más antiguo — así el
  // papá nunca queda trabado sin entender por qué no puede tocar otra opción.
  const toggleItemPack = (reqId, item, categoria, cantidad) => setEstado((p) => {
    if (!p.packMayores) return p;
    const actual = p.packMayores.seleccion[reqId] || { rama: null, items: [] };
    const items = [...actual.items];
    const yaEsta = items.indexOf(item.id);
    if (yaEsta >= 0) {
      items.splice(yaEsta, 1);
    } else {
      const mismaCat = items.filter((id) => getItem(id)?.categoria_pack === categoria);
      if (mismaCat.length >= cantidad) items.splice(items.indexOf(mismaCat[0]), 1);
      items.push(item.id);
    }
    return {
      ...p,
      packMayores: {
        ...p.packMayores,
        seleccion: { ...p.packMayores.seleccion, [reqId]: { ...actual, items } },
      },
    };
  });


  // Marcar/desmarcar una categoría "A COTIZAR" (banquetería/comida) para consultarla
  // al final. NO sale del armador → nunca se pierde lo avanzado.
  const toggleCotizar = (grupo) => setEstado((p) => {
    const ya = p.cotizar.some((c) => c.id === grupo.id);
    return {
      ...p,
      cotizar: ya
        ? p.cotizar.filter((c) => c.id !== grupo.id)
        : [...p.cotizar, { id: grupo.id, nombre: grupo.nombre }],
    };
  });

  // ── Persistencia del wizard — el carrito nunca se pierde ─────────────────
  // Si el papá abandona a medio camino y vuelve (hasta 7 días después),
  // retoma exactamente donde quedó. Los extras se re-validan contra el
  // catálogo vigente (precios/ítems frescos, nunca datos obsoletos).
  const [retomado, setRetomado] = useState(false);
  useEffect(() => {
    try {
      // v3: el paso de invitados volvió a trabajar por TRAMOS y el wizard pasó
      // a cinco pasos. Las sesiones anteriores no son compatibles y se ignoran.
      const raw = localStorage.getItem('alce-wizard-v3');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s.ts || Date.now() - s.ts > 7 * 24 * 3600 * 1000) return;
      const fecha = s.fecha ? new Date(s.fecha) : null;
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const fechaValida = fecha && !isNaN(fecha) && fecha >= hoy ? fecha : null;
      const extras = (s.extras || []).map((e) => ITEM_LOOKUP[e?.id]).filter(Boolean);
      const cotizar = Array.isArray(s.cotizar) ? s.cotizar.filter((c) => c && c.id && c.nombre) : [];
      // Venir del catálogo con productos pendientes TAMBIÉN es avance: si no,
      // la sesión se descartaba y la intención del papá se perdía (§AT).
      const pendientes = Array.isArray(s.pendientes) ? s.pendientes : [];
      const hayAvance = fechaValida || s.nombreNino || extras.length > 0
        || cotizar.length > 0 || pendientes.length > 0;
      if (!hayAvance) return;
      setEstado((p) => ({
        ...p,
        fecha: fechaValida,
        hora: fechaValida ? (s.hora ?? null) : null,
        festejados: s.festejados || 1,
        nombreNino: s.nombreNino || '',
        edadNino: s.edadNino ?? null,
        tramoInvitados: s.tramoInvitados ?? null,
        totalNinos: s.totalNinos ?? null,
        tramoMayores: s.tramoMayores ?? null,
        mayoresAprox: s.mayoresAprox ?? null,
        packMayores: s.packMayores ?? null,
        pendientes,
        idCotizacion: s.idCotizacion ?? null,
        tokenCotizacion: s.tokenCotizacion ?? null,
        // cantNinos/ninosExtra los recalcula normalizarConfiguracion()
        cantNinos: s.tramoInvitados ? cantNinosDeTramo(s.tramoInvitados) : null,
        ninosExtra: 0,
        sector: s.sector ?? null,
        packCelebra: !!s.packCelebra,
        extras,
        cotizar,
        codigo: s.codigo || '',
        usaCocina: !!s.usaCocina,
        notas: s.notas || '',
        horasAdicionales: Math.min(migrarHoraExtra(s), maxHorasAdicionales(s.hora, s.fecha)),
      }));
      if (typeof s.paso === 'number' && s.paso > 0) {
        setPaso(s.paso);
        setRetomado(true);
        setTimeout(() => setRetomado(false), 5000);
      }
    } catch {} // storage corrupto o bloqueado: se parte de cero, sin romper nada
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const { fecha, ...rest } = estado;
      localStorage.setItem('alce-wizard-v3', JSON.stringify({
        ...rest,
        fecha: fecha ? fecha.toISOString() : null,
        paso,
        ts: Date.now(),
      }));
    } catch {}
  }, [estado, paso]);

  // Quien llega desde el catálogo con productos elegidos entra por el PRIMER
  // PASO INCOMPLETO, nunca directo a Personaliza: sin fecha, festejado e
  // invitados el armador no puede saber si esos productos corresponden (§AT).
  const primerPasoIncompleto = (e) => {
    if (!e.fecha || !e.hora) return 0;
    if (!e.nombreNino || !e.edadNino) return 1;
    if (!e.tramoInvitados || !e.tramoMayores || !e.sector) return 2;
    return 3;
  };

  // Resultado de resolver los pendientes, para contárselo al papá.
  const [avisoPendientes, setAvisoPendientes] = useState(null);

  useEffect(() => {
    if (!estado.pendientes?.length) return;
    // Todavía no hay contexto suficiente: se esperan, no se pierden.
    if (!estado.tramoInvitados || !estado.tramoMayores || !estado.sector) {
      setPaso((p) => Math.min(p, primerPasoIncompleto(estado)));
      return;
    }
    const enPack = new Set(itemsDelPack(estado.packMayores?.seleccion));
    const agregados = [];
    const rechazados = [];
    for (const id of estado.pendientes) {
      const item = getItem(id);
      if (!item) continue;
      if (estado.extras.some((e) => e.id === id)) continue;
      if (enPack.has(id)) {
        rechazados.push({ item, motivo: 'ya viene dentro de la entretención para los mayores', alternativas: [] });
        continue;
      }
      if (itemVisible(item, ctx)) {
        agregados.push(item);
      } else {
        rechazados.push({
          item,
          motivo: motivoNoDisponible(id, ctx),
          alternativas: alternativasPara(id, ctx, 2),
        });
      }
    }
    setEstado((p) => ({
      ...p,
      extras: [...p.extras, ...agregados.filter((a) => !p.extras.some((e) => e.id === a.id))],
      pendientes: [],
    }));
    if (agregados.length || rechazados.length) setAvisoPendientes({ agregados, rechazados });
  }, [estado.pendientes, estado.tramoInvitados, estado.tramoMayores, estado.sector, estado.packMayores]); // eslint-disable-line react-hooks/exhaustive-deps

  const [grupoAbierto, setGrupoAbierto] = useState(null); // grupo resuelto activo
  const [grupoFicha, setGrupoFicha] = useState(null); // FichaCarrusel paso 4
  const [sheetAbierto, setSheetAbierto] = useState(false); // bottom sheet móvil
  const [activoBloqueId, setActivoBloqueId] = useState(BLOQUES_VITRINA[0]?.id ?? '');
  // Personaliza abre con todo cerrado: el papá ve el mapa completo de
  // categorías en una pantalla y abre solo la que le interesa (§P1-26).
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);
  // Solo se enciende si al intentar avanzar falta entretención para los grandes.
  const [faltaMayores, setFaltaMayores] = useState(false);
  const faltaMayoresRef = useRef(null);
  const faltaTematicaRef = useRef(null);

  // Cuántas cosas lleva elegidas dentro de cada categoría: se muestra en la
  // cabecera para que cerrar una categoría no esconda lo ya seleccionado.
  const seleccionadosDe = (bloque) => {
    const ids = bloque.grupos.flatMap((g) => resolveGrupo(g).items.map((i) => i.id));
    const grupoIds = bloque.grupos.map((g) => resolveGrupo(g).id);
    return estado.extras.filter((e) => ids.includes(e.id)).length
      + estado.cotizar.filter((c) => grupoIds.includes(c.id)).length;
  };
  const navCatRef = useRef(null);

  // ── Guiado del wizard: al elegir algo, llevar suave a la siguiente sub-sección ──
  // (clave en móvil, donde el horario/sector aparecen debajo y el usuario no los ve)
  const horarioRef = useRef(null);
  const sectorRef  = useRef(null);
  const mayoresRef = useRef(null);
  const exactoRef  = useRef(null);
  const p0BtnRef   = useRef(null);
  const p1BtnRef   = useRef(null);
  const p2BtnRef   = useRef(null);
  const scrollA = (ref) => setTimeout(() => {
    ref?.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, 90);

  // ── Navegación con HISTORIAL REAL (como cualquier sitio: un paso por atrás) ──
  // Cada AVANCE (entrar a una vista, pasar de paso, abrir un panel) apila una
  // entrada real en el historial del navegador, guardando en `history.state` el
  // estado EXACTO de esa pantalla. El botón atrás del celular retrocede una
  // entrada y nosotros restauramos ese estado guardado → vuelve al paso anterior,
  // igual que el botón "Volver". Cuando ya está en el inicio (entrada base), el
  // atrás sale del sitio de forma natural, como en todos los sitios.
  // Restaurar el estado ABSOLUTO (no "deshacer un paso") lo hace robusto incluso
  // ante dos toques muy rápidos: cada popstate lee el snapshot correcto.
  // ⚠️ history.pushState usa SIEMPRE location.href (la URL no cambia) para no
  // gatillar el router de Next.
  const depthRef = useRef(0);          // cuántas entradas hemos apilado sobre la base
  const navFullRef = useRef(null);     // estado de navegación actual (fuente de verdad)

  const applyNav = (n) => {
    setPaso(n.paso || 0);
    setGrupoAbierto(n.grupo ?? null);
    setGrupoFicha(n.ficha ?? null);
    setSheetAbierto(!!n.sheet);
    navFullRef.current = n;
  };

  // AVANZAR: aplica el nuevo estado y apila un punto de retorno (durante el gesto
  // del usuario → el navegador lo respeta y no lo ignora como a las marcas huecas).
  const avanzar = (patch) => {
    // `cur` = estado visible en vivo (siempre actual en el closure del onClick).
    const cur = { paso, grupo: grupoAbierto, ficha: grupoFicha, sheet: sheetAbierto };
    const next = { paso: cur.paso, grupo: null, ficha: null, sheet: false, ...patch };
    applyNav(next);
    depthRef.current += 1;
    try { history.pushState({ nav: next, depth: depthRef.current }, '', location.href); } catch {}
  };

  // RETROCEDER un paso = lo mismo que el botón atrás del navegador (consume una
  // entrada apilada). Si NO hay entradas apiladas (entrada directa a /armar o
  // sesión restaurada), retrocede un nivel DENTRO del sitio sin salir.
  const retroceder = () => {
    if (depthRef.current > 0) { try { history.back(); } catch {} return; }
    const cur = { paso, grupo: grupoAbierto, ficha: grupoFicha, sheet: sheetAbierto };
    if (cur.sheet)                 applyNav({ ...cur, sheet: false });
    else if (cur.ficha)            applyNav({ ...cur, ficha: null });
    else if (cur.grupo)            applyNav({ ...cur, grupo: null });
    else if (cur.paso > 0)         applyNav({ ...cur, paso: cur.paso - 1 });
    else if (cur.paso > 0) applyNav({ paso: cur.paso - 1, grupo: null, ficha: null, sheet: false });
  };

  // Inicializar la entrada base con la posición inicial (normalmente 'inicio').
  useEffect(() => {
    const inicial = { paso, grupo: null, ficha: null, sheet: false };
    navFullRef.current = inicial;
    depthRef.current = 0;
    try { history.replaceState({ nav: inicial, depth: 0 }, '', location.href); } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // El botón atrás del navegador: restaurar el estado guardado en esa entrada.
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state || history.state;
      if (st && st.nav) {
        applyNav(st.nav);
        depthRef.current = st.depth || 0;
      }
      // Sin snapshot = bajamos de la entrada base → el navegador ya salió del sitio.
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quitar un extra por id (para el bottom sheet)
  const quitarExtra = (itemId) =>
    setEstado((p) => ({ ...p, extras: p.extras.filter((e) => e.id !== itemId) }));

  // Grupo (sección) al que pertenece una opción — lo necesitan los
  // recomendados para respetar la regla single/multi-select de su sección.
  const grupoDeItem = (itemId) => {
    for (const b of BLOQUES_VITRINA) {
      for (const g of b.grupos) {
        if ((g.itemIds || []).includes(itemId)) return resolveGrupo(g);
      }
    }
    return { seleccionMultiple: true, items: [] };
  };

  // Toggle de ítem dentro del modal
  // - single-select: quita todos los de este grupo antes de agregar
  // - multi-select: toggle normal
  const toggleItemModal = (item, grupo) => {
    setEstado((p) => {
      const yaEsta = p.extras.some((e) => e.id === item.id);
      if (!yaEsta) track(EVENTOS.extraAdded, { producto: item.id, gratis: !!item.gratis });
      if (yaEsta) {
        return { ...p, extras: p.extras.filter((e) => e.id !== item.id) };
      }
      if (!grupo.seleccionMultiple) {
        const idsGrupo = grupo.items.map((i) => i.id);
        return {
          ...p,
          extras: [...p.extras.filter((e) => !idsGrupo.includes(e.id)), item],
        };
      }
      return { ...p, extras: [...p.extras, item] };
    });
  };

  // Precio correcto según día — sábado tiene tabla propia
  const esSabado = estado.fecha?.getDay() === 6;

  // Arriendo del recinto para un sector dado, con la configuración actual.
  // Misma fórmula de siempre: base(día/sector) + add_edad + add_cantidad.
  const precioArriendo = (sectorId) => {
    const tramo = estado.cantNinos || 'hasta10';
    const raw =
      sectorId === 'independiente'
        ? (esSabado ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente)
        : tramo === 'hasta10'
          ? (esSabado ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10)
          : tramo === 'hasta20'
            ? (esSabado ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20)
            : (esSabado ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30);
    // El valor de los hermanos mayores viaja DENTRO del arriendo: se cobra,
    // pero nunca se desglosa como una línea aparte (decisión de César).
    return aplicarMult(raw, estado.edadNino, tramo)
      + (estado.ninosExtra || 0) * PRECIOS_EXTRAS.nino_extra
      + valorMayores(ctx);
  };

  const totalBruto = useMemo(() => {
    let t = 0;
    const _sab = estado.fecha?.getDay() === 6;
    let _baseRaw_total = 0;
    if (estado.sector === 'independiente')
      _baseRaw_total = _sab ? PRECIOS_BASE.independiente_sab : PRECIOS_BASE.independiente;
    else if (estado.cantNinos === 'hasta10' && estado.sector === 'completo')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_10_sab : PRECIOS_BASE.completo_10;
    else if (estado.cantNinos === 'hasta20')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_20_sab : PRECIOS_BASE.completo_20;
    else if (estado.cantNinos === 'hasta30' || estado.cantNinos === 'mas30')
      _baseRaw_total = _sab ? PRECIOS_BASE.completo_30_sab : PRECIOS_BASE.completo_30;
    t += aplicarMult(_baseRaw_total, estado.edadNino, estado.cantNinos);
    t += recargoFestejados(estado.festejados);
    if (estado.packCelebra) t += PRECIOS_EXTRAS.pack_celebra;
    estado.extras.forEach((e) => (t += getPrecio(e, estado.cantNinos)));
    if (estado.usaCocina) t += PRECIOS_EXTRAS.aseo_profundo;
    // Horas adicionales: se contratan al elegir el horario, así que se suman.
    t += (estado.horasAdicionales || 0) * PRECIOS_EXTRAS.hora_adicional;
    if (estado.cantNinos === 'mas30') t += (estado.ninosExtra || 0) * PRECIOS_EXTRAS.nino_extra;
    // Sumar hermanos mayores tiene un valor cerrado por tramo. Su entretención
    // ya viene contada en `extras`, como cualquier otro adicional.
    t += valorMayores(contextoDesde(estado));
    return t;
  }, [estado]);

  // Código de descuento: promo válida + monto a descontar (sobre el ítem elegible mayor).
  const promo = useMemo(() => buscarPromo(estado.codigo), [estado.codigo]);
  const descuento = useMemo(
    () => calcularDescuento(promo, estado.extras, estado.cantNinos),
    [promo, estado.extras, estado.cantNinos]
  );
  const total = Math.max(0, totalBruto - descuento.monto);
  const anticipo = Math.round(total / 2);

  const datosDelPack = null;   // el pack dejó de ser una compra aparte

  // Cuánto suma tener hermanos mayores, y si lo que ya eligió les alcanza.
  const valorHermanosMayores = useMemo(() => valorMayores(ctx), [ctx]);
  const mayoresResuelto = useMemo(
    () => evaluarMayores(estado.extras, ctx),
    [estado.extras, ctx]
  );

  // Con todo a precio cerrado ya no existe el "valor estimado".
  const hayValorReferencial = cotizacionEsReferencial();

  // Lo que el papá pidió que dejemos preparado (siempre $0).
  const preparados = useMemo(() => estado.extras.filter((e) => e.gratis), [estado.extras]);


  // Snapshot completo de la solicitud — queda guardado localmente y viaja con
  // el mismo ID en el mensaje. Es la base del futuro guardar/compartir cotización.
  const guardarCotizacion = (id, accessToken) => {
    // Se arma una sola vez y sirve para las dos copias: la local y la central.
    let cuerpoCentral = { id, accessToken };
    try {
      const registro = {
        id,
        accessToken,
        creada: new Date().toISOString(),
        estadoSolicitud: 'enviada_whatsapp',
        evento: {
          fecha: estado.fecha ? estado.fecha.toISOString() : null,
          fechaTexto: estado.fecha
            ? estado.fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : null,
          horario: estado.hora,
          horasAdicionales: estado.horasAdicionales || 0,
          horaInicioReal: horario?.horaInicio || null,
          horaTerminoReal: horario?.horaTermino || null,
          horarioTexto: horario?.textoLargo || null,
          sector: estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo',
        },
        festejado: {
          nombre: estado.nombreNino,
          edad: estado.edadNino,
          festejados: estado.festejados,
        },
        invitados: {
          tramoInvitados: estado.tramoInvitados,
          totalExacto: ctx.totalExacto,          // solo existe en 31-40
          etiqueta: labelInvitados(estado),
          tramoPrecio: estado.cantNinos,
          tramoMayores: estado.tramoMayores,
          mayoresExacto: estado.tramoMayores === '7mas' ? ctx.cantidadMayores : null,
          etiquetaMayores: labelMayores(estado),
          valorMayores: valorHermanosMayores,
        },
        pack: datosDelPack
          ? {
              packId: datosDelPack.pack.id,
              nombre: datosDelPack.pack.nombre,
              varianteId: datosDelPack.variante.id,
              elecciones: datosDelPack.items.map((i) => i.id),
              precio: datosDelPack.precio,
              referencial: datosDelPack.referencial,
            }
          : null,
        preparados: preparados.map((e) => e.id),
        adicionales: estado.extras.filter((e) => !e.gratis).map((e) => e.id),
        cotizar: estado.cotizar.map((c) => c.id),
        packCelebra: estado.packCelebra,
        codigo: estado.codigo || null,
        total,
        esEstimado: hayValorReferencial,
        anticipo,
        saldo: total - anticipo,
        saldoVence: 'hasta 48 horas antes del evento',
        tycVersion: TYC_VERSION,
      };
      cuerpoCentral = registro;
      const previas = JSON.parse(localStorage.getItem('alce-cotizaciones') || '[]');
      localStorage.setItem(
        'alce-cotizaciones',
        JSON.stringify([registro, ...previas.filter((r) => r.id !== id)].slice(0, 20))
      );
    } catch {} // storage bloqueado: el mensaje igual sale, solo no queda copia local

    // Copia central en el servidor: el localStorage sigue siendo soporte de
    // experiencia, pero ya no es la única fuente (§AZ). Va aparte del bloque de
    // arriba —si el navegador bloquea el storage, la copia central igual se
    // guarda— sin await y con keepalive para que el WhatsApp se abra al
    // instante. Si el servidor falla, el papá no se entera: su solicitud sale.
    try {
      fetch('/api/cotizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpoCentral),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  // ── ID de cotización ───────────────────────────────────────────────────
  // Cada configuración enviada por WhatsApp lleva su propio identificador,
  // así César la encuentra al tiro y después /cadena puede engancharla.
  // Correlativo real (000123) necesita almacenamiento en servidor: cuando
  // exista, se reemplaza acá y el resto del flujo no cambia.
  const nuevoIdCotizacion = () => {
    const anio = new Date().getFullYear();
    const azar = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `CSC-${anio}-${azar}`;
  };

  // El ID viaja por WhatsApp y es corto a propósito. La cotización guarda el
  // nombre del festejado, así que leerla exige además esta llave, que solo
  // existe en el link privado de confirmación (§P0-23).
  const nuevoToken = () => {
    const b = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  };

  // Mensaje corto (§AY): lo que César necesita para responder, nada más.
  // No se listan las prestaciones gratuitas estándar.
  const generarWhatsApp = () => {
    const id = estado.idCotizacion || nuevoIdCotizacion();
    const token = estado.tokenCotizacion || nuevoToken();
    if (!estado.idCotizacion || !estado.tokenCotizacion) {
      setEstado((p) => ({ ...p, idCotizacion: id, tokenCotizacion: token }));
    }
    guardarCotizacion(id, token);
    track(EVENTOS.whatsappRequestClicked, propsCelebracion(estado, ctx, { total, estimado: hayValorReferencial }));

    const fechaTexto = estado.fecha?.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
    }) || '—';
    const horarioTexto = horario?.textoLargo || '—';
    const sectorTexto = estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo';

    const bloquePack = datosDelPack && datosDelPack.items.length
      ? `\n🎈 ${datosDelPack.pack.nombre}:\n` +
        datosDelPack.items.map((i) => `• ${i.nombre}`).join('\n') + '\n'
      : '';

    const pagados = [
      ...(estado.packCelebra ? [`• Pack Celebra Sin Cesar: ${clp(PRECIOS_EXTRAS.pack_celebra)}`] : []),
      ...estado.extras.filter((e) => !e.gratis).map((e) => `• ${e.nombre}: ${clp(getPrecio(e, estado.cantNinos))}`),
      ...estado.cotizar.map((c) => `• ${c.nombre}: quiero cotizarlo`),
      ...(estado.horasAdicionales > 0
        ? [`• ${estado.horasAdicionales} hora${estado.horasAdicionales > 1 ? 's' : ''} adicional${estado.horasAdicionales > 1 ? 'es' : ''}: ${clp(horario.precioAdicional)}`]
        : []),
    ];
    const bloqueAdicionales = pagados.length ? `\n✨ Adicionales:\n${pagados.join('\n')}\n` : '';

    const bloquePreparado = preparados.length
      ? `\n🎁 Dejar preparado: ${preparados.map((e) => e.nombre).join(', ')}\n`
      : '';

    const descuentoLinea = descuento.monto > 0
      ? `\n🎫 Código ${estado.codigo.trim().toUpperCase()}: -${clp(descuento.monto)}`
      : '';

    const tematicaLinea = tieneDecoTematica && estado.tematica.trim() ? `\n🎨 Temática: ${estado.tematica.trim()}` : '';
    const notasLinea = estado.notas?.trim() ? `\n📝 ${estado.notas.trim()}` : '';

    const msg =
`Hola César 👋 Quiero solicitar esta celebración:

🎉 Cotización: ${id}
📅 ${fechaTexto} · ${horarioTexto}
🎂 ${estado.nombreNino || '—'}${estado.edadNino ? ` · cumple ${estado.edadNino}` : ''}
👧 ${labelInvitados(estado) || '—'}
👦 Mayores de 6: ${labelMayores(estado) || '—'}
🏡 ${sectorTexto}
${bloquePack}${bloqueAdicionales}${tematicaLinea}${bloquePreparado}${descuentoLinea}
💰 ${hayValorReferencial ? 'Valor estimado' : 'Valor total'}: ${clp(total)}
💳 Anticipo 50%: ${clp(anticipo)}
💵 Saldo hasta 48 h antes: ${clp(total - anticipo)}${notasLinea}

¿Me confirmas disponibilidad y datos para reservar?`;

    window.open(`https://wa.me/56944356955?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const generarWhatsAppVisita = () => {
    const nombre = estado.nombreNino;
    const msg = nombre
      ? `¡Hola César! Me gustaría conocer el espacio Alce Kids antes de reservar la celebración de ${nombre}. ¿Cuándo podría pasar a visitarlo sin compromiso?`
      : `¡Hola César! Me gustaría conocer el espacio Alce Kids sin compromiso. ¿Cuándo podría pasar a visitarlo?`;
    window.open(`https://wa.me/56944356955?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const irAlRecinto = () => router.push('/alce-kids');
  // Ir al inicio = retroceder todas las entradas apiladas de una (deshace la cadena).
  const irInicio   = () => router.push('/');
  const irAPaso    = (n) => avanzar({ paso: n });

  // ── VISTA WIZARD ──────────────────────────────
  return (
    <>
      <Header onHome={irInicio} variant="wizard" />
      <div className="max-w-6xl mx-auto px-4 py-8 pb-28 lg:pb-8">

        {/* Banner Alce Kids */}
        <div className="rounded-3xl p-5 mb-8 flex items-center gap-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #060F2E 0%, #0D2B6E 50%, #0E6FA8 100%)', boxShadow: '0 8px 40px rgba(13,43,110,0.35)' }}>
          <div className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(circle at 80% 50%, rgba(41,185,232,0.25) 0%, transparent 60%)' }} />
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 relative z-10"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <img src="/logo-alce.webp" alt="Alce Kids" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <span style={{ display: 'none' }} className="text-3xl">🦌</span>
          </div>
          <div className="flex-1 relative z-10">
            <h2 className="text-white font-black text-2xl leading-none">Alce Kids</h2>
            <p className="text-blue-200/70 text-sm mt-0.5">Recinto exclusivo · Talavera de la Reina 380, Las Condes · 0 a 6 años</p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xl">⭐ {STATS.rating}</span>
              <span className="text-blue-200/60 text-xs">· {STATS.reseñas}+ reseñas en Google</span>
            </div>
            <button
              onClick={irAlRecinto}
              className="text-xs font-bold px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ background: 'rgba(41,185,232,0.2)', color: '#93c5fd' }}
            >
              ← Ver el recinto
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 min-w-0">
          {/* Contenido principal */}
          <div className="lg:col-span-2 min-w-0">
            {/* Siempre cinco pasos: declarar niños mayores nunca debe
                parecer "un paso más de trabajo" (§M). */}
            <Pasos actual={paso} labels={['Fecha', 'Festejado', 'Invitados', 'Personaliza', 'Revisa']} />

            {/* ─── PASO 0: FECHA Y HORA ─── */}
            {paso === 0 && (
              <div>
                {/* ── Primero la pregunta, nada antes ──────────────────────
                     El video autoplay y el recorrido de fotos se fueron a
                     /alce-kids: acá el papá viene a resolver una fecha. ── */}
                <div className="mb-6">
                  <h2 className="text-2xl md:text-3xl font-black leading-tight" style={{ color: '#1565C0' }}>
                    ¿Cuándo quieres celebrar?
                  </h2>
                  <div className="flex items-baseline justify-between gap-3 flex-wrap mt-1">
                    <p className="text-gray-500">Viernes PM 16:00–19:00 · Sábados y domingos AM 11:00–14:00 · PM 15:00–18:00</p>
                    <a href="/alce-kids"
                      className="text-sm font-bold whitespace-nowrap transition-opacity hover:opacity-70"
                      style={{ color: '#0E7FA8' }}>
                      ¿Quieres ver el lugar? → Ver fotos
                    </a>
                  </div>
                </div>

                {/* ── No se pudo comprobar la disponibilidad ───────────────
                     Un fallo del calendario nunca se muestra como "hay cupo":
                     se dice la verdad y se ofrece la vía humana. ── */}
                {estadoDisponibilidad === 'error' && (
                  <div className="rounded-2xl p-5 mb-6"
                    style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', border: '2px solid #F97316' }}>
                    <p className="font-black text-orange-900">
                      No pudimos comprobar la disponibilidad en este momento.
                    </p>
                    <p className="text-sm text-orange-700 mt-1.5 leading-relaxed">
                      Para no confirmarte una fecha que quizá ya está tomada, preferimos revisarla contigo.
                      Escríbenos y te decimos al tiro si tu día está libre.
                    </p>
                    <a
                      href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Quiero consultar disponibilidad para una celebración en Alce Kids 😊')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-4 text-white font-black py-3 px-5 rounded-2xl transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
                    >
                      <WaIcon /> Consultar por WhatsApp
                    </a>
                  </div>
                )}

                {/* ── Urgencia honesta — solo con disponibilidad comprobada (§P) ── */}
                {estadoDisponibilidad === 'ok' && (() => {
                  const ahora = new Date();
                  const libresEste = contarFechasLibres(disponibilidad, ahora.getFullYear(), ahora.getMonth());
                  const nextM = ahora.getMonth() === 11 ? 0 : ahora.getMonth() + 1;
                  const nextY = ahora.getMonth() === 11 ? ahora.getFullYear() + 1 : ahora.getFullYear();
                  const libresProx = contarFechasLibres(disponibilidad, nextY, nextM);
                  const usarProx = libresEste === 0;
                  const n = usarProx ? libresProx : libresEste;
                  const mesNombre = MESES[usarProx ? nextM : ahora.getMonth()];
                  if (n === 0) return null; // sin data o sin cupos: no inventamos nada
                  const pocas = n <= 4;
                  return (
                    <div
                      className="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl"
                      style={{
                        background: pocas
                          ? 'linear-gradient(135deg,#FFF1E6,#FFE4CC)'
                          : 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                        border: `1.5px solid ${pocas ? 'rgba(249,115,22,0.35)' : 'rgba(21,101,192,0.2)'}`,
                      }}
                    >
                      <span className="text-xl flex-shrink-0">{pocas ? '🔥' : '📅'}</span>
                      <p className="text-sm font-bold leading-snug" style={{ color: pocas ? '#9A3412' : '#1E40AF' }}>
                        {pocas
                          ? <>{n === 1 ? 'Queda' : 'Quedan'} <span className="font-black">solo {n} {n === 1 ? 'fecha libre' : 'fechas libres'}</span> en {mesNombre} — los fines de semana se agendan rápido.</>
                          : <><span className="font-black">{n} fechas libres</span> en {mesNombre}. Los fines de semana del sector oriente se reservan con semanas de anticipación.</>}
                      </p>
                    </div>
                  );
                })()}

                {/* ── Tranquilidad de invierno — responde la objeción #1 de mayo-agosto
                     en el momento exacto de la decisión (elegir fecha) ── */}
                {(() => {
                  const mes = new Date().getMonth(); // 4=may … 7=ago
                  if (mes < 4 || mes > 7) return null;
                  return (
                    <div
                      className="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl"
                      style={{ background: 'linear-gradient(135deg,#EFF8FF,#E0F2FE)', border: '1.5px solid rgba(14,165,233,0.3)' }}
                    >
                      <span className="text-xl flex-shrink-0">🌧️</span>
                      <p className="text-sm font-bold leading-snug" style={{ color: '#0369A1' }}>
                        ¿Reservando en invierno? Tranquilidad total: si llueve,{' '}
                        <span className="font-black">reagendas sin costo</span> y tu anticipo queda 100% vigente.
                        Nunca pierdes tu reserva.
                      </p>
                    </div>
                  );
                })()}

                {/* ── Dos columnas: Calendario | Horario ── */}
                <div className="grid md:grid-cols-2 gap-6 items-start"
                  style={estadoDisponibilidad === 'error'
                    ? { opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(0.6)' }
                    : undefined}
                  aria-hidden={estadoDisponibilidad === 'error'}>

                  {/* Columna izquierda — Calendario */}
                  <div>
                    <p className="text-gray-500 text-xs mb-3 font-semibold tracking-wide uppercase">Viernes · Sábados · Domingos</p>
                    <Calendario
                      fecha={estado.fecha}
                      onFecha={(f) => {
                        setEstado((p) => ({ ...p, fecha: f, hora: null, horasAdicionales: 0 }));
                        track(EVENTOS.dateSelected, { dia_semana: f.getDay() });
                        scrollA(horarioRef);
                      }}
                      disponibilidad={disponibilidad}
                    />
                  </div>

                  {/* Columna derecha — Horario */}
                  <div ref={horarioRef} className="scroll-mt-24">
                    <p className="text-gray-500 text-xs mb-3 font-semibold tracking-wide uppercase">🕐 Bloque horario</p>

                    {estado.fecha ? (
                      <>
                        {/* Slots AM / PM */}
                        {(() => {
                          const fs = estado.fecha
                            ? `${estado.fecha.getFullYear()}-${String(estado.fecha.getMonth() + 1).padStart(2, '0')}-${String(estado.fecha.getDate()).padStart(2, '0')}`
                            : null;
                          const amReservado = fs && disponibilidad.blockedAM.includes(fs);
                          const pmReservado = fs && disponibilidad.blockedPM.includes(fs);
                          return (
                            <div className="space-y-3 mb-5">
                              {[
                                { id: 'AM', label: 'Mañana · AM', emoji: '🌅', reservado: amReservado },
                                { id: 'PM', label: 'Tarde · PM',  emoji: '🌇', reservado: pmReservado },
                              ]
                                // Los viernes no existe turno AM (§1, Autorización Fase 1A):
                                // no se ofrece, no es que esté "reservado".
                                .filter((c) => turnoPorId(c.id, estado.fecha))
                                .map((c) => ({ ...c, hora: horarioEfectivo(c.id, 0, estado.fecha).texto }))
                                .map((slot) => {
                                const sel = estado.hora === slot.id;
                                return (
                                  <button
                                    key={slot.id}
                                    disabled={slot.reservado}
                                    onClick={() => {
                                      if (slot.reservado) return;
                                      // Al cambiar de turno las horas se acotan a lo que ese
                                      // turno admite: PM +2 -> AM deja 1.
                                      setEstado((p) => ({
                                        ...p, hora: slot.id,
                                        horasAdicionales: Math.min(p.horasAdicionales || 0, maxHorasAdicionales(slot.id, p.fecha)),
                                      }));
                                      scrollA(p0BtnRef);
                                    }}
                                    className="w-full p-4 rounded-2xl text-left transition-all duration-200"
                                    style={{
                                      border: slot.reservado ? '2px solid #F3F4F6' :
                                              sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                                      background: slot.reservado ? '#F9FAFB' :
                                                  sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                                      boxShadow: sel ? '0 4px 16px rgba(21,101,192,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                                      transform: sel ? 'scale(1.02)' : 'scale(1)',
                                      cursor: slot.reservado ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`text-2xl ${slot.reservado ? 'opacity-30' : ''}`}>{slot.emoji}</div>
                                      <div className="flex-1">
                                        <div className="font-black text-sm"
                                          style={{ color: slot.reservado ? '#D1D5DB' : sel ? '#1565C0' : '#1e293b',
                                                   textDecoration: slot.reservado ? 'line-through' : 'none' }}>
                                          {slot.label}
                                        </div>
                                        <div className="text-xs mt-0.5"
                                          style={{ color: slot.reservado ? '#D1D5DB' : '#6B7280',
                                                   textDecoration: slot.reservado ? 'line-through' : 'none' }}>
                                          {slot.hora}
                                        </div>
                                      </div>
                                      {slot.reservado && (
                                        <span className="text-xs font-black text-red-400 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                          Reservado
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Imagen "elige tu horario" — solo antes de elegir turno */}
                        {!estado.hora && (
                          <div className="flex justify-center mb-3">
                            <img
                              src="/elige-tu-horario.webp" width="560" height="560" decoding="async"
                              alt="Elige tu horario"
                              className="w-full max-w-[260px]"
                              style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.18))' }}
                            />
                          </div>
                        )}

                        {/* Duración — se elige junto con el horario, no después */}
                        {estado.hora ? (
                          <div className="mb-4">
                            <p className="text-gray-500 text-xs mb-2 font-semibold tracking-wide uppercase">⏱️ Duración</p>
                            <div className="space-y-2">
                              {opcionesHorario(estado.hora, estado.fecha).map((op) => {
                                const sel = (estado.horasAdicionales || 0) === op.horas;
                                return (
                                  <button
                                    key={op.horas}
                                    onClick={() => set('horasAdicionales', op.horas)}
                                    className="w-full px-4 py-3 rounded-2xl text-left transition-all flex items-center gap-3"
                                    style={{
                                      border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                                      background: sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                                    }}
                                  >
                                    <span
                                      className="w-4 h-4 rounded-full flex-shrink-0"
                                      style={{
                                        border: sel ? '5px solid #1565C0' : '2px solid #CBD5E1',
                                        background: 'white',
                                      }}
                                    />
                                    <span className="flex-1">
                                      <span className="block font-black text-sm" style={{ color: sel ? '#1565C0' : '#1e293b' }}>
                                        {op.texto}
                                      </span>
                                      <span className="block text-xs mt-0.5 text-gray-500">
                                        {op.horas === 0
                                          ? '3 horas · incluidas'
                                          : `${3 + op.horas} horas · ${op.horas} adicional${op.horas > 1 ? 'es' : ''}`}
                                      </span>
                                    </span>
                                    <span className="font-black text-sm flex-shrink-0"
                                      style={{ color: op.horas === 0 ? '#16A34A' : '#1565C0' }}>
                                      {op.horas === 0 ? 'Incluido' : `+${clp(op.precioAdicional)}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-gray-500 text-xs mt-2 leading-snug">
                              Además de la duración elegida tienes 30 minutos de cortesía. Los adultos no pagan entrada.
                            </p>
                          </div>
                        ) : (
                          <div
                            className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5 border"
                            style={{ background: '#EFF8FF', borderColor: '#BAE6FD' }}
                          >
                            <span className="text-lg">⏱️</span>
                            <div>
                              <p className="font-black text-xs" style={{ color: '#0369A1' }}>
                                3 horas incluidas + 30 min de cortesía
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: '#0EA5E9' }}>
                                Adultos sin costo adicional
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Imagen "¡Buena elección!" — solo cuando ya eligió horario */}
                        {estado.hora && (
                          <div className="flex justify-center">
                            <img
                              src="/buena-eleccion.webp" width="600" height="204" decoding="async"
                              alt="¡Buena elección! ahora al siguiente paso"
                              className="w-full max-w-[300px]"
                              style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.2))' }}
                            />
                          </div>
                        )}

                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <img
                          src="/elige-tu-fecha.webp" width="560" height="560" decoding="async"
                          alt="Elige tu fecha - Alce Kids"
                          className="w-full max-w-[280px] mx-auto"
                          style={{ filter: 'drop-shadow(0 8px 24px rgba(21,101,192,0.18))' }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  ref={p0BtnRef}
                  disabled={!estado.fecha || !estado.hora}
                  onClick={() => irAPaso(1)}
                  className="mt-8 w-full text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 scroll-mt-24"
                  style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                >
                  Siguiente →
                </button>
              </div>
            )}

            {/* ─── PASO 1: EL FESTEJADO ─── */}
            {paso === 1 && (
              <div>
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>🎂 {estado.festejados > 1 ? 'Los festejados' : 'El festejado'}</h2>
                <p className="text-gray-500 mb-6">Queremos hacer su día inolvidable</p>

                <div className="space-y-5">
                  {/* ── Cumpleaños compartido — 1 a 3 festejados ── */}
                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">¿Cuántos cumpleañeros celebran?</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((n) => {
                        const sel = estado.festejados === n;
                        return (
                          <button
                            key={n}
                            onClick={() => set('festejados', n)}
                            className="py-3.5 px-2 rounded-2xl transition-all duration-200 text-center"
                            style={{
                              border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : 'white',
                              boxShadow: sel ? '0 4px 14px rgba(249,115,22,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div className="font-black text-base" style={{ color: sel ? '#EA580C' : '#6B7280' }}>
                              {n === 1 ? '1 festejado' : `${n} festejados`}
                            </div>
                            <div className="text-xs font-bold mt-0.5" style={{ color: sel ? '#F97316' : '#9CA3AF' }}>
                              {n === 1 ? 'Clásico' : 'Compartido'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Solo explica QUÉ es un cumpleaños compartido. No promete
                        nada incluido: lo que se agregue lo elige el papá. */}
                    {estado.festejados > 1 && (
                      <p className="text-xs mt-2 font-semibold leading-relaxed" style={{ color: '#F97316' }}>
                        🎉 Celebran juntos hermanos, mellizos o amigos, cada uno con su nombre en la
                        reserva. El valor se ajusta solo en el detalle.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">
                      {estado.festejados > 1 ? '¿Cómo se llaman los cumpleañeros?' : '¿Cómo se llama el cumpleañero/a?'}
                    </label>
                    <input
                      type="text"
                      value={estado.nombreNino}
                      onChange={(e) => set('nombreNino', e.target.value)}
                      placeholder={estado.festejados > 1 ? 'Ej: Sofía y Matías' : 'Ej: Sofía, Matías, Antonia...'}
                      className="w-full rounded-2xl px-5 py-4 text-lg outline-none transition-all font-semibold"
                      style={{
                        border: '2px solid #E5E7EB',
                        background: '#FAFBFF',
                        color: '#1e293b',
                      }}
                      onFocus={(e) => { e.target.style.border = '2px solid #1565C0'; e.target.style.boxShadow = '0 0 0 4px rgba(21,101,192,0.08)'; }}
                      onBlur={(e)  => { e.target.style.border = '2px solid #E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-gray-600 mb-2">
                      {estado.festejados > 1 ? '¿Cuántos años cumple el mayor de los festejados?' : '¿Cuántos años cumple?'}
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((edad) => {
                        const sel = estado.edadNino === edad;
                        return (
                          <button
                            key={edad}
                            onClick={() => { set('edadNino', edad); scrollA(p1BtnRef); }}
                            className="py-4 rounded-2xl font-black text-xl transition-all duration-200"
                            style={{
                              border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : 'white',
                              color: sel ? '#EA580C' : '#6B7280',
                              boxShadow: sel ? '0 4px 14px rgba(249,115,22,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                              transform: sel ? 'scale(1.08)' : 'scale(1)',
                            }}
                          >
                            {edad}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs mt-2 font-semibold" style={{ color: '#29B9E8' }}>* Alce Kids celebra a niños hasta los 6 años</p>
                  </div>

                </div>

                <div ref={p1BtnRef} className="flex gap-3 mt-8 scroll-mt-24">
                  <button onClick={retroceder}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    disabled={!estado.nombreNino || !estado.edadNino}
                    onClick={() => {
                      track(EVENTOS.birthdayCompleted, { edad_festejado: estado.edadNino, festejados: estado.festejados });
                      irAPaso(2);
                    }}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 2: CANTIDAD Y EDADES DE LOS INVITADOS ─── */}
            {paso === 2 && (
              <div>
                <h2 className="text-2xl font-black mb-1" style={{color:'#1565C0'}}>👨‍👩‍👧‍👦 Cuéntanos de los invitados</h2>
                <p className="text-gray-500 mb-4">Con esto filtramos lo que realmente sirve para tu cumpleaños.</p>

                {/* Banner adultos */}
                <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '1.5px solid rgba(21,101,192,0.2)' }}>
                  <span className="text-2xl">🎉</span>
                  <p className="font-bold text-sm" style={{ color: '#1E40AF' }}>
                    <strong>¡Adultos sin costo adicional!</strong> No pagas extra por papás, apoderados ni familiares que acompañen.
                  </p>
                </div>

                {/* ── ¿Cuántos niños vienen? — TRAMOS, no un número exacto ──
                     Nadie sabe la cifra final tres semanas antes. Pedir
                     precisión convierte el armador en una calculadora. ── */}
                <div className="mb-6">
                  <label className="block text-sm font-black text-gray-600 mb-1">
                    ¿Cuántos niños asistirán aproximadamente?
                  </label>
                  <p className="text-xs text-gray-500 mb-4">
                    Cuenta a todos los niños, incluido el festejado. La cantidad final la confirmamos antes del evento.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {TRAMOS_INVITADOS.map((t) => {
                      const sel = estado.tramoInvitados === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            aplicarTramo(t.id);
                            track(EVENTOS.guestRangeSelected, { tramo: t.id });
                            scrollA(t.pideExacto ? exactoRef : mayoresRef);
                          }}
                          className="py-5 px-4 rounded-2xl font-black transition-all duration-200"
                          style={{
                            border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                            background: sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                            color: sel ? '#1565C0' : '#374151',
                            boxShadow: sel ? '0 4px 18px rgba(21,101,192,0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                            transform: sel ? 'scale(1.02)' : 'scale(1)',
                          }}
                        >
                          <span className="block text-lg leading-none">{t.label}</span>
                          <span className="block text-xs font-semibold mt-1" style={{ color: sel ? '#1565C0' : '#9CA3AF' }}>
                            niños
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Solo 31-40 necesita el número exacto: cada niño sobre 30
                      cambia el precio, así que acá sí hay que preguntarlo. */}
                  {tramoActual?.pideExacto && (
                    <div ref={exactoRef} className="mt-5 pt-5 scroll-mt-24" style={{ borderTop: '1px dashed #E5E7EB' }}>
                      <label className="block text-sm font-black text-gray-600 mb-1">¿Cuántos aproximadamente?</label>
                      <p className="text-xs text-gray-500 mb-4">
                        Desde el niño 31 cada uno suma {clp(PRECIOS_EXTRAS.nino_extra)} al arriendo.
                      </p>
                      <div className="flex items-center justify-center gap-6">
                        <button
                          onClick={() => aplicarExacto((estado.totalNinos || 31) - 1)}
                          disabled={(estado.totalNinos || 31) <= 31}
                          className="w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-all shadow-sm disabled:opacity-40"
                          style={{
                            background: (estado.totalNinos || 31) > 31 ? '#1565C0' : '#F3F4F6',
                            color: (estado.totalNinos || 31) > 31 ? 'white' : '#D1D5DB',
                          }}
                          aria-label="Un niño menos"
                        >−</button>
                        <div className="text-center min-w-[100px]">
                          <div className="font-black text-4xl leading-none" style={{ color: '#1565C0' }}>
                            {estado.totalNinos || 31}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">niños en total</div>
                        </div>
                        <button
                          onClick={() => aplicarExacto((estado.totalNinos || 31) + 1)}
                          disabled={(estado.totalNinos || 31) >= MAX_NINOS}
                          className="w-12 h-12 rounded-full font-black text-xl flex items-center justify-center transition-all shadow-sm text-white disabled:opacity-40"
                          style={{ background: '#F97316' }}
                          aria-label="Un niño más"
                        >+</button>
                      </div>
                      {(estado.totalNinos || 31) >= MAX_NINOS && (
                        <p className="text-xs text-center mt-4 font-bold" style={{ color: '#F97316' }}>
                          {MAX_NINOS} niños es nuestro máximo. ¿Son más? Escríbenos y lo vemos caso a caso.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── ¿Vendrán niños mayores de 6? ─────────────────────────────
                     No es un filtro legal: nos permite prepararles entretención
                     adecuada. Ya están contados dentro del total. ── */}
                {estado.tramoInvitados && (
                  <div ref={mayoresRef} className="rounded-2xl border-2 p-5 mb-5 scroll-mt-24" style={{ borderColor: '#E5E7EB' }}>
                    <label className="block text-sm font-black text-gray-600 mb-1">
                      ¿Vendrán niños mayores de 6 años?
                    </label>
                    <p className="text-xs text-gray-500 mb-4">
                      Hermanos, primos o invitados grandes. Ya están incluidos en los {labelInvitados(estado)} de arriba.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {TRAMOS_MAYORES.map((t) => {
                        const sel = estado.tramoMayores === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setEstado((prev) => ({
                                ...prev,
                                tramoMayores: t.id,
                                mayoresAprox: t.id === '7mas' ? (prev.mayoresAprox || 7) : null,
                              }));
                              track(EVENTOS.olderChildrenSelected, { mayores: t.id });
                              scrollA(t.id === '7mas' ? mayoresRef : p2BtnRef);
                            }}
                            className="py-4 px-3 rounded-2xl font-bold text-sm transition-all duration-200"
                            style={{
                              border: sel ? '2px solid #1565C0' : '2px solid #E5E7EB',
                              background: sel ? 'linear-gradient(135deg,#EFF6FF,#DBEAFE)' : 'white',
                              color: sel ? '#1565C0' : '#6B7280',
                              boxShadow: sel ? '0 4px 14px rgba(21,101,192,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* 7 o más → el único caso donde pedimos un número */}
                    {estado.tramoMayores === '7mas' && (
                      <div className="mt-5 pt-5" style={{ borderTop: '1px dashed #E5E7EB' }}>
                        <label className="block text-sm font-black text-gray-600 mb-3">
                          ¿Cuántos aproximadamente?
                        </label>
                        <div className="flex items-center justify-center gap-6">
                          <button
                            onClick={() => setEstado((prev) => ({ ...prev, mayoresAprox: Math.max(7, (prev.mayoresAprox || 7) - 1) }))}
                            disabled={(estado.mayoresAprox || 7) <= 7}
                            className="w-11 h-11 rounded-full font-black text-lg flex items-center justify-center transition-all shadow-sm disabled:opacity-40"
                            style={{
                              background: (estado.mayoresAprox || 7) > 7 ? '#1565C0' : '#F3F4F6',
                              color: (estado.mayoresAprox || 7) > 7 ? 'white' : '#D1D5DB',
                            }}
                            aria-label="Un mayor menos"
                          >−</button>
                          <div className="text-center min-w-[90px]">
                            <div className="font-black text-4xl leading-none" style={{ color: '#1565C0' }}>
                              {estado.mayoresAprox || 7}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">mayores de 6</div>
                          </div>
                          <button
                            onClick={() => setEstado((prev) => ({ ...prev, mayoresAprox: Math.min(topeMayores, (prev.mayoresAprox || 7) + 1) }))}
                            disabled={(estado.mayoresAprox || 7) >= topeMayores}
                            className="w-11 h-11 rounded-full font-black text-lg flex items-center justify-center transition-all shadow-sm text-white disabled:opacity-40"
                            style={{ background: '#F97316' }}
                            aria-label="Un mayor más"
                          >+</button>
                        </div>
                        <p className="text-xs text-center text-gray-500 mt-3">
                          Máximo {topeMayores} para {labelInvitados(estado)}.
                        </p>
                      </div>
                    )}

                    {/* Bienvenida a los hermanos mayores — nunca una advertencia
                        ni un castigo: se suman a la fiesta y su valor se ve al
                        tiro, sin letra chica. */}
                    {hayMayores && (
                      <div className="rounded-2xl p-4 mt-5"
                        style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: '2px solid #93C5FD' }}>
                        <div className="flex gap-3">
                          <span className="text-2xl flex-shrink-0">🎉</span>
                          <div className="flex-1">
                            <p className="font-black" style={{ color: '#1E40AF' }}>{COPY_MAYORES.titulo}</p>
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#1D4ED8' }}>
                              {COPY_MAYORES.texto}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sector — solo se ofrece elegir con hasta 10 niños y sin mayores */}
                {estado.tramoInvitados && puedeElegirSector(ctx.totalNinos, estado.edadNino, hayMayores) && (
                  <div ref={sectorRef} className="mb-4 scroll-mt-24">
                    <h3 className="font-black text-gray-700 mb-3">¿Qué sector prefieres?</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        {
                          id: 'independiente',
                          nombre: 'Sector Independiente',
                          desc: 'Un solo sector del recinto. Más íntimo y privado.',
                          precio: precioArriendo('independiente'),
                          emoji: '🌳',
                        },
                        {
                          id: 'completo',
                          nombre: 'Recinto Completo',
                          desc: 'Acceso a todas las áreas. La experiencia completa.',
                          precio: precioArriendo('completo'),
                          emoji: '🏡',
                        },
                      ].map((s) => {
                        const sel = estado.sector === s.id;
                        return (
                        <button
                          key={s.id}
                          onClick={() => {
                            set('sector', s.id);
                            track(EVENTOS.sectorSelected, { sector: s.id });
                            scrollA(p2BtnRef);
                          }}
                          className="p-5 rounded-2xl text-left transition-all duration-200"
                          style={{
                            border: sel ? '2px solid #F97316' : '2px solid #E5E7EB',
                            background: sel ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' : 'white',
                            boxShadow: sel ? '0 4px 20px rgba(249,115,22,0.18)' : '0 1px 4px rgba(0,0,0,0.04)',
                            transform: sel ? 'scale(1.02)' : 'scale(1)',
                          }}
                        >
                          <div className="text-3xl mb-2">{s.emoji}</div>
                          <div className="font-black text-gray-800 text-sm">{s.nombre}</div>
                          <div className="text-gray-500 text-xs mt-1 mb-3">{s.desc}</div>
                          <div className="font-black text-lg" style={{ color: sel ? '#F97316' : '#1565C0' }}>{clp(s.precio)}</div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sector asignado automáticamente */}
                {estado.tramoInvitados && !puedeElegirSector(ctx.totalNinos, estado.edadNino, hayMayores) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-blue-700 font-bold text-sm">🏡 Recinto Completo — asignado automáticamente</p>
                      <p className="font-black text-lg flex-shrink-0" style={{ color: '#1565C0' }}>{clp(precioArriendo('completo'))}</p>
                    </div>
                    <p className="text-blue-500 text-xs mt-1">
                      {{
                        mayores: 'Como vienen niños mayores de 6, su entretención se instala fuera del sector de los más chicos: por eso la celebración va en el recinto completo.',
                        cantidad: 'Desde 11 invitados la celebración va en el Recinto Completo: es el espacio que rinde para todos.',
                      }[motivoRecintoCompleto(ctx.totalNinos, estado.edadNino, hayMayores)]}
                    </p>
                    {estado.ninosExtra > 0 && (
                      <p className="text-blue-500 text-xs mt-1">
                        Incluye {estado.ninosExtra} niño{estado.ninosExtra !== 1 ? 's' : ''} sobre 30 · {clp(PRECIOS_EXTRAS.nino_extra)} c/u
                      </p>
                    )}
                  </div>
                )}

                <div ref={p2BtnRef} className="flex gap-3 mt-6 scroll-mt-24">
                  <button onClick={retroceder}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    disabled={!estado.tramoInvitados || !estado.tramoMayores || !estado.sector}
                    onClick={() => {
                      track(EVENTOS.personalizationStarted, propsCelebracion(estado, ctx));
                      if (hayMayores) track(EVENTOS.olderPackStarted, { mayores: estado.tramoMayores, tramo: estado.tramoInvitados });
                      irAPaso(3);
                    }}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                  >
                    Personalizar mi celebración →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 3: PERSONALIZA ────────────────────────────────────
                 Un solo paso (§AD):
                   B · tu arriendo ya incluye
                   C · qué dejamos preparado
                   D · recomendados para tu celebración
                   E · otros adicionales
                 Declarar mayores no abre ningún paso: solo al salir se
                 comprueba si lo elegido alcanza para los grandes. ── */}
            {paso === 3 && (
              <div>
                <h2 className="text-2xl md:text-3xl font-black mb-1" style={{color:'#1565C0'}}>Personaliza tu celebración</h2>
                <p className="text-gray-500 mb-6">Cuéntanos qué quieres y lo dejamos listo.</p>

                {/* ── B · TU ARRIENDO YA INCLUYE (compacto, §AM) ────────── */}
                <div className="rounded-2xl border-2 p-5 mb-8" style={{ borderColor: '#E5E7EB' }}>
                  <p className="font-black text-gray-700 mb-3">Tu arriendo ya incluye</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      'Juegos Alce Kids',
                      'Salón climatizado',
                      'Baños completos',
                      'Limpieza profunda',
                      '3 estacionamientos',
                      'Adultos sin costo adicional',
                      'Uso exclusivo del sector contratado',
                      'Granja con conejos',
                    ].map((t) => (
                      <div key={t} className="flex items-center gap-2 text-sm">
                        <span style={{ color: '#22c55e' }}>✓</span>
                        <span className="text-gray-600">{t}</span>
                      </div>
                    ))}
                  </div>
                  <a href="/alce-kids" className="inline-block mt-4 text-sm font-bold" style={{ color: '#29B9E8' }}>
                    ¿Quieres volver a ver el lugar? → Ver fotos
                  </a>
                </div>

                {/* ── C · QUÉ DEJAMOS PREPARADO (§AN) ───────────────────── */}
                {bloqueIncluidos && (
                  <div className="mb-10">
                    <h3 className="font-black text-xl tracking-tight" style={{ color: '#1565C0' }}>
                      ¿Qué quieres que dejemos preparado sin costo?
                    </h3>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5 mb-4">
                      Lo tenemos listo antes de que llegues. Nada de esto tiene costo.
                    </p>
                    <BloqueSection
                      bloque={bloqueIncluidos}
                      onTapGrupo={(g) => avanzar({ ficha: g })}
                      getSeleccionado={(grupo) => grupo.items.some(i => estado.extras.some(e => e.id === i.id))}
                      getAgregados={(grupo) => grupo.items.filter(i => estado.extras.some(e => e.id === i.id))}
                      onAddDirecto={toggleItemModal}
                      cantNinos={estado.cantNinos || 'hasta10'}
                      onCotizar={toggleCotizar}
                      getCotizado={(grupo) => estado.cotizar.some(c => c.id === grupo.id)}
                    />
                  </div>
                )}

                {/* Nav categorías sticky */}
                <div className="sticky z-40 flex items-center"
                  style={{ top: '72px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(14px)', borderBottom: '2px solid rgba(21,101,192,0.07)' }}>
                  <button onClick={() => navCatRef.current?.scrollBy({ left: -200, behavior: scrollBehavior() })}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg"
                    style={{ color: '#1565C0' }}>‹</button>
                  <div ref={navCatRef} className="flex gap-1.5 px-2 py-2.5 overflow-x-auto flex-1 min-w-0"
                    style={{ scrollbarWidth: 'none' }}>
                    {bloquesAdicionales.map((b) => (
                      <button key={b.id}
                        onClick={() => {
                          setActivoBloqueId(b.id);
                          setCategoriaAbierta(b.id);
                          document.getElementById(b.id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
                        }}
                        className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all"
                        style={activoBloqueId === b.id
                          ? { background: '#1565C0', color: 'white', boxShadow: '0 2px 10px rgba(21,101,192,0.35)' }
                          : { background: 'rgba(21,101,192,0.07)', color: '#1565C0' }}>
                        {b.titulo}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => navCatRef.current?.scrollBy({ left: 200, behavior: scrollBehavior() })}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center font-black text-lg"
                    style={{ color: '#1565C0' }}>›</button>
                </div>

                {/* ── Nada de esto es obligatorio: se dice concreto, sin promesas
                     absolutas, en el momento exacto del upsell (§P1-33) ── */}
                <div className="rounded-2xl px-4 py-3 mt-5 flex items-center gap-3"
                  style={{ background: 'linear-gradient(135deg,#F0F9FF,#EFF6FF)', border: '1.5px solid rgba(21,101,192,0.18)' }}>
                  <span className="text-xl flex-shrink-0">🔓</span>
                  <p className="text-sm font-bold leading-snug" style={{ color: '#1E40AF' }}>
                    <span className="font-black">Tu celebración, a tu manera.</span> Trae tu propia torta,
                    comida y decoración sin costo extra, o suma solo lo que necesites.
                    {hayMayores ? ' Los hermanos mayores también encuentran lo suyo acá.' : ''}
                  </p>
                </div>

                {/* Recomendados — lo que calza con ESTA celebración */}
                <Recomendados
                  lista={listaRecomendados}
                  cantNinos={estado.cantNinos || 'hasta10'}
                  isAdded={(item) => estado.extras.some((e) => e.id === item.id)}
                  onAdd={(item) => {
                    if (!estado.extras.some((e) => e.id === item.id)) {
                      track(EVENTOS.recommendationAdded, { producto: item.id, categoria: item.categoria_pack || null });
                    }
                    toggleItemModal(item, grupoDeItem(item.id));
                  }}
                />

                {/* Pack Celebra Sin Cesar */}
                <div className="rounded-2xl p-5 mt-5 mb-6 border-2"
                  style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', borderColor: '#F97316' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-black text-orange-900 text-base leading-tight">Pack Celebra Sin Cesar</h3>
                        <span className="bg-orange-500 text-white text-xs font-black px-2 py-0.5 rounded-full">POPULAR</span>
                      </div>
                      <p className="text-orange-700 text-sm leading-snug">Piñata temática · Decoración básica por sexo · Arco de globos</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-orange-900 text-xl">{clp(PRECIOS_EXTRAS.pack_celebra)}</div>
                      <button
                        onClick={() => set('packCelebra', !estado.packCelebra)}
                        className="mt-2 px-4 py-2 rounded-xl font-black text-sm transition-all"
                        style={estado.packCelebra
                          ? { background: '#F97316', color: 'white' }
                          : { background: 'white', border: '2px solid #F97316', color: '#F97316' }}>
                        {estado.packCelebra ? '✓ Agregado' : '+ Agregar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vitrina de bloques — todo lo compatible con esta celebración */}
                <div className="mb-5">
                  <h3 className="font-black text-xl tracking-tight" style={{ color: '#1565C0' }}>
                    ¿Quieres agregar algo más?
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    Ya filtramos lo que no corresponde para {labelInvitados(estado) || 'tu celebración'}
                    {hayMayores ? ' con invitados mayores de 6' : ''}
                  </p>
                  <div className="h-0.5 w-10 rounded-full mt-1.5" style={{ background: '#F97316' }} />
                </div>

                {/* Acordeón: una categoría abierta a la vez. Cerrar no pierde
                    nada de lo elegido — solo deja de ocupar pantalla. */}
                <div className="space-y-3">
                  {bloquesAdicionales.map((bloque) => {
                    const abierta = categoriaAbierta === bloque.id;
                    const nSel = seleccionadosDe(bloque);
                    return (
                      <div
                        key={bloque.id}
                        id={bloque.id}
                        className="rounded-2xl border-2 overflow-hidden scroll-mt-28"
                        style={{ borderColor: abierta ? 'rgba(21,101,192,0.28)' : '#E5E7EB', background: 'white' }}
                      >
                        <button
                          onClick={() => {
                            setCategoriaAbierta(abierta ? null : bloque.id);
                            if (!abierta) setActivoBloqueId(bloque.id);
                          }}
                          aria-expanded={abierta}
                          className="w-full flex items-center gap-3 px-4 py-4 text-left"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block font-black text-base tracking-tight truncate" style={{ color: '#1565C0' }}>
                              {bloque.titulo}
                            </span>
                            {bloque.subTitulo && (
                              <span className="block text-xs font-semibold text-gray-500 truncate">{bloque.subTitulo}</span>
                            )}
                          </span>
                          {nSel > 0 && (
                            <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
                              {nSel} seleccionado{nSel > 1 ? 's' : ''}
                            </span>
                          )}
                          <span className="flex-shrink-0 font-black text-lg transition-transform"
                            style={{ color: '#94A3B8', transform: abierta ? 'rotate(180deg)' : 'none' }}>
                            ⌄
                          </span>
                        </button>
                        {abierta && (
                          <div className="px-4 pb-2">
                            <BloqueSection
                              compacto
                              bloque={bloque}
                              onTapGrupo={(g) => avanzar({ ficha: g })}
                              getSeleccionado={(grupo) => grupo.items.some(i => estado.extras.some(e => e.id === i.id))}
                              getAgregados={(grupo) => grupo.items.filter(i => estado.extras.some(e => e.id === i.id))}
                              onAddDirecto={toggleItemModal}
                              cantNinos={estado.cantNinos || 'hasta10'}
                              onCotizar={toggleCotizar}
                              getCotizado={(grupo) => estado.cotizar.some(c => c.id === grupo.id)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Solo si lo elegido no alcanza para los grandes ──
                     No es un reproche ni un cobro sorpresa: es la última pieza
                     para que ellos también tengan qué hacer. Aparece recién
                     aquí, después de que recorrió todo el catálogo. ── */}
                {hayMayores && faltaMayores && !mayoresResuelto.cumple && (
                  <div ref={faltaMayoresRef} className="rounded-2xl p-5 mt-8 scroll-mt-24"
                    style={{ background: 'linear-gradient(135deg,#FFF8EE,#FFF3E0)', border: '2px solid #F97316' }}>
                    <p className="font-black text-lg" style={{ color: '#9A3412' }}>
                      🎉 Falta la entretención para los grandes
                    </p>
                    <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#B45309' }}>
                      Los juegos del jardín están hechos para los más chicos, así que
                      los {labelMayores(estado)} niños mayores necesitan lo suyo. Elige
                      una alternativa y seguimos.
                    </p>

                    {mayoresResuelto.faltantes.map((bloque) => (
                      <div key={bloque.id} className="mt-5">
                        <p className="font-black text-sm mb-2" style={{ color: '#9A3412' }}>
                          {bloque.titulo}
                        </p>
                        {bloque.opciones.map((op) => {
                          const cat = CATEGORIAS_PACK[op.pide[0].categoria];
                          const disponibles = opcionesPack(op.pide[0].categoria, ctx);
                          return (
                            <div key={op.id} className="mb-3">
                              <p className="text-xs font-bold mb-1.5" style={{ color: '#B45309' }}>
                                {cat?.emoji} {op.label}
                                {op.pide[0].faltan < op.pide[0].cantidad
                                  ? ` · te falta${op.pide[0].faltan > 1 ? 'n' : ''} ${op.pide[0].faltan}`
                                  : ''}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {disponibles.map((item) => {
                                  const puesto = estado.extras.some((e) => e.id === item.id);
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => toggleItemModal(item, grupoDeItem(item.id))}
                                      className="px-3 py-2 rounded-xl text-xs font-bold transition-all text-left"
                                      style={puesto
                                        ? { background: '#F97316', color: 'white', border: '2px solid #F97316' }
                                        : { background: 'white', color: '#9A3412', border: '2px solid rgba(249,115,22,0.35)' }}
                                    >
                                      {puesto ? '✓ ' : '+ '}{item.emoji} {item.nombre}
                                      <span className="block font-black">
                                        {clp(getPrecio(item, estado.cantNinos))}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* Decoración temática seleccionada sin temática: campo
                    obligatorio antes de poder avanzar (documento
                    "FASE 2B — IMPLEMENTAR BLOQUE 1", 21-sep-2026, §7). */}
                {tieneDecoTematica && (
                  <div ref={faltaTematicaRef} className="rounded-2xl p-5 mt-6" style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                    <label className="block text-sm font-black mb-2" style={{ color: '#9A3412' }}>
                      ¿Qué temática quieres para la celebración?
                    </label>
                    <input
                      type="text"
                      value={estado.tematica}
                      onChange={(e) => setEstado((p) => ({ ...p, tematica: e.target.value }))}
                      placeholder="Ej.: Minnie, dinosaurios, fútbol, princesas, Stitch..."
                      className="w-full px-4 py-3 rounded-xl text-sm"
                      style={{ border: faltaTematica ? '1.5px solid #EA580C' : '1.5px solid #FED7AA' }}
                    />
                    <p className="text-xs mt-2" style={{ color: '#9A3412' }}>
                      La temática está sujeta a disponibilidad de materiales y proveedores. Algunas
                      temáticas muy específicas pueden requerir hasta 3 semanas de anticipación. Si
                      necesitamos proponerte una alternativa, te contactaremos.
                    </p>
                  </div>
                )}

                {/* Sin CTA de reserva acá: la solicitud vive solo en Revisa (§AX) */}
                <div className="flex gap-3 mt-8 mb-4">
                  <button onClick={retroceder}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button
                    disabled={faltaTematica}
                    onClick={() => {
                      if (faltaTematica) {
                        setTimeout(() => faltaTematicaRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }), 0);
                        return;
                      }
                      // Recién aquí se comprueba si lo elegido entretiene a los
                      // grandes. Si alcanza —lo habitual cuando el papá ya
                      // recorrió el catálogo— no se entera de que había regla.
                      if (hayMayores && !mayoresResuelto.cumple) {
                        setFaltaMayores(true);
                        track(EVENTOS.olderPackStarted, { mayores: estado.tramoMayores, tramo: estado.tramoInvitados });
                        setTimeout(() => faltaMayoresRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }), 60);
                        return;
                      }
                      if (hayMayores) track(EVENTOS.olderPackCompleted, propsCelebracion(estado, ctx));
                      track(EVENTOS.reviewReached, propsCelebracion(estado, ctx, { total }));
                      irAPaso(4);
                    }}
                    className="flex-1 text-white font-black py-4 rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                    style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)', boxShadow: '0 4px 16px rgba(21,101,192,0.3)' }}
                  >
                    Revisar mi celebración →
                  </button>
                </div>
              </div>
            )}

            {/* ─── PASO 4: REVISA ─────────────────────────────────────────
                 La única pantalla con CTA de reserva. Todo editable, nada
                 que el papá tenga que recordar de memoria. ── */}
            {paso === 4 && (
              <div>
                <h2 className="text-2xl md:text-3xl font-black mb-1" style={{ color: '#1565C0' }}>
                  Revisa tu celebración 🎉
                </h2>
                <p className="text-gray-500 mb-6">Si algo no calza, edítalo aquí mismo. No pierdes nada de lo avanzado.</p>

                {[
                  {
                    titulo: 'Fecha y horario', paso: 0, emoji: '📅',
                    filas: [
                      ['Día', estado.fecha ? estado.fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'],
                      ['Horario', horario?.textoLargo || '—'],
                      ...(estado.horasAdicionales > 0
                        ? [[`Hora${estado.horasAdicionales > 1 ? 's' : ''} adicional${estado.horasAdicionales > 1 ? 'es' : ''}`, clp(horario.precioAdicional)]]
                        : []),
                    ],
                  },
                  {
                    titulo: 'Festejado', paso: 1, emoji: '🎂',
                    filas: [
                      ['Nombre', estado.nombreNino || '—'],
                      ['Cumple', estado.edadNino ? `${estado.edadNino} años` : '—'],
                      ...(estado.festejados > 1 ? [['Cumpleaños compartido', `${estado.festejados} festejados`]] : []),
                    ],
                  },
                  {
                    titulo: 'Invitados', paso: 2, emoji: '👨‍👩‍👧‍👦',
                    filas: [
                      ['Niños', labelInvitados(estado) || '—'],
                      ['Mayores de 6', labelMayores(estado) || '—'],
                      ['Sector', estado.sector === 'independiente' ? 'Sector Independiente' : 'Recinto Completo'],
                    ],
                  },
                  {
                    titulo: 'Personalización', paso: 3, emoji: '✨',
                    filas: [
                      ...(datosDelPack
                        ? [[datosDelPack.pack.nombre, datosDelPack.items.map((i) => i.nombre).join(' · ') || '—']]
                        : []),
                      ...(estado.packCelebra ? [['Pack Celebra Sin Cesar', clp(PRECIOS_EXTRAS.pack_celebra)]] : []),
                      ...estado.extras.filter((e) => !e.gratis).map((e) => [e.nombre, clp(getPrecio(e, estado.cantNinos))]),
                      ...(preparados.length ? [['Dejamos preparado', preparados.map((e) => e.nombre).join(' · ')]] : []),
                      ...estado.cotizar.map((c) => [c.nombre, 'Lo consultamos']),
      ...(tieneDecoTematica && estado.tematica.trim() ? [['Temática', estado.tematica.trim()]] : []),

                      ...(estado.extras.length === 0 && !estado.packCelebra && !datosDelPack
                        ? [['Sin adicionales', 'Tu celebración va con todo lo incluido']] : []),
                    ],
                  },
                ].map((bloque) => (
                  <div key={bloque.titulo} className="rounded-2xl border-2 p-5 mb-4" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="font-black text-gray-700">{bloque.emoji} {bloque.titulo}</p>
                      <button
                        onClick={() => irAPaso(bloque.paso)}
                        className="text-xs font-black px-3 py-1.5 rounded-xl transition-all hover:scale-105"
                        style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}
                      >
                        Editar
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {bloque.filas.map(([k, v], i) => (
                        <div key={k + i} className="flex justify-between items-baseline gap-3 text-sm">
                          <span className="text-gray-500 flex-shrink-0">{k}</span>
                          <span className="font-bold text-gray-700 text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Código de descuento — última oportunidad antes de solicitar */}
                <CodigoDescuento
                  codigoAplicado={estado.codigo}
                  promo={promo}
                  descuento={descuento}
                  onAplicar={(c) => set('codigo', c)}
                />

                {/* ── Resumen económico ──────────────────────────────────── */}
                <div className="rounded-3xl p-6 mt-6"
                  style={{ background: 'linear-gradient(160deg, #060F2E 0%, #0D1B3E 60%, #081529 100%)' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-black text-sm uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {hayValorReferencial ? 'Valor estimado' : 'Valor total'}
                    </span>
                    <span className="font-black text-3xl" style={{ color: '#F97316' }}>{clp(total)}</span>
                  </div>
                  {hayValorReferencial && (
                    <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Incluye el valor referencial de la entretención para los mayores. Lo confirmamos contigo al reservar.
                    </p>
                  )}

                  <div className="mt-5 pt-4 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold" style={{ color: '#4ade80' }}>Anticipo para confirmar tu reserva (50%)</span>
                      <span className="font-black text-white">{clp(anticipo)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Saldo restante · hasta 48 horas antes</span>
                      <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{clp(total - anticipo)}</span>
                    </div>
                  </div>

                  {/* Con pagos habilitados, pagar el anticipo es el camino
                      principal: retiene la fecha al instante en vez de
                      esperar a que César confirme por WhatsApp. Quien
                      prefiera coordinar a mano sigue pudiendo — el botón
                      de WhatsApp no desaparece, solo pasa a segundo
                      plano. */}
                  {pagosHabilitados ? (
                    <>
                      <button onClick={() => { track(EVENTOS.whatsappRequestClicked, propsCelebracion(estado, ctx, { total, estimado: hayValorReferencial, canal: 'pago_web' })); setModalPagoAbierto(true); }}
                        className="w-full mt-6 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: `linear-gradient(135deg,${'#1565C0'},#1976D2)`, boxShadow: '0 4px 20px rgba(21,101,192,0.35)' }}>
                        💳 Reservar y pagar el anticipo
                      </button>
                      <button onClick={generarWhatsApp}
                        className="w-full mt-3 text-sm font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-all"
                        style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.18)' }}>
                        <WaIcon /> Prefiero coordinar por WhatsApp
                      </button>
                      <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Al pagar el anticipo tu fecha queda reservada al instante. El saldo se paga {NEGOCIO.saldoVence}.
                      </p>
                    </>
                  ) : (
                    <>
                      <button onClick={generarWhatsApp}
                        className="w-full mt-6 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 20px rgba(34,197,94,0.35)' }}>
                        <WaIcon /> Solicitar reserva por WhatsApp
                      </button>
                      <p className="text-xs mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        La fecha queda reservada una vez que confirmemos disponibilidad y recibamos el anticipo del 50%.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-3 mt-5">
                  <button onClick={retroceder}
                    className="px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ← Volver
                  </button>
                  <button onClick={() => irAPaso(3)}
                    className="flex-1 py-4 rounded-2xl font-bold transition-all hover:scale-[1.01]"
                    style={{ border: '2px solid #E5E7EB', color: '#6B7280', background: 'white' }}>
                    ✏️ Seguir personalizando
                  </button>
                </div>
              </div>
            )}


            {/* ── Una sola salida humana, discreta: tres botones de rescate
                 compiten con el CTA que sí cierra la venta (§P1-28) ── */}
            <div className="mt-10 pt-6 text-center" style={{ borderTop: '1px solid rgba(21,101,192,0.1)' }}>
              <a
                href={`https://wa.me/56944356955?text=${encodeURIComponent('¡Hola César! Estoy armando mi celebración en la web y me gustaría que me asesores 😊')}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline"
                style={{ color: '#6B7280' }}
              >
                ¿Necesitas ayuda? César te asesora por WhatsApp →
              </a>
            </div>
          </div>

          {/* ─── SIDEBAR RESUMEN ───
               No aparece antes de Personaliza: mientras el papá cuenta su
               celebración no queremos un contador de plata al lado. */}
          <div className="hidden lg:block">
            {/* El CTA de reserva solo existe en Revisa (paso 4): en el resto
                el resumen informa, no empuja (§AB, §AX). */}
            {paso >= 3 && (
            <ResumenLateral estado={estado} total={total}
              onWhatsApp={paso === 4 && !pagosHabilitados ? generarWhatsApp : null}
              onModificar={paso !== 2 ? () => irAPaso(2) : null} descuento={descuento} />
            )}
          </div>
        </div>
      </div>

      {/* Modal carrusel del grupo seleccionado */}
      {modalPagoAbierto && (
        <ModalPago
          estado={estado}
          onCerrar={() => setModalPagoAbierto(false)}
          onIrWhatsApp={() => { setModalPagoAbierto(false); generarWhatsApp(); }}
          onContinuar={(cliente) => { setModalPagoAbierto(false); setClienteContacto(cliente); }}
        />
      )}

      {clienteContacto && (
        <ConfirmarReserva
          estado={estado}
          total={total}
          anticipo={anticipo}
          cliente={clienteContacto}
          onCerrar={() => setClienteContacto(null)}
          onIrWhatsApp={() => { setClienteContacto(null); generarWhatsApp(); }}
        />
      )}

      {grupoAbierto && (
        <ModalCarrusel
          grupo={grupoAbierto}
          extras={estado.extras}
          cantNinos={estado.cantNinos}
          onToggle={toggleItemModal}
          onCerrar={retroceder}
        />
      )}

      {/* FichaCarrusel paso 4 — misma lógica que /catalogo pero con botón Agregar */}
      {grupoFicha && (
        <FichaCarrusel
          grupo={grupoFicha}
          onCerrar={retroceder}
          onAdd={(item, grupo) => toggleItemModal(item, grupo)}
          isAdded={(item) => estado.extras.some(e => e.id === item.id)}
          cantNinos={estado.cantNinos || 'hasta10'}
          ownHistory={false}
        />
      )}

      {/* ── Barra inferior móvil (solo en Personaliza) ──────────────────
           Ni contador de seleccionados, ni círculo naranja, ni CTA verde de
           reserva: eso convertía el armador en un taxímetro. Solo el valor
           acumulado y la puerta al detalle. En Revisa desaparece, porque
           ahí el CTA vive en la propia página (§AA, §AX). ── */}
      {total > 0 && !sheetAbierto && paso === 3 && (
        <button
          onClick={() => { track(EVENTOS.summaryOpened, { paso }); avanzar({ sheet: true }); }}
          className="fixed bottom-0 left-0 right-0 px-5 py-3.5 flex items-center justify-between lg:hidden z-50 text-left"
          style={{
            background: 'linear-gradient(135deg, #060F2E 0%, #0D1B3E 100%)',
            borderTop: '1px solid rgba(41,185,232,0.2)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          }}
          aria-label="Ver el detalle de tu celebración"
        >
          <div>
            <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {hayValorReferencial ? 'Valor estimado hasta ahora' : 'Valor hasta ahora'}
            </div>
            <div className="font-black text-2xl leading-tight" style={{ color: '#F97316' }}>
              {clp(total)}
            </div>
          </div>
          <span className="text-sm font-black flex-shrink-0" style={{ color: '#29B9E8' }}>
            Ver detalle ↑
          </span>
        </button>
      )}

      {/* Bottom sheet móvil — resumen completo */}
      {sheetAbierto && (
        <BottomSheetResumen
          estado={estado}
          total={total}
          onCerrar={retroceder}
          onQuitarExtra={quitarExtra}
          onModificar={() => { retroceder(); irAPaso(2); }}
          onWhatsApp={paso === 4 && !pagosHabilitados ? generarWhatsApp : null}
          descuento={descuento}
        />
      )}

      {/* ── Lo que traía del catálogo (§AT) ──────────────────────────────
           Nunca se pierde la intención: lo compatible se agrega solo, y lo
           que no corresponde se explica con alternativas de la misma
           categoría. El papá cierra cuando quiera. ── */}
      {avisoPendientes && (
        <div className="fixed inset-x-0 bottom-0 z-[130] p-4 lg:inset-auto lg:bottom-6 lg:right-6 lg:max-w-sm">
          <div className="rounded-3xl p-5 shadow-2xl"
            style={{ background: 'white', border: '2px solid rgba(21,101,192,0.25)', boxShadow: '0 12px 48px rgba(6,15,46,0.25)' }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-black" style={{ color: '#1565C0' }}>Lo que traías del catálogo</p>
              <button onClick={() => setAvisoPendientes(null)} aria-label="Cerrar aviso"
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {avisoPendientes.agregados.length > 0 && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Ya está en tu celebración:{' '}
                  <span className="font-bold text-gray-800">
                    {avisoPendientes.agregados.map((i) => i.nombre).join(' · ')}
                  </span>
                </p>
              </div>
            )}

            {avisoPendientes.rechazados.map(({ item, motivo, alternativas }) => (
              <div key={item.id} className="rounded-2xl p-3.5 mb-2"
                style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#9A3412' }}>
                  <span className="font-black">{item.nombre}</span> no quedó agregado: {motivo}.
                </p>
                {alternativas.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs font-bold mb-1.5" style={{ color: '#B45309' }}>
                      Para esta celebración te recomendamos estas alternativas:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {alternativas.map((alt) => (
                        <button key={alt.id}
                          onClick={() => {
                            toggleItemModal(alt, grupoDeItem(alt.id));
                            setAvisoPendientes((p) => p && {
                              ...p,
                              rechazados: p.rechazados.filter((r) => r.item.id !== item.id),
                              agregados: [...p.agregados, alt],
                            });
                          }}
                          className="text-xs font-black px-3 py-1.5 rounded-xl text-white transition-transform active:scale-95"
                          style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>
                          + {alt.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button onClick={() => { setAvisoPendientes(null); irAPaso(3); }}
              className="w-full mt-2 py-2.5 rounded-2xl font-bold text-sm"
              style={{ background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
              Ver todos los adicionales →
            </button>
          </div>
        </div>
      )}

      {/* Toast — celebración retomada desde donde quedó (persistencia) */}
      {retomado && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] px-5 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 whitespace-nowrap"
          style={{
            background: 'rgba(6,15,46,0.96)',
            border: '1px solid rgba(41,185,232,0.4)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ✨ Retomamos tu celebración donde la dejaste
        </div>
      )}

      {/* Toast — un adicional dejó de corresponder tras cambiar la configuración */}
      {avisoFiltro && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[96] px-5 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 max-w-[92vw] text-center"
          style={{
            background: 'rgba(6,15,46,0.96)',
            border: '1px solid rgba(249,115,22,0.45)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⚠️ {avisoFiltro}
        </div>
      )}
    </>
  );
}
