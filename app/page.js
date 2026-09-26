'use client';

// ══════════════════════════════════════════════════════════════════════
// HOME — celebrasincesar.cl
// ──────────────────────────────────────────────────────────────────────
// Cuatro trabajos, ninguno más: decir qué es Celebra Sin Cesar, generar
// confianza, posicionar Alce Kids y mandar al papá a la acción correcta.
// El recorrido largo del recinto vive en /alce-kids; el armador en /armar.
// ══════════════════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation';
import { Header, CardInicio, Footer, WhatsAppFab } from './celebra-ui';

export default function HomePage() {
  const router = useRouter();
  return (
    <>
      <Header onHome={() => router.push('/')} />
      <CardInicio onSelect={(tipo) => router.push(tipo === 'alce' ? '/alce-kids' : '/armar')} />
      <Footer />
      <WhatsAppFab />
    </>
  );
}
