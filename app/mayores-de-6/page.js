import { PACKS_MAYORES, COPY_MAYORES } from '../../data/packs-mayores';
import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'mayores-de-6',
  'Vienen niños mayores de 6',
  'Alce Kids está diseñado para niños de 0 a 6 años. Cuando vienen hermanos o invitados mayores incorporamos entretención adecuada para su edad.'
);

export default function MayoresPage() {
  return (
    <Pagina
      slug="mayores-de-6"
      emoji="🎉"
      titulo={COPY_MAYORES.titulo.replace(' 🎉', '')}
      bajada={COPY_MAYORES.texto}
      cta={<CtaArmar texto="Armar mi celebración" nota="El armador te muestra la configuración que corresponde" />}
    >
      <Tarjeta titulo="Por qué existe esto">
        <p>
          Los juegos permanentes del jardín —piscina de pelotas, tobogán y estructuras— están
          diseñados para niños de {NEGOCIO.edades.min} a {NEGOCIO.edades.max} años. Un niño de 9
          o 10 no lo pasa bien ahí, y además es un tema de seguridad para los más chicos.
        </p>
        <p>
          Por eso, cuando nos dices que vienen niños grandes, incorporamos entretención pensada
          para ellos: inflables aptos para su edad, mesas de competencia y animación.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Cómo funciona" acento="#F97316">
        <p className="mb-3">
          No tienes que adivinar nada: al armar tu celebración eliges cuántos niños mayores vienen
          y el sistema te muestra la configuración que corresponde. <strong>Tú eliges qué juegos
          y qué animación</strong> dentro de las alternativas válidas.
        </p>
        <div className="space-y-2.5">
          {PACKS_MAYORES.map((p) => (
            <div key={p.id} className="rounded-2xl p-3.5" style={{ background: 'rgba(21,101,192,0.06)' }}>
              <p className="font-black text-sm" style={{ color: '#1565C0' }}>
                {p.tramo_mayores_min} a {p.tramo_mayores_max > 90 ? 'más' : p.tramo_mayores_max} niños mayores
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{p.descripcion}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          La combinación exacta también depende de cuántos niños vengan en total. El armador la
          calcula sola.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Lo importante" acento="#16a34a">
        <p>{COPY_MAYORES.nota}</p>
        <p>
          Contratar esta entretención no habilita a los niños mayores a usar los juegos fijos del
          jardín: son cosas distintas y así lo cuidamos para todos.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
