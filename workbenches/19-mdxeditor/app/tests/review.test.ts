import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { exampleDocument, validateDocument, restoreDocument, markdownProblem, decodeImport, projectExport, safeLink } from '../src/contracts/review.ts';
import { createAutosaveStore } from '../src/server/autosave.ts';
import { createStore } from '../src/server/store.ts';

const setup = () => {
  const db = new DatabaseSync(':memory:');
  for (const file of ['0001_initial.sql', '0002_projects.sql', '0003_autosave.sql']) db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  return { db, drafts: createAutosaveStore(db, validateDocument), projects: createStore(db, validateDocument) };
};
const command = () => ({ documentId: randomUUID(), mutationId: randomUUID(), draftRevision: 0, projectId: null as string | null, projectRevision: null as number | null, snapshot: { title: '审阅文档', data: structuredClone(exampleDocument), extra: {} as Record<string, unknown> } });

test('ordinary documentation preserves code, tables, links and comparison baseline', () => {
  assert.deepEqual(validateDocument(exampleDocument), exampleDocument);
  assert.equal(markdownProblem('```html\n<img src="https://example.com/x">\n```'), '');
  assert.equal(markdownProblem('[文档](https://example.com/docs)\n\n{plain text}'), '');
  assert.equal(safeLink('javascript:alert(1)'), false);
});

test('HTML, JSX, media references and disguised unsafe URLs are never renderable models', () => {
  for (const markdown of ['<script>alert(1)</script>', '<Widget value="x" />', '![x](https://example.com/x.png)', '![x][photo]\n\n[photo]: https://example.com/x.png', '[x](java&#x73;cript:alert%281%29)', '[x](data:text/html,bad)', '[x](//example.com)']) {
    assert.ok(markdownProblem(markdown), markdown);
    assert.throws(() => validateDocument({ ...exampleDocument, markdown }));
    assert.equal(restoreDocument({ ...exampleDocument, markdown }).markdown, markdown);
  }
});

test('import is bounded and rejects malformed structure and duplicate note identifiers', () => {
  assert.throws(() => decodeImport('{', 'project'), /JSON/);
  assert.throws(() => decodeImport('x'.repeat(80001), 'markdown'), /文本/);
  assert.throws(() => restoreDocument({ ...exampleDocument, notes: [exampleDocument.notes[0], exampleDocument.notes[0]] }), /重复/);
  assert.throws(() => restoreDocument({ ...exampleDocument, notes: [{ id: 'x', text: 7, done: false }] }));
  assert.throws(() => restoreDocument({ ...exampleDocument, version: 2 }));
  assert.throws(() => decodeImport('😀'.repeat(300000), 'markdown'), /1.1 MB/);
});

test('project export round-trips baseline, resolved notes and unfinished inputs', () => {
  const exported = projectExport('说明', exampleDocument, { noteInput: '尚未完成的意见', importText: '{"unfinished":', importKind: 'project', privateUnknown: 42 });
  const restored = decodeImport(JSON.stringify(exported), 'project');
  assert.deepEqual(restored.data, exampleDocument);
  assert.equal(restored.extra.noteInput, '尚未完成的意见');
  assert.equal(restored.extra.importText, '{"unfinished":');
  assert.equal(restored.extra.importKind, 'project');
  assert.equal('privateUnknown' in restored.extra, false);
  const invalid = decodeImport('![unfinished](https://example.com/x.png)', 'markdown');
  assert.ok(markdownProblem(invalid.data.markdown));
});

test('autosave replay after a lost acknowledgement creates one project and keeps complete drafts', async () => {
  const { db, drafts, projects } = setup();
  try {
    const input = command(); input.snapshot.extra = { noteInput: '未提交', importText: '{', importKind: 'project' };
    const first = await drafts.commit(input), replay = await drafts.commit(input);
    assert.equal(first.phase, 'saved'); assert.deepEqual(replay, first);
    assert.equal(projects.list().length, 1); assert.equal(first.project?.id, input.documentId);
    assert.equal(drafts.get(input.documentId)?.snapshot.extra.importText, '{');
    assert.equal(first.project?.data.baseline, exampleDocument.baseline);
  } finally { db.close(); }
});

test('invalid source is durably saved as draft while last valid model remains unchanged', async () => {
  const { db, drafts, projects } = setup();
  try {
    const input = command(); const first = await drafts.commit(input);
    const invalid = structuredClone(input); invalid.mutationId = randomUUID(); invalid.draftRevision = 1; invalid.projectId = first.project!.id; invalid.projectRevision = 1; invalid.snapshot.data.markdown = '<Unfinished component="x" />';
    const receipt = await drafts.commit(invalid);
    assert.equal(receipt.phase, 'draft'); assert.equal(receipt.project, null);
    assert.equal(drafts.get(input.documentId)?.snapshot.data && restoreDocument(drafts.get(input.documentId)!.snapshot.data).markdown, invalid.snapshot.data.markdown);
    assert.equal(projects.get(first.project!.id).data.markdown, exampleDocument.markdown);
  } finally { db.close(); }
});

test('stale project revision preserves server changes and stores the conflicting review copy', async () => {
  const { db, drafts, projects } = setup();
  try {
    const input = command(), first = await drafts.commit(input);
    projects.update(first.project!.id, '服务器文档', { ...exampleDocument, markdown: '# 服务器修改' }, 1);
    const stale = structuredClone(input); stale.mutationId = randomUUID(); stale.draftRevision = 1; stale.projectId = first.project!.id; stale.projectRevision = 1; stale.snapshot.data.markdown = '# 本机修改';
    assert.equal((await drafts.commit(stale)).phase, 'conflict');
    assert.equal(projects.get(first.project!.id).data.markdown, '# 服务器修改');
    assert.equal(restoreDocument(drafts.get(input.documentId)!.snapshot.data).markdown, '# 本机修改');
  } finally { db.close(); }
});

test('imported project saves as a distinct document without overwriting the source project', async () => {
  const { db, drafts, projects } = setup();
  try {
    const original = command(); await drafts.commit(original);
    const imported = command(); const parsed = decodeImport('# 导入的新稿', 'markdown'); imported.snapshot.data = parsed.data;
    await drafts.commit(imported);
    assert.equal(projects.list().length, 2);
    assert.equal(projects.get(original.documentId).data.markdown, exampleDocument.markdown);
    assert.equal(projects.get(imported.documentId).data.markdown, '# 导入的新稿');
  } finally { db.close(); }
});


test('large valid project exports remain importable without copying JSON into a raw input draft', () => {
  const document = restoreDocument({ version: 1, markdown: '文'.repeat(79000), baseline: '文'.repeat(79000), baselineLabel: '基线', notes: Array.from({ length: 56 }, (_, index) => ({ id: `n-${index}`, text: '文'.repeat(1000), done: false })) });
  const exported = projectExport('大文档', document, { noteInput: '文'.repeat(3000), importText: '文'.repeat(100000), importKind: 'project' });
  const json = JSON.stringify(exported, null, 2);
  assert.ok(new TextEncoder().encode(json).length > 900000);
  const imported = decodeImport(json, 'project');
  assert.deepEqual(imported.data, document);
  assert.equal(imported.extra.importText, exported.drafts.importText);
  assert.equal(String(imported.extra.importText).length, 100000);
});
