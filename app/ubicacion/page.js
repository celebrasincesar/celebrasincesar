import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaWhatsApp, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'ubicacion',
  'Dónde estamos',
  'Alce Kids está en Talavera de la Reina 380, Las Condes, Santiago. Con estacionamientos exclusivos para tu celebración.'
);

export default function UbicacionPage() {
  return (
    <Pagina
      slug="ubicacion"
      emoji="📍"
      titulo="Dónde estamos"
      bajada={NEGOCIO.direccion.completa}
      cta={
        <CtaWhatsApp
          texto="Preguntar cómo llegar"
          mensaje="¡Hola César! Quiero saber cómo llegar a Alce Kids 😊"
        />
      }
    >
      <Tarjeta titulo="La dirección">
        <p className="text-base font-bold text-gray-700">{NEGOCIO.direccion.calle}</p>
        <p>{NEGOCIO.direccion.comuna}, Santiago</p>
        <a href={NEGOCIO.mapa} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 font-bold text-sm" style={{ color: '#1565C0' }}>
          Abrir en Google Maps →
        </a>
      </Tarjeta>

      <Tarjeta titulo="Estacionamiento" acento="#F97316">
        <p>
          Tu celebración tiene <strong>3 estacionamientos exclusivos</strong>. El resto de los
          invitados puede estacionar en la calle: es un sector residencial, y la disponibilidad
          depende del día y la hora.
        </p>
      </Tarjeta>

      <Tarjeta titulo="El sector">
        <p>
          Estamos en Las Condes, a pocos minutos de Vitacura, Lo Barnechea y Providencia. Es un
          recinto privado con jardín, en un sector residencial y tranquilo.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
