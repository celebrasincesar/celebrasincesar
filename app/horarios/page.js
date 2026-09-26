import { NEGOCIO, PRECIOS_EXTRAS } from '../../data/master';
import { opcionesHorario, clp } from '../../data/reglas';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'horarios',
  'Días y horarios',
  'Celebramos viernes (PM 16:00-19:00), sábados y domingos (AM 11:00-14:00 y PM 15:00-18:00). Puedes llegar 30 minutos antes a decorar.'
);

// Fecha de referencia solo para resolver qué tabla de turnos corresponde a
// cada fila (data/reglas.js: turnoPorId/opcionesHorario dependen de si la
// fecha es viernes) — un viernes cualquiera y un sábado cualquiera, no una
// fecha real de ninguna reserva.
const FECHA_REF_VIERNES = '2026-09-18';
const FECHA_REF_SABADO = '2026-09-19';

export default function HorariosPage() {
  return (
    <Pagina
      slug="horarios"
      emoji="🕐"
      titulo="Días y horarios"
      bajada="Una sola celebración por bloque: el recinto es exclusivo para tu familia durante todo tu horario."
      cta={<CtaArmar texto="Ver fechas disponibles" nota="El calendario muestra la disponibilidad real" />}
    >
      <Tarjeta titulo="Cuándo celebramos">
        <p className="mb-3">{NEGOCIO.dias.join(' · ')}</p>

        <p className="text-sm font-bold mb-2" style={{ color: '#1565C0' }}>Sábados y domingos</p>
        <div className="grid grid-cols-2 gap-3">
          {NEGOCIO.turnos.map((t) => (
            <div key={t.id} className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(21,101,192,0.06)' }}>
              <div className="font-black text-lg" style={{ color: '#1565C0' }}>{t.label}</div>
              <div className="text-sm text-gray-500 mt-0.5">{t.desde} – {t.hasta}</div>
            </div>
          ))}
        </div>

        <p className="text-sm font-bold mb-2 mt-5" style={{ color: '#1565C0' }}>Viernes</p>
        <div className="grid grid-cols-2 gap-3">
          {NEGOCIO.turnosViernes.map((t) => (
            <div key={t.id} className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(21,101,192,0.06)' }}>
              <div className="font-black text-lg" style={{ color: '#1565C0' }}>{t.label}</div>
              <div className="text-sm text-gray-500 mt-0.5">{t.desde} – {t.hasta}</div>
            </div>
          ))}
          <div className="rounded-2xl p-4 text-center flex flex-col justify-center"
            style={{ background: 'rgba(107,114,128,0.06)' }}>
            <div className="font-black text-sm text-gray-400">Sin bloque AM los viernes</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Son tres horas completas de celebración (el viernes PM son tres horas también, de
          16:00 a 19:00). Los bloques no se mueven: así el equipo alcanza a dejar todo impecable
          entre una celebración y la siguiente.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Para decorar" acento="#F97316">
        <p>{NEGOCIO.preparacion}</p>
      </Tarjeta>

      <Tarjeta titulo="¿Necesitas más tiempo?" acento="#F97316">
        <p>
          Puedes contratar <strong>horas adicionales</strong> al elegir tu horario, con precio
          cerrado: {clp(PRECIOS_EXTRAS.hora_adicional)} cada una, ya sumadas a tu total.
        </p>
        <p className="text-sm font-bold mb-1 mt-3" style={{ color: '#1565C0' }}>Sábados y domingos</p>
        <ul className="space-y-1.5">
          {NEGOCIO.turnos.map((t) => (
            <li key={t.id} className="text-sm">
              <strong>{t.label}</strong>{': '}
              {opcionesHorario(t.id, FECHA_REF_SABADO).map((op, i) => (
                <span key={op.horas}>
                  {i > 0 && ' · '}
                  {op.texto}
                  {op.horas > 0 ? ` (+${clp(op.precioAdicional)})` : ''}
                </span>
              ))}
            </li>
          ))}
        </ul>
        <p className="text-sm font-bold mb-1 mt-3" style={{ color: '#1565C0' }}>Viernes</p>
        <ul className="space-y-1.5">
          {NEGOCIO.turnosViernes.map((t) => (
            <li key={t.id} className="text-sm">
              <strong>{t.label}</strong>{': '}
              {opcionesHorario(t.id, FECHA_REF_VIERNES).map((op, i) => (
                <span key={op.horas}>
                  {i > 0 && ' · '}
                  {op.texto}
                  {op.horas > 0 ? ` (+${clp(op.precioAdicional)})` : ''}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </Tarjeta>
    </Pagina>
  );
}
