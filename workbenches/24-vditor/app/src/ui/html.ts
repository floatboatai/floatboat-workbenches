// A closed article vocabulary keeps imported/previewed/exported HTML inert.
const allowed = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'S', 'DEL', 'A', 'BLOCKQUOTE', 'PRE', 'CODE', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'HR', 'BR', 'INPUT', 'SUP', 'SUB']);
const dropped = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'VIDEO', 'AUDIO', 'SOURCE', 'LINK', 'META', 'BASE', 'FORM', 'BUTTON', 'TEXTAREA', 'SELECT']);
export function safeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  function walk(root: ParentNode) {
    for (const element of Array.from(root.children)) {
      if (dropped.has(element.tagName)) { element.remove(); continue; }
      if (element.tagName === 'IMG') { element.replaceWith(document.createTextNode(element.getAttribute('alt') || '[图片]')); continue; }
      walk(element);
      if (!allowed.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
      const href = element.getAttribute('href'), checked = element.hasAttribute('checked');
      for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
      if (element.tagName === 'A' && href && /^(https?:\/\/|mailto:|#[\w-])/i.test(href)) { element.setAttribute('href', href); element.setAttribute('rel', 'noopener noreferrer'); }
      if (element.tagName === 'INPUT') { element.setAttribute('type', 'checkbox'); element.setAttribute('disabled', ''); if (checked) element.setAttribute('checked', ''); }
    }
  }
  walk(template.content);
  return template.innerHTML;
}
export function escapeHtml(text: string) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function htmlDocument(title: string, author: string, summary: string, html: string, typeset: string): string {
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{max-width:760px;margin:48px auto;padding:0 24px;color:#26352f;font-family:${typeset === 'wechat' ? 'system-ui,sans-serif' : 'Georgia,serif'};font-size:17px;line-height:1.9}h1,h2,h3{line-height:1.4}h1{font-size:2em}h2{margin-top:2em;border-bottom:1px solid #d8dfdb;padding-bottom:.4em}blockquote{margin:24px 0;padding:8px 24px;border-left:3px solid #588271;background:#f2f6f3}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d8dfdb;padding:8px 12px;text-align:left}pre{overflow:auto;padding:16px;background:#f2f6f3}code{font-family:monospace}a{color:#306b56}.byline,.summary{color:#647369}hr{border:0;border-top:1px solid #d8dfdb;margin:32px 0}@media print{body{margin:0;max-width:none}}</style></head><body><header><p class="byline">${escapeHtml(author)}</p>${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ''}</header><main>${safeHtml(html)}</main></body></html>`;
}
