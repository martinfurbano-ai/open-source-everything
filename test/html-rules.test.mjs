import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { built, htmlFiles, read, tags, files } from './helpers.mjs';

async function resolves(value, out, file, config, externalHosts) {
  const url = new URL(value.replaceAll('&amp;', '&'), config.siteUrl + '/' + file.slice(out.length + 1));
  if (url.origin !== config.siteUrl) {
    const allowed = ['github.com', 'www.instagram.com', ...(config.links.coffee ? [new URL(config.links.coffee).hostname] : [])];
    assert.equal(url.protocol, 'https:', value);
    assert.ok(allowed.includes(url.hostname) || url.href === 'https://apps.apple.com/app/id6829756587', `${file}: unexpected host ${value}`);
    externalHosts.add(url.hostname);
    return;
  }
  const path = decodeURIComponent(url.pathname);
  const target = join(out, path, path.endsWith('/') ? 'index.html' : '');
  await access(target);
  if (url.hash) {
    assert.ok((await read(target)).includes(`id="${url.hash.slice(1)}"`), `${file}: missing fragment ${value}`);
  }
}
for (const coffee of ['', 'https://buymeacoffee.com/example']) {
test(`all HTML and own-domain URLs resolve with coffee=${coffee || 'empty'}`, async (t) => {
  const { out, config } = await built(t, { links: { coffee } });
  const externalHosts = new Set();
  for (const file of await htmlFiles(out)) {
    const html = await read(file);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
    for (const landmark of ['header', 'nav', 'main', 'footer']) assert.ok(tags(html, landmark).length, `${file}: ${landmark}`);
    assert.match(html, /class="skip-link"/);
    for (const img of tags(html, 'img')) for (const key of ['alt', 'width', 'height']) assert.ok(Object.hasOwn(img, key), `${file}: img ${key}`);
    assert.doesNotMatch(html, /\btarget\s*=|\bon[a-z]+\s*=|\bstyle\s*=|<style\b/i);
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      assert.ok(/\bsrc=/.test(attrs) || /type="application\/json"/.test(attrs));
      if (/\bsrc=/.test(attrs)) assert.equal(body, '');
    }
    assert.doesNotMatch(html, /{{/);
    for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      await resolves(value, out, file, config, externalHosts);
    }
    for (const meta of tags(html, 'meta').filter((meta) => ['og:url', 'og:image'].includes(meta.property))) await resolves(meta.content, out, file, config, externalHosts);
    for (const [, set] of html.matchAll(/srcset="([^"]+)"/g)) for (const entry of set.split(',')) await resolves(entry.trim().split(/\s+/)[0], out, file, config, externalHosts);
  }
  for (const file of (await files(out)).filter((f) => f.endsWith('.css'))) {
    for (const [, value] of (await read(file)).matchAll(/url\(["']?([^\s)'"\n]+)["']?\)/g)) await resolves(value, out, file, config, externalHosts);
  }
  const sitemapFile = join(out, 'sitemap.xml');
  const sitemap = await read(sitemapFile);
  for (const [, value] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    await resolves(value, out, sitemapFile, config, externalHosts);
  }
  for (const link of tags(sitemap, 'xhtml:link')) await resolves(link.href, out, sitemapFile, config, externalHosts);
  assert.deepEqual([...externalHosts].sort(), ['apps.apple.com', 'github.com', 'www.instagram.com', ...(coffee ? ['buymeacoffee.com'] : [])].sort());
});
}

test('text token pairings meet AA contrast in both themes, including small status labels', async () => {
  const { root } = await import('./helpers.mjs');
  const base = await read(join(root, 'src/styles/base.css'));
  const hub = await read(join(root, 'src/styles/hub.css'));
  const roots = [...base.matchAll(/:root(?:\[data-theme="dark"\])?\s*{([^}]+)}/g)];
  assert.equal(roots.length, 2);
  const status = hub.match(/\.status-row span:first-child\s*{([^}]+)}/)[1];
  const statusColor = status.match(/(?:^|;)\s*color:\s*var\(--([\w-]+)\)/)[1];
  function luminance(hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
      .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return channels.reduce((total, c, i) => total + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  const media = base.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{([^}]+)}\s*}/);
  assert.ok(media, 'missing automatic dark theme');
  const properties = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
  assert.deepEqual(properties(media[1]), properties(roots[1][1]), 'automatic and explicit dark tokens differ');
  for (const block of [...roots.map((match) => match[1]), media[1]]) {
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*#([a-f0-9]+);/g)].map((m) => [m[1], m[2]]));
    for (const [foreground, background] of [['fg', 'bg'], ['muted', 'bg'], ['fg', 'surface'], ['muted', 'surface'], ['accent-ink', 'accent'], [statusColor, 'accent-soft']]) {
      const values = [luminance(tokens[foreground]), luminance(tokens[background])].sort((a, b) => a - b);
      const contrast = (values[1] + 0.05) / (values[0] + 0.05);
      assert.ok(contrast >= 4.5, `${foreground} on ${background}: ${contrast.toFixed(2)}:1`);
    }
  }
});
