import { useRef, useState } from 'react';
import { MDXEditor, type MDXEditorMethods, type ViewMode, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, markdownShortcutPlugin, tablePlugin, linkPlugin, linkDialogPlugin, codeBlockPlugin, codeMirrorPlugin, diffSourcePlugin, toolbarPlugin, realmPlugin, viewMode$, UndoRedo, BoldItalicUnderlineToggles, BlockTypeSelect, ListsToggle, InsertTable, InsertCodeBlock, CreateLink, CodeToggle, Separator } from '@mdxeditor/editor';
import { FileText, Code2, GitCompareArrows } from 'lucide-react';
import { markdownProblem, safeLink } from '../contracts/review';
import { translateEditor } from './messages';
import '@mdxeditor/editor/style.css';

const modePlugin = realmPlugin<{ mode: ViewMode }>({ update(realm, options) { if (options && realm.getValue(viewMode$) !== options.mode) realm.pub(viewMode$, options.mode); } });
const modes = [{ value: 'rich-text', label: '正文', icon: FileText }, { value: 'source', label: '源文', icon: Code2 }, { value: 'diff', label: '差异', icon: GitCompareArrows }] as const;

export function ReviewEditor({ markdown, baseline, onChange }: { markdown: string; baseline: string; onChange: (value: string) => void }) {
  // This component is keyed only by documentKey. Save acknowledgements never reseed the editor.
  const initial = useRef(markdown), editor = useRef<MDXEditorMethods>(null);
  const [mode, setMode] = useState<ViewMode>(() => markdownProblem(markdown) ? 'source' : 'rich-text');
  const [renderError, setRenderError] = useState('');
  const problem = markdownProblem(markdown);
  return <section className={'editor-surface mode-' + mode} aria-label="文档编辑区">
    <div className="view-row"><nav className="view-tabs" aria-label="编辑视图">{modes.map(({ value, label, icon: Icon }) => <button type="button" key={value} aria-pressed={mode === value} disabled={value === 'rich-text' && !!problem} title={value === 'rich-text' && problem ? problem : undefined} onClick={() => { setRenderError(''); setMode(value); }}><Icon size={16} aria-hidden="true" />{label}</button>)}</nav><span className="view-hint">{mode === 'rich-text' ? '编辑与阅读' : mode === 'source' ? 'Markdown · 原始文本' : '逐行核对本轮修改'}</span></div>
    {mode === 'diff' && <div className="diff-labels"><span>比较基线 · 只读</span><span>当前稿 · 在源文中修改</span></div>}
    {(problem || renderError) && <p className="source-warning" role="status">{problem || '源文暂不能显示为正文，请在源文中修正。'} 输入会作为草稿保留。</p>}
    <div onClickCapture={(event) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault(); }}>
      <MDXEditor ref={editor} markdown={initial.current} trim={false} suppressHtmlProcessing contentEditableClassName="document-content" translation={translateEditor} placeholder="写下文档标题，开始这一轮创作…" onChange={(value, normalized) => { if (!normalized || mode !== 'rich-text') { setRenderError(''); onChange(value); } }} onError={({ error }) => { queueMicrotask(() => { setRenderError(error); setMode('source'); }); }} plugins={[
        headingsPlugin(), listsPlugin(), quotePlugin(), thematicBreakPlugin(), tablePlugin(), linkPlugin({ validateUrl: safeLink, disableAutoLink: true }), linkDialogPlugin(), codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }), codeMirrorPlugin({ codeBlockLanguages: { text: '纯文本', json: 'JSON', js: 'JavaScript', css: 'CSS', bash: 'Shell' }, autoLoadLanguageSupport: false }), markdownShortcutPlugin(), diffSourcePlugin({ diffMarkdown: baseline, viewMode: mode, readOnlyDiff: true }), modePlugin({ mode }),
        toolbarPlugin({ toolbarContents: () => mode === 'rich-text' ? <><UndoRedo /><Separator /><BlockTypeSelect /><Separator /><BoldItalicUnderlineToggles options={['Bold', 'Italic']} /><CodeToggle /><Separator /><ListsToggle /><CreateLink /><InsertTable /><InsertCodeBlock /></> : <span className="source-toolbar">{mode === 'source' ? '直接修改源文；返回正文查看排版。' : '红色为删除，绿色为新增。比较基线不会随编辑改变。'}</span> }),
      ]} />
    </div>
  </section>;
}
