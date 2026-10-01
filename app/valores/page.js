import { PRECIOS_BASE, PRECIOS_EXTRAS, MULTIPLICADORES, NEGOCIO } from '../../data/master';
import { TRAMOS_INVITADOS } from '../../data/reglas';
import { Pagina, Tarjeta, CtaArmar, metaRespuesta } from '../paginas-respuesta';

export const metadata = metaRespuesta(
  'valores',
  'Valores y tramos',
  'Cómo se calcula el valor de un cumpleaños en Alce Kids: sector, cantidad de niños, día y edad del festejado. Reserva con el 50%.'
);

const clp = (n) => `$${n.toLocaleString('es-CL')}`;

// Todos los números salen del motor de precios. Si César cambia la tabla en
// data/master.js, esta página cambia sola: nunca hay un precio escrito a mano.
const addCantidad = (id) => MULTIPLICADORES.cantidad.find((c) => c.id === id)?.add ?? 0;
const addEdadMax = Math.max(...MULTIPLICADORES.edad.map((e) => e.add));
const recargoSabado = PRECIOS_BASE.completo_10_sab - PRECIOS_BASE.completo_10;

const filas = TRAMOS_INVITADOS.map((t) => ({
  tramo: t.label,
  // "Desde" = festejado de 1 a 3 años, viernes o domingo.
  completo: PRECIOS_BASE.completo_10 + addCantidad(t.cantNinos),
  independiente: t.id === 'hasta10' ? PRECIOS_BASE.independiente : null,
  extra: t.pideExacto,
}));

export default function ValoresPage() {
  return (
    <Pagina
      slug="valores"
      emoji="💰"
      titulo="Cómo funcionan los valores"
      bajada="Arriendas el recinto y sumas solo lo que necesites. El valor del arriendo depende de cuatro cosas."
      cta={<CtaArmar texto="Ver el valor de mi fecha" nota="El armador calcula el total exacto según tu día" />}
    >
      <Tarjeta titulo="1 · Cuántos niños vienen">
        <div className="overflow-x-auto -mx-1 px-1" tabIndex={0} role="region" aria-label="Tabla de valores por cantidad de niños">
          <table className="w-full text-sm" style={{ minWidth: '300px' }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 font-black">Niños</th>
                <th className="pb-2 font-black">Sector Independiente</th>
                <th className="pb-2 font-black">Recinto Completo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.tramo} style={{ borderTop: '1px solid rgba(21,101,192,0.1)' }}>
                  <td className="py-2.5 font-bold text-gray-700">{f.tramo}</td>
                  <td className="py-2.5 text-gray-500">
                    {f.independiente ? `desde ${clp(f.independiente)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 font-bold" style={{ color: '#1565C0' }}>
                    desde {clp(f.completo)}{f.extra ? ' +' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          El Sector Independiente está disponible para celebraciones de hasta 10 niños y sin invitados
          mayores de 6 años. Desde ahí la celebración va en el Recinto Completo.
          Sobre 30 niños, cada niño adicional suma {clp(PRECIOS_EXTRAS.nino_extra)}.
        </p>
      </Tarjeta>

      <Tarjeta titulo="2 · Qué día celebras" acento="#F97316">
        <p>
          Viernes y domingo tienen el mismo valor. El <strong>sábado suma {clp(recargoSabado)}</strong>,
          porque es el día más pedido.
        </p>
      </Tarjeta>

      <Tarjeta titulo="3 · Qué edad cumple" acento="#F97316">
        <p>
          El valor del arriendo sube según la edad que cumple el festejado. Es un recargo único
          sobre el arriendo, sin cobros aparte, y ya viene incluido en el valor que ves:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 mt-1">
          {MULTIPLICADORES.edad.map((e) => (
            <li key={e.edades.join('-')}>
              <strong>{e.edades.length > 1 ? `${e.edades[0]} a ${e.edades[e.edades.length - 1]} años` : `${e.edades[0]} años`}:</strong>{' '}
              {e.add === 0 ? 'sin recargo' : `+${clp(e.add)}`}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          Máximo {clp(addEdadMax)} sobre el valor base.
        </p>
      </Tarjeta>

      <Tarjeta titulo="4 · Qué le sumas" acento="#F97316">
        <p>
          Inflables, animación, decoración, juegos y banquetería son opcionales y los eliges tú en
          el <a href="/catalogo" className="font-bold underline" style={{ color: '#1565C0' }}>catálogo</a>.
          Si vienen niños mayores de 6 años incorporamos una configuración de entretención adecuada
          para ellos — te la explicamos <a href="/mayores-de-6" className="font-bold underline" style={{ color: '#1565C0' }}>acá</a>.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Cómo se paga" acento="#16a34a">
        <p>
          Reservas con el <strong>{NEGOCIO.anticipoPorcentaje}% del valor total</strong> como anticipo y el saldo lo pagas{' '}
          <strong>{NEGOCIO.saldoVence}</strong>. La fecha queda reservada apenas se acredita el anticipo.
        </p>
        <p className="text-xs text-gray-500">
          El pago es online con Flow: eliges entre los medios habilitados (débito, crédito, prepago o
          transferencia). Si usas crédito, las cuotas las define tu banco; Alce Kids no ofrece
          financiamiento propio. Después completas los datos finales en Mi Celebración.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
