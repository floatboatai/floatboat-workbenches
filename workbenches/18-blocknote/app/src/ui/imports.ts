import { MAX_SOURCE, safeLink, restoreNotebook, validateNotebook, type Notebook } from '../contracts/notebook.ts';
import { isRecord } from '../contracts/project.ts';
export function sourceText(value: unknown): string { return typeof value === 'string' && value.length <= MAX_SOURCE ? value : ''; }
export const MAX_PROJECT_FILE_BYTES = 4_000_000;
export function importJSON(source: string): { data: Notebook; title: string; extra: Record<string, unknown> } {
  if (new TextEncoder().encode(source).length > MAX_PROJECT_FILE_BYTES) throw new Error('知识页文件不能超过 4 MB。');
  const raw: unknown = JSON.parse(source);
  if (!isRecord(raw)) throw new Error('文件需要一个知识页对象。');
  const object = isRecord(raw.snapshot) ? raw.snapshot : raw;
  const title = typeof object.title === 'string' ? object.title : '导入的知识页';
  if (title.length > 120) throw new Error('标题最多 120 字符。');
  const extra = isRecord(object.extra) ? { importSource: sourceText(object.extra.importSource), importFormat: ['json', 'md', 'html'].includes(String(object.extra.importFormat)) ? object.extra.importFormat : 'json' } : {};
  return { data: isRecord(raw.snapshot) ? restoreNotebook(object.data) : validateNotebook(object.data ?? object), title, extra };
}
/** Template content is inert. Only supported text markup enters the native parser. */
export function safeHTML(source: string): string {
  if (source.length > MAX_SOURCE) throw new Error('导入文本最多 180,000 字符。');
  const template = document.createElement('template'); template.innerHTML = source;
  const allowed = new Set(['P', 'DIV', 'SPAN', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'CODE', 'A', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const dangerous = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'IMG', 'VIDEO', 'AUDIO', 'SVG', 'MATH', 'LINK', 'META', 'FORM', 'INPUT']);
  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof Element) || dangerous.has(node.tagName)) return null;
    const output = document.createElement(allowed.has(node.tagName) ? node.tagName.toLowerCase() : 'span');
    if (node.tagName === 'A' && safeLink(node.getAttribute('href') ?? '')) output.setAttribute('href', node.getAttribute('href')!);
    if (node.tagName === 'OL' && /^\d{1,4}$/.test(node.getAttribute('start') ?? '')) output.setAttribute('start', node.getAttribute('start')!);
    for (const child of node.childNodes) { const next = clean(child); if (next) output.append(next); }
    return output;
  }
  const result = document.createElement('div');
  for (const node of template.content.childNodes) { const next = clean(node); if (next) result.append(next); }
  return result.innerHTML;
}
export function escapeHTML(text: string): string { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
