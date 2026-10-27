// ABOUTME: 提供应用公开信息，不向页面暴露 Host 凭据。

import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import type { AppInfo } from "../contracts/app";
import { WorkbenchHostError } from "../../sdk/host.mjs";

export function registerAppRoute(app: WorkbenchServer): void {
  app.route("GET", "/api/app", async (): Promise<AppInfo> => {
    let platform: AppInfo["platform"] = "connected";
    try {
      await app.host.capabilities.list();
    } catch (error) {
      platform =
        error instanceof WorkbenchHostError &&
        error.code === "HOST_NOT_CONNECTED"
          ? "not-connected"
          : "unavailable";
    }
    return { name: app.manifest.name, version: app.manifest.version, platform };
  });
}
