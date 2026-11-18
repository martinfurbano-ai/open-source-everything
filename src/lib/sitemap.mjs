import { escapeHtml as e } from './files.mjs';

export function sitemap(pages, config) {
  const urls = pages.flatMap((page) => config.locales.map((locale) => {
    const alternates = ['en', 'es', 'x-default'].map((lang) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${e(config.siteUrl + page.paths[lang === 'x-default' ? 'en' : lang])}"/>`).join('\n');
    return `  <url>\n    <loc>${e(config.siteUrl + page.paths[locale])}</loc>\n${alternates}\n  </url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}
