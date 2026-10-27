import { useEffect, useRef, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import type { Article, EditorMode } from '../contracts/article';
import { contentNotice, requiresSource, renderingLimited } from '../contracts/article';
import { safeHtml } from './html';
export interface EditorBridge { mode: (mode: EditorMode) => boolean; html: () => string; html2md: (html: string) => string; value: () => string; focus: () => void; }
interface Props { initial: Article; dark: boolean; mode: EditorMode; typeset: Article['typeset']; onInput: (markdown: string, mode: EditorMode) => void; onReady: (bridge: EditorBridge | null) => void; onError: (message: string) => void; }

export function ArticleEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null), instance = useRef<Vditor | null>(null), latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let destroyed = false, editor: Vditor | null = null;
    const element = host.current;
    const emit = () => {
      if (!editor?.vditor?.lute || destroyed) return;
      // SV's native textarea is the exact working source, including trailing whitespace.
      const mode = editor.getCurrentMode();
      const markdown = mode === 'sv' ? editor.vditor.sv!.element.value : editor.getValue();
      if (mode === 'sv') { editor.setPreviewMode(renderingLimited(markdown) ? 'editor' : 'both'); if (renderingLimited(markdown)) editor.renderPreview(); }
      latest.current.onInput(markdown, mode);
    };
    const switchMode = (mode: EditorMode) => {
      if (!editor?.vditor?.lute) return false;
      const markdown = editor.getCurrentMode() === 'sv' ? editor.vditor.sv!.element.value : editor.getValue();
      if (mode !== 'sv' && renderingLimited(markdown)) { latest.current.onError('这篇文章需要先在源码模式缩短：总长不超过 50,000 字符，单行不超过 4,000 字符后可排版。'); return false; }
      if (mode !== 'sv' && requiresSource(markdown)) { latest.current.onError('这段内容含媒体、原始 HTML 或公式。请在源码模式编辑；移除这些语法后可切换。'); return false; }
      emit();
      const button = element.querySelector<HTMLButtonElement>(`button[data-mode="${mode}"]`);
      if (navigator.userAgent.includes('iPhone')) button?.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true })); else button?.click();
      if (mode === 'sv') editor.vditor.sv!.element.value = markdown;
      latest.current.onInput(markdown, mode);
      return true;
    };
    editor = new Vditor(element, {
      cdn: '/api/vditor', lang: 'zh_CN', icon: 'ant', cache: { enable: false }, value: '',
      mode: requiresSource(props.initial.markdown) || renderingLimited(props.initial.markdown) ? 'sv' : props.initial.mode, theme: props.dark ? 'dark' : 'classic',
      minHeight: 540, height: 'auto', width: '100%', undoDelay: 150,
      placeholder: '从一个值得记录的瞬间开始…',
      toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'quote', 'list', 'ordered-list', 'check', '|', 'link', 'table', 'code', 'inline-code', '|', 'undo', 'redo', 'edit-mode'],
      toolbarConfig: { pin: false }, outline: { enable: false, position: 'left' },
      hint: { parse: false, emoji: {}, emojiPath: '/api/vditor/unused-emoji' },
      link: { isOpen: false }, image: { isPreview: false },
      preview: { delay: 150, maxWidth: 720, mode: renderingLimited(props.initial.markdown) ? 'editor' : 'both', actions: [], hljs: { enable: false },
        // Pre-size code blocks before Vditor adds its optional inline-handler copy menu.
        parse: (element) => { element.querySelectorAll<HTMLElement>('pre > code').forEach(code => { code.style.maxHeight = '800px'; }); },
        markdown: { sanitize: true, codeBlockPreview: false, mathBlockPreview: false, inlineMath: false, toc: false, autoSpace: false, fixTermTypo: false },
        render: { media: { enable: false } },
        theme: { current: props.dark ? 'dark' : props.initial.typeset, list: { light: '书稿', wechat: '发布稿', dark: '夜读' }, path: '/api/vditor/dist/css/content-theme' },
        transform: safeHtml,
      },
      input: emit, blur: emit,
      after: () => {
        if (!editor) return;
        if (destroyed) { editor.destroy(); return; }
        // Icons are loaded with an external same-origin script; upstream sync loader injects inline JS.
        editor.vditor.options.icon = undefined;
        // Delay the initial document until native HTML previews and images are inert.
        const lute = editor.vditor.lute as typeof editor.vditor.lute & { SetVditorHTMLBlockPreview: (enable: boolean) => void };
        lute.SetVditorHTMLBlockPreview(false);
        lute.SetImageLazyLoading('data:,');
        editor.setValue(props.initial.markdown, true);
        if (editor.vditor.sv) { editor.vditor.sv.element.maxLength = 200000; if (editor.getCurrentMode() === 'sv') editor.vditor.sv.element.value = props.initial.markdown; }
        for (const item of element.querySelectorAll<HTMLElement>('[contenteditable="true"],textarea')) { item.setAttribute('aria-label', item.tagName === 'TEXTAREA' ? 'Markdown 源码' : '文章正文'); item.setAttribute('spellcheck', 'false'); if (item.tagName !== 'TEXTAREA') { item.setAttribute('role', 'textbox'); item.setAttribute('aria-multiline', 'true'); } }
        instance.current = editor;
        setReady(true);
        latest.current.onReady({ mode: switchMode, html: () => { if (renderingLimited(latest.current.initial.markdown)) throw new Error('请先缩短长文或超长行，再导出 HTML。Markdown 与完整项目可直接导出。'); return safeHtml(editor?.vditor.lute.Md2HTML(latest.current.initial.markdown) ?? ''); }, html2md: (html) => editor?.html2md(safeHtml(html)) ?? '', value: () => editor?.getCurrentMode() === 'sv' ? editor.vditor.sv!.element.value : editor?.getValue() ?? '', focus: () => editor?.focus() });
        if ((requiresSource(props.initial.markdown) || renderingLimited(props.initial.markdown)) && props.initial.mode !== 'sv') latest.current.onInput(props.initial.markdown, 'sv');
      },
    });
    const capture = (event: Event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest('[contenteditable="true"],textarea')) return;
      // Also capture immediately instead of waiting for the upstream undo debounce.
      queueMicrotask(emit);
    };
    const modeShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.altKey && ['Digit7', 'Digit8', 'Digit9'].includes(event.code)) {
        event.preventDefault(); event.stopPropagation();
        switchMode(event.code === 'Digit7' ? 'wysiwyg' : event.code === 'Digit8' ? 'ir' : 'sv');
      }
    };
    element.addEventListener('keydown', modeShortcut, true);
    const guardPaste = (event: ClipboardEvent) => { const html = event.clipboardData?.getData('text/html'); if (html && editor) { event.preventDefault(); if (html.length > 100000) { latest.current.onError('HTML 粘贴内容超过 100,000 字符，请先缩短。'); return; } const markdown = editor.html2md(safeHtml(html)); if (editor.getCurrentMode() !== 'sv' && renderingLimited(markdown + editor.getValue())) { latest.current.onError('请切换到源码模式粘贴长文本。'); return; } editor.insertMD(markdown); emit(); return; } if (editor?.getCurrentMode() !== 'sv' && renderingLimited((event.clipboardData?.getData('text/plain') ?? '') + (editor?.getValue() ?? ''))) { event.preventDefault(); latest.current.onError('请切换到源码模式粘贴长文本。'); return; } if ((event.clipboardData?.getData('text/plain').length ?? 0) + (editor?.getValue().length ?? 0) > 200000) { event.preventDefault(); latest.current.onError('粘贴内容超过草稿容量（200,000 字符），请拆分后导入。'); } };
    element.addEventListener('paste', guardPaste, true);
    element.addEventListener('input', capture);
    const timer = window.setTimeout(() => { if (!instance.current && !destroyed) latest.current.onError('编辑器资源加载失败。请刷新重试；已有内容仍保留。'); }, 12000);
    return () => { destroyed = true; clearTimeout(timer); element.removeEventListener('input', capture); element.removeEventListener('paste', guardPaste, true); element.removeEventListener('keydown', modeShortcut, true); latest.current.onReady(null); if (editor?.vditor?.lute) editor.destroy(); instance.current = null; };
  }, []);
  useEffect(() => { if (ready) instance.current?.setTheme(props.dark ? 'dark' : 'classic', props.dark ? 'dark' : props.typeset, undefined, '/api/vditor/dist/css/content-theme'); }, [props.dark, props.typeset, ready]);
  return <div className={`editor-wrap mode-${props.mode} ${renderingLimited(props.initial.markdown) ? 'render-paused' : ''}`} data-editor-ready={ready}>{!ready && <p role="status" className="editor-loading">正在准备文章…</p>}<div ref={host} />{contentNotice(props.initial.markdown) && <p className="content-note">{contentNotice(props.initial.markdown)}</p>}</div>;
}
