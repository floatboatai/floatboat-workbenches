// ABOUTME: Mermaid 源码的纯文本工具：外部资源检测、Markdown 代码块提取、错误行定位、文件名与 CSS 净化。
// 不依赖浏览器 DOM，服务端校验与 node:test 共用。

export interface ExternalResource {
  line: number;
  url: string;
}

const lineAt = (text: string, index: number) =>
  text.slice(0, index).split("\n").length;

const loadsNetwork = (raw: string) => {
  const url = raw
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!url) return false;
  if (url.startsWith("#")) return false;
  if (/^data:/i.test(url)) return false;
  return true;
};

/**
 * 只检测真正会触发资源加载的写法：节点元数据的 img、样式/主题 CSS 中的 url() 与 @import。
 * 普通文字（例如 `A[Docker image: nginx]`）不受影响。
 */
export function findExternalResources(source: string): ExternalResource[] {
  const text = source.replace(/\r\n?/g, "\n");
  const found: ExternalResource[] = [];
  for (const meta of text.matchAll(/@\{([^}]*)\}/g)) {
    const body = meta[1];
    const img = /(?:^|[\s,{])img\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s,}]+))/.exec(
      body,
    );
    if (!img) continue;
    const url = img[1] ?? img[2] ?? img[3] ?? "";
    if (loadsNetwork(url))
      found.push({ line: lineAt(text, meta.index + 2 + img.index), url });
  }
  const styled: [number, string][] = [];
  const lines = text.split("\n");
  const front = matchFrontMatter(text);
  const frontLines = front
    ? text.slice(0, front.length).split("\n").length - 1
    : 0;
  lines.forEach((content, index) => {
    if (
      index < frontLines ||
      /^\s*(?:classDef|style|linkStyle|cssClass)\b/.test(content)
    )
      styled.push([index + 1, content]);
  });
  for (const directive of text.matchAll(/%%\{[\s\S]*?\}%%/g)) {
    const first = lineAt(text, directive.index);
    directive[0]
      .split("\n")
      .forEach((content, offset) => styled.push([first + offset, content]));
  }
  for (const [line, content] of styled) {
    for (const match of content.matchAll(/url\(\s*([^)]*)\)/gi))
      if (loadsNetwork(match[1])) found.push({ line, url: match[1].trim() });
    const imported = /@import\s+(?:url\()?\s*['"]?([^'";)\s]+)/i.exec(content);
    if (imported) found.push({ line, url: imported[1] });
  }
  return found.sort((a, b) => a.line - b.line);
}

/**
 * 渲染前移除会联网的写法（行数不变，错误行号仍可对应）：去掉节点元数据中的外部 img，
 * 净化样式行、指令与 frontmatter 中的 url()/@import。Mermaid 渲染时会把 SVG 临时插入页面
 * 并预加载图片，所以必须在渲染前处理，而不仅是净化输出。
 */
export function neutralizeExternal(source: string): string {
  if (!findExternalResources(source).length) return source;
  const text = source.replace(/\r\n?/g, "\n");
  let out = text.replace(/@\{([^}]*)\}/g, (_whole, body: string) => {
    const cleaned = body.replace(
      /(^|[\s,{])img\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s,}]+))\s*,?/,
      (match: string, lead: string, a?: string, b?: string, c?: string) =>
        loadsNetwork(a ?? b ?? c ?? "") ? lead : match,
    );
    return "@{" + cleaned + "}";
  });
  const front = matchFrontMatter(out);
  const frontLines = front
    ? out.slice(0, front.length).split("\n").length - 1
    : 0;
  out = out
    .split("\n")
    .map((line, index) =>
      index < frontLines ||
      /^\s*(?:classDef|style|linkStyle|cssClass)\b/.test(line)
        ? sanitizeCssText(line)
        : line,
    )
    .join("\n");
  return out.replace(/%%\{[\s\S]*?\}%%/g, (directive) =>
    sanitizeCssText(directive),
  );
}

/** 去除 CSS 中的外部加载：@import 与非片段/非 data 的 url()。 */
export function sanitizeCssText(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*([^)]*)\)/gi, (whole, inner: string) =>
      loadsNetwork(inner) ? "none" : whole,
    );
}

/** SVG/HTML 属性中允许保留的引用：页面内片段、内嵌位图，以及链接元素上的 http(s)/mailto。 */
export function allowedReference(value: string, element: string): boolean {
  const url = value.trim();
  if (url.startsWith("#")) return true;
  if (/^data:image\/(?:png|jpe?g|gif|webp);/i.test(url)) return true;
  if (element.toLowerCase() === "a" && /^(?:https?:|mailto:)/i.test(url))
    return true;
  return false;
}

export interface MermaidBlock {
  source: string;
  title: string;
  line: number;
}

/** 从 Markdown 中提取 ```mermaid / ~~~mermaid / :::mermaid 代码块，标题取最近的上级标题。 */
export function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const lines = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: MermaidBlock[] = [];
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const head = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (head) {
      heading = head[1].trim();
      continue;
    }
    const fence = /^( {0,3})(`{3,}|~{3,})\s*mermaid\b.*$/i.exec(line);
    const colon = /^ {0,3}:::\s*mermaid\s*$/i.exec(line);
    if (fence) {
      const indent = fence[1].length,
        marker = fence[2];
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const close = new RegExp(
          "^ {0,3}" +
            (marker[0] === "`" ? "`" : "~") +
            "{" +
            marker.length +
            ",}\\s*$",
        );
        if (close.test(lines[j])) break;
        body.push(lines[j].replace(new RegExp("^ {0," + indent + "}"), ""));
      }
      const source = body.join("\n").trim();
      if (source) blocks.push({ source, title: heading, line: i + 1 });
      i = j;
    } else if (colon) {
      const body: string[] = [];
      let j = i + 1;
      for (; j < lines.length && !/^ {0,3}:::\s*$/.test(lines[j]); j++)
        body.push(lines[j]);
      const source = body.join("\n").trim();
      if (source) blocks.push({ source, title: heading, line: i + 1 });
      i = j;
    }
  }
  return blocks;
}

/** frontmatter 中的 title，用作导入文件的名称。 */
export function frontmatterTitle(source: string): string {
  const text = source.replace(/\r\n?/g, "\n");
  const front = matchFrontMatter(text);
  if (!front) return "";
  const title = /^title\s*:\s*(.+?)\s*$/m.exec(front.body);
  return title
    ? title[1]
        .replace(/^(['"])(.*)\1$/, "$2")
        .trim()
        .slice(0, 120)
    : "";
}

const RESERVED = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i;
/** 生成可在 Windows/macOS/Linux 保存的文件名。 */
export function safeFileName(title: string, extension: string): string {
  let base = title
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (!base || RESERVED.test(base)) base = base ? base + "_" : "diagram";
  const chars = Array.from(base);
  if (chars.length > 80) base = chars.slice(0, 80).join("").trim();
  return base + "." + extension.replace(/^\./, "");
}

// ---- 解析错误定位 ----
// Mermaid 解析前会去掉 frontmatter、%%{}%% 指令和 %% 注释并 trimStart，
// 解析器报告的行号基于清理后的文本。以下逻辑按 Mermaid 12.2.0
// (src/preprocess.ts、src/diagram-api/regexes.ts，MIT) 的同等规则建立清理后行到原始行的映射。

const whitespace = /\s/;
const isLineBreak = (char: string | undefined) =>
  char === "\n" || char === "\r";
const lastLineBreakInWhitespaceRun = (text: string, from: number) => {
  let index = -1;
  for (let i = from; i < text.length && whitespace.test(text[i]); i++)
    if (isLineBreak(text[i])) index = i;
  return index;
};
export function matchFrontMatter(
  text: string,
): { indent: string; body: string; length: number } | undefined {
  let cursor = 0;
  while (
    cursor < text.length &&
    whitespace.test(text[cursor]) &&
    !isLineBreak(text[cursor])
  )
    cursor++;
  const indent = text.slice(0, cursor);
  if (!text.startsWith("---", cursor)) return undefined;
  const openingEnds: number[] = [];
  for (let i = cursor + 3; i < text.length && whitespace.test(text[i]); i++)
    if (isLineBreak(text[i])) openingEnds.push(i);
  if (!openingEnds.length) return undefined;
  const closingFence = indent + "---";
  const closingEnd = (i: number) =>
    isLineBreak(text[i]) && text.startsWith(closingFence, i + 1)
      ? lastLineBreakInWhitespaceRun(text, i + 1 + closingFence.length)
      : -1;
  let lastClosingFence = -1;
  for (let i = openingEnds[0] + 1; i < text.length; i++)
    if (closingEnd(i) !== -1) lastClosingFence = i;
  if (lastClosingFence === -1) return undefined;
  let openingEnd = openingEnds[0];
  for (const candidate of openingEnds)
    if (candidate < lastClosingFence) openingEnd = candidate;
  const bodyStart = openingEnd + 1;
  for (let i = bodyStart; i <= lastClosingFence; i++) {
    const end = closingEnd(i);
    if (end !== -1)
      return { indent, body: text.slice(bodyStart, i), length: end + 1 };
  }
  return undefined;
}

const directiveRegex =
  /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
const commentRegex = /^\s*%%(?!{)[^\n]+\n?/gm;

interface Tracked {
  text: string;
  lines: number[];
}
function removeMatches(value: Tracked, pattern: RegExp): Tracked {
  let text = "";
  const lines: number[] = [];
  let last = 0;
  for (const match of value.text.matchAll(pattern)) {
    text += value.text.slice(last, match.index);
    lines.push(...value.lines.slice(last, match.index));
    last = match.index + match[0].length;
  }
  text += value.text.slice(last);
  lines.push(...value.lines.slice(last));
  return { text, lines };
}

/** 返回数组 map，map[k-1] 为清理后第 k 行对应的原始行号（1 起）。 */
export function cleanedLineMap(source: string): number[] {
  const text = source.replace(/\r\n?/g, "\n");
  const lines: number[] = [];
  let line = 1;
  for (const char of text) {
    for (let u = 0; u < char.length; u++) lines.push(line);
    if (char === "\n") line++;
  }
  let value: Tracked = { text, lines };
  const front = matchFrontMatter(value.text);
  if (front)
    value = {
      text: value.text.slice(front.length),
      lines: value.lines.slice(front.length),
    };
  value = removeMatches(value, directiveRegex);
  value = removeMatches(value, commentRegex);
  const lead = value.text.length - value.text.trimStart().length;
  value = { text: value.text.slice(lead), lines: value.lines.slice(lead) };
  const map: number[] = [];
  let start = 0;
  const total = text.split("\n").length;
  while (start <= value.text.length) {
    map.push(
      value.lines[start] ?? Math.min(total, (value.lines[start - 1] ?? 0) + 1),
    );
    const next = value.text.indexOf("\n", start);
    if (next === -1) break;
    start = next + 1;
  }
  return map;
}

export interface SourceLocation {
  line: number;
  column: number;
  message: string;
}

const cleanMessage = (raw: string) => {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const expecting = lines.find((l) => /^Expecting\b/.test(l));
  const head = lines[0]
    ?.replace(/^Parse error on line \d+:?\s*/i, "")
    .replace(/^Parsing failed:\s*/i, "")
    .trim();
  const text = expecting ?? (head || lines[1] || raw);
  return text.length > 220 ? text.slice(0, 217) + "…" : text;
};

/** 将 mermaid.parse 抛出的错误映射到原始源码的行列。行号无法确定时返回 null 位置。 */
export function locateParseError(
  error: unknown,
  source: string,
): { line: number | null; column: number; message: string } {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "无法解析图形源码。";
  let line: number | null = null,
    column = 1;
  const hash =
    typeof error === "object" && error !== null && "hash" in error
      ? (error as { hash?: unknown }).hash
      : undefined;
  if (typeof hash === "object" && hash !== null) {
    const loc = (hash as { loc?: unknown }).loc;
    if (
      typeof loc === "object" &&
      loc !== null &&
      typeof (loc as { first_line?: unknown }).first_line === "number"
    ) {
      line = (loc as { first_line: number }).first_line;
      const col = (loc as { first_column?: unknown }).first_column;
      column = typeof col === "number" ? col + 1 : 1;
    } else if (typeof (hash as { line?: unknown }).line === "number") {
      line = (hash as { line: number }).line + 1;
    }
  }
  if (line === null) {
    const match = /line[:\s]+(\d+)(?:\D{1,12}column[:\s]+(\d+))?/i.exec(raw);
    if (match) {
      line = Number(match[1]);
      if (match[2]) column = Number(match[2]);
    }
  }
  const message = /No diagram type detected/i.test(raw)
    ? "没有识别到图类型。第一行应为 flowchart、sequenceDiagram、classDiagram 等关键字。"
    : /Diagram .* not found/i.test(raw)
      ? "此 Mermaid 版本不支持该图类型。"
      : cleanMessage(raw);
  if (line === null) {
    if (/No diagram type detected|not found/i.test(raw)) {
      const map = cleanedLineMap(source);
      return { line: map[0] ?? 1, column: 1, message };
    }
    return { line: null, column: 1, message };
  }
  const map = cleanedLineMap(source);
  const total = source.split(/\r\n?|\n/).length;
  const mapped = map[Math.max(0, Math.min(map.length - 1, line - 1))] ?? line;
  return {
    line: Math.max(1, Math.min(total, mapped)),
    column: Math.max(1, column),
    message,
  };
}
