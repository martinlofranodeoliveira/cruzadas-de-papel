import { readFile, writeFile, mkdir, rm, rename, mkdtemp, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES } from './public-files.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const output = resolve(root, 'dist');
if (new Set(PUBLIC_FILES).size !== PUBLIC_FILES.length) throw new Error('Arquivo público repetido.');
// Lê tudo antes de substituir dist. Não compila, baixa ou incorpora dependências.
const copied = await Promise.all(PUBLIC_FILES.map(async (file) => {
  if (!/^[A-Za-z0-9_./-]+$/u.test(file) || file.startsWith('/') || file.split('/').some((part) => ['', '.', '..'].includes(part))) {
    throw new Error('Caminho inválido na lista pública.');
  }
  const path = resolve(root, file);
  if (!(await lstat(path)).isFile() || await realpath(path) !== path) throw new Error('Arquivo público deve ser regular e local.');
  return [file, await readFile(path)];
}));
const files = new Map(copied);
files.set('.nojekyll', Buffer.alloc(0));
const manifest = Object.fromEntries([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, bytes]) => [file, {
  size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
}]));
files.set('build-manifest.json', Buffer.from(JSON.stringify({
  version: 1, algorithm: 'SHA-256', selfExcluded: 'build-manifest.json', files: manifest,
}, null, 2) + '\n', 'utf8'));

const staging = await mkdtemp(resolve(root, '.dist-build-'));
try {
  for (const [file, bytes] of files) {
    await mkdir(dirname(resolve(staging, file)), { recursive: true });
    await writeFile(resolve(staging, file), bytes);
  }
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
console.log(`Build estático: ${files.size} arquivos locais, módulos originais e manifesto SHA-256; sem compilador ou dependências.`);
