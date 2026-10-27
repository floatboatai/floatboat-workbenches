import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { emptyNotebook, outline, restoreNotebook, safeLink, sampleNotebook, validateNotebook } from '../src/contracts/notebook.ts';
import { createStore } from '../src/server/store.ts';
import { createAutosaveStore } from '../src/server/autosave.ts';
import { importJSON } from '../src/ui/imports.ts';
function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0001_initial.sql', '0002_projects.sql', '0003_autosave.sql']) db.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
  return db;
}
test('知识页保留嵌套、勾选、文字样式、表头和章节', () => {
  const doc = validateNotebook(JSON.parse(JSON.stringify(sampleNotebook)));
  assert.equal(doc.blocks[4].children?.length, 1);
  assert.deepEqual(doc.blocks[7].props, { checked: true });
  assert.equal(outline(doc.blocks).length, 4);
  assert.deepEqual(validateNotebook(doc), doc);
});
test('只接受支持的文字块，拒绝媒体、重复标识、过深结构和未知属性', () => {
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'image', props: { url: 'https://example.com/a.jpg' } }] }));
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ id: 'same', type: 'paragraph' }, { id: 'same', type: 'paragraph' }] }));
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'paragraph', props: { onclick: 'alert(1)' } }] }));
  let nested: unknown = { type: 'paragraph' }; for (let i = 0; i < 10; i++) nested = { type: 'paragraph', children: [nested] };
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [nested] }));
});
test('链接协议和样式不能携带执行内容或资源地址', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//example.com', 'file:///etc/passwd', 'https://u:p@example.com', 'https:\n//example.com']) assert.equal(safeLink(url), false, url);
  assert.equal(safeLink('https://example.com/path?q=abc'), true);
  assert.equal(safeLink('mailto:hello@example.com'), true);
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'paragraph', content: [{ type: 'link', href: 'javascript:alert(1)', content: 'click' }] }] }));
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', styles: { backgroundColor: 'url(https://example.com)' } }] }] }));
});
test('矩形表格保留列宽和单元格格式，拒绝合并与超限表格', () => {
  const blocks = [{ type: 'table', content: { type: 'tableContent', columnWidths: [120, null], rows: [{ cells: [{ type: 'tableCell', props: { textColor: 'green', colspan: 1 }, content: 'a' }, 'b'] }] } }];
  const doc = validateNotebook({ ...emptyNotebook, blocks }); assert.equal(doc.blocks[0].type, 'table');
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'table', content: { type: 'tableContent', rows: [{ cells: ['a'] }, { cells: ['a', 'b'] }] } }] }));
  assert.throws(() => validateNotebook({ ...emptyNotebook, blocks: [{ type: 'table', content: { type: 'tableContent', rows: [{ cells: Array(13).fill('a') }] } }] }));
});
test('JSON 和恢复文件可导入，原始无效源文保持为独立草稿', () => {
  const exported = { title: '记录', data: sampleNotebook };
  assert.deepEqual(importJSON(JSON.stringify(exported)).data, sampleNotebook);
  const restored = importJSON(JSON.stringify({ snapshot: { ...exported, extra: { importSource: '{ unfinished', importFormat: 'json', malicious: 1 } } }));
  assert.deepEqual(restored.extra, { importSource: '{ unfinished', importFormat: 'json' });
  assert.throws(() => importJSON('{ unfinished'));
  assert.throws(() => importJSON('x'.repeat(180001)));
});
test('持久页使用乐观版本，陈旧更新和删除不能覆盖新内容', () => {
  const db = database(); try {
    const store = createStore(db, validateNotebook), first = store.create('团队笔记', sampleNotebook);
    const updated = store.update(first.id, '新的决定', emptyNotebook, first.revision);
    assert.equal(updated.revision, 2);
    assert.throws(() => store.update(first.id, '陈旧记录', sampleNotebook, 1));
    assert.throws(() => store.remove(first.id, 1));
    assert.equal(store.get(first.id).title, '新的决定');
  } finally { db.close(); }
});
test('自动保存重试幂等，未完成导入源文随工作副本保存', async () => {
  const db = database(); try {
    const store = createAutosaveStore(db, validateNotebook), id = randomUUID();
    const request = { documentId: id, mutationId: randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: '记录', data: sampleNotebook, extra: { importSource: '{ unfinished' } } };
    const first = await store.commit(request), retry = await store.commit(request);
    assert.deepEqual(retry, first); assert.equal(first.phase, 'saved');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get()?.n, 1);
    assert.equal(store.get(id)?.snapshot.extra.importSource, '{ unfinished');
    const draft = await store.commit({ ...request, mutationId: randomUUID(), draftRevision: 1, projectId: id, projectRevision: 1, snapshot: { ...request.snapshot, title: '' } });
    assert.equal(draft.phase, 'draft'); assert.equal(store.get(id)?.snapshot.title, '');
  } finally { db.close(); }
});
test('自动保存冲突保留输入并保护服务器版本', async () => {
  const db = database(); try {
    const store = createAutosaveStore(db, validateNotebook), projects = createStore(db, validateNotebook), id = randomUUID();
    const request = { documentId: id, mutationId: randomUUID(), draftRevision: 0, projectId: null, projectRevision: null, snapshot: { title: '原稿', data: sampleNotebook, extra: {} } };
    await store.commit(request); projects.update(id, '其他窗口', emptyNotebook, 1);
    const result = await store.commit({ ...request, mutationId: randomUUID(), draftRevision: 1, projectId: id, projectRevision: 1, snapshot: { ...request.snapshot, title: '本机更改' } });
    assert.equal(result.phase, 'conflict'); assert.equal(projects.get(id).title, '其他窗口'); assert.equal(store.get(id)?.snapshot.title, '本机更改');
  } finally { db.close(); }
});

test('安全但超过应用块数的工作副本仍可恢复，媒体始终被拒绝', () => {
  const draft = { ...emptyNotebook, blocks: Array.from({length:1201}, () => ({type:'paragraph', content:'保留输入'})) };
  assert.throws(() => validateNotebook(draft));
  assert.equal(restoreNotebook(draft).blocks.length,1201);
  assert.equal(importJSON(JSON.stringify({snapshot:{title:"恢复页",data:draft,extra:{}}})).data.blocks.length,1201);
  assert.throws(() => restoreNotebook({...emptyNotebook, blocks:[{type:'image'}]}));
});
