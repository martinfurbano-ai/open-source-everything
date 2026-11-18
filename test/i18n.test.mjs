import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { root, files, read, json } from './helpers.mjs';

test('locale dictionaries have matching keys and exact consumers of the correct token kind', async () => {
  const dictionaries = (await Promise.all(['src/i18n', 'projects'].map((dir) => files(join(root, dir))))).flat().filter((file) => file.endsWith('.en.json'));
  assert.ok(dictionaries.length >= 5);
  const registry = await json(join(root, 'src/pages.json'));
  const templates = await Promise.all(registry.map(async (page) => {
    const source = await read(join(root, page.template));
    const tokens = [...source.matchAll(/{{\s*(t|h|p|pj):([^}\s]+)\s*}}/g)];
    const sets = Object.fromEntries(['t', 'h', 'p', 'pj'].map((kind) => [kind, new Set(tokens.filter((match) => match[1] === kind).map((match) => match[2]))]));
    return { ...page, source, sets };
  }));
  for (const file of dictionaries) {
    const en = await json(file);
    const es = await json(file.replace('.en.json', '.es.json'));
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), file);
    const stem = file.slice(root.length + 1, -8);
    const common = stem === 'src/i18n/common';
    const card = stem.endsWith('/card');
    const consumers = templates.filter((page) => common || page.i18n.includes(stem) || (card && page.source.includes('{{#projects}}')));
    assert.ok(consumers.length, `${stem}: no template`);
    const uses = (page, key) => card ? page.sets.p.has(key)
      : page.sets.t.has(key) || page.sets.h.has(key) || (['meta.title', 'meta.description'].includes(key) && page.source.includes('{{head}}'));
    for (const key of Object.keys(en)) {
      assert.ok(common ? consumers.some((page) => uses(page, key)) : consumers.every((page) => uses(page, key)), `${file}: unused ${key} in its consuming templates`);
    }
    for (const locale of [en, es]) for (const page of consumers) for (const key of page.sets.h) {
      if (!Object.hasOwn(locale, key)) continue;
      const { render } = await import('../src/lib/template.mjs');
      assert.equal(render(`{{h:${key}}}`, { file, i18n: locale }), locale[key]);
    }
  }
});
test('i18n merge applies common first and later stems win without mutation', async (t) => {
  const { mergeDictionaries } = await import('../src/lib/i18n.mjs');
  const first = { shared: 'common', stable: 'yes' };
  assert.deepEqual(mergeDictionaries([first, { shared: 'page' }]), { shared: 'page', stable: 'yes' });
  assert.equal(first.shared, 'common');
});
