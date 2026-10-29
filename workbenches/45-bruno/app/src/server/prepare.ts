// Builds the concrete HTTP exchange: variables, inheritance, auth and body encoding.
import { isRecord } from "../contracts/project.ts";
import {
  environmentName,
  fileKind,
  type RequestModel,
  type Row,
  type SentRequest,
  type SourceFile,
} from "../contracts/bruno.ts";
import { createInterpolator, type Scope } from "../contracts/vars.ts";
import { native, parse, rows, scriptWarnings } from "./bru.ts";

/* ---------------------------------------------------------------- execution */

export interface PrepareOptions {
  environment?: string;
  secrets?: Record<string, string>;
  runtime?: Record<string, string>;
  dynamic?: Record<string, string>;
}
export interface Prepared {
  file: SourceFile;
  model: RequestModel;
  method: string;
  url: string;
  headers: Headers;
  body: string | URLSearchParams | FormData | undefined;
  sent: SentRequest;
  interpolate: (t: string) => string;
  sensitive: string[];
  warnings: string[];
  timeoutMs: number;
}
const FORBIDDEN_HEADERS = ["host", "connection", "content-length", "transfer-encoding", "cookie", "proxy-authorization"];

interface Layer {
  headers: Row[];
  vars: Row[];
  authMode?: string;
  auth: Record<string, unknown>;
  warnings: string[];
}
function layer(file: SourceFile | undefined, where: string): Layer | null {
  if (!file) return null;
  const obj = native(file.source, true);
  const auth = isRecord(obj.auth) ? obj.auth : {};
  return {
    headers: rows(obj.headers),
    vars: rows(isRecord(obj.vars) ? obj.vars.req : undefined),
    authMode: typeof auth.mode === "string" ? auth.mode : undefined,
    auth,
    warnings: scriptWarnings(obj, where),
  };
}
const enabledValues = (list: Row[]) =>
  Object.fromEntries(list.filter((r) => r.enabled && r.name).map((r) => [r.name, r.value]));

export function prepare(files: SourceFile[], requestId: string, options: PrepareOptions = {}): Prepared {
  const file = files.find((f) => f.id === requestId);
  if (!file) throw new Error("请求文件不存在。");
  const parsed = parse(file);
  if (parsed.kind !== "request" || !parsed.model) throw new Error("所选文件不是可发送的请求。");
  if (parsed.blocked.length) throw new Error(parsed.blocked.join(" "));
  const model = parsed.model;
  const warnings = [...parsed.warnings];
  for (const config of files.filter((f) => fileKind(f.path) === "config"))
    try {
      warnings.push(...parse(config).warnings);
    } catch {
      warnings.push("bruno.json 无法解析，已忽略。");
    }
  const collection = layer(files.find((f) => f.path === "collection.bru"), "集合设置");
  const segments = file.path.split("/").slice(0, -1);
  const folders: Layer[] = [];
  for (let i = 1; i <= segments.length; i++) {
    const path = segments.slice(0, i).join("/") + "/folder.bru";
    const l = layer(files.find((f) => f.path === path), `文件夹 ${segments[i - 1]} `);
    if (l) folders.push(l);
  }
  for (const l of [collection, ...folders]) if (l) warnings.push(...l.warnings);

  // Environment
  const secrets = options.secrets ?? {};
  const secretNames = new Set<string>();
  const envValues: Record<string, string> = {};
  const missingSecrets: string[] = [];
  if (options.environment) {
    const envFile = files.find(
      (f) => fileKind(f.path) === "environment" && environmentName(f.path) === options.environment,
    );
    if (!envFile) throw new Error(`环境「${options.environment}」不存在，请重新选择。`);
    for (const v of parse(envFile).environment ?? []) {
      if (!v.enabled || !v.name) continue;
      if (v.secret) {
        secretNames.add(v.name);
        const value = secrets[v.name];
        if (value) envValues[v.name] = value;
        else missingSecrets.push(v.name);
      } else envValues[v.name] = v.value;
    }
  }
  const scopes: Scope[] = [
    { label: "运行时", values: options.runtime ?? {} },
    { label: "请求", values: enabledValues(model.vars) },
    ...[...folders].reverse().map((l) => ({ label: "文件夹", values: enabledValues(l.vars) })),
    { label: "环境", values: envValues },
    { label: "集合", values: enabledValues(collection?.vars ?? []) },
  ];
  const interpolate = createInterpolator(scopes, options.dynamic ?? {});
  const secretRef = (t: string) =>
    [...secretNames].some((n) => new RegExp(`\\{\\{\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`).test(t));

  // URL, path and query params
  let rawUrl = interpolate(model.url.trim());
  for (const p of model.path)
    if (p.enabled && p.name)
      rawUrl = rawUrl.replace(new RegExp(`/:${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=/|\\?|#|$)`, "g"), "/" + encodeURIComponent(interpolate(p.value)));
  if (!/^https?:\/\//i.test(rawUrl) && !rawUrl.includes("{{"))
    rawUrl = (/^(localhost|127\.|\[::1\])/i.test(rawUrl) ? "http://" : "https://") + rawUrl;
  let url: URL | null = null;
  try {
    url = new URL(rawUrl);
  } catch {
    url = null;
  }
  if (url) {
    for (const q of model.query)
      if (q.enabled && q.name) {
        const name = interpolate(q.name),
          value = interpolate(q.value);
        if (!url.searchParams.getAll(name).includes(value)) url.searchParams.append(name, value);
      }
  }

  // Headers: collection → folders → request
  const headers = new Headers();
  const sensitiveHeaders = new Set<string>();
  const applyHeaders = (list: Row[]) => {
    for (const h of list) {
      if (!h.enabled || !h.name) continue;
      const name = interpolate(h.name).trim();
      if (FORBIDDEN_HEADERS.includes(name.toLowerCase())) throw new Error("该受控请求头由运行时管理，不能手动设置：" + name);
      try {
        headers.set(name, interpolate(h.value));
      } catch {
        throw new Error(`请求头「${name}」包含无效字符。`);
      }
      if (secretRef(h.value)) sensitiveHeaders.add(name.toLowerCase());
    }
  };
  if (collection) applyHeaders(collection.headers);
  for (const l of folders) applyHeaders(l.headers);
  applyHeaders(model.headers);

  // Auth
  let mode = model.authMode,
    authSource: Record<string, unknown> = {
      bearer: model.auth.bearer,
      basic: model.auth.basic,
      apikey: model.auth.apikey,
    },
    authFrom = "请求";
  if (mode === "inherit") {
    mode = "none";
    authFrom = "集合";
    const chain = [...folders].reverse();
    const owner = chain.find((l) => l.authMode && l.authMode !== "inherit") ?? collection;
    if (owner?.authMode && owner.authMode !== "inherit") {
      mode = owner.authMode;
      authSource = owner.auth;
      authFrom = owner === collection ? "集合" : "文件夹";
    }
  }
  const field = (group: string, key: string) => {
    const g = authSource[group];
    return isRecord(g) && typeof g[key] === "string" ? (g[key] as string) : "";
  };
  if (mode === "bearer") {
    const token = field("bearer", "token");
    if (!headers.has("authorization")) headers.set("authorization", "Bearer " + interpolate(token));
    if (secretRef(token)) sensitiveHeaders.add("authorization");
  } else if (mode === "basic") {
    const user = field("basic", "username"),
      pass = field("basic", "password");
    if (!headers.has("authorization"))
      headers.set("authorization", "Basic " + Buffer.from(interpolate(user) + ":" + interpolate(pass)).toString("base64"));
    if (secretRef(user) || secretRef(pass)) sensitiveHeaders.add("authorization");
  } else if (mode === "apikey") {
    const key = interpolate(field("apikey", "key")).trim(),
      value = field("apikey", "value"),
      placement = field("apikey", "placement") || "header";
    if (!key) throw new Error(`${authFrom}的 API Key 认证缺少名称。`);
    if (placement === "queryparams") url?.searchParams.set(key, interpolate(value));
    else {
      headers.set(key, interpolate(value));
      if (secretRef(value)) sensitiveHeaders.add(key.toLowerCase());
    }
  } else if (mode !== "none") throw new Error(`${authFrom}的认证模式 ${mode} 不受支持。`);

  // Body
  let body: Prepared["body"];
  let preview: string | undefined;
  const setType = (type: string) => {
    if (!headers.has("content-type")) headers.set("content-type", type);
  };
  switch (model.bodyMode) {
    case "json":
      body = interpolate(model.body.json);
      setType("application/json");
      break;
    case "text":
      body = interpolate(model.body.text);
      setType("text/plain");
      break;
    case "xml":
      body = interpolate(model.body.xml);
      setType("application/xml");
      break;
    case "formUrlEncoded": {
      const form = new URLSearchParams();
      for (const r of model.body.formUrlEncoded)
        if (r.enabled && r.name) form.append(interpolate(r.name), interpolate(r.value));
      body = form;
      preview = form.toString();
      setType("application/x-www-form-urlencoded");
      break;
    }
    case "multipartForm": {
      const form = new FormData();
      const lines: string[] = [];
      for (const r of model.body.multipartForm)
        if (r.enabled && r.name) {
          form.append(interpolate(r.name), interpolate(r.value));
          lines.push(`${interpolate(r.name)}=${interpolate(r.value)}`);
        }
      body = form;
      preview = lines.join("\n");
      if (!/boundary=/i.test(headers.get("content-type") ?? "")) headers.delete("content-type");
      break;
    }
    case "graphql": {
      let variables: unknown = undefined;
      const rawVars = interpolate(model.body.graphql.variables).trim();
      if (rawVars)
        try {
          variables = JSON.parse(rawVars);
        } catch {
          throw new Error("GraphQL 变量不是有效 JSON。");
        }
      body = JSON.stringify({ query: interpolate(model.body.graphql.query), ...(variables === undefined ? {} : { variables }) });
      setType("application/json");
      break;
    }
    default:
      body = undefined;
  }
  if (typeof body === "string") preview = body;

  const missing = [...interpolate.missing];
  if (missing.length) {
    const secretMissing = missing.filter((n) => missingSecrets.includes(n));
    const plain = missing.filter((n) => !missingSecrets.includes(n));
    const parts: string[] = [];
    if (plain.length)
      parts.push(
        `未定义变量 ${plain.map((n) => `{{${n}}}`).join("、")}` +
          (options.environment ? `（当前环境「${options.environment}」）` : "（未选择环境）"),
      );
    if (secretMissing.length)
      parts.push(`秘密变量 ${secretMissing.join("、")} 尚未在本次会话输入（环境面板中填写，不会写入磁盘）`);
    if (plain.some((n) => n.startsWith("process.env."))) parts.push("工作台不读取系统环境变量");
    throw new Error(parts.join("；") + "。请求未发送。");
  }
  if (!url) throw new Error(`URL 无效：${rawUrl || "（空）"}。请求未发送。`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 http:// 与 https:// 地址。");
  if (url.username || url.password) throw new Error("URL 不能内嵌账号密码，请使用 Basic 认证。");
  if (["GET", "HEAD"].includes(model.method) && body !== undefined && model.bodyMode !== "none")
    throw new Error(`${model.method} 请求不能携带请求体；请把 Body 设为 none 或改用 POST。`);
  const bodyBytes = typeof body === "string" ? Buffer.byteLength(body) : preview ? Buffer.byteLength(preview) : 0;
  if (Buffer.byteLength(url.toString()) > 16384 || bodyBytes > 4 * 1024 * 1024)
    throw new Error("URL 超过 16 KiB 或请求体超过 4 MiB。");

  const sensitive = Object.entries(secrets)
    .filter(([name, v]) => secretNames.has(name) && v)
    .map(([, v]) => v);
  for (const name of sensitiveHeaders) {
    const v = headers.get(name);
    if (v) sensitive.push(v);
  }
  const sentHeaders: Record<string, string> = {};
  headers.forEach((v, k) => {
    sentHeaders[k] = sensitiveHeaders.has(k) ? "•••（秘密变量）" : v;
  });
  const own = native(file.source);
  const settings = isRecord(own.settings) ? own.settings : {};
  const requested = Number(settings.timeout);
  const timeoutMs = Number.isFinite(requested) && requested > 0 ? Math.min(Math.max(requested, 1000), 120000) : 30000;
  return {
    file,
    model,
    method: model.method,
    url: url.toString(),
    headers,
    body: model.bodyMode === "none" ? undefined : body,
    sent: {
      method: model.method,
      url: url.toString(),
      headers: sentHeaders,
      ...(preview !== undefined && model.bodyMode !== "none" ? { body: preview.slice(0, 60000), bodyBytes } : {}),
    },
    interpolate,
    sensitive,
    warnings: [...new Set(warnings)],
    timeoutMs,
  };
}
