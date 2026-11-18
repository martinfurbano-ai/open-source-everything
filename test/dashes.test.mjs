import test from 'node:test';
import assert from 'node:assert/strict';
import { join, extname, basename } from 'node:path';
import { root, built, filesIfPresent, read } from './helpers.mjs';

test('all authored text and output are free of both forbidden dash code points', async (t) => {
  const { out } = await built(t);
  const directories = [out, ...['src', 'projects', 'test', 'docs', 'scripts'].map((p) => join(root, p))];
  const all = (await Promise.all(directories.map((directory) => filesIfPresent(directory)))).flat().concat(['README.md', 'build.mjs', 'site.config.json', 'wrangler.jsonc', 'package.json'].map((p) => join(root, p)));
  const extensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.jsonc', '.txt', '.xml', '.md', '.svg']);
  for (const file of all.filter((p) => extensions.has(extname(p)) || basename(p) === '_headers')) {
    assert.doesNotMatch(await read(file), /[\u2013\u2014]/u, file);
  }
});
