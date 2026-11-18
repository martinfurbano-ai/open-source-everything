import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { root, built, files, read } from './helpers.mjs';

const EXPECTED_HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; manifest-src 'self'
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

test('asset filenames are the first eight SHA256 hex characters of their contents', async (t) => {
  const { out } = await built(t);
  const assets = await files(join(out, 'assets'));
  assert.ok(assets.some((p) => p.endsWith('.woff2')));
  for (const file of assets) {
    const hash = createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 8);
    assert.ok(basename(file).includes(`.${hash}.`), file);
  }
  for (const name of ['lang', 'ui']) {
    const output = assets.find((p) => basename(p).startsWith(`${name}.`) && p.endsWith('.js'));
    assert.equal(await read(output), await read(join(root, 'src/js', `${name}.js`)));
  }
});
test('headers include strict CSP and immutable asset caching', async (t) => {
  const { out } = await built(t);
  const text = await read(join(out, '_headers'));
  assert.equal(text, EXPECTED_HEADERS);
  assert.doesNotMatch(text, /unsafe-inline|unsafe-eval/);
});
test('Worker config matches the static asset deployment contract', async () => {
  const config = JSON.parse((await read(join(root, 'wrangler.jsonc'))).replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.name, 'open-source-everything');
  assert.equal(config.account_id, '6366d45811d80fdc7a5943fc2ab1c9f3');
  assert.equal(config.compatibility_date, '2026-11-01');
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.assets, { directory: './dist', not_found_handling: '404-page', html_handling: 'auto-trailing-slash' });
  assert.deepEqual(config.routes, [{ pattern: 'opensource.dalepanama.com', custom_domain: true }]);
  assert.equal(config.main, undefined);
  assert.equal(config.bindings, undefined);
});
