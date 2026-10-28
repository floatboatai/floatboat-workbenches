import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord } from "../contracts/project.ts";
import { designValue } from "../contracts/design.ts";
import { viewFile, transform } from "./engine.ts";
export function registerDesignRoutes(app: WorkbenchServer) {
  for (const mode of ["preview", "edit"] as const)
    app.route("POST", "/api/" + mode, async ({ body }) => {
      try {
        if (!isRecord(body)) throw new Error("设计请求无效。");
        const { file } = designValue({ file: body.file, notes: "" });
        const page = typeof body.pageId === "string" ? body.pageId : undefined;
        return mode === "preview"
          ? await viewFile(file, page)
          : await transform(file, body.action, page);
      } catch (error) {
        return Response.json(
          {
            error: {
              message:
                error instanceof Error
                  ? error.message.slice(0, 250)
                  : "无法读取设计文件。",
            },
          },
          { status: 400 },
        );
      }
    });
}
