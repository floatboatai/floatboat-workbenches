import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseModelRecord,
  hostModelErrorMessage,
} from "../src/server/model-output.ts";
// Ordinary fixture returned by a real Host text call; no provider credentials.
const observed =
  '```json\n{\n  "subject": "冬季展览灯光验收",\n  "owner": "林晓",\n  "dueDate": "2026-11-15",\n  "summary": "验收24套可调光射灯，并整理验收结论及待处理问题为一份交付记录。",\n  "checklist": [\n    "核对灯具数量",\n    "核对色温测试报告",\n    "核对两年质保文件",\n    "整理交付记录（含验收结论及待处理问题）"\n  ]\n}\n```';
test("observed Host fenced JSON decodes into the expected delivery fields", () => {
  const record = parseModelRecord(observed);
  assert.equal(record.owner, "林晓");
  assert.equal(record.dueDate, "2026-11-15");
  assert.match(record.subject, /灯光|展览/);
  assert.ok(record.checklist.length >= 3);
});

const record = {
  subject: "灯光验收",
  owner: "林晓",
  dueDate: "2026-11-15",
  summary: "核对24套灯具",
  checklist: ["检查数量"],
};
test("plain JSON and one outer JSON fence preserve exact record fields", () => {
  const raw = JSON.stringify(record);
  assert.deepEqual(parseModelRecord(raw), record);
  assert.deepEqual(parseModelRecord("```JSON\r\n" + raw + "\r\n```"), record);
  assert.deepEqual(parseModelRecord("```\n" + raw + "\n```"), record);
});
test("prose, incomplete JSON, mismatched fences and non-object output remain failures", () => {
  for (const value of [
    "说明：" + JSON.stringify(record),
    "```json\n" + JSON.stringify(record),
    JSON.stringify(record) + " trailing",
    "```python\n" + JSON.stringify(record) + "\n```",
    "[]",
    "null",
    '{"subject":',
  ])
    assert.throws(() => parseModelRecord(value));
});
test("unknown fields, wrong types and invalid dates do not bypass domain validation", () => {
  for (const value of [
    { ...record, extra: true },
    { ...record, owner: null },
    { ...record, dueDate: "2026-02-30" },
    { ...record, checklist: [3] },
    { ...record, checklist: Array(41).fill("check") },
    { ...record, owner: "" },
  ])
    assert.throws(() => parseModelRecord(JSON.stringify(value)));
});
test("token-limited responses cannot be published even if their prefix is valid JSON", () => {
  assert.throws(
    () => parseModelRecord(JSON.stringify(record), "MAX_TOKENS"),
    /未完整结束/,
  );
});
test("Host failure messages distinguish disconnection and redact non-code details", () => {
  assert.match(hostModelErrorMessage("HOST_NOT_CONNECTED"), /连接已断开/);
  assert.match(
    hostModelErrorMessage("LLM_OBJECT_INVALID"),
    /LLM_OBJECT_INVALID/,
  );
  assert.doesNotMatch(
    hostModelErrorMessage("unsafe message with private details"),
    /private details/,
  );
});
