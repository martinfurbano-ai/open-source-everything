import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { read, root } from './helpers.mjs';

const base = await read(join(root, 'src/styles/base.css'));
const hub = await read(join(root, 'src/styles/hub.css'));
const product = await read(join(root, 'projects/speak-away/page.css'));

function rule(css, selector) {
  const block = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find((match) => match[1].split(',').some((value) => value.trim() === selector));
  assert.ok(block, `missing ${selector} rule`);
  return block[2];
}

for (const heading of ['h1', 'h2']) {
  test(`${heading} balances its lines`, () => {
    assert.match(rule(base, heading), /text-wrap:\s*balance\s*;/);
  });
}

test('paragraphs avoid short trailing lines', () => {
  assert.match(rule(base, 'p'), /text-wrap:\s*pretty\s*;/);
});

test('paragraphs retain a readable character-based measure', () => {
  assert.match(rule(base, 'p'), /max-width:\s*6[0-9]ch\s*;/);
});

test('Speak Away section introductions use a 60ch measure', () => {
  assert.match(rule(product, '.section-heading p'), /max-width:\s*60ch\s*;/);
});

test('hub headline size keeps open source together on desktop', () => {
  assert.match(rule(hub, '.hero h1'), /font-size:\s*clamp\(2\.75rem,\s*4\.5vw,\s*4rem\)\s*;/);
});
