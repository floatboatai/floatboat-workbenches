// ABOUTME: 读取 vega-lite 包内的官方 JSON Schema（规范化后缓存），并提供服务端规格与数据集引用的完整校验。
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { Model } from "../contracts/model.ts";
import { createSpecChecker, normalizeSchema, type SpecChecker } from "../contracts/spec-schema.ts";
import type { DatasetStore } from "./datasets.ts";
import { StoreError } from "./store.ts";

let cached: { text: string; checker: SpecChecker } | null = null;
export function loadSchema() {
  if (cached) return cached;
  const require = createRequire(import.meta.url);
  const raw: unknown = JSON.parse(readFileSync(require.resolve("vega-lite/vega-lite-schema.json"), "utf8"));
  const schema = normalizeSchema(raw);
  cached = { text: JSON.stringify(schema), checker: createSpecChecker(schema) };
  return cached;
}

/** 正式保存前的完整校验：官方 schema + 数据集都已存在。失败时自动保存保留为草稿。 */
export function verifyModel(model: Model, datasets: DatasetStore): void {
  const issues = loadSchema().checker(model.spec);
  if (issues.length) {
    const first = issues[0];
    throw new StoreError(
      422,
      `规格不符合 Vega-Lite schema${first.pointer ? `（${first.pointer}）` : ""}：${first.message}`,
    );
  }
  const missing = model.datasets.filter((item) => !datasets.has(item.id));
  if (missing.length)
    throw new StoreError(422, `缺少数据集 ${missing.map((item) => item.file).join("、")}，请重新导入这些数据文件。`);
}
