// ABOUTME: 解析 OpenAPI/Swagger 的 YAML 或 JSON 原文，给出带行号的诊断和端点目录。
import { stringify } from "yaml";
import {
  isObject,
  lineStarts,
  makeLocator,
  resolvePointer,
  syntax,
  type Diagnostic,
  type Locator,
  type SpecFormat,
} from "./openapi-source.ts";
import {
  collectSecurity,
  collectServers,
  type SecurityEntry,
  type ServerEntry,
} from "./openapi-facts.ts";
export type { SecurityEntry, ServerEntry } from "./openapi-facts.ts";
export type { Diagnostic, Severity, SpecFormat } from "./openapi-source.ts";

export interface OperationEntry {
  method: string;
  path: string;
  tags: string[];
  summary: string;
  operationId: string;
  deprecated: boolean;
  line?: number;
}
export interface SpecAnalysis {
  format: SpecFormat;
  /** 规格对象，只有在没有错误时才可用于预览；不要修改。 */
  spec: Record<string, unknown> | null;
  version: string;
  title: string;
  apiVersion: string;
  diagnostics: Diagnostic[];
  operations: OperationEntry[];
  schemas: string[];
  security: SecurityEntry[];
  servers: ServerEntry[];
}

/** 原文上限：单个工作副本需在自动保存请求 2 MB 以内同时容纳模型与未应用草稿。 */
export const SOURCE_LIMIT = 750_000;
export const METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 96;
const MAX_DIAGNOSTICS = 200;


export function detectFormat(text: string, fileName = ""): SpecFormat {
  if (/\.json$/i.test(fileName)) return "json";
  if (/\.ya?ml$/i.test(fileName)) return "yaml";
  return /^\s*[{[]/.test(text) ? "json" : "yaml";
}


function emptyAnalysis(format: SpecFormat, diagnostics: Diagnostic[]): SpecAnalysis {
  diagnostics.sort(
    (left, right) =>
      (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1) ||
      (left.line ?? 0) - (right.line ?? 0),
  );
  return {
    format,
    spec: null,
    version: "",
    title: "",
    apiVersion: "",
    diagnostics,
    operations: [],
    schemas: [],
    security: [],
    servers: [],
  };
}

function inspectStructure(
  value: unknown,
  locate: Locator,
  add: (diagnostic: Diagnostic) => void,
  refs: { ref: string; pointer: (string | number)[] }[],
) {
  const stack: { value: unknown; pointer: (string | number)[] }[] = [
    { value, pointer: [] },
  ];
  let nodes = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++nodes > 400_000) throw new Error("规格节点数量超过 400,000。");
    if (current.pointer.length > MAX_DEPTH) {
      add({
        severity: "error",
        message: `嵌套超过 ${MAX_DEPTH} 层，无法安全显示。`,
        ...locate(current.pointer),
      });
      return;
    }
    if (Array.isArray(current.value)) {
      current.value.forEach((item, index) =>
        stack.push({ value: item, pointer: [...current.pointer, index] }),
      );
      continue;
    }
    if (!isObject(current.value)) continue;
    for (const key of Object.keys(current.value)) {
      const pointer = [...current.pointer, key];
      if (FORBIDDEN.has(key)) {
        add({
          severity: "error",
          message: `不支持属性名 ${key}。`,
          ...locate(pointer),
        });
        continue;
      }
      const item = current.value[key];
      if (key === "$ref" && typeof item === "string") refs.push({ ref: item, pointer });
      else if (key === "$ref")
        add({ severity: "warning", message: "$ref 需要是字符串。", ...locate(pointer) });
      if (typeof item === "object" && item !== null) stack.push({ value: item, pointer });
    }
  }
}

function analyzeUncached(text: string, format: SpecFormat): SpecAnalysis {
  if (text.length > SOURCE_LIMIT)
    return emptyAnalysis(format, [
      {
        severity: "error",
        message: `规格原文超过 ${SOURCE_LIMIT.toLocaleString("en-US")} 个字符（约 730 KB），请拆分或精简后再导入。`,
      },
    ]);
  if (!text.trim())
    return emptyAnalysis(format, [
      { severity: "error", message: "规格为空。", line: 1, column: 1 },
    ]);
  const starts = lineStarts(text);
  const parsed = syntax(text, format, starts);
  const diagnostics = parsed.diagnostics;
  if (parsed.value === undefined) return emptyAnalysis(format, diagnostics);
  const locate = makeLocator(parsed.doc, starts);
  const add = (diagnostic: Diagnostic) => {
    if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push(diagnostic);
  };
  const root = parsed.value;
  if (!isObject(root)) {
    add({ severity: "error", message: "根节点必须是对象（映射）。", line: 1, column: 1 });
    return emptyAnalysis(format, diagnostics);
  }
  const refs: { ref: string; pointer: (string | number)[] }[] = [];
  try {
    inspectStructure(root, locate, add, refs);
  } catch (error) {
    add({
      severity: "error",
      message: error instanceof Error ? error.message : "规格结构过大。",
    });
  }
  // 版本
  let version = "";
  let swagger2 = false;
  const spec: Record<string, unknown> = { ...root };
  if (typeof root.openapi === "string") {
    if (/^3\.[012]\.\d+(?:-[\w.]+)?$/.test(root.openapi)) version = root.openapi;
    else
      add({
        severity: "error",
        message: `不支持 openapi: ${root.openapi}。Swagger UI 5.34 支持 OpenAPI 3.0、3.1、3.2 与 Swagger 2.0。`,
        ...locate(["openapi"], false),
      });
  } else if (root.openapi !== undefined) {
    add({
      severity: "error",
      message: 'openapi 版本需写成字符串，例如 openapi: "3.0.3"。',
      ...locate(["openapi"], false),
    });
  } else if (root.swagger === "2.0") {
    version = "2.0";
    swagger2 = true;
  } else if (root.swagger === 2) {
    version = "2.0";
    swagger2 = true;
    spec.swagger = "2.0";
    add({
      severity: "warning",
      message: 'swagger 版本被解析为数字 2，预览按 "2.0" 处理；建议写成 swagger: "2.0"。',
      ...locate(["swagger"], false),
    });
  } else if (root.swagger !== undefined) {
    add({
      severity: "error",
      message: `不支持 swagger: ${String(root.swagger)}，只支持 Swagger 2.0。`,
      ...locate(["swagger"], false),
    });
  } else {
    add({
      severity: "error",
      message: "缺少 openapi（3.x）或 swagger（2.0）版本字段。",
      line: 1,
      column: 1,
    });
  }
  // info
  const info = root.info;
  let title = "",
    apiVersion = "";
  if (!isObject(info))
    add({ severity: "error", message: "缺少 info 对象。", ...locate(["info"]) });
  else {
    if (typeof info.title === "string" && info.title.trim()) title = info.title.trim();
    else
      add({
        severity: "error",
        message: "info.title 需要是非空字符串。",
        ...locate(info.title === undefined ? ["info"] : ["info", "title"]),
      });
    if (typeof info.version === "string") apiVersion = info.version;
    else if (typeof info.version === "number") {
      apiVersion = String(info.version);
      add({
        severity: "warning",
        message: `info.version 被解析为数字 ${info.version}，建议加引号写成字符串。`,
        ...locate(["info", "version"], false),
      });
    } else
      add({ severity: "warning", message: "缺少 info.version。", ...locate(["info"]) });
  }
  // paths
  const paths = root.paths;
  const is31 = /^3\.[12]\./.test(version);
  if (paths === undefined) {
    if (!is31 || (!isObject(root.webhooks) && !isObject(root.components)))
      add({
        severity: "error",
        message: is31
          ? "OpenAPI 3.1 需要 paths、webhooks 或 components 中至少一项。"
          : "缺少 paths 对象。",
        line: 1,
        column: 1,
      });
  } else if (!isObject(paths))
    add({ severity: "error", message: "paths 需要是对象。", ...locate(["paths"]) });

  const operations: OperationEntry[] = [];
  const operationIds = new Map<string, string>();
  if (isObject(paths)) {
    for (const [path, item] of Object.entries(paths)) {
      if (!path.startsWith("/") && !path.startsWith("x-"))
        add({
          severity: "warning",
          message: `路径 ${path} 应以 / 开头。`,
          ...locate(["paths", path]),
        });
      if (!isObject(item)) continue;
      const pathParams = Array.isArray(item.parameters) ? item.parameters : [];
      for (const method of METHODS) {
        const operation = item[method];
        if (!isObject(operation)) continue;
        const pointer = ["paths", path, method];
        const tags = Array.isArray(operation.tags)
          ? operation.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        const operationId =
          typeof operation.operationId === "string" ? operation.operationId : "";
        operations.push({
          method,
          path,
          tags: tags.length ? tags : ["default"],
          summary: typeof operation.summary === "string" ? operation.summary : "",
          operationId,
          deprecated: operation.deprecated === true,
          ...locate(pointer),
        });
        if (operationId) {
          const previous = operationIds.get(operationId);
          if (previous)
            add({
              severity: "warning",
              message: `operationId ${operationId} 与 ${previous} 重复。`,
              ...locate([...pointer, "operationId"], false),
            });
          else operationIds.set(operationId, `${method.toUpperCase()} ${path}`);
        }
        if (!is31 && !isObject(operation.responses))
          add({
            severity: "warning",
            message: `${method.toUpperCase()} ${path} 缺少 responses。`,
            ...locate(pointer),
          });
        const params = [
          ...pathParams,
          ...(Array.isArray(operation.parameters) ? operation.parameters : []),
        ]
          .map((param) =>
            isObject(param) && typeof param.$ref === "string" && param.$ref.startsWith("#")
              ? resolvePointer(root, param.$ref)
              : param,
          )
          .filter(isObject);
        const declared = new Set(
          params
            .filter((param) => param.in === "path" && typeof param.name === "string")
            .map((param) => String(param.name)),
        );
        for (const match of path.matchAll(/\{([^}]+)\}/g))
          if (!declared.has(match[1]))
            add({
              severity: "warning",
              message: `${method.toUpperCase()} ${path} 没有声明路径参数 ${match[1]}。`,
              ...locate(pointer),
            });
      }
    }
  }
  if (isObject(paths) && !operations.length && version)
    add({ severity: "warning", message: "paths 中还没有端点。", ...locate(["paths"]) });

  // $ref
  for (const { ref, pointer } of refs) {
    if (ref.startsWith("#")) {
      if (resolvePointer(root, ref) === undefined)
        add({
          severity: "warning",
          message: `找不到引用目标 ${ref}。`,
          ...locate(pointer, false),
        });
    } else
      add({
        severity: "warning",
        message: `外部引用 ${ref.slice(0, 120)} 不会被加载；请把被引用内容合并到同一文件。`,
        ...locate(pointer, false),
      });
  }

  const components = isObject(root.components) ? root.components : {};
  const security = collectSecurity(root, swagger2, locate, add);
  const servers = collectServers(root, swagger2, locate, add);
  const schemaSource = swagger2 ? root.definitions : components.schemas;
  const schemas = isObject(schemaSource) ? Object.keys(schemaSource) : [];
  diagnostics.sort(
    (left, right) =>
      (left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1) ||
      (left.line ?? 0) - (right.line ?? 0),
  );
  const failed = diagnostics.some((item) => item.severity === "error");
  return {
    format,
    spec: failed ? null : spec,
    version,
    title,
    apiVersion,
    diagnostics,
    operations,
    schemas,
    security,
    servers,
  };
}

const cache = new Map<string, SpecAnalysis>();
/** 同一原文重复分析时复用结果（客户端每次渲染、服务端每次保存都会调用）。 */
export function analyzeSpec(text: string, format: SpecFormat): SpecAnalysis {
  const key = format + "\u0000" + text;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const result = analyzeUncached(text, format);
  cache.set(key, result);
  while (cache.size > 6) cache.delete(cache.keys().next().value!);
  return result;
}

export function describe(diagnostic: Diagnostic): string {
  return (
    (diagnostic.line ? `第 ${diagnostic.line} 行：` : "") + diagnostic.message
  );
}

/** 在 YAML 与 JSON 之间转换。YAML 注释不会进入 JSON。 */
export function convertSource(spec: Record<string, unknown>, to: SpecFormat): string {
  return to === "json"
    ? JSON.stringify(spec, null, 2) + "\n"
    : stringify(spec, { lineWidth: 0, aliasDuplicateObjects: false });
}
