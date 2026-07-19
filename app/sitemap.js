export default function sitemap() {
  return [
    {
      url: 'https://celebrasincesar.cl',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://celebrasincesar.cl/catalogo',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://celebrasincesar.cl/terminos',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // /confirmacion excluida a propósito: formulario privado pre-evento (noindex)
    // /armar excluida a propósito: canonical → home (mismo contenido)
  ];
}
