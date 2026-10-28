import lang from "@usebruno/lang";
import { isRecord } from "../contracts/project.ts";
import {
  fieldsValue,
  validateCollection,
  type Fields,
  type Parsed,
  type SourceFile,
} from "../contracts/bruno.ts";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
function pairs(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map((v) => {
      if (
        !isRecord(v) ||
        typeof v.name !== "string" ||
        typeof v.value !== "string"
      )
        throw new Error("参数行无效。");
      return `${v.enabled === false ? "~" : ""}${v.name}: ${v.value}`;
    })
    .join("\n");
}
function rows(text: string, type?: string) {
  return text
    .split("\n")
    .filter((s) => s.trim())
    .map((line) => {
      const i = line.indexOf(":");
      if (i < 1) throw new Error("每行需为 name: value，可用 ~ 前缀停用。");
      const name = line.slice(0, i).trim();
      return {
        name: name.replace(/^~/, ""),
        value: line.slice(i + 1).trim(),
        enabled: !name.startsWith("~"),
        ...(type ? { type } : {}),
      };
    });
}
export function native(
  source: string,
  collection = false,
): Record<string, unknown> {
  const raw = collection
    ? lang.collectionBruToJson(source)
    : lang.bruToJsonV2(source);
  if (!isRecord(raw)) throw new Error("官方解析器未返回有效对象。");
  return raw;
}
export function parse(file: SourceFile): Parsed {
  if (file.path.endsWith("bruno.json")) {
    const v: unknown = JSON.parse(file.source);
    if (!isRecord(v)) throw new Error("bruno.json 必须是对象。");
    return {
      fields: null,
      kind: "collection-config",
      blocked: ["集合配置仅保存和导出；不执行继承设置。"],
    };
  }
  const collection = /(^|\/)(collection|folder)\.bru$/.test(file.path),
    obj = native(file.source, collection),
    blocked: string[] = [];
  if (collection)
    return {
      fields: null,
      kind: "collection",
      blocked: ["集合/文件夹规则原样保留；不执行继承或脚本。"],
    };
  const http = isRecord(obj.http) ? obj.http : {};
  const meta = isRecord(obj.meta) ? obj.meta : {};
  for (const key of [
    "script",
    "tests",
    "assertions",
    "vars",
    "auth",
    "settings",
    "grpc",
    "ws",
    "app",
    "examples",
  ])
    if (
      obj[key] !== undefined &&
      JSON.stringify(obj[key]) !== "{}" &&
      JSON.stringify(obj[key]) !== "[]" &&
      obj[key] !== ""
    )
      blocked.push(`包含未支持的 ${key}；原文保留，发送与结构改写已阻止。`);
  for (const key of Object.keys(http))
    if (!["method", "url", "body", "auth"].includes(key))
      blocked.push(`未支持 HTTP 字段 ${key}。`);
  const method = String(http.method ?? "").toUpperCase(),
    bodyType = String(http.body ?? "none");
  if (!METHODS.includes(method))
    blocked.push("仅支持 GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS。");
  if (http.auth && http.auth !== "none")
    blocked.push("认证继承/自动认证不受支持。");
  if (!["none", "json", "text", "xml"].includes(bodyType))
    blocked.push("仅支持 none / json / text / xml 请求体。");
  if (isRecord(obj.body) && Object.keys(obj.body).some((k) => k !== bodyType))
    blocked.push("包含非当前类型的请求体字段；原文保留。");
  for (const list of [obj.headers, obj.params])
    if (
      Array.isArray(list) &&
      list.some(
        (v) =>
          isRecord(v) &&
          Object.keys(v).some(
            (k) => !["name", "value", "enabled", "type"].includes(k),
          ),
      )
    )
      blocked.push("参数包含额外注解，结构编辑不受支持；原文保留。");
  for (const list of [obj.headers, obj.params])
    if (
      Array.isArray(list) &&
      list.some(
        (v) =>
          isRecord(v) &&
          ((typeof v.name === "string" &&
            (v.name.includes(":") ||
              v.name.startsWith("~") ||
              /[\r\n]/.test(v.name))) ||
            (typeof v.value === "string" && /[\r\n]/.test(v.value))),
      )
    )
      blocked.push("参数名称或值包含结构化编辑不支持的分隔符；原文保留。");
  if (
    Array.isArray(obj.params) &&
    obj.params.some((p) => isRecord(p) && p.type !== "query")
  )
    blocked.push("路径参数替换不受支持，请使用完整 URL。");
  if (/\{\{/.test(file.source))
    blocked.push("环境/动态变量不受支持；不会读取系统秘密。");
  const keys = new Set(["meta", "http", "headers", "params", "body", "docs"]);
  for (const key of Object.keys(obj))
    if (
      !keys.has(key) &&
      ![
        "script",
        "tests",
        "assertions",
        "vars",
        "auth",
        "settings",
        "grpc",
        "ws",
        "app",
        "examples",
      ].includes(key)
    )
      blocked.push(`未支持字段 ${key}，请保留原文处理。`);
  return {
    kind: "request",
    blocked,
    fields: {
      name: String(meta.name ?? file.path),
      method,
      url: String(http.url ?? ""),
      headers: pairs(obj.headers),
      query: pairs(obj.params),
      bodyType,
      body: isRecord(obj.body) ? String(obj.body[bodyType] ?? "") : "",
    },
  };
}
export function compose(file: SourceFile, raw: unknown): string {
  const parsed = parse(file);
  if (parsed.blocked.length || !parsed.fields)
    throw new Error("此文件含未支持块，仅允许编辑原生源文件。");
  const fields = fieldsValue(raw),
    obj = native(file.source);
  obj.meta = { ...(isRecord(obj.meta) ? obj.meta : {}), name: fields.name };
  obj.http = {
    method: fields.method.toLowerCase(),
    url: fields.url,
    body: fields.bodyType,
    auth: "none",
  };
  obj.headers = rows(fields.headers);
  obj.params = rows(fields.query, "query");
  obj.body =
    fields.bodyType === "none" ? {} : { [fields.bodyType]: fields.body };
  const result = lang.jsonToBruV2(structuredClone(obj));
  if (result.length > 40000) throw new Error("Bru 超过 40K 字符。");
  native(result);
  return result;
}
export function executable(files: SourceFile[], fileId: string) {
  const file = files.find((f) => f.id === fileId);
  if (!file) throw new Error("请求文件不存在。");
  for (const f of files) {
    if (/(^|\/)(collection|folder)\.bru$/.test(f.path)) {
      const n = native(f.source, true);
      if (Object.keys(n).some((k) => !["meta", "docs"].includes(k)))
        throw new Error(
          "集合包含继承规则或脚本。请新建只含受支持请求的集合后发送。",
        );
    }
  }
  for (const config of files.filter((f) => f.path.endsWith("bruno.json"))) {
    const v: unknown = JSON.parse(config.source);
    if (
      !isRecord(v) ||
      Object.keys(v).some(
        (k) => !["name", "version", "type", "ignore"].includes(k),
      )
    )
      throw new Error("bruno.json 含未支持运行设置，请在纯请求集合内执行。");
  }
  const parsed = parse(file);
  if (parsed.blocked.length || !parsed.fields)
    throw new Error(parsed.blocked.join(" "));
  const f = parsed.fields;
  const url = new URL(f.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("请输入无内嵌凭据的 HTTP(S) URL。");
  for (const q of rows(f.query, "query"))
    if (q.enabled) url.searchParams.append(q.name, q.value);
  const headers = new Headers();
  for (const h of rows(f.headers))
    if (h.enabled) {
      if (
        [
          "host",
          "connection",
          "content-length",
          "cookie",
          "proxy-authorization",
        ].includes(h.name.toLowerCase())
      )
        throw new Error("该受控请求头不支持：" + h.name);
      headers.append(h.name, h.value);
    }
  if (f.bodyType !== "none" && !headers.has("content-type"))
    headers.set(
      "content-type",
      f.bodyType === "json"
        ? "application/json"
        : f.bodyType === "xml"
          ? "application/xml"
          : "text/plain",
    );
  if (["GET", "HEAD"].includes(f.method) && f.bodyType !== "none")
    throw new Error("GET / HEAD 不支持请求体。");
  if (
    Buffer.byteLength(url.toString()) > 8192 ||
    Buffer.byteLength(JSON.stringify([...headers])) > 16384 ||
    Buffer.byteLength(f.body) > 131072
  )
    throw new Error("请求 URL、头或正文超过发送预算。");
  return {
    file,
    method: f.method,
    url: url.toString(),
    headers,
    body: f.bodyType === "none" ? undefined : f.body,
  };
}
export function validateNativeCollection(raw: unknown) {
  const v = validateCollection(raw);
  for (const f of v.files) parse(f);
  return v;
}
