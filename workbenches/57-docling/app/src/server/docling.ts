import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { boundedText, isRecord } from "../contracts/project.ts";
import { parseDocument } from "../contracts/document.ts";
import { jobValue, type Job, type JobState } from "../contracts/jobs.ts";
const safeId = /^[a-zA-Z0-9-]{8,80}$/;
export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.DOCLING_SERVE_URL;
  if (!raw) return null;
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "DOCLING_SERVE_URL 需要无路径、无凭据的 HTTP(S) 服务地址。",
    );
  return { base: url.origin, key: env.DOCLING_SERVE_API_KEY ?? "" };
}
export function statusValue(v: unknown): { id: string; state: JobState } {
  if (
    !isRecord(v) ||
    typeof v.task_id !== "string" ||
    !safeId.test(v.task_id) ||
    typeof v.task_status !== "string"
  )
    throw new Error("服务返回的任务格式无效。");
  const mapping: Record<string, JobState> = {
    pending: "pending",
    started: "running",
    running: "running",
    success: "running",
    partial_success: "running",
    failure: "failure",
    skipped: "failure",
  };
  const state = mapping[v.task_status];
  if (!state) throw new Error("服务返回未知任务状态。");
  return { id: v.task_id, state };
}
async function boundedJson(response: Response) {
  if (!response.body) throw new Error("服务返回空响应。");
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1000000) {
      await reader.cancel();
      throw new Error("转换结果超过 1 MB；请在服务端拆分文档。");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("服务返回的内容不是有效 JSON。");
  }
}
export function createJobs(
  db: DatabaseSync,
  path: (name: string, write?: boolean) => Promise<string>,
  config: ReturnType<typeof configuration>,
  transport: typeof fetch = fetch,
) {
  const hash = (s: string) => createHash("sha256").update(s).digest("hex"),
    serviceHash = config ? hash(config.base) : "";
  db.prepare(
    "UPDATE docling_operations SET state='uncertain',message='连接中断，提交结果不确定。请核对上游任务，不会自动重交。' WHERE state='submitting'",
  ).run();
  db.prepare(
    "UPDATE docling_operations SET state='failure',message='写入输入时中断；尚未提交到服务。' WHERE state='preparing'",
  ).run();
  const get = (id: string): Job => {
    const row = db
      .prepare(
        "SELECT id,filename,input_hash AS inputHash,task_id AS taskId,state,message,created_at AS createdAt,updated_at AS updatedAt FROM docling_operations WHERE id=?",
      )
      .get(id);
    if (!row) throw new Error("转换记录不存在。");
    return jobValue(row);
  };
  const update = (
    id: string,
    state: JobState,
    message: string,
    taskId?: string,
  ) => {
    db.prepare(
      "UPDATE docling_operations SET state=?,message=?,task_id=COALESCE(?,task_id),updated_at=? WHERE id=?",
    ).run(state, message, taskId ?? null, new Date().toISOString(), id);
    return get(id);
  };
  const ensure = (id: string) => {
    if (!config)
      throw new Error("尚未配置 Docling Serve。请设置服务端环境后重启。");
    const row = db
      .prepare("SELECT service_hash FROM docling_operations WHERE id=?")
      .get(id);
    if (row && row.service_hash !== serviceHash)
      throw new Error("此任务属于另一个服务地址，请恢复原服务配置后继续。");
  };
  const fetchApi = async (route: string, init: RequestInit = {}) => {
    if (!config) throw new Error("Docling Serve 未配置。");
    return transport(config.base + route, {
      ...init,
      headers: {
        ...(config.key ? { "X-Api-Key": config.key } : {}),
        ...init.headers,
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  };
  const polling = new Map<string, Promise<Job>>();
  const poll = async (id: string): Promise<Job> => {
    ensure(id);
    const job = get(id);
    if (!job.taskId || ["success", "failure", "paused"].includes(job.state))
      return job;
    const finish = (state: JobState, message: string) =>
      get(id).state === "paused" ? get(id) : update(id, state, message);
    try {
      const response = await fetchApi(
        "/v1/status/poll/" + encodeURIComponent(job.taskId),
      );
      if (!response.ok)
        throw new Error(
          "无法查询任务（HTTP " + response.status + "），请重试刷新。",
        );
      const raw = await boundedJson(response),
        status = statusValue(raw);
      if (status.id !== job.taskId) throw new Error("服务任务 ID 不匹配。");
      if (
        isRecord(raw) &&
        ["success", "partial_success"].includes(String(raw.task_status))
      ) {
        const result = await fetchApi(
          "/v1/result/" + encodeURIComponent(job.taskId),
        );
        if (!result.ok) throw new Error("结果尚不可读取，请稍后刷新。");
        const payload = await boundedJson(result);
        if (!isRecord(payload) || !isRecord(payload.document))
          throw new Error(
            "需要 inline Docling JSON 结果；当前服务输出类型不受支持。",
          );
        const doc = parseDocument(payload.document.json_content);
        const target = await path(id + ".result.json", true),
          temp = await path(id + ".result.tmp", true);
        await writeFile(temp, JSON.stringify(doc), "utf8");
        await rename(temp, target);
        return finish(
          "success",
          raw.task_status === "partial_success"
            ? "转换部分完成，请逐项核对。结果可作为新项目打开。"
            : "转换完成，可作为新项目打开。",
        );
      }
      return finish(
        status.state,
        status.state === "failure"
          ? "上游转换失败。请检查服务日志，再以新操作提交。"
          : status.state === "pending"
            ? "等待 Docling 转换…"
            : "Docling 正在转换…",
      );
    } catch (error) {
      return finish(
        "paused",
        "跟踪已暂停：" +
          (error instanceof Error ? error.message : "无法读取状态。") +
          " 可恢复跟踪重试。",
      );
    }
  };
  return {
    list: () =>
      db
        .prepare(
          "SELECT id,filename,input_hash AS inputHash,task_id AS taskId,state,message,created_at AS createdAt,updated_at AS updatedAt FROM docling_operations ORDER BY created_at DESC LIMIT 50",
        )
        .all()
        .map(jobValue),
    get,
    async health() {
      if (!config)
        return {
          configured: false,
          reachable: false,
          message: "未连接转换服务 · 可直接导入 Docling JSON",
        };
      try {
        const r = await fetchApi("/health");
        return {
          configured: true,
          reachable: r.ok,
          message: r.ok
            ? "Docling Serve 已连接"
            : "服务健康检查失败（HTTP " + r.status + "）",
        };
      } catch {
        return {
          configured: true,
          reachable: false,
          message: "无法连接 Docling Serve，请检查服务地址。",
        };
      }
    },
    async submit(value: unknown) {
      if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        !safeId.test(value.id)
      )
        throw new Error("操作 ID 无效。");
      ensure(value.id);
      const id = value.id,
        html = boundedText(value.html, 400000),
        filename = boundedText(value.filename, 120);
      if (
        !/\.html?$/i.test(filename) ||
        !html.trim() ||
        Buffer.byteLength(html) > 400000
      )
        throw new Error("请选择小于 400 KB 的 HTML 文件。");
      const exists = db
        .prepare("SELECT id,input_hash FROM docling_operations WHERE id=?")
        .get(id);
      if (exists) {
        if (exists.input_hash !== hash(html))
          throw new Error("操作 ID 已用于不同输入。");
        return get(id);
      }
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO docling_operations(id,filename,input_hash,service_hash,state,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        id,
        filename,
        hash(html),
        serviceHash,
        "preparing",
        "正在保存输入快照…",
        now,
        now,
      );
      try {
        await writeFile(await path(id + ".input.html", true), html, {
          encoding: "utf8",
          flag: "wx",
        });
      } catch {
        return update(id, "failure", "无法保存输入文件，尚未提交到服务。");
      }
      update(id, "submitting", "正在提交，关闭页面不会重交。");
      try {
        const form = new FormData();
        form.append("files", new Blob([html], { type: "text/html" }), filename);
        form.append("to_formats", "json");
        form.append("image_export_mode", "placeholder");
        form.append("do_ocr", "false");
        form.append("target_type", "inbody");
        const response = await fetchApi("/v1/convert/file/async", {
          method: "POST",
          body: form,
        });
        if (!response.ok)
          return update(
            id,
            response.status >= 400 && response.status < 500
              ? "failure"
              : "uncertain",
            "提交返回 HTTP " +
              response.status +
              "。请检查服务记录；不会自动重交。",
          );
        const status = statusValue(await boundedJson(response));
        return update(id, status.state, "已提交，请刷新任务状态。", status.id);
      } catch {
        return update(
          id,
          "uncertain",
          "提交结果不确定。请从服务日志查找任务 ID 后关联；不会自动重交。",
        );
      }
    },
    refresh(id: string) {
      const existing = polling.get(id);
      if (existing) return existing;
      const promise = poll(id).finally(() => polling.delete(id));
      polling.set(id, promise);
      return promise;
    },
    async attach(id: string, taskId: unknown) {
      ensure(id);
      const job = get(id);
      if (
        job.state !== "uncertain" ||
        typeof taskId !== "string" ||
        !safeId.test(taskId)
      )
        throw new Error("只能为不确定的提交关联有效任务 ID。");
      const response = await fetchApi(
        "/v1/status/poll/" + encodeURIComponent(taskId),
      );
      if (!response.ok) throw new Error("上游没有找到此任务，请核对任务 ID。");
      const task = statusValue(await boundedJson(response));
      if (task.id !== taskId) throw new Error("任务 ID 不匹配。");
      return update(id, task.state, "已关联上游任务，请刷新。", task.id);
    },
    pause(id: string) {
      const job = get(id);
      if (!["pending", "running"].includes(job.state))
        throw new Error("此任务不能暂停本地跟踪。");
      return update(id, "paused", "已暂停本地跟踪，上游转换仍会继续。");
    },
    resume(id: string) {
      const job = get(id);
      if (job.state !== "paused") throw new Error("任务尚未暂停。");
      return update(id, "running", "已恢复跟踪，请刷新状态。");
    },
    async result(id: string) {
      if (get(id).state !== "success") throw new Error("转换结果尚未就绪。");
      return parseDocument(
        JSON.parse(await readFile(await path(id + ".result.json"), "utf8")),
      );
    },
  };
}
export function registerDocling(app: WorkbenchServer) {
  let config: ReturnType<typeof configuration> = null;
  let configError = "";
  try {
    config = configuration();
  } catch (error) {
    configError = error instanceof Error ? error.message : "转换服务配置无效。";
  }
  const jobs = createJobs(
    app.database,
    (name, write) =>
      app.resources.path("documents", name, write ? "write" : "read"),
    config,
  );
  const failure = (e: unknown) =>
    Response.json(
      { error: { message: e instanceof Error ? e.message : "转换操作失败。" } },
      { status: 400 },
    );
  app.route("GET", "/api/docling", () =>
    configError
      ? { configured: false, reachable: false, message: configError }
      : jobs.health(),
  );
  app.route("GET", "/api/docling/jobs", () => jobs.list());
  app.route("POST", "/api/docling/jobs", async ({ body }) => {
    try {
      return await jobs.submit(body);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/docling/jobs/:id/refresh", async ({ params }) => {
    try {
      return await jobs.refresh(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route(
    "POST",
    "/api/docling/jobs/:id/attach",
    async ({ params, body }) => {
      try {
        return await jobs.attach(
          params.id,
          isRecord(body) ? body.taskId : undefined,
        );
      } catch (e) {
        return failure(e);
      }
    },
  );
  app.route("POST", "/api/docling/jobs/:id/pause", ({ params }) => {
    try {
      return jobs.pause(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("POST", "/api/docling/jobs/:id/resume", ({ params }) => {
    try {
      return jobs.resume(params.id);
    } catch (e) {
      return failure(e);
    }
  });
  app.route("GET", "/api/docling/jobs/:id/result", async ({ params }) => {
    try {
      return await jobs.result(params.id);
    } catch (e) {
      return failure(e);
    }
  });
}
