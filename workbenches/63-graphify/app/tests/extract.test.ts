import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sha256 } from "../src/contracts/hash.ts";
import { extractCorpus } from "../src/contracts/extract/index.ts";
import { sampleFiles } from "../src/contracts/sample/corpus.ts";
import { sample } from "../src/contracts/sample/index.ts";
import { classifyPath, contentProblem } from "../src/contracts/corpus.ts";

const link = (g: ReturnType<typeof extractCorpus>["graph"], s: string, t: string, rel?: string) =>
  g.links.find((l) => l.source === s && l.target === t && (!rel || l.relation === rel));

test("sync SHA-256 matches node:crypto for ASCII, CJK, emoji and block boundaries", () => {
  for (const text of ["", "abc", "安全库存与补货点", "🧭 map", "x".repeat(55), "y".repeat(56), "z".repeat(64), "多".repeat(1000)])
    assert.equal(sha256(text), createHash("sha256").update(text, "utf8").digest("hex"));
});

test("sample corpus module is generated from sample/replenishment files", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const resource = manifest.resources.find((item: { id: string; path: string }) => item.id === "sample-corpus");
  assert.ok(resource, "sample corpus must ship with the source package");
  const root = new URL(`../${resource.path}/`, import.meta.url).pathname;
  const walk = (dir: string): string[] => readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  const disk = walk(root).map((f) => ({ path: relative(root, f), text: readFileSync(f, "utf8") }));
  assert.deepEqual(sampleFiles, disk);
});

test("sample dataset yields a substantial multi-community graph with code, docs and notes linked", () => {
  const { graph, stats } = extractCorpus(sampleFiles);
  assert.ok(stats.nodes >= 100 && stats.nodes <= 400, `nodes ${stats.nodes}`);
  assert.ok(stats.links >= 200, `links ${stats.links}`);
  assert.ok(stats.communities >= 5, `communities ${stats.communities}`);
  assert.equal(stats.files, 17);
  for (const kind of ["file", "class", "method", "function", "section", "concept", "rationale", "module"]) assert.ok(stats.byKind[kind] > 0, kind);
  for (const rel of ["contains", "method", "calls", "imports", "inherits", "references", "mentions", "related_to", "rationale_for", "renders"]) assert.ok(stats.byRelation[rel] > 0, rel);
  // 代码：继承、跨文件调用、self 调用、相对导入
  assert.ok(link(graph, "replenish_forecast_seasonalforecast", "replenish_forecast_movingaverageforecast", "inherits"));
  assert.equal(link(graph, "replenish_policy_reorderpolicy_suggest", "replenish_forecast_forecast_demand", "calls")?.confidence, "EXTRACTED");
  assert.ok(link(graph, "replenish_policy_reorderpolicy_safety_stock", "replenish_policy_reorderpolicy_lead_time", "calls"));
  assert.ok(link(graph, "replenish_jobs", "replenish_inventory", "imports"));
  assert.ok(link(graph, "web_src_suggestiontable", "web_src_api", "imports"));
  assert.ok(link(graph, "web_src_suggestiontable_onapprove", "web_src_api_approvesuggestion", "calls"));
  // 文档：链接、行内代码、术语与共现
  assert.ok(link(graph, "readme_门店补货助手", "docs_architecture_md", "references"));
  assert.ok(link(graph, "docs_runbook_夜间任务失败", "replenish_jobs_retry_failed_orders", "mentions"));
  assert.ok(graph.nodes.some((n) => n.id === "concept_安全库存" && Number(n.mentions) >= 4));
  assert.ok(graph.links.some((l) => l.relation === "related_to" && l.confidence === "INFERRED" && Number(l.weight) >= 2));
  // 纯文本纪要的标题与对代码的提及
  assert.ok(graph.nodes.some((n) => n.source_file === "notes/2026-10-22-weekly-sync.txt" && n.kind === "section" && n.label === "一、上周问题"));
  // 源码位置
  const policy = graph.nodes.find((n) => n.id === "replenish_policy_reorderpolicy")!;
  assert.equal(policy.source_location, "L13");
  assert.ok(Number(policy.source_end) > 40);
  assert.ok(graph.nodes.every((n) => typeof n.community === "number"));
});

test("extraction is deterministic and the sample project points at the same content address", () => {
  const a = JSON.stringify(extractCorpus(sampleFiles).graph);
  const b = JSON.stringify(extractCorpus([...sampleFiles].reverse()).graph);
  assert.equal(a, b);
  assert.equal(sample().project.graph.hash, sha256(a));
  assert.ok(sample().project.corpus.every((c) => sample().texts.has(c.hash)));
});

test("calls inside strings and comments are ignored; JS .js specifiers resolve to .ts and index files", () => {
  const { graph } = extractCorpus([
    { path: "src/a.ts", text: "import { b } from './lib/b.js';\nimport * as c from './c';\n// helper() in a comment\nexport function run() {\n  const s = 'helper()';\n  b();\n  return c.cee();\n}\nfunction helper() {}\n" },
    { path: "src/lib/b.ts", text: "export function b() { return 1; }\n" },
    { path: "src/c/index.ts", text: "export function cee() { return 2; }\n" },
  ]);
  assert.ok(link(graph, "src_a", "src_lib_b", "imports"));
  assert.ok(link(graph, "src_a", "src_c_index", "imports"));
  assert.ok(link(graph, "src_a_run", "src_lib_b_b", "calls"));
  assert.equal(link(graph, "src_a_run", "src_a_helper", "calls"), undefined);
});

test("Markdown anchors, wiki links and setext headings; plain text numbered headings", () => {
  const { graph } = extractCorpus([
    { path: "docs/a.md", text: "Guide\n=====\n\nSee [b](b.md#setup) and [[c]].\n\n## Next\n\nBack to [top](#guide).\n" },
    { path: "docs/b.md", text: "# B\n\n## Setup\n\ntext\n" },
    { path: "docs/c.md", text: "# C\n" },
    { path: "notes.txt", text: "1. 背景\n内容一\n\n2. 方案\n内容二\n" },
  ]);
  assert.ok(link(graph, "docs_a_guide", "docs_b_setup", "references"));
  assert.ok(link(graph, "docs_a_guide", "docs_c_md", "references"));
  assert.ok(link(graph, "docs_a_next", "docs_a_guide", "references"));
  assert.deepEqual(graph.nodes.filter((n) => n.source_file === "notes.txt" && n.kind === "section").map((n) => n.label), ["1. 背景", "2. 方案"]);
});

test("path and content rules skip dependency folders, lockfiles, binaries and minified code", () => {
  assert.ok("skip" in classifyPath("node_modules/x/index.js"));
  assert.ok("skip" in classifyPath("web/pnpm-lock.yaml"));
  assert.ok("skip" in classifyPath("assets/logo.png"));
  assert.deepEqual(classifyPath("src/Main.kt"), { kind: "code", language: "kotlin" });
  assert.equal(contentProblem("a\u0000b"), "二进制内容");
  assert.equal(contentProblem("x".repeat(30000)), "单行过长（疑似压缩代码）");
  const { stats } = extractCorpus([
    { path: "a.py", text: "def f():\n    pass\n" },
    { path: "dist/a.js", text: "x" },
    { path: "a.py", text: "dup" },
  ]);
  assert.deepEqual(stats.skipped.map((s) => s.reason), ["依赖或构建目录 dist", "重复路径"]);
});

test("upstream Graphify code nodes keep their ids and still receive document mentions", () => {
  const upstream = {
    engine: "graphifyy@0.9.97",
    nodes: [
      { id: "svc", label: "svc.py", source_file: "svc.py", source_location: "L1", file_type: "code" },
      { id: "svc_billing_client", label: "BillingClient", _callable: true, _callable_class: true, source_file: "svc.py", source_location: "L3", file_type: "code" },
    ],
    links: [{ source: "svc", target: "svc_billing_client", relation: "contains", confidence: "EXTRACTED", confidence_score: 1, weight: 1 }],
  };
  const { graph } = extractCorpus([
    { path: "svc.py", text: "\n\nclass BillingClient:\n    pass\n" },
    { path: "README.md", text: "# Billing\n\nUse `BillingClient` for invoices.\n" },
  ], { upstream });
  assert.ok(graph.nodes.some((n) => n.id === "svc_billing_client" && n.kind === "class"));
  assert.ok(!graph.nodes.some((n) => n.id === "svc_billingclient"));
  assert.ok(link(graph, "readme_billing", "svc_billing_client", "mentions"));
  assert.match(String((graph.graph as Record<string, unknown>).generator), /graphifyy/);
});
