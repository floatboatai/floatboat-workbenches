/** Same request budget as the server's RAW_BANK_BYTES (2 MB request cap). */
export const BANK_FILE_BYTES = 1_500_000;
/** Raw bank text above this size is checked but not kept in the autosaved draft. */
export const BANK_DRAFT_LIMIT = 400_000;

/**
 * Read a question-bank file like DeepTutor's importer: UTF-8 (BOM allowed),
 * falling back to GB18030 for spreadsheets exported by Chinese Excel/WPS.
 */
export async function decodeBankFile(file: File) {
  const format = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (format === "xlsx" || format === "xls")
    throw new Error("XLSX题库请在表格软件中另存为CSV（UTF-8）后导入。");
  if (!["json", "csv", "tsv", "txt"].includes(format))
    throw new Error("请选择JSON、CSV或TSV题库文件。");
  if (!file.size) throw new Error("题库文件为空。");
  if (file.size > BANK_FILE_BYTES)
    throw new Error(
      `题库文件为${(file.size / 1e6).toFixed(1)}MB，单次最多1.5MB；请按章节拆分后分批追加。`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string,
    encoding = "utf-8";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("gb18030").decode(bytes);
    encoding = "gb18030";
  }
  if (text.startsWith("﻿")) text = text.slice(1);
  return {
    text,
    format: format === "txt" ? (text.includes("\t") ? "tsv" : "csv") : format,
    encoding,
  };
}
