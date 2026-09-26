import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'lluvia',
  'Si llueve',
  'Si llueve, reagendas sin costo y tu anticipo queda 100% vigente. Nunca pierdes tu reserva en Alce Kids.'
);

export default function LluviaPage() {
  return (
    <Pagina
      slug="lluvia"
      emoji="🌧️"
      titulo="¿Y si llueve?"
      bajada="Es la pregunta que más nos hacen entre mayo y agosto. La respuesta corta: no pierdes nada."
      cta={<CtaArmar texto="Reservar mi fecha" nota="Reservar en invierno no tiene riesgo" />}
    >
      <Tarjeta titulo="La política" acento="#16a34a">
        <p className="text-base font-bold text-gray-700">{NEGOCIO.lluvia}</p>
      </Tarjeta>

      <Tarjeta titulo="Qué pasa en la práctica">
        <p>
          Si el pronóstico está malo, nos escribimos y buscamos otra fecha disponible. Tu anticipo
          se traslada completo a la fecha nueva.
        </p>
        <p>
          El salón está climatizado y buena parte del recinto tiene toldos, así que muchas
          celebraciones se hacen igual con lluvia suave. La decisión la tomamos contigo.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Reservar en invierno" acento="#F97316">
        <p>
          Los meses de invierno tienen mucha más disponibilidad de fechas y de horarios. Con esta
          política, adelantarse no tiene riesgo.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
