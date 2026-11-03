import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'lluvia',
  'Si llueve',
  'Si llueve, reagendas sin costo y tu anticipo pasa completo a la nueva fecha, dentro de los 3 meses siguientes y según disponibilidad.'
);

export default function LluviaPage() {
  return (
    <Pagina
      slug="lluvia"
      emoji="🌧️"
      titulo="¿Y si llueve?"
      bajada="Es la pregunta que más nos hacen entre mayo y agosto. La respuesta corta: tu anticipo queda a tu favor."
      cta={<CtaArmar texto="Reservar mi fecha" nota="Reservar en invierno es tranquilo" />}
    >
      <Tarjeta titulo="La política" acento="#16a34a">
        <p className="text-base font-bold text-gray-700">{NEGOCIO.lluvia}</p>
      </Tarjeta>

      <Tarjeta titulo="Qué pasa en la práctica">
        <p>
          Si el pronóstico está difícil, nos escribimos y buscamos juntos la nueva fecha, dentro de
          los 3 meses siguientes y según disponibilidad. Tu anticipo se traslada completo.
        </p>
        <p>
          El salón está climatizado y buena parte del recinto tiene toldos, así que muchas
          celebraciones se hacen igual con lluvia suave. La decisión la tomamos contigo.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Reservar en invierno" acento="#F97316">
        <p>
          Los meses de invierno tienen mucha más disponibilidad de fechas y de horarios. Con esta
          política, adelantarse es tranquilo.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
