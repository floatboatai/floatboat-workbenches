// ABOUTME: 报告用的安全 Markdown 子集渲染：标题、段落、列表、引用、表格、粗体与行内代码；不解析 HTML。
import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let at = 0,
    k = 0;
  for (const m of text.matchAll(re)) {
    if ((m.index ?? 0) > at) out.push(text.slice(at, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={k++}>{t.slice(2, -2)}</strong> : <code key={k++}>{t.slice(1, -1)}</code>);
    at = (m.index ?? 0) + t.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0,
    k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1];
      blocks.push(<Tag key={k++}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++}>{inline(quote.join(" "))}</blockquote>);
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div className="table-wrap" key={k++}>
          <table>
            <thead>
              <tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</List>);
      continue;
    }
    const para: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++}>{para.map((t, j) => <Fragment key={j}>{j ? <br /> : null}{inline(t)}</Fragment>)}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
