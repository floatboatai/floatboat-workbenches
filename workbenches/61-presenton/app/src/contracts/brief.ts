// ABOUTME: 把资料简报（Markdown 或普通文本）解析为章节、段落、列表、表格与引语，并抽取数字、时间等事实；纯函数，浏览器与 Node 共用。

export type Block =
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "quote"; text: string; cite: string };
export type Part = { title: string; blocks: Block[] };
export type Section = { title: string; blocks: Block[]; parts: Part[] };
export type ParsedBrief = { title: string; intro: Block[]; sections: Section[]; chars: number; cjk: boolean };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const CN_HEADING = /^(?:[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十百0-9]+[部分章节篇][\s：:]*)\s*(.{1,40})$/;
const LIST = /^\s*(?:([-*+•·▪●])|(\d{1,3})[.)、]|[（(](\d{1,3})[)）])\s*(.+)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const END_PUNCT = /[。．.!！?？;；:：,，、]$/;

export const isCjk = (text: string) => {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]+/g) || []).length;
  return cjk >= latin;
};

/** Removes inline Markdown emphasis, code ticks, images and keeps link text. */
export function plain(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])[*_]([^*_\s][^*_]*?)[*_](?=[^*\w]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]{1,200}>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => plain(c));

function splitCite(text: string): { text: string; cite: string } {
  const m = text.match(/^(.*?)[\s]*(?:——|—|--|－－)\s*([^—]{1,60})$/);
  if (m && m[1].trim()) return { text: m[1].trim(), cite: m[2].trim() };
  return { text, cite: "" };
}

function joinLines(parts: string[]): string {
  return parts.reduce((acc, line) => {
    if (!acc) return line;
    const glue = /[㐀-鿿，。；：、！？）」]$/.test(acc) || /^[㐀-鿿，。；：、！？（「]/.test(line) ? "" : " ";
    return acc + glue + line;
  }, "");
}

/** Parses Markdown-like text. Plain text without headings uses short standalone lines as section titles. */
export function parseBrief(source: string): ParsedBrief {
  const text = source.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
  const raw = text.split("\n");
  const hasMarkdownHeadings = raw.some((l) => HEADING.test(l) || CN_HEADING.test(l.trim()));
  let title = "";
  const intro: Block[] = [];
  const sections: Section[] = [];
  let section: Section | null = null;
  let part: Part | null = null;
  let para: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;
  let quote: string[] = [];
  const target = (): Block[] => (part ? part.blocks : section ? section.blocks : intro);
  const flushPara = () => {
    if (para.length) target().push({ kind: "para", text: plain(joinLines(para)) });
    para = [];
  };
  const flushList = () => {
    if (list?.items.length) target().push({ kind: "list", items: list.items, ordered: list.ordered });
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) {
      const { text: q, cite } = splitCite(plain(joinLines(quote)));
      target().push({ kind: "quote", text: q.replace(/^[“"「]|[”"」]$/g, ""), cite: cite.replace(/^[—\-\s]+/, "") });
    }
    quote = [];
  };
  const flush = () => {
    flushPara();
    flushList();
    flushQuote();
  };
  const heading = (level: number, value: string) => {
    flush();
    const name = plain(value);
    if (level === 1 && !title && !sections.length) {
      title = name;
      return;
    }
    if (level <= 2 || !section) {
      section = { title: name, blocks: [], parts: [] };
      sections.push(section);
      part = null;
    } else {
      part = { title: name, blocks: [] };
      section.parts.push(part);
    }
  };
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushQuote();
      if (list && !LIST.test(raw[i + 1] ?? "")) flushList();
      continue;
    }
    const h = trimmed.match(HEADING);
    if (h) {
      heading(h[1].length, h[2]);
      continue;
    }
    const cn = trimmed.match(CN_HEADING);
    if (cn && !END_PUNCT.test(trimmed)) {
      heading(2, cn[1]);
      continue;
    }
    if (TABLE_ROW.test(trimmed) && TABLE_SEP.test(raw[i + 1] ?? "")) {
      flush();
      const header = cells(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < raw.length && TABLE_ROW.test(raw[i].trim())) {
        const row = cells(raw[i]);
        rows.push(header.map((_, c) => row[c] ?? ""));
        i++;
      }
      i--;
      if (rows.length) target().push({ kind: "table", header, rows });
      continue;
    }
    if (/^>/.test(trimmed)) {
      flushPara();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    const li = line.match(LIST);
    if (li && !/^\d{1,3}[.)、]\d/.test(trimmed)) {
      flushPara();
      flushQuote();
      const ordered = !li[1];
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { items: [], ordered };
      }
      list.items.push(plain(li[4]));
      continue;
    }
    if (list && /^\s{2,}/.test(line)) {
      list.items[list.items.length - 1] += plain(" " + trimmed);
      continue;
    }
    flushList();
    flushQuote();
    if (
      !hasMarkdownHeadings &&
      !para.length &&
      trimmed.length <= 28 &&
      !END_PUNCT.test(trimmed) &&
      raw.slice(i + 1).some((l) => l.trim()) &&
      (i === 0 || !raw[i - 1].trim())
    ) {
      heading(title || i > 0 ? 2 : 1, trimmed);
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return { title, intro, sections, chars: text.length, cjk: isCjk(text) };
}

const NUMBER =
  /[-+]?\d[\d,]*(?:\.\d+)?\s*(?:个百分点|百分点|%|％|‰|℃|°C|万元|亿元|千元|元|万人|万户|万|亿|千米|公里|km|平方米|㎡|米|株|人次|人|次|天|小时|分钟|倍|个|项|处|场|户|家|所|条|名|座|台|吨|kg|小时|月|年|周)?/g;

export const numbersIn = (text: string) => text.match(NUMBER)?.map((n) => n.replace(/\s+/g, "")) ?? [];
export const parseNumber = (text: string) => {
  const m = text.replace(/,/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/** Splits a line that leads with a time marker ("2027 年 3 月：…", "Q2: …", "第一阶段 …"). */
export function timeMarker(text: string): { label: string; rest: string } | null {
  const m = text.match(
    /^((?:\d{4}\s*年(?:\s*\d{1,2}\s*月)?(?:\s*\d{1,2}\s*日)?|\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?|\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?|Q[1-4](?:\s*\d{4})?|\d{4}\s*Q[1-4]|第\s*[一二三四五六七八九十\d]+\s*(?:阶段|周|月|季度|期|步|年)|(?:Phase|Week|Step|Stage)\s*\d+|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{0,4}))\s*[：:，,、\-–—]?\s*(.*)$/i,
  );
  if (!m || !m[2].trim()) return null;
  return { label: m[1].replace(/\s+/g, " ").trim(), rest: m[2].trim() };
}

/** Picks the headline number of a line and the remaining description ("满意度从 52% 提升到 81%" → 81% / 满意度（原 52%）). */
export function extractStat(text: string): { value: string; label: string } | null {
  const t = plain(text).replace(/[。．.;；]+$/, "");
  const num = "([-+]?\\d[\\d,]*(?:\\.\\d+)?\\s*(?:个百分点|百分点|%|％|℃|°C|万元|亿元|元|万|亿|倍|pts)?)";
  const from = t.match(new RegExp(`^(.*?)从\\s*${num}\\s*(?:提升|增加|增长|下降|降低|减少|提高|上升)?(?:到|至)\\s*${num}(.*)$`));
  if (from) return { value: from[3].trim(), label: `${(from[1] + from[4]).trim()}（原 ${from[2].trim()}）` };
  const en = t.match(new RegExp(`^(.*?)from\\s*${num}\\s*to\\s*${num}(.*)$`, "i"));
  if (en) return { value: en[3].trim(), label: `${(en[1] + en[4]).trim()} (from ${en[2].trim()})` };
  NUMBER.lastIndex = 0;
  const m = NUMBER.exec(t);
  NUMBER.lastIndex = 0;
  if (!m || !/\d/.test(m[0])) return null;
  const value = m[0].trim();
  const label = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length))
    .replace(/\s{2,}/g, " ")
    .replace(/\s*(?:提升|下降|增加|减少|增长|降低|提高)?(?:到|至|达到|达|为)\s*$/, "")
    .replace(/^[\s:：,，、]+|[\s:：,，、]+$/g, "")
    .trim();
  return { value, label: label || t };
}

export function blockText(b: Block): string[] {
  if (b.kind === "para") return [b.text];
  if (b.kind === "list") return b.items;
  if (b.kind === "quote") return [b.text + (b.cite ? ` ——${b.cite}` : "")];
  return [b.header.join(" / "), ...b.rows.map((r) => r.join(" / "))];
}
export function sectionText(s: { blocks: Block[]; parts?: Part[] }): string {
  return [...s.blocks.flatMap(blockText), ...(s.parts ?? []).flatMap((p) => [p.title, ...p.blocks.flatMap(blockText)])]
    .filter(Boolean)
    .join("\n");
}

/** Sentence split that keeps numbers like 4.1 together. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])\s*|(?<=\.)\s+(?=[A-Z㐀-鿿])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const LEAD_IN = /(显示|表明|发现|指出|认为|来看|看到|据统计|据调查|调查|数据显示|结果)[，,：:]?$/;
/** Shortens a statement to a slide point: whole clauses first, dropping a lead-in ("测量显示，"), never cutting inside a number. */
export function condense(text: string, max: number): string {
  const t = plain(text).replace(/[。．.;；]+$/, "");
  if (t.length <= max) return t;
  const clauses = t.split(/(?<=[，；;：:])|(?<=(?<!\d),)|(?<=,(?!\d))/).filter((c) => c.trim());
  if (clauses.length > 1 && LEAD_IN.test(clauses[0].trim())) clauses.shift();
  let out = "";
  for (const c of clauses) {
    if ((out + c).length <= max * 1.2 || !out) out += c;
    else break;
  }
  out = out.trim().replace(/[，；;：:,]+$/, "");
  if (out.length <= max * 1.2) return out;
  if (!isCjk(out)) {
    const space = out.lastIndexOf(" ", max);
    if (space > max * 0.5) return out.slice(0, space).replace(/[,;:]+$/, "") + "…";
  }
  let cut = max;
  if (/[\d.,%]/.test(out[cut] ?? "") && /[\d.,]/.test(out[cut - 1] ?? "")) {
    let end = cut;
    while (/[\d.,%]/.test(out[end] ?? "")) end++;
    if (end <= max * 1.3) cut = end;
    else while (cut > max * 0.6 && /[\d.,%]/.test(out[cut] ?? "") && /[\d.,]/.test(out[cut - 1] ?? "")) cut--;
  }
  return out.slice(0, cut).trim() + "…";
}
