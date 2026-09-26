import { NEGOCIO } from '../../data/master';
import { Pagina, Tarjeta, CtaWhatsApp, metaRespuesta } from '../paginas-respuesta';
import Link from 'next/link';

export const metadata = metaRespuesta(
  'visitar',
  'Visitar el lugar',
  'Ven a conocer Alce Kids antes de reservar, sin compromiso. Agenda tu visita online o coordina por WhatsApp.'
);

export default function VisitarPage() {
  return (
    <Pagina
      slug="visitar"
      emoji="👀"
      titulo="Ven a conocerlo"
      bajada="La mayoría de las familias reserva después de venir. Ver el espacio con tus propios ojos vale más que cualquier foto."
      cta={
        // Dos caminos, sin eliminar el canal humano (documento "FASE 3A —
        // VISITAS AUTOGESTIONADAS — IMPLEMENTAR BLOQUE B", 22-sep-2026,
        // §14): quien quiere resolverlo ahora, agenda solo; quien prefiere
        // hablar con alguien, sigue teniendo WhatsApp exactamente igual.
        <div className="space-y-3">
          <Link href="/visitas"
            className="block w-full text-center text-white font-black py-4 rounded-2xl transition-transform hover:scale-[1.01]"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 20px rgba(249,115,22,0.3)' }}>
            Agendar una visita →
          </Link>
          <CtaWhatsApp
            texto="Coordinar por WhatsApp"
            mensaje="¡Hola César! Me gustaría conocer Alce Kids antes de reservar. ¿Qué día te acomoda?"
            nota="Sin compromiso. Te mostramos todo el recinto."
          />
        </div>
      }
    >
      <Tarjeta titulo="Cómo funciona">
        <p>
          Eliges tú el día y la hora disponibles y agendas online en pocos pasos. Recorres el recinto
          completo: los juegos, el salón, la granja, los sectores y los estacionamientos. Si
          prefieres conversarlo antes, también puedes coordinar por WhatsApp.
        </p>
        <p>Puedes venir con tu hijo. Normalmente es lo que termina de decidir.</p>
      </Tarjeta>

      <Tarjeta titulo="Mientras tanto" acento="#F97316">
        <p>
          Puedes ver todas las fotos del recinto en{' '}
          <Link href="/alce-kids" className="font-bold underline" style={{ color: '#1565C0' }}>la página de Alce Kids</Link>{' '}
          y revisar <Link href="/ubicacion" className="font-bold underline" style={{ color: '#1565C0' }}>dónde estamos</Link>.
        </p>
      </Tarjeta>
    </Pagina>
  );
}
