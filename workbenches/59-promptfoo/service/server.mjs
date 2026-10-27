import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateSuite,
  parseEvaluation,
} from "../app/src/contracts/evaluation.ts";
process.env.PROMPTFOO_DISABLE_TELEMETRY = "1";
process.env.PROMPTFOO_CONFIG_DIR ??= resolve(".local/promptfoo");
const { evaluate } = await import("promptfoo");
const idValue = (v) => {
  if (typeof v !== "string" || !/^eval-[a-f0-9-]{36}$/.test(v))
    throw new Error("Invalid job ID");
  return v;
};
export function createService({
  databasePath = resolve(".local/runner.sqlite"),
  token = process.env.PROMPTFOO_RUNNER_TOKEN,
  modelUrl = process.env.EVAL_MODEL_URL,
  modelKey = process.env.EVAL_MODEL_KEY,
  modelName = process.env.EVAL_MODEL_NAME,
  evaluator = evaluate,
} = {}) {
  if (databasePath !== ":memory:")
    mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,suite TEXT NOT NULL,state TEXT NOT NULL,report TEXT,error TEXT NOT NULL DEFAULT '',created TEXT NOT NULL); UPDATE jobs SET state='interrupted',error='Runner restarted before completion' WHERE state IN ('queued','running');",
  );
  let modelEndpoint = null;
  if (modelUrl) {
    modelEndpoint = new URL(modelUrl);
    if (
      modelEndpoint.username ||
      modelEndpoint.password ||
      modelEndpoint.hash ||
      !["https:", "http:"].includes(modelEndpoint.protocol) ||
      (modelEndpoint.protocol === "http:" &&
        !["127.0.0.1", "localhost", "[::1]"].includes(modelEndpoint.hostname))
    )
      throw new Error("Invalid model endpoint");
  }
  const modelConfigured = Boolean(modelEndpoint && modelName);
  let chain = Promise.resolve();
  const get = (id) => {
    const r = db
      .prepare("SELECT id,state,report,error FROM jobs WHERE id=?")
      .get(idValue(id));
    return r
      ? {
          id: r.id,
          state: r.state,
          report: r.report ? JSON.parse(r.report) : null,
          error: r.error,
        }
      : null;
  };
  async function run(id, suite) {
    db.prepare("UPDATE jobs SET state='running' WHERE id=?").run(id);
    try {
      const provider =
        suite.mode === "echo"
          ? {
              id: () => "echo (no model)",
              callApi: async (prompt) => ({ output: prompt }),
            }
          : {
              id: () => `configured-model:${modelName}`,
              callApi: async (prompt) => {
                const response = await fetch(modelEndpoint, {
                  method: "POST",
                  redirect: "error",
                  signal: AbortSignal.timeout(90000),
                  headers: {
                    "content-type": "application/json",
                    ...(modelKey
                      ? { authorization: `Bearer ${modelKey}` }
                      : {}),
                  },
                  body: JSON.stringify({
                    model: modelName,
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 1000,
                    temperature: 0,
                  }),
                });
                if (!response.ok)
                  throw new Error(`Model request failed (${response.status})`);
                const reader = response.body.getReader();
                const chunks = [];
                let size = 0;
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    size += value.length;
                    if (size > 100000)
                      throw new Error("Model response too large");
                    chunks.push(value);
                  }
                } finally {
                  await reader.cancel().catch(() => {});
                }
                const value = JSON.parse(Buffer.concat(chunks).toString()),
                  output = value?.choices?.[0]?.message?.content;
                if (typeof output !== "string" || output.length > 12000)
                  throw new Error("Model response has no bounded text");
                return { output };
              },
            };
      const config = {
        description: suite.description,
        prompts: suite.prompts,
        providers: [provider],
        tests: suite.tests,
      };
      const record = await evaluator(config, {
        writeLatestResults: false,
        showProgressBar: false,
        cache: false,
        maxConcurrency: 2,
      });
      const summary = await record.toEvaluateSummary();
      const report = {
        results: summary,
        config: {
          description: suite.description,
          prompts: suite.prompts,
          tests: suite.tests,
          providers: [provider.id()],
        },
        provenance: {
          engine: "promptfoo",
          version: "0.125.1",
          mode: suite.mode,
        },
      };
      const raw = JSON.stringify(report);
      parseEvaluation(raw);
      db.prepare(
        "UPDATE jobs SET state='completed',report=?,error='' WHERE id=?",
      ).run(raw, id);
    } catch (error) {
      console.error(
        `Evaluation ${id} failed: ${error instanceof Error ? error.name : "Error"}`,
      );
      db.prepare(
        "UPDATE jobs SET state='failed',error='Evaluation failed; check configuration or reduce suite size' WHERE id=?",
      ).run(id);
    }
  }
  function submit(id, input) {
    idValue(id);
    const suite = validateSuite(input);
    if (suite.mode === "model" && !modelConfigured)
      throw new Error("Model provider is not configured");
    const payload = JSON.stringify(suite);
    if (Buffer.byteLength(payload) > 60000) throw new Error("Suite too large");
    const digest = createHash("sha256").update(payload).digest("hex"),
      old = db.prepare("SELECT digest FROM jobs WHERE id=?").get(id);
    if (old) {
      if (old.digest !== digest) throw new Error("Idempotency mismatch");
      return get(id);
    }
    const queue = db
      .prepare(
        "SELECT COUNT(*) AS n FROM jobs WHERE state IN ('queued','running')",
      )
      .get().n;
    if (queue >= 4) throw new Error("Runner queue is full");
    db.prepare(
      "INSERT INTO jobs(id,digest,suite,state,created) VALUES(?,?,?,'queued',?)",
    ).run(id, digest, payload, new Date().toISOString());
    chain = chain.then(() => run(id, suite));
    return get(id);
  }
  const server = createServer(async (req, res) => {
    const send = (code, value) => {
      res.writeHead(code, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.origin)
        return send(403, {
          error: "Browser access is disabled; use workbench connector",
        });
      if (token && req.headers.authorization !== `Bearer ${token}`)
        return send(401, { error: "Authentication required" });
      const url = new URL(req.url, "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health")
        return send(200, {
          service: "floatboat-promptfoo-runner",
          version: "0.125.1",
          modelConfigured,
        });
      if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
        const job = get(url.pathname.slice(6));
        return send(job ? 200 : 404, job ?? { error: "Job not found" });
      }
      if (req.method === "POST" && url.pathname === "/jobs") {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65000) {
            send(413, { error: "Request too large" });
            req.destroy();
            return;
          }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        return send(202, submit(body.id, body.suite));
      }
      send(404, { error: "Route not found" });
    } catch {
      send(400, {
        error: "Invalid request, unavailable provider or idempotency conflict",
      });
    }
  });
  return { server, get, submit, drain: () => chain, close: () => db.close() };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const service = createService();
  const port = Number(process.env.PROMPTFOO_RUNNER_PORT ?? 8770);
  service.server.listen(port, "127.0.0.1", () =>
    console.log(`Promptfoo runner: http://127.0.0.1:${port}`),
  );
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
