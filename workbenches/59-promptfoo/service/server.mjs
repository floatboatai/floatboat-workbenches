// ABOUTME: 可选的官方 promptfoo 0.125.1 交叉核对执行器：用真实 evaluate 重跑工作台配置（echo 与录制回放列）。
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfigText, normalizeConfig, baseType, isLocalAssertion } from "../app/src/contracts/config.ts";
import { recordingKey } from "../app/src/contracts/results.ts";
process.env.PROMPTFOO_DISABLE_TELEMETRY = "1";
process.env.PROMPTFOO_DISABLE_UPDATE = "1";
process.env.PROMPTFOO_CONFIG_DIR ??= resolve(".local/promptfoo");
const { evaluate } = await import("promptfoo");
const idValue = (v) => {
  if (typeof v !== "string" || !/^eval-[a-f0-9-]{36}$/.test(v)) throw new Error("Invalid job ID");
  return v;
};
const MAX_BODY = 30_000_000;

/** 把工作台配置翻译成 promptfoo evaluate 的 TestSuite；本机脚本与 Floatboat 模型列不交给官方执行器。 */
export function officialSuite(configText, recordings, allowJavascript) {
  const suite = normalizeConfig(parseConfigText(configText));
  const assertions = suite.tests.flatMap((t) => t.assert.flatMap((a) => a.assert ? a.assert : [a]));
  const unsupported = assertions.filter((a) => !isLocalAssertion(a.type));
  if (unsupported.length) throw new Error(`官方核对仅执行确定性断言；请移除外部评分断言：${[...new Set(unsupported.map((a) => a.type))].join("、")}`);
  const usesJs = suite.tests.some(
    (t) => t.options.transform || t.assert.flatMap((a) => (a.assert ? [a, ...a.assert] : [a])).some((a) => baseType(a.type) === "javascript" || a.transform),
  );
  if (usesJs && !allowJavascript)
    throw new Error("配置含 javascript 断言或 transform；官方 promptfoo 会在执行器进程内直接运行这些代码。确认来源可信后以 PROMPTFOO_RUNNER_ALLOW_JS=1 启动执行器。");
  const rec = new Map(recordings);
  const skipped = suite.providers.filter((p) => p.kind === "script" || p.kind === "host").map((p) => p.label);
  const providers = suite.providers
    .filter((p) => p.kind === "echo" || p.kind === "replay")
    .map((p) =>
      p.kind === "echo"
        ? { id: "echo", label: p.label }
        : {
            id: () => p.id,
            label: p.label,
            config: p.config,
            callApi: async (prompt) => {
              const hit = rec.get(recordingKey(p.replayOf, prompt));
              if (!hit) return { error: `No recorded output for ${p.replayOf}` };
              return {
                output: hit.output,
                ...(hit.latencyMs !== null ? { latencyMs: hit.latencyMs } : {}),
                ...(hit.cost !== null ? { cost: hit.cost } : {}),
                ...(hit.tokenUsage ? { tokenUsage: hit.tokenUsage } : {}),
                ...(hit.finishReason ? { finishReason: hit.finishReason } : {}),
              };
            },
          },
    );
  if (!providers.length) throw new Error("没有可交给官方执行器的列（需要 echo 或录制回放 provider）。");
  const providerPromptMap = {};
  for (const p of suite.providers) if (p.prompts && (p.kind === "echo" || p.kind === "replay")) providerPromptMap[p.label] = p.prompts;
  return {
    skipped,
    testSuite: {
      description: suite.description,
      prompts: suite.prompts.map((p) => ({ raw: p.raw, label: p.label })),
      providers,
      ...(Object.keys(providerPromptMap).length ? { providerPromptMap } : {}),
      tests: suite.tests.map((t) => ({
        ...(t.description ? { description: t.description } : {}),
        vars: t.vars,
        assert: t.assert,
        ...(t.threshold !== undefined ? { threshold: t.threshold } : {}),
        options: { ...t.options, disableVarExpansion: true },
        metadata: t.metadata,
      })),
    },
    config: parseConfigText(configText),
  };
}

export function createService({
  databasePath = resolve(".local/runner.sqlite"),
  token = process.env.PROMPTFOO_RUNNER_TOKEN,
  allowJavascript = process.env.PROMPTFOO_RUNNER_ALLOW_JS === "1",
  evaluator = evaluate,
} = {}) {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs2(id TEXT PRIMARY KEY,digest TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,report TEXT,error TEXT NOT NULL DEFAULT '',created TEXT NOT NULL); UPDATE jobs2 SET state='interrupted',error='Runner restarted before completion' WHERE state IN ('queued','running');",
  );
  let chain = Promise.resolve();
  const get = (id) => {
    const r = db.prepare("SELECT id,state,report,error FROM jobs2 WHERE id=?").get(idValue(id));
    return r ? { id: r.id, state: r.state, report: r.report ? JSON.parse(r.report) : null, error: r.error } : null;
  };
  async function run(id, payload) {
    db.prepare("UPDATE jobs2 SET state='running' WHERE id=?").run(id);
    try {
      const { testSuite, config, skipped } = officialSuite(payload.config, payload.recordings, allowJavascript);
      const record = await evaluator(testSuite, { writeLatestResults: false, showProgressBar: false, cache: false, maxConcurrency: 4 });
      const summary = await record.toEvaluateSummary();
      const report = {
        evalId: `official-${id.slice(5, 13)}`,
        results: summary,
        config,
        shareableUrl: null,
        metadata: { producer: "promptfoo", promptfooVersion: "0.125.1", skippedProviders: skipped },
      };
      db.prepare("UPDATE jobs2 SET state='completed',report=?,error='' WHERE id=?").run(JSON.stringify(report), id);
    } catch (error) {
      console.error(`Evaluation ${id} failed: ${error instanceof Error ? error.message : "Error"}`);
      db.prepare("UPDATE jobs2 SET state='failed',error=? WHERE id=?").run(
        error instanceof Error ? error.message.slice(0, 800) : "Evaluation failed",
        id,
      );
    }
  }
  function submit(id, input) {
    idValue(id);
    if (!input || typeof input.config !== "string" || !Array.isArray(input.recordings)) throw new Error("Invalid payload");
    officialSuite(input.config, input.recordings, allowJavascript);
    const payload = JSON.stringify({ config: input.config, recordings: input.recordings });
    const digest = createHash("sha256").update(payload).digest("hex"),
      old = db.prepare("SELECT digest FROM jobs2 WHERE id=?").get(id);
    if (old) {
      if (old.digest !== digest) throw new Error("Idempotency mismatch");
      return get(id);
    }
    const queue = db.prepare("SELECT COUNT(*) AS n FROM jobs2 WHERE state IN ('queued','running')").get().n;
    if (queue >= 4) throw new Error("Runner queue is full");
    db.prepare("INSERT INTO jobs2(id,digest,payload,state,created) VALUES(?,?,?,'queued',?)").run(id, digest, payload, new Date().toISOString());
    const parsed = JSON.parse(payload);
    chain = chain.then(() => run(id, parsed));
    return get(id);
  }
  const server = createServer(async (req, res) => {
    const send = (code, value) => {
      res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.origin) return send(403, { error: "Browser access is disabled; use the workbench connector" });
      if (token && req.headers.authorization !== `Bearer ${token}`) return send(401, { error: "Authentication required" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health")
        return send(200, { service: "floatboat-promptfoo-runner", version: "0.125.1", protocol: 2, allowJavascript });
      if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
        const job = get(url.pathname.slice(6));
        return send(job ? 200 : 404, job ?? { error: "Job not found" });
      }
      if (req.method === "POST" && url.pathname === "/jobs") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) {
            send(413, { error: "Request too large" });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        return send(202, submit(body.id, body));
      }
      send(404, { error: "Route not found" });
    } catch (e) {
      send(400, { error: e instanceof Error ? e.message.slice(0, 600) : "Invalid request" });
    }
  });
  return { server, get, submit, drain: () => chain, close: () => db.close() };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const service = createService();
  const port = Number(process.env.PROMPTFOO_RUNNER_PORT ?? 8770);
  service.server.listen(port, "127.0.0.1", () => console.log(`Promptfoo runner: http://127.0.0.1:${port}`));
  const stop = () => {
    service.server.close();
    void service.drain().finally(() => {
      service.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
