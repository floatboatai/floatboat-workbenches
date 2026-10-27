import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blank,
  example,
  restoreDeck,
  validateDeck,
  generationRequest,
  importDeck,
  portable,
  outline,
  taskValue,
} from "../src/contracts/deck.ts";
import {
  configFrom,
  artifactUrl,
  createPresenton,
  boundedResponse,
} from "../src/server/presenton.ts";
test("完整演示计划与便携格式保留资料、设置、备注和原始草稿", () => {
  const text = portable("城市", example, { importText: '{"unfinished"' });
  const back = importDeck(text);
  assert.deepEqual(back.deck, example);
  assert.equal(back.extra.importText, '{"unfinished"');
  assert.match(outline(example), /Speaker notes/);
});
test("未完成页面可恢复但不能制作，重复 ID 和超限内容被拒绝", () => {
  assert.deepEqual(restoreDeck(blank), blank);
  assert.throws(() => validateDeck(blank), /草稿/);
  assert.throws(
    () =>
      restoreDeck({
        ...example,
        slides: [example.slides[0], example.slides[0]],
      }),
    /重复/,
  );
  assert.throws(() => restoreDeck({ ...example, source: "a".repeat(60001) }));
});
test("真实 Presenton generate 请求字段包括每页 Markdown 和备注，不使用 Host LLM", () => {
  const r = generationRequest(example);
  assert.equal(r.n_slides, 4);
  assert.equal(r.export_as, "pptx");
  assert.equal(r.trigger_webhook, false);
  assert.match(r.slides_markdown[0], /Speaker guidance/);
  assert.equal(r.template, "general");
});
test("导入 PresentationWithSlides 按 index 排列，HTML 不被用作内容", () => {
  const value = {
    id: "presentation-one",
    title: "Imported",
    content: "Source",
    slides: [
      {
        index: 1,
        content: { title: "Second", items: ["B"] },
        html_content: "<script>alert(1)</script>",
        speaker_note: "Note",
      },
      {
        index: 0,
        content: { title: "First", image_url: "https://untrusted.example/a" },
      },
    ],
  };
  const d = importDeck(JSON.stringify(value));
  assert.equal(d.deck.slides[0].title, "First");
  assert.equal(d.deck.slides[1].notes, "Note");
  assert.doesNotMatch(
    d.deck.slides.map((s) => s.markdown).join(""),
    /script|untrusted/,
  );
  assert.equal(d.deck.result?.raw, JSON.stringify(value));
});
test("生成响应和真实 task 状态可导入；无效状态、非 Presenton JSON 和超限文件拒绝", () => {
  const v = {
    id: "task-123",
    status: "completed",
    data: { presentation_id: "deck-123", path: "/app_data/exports/a.pptx" },
  };
  assert.equal(importDeck(JSON.stringify(v)).deck.result?.taskId, "task-123");
  assert.throws(() => taskValue({ ...v, status: "success" }));
  assert.throws(() => importDeck("{"));
  assert.throws(() => importDeck('{"unrelated":true}'));
  assert.throws(() => importDeck("a".repeat(24000001)));
});
test("服务地址只允许固定源，无凭据、路径或远程明文 HTTP", () => {
  assert.equal(configFrom({}), null);
  assert.equal(
    configFrom({ PRESENTON_URL: "http://127.0.0.1:5000" })?.origin,
    "http://127.0.0.1:5000",
  );
  for (const u of [
    "http://remote.example",
    "https://user:pass@host.example",
    "https://host.example/path",
    "https://host.example/?token=1",
    "file:///tmp",
  ])
    assert.throws(() => configFrom({ PRESENTON_URL: u }));
});
test("生成文件仅允许配置源的已知导出目录；阻止凭据泄漏、遍历和重定向源", () => {
  const origin = "https://presenton.example";
  assert.equal(
    artifactUrl("/app_data/exports/users/user-id/hello.pptx", origin).origin,
    origin,
  );
  for (const p of [
    "https://evil.example/app_data/exports/a.pdf",
    "//evil.example/app_data/exports/a.pdf",
    "/api/secret.pptx",
    "/app_data/exports/../a.pdf",
    "/app_data/exports/%2e%2e/a.pdf",
    "/app_data/exports/%252e/a.pdf",
    "/app_data/exports/a.pdf?secret=1",
    "https://u:p@presenton.example/app_data/exports/a.pdf",
    "/app_data/exports/a.html",
  ])
    assert.throws(() => artifactUrl(p, origin), p);
});
test("connector contract: exact async/status/export URLs, Bearer only server, redirects disabled", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const client = createPresenton(
    { origin: "https://presenton.example", key: "TEST-ONLY" },
    async (input, init) => {
      seen.push({ url: String(input), init });
      return Response.json(
        String(input).endsWith("/export")
          ? { presentation_id: "deck-1", path: "/app_data/exports/a.pdf" }
          : {
              id: "task-1",
              status: "pending",
              data: { presentation_id: "deck-1" },
            },
      );
    },
  );
  await client.generate(generationRequest(example));
  await client.status("task-1");
  await client.export("deck-1", "pdf");
  assert.equal(
    seen[0].url,
    "https://presenton.example/api/v1/ppt/presentation/generate/async",
  );
  assert.equal(
    seen[1].url,
    "https://presenton.example/api/v1/ppt/presentation/status/task-1",
  );
  assert.equal(seen[2].init?.body, '{"export_as":"pdf"}');
  for (const s of seen) {
    assert.equal(s.init?.redirect, "error");
    assert.equal(
      new Headers(s.init?.headers).get("authorization"),
      "Bearer TEST-ONLY",
    );
  }
});
test("connector contract: wrong task ID and upstream auth/error details are not trusted", async () => {
  const c = createPresenton(
    { origin: "https://presenton.example", key: "secret" },
    async () => Response.json({ id: "task-other", status: "pending" }),
  );
  await assert.rejects(() => c.status("task-one"), /不同/);
  const bad = createPresenton(
    { origin: "https://presenton.example", key: "secret" },
    async () => new Response("secret", { status: 401 }),
  );
  await assert.rejects(
    () => bad.generate({}),
    (e) =>
      e instanceof Error &&
      e.message.includes("401") &&
      !e.message.includes("secret"),
  );
});
test("connector contract: stream bounds and artifact signatures reject invalid download", async () => {
  await assert.rejects(
    () => boundedResponse(new Response("123456"), 5),
    /容量/,
  );
  const c = createPresenton(
    { origin: "https://presenton.example", key: "" },
    async () => new Response("<html>oops</html>"),
  );
  await assert.rejects(() => c.artifact("/app_data/exports/a.pptx"), /格式/);
});

test("完整工作副本恢复导入使用实际 snapshot 格式", () => {
  const value = {
    documentId: "id",
    snapshot: {
      title: "Recovered",
      data: blank,
      extra: { importText: "{unfinished" },
    },
  };
  const restored = importDeck(JSON.stringify(value));
  assert.deepEqual(restored.deck, blank);
  assert.equal(restored.extra.importText, "{unfinished");
});

test("超过正式模型容量的完整草稿与原始编辑器可便携往返", () => {
  const large = {
    ...structuredClone(example),
    slides: Array.from({ length: 35 }, (_, i) => ({
      ...example.slides[0],
      id: `large-${i}`,
      markdown: "中".repeat(8000),
    })),
  };
  assert.throws(() => validateDeck(large), /700 KB/);
  assert.deepEqual(restoreDeck(large), large);
  const extra = { importText: '{"raw": ' + "中".repeat(200000) };
  const restored = importDeck(portable("Large", large, extra));
  assert.deepEqual(restored.deck, large);
  assert.deepEqual(restored.extra, extra);
});
