import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createBlobStore, digest } from "../src/server/blobs.ts";
import { runExtraction, extractRequestValue } from "../src/server/extraction.ts";
import { migrateLegacy } from "../src/server/legacy.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
import { serviceStatus, extractWithService } from "../src/server/graphify-service.ts";
import { registerEnhance } from "../src/server/enhance.ts";
import { projectValue, emptyProject, graphText } from "../src/contracts/map.ts";
import { sample } from "../src/contracts/sample/index.ts";
import { buildEnhanceRequest, enhancePrompt, parseEnhanceResult } from "../src/contracts/enhance.ts";
import { summarizeCommunities } from "../src/contracts/analysis.ts";

function db() {
  const d = new DatabaseSync(":memory:");
  for (const f of ["0001_initial.sql", "0002_projects.sql", "0003_autosave.sql", "0004_blobs.sql"])
    d.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
  return d;
}

test("unclassified connection failures give actionable status and extraction errors", async () => {
  const disconnected = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const status = await serviceStatus(disconnected);
  assert.equal(status.available, false);
  assert.match(status.message, /检查服务地址/);
  assert.doesNotMatch(status.message, /fetch failed/);
  await assert.rejects(extractWithService([{ path: "a.py", code: "x=1" }], disconnected), /可切换到内置抽取/);
});

test("content store accepts chunked uploads, verifies the address and is idempotent", () => {
  const blobs = createBlobStore(db());
  const text = "安全库存".repeat(1000);
  const hash = digest(text);
  assert.equal(blobs.stage(hash, "source", 1, 3, text.slice(1000, 2000)), false);
  assert.equal(blobs.stage(hash, "source", 0, 3, text.slice(0, 1000)), false);
  assert.equal(blobs.stage(hash, "source", 0, 3, text.slice(0, 1000)), false, "duplicate part tolerated");
  assert.equal(blobs.stage(hash, "source", 2, 3, text.slice(2000)), true);
  assert.equal(blobs.get(hash)?.body, text);
  assert.equal(blobs.stage(hash, "source", 0, 1, text), true);
  assert.throws(() => blobs.stage(digest("x"), "source", 0, 1, "y"), /不一致/);
});

test("server extraction reads stored sources, stores the graph and reports missing files", async () => {
  const blobs = createBlobStore(db());
  const { project, texts } = sample();
  for (const t of texts.values()) blobs.put("source", t);
  const req = extractRequestValue({ files: project.corpus.map((c) => ({ path: c.path, hash: c.hash })) });
  const out = await runExtraction(blobs, req);
  assert.equal(out.ref.hash, project.graph.hash);
  assert.ok(blobs.has(out.ref.hash));
  assert.equal(out.corpus.length, 17);
  await assert.rejects(runExtraction(blobs, { files: [{ path: "x.py", hash: digest("not stored") }], engine: "node" }), /不在本机内容库/);
  assert.throws(() => extractRequestValue({ files: [{ path: "../etc/passwd", hash: digest("a") }] }), /路径无效/);
  const refused = (async () => {
    throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  }) as unknown as typeof fetch;
  await assert.rejects(runExtraction(blobs, { ...req, engine: "graphify" }, refused), /服务未启动/);
});

test("0.5 projects and drafts are migrated to content addresses on startup", () => {
  const d = db();
  const blobs = createBlobStore(d);
  const legacy = {
    name: "catalog.py", source: "class Catalog:\n    pass\n",
    graph: { directed: true, nodes: [{ id: "catalog" }, { id: "catalog_catalog" }], links: [{ source: "catalog", target: "catalog_catalog" }] },
    notes: { catalog_catalog: "入口" }, positions: {}, selected: "catalog", from: "", to: "",
  };
  d.prepare("INSERT INTO projects(id,title,payload,revision,updated_at) VALUES('p1','目录',?,1,'2026-10-28')").run(JSON.stringify(legacy));
  d.prepare("INSERT INTO autosave_drafts(id,project_id,project_revision,revision,mutation_id,snapshot,receipt,updated_at) VALUES('d1','p1',1,1,'m',?,?,'2026-10-28')").run(
    JSON.stringify({ title: "目录", data: legacy, extra: {} }),
    JSON.stringify({ phase: "saved", project: { id: "p1", title: "目录", data: legacy, revision: 1, updatedAt: "" } }),
  );
  assert.equal(migrateLegacy(d, blobs), 2);
  const row = d.prepare("SELECT payload FROM projects WHERE id='p1'").get();
  const data = projectValue(JSON.parse(String(row!.payload)));
  assert.ok(blobs.has(data.graph.hash));
  assert.ok(blobs.has(data.corpus[0].hash));
  assert.equal(data.notes.catalog_catalog, "入口");
  const draft = JSON.parse(String(d.prepare("SELECT snapshot FROM autosave_drafts WHERE id='d1'").get()!.snapshot));
  assert.equal(projectValue(draft.data).graph.hash, data.graph.hash);
  assert.equal(migrateLegacy(d, blobs), 0);
});

test("autosave keeps a draft (not a saved model) when the referenced graph is missing", async () => {
  const d = db();
  const blobs = createBlobStore(d);
  const store = createAutosaveStore(d, projectValue, undefined, {
    verify: async (data) => {
      if (!blobs.has(data.graph.hash)) throw new Error("图谱内容不在本机内容库中");
    },
  });
  const envelope = (documentId: string, data: unknown) => ({
    documentId, mutationId: crypto.randomUUID(), draftRevision: 0, projectId: null, projectRevision: null,
    snapshot: { title: "地图", data, extra: {} },
  });
  const missing = await store.commit(envelope(crypto.randomUUID(), emptyProject()));
  assert.equal(missing.phase, "draft");
  assert.match(missing.message, /内容库/);
  blobs.put("graph", graphText(sample().graph));
  const ok = await store.commit(envelope(crypto.randomUUID(), sample().project));
  assert.equal(ok.phase, "saved");
});

test("Graphify service status explains how to start it; multi-file results are validated", async () => {
  const refused = (async () => {
    throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  }) as unknown as typeof fetch;
  const off = await serviceStatus(refused);
  assert.equal(off.available, false);
  assert.match(off.message, /服务未启动/);
  assert.ok(off.start.some((c) => c.includes("service/server.py")));
  const json = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  assert.equal((await serviceStatus(json({ ready: true, engine: "graphifyy", version: "0.9.97" }))).available, false, "old single-file adapter");
  assert.equal((await serviceStatus(json({ ready: true, engine: "graphifyy", version: "0.9.97", multiFile: true }))).available, true);
  await assert.rejects(extractWithService([{ path: "a.py", code: "x" }], json({ graph: {} })), /格式无效/);
  await assert.rejects(extractWithService([{ path: "a.py", code: "x" }], json({ error: "语法错误" }, 400)), /语法错误/);
});

test("Host naming sends only member names/summaries, maps offline to 503 and validates model output (mock only)", async () => {
  const { graph } = sample();
  const req = buildEnhanceRequest("门店补货助手", graph, summarizeCommunities(graph));
  const prompt = enhancePrompt(req);
  assert.ok(req.communities.length >= 4 && req.communities.every((c) => c.members.length <= 12));
  assert.doesNotMatch(prompt, /def suggest\(self/, "source text is never sent");
  assert.throws(() => parseEnhanceResult({ communities: [{ id: 999, label: "x", summary: "" }] }, req));
  const routes = new Map<string, (ctx: { body: unknown }) => unknown>();
  const calls: unknown[] = [];
  let mode: "offline" | "ok" = "offline";
  const fake = {
    route: (method: string, path: string, handler: (ctx: { body: unknown }) => unknown) => routes.set(`${method} ${path}`, handler),
    host: {
      capabilities: { list: async () => { if (mode === "offline") throw Object.assign(new Error("x"), { code: "HOST_NOT_CONNECTED" }); return { capabilities: [{ domain: "llm", operation: "generateObject", status: "available" }] }; } },
      llm: {
        generateObject: async (input: unknown) => {
          calls.push(input);
          if (mode === "offline") throw Object.assign(new Error("x"), { code: "HOST_NOT_CONNECTED" });
          return { object: { communities: req.communities.map((c) => ({ id: c.id, label: `  社区${c.id}  `, summary: "说明" })).concat([{ id: 999, label: "多余", summary: "" }]) }, model: "mock-model", requestId: "r1" };
        },
      },
    },
  };
  registerEnhance(fake as never);
  assert.equal(((await routes.get("GET /api/host/status")!({ body: null })) as { llm: string }).llm, "not-connected");
  const offline = (await routes.get("POST /api/enhance")!({ body: req })) as Response;
  assert.equal(offline.status, 503);
  mode = "ok";
  assert.equal(((await routes.get("GET /api/host/status")!({ body: null })) as { llm: string }).llm, "available");
  const ok = (await routes.get("POST /api/enhance")!({ body: req })) as { communities: { id: number; label: string }[]; model: string };
  assert.equal(ok.model, "mock-model");
  assert.equal(ok.communities.length, req.communities.length);
  assert.equal(ok.communities[0].label, `社区${req.communities[0].id}`);
  assert.equal(calls.length, 2);
  const bad = (await routes.get("POST /api/enhance")!({ body: { communities: [] } })) as Response;
  assert.equal(bad.status, 400);
});

test("blob reads are explicit: content first uploaded as a file can still be served as a graph", async () => {
  const { registerBlobRoutes } = await import("../src/server/blobs.ts");
  const blobs = createBlobStore(db());
  const routes = new Map<string, (ctx: { params: Record<string, string>; url: URL; body?: unknown }) => unknown>();
  registerBlobRoutes({ route: (m: string, p: string, h: never) => routes.set(`${m} ${p}`, h) } as never, blobs);
  const text = graphText(sample().graph);
  const hash = digest(text);
  blobs.stage(hash, "upload", 0, 1, text);
  blobs.put("graph", text);
  const get = routes.get("GET /api/blobs/:hash")!;
  const asGraph = (await (get({ params: { hash }, url: new URL(`http://x/api/blobs/${hash}?as=graph`) }) as Response).json()) as { nodes: unknown[] };
  assert.equal(asGraph.nodes.length, sample().graph.nodes.length);
  const asText = (await (get({ params: { hash }, url: new URL(`http://x/api/blobs/${hash}?as=text`) }) as Response).json()) as { text: string };
  assert.equal(asText.text, text);
  const missing = routes.get("POST /api/blobs/missing")!({ params: {}, url: new URL("http://x"), body: { hashes: [hash, digest("nope")] } }) as { missing: string[] };
  assert.deepEqual(missing.missing, [digest("nope")]);
});
