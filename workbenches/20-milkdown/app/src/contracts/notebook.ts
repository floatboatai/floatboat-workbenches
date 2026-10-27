import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { isRecord, boundedText, titleValue } from './project.ts';

export const MARKDOWN_LIMIT = 100000;
export const MODEL_BYTES = 700000;
export const DRAFT_BYTES = 350000;
export const ARCHIVE_BYTES = 1100000;
export interface Note { id: string; title: string; tags: string[]; markdown: string; notes: string }
export interface Notebook { version: 1; documents: Note[] }
export interface NotebookDraft { sources?: Record<string, string>; importText?: string; selectedId?: string; tagInput?: string }
export interface Archive { format: 'milkdown-notebook'; version: 1; title: string; data: Notebook; draft: NotebookDraft }
const parser = unified().use(remarkParse).use(remarkGfm);
export const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
export function safeLink(url: string): boolean { return /^(https?:\/\/|mailto:|#)/i.test(url) && !/[\u0000-\u0020\u007f]/.test(url); }
export function markdownTree(source: string) { return parser.parse(source); }
export function validateMarkdown(value: unknown): string {
  const source = boundedText(value, MARKDOWN_LIMIT);
  const tree = markdownTree(source);
  let count = 0;
  function visit(node: unknown, depth: number) {
    if (!isRecord(node)) return;
    if (++count > 12000 || depth > 40) throw new Error('文档结构过于复杂，请拆分为多篇笔记。');
    if (node.type === 'image' || node.type === 'imageReference' || node.type === 'html') throw new Error('仅支持文字 Markdown；请移除图片、HTML 或嵌入，原始输入会保留。');
    if (['link', 'definition'].includes(String(node.type)) && (typeof node.url !== 'string' || !safeLink(node.url))) throw new Error('链接仅支持 https、http、mailto 或文内锚点。');
    if (Array.isArray(node.children)) for (const child of node.children) visit(child, depth + 1);
  }
  visit(tree, 0);
  return source;
}
export function validateNotebook(value: unknown): Notebook {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.documents) || value.documents.length < 1 || value.documents.length > 30) throw new Error('笔记本需要 1–30 篇笔记。');
  const ids = new Set<string>();
  const documents = value.documents.map((raw): Note => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(raw.id) || ids.has(raw.id)) throw new Error('笔记标识无效或重复。');
    ids.add(raw.id);
    if (!Array.isArray(raw.tags) || raw.tags.length > 8 || raw.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 24)) throw new Error('每篇笔记最多 8 个标签，每个最多 24 字。');
    return { id: raw.id, title: titleValue(raw.title), tags: [...new Set(raw.tags as string[])], markdown: validateMarkdown(raw.markdown), notes: boundedText(raw.notes, 10000) };
  });
  const notebook: Notebook = { version: 1, documents };
  if (bytes(notebook) > MODEL_BYTES) throw new Error('笔记本超过 700 KB，请拆分内容。');
  return notebook;
}
export function restoreNotebook(value: unknown): Notebook {
  if (!isRecord(value) || !Array.isArray(value.documents)) return validateNotebook(value);
  const copy = structuredClone(value);
  if (!Array.isArray(copy.documents)) return validateNotebook(value);
  const titles = copy.documents.map(raw => isRecord(raw) ? boundedText(raw.title, 120) : '');
  for (const raw of copy.documents) if (isRecord(raw) && typeof raw.title === 'string' && !raw.title.trim()) raw.title = '未命名';
  const result = validateNotebook(copy);
  result.documents.forEach((note, index) => { note.title = titles[index]; });
  return result;
}
export function validateDraft(value: unknown): NotebookDraft {
  if (!isRecord(value)) throw new Error('草稿格式无效。');
  const draft: NotebookDraft = {};
  if (value.tagInput !== undefined) draft.tagInput = boundedText(value.tagInput, 200);
  if (value.importText !== undefined) draft.importText = boundedText(value.importText, MARKDOWN_LIMIT);
  if (value.selectedId !== undefined) draft.selectedId = boundedText(value.selectedId, 64);
  if (value.sources !== undefined) {
    if (!isRecord(value.sources) || Object.keys(value.sources).length > 30) throw new Error('源码草稿格式无效。');
    draft.sources = {};
    for (const [id, source] of Object.entries(value.sources)) {
      if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) throw new Error('源码笔记标识无效。');
      draft.sources[id] = boundedText(source, MARKDOWN_LIMIT);
    }
  }
  if (bytes(draft) > DRAFT_BYTES) throw new Error('未应用稿超过 350 KB，请先导出草稿并减少内容。');
  return draft;
}
export function readArchive(text: string): Archive {
  if (new TextEncoder().encode(text).length > ARCHIVE_BYTES) throw new Error('笔记本文件超过 1.1 MB。');
  const raw: unknown = JSON.parse(text);
  if (!isRecord(raw) || raw.format !== 'milkdown-notebook' || raw.version !== 1) throw new Error('请选择 Milkdown 笔记本 JSON，或导入 Markdown。');
  return { format: 'milkdown-notebook', version: 1, title: titleValue(raw.title), data: validateNotebook(raw.data), draft: validateDraft(raw.draft ?? {}) };
}
export function createArchive(title: string, data: Notebook, draft: unknown): string {
  const value: Archive = { format: 'milkdown-notebook', version: 1, title: titleValue(title), data: validateNotebook(data), draft: validateDraft(draft) };
  // Compact JSON keeps an exported archive within the dedicated JSON-file import budget.
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > ARCHIVE_BYTES) throw new Error('笔记本导出超过文件上限。');
  return text;
}
export function headings(source: string): { text: string; level: number }[] {
  const result: { text: string; level: number }[] = [];
  const text = (node: unknown): string => isRecord(node) ? typeof node.value === 'string' ? node.value : Array.isArray(node.children) ? node.children.map(text).join('') : '' : '';
  for (const node of markdownTree(source).children) if (node.type === 'heading') result.push({ text: text(node), level: node.depth });
  return result;
}
export const seed: Notebook = { version: 1, documents: [
  { id: 'morning', title: '把清晨留给散步', tags: ['随笔', '城市观察'], notes: '下次经过河堤时，记下早市收摊的声音。\n\n第三节还可以加入一个具体的人物。', markdown: '有些想法，只有走慢一点才会出现。\n\n## 从桥边出发\n\n今天没有带耳机。沿着河往东走，街道慢慢醒来：早餐店的蒸汽、树下停着的单车，还有第一班公交车经过的声音。\n\n我想记录的不是路线，而是那些**值得停下来看的瞬间**。\n\n> 散步并不是为了抵达哪里，而是重新认识已经熟悉的地方。\n\n## 途中拾起的片段\n\n- 桥下的水面把晨光切成细碎的银色。\n- 花店老板把第一桶雏菊放到门口。\n- 路边有人停下来，为一只猫让路。\n\n## 留给下一次\n\n- [x] 走一条没有走过的小路\n- [ ] 记下街角咖啡店的名字\n- [ ] 把观察写成一篇短文\n\n写到这里，窗外的光已经变了。明天可以从另一个方向出发。\n' },
  { id: 'reading', title: '阅读时留下的空白', tags: ['阅读'], notes: '', markdown: '## 慢读清单\n\n读完一章以后，先写下一个问题。\n\n| 书页 | 留下的问题 |\n| --- | --- |\n| 第一章 | 作者为什么从这里开始？ |\n| 第二章 | 哪个细节改变了我的理解？ |\n' },
  { id: 'ideas', title: '一些还没有标题的想法', tags: ['灵感'], notes: '', markdown: '## 随手记\n\n让想法先落在纸上，再决定它会长成什么。\n\n```text\n观察 → 提问 → 记录 → 重写\n```\n' }
] };
