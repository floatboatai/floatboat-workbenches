import { isRecord } from "./project.ts";
export interface Model {
  spec: Record<string, unknown>;
}
export const seed: Model = {
  spec: {
    openapi: "3.0.3",
    info: {
      title: "工作台示例 API",
      version: "1.0.0",
      description: "读取当前工作台的服务状态，此示例不会更改数据。",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/demo/health": {
        get: {
          summary: "读取服务状态",
          operationId: "getHealth",
          tags: ["服务状态"],
          responses: {
            "200": {
              description: "服务可用",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      service: { type: "string" },
                      time: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
function inspect(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error("规格嵌套过深。");
  if (Array.isArray(value)) {
    for (const item of value) inspect(item, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (
      key === "servers" &&
      (!Array.isArray(item) ||
        item.some(
          (server) =>
            !isRecord(server) ||
            typeof server.url !== "string" ||
            !server.url.startsWith("/") ||
            server.url.startsWith("//") ||
            server.url.includes("\\"),
        ))
    )
      throw new Error("当前只支持以 / 开头的同源 servers 地址。");
    if (key === "$ref" && (typeof item !== "string" || !item.startsWith("#/")))
      throw new Error("仅支持规格内部的 $ref 引用。");
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("规格包含不支持的属性。");
    inspect(item, depth + 1);
  }
}
export function validate(value: unknown): Model {
  if (!isRecord(value) || !isRecord(value.spec))
    throw new Error("请输入 OpenAPI JSON 对象。");
  const spec = value.spec;
  if (typeof spec.openapi !== "string" || !/^3\.[01]\.\d+$/.test(spec.openapi))
    throw new Error("仅支持 OpenAPI 3.0 或 3.1 规格。");
  if (
    !isRecord(spec.info) ||
    typeof spec.info.title !== "string" ||
    !spec.info.title.trim() ||
    typeof spec.info.version !== "string" ||
    !isRecord(spec.paths)
  )
    throw new Error("规格需要 info.title、info.version 和 paths。");
  if (JSON.stringify(spec).length > 250000)
    throw new Error("规格超过 250,000 字符。");
  inspect(spec);
  return { spec };
}
export const instructions =
  '按用户要求生成 OpenAPI 3.0.3 JSON。根对象必须只有 spec 字段，形状为 {"spec":{"openapi":"3.0.3","info":{"title":"接口名称","version":"1.0.0"},"servers":[{"url":"/"}],"paths":{}}}。info.title、info.version必须是字符串，paths必须是对象。只生成GET操作和内部#/引用。servers只能使用以/开头的相对地址，禁止域名、凭据与外部引用。';
