// ─────────────────────────────────────────────────────────────────────────
// PROPUESTA DE NUEVA VERSIÓN CONTRACTUAL — BORRADOR, NO ACTIVADO
// ─────────────────────────────────────────────────────────────────────────
// Documento "Continúa desde tu última entrega...", 21-sep-2026, §17.
//
// Este archivo NO es la fuente que usa el sitio en vivo (esa sigue siendo
// app/terminos/page.js, intacta — 2026-09-v2 no se toca). Es el borrador
// de la PRÓXIMA versión, para que:
//   1. se pueda revisar como diff completo contra 2026-09-v2;
//   2. se pueda calcular su contenido_sha256 y su PDF de verdad, probando
//      que el pipeline determinístico funciona también para el contenido
//      nuevo — sin insertar nada en tyc_version ni tocar
//      data/master.js#TYC_VERSION (eso sería "activarla", explícitamente
//      no autorizado todavía).
//
// Identificador propuesto: '2026-09-v3' si se publica en septiembre de
// 2026, o '2026-10' si se publica en octubre (documento §16) — a decidir
// al momento real de publicar, no ahora.
//
// Cambios respecto de 2026-09-v2 (resumen — el diff detallado línea por
// línea va en el informe de esta ronda, no acá):
//   · NUEVA sección 11 — Derecho a retracto (texto fusionado, aprobado
//     literal por César el 21-sep-2026 — no se modificó ni una palabra).
//     Esto corre en +1 la numeración de todo lo que sigue (11→12, 12→13...).
//   · Sección 3 (Aceptación): ya no describe un "formulario de
//     confirmación" como mecanismo formal de ratificación — la aceptación
//     ocurre electrónicamente en el checkout, antes del pago; la
//     coordinación posterior por WhatsApp se describe expresamente como
//     operacional, nunca como una segunda aceptación contractual.
//   · Sección 4 (Edades): reescritura MATERIAL de la última viñeta, no un
//     agregado cosmético (documento "La propuesta queda aprobada EN SU
//     ARQUITECTURA...", 21-sep-2026, §4): el "uso contrario al diseño" y
//     sus consecuencias solo se atribuyen al adulto responsable CUANDO le
//     sea imputable — ya no de forma automática — y se agrega la misma
//     salvaguarda explícita que §6 (Alce Kids no queda liberada de su
//     propia responsabilidad cuando el hecho le sea imputable a ella, ni
//     se afectan derechos irrenunciables), en vez de una frase genérica
//     pegada al final.
//   · Sección 5 (Supervisión): se retira la referencia al "formulario de
//     confirmación" — la designación del adulto responsable se describe
//     como parte de la coordinación de la celebración.
//   · Sección 6 (Uso del espacio): la exoneración absoluta ("eximiendo a
//     Alce Kids de toda consecuencia legal o económica") se matiza según
//     el mismo modelo aplicado ahora también a §4: responde quien haga
//     mal uso, sin que eso excluya la responsabilidad propia de Alce Kids
//     cuando el incumplimiento le sea imputable, ni los derechos
//     irrenunciables de la Ley 19.496. Grep de auditoría (§5 del mismo
//     documento) confirmó que no existe ninguna otra cláusula con
//     "toda responsabilidad"/"toda consecuencia"/"en ningún caso"/
//     "bajo ninguna circunstancia"/"exime(iendo)" en el documento.
//   · Sección 10 (Pago): se retiró la referencia a "la exclusión del
//     derecho a retracto" como si fuera una excepción de reembolso del
//     anticipo (podía leerse como si el retracto fuera un caso más de
//     devolución, en vez de un derecho excluido aparte) — se reemplazó
//     por una oración de cierre neutral que separa los tres regímenes
//     (cancelación, retracto, fuerza mayor) sin mezclarlos.
//   · Sección 12 (antes 11, Cancelación): la oración inicial ya no dice
//     "independiente y adicional al derecho legal de retracto" (podía
//     leerse como si existiera un retracto ejercitable en paralelo a su
//     exclusión) — dice "distinta e independiente de la regulación del
//     derecho a retracto y de su exclusión informada en la sección 11".
//   · Sección 19 (antes 18, Privacidad e imagen): se reemplaza por una
//     referencia breve a la Política de Privacidad (celebrasincesar.cl/
//     privacidad), que pasa a concentrar todo el tratamiento sustantivo
//     de datos, imágenes y cámaras — evita duplicar bloques grandes en
//     los dos documentos.
//   · Sección 20 (antes 19, Recinto y cámaras): se conserva el párrafo de
//     acceso (no es un tema de privacidad), y el párrafo de cámaras se
//     reemplaza por una referencia breve a /privacidad.
//   · El resto de las secciones (1, 2, 7, 8, 9, 13-18, 21, 22) se
//     mantienen exactamente iguales a 2026-09-v2 — ni una palabra tocada.
// ─────────────────────────────────────────────────────────────────────────

export const SECCIONES_PROPUESTA_2026_09_V3 = [
  {
    numero: 1, titulo: 'Identificación del prestador',
    lineas: [
      'Razón social: CELEBRA SIN CESAR SpA',
      'RUT: 78.408.845-6',
      'Nombre de fantasía: Alce Kids · Celebra Sin Cesar',
      'Domicilio: Talavera de la Reina 380, Las Condes, Región Metropolitana, Chile',
      'Sitio web: celebrasincesar.cl',
      'Contacto: +56 9 4435 6955 — disponible viernes, sábado y domingo',
    ],
  },
  {
    numero: 2, titulo: 'Objeto del contrato',
    lineas: [
      'El presente instrumento regula el arrendamiento temporal y exclusivo del espacio de celebraciones infantiles Alce Kids, que incluye todas sus instalaciones, áreas de juego y servicios complementarios contratados, para la realización de una celebración de cumpleaños u evento infantil privado en la fecha y horario acordados.',
      'El arrendamiento confiere al contratante el uso exclusivo del recinto durante el bloque horario reservado. No constituye cesión de derechos sobre el inmueble ni sobre ningún elemento de la infraestructura.',
      'El arriendo incluye: uso del patio, juegos, salón principal y baños; microondas y hervidor disponibles en todo momento; sistema de calefacción y aire acondicionado; y servicio de limpieza post-evento. El uso de la cocina para preparaciones extras debe coordinarse con anticipación al momento de reservar.',
    ],
  },
  {
    numero: 3, titulo: 'Aceptación de los términos',
    lineas: [
      'Los presentes Términos y Condiciones, junto con el aviso de exclusión del derecho a retracto (sección 11), se entienden aceptados electrónicamente al completar el proceso de pago del anticipo a través del sitio web, mediante la aceptación expresa que el propio sistema de reserva exige antes de continuar al pago. Desde ese momento el contratante se compromete a cumplir y hacer cumplir a todos sus invitados el presente reglamento.',
      'Con posterioridad a la reserva, Alce Kids coordina con el contratante, habitualmente por WhatsApp, los detalles operacionales de la celebración — cantidad final de asistentes, información relevante para la seguridad de los niños y el adulto responsable presente el día del evento. Esta coordinación es de carácter operacional: no constituye una nueva aceptación contractual ni sustituye la aceptación electrónica ya prestada conforme al párrafo anterior.',
    ],
  },
  {
    numero: 4, titulo: 'Edades y público objetivo',
    lineas: [
      'Alce Kids está diseñado con cariño para niños y niñas de 0 a 6 años. Todas las instalaciones — dimensiones, materiales, alturas y medidas de seguridad — han sido pensadas para este grupo etario.',
      '- Los niños mayores de 6 años son muy bienvenidos como acompañantes. Como los juegos e infraestructura del jardín (piscina de pelotas, tobogán, estructuras, columpios y similares) están dimensionados para niños de 0 a 6 años, por su seguridad y la de los más pequeños se reservan para ese grupo de edad y no son aptos para los mayores.',
      '- Para que los mayores de 6 años también lo pasen genial, contamos con servicios adicionales pensados para su edad — inflables según la edad recomendada de cada modelo, juegos deportivos, animación y la sala de videojuegos +7 — disponibles en el catálogo de adicionales.',
      '- Velar por el cumplimiento de esta regla corresponde al contratante y al adulto a cargo de cada menor, quienes asumen el deber de impedir de manera activa que los niños mayores de 6 años accedan a la infraestructura del jardín. El anfitrión de Alce Kids no ejerce función de vigilancia individual (sección 5). Cuando el uso de la infraestructura del jardín por un niño mayor de 6 años sea imputable al contratante o al adulto a cargo, dicho uso constituye uso contrario al diseño para los efectos de la sección 17, y las consecuencias que de él deriven serán de cargo de ese adulto responsable. Lo anterior no exime a Alce Kids de su propia responsabilidad cuando el hecho sea consecuencia de un incumplimiento que le sea imputable a Alce Kids, ni afecta los derechos irrenunciables que la Ley N.º 19.496 reconoce a los consumidores.',
      '- Los adultos acompañantes no tienen costo adicional, dentro de la capacidad máxima autorizada del recinto. Les pedimos que los juegos y estructuras se reserven para los niños, salvo cuando sea necesario asistir a un menor.',
      '- Alce Kids puede solicitar el retiro de cualquier persona cuya presencia resulte incompatible con la seguridad del evento.',
    ],
  },
  {
    numero: 5, titulo: 'Supervisión y responsabilidad parental',
    lineas: [
      'Durante toda la celebración habrá un anfitrión de Alce Kids presente en el recinto, encargado de orientar a los asistentes y velar por el uso adecuado del espacio. Con todo, la supervisión permanente e individual de los menores es responsabilidad de sus padres, tutores o adultos acompañantes. Alce Kids no presta servicio de guardería ni cuenta con personal de vigilancia individual de niños.',
      '- Cada adulto acompañante asume la responsabilidad directa de los menores a su cargo durante toda su permanencia en el recinto.',
      '- Al coordinar los detalles de la celebración, el contratante designa a un adulto responsable del evento (que puede ser él mismo), quien deberá permanecer en el recinto durante toda la celebración. El contratante se obliga, además, a que cada menor asista acompañado de su padre, madre, tutor o de un adulto expresamente encargado por éstos.',
      '- El contratante responde solidariamente por el comportamiento de todos sus invitados, tanto adultos como menores.',
      '- En caso de emergencia médica, el personal de Alce Kids prestará primeros auxilios básicos y contactará a los servicios de emergencia. Si la urgencia lo exige y no es posible ubicar de inmediato al padre, madre o tutor, el contratante autoriza al personal a gestionar el traslado del menor a un centro asistencial. La responsabilidad sobre la salud del menor recae en sus padres o tutores.',
    ],
  },
  {
    numero: 6, titulo: 'Uso del espacio e instalaciones',
    lineas: [
      'Cada área del recinto fue diseñada pensando en la seguridad de los más pequeños. Para cuidar a todos los participantes, te pedimos tener en cuenta lo siguiente:',
      '- Piscina de pelotas: exclusiva para menores de hasta 6 años. Por favor no ingreses calzado, objetos con bordes ni alimentos o bebidas. Los adultos pueden ingresar solo para asistir a un menor.',
      '- Tobogán y estructuras de juego: un niño a la vez. Pedimos no empujarse ni usar las estructuras de forma contraria a su diseño.',
      '- Granja de animales: los niños deben ir siempre acompañados de un adulto. No alimentes a los animales con productos externos. El contacto físico se realiza bajo supervisión del personal.',
      '- Áreas de libre juego: te pedimos evitar situaciones de riesgo como carreras o juegos bruscos entre niños de distintas edades.',
      'Los vehículos deben estacionarse únicamente en las zonas habilitadas para ello. Por favor evita estacionar sobre el pasto, zonas verdes o accesos del recinto.',
      'El uso indebido de las instalaciones que derive en daños o lesiones será responsabilidad de quien lo provoque. Lo anterior no exime a Alce Kids de su propia responsabilidad cuando el daño sea consecuencia de un incumplimiento que le sea imputable, ni afecta los derechos irrenunciables que la Ley N.º 19.496 reconoce a los consumidores.',
    ],
  },
  {
    numero: 7, titulo: 'Servicios adicionales y extras',
    lineas: [
      'Alce Kids ofrece un catálogo de servicios adicionales opcionales — decoración, animación, banquetería y entretención — que pueden contratarse al momento de reservar o hasta 5 días antes del evento, sujeto a disponibilidad.',
      'Los extras confirmados y pagados se consideran parte del contrato y quedan sujetos a la misma política de cancelación del arriendo. Extras no confirmados dentro del plazo no podrán garantizarse para la fecha del evento.',
    ],
  },
  {
    numero: 8, titulo: 'Capacidad y aforo',
    lineas: [
      'Cada bloque horario admite un número máximo de personas determinado por la modalidad contratada. Respetar el aforo es fundamental para garantizar la seguridad y comodidad de todos los asistentes. En caso de superarse el límite acordado, Alce Kids podrá solicitar que se regule el ingreso, sin que ello genere derecho a compensación para el contratante.',
    ],
  },
  {
    numero: 9, titulo: 'Horarios y puntualidad',
    lineas: [
      'Los bloques horarios base son: AM 11:00–14:00 y PM 15:00–18:00. El tiempo de uso del recinto corresponde al horario contratado, incluyendo las horas adicionales que se hayan sumado al reservar.',
      '- El bloque AM puede extenderse hacia atrás hasta 1 hora (10:00–14:00), con un cargo de $50.000. El bloque PM puede extenderse hacia adelante hasta 2 horas (15:00–19:00 por $50.000, o 15:00–20:00 por $100.000). Las horas adicionales se contratan al elegir el horario, junto con el resto de la celebración.',
      '- Puedes iniciar la preparación del espacio hasta 30 minutos antes del comienzo del bloque, previa coordinación con el equipo.',
      '- Si la celebración comienza tarde por parte del contratante, el tiempo no se extiende ni se compensa económicamente.',
      '- La permanencia en el recinto más allá del horario contratado (incluidas las horas adicionales, si se contrataron) generará un cargo adicional de $15.000 CLP por cada 15 minutos de exceso o fracción.',
    ],
  },
  {
    numero: 10, titulo: 'Condiciones de pago y reserva',
    lineas: [
      'La reserva se confirma con el pago de un anticipo del 50 % del valor total acordado. El saldo restante debe cancelarse con un mínimo de 48 horas de anticipación a la fecha del evento.',
      '- El precio que ves y aceptas al armar tu celebración es el precio final de tu reserva: queda fijado en ese momento y no cambia después, aunque los precios publicados en el sitio se actualicen más adelante.',
      '- El anticipo no es reembolsable, salvo en los casos contemplados en la cláusula de fuerza mayor (sección 21).',
      '- El no pago del saldo antes del plazo establecido faculta a Alce Kids a liberar la fecha reservada, sin derecho a devolución del anticipo.',
      'Los pagos, devoluciones, cancelaciones y reprogramaciones se rigen por las disposiciones aplicables de estos Términos y Condiciones, incluidas la política de cancelación y reprogramación (sección 12), la regulación del derecho a retracto (sección 11) y las disposiciones sobre fuerza mayor (sección 21).',
    ],
  },
  {
    numero: 11, titulo: 'Derecho a retracto',
    lineas: [
      'De conformidad con el artículo 3° bis de la Ley N.º 19.496 y el Decreto N.º 52 de 2024, CELEBRA SIN CESAR SpA, bajo su marca Alce Kids, informa de manera previa, clara, inequívoca, destacada y fácilmente accesible que ha dispuesto expresamente la exclusión del derecho a retracto respecto de los servicios de celebración infantil contratados a través de este sitio web.',
      'Esta exclusión se informa al contratante antes de la aceptación del contrato y del pago, dentro del mismo proceso en que se presentan las características esenciales y el precio del servicio.',
      'La celebración contratada se encuentra asociada a una fecha y bloque horario determinados que, una vez reservados, dejan de estar disponibles para otros clientes. Esta circunstancia forma parte de las características comerciales del servicio reservado.',
      'La exclusión del derecho a retracto es distinta e independiente de la política comercial de cancelación y reprogramación de Alce Kids, que se aplica conforme a sus propias condiciones.',
      'Lo anterior no limita, restringe ni sustituye los derechos irrenunciables que la Ley N.º 19.496 y demás normativa aplicable reconocen a los consumidores, incluidos aquellos que correspondan frente a un incumplimiento imputable a CELEBRA SIN CESAR SpA.',
    ],
  },
  {
    numero: 12, titulo: 'Cancelación y reagendamiento',
    lineas: [
      'Esta es una política comercial de Alce Kids, distinta e independiente de la regulación del derecho a retracto y de su exclusión informada en la sección 11.',
      '- Cancelación con 7 o más días de anticipación: el anticipo se aplica íntegramente como crédito para una nueva fecha dentro de los 3 meses siguientes, sujeto a disponibilidad.',
      '- Cancelación con menos de 7 días de anticipación: el anticipo no es reembolsable ni canjeable.',
      '- Cambio de fecha: se permite una modificación con un mínimo de 7 días de anticipación, sujeto a disponibilidad.',
      'Entendemos que los imprevistos ocurren. Ante cualquier situación excepcional, siempre estamos disponibles para conversar y buscar la mejor solución para ambas partes.',
    ],
  },
  {
    numero: 13, titulo: 'Lo que pedimos no ingresar',
    lineas: [
      'Para proteger a los niños y mantener el espacio en las mejores condiciones, te pedimos no ingresar los siguientes elementos:',
      '- Bebidas alcohólicas o cualquier sustancia psicoactiva',
      '- Fuegos artificiales, pirotecnia o velas de gran formato',
      '- Artículos de vidrio (botellas, fuentes, copas, etc.)',
      '- Animales propios de los invitados',
      '- Confeti, papel picado, challa y serpentinas',
      '- Equipos de sonido externos de alto volumen',
      '- Cualquier elemento que a criterio del personal de Alce Kids represente un riesgo para la seguridad de los asistentes o un daño a las instalaciones',
      'Si hay algún artículo que no estás seguro de poder traer, consúltanos antes — con gusto te orientamos. Ante incumplimientos graves, Alce Kids podrá solicitar retirar el artículo o, en casos extremos, dar por terminado el evento sin reembolso.',
    ],
  },
  {
    numero: 14, titulo: 'Alimentos y bebidas',
    lineas: [
      'Puedes traer libremente alimentos y bebidas para la celebración, respetando estas condiciones:',
      '- La torta de cumpleaños, bocadillos y bebidas sin alcohol están expresamente permitidos — ¡son parte de la fiesta!',
      '- No está permitido el ingreso de bebidas alcohólicas de ningún tipo.',
      '- Los alimentos solo pueden consumirse en el área de mesas. Por favor no los lleves a las zonas de juego.',
      '- Si contratas catering externo, avísanos con anticipación para coordinar el ingreso.',
      '- Alce Kids no se hace responsable por alergias, intoxicaciones u otras afecciones relacionadas con alimentos ingresados por los asistentes.',
    ],
  },
  {
    numero: 15, titulo: 'Decoración y montaje',
    lineas: [
      'Puedes ingresar toda la decoración temática que quieras. Te pedimos seguir estas indicaciones para cuidar el espacio:',
      '- Para fijar decoraciones, por favor usa únicamente cinta de papel removible (masking tape). Evita cualquier elemento que pueda perforar o dañar las superficies del recinto.',
      '- El confeti, papel picado, challa y serpentinas no están permitidos en ningún área. Los globos de látex y elementos pequeños pueden usarse bajo supervisión directa de un adulto.',
      '- Las velas solo están permitidas sobre el pastel de cumpleaños y deben apagarse de inmediato tras el momento de soplar.',
      '- El montaje debe quedar listo dentro del tiempo de preparación autorizado y el desmontaje, antes del término del bloque contratado.',
    ],
  },
  {
    numero: 16, titulo: 'Daños a las instalaciones',
    lineas: [
      'El contratante es responsable de los daños que se produzcan en el recinto, su mobiliario, equipos y elementos decorativos durante el tiempo de uso.',
      '- Los daños constatados serán valorados por el equipo de Alce Kids y comunicados al contratante dentro de las 48 horas siguientes a la celebración.',
      '- Los daños a estructuras de juego provocados por uso indebido serán de cargo del contratante o de la familia del menor responsable, según corresponda.',
      '- El saldo de la reserva se paga siempre antes del evento (sección 10), por lo que no queda saldo pendiente que retener al término de la celebración. Ante daños constatados, Alce Kids notificará al contratante dentro del plazo indicado arriba y podrá cobrar el valor correspondiente de forma independiente al pago de la reserva.',
    ],
  },
  {
    numero: 17, titulo: 'Responsabilidad y seguridad',
    lineas: [
      'Alce Kids ha diseñado sus instalaciones con estándares de seguridad apropiados para la primera infancia: dimensiones, alturas, materiales y superficies pensados para niños de 0 a 6 años. Las estructuras de juego son objeto de revisión e inspección periódica, de la cual se mantiene registro. El recinto cuenta con personal capacitado para atender situaciones de emergencia. Con todo, es importante que tengas en cuenta lo siguiente:',
      '- Antes de iniciar el evento, el contratante puede solicitar un recorrido por las instalaciones para verificar su estado. El inicio del uso del recinto sin observaciones implica conformidad con el estado aparente de conservación de las instalaciones.',
      '- Alce Kids no será responsable por accidentes, lesiones o daños que sean consecuencia directa del incumplimiento de las normas de uso establecidas en estos términos, del uso de los juegos por personas fuera del rango de edad indicado, o de un uso contrario a su diseño.',
      '- Alce Kids no será responsable por accidentes derivados de la falta de supervisión adulta de los menores, deber que corresponde a sus padres, tutores o adultos acompañantes conforme a la sección 5.',
      '- Si lo deseas, puedes contratar un seguro de accidentes personal para tus invitados — te recomendamos considerarlo, especialmente para los niños más pequeños.',
      'Lo anterior no afecta los derechos irrenunciables que la Ley N.º 19.496 reconoce a los consumidores.',
    ],
  },
  {
    numero: 18, titulo: 'Derecho de admisión',
    lineas: [
      'Alce Kids se reserva el derecho de admisión y permanencia en el recinto. Podremos pedir el retiro de cualquier persona — adulto o menor — cuya conducta:',
      '- Ponga en riesgo la integridad física de otros asistentes',
      '- Cause daños a las instalaciones',
      '- Incumpla reiteradamente las normas de uso',
      '- Sea contraria al orden y buen ambiente del evento',
      'El ejercicio de este derecho no generará obligación de reembolso ni de compensación para el contratante.',
    ],
  },
  {
    numero: 19, titulo: 'Privacidad e imagen',
    lineas: [
      'Los datos personales que nos entregas se tratan conforme a nuestra Política de Privacidad, disponible en celebrasincesar.cl/privacidad, que forma parte integrante de estos Términos y Condiciones. Ahí se describe, entre otras cosas, el tratamiento de imágenes de las celebraciones y de las grabaciones de las cámaras de seguridad del recinto.',
    ],
  },
  {
    numero: 20, titulo: 'Recinto privado y seguridad',
    lineas: [
      'Alce Kids es un recinto privado y cerrado. El ingreso está reservado para los asistentes de la celebración confirmada. No se permite el acceso a personas ajenas al evento durante su realización.',
      'El tratamiento de las imágenes captadas por las cámaras de seguridad del recinto se describe en nuestra Política de Privacidad (celebrasincesar.cl/privacidad).',
    ],
  },
  {
    numero: 21, titulo: 'Caso fortuito y fuerza mayor',
    lineas: [
      'Ninguna de las partes será responsable por el incumplimiento de sus obligaciones cuando dicho incumplimiento sea consecuencia de un caso fortuito o fuerza mayor en los términos del artículo 45 del Código Civil de Chile, incluyendo: catástrofes naturales, cortes de suministros básicos, emergencias sanitarias declaradas por la autoridad, o cualquier acto de autoridad pública que impida la realización del evento.',
      'Si Alce Kids debe cancelar un evento por fuerza mayor, el anticipo pagado será devuelto íntegramente o aplicado como crédito para una nueva fecha, a elección del contratante.',
      'Las condiciones climáticas adversas (lluvia, calor intenso, etc.) no constituyen caso de fuerza mayor que dé derecho a cancelación con reembolso. No obstante, dado que parte importante de la entretención se desarrolla al aire libre, si el día del evento se presenta lluvia, Alce Kids ofrece reagendar la celebración a una nueva fecha disponible sin costo de reprogramación, conservando íntegramente el anticipo. El salón techado y climatizado permanece disponible para quienes prefieran realizar la celebración igualmente. Siempre buscamos contigo la mejor solución.',
    ],
  },
  {
    numero: 22, titulo: 'Marco legal aplicable',
    lineas: [
      'Los presentes Términos y Condiciones se rigen íntegramente por la legislación chilena, en particular por el Código Civil, la Ley N.º 19.496 sobre Protección de los Derechos de los Consumidores y sus normas complementarias.',
      'Cualquier consulta, reclamo o diferencia derivada de la interpretación o aplicación de estos términos se resolverá en primer lugar mediante diálogo directo entre las partes. Si no se alcanza una solución, el contratante puede acudir al Servicio Nacional del Consumidor (SERNAC) o a los organismos competentes conforme a la legislación vigente.',
    ],
  },
];

// Arma el `contenido` canónico con el MISMO formato que
// documentoDesdeSecciones() de lib/tyc.js usa para todas las demás
// versiones — para que el mismo pipeline de hash/PDF funcione sin
// modificaciones.
export function contenidoPropuesta2026_09_v3() {
  return SECCIONES_PROPUESTA_2026_09_V3
    .map((s) => `${s.numero}. ${s.titulo}\n\n${s.lineas.join('\n')}`)
    .join('\n\n---\n\n');
}
