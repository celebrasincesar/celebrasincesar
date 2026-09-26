import Link from 'next/link';
import { FAQS } from '../../data/faqs';
import { NEGOCIO } from '../../data/master';
import { Pagina, RESPUESTAS, Tarjeta, CtaWhatsApp, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'preguntas',
  'Preguntas frecuentes',
  'Todo lo que preguntan las familias antes de reservar un cumpleaños en Alce Kids: qué incluye, valores, horarios, lluvia, niños mayores de 6 y cómo reservar.'
);

export default function PreguntasPage() {
  return (
    <Pagina
      slug="preguntas"
      emoji="❓"
      titulo="Preguntas frecuentes"
      bajada="Las respuestas que más nos piden. Si falta la tuya, escríbenos y la contestamos al tiro."
      cta={
        <CtaWhatsApp
          texto="Tengo otra pregunta"
          mensaje="¡Hola César! Tengo una consulta sobre Alce Kids 😊"
        />
      }
    >
      {/* Accesos directos a las páginas-respuesta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RESPUESTAS.map((r) => (
          <Link key={r.slug} href={`/${r.slug}`}
            className="bg-white rounded-2xl p-4 transition-transform hover:scale-[1.02]"
            style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
            <div className="text-2xl mb-1.5">{r.emoji}</div>
            <p className="font-black text-sm text-gray-800">{r.titulo}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{r.resumen}</p>
          </Link>
        ))}
      </div>

      {/* Las mismas FAQ que alimentan la home y el schema de Google:
          una sola fuente en data/faqs.js. */}
      <div className="pt-4">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
          Y las de siempre
        </p>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="bg-white rounded-2xl p-4 group"
              style={{ border: '1.5px solid rgba(21,101,192,0.12)' }}>
              <summary className="font-black text-sm text-gray-800 cursor-pointer list-none flex items-start justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-gray-300 group-open:rotate-45 transition-transform flex-shrink-0">＋</span>
              </summary>
              <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <Tarjeta titulo="Lo esencial en tres líneas" acento="#16a34a">
        <p>📍 {NEGOCIO.direccion.completa}</p>
        <p>🕐 {NEGOCIO.dias.join(' · ')} — {NEGOCIO.turnos.map((t) => `${t.label} ${t.desde}–${t.hasta}`).join(' · ')}</p>
        <p>💳 Reservas con el {NEGOCIO.anticipoPorcentaje}% · saldo {NEGOCIO.saldoVence}</p>
      </Tarjeta>
    </Pagina>
  );
}
