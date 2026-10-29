import lang from "@usebruno/lang";
import { isRecord } from "../contracts/project.ts";
import {
  AUTH_MODES,
  BODY_MODES,
  LIMITS,
  METHODS,
  envVars,
  fileKind,
  requestModel,
  validateCollection,
  type Parsed,
  type RequestModel,
  type Row,
  type SourceFile,
} from "../contracts/bruno.ts";

const SCRIPT_KEYS = ["script", "tests"];

export function native(source: string, collection = false): Record<string, unknown> {
  const raw = collection ? lang.collectionBruToJson(source) : lang.bruToJsonV2(source);
  if (!isRecord(raw)) throw new Error("官方解析器未返回有效对象。");
  return raw;
}
const present = (v: unknown) =>
  v !== undefined &&
  v !== null &&
  v !== "" &&
  JSON.stringify(v) !== "{}" &&
  JSON.stringify(v) !== "[]" &&
  !(isRecord(v) && Object.values(v).every((x) => x === "" || x === undefined));

export function rows(raw: unknown, type?: string): Row[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => isRecord(v) && (type === undefined || v.type === type))
    .map((v) => {
      const r = v as Record<string, unknown>;
      return {
        ...r,
        name: String(r.name ?? ""),
        value: String(r.value ?? ""),
        enabled: r.enabled !== false,
      } as Row;
    });
}
const text = (v: unknown) => (typeof v === "string" ? v : "");

export function toModel(obj: Record<string, unknown>, path: string): RequestModel | null {
  if (!isRecord(obj.http)) return null;
  const http = obj.http,
    meta = isRecord(obj.meta) ? obj.meta : {},
    body = isRecord(obj.body) ? obj.body : {},
    auth = isRecord(obj.auth) ? obj.auth : {},
    vars = isRecord(obj.vars) ? obj.vars : {};
  const bearer = isRecord(auth.bearer) ? auth.bearer : {},
    basic = isRecord(auth.basic) ? auth.basic : {},
    apikey = isRecord(auth.apikey) ? auth.apikey : {},
    graphql = isRecord(body.graphql) ? body.graphql : {};
  return {
    name: String(meta.name ?? path.split("/").at(-1)?.replace(/\.bru$/, "") ?? ""),
    method: String(http.method ?? "get").toUpperCase(),
    url: text(http.url),
    query: rows(obj.params, "query"),
    path: rows(obj.params, "path"),
    headers: rows(obj.headers),
    bodyMode: String(http.body ?? "none"),
    body: {
      json: text(body.json),
      text: text(body.text),
      xml: text(body.xml),
      formUrlEncoded: rows(body.formUrlEncoded),
      multipartForm: rows(body.multipartForm),
      graphql: { query: text(graphql.query), variables: text(graphql.variables) },
    },
    authMode: String(http.auth ?? "none"),
    auth: {
      bearer: { token: text(bearer.token) },
      basic: { username: text(basic.username), password: text(basic.password) },
      apikey: {
        key: text(apikey.key),
        value: text(apikey.value),
        placement: text(apikey.placement) || "header",
      },
    },
    vars: rows(vars.req),
    postVars: rows(vars.res),
    assertions: rows(obj.assertions),
    docs: text(obj.docs),
  };
}

export function scriptWarnings(obj: Record<string, unknown>, where: string) {
  const out: string[] = [];
  if (SCRIPT_KEYS.some((k) => present(obj[k])))
    out.push(`${where}含 JavaScript 脚本或 tests：原文保留，本工作台不执行脚本。`);
  return out;
}

export function parse(file: SourceFile): Parsed {
  const kind = fileKind(file.path);
  const base = { kind, blocked: [] as string[], warnings: [] as string[], model: null, environment: null };
  if (kind === "config") {
    const v: unknown = JSON.parse(file.source);
    if (!isRecord(v)) throw new Error("bruno.json 必须是对象。");
    const extra = Object.keys(v).filter((k) => !["name", "version", "type", "ignore"].includes(k));
    if (extra.length)
      base.warnings.push(`bruno.json 中的 ${extra.join("、")} 原样保留，发送时不应用（例如代理与客户端证书）。`);
    return base;
  }
  if (kind === "environment") {
    const v = lang.bruToEnvJsonV2(file.source);
    if (!isRecord(v) || !Array.isArray(v.variables)) throw new Error("环境文件无效。");
    return {
      ...base,
      environment: envVars(
        v.variables.map((x) => {
          const r = isRecord(x) ? x : {};
          return {
            name: String(r.name ?? ""),
            value: String(r.value ?? ""),
            enabled: r.enabled !== false,
            secret: r.secret === true,
          };
        }),
      ),
    };
  }
  if (kind === "collection" || kind === "folder") {
    const obj = native(file.source, true);
    base.warnings.push(...scriptWarnings(obj, kind === "collection" ? "集合设置" : "文件夹设置"));
    const auth = isRecord(obj.auth) ? obj.auth : {};
    const mode = String(auth.mode ?? "none");
    if (!["none", "inherit", "bearer", "basic", "apikey"].includes(mode))
      base.warnings.push(`认证模式 ${mode} 不受支持；继承此认证的请求会被阻止发送。`);
    return base;
  }
  const obj = native(file.source);
  const model = toModel(obj, file.path);
  const blocked: string[] = [],
    warnings = scriptWarnings(obj, "此请求");
  if (!model) {
    blocked.push("只支持 HTTP 请求；gRPC / WebSocket 等请求原文保留。");
    return { ...base, blocked, warnings };
  }
  if (!(METHODS as readonly string[]).includes(model.method))
    blocked.push(`方法 ${model.method} 不受支持。`);
  if (!(BODY_MODES as readonly string[]).includes(model.bodyMode))
    blocked.push(`请求体类型 ${model.bodyMode} 不受支持（支持 json/text/xml/表单/multipart 文本/GraphQL）。`);
  if (!(AUTH_MODES as readonly string[]).includes(model.authMode))
    blocked.push(`认证模式 ${model.authMode} 不受支持（支持 bearer / basic / API Key / 继承）。`);
  if (
    model.bodyMode === "multipartForm" &&
    model.body.multipartForm.some((r) => r.enabled && r.type === "file")
  )
    blocked.push("multipart 文件字段不受支持；请改为文本字段或停用该行。");
  return { ...base, blocked, warnings, model };
}

const hasRows = (r: Row[]) => r.length > 0;

/** Applies a structured edit to the native object and serializes with the official converter. */
export function compose(file: SourceFile, raw: unknown): string {
  if (fileKind(file.path) !== "request") throw new Error("只有请求文件可以结构化编辑。");
  const model = requestModel(raw);
  const obj = native(file.source);
  if (!isRecord(obj.http)) throw new Error("此请求不是 HTTP 请求，只能编辑源文件。");
  for (const r of [...model.query, ...model.path, ...model.headers, ...model.vars, ...model.postVars, ...model.assertions, ...model.body.formUrlEncoded, ...model.body.multipartForm])
    if (/[\r\n]/.test(r.name)) throw new Error(`名称「${r.name.slice(0, 40)}」不能包含换行。`);
  obj.meta = { ...(isRecord(obj.meta) ? obj.meta : {}), name: model.name };
  obj.http = {
    ...obj.http,
    method: model.method.toLowerCase(),
    url: model.url,
    body: model.bodyMode,
    auth: model.authMode,
  };
  const strip = (r: Row): Row => ({ ...r });
  obj.params = [
    ...model.query.map((r) => ({ ...strip(r), type: "query" })),
    ...model.path.map((r) => ({ ...strip(r), type: "path" })),
  ];
  obj.headers = model.headers.map(strip);
  const body: Record<string, unknown> = { ...(isRecord(obj.body) ? obj.body : {}) };
  for (const key of ["json", "text", "xml"] as const)
    if (model.body[key] !== "" || model.bodyMode === key) body[key] = model.body[key];
    else delete body[key];
  for (const key of ["formUrlEncoded", "multipartForm"] as const)
    if (hasRows(model.body[key])) body[key] = model.body[key].map(strip);
    else delete body[key];
  if (model.body.graphql.query || model.body.graphql.variables || model.bodyMode === "graphql")
    body.graphql = { ...model.body.graphql };
  else delete body.graphql;
  obj.body = body;
  const auth: Record<string, unknown> = { ...(isRecord(obj.auth) ? obj.auth : {}) };
  const keepAuth = (key: "bearer" | "basic" | "apikey", value: Record<string, string>) => {
    const filled = Object.entries(value).some(([k, v]) => v !== "" && !(k === "placement" && v === "header"));
    if (filled || model.authMode === key) auth[key] = { ...value };
    else delete auth[key];
  };
  keepAuth("bearer", model.auth.bearer);
  keepAuth("basic", model.auth.basic);
  keepAuth("apikey", model.auth.apikey);
  obj.auth = auth;
  const vars: Record<string, unknown> = { ...(isRecord(obj.vars) ? obj.vars : {}) };
  if (hasRows(model.vars)) vars.req = model.vars.map((r) => ({ local: false, ...r }));
  else delete vars.req;
  if (hasRows(model.postVars)) vars.res = model.postVars.map((r) => ({ local: false, ...r }));
  else delete vars.res;
  obj.vars = vars;
  obj.assertions = model.assertions.map(strip);
  if (model.docs) obj.docs = model.docs;
  else delete obj.docs;
  const result = lang.jsonToBruV2(structuredClone(obj));
  if (result.length > LIMITS.sourceChars) throw new Error("Bru 源文件超过 200K 字符。");
  native(result);
  return result;
}

export function composeEnvironment(raw: unknown): string {
  const vars = envVars(raw);
  for (const v of vars) {
    if (!/^[\w.-]+$/.test(v.name)) throw new Error(`变量名「${v.name}」只能包含字母、数字、下划线、点和短横线。`);
  }
  const result = lang.envJsonToBruV2({
    variables: vars.map((v) => ({ ...v, value: v.secret ? "" : v.value })),
  });
  lang.bruToEnvJsonV2(result);
  return result;
}

export function validateNativeCollection(raw: unknown) {
  const v = validateCollection(raw);
  for (const f of v.files) parse(f);
  return v;
}
