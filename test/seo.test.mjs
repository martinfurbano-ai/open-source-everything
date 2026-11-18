import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { built, pageFile, read, tags } from './helpers.mjs';

test('six pages have complete localized heads and reciprocal alternates', async (t) => {
  const { out, pages, config } = await built(t);
  for (const page of pages) for (const lang of config.locales) {
    const html = await read(pageFile(out, page.paths[lang]));
    assert.equal(tags(html, 'html')[0].lang, lang);
    const titles = [...html.matchAll(/<title>(.*?)<\/title>/g)];
    assert.equal(titles.length, 1);
    assert.ok(titles[0][1].length <= 62);
    const metas = tags(html, 'meta');
    const description = metas.find((m) => m.name === 'description').content;
    assert.ok(description.length >= 110 && description.length <= 165, description);
    const links = tags(html, 'link');
    const absolute = config.siteUrl + page.paths[lang];
    assert.equal(links.find((l) => l.rel === 'canonical').href, absolute);
    for (const target of ['en', 'es', 'x-default']) {
      assert.equal(links.find((l) => l.hreflang === target).href, config.siteUrl + page.paths[target === 'x-default' ? 'en' : target]);
    }
    const og = Object.fromEntries(metas.filter((m) => m.property).map((m) => [m.property, m.content]));
    assert.equal(og['og:url'], absolute);
    assert.equal(og['og:title'], titles[0][1]);
    assert.equal(og['og:description'], description);
    assert.equal(og['og:type'], 'website');
    assert.equal(og['og:site_name'], config.brand);
    assert.equal(og['og:image'], config.siteUrl + '/icon-512.png');
    assert.equal(og['og:locale'], lang === 'en' ? 'en_US' : 'es_LA');
    assert.equal(og['og:locale:alternate'], lang === 'en' ? 'es_LA' : 'en_US');
    assert.equal(metas.find((m) => m.name === 'twitter:card').content, 'summary');
    assert.equal(metas.find((m) => m.name === 'color-scheme').content, 'light dark');
    assert.equal(metas.filter((m) => m.name === 'theme-color' && m.media).length, 2);
    assert.ok(links.some((l) => l.rel === 'preload' && l.as === 'font' && l.type === 'font/woff2'));
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<script src="\/assets\/js\/lang\.[a-f0-9]{8}\.js"><\/script>/);
  }
});
test('sitemap has all six URLs and alternates; robots points to it', async (t) => {
  const { out, pages, config } = await built(t);
  const sitemap = await read(join(out, 'sitemap.xml'));
  const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
  const expected = pages.flatMap((page) => config.locales.map((lang) => ({ page, loc: config.siteUrl + page.paths[lang] })));
  assert.equal(blocks.length, expected.length);
  const locations = blocks.map((block) => {
    const locs = [...block.matchAll(/<loc>([^<]+)<\/loc>/g)];
    assert.equal(locs.length, 1);
    const loc = locs[0][1];
    const entry = expected.find((item) => item.loc === loc);
    assert.ok(entry, `unexpected sitemap loc ${loc}`);
    const alternates = tags(block, 'xhtml:link');
    assert.equal(alternates.length, 3, loc);
    assert.deepEqual(alternates.map((link) => link.hreflang).sort(), ['en', 'es', 'x-default']);
    for (const link of alternates) {
      assert.equal(link.rel, 'alternate');
      assert.equal(link.href, config.siteUrl + entry.page.paths[link.hreflang === 'x-default' ? 'en' : link.hreflang], loc);
    }
    return loc;
  });
  assert.deepEqual(locations.sort(), expected.map((entry) => entry.loc).sort());
  assert.doesNotMatch(sitemap, /lastmod/);
  assert.equal(await read(join(out, 'robots.txt')), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

test('404 head has a bounded title and description, noindex and no canonical', async (t) => {
  const { out } = await built(t);
  const html = await read(join(out, '404.html'));
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const titles = [...head.matchAll(/<title>(.*?)<\/title>/g)];
  assert.equal(titles.length, 1);
  assert.ok(titles[0][1].trim().length > 0 && titles[0][1].length <= 62);
  const descriptions = tags(head, 'meta').filter((meta) => meta.name === 'description');
  assert.equal(descriptions.length, 1);
  assert.ok(descriptions[0].content.length >= 110 && descriptions[0].content.length <= 165);
  assert.ok(tags(head, 'meta').some((meta) => meta.name === 'robots' && meta.content.split(/[\s,]+/).includes('noindex')));
  assert.ok(!tags(head, 'link').some((link) => link.rel === 'canonical'));
});
