// ABOUTME: 图表文件、数据集上传/读取、官方 schema 与 AI 起草的 HTTP 路由。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { WorkbenchHostError } from "../../sdk/host.mjs";
import { decodeDatasetRef, parseDataset, type DatasetRef } from "../contracts/datasets.ts";
import { checkSpec, validate, instructions, type Model } from "../contracts/model.ts";
import { isRecord } from "../contracts/project.ts";
import { createDatasetStore, decodeText, uploadSessions, type DatasetStore } from "./datasets.ts";
import { loadSchema, verifyModel } from "./schema.ts";
import { createStore, StoreError } from "./store.ts";

export function fail(error: unknown) {
  return Response.json(
    {
      error: {
        message:
          error instanceof WorkbenchHostError
            ? "模型服务暂不可用，请打开 Floatboat 并检查登录和模型设置。"
            : error instanceof Error
              ? error.message
              : "操作失败，请重试。",
      },
    },
    {
      status:
        error instanceof StoreError ? error.status : error instanceof WorkbenchHostError ? 503 : 400,
    },
  );
}
const guard =
  <C>(handler: (context: C) => unknown) =>
  async (context: C) => {
    try {
      return await handler(context);
    } catch (error) {
      return fail(error);
    }
  };

/** 给模型的数据集说明：字段、类型与前三行样例。 */
function describeDatasets(refs: DatasetRef[], datasets: DatasetStore): string {
  return refs
    .slice(0, 8)
    .map((ref) => {
      let sample = "";
      try {
        const { format, content } = datasets.content(ref.id);
        sample = JSON.stringify(parseDataset(content.slice(0, 20000), format).rows.slice(0, 3));
      } catch {
        /* 内容不可读时只给字段 */
      }
      return `数据集 ${ref.name}（${ref.rows} 行）字段：${ref.columns.map((c) => `${c.name}:${c.type}`).join(", ")}${sample ? `；样例：${sample}` : ""}`;
    })
    .join("\n");
}

export function registerRoutes(app: WorkbenchServer): DatasetStore {
  const datasets = createDatasetStore(app.database);
  datasets.installSamples();
  const uploads = uploadSessions();
  const store = createStore(app.database, validate);
  const full = (value: unknown): Model => {
    const model = validate(value);
    verifyModel(model, datasets);
    return model;
  };

  app.route("GET", "/api/projects", () => store.list());
  app.route("GET", "/api/projects/:id", guard(({ params }) => store.get(params.id)));
  app.route(
    "POST",
    "/api/projects",
    guard(({ body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return Response.json(store.create(body.title, full(body.data)), { status: 201 });
    }),
  );
  app.route(
    "PUT",
    "/api/projects/:id",
    guard(({ params, body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.update(params.id, body.title, full(body.data), body.revision);
    }),
  );
  app.route(
    "DELETE",
    "/api/projects/:id",
    guard(({ params, body }) => {
      if (!isRecord(body)) throw new Error("请求格式无效。");
      return store.remove(params.id, body.revision);
    }),
  );

  app.route(
    "GET",
    "/api/schema",
    guard(
      () =>
        new Response(loadSchema().text, {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=3600" },
        }),
    ),
  );

  app.route("POST", "/api/datasets/uploads", guard(({ body }) => uploads.create(body)));
  app.route("POST", "/api/datasets/uploads/:id/chunk", guard(({ params, body }) => uploads.chunk(params.id, body)));
  app.route("DELETE", "/api/datasets/uploads/:id", guard(({ params }) => uploads.drop(params.id)));
  app.route(
    "POST",
    "/api/datasets/uploads/:id/finish",
    guard(({ params }) => {
      const file = uploads.take(params.id);
      return datasets.save(file.file, decodeText(file.bytes));
    }),
  );
  app.route(
    "POST",
    "/api/datasets/missing",
    guard(({ body }) => ({ missing: datasets.missing(isRecord(body) ? body.ids : null) })),
  );
  app.route(
    "GET",
    "/api/datasets/:id",
    guard(({ params }) => {
      const { content } = datasets.content(params.id);
      return new Response(content, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "private, max-age=31536000, immutable",
        },
      });
    }),
  );

  app.route(
    "POST",
    "/api/generate",
    guard(async ({ body }) => {
      if (!isRecord(body) || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 12000)
        throw new Error("请输入 1–12000 个字符的要求。");
      const refs = Array.isArray(body.datasets) ? body.datasets.slice(0, 16).map(decodeDatasetRef) : [];
      const context = refs.length ? "\n\n可用数据集：\n" + describeDatasets(refs, datasets) : "";
      const result = await app.host.llm.generateText(
        {
          prompt: body.prompt + context,
          system: instructions + " 只返回一个完整 JSON 对象，不要附加 Markdown 围栏或解释文字。",
          maxOutputTokens: 6000,
        },
        { timeoutMs: 90000 },
      );
      const text = result.text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new Error("模型返回的内容不是完整 JSON，请调整要求重试。");
      }
      const spec = checkSpec(isRecord(value) && isRecord(value.spec) ? value.spec : value);
      const issues = loadSchema().checker(spec);
      if (issues.length) throw new Error(`模型返回的规格不符合 Vega-Lite schema：${issues[0].message}`);
      return { spec };
    }),
  );
  return datasets;
}
