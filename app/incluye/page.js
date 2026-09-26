import { CATEGORIAS_ADICIONALES, NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, Checks, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'incluye',
  'Qué incluye el arriendo',
  'Todo lo que viene sin costo adicional al arrendar Alce Kids: juegos, salón climatizado, granja, estacionamientos, limpieza y adultos sin costo.'
);

// Los "incluidos" salen del catálogo central: si mañana cambian ahí,
// cambian acá solos. Nada escrito a mano.
const incluidos = CATEGORIAS_ADICIONALES.find((c) => c.id === 'incluidos')?.items || [];

export default function IncluyePage() {
  return (
    <Pagina
      slug="incluye"
      emoji="✨"
      titulo="Qué incluye tu arriendo"
      bajada={`Arriendas ${NEGOCIO.superficieM2} m² de recinto para tu familia. Esto viene en el precio, sin costos ocultos.`}
      cta={<CtaArmar nota="Calcula el valor exacto de tu fecha en 2 minutos" />}
    >
      <Tarjeta titulo="El recinto">
        <Checks items={[
          'Juegos Alce Kids: piscina de pelotas, tobogán y estructuras',
          'Autopista gigante para los autos',
          'Granja con conejos',
          'Salón climatizado',
          'Baños completos, diferenciados',
          '3 estacionamientos exclusivos',
          'Uso exclusivo del sector contratado',
          'Limpieza profunda antes y después',
        ]} />
      </Tarjeta>

      <Tarjeta titulo="Los acompañantes" acento="#F97316">
        <p>
          <strong>Adultos sin costo adicional.</strong> Papás, abuelos, apoderados y familiares
          entran sin cargo extra: solo cuentas la cantidad de niños.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Y lo que dejamos preparado si nos avisas">
        <p className="mb-3">
          Todo esto es sin costo. Lo marcas al armar tu celebración y lo tenemos listo antes de que llegues:
        </p>
        <Checks items={incluidos.map((i) => `${i.nombre} — ${i.desc}`)} color="#1565C0" />
      </Tarjeta>

      <Tarjeta titulo="Lo que puedes traer tú">
        <p>
          Tu torta, tu comida, tu decoración y tus animadores, <strong>sin costo extra por traer de afuera</strong>.
          O lo armamos nosotros con los adicionales del <a href="/catalogo" className="font-bold underline" style={{ color: '#1565C0' }}>catálogo</a>.
          Tú eliges cuánto delegar.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
