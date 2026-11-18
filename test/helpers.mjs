import { mkdtemp, rm, readFile, readdir, cp } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const read = (path) => readFile(path, 'utf8');
export const json = async (path) => JSON.parse(await read(path));
export const pageFile = (out, path) => join(out, path, 'index.html');
export async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? files(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}
export async function filesIfPresent(dir) {
  try {
    return await files(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
export async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'ose-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
export async function built(t, config) {
  const dir = await temporary(t);
  const { build } = await import('../build.mjs');
  const out = join(dir, 'dist');
  await build({ root, outDir: out, config });
  const defaults = await json(join(root, 'site.config.json'));
  return { out, config: { ...defaults, ...config, links: { ...defaults.links, ...config?.links } }, pages: await json(join(root, 'src/pages.json')) };
}
export async function fixture(t) {
  const dir = await temporary(t);
  for (const name of ['src', 'projects', 'public', 'vendor', 'site.config.json']) {
    await cp(join(root, name), join(dir, name), { recursive: true });
  }
  return dir;
}
export const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
export const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attributes(m[0]));
export async function htmlFiles(out) {
  return (await files(out)).filter((file) => file.endsWith('.html'));
}
