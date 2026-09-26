import { Suspense } from 'react';
import GestionarVisita from './gestionar-visita';

// Página privada por token — fuera de buscadores.
export const metadata = { title: 'Gestionar mi visita', robots: { index: false, follow: true } };

export default function GestionarVisitaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" style={{ background: '#F8FAFF' }} />}>
      <GestionarVisita />
    </Suspense>
  );
}
