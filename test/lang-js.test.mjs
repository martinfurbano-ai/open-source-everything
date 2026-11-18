import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { join } from 'node:path';
import { root, read } from './helpers.mjs';

async function execute({ lang = 'en', browser = 'es-PA', saved, guarded = false, blocked, alternate = true, expected = 'es' } = {}) {
  const actions = [];
  const state = { 'ose-lang': saved, 'ose-lang-redirected': guarded ? '1' : null };
  const storage = (name) => ({
    getItem(key) { actions.push(`read:${key}`); if (blocked === `${name}:get`) throw Error('blocked'); return state[key] ?? null; },
    setItem(key, value) { if (blocked === `${name}:set`) throw Error('blocked'); state[key] = value; },
  });
  let click;
  const document = {
    documentElement: { lang, classList: { add: (name) => actions.push(`class:${name}`) } },
    querySelector: (selector) => {
      actions.push(`query:${selector}`);
      return alternate && selector === `head link[rel="alternate"][hreflang="${expected}"]`
        ? { href: expected === 'es' ? 'https://local.test/es/' : 'https://local.test/' } : null;
    },
    addEventListener: (event, callback) => { actions.push(`listen:${event}`); if (event === 'click') click = callback; },
  };
  const sandbox = { document, localStorage: storage('local'), sessionStorage: storage('session'),
    navigator: { languages: browser ? [browser] : [] }, location: { replace: (url) => actions.push(`redirect:${url}`) } };
  const source = await read(join(root, 'src/js/lang.js'));
  const run = () => runInNewContext(source, { ...sandbox, window: sandbox });
  run();
  return { actions, state, click, run };
}
const redirects = (result) => result.actions.filter((action) => action.startsWith('redirect:'));
for (const [label, options, url] of [
  ['Spanish browser on English', {}, 'https://local.test/es/'],
  ['English browser preserves Spanish', { lang: 'es', browser: 'en-US', expected: 'en' }, null],
  ['stored English on Spanish', { lang: 'es', saved: 'en', expected: 'en' }, 'https://local.test/'],
  ['stored Spanish on English', { saved: 'es', browser: 'en-US' }, 'https://local.test/es/'],
  ['stored English overrides Spanish browser', { saved: 'en' }, null],
  ['matching Spanish preference', { lang: 'es', saved: 'es', browser: 'en-US' }, null],
  ['matching English preference', { saved: 'en', browser: 'en-US' }, null],
  ['missing Spanish alternate', { alternate: false }, null],
  ['missing English alternate', { lang: 'es', saved: 'en', expected: 'en', alternate: false }, null],
  ['session guard for browser redirect', { guarded: true }, null],
  ['session guard for explicit redirect', { lang: 'es', saved: 'en', expected: 'en', guarded: true }, null],
  ['non-Spanish browser', { browser: 'fr-FR' }, null],
  ['no browser languages', { browser: null }, null],
  ['localStorage read fails', { blocked: 'local:get' }, 'https://local.test/es/'],
  ['sessionStorage read fails', { blocked: 'session:get' }, null],
  ['sessionStorage write fails', { blocked: 'session:set' }, null],
]) {
  test(`language policy: ${label}`, async () => {
    const result = await execute(options);
    assert.equal(result.actions[0], 'class:js');
    assert.deepEqual(redirects(result), url ? [`redirect:${url}`] : []);
    if (url) assert.equal(result.state['ose-lang-redirected'], '1');
  });
}
test('session guard prevents a second redirect across executions', async () => {
  const result = await execute();
  result.run();
  assert.equal(redirects(result).length, 1);
});
test('ordinary language link click stores its target preference and survives blocked storage', async () => {
  for (const blocked of [undefined, 'local:set']) {
    const result = await execute({ saved: 'en', blocked });
    result.click({ target: { closest: () => ({ getAttribute: (key) => key === 'hreflang' ? 'es' : null }) } });
    assert.equal(result.state['ose-lang'], blocked ? 'en' : 'es');
  }
});
