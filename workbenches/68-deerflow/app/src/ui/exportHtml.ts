// ABOUTME: 生成可独立打开的 HTML 报告（按需加载，避免把服务端渲染器放进首屏）。
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportMarkdown } from "./ReportMarkdown";
import { htmlDocument } from "../contracts/report";
import type { Research } from "../contracts/research";

export function renderReportHtml(title: string, data: Research) {
  const body = renderToStaticMarkup(createElement(ReportMarkdown, { text: data.report, sources: data.sources }));
  return htmlDocument(title, body, data);
}
