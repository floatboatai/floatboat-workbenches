// ABOUTME: 抽取公共部分：Graphify 风格节点/关系构造、确定性编号与按行定位的源码扫描工具。

export const ENGINE = "floatboat-node-extractor@0.9.0";
export type Confidence = "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
export type NodeKind =
  | "file" | "class" | "function" | "method" | "interface" | "type" | "enum" | "variable"
  | "module" | "section" | "concept" | "rationale";
export type GNode = Record<string, unknown> & {
  id: string;
  label: string;
  kind: NodeKind;
  file_type: string;
  source_file?: string;
  source_location?: string;
};
export type GLink = Record<string, unknown> & {
  source: string;
  target: string;
  relation: string;
  confidence: Confidence;
  confidence_score: number;
  weight: number;
};

export function slug(text: string) {
  const s = text
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9㐀-鿿]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s.slice(0, 120) || "x";
}

export class GraphBuilder {
  nodes = new Map<string, GNode>();
  links = new Map<string, GLink>();
  private used = new Set<string>();

  uniqueId(base: string) {
    let id = base, n = 2;
    while (this.used.has(id) || ["__proto__", "constructor", "prototype"].includes(id)) id = `${base}_${n++}`;
    this.used.add(id);
    return id;
  }
  addNode(base: string, node: Record<string, unknown> & { label: string; kind: NodeKind; file_type: string }): GNode {
    const id = this.uniqueId(base);
    const full: GNode = { id, norm_label: node.label.toLowerCase(), _origin: ENGINE, ...node };
    this.nodes.set(id, full);
    return full;
  }
  /** 同一对节点同一关系只保留一条：首次位置，weight 累计，置信度取最高。 */
  addLink(
    source: string,
    target: string,
    relation: string,
    confidence: Confidence,
    score: number,
    extra: { source_file?: string; line?: number; context?: string } = {},
  ) {
    if (source === target || !this.nodes.has(source) || !this.nodes.has(target)) return null;
    const key = `${source}\u0000${target}\u0000${relation}`;
    const prior = this.links.get(key);
    if (prior) {
      prior.weight += 1;
      if (score > prior.confidence_score) {
        prior.confidence_score = score;
        prior.confidence = confidence;
      }
      return prior;
    }
    const link: GLink = {
      source,
      target,
      relation,
      confidence,
      confidence_score: score,
      weight: 1,
      _origin: ENGINE,
    };
    if (extra.context) link.context = extra.context;
    if (extra.source_file) link.source_file = extra.source_file;
    if (extra.line) link.source_location = `L${extra.line}`;
    this.links.set(key, link);
    return link;
  }
}

/** 按偏移查行号（1 起）。 */
export function lineIndex(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset: number) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

export type Comment = { line: number; text: string };
export type Scanned = {
  /** 去掉注释（保留字符串），偏移与原文一致 */
  noComments: string;
  /** 去掉注释与字符串内容，偏移与原文一致 */
  code: string;
  comments: Comment[];
};

/** 线性扫描：识别字符串与注释，用空格替换以保留偏移和换行。 */
export function scanSource(text: string, style: "c" | "python" | "hash" | "sql"): Scanned {
  const out = text.split("");
  const strip = text.split("");
  const comments: Comment[] = [];
  let line = 1;
  const blank = (arr: string[], from: number, to: number) => {
    for (let k = from; k < to; k++) if (arr[k] !== "\n") arr[k] = " ";
  };
  const lineComment = style === "c" ? "//" : style === "sql" ? "--" : "#";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      line++;
      i++;
      continue;
    }
    if (text.startsWith(lineComment, i) || (style === "c" && ch === "#" && false)) {
      let j = text.indexOf("\n", i);
      if (j < 0) j = text.length;
      comments.push({ line, text: text.slice(i + lineComment.length, j).trim() });
      blank(out, i, j);
      blank(strip, i, j);
      i = j;
      continue;
    }
    if ((style === "c" || style === "sql") && text.startsWith("/*", i)) {
      let j = text.indexOf("*/", i + 2);
      j = j < 0 ? text.length : j + 2;
      const body = text.slice(i + 2, j - 2);
      const startLine = line;
      body.split("\n").forEach((t, k) => {
        const cleaned = t.replace(/^\s*\*?\s?/, "").trim();
        if (cleaned) comments.push({ line: startLine + k, text: cleaned });
      });
      for (let k = i; k < j; k++) if (text[k] === "\n") line++;
      blank(out, i, j);
      blank(strip, i, j);
      i = j;
      continue;
    }
    const triple = style === "python" && (text.startsWith('"""', i) || text.startsWith("'''", i));
    if (triple || ch === '"' || ch === "'" || (style === "c" && ch === "`")) {
      const quote = triple ? text.slice(i, i + 3) : ch;
      let j = i + quote.length;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text.startsWith(quote, j)) break;
        if (!triple && quote !== "`" && text[j] === "\n") break;
        j++;
      }
      const end = Math.min(text.length, j + quote.length);
      for (let k = i; k < end; k++) if (text[k] === "\n") line++;
      blank(strip, i + quote.length, Math.max(i + quote.length, j));
      i = end;
      continue;
    }
    i++;
  }
  return { noComments: out.join(""), code: strip.join(""), comments };
}

/** 以 code（已去字符串）计算花括号配对：开括号偏移 → 闭括号偏移。 */
export function bracePairs(code: string) {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{") stack.push(i);
    else if (c === "}") {
      const open = stack.pop();
      if (open !== undefined) pairs.set(open, i);
    }
  }
  return pairs;
}

export const RATIONALE = /^(NOTE|WHY|HACK|IMPORTANT|TODO|FIXME|XXX|注意|原因)[:：]\s*(.+)/i;

export const COMMON_CALLS = new Set(
  (
    "if for while switch catch return function typeof new super this print len range str int float " +
    "list dict set tuple bool isinstance getattr setattr hasattr super sorted enumerate zip map filter " +
    "min max sum abs any all open format round repr type id iter next object property staticmethod " +
    "classmethod get set append extend insert remove pop items keys values join split strip lower upper " +
    "replace startswith endswith update add copy sort reverse push shift unshift slice splice concat " +
    "indexOf includes find findIndex some every reduce forEach then catch finally resolve reject log " +
    "warn error info debug toString valueOf parse stringify assign entries fromEntries freeze require " +
    "setTimeout clearTimeout setInterval clearInterval fetch json text close read write send emit on off " +
    "trim match test exec has delete clear now call apply bind useState useEffect useMemo useCallback " +
    "useRef render describe it expect assert defer go make new_ String Number Boolean Array Object Promise " +
    "Error Map Set Date Math JSON Symbol RegExp URL console assertEqual assertTrue raises"
  ).split(/\s+/),
);
