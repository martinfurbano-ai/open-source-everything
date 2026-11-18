import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { built, read, files } from './helpers.mjs';

test('request path normalization is pure, collapses leading slashes and rejects invalid paths', async () => {
  const { normalizeRequestPath } = await import('../scripts/serve.mjs');
  assert.equal(typeof normalizeRequestPath, 'function');
  for (const [input, expected] of [
    ['/', '/'], ['/es?x=1', '/es'], ['/%2Fes', '/es'], ['///es', '/es'],
    ['/%2f%2fes', '/es'], ['/es/', '/es/'], ['/a%20b', '/a b'],
    ['/%00', null], ['/%0d%0aLocation:x', null], ['/%', null], ['/%ff', null],
    ['/a%5cb', null], ['http://example.com/', null],
  ]) assert.equal(normalizeRequestPath(input), expected, input);
});

test('header matching applies immutable caching only to assets without a socket', async () => {
  const { parseHeaders, responseHeaders } = await import('../src/lib/headers.mjs');
  const rules = parseHeaders('/*\n  X-Frame-Options: DENY\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  assert.doesNotMatch(responseHeaders(rules, '/')['Cache-Control'] || '', /immutable/);
  assert.match(responseHeaders(rules, '/assets/test.js')['Cache-Control'], /immutable/);
});

test('preview applies production headers, serves assets, 404 and trailing-slash pages', async (t) => {
  const { out } = await built(t);
  const { start } = await import('../scripts/serve.mjs');
  let server;
  try {
    try { server = await start({ root: out, port: 0 }); }
    catch (error) {
      if (error.code === 'EPERM') { t.skip('Sandbox forbids binding to localhost (EPERM).'); return; }
      throw error;
    }
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get('cache-control') || '', /immutable/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-inline/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    await response.text();
    const asset = (await files(join(out, 'assets')))[0].slice(out.length);
    const assetResponse = await fetch(base + asset);
    assert.equal(assetResponse.status, 200);
    assert.equal(assetResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    await assetResponse.arrayBuffer();
    const missing = await fetch(base + '/missing');
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), await read(join(out, '404.html')));
    assert.ok(missing.headers.get('content-security-policy'));
    const project = await fetch(base + '/speak-away', { redirect: 'manual' });
    assert.ok([200, 301, 302, 307, 308].includes(project.status));
    if (project.status !== 200) assert.equal(project.headers.get('location'), '/speak-away/');
    await project.text();
    const encodedSlash = await fetch(base + '/%2Fes', { redirect: 'manual' });
    assert.equal(encodedSlash.status, 308);
    assert.equal(encodedSlash.headers.get('location'), '/es/');
    await encodedSlash.text();
    for (const path of ['/%00', '/%', '/%0d%0aLocation:x']) {
      const invalid = await fetch(base + path);
      assert.equal(invalid.status, 404, path);
      assert.equal(await invalid.text(), await read(join(out, '404.html')));
    }
    const privateFile = await fetch(base + '/_headers');
    assert.equal(privateFile.status, 404);
    await privateFile.text();
  } finally {
    if (server) { server.closeAllConnections(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  }
});
