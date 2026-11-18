import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';

export function within(root, path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error(`${path}: path escapes ${root}`);
  return absolute;
}
export function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch (error) { throw new Error(`${file}: cannot read file (${error.code})`, { cause: error }); }
}
export function readJson(file) {
  try { return JSON.parse(readText(file)); }
  catch (error) { throw new Error(`${file}: invalid JSON or missing file: ${error.message}`, { cause: error }); }
}
export function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
export function lookup(object, key) {
  if (object && Object.hasOwn(object, key)) return object[key];
  return key.split('.').reduce((value, part) => value && Object.hasOwn(value, part) ? value[part] : undefined, object);
}
