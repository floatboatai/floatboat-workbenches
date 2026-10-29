// ABOUTME: 节点类型到图标的映射，以及端口类型的简写标记。
import {
  ArrowRightLeft,
  ArrowUpDown,
  Braces,
  CaseSensitive,
  ChartBarBig,
  Combine,
  CopyMinus,
  Download,
  FileCode,
  FileText,
  Group,
  ListFilter,
  Merge,
  Regex,
  Replace,
  Rows3,
  ScrollText,
  Sheet,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { OpKind } from "../contracts/ops";
import type { PortType } from "../contracts/values";

export const opIcons: Record<OpKind, LucideIcon> = {
  textInput: FileText,
  csvInput: Sheet,
  jsonInput: Braces,
  textTransform: CaseSensitive,
  splitLines: Rows3,
  regexExtract: Regex,
  regexReplace: Replace,
  template: FileCode,
  jsonPick: Braces,
  filter: ListFilter,
  mapFields: ArrowRightLeft,
  sort: ArrowUpDown,
  dedupe: CopyMinus,
  group: Group,
  join: Merge,
  concat: Combine,
  textOutput: ScrollText,
  tableOutput: Table2,
  chartOutput: ChartBarBig,
  fileOutput: Download,
};

export const portMarks: Record<PortType, string> = { text: "T", table: "▦", json: "{}" };
