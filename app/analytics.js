import Script from 'next/script';
import { GA_ID } from '../data/analytics';

// Carga Google Analytics 4 SOLO si NEXT_PUBLIC_GA_ID está configurado.
// Sin la variable no se descarga ni un byte de script de terceros: la web
// sigue funcionando igual y el rendimiento no se resiente (§BR).
//
// `afterInteractive` = se carga después de que la página ya es usable, así
// la medición no compite con el primer render.
export default function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
