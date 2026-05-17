import Link from 'next/link';

export const metadata = {
  title: 'Términos y Condiciones | Celebra Sin César',
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
            Alce Kids · Celebra Sin César · Las Condes, Santiago · Vigente desde enero 2024
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
            <strong>Razón social:</strong> Alce Kids / Celebra Sin César<br />
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
        </Section>

        <Section num="3" titulo="Aceptación de los términos">
          <p>
            La aceptación de estos Términos y Condiciones opera de manera automática e irrevocable
            ante cualquiera de los siguientes actos: (a) el pago total o parcial del valor de la
            reserva; (b) la confirmación verbal o escrita de la fecha de celebración; (c) el ingreso
            al recinto el día del evento. Desde ese momento el contratante se obliga a cumplir y
            hacer cumplir a todos sus invitados el presente reglamento.
          </p>
        </Section>

        <Section num="4" titulo="Edades permitidas y público objetivo">
          <p>
            Alce Kids está diseñado exclusivamente para niños y niñas de <strong>0 a 6 años</strong>.
            Todas las instalaciones — dimensiones, materiales, alturas y medidas de seguridad —
            han sido concebidas para este rango etario.
          </p>
          <ul>
            <li>
              El ingreso de niños mayores de 6 años queda sujeto a la autorización expresa del
              administrador del recinto en el momento de la visita.
            </li>
            <li>
              Los adultos podrán ingresar en número ilimitado para acompañar a los menores; sin
              embargo, no está permitido que adultos utilicen los juegos y estructuras salvo cuando
              sea estrictamente necesario para asistir a un menor.
            </li>
            <li>
              Alce Kids se reserva el derecho de negar el ingreso o solicitar el retiro de cualquier
              persona cuya presencia resulte incompatible con la seguridad del evento.
            </li>
          </ul>
        </Section>

        <Section num="5" titulo="Supervisión y responsabilidad parental">
          <p>
            La supervisión permanente e individual de los menores es responsabilidad exclusiva de
            sus padres, tutores o adultos acompañantes. Alce Kids no presta servicio de guardería
            ni dispone de personal dedicado a la vigilancia individual de niños.
          </p>
          <ul>
            <li>
              Cada adulto acompañante asume la responsabilidad directa de los menores a su cargo
              durante toda su permanencia en el recinto.
            </li>
            <li>
              El contratante responde solidariamente por el comportamiento de todos sus invitados,
              tanto adultos como menores.
            </li>
            <li>
              En caso de emergencia médica, el personal de Alce Kids prestará primeros auxilios
              básicos y contactará a los servicios de emergencia, pero la responsabilidad sobre
              la salud del menor recae en sus padres o tutores.
            </li>
          </ul>
        </Section>

        <Section num="6" titulo="Uso correcto de las instalaciones">
          <p>
            El espacio cuenta con infraestructura diseñada para el juego seguro de la primera
            infancia. Para garantizar la integridad de todos los participantes:
          </p>
          <ul>
            <li>
              <strong>Piscina de pelotas:</strong> uso exclusivo para menores de hasta 6 años. Está
              prohibido ingresar calzado, objetos cortantes, alimentos o bebidas. Los adultos solo
              pueden ingresar para asistir a un menor en dificultad.
            </li>
            <li>
              <strong>Tobogán y estructuras de juego:</strong> un niño a la vez. Prohibido
              empujarse, descender de cabeza o usar las estructuras de forma contraria a su diseño.
            </li>
            <li>
              <strong>Granja de animales:</strong> los menores deben ir acompañados de un adulto.
              Prohibido alimentar a los animales con productos externos. El contacto físico se
              permite bajo supervisión del personal.
            </li>
            <li>
              <strong>Áreas de libre juego:</strong> los adultos deben abstenerse de generar
              situaciones de riesgo, como carreras o juegos bruscos entre menores de distintas
              edades.
            </li>
          </ul>
          <p className="mt-3">
            Cualquier uso indebido de las instalaciones que derive en daños o lesiones será
            responsabilidad exclusiva de quien lo provoque, eximiendo completamente a Alce Kids de
            toda consecuencia legal o económica.
          </p>
        </Section>

        <Section num="7" titulo="Capacidad y aforo">
          <p>
            Cada bloque horario admite un número máximo de personas determinado por la modalidad
            contratada. Superar el aforo establecido compromete la seguridad de los asistentes y
            está expresamente prohibido. Alce Kids podrá solicitar el retiro de personas que
            excedan el límite sin que ello genere derecho a compensación alguna para el
            contratante.
          </p>
        </Section>

        <Section num="8" titulo="Horarios y puntualidad">
          <p>
            Los bloques horarios son inamovibles: <strong>AM 11:00–14:00</strong> y{' '}
            <strong>PM 15:30–18:30</strong>. El tiempo de uso del recinto corresponde
            exclusivamente al horario contratado.
          </p>
          <ul>
            <li>
              La preparación del espacio puede iniciarse hasta 30 minutos antes del comienzo del
              bloque, previa coordinación.
            </li>
            <li>
              El retraso en el inicio de la celebración por parte del contratante no dará derecho
              a extensión del bloque ni a compensación económica.
            </li>
            <li>
              La permanencia en el recinto más allá del horario contratado generará un cargo
              adicional de $30.000 CLP por cada 15 minutos de exceso, o la diferencia
              proporcional que Alce Kids determine, según disponibilidad.
            </li>
          </ul>
        </Section>

        <Section num="9" titulo="Condiciones de pago y reserva">
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
              fuerza mayor (sección 19).
            </li>
            <li>
              El incumplimiento del pago del saldo antes del plazo establecido faculta a Alce Kids
              a liberar la fecha reservada sin derecho a devolución del anticipo.
            </li>
          </ul>
        </Section>

        <Section num="10" titulo="Política de cancelación y reagendamiento">
          <ul>
            <li>
              <strong>Cancelación con más de 15 días de anticipación:</strong> el anticipo podrá
              aplicarse como crédito para una nueva fecha dentro de los 6 meses siguientes.
            </li>
            <li>
              <strong>Cancelación entre 8 y 15 días:</strong> se pierde el 50 % del anticipo; el
              50 % restante podrá usarse como crédito por 3 meses.
            </li>
            <li>
              <strong>Cancelación con menos de 7 días:</strong> el anticipo se pierde en su
              totalidad.
            </li>
            <li>
              <strong>Reagendamiento:</strong> se permite una sola modificación de fecha sin costo,
              con un mínimo de 10 días de anticipación y sujeto a disponibilidad. Cambios
              adicionales tendrán un costo administrativo de $20.000 CLP.
            </li>
          </ul>
        </Section>

        <Section num="11" titulo="Artículos prohibidos">
          <p>
            Está estrictamente prohibido ingresar al recinto los siguientes elementos:
          </p>
          <ul>
            <li>Bebidas alcohólicas o cualquier sustancia psicoactiva</li>
            <li>Fuegos artificiales, pirotecnia o velas de gran formato</li>
            <li>Artículos de vidrio (botellas, fuentes, copas, etc.)</li>
            <li>Armas de cualquier tipo</li>
            <li>Animales propios de los invitados</li>
            <li>Equipos de sonido externos de alto volumen que superen los límites permitidos</li>
            <li>
              Cualquier elemento que a criterio del personal de Alce Kids represente un riesgo para
              la seguridad de los asistentes o daño a las instalaciones
            </li>
          </ul>
          <p className="mt-3">
            El incumplimiento de esta norma faculta a Alce Kids a retirar el artículo o, en casos
            graves, a dar por terminado el evento sin reembolso.
          </p>
        </Section>

        <Section num="12" titulo="Alimentos y bebidas">
          <p>
            El contratante puede ingresar alimentos y bebidas para la celebración respetando las
            siguientes condiciones:
          </p>
          <ul>
            <li>
              El ingreso de torta de cumpleaños, bocadillos y bebidas sin alcohol está
              expresamente permitido.
            </li>
            <li>
              Se prohíbe el ingreso de bebidas alcohólicas de cualquier graduación.
            </li>
            <li>
              Los alimentos solo pueden consumirse en el área designada para ello (salón o zona de
              mesas). Está prohibido consumir alimentos dentro de las áreas de juego.
            </li>
            <li>
              En caso de que el contratante opte por el servicio de catering externo, deberá
              informarlo previamente para coordinar la logística de ingreso.
            </li>
            <li>
              Alce Kids no se hace responsable por alergias, intoxicaciones u otras afecciones
              relacionadas con alimentos ingresados por los asistentes.
            </li>
          </ul>
        </Section>

        <Section num="13" titulo="Decoración y montaje">
          <p>
            El contratante puede ingresar decoración temática, cumpliendo las siguientes normas:
          </p>
          <ul>
            <li>
              Solo se permite el uso de cinta adhesiva de baja adhesión (masking tape) para fijar
              decoraciones. Queda prohibido el uso de silicona caliente, clavos, tornillos o
              cualquier elemento que dañe paredes, techos o mobiliario.
            </li>
            <li>
              El uso de confeti, serpentinas, globos de látex o elementos de pequeño tamaño que
              puedan ser ingeridos por menores requiere autorización previa.
            </li>
            <li>
              Las velas solo están permitidas sobre el pastel de cumpleaños y deben apagarse de
              inmediato tras el ritual de soplado.
            </li>
            <li>
              El montaje de decoración deberá quedar concluido dentro del tiempo de preparación
              autorizado y el desmontaje deberá realizarse antes del término del bloque
              contratado.
            </li>
          </ul>
        </Section>

        <Section num="14" titulo="Daños a las instalaciones">
          <p>
            El contratante es responsable de los daños que se produzcan en el recinto, su
            mobiliario, equipos y elementos decorativos durante el tiempo de uso del espacio.
          </p>
          <ul>
            <li>
              Los daños constatados serán valorados por el personal de Alce Kids y cobrados al
              contratante dentro de las 48 horas siguientes a la celebración.
            </li>
            <li>
              En caso de daños a las estructuras de juego provocados por uso indebido, el costo de
              reparación o reposición será de cargo exclusivo del contratante o de la familia del
              menor que los provocó, según corresponda.
            </li>
            <li>
              Alce Kids se reserva el derecho a retener el saldo pendiente de pago como garantía
              provisional ante daños constatados al término del evento.
            </li>
          </ul>
        </Section>

        <Section num="15" titulo="Limitación de responsabilidad">
          <p>
            Alce Kids ha diseñado sus instalaciones con estándares de seguridad apropiados para la
            primera infancia. Sin perjuicio de lo anterior:
          </p>
          <ul>
            <li>
              Alce Kids no será responsable por accidentes, lesiones o daños a personas o bienes
              que sean consecuencia del incumplimiento de las normas de uso establecidas en estos
              Términos y Condiciones.
            </li>
            <li>
              Alce Kids no será responsable por accidentes derivados de la falta de supervisión
              adulta de los menores.
            </li>
            <li>
              La responsabilidad máxima de Alce Kids ante cualquier reclamo no podrá exceder el
              valor total pagado por el contratante por el arrendamiento del espacio.
            </li>
            <li>
              Se recomienda al contratante contar con un seguro de accidentes personal para sus
              invitados, en especial para los menores participantes.
            </li>
          </ul>
          <p className="mt-3">
            Lo anterior es sin perjuicio de los derechos irrenunciables que la Ley N.º 19.496
            reconoce a los consumidores.
          </p>
        </Section>

        <Section num="16" titulo="Derecho de admisión">
          <p>
            Alce Kids se reserva el derecho de admisión y permanencia en el recinto. Podrá
            solicitar el retiro de cualquier persona — adulto o menor — cuya conducta:
          </p>
          <ul>
            <li>Ponga en riesgo la integridad física de otros asistentes</li>
            <li>Cause daños a las instalaciones</li>
            <li>Incumpla reiteradamente las normas de uso</li>
            <li>Sea contraria a las buenas costumbres o al orden del evento</li>
          </ul>
          <p className="mt-3">
            El ejercicio de este derecho no generará obligación de reembolso ni de compensación
            alguna para el contratante.
          </p>
        </Section>

        <Section num="17" titulo="Privacidad e imagen">
          <p>
            El contratante autoriza expresamente a Alce Kids a fotografiar y/o filmar las
            celebraciones realizadas en el recinto con fines promocionales, incluyendo su
            publicación en redes sociales y sitio web institucional, con la debida reserva de
            identidades cuando corresponda.
          </p>
          <p className="mt-3">
            Si el contratante desea que las imágenes de su celebración no sean utilizadas con
            fines promocionales, deberá comunicarlo de forma expresa y por escrito al momento de
            formalizar la reserva.
          </p>
          <p className="mt-3">
            Los datos personales proporcionados serán tratados de conformidad con la Ley N.º 19.628
            sobre Protección de la Vida Privada de Chile, siendo utilizados exclusivamente para
            la gestión de la reserva y comunicaciones relacionadas con el servicio.
          </p>
        </Section>

        <Section num="18" titulo="Propiedad privada y seguridad del recinto">
          <p>
            Alce Kids es un recinto privado y cerrado. El ingreso queda restringido a los
            asistentes inscritos en la celebración reservada. No se permite el acceso a personas
            ajenas al evento durante el desarrollo del mismo.
          </p>
          <p className="mt-3">
            El recinto dispone de cámaras de seguridad en áreas comunes, cuyo objetivo es velar
            por la integridad de las personas y las instalaciones. Las grabaciones podrán ser
            puestas a disposición de la autoridad competente en caso de incidentes que lo ameriten.
          </p>
        </Section>

        <Section num="19" titulo="Caso fortuito y fuerza mayor">
          <p>
            Ninguna de las partes será responsable por el incumplimiento de sus obligaciones cuando
            dicho incumplimiento sea consecuencia de un caso fortuito o de fuerza mayor en los
            términos del artículo 45 del Código Civil de Chile, incluyendo, sin carácter taxativo:
            catástrofes naturales, cortes de suministros básicos, emergencias sanitarias declaradas
            por la autoridad, o cualquier acto de autoridad pública que impida la realización del
            evento.
          </p>
          <p className="mt-3">
            En caso de que Alce Kids deba cancelar un evento por fuerza mayor, el anticipo pagado
            será devuelto íntegramente o aplicado como crédito para una nueva fecha, a elección del
            contratante.
          </p>
          <p className="mt-3">
            Las condiciones climáticas adversas (lluvia, calor extremo, etc.) no constituyen caso
            de fuerza mayor que justifique la cancelación sin costo, dado que el recinto cuenta con
            zonas cubiertas y salón climatizado que permiten el desarrollo normal de la celebración
            en cualquier condición meteorológica.
          </p>
        </Section>

        <Section num="20" titulo="Legislación aplicable y jurisdicción">
          <p>
            Los presentes Términos y Condiciones se rigen íntegramente por la legislación chilena,
            en particular por el Código Civil, la Ley N.º 19.496 sobre Protección de los Derechos
            de los Consumidores y sus normas complementarias.
          </p>
          <p className="mt-3">
            Para la resolución de cualquier controversia derivada de la interpretación, aplicación
            o incumplimiento de este instrumento, las partes se someten a la jurisdicción de los
            Tribunales Ordinarios de Justicia de la ciudad de Santiago, Región Metropolitana de
            Chile, renunciando expresamente a cualquier otro fuero o domicilio que pudiera
            corresponderles.
          </p>
          <p className="mt-3">
            Sin perjuicio de lo anterior, el contratante podrá acudir al Servicio Nacional del
            Consumidor (SERNAC) en caso de estimar que sus derechos como consumidor han sido
            vulnerados.
          </p>
        </Section>

        {/* Cierre */}
        <div
          className="rounded-2xl p-6 mt-10 text-sm leading-relaxed text-center"
          style={{ background: '#0D1B3E', color: 'rgba(255,255,255,0.6)' }}
        >
          <p className="font-black text-white mb-2">
            Alce Kids · Celebra Sin César
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
            Última actualización: enero 2024 · Versión 1.0
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

// Extend Section to handle ul lists nicely via global CSS already present
