import type { PartialBlock } from '@blocknote/core';
import { isRecord, boundedText } from './project.ts';

export interface Notebook { category: string; summary: string; blocks: PartialBlock[] }
export const MAX_SOURCE = 180000;
const blockTypes = new Set(['paragraph', 'heading', 'quote', 'bulletListItem', 'numberedListItem', 'checkListItem', 'toggleListItem', 'table']);
const colors = new Set(['default', 'gray', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
const alignments = new Set(['left', 'center', 'right', 'justify']);
export function safeLink(value: string): boolean {
  if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function props(value: unknown, allowed: string[]) {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('块属性格式无效。');
  const output: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!allowed.includes(key)) throw new Error(`不支持块属性：${key}`);
    if ((key === 'textColor' || key === 'backgroundColor') && typeof item === 'string' && colors.has(item)) output[key] = item;
    else if (key === 'textAlignment' && typeof item === 'string' && alignments.has(item)) output[key] = item;
    else if (['checked', 'isToggleable'].includes(key) && typeof item === 'boolean') output[key] = item;
    else if (key === 'level' && typeof item === 'number' && [1, 2, 3].includes(item)) output[key] = item;
    else if (key === 'start' && typeof item === 'number' && Number.isInteger(item) && item >= 1 && item <= 10000) output[key] = item;
    else if (['colspan', 'rowspan'].includes(key) && item === 1) output[key] = item;
    else throw new Error(`块属性 ${key} 无效。`);
  }
  return output;
}
function inline(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [{ type: 'text', text: boundedText(value, MAX_SOURCE), styles: {} }];
  if (!Array.isArray(value) || value.length > 6000) throw new Error('文字片段格式无效。');
  return value.map(item => {
    if (typeof item === 'string') return { type: 'text', text: boundedText(item, MAX_SOURCE), styles: {} };
    if (!isRecord(item)) throw new Error('文字片段格式无效。');
    if (item.type === 'link') {
      if (typeof item.href !== 'string' || !safeLink(item.href)) throw new Error('链接仅支持完整 http、https 或 mailto 地址。');
      const content = inline(item.content);
      if (content.some(x => isRecord(x) && x.type !== 'text')) throw new Error('链接不能嵌套链接。');
      return { type: 'link', href: item.href, content };
    }
    if (item.type !== 'text') throw new Error('仅支持文字与链接。');
    const styles: Record<string, boolean | string> = {};
    if (item.styles !== undefined) {
      if (!isRecord(item.styles)) throw new Error('文字样式无效。');
      for (const [key, style] of Object.entries(item.styles)) {
        if (['bold', 'italic', 'underline', 'strike', 'code'].includes(key) && typeof style === 'boolean') styles[key] = style;
        else if (['textColor', 'backgroundColor'].includes(key) && typeof style === 'string' && colors.has(style)) styles[key] = style;
        else throw new Error('文字样式不受支持。');
      }
    }
    return { type: 'text', text: boundedText(item.text, MAX_SOURCE), styles };
  });
}
const baseProps = ['textColor', 'backgroundColor', 'textAlignment'];
function decodeNotebook(value: unknown, recovery = false): Notebook {
  if (!isRecord(value)) throw new Error('知识页格式无效。');
  if (new TextEncoder().encode(JSON.stringify(value)).length > (recovery ? 1500000 : 700000)) throw new Error('知识页超过 700 KB，请拆分页面。');
  const category = boundedText(value.category ?? '知识笔记', 40), summary = boundedText(value.summary ?? '', 500);
  let count = 0;
  const ids = new Set<string>();
  function blocks(raw: unknown, depth: number): unknown[] {
    if (!Array.isArray(raw) || raw.length < 1 || depth > (recovery ? 16 : 8)) throw new Error('页面需有内容块，嵌套最多 8 层。');
    return raw.map(block => {
      if (++count > (recovery ? 2400 : 1200) || !isRecord(block) || typeof block.type !== 'string' || !blockTypes.has(block.type)) throw new Error('块类型不受支持，或超过 1200 块。');
      let id: string | undefined;
      if (block.id !== undefined) {
        if (typeof block.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(block.id) || ids.has(block.id)) throw new Error('块标识无效或重复。');
        id = block.id; ids.add(id);
      }
      const extra = block.type === 'heading' ? ['level', 'isToggleable'] : block.type === 'checkListItem' ? ['checked'] : block.type === 'numberedListItem' ? ['start'] : [];
      const blockProps = props(block.props, [...baseProps, ...extra]);
      let content: unknown = inline(block.type === 'table' ? undefined : block.content);
      if (block.type === 'table') {
        const table = block.content;
        if (!isRecord(table) || table.type !== 'tableContent' || !Array.isArray(table.rows) || !table.rows.length || table.rows.length > 100) throw new Error('表格最多 100 行。');
        let columns = 0;
        const rows = table.rows.map(row => {
          if (!isRecord(row) || !Array.isArray(row.cells) || !row.cells.length || row.cells.length > 12) throw new Error('表格最多 12 列。');
          if (columns && columns !== row.cells.length) throw new Error('表格每行列数必须相同。');
          columns = row.cells.length;
          return { cells: row.cells.map(cell => {
            if (isRecord(cell) && cell.type === 'tableCell') return { type: 'tableCell', props: props(cell.props, [...baseProps, 'colspan', 'rowspan']), content: inline(cell.content) };
            return inline(cell);
          }) };
        });
        const widths = table.columnWidths;
        if (widths !== undefined && (!Array.isArray(widths) || widths.length !== columns || widths.some(w => w !== null && w !== undefined && (typeof w !== 'number' || w < 20 || w > 2000)))) throw new Error('表格列宽无效。');
        for (const key of ['headerRows', 'headerCols']) if (table[key] !== undefined && (typeof table[key] !== 'number' || ![0, 1].includes(table[key]))) throw new Error('表头格式无效。');
        content = { type: 'tableContent', rows, columnWidths: widths ?? Array(columns).fill(null), ...(table.headerRows === undefined ? {} : { headerRows: table.headerRows }), ...(table.headerCols === undefined ? {} : { headerCols: table.headerCols }) };
      }
      const children = block.children === undefined || (Array.isArray(block.children) && block.children.length === 0) ? [] : blocks(block.children, depth + 1);
      return { ...(id ? { id } : {}), type: block.type, props: blockProps, content, children };
    });
  }
  // Every supported field has been checked above; media and executable/custom nodes are excluded.
  return { category, summary, blocks: blocks(value.blocks, 0) as PartialBlock[] };
}
export function validateNotebook(value: unknown): Notebook { return decodeNotebook(value); }
// A safe but over-limit working copy remains recoverable while the applied model is unchanged.
export function restoreNotebook(value: unknown): Notebook { return decodeNotebook(value, true); }
export function blockText(block: { content?: unknown }): string {
  function text(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(text).join('');
    if (isRecord(content)) return typeof content.text === 'string' ? content.text : text(content.content);
    return '';
  }
  return text(block.content);
}
export function outline(blocks: PartialBlock[]): { id: string; title: string; level: number }[] {
  return blocks.flatMap(block => [
    ...(block.type === 'heading' && block.id ? [{ id: block.id, title: blockText(block) || '未命名章节', level: block.props?.level ?? 1 }] : []),
    ...outline(block.children ?? []),
  ]);
}
export const emptyNotebook: Notebook = { category: '知识笔记', summary: '', blocks: [{ type: 'paragraph', content: '' }] };
export const sampleNotebook = validateNotebook({
  category: '团队手册', summary: '把分散的经验，整理成团队可以复用的工作方式。',
  blocks: [
    { id: 'principle', type: 'heading', props: { level: 1 }, content: '让知识持续生长' },
    { type: 'paragraph', content: '一次好的记录，不只留住答案，也留下当时为什么这样做。这个页面收集了我们整理团队知识时的小习惯。' },
    { type: 'quote', content: '先写下正在发生的事，再慢慢把经验整理成方法。' },
    { id: 'practice', type: 'heading', props: { level: 2 }, content: '01  从一次具体的实践开始' },
    { type: 'bulletListItem', content: [{ type: 'text', text: '记录背景', styles: { bold: true } }, { type: 'text', text: '：这次要解决什么问题？', styles: {} }], children: [{ type: 'bulletListItem', content: '给后来的人足够的上下文，而不只是一个结论。' }] },
    { type: 'bulletListItem', content: [{ type: 'text', text: '写清决定', styles: { bold: true } }, { type: 'text', text: '：我们选择了什么，以及放弃了什么。', styles: {} }] },
    { id: 'next', type: 'heading', props: { level: 2 }, content: '02  下一次分享之前' },
    { type: 'checkListItem', props: { checked: true }, content: '整理最近一次项目复盘的关键决定' },
    { type: 'checkListItem', props: { checked: false }, content: '补充一个可以直接复用的示例' },
    { type: 'checkListItem', props: { checked: false }, content: '邀请一位同事试着照着文档完成任务' },
    { id: 'rhythm', type: 'heading', props: { level: 2 }, content: '03  给知识留一个更新节奏' },
    { type: 'table', content: { type: 'tableContent', headerRows: 1, rows: [{ cells: ['什么时候', '做什么', '留下什么'] }, { cells: ['每次实践后', '补充现场记录', '背景与决定'] }, { cells: ['每月回顾', '合并重复经验', '可复用的方法'] }] } },
    { type: 'paragraph', content: '' },
  ],
});
