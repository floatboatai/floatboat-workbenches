import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { isRecord, boundedText } from "../contracts/project.ts";
import {
  canonicalPath,
  hostname,
  logValue,
  pageValue,
  type Candidate,
  type LogRow,
  type ContentPage,
} from "../contracts/observation.ts";
import {
  parseStrictDate,
  parseCombinedDate,
} from "../vendor/geoinflow/strict-date.ts";
function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell) throw new Error("CSV引号位置无效。");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV引号尚未闭合。");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function parseInput(raw: unknown): Candidate {
  if (!isRecord(raw) || !["logs", "pages"].includes(String(raw.kind)))
    throw new Error("请选择日志或内容清单。");
  const kind = raw.kind as Candidate["kind"],
    domain = hostname(boundedText(raw.domain, 253)),
    format = boundedText(raw.format, 20),
    text = boundedText(raw.text, 200000);
  if (Buffer.byteLength(text) > 550000) throw new Error("输入超过550KB。");
  let rows: unknown[];
  if (format === "json") {
    const v: unknown = JSON.parse(text);
    if (Array.isArray(v)) rows = v;
    else if (isRecord(v) && Array.isArray(v.records)) rows = v.records;
    else throw new Error("JSON应为记录数组或包含records数组。");
  } else if (kind === "logs" && format === "combined")
    rows = text.split(/\r?\n/).filter((s) => s.trim());
  else if (kind === "pages" && format === "csv") {
    const all = csvRows(text.replace(/^\uFEFF/, "")),
      headers = all.shift()?.map((x) => x.trim());
    if (!headers || !headers.some((h) => h === "path" || h === "url"))
      throw new Error("CSV需要path或url表头，可选title、priority。");
    rows = all.map((cells) =>
      Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])),
    );
  } else if (kind === "pages" && format === "sitemap") {
    if (
      /<!DOCTYPE|<!ENTITY|<sitemapindex/i.test(text) ||
      !/<urlset(?:\s[^>]*)?>[\s\S]*<\/urlset>\s*$/i.test(text)
    )
      throw new Error("仅接受无外部实体的urlset站点地图。");
    rows = Array.from(
      text.matchAll(/<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/gi),
      (m) => ({
        url: m[1]
          .match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]
          .replaceAll("&amp;", "&"),
      }),
    );
  } else throw new Error("不支持此输入格式。");
  if (!rows.length || rows.length > 200)
    throw new Error("每次导入需要1–200条记录。");
  const records: (LogRow | ContentPage)[] = [],
    errors: { line: number; reason: string }[] = [],
    seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    try {
      let value: unknown = row;
      if (kind === "logs" && format === "combined") {
        if (typeof row !== "string" || row.length > 3000)
          throw new Error("日志行超过容量。");
        const m = row.match(
          /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (.*?) HTTP\/[\d.]+" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"$/,
        );
        if (!m) throw new Error("不是combined日志行。");
        value = {
          ip: m[1],
          time: parseCombinedDate(m[2]).toISOString(),
          method: m[3],
          path: m[4],
          status: Number(m[5]),
          bytes: m[6] === "-" ? 0 : Number(m[6]),
          referrer: m[7] === "-" ? "" : m[7],
          userAgent: m[8],
        };
      }
      if (!isRecord(value)) throw new Error("记录不是对象。");
      const path = canonicalPath(
        boundedText(value.path ?? value.url, 2000),
        domain,
      );
      if (kind === "logs") {
        if (value.ip !== undefined && !isIP(String(value.ip)))
          throw new Error("IP格式无效。");
        const time = parseStrictDate(
          value.time ?? value.timestamp,
        ).toISOString();
        const id = createHash("sha256")
          .update(
            JSON.stringify([
              i,
              time,
              path,
              value.method,
              value.status,
              value.userAgent ?? value.user_agent,
            ]),
          )
          .digest("hex");
        records.push(
          logValue({
            id,
            time,
            path,
            method: String(value.method ?? "GET").toUpperCase(),
            status: Number(value.status),
            bytes: Number(value.bytes ?? 0),
            userAgent: value.userAgent ?? value.user_agent ?? "",
            referrer: value.referrer ?? value.referer ?? "",
          }),
        );
      } else {
        if (seen.has(path)) throw new Error("清单内路径重复。");
        seen.add(path);
        records.push(
          pageValue({
            path,
            title: value.title ?? path,
            priority: value.priority === "high" ? "high" : "normal",
          }),
        );
      }
    } catch (e) {
      errors.push({
        line: i + 1,
        reason: e instanceof Error ? e.message : "记录无效。",
      });
    }
  }
  if (Buffer.byteLength(JSON.stringify(records)) > 400000)
    throw new Error("解析结果超过400KB，请拆分输入。");
  return {
    kind,
    records: records as LogRow[] | ContentPage[],
    accepted: records.length,
    rejected: errors.length,
    errors,
    source: format,
    inputHash: createHash("sha256")
      .update(
        JSON.stringify({
          kind: raw.kind,
          domain: raw.domain,
          format: raw.format,
          text: raw.text,
        }),
      )
      .digest("hex"),
  };
}
