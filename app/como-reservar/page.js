import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'como-reservar',
  'Cómo reservar',
  'Reservar en Alce Kids: eliges fecha, armas tu celebración, pagas el anticipo y tu reserva queda confirmada al instante.'
);

const PASOS = [
  { n: 1, t: 'Eliges tu fecha', d: 'El calendario muestra la disponibilidad real: si aparece libre, está libre.' },
  { n: 2, t: 'Armas tu celebración', d: 'Nos cuentas cuántos niños vienen y qué edades. El sistema filtra lo que sirve y calcula el valor.' },
  { n: 3, t: 'Revisas y pagas el anticipo', d: 'Ves el detalle completo y el valor final antes de pagar. Sin sorpresas ni letra chica.' },
  { n: 4, t: 'Tu reserva queda confirmada', d: 'Automáticamente, apenas se acredita el anticipo. Después recibes el enlace a Mi Celebración, tu página privada para completar los datos finales.' },
];

export default function ComoReservarPage() {
  return (
    <Pagina
      slug="como-reservar"
      emoji="📅"
      titulo="Cómo reservar"
      bajada="Cuatro pasos. Los dos primeros los haces desde el celular en un par de minutos."
      cta={<CtaArmar texto="Empezar ahora" nota="Puedes dejarlo a medias y retomarlo después" />}
    >
      {PASOS.map((p) => (
        <div key={p.n} className="flex gap-4">
          <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white"
            style={{ background: 'linear-gradient(135deg,#1565C0,#1976D2)' }}>
            {p.n}
          </div>
          <div className="pt-1">
            <p className="font-black text-gray-800">{p.t}</p>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{p.d}</p>
          </div>
        </div>
      ))}

      <Tarjeta titulo="El pago" acento="#16a34a">
        <p>
          Paga el <strong>{NEGOCIO.anticipoPorcentaje}% de anticipo</strong> y tu fecha queda reservada
          al instante, de forma automática. El saldo lo pagas <strong>{NEGOCIO.saldoVence}</strong>.
        </p>
        <p className="text-xs text-gray-500">
          Pagas online con Flow y eliges el medio habilitado que prefieras. Si usas crédito, las cuotas
          las define tu banco. WhatsApp queda como canal de ayuda — no es un paso necesario para reservar.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Antes del cumpleaños">
        <p>
          Desde Mi Celebración completas los datos finales: cantidad final de niños y lo que falte
          para dejar todo listo. Te recordamos cuando se acerque la fecha.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
