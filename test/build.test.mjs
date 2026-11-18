import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { built, fixture, read, json, root, temporary } from './helpers.mjs';

test('build writes six localized pages, root assets and generated documents', async (t) => {
  const { out } = await built(t);
  for (const file of ['index.html', 'es/index.html', 'speak-away/index.html',
    'es/speak-away/index.html', 'speak-away/privacy/index.html',
    'es/speak-away/privacidad/index.html', '404.html', 'robots.txt', 'sitemap.xml',
    '_headers', 'favicon.png', 'apple-touch-icon.png', 'icon-512.png']) {
    await access(join(out, file));
  }
  const missing = await read(join(out, '404.html'));
  assert.match(missing, /name="robots" content="noindex"/);
  assert.match(missing, /href="\/"/);
  assert.match(missing, /href="\/es\/"/);
  assert.match(missing, /lang="es"/);
});

test('build cleans output, is reproducible, and leaves the config override unchanged', async (t) => {
  const dir = await fixture(t);
  const { build } = await import('../build.mjs');
  const out = join(dir, 'dist');
  await mkdir(out);
  await writeFile(join(out, 'stale.txt'), 'old');
  const config = { links: { coffee: '' } };
  await build({ root: dir, outDir: out, config });
  await assert.rejects(access(join(out, 'stale.txt')));
  const before = await read(join(out, 'index.html'));
  await build({ root: dir, outDir: out, config });
  assert.equal(await read(join(out, 'index.html')), before);
  assert.deepEqual(config, { links: { coffee: '' } });
});

for (const [label, snippet, error] of [
  ['missing i18n key', '{{t:missing.key}}', /hub\.html.*missing.key/i],
  ['missing icon', '{{icon:not-an-icon}}', /hub\.html.*not-an-icon/i],
  ['missing asset', '{{asset:img/missing.webp}}', /hub\.html.*img\/missing.webp/i],
  ['unknown placeholder', '{{unexpected:thing}}', /hub\.html.*unexpected:thing/i],
  ['nested if', '{{#if cfg:links.coffee}}{{#if cfg:links.coffee}}x{{/if}}{{/if}}', /hub\.html.*nested.*if/i],
  ['unclosed block', '{{#projects}}x', /hub\.html.*unclosed/i],
]) {
  test(`build rejects ${label} with file and key context`, async (t) => {
    const dir = await fixture(t);
    const registry = await json(join(dir, 'src/pages.json'));
    const file = join(dir, registry.find((page) => page.id === 'hub').template);
    await writeFile(file, (await read(file)) + snippet);
    const { build } = await import('../build.mjs');
    await assert.rejects(build({ root: dir, outDir: join(dir, 'dist') }), error);
  });
}

test('build accepts a separate temporary output directory and protects source directories', async (t) => {
  const dir = await fixture(t);
  const { temporary } = await import('./helpers.mjs');
  const outDir = join(await temporary(t), 'output');
  const { build } = await import('../build.mjs');
  await build({ root: dir, outDir });
  await access(join(outDir, 'index.html'));
  for (const unsafe of [dir, join(dir, 'src'), join(dir, '.git')]) {
    await assert.rejects(build({ root: dir, outDir: unsafe }), /unsafe outDir/);
  }
});

test('unsafe output paths throw before deleting existing files or the repo root', async (t) => {
  const dir = await temporary(t);
  const file = join(dir, 'README.md');
  const contents = 'Do not delete this file.';
  await writeFile(file, contents);
  const { build } = await import('../build.mjs');
  const original = await read(join(root, 'README.md'));
  for (const outDir of [file, root, join(root, 'README.md'), join(root, 'unapproved-output')]) {
    await assert.rejects(build({ outDir }), (error) => {
      assert.ok(error.message.includes(outDir), error.message);
      assert.match(error.message, /unsafe outDir/);
      return true;
    });
    assert.equal(await read(file), contents);
    assert.equal(await read(join(root, 'README.md')), original);
  }
});
