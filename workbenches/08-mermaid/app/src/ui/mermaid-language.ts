// ABOUTME: CodeMirror 的 Mermaid 语法高亮（流式分词）、配色与关键字补全。
import {
  HighlightStyle,
  StreamLanguage,
  type StringStream,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Completion } from "@codemirror/autocomplete";

export const DIAGRAM_KEYWORDS = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "classDiagram-v2",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "pie",
  "mindmap",
  "timeline",
  "quadrantChart",
  "journey",
  "gitGraph",
  "requirementDiagram",
  "architecture-beta",
  "architecture",
  "xychart-beta",
  "xychart",
  "sankey-beta",
  "sankey",
  "block-beta",
  "block",
  "packet-beta",
  "packet",
  "kanban",
  "radar-beta",
  "treemap-beta",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
  "zenuml",
];
const HEADERS = new Set(DIAGRAM_KEYWORDS.map((k) => k.toLowerCase()));

export const STATEMENT_KEYWORDS = [
  "subgraph",
  "end",
  "direction",
  "participant",
  "actor",
  "as",
  "activate",
  "deactivate",
  "autonumber",
  "loop",
  "alt",
  "else",
  "opt",
  "par",
  "and",
  "critical",
  "break",
  "rect",
  "box",
  "note",
  "over",
  "left",
  "right",
  "of",
  "class",
  "classDef",
  "style",
  "linkStyle",
  "click",
  "href",
  "call",
  "callback",
  "state",
  "section",
  "title",
  "dateFormat",
  "axisFormat",
  "tickInterval",
  "excludes",
  "includes",
  "todayMarker",
  "weekday",
  "accTitle",
  "accDescr",
  "commit",
  "branch",
  "checkout",
  "merge",
  "cherry-pick",
  "tag",
  "id",
  "type",
  "x-axis",
  "y-axis",
  "quadrant-1",
  "quadrant-2",
  "quadrant-3",
  "quadrant-4",
  "bar",
  "line",
  "group",
  "service",
  "junction",
  "in",
  "requirement",
  "functionalRequirement",
  "performanceRequirement",
  "interfaceRequirement",
  "physicalRequirement",
  "designConstraint",
  "element",
  "satisfies",
  "traces",
  "contains",
  "copies",
  "derives",
  "verifies",
  "refines",
  "showData",
  "namespace",
  "columns",
  "space",
  "done",
  "active",
  "crit",
  "milestone",
  "after",
  "until",
];
const KEYWORDS = new Set(STATEMENT_KEYWORDS);
const ATOMS = new Set([
  "TB",
  "TD",
  "BT",
  "RL",
  "LR",
  "true",
  "false",
  "PK",
  "FK",
  "UK",
  "high",
  "medium",
  "low",
  "test",
  "analysis",
  "inspection",
  "demonstration",
]);

interface State {
  front: 0 | 1 | 2; // 0 未检查，1 frontmatter 内，2 已结束
  header: boolean;
  directive: boolean;
  closer: string;
}

const CLOSERS: Record<string, string> = { "[": "]", "(": ")", "{": "}" };

function token(stream: StringStream, state: State): string | null {
  if (stream.sol() && state.front === 0) {
    if (stream.match(/^\s*---\s*$/)) {
      state.front = 1;
      return "meta";
    }
    if (!stream.match(/^\s*$/, false)) state.front = 2;
  }
  if (state.front === 1) {
    if (stream.sol() && stream.match(/^\s*---\s*$/)) {
      state.front = 2;
      return "meta";
    }
    if (stream.match(/^\s*[\w-]+(?=\s*:)/)) return "propertyName";
    stream.skipToEnd();
    return "string";
  }
  if (state.directive) {
    if (stream.skipTo("}%%")) {
      stream.match("}%%");
      state.directive = false;
    } else stream.skipToEnd();
    return "meta";
  }
  if (state.closer) {
    const closer = state.closer;
    state.closer = "";
    const end = stream.string.indexOf(closer, stream.pos);
    if (end > stream.pos) {
      stream.pos = end;
      return "string";
    }
  }
  if (stream.eatSpace()) return null;
  if (stream.match("%%{")) {
    state.directive = true;
    return "meta";
  }
  if (stream.match("%%")) {
    stream.skipToEnd();
    return "comment";
  }
  if (!state.header) {
    const word = stream.match(/^[\w-]+/);
    if (word && typeof word === "object") {
      state.header = true;
      return HEADERS.has(word[0].toLowerCase()) ? "typeName" : "invalid";
    }
  }
  if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
  if (stream.match(/^`[^`]*`?/)) return "string";
  if (stream.match(/^\|[^|\n]*\|/)) return "labelName";
  if (stream.match("@{")) {
    if (stream.skipTo("}")) stream.next();
    else stream.skipToEnd();
    return "attributeName";
  }
  if (stream.match(/^:::[\w-]+/)) return "className";
  if (
    stream.match(
      /^(?:<\|?|[|}{o*x]{1,2}|<<)?(?:-{2,}|={2,}|-\.+-|-{1,2}>{1,2}|-[x)]|--[x)])[-=.]*(?:\|>|>>|>|[|}{o*x]{1,2})?/,
    )
  )
    return "operator";
  const open = stream.match(
    /^(?:\[\[|\[\(|\(\[|\(\(\(|\(\(|\{\{|\[\/|\[\\|\[|\(|\{)/,
  );
  if (open && typeof open === "object") {
    const opener = open[0];
    const closer = opener.startsWith("[")
      ? "]"
      : (CLOSERS[opener[opener.length - 1]] ?? "]");
    if (stream.string.indexOf(closer, stream.pos) > stream.pos)
      state.closer = closer;
    return "bracket";
  }
  if (stream.match(/^[\])}]+/)) return "bracket";
  if (stream.match(/^-?\d+(?:\.\d+)?%?/)) return "number";
  const word = stream.match(/^[\p{L}\p{N}_][\p{L}\p{N}_.-]*/u);
  if (word && typeof word === "object") {
    if (KEYWORDS.has(word[0])) return "keyword";
    if (ATOMS.has(word[0])) return "atom";
    return "variableName";
  }
  if (stream.match(/^[:;,]/)) return "punctuation";
  stream.next();
  return null;
}

export const mermaidLanguage = StreamLanguage.define<State>({
  name: "mermaid",
  startState: () => ({ front: 0, header: false, directive: false, closer: "" }),
  copyState: (state) => ({ ...state }),
  token,
  languageData: {
    commentTokens: { line: "%%" },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
  },
});

export const mermaidCompletions: Completion[] = [
  ...DIAGRAM_KEYWORDS.map((label) => ({
    label,
    type: "type",
    detail: "图类型",
  })),
  ...STATEMENT_KEYWORDS.map((label) => ({ label, type: "keyword" })),
];

export const mermaidHighlight = HighlightStyle.define([
  { tag: t.typeName, color: "#f2b866", fontWeight: "700" },
  { tag: t.keyword, color: "#8fb4ff" },
  { tag: t.atom, color: "#d39bff" },
  { tag: t.operator, color: "#ff9f80" },
  { tag: t.string, color: "#a8d8a0" },
  { tag: t.labelName, color: "#e3cf8a" },
  { tag: t.comment, color: "#74808f", fontStyle: "italic" },
  { tag: t.meta, color: "#c792ea" },
  { tag: t.propertyName, color: "#7fd1e6" },
  { tag: t.attributeName, color: "#7fd1e6" },
  { tag: t.number, color: "#f78c6c" },
  { tag: t.className, color: "#ffcb6b" },
  { tag: t.bracket, color: "#9aa7b6" },
  { tag: t.variableName, color: "#e6edf5" },
  { tag: t.invalid, color: "#ff8a8a", textDecoration: "underline wavy" },
]);
