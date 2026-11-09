import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoProject } from '../src/demo.mjs';
import { analyze, createProject, validateProject } from '../src/model.mjs';
import { MAX_PROJECT_BYTES, parseProject, serializeProject, exportIpuz, exportSvg } from '../src/io.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const fixture = name => readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const throwsCode = (fn, code) => assert.throws(fn, error => error.code === code);
const decodeXml = value => value.replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[entity]);
const visibleText = value => decodeXml(value.replace(/<[^>]*>/g, ''));
const wrappingUnits = value => Array.from(value).reduce((sum, point) => sum + (point.codePointAt(0) < 128 ? 1 : 2), 0);
const ipuzKeys = ['version', 'kind', 'uniqueid', 'title', 'author', 'intro', 'dimensions', 'block', 'empty', 'charset', 'puzzle', 'clues'];

test('original demo fixes geometry, shared start, accents and Portuguese text', () => {
  const project = createDemoProject();
  const result = analyze(project);
  assert.equal(result.ready, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.stats, { entries: 9, placed: 9, unplaced: 0, lightCells: 28, crossings: 8, components: 1 });
  assert.deepEqual(result.entries.map(entry => [entry.id, entry.number]), [['casa', 1], ['cafe', 1], ['feira', 2], ['acao', 3], ['arte', 4], ['tema', 5], ['mala', 6], ['lua', 7], ['agua', 8]]);
  for (const [source, answer] of [['café', 'CAFE'], ['ação', 'ACAO'], ['água', 'AGUA']]) {
    assert.ok(project.entries.some(entry => entry.source === source && entry.answer === answer));
  }
  assert.ok(project.entries.some(entry => entry.clue.includes('&')));
  assert.ok(project.entries.some(entry => entry.clue.includes('<')));
  assert.notEqual(createDemoProject(), project);
  assert.equal(Object.isFrozen(project.entries[0].placement), true);
});

test('project and two IPUZ fixtures are canonical bytes, with final LF', async () => {
  const project = createDemoProject();
  assert.equal(await fixture('demo-project.json'), serializeProject(project));
  assert.equal(await fixture('demo-activity.ipuz'), exportIpuz(project, { solution: false }));
  assert.equal(await fixture('demo-solution.ipuz'), exportIpuz(project, { solution: true }));
  const serialized = serializeProject(project);
  assert.equal(serializeProject(parseProject(serialized)), serialized);
  assert.ok(serialized.endsWith('\n'));
  assert.equal(serialized.includes('\r'), false);
  const shuffled = { entries: copy(project.entries), puzzle: Object.fromEntries(Object.entries(project.puzzle).reverse()), version: 1 };
  assert.equal(serializeProject(shuffled), serialized);
});

test('parseProject enforces the UTF-8 512 KiB inclusive boundary', () => {
  const serialized = serializeProject(createDemoProject());
  const bytes = new TextEncoder().encode(serialized).length;
  const exact = serialized + ' '.repeat(MAX_PROJECT_BYTES - bytes);
  assert.equal(new TextEncoder().encode(exact).length, MAX_PROJECT_BYTES);
  assert.equal(serializeProject(parseProject(exact)), serialized);
  throwsCode(() => parseProject(exact + ' '), 'E_LIMIT');
  const moreBytesThanUnits = `"${'é'.repeat(MAX_PROJECT_BYTES / 2)}"`;
  assert.ok(moreBytesThanUnits.length < MAX_PROJECT_BYTES);
  throwsCode(() => parseProject(moreBytesThanUnits), 'E_LIMIT');
  throwsCode(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1)), 'E_LIMIT');
});

test('parseProject rejects syntax, wrong types, forged shape and incoherent answers without leaking input', () => {
  throwsCode(() => parseProject('{"title":"private-payload"'), 'E_JSON');
  for (const value of [null, 1, {}, [], new String('{}')]) throwsCode(() => parseProject(value), 'E_SCHEMA');
  const bad = copy(createDemoProject());
  bad.entries[0].answer = 'OTHER';
  throwsCode(() => parseProject(JSON.stringify(bad)), 'E_ANSWER');
  bad.entries[0].answer = 'CASA';
  bad.saved = { answers: ['PRIVATE'] };
  throwsCode(() => parseProject(JSON.stringify(bad)), 'E_SCHEMA');
  try { parseProject('private-payload'); } catch (error) { assert.equal(error.message.includes('private-payload'), false); }
  // JSON.parse semantics are intentional; no lexical duplicate-key detector is promised.
  const normal = serializeProject(createDemoProject());
  const duplicate = normal.replace('"version": 1', '"version": 9, "version": 1');
  assert.equal(serializeProject(parseProject(duplicate)), normal);
});

test('both exporters reject unfinished projects; author backups remain available', () => {
  const drafts = [createProject('empty')];
  const noClue = copy(createDemoProject());
  noClue.entries[0].clue = '';
  drafts.push(noClue);
  const noPlacement = copy(createDemoProject());
  noPlacement.entries[0].placement = null;
  drafts.push(noPlacement);
  for (const project of drafts) {
    const before = JSON.stringify(project);
    for (const exporter of [exportIpuz, exportSvg]) throwsCode(() => exporter(project), 'E_NOT_READY');
    assert.equal(JSON.stringify(project), before);
    assert.equal(parseProject(serializeProject(project)).version, 1);
  }
});

test('closed export options reject getters, symbols, coercion and unrecognized keys', () => {
  const project = createDemoProject();
  let getterCalls = 0;
  const getter = Object.defineProperty({}, 'solution', { get() { getterCalls++; return true; } });
  const unknownGetter = Object.defineProperty({}, 'leak', { get() { getterCalls++; return true; } });
  for (const exporter of [exportIpuz, exportSvg]) {
    for (const options of [null, [], new Date(), false, 'true', { solution: 1 }, { solution: 'true' }, { solution: undefined }, { source: false }, { [Symbol('hidden')]: true }, getter, unknownGetter]) {
      throwsCode(() => exporter(project, options), 'E_SCHEMA');
    }
    assert.equal(exporter(project, {}), exporter(project, { solution: false }));
    assert.equal(exporter(project, Object.create(null)), exporter(project, {}));
  }
  assert.equal(getterCalls, 0);
});

test('IPUZ uses a strict profile and has no structural solution in the activity', () => {
  const project = createDemoProject();
  const before = serializeProject(project);
  const activity = JSON.parse(exportIpuz(project));
  const solution = JSON.parse(exportIpuz(project, { solution: true }));
  assert.deepEqual(Object.keys(activity), ipuzKeys);
  assert.deepEqual(Object.keys(solution), [...ipuzKeys, 'solution']);
  assert.equal(activity.version, 'http://ipuz.org/v2');
  assert.deepEqual(activity.kind, ['http://ipuz.org/crossword#1']);
  assert.deepEqual(activity.dimensions, { width: 15, height: 13 });
  assert.equal(activity.uniqueid, project.puzzle.id);
  assert.equal(activity.block, '#');
  assert.equal(activity.empty, 0);
  assert.equal(activity.charset, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.deepEqual(Object.keys(activity.clues), ['Across', 'Down']);
  assert.deepEqual(activity.clues.Across.map(clue => clue[0]), [1, 2, 4, 6, 8]);
  assert.deepEqual(activity.clues.Down.map(clue => clue[0]), [1, 3, 5, 7]);
  assert.equal(activity.puzzle[2][2], 1);
  assert.equal(activity.puzzle[2][3], 0);
  assert.equal(activity.puzzle[0][0], '#');
  assert.equal(solution.solution[2][2], 'C');
  assert.equal(solution.solution[0][0], '#');
  assert.deepEqual(solution.puzzle, activity.puzzle);
  for (const row of activity.puzzle) for (const cell of row) assert.ok(cell === '#' || Number.isInteger(cell));
  for (const row of solution.solution) for (const cell of row) assert.ok(cell === '#' || /^[A-Z]$/.test(cell));
  assert.equal(serializeProject(project), before);
});

test('IPUZ HTML fields preserve text through escaping, including length as literal text', () => {
  const project = copy(createDemoProject());
  project.puzzle.title = '<b>ação & "café"</b>';
  project.puzzle.author = "D'Água <autor> & Cia";
  project.puzzle.subtitle = '<img src=x onerror=alert(1)> & texto';
  project.entries[0].clue = '<script>resolver & pensar</script> "ação"';
  const ipuz = JSON.parse(exportIpuz(project));
  for (const [actual, expected] of [[ipuz.title, project.puzzle.title], [ipuz.author, project.puzzle.author], [ipuz.intro, project.puzzle.subtitle], [ipuz.clues.Across[0][1], project.entries[0].clue + ' (4)']]) {
    assert.equal(decodeXml(actual), expected);
    assert.equal(actual.includes('<'), false);
    assert.equal(actual.includes('>'), false);
  }
  assert.ok(ipuz.clues.Across[0][1].endsWith(' (4)'));
});

test('SVG emits all cells, canonical numbers, complete clues, and letters only in the answer sheet', () => {
  const project = createDemoProject();
  const activity = exportSvg(project);
  const solution = exportSvg(project, { solution: true });
  assert.equal((activity.match(/data-row=/g) ?? []).length, 15 * 13);
  assert.equal((activity.match(/data-role="number"/g) ?? []).length, 8);
  assert.equal((activity.match(/data-role="letter"/g) ?? []).length, 0);
  assert.equal((solution.match(/data-role="letter"/g) ?? []).length, 28);
  assert.match(activity, />Atividade<\/text>/);
  assert.match(solution, />Gabarito<\/text>/);
  assert.match(activity, /data-cell-size="32"/);
  assert.match(activity, /<text[^>]*>Horizontal<\/text>/);
  assert.match(activity, /<text[^>]*>Vertical<\/text>/);
  for (const entry of analyze(project).entries) {
    const group = activity.match(new RegExp(`<g data-direction="${entry.direction}" data-number="${entry.number}">([\\s\\S]*?)<\\/g>`));
    assert.ok(group);
    assert.equal(visibleText(group[1]), `${entry.number}. ${project.entries.find(item => item.id === entry.id).clue} (${entry.length})`);
  }
  assert.ok(activity.endsWith('</svg>\n'));
});

test('SVG treats markup as visible text and contains no active or external content', () => {
  const project = copy(createDemoProject());
  project.puzzle.title = '<script>alert("ação & café")</script>';
  project.puzzle.author = "A&B <autor> '";
  project.puzzle.subtitle = 'Imagem <img src="https://invalid.example/x">';
  project.entries[0].clue = '<foreignObject onclick="x">ação & café</foreignObject>';
  const svg = exportSvg(project);
  assert.equal(/<(?:script|foreignObject|image|a|style)\b/i.test(svg), false);
  const actualTags = svg.match(/<[^>]+>/g).join('');
  assert.equal(/\s(?:href|src|on\w+)\s*=/.test(actualTags), false);
  assert.equal(/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/.test(svg), false);
  assert.equal(/<(?:metadata|defs)\b/.test(svg), false);
  assert.equal(svg.includes('data-role="letter"'), false);
  for (const text of [project.puzzle.title, project.puzzle.subtitle, `Autoria: ${project.puzzle.author}`]) assert.ok(visibleText(svg).includes(text));
  assert.ok(visibleText(svg).includes(project.entries[0].clue));
});

test('maximum ready grid keeps every Unicode clue character and every fitted line inside its column', () => {
  // Twenty maximal horizontal and twenty maximal vertical runs are forty
  // registered words, all connected: no synthetic export-only bypass of ready.
  // Long Unicode words separated by spaces stress the word-preserving case:
  // some lines can be short, unlike a simple hard-wrapped unbroken string.
  const clue = Array.from(('😀'.repeat(13) + ' ').repeat(20)).slice(0, 200).join('');
  const project = {
    version: 1,
    puzzle: { id: 'max-sheet', title: 'T'.repeat(100), subtitle: 's'.repeat(160), author: 'a'.repeat(80), width: 21, height: 21 },
    entries: Array.from({ length: 40 }, (_, index) => ({
      id: `word-${index}`, source: 'A'.repeat(20), answer: 'A'.repeat(20), clue,
      placement: { row: index < 20 ? index : 0, col: index < 20 ? 0 : index - 20, direction: index < 20 ? 'across' : 'down' },
    })),
  };
  assert.equal(analyze(validateProject(project)).ready, true);
  const svg = exportSvg(project);
  const height = Number(svg.match(/<svg[^>]+height="(\d+)"/)[1]);
  assert.ok(height > 0 && height <= 28000);
  assert.match(svg, /width="1000"/);
  const groups = [...svg.matchAll(/<g data-direction="(across|down)" data-number="(\d+)">([\s\S]*?)<\/g>/g)];
  assert.equal(groups.length, 40);
  for (const [, direction, number, markup] of groups) {
    assert.equal(visibleText(markup), `${number}. ${clue} (20)`);
    const spans = [...markup.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)" textLength="([\d.]+)" lengthAdjust="spacingAndGlyphs">([\s\S]*?)<\/tspan>/g)];
    assert.ok(spans.length >= 1 && spans.length <= 30);
    for (const [, x, y, length, content] of spans) {
      const units = wrappingUnits(decodeXml(content));
      assert.ok(units <= 26, 'real line breaks fit independently of SVG textLength support');
      assert.ok(units * 16 <= 432, 'conservative nominal em budget leaves room inside the clue column');
      assert.equal(Number(x), direction === 'across' ? 56 : 512);
      assert.ok(Number(length) > 0 && Number(length) <= 432);
      assert.ok(Number(x) + Number(length) <= 944);
      assert.ok(Number(y) + 5 < height);
    }
  }
});

test('SVG really breaks wide ASCII and Unicode lines when a renderer ignores textLength', () => {
  // Regression: librsvg/FFmpeg ignored fitting hints and our previous 64-point
  // clue lines ran into the adjacent column. Inspect actual decoded line text,
  // including prefixes, without using textLength to establish the bound.
  const project = copy(createDemoProject());
  project.puzzle.title = 'W'.repeat(100);
  project.puzzle.subtitle = '漢'.repeat(160);
  project.puzzle.author = '😀'.repeat(80);
  project.entries[0].clue = 'W'.repeat(200);
  project.entries[2].clue = '漢'.repeat(200);
  project.entries[4].clue = 'WWWW WWWW WWWW WWWW WWWW WWWW WWWW WWWW';
  const svg = exportSvg(project).replace(/ textLength="[^"]*" lengthAdjust="[^"]*"/g, '');
  const blocks = [...svg.matchAll(/<text font-size="(\d+)" xml:space="preserve"([^>]*)>([\s\S]*?)<\/text>/g)];
  assert.equal(blocks.length, project.entries.length + 3);
  for (const [, rawSize, attributes, markup] of blocks) {
    const size = Number(rawSize);
    const isClue = attributes.includes('data-role="clue"');
    const budget = isClue ? 26 : size === 30 ? 28 : size === 14 ? 60 : 54;
    const width = isClue ? 432 : 888;
    const spans = [...markup.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([\s\S]*?)<\/tspan>/g)];
    assert.ok(spans.length > 0);
    for (const [, , , content] of spans) {
      const units = wrappingUnits(decodeXml(content));
      assert.ok(units <= budget);
      assert.ok(units * size <= width);
    }
  }
  assert.ok(visibleText(svg).includes(project.puzzle.title));
  assert.ok(visibleText(svg).includes(project.puzzle.subtitle));
  assert.ok(visibleText(svg).includes(`Autoria: ${project.puzzle.author}`));
  for (const entry of project.entries) assert.ok(visibleText(svg).includes(entry.clue));
});

test('SVG keeps every ordinary word whole and only splits tokens longer than their line budget', () => {
  // Regression from actual downloaded-sheet renders: a minimum line fill used
  // to split ordinary words as história/s and lembran/ças despite a prior space.
  const project = createDemoProject();
  const svg = exportSvg(project);
  for (const entry of analyze(project).entries) {
    const clue = project.entries.find(item => item.id === entry.id).clue;
    const expected = `${entry.number}. ${clue} (${entry.length})`;
    const group = svg.match(new RegExp(`<g data-direction="${entry.direction}" data-number="${entry.number}">([\\s\\S]*?)<\\/g>`))[1];
    const lines = [...group.matchAll(/<tspan[^>]*>([\s\S]*?)<\/tspan>/g)].map(match => decodeXml(match[1]));
    assert.equal(lines.join(''), expected);
    for (const token of expected.split(' ').filter(Boolean)) {
      if (wrappingUnits(token) <= 26) assert.ok(lines.some(line => line.includes(token)), `ordinary token was split: ${token}`);
    }
    for (const line of lines.slice(0, -1)) {
      // If a nonfinal line ends inside a token, the token has no earlier space
      // in that line: only an over-budget token may need such a hard break.
      if (!line.endsWith(' ')) assert.equal(line.includes(' '), false);
    }
  }
  const withSpaces = copy(project);
  withSpaces.entries[0].clue = 'Uma  história com lembranças e espaços  preservados.';
  const spaced = exportSvg(withSpaces);
  const group = spaced.match(/<g data-direction="across" data-number="1">([\s\S]*?)<\/g>/)[1];
  const lines = [...group.matchAll(/<tspan[^>]*>([\s\S]*?)<\/tspan>/g)].map(match => decodeXml(match[1]));
  assert.equal(lines.join(''), '1. Uma  história com lembranças e espaços  preservados. (4)');
  assert.ok(lines.some(line => line.includes('história')));
  assert.ok(lines.some(line => line.includes('lembranças')));
});
