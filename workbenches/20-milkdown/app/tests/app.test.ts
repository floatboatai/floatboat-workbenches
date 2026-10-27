import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateNotebook, restoreNotebook, validateMarkdown, validateDraft, seed, headings, createArchive, readArchive, bytes, ARCHIVE_BYTES } from '../src/contracts/notebook.ts';
import { createAutosaveStore } from '../src/server/autosave.ts';
import { createStore } from '../src/server/store.ts';

function database() {
  const db = new DatabaseSync(':memory:');
  for (const migration of ['0001_initial', '0002_projects', '0003_autosave']) db.exec(readFileSync(new URL('../migrations/' + migration + '.sql', import.meta.url), 'utf8'));
  return db;
}
function command(data: unknown = seed) { return { documentId: randomUUID(), mutationId: randomUUID(), draftRevision: 0, projectId: null as string | null, projectRevision: null as number | null, snapshot: { title: '旅行笔记', data, extra: {} as Record<string, unknown> } }; }

test('supported Markdown preserves exact source and outline ignores fenced headings', () => {
  const source = '# 标题\n\n- [x] 完成\n\n| A | B |\n| - | - |\n| x | y |\n\n```js\n# not a heading\nconsole.log("safe text")\n```\n\n[阅读](https://example.com)\n';
  assert.equal(validateMarkdown(source), source);
  assert.deepEqual(headings(source), [{ text: '标题', level: 1 }]);
});
test('AST validation rejects inline/reference images, HTML and obfuscated unsafe links but permits code examples', () => {
  for (const text of ['![photo](https://evil.example/x)', '![photo][x]\n\n[x]: https://evil.example/x', '<img src="x">', '<iframe src="x"></iframe>', '[x](javascript:alert%281%29)', '[x](jav&#x61;script:foo)', '[x](data:text/html,hello)', '[x](//evil.example)']) assert.throws(() => validateMarkdown(text), text);
  assert.doesNotThrow(() => validateMarkdown('```html\n<img src="https://example.com/x">\n```'));
});
test('models reject duplicate IDs, oversized documents, deep structures and wrong field types', () => {
  assert.throws(() => validateNotebook({ ...seed, documents: [seed.documents[0], seed.documents[0]] }));
  assert.throws(() => validateMarkdown('x'.repeat(100001)));
  assert.throws(() => validateMarkdown('> '.repeat(42) + 'deep'));
  assert.throws(() => validateNotebook({ ...seed, documents: [{ ...seed.documents[0], notes: 2 }] }));
  assert.throws(() => validateNotebook({ ...seed, documents: [{ ...seed.documents[0], tags: Array(9).fill('a') }] }));
});
test('unfinished titles and invalid raw imports restore without applying unsafe Markdown', () => {
  const value = { ...seed, documents: [{ ...seed.documents[0], title: '' }] };
  assert.throws(() => validateNotebook(value));
  assert.equal(restoreNotebook(value).documents[0].title, '');
  const draft = { sources: { morning: '<script>unfinished' }, importText: '{ invalid', selectedId: 'morning', tagInput: '途中' };
  assert.deepEqual(validateDraft(draft), draft);
  assert.throws(() => validateDraft({ sources: { morning: 'x'.repeat(100001) } }));
});
test('near-limit Unicode archive roundtrips all sources, notes, metadata and unfinished drafts beyond paste limit', () => {
  const documents = Array.from({ length: 7 }, (_, index) => ({ id: 'note-' + index, title: '笔记 ' + index, tags: ['观察'], markdown: '清晨'.repeat(15000) + '\n', notes: '旁注'.repeat(500) }));
  const data = validateNotebook({ version: 1, documents });
  const draft = { sources: { 'note-0': '<unfinished>\n' + '字'.repeat(65000) }, importText: '{ invalid' };
  const text = createArchive('完整旅行本', data, draft);
  assert.ok(text.length > 100000);
  assert.ok(new TextEncoder().encode(text).length < ARCHIVE_BYTES);
  assert.ok(bytes(data) > 640000);
  const archive = readArchive(text);
  assert.deepEqual(archive.data, data); assert.deepEqual(archive.draft, draft); assert.equal(archive.title, '完整旅行本');
});
test('lost-response retry is idempotent, newer revision saves, and conflict keeps both copies', async () => {
  const db = database();
  try {
    const drafts = createAutosaveStore(db, validateNotebook), projects = createStore(db, validateNotebook), first = command();
    const receipt = await drafts.commit(first);
    assert.equal(receipt.phase, 'saved'); assert.deepEqual(await drafts.commit(first), receipt); assert.equal(projects.list().length, 1);
    const next = { ...first, mutationId: randomUUID(), draftRevision: receipt.draftRevision, projectId: receipt.project!.id, projectRevision: receipt.project!.revision, snapshot: { ...first.snapshot, title: '新版' } };
    const saved = await drafts.commit(next); assert.equal(saved.project?.title, '新版');
    const conflict = command(); conflict.projectId = receipt.project!.id; conflict.projectRevision = receipt.project!.revision; conflict.snapshot.title = '另一窗口';
    const result = await drafts.commit(conflict); assert.equal(result.phase, 'conflict'); assert.equal(projects.get(receipt.project!.id).title, '新版'); assert.equal(drafts.get(conflict.documentId)?.snapshot.title, '另一窗口');
  } finally { db.close(); }
});
test('invalid model saves a draft, recovers raw source and never overwrites accepted model', async () => {
  const db = database();
  try {
    const store = createAutosaveStore(db, validateNotebook), first = command(); const saved = await store.commit(first);
    const invalid = { ...first, mutationId: randomUUID(), draftRevision: saved.draftRevision, projectId: saved.project!.id, projectRevision: saved.project!.revision, snapshot: { title: '', data: seed, extra: { sources: { morning: 'unfinished <' }, importText: '{' } } };
    const result = await store.commit(invalid); assert.equal(result.phase, 'draft'); assert.deepEqual(store.get(first.documentId)?.snapshot.extra, invalid.snapshot.extra); assert.equal(createStore(db, validateNotebook).get(saved.project!.id).title, '旅行笔记');
  } finally { db.close(); }
});
test('import models create distinct projects and retain the original', async () => {
  const db = database();
  try { const store = createAutosaveStore(db, validateNotebook); const first = await store.commit(command()); const second = await store.commit(command(readArchive(createArchive('旅行笔记', seed, {})).data)); assert.notEqual(first.project?.id, second.project?.id); assert.equal(createStore(db, validateNotebook).list().length, 2); } finally { db.close(); }
});
