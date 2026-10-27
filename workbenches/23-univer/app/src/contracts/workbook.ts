import type { IWorkbookData, ICellData } from "@univerjs/presets";
import { isRecord } from "./project.ts";
export interface SheetModel {
  workbook: IWorkbookData;
}
export interface CellDraft {
  sheetId: string;
  sheetName: string;
  row: number;
  column: number;
  text: string;
}
export const MAX_BYTES = 850000;
export const MAX_IMPORT = 850000;
const bytes = (x: unknown) =>
  new TextEncoder().encode(JSON.stringify(x)).length;
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const id = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(x);
function inspect(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error("工作簿结构过深。");
  if (value === null || value === undefined || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string" && value.length <= 100000) return;
  if (Array.isArray(value)) {
    if (value.length > 20000) throw new Error("列表过长。");
    value.forEach((x) => inspect(x, depth + 1));
    return;
  }
  if (!isRecord(value)) throw new Error("工作簿包含无效值。");
  for (const [k, v] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(k))
      throw new Error("工作簿包含不支持的字段。");
    if (
      ["backgroundImage", "drawings", "customRanges"].includes(k) &&
      v &&
      Object.keys(v).length
    )
      throw new Error("此工作台不导入图片、链接或外部资源，请先移除后再导入。");
    inspect(v, depth + 1);
  }
}
function decode(value: unknown, draft = false): SheetModel {
  if (!isRecord(value) || !isRecord(value.workbook))
    throw new Error("请选择 Univer 原生工作簿 JSON。");
  if (bytes(value) > (draft ? 1800000 : MAX_BYTES))
    throw new Error("工作簿超过 850 KB，请减少数据。");
  inspect(value);
  const w = value.workbook;
  if (
    !id(w.id) ||
    typeof w.name !== "string" ||
    w.name.length > 120 ||
    typeof w.appVersion !== "string" ||
    typeof w.locale !== "string" ||
    !isRecord(w.styles) ||
    !isRecord(w.sheets) ||
    !Array.isArray(w.sheetOrder) ||
    w.sheetOrder.length < 1 ||
    w.sheetOrder.length > (draft ? 32 : 8) ||
    new Set(w.sheetOrder).size !== w.sheetOrder.length
  )
    throw new Error("工作簿标识、样式或工作表列表无效（最多 8 张表）。");
  if (Object.keys(w.sheets).length !== w.sheetOrder.length)
    throw new Error("工作表顺序与数据不一致。");
  for (const style of Object.values(w.styles))
    if (style !== null && !isRecord(style)) throw new Error("样式数据无效。");
  let count = 0,
    visible = 0;
  for (const sid of w.sheetOrder) {
    if (!id(sid) || !isRecord(w.sheets[sid]))
      throw new Error("工作表标识无效。");
    const s = w.sheets[sid];
    if (
      s.id !== sid ||
      typeof s.name !== "string" ||
      !s.name.trim() ||
      s.name.length > 100 ||
      !integer(s.rowCount, 1, draft ? 10000 : 2000) ||
      !integer(s.columnCount, 1, draft ? 1000 : 200) ||
      !isRecord(s.cellData)
    )
      throw new Error("工作表最多 2000 行、200 列，且必须有名称和单元格数据。");
    if (s.hidden !== undefined && !integer(s.hidden, 0, 2))
      throw new Error("工作表可见状态无效。");
    for (const field of ["rowData", "columnData"])
      if (s[field] !== undefined && !isRecord(s[field]))
        throw new Error("行列尺寸数据无效。");
    for (const field of ["defaultRowHeight", "defaultColumnWidth", "zoomRatio"])
      if (
        s[field] !== undefined &&
        (typeof s[field] !== "number" || s[field] <= 0 || s[field] > 2000)
      )
        throw new Error("工作表尺寸无效。");
    if (
      s.mergeData !== undefined &&
      (!Array.isArray(s.mergeData) ||
        s.mergeData.some(
          (m) =>
            !isRecord(m) ||
            !integer(m.startRow, 0, (s.rowCount as number) - 1) ||
            !integer(
              m.endRow,
              m.startRow as number,
              (s.rowCount as number) - 1,
            ) ||
            !integer(m.startColumn, 0, (s.columnCount as number) - 1) ||
            !integer(
              m.endColumn,
              m.startColumn as number,
              (s.columnCount as number) - 1,
            ),
        ))
    )
      throw new Error("合并单元格范围无效。");
    if (!s.hidden) visible++;
    for (const [r, row] of Object.entries(s.cellData)) {
      if (
        !/^\d+$/.test(r) ||
        !integer(Number(r), 0, s.rowCount - 1) ||
        !isRecord(row)
      )
        throw new Error("单元格行索引无效。");
      for (const [c, cell] of Object.entries(row)) {
        if (!/^\d+$/.test(c) || !integer(Number(c), 0, s.columnCount - 1))
          throw new Error("单元格列索引无效。");
        if (cell === null) continue;
        if (!isRecord(cell) || ++count > (draft ? 100000 : 20000))
          throw new Error("单元格无效或超过 20000 个。");
        if (
          cell.v !== undefined &&
          cell.v !== null &&
          !["string", "number", "boolean"].includes(typeof cell.v)
        )
          throw new Error("单元格值必须为文本、数字或布尔值。");
        if (
          cell.f !== undefined &&
          cell.f !== null &&
          (typeof cell.f !== "string" ||
            cell.f.length > 2000 ||
            (cell.f !== "" && !cell.f.startsWith("=")))
        )
          throw new Error("公式需要以 = 开头，且不超过 2000 字符。");
        if (
          cell.p !== undefined &&
          cell.p !== null &&
          (!isRecord(cell.p) ||
            !isRecord(cell.p.body) ||
            typeof cell.p.body.dataStream !== "string")
        )
          throw new Error("富文本单元格无效。");
        if (cell.t !== undefined && cell.t !== null && !integer(cell.t, 1, 4))
          throw new Error("单元格类型无效。");
      }
    }
  }
  if (!visible) throw new Error("至少保留一张可见工作表。");
  if (
    w.resources !== undefined &&
    (!Array.isArray(w.resources) ||
      w.resources.some(
        (r) =>
          !isRecord(r) ||
          typeof r.name !== "string" ||
          typeof r.data !== "string" ||
          r.data.length > 100000,
      ))
  )
    throw new Error("扩展资源无效。");
  if (Array.isArray(w.resources))
    for (const resource of w.resources) {
      const r = resource as { name: string; data: string };
      if (
        ![
          "SHEET_RANGE_PROTECTION_PLUGIN",
          "SHEET_AuthzIoMockService_PLUGIN",
          "SHEET_WORKSHEET_PROTECTION_PLUGIN",
          "SHEET_WORKSHEET_PROTECTION_POINT_PLUGIN",
          "SHEET_DEFINED_NAME_PLUGIN",
          "SHEET_RANGE_THEME_MODEL_PLUGIN",
        ].includes(r.name)
      )
        throw new Error("此工作簿包含不支持的扩展资源。");
      if (r.data) {
        let data: unknown;
        try {
          data = JSON.parse(r.data);
        } catch {
          throw new Error("扩展资源 JSON 无效。");
        }
        if (!isRecord(data) && !Array.isArray(data))
          throw new Error("扩展资源结构无效。");
        inspect(data);
      }
    }
  return { workbook: structuredClone(w) as unknown as IWorkbookData };
}
export const validate = (value: unknown): SheetModel => decode(value);
export const restoreDraftData = (value: unknown): SheetModel =>
  decode(value, true);
export function decodeCellDraft(raw: unknown): CellDraft | null {
  if (
    !isRecord(raw) ||
    !id(raw.sheetId) ||
    typeof raw.sheetName !== "string" ||
    !integer(raw.row, 0, 1999) ||
    !integer(raw.column, 0, 199) ||
    typeof raw.text !== "string" ||
    raw.text.length > 20000
  )
    return null;
  return {
    sheetId: raw.sheetId,
    sheetName: raw.sheetName,
    row: raw.row,
    column: raw.column,
    text: raw.text,
  };
}
export function columnName(index: number): string {
  let n = index + 1,
    s = "";
  while (n) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
export function inputCell(text: string): ICellData {
  if (text.startsWith("'")) return { v: text.slice(1), t: 1 };
  if (text.startsWith("=")) return { f: text };
  if (
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) &&
    Number.isFinite(Number(text))
  )
    return { v: Number(text), t: 2 };
  return { v: text, t: 1 };
}
export function parseCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).length > MAX_IMPORT)
    throw new Error("CSV 超过 850 KB。");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > 200) throw new Error("CSV 最多 200 列。");
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > 2000) throw new Error("CSV 最多 2000 行。");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("CSV 引号格式无效。");
      cell += c;
    }
  }
  if (quoted) throw new Error("CSV 引号尚未闭合。");
  if (cell !== "" || row.length || closed) pushRow();
  if (!rows.length) throw new Error("CSV 没有数据。");
  if (rows.reduce((n, r) => n + r.length, 0) > 20000)
    throw new Error("CSV 最多 20000 个单元格。");
  return rows;
}
export function fromCsv(text: string, name: string): SheetModel {
  const rows = parseCsv(text),
    cellData: Record<number, Record<number, ICellData>> = {};
  rows.forEach((row, r) => {
    cellData[r] = {};
    row.forEach((v, c) => {
      cellData[r][c] = v.startsWith("=")
        ? { v, t: 1 }
        : inputCell(v.startsWith("'") ? "'" + v : v);
    });
  });
  return validate({
    workbook: {
      id: crypto.randomUUID(),
      name,
      appVersion: "1.2.0",
      locale: "zhCN",
      styles: {},
      sheetOrder: ["sheet1"],
      sheets: {
        sheet1: {
          id: "sheet1",
          name: "导入数据",
          rowCount: Math.max(100, rows.length),
          columnCount: Math.max(20, ...rows.map((r) => r.length)),
          cellData,
        },
      },
    },
  });
}
export function toCsv(workbook: IWorkbookData, sheetId: string): string {
  const s = workbook.sheets[sheetId];
  if (!s) throw new Error("当前工作表不存在。");
  let maxR = -1,
    maxC = -1;
  for (const [r, row] of Object.entries(s.cellData ?? {}))
    for (const [c, v] of Object.entries(row ?? {}) as [
      string,
      ICellData | null,
    ][]) {
      if (v && ((v.v !== undefined && v.v !== null) || v.f || v.p)) {
        maxR = Math.max(maxR, +r);
        maxC = Math.max(maxC, +c);
      }
    }
  const rows: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const values: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const cell = s.cellData?.[r]?.[c];
      let v = cell?.v ?? cell?.p?.body?.dataStream?.replace(/\r\n$/, "") ?? "";
      // CSV exports calculated values; dangerous literal text receives a spreadsheet-safe apostrophe.
      if (typeof v === "string" && /^[=+\-@\t\r]/.test(v)) v = "'" + v;
      values.push('"' + String(v).replace(/"/g, '""') + '"');
    }
    rows.push(values.join(","));
  }
  return "\uFEFF" + rows.join("\r\n");
}
export { seed } from "./seed.ts";
