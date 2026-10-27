import { useMemo, useRef, useState } from 'react';
import { BookOpen, Plus, Search, PanelLeftClose, PanelLeftOpen, Focus, Download, Upload, FileText, Hash, ChevronRight, Trash2, X, ArrowLeft } from 'lucide-react';
import { useWorkbenchState } from './autosave-client';
import { download } from './requests';
import { Editor } from './Editor';
import { seed, validateNotebook, restoreNotebook, validateMarkdown, validateDraft, readArchive, createArchive, headings, MARKDOWN_LIMIT, ARCHIVE_BYTES, bytes, MODEL_BYTES, type Note, type NotebookDraft } from '../contracts/notebook';

export function App() {
  const p = useWorkbenchState(seed, validateNotebook, '散步与书页', { storageKey: 'milkdown-notebook-v1', restoreDraftData: restoreNotebook });
  const [library, setLibrary] = useState(() => window.innerWidth >= 760), [focus, setFocus] = useState(false), [sourceMode, setSourceMode] = useState(false), [importOpen, setImportOpen] = useState(false), [search, setSearch] = useState(''), [tag, setTag] = useState(''), [sourceEpoch, setSourceEpoch] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingHeading = useRef<number | null>(null);
  function scrollHeading(index: number) { document.querySelectorAll('.ProseMirror h1,.ProseMirror h2,.ProseMirror h3,.ProseMirror h4,.ProseMirror h5,.ProseMirror h6')[index]?.scrollIntoView({ block: 'center', behavior: 'instant' }); }
  let draft: NotebookDraft = {};
  try { draft = validateDraft(p.draft); } catch { /* Recovery export remains available for an older or invalid working copy. */ }
  const selectedId = draft.selectedId ?? p.data.documents[0].id;
  const note = p.data.documents.find(item => item.id === selectedId) ?? p.data.documents[0];
  const source = draft.sources?.[note.id] ?? note.markdown;
  const changedSource = draft.sources?.[note.id] !== undefined;
  const outline = useMemo(() => headings(note.markdown), [note.markdown]);
  const tags = useMemo(() => [...new Set(p.data.documents.flatMap(item => item.tags))], [p.data.documents]);
  const visible = p.data.documents.filter(item => (!tag || item.tags.includes(tag)) && (!search || (item.title + item.markdown + item.tags.join(' ')).toLowerCase().includes(search.toLowerCase())));
  const chars = note.markdown.replace(/\s/g, '').length;
  function changeDraft(next: NotebookDraft) { try { const valid = validateDraft(next); p.setDraft({ ...valid }); } catch (error) { p.report(error); } }
  function updatedNote(patch: Partial<Note>) { return { ...p.data, documents: p.data.documents.map(item => item.id === note.id ? { ...item, ...patch } : item) }; }
  function updateNote(patch: Partial<Note>) { const next = updatedNote(patch); if (bytes(next) > MODEL_BYTES) { p.setError('笔记本容量已满，请导出并新建笔记本。'); return; } p.setData(next); }
  function select(id: string) { changeDraft({ ...draft, selectedId: id, tagInput: '' }); setSourceMode(false); if (window.innerWidth < 760) setLibrary(false); }
  function addNote() {
    if (p.data.documents.length >= 30) { p.setError('每本最多 30 篇笔记，请新建笔记本。'); return; }
    const id = crypto.randomUUID();
    p.setData(current => ({ ...current, documents: [...current.documents, { id, title: '未命名笔记', tags: tag ? [tag] : [], markdown: '', notes: '' }] }));
    changeDraft({ ...draft, selectedId: id, tagInput: '' }); setSearch(''); setSourceMode(false);
  }
  function removeNote() {
    if (p.data.documents.length === 1) { p.setError('笔记本至少保留一篇笔记。'); return; }
    if (!confirm('删除「' + note.title + '」及其旁注？')) return;
    p.setData(current => ({ ...current, documents: current.documents.filter(item => item.id !== note.id) }));
    const sources = { ...draft.sources }; delete sources[note.id]; changeDraft({ ...draft, sources, selectedId: p.data.documents.find(item => item.id !== note.id)?.id });
  }
  function addTag() {
    const text = draft.tagInput?.trim();
    if (!text) return;
    if (text.length > 24 || note.tags.length >= 8) { p.setError('每篇最多 8 个标签，每个最多 24 字。'); return; }
    updateNote({ tags: [...new Set([...note.tags, text])] }); changeDraft({ ...draft, tagInput: '' });
  }
  async function importText(text: string, filename = '') {
    p.setError('');
    try {
      const archive = filename.toLowerCase().endsWith('.json') || (!filename && text.trimStart().startsWith('{')) ? readArchive(text) : null;
      const data = archive?.data ?? { version: 1 as const, documents: [{ id: crypto.randomUUID(), title: filename.replace(/\.(md|markdown|txt)$/i, '').slice(0, 120) || '导入笔记', tags: [], markdown: validateMarkdown(text), notes: '' }] };
      if (await p.replace(data, archive?.title ?? '导入的笔记本', archive ? { ...archive.draft } : {})) { setImportOpen(false); setSourceMode(false); setSearch(''); setTag(''); p.setNotice('已创建新的笔记本。'); }
    } catch (error) { p.report(error); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    try {
      const json = file.name.toLowerCase().endsWith('.json');
      if (file.size > (json ? ARCHIVE_BYTES : 400000)) throw new Error(json ? '笔记本文件超过 1.1 MB。' : 'Markdown 文件过大，请拆分后导入。');
      const text = await file.text();
      if (json) { if (text.length <= MARKDOWN_LIMIT) changeDraft({ ...draft, importText: text }); await importText(text, file.name); return; }
      if (text.length > MARKDOWN_LIMIT) throw new Error('Markdown 最多 100,000 字符。');
      changeDraft({ ...draft, importText: text });
      await importText(text, file.name);
    } catch (error) { p.report(error); }
  }
  function applySource() {
    try {
      validateMarkdown(source);
      const next = { ...p.data, documents: p.data.documents.map(item => item.id === note.id ? { ...item, markdown: source } : item) };
      validateNotebook(next); p.setData(next);
      const sources = { ...draft.sources }; delete sources[note.id]; changeDraft({ ...draft, sources }); setSourceEpoch(value => value + 1); setSourceMode(false); p.setError(''); p.setNotice('源码已应用到正文。');
    } catch (error) { p.report(error); }
  }
  function exportNotebook() { try { download(new Blob([createArchive(p.title, p.data, p.draft)], { type: 'application/json' }), (p.title || '笔记本') + '.milkdown.json'); } catch (error) { p.report(error); } }
  function exportMarkdown() { download(new Blob([note.markdown], { type: 'text/markdown;charset=utf-8' }), (note.title || '笔记') + '.md'); }
  if (p.loading) return <main className="loading" role="status">正在打开笔记本…</main>;
  return <div className={'notebook ' + (focus ? 'focus-mode' : '') + (library ? ' library-open' : '')}>
    <a className="skip-link" href="#writing">跳到正文</a>
    <header className="topbar">
      <div className="brand"><BookOpen size={22} aria-hidden="true" /><strong>Milkdown<span>写作笔记</span></strong></div>
      <div className="notebook-name"><label className="sr-only" htmlFor="notebook-title">笔记本名称</label><input id="notebook-title" value={p.title} maxLength={120} onChange={e => p.setTitle(e.target.value)} /><span className={'save-status ' + p.autoState.phase} role="status">{p.autoState.message}{changedSource ? ' · 源码待应用' : ''}</span></div>
      <div className="file-actions"><button aria-label="导入" onClick={() => setImportOpen(value => !value)} aria-expanded={importOpen}><Upload size={15} aria-hidden="true" /><span>导入</span></button><button aria-label="Markdown" onClick={exportMarkdown}><Download size={15} aria-hidden="true" /><span>Markdown</span></button><details className="more-menu"><summary aria-label="笔记本操作">•••</summary><div><button onClick={exportNotebook}>导出完整笔记本</button><button onClick={p.exportDraft}>导出恢复副本</button><button onClick={() => void p.save()}>立即保存 / 重试</button><button onClick={() => void p.replace({ version: 1, documents: [{ id: crypto.randomUUID(), title: '未命名笔记', tags: [], markdown: '', notes: '' }] }, '新笔记本')}>新建空白笔记本</button><button onClick={() => void p.remove()} disabled={!p.current}>删除当前笔记本</button></div></details></div>
    </header>
    {p.error && <div className="message error" role="alert">{p.error}<button onClick={() => p.setError('')} aria-label="关闭提示"><X size={16} /></button></div>}
    {p.notice && !p.error && <div className="message" role="status">{p.notice}<button onClick={() => p.setNotice('')} aria-label="关闭提示"><X size={16} /></button></div>}
    {p.autoState.phase === 'conflict' && <div className="message error"><span>另一窗口已有新版本。当前输入已保留。</span><button onClick={p.exportDraft}>导出当前副本</button><button onClick={() => p.current && void p.open(p.current.id)}>打开服务器版本</button></div>}
    {importOpen && <section className="import-panel" aria-label="导入笔记"><div><h2>从 Markdown 开始</h2><p>导入后创建新的笔记本。文字、标题、列表、任务、表格与代码块均可继续编辑。</p></div><label>粘贴 Markdown 或笔记本 JSON<textarea aria-label="导入内容" spellCheck={false} value={draft.importText ?? ''} maxLength={MARKDOWN_LIMIT} onChange={e => changeDraft({ ...draft, importText: e.target.value })} placeholder="# 一个新的想法…" /></label><div className="import-actions"><button className="primary" onClick={() => void importText(draft.importText ?? '')}>导入为新笔记本</button><button onClick={() => fileInput.current?.click()}>选择 .md / .json 文件</button><input ref={fileInput} className="sr-only" type="file" accept=".md,.markdown,.txt,.json" aria-label="选择导入文件" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} /><button onClick={() => setImportOpen(false)}>收起</button></div><small>仅收录文字，不载入图片、HTML 或嵌入。未完成的粘贴稿会自动保留；大型笔记本 JSON 请通过文件选择导入。</small></section>}
    <div className="workspace">
      {library && !focus && <aside className="library" aria-label="笔记目录"><div className="library-heading"><span>我的笔记本</span><button onClick={() => setLibrary(false)} aria-label="收起目录"><PanelLeftClose size={16} /></button></div><label className="sr-only" htmlFor="notebook-picker">打开笔记本</label><select id="notebook-picker" disabled={p.busy} value={p.current?.id ?? ''} onChange={async e => { if (e.target.value && await p.open(e.target.value)) { setSourceMode(false); setSearch(''); setTag(''); } }}><option value="">当前笔记本</option>{p.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><label className="search"><Search size={15} aria-hidden="true" /><input aria-label="搜索笔记" placeholder="寻找一篇笔记…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="tag-filter"><button className={!tag ? 'selected' : ''} onClick={() => setTag('')}>全部笔记 <span>{p.data.documents.length}</span></button>{tags.map(value => <button key={value} className={tag === value ? 'selected' : ''} onClick={() => setTag(value)}><Hash size={13} aria-hidden="true" />{value}</button>)}</div><div className="list-heading"><span>{tag || '所有文字'}</span><button onClick={addNote} aria-label="新建笔记"><Plus size={17} /></button></div><nav className="note-list" aria-label="选择笔记">{visible.map((item, index) => <button key={item.id} className={note.id === item.id ? 'active' : ''} aria-current={note.id === item.id ? 'page' : undefined} onClick={() => select(item.id)}><span className="note-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.title || '未命名笔记'}</strong><small>{item.tags.join(' · ') || '尚无标签'}</small></span></button>)}{visible.length === 0 && <p className="empty">没有找到笔记。试试其他词语或标签。</p>}</nav><button className="new-note" onClick={addNote}><Plus size={16} aria-hidden="true" />写一篇新笔记</button><p className="library-foot">让每一个想法<br />都有落笔的地方。</p></aside>}
      <main id="writing" className="writing"><div className="writing-bar"><div>{(!library || focus) && <button onClick={() => { setFocus(false); setLibrary(true); }} aria-label="打开目录"><PanelLeftOpen size={17} /></button>}<span className="breadcrumb">{p.title || '笔记本'}<ChevronRight size={12} aria-hidden="true" />{note.tags[0] || '文字'}</span></div><div className="editor-actions"><button aria-pressed={sourceMode} onClick={() => setSourceMode(value => !value)}><FileText size={14} aria-hidden="true" />{sourceMode ? '返回正文' : '源码'}</button><button aria-pressed={focus} onClick={() => setFocus(value => !value)}><Focus size={15} aria-hidden="true" />{focus ? '退出专注' : '专注'}</button></div></div>
      <article className="paper"><div className="eyebrow">随记 / {String(p.data.documents.indexOf(note) + 1).padStart(2, '0')}</div><label className="sr-only" htmlFor="note-title">笔记标题</label><input id="note-title" className="note-title" value={note.title} maxLength={120} onChange={e => updateNote({ title: e.target.value })} placeholder="给这篇文字起个名字…" /><div className="note-meta"><span>{chars.toLocaleString('zh-CN')} 字</span><span>约 {Math.max(1, Math.ceil(chars / 400))} 分钟阅读</span><span className="tiny-dot" />{note.tags.map(value => <button key={value} onClick={() => setTag(value)}>#{value}</button>)}</div>
      {sourceMode ? <section className="source-panel"><div className="source-toolbar"><span>{changedSource ? '修改已保留，尚未应用到正文' : '当前正文的 Markdown'}</span><button className="primary" onClick={applySource}>应用源码</button></div><label className="sr-only" htmlFor="markdown-source">Markdown 源码</label><textarea id="markdown-source" value={source} maxLength={MARKDOWN_LIMIT} spellCheck={false} onChange={e => changeDraft({ ...draft, sources: { ...draft.sources, [note.id]: e.target.value } })} /><p>应用后更新正文；返回正文不会丢失未应用的输入。</p></section> : <Editor key={p.documentKey + ':' + note.id + ':' + sourceEpoch} initial={note.markdown} onChange={markdown => updateNote({ markdown })} onError={p.setError} canChange={markdown => bytes(updatedNote({ markdown })) <= MODEL_BYTES} onReady={() => { if (pendingHeading.current !== null) { scrollHeading(pendingHeading.current); pendingHeading.current = null; } }} />}
      <div className="end-mark" aria-hidden="true">—</div><footer className="page-footer"><span>在这里，慢慢写。</span><button onClick={removeNote} aria-label="删除这篇笔记"><Trash2 size={14} /></button></footer></article></main>
      {!focus && <aside className="margin" aria-label="写作工具"><section><h2>这一页</h2><nav className="outline" aria-label="章节大纲">{outline.length ? outline.map((heading, index) => <button key={index} style={{ paddingLeft: Math.max(0, heading.level - 2) * 10 }} onClick={() => { if (sourceMode) { pendingHeading.current = index; setSourceMode(false); } else scrollHeading(index); }}><span>{String(index + 1).padStart(2, '0')}</span>{heading.text || '空标题'}</button>) : <p className="empty">写下标题后，章节会出现在这里。</p>}</nav></section><section className="notes-section"><h2>页边笔记</h2><label className="sr-only" htmlFor="side-notes">页边笔记</label><textarea id="side-notes" value={note.notes} maxLength={10000} onChange={e => updateNote({ notes: e.target.value })} placeholder="留下一个问题，或下一次写作的线索…" /></section><section className="tag-editor"><h2>整理标签</h2><div>{note.tags.map(value => <button key={value} onClick={() => updateNote({ tags: note.tags.filter(item => item !== value) })} aria-label={'移除标签 ' + value}>{value}<X size={11} aria-hidden="true" /></button>)}</div><form onSubmit={e => { e.preventDefault(); addTag(); }}><input aria-label="新标签" placeholder="添加标签…" value={draft.tagInput ?? ''} maxLength={24} onChange={e => changeDraft({ ...draft, tagInput: e.target.value })} /><button type="submit" aria-label="添加标签"><Plus size={14} /></button></form></section><p className="writing-tip">输入 <kbd>/</kbd> 插入内容<br />选中文字，整理格式。</p></aside>}
    </div>
    {focus && <button className="focus-exit" onClick={() => setFocus(false)}><ArrowLeft size={14} aria-hidden="true" />回到笔记本</button>}
  </div>;
}
