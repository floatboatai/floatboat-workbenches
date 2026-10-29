// ABOUTME: 从规格中整理认证方案与服务器地址，并给出相应警告。
import { isObject, type Add, type Locator, type Pointer } from "./openapi-source.ts";

export interface SecurityEntry {
  name: string;
  detail: string;
}
export interface ServerEntry {
  url: string;
  description: string;
}
const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

export function collectSecurity(
  root: Record<string, unknown>,
  swagger2: boolean,
  locate: Locator,
  add: Add,
): SecurityEntry[] {
  const paths = root.paths;
  const components = isObject(root.components) ? root.components : {};
  const schemesSource = swagger2 ? root.securityDefinitions : components.securitySchemes;
  const security: SecurityEntry[] = [];
  const schemeNames = new Set<string>();
  if (isObject(schemesSource))
    for (const [name, scheme] of Object.entries(schemesSource)) {
      schemeNames.add(name);
      if (!isObject(scheme)) continue;
      const type = String(scheme.type ?? "");
      const detail =
        type === "http"
          ? `HTTP ${String(scheme.scheme ?? "")}${scheme.bearerFormat ? " · " + String(scheme.bearerFormat) : ""}`
          : type === "apiKey"
            ? `API Key · ${String(scheme.in ?? "")} ${String(scheme.name ?? "")}`
            : type === "basic"
              ? "HTTP Basic"
              : type === "oauth2"
                ? "OAuth 2.0"
                : type === "openIdConnect"
                  ? "OpenID Connect"
                  : type || "未知类型";
      security.push({ name, detail });
    }
  const checkRequirements = (value: unknown, pointer: Pointer) => {
    if (!Array.isArray(value)) return;
    value.forEach((requirement, index) => {
      if (!isObject(requirement)) return;
      for (const name of Object.keys(requirement))
        if (!schemeNames.has(name))
          add({
            severity: "warning",
            message: `安全要求引用了未定义的方案 ${name}。`,
            ...locate([...pointer, index, name]),
          });
    });
  };
  checkRequirements(root.security, ["security"]);
  if (isObject(paths))
    for (const [path, item] of Object.entries(paths))
      if (isObject(item))
        for (const method of METHODS)
          if (isObject(item[method]))
            checkRequirements((item[method] as Record<string, unknown>).security, [
              "paths",
              path,
              method,
              "security",
            ]);

  return security;
}

export function collectServers(
  root: Record<string, unknown>,
  swagger2: boolean,
  locate: Locator,
  add: Add,
): ServerEntry[] {
  const servers: ServerEntry[] = [];
  if (swagger2) {
    const host = typeof root.host === "string" ? root.host : "";
    const basePath = typeof root.basePath === "string" ? root.basePath : "";
    const schemes = Array.isArray(root.schemes)
      ? root.schemes.filter((scheme): scheme is string => typeof scheme === "string")
      : ["https"];
    if (host)
      for (const scheme of schemes.length ? schemes : ["https"])
        servers.push({ url: `${scheme}://${host}${basePath}`, description: "" });
    else {
      servers.push({ url: basePath || "/", description: "未声明 host" });
      add({
        severity: "warning",
        message: "Swagger 2.0 未声明 host，试调会指向工作台本身；请填写真实 host。",
        line: 1,
        column: 1,
      });
    }
  } else if (Array.isArray(root.servers)) {
    root.servers.forEach((server, index) => {
      if (!isObject(server) || typeof server.url !== "string") {
        add({
          severity: "warning",
          message: "servers 项需要 url 字符串。",
          ...locate(["servers", index]),
        });
        return;
      }
      servers.push({
        url: server.url,
        description: typeof server.description === "string" ? server.description : "",
      });
      if (
        !/^[a-z][a-z\d+.-]*:\/\//i.test(server.url) &&
        !/^\{[^}]+\}/.test(server.url) &&
        !/^\/api\/(?:sample|demo)(?:\/|$)/.test(server.url)
      )
        add({
          severity: "warning",
          message: `相对服务器地址 ${server.url} 会指向本工作台，试调前请改成完整的 https:// 地址。`,
          ...locate(["servers", index, "url"], false),
        });
    });
  }
  return servers;
}
