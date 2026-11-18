import { readdirSync, rmSync, existsSync, realpathSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { within, readJson, readText, write } from './src/lib/files.mjs';
import { loadI18n } from './src/lib/i18n.mjs';
import { render } from './src/lib/template.mjs';
import { createAssets } from './src/lib/assets.mjs';
import { iconReader } from './src/lib/icons.mjs';
import { head } from './src/lib/head.mjs';
import { headers } from './src/lib/headers.mjs';
import { sitemap } from './src/lib/sitemap.mjs';
import { notFound } from './src/lib/not-found.mjs';

const defaultRoot = dirname(fileURLToPath(import.meta.url));
function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('../') && path !== '..' && !isAbsolute(path));
}
function physicalPath(path) {
  if (existsSync(path)) return realpathSync(path);
  return join(physicalPath(dirname(path)), path.slice(dirname(path).length + 1));
}
function validateOutput(root, outDir) {
  const destination = physicalPath(outDir);
  const source = realpathSync(root);
  const temporary = realpathSync(tmpdir());
  const dist = join(realpathSync(defaultRoot), 'dist');
  const temporaryOutput = destination !== temporary && contains(temporary, destination);
  const sourceOutput = contains(source, destination) && destination !== join(source, 'dist');
  const existingFile = existsSync(outDir) && !lstatSync(outDir).isDirectory();
  if (existingFile || contains(destination, source) || sourceOutput || (destination !== dist && !temporaryOutput)) {
    throw new Error(`build: unsafe outDir ${outDir}; use the repo dist folder or a directory under os.tmpdir()`);
  }
}
function validate(config, pages) {
  if (JSON.stringify(config.locales) !== '["en","es"]' || config.defaultLocale !== 'en') throw new Error('site.config.json: locales must be en, es; defaultLocale must be en');
  const site = new URL(config.siteUrl);
  if (!['http:', 'https:'].includes(site.protocol) || site.pathname !== '/' || site.search || site.hash || config.siteUrl.endsWith('/')) throw new Error('site.config.json: siteUrl must be an origin without trailing slash');
  for (const [key, value] of Object.entries(config.links)) {
    if (key === 'coffee' && value === '') continue;
    if (typeof value !== 'string' || !/^https:\/\//.test(value)) throw new Error(`site.config.json: links.${key} must be an HTTPS URL`);
    new URL(value);
  }
  const paths = pages.flatMap((page) => config.locales.map((lang) => page.paths[lang]));
  if (new Set(pages.map((p) => p.id)).size !== pages.length) throw new Error('src/pages.json: duplicate id');
  if (new Set(paths).size !== paths.length) throw new Error('src/pages.json: duplicate path');
  for (const path of paths) if (typeof path !== 'string' || !/^\/(?:[a-z0-9-]+\/)*$/.test(path)) throw new Error(`src/pages.json: invalid path ${path}`);
}
function loadProjects(root, pages) {
  return readdirSync(join(root, 'projects'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const file = `projects/${entry.name}/project.json`;
    const data = readJson(join(root, file));
    if (data.slug !== entry.name || !Number.isFinite(data.order)) throw new Error(`${file}: invalid slug or order`);
    const page = pages.find((candidate) => candidate.type === 'project' && candidate.project === data.slug);
    if (!page) throw new Error(`${file}: missing landing page in src/pages.json`);
    return { data, page };
  }).sort((a, b) => a.data.order - b.data.order || a.data.slug.localeCompare(b.data.slug, 'en'));
}
function localizedProject(data, url, lang) {
  if (!data.privacyUpdated) return { ...data, url };
  const date = new Date(`${data.privacyUpdated}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.privacyUpdated) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.privacyUpdated) {
    throw new Error(`projects/${data.slug}/project.json: invalid privacyUpdated ${data.privacyUpdated}`);
  }
  const privacyUpdatedLabel = new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  return { ...data, url, privacyUpdatedLabel };
}
export async function build(options = {}) {
  const root = resolve(options.root ?? defaultRoot);
  const outDir = resolve(root, options.outDir ?? 'dist');
  validateOutput(root, outDir);
  const defaults = readJson(join(root, 'site.config.json'));
  const config = { ...defaults, ...options.config, links: { ...defaults.links, ...options.config?.links } };
  const pages = readJson(join(root, 'src/pages.json'));
  validate(config, pages);
  const projects = loadProjects(root, pages);
  rmSync(outDir, { recursive: true, force: true });
  const assets = createAssets(root, outDir);
  assets.copyRoot();
  const langScript = assets.script('src/js/lang.js');
  const font = assets.fonts['Geist-Variable.woff2'];
  for (const page of pages) {
    const source = readText(within(root, page.template));
    const css = assets.stylesheet(page);
    const scripts = page.js.map((path) => `<script src="${assets.script(path)}" defer></script>`).join('\n');
    for (const lang of config.locales) {
      const i18n = loadI18n(root, page.i18n, lang);
      const localizedProjects = projects.map(({ data, page: landing }) => ({
        data: localizedProject(data, landing.paths[lang], lang),
        card: readJson(join(root, `projects/${data.slug}/i18n/card.${lang}.json`)),
      }));
      const result = render(source, {
        file: page.template, lang, config, pages, i18n, scripts,
        head: head({ config, page, lang, i18n, css, langScript, font }),
        projects: localizedProjects, project: localizedProjects.find((p) => p.data.slug === page.project)?.data,
        icon: iconReader(root), asset: assets.publicAsset,
      });
      write(within(outDir, `.${page.paths[lang]}index.html`), result);
    }
  }
  const hub = pages.find((page) => page.type === 'hub');
  write(join(outDir, '404.html'), notFound({ config, page: hub, css: assets.stylesheet(hub), langScript, font }));
  write(join(outDir, '_headers'), headers);
  write(join(outDir, 'sitemap.xml'), sitemap(pages, config));
  write(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
  return { outDir, pages: pages.length * config.locales.length, notFound: 1 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await build();
    console.log(`Built ${result.pages} localized pages + ${result.notFound} bilingual 404 page in dist/.`);
    console.log('Generated sitemap.xml, robots.txt, _headers, hashed assets and 3 root icons.');
  } catch (error) { console.error(`Build failed: ${error.message}`); process.exitCode = 1; }
}
