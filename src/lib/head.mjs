import { escapeHtml as e } from './files.mjs';

export function head({ config, page, lang, i18n, css, langScript, font, notFound = false }) {
  const absolute = (locale) => config.siteUrl + page.paths[locale];
  const title = i18n['meta.title'];
  const description = i18n['meta.description'];
  for (const [key, value] of [['meta.title', title], ['meta.description', description]]) {
    if (!value) throw new Error(`${page.template}: missing i18n ${key}`);
  }
  const alternate = lang === 'en' ? 'es' : 'en';
  const locales = { en: 'en_US', es: 'es_LA' };
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}">`,
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#f3f4f5" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0e0f10" media="(prefers-color-scheme: dark)">',
    ...(notFound ? ['<meta name="robots" content="noindex">'] : [
      `<link rel="canonical" href="${e(absolute(lang))}">`,
      ...['en', 'es', 'x-default'].map((locale) => `<link rel="alternate" hreflang="${locale}" href="${e(absolute(locale === 'x-default' ? 'en' : locale))}">`),
    ]),
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${e(config.brand)}">`,
    `<meta property="og:title" content="${e(title)}">`,
    `<meta property="og:description" content="${e(description)}">`,
    `<meta property="og:url" content="${e(notFound ? config.siteUrl + '/404.html' : absolute(lang))}">`,
    `<meta property="og:image" content="${e(config.siteUrl)}/icon-512.png">`,
    `<meta property="og:locale" content="${locales[lang]}">`,
    `<meta property="og:locale:alternate" content="${locales[alternate]}">`,
    '<meta name="twitter:card" content="summary">',
    '<link rel="icon" type="image/png" href="/favicon.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    `<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${css}">`,
    `<script src="${langScript}"></script>`,
  ].join('\n');
}
