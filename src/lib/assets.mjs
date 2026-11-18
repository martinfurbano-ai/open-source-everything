import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, dirname } from 'node:path';
import { within, readText, write } from './files.mjs';

export function createAssets(root, outDir) {
  function hashed(path, content) {
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
    const ext = extname(path);
    const name = path.slice(0, -ext.length) + `.${hash}${ext}`;
    write(within(outDir, `assets/${name}`), content);
    return `/assets/${name}`;
  }
  function publicAsset(path) {
    const file = within(join(root, 'public'), path);
    try { return hashed(path, readFileSync(file)); }
    catch (error) { throw new Error(`${path}: missing asset (${error.message})`, { cause: error }); }
  }
  const fontFiles = ['Geist-Variable.woff2', 'GeistMono-Variable.woff2'];
  const fonts = Object.fromEntries(fontFiles.map((name) => [name, hashed(`fonts/${name}`, readFileSync(join(root, 'vendor/geist', name)))]));
  function stylesheet(page) {
    const css = page.css.map((path) => readText(within(root, path)).replace(/url\(["']?\/fonts\/([^)'"\s]+)["']?\)/g, (_, font) => {
      if (!fonts[font]) throw new Error(`${path}: missing font ${font}`);
      return `url("${fonts[font]}")`;
    })).join('\n');
    return hashed(`css/${page.type}.css`, css);
  }
  function script(path) { return hashed(`js/${basename(path)}`, readFileSync(within(root, path))); }
  function copyRoot() {
    for (const name of readdirSync(join(root, 'public/root'))) {
      const destination = within(outDir, name);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(root, 'public/root', name), destination);
    }
  }
  return { publicAsset, stylesheet, script, copyRoot, fonts };
}
