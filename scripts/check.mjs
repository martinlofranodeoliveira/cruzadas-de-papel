import assert from 'node:assert/strict';
import { readFile, readdir, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, ALLOWED_DIST_FILES } from './public-files.mjs';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const dist = resolve(root, 'dist');
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === '--sources-only'), 'Use node scripts/check.mjs [--sources-only].');
const sourceOnly = args.length === 1;
const sourceNames = PUBLIC_FILES.filter((file) => file.endsWith('.mjs'));
const actualSources = (await readdir(resolve(root, 'src'))).map((file) => `src/${file}`).sort();
assert.deepEqual(actualSources, [...sourceNames].sort(), 'A aplicação deve ter somente os módulos públicos declarados.');

for (const file of sourceNames) {
  const path = resolve(root, file);
  assert((await lstat(path)).isFile() && await realpath(path) === path, 'Módulos devem ser arquivos regulares locais.');
  const text = await readFile(path, 'utf8');
  assert(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*write\b|\beval\s*\(|\bnew\s+Function\s*\(/u.test(text), `HTML ou código dinâmico em ${file}.`);
  assert(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|getUserMedia|sendBeacon|serviceWorker|SharedWorker)\b|\bdocument\s*\.\s*cookie\b/u.test(text), `Rede, captura ou armazenamento implícito em ${file}.`);
  assert(!/\bimport\s*\(/u.test(text), `Importação dinâmica em ${file}.`);
  for (const match of text.matchAll(/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/gu)) {
    const dependency = match[1];
    assert(dependency.startsWith('./') && !dependency.includes('\\') && !dependency.includes('?') && !dependency.includes('#'), `Importação deve ser relativa e local em ${file}.`);
    const target = posix.normalize(posix.join(posix.dirname(file), dependency));
    assert(sourceNames.includes(target), `Importação fora da lista pública em ${file}.`);
  }
}
const info = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
assert.equal(info.type, 'module'); assert.equal(info.license, 'MIT');
for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  assert.equal(Object.keys(info[field] ?? {}).length, 0, 'Este build não usa pacotes externos.');
}
assert(!Object.keys(info.scripts).some((name) => /^(?:preinstall|install|postinstall|prepare|prepublish|prepublishOnly)$/u.test(name)), 'Hooks de instalação não são necessários.');
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
assert.deepEqual(Object.keys(lock.packages), [''], 'Lockfile deve conter somente o projeto.');

const fonts = JSON.parse(await readFile(resolve(root, 'assets/FONTS.json'), 'utf8'));
assert.equal(fonts.source, 'Google Fonts official repository');
assert.deepEqual(fonts.files.map((item) => item.file).sort(),
  ['BRICOLAGE-OFL.txt', 'SOURCE-SANS-OFL.txt', 'bricolage-grotesque.ttf', 'source-sans-3.ttf'].sort());
for (const font of fonts.files) {
  assert.equal(font.modified, false); assert.equal(font.license, 'SIL Open Font License 1.1');
  assert.match(font.upstream, /^https:\/\/raw\.githubusercontent\.com\/google\/fonts\/(?:main|[0-9a-f]{40})\/ofl\//u);
  assert.match(font.gitBlobSha1, /^[0-9a-f]{40}$/u); assert.match(font.sha256, /^[0-9a-f]{64}$/u);
  const bytes = await readFile(resolve(root, 'assets', font.file));
  assert.equal(font.bytes, bytes.length); assert.equal(font.sha256, hash(bytes));
  assert.equal(font.gitBlobSha1, hash(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1'));
}
for (const file of ['assets/BRICOLAGE-OFL.txt', 'assets/SOURCE-SANS-OFL.txt']) {
  assert((await readFile(resolve(root, file), 'utf8')).includes('SIL OPEN FONT LICENSE Version 1.1'));
}

async function walk(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    assert(!item.isSymbolicLink(), 'A distribuição não deve conter links simbólicos.');
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) result.push(...await walk(resolve(directory, item.name), `${name}/`));
    else { assert(item.isFile(), 'A distribuição deve conter somente arquivos regulares.'); result.push(name); }
  }
  return result;
}
if (sourceOnly) {
  console.log(`Fontes locais conferidas: ${sourceNames.length} módulos sem pacotes, rede ou persistência implícita; quatro fontes/licenças fixadas por SHA.`);
} else {
  assert.equal(await realpath(dist), dist, 'dist deve ser um diretório local.');
  const actualFiles = (await walk(dist)).sort();
  assert.deepEqual(actualFiles, [...ALLOWED_DIST_FILES].sort(), 'Lista pública deve coincidir exatamente com dist.');
  const manifestText = await readFile(resolve(dist, 'build-manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(Object.keys(manifest), ['version', 'algorithm', 'selfExcluded', 'files']);
  assert.equal(manifest.version, 1); assert.equal(manifest.algorithm, 'SHA-256');
  assert.equal(manifest.selfExcluded, 'build-manifest.json');
  assert.equal(manifestText, JSON.stringify(manifest, null, 2) + '\n');
  assert.deepEqual(Object.keys(manifest.files), actualFiles.filter((file) => file !== 'build-manifest.json'));
  for (const [file, item] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(dist, file));
    assert.deepEqual(Object.keys(item), ['size_bytes', 'sha256']);
    assert.equal(item.size_bytes, bytes.length, `Tamanho divergente: ${file}.`);
    assert.equal(item.sha256, hash(bytes), `SHA-256 divergente: ${file}.`);
  }
  for (const file of PUBLIC_FILES) assert.deepEqual(await readFile(resolve(dist, file)), await readFile(resolve(root, file)), `Cópia divergente: ${file}.`);
  assert.equal((await readFile(resolve(dist, '.nojekyll'))).length, 0);
  const html = await readFile(resolve(dist, 'index.html'), 'utf8');
  assert(/\blang=["']pt-BR["']/u.test(html), 'HTML deve declarar português.');
  assert(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'](?:\.\/)?src\/app\.mjs["'][^>]*>\s*<\/script>/u.test(html)
    || /<script\b[^>]*\bsrc=["'](?:\.\/)?src\/app\.mjs["'][^>]*\btype=["']module["'][^>]*>\s*<\/script>/u.test(html), 'HTML deve carregar o módulo original local.');
  assert(!/\son[a-z]+\s*=|\bjavascript\s*:/iu.test(html), 'HTML não deve conter eventos ou código inline.');
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    assert(/\bsrc=["'](?:\.\/)?src\/app\.mjs["']/u.test(script[1]) && script[2].trim() === '', 'Somente o módulo local é carregado.');
  }
  assert(!/<(?:iframe|object|embed|audio|video)\b/iu.test(html), 'A página não carrega mídia ou conteúdo incorporado externo.');
  for (const tag of html.matchAll(/<(?:script|img|link)\b[^>]*>/giu)) {
    const reference = /\b(?:src|href)=["']([^"']+)["']/u.exec(tag[0]);
    if (reference) assert(PUBLIC_FILES.includes(reference[1].replace(/^\.\//u, '')), 'Recurso HTML deve existir na lista pública.');
  }
  const css = await readFile(resolve(dist, 'styles.css'), 'utf8');
  assert(!/@import\b/iu.test(css), 'CSS não deve importar folhas remotas.');
  for (const resource of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/giu)) {
    const target = resource[1].replace(/^\.\//u, '');
    assert(PUBLIC_FILES.includes(target), 'Recurso CSS deve existir na lista pública.');
  }
  const logo = await readFile(resolve(dist, 'logo.svg'), 'utf8');
  assert(!/<(?:script|foreignObject)\b|\son[a-z]+\s*=|\b(?:href|src)\s*=/iu.test(logo), 'Logo deve ser SVG local sem conteúdo ativo.');
  console.log(`Distribuição conferida: ${actualFiles.length} arquivos exatos, módulos locais, licenças preservadas e manifesto SHA-256.`);
}
