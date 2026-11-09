import http from 'node:http';
import { readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_DIST_FILES } from './public-files.mjs';

const args = process.argv.slice(2);
let port = 4173;
let portSpecified = false;
let distSpecified = false;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--dist' && !distSpecified) { distSpecified = true; continue; }
  if (args[index] !== '--port' || portSpecified || !/^[0-9]{1,5}$/u.test(args[index + 1] || '')) {
    throw new Error('Use npm run dev -- --port 4173. O servidor utiliza somente dist.');
  }
  port = Number(args[index + 1]); portSpecified = true; index += 1;
}
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Porta inválida.');
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../dist')).catch(() => {
  throw new Error('Distribuição ausente. Execute npm run build antes de npm run dev.');
});
const allowed = new Set(ALLOWED_DIST_FILES);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.ipuz': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    if (!allowed.has(file)) { response.writeHead(404); response.end('Não encontrado.'); return; }
    const target = resolve(root, file);
    if (await realpath(target) !== target || !(await lstat(target)).isFile()) throw new Error('Arquivo público inválido.');
    const data = await readFile(target);
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'text/plain; charset=utf-8', 'Content-Length': data.length,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 400;
    response.writeHead(status); response.end(status === 404 ? 'Não encontrado.' : 'Requisição inválida.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local (dist): http://127.0.0.1:${server.address().port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
