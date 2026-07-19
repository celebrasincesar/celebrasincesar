import Link from 'next/link';

export const metadata = {
  title: 'Términos y Condiciones',
  description:
    'Términos y condiciones de uso del espacio Alce Kids Las Condes. Reglamento de celebraciones infantiles, política de reservas y responsabilidades.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://celebrasincesar.cl/terminos' },
};

export default function TerminosPage() {
  return (
    <main
      style={{ fontFamily: 'var(--font-nunito, Nunito, sans-serif)', background: '#F8FAFF' }}
      className="min-h-screen"
    >
      {/* ── Encabezado ── */}
      <header style={{ background: '#0D1B3E' }} className="py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold mb-6 transition-opacity hover:opacity-80"
            style={{ color: '#29B9E8' }}
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-black text-white leading-tight">
            Términos y Condiciones de Uso
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Alce Kids · Celebra Sin Cesar · Las Condes, Santiago · Vigente desde enero 2024
          </p>
        </div>
      </header>

      {/* ── Contenido ── */}
      <article className="max-w-3xl mx-auto px-4 py-12">

        {/* Aviso destacado */}
        <div
          className="rounded-2xl p-5 mb-10 text-sm leading-relaxed"
          style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1E40AF' }}
        >
          <strong>Importante:</strong> Al efectuar una reserva, realizar el pago del anticipo o
          hacer uso de las instalaciones de Alce Kids — cualquiera que ocurra primero —, el
          contratante declara haber leído, comprendido y aceptado íntegramente los presentes
          Términos y Condiciones, que constituyen un contrato de arrendamiento temporal de espacio
          privado conforme al Código Civil de la República de Chile y a la Ley N.º 19.496 sobre
          Protección de los Derechos de los Consumidores.
        </div>

        <Section num="1" titulo="Identificación del prestador">
          <p>
            <strong>Razón social:</strong> CELEBRA SIN CESAR SpA<br />
            <strong>RUT:</strong> 78.408.845-6<br />
            <strong>Nombre de fantasía:</strong> Alce Kids · Celebra Sin Cesar<br />
            <strong>Domicilio:</strong> Talavera de la Reina 380, Las Condes, Región Metropolitana,
            Chile<br />
            <strong>Sitio web:</strong>{' '}
            <a href="https://celebrasincesar.cl" style={{ color: '#1565C0' }}>
              celebrasincesar.cl
            </a>
            <br />
            <strong>Contacto:</strong> +56 9 4435 6955 — disponible viernes, sábado y domingo
          </p>
        </Section>

        <Section num="2" titulo="Objeto del contrato">
          <p>
            El presente instrumento regula el arrendamiento temporal y exclusivo del espacio de
            celebraciones infantiles Alce Kids, que incluye todas sus instalaciones, áreas de juego
            y servicios complementarios contratados, para la realización de una celebración de
            cumpleaños u evento infantil privado en la fecha y horario acordados.
          </p>
          <p className="mt-3">
            El arrendamiento confiere al contratante el uso exclusivo del recinto durante el bloque
            horario reservado. No constituye cesión de derechos sobre el inmueble ni sobre ningún
            elemento de la infraestructura.
          </p>
          <p className="mt-3">
            El arriendo incluye: uso del patio, juegos, salón principal y baños; microondas y
            hervidor disponibles en todo momento; sistema de calefacción y aire acondicionado; y
            servicio de limpieza post-evento. El uso de la cocina para preparaciones extras debe
            coordinarse con anticipación al momento de reservar.
          </p>
        </Section>

        <Section num="3" titulo="Aceptación de los términos">
          <p>
            Los presentes Términos y Condiciones se entienden aceptados desde el momento en que
            ocurre cualquiera de los siguientes actos: (a) el pago total o parcial del valor de la
            reserva; (b) la confirmación verbal o escrita de la fecha de celebración; (c) el ingreso
            al recinto el día del evento. Desde ese momento el contratante se compromete a cumplir
            y hacer cumplir a todos sus invitados el presente reglamento.
          </p>
          <p className="mt-3">
            Adicionalmente, antes de la celebración el contratante completa un{' '}
            <strong>formulario de confirmación</strong> en el que ratifica la aceptación de estos
            términos y formula declaraciones expresas sobre supervisión de los menores, uso
            correcto de las instalaciones y veracidad de la información entregada. Dichas
            declaraciones forman parte integrante del presente contrato.
          </p>
        </Section>

        <Section num="4" titulo="Edades y público objetivo">
          <p>
            Alce Kids está diseñado con cariño para niños y niñas de <strong>0 a 6 años</strong>.
            Todas las instalaciones — dimensiones, materiales, alturas y medidas de seguridad —
            han sido pensadas para este grupo etario.
          </p>
          <ul>
            <li>
              Los niños mayores de 6 años son bienvenidos como acompañantes. Sin embargo, por
              seguridad y diseño estructural, <strong>no pueden usar los juegos e infraestructura
              del jardín</strong> (piscina de pelotas, tobogán, estructuras, columpios y
              similares), dimensionados exclusivamente para niños de 0 a 6 años.
            </li>
            <li>
              Para los mayores de 6 años existen servicios adicionales aptos para su edad —
              inflables según la edad recomendada de cada modelo, juegos deportivos y animación —
              disponibles en el catálogo de adicionales.
            </li>
            <li>
              <strong>Velar por el cumplimiento de esta regla corresponde al contratante y al
              adulto a cargo de cada menor</strong>, quienes asumen el deber de impedir de manera
              activa que los niños mayores de 6 años accedan a la infraestructura del jardín. El
              anfitrión de Alce Kids no ejerce función de vigilancia individual (sección 5). El
              uso de la infraestructura del jardín por niños mayores de 6 años constituye uso
              contrario al diseño para los efectos de la sección 16, y las consecuencias que de
              él deriven serán de cargo del adulto responsable del menor.
            </li>
            <li>
              Los adultos pueden ingresar en número ilimitado para acompañar a los menores.
              Les pedimos que los juegos y estructuras se reserven para los niños, salvo cuando
              sea necesario asistir a un menor.
            </li>
            <li>
              Alce Kids puede solicitar el retiro de cualquier persona cuya presencia resulte
              incompatible con la seguridad del evento.
            </li>
          </ul>
        </Section>

        <Section num="5" titulo="Supervisión y responsabilidad parental">
          <p>
            Durante toda la celebración habrá un anfitrión de Alce Kids presente en el recinto,
            encargado de orientar a los asistentes y velar por el uso adecuado del espacio.
            Con todo, la supervisión permanente e individual de los menores es responsabilidad
            de sus padres, tutores o adultos acompañantes. Alce Kids no presta servicio de
            guardería ni cuenta con personal de vigilancia individual de niños.
          </p>
          <ul>
            <li>
              Cada adulto acompañante asume la responsabilidad directa de los menores a su cargo
              durante toda su permanencia en el recinto.
            </li>
            <li>
              En el formulario de confirmación, el contratante designa a un{' '}
              <strong>adulto responsable del evento</strong> (que puede ser él mismo), quien deberá
              permanecer en el recinto durante toda la celebración. El contratante se obliga,
              además, a que cada menor asista acompañado de su padre, madre, tutor o de un adulto
              expresamente encargado por éstos.
            </li>
            <li>
              El contratante responde solidariamente por el comportamiento de todos sus invitados,
              tanto adultos como menores.
            </li>
            <li>
              En caso de emergencia médica, el personal de Alce Kids prestará primeros auxilios
              básicos y contactará a los servicios de emergencia. Si la urgencia lo exige y no es
              posible ubicar de inmediato al padre, madre o tutor, el contratante autoriza al
              personal a gestionar el traslado del menor a un centro asistencial. La
              responsabilidad sobre la salud del menor recae en sus padres o tutores.
            </li>
          </ul>
        </Section>

        <Section num="6" titulo="Uso del espacio e instalaciones">
          <p>
            Cada área del recinto fue diseñada pensando en la seguridad de los más pequeños.
            Para cuidar a todos los participantes, te pedimos tener en cuenta lo siguiente:
          </p>
          <ul>
            <li>
              <strong>Piscina de pelotas:</strong> exclusiva para menores de hasta 6 años. Por
              favor no ingreses calzado, objetos con bordes ni alimentos o bebidas. Los adultos
              pueden ingresar solo para asistir a un menor.
            </li>
            <li>
              <strong>Tobogán y estructuras de juego:</strong> un niño a la vez. Pedimos no
              empujarse ni usar las estructuras de forma contraria a su diseño.
            </li>
            <li>
              <strong>Granja de animales:</strong> los niños deben ir siempre acompañados de un
              adulto. No alimentes a los animales con productos externos. El contacto físico se
              realiza bajo supervisión del personal.
            </li>
            <li>
              <strong>Áreas de libre juego:</strong> te pedimos evitar situaciones de riesgo como
              carreras o juegos bruscos entre niños de distintas edades.
            </li>
          </ul>
          <p className="mt-3">
            Los vehículos deben estacionarse únicamente en las zonas habilitadas para ello.
            Por favor evita estacionar sobre el pasto, zonas verdes o accesos del recinto.
          </p>
          <p className="mt-3">
            El uso indebido de las instalaciones que derive en daños o lesiones será responsabilidad
            de quien lo provoque, eximiendo a Alce Kids de toda consecuencia legal o económica
            derivada de dicha conducta.
          </p>
        </Section>

        <Section num="7" titulo="Servicios adicionales y extras">
          <p>
            Alce Kids ofrece un catálogo de servicios adicionales opcionales — decoración, animación,
            banquetería y entretención — que pueden contratarse al momento de reservar o hasta
            <strong> 5 días antes del evento</strong>, sujeto a disponibilidad.
          </p>
          <p className="mt-3">
            Los extras confirmados y pagados se consideran parte del contrato y quedan sujetos a
            la misma política de cancelación del arriendo. Extras no confirmados dentro del plazo
            no podrán garantizarse para la fecha del evento.
          </p>
        </Section>

        <Section num="8" titulo="Capacidad y aforo">
          <p>
            Cada bloque horario admite un número máximo de personas determinado por la modalidad
            contratada. Respetar el aforo es fundamental para garantizar la seguridad y comodidad
            de todos los asistentes. En caso de superarse el límite acordado, Alce Kids podrá
            solicitar que se regule el ingreso, sin que ello genere derecho a compensación
            para el contratante.
          </p>
        </Section>

        <Section num="9" titulo="Horarios y puntualidad">
          <p>
            Los bloques horarios son inamovibles: <strong>AM 11:00–14:00</strong> y{' '}
            <strong>PM 15:30–18:30</strong>. El tiempo de uso del recinto corresponde
            exclusivamente al horario contratado.
          </p>
          <ul>
            <li>
              Puedes iniciar la preparación del espacio hasta 30 minutos antes del comienzo del
              bloque, previa coordinación con el equipo.
            </li>
            <li>
              Si la celebración comienza tarde por parte del contratante, el tiempo no se extiende
              ni se compensa económicamente.
            </li>
            <li>
              La permanencia en el recinto más allá del horario contratado generará un cargo
              adicional de <strong>$15.000 CLP por cada 15 minutos de exceso</strong> o fracción.
              Si prefieres más tiempo, la hora adicional contratada con anticipación tiene un
              valor preferente — pídela al reservar.
            </li>
          </ul>
        </Section>

        <Section num="10" titulo="Condiciones de pago y reserva">
          <p>
            La reserva se confirma con el pago de un anticipo del <strong>50 % del valor total</strong>{' '}
            acordado. El saldo restante debe cancelarse con un mínimo de{' '}
            <strong>48 horas de anticipación</strong> a la fecha del evento.
          </p>
          <ul>
            <li>
              Los precios publicados en el sitio web son referenciales y pueden variar según
              temporada, disponibilidad y extras contratados. El precio definitivo es el confirmado
              al momento de formalizar la reserva.
            </li>
            <li>
              El anticipo no es reembolsable, salvo en los casos contemplados en la cláusula de
              fuerza mayor (sección 20).
            </li>
            <li>
              El no pago del saldo antes del plazo establecido faculta a Alce Kids a liberar la
              fecha reservada, sin derecho a devolución del anticipo.
            </li>
          </ul>
        </Section>

        <Section num="11" titulo="Cancelación y reagendamiento">
          <ul>
            <li>
              <strong>Cancelación con 7 o más días de anticipación:</strong> el anticipo se
              aplica íntegramente como crédito para una nueva fecha dentro de los 3 meses
              siguientes, sujeto a disponibilidad.
            </li>
            <li>
              <strong>Cancelación con menos de 7 días de anticipación:</strong> el anticipo no
              es reembolsable ni canjeable.
            </li>
            <li>
              <strong>Cambio de fecha:</strong> se permite una modificación con un mínimo de
              7 días de anticipación, sujeto a disponibilidad.
            </li>
          </ul>
          <p className="mt-3">
            Entendemos que los imprevistos ocurren. Ante cualquier situación excepcional,
            siempre estamos disponibles para conversar y buscar la mejor solución para ambas partes.
          </p>
        </Section>

        <Section num="12" titulo="Lo que pedimos no ingresar">
          <p>
            Para proteger a los niños y mantener el espacio en las mejores condiciones, te pedimos
            no ingresar los siguientes elementos:
          </p>
          <ul>
            <li>Bebidas alcohólicas o cualquier sustancia psicoactiva</li>
            <li>Fuegos artificiales, pirotecnia o velas de gran formato</li>
            <li>Artículos de vidrio (botellas, fuentes, copas, etc.)</li>
            <li>Animales propios de los invitados</li>
            <li>Confeti, papel picado, challa y serpentinas</li>
            <li>Equipos de sonido externos de alto volumen</li>
            <li>
              Cualquier elemento que a criterio del personal de Alce Kids represente un riesgo para
              la seguridad de los asistentes o un daño a las instalaciones
            </li>
          </ul>
          <p className="mt-3">
            Si hay algún artículo que no estás seguro de poder traer, consúltanos antes — con gusto
            te orientamos. Ante incumplimientos graves, Alce Kids podrá solicitar retirar el artículo
            o, en casos extremos, dar por terminado el evento sin reembolso.
          </p>
        </Section>

        <Section num="13" titulo="Alimentos y bebidas">
          <p>
            Puedes traer libremente alimentos y bebidas para la celebración, respetando estas
            condiciones:
          </p>
          <ul>
            <li>
              La torta de cumpleaños, bocadillos y bebidas sin alcohol están expresamente
              permitidos — ¡son parte de la fiesta!
            </li>
            <li>
              No está permitido el ingreso de bebidas alcohólicas de ningún tipo.
            </li>
            <li>
              Los alimentos solo pueden consumirse en el área de mesas. Por favor no los lleves
              a las zonas de juego.
            </li>
            <li>
              Si contratas catering externo, avísanos con anticipación para coordinar el ingreso.
            </li>
            <li>
              Alce Kids no se hace responsable por alergias, intoxicaciones u otras afecciones
              relacionadas con alimentos ingresados por los asistentes.
            </li>
          </ul>
        </Section>

        <Section num="14" titulo="Decoración y montaje">
          <p>
            Puedes ingresar toda la decoración temática que quieras. Te pedimos seguir estas
            indicaciones para cuidar el espacio:
          </p>
          <ul>
            <li>
              Para fijar decoraciones, por favor usa únicamente cinta de papel removible
              (masking tape). Evita cualquier elemento que pueda perforar o dañar las superficies
              del recinto.
            </li>
            <li>
              El confeti, papel picado, challa y serpentinas no están permitidos en ningún área.
              Los globos de látex y elementos pequeños pueden usarse bajo supervisión directa
              de un adulto.
            </li>
            <li>
              Las velas solo están permitidas sobre el pastel de cumpleaños y deben apagarse
              de inmediato tras el momento de soplar.
            </li>
            <li>
              El montaje debe quedar listo dentro del tiempo de preparación autorizado y el
              desmontaje, antes del término del bloque contratado.
            </li>
          </ul>
        </Section>

        <Section num="15" titulo="Daños a las instalaciones">
          <p>
            El contratante es responsable de los daños que se produzcan en el recinto, su
            mobiliario, equipos y elementos decorativos durante el tiempo de uso.
          </p>
          <ul>
            <li>
              Los daños constatados serán valorados por el equipo de Alce Kids y comunicados
              al contratante dentro de las 48 horas siguientes a la celebración.
            </li>
            <li>
              Los daños a estructuras de juego provocados por uso indebido serán de cargo del
              contratante o de la familia del menor responsable, según corresponda.
            </li>
            <li>
              Alce Kids puede retener el saldo pendiente de pago como garantía provisional
              ante daños constatados al término del evento.
            </li>
          </ul>
        </Section>

        <Section num="16" titulo="Responsabilidad y seguridad">
          <p>
            Alce Kids ha diseñado sus instalaciones con estándares de seguridad apropiados para la
            primera infancia: dimensiones, alturas, materiales y superficies pensados para niños
            de 0 a 6 años. Las estructuras de juego son objeto de{' '}
            <strong>revisión e inspección periódica</strong>, de la cual se mantiene registro.
            El recinto cuenta con personal capacitado para atender situaciones de emergencia.
            Con todo, es importante que tengas en cuenta lo siguiente:
          </p>
          <ul>
            <li>
              Antes de iniciar el evento, el contratante puede solicitar un recorrido por las
              instalaciones para verificar su estado. El inicio del uso del recinto sin
              observaciones implica conformidad con el estado aparente de conservación de las
              instalaciones.
            </li>
            <li>
              Alce Kids no será responsable por accidentes, lesiones o daños que sean consecuencia
              directa del incumplimiento de las normas de uso establecidas en estos términos, del
              uso de los juegos por personas fuera del rango de edad indicado, o de un uso
              contrario a su diseño.
            </li>
            <li>
              Alce Kids no será responsable por accidentes derivados de la falta de supervisión
              adulta de los menores, deber que corresponde a sus padres, tutores o adultos
              acompañantes conforme a la sección 5.
            </li>
            <li>
              Si lo deseas, puedes contratar un seguro de accidentes personal para tus invitados —
              te recomendamos considerarlo, especialmente para los niños más pequeños.
            </li>
          </ul>
          <p className="mt-3">
            Lo anterior no afecta los derechos irrenunciables que la Ley N.º 19.496
            reconoce a los consumidores.
          </p>
        </Section>

        <Section num="17" titulo="Derecho de admisión">
          <p>
            Alce Kids se reserva el derecho de admisión y permanencia en el recinto. Podremos
            pedir el retiro de cualquier persona — adulto o menor — cuya conducta:
          </p>
          <ul>
            <li>Ponga en riesgo la integridad física de otros asistentes</li>
            <li>Cause daños a las instalaciones</li>
            <li>Incumpla reiteradamente las normas de uso</li>
            <li>Sea contraria al orden y buen ambiente del evento</li>
          </ul>
          <p className="mt-3">
            El ejercicio de este derecho no generará obligación de reembolso ni de compensación
            para el contratante.
          </p>
        </Section>

        <Section num="18" titulo="Privacidad e imagen">
          <p>
            Alce Kids solo captará y utilizará imágenes de las celebraciones con fines
            promocionales (redes sociales y sitio web) cuando el contratante lo{' '}
            <strong>autorice expresamente</strong> en el formulario de confirmación. Sin esa
            autorización, no se publicarán imágenes del evento.
          </p>
          <p className="mt-3">
            La autorización del contratante alcanza únicamente a su propia imagen y a la de los
            menores a su cargo. En fotografías donde aparezcan otros asistentes, Alce Kids evitará
            publicar rostros identificables de menores cuyos padres o tutores no hayan autorizado
            su difusión. La autorización es siempre revocable: basta comunicarlo por escrito y las
            imágenes serán retiradas de los canales administrados por Alce Kids.
          </p>
          <p className="mt-3">
            Los datos personales proporcionados serán tratados conforme a la Ley N.º 19.628 sobre
            Protección de la Vida Privada y a la Ley N.º 21.719 según su entrada en vigencia, y se
            utilizarán exclusivamente para la gestión de la reserva y comunicaciones relacionadas
            con el servicio. La información de salud entregada (como alergias o necesidades
            especiales) es un <strong>dato sensible</strong>: se usa únicamente para resguardar el
            bienestar de los asistentes durante el evento, no se comparte con terceros y se elimina
            una vez realizada la celebración.
          </p>
        </Section>

        <Section num="19" titulo="Recinto privado y seguridad">
          <p>
            Alce Kids es un recinto privado y cerrado. El ingreso está reservado para los
            asistentes de la celebración confirmada. No se permite el acceso a personas ajenas
            al evento durante su realización.
          </p>
          <p className="mt-3">
            El recinto cuenta con cámaras de seguridad en áreas comunes para velar por la
            integridad de las personas y las instalaciones. Las grabaciones podrán ponerse a
            disposición de la autoridad competente en caso de incidentes que lo ameriten.
          </p>
        </Section>

        <Section num="20" titulo="Caso fortuito y fuerza mayor">
          <p>
            Ninguna de las partes será responsable por el incumplimiento de sus obligaciones cuando
            dicho incumplimiento sea consecuencia de un caso fortuito o fuerza mayor en los términos
            del artículo 45 del Código Civil de Chile, incluyendo: catástrofes naturales, cortes
            de suministros básicos, emergencias sanitarias declaradas por la autoridad, o cualquier
            acto de autoridad pública que impida la realización del evento.
          </p>
          <p className="mt-3">
            Si Alce Kids debe cancelar un evento por fuerza mayor, el anticipo pagado será
            devuelto íntegramente o aplicado como crédito para una nueva fecha, a elección del
            contratante.
          </p>
          <p className="mt-3">
            Las condiciones climáticas adversas (lluvia, calor intenso, etc.) no constituyen
            caso de fuerza mayor que dé derecho a cancelación con reembolso. No obstante, dado que
            parte importante de la entretención se desarrolla al aire libre, si el día del evento
            se presenta lluvia, Alce Kids ofrece reagendar la celebración a una nueva fecha
            disponible sin costo de reprogramación, conservando íntegramente el anticipo. El salón
            techado y climatizado permanece disponible para quienes prefieran realizar la
            celebración igualmente. Siempre buscamos contigo la mejor solución.
          </p>
        </Section>

        <Section num="21" titulo="Marco legal aplicable">
          <p>
            Los presentes Términos y Condiciones se rigen íntegramente por la legislación chilena,
            en particular por el Código Civil, la Ley N.º 19.496 sobre Protección de los Derechos
            de los Consumidores y sus normas complementarias.
          </p>
          <p className="mt-3">
            Cualquier consulta, reclamo o diferencia derivada de la interpretación o aplicación de
            estos términos se resolverá en primer lugar mediante diálogo directo entre las partes.
            Si no se alcanza una solución, el contratante puede acudir al Servicio Nacional del
            Consumidor (SERNAC) o a los organismos competentes conforme a la legislación vigente.
          </p>
        </Section>

        {/* Cierre */}
        <div
          className="rounded-2xl p-6 mt-10 text-sm leading-relaxed text-center"
          style={{ background: '#0D1B3E', color: 'rgba(255,255,255,0.6)' }}
        >
          <p className="font-black text-white mb-2">
            Alce Kids · CELEBRA SIN CESAR SpA
          </p>
          <p>Talavera de la Reina 380, Las Condes, Santiago, Chile</p>
          <p className="mt-1">
            Consultas:{' '}
            <a
              href="https://wa.me/56944356955"
              style={{ color: '#29B9E8' }}
              className="font-bold hover:underline"
            >
              +56 9 4435 6955
            </a>
          </p>
          <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Última actualización: julio 2026 · Versión 3.2
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-black py-3 px-8 rounded-2xl text-white transition-all hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(135deg,#1565C0,#1976D2)',
              boxShadow: '0 4px 16px rgba(21,101,192,0.3)',
            }}
          >
            ← Volver y reservar mi fecha
          </Link>
        </div>
      </article>
    </main>
  );
}

/* ─── Componente auxiliar ─── */
function Section({ num, titulo, children }) {
  return (
    <section className="mb-8">
      <h2
        className="text-lg font-black mb-3 pb-2"
        style={{
          color: '#1565C0',
          borderBottom: '2px solid #DBEAFE',
          display: 'flex',
          gap: '8px',
          alignItems: 'baseline',
        }}
      >
        <span
          className="text-xs font-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0"
          style={{ background: '#1565C0', color: 'white', lineHeight: 1, paddingTop: '1px' }}
        >
          {num}
        </span>
        {titulo}
      </h2>
      <div
        className="text-sm leading-relaxed space-y-2"
        style={{ color: '#374151' }}
      >
        {children}
      </div>
    </section>
  );
}
