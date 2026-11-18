import test from 'node:test';
import assert from 'node:assert/strict';

const context = () => ({
  file: 'example.html', lang: 'es', i18n: { text: '<b>"&\'</b>', rich: '<strong>Safe</strong>' },
  config: { brand: 'A & B', links: { coffee: '' } },
  project: { slug: 'current' }, pages: [{ id: 'home', paths: { en: '/', es: '/es/' } }],
  head: '<title>Test</title>', scripts: '<script src="/ui.js" defer></script>',
  icon: (name) => { if (name !== 'check') throw new Error(`Missing icon ${name}`); return '<svg></svg>'; },
  asset: (path) => { if (path === 'missing.webp') throw new Error(`Missing asset ${path}`); return `/assets/${path}`; }, projects: [
    { data: { slug: 'first', url: '/es/first/' }, card: { name: 'Uno' } },
    { data: { slug: 'second', url: '/es/second/' }, card: { name: 'Dos' } },
  ],
});
async function render(text, ctx = context()) {
  return (await import('../src/lib/template.mjs')).render(text, ctx);
}

test('template resolves every placeholder and escapes text independently of trusted HTML', async () => {
  const result = await render('{{t:text}}|{{h:rich}}|{{cfg:brand}}|{{pj:slug}}|{{lang}}|{{url:home}}|{{url:home@en}}|{{asset:img/a.webp}}|{{icon:check}}|{{head}}|{{scripts}}');
  assert.equal(result, '&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;|<strong>Safe</strong>|A &amp; B|current|es|/es/|/|/assets/img/a.webp|<i class="ic" aria-hidden="true"><svg></svg></i>|<title>Test</title>|<script src="/ui.js" defer></script>');
});
test('condition renders only for a non-empty string without mutating context', async () => {
  const ctx = context();
  const block = 'a{{#if cfg:links.coffee}}yes{{/if}}z';
  assert.equal(await render(block, ctx), 'az');
  for (const coffee of ['https://example.com', '', false, null, 2]) {
    assert.equal(await render(block, { ...ctx, config: { links: { coffee } } }), typeof coffee === 'string' && coffee ? 'ayesz' : 'az');
  }
  assert.equal(ctx.config.links.coffee, '');
});
test('projects loop exposes independent localized cards and project data', async () => {
  assert.equal(await render('{{#projects}}<a href="{{pj:url}}">{{p:name}}:{{pj:slug}}</a>{{/projects}}'), '<a href="/es/first/">Uno:first</a><a href="/es/second/">Dos:second</a>');
});
for (const [input, detail] of [
  ['{{t:absent}}', /t:absent/], ['{{h:absent}}', /h:absent/],
  ['{{url:missing}}', /url:missing/], ['{{cfg:absent}}', /cfg:absent/],
  ['{{icon:missing}}', /icon:missing/], ['{{asset:missing.webp}}', /asset:missing.webp/],
  ['{{unknown}}', /unknown/], ['{{#if cfg:links.coffee}}', /unclosed.*\/if/],
  ['{{#projects}}', /unclosed.*\/projects/], ['{{/if}}', /unexpected.*\/if/],
  ['{{#if cfg:links.coffee}}{{#if cfg:brand}}x{{/if}}{{/if}}', /nested if/],
]) {
  test(`template rejects invalid syntax or missing value: ${input}`, async () => {
    await assert.rejects(render(input), (error) => {
      assert.match(error.message, /example\.html/);
      assert.match(error.message, detail);
      return true;
    });
  });
}
test('unknown and missing placeholders inside a disabled block still fail', async () => {
  await assert.rejects(render('{{#if cfg:links.coffee}}{{t:absent}}{{/if}}'), /absent/);
});

for (const value of [
  '<b>bad</b>', '<script>alert(1)</script>', '<span class="bad">bad</span>',
  '<em href="/">bad</em>', '<a href\u00a0="/">bad</a>', '<a onclick="alert(1)" href="/">bad</a>',
  '<a href="javascript:alert(1)">bad</a>', '<a href="data:text/html,bad">bad</a>',
  '<strong>unclosed', '<em><strong>bad</em></strong>', '</span>', '<span',
  '<a href="/" href="https://example.com">bad</a>', '<!-- hidden -->', '<br></br>',
]) {
  test(`trusted HTML rejects unsafe or unbalanced markup: ${value}`, async () => {
    await assert.rejects(render('{{h:unsafe.copy}}', { ...context(), i18n: { 'unsafe.copy': value } }), /h:unsafe\.copy/);
  });
}
test('trusted HTML accepts every allowed tag and href prefix without escaping', async () => {
  const rich = '<span><em>Em</em><strong>Bold</strong><code>Code</code><kbd>Fn</kbd><br></span>'
    + ['https://example.com', '/es/', '#main', 'mailto:hello@example.com'].map((href) => `<a href="${href}">Link</a>`).join('');
  assert.equal(await render('{{h:rich}}', { ...context(), i18n: { rich } }), rich);
});

test('trusted HTML accepts void br syntax and rejects non-HTML tag separators', async () => {
  const rich = '<br/><br /><a href="/es/">Spanish</a>';
  assert.equal(await render('{{h:rich}}', { ...context(), i18n: { rich } }), rich);
  await assert.rejects(render('{{h:rich}}', { ...context(), i18n: { rich: '<a\u00a0href="/">bad</a>' } }), /h:rich/);
});
