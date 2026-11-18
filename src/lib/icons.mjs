import { join } from 'node:path';
import { readText } from './files.mjs';

export function iconReader(root) {
  return (name) => {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`missing icon ${name}`);
    return readText(join(root, 'vendor/phosphor/regular', `${name}.svg`)).trim();
  };
}
