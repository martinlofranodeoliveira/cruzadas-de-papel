import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PlanError, LIMITS, createProject, validateProject, setPuzzle, prepareAnswer,
  upsertEntry, removeEntry, placeEntry, unplaceEntry, analyze, findPlacements,
  createAttempt, checkAttempt,
} from '../src/model.mjs';

const clone = (value) => JSON.parse(JSON.stringify(value));
const position = (row, col, direction = 'across') => ({ row, col, direction });
const entry = (id, answer, placement = null, clue = 'Pista original.') => ({ id, source: answer, answer, clue, placement });
function small(width = 5, height = 5) {
  return setPuzzle(createProject('test'), { title: 'Teste', subtitle: '', author: '', width, height });
}
function projectWith(entries, width = 5, height = 5) {
  return validateProject({ ...small(width, height), entries });
}
function errorCode(code, action) {
  assert.throws(action, (error) => error instanceof PlanError && error.code === code);
}
function frozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  Object.values(value).forEach(frozen);
}
const square = () => projectWith([
  entry('cd', 'CD', position(1, 0)), entry('bd', 'BD', position(0, 1, 'down')),
  entry('ac', 'AC', position(0, 0, 'down')), entry('ab', 'AB', position(0, 0)),
]);

test('defaults, closed canonical shapes and deep copies retain explicit stable identity', () => {
  const blank = createProject('a_B-9');
  assert.deepEqual(blank, { version: 1, puzzle: { id: 'a_B-9', title: 'Minha cruzada', subtitle: '', author: '',
    width: 11, height: 11 }, entries: [] });
  frozen(blank); frozen(LIMITS);
  const input = clone(square());
  const copy = validateProject(input);
  assert.notEqual(copy, input); assert.notEqual(copy.puzzle, input.puzzle);
  assert.notEqual(copy.entries, input.entries); assert.notEqual(copy.entries[0].placement, input.entries[0].placement);
  input.entries[0].placement.row = 4;
  assert.equal(copy.entries[0].placement.row, 1);
  const changed = setPuzzle(copy, { title: '  Título exato  ', subtitle: '', author: 'Nome', width: 6, height: 7 });
  assert.equal(changed.puzzle.id, copy.puzzle.id);
  assert.equal(changed.puzzle.title, '  Título exato  ');
  frozen(copy); frozen(changed);
  const nullRecord = Object.assign(Object.create(null), clone(blank));
  assert.deepEqual(validateProject(nullRecord), blank);
});

test('strict data snapshots reject getters, hidden fields, symbols, sparse arrays and forged classes without getters', () => {
  const mutations = [
    (p) => { p.extra = true; }, (p) => { delete p.version; }, (p) => { p.version = '1'; },
    (p) => { p.puzzle.extra = true; }, (p) => { p.entries[0].extra = true; },
    (p) => { p.entries[0].placement.extra = true; }, (p) => { p[Symbol('x')] = true; },
    (p) => { Object.defineProperty(p.puzzle, 'title', { value: 'T', enumerable: false }); },
    (p) => { p.entries.push(entry('cd', 'ZZ')); }, (p) => { delete p.entries[1]; },
    (p) => { p.entries.name = 'forged'; }, (p) => { Object.setPrototypeOf(p, { version: 1 }); },
    (p) => { Object.setPrototypeOf(p.entries, null); },
    (p) => { p.puzzle = new (class Puzzle { constructor() { Object.assign(this, p.puzzle); } })(); },
  ];
  for (const mutate of mutations) {
    const input = clone(square()); mutate(input);
    errorCode('E_SCHEMA', () => validateProject(input));
  }
  let calls = 0;
  for (const target of ['project', 'puzzle', 'entry', 'placement', 'array']) {
    const input = clone(square());
    const [object, key] = target === 'project' ? [input, 'version']
      : target === 'puzzle' ? [input.puzzle, 'title'] : target === 'entry' ? [input.entries[0], 'source']
        : target === 'placement' ? [input.entries[0].placement, 'row'] : [input.entries, '0'];
    Object.defineProperty(object, key, { get() { calls += 1; throw new Error('secret'); }, enumerable: true });
    errorCode('E_SCHEMA', () => validateProject(input));
  }
  assert.equal(calls, 0);
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  errorCode('E_SCHEMA', () => validateProject(revoked.proxy));
  const hostile = new Proxy({}, { ownKeys() { throw new Error('secret'.repeat(100)); } });
  assert.throws(() => validateProject(hostile), (error) => error.code === 'E_SCHEMA' && !error.message.includes('secret'));
  const e = new PlanError('invalid', 'a\n\u0000\ud800'.repeat(300));
  assert.equal(e.code, 'E_INPUT'); assert.equal(Array.from(e.message).length, 240);
  assert.doesNotMatch(e.message, /[\u0000-\u001f\u007f]|\ud800/u);
});

test('normalization is explicit, narrow, validates before uppercasing and preserves provenance', () => {
  for (const [source, answer] of [['ação', 'ACAO'], ['maçã', 'MACA'], ['São Paulo', 'SAOPAULO'],
    ["d'água", 'DAGUA'], ['d’água', 'DAGUA'], ['guarda-chuva', 'GUARDACHUVA'], ['ac\u0327a\u0303o', 'ACAO']]) {
    assert.equal(prepareAnswer(source), answer);
    const saved = upsertEntry(small(), { id: 'entry', source, answer, clue: '', placement: null });
    assert.equal(saved.entries[0].source, source);
    assert.equal(saved.entries[0].answer, answer);
  }
  for (const source of ['ßa', 'æa', 'œa', 'a\u00a0b', 'a—b', 'a_b', 'a/b', 'a2', '你好', 'аa', 'ab🙂',
    'a\u1ab0b', 'a\u200bb', 'a“b', 'a‘b', 'a', 'a'.repeat(22)]) {
    errorCode('E_ANSWER', () => prepareAnswer(source));
  }
  for (const source of [null, 12, { toString() { throw new Error('coercion'); } }, '', '  ', 'a\nb', 'a\tb', 'a\0b',
    'a\u007fb', 'a\ud800b', 'a\udc00b', 'a\u2028b', 'a\u2029b', 'a\ufffeb', 'a\uffffb']) errorCode('E_SCHEMA', () => prepareAnswer(source));
  assert.equal(prepareAnswer('A'.repeat(21)), 'A'.repeat(21));
  assert.equal(prepareAnswer(`a${'\u0301'.repeat(78)}b`), 'AB');
  errorCode('E_LIMIT', () => prepareAnswer(`a${'\u0301'.repeat(79)}b`));
  errorCode('E_ANSWER', () => upsertEntry(small(), { ...entry('x', 'MACA'), source: 'ação' }));
  errorCode('E_ANSWER', () => upsertEntry(small(), { ...entry('x', 'AB'), answer: 'ab' }));
});

test('limits count Unicode points, validate every field and allow 40 independent entries', () => {
  const makeMeta = (changes) => ({ title: 'T', subtitle: '', author: '', width: 21, height: 21, ...changes });
  let p = setPuzzle(small(), makeMeta({ title: '🙂'.repeat(100), subtitle: 'ç'.repeat(160), author: '🙂'.repeat(80) }));
  assert.equal(p.puzzle.title.length, 200);
  for (const [key, max] of [['title', 100], ['subtitle', 160], ['author', 80]]) {
    errorCode('E_LIMIT', () => setPuzzle(p, makeMeta({ [key]: '🙂'.repeat(max + 1) })));
    errorCode('E_SCHEMA', () => setPuzzle(p, makeMeta({ [key]: '   ' })));
    for (const invalid of ['\ufffe', '\uffff']) errorCode('E_SCHEMA', () => setPuzzle(p, makeMeta({ [key]: `a${invalid}` })));
  }
  p = upsertEntry(p, { ...entry('x', 'AB'), clue: '🙂'.repeat(200) });
  errorCode('E_LIMIT', () => upsertEntry(p, { ...entry('x', 'AB'), clue: '🙂'.repeat(201) }));
  errorCode('E_SCHEMA', () => upsertEntry(p, { ...entry('x', 'AB'), clue: ' ' }));
  for (const invalid of ['\ufffe', '\uffff']) errorCode('E_SCHEMA', () => upsertEntry(p, { ...entry('x', 'AB'), clue: `a${invalid}` }));
  for (const dim of [4, 22, 5.5, NaN, Infinity, '5', null]) {
    errorCode('E_LIMIT', () => setPuzzle(p, makeMeta({ width: dim })));
    errorCode('E_LIMIT', () => setPuzzle(p, makeMeta({ height: dim })));
  }
  for (const bad of ['', '_x', '-x', 'á', 'a'.repeat(41), 'ab\n', 'a b', 1]) errorCode('E_SCHEMA', () => createProject(bad));
  assert.equal(createProject('a'.repeat(40)).puzzle.id.length, 40);
  p = small();
  for (let i = 0; i < 40; i += 1) p = upsertEntry(p, entry(`e${i}`, 'AB'));
  assert.equal(p.entries.length, 40);
  assert.equal(new Set(p.entries.map((item) => item.answer)).size, 1);
  errorCode('E_LIMIT', () => upsertEntry(p, entry('extra', 'AB')));
  assert.equal(upsertEntry(p, entry('e0', 'CD')).entries[0].answer, 'CD');
});

test('geometry rejects collisions, parallel overlap and out of bounds atomically', () => {
  const p = projectWith([entry('base', 'ABCD', position(2, 0)), entry('free', 'ZZ')]);
  const before = JSON.stringify(p);
  for (const next of [entry('x', 'ZZ', position(1, 1, 'down')), entry('x', 'BC', position(2, 1)),
    entry('x', 'ABCD', position(2, 0)), entry('x', 'AB', position(4, 0, 'down')),
    entry('x', 'AB', position(0, 4)), entry('x', 'AB', position(9, 0))]) {
    errorCode('E_GEOMETRY', () => upsertEntry(p, next));
    assert.equal(JSON.stringify(p), before);
  }
  for (const bad of [position(-1, 0), position(0.2, 0), position(0, Number.MAX_SAFE_INTEGER + 1),
    position(0, 0, 'horizontal'), { row: 0, col: 0 }, null]) {
    errorCode('E_SCHEMA', () => placeEntry(p, 'free', bad));
  }
  errorCode('E_GEOMETRY', () => placeEntry(p, 'base', position(3, 3)));
  const large = projectWith([entry('edge', 'AB', position(6, 5))], 7, 7);
  errorCode('E_GEOMETRY', () => setPuzzle(large, { title: 'T', subtitle: '', author: '', width: 5, height: 5 }));
  assert.equal(large.puzzle.width, 7);
  const crossed = upsertEntry(p, entry('yes', 'XBY', position(1, 1, 'down')));
  assert.equal(analyze(crossed).stats.crossings, 1);
  assert.equal(analyze(crossed).grid[2][1].letter, 'B');
  const maximal = projectWith([entry('long', 'A'.repeat(21), position(20, 0))], 21, 21);
  assert.equal(analyze(maximal).stats.lightCells, 21);
  errorCode('E_GEOMETRY', () => placeEntry(maximal, 'long', position(20, 1)));
});

test('moves replace their own cells; removal, upsert and unplacing preserve order and leave inputs untouched', () => {
  const p = square(); const initial = JSON.stringify(p);
  assert.equal(unplaceEntry(p, 'ab').entries[3].placement, null);
  const moved = placeEntry(unplaceEntry(p, 'ab'), 'ab', position(0, 0));
  assert.deepEqual(moved, p);
  const changed = upsertEntry(p, { ...p.entries[3], clue: 'Outra pista.' });
  assert.deepEqual(changed.entries.map((item) => item.id), ['cd', 'bd', 'ac', 'ab']);
  assert.equal(removeEntry(p, 'ac').entries.length, 3);
  assert.equal(JSON.stringify(p), initial);
  for (const operation of [removeEntry, unplaceEntry, (state, id) => placeEntry(state, id, position(0, 0)), findPlacements]) {
    errorCode('E_NOT_FOUND', () => operation(p, 'missing'));
    errorCode('E_SCHEMA', () => operation(p, '$invalid'));
  }
  const alone = projectWith([entry('x', 'ABC', position(1, 0))]);
  assert.deepEqual(placeEntry(alone, 'x', position(1, 1)).entries[0].placement, position(1, 1));
});

test('independent literal 2×2 golden fixes numbers, registration order, maximal runs and crossing counts', () => {
  const result = analyze(square());
  assert.equal(result.ready, true); assert.deepEqual(result.issues, []);
  assert.deepEqual(result.stats, { entries: 4, placed: 4, unplaced: 0, lightCells: 4, crossings: 4, components: 1 });
  assert.deepEqual(result.grid.map((row) => row.map((cell) => cell.letter ?? '#').join('')),
    ['AB###', 'CD###', '#####', '#####', '#####']);
  assert.deepEqual(result.grid.map((row) => row.map((cell) => cell.number)),
    [[1, 2, null, null, null], [3, null, null, null, null], ...Array.from({ length: 3 }, () => Array(5).fill(null))]);
  assert.deepEqual(result.grid[0][0].entryIds, ['ac', 'ab']);
  assert.deepEqual(result.grid[1][1].entryIds, ['cd', 'bd']);
  assert.deepEqual(result.entries, [
    { id: 'cd', number: 3, row: 1, col: 0, direction: 'across', length: 2, placed: true, crossings: 2 },
    { id: 'bd', number: 2, row: 0, col: 1, direction: 'down', length: 2, placed: true, crossings: 2 },
    { id: 'ac', number: 1, row: 0, col: 0, direction: 'down', length: 2, placed: true, crossings: 2 },
    { id: 'ab', number: 1, row: 0, col: 0, direction: 'across', length: 2, placed: true, crossings: 2 },
  ]);
  frozen(result);
});

test('draft diagnostics are valid states, stable, localized and detect accidental maximal runs', () => {
  assert.deepEqual(analyze(small()).issues.map((item) => item.code), ['EMPTY']);
  const p = projectWith([entry('u', 'AB', null, ''), entry('one', 'AB', position(0, 0), ''),
    entry('two', 'CD', position(4, 3))]);
  const result = analyze(p);
  assert.equal(result.ready, false);
  assert.deepEqual(result.issues.map((item) => [item.code, item.entryIds]), [
    ['UNPLACED', ['u']], ['MISSING_CLUE', ['u']], ['MISSING_CLUE', ['one']], ['DISCONNECTED', ['one', 'two']],
  ]);
  assert.deepEqual(result.entries[0], { id: 'u', number: null, row: null, col: null, direction: null,
    length: 2, placed: false, crossings: 0 });
  const adjacent = projectWith([entry('first', 'AB', position(2, 0)), entry('second', 'CD', position(2, 2))]);
  const runs = analyze(adjacent).issues.filter((item) => item.code === 'RUN_MISMATCH');
  assert.deepEqual(runs, [
    { code: 'RUN_MISMATCH', entryIds: ['first'], row: 2, col: 0, direction: 'across', length: 2 },
    { code: 'RUN_MISMATCH', entryIds: ['first', 'second'], row: 2, col: 0, direction: 'across', length: 4 },
    { code: 'RUN_MISMATCH', entryIds: ['second'], row: 2, col: 2, direction: 'across', length: 2 },
  ]);
  const parallel = projectWith([entry('a', 'AB', position(0, 0)), entry('b', 'CD', position(1, 0))]);
  assert.deepEqual(analyze(parallel).issues.filter((item) => item.code === 'RUN_MISMATCH')
    .map((item) => [item.row, item.col, item.direction, item.length]), [[0, 0, 'down', 2], [0, 1, 'down', 2]]);
  const solo = projectWith([entry('x', 'AB', position(2, 2))]);
  assert.equal(analyze(solo).ready, true); // Não inventa entradas perpendiculares de uma célula.
});

test('attempts are temporary strict copied matrices, count visible cells once and require readiness', () => {
  const p = square(); const attempt = createAttempt(p); frozen(attempt);
  assert.deepEqual(attempt, [['', '', '#', '#', '#'], ['', '', '#', '#', '#'], ...Array.from({ length: 3 }, () => Array(5).fill('#'))]);
  const empty = checkAttempt(p, attempt);
  assert.deepEqual(empty, { filled: 0, correct: 0, total: 4, complete: false, wrongCells: [],
    emptyCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }] });
  const partial = clone(attempt); partial[0][0] = 'A'; partial[1][1] = 'Z';
  assert.deepEqual(checkAttempt(p, partial), { filled: 2, correct: 1, total: 4, complete: false,
    wrongCells: [{ row: 1, col: 1 }], emptyCells: [{ row: 0, col: 1 }, { row: 1, col: 0 }] });
  const solution = analyze(p).grid.map((row) => row.map((cell) => cell.letter ?? '#'));
  assert.equal(checkAttempt(p, solution).complete, true);
  assert.deepEqual(attempt[0], ['', '', '#', '#', '#']);
  frozen(empty); frozen(checkAttempt(p, partial));
  for (const value of ['a', 'Ç', 'AB', null, 1, '#', 'A\n', '\ud800']) {
    const bad = clone(attempt); bad[0][0] = value;
    errorCode('E_SCHEMA', () => checkAttempt(p, bad));
  }
  for (const mutate of [(a) => { a[2][2] = ''; }, (a) => a.pop(), (a) => a[0].pop(),
    (a) => { delete a[0][0]; }, (a) => { a.extra = 1; }, (a) => { a[0].extra = 1; }]) {
    const bad = clone(attempt); mutate(bad); errorCode('E_SCHEMA', () => checkAttempt(p, bad));
  }
  let calls = 0; const getter = clone(attempt);
  Object.defineProperty(getter[0], '0', { enumerable: true, get() { calls += 1; return 'A'; } });
  errorCode('E_SCHEMA', () => checkAttempt(p, getter)); assert.equal(calls, 0);
  errorCode('E_NOT_READY', () => createAttempt(small()));
  errorCode('E_NOT_READY', () => checkAttempt(unplaceEntry(p, 'ab'), attempt));
});

/** Oracle deliberately uses coordinate maps, interval maximality and union by sets,
 * rather than the model's grid walk/adjacency traversal. No model result is input. */
function oracle(project) {
  const occupied = new Map();
  const placed = project.entries.filter((item) => item.placement);
  for (const word of placed) {
    for (let k = 0; k < word.answer.length; k += 1) {
      const r = word.placement.row + (word.placement.direction === 'down' ? k : 0);
      const c = word.placement.col + (word.placement.direction === 'across' ? k : 0);
      if (r >= project.puzzle.height || c >= project.puzzle.width) return { physical: false };
      const key = `${r},${c}`;
      const previous = occupied.get(key) ?? [];
      if (previous.some((old) => old.direction === word.placement.direction || old.letter !== word.answer[k])) {
        return { physical: false };
      }
      occupied.set(key, [...previous, { id: word.id, direction: word.placement.direction, letter: word.answer[k] }]);
    }
  }
  let components = placed.map((word) => new Set([word.id]));
  const counts = Object.fromEntries(project.entries.map((word) => [word.id, 0]));
  let crossings = 0;
  for (const owners of occupied.values()) if (owners.length === 2) {
    crossings += 1; owners.forEach((owner) => { counts[owner.id] += 1; });
    const touching = components.filter((set) => owners.some((owner) => set.has(owner.id)));
    const merged = new Set(touching.flatMap((set) => [...set]));
    components = components.filter((set) => !touching.includes(set)); components.push(merged);
  }
  const startCoordinates = [...new Set(placed.map((word) => `${word.placement.row},${word.placement.col}`))]
    .map((key) => key.split(',').map(Number)).sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2);
  const numbers = Object.fromEntries(placed.map((word) => [word.id,
    startCoordinates.findIndex(([r, c]) => r === word.placement.row && c === word.placement.col) + 1]));
  const runs = new Set();
  for (const direction of ['across', 'down']) {
    const down = direction === 'down';
    const major = down ? project.puzzle.width : project.puzzle.height;
    const minor = down ? project.puzzle.height : project.puzzle.width;
    for (let line = 0; line < major; line += 1) {
      let first = null;
      for (let offset = 0; offset <= minor; offset += 1) {
        const key = down ? `${offset},${line}` : `${line},${offset}`;
        if (offset < minor && occupied.has(key)) { if (first === null) first = offset; }
        else if (first !== null) {
          if (offset - first >= 2) runs.add(`${down ? first : line},${down ? line : first},${direction},${offset - first}`);
          first = null;
        }
      }
    }
  }
  const declared = new Set(placed.map((word) => `${word.placement.row},${word.placement.col},${word.placement.direction},${word.answer.length}`));
  const mismatch = [...runs].some((key) => !declared.has(key)) || [...declared].some((key) => !runs.has(key));
  const ready = project.entries.length > 0 && placed.length === project.entries.length
    && project.entries.every((word) => word.clue !== '') && components.length === 1 && !mismatch;
  const coordinates = [...occupied.keys()].map((key) => key.split(',').map(Number));
  const area = coordinates.length ? (Math.max(...coordinates.map(([r]) => r)) - Math.min(...coordinates.map(([r]) => r)) + 1)
    * (Math.max(...coordinates.map(([, c]) => c)) - Math.min(...coordinates.map(([, c]) => c)) + 1) : 0;
  return { physical: true, components: components.length, crossings, counts, lightCells: occupied.size, numbers, mismatch, ready, area };
}

test('independent interval/union oracle checks 700 deterministic adversarial geometries', () => {
  let seed = 5397;
  const next = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 12) % n; };
  let accepted = 0; let rejected = 0; let accidental = 0;
  for (let sample = 0; sample < 700; sample += 1) {
    const p = clone(small());
    const count = 1 + next(8);
    for (let w = 0; w < count; w += 1) {
      const length = 2 + next(4);
      const answer = Array.from({ length }, () => 'ABC'[next(3)]).join('');
      p.entries.push(entry(`e${w}`, answer, next(6) === 0 ? null : position(next(5), next(5), next(2) ? 'across' : 'down'), next(6) ? 'Pista' : ''));
    }
    const expected = oracle(p);
    if (!expected.physical) { errorCode('E_GEOMETRY', () => validateProject(p)); rejected += 1; continue; }
    const result = analyze(p); accepted += 1;
    assert.equal(result.ready, expected.ready, `ready sample ${sample}`);
    assert.equal(result.stats.components, expected.components, `components sample ${sample}`);
    assert.equal(result.stats.crossings, expected.crossings);
    assert.equal(result.stats.lightCells, expected.lightCells);
    assert.equal(result.issues.some((item) => item.code === 'RUN_MISMATCH'), expected.mismatch);
    if (expected.mismatch) accidental += 1;
    for (const row of result.entries) {
      assert.equal(row.crossings, expected.counts[row.id]);
      assert.equal(row.number, expected.numbers[row.id] ?? null);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(validateProject(p))), p);
  }
  assert.ok(accepted > 20); assert.ok(rejected > 20); assert.ok(accidental > 5);
});

function exhaustiveSuggestions(project, id, limit = 20) {
  const draft = clone(project);
  const word = draft.entries.find((item) => item.id === id); word.placement = null;
  const others = draft.entries.some((item) => item.placement);
  const possible = [];
  for (let r = 0; r < draft.puzzle.height; r += 1) for (let c = 0; c < draft.puzzle.width; c += 1) {
    for (const direction of ['across', 'down']) {
      word.placement = position(r, c, direction);
      const value = oracle(draft);
      if (!value.physical || value.mismatch || value.components !== 1 || (others && !value.counts[id])) continue;
      const rr = 2 * r + (direction === 'down' ? word.answer.length - 1 : 0);
      const cc = 2 * c + (direction === 'across' ? word.answer.length - 1 : 0);
      possible.push({ row: r, col: c, direction, crossings: value.counts[id], area: value.area,
        centerDistance: Math.abs(rr - draft.puzzle.height + 1) + Math.abs(cc - draft.puzzle.width + 1) });
    }
  }
  return possible.sort((a, b) => b.crossings - a.crossings || a.area - b.area || a.centerDistance - b.centerDistance
    || a.row - b.row || a.col - b.col || (a.direction === 'across' ? 0 : 1) - (b.direction === 'across' ? 0 : 1)).slice(0, limit);
}

test('suggestions exhaust all candidates and rank crossings, area, doubled center and deterministic ties', () => {
  const cases = [
    projectWith([entry('x', 'ABC')]),
    projectWith([entry('a', 'ABC', position(2, 0)), entry('x', 'BAD')]),
    projectWith([entry('a', 'AAA', position(2, 1)), entry('x', 'AAA', position(0, 0, 'down')), entry('pending', 'ZZ', null, '')]),
    unplaceEntry(square(), 'cd'),
    projectWith([entry('a', 'AB', position(0, 0)), entry('b', 'CD', position(4, 3)), entry('x', 'AC')]),
    projectWith([entry('a', 'ZZ', position(0, 0)), entry('x', 'AB')]),
  ];
  for (const p of cases) {
    const snapshot = JSON.stringify(p);
    const target = p.entries.some((w) => w.id === 'x') ? 'x' : 'cd';
    assert.deepEqual(findPlacements(p, target, { limit: 20 }), exhaustiveSuggestions(p, target));
    assert.equal(JSON.stringify(p), snapshot);
  }
  const p = cases[0];
  assert.deepEqual(findPlacements(p, 'x', { limit: 1 }), [{ row: 1, col: 2, direction: 'down', crossings: 0, area: 3, centerDistance: 0 }]);
  assert.equal(findPlacements(p, 'x').length, 12);
  assert.equal(findPlacements(p, 'x', { limit: 20 }).length, 20);
  assert.deepEqual(findPlacements(cases.at(-1), 'x'), []);
  frozen(findPlacements(p, 'x'));
  for (const limit of [0, 21, -1, 1.1, NaN, '1', null, undefined]) errorCode('E_LIMIT', () => findPlacements(p, 'x', { limit }));
  for (const options of [null, [], { limit: 1, extra: true }, { extra: true }]) errorCode('E_SCHEMA', () => findPlacements(p, 'x', options));
  let calls = 0; const options = {};
  Object.defineProperty(options, 'limit', { enumerable: true, get() { calls += 1; return 1; } });
  errorCode('E_SCHEMA', () => findPlacements(p, 'x', options)); assert.equal(calls, 0);
});

test('maximum 21×21 suggestion scan keeps exact boundary placements and a replayed project', () => {
  const p = projectWith([entry('x', 'A'.repeat(21))], 21, 21);
  const options = findPlacements(p, 'x', { limit: 20 });
  assert.deepEqual(options, exhaustiveSuggestions(p, 'x'));
  assert.deepEqual(options[0], { row: 0, col: 10, direction: 'down', crossings: 0, area: 21, centerDistance: 0 });
  let replay = small();
  for (const item of square().entries) replay = upsertEntry(replay, item);
  replay = placeEntry(unplaceEntry(replay, 'ab'), 'ab', position(0, 0));
  assert.deepEqual(replay, square());
  assert.deepEqual(validateProject(clone(replay)), replay);
});
