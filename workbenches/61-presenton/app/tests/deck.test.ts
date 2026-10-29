import assert from "node:assert/strict";
import { test } from "node:test";
import { blank, example, generationRequest, importDeck, outlineMarkdown, portable, restoreDeck, taskValue, validateDeck } from "../src/contracts/deck.ts";
import { configFrom, artifactUrl, createPresenton, boundedResponse } from "../src/server/presenton.ts";

const MEDIA = "a".repeat(64);
test("便携项目 v2 保留资料、大纲、幻灯片、主题、图片与未完成的导入草稿", () => {
  const deck = structuredClone(example);
  deck.theme = "forest";
  deck.slides[2].image = { kind: "media", id: MEDIA, alt: "路线照片" };
  const text = portable("城市", deck, { importText: '{"unfinished"', step: "deck" }, { [MEDIA]: { mime: "image/png", base64: "iVBORw0KGgo=", name: "p.png" } });
  const back = importDeck(text);
  assert.deepEqual(back.deck, deck);
  assert.equal(back.extra.importText, '{"unfinished"');
  assert.equal(back.extra.step, "deck");
  assert.equal(back.media[MEDIA].name, "p.png");
  assert.throws(() => importDeck(portable("x", deck, {}, { bad: { mime: "image/png", base64: "x", name: "" } })), /图片/);
});
test("0.4 旧项目（schemaVersion 1）确定性迁移为资料、大纲与幻灯片", () => {
  const old = {
    schemaVersion: 1,
    source: "旧资料",
    audience: "社区",
    objective: "共识",
    slides: [
      { id: "vision", title: "开场", markdown: "一句话\n\n- 甲\n- 乙", notes: "问候", reviewed: true },
      { id: "plan", title: "计划", markdown: "1. 观察\n2. 设计", notes: "", reviewed: false },
    ],
    settings: { language: "Chinese", template: "general", tone: "professional", verbosity: "standard", format: "pptx", instructions: "", webSearch: false, titleSlide: true, contents: false },
    result: null,
  };
  const d = restoreDeck(old);
  assert.equal(d.schemaVersion, 2);
  assert.equal(d.brief.source, "旧资料");
  assert.deepEqual(d.outline.map((o) => o.layout), ["cover", "bullets"]);
  assert.deepEqual(d.slides[1].bullets, ["观察", "设计"]);
  assert.equal(d.slides[0].subtitle, "一句话");
  assert.equal(d.slides[0].notes, "问候");
  assert.deepEqual(validateDeck(old), d);
  const imported = importDeck(JSON.stringify({ format: "presenton-workbench", version: 1, title: "旧", deck: old, extra: {} }));
  assert.equal(imported.deck.slides.length, 2);
});
test("结构错误与超限拒绝；重复标识拒绝", () => {
  assert.throws(() => restoreDeck({ ...example, slides: [example.slides[0], example.slides[0]] }), /重复/);
  assert.throws(() => restoreDeck({ ...example, theme: "neon" }), /主题/);
  assert.throws(() => restoreDeck({ ...example, brief: { ...example.brief, source: "a".repeat(280_001) } }));
  assert.throws(() => restoreDeck({ ...example, slides: [{ ...example.slides[0], bullets: Array(15).fill("x") }] }), /最多/);
  assert.deepEqual(restoreDeck(blank), blank);
});
test("Presenton 请求用大纲逐页 Markdown 与备注，不含 Host 模型", () => {
  const r = generationRequest(example);
  assert.equal(r.n_slides, example.outline.length);
  assert.equal(r.export_as, "pptx");
  assert.equal(r.trigger_webhook, false);
  assert.match(r.slides_markdown[4], /^# 试点路线的遮荫变化/);
  assert.match(r.content, /Audience: 街道办/);
  assert.throws(() => generationRequest(blank), /大纲/);
});
test("导入 PresentationWithSlides 按 index 排列为新文稿，HTML 与图片地址不进入内容", () => {
  const value = {
    id: "presentation-one",
    title: "Imported",
    content: "Source",
    slides: [
      { index: 1, content: { title: "Second", items: ["B"] }, html_content: "<script>alert(1)</script>", speaker_note: "Note" },
      { index: 0, content: { title: "First", image_url: "https://untrusted.example/a" } },
    ],
  };
  const d = importDeck(JSON.stringify(value));
  assert.equal(d.deck.slides[0].title, "First");
  assert.equal(d.deck.slides[0].layout, "cover");
  assert.equal(d.deck.slides[1].notes, "Note");
  assert.deepEqual(d.deck.slides[1].bullets, ["B"]);
  assert.doesNotMatch(JSON.stringify(d.deck.slides), /script|untrusted/);
  assert.equal(d.deck.result?.raw, JSON.stringify(value));
  assert.equal(d.deck.brief.source, "Source");
});
test("生成响应和 task 状态可导入；无效状态与无关 JSON 给出可读错误", () => {
  const v = { id: "task-123", status: "completed", data: { presentation_id: "deck-123", path: "/app_data/exports/a.pptx" } };
  const d = importDeck(JSON.stringify(v));
  assert.equal(d.deck.result?.taskId, "task-123");
  assert.equal(d.deck.result?.presentationId, "deck-123");
  assert.throws(() => taskValue({ id: "task-1", status: "running" }));
  assert.throws(() => importDeck('{"hello":1}'), /未识别/);
  assert.throws(() => importDeck("{"), /尚未完整/);
});
test("Markdown 讲义包含版式、要点、图表数据与演讲备注", () => {
  const md = outlineMarkdown("城市", example);
  assert.match(md, /_图表_/);
  assert.match(md, /\| 桂园路（学校—社区） \| 18 \| 46 \|/);
  assert.match(md, /> 演讲备注：/);
});
test("服务配置只接受源地址；远程必须 HTTPS；产物路径限定在 app_data/exports", async () => {
  assert.equal(configFrom({}), null);
  assert.throws(() => configFrom({ PRESENTON_URL: "http://example.com" }), /HTTPS/);
  assert.throws(() => configFrom({ PRESENTON_URL: "https://example.com/api" }));
  assert.equal(configFrom({ PRESENTON_URL: "http://127.0.0.1:5001", PRESENTON_API_KEY: " k " })?.key, "k");
  const origin = "https://p.example";
  assert.equal(artifactUrl("/app_data/exports/x/a.pptx", origin).pathname, "/app_data/exports/x/a.pptx");
  for (const bad of ["/app_data/exports/../a.pptx", "https://evil.example/app_data/exports/a.pptx", "/app_data/exports/a.exe", "/app_data/exports/a.pptx?x=1"])
    assert.throws(() => artifactUrl(bad, origin));
  await assert.rejects(() => boundedResponse(new Response("x".repeat(20)), 10), /容量/);
  const service = createPresenton({ origin, key: "secret" }, async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer secret");
    return Response.json({ paths: {} });
  });
  await assert.rejects(() => service.health(), /异步制作接口/);
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
  const value = { documentId: "id", snapshot: { title: "Recovered", data: blank, extra: { importText: "{unfinished" } } };
  const restored = importDeck(JSON.stringify(value));
  assert.deepEqual(restored.deck, blank);
  assert.equal(restored.extra.importText, "{unfinished");
});
test("超过正式模型容量的完整草稿与原始编辑器可便携往返", () => {
  const large = {
    ...structuredClone(example),
    slides: Array.from({ length: 60 }, (_, i) => ({ ...example.slides[2], id: `large-${i}`, bullets: Array.from({ length: 14 }, () => "中".repeat(600)) })),
  };
  assert.throws(() => validateDeck(large), /900 KB/);
  assert.deepEqual(restoreDeck(large), large);
  const extra = { importText: '{"raw": ' + "中".repeat(200000) };
  const restored = importDeck(portable("Large", large, extra));
  assert.deepEqual(restored.deck, large);
  assert.deepEqual(restored.extra, extra);
});
