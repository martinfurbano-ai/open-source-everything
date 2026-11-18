import test from 'node:test';
import assert from 'node:assert/strict';
import { built, htmlFiles, read, pageFile } from './helpers.mjs';

test('empty coffee configuration removes support navigation, sections and buttons everywhere', async (t) => {
  const { out } = await built(t, { links: { coffee: '' } });
  for (const file of await htmlFiles(out)) assert.doesNotMatch(await read(file), /coffee|café|#support|id="support"/i);
});
test('configured coffee URL renders the localized support section and navigation', async (t) => {
  const coffee = 'https://buymeacoffee.com/example';
  const { out, pages, config } = await built(t, { links: { coffee } });
  for (const page of pages) for (const lang of config.locales) {
    const path = page.paths[lang];
    const label = lang === 'en' ? 'Buy a coffee' : 'Invitar un café';
    const html = await read(pageFile(out, path));
    if (page.type === 'hub') assert.match(html, /id="support"/);
    const nav = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.match(nav, /<a href="\/(?:es\/)?#support">/, path);
    assert.ok(html.includes(`href="${coffee}"`));
    assert.ok(html.includes(label));
  }
});
