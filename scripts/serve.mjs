import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { extname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseHeaders, responseHeaders } from '../src/lib/headers.mjs';
import { within } from '../src/lib/files.mjs';

const defaultRoot = fileURLToPath(new URL('../dist/', import.meta.url));
export function normalizeRequestPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/')) return null;
  try {
    const path = decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\/+/, '/');
    return /[\x00-\x1f\x7f\\]/.test(path) ? null : path;
  } catch { return null; }
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
async function info(path) {
  try { return await stat(path); }
  catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null; throw error; }
}
async function respond(request, response, root, rules) {
  const path = normalizeRequestPath(request.url);
  const security = responseHeaders(rules, path ?? '/');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...security, Allow: 'GET, HEAD' }); response.end(); return;
  }
  let file;
  try { file = path === null ? null : within(root, '.' + path); }
  catch { file = null; }
  const hidden = path === null || path.split('/').some((part) => part.startsWith('.') || part === '_headers' || part === '_redirects');
  let details = file && !hidden ? await info(file) : null;
  if (details?.isDirectory()) {
    if (!path.endsWith('/')) {
      response.writeHead(308, { ...security, Location: path + '/' }); response.end(); return;
    }
    file = join(file, 'index.html');
    details = await info(file);
  }
  if (details?.isFile()) {
    try { within(root, await realpath(file)); }
    catch { details = null; }
  }
  const found = details?.isFile();
  const target = found ? file : join(root, '404.html');
  const body = await readFile(target);
  response.writeHead(found ? 200 : 404, { ...security, 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Content-Length': body.length });
  response.end(request.method === 'HEAD' ? undefined : body);
}
export async function start({ root = defaultRoot, port = Number(process.env.PORT || 4173), host = '127.0.0.1' } = {}) {
  const directory = await realpath(root);
  const rules = parseHeaders(await readFile(join(directory, '_headers'), 'utf8'));
  const server = createServer((request, response) => {
    respond(request, response, directory, rules).catch((error) => {
      console.error('Preview request failed:', request.url, error);
      if (!response.headersSent) response.writeHead(500, { ...responseHeaders(rules, '/'), 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Could not load this page. Please try again.');
    });
  });
  return new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); accept(server); });
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const server = await start();
    console.log(`Preview: http://127.0.0.1:${server.address().port}`);
    const close = () => { server.closeAllConnections(); server.close(); };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  } catch (error) { console.error(`Preview failed: ${error.message}. Run npm run build first.`); process.exitCode = 1; }
}
