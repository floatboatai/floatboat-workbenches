import { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, FileText, Search, ArrowDownToLine, ArrowUpFromLine, PanelLeft, Trash2, ChevronRight, List, RotateCcw, X, FolderOpen } from 'lucide-react';
import { BlockNoteSchema, defaultBlockSpecs, type PartialBlock } from '@blocknote/core';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { blockText, emptyNotebook, MAX_SOURCE, outline, restoreNotebook, safeLink, sampleNotebook, validateNotebook, type Notebook } from '../contracts/notebook';
import { useWorkbenchState } from './autosave-client';
import { download } from './requests';
import { escapeHTML, importJSON, safeHTML, sourceText } from './imports';
import { RenderBoundary } from './workspace';

const nativeTask = defaultBlockSpecs.checkListItem;
type TaskRenderer = NonNullable<typeof nativeTask.implementation.render>;
const accessibleTask = { ...nativeTask, implementation: { ...nativeTask.implementation,
  render: function (this: ThisParameterType<TaskRenderer>, ...args: Parameters<TaskRenderer>) {
    const rendered = nativeTask.implementation.render!.apply(this, args);
    rendered.dom.querySelector('input[type="checkbox"]')?.setAttribute('aria-label', '完成任务：' + (blockText(args[0]) || '未命名任务'));
    return rendered;
  },
} };
const schema = BlockNoteSchema.create({ blockSpecs: {
  paragraph: defaultBlockSpecs.paragraph, heading: defaultBlockSpecs.heading, quote: defaultBlockSpecs.quote,
  bulletListItem: defaultBlockSpecs.bulletListItem, numberedListItem: defaultBlockSpecs.numberedListItem,
  checkListItem: accessibleTask, toggleListItem: defaultBlockSpecs.toggleListItem, table: defaultBlockSpecs.table,
} });
type PageState = ReturnType<typeof useWorkbenchState<Notebook>>;
const options = { storageKey: 'blocknote-knowledge-binder-v1', restoreDraftData: restoreNotebook };
function useDark() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const change = () => setDark(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return dark;
}
export function App() {
  const p = useWorkbenchState(sampleNotebook, validateNotebook, '团队知识，如何沉淀', options);
  const [query, setQuery] = useState(''), [library, setLibrary] = useState(false);
  const headings = outline(p.data.blocks);
  const items = p.items.filter(item => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  async function create(blank: boolean) { if (await p.replace(blank ? emptyNotebook : sampleNotebook, blank ? '未命名知识页' : '团队知识，如何沉淀')) setLibrary(false); }
  return <div className="binder">
    <a className="skip-link" href="#page-title">跳到正文</a>
    <aside className={`library ${library ? 'expanded' : ''}`} aria-label="知识夹">
      <div className="brand"><span className="brand-mark"><BookOpen size={22} aria-hidden="true" /></span><div><strong>知识夹</strong><small>BLOCKNOTE</small></div><button className="mobile-close icon-button" aria-label="关闭知识夹" onClick={() => setLibrary(false)}><X size={18} /></button></div>
      <button className="new-page" onClick={() => void create(true)} disabled={p.busy || p.loading}><Plus size={17} aria-hidden="true" />新建知识页</button>
      <label className="search"><Search size={15} aria-hidden="true" /><input aria-label="搜索知识页" placeholder="搜索页面…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" /></label>
      <div className="section-label"><span>我的知识页</span><button className="icon-button" onClick={() => void p.refresh().catch(p.report)} aria-label="刷新知识页列表"><RotateCcw size={13} /></button></div>
      <nav className="page-list" aria-label="知识页列表">
        {p.loading ? <p className="quiet">正在打开知识夹…</p> : items.length === 0 ? <p className="quiet">{query ? '没有找到这个页面' : '写下第一条知识，页面会自动收进这里。'}</p> : items.map(item => <button key={item.id} title={item.title} className={item.id === p.current?.id ? 'active' : ''} disabled={p.busy} onClick={async () => { if (await p.open(item.id)) setLibrary(false); }}><FileText size={15} aria-hidden="true" /><span>{item.title}</span></button>)}
      </nav>
      <div className="section-label outline-label"><span>本页目录</span><List size={14} aria-hidden="true" /></div>
      <nav className="outline" aria-label="本页目录">{headings.length ? headings.map((heading, i) => <button key={heading.id} className={heading.level > 1 ? 'nested' : ''} onClick={() => { const node = document.querySelector(`[data-id="${heading.id}"]`); node?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); setLibrary(false); }}><span>{String(i + 1).padStart(2, '0')}</span>{heading.title}</button>) : <p className="quiet">添加标题，章节会出现在这里。</p>}</nav>
      <div className="library-bottom"><button onClick={() => void create(false)}><FolderOpen size={16} aria-hidden="true" />打开示例知识页</button><p>记录一次，复用很多次。</p></div>
    </aside>
    <div className="workspace">
      <header className="workspace-header"><div className="breadcrumb"><button className="mobile-toggle icon-button" aria-label="打开知识夹" onClick={() => setLibrary(!library)}><PanelLeft size={19} /></button><BookOpen size={16} aria-hidden="true" /><span>我的知识夹</span><ChevronRight size={13} aria-hidden="true" /><strong>{p.data.category || '知识笔记'}</strong></div><div className={`save-state ${p.autoState.phase}`} role="status"><i aria-hidden="true" />{p.autoState.message}</div></header>
      {p.error && <div className="feedback error" role="alert">{p.error}</div>}
      {p.notice && <div className="feedback" role="status">{p.notice}</div>}
      {['offline', 'conflict', 'draft'].includes(p.autoState.phase) && <div className="recovery"><span>当前更改尚未同步，请处理保存状态。</span><button onClick={() => void p.save()}>重试保存</button><button onClick={p.exportDraft}>导出恢复草稿</button>{p.current && p.autoState.phase === 'conflict' && <button onClick={() => void p.open(p.current!.id)}>打开服务器版本</button>}</div>}
      {p.loading ? <p className="loading" role="status">正在恢复上次的知识页…</p> : <RenderBoundary key={p.documentKey}><Document key={p.documentKey} p={p} /></RenderBoundary>}
    </div>
  </div>;
}
function Document({ p }: { p: PageState }) {
  const current = useRef(p); current.current = p;
  const [imports, setImports] = useState(Boolean(sourceText(p.draft.importSource))), [exportMenu, setExportMenu] = useState(false);
  const [processing, setProcessing] = useState(false);
  const importButton = useRef<HTMLButtonElement>(null);
  const dark = useDark();
  const editor = useCreateBlockNote({ schema, dictionary: zh, initialContent: p.data.blocks as PartialBlock<typeof schema.blockSchema>[],
    links: { isValidLink: safeLink }, domAttributes: { editor: { 'aria-label': '知识页正文' } }, tables: { headers: true, cellBackgroundColor: true, cellTextColor: true, splitCells: false },
    pasteHandler: ({ event, editor: activeEditor }) => {
      try {
        const html = event.clipboardData?.getData('text/html'), text = event.clipboardData?.getData('text/plain') ?? '';
        if (text.length > MAX_SOURCE || (html?.length ?? 0) > MAX_SOURCE) throw new Error('粘贴内容过大，请拆分为多个知识页。');
        if (html) { const cleaned = safeHTML(html); validateNotebook({ ...current.current.data, blocks: activeEditor.tryParseHTMLToBlocks(cleaned) }); activeEditor.pasteHTML(cleaned); }
        else { const parsed = activeEditor.tryParseMarkdownToBlocks(text); validateNotebook({ ...current.current.data, blocks: parsed }); activeEditor.pasteMarkdown(text); }
        return true;
      } catch (e) { current.current.report(e); return true; }
    },
  }, []);
  const source = sourceText(p.draft.importSource), format = p.draft.importFormat === 'md' || p.draft.importFormat === 'html' ? p.draft.importFormat : 'json';
  function draftSource(value: string) { p.setDraft(extra => ({ ...extra, importSource: value })); }
  async function applyImport() {
    setProcessing(true); p.setError('');
    try {
      if (!source.trim()) throw new Error('请先选择文件或粘贴内容。');
      const next = format === 'json' ? importJSON(source) : { title: '导入的知识页', data: validateNotebook({ category: '导入资料', summary: '', blocks: format === 'html' ? editor.tryParseHTMLToBlocks(safeHTML(source)) : editor.tryParseMarkdownToBlocks(source) }), extra: {} };
      if (await p.replace(next.data, next.title, next.extra)) { setImports(false); p.setNotice('已导入为新知识页，原页面仍在知识夹中。'); }
    } catch (e) { p.report(e); } finally { setProcessing(false); }
  }
  function exportPage(kind: 'json' | 'md' | 'html') {
    try {
      const valid = validateNotebook({ ...p.data, blocks: editor.document });
      const title = p.title || '知识页', name = title.replace(/[\\/:*?"<>|]/g, '-');
      const body = kind === 'json' ? JSON.stringify({ format: 'blocknote-knowledge-page', version: 1, title, data: valid }, null, 2) : kind === 'md' ? `# ${title}\n\n${editor.blocksToMarkdownLossy()}\n` : `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>body{font:17px/1.8 system-ui;max-width:780px;margin:48px auto;padding:24px;color:#26332d}table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:8px}blockquote{border-left:3px solid #829488;padding-left:18px}a{color:#29664f}</style></head><body><h1>${escapeHTML(title)}</h1>${editor.blocksToHTMLLossy()}</body></html>`;
      download(new Blob([body], { type: kind === 'json' ? 'application/json' : kind === 'html' ? 'text/html' : 'text/markdown' }), `${name}.${kind}`);
      setExportMenu(false); p.setNotice(`已导出 ${kind === 'json' ? '完整知识页' : kind === 'html' ? 'HTML' : 'Markdown'}。`);
    } catch (e) { p.report(e); }
  }
  return <>
    <div className="document-tools"><span className="page-kind"><FileText size={14} aria-hidden="true" />知识页</span><div className="tool-actions"><button ref={importButton} onClick={() => setImports(!imports)} aria-expanded={imports}><ArrowUpFromLine size={15} aria-hidden="true" />导入</button><div className="export-wrap"><button onClick={() => setExportMenu(!exportMenu)} aria-expanded={exportMenu}><ArrowDownToLine size={15} aria-hidden="true" />导出</button>{exportMenu && <div className="export-menu" onKeyDown={e => { if (e.key === 'Escape') setExportMenu(false); }}><button onClick={() => exportPage('json')}>知识页 JSON · 完整保留</button><button onClick={() => exportPage('md')}>Markdown · 通用文本</button><button onClick={() => exportPage('html')}>HTML · 阅读页面</button><button onClick={p.exportDraft}>恢复草稿 · 含未应用输入</button></div>}</div><button className="icon-button" aria-label="删除当前知识页" disabled={!p.current || p.busy} onClick={() => void p.remove()}><Trash2 size={15} /></button></div></div>
    {imports && <section className="import-panel" aria-labelledby="import-title"><div className="import-heading"><h2 id="import-title">将资料收进知识夹</h2><button className="icon-button" aria-label="关闭导入面板" onClick={() => { setImports(false); importButton.current?.focus(); }}><X size={18} /></button></div><p>每次导入都会新建页面。JSON 保留完整块结构；Markdown 与 HTML 保留可支持的文字、列表和表格。</p><div className="import-controls"><label>内容格式<select aria-label="导入格式" value={format} onChange={e => p.setDraft(extra => ({ ...extra, importFormat: e.target.value }))}><option value="json">知识页 JSON / 恢复草稿</option><option value="md">Markdown</option><option value="html">HTML</option></select></label><label className="file-label">选择文件<input type="file" accept=".json,.md,.markdown,.html,.htm,text/plain" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 700000) throw new Error('文件超过 700 KB，请拆分后导入。'); const value = await file.text(); if (value.length > MAX_SOURCE) throw new Error('导入文本最多 180,000 字符。'); const kind = /\.html?$/i.test(file.name) ? 'html' : /\.(md|markdown)$/i.test(file.name) ? 'md' : 'json'; p.setDraft(extra => ({ ...extra, importSource: value, importFormat: kind })); } catch (error) { p.report(error); } e.target.value = ''; }} /></label></div><textarea aria-label="待导入内容" value={source} maxLength={MAX_SOURCE} spellCheck={false} placeholder="粘贴知识页 JSON、Markdown 或 HTML…" onChange={e => draftSource(e.target.value)} /><div className="import-footer"><span>{source ? '此处是未应用的导入草稿，随当前页自动保存。' : 'HTML 只导入文字结构，外部媒体不会载入。'}</span><button className="primary" disabled={processing || p.busy} onClick={() => void applyImport()}>{processing ? '正在导入…' : '导入为新知识页'}</button></div></section>}
    <main className="paper" id="document"><div className="page-intro"><label className="category-label"><span className="sr-only">页面分类</span><input aria-label="页面分类" value={p.data.category} maxLength={40} placeholder="知识笔记" onChange={e => p.setData(data => ({ ...data, category: e.target.value }))} /></label><input className="page-title" id="page-title" aria-label="知识页标题" value={p.title} maxLength={120} onChange={e => p.setTitle(e.target.value)} placeholder="未命名知识页" autoComplete="off" /><textarea className="page-summary" aria-label="页面摘要" value={p.data.summary} maxLength={500} placeholder="为这页知识写一句简介…" rows={2} onChange={e => p.setData(data => ({ ...data, summary: e.target.value }))} /><div className="page-rule"><span>写下思考，连接经验</span><span>/ 插入块 · 选中文字设置格式</span></div></div>
      <BlockNoteView editor={editor} theme={dark ? 'dark' : 'light'} onChange={() => { p.setData(data => ({ ...data, blocks: editor.document })); }} />
      <footer className="page-footer"><span>知识的价值，在下一次被用到时发生。</span><span>正文与嵌套内容 · 自动保存已开启</span></footer>
    </main>
  </>;
}
