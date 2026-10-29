// ABOUTME: 官方示例库：setuplist 解析、文件完整性、只读路由的白名单与布局示意几何。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE_FILE, filterExamples, groupExamples, parseSetupList, previewGeometry } from '../src/contracts/examples.ts';
import { registerExampleRoutes } from '../src/server/examples.ts';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const notices = manifest.resources.find((x: { id: string }) => x.id === 'notices').path;
const root = new URL(`../${notices}/`, import.meta.url);
const setup = readFileSync(new URL('upstream/ts/public/setuplist.txt', root), 'utf8');

test('setuplist parses into 366 categorized examples whose files ship with the GPL source snapshot', () => {
  const entries = parseSetupList(setup);
  assert.equal(entries.length, 366);
  assert.equal(entries.filter(e => e.start).map(e => e.file).join(), 'lrc.txt');
  for (const e of entries) {
    assert.match(e.file, EXAMPLE_FILE);
    assert.ok(existsSync(new URL(`upstream/ts/public/circuits/${e.file}`, root)), e.file);
    assert.ok(e.path.length >= 1 || e.file === 'blank.txt', e.file);
  }
  assert.deepEqual(entries.find(e => e.file === 'indseries.txt')?.path, ['Other Passive Circuits', 'Series/Parallel']);
  const groups = groupExamples(entries);
  assert.equal(groups.reduce((n, g) => n + g.count, 0), 366);
  assert.equal(groups[0].name, 'Basics');
  assert.ok(groups.length >= 20);
  assert.ok(filterExamples(entries, '555').length >= 10);
  assert.ok(filterExamples(entries, 'flip-flop').length >= 3);
});

test('parser ignores comments, malformed and traversal-looking names', () => {
  const list = parseSetupList('# c\n+A\n../x.txt Bad\nok.txt Fine\n>start.txt Start\nnospace\n-\n+B\n+C\ndeep.txt Deep\n-\n-\n');
  assert.deepEqual(list, [{ file: 'ok.txt', title: 'Fine', path: ['A'] }, { file: 'start.txt', title: 'Start', path: ['A'], start: true }, { file: 'deep.txt', title: 'Deep', path: ['B', 'C'] }]);
});

test('preview geometry reads both legacy text and XML, skipping non-element lines and subcircuit models', () => {
  const text = previewGeometry('$ 1 5e-6 10 50 5 50\nw 0 0 64 0 0\nr 64 0 64 96 0 1000\no 1 64 0 4099 5 0.1 0 2 1 3\n38 1 0 1 10 R\n');
  assert.equal(text.segments.length, 2);
  assert.deepEqual([text.minX, text.minY, text.maxX, text.maxY], [0, 0, 64, 96]);
  assert.equal(text.segments[0].wire, true);
  const xml = previewGeometry('<cir f="1"><ccm n="x"><r x="0 0 900 900"/></ccm><w x="-16 0 16 0" f="0"/><Timer x="32 0 48 0" f="0"/><o en="1"/></cir>');
  assert.equal(xml.segments.length, 2);
  assert.equal(xml.maxX, 48);
  for (const file of ['lrc.txt', 'adder4-sc.txt', 'alu74181.txt']) {
    const g = previewGeometry(readFileSync(new URL(`upstream/ts/public/circuits/${file}`, root), 'utf8'));
    assert.ok(g.segments.length > 5, file);
  }
});

type Handler = (ctx: { params: Record<string, string> }) => Promise<unknown>;
test('example routes list the catalog and serve only listed files', async () => {
  const routes = new Map<string, Handler>();
  const app = {
    route: (method: string, path: string, handler: Handler) => routes.set(`${method} ${path}`, handler),
    resources: { path: async (id: string, rel = '') => { assert.equal(id, 'notices'); return fileURLToPath(new URL(rel, root)); } },
  };
  registerExampleRoutes(app as never);
  const list = await routes.get('GET /api/examples')!({ params: {} }) as { examples: unknown[]; license: string };
  assert.equal(list.examples.length, 366);
  assert.equal(list.license, 'GPL-2.0-or-later');
  const one = await routes.get('GET /api/examples/:file')!({ params: { file: 'lrc.txt' } }) as { source: string; title: string };
  assert.equal(one.title, 'LRC Circuit');
  assert.match(one.source, /^\$ 1 /);
  for (const file of ['../setuplist.txt', 'notlisted.txt', 'lrc.txt/../../x', 'LICENSE']) {
    const res = await routes.get('GET /api/examples/:file')!({ params: { file } }) as Response;
    assert.equal(res.status, 404, file);
  }
});
