/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Dominios externos permitidos (Unsplash eliminado — ya no se usa)
    remotePatterns: [],
    // WebP y AVIF se generan automáticamente por Next.js
    formats: ['image/avif', 'image/webp'],
  },
  // Encabezados de seguridad básicos (auditoría 19-oct-2026). Sin CSP a
  // propósito: el sitio carga GA, Flow, mapas y fuentes externas y una CSP
  // mal armada rompe pagos; se hace aparte, con pruebas.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
