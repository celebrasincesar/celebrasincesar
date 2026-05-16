/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Dominios externos permitidos (Unsplash eliminado — ya no se usa)
    remotePatterns: [],
    // WebP y AVIF se generan automáticamente por Next.js
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
