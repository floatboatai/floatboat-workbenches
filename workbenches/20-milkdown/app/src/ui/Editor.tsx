import { useEffect, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewOptionsCtx, serializerCtx } from '@milkdown/kit/core';
import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { stableTableView, tableBlockView } from './stable-table';
import { safeLink, MARKDOWN_LIMIT } from '../contracts/notebook';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/nord.css';

export function Editor({ initial, onChange, onError, canChange, onReady }: { initial: string; onChange: (source: string) => void; onError: (message: string) => void; canChange: (source: string) => boolean; onReady: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onChange, onError, canChange, onReady });
  handlers.current = { onChange, onError, canChange, onReady };
  const [state, setState] = useState('正在展开笔记…');
  useEffect(() => {
    if (!root.current) return;
    let disposed = false;
    const container = root.current;
    const labelTasks = () => container.querySelectorAll<HTMLElement>('.label-wrapper').forEach(element => {
      const icon = element.querySelector('.checked,.unchecked');
      if (!icon) return;
      element.setAttribute('role', 'checkbox'); element.tabIndex = 0;
      element.setAttribute('aria-checked', String(icon.classList.contains('checked')));
      element.setAttribute('aria-label', element.closest('li')?.querySelector('.content-dom')?.textContent || '任务完成状态');
    });
    const observer = new MutationObserver(labelTasks);
    observer.observe(container, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    const keyboardTask = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('[role="checkbox"]') || ![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const target = event.target;
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      queueMicrotask(() => target.focus());
    };
    container.addEventListener('keydown', keyboardTask, true);
    const crepe = new Crepe({ root: root.current, defaultValue: initial,
      features: { [Crepe.Feature.ImageBlock]: false, [Crepe.Feature.Latex]: false, [Crepe.Feature.AI]: false, [Crepe.Feature.TopBar]: false },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: '在这里写下新的想法，输入 / 插入段落…' },
        [Crepe.Feature.Toolbar]: { boldLabel: '粗体', italicLabel: '斜体', codeLabel: '行内代码', linkLabel: '链接', strikethroughLabel: '删除线' },
        [Crepe.Feature.CodeMirror]: { copyText: '复制', searchPlaceholder: '查找语言…', noResultText: '暂无语言', renderPreview: () => null },
        [Crepe.Feature.LinkTooltip]: { inputPlaceholder: 'https://…' },
        [Crepe.Feature.BlockEdit]: { textGroup: { label: '段落', text: { label: '正文' }, h1: { label: '一级标题' }, h2: { label: '二级标题' }, h3: { label: '三级标题' }, h4: { label: '四级标题' }, h5: { label: '五级标题' }, h6: { label: '六级标题' }, quote: { label: '引用' }, divider: { label: '分隔线' } }, listGroup: { label: '列表', bulletList: { label: '无序列表' }, orderedList: { label: '有序列表' }, taskList: { label: '任务清单' } }, advancedGroup: { label: '更多', image: null, math: null, codeBlock: { label: '代码块' }, table: { label: '表格' } } }
      }
    });
    const tableReady = crepe.editor.remove(tableBlockView);
    crepe.editor.use(stableTableView).config(ctx => {
      ctx.update(uploadConfig.key, previous => ({ ...previous, uploader: async () => { handlers.current.onError('此笔记本仅收录文字，图片未导入。'); return []; } }));
      ctx.update(editorViewOptionsCtx, previous => ({ ...previous, attributes: { 'aria-label': '笔记正文', role: 'textbox', 'aria-multiline': 'true' } }));
    }).use($prose(ctx => new Plugin({ view: () => ({ update(view, previous) { if (!disposed && !view.state.doc.eq(previous.doc)) handlers.current.onChange(ctx.get(serializerCtx)(view.state.doc)); } }), filterTransaction(transaction) {
      if (!transaction.docChanged) return true;
      let error = transaction.doc.textContent.length > MARKDOWN_LIMIT ? '正文最多 100,000 字符，请新建笔记继续。' : '';
      transaction.doc.descendants(node => {
        if (node.type.name === 'image' || node.type.name === 'image-block') error = '此笔记本仅收录文字，图片未导入。';
        for (const mark of node.marks) if (mark.type.name === 'link' && !safeLink(String(mark.attrs.href))) error = '链接仅支持 http、https、mailto 或文内锚点。';
      });
      const source = ctx.get(serializerCtx)(transaction.doc);
      if (source.length > MARKDOWN_LIMIT) error = 'Markdown 最多 100,000 字符，请新建笔记继续。';
      if (!error && !handlers.current.canChange(source)) error = '笔记本容量已满，请导出并新建笔记本。';
      if (error) handlers.current.onError(error);
      return !error;
    } })));
    const ready = tableReady.then(() => crepe.create()).then(() => { if (!disposed) { setState(''); handlers.current.onReady(); } }).catch(error => { if (!disposed) { setState('编辑器加载失败，可切换源码继续写作。'); handlers.current.onError(error instanceof Error ? error.message : '编辑器加载失败。'); } });
    return () => { disposed = true; observer.disconnect(); container.removeEventListener('keydown', keyboardTask, true); void ready.then(() => crepe.destroy()); };
    // Initial content belongs to this keyed document; autosave ACKs never rebuild it.
  }, []);
  return <div className="native-editor">{state && <p role="status">{state}</p>}<div ref={root} /></div>;
}
