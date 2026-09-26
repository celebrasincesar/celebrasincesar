'use client';

// ══════════════════════════════════════════════════════════════════════
// /alce-kids — LA PÁGINA DEL RECINTO
// ──────────────────────────────────────────────────────────────────────
// Para el papá que pregunta "¿cómo es el lugar?": video, fotos, piscina de
// pelotas, tobogán, autopista, granja, salón, sectores, qué incluye,
// lluvia, testimonios, ubicación y visita.
// Es el mismo componente que antes vivía dentro de /armar — no hay copia.
// ══════════════════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation';
import { Header, PageAlce, Footer, WhatsAppFab } from '../celebra-ui';

export default function AlceKidsLanding() {
  const router = useRouter();
  return (
    <>
      <Header onHome={() => router.push('/')} variant="alce" />
      <PageAlce onIniciarWizard={() => router.push('/armar')} />
      <Footer />
      <WhatsAppFab />
    </>
  );
}
