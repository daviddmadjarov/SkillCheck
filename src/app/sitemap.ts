import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://skillcheck.online';

  const staticPages = [
    '',
    '/about',
    '/faq',
    '/privacy-policy',
    '/tos',
    '/imprint',
    '/contact-us',
    '/lab-results',
    '/daily',
    '/duel',
    '/party/create',
    '/party/join',
    '/category/reaction',
    '/category/aim',
    '/category/typing',
    '/category/mouse',
    '/category/rhythm',
    '/category/thinking',
  ];

  return staticPages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: page === '' ? 1.0 : 0.8,
  }));
}