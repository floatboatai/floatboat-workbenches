// ABOUTME: 规格文件的读入与导出：保留用户给出的原文与格式，导入错误给出首个诊断。
import type { Model } from "../contracts/model";
import {
  analyzeSpec,
  convertSource,
  describe,
  detectFormat,
  SOURCE_LIMIT,
  type SpecFormat,
} from "../contracts/openapi";
import type { ImportProblem } from "./Panels";
import { download } from "./requests";

export const fileName = (title: string) =>
  (title.trim() || "openapi").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 80);

/** 导入失败但仍想修正时使用的最小有效模型；真正的原文放在源码草稿中。 */
export const placeholder = (title: string, format: SpecFormat): Model => ({
  format,
  source: convertSource(
    { openapi: "3.0.3", info: { title: title || "导入的规格", version: "0.0.0" }, paths: {} },
    format,
  ),
});

export type ReadResult =
  | { ok: true; model: Model; title: string }
  | { ok: false; problem: ImportProblem };

export async function readSpecFile(file: File): Promise<ReadResult> {
  if (file.size > SOURCE_LIMIT * 4)
    throw new Error(
      `文件超过 ${Math.round((SOURCE_LIMIT * 4) / 1_000_000)} MB，无法作为单个规格编辑。`,
    );
  const source = (await file.text()).replace(/^﻿/, "");
  const format = detectFormat(source, file.name);
  const result = analyzeSpec(source, format);
  const error = result.diagnostics.find((item) => item.severity === "error");
  if (error)
    return {
      ok: false,
      problem: {
        name: file.name,
        message: describe(error),
        text: source.length > SOURCE_LIMIT ? "" : source,
        format,
      },
    };
  return {
    ok: true,
    model: { format, source },
    title: (result.title || file.name.replace(/\.[^.]+$/, "")).slice(0, 120),
  };
}

/** 原格式导出原文；另一格式由解析结果转换（YAML 注释不会进入 JSON）。 */
export function exportSpec(
  model: Model,
  spec: Record<string, unknown>,
  target: SpecFormat,
  title: string,
) {
  const body = target === model.format ? model.source : convertSource(spec, target);
  download(
    new Blob([body], { type: target === "yaml" ? "application/yaml" : "application/json" }),
    fileName(title) + (target === "yaml" ? ".yaml" : ".json"),
  );
}
