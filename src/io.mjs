import { PlanError, validateProject, analyze } from './model.mjs';

export const MAX_PROJECT_BYTES = 512 * 1024;

function assertSize(text) {
  // A UTF-16 code unit needs at least one byte in valid UTF-8. Check the cheap
  // bound first so an obviously oversized string need not be encoded at all.
  if (text.length > MAX_PROJECT_BYTES || new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES) {
    throw new PlanError('E_LIMIT', 'O projeto excede o limite de 512 KiB.');
  }
}

/** Read a UTF-8-sized JSON author project, then let the model check its shape. */
export function parseProject(text) {
  if (typeof text !== 'string') throw new PlanError('E_SCHEMA', 'O arquivo do projeto deve conter texto JSON.');
  assertSize(text);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new PlanError('E_JSON', 'O arquivo não contém JSON válido.');
  }
  return validateProject(value);
}

/** Canonical key order, registration order, two spaces, one final LF. */
export function serializeProject(project) {
  const canonical = validateProject(project);
  const text = JSON.stringify(canonical, null, 2) + '\n';
  assertSize(text);
  return text;
}

function readOptions(options) {
  if (options === null || typeof options !== 'object' ||
      (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)) {
    throw new PlanError('E_SCHEMA', 'As opções de exportação são inválidas.');
  }
  const keys = Reflect.ownKeys(options);
  if (keys.some(key => key !== 'solution')) throw new PlanError('E_SCHEMA', 'A opção de exportação não é reconhecida.');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'solution');
  if (!descriptor) return false;
  if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') {
    throw new PlanError('E_SCHEMA', 'A opção de gabarito deve ser verdadeira ou falsa.');
  }
  return descriptor.value;
}

function readyProject(project) {
  const canonical = validateProject(project);
  const analysis = analyze(canonical);
  if (!analysis.ready) throw new PlanError('E_NOT_READY', 'Conclua as pendências antes de exportar a atividade.');
  return { project: canonical, analysis };
}

// IPUZ declares title/author/intro/clues to be HTML, even when the author wrote
// plain text. Escape ampersands first; never interpret the author as markup.
function escapeText(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Our rectangular ASCII blocked-crossword profile of IPUZ v2. */
export function exportIpuz(project, options = {}) {
  const solution = readOptions(options);
  const { project: canonical, analysis } = readyProject(project);
  const entriesById = new Map(canonical.entries.map(entry => [entry.id, entry]));
  const cluesFor = direction => analysis.entries
    .filter(entry => entry.direction === direction)
    .sort((a, b) => a.number - b.number)
    .map(entry => [entry.number, `${escapeText(entriesById.get(entry.id).clue)} (${entry.length})`]);
  // The literal object below is an intentional whitelist. Author source,
  // answers, checking hashes and a solver's attempt have no export path here.
  const document = {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    uniqueid: canonical.puzzle.id,
    title: escapeText(canonical.puzzle.title),
    author: escapeText(canonical.puzzle.author),
    intro: escapeText(canonical.puzzle.subtitle),
    dimensions: { width: canonical.puzzle.width, height: canonical.puzzle.height },
    block: '#',
    empty: 0,
    charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    puzzle: analysis.grid.map(row => row.map(cell => cell.letter === null ? '#' : (cell.number ?? 0))),
    clues: { Across: cluesFor('across'), Down: cluesFor('down') },
  };
  if (solution) document.solution = analysis.grid.map(row => row.map(cell => cell.letter ?? '#'));
  return JSON.stringify(document, null, 2) + '\n';
}

/**
 * Break real lines before adding optional SVG fitting hints. Some renderers
 * ignore textLength, so it must not be the only barrier between clue columns.
 * ASCII points cost one unit; all other Unicode points cost two. Never trim or
 * drop a point: joining spans recovers the exact text, including boundary spaces.
 */
function pointUnits(point) {
  return point.codePointAt(0) <= 0x7f ? 1 : 2;
}

function textUnits(text) {
  return Array.from(text).reduce((total, point) => total + pointUnits(point), 0);
}

function wrapText(text, budget) {
  const points = Array.from(text);
  const lines = [];
  while (points.length) {
    let count = 0;
    let units = 0;
    while (count < points.length && units + pointUnits(points[count]) <= budget) {
      units += pointUnits(points[count]);
      count++;
    }
    if (count < points.length) {
      // Prefer the last whole-word boundary anywhere in the available line.
      // A token is split only when it cannot fit in an otherwise empty line.
      for (let index = count - 1; index >= 0; index--) {
        if (points[index] === ' ') { count = index + 1; break; }
      }
    }
    lines.push(points.splice(0, count).join(''));
  }
  return lines.length ? lines : [''];
}

function textBlock(text, { x, y, budget = 26, size = 16, lineHeight = 20, width = 432, attributes = '' }) {
  const lines = wrapText(text, budget);
  const spans = lines.map((line, index) => {
    // An extra fitting hint only. The conservative real line breaks above are
    // also used by consumers that ignore these optional SVG text attributes.
    const length = Math.max(1, Math.min(width, textUnits(line) * size * 0.48));
    return `<tspan x="${x}" y="${y + index * lineHeight}" textLength="${length.toFixed(2)}" lengthAdjust="spacingAndGlyphs">${escapeText(line)}</tspan>`;
  }).join('');
  return { markup: `<text font-size="${size}" xml:space="preserve"${attributes ? ` ${attributes}` : ''}>${spans}</text>`, height: lines.length * lineHeight };
}

/**
 * A self-contained print sheet. Coordinates are SVG user units: canvas 1000
 * wide, 56-unit margins, cells 32 square; clue columns 432 wide with 24 gap.
 * All text is visible and XML escaped. At 40 clues of 200 Unicode points, even
 * one full clue column remains below 28000 units high. No external resources.
 */
export function exportSvg(project, options = {}) {
  const solution = readOptions(options);
  const { project: canonical, analysis } = readyProject(project);
  const parts = [];
  parts.push(`<text x="56" y="48" font-size="16" font-weight="700">${solution ? 'Gabarito' : 'Atividade'}</text>`);
  let y = 91;
  const title = textBlock(canonical.puzzle.title, { x: 56, y, size: 30, lineHeight: 36, budget: 28, width: 888, attributes: 'id="sheet-heading" font-weight="700"' });
  parts.push(title.markup);
  y += title.height + 12;
  if (canonical.puzzle.subtitle) {
    const subtitle = textBlock(canonical.puzzle.subtitle, { x: 56, y, size: 16, lineHeight: 21, width: 888, budget: 54 });
    parts.push(subtitle.markup);
    y += subtitle.height + 10;
  }
  if (canonical.puzzle.author) {
    const author = textBlock(`Autoria: ${canonical.puzzle.author}`, { x: 56, y, size: 14, lineHeight: 18, width: 888, budget: 60 });
    parts.push(author.markup);
    y += author.height + 10;
  }
  parts.push(`<text x="56" y="${y}" font-size="13">Uma letra A–Z por célula. As pistas indicam o número de letras.</text>`);
  const cellSize = 32;
  const gridX = (1000 - canonical.puzzle.width * cellSize) / 2;
  const gridY = y + 24;
  parts.push(`<g id="grid" data-cell-size="${cellSize}" data-x="${gridX}" data-y="${gridY}">`);
  for (let row = 0; row < canonical.puzzle.height; row++) {
    for (let col = 0; col < canonical.puzzle.width; col++) {
      const cell = analysis.grid[row][col];
      const x = gridX + col * cellSize;
      const cellY = gridY + row * cellSize;
      parts.push(`<g data-row="${row}" data-col="${col}"><rect x="${x}" y="${cellY}" width="32" height="32" fill="${cell.letter === null ? '#202833' : '#fff'}" stroke="#202833" stroke-width="1"/>`);
      if (cell.number !== null) parts.push(`<text data-role="number" x="${x + 3}" y="${cellY + 10}" font-size="9">${cell.number}</text>`);
      if (solution && cell.letter !== null) parts.push(`<text data-role="letter" x="${x + 16}" y="${cellY + 24}" font-size="19" text-anchor="middle" font-weight="700">${cell.letter}</text>`);
      parts.push('</g>');
    }
  }
  parts.push('</g>');
  const clueStartY = gridY + canonical.puzzle.height * cellSize + 45;
  const entriesById = new Map(canonical.entries.map(entry => [entry.id, entry]));
  const columnBottoms = [];
  for (const [direction, label, x] of [['across', 'Horizontal', 56], ['down', 'Vertical', 512]]) {
    parts.push(`<text x="${x}" y="${clueStartY}" font-size="19" font-weight="700">${label}</text>`);
    let clueY = clueStartY + 30;
    for (const entry of analysis.entries.filter(item => item.direction === direction).sort((a, b) => a.number - b.number)) {
      const text = `${entry.number}. ${entriesById.get(entry.id).clue} (${entry.length})`;
      const block = textBlock(text, { x, y: clueY, attributes: 'data-role="clue"', size: 16, lineHeight: 20, width: 432, budget: 26 });
      parts.push(`<g data-direction="${direction}" data-number="${entry.number}">${block.markup}</g>`);
      clueY += block.height + 10;
    }
    columnBottoms.push(clueY);
  }
  const footerY = Math.max(...columnBottoms) + 22;
  const height = footerY + 30;
  parts.push(`<text x="56" y="${footerY}" font-size="11" fill="#566171">Cruzadas de Papel · LOFRANO TECNOLOGIA</text>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="sheet-heading" font-family="sans-serif">\n<rect width="1000" height="${height}" fill="#fff"/>\n${parts.join('\n')}\n</svg>\n`;
}
