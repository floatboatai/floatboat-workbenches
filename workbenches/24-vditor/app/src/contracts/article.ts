import { boundedText, isRecord, titleValue } from './project.ts';
export const MARKDOWN_LIMIT = 100000;
export const PROJECT_FILE_LIMIT = 900000;
export type EditorMode = 'ir' | 'wysiwyg' | 'sv';
export interface Article { markdown: string; author: string; summary: string; mode: EditorMode; typeset: 'light' | 'wechat'; }
export function restoreArticle(value: unknown): Article {
  if (!isRecord(value) || !['ir', 'wysiwyg', 'sv'].includes(String(value.mode)) || !['light', 'wechat'].includes(String(value.typeset))) throw new Error('文章格式不正确。');
  return { markdown: boundedText(value.markdown, 200000), author: boundedText(value.author, 80), summary: boundedText(value.summary, 1000), mode: value.mode as EditorMode, typeset: value.typeset as Article['typeset'] };
}
export function validateArticle(value: unknown): Article { const article = restoreArticle(value); boundedText(article.markdown, MARKDOWN_LIMIT); return article; }
export const blankArticle: Article = { markdown: '', author: '', summary: '', mode: 'ir', typeset: 'light' };
export const exampleArticle: Article = {
  markdown: '# 把日常观察，写成一篇好文章\n\n写作的起点，往往不是一个宏大的主题，而是一个值得多看一眼的瞬间。\n\n## 01 从一个具体的场景开始\n\n周六清晨，街角的面包店比平时早亮了一盏灯。老板把新出炉的面包放在窗边，路过的人放慢了脚步。\n\n一个场景能让读者进入故事。**先写你看见的，再写你想到的。** 让细节成为观点的入口。\n\n> 好的文字让人看见，而不只是知道。\n\n## 02 给观察一个清晰的结构\n\n从细节到问题，再从问题到自己的理解。每个段落只承担一个任务。\n\n| 段落 | 要回答的问题 |\n| --- | --- |\n| 开头 | 什么细节让你停下来？ |\n| 展开 | 它为什么值得被记录？ |\n| 结尾 | 读者可以带走什么？ |\n\n## 03 留一点时间，重新读一遍\n\n- [x] 找到文章的核心句\n- [x] 用一个具体场景代替抽象描述\n- [ ] 删掉重复的解释\n- [ ] 大声读一遍，调整句子的节奏\n\n---\n\n不必一次写得完美。先留下真实的观察，再慢慢把它写清楚。\n',
  author: '林间编辑部', summary: '一份写给日常记录者的文章练习：从具体场景出发，为观察找到结构。', mode: 'ir', typeset: 'light',
};
export function encodeProject(title: string, article: Article): string {
  return JSON.stringify({ format: 'vditor-article', version: 1, title: titleValue(title), article: validateArticle(article) }, null, 2);
}
export function decodeProject(text: string): { title: string; article: Article } {
  if (new TextEncoder().encode(text).length > PROJECT_FILE_LIMIT) throw new Error('项目文件不能超过 900 KB。');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('项目 JSON 尚未完整，请检查后重试。'); }
  if (!isRecord(value) || value.format !== 'vditor-article' || value.version !== 1) throw new Error('请选择 Vditor 文章项目文件（版本 1）。');
  return { title: titleValue(value.title), article: validateArticle(value.article) };
}
export function renderingLimited(markdown: string): boolean { return markdown.length > 50000 || markdown.split('\n').some(line => line.length > 4000); }
export function requiresSource(markdown: string): boolean {
  let fence = '';
  const prose: string[] = [];
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1]; else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''; continue; }
    if (!fence && !/^( {4}|\t)/.test(line)) prose.push(line.replace(/`+[^`]*`+/g, ''));
  }
  return /<\/?[a-z][\w:-]*(?:\s[^>]*|\/?)>|!\[|^\s*\$\$/im.test(prose.join('\n'));
}
export function contentNotice(markdown: string): string {
  if (renderingLimited(markdown)) return '长文源码模式：超过 50,000 字符或单行超过 4,000 字符，暂缓预览与 HTML 导出。正文与完整项目仍可保存、导出；缩短后恢复排版。';
  if (requiresSource(markdown)) return '媒体、原始 HTML 与公式保留在源码中；阅读版仅排版正文。';
  if (/^\s*(```|~~~)\s*(mermaid|math|abc|plantuml|echarts|graphviz|flowchart|wavedrom|markmap|mindmap|smiles)/im.test(markdown)) return '图表与公式以代码原文显示。';
  return '';
}
export function safeFilename(title: string): string { return (title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '文章').slice(0, 100); }
