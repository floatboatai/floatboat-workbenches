// ABOUTME: 文件进出格式：完整 JSON 备份、HTML 独立文档外壳、安全文件名，以及按扩展名识别导入文件。
import { isRecord } from "./project.ts";
import { validateWriting, type WritingProject } from "./domain.ts";

export const BACKUP_FORMAT = "floatboat-writing";
export const BACKUP_VERSION = 1;
/** 导入文件上限：含内嵌图片的 JSON/Markdown 通常在数 MB 内，真正的容量由 validateWriting 判定。 */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export interface WritingBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  title: string;
  exportedAt: string;
  content: WritingProject["content"];
}

export function backupJson(title: string, data: WritingProject, now = new Date()): string {
  const backup: WritingBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    title,
    exportedAt: now.toISOString(),
    content: validateWriting(data).content,
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * 接受：本应用的完整备份、0.3.0 的 {content} 导出、裸 doc，以及「导出恢复草稿」生成的工作副本文件。
 * 返回的标题为 null 时由调用方用文件名代替。
 */
export function parseJsonImport(value: unknown): { title: string | null; data: WritingProject } {
  if (!isRecord(value)) throw new Error("JSON 文件不是文稿对象。");
  const title = (candidate: unknown) =>
    typeof candidate === "string" && candidate.trim() ? candidate.trim().slice(0, 120) : null;
  if (value.format === BACKUP_FORMAT) {
    if (value.version !== BACKUP_VERSION) throw new Error("该备份来自更新的写作台版本，暂时无法导入。");
    return { title: title(value.title), data: validateWriting({ content: value.content }) };
  }
  if (isRecord(value.snapshot) && isRecord(value.snapshot.data))
    return { title: title(value.snapshot.title), data: validateWriting(value.snapshot.data) };
  if (value.type === "doc") return { title: null, data: validateWriting({ content: value }) };
  if (isRecord(value.content)) return { title: title(value.title), data: validateWriting(value) };
  throw new Error("JSON 文件中没有可识别的文稿内容。");
}

export type ImportKind = "markdown" | "json";

export function importKind(name: string, type = ""): ImportKind | null {
  if (/\.json$/i.test(name) || type === "application/json") return "json";
  if (/\.(md|markdown|mdown|mkd|txt)$/i.test(name) || /^text\/(markdown|plain|x-markdown)/.test(type))
    return "markdown";
  return null;
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return (base || "导入的文稿").slice(0, 120);
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** 去除路径分隔符、控制字符与 Windows 保留名，保留中文。 */
export function safeFileName(title: string, extension: string): string {
  let base = title
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80)
    .trim();
  if (!base || RESERVED.test(base)) base = base ? `${base}-文稿` : "文稿";
  return `${base}.${extension}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EXPORT_CSS = `
:root{color-scheme:light;--ink:#2b3134;--muted:#6b7478;--line:#dfe3e1;--accent:#3f6a63}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:17px/1.85 Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif}
article{max-width:760px;margin:56px auto;padding:0 24px}
h1,h2,h3{font-family:Georgia,"Songti SC",serif;line-height:1.35;font-weight:600;margin:1.6em 0 .6em}
article>h1:first-child{font-size:38px;margin-top:0}
h1{font-size:30px}h2{font-size:25px}h3{font-size:21px}
p{margin:0 0 1.05em}
a{color:var(--accent);text-underline-offset:3px}
blockquote{border-left:3px solid #8aa79e;margin:1.4em 0;padding-left:20px;color:#5f6f68}
ul,ol{padding-left:1.6em}
li>p{margin:0}
ul[data-type=taskList]{list-style:none;padding-left:.2em}
ul[data-type=taskList] li{display:flex;gap:.6em;align-items:flex-start}
ul[data-type=taskList] li>label{flex:none;margin-top:.15em}
ul[data-type=taskList] li[data-checked=true]>div{color:var(--muted);text-decoration:line-through}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;background:#f1f3f2;padding:.1em .3em;border-radius:3px}
pre{background:#f4f6f5;padding:16px 18px;border-radius:6px;white-space:pre-wrap;line-height:1.6;font-size:14px}
pre code{background:none;padding:0}
mark{background:#fbeaa0;color:inherit;padding:0 .1em}
hr{border:0;border-top:1px solid var(--line);margin:2em 0}
img{max-width:100%;height:auto;display:block;margin:1.2em auto;border-radius:4px}
table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:15px;table-layout:auto}
th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;vertical-align:top}
th{background:#f3f5f4;font-weight:600}
td>p,th>p{margin:0}
footer{margin-top:3em;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
@media print{article{margin:0 auto}a{color:inherit}}
`;

/** 生成独立 HTML：标题来自文稿，样式内联，无脚本、无外部字体或图片。body 必须由 generateHTML 从校验过的 JSON 生成。 */
export function htmlDocument(title: string, body: string, exportedAt = new Date()): string {
  const safeTitle = escapeHtml(title.trim() || "未命名文稿");
  const date = exportedAt.toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Floatboat 写作台">
<title>${safeTitle}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
<article>
<h1>${safeTitle}</h1>
${body}
<footer>导出于 ${date}</footer>
</article>
</body>
</html>
`;
}
