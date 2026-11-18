import { escapeHtml as e } from './files.mjs';
import { head } from './head.mjs';

export function notFound(options) {
  const content = head({ ...options, lang: 'en', notFound: true, i18n: {
    'meta.title': 'Page not found | Open Source Everything',
    'meta.description': 'This page could not be found. Explore free, open source projects from Open Source Everything, available in English and Spanish.',
  } });
  return `<!doctype html>
<html lang="en">
<head>${content}</head>
<body>
<a class="skip-link" href="#main">Skip to content / <span lang="es">Saltar al contenido</span></a>
<header class="site-header"><nav class="wrap nav-inner" aria-label="Navigation"><a class="brand" href="/"><img src="/favicon.png" width="32" height="32" alt="">${e(options.config.brand)}</a></nav></header>
<main id="main" class="wrap not-found"><h1>Page not found. <span lang="es">Página no encontrada.</span></h1>
<p>Explore our projects. <span lang="es">Explora nuestros proyectos.</span></p>
<div class="actions"><a class="btn btn-primary" href="/" lang="en">English</a><a class="btn btn-ghost" href="/es/" lang="es">Español</a></div></main>
<footer><div class="wrap"><p>Made by ${e(options.config.author)} for ${e(options.config.brand)}.</p><p lang="es">Hecho por ${e(options.config.author)} para ${e(options.config.brand)}.</p></div></footer>
</body></html>\n`;
}
