# Open Source Everything

Free, open source versions of apps that charge a subscription. This repository is the hub site at https://opensource.dalepanama.com: a bilingual (English and Spanish) static site with no runtime dependencies, no analytics and no third-party requests.

Made by Martín Urbano. Follow along on Instagram: https://www.instagram.com/opensourceeverything/

## Projects

- [Speak Away](https://github.com/martinfurbano-ai/speak-away): voice dictation and meeting notes that run on your own computer. Page: https://opensource.dalepanama.com/speak-away/

## Run it locally

Use Node 20 or newer. There is no install step and the build makes no network requests.

```sh
npm test
npm run build
npm run serve
```

`npm test` runs the node:test suite, `npm run build` writes `dist/`, and `npm run serve` previews it at http://127.0.0.1:4173 (or the port in `PORT`), applying `dist/_headers` to responses. Stop it with Ctrl+C.

The build replaces `dist/` and writes the localized pages, a bilingual 404 page, SEO files, security headers and content-hashed assets. `build.mjs` exports `build({ root, outDir, config })`. Config overrides merge with `site.config.json`, including its `links` object. Use a dedicated output directory, because a build removes its previous contents.

## Configuration

`site.config.json` holds the site URL, brand, author, locales and the `links` object (`github`, `instagram`, `coffee`). `links.coffee` is an optional support link: when it is an HTTPS URL, the hub shows a support section and a navigation item in both languages; when it is empty, nothing support-related renders anywhere.

## Add a project

1. Create `projects/<slug>/project.json` with `slug`, numeric `order`, `repo`, `download`, `license` and any additional project values.
2. Add `i18n/card.en.json` and `i18n/card.es.json` with the same card keys as Speak Away. Lower order values appear first on the hub.
3. Add the project's HTML templates and matching English and Spanish dictionaries, using the template syntax below.
4. Register each page in `src/pages.json`, including its template, dictionary stems, paths, CSS, JS and type. Its landing page must have type `project` and the matching `project` slug.
5. Run the tests and the build. The hub discovers the project automatically, and every registered page gets localized metadata and sitemap entries.

Common dictionaries load first; page dictionary stems load in order, with later values winning. Text placeholders are escaped; `h:` is reserved for reviewed HTML using the tag allowlist below. Images are local under `public/`, fonts and icons under `vendor/`; keep their licenses next to the vendored files.

## Template syntax

- `{{t:key}}`: HTML-escaped text from the merged dictionary of the page and locale.
- `{{h:key}}`: trusted HTML from a dictionary. Allowed tags: `a`, `br`, `em`, `strong`, `code`, `kbd`, `span`.
- `{{icon:name}}`: inlines `vendor/phosphor/regular/name.svg`. An unknown icon is a build error.
- `{{asset:path}}`: content-hashed URL of a file under `public/`.
- `{{url:id}}`: URL of a page in the current locale; `{{url:id@en}}` and `{{url:id@es}}` pick a locale.
- `{{cfg:path.to.value}}`: escaped value from `site.config.json`. `{{pj:key}}`: value from the current project's `project.json`.
- `{{lang}}`: current locale code. `{{head}}` and `{{scripts}}` are filled in by the generator.
- `{{#if cfg:links.coffee}}...{{/if}}`: renders the block only when the value is a non-empty string. Blocks do not nest.
- `{{#projects}}...{{/projects}}`: repeats the block once per project, exposing `{{p:key}}` (the project's card strings) and `{{pj:key}}`.

## Deployment

The site is published as Cloudflare Worker static assets: `wrangler.jsonc` serves `dist/` on https://opensource.dalepanama.com and has no Worker script or bindings. To deploy your own copy, set your own `account_id` and domain in `wrangler.jsonc`, then:

```sh
npm test && npm run build && npx wrangler deploy
```

## License

MIT, see `LICENSE`. The Geist fonts (SIL Open Font License 1.1) and the Phosphor icons (MIT) are vendored under `vendor/` with their licenses.
