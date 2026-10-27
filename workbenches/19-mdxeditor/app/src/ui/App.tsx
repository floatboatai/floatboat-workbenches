import { useState, type ChangeEvent } from 'react';
import { BookOpen, Plus, Download, FileInput, Ellipsis, MessageSquare, Check, Circle, RotateCcw, ArrowUpRight, Trash2 } from 'lucide-react';
import { useProjects, ProjectPicker, Notice, RenderBoundary, download } from './workspace';
import { exampleDocument, MAX_PROJECT_FILE_BYTES, validateDocument, restoreDocument, markdownProblem, decodeImport, projectExport } from '../contracts/review';
import { ReviewEditor } from './ReviewEditor';

const options = { storageKey: 'mdxeditor-review-v1', restoreDraftData: restoreDocument };
const stringDraft = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const safeFilename = (title: string) => (title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 80) || '未命名文档');
export function App() {
  const p = useProjects(exampleDocument, validateDocument, '快速开始 · 文档协作指南', options);
  const [showImport, setShowImport] = useState(false);
  const noteInput = stringDraft(p.draft.noteInput, 3000), importText = stringDraft(p.draft.importText, 100000);
  const importKind = p.draft.importKind === 'project' ? 'project' : 'markdown';
  const openNotes = p.data.notes.filter(note => !note.done).length;
  const problem = markdownProblem(p.data.markdown);
  const changed = p.data.markdown.trim() !== p.data.baseline.trim();
  const draftField = (key: string, value: string) => p.setDraft(extra => ({ ...extra, [key]: value }));
  async function importContent(text: string, kind: 'markdown' | 'project', name?: string) {
    try { const result = decodeImport(text, kind, name); if (await p.replace(result.data, result.title, result.extra)) { setShowImport(false); p.setNotice('已作为新文档导入，原文档保留。'); } } catch (error) { p.report(error); }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > MAX_PROJECT_FILE_BYTES) { p.setError('文件不能超过 1.1 MB，请拆分后导入。'); return; }
    try { await importContent(await file.text(), file.name.toLowerCase().endsWith('.json') ? 'project' : 'markdown', file.name.replace(/\.(md|markdown|mdx)$/i, '')); } catch (error) { p.report(error); }
  }
  function exportProject() {
    try { download(new Blob([JSON.stringify(projectExport(p.title, p.data, p.draft), null, 2)], { type: 'application/json' }), safeFilename(p.title) + '.review.json'); p.setNotice('已导出文档、比较基线、审阅意见和未完成输入。'); } catch (error) { p.report(error); }
  }
  function setBaseline() {
    if (problem) { p.setError('请先修正源文，再更新比较基线。'); return; }
    if (!confirm('将当前稿设为新的比较基线？旧基线将被替换，建议先导出审阅项目。')) return;
    p.setData(data => ({ ...data, baseline: data.markdown, baselineLabel: '本轮审阅后的版本' })); p.setNotice('已更新比较基线。之后的修改会显示为新差异。');
  }
  return <div className="review-app">
    <a className="skip-link" href="#document">跳到文档</a>
    <header className="app-bar"><div className="brand"><BookOpen size={22} aria-hidden="true" /><div><strong>文档审阅台</strong><span>MDXEditor</span></div></div><div className="file-actions"><ProjectPicker items={p.items} id={p.current?.id} disabled={p.busy || p.loading} onOpen={id => { void p.open(id); }} /><button type="button" disabled={p.busy || p.loading} onClick={async () => { await p.replace({ version: 1, markdown: '# 新文档\n\n', baseline: '# 新文档\n\n', baselineLabel: '创建时的版本', notes: [] }, '未命名文档'); }}><Plus size={16} aria-hidden="true" />新建</button><button type="button" onClick={() => setShowImport(value => !value)} aria-expanded={showImport}><FileInput size={16} aria-hidden="true" />导入</button><button className="primary" type="button" onClick={() => download(new Blob([p.data.markdown], { type: 'text/markdown;charset=utf-8' }), safeFilename(p.title) + '.md')}><Download size={16} aria-hidden="true" />导出 Markdown</button><details className="file-menu"><summary aria-label="更多文件操作"><Ellipsis size={19} aria-hidden="true" /></summary><div><button type="button" onClick={exportProject}>导出审阅项目 JSON</button><button type="button" onClick={p.exportDraft}>导出恢复草稿</button><button type="button" onClick={() => { void p.save(); }}>立即保存 / 重试</button><button type="button" onClick={() => { void p.refresh().catch(p.report); }}>刷新文档列表</button><button type="button" disabled={!p.current || p.busy} onClick={() => { void p.remove(); }}><Trash2 size={14} aria-hidden="true" />删除当前文档</button></div></details></div></header>
    <div className="save-row"><span>工作区 / 产品文档</span><span role="status" data-save-phase={p.autoState.phase}><i aria-hidden="true" />{p.loading ? '正在恢复文档…' : p.autoState.message}</span></div>
    <Notice error={p.error} notice={p.notice} />
    {(p.autoState.phase === 'offline' || p.autoState.phase === 'conflict') && <div className="recovery-bar"><span>{p.autoState.phase === 'conflict' ? '当前输入已保留，请先导出，再选择要继续的版本。' : '可以继续编辑，也可以导出一份恢复副本。'}</span><button onClick={p.exportDraft}>导出恢复草稿</button><button onClick={() => { void p.save(); }}>重试同步</button>{p.current && <button onClick={() => { void p.open(p.current!.id); }}>打开服务器版本</button>}</div>}
    {showImport && <section className="import-panel" aria-label="导入文档"><div><h2>导入为新文档</h2><p>选择 Markdown 或审阅项目文件，也可以先粘贴未完成的内容。</p><label className="file-upload">选择文件<input aria-label="选择导入文件" type="file" accept=".md,.markdown,.mdx,.json,text/markdown,application/json" onChange={event => { void importFile(event); }} /></label></div><div><div className="import-controls"><label>内容格式<select value={importKind} onChange={event => draftField('importKind', event.target.value)}><option value="markdown">Markdown</option><option value="project">审阅项目 JSON</option></select></label><button onClick={() => { void importContent(importText, importKind); }} disabled={p.busy}>导入粘贴内容<ArrowUpRight size={15} aria-hidden="true" /></button><button onClick={() => setShowImport(false)}>收起</button></div><label className="sr-only" htmlFor="import-source">导入内容</label><textarea id="import-source" maxLength={100000} value={importText} onChange={event => draftField('importText', event.target.value)} placeholder="粘贴 Markdown 或项目 JSON…" spellCheck={false} /></div></section>}
    <main id="document" tabIndex={-1}><section className="document-heading"><div className="eyebrow"><span>DOCUMENT REVIEW</span><span className="review-badge">{openNotes ? '审阅中' : '意见已处理'}</span></div><label className="sr-only" htmlFor="document-title">文档名称</label><input id="document-title" className="document-title" value={p.title} onChange={event => p.setTitle(event.target.value)} maxLength={120} autoComplete="off" /><p>写作、核对修改，把每一轮讨论留在文档旁。</p></section>
    <div className="review-layout"><div className="document-column"><div className="baseline-bar"><div><GitBaseline /><span>比较基线</span><label className="sr-only" htmlFor="baseline-name">比较基线名称</label><input id="baseline-name" value={p.data.baselineLabel} maxLength={100} onChange={event => p.setData(data => ({ ...data, baselineLabel: event.target.value }))} /><span className="change-indicator">{changed ? '有本轮修改' : '与当前稿一致'}</span></div><button onClick={setBaseline} disabled={!changed || !!problem} title="将当前稿设为比较基线"><RotateCcw size={13} aria-hidden="true" />更新基线</button></div>
    {p.loading ? <p className="loading" role="status">正在恢复文档与审阅记录…</p> : <RenderBoundary key={p.documentKey}><ReviewEditor markdown={p.data.markdown} baseline={p.data.baseline} onChange={markdown => p.setData(data => ({ ...data, markdown }))} /></RenderBoundary>}
    <footer className="document-footer"><span>{new Intl.NumberFormat('zh-CN').format(p.data.markdown.length)} 字符 · Markdown</span><span>当前稿可直接导出 · 审阅记录随项目保存</span></footer></div>
    <aside className="review-margin" aria-label="审阅意见"><div className="margin-title"><MessageSquare size={18} aria-hidden="true" /><h2>审阅意见</h2><span>{openNotes} 待处理</span></div><p className="margin-intro">记下需要确认的问题，完成后勾选。</p><div className="note-list">{p.data.notes.length === 0 && <p className="empty-notes">还没有审阅意见。写下第一个需要确认的问题。</p>}{p.data.notes.map((note, index) => <article className={'review-note' + (note.done ? ' done' : '')} key={note.id}><div className="note-heading"><span>意见 {String(index + 1).padStart(2, '0')}</span><button type="button" className="note-toggle" aria-label={note.done ? `重新打开意见 ${index + 1}` : `标记意见 ${index + 1} 已处理`} aria-pressed={note.done} onClick={() => p.setData(data => ({ ...data, notes: data.notes.map(item => item.id === note.id ? { ...item, done: !item.done } : item) }))}>{note.done ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}{note.done ? '已处理' : '待处理'}</button></div><textarea aria-label={`意见 ${index + 1} 内容`} maxLength={3000} value={note.text} onChange={event => p.setData(data => ({ ...data, notes: data.notes.map(item => item.id === note.id ? { ...item, text: event.target.value } : item) }))} /><button className="delete-note" onClick={() => { if (confirm('删除这条审阅意见？')) p.setData(data => ({ ...data, notes: data.notes.filter(item => item.id !== note.id) })); }}>删除意见</button></article>)}</div><form className="add-note" onSubmit={event => { event.preventDefault(); if (!noteInput.trim() || p.data.notes.length >= 80) return; p.setData(data => ({ ...data, notes: [...data.notes, { id: crypto.randomUUID(), text: noteInput, done: false }] })); draftField('noteInput', ''); }}><label htmlFor="note-input">添加审阅意见</label><textarea id="note-input" value={noteInput} maxLength={3000} onChange={event => draftField('noteInput', event.target.value)} placeholder="例如：这一段还需要补充操作示例…" /><button type="submit" disabled={!noteInput.trim() || p.data.notes.length >= 80}><Plus size={15} aria-hidden="true" />加入审阅</button></form><div className="margin-footnote"><span className="eyebrow">这一轮的工作方式</span><p>正文中完善表达<br />差异中核对修改<br />意见中保留讨论</p></div></aside></div></main>
  </div>;
}
function GitBaseline() { return <span className="baseline-mark" aria-hidden="true">↳</span>; }
