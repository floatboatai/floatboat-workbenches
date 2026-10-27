import { fromMarkdown } from 'mdast-util-from-markdown';
import { isRecord, boundedText, titleValue } from './project.ts';

export const MAX_MARKDOWN = 80000;
export const MAX_PROJECT_FILE_BYTES = 1100000;
export interface ReviewNote { id: string; text: string; done: boolean }
export interface ReviewDocument { version: 1; markdown: string; baseline: string; baselineLabel: string; notes: ReviewNote[] }
export interface ReviewExport { format: 'mdxeditor-review'; version: 1; title: string; document: ReviewDocument; drafts: { noteInput: string; importText: string; importKind: 'markdown' | 'project' } }

export function safeLink(url: string): boolean {
  return /^(https?:\/\/|mailto:|#)/i.test(url) && !/[\u0000-\u0020\u007f]/.test(url);
}

/** Restore structural drafts without erasing incomplete or unsupported Markdown. */
export function restoreDocument(value: unknown): ReviewDocument {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.notes) || value.notes.length > 80) throw new Error('审阅文档格式无效，最多保留 80 条意见。');
  const seen = new Set<string>();
  const notes = value.notes.map((note) => {
    if (!isRecord(note) || typeof note.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(note.id) || typeof note.done !== 'boolean' || seen.has(note.id)) throw new Error('审阅意见格式无效或标识重复。');
    seen.add(note.id);
    return { id: note.id, text: boundedText(note.text, 3000), done: note.done };
  });
  const document: ReviewDocument = { version: 1, markdown: boundedText(value.markdown, MAX_MARKDOWN), baseline: boundedText(value.baseline, MAX_MARKDOWN), baselineLabel: boundedText(value.baselineLabel, 100), notes };
  if (new TextEncoder().encode(JSON.stringify(document)).length > 650000) throw new Error('文档与审阅意见合计不能超过 650 KB。');
  return document;
}

export function markdownProblem(markdown: string): string {
  if (markdown.length > MAX_MARKDOWN) return '源文超过 80,000 个字符，请导出后拆分文档。';
  let problem = '';
  const visit = (node: unknown) => {
    if (!isRecord(node) || problem) return;
    if (node.type === 'html') problem = 'HTML / JSX 保留为源文；请改用 Markdown 或代码块后查看正文。';
    if (node.type === 'image' || node.type === 'imageReference') problem = '图片保留为源文；本工作台不加载媒体，请改用文字说明或链接。';
    if ((node.type === 'link' || node.type === 'definition') && typeof node.url === 'string' && !safeLink(node.url)) problem = '链接仅支持 https、http、mailto 或页内锚点，请修改地址。';
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  try { visit(fromMarkdown(markdown)); } catch { return '源文暂不能解析，请继续在源文模式中修正。'; }
  return problem;
}

export function validateDocument(value: unknown): ReviewDocument {
  const document = restoreDocument(value), problem = markdownProblem(document.markdown);
  if (problem) throw new Error(problem);
  return document;
}

export function decodeImport(text: string, kind: 'markdown' | 'project', fallbackTitle = '导入文档'): { title: string; data: ReviewDocument; extra: Record<string, unknown> } {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_FILE_BYTES) throw new Error('导入文件不能超过 1.1 MB。');
  if (kind === 'markdown') {
    const markdown = boundedText(text, MAX_MARKDOWN);
    return { title: titleValue(fallbackTitle.slice(0, 120)), data: restoreDocument({ version: 1, markdown, baseline: markdown, baselineLabel: '导入时的版本', notes: [] }), extra: {} };
  }
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('JSON 尚未完整，请修正后重新导入。'); }
  if (!isRecord(value) || value.format !== 'mdxeditor-review' || value.version !== 1 || !isRecord(value.drafts)) throw new Error('请选择本工作台导出的审阅项目 JSON。');
  return { title: titleValue(value.title), data: restoreDocument(value.document), extra: { noteInput: boundedText(value.drafts.noteInput, 3000), importText: boundedText(value.drafts.importText, 100000), importKind: value.drafts.importKind === 'project' ? 'project' : 'markdown' } };
}

export function projectExport(title: string, document: ReviewDocument, extra: Record<string, unknown>): ReviewExport {
  const read = (key: string, max: number) => typeof extra[key] === 'string' ? boundedText(extra[key], max) : '';
  return { format: 'mdxeditor-review', version: 1, title: title.trim() || '未命名文档', document: restoreDocument(document), drafts: { noteInput: read('noteInput', 3000), importText: read('importText', 100000), importKind: extra.importKind === 'project' ? 'project' : 'markdown' } };
}

export const exampleDocument: ReviewDocument = {
  version: 1,
  markdown: '# 从第一份文档开始\n\n把分散的想法整理成一份清楚、可交接的说明。每一轮修改，都值得留下上下文。\n\n## 01  建立共同起点\n\n在开始审阅之前，先确认**文档的读者**与希望他们完成的任务。用一段简短的说明，交代这次修改的范围。\n\n> 好的文档让读者知道下一步做什么，也让维护者知道为什么这样写。\n\n## 02  完成一轮审阅\n\n- 写出步骤，并补充一个可复用的例子\n- 在「差异」中核对本轮新增与删改\n- 把未解决的问题留在审阅意见中\n\n| 阶段 | 检查重点 | 负责人 |\n| --- | --- | --- |\n| 初稿 | 步骤是否完整 | 文档作者 |\n| 审阅 | 示例是否可复现 | 审阅者 |\n| 发布 | 术语与链接是否一致 | 维护者 |\n\n## 03  留下一个具体例子\n\n```json\n{\n  "title": "快速开始",\n  "status": "review"\n}\n```\n\n确认所有意见后，将当前稿设为下一轮比较基线。\n',
  baseline: '# 从第一份文档开始\n\n把分散的想法整理成一份清楚的说明。\n\n## 01  建立共同起点\n\n先确认文档的读者。\n\n## 02  完成一轮审阅\n\n- 写出步骤\n- 核对修改\n\n确认后发布文档。\n',
  baselineLabel: '第一轮初稿',
  notes: [ { id: 'example-01', text: '示例已经补齐。发布前再确认一次字段命名与产品界面一致。', done: false }, { id: 'example-02', text: '将“核对修改”拆成明确的审阅步骤。', done: true } ],
};
