#!/usr/bin/env node
/** Partial interoperability evidence only: no DOM, browser, network, or app imports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = '8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2';
const CONVERTER_SHA = '9313bef3f05bd492e79678ddcc1e53b30075c247f587fabf454dd5ed1a923fac';
const args = process.argv.slice(2);
let playerDir = resolve(ROOT, 'local/exolve');
let reportPath = null;
const inputs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--player-dir') playerDir = resolve(args[++i]);
  else if (args[i] === '--report') reportPath = resolve(args[++i]);
  else if (args[i].startsWith('--')) throw new Error(`Unknown option ${args[i]}`);
  else inputs.push(resolve(args[i]));
}
if (inputs.length !== 2) throw new Error('Usage: node tools/check-exolve-conversion.mjs [--report FILE] activity.ipuz solution.ipuz');
const bytes = await readFile(resolve(playerDir, 'exolve-from-ipuz.js'));
assert.equal(createHash('sha256').update(bytes).digest('hex'), CONVERTER_SHA, 'Official converter hash');
const logs = [];
const context = vm.createContext({console: Object.freeze({log: (...parts) => logs.push(parts.map(String).join(' '))})}, {
  name: 'official-exolve-converter-no-network', codeGeneration: {strings: false, wasm: false},
});
new vm.Script(bytes.toString('utf8'), {filename: 'official/exolve-from-ipuz.js'}).runInContext(context, {timeout: 1000});
const results = [];
for (const [index, file] of inputs.entries()) {
  const raw = await readFile(file);
  const ipuz = JSON.parse(raw.toString('utf8'));
  // Pass only inert JSON text into the context; no host callback, process, require or fetch.
  context.inputJSON = JSON.stringify(ipuz);
  context.fileName = index ? 'cruzadas-gabarito.ipuz' : 'cruzadas-atividade.ipuz';
  const output = new vm.Script('exolveFromIpuz(JSON.parse(inputJSON), fileName)').runInContext(context, {timeout: 1000});
  assert.equal(typeof output, 'string');
  assert.ok(output.includes('exolve-begin') && output.includes('exolve-end'), 'Converter accepted the file');
  const expectedGrid = ipuz.puzzle.map((row, r) => row.map((cell, c) => cell === '#' ? '.' : index ? ipuz.solution[r][c] : '0').join(''));
  const actualGrid = output.split('exolve-grid:')[1].split(/\n\s*exolve-/)[0].trim().split('\n').map(x => x.trim());
  assert.deepEqual(actualGrid, expectedGrid, 'All cells, blocks and solution/blank values');
  assert.equal(output.includes(`exolve-width: ${ipuz.dimensions.width}`), true);
  assert.equal(output.includes(`exolve-height: ${ipuz.dimensions.height}`), true);
  assert.equal('solution' in ipuz, Boolean(index), 'Expected activity then solution order');
  for (const direction of ['Across', 'Down']) {
    const segment = output.split(`exolve-${direction.toLowerCase()}:`)[1].split(/\n\s*exolve-/)[0].trim().split('\n').map(x => x.trim());
    assert.deepEqual(segment, ipuz.clues[direction].map(([n, text]) => `${n} ${text}`), `${direction} labels and escaped clue text`);
  }
  results.push({filename: context.fileName, inputSHA256: createHash('sha256').update(raw).digest('hex'), width: ipuz.dimensions.width,
    height: ipuz.dimensions.height, clueCount: Object.values(ipuz.clues).reduce((sum, clues) => sum + clues.length, 0),
    solutionIncluded: Boolean(index), converted: true});
}
const report = {scope: 'Partial evidence: official converter function in Node vm; this does not prove browser rendering, input, numbering or reveal controls.',
  upstream: {repository: 'https://github.com/viresh-ratnakar/exolve', commit: COMMIT, converterSHA256: CONVERTER_SHA, unmodified: true},
  runtime: process.version, results, converterLogs: logs};
if (reportPath) {
  await mkdir(dirname(reportPath), {recursive: true});
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
