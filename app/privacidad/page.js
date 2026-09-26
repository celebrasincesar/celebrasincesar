import Link from 'next/link';
import Section from '../legal-section';
import { NEGOCIO } from '../../data/master';

// Versión de esta Política de Privacidad — independiente de TYC_VERSION
// (documento "Instrucción Maestra — Continuación", 14-sep-2026, §13/§16:
// T&C y Privacidad son documentos distintos, cada uno con su propio ciclo
// de versiones; se referencian entre sí, nunca se fusionan).
export const PRIVACIDAD_VERSION = '2026-09-25';

export const metadata = {
  title: 'Política de Privacidad',
  description:
    'Cómo Alce Kids · Celebra Sin Cesar SpA recopila, usa y protege los datos personales de quienes reservan una celebración.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${NEGOCIO.sitio}/privacidad` },
};

export default function PrivacidadPage() {
  return (
    <main
      style={{ fontFamily: 'var(--font-nunito, Nunito, sans-serif)', background: '#F8FAFF' }}
      className="min-h-screen"
    >
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
            Política de Privacidad
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Alce Kids · Celebra Sin Cesar · Las Condes, Santiago · Versión {PRIVACIDAD_VERSION}
          </p>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <div
          className="rounded-2xl p-5 mb-10 text-sm leading-relaxed"
          style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1E40AF' }}
        >
          <strong>En una frase:</strong> solo recopilamos los datos que necesitamos para
          coordinar tu celebración y procesar tu pago. Nunca los vendemos, y solo los
          compartimos con los proveedores estrictamente necesarios para operar el servicio
          (descritos uno por uno más abajo). Esta política describe exclusivamente los
          tratamientos de datos que existen hoy — no funcionalidades futuras.
        </div>

        <Section num="1" titulo="Responsable del tratamiento">
          <p>
            <strong>Razón social:</strong> {NEGOCIO.razonSocial}<br />
            <strong>RUT:</strong> 78.408.845-6<br />
            <strong>Nombre de fantasía:</strong> Alce Kids · Celebra Sin Cesar<br />
            <strong>Domicilio:</strong> Talavera de la Reina 380, Las Condes, Región Metropolitana, Chile<br />
            <strong>Contacto para temas de privacidad:</strong>{' '}
            <a href={`mailto:${NEGOCIO.email}`} style={{ color: '#1565C0' }}>{NEGOCIO.email}</a>
          </p>
        </Section>

        <Section num="2" titulo="Qué datos recopilamos y para qué">
          <p>Solo recopilamos los datos necesarios para gestionar tu reserva y tu celebración — nada adicional "por si acaso":</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Del contratante:</strong> nombre, correo electrónico y teléfono — para confirmar tu reserva, coordinar la celebración y enviarte la confirmación contractual.</li>
            <li><strong>Del festejado:</strong> nombre y edad — para preparar la celebración correctamente (aforo, entretención adecuada a la edad). No pedimos su RUT, su colegio ni su dirección particular.</li>
            <li><strong>De la reserva:</strong> fecha, horario, sector, cantidad de invitados y adicionales elegidos — el detalle de lo que contrataste.</li>
            <li><strong>De una visita agendada:</strong> nombre del adulto, WhatsApp, correo electrónico, día y hora elegidos y, si quieres indicarlo, nombre y edad del festejado — para reservar tu horario de visita, enviarte la confirmación y poder reagendarla o cancelarla. Agendar una visita no te obliga a reservar.</li>
            <li><strong>De pago:</strong> el monto, el medio de pago y el estado de la transacción. <strong>Nunca vemos ni almacenamos el número de tu tarjeta</strong> — eso lo procesa directamente Flow (sección 5).</li>
          </ul>
        </Section>

        <Section num="3" titulo="Base jurídica del tratamiento">
          <p>
            Tratamos estos datos porque son necesarios para <strong>ejecutar el contrato</strong> que
            aceptas al reservar (Ley N.º 19.496 y, según su entrada en vigencia, Ley N.º 21.719).
            No usamos tus datos de contacto para enviarte marketing salvo que exista un canal
            separado y explícito para ello — hoy, la comunicación que recibes es exclusivamente
            transaccional: confirmaciones, recordatorios y coordinación de tu propia celebración o de tu visita, y, después del evento, un mensaje de agradecimiento con el enlace para dejar una reseña en Google si quieres hacerlo.
          </p>
        </Section>

        <Section num="4" titulo="Coordinación por WhatsApp">
          <p>
            Los datos finales de tu celebración los completas en Mi Celebración, tu página privada.
            Parte de la coordinación (resolver dudas, consultas de visita y el mensaje posterior al
            evento) ocurre por WhatsApp, al número comercial de Alce Kids. Lo que compartas ahí se usa
            únicamente para organizar tu evento. WhatsApp es un canal de coordinación operacional,
            no reemplaza ni modifica los Términos y Condiciones que aceptaste antes de pagar.
          </p>
        </Section>

        <Section num="5" titulo="Con quién compartimos tus datos">
          <p>Trabajamos con proveedores que procesan datos en nuestro nombre, cada uno para una función específica:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Flow</strong> — procesa el pago de tu anticipo y saldo. Los datos de tu tarjeta o transferencia los recibe Flow directamente; nosotros solo vemos el resultado (pagado / rechazado) y el monto.</li>
            <li><strong>Neon (base de datos)</strong> — almacena los datos de tu reserva y de tus visitas agendadas de forma segura.</li>
            <li><strong>Zoho</strong> — envía los correos de confirmación y coordinación de reservas y visitas.</li>
            <li><strong>Google Calendar</strong> — usamos eventos de calendario internos para coordinar con nuestro equipo el día de tu celebración y el horario de tu visita. Esos eventos incluyen el nombre del festejado (si lo indicaste) y el código de tu reserva o visita — lo mínimo necesario para identificarlos operativamente.</li>
            <li><strong>Vercel</strong> — aloja el sitio web.</li>
          </ul>
          <p>Ninguno de estos proveedores puede usar tus datos para fines propios ajenos a prestarnos su servicio.</p>
        </Section>

        <Section num="6" titulo="Analítica del sitio">
          <p>
            Si tenemos analítica web activa (Google Analytics), solo recibe datos agregados y
            anónimos sobre cómo se usa el armador — por ejemplo, en qué paso está alguien o qué
            sector eligió. <strong>Nunca enviamos tu nombre, teléfono, correo, la fecha exacta de
            tu celebración ni tu código de reserva</strong> a la analítica: esos campos están
            explícitamente excluidos en el código del sitio.
          </p>
        </Section>

        <Section num="7" titulo="Cámaras de seguridad">
          <p>
            El recinto cuenta con cámaras de seguridad en áreas comunes, para proteger la
            integridad de las personas y las instalaciones. Las grabaciones podrán ponerse a
            disposición de la autoridad competente en caso de incidentes que lo ameriten.
          </p>
        </Section>

        <Section num="8" titulo="Fotografías e imágenes">
          <p>
            Solo usamos imágenes de tu celebración con fines promocionales (redes sociales, sitio
            web) si lo autorizas expresamente y por separado — nunca como condición para reservar,
            y nunca incluida automáticamente dentro de la aceptación general de los Términos y
            Condiciones. Esa autorización es siempre revocable: basta con avisarnos por escrito y
            retiramos las imágenes de los canales que administramos.
          </p>
        </Section>

        <Section num="9" titulo="Datos de menores">
          <p>
            Al reservar tu celebración, solo pedimos del festejado o festejada su <strong>nombre
            y edad</strong> — nunca su RUT, su colegio ni su dirección particular. Aplicamos el
            mismo principio de minimización a cualquier otro niño mencionado en la reserva. No
            solicitamos más información de salud que la operacionalmente necesaria para el cuidado
            de los asistentes.
          </p>
          <p>
            Antes de la celebración podemos solicitar o recibir por WhatsApp información
            operacional que el adulto responsable decida comunicar voluntariamente, como alergias
            o necesidades especiales relevantes para el cuidado de los asistentes. Esta información
            se utiliza únicamente para organizar la celebración y atender las necesidades
            comunicadas para ese evento — nunca para marketing, perfilamiento ni publicidad.
          </p>
          <p>
            Actualmente esta información no se incorpora a la base de datos de reservas de Alce
            Kids y permanece dentro del canal de comunicación utilizado para la coordinación. El
            tratamiento realizado a través de WhatsApp se encuentra además sujeto a las condiciones
            y políticas aplicables de dicha plataforma. Si en el futuro incorporamos un mecanismo
            propio para reunir y conservar esta información, esta política se actualizará para
            describir dónde queda guardada, con qué consentimiento, por cuánto tiempo y quién
            puede acceder a ella.
          </p>
        </Section>

        <Section num="10" titulo="Cuánto tiempo conservamos tus datos">
          <p>
            Conservamos los datos de tu reserva mientras sea necesario para cumplir el contrato y
            nuestras obligaciones legales (por ejemplo, tributarias). Si tienes dudas sobre un caso
            específico, escríbenos y te indicamos el plazo aplicable.
          </p>
        </Section>

        <Section num="11" titulo="Tus derechos">
          <p>
            Puedes pedirnos acceder, corregir o eliminar tus datos personales, y oponerte a un
            tratamiento específico, escribiendo a{' '}
            <a href={`mailto:${NEGOCIO.email}`} style={{ color: '#1565C0' }}>{NEGOCIO.email}</a>.
            Te responderemos dentro de un plazo razonable. Estos derechos se ejercen conforme a la
            Ley N.º 19.628 sobre Protección de la Vida Privada y, desde su entrada en vigencia
            plena el 1 de diciembre de 2026, a la Ley N.º 21.719 sobre Protección de Datos
            Personales.
          </p>
        </Section>

        <Section num="12" titulo="Seguridad de la información">
          <p>
            Tomamos medidas razonables para proteger tus datos frente a accesos no autorizados,
            pérdida o alteración — incluyendo el uso de proveedores con estándares de seguridad
            reconocidos (sección 5). Ningún sistema es 100% infalible; si detectamos un incidente
            que pueda afectar tus datos, te lo comunicaremos conforme a la normativa aplicable.
          </p>
        </Section>

        <Section num="13" titulo="Relación con los Términos y Condiciones">
          <p>
            Esta Política de Privacidad complementa los{' '}
            <Link href="/terminos" style={{ color: '#1565C0' }} className="font-bold">
              Términos y Condiciones
            </Link>{' '}
            de Alce Kids y forma parte integrante de la relación contractual. Ante cualquier
            contradicción específica sobre el tratamiento de datos personales, prevalece lo
            dispuesto en este documento.
          </p>
        </Section>

        <Section num="14" titulo="Cambios a esta política">
          <p>
            Si actualizamos esta Política, publicaremos la nueva versión en esta misma página con
            su fecha de vigencia. Los cambios relevantes se comunicarán de forma clara.
          </p>
        </Section>

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
            <a href={`mailto:${NEGOCIO.email}`} style={{ color: '#29B9E8' }} className="font-bold hover:underline">
              {NEGOCIO.email}
            </a>
          </p>
          <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Versión {PRIVACIDAD_VERSION}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/terminos"
            className="inline-flex items-center justify-center gap-2 font-black py-3 px-8 rounded-2xl transition-all hover:scale-[1.03]"
            style={{ background: '#fff', color: '#1565C0', border: '2px solid #1565C0' }}
          >
            Ver Términos y Condiciones →
          </Link>
        </div>
      </article>
    </main>
  );
}
