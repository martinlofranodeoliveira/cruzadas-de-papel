/** Núcleo de autoria de cruzadas: dados explícitos, copiados, sem efeitos externos. */
export const MAX_ENTRIES = 40;
export const MIN_GRID_SIZE = 5;
export const MAX_GRID_SIZE = 21;
export const MAX_SOURCE_LENGTH = 80;
export const MAX_ANSWER_LENGTH = 21;
export const MAX_TITLE_LENGTH = 100;
export const MAX_SUBTITLE_LENGTH = 160;
export const MAX_AUTHOR_LENGTH = 80;
export const MAX_CLUE_LENGTH = 200;
export const MAX_SUGGESTIONS = 20;
export const LIMITS = Object.freeze({ MAX_ENTRIES, MIN_GRID_SIZE, MAX_GRID_SIZE,
  MAX_SOURCE_LENGTH, MAX_ANSWER_LENGTH, MAX_TITLE_LENGTH, MAX_SUBTITLE_LENGTH,
  MAX_AUTHOR_LENGTH, MAX_CLUE_LENGTH, MAX_SUGGESTIONS });

export class PlanError extends Error {
  constructor(code, message) {
    const safeMessage = typeof message === 'string'
      ? Array.from(message.replace(/[\u0000-\u001f\u007f]/gu, ' ')
        .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/gu, '�'))
        .slice(0, 240).join('') : 'Não foi possível concluir a operação.';
    super(safeMessage);
    this.name = 'PlanError';
    this.code = typeof code === 'string' && /^E_[A-Z0-9_]{1,38}$/u.test(code) ? code : 'E_INPUT';
  }
}

const MODEL_ERRORS = new WeakSet();
const DIRECTIONS = ['across', 'down'];
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/u;
const PROJECT_KEYS = ['version', 'puzzle', 'entries'];
const PUZZLE_KEYS = ['id', 'title', 'subtitle', 'author', 'width', 'height'];
const ENTRY_KEYS = ['id', 'source', 'answer', 'clue', 'placement'];
const POSITION_KEYS = ['row', 'col', 'direction'];

function fail(code, message) {
  const error = new PlanError(code, message);
  MODEL_ERRORS.add(error);
  throw error;
}
function safely(operation) {
  try { return operation(); } catch (error) {
    if (MODEL_ERRORS.has(error)) throw error;
    // Proxies revogados/hostis não podem injetar mensagens de erro na interface.
    fail('E_SCHEMA', 'Não foi possível ler a estrutura dos dados.');
  }
}
function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
/** Snapshots por descritores: getters, símbolos, classes e campos extras são recusados. */
function record(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('E_SCHEMA', 'A estrutura dos dados é inválida.');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('E_SCHEMA', 'Use somente registros de dados.');
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => !keys.includes(key))) {
    fail('E_SCHEMA', 'Os campos dos dados são inválidos.');
  }
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('E_SCHEMA', 'Os campos devem conter somente dados.');
    }
    result[key] = descriptor.value;
  }
  return result;
}
/** Não chama iteradores nem métodos fornecidos pelas coleções recebidas. */
function list(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail('E_SCHEMA', 'As coleções devem ser listas simples.');
  }
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (!Number.isSafeInteger(length) || length < 0) fail('E_SCHEMA', 'Uma lista é inválida.');
  if (length > maximum) fail('E_LIMIT', 'O limite de itens foi excedido.');
  if (Reflect.ownKeys(value).length !== length + 1) fail('E_SCHEMA', 'Use somente itens consecutivos nas listas.');
  const result = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('E_SCHEMA', 'As listas devem conter somente dados consecutivos.');
    }
    result.push(descriptor.value);
  }
  return result;
}
function text(value, maximum, optional = false) {
  if (typeof value !== 'string') fail('E_SCHEMA', 'Um campo de texto é inválido.');
  if ((!optional || value !== '') && value.trim() === '') fail('E_SCHEMA', 'Preencha os textos obrigatórios.');
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit <= 0x1f || unit === 0x7f || unit === 0x2028 || unit === 0x2029 || unit === 0xfffe || unit === 0xffff) {
      fail('E_SCHEMA', 'Os textos devem ocupar uma única linha.');
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('E_SCHEMA', 'Um texto contém Unicode inválido.');
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) fail('E_SCHEMA', 'Um texto contém Unicode inválido.');
    length += 1;
    if (length > maximum) fail('E_LIMIT', 'O limite de tamanho de texto foi excedido.');
  }
  return value;
}
function id(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail('E_SCHEMA', 'Um identificador é inválido.');
  return value;
}
function size(value) {
  if (!Number.isSafeInteger(value) || value < MIN_GRID_SIZE || value > MAX_GRID_SIZE) {
    fail('E_LIMIT', 'Cada dimensão da grade deve estar entre 5 e 21.');
  }
  return value;
}
function normalizedAnswer(source) {
  text(source, MAX_SOURCE_LENGTH);
  const letters = source.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/[ '\-’]/gu, '');
  if (!/^[A-Za-z]+$/u.test(letters)) fail('E_ANSWER', 'Use letras latinas, espaços, hífens e apóstrofos permitidos.');
  if (letters.length < 2 || letters.length > MAX_ANSWER_LENGTH) {
    fail('E_ANSWER', 'A resposta deve resultar em 2 a 21 letras A–Z.');
  }
  return letters.toUpperCase();
}
export function prepareAnswer(source) { return safely(() => normalizedAnswer(source)); }

function readPlacement(value) {
  if (value === null) return null;
  const data = record(value, POSITION_KEYS);
  if (!Number.isSafeInteger(data.row) || data.row < 0 || !Number.isSafeInteger(data.col) || data.col < 0
    || !DIRECTIONS.includes(data.direction)) fail('E_SCHEMA', 'A posição ou direção é inválida.');
  return { row: data.row, col: data.col, direction: data.direction };
}
function readEntry(value) {
  const data = record(value, ENTRY_KEYS);
  const answer = normalizedAnswer(data.source);
  if (data.answer !== answer) fail('E_ANSWER', 'A resposta canônica não corresponde à resposta original.');
  return { id: id(data.id), source: data.source, answer, clue: text(data.clue, MAX_CLUE_LENGTH, true),
    placement: readPlacement(data.placement) };
}
function readPuzzle(value) {
  const data = record(value, PUZZLE_KEYS);
  return { id: id(data.id), title: text(data.title, MAX_TITLE_LENGTH),
    subtitle: text(data.subtitle, MAX_SUBTITLE_LENGTH, true), author: text(data.author, MAX_AUTHOR_LENGTH, true),
    width: size(data.width), height: size(data.height) };
}

/** Única construção da geometria física; pendências editoriais são analisadas depois. */
function geometry(project) {
  const { width, height } = project.puzzle;
  const grid = Array.from({ length: height }, () => Array.from({ length: width },
    () => ({ letter: null, number: null, entryIds: [] })));
  const owners = new Map(project.entries.map((entry) => [entry.id, entry]));
  for (const entry of project.entries) {
    if (!entry.placement) continue;
    const { row, col, direction } = entry.placement;
    const down = direction === 'down';
    if (row >= height || col >= width || (down ? row : col) + entry.answer.length > (down ? height : width)) {
      fail('E_GEOMETRY', 'Uma palavra ultrapassa os limites da grade.');
    }
    for (let index = 0; index < entry.answer.length; index += 1) {
      const cell = grid[row + (down ? index : 0)][col + (down ? 0 : index)];
      if (cell.entryIds.some((owner) => owners.get(owner).placement.direction === direction)) {
        fail('E_GEOMETRY', 'Palavras da mesma direção não podem compartilhar células.');
      }
      if (cell.letter !== null && cell.letter !== entry.answer[index]) {
        fail('E_GEOMETRY', 'As letras de um cruzamento devem ser iguais.');
      }
      cell.letter = entry.answer[index];
      cell.entryIds.push(entry.id);
    }
  }
  return grid;
}
function copyProject(value) {
  const data = record(value, PROJECT_KEYS);
  if (data.version !== 1) fail('E_SCHEMA', 'A versão do projeto não é compatível.');
  const project = { version: 1, puzzle: readPuzzle(data.puzzle), entries: list(data.entries, MAX_ENTRIES).map(readEntry) };
  const ids = new Set();
  for (const entry of project.entries) {
    if (ids.has(entry.id)) fail('E_SCHEMA', 'Os identificadores das entradas devem ser únicos.');
    ids.add(entry.id);
  }
  geometry(project);
  return project;
}
function signature(row, col, direction, length) { return `${row}:${col}:${direction}:${length}`; }
function placedSignature(entry) {
  return signature(entry.placement.row, entry.placement.col, entry.placement.direction, entry.answer.length);
}
function requireEntry(project, entryId) {
  id(entryId);
  const entry = project.entries.find((item) => item.id === entryId);
  if (!entry) fail('E_NOT_FOUND', 'A entrada não foi encontrada.');
  return entry;
}
function issue(code, entryIds = [], row = null, col = null, direction = null, length = null) {
  return { code, entryIds, row, col, direction, length };
}
function comparePosition(a, b) {
  return a.row - b.row || a.col - b.col || DIRECTIONS.indexOf(a.direction) - DIRECTIONS.indexOf(b.direction)
    || a.length - b.length;
}

/** Reconstrói números, sequências maximais e componentes sem mudar o projeto recebido. */
function analysis(project) {
  const grid = geometry(project);
  const placed = project.entries.filter((entry) => entry.placement !== null);
  const starts = new Map();
  for (const entry of placed) starts.set(`${entry.placement.row}:${entry.placement.col}`, entry.placement);
  [...starts.values()].sort((a, b) => a.row - b.row || a.col - b.col).forEach((start, index) => {
    grid[start.row][start.col].number = index + 1;
  });
  const crossingCounts = new Map(project.entries.map((entry) => [entry.id, 0]));
  const neighbors = new Map(placed.map((entry) => [entry.id, new Set()]));
  let lightCells = 0;
  let crossings = 0;
  for (const row of grid) for (const cell of row) {
    if (cell.letter !== null) lightCells += 1;
    if (cell.entryIds.length === 2) {
      crossings += 1;
      const [first, second] = cell.entryIds;
      crossingCounts.set(first, crossingCounts.get(first) + 1);
      crossingCounts.set(second, crossingCounts.get(second) + 1);
      neighbors.get(first).add(second);
      neighbors.get(second).add(first);
    }
  }
  let components = 0;
  const visited = new Set();
  for (const entry of placed) {
    if (visited.has(entry.id)) continue;
    components += 1;
    const pending = [entry.id];
    visited.add(entry.id);
    while (pending.length) for (const neighbor of neighbors.get(pending.pop())) {
      if (!visited.has(neighbor)) { visited.add(neighbor); pending.push(neighbor); }
    }
  }
  const runs = [];
  const { width, height } = project.puzzle;
  for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) {
    if (grid[row][col].letter === null) continue;
    for (const direction of DIRECTIONS) {
      const down = direction === 'down';
      if ((down ? row : col) > 0 && grid[row - (down ? 1 : 0)][col - (down ? 0 : 1)].letter !== null) continue;
      let length = 0;
      const owners = new Set();
      while (row + (down ? length : 0) < height && col + (down ? 0 : length) < width) {
        const cell = grid[row + (down ? length : 0)][col + (down ? 0 : length)];
        if (cell.letter === null) break;
        cell.entryIds.forEach((owner) => owners.add(owner));
        length += 1;
      }
      if (length >= 2) runs.push({ row, col, direction, length, owners });
    }
  }
  const entrySignatures = new Set(placed.map(placedSignature));
  const runSignatures = new Set(runs.map((run) => signature(run.row, run.col, run.direction, run.length)));
  const mismatches = new Map();
  for (const run of runs) {
    const key = signature(run.row, run.col, run.direction, run.length);
    if (!entrySignatures.has(key)) mismatches.set(key, issue('RUN_MISMATCH',
      project.entries.filter((entry) => run.owners.has(entry.id)).map((entry) => entry.id),
      run.row, run.col, run.direction, run.length));
  }
  for (const entry of placed) if (!runSignatures.has(placedSignature(entry))) {
    const { row, col, direction } = entry.placement;
    mismatches.set(placedSignature(entry), issue('RUN_MISMATCH', [entry.id], row, col, direction, entry.answer.length));
  }
  const issues = [];
  if (!project.entries.length) issues.push(issue('EMPTY'));
  for (const entry of project.entries) if (!entry.placement) issues.push(issue('UNPLACED', [entry.id]));
  for (const entry of project.entries) if (!entry.clue) issues.push(issue('MISSING_CLUE', [entry.id]));
  if (components > 1) issues.push(issue('DISCONNECTED', placed.map((entry) => entry.id)));
  issues.push(...[...mismatches.values()].sort(comparePosition));
  const entries = project.entries.map((entry) => ({ id: entry.id,
    number: entry.placement ? grid[entry.placement.row][entry.placement.col].number : null,
    row: entry.placement?.row ?? null, col: entry.placement?.col ?? null,
    direction: entry.placement?.direction ?? null, length: entry.answer.length,
    placed: entry.placement !== null, crossings: crossingCounts.get(entry.id) }));
  return { grid, entries, issues, stats: { entries: project.entries.length, placed: placed.length,
    unplaced: project.entries.length - placed.length, lightCells, crossings, components }, ready: issues.length === 0 };
}

export function createProject(projectId) {
  return validateProject({ version: 1, puzzle: { id: projectId, title: 'Minha cruzada', subtitle: '', author: '',
    width: 11, height: 11 }, entries: [] });
}
export function validateProject(value) { return safely(() => deepFreeze(copyProject(value))); }
export function setPuzzle(project, value) {
  return safely(() => {
    const draft = copyProject(project);
    const data = record(value, ['title', 'subtitle', 'author', 'width', 'height']);
    draft.puzzle = readPuzzle({ id: draft.puzzle.id, ...data });
    geometry(draft);
    return deepFreeze(draft);
  });
}
export function upsertEntry(project, value) {
  return safely(() => {
    const draft = copyProject(project);
    const entry = readEntry(value);
    const index = draft.entries.findIndex((item) => item.id === entry.id);
    if (index === -1) {
      if (draft.entries.length >= MAX_ENTRIES) fail('E_LIMIT', 'O limite de 40 entradas foi atingido.');
      draft.entries.push(entry);
    } else draft.entries[index] = entry;
    geometry(draft);
    return deepFreeze(draft);
  });
}
export function removeEntry(project, entryId) {
  return safely(() => {
    const draft = copyProject(project);
    requireEntry(draft, entryId);
    draft.entries = draft.entries.filter((entry) => entry.id !== entryId);
    return deepFreeze(draft);
  });
}
export function placeEntry(project, entryId, value) {
  return safely(() => {
    const draft = copyProject(project);
    const entry = requireEntry(draft, entryId);
    const placement = readPlacement(value);
    if (placement === null) fail('E_SCHEMA', 'Informe uma posição para a palavra.');
    entry.placement = placement;
    geometry(draft);
    return deepFreeze(draft);
  });
}
export function unplaceEntry(project, entryId) {
  return safely(() => {
    const draft = copyProject(project);
    requireEntry(draft, entryId).placement = null;
    return deepFreeze(draft);
  });
}
export function analyze(project) { return safely(() => deepFreeze(analysis(copyProject(project)))); }

/** Busca exaustiva limitada a duas direções × 21 × 21 inícios; nenhuma opção é aplicada. */
export function findPlacements(project, entryId, options = {}) {
  return safely(() => {
    const draft = copyProject(project);
    const entry = requireEntry(draft, entryId);
    const optionKeys = options !== null && typeof options === 'object' ? Reflect.ownKeys(options) : [];
    const data = record(options, optionKeys.length === 0 ? [] : ['limit']);
    const limit = Object.hasOwn(data, 'limit') ? data.limit : 12;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SUGGESTIONS) {
      fail('E_LIMIT', 'O limite de sugestões deve estar entre 1 e 20.');
    }
    entry.placement = null;
    const otherPlaced = draft.entries.some((item) => item.placement !== null);
    const suggestions = [];
    const { width, height } = draft.puzzle;
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) {
      for (const direction of DIRECTIONS) {
        const down = direction === 'down';
        if ((down ? row : col) + entry.answer.length > (down ? height : width)) continue;
        entry.placement = { row, col, direction };
        let result;
        try { result = analysis(draft); } catch (error) {
          if (MODEL_ERRORS.has(error) && error.code === 'E_GEOMETRY') continue;
          throw error;
        }
        const own = result.entries.find((item) => item.id === entry.id);
        if (result.stats.components !== 1 || (otherPlaced && own.crossings < 1)
          || result.issues.some((item) => item.code === 'RUN_MISMATCH')) continue;
        let minRow = height; let minCol = width; let maxRow = -1; let maxCol = -1;
        result.grid.forEach((cells, r) => cells.forEach((cell, c) => {
          if (cell.letter !== null) { minRow = Math.min(minRow, r); minCol = Math.min(minCol, c);
            maxRow = Math.max(maxRow, r); maxCol = Math.max(maxCol, c); }
        }));
        suggestions.push({ row, col, direction, crossings: own.crossings,
          area: (maxRow - minRow + 1) * (maxCol - minCol + 1),
          centerDistance: Math.abs(2 * row + (down ? entry.answer.length - 1 : 0) - (height - 1))
            + Math.abs(2 * col + (down ? 0 : entry.answer.length - 1) - (width - 1)) });
      }
    }
    suggestions.sort((a, b) => b.crossings - a.crossings || a.area - b.area || a.centerDistance - b.centerDistance
      || a.row - b.row || a.col - b.col || DIRECTIONS.indexOf(a.direction) - DIRECTIONS.indexOf(b.direction));
    return deepFreeze(suggestions.slice(0, limit));
  });
}

function readyAnalysis(project) {
  const result = analysis(copyProject(project));
  if (!result.ready) fail('E_NOT_READY', 'Conclua as pendências antes de experimentar ou exportar a atividade.');
  return result;
}
export function createAttempt(project) {
  return safely(() => deepFreeze(readyAnalysis(project).grid.map((row) => row.map((cell) => cell.letter === null ? '#' : ''))));
}
export function checkAttempt(project, cells) {
  return safely(() => {
    const result = readyAnalysis(project);
    const rows = list(cells, result.grid.length);
    if (rows.length !== result.grid.length) fail('E_SCHEMA', 'A tentativa deve ter a altura da grade.');
    let filled = 0; let correct = 0;
    const wrongCells = []; const emptyCells = [];
    rows.forEach((row, r) => {
      const values = list(row, result.grid[r].length);
      if (values.length !== result.grid[r].length) fail('E_SCHEMA', 'A tentativa deve ter a largura da grade.');
      values.forEach((value, c) => {
        const letter = result.grid[r][c].letter;
        if (letter === null) {
          if (value !== '#') fail('E_SCHEMA', 'Os bloqueios da tentativa devem ser preservados.');
        } else {
          if (typeof value !== 'string' || (value !== '' && !/^[A-Z]$/u.test(value))) {
            fail('E_SCHEMA', 'Cada célula deve conter uma letra A–Z ou estar vazia.');
          }
          if (value === '') emptyCells.push({ row: r, col: c });
          else { filled += 1; if (value === letter) correct += 1; else wrongCells.push({ row: r, col: c }); }
        }
      });
    });
    return deepFreeze({ filled, correct, total: result.stats.lightCells,
      complete: correct === result.stats.lightCells, wrongCells, emptyCells });
  });
}
