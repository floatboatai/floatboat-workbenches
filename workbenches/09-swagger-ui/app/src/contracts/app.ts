// ABOUTME: 页面和服务端共用的应用信息契约及响应校验。

export interface AppInfo {
  name: string;
  version: string;
  platform: "connected" | "not-connected" | "unavailable";
}

export function isAppInfo(value: unknown): value is AppInfo {
  return (
    value !== null &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string" &&
    "version" in value &&
    typeof value.version === "string" &&
    "platform" in value &&
    typeof value.platform === "string" &&
    ["connected", "not-connected", "unavailable"].includes(value.platform)
  );
}
