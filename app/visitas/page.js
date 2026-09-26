import { NEGOCIO } from '../../data/master';
import VisitasFlow from './visitas-flow';

export const metadata = {
  title: 'Agenda tu visita',
  description: 'Agenda una visita para conocer Alce Kids antes de reservar.',
  alternates: { canonical: `${NEGOCIO.sitio}/visitas` },
};

export default function VisitasPage() {
  return <VisitasFlow />;
}
