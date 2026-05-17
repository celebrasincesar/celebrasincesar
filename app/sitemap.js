export default function sitemap() {
  return [
    {
      url: 'https://celebrasincesar.cl',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://celebrasincesar.cl/terminos',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];
}
