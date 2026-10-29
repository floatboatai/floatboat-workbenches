import { test } from "node:test";
import assert from "node:assert/strict";
import {
  A4_PORTRAIT,
  addComment,
  adjacentRevision,
  bodyParagraphs,
  bodyReturnPosition,
  commentSelection,
  listComments,
  listRevisions,
  marginPresetId,
  pageSizeId,
  paragraphOffset,
  positionAt,
  updateComment,
  withPageSize,
} from "../src/contracts/review.ts";
import { restoreDocument, seed } from "../src/contracts/document.ts";

const rev = (id: string, type: "insert" | "delete", author = "李宁") => ({ id, type, author, date: 1 });
function doc(): any {
  return {
    id: "d",
    schemaVersion: 1,
    pageSettings: { ...A4_PORTRAIT, margins: { ...A4_PORTRAIT.margins } },
    sections: [
      {
        id: "s",
        pageSettings: { ...A4_PORTRAIT, margins: { ...A4_PORTRAIT.margins } },
        blocks: [
          {
            id: "p1",
            type: "paragraph",
            runs: [
              { id: "a", kind: "text", text: "预计开展" },
              { id: "b", kind: "text", text: "约50场", revision: rev("r1", "delete") },
              { id: "c", kind: "text", text: "不少于", revision: rev("r2", "insert") },
              { id: "d", kind: "text", text: "60场", revision: rev("r2", "insert") },
              { id: "e", kind: "text", text: "。" },
              { id: "f", kind: "footnoteReference", text: "1", footnoteReference: { footnoteId: "fn1" } },
            ],
          },
          {
            id: "t",
            type: "table",
            rows: [
              {
                id: "row",
                cells: [
                  {
                    id: "cell",
                    blocks: [{ id: "p2", type: "paragraph", runs: [{ id: "g", kind: "text", text: "表内新增", revision: rev("r3", "insert", "王敏") }] }],
                  },
                ],
              },
            ],
          },
          { id: "p3", type: "paragraph", runs: [{ id: "h", kind: "text", text: "附件：居民意见汇总表" }] },
        ],
      },
    ],
  };
}
const at = (paragraphId: string, runId: string, offset: number) => ({ paragraphId, runId, offset });

test("修订按 id 合并为可选择区间，表格内修订也计入", () => {
  const marks = listRevisions(doc());
  assert.deepEqual(marks.map((m) => [m.id, m.type, m.text]), [
    ["r1", "delete", "约50场"],
    ["r2", "insert", "不少于60场"],
    ["r3", "insert", "表内新增"],
  ]);
  assert.deepEqual(marks[1].selection, { anchor: at("p1", "c", 0), focus: at("p1", "d", 3) });
  assert.deepEqual(bodyParagraphs(doc()).map((p) => p.id), ["p1", "p2", "p3"]);
});

test("上一处/下一处修订按光标位置循环", () => {
  const d = doc();
  const marks = listRevisions(d);
  assert.equal(adjacentRevision(d, marks, at("p1", "a", 1), 1)?.id, "r1");
  assert.equal(adjacentRevision(d, marks, at("p1", "b", 2), 1)?.id, "r2");
  assert.equal(adjacentRevision(d, marks, at("p3", "h", 0), 1)?.id, "r1", "wraps to first");
  assert.equal(adjacentRevision(d, marks, at("p1", "a", 0), -1)?.id, "r3", "wraps to last");
  assert.equal(adjacentRevision(d, marks, at("p3", "h", 2), -1)?.id, "r3");
  assert.equal(adjacentRevision(d, [], at("p1", "a", 0), 1), null);
});

test("段落偏移与 run 位置可互相换算", () => {
  const p1 = bodyParagraphs(doc())[0];
  assert.equal(paragraphOffset(p1, at("p1", "c", 2)), 4 + 4 + 2);
  assert.deepEqual(positionAt(p1, 10), at("p1", "c", 2));
  assert.deepEqual(positionAt(p1, 999), at("p1", "f", 1));
});

test("批注锚定选区、可反向选择、解决与删除并回到选区", () => {
  const d = addComment(doc(), { anchor: at("p3", "h", 7), focus: at("p3", "h", 3) }, "  请附上样表  ", "周晓岚", 5, "c1");
  const [c] = listComments(d);
  assert.equal(c.text, "请附上样表");
  assert.equal(c.author, "周晓岚");
  assert.deepEqual([c.start, c.end], [{ paragraphId: "p3", offset: 3 }, { paragraphId: "p3", offset: 7 }]);
  assert.deepEqual(commentSelection(d, c), { anchor: at("p3", "h", 3), focus: at("p3", "h", 7) });
  const resolved = updateComment(d, "c1", { resolved: true });
  assert.equal(listComments(resolved)[0].resolved, true);
  const removed = updateComment(resolved, "c1", { remove: true });
  assert.deepEqual(removed.comments, { items: {}, order: [] });
  assert.throws(() => addComment(doc(), { anchor: at("p3", "h", 2), focus: at("p3", "h", 2) }, "x", "a"), /选中/);
  assert.throws(() => addComment(doc(), { anchor: at("p3", "h", 0), focus: at("p3", "h", 2) }, "   ", "a"), /不能为空/);
  assert.throws(() => addComment(doc(), { anchor: at("zz", "h", 0), focus: at("p3", "h", 2) }, "x", "a"), /正文/);
});

test("纸张大小保持方向，页边距与纸张预设可识别", () => {
  const d = doc();
  assert.equal(pageSizeId(d.sections[0].pageSettings), "A4");
  assert.equal(marginPresetId(d.sections[0].pageSettings), "normal");
  const a5 = withPageSize(d, "A5");
  assert.equal(pageSizeId(a5.sections![0].pageSettings), "A5");
  assert.ok(a5.sections![0].pageSettings.height > a5.sections![0].pageSettings.width);
  const landscape = { ...d, sections: [{ ...d.sections[0], pageSettings: { ...d.sections[0].pageSettings, orientation: "landscape", width: 1123, height: 794 } }] };
  const letter = withPageSize(landscape, "Letter");
  assert.deepEqual([letter.sections![0].pageSettings.width, letter.sections![0].pageSettings.height], [1056, 816]);
  assert.throws(() => withPageSize(d, "A0"), /未知/);
});

test("从脚注或页眉返回正文的位置", () => {
  assert.deepEqual(bodyReturnPosition(doc(), "fn1"), at("p1", "f", 1));
  assert.deepEqual(bodyReturnPosition(doc(), null), at("p1", "a", 0));
});

test("修订模式字段可选，类型错误被拒绝", () => {
  const base = { ...seed, document: doc() };
  assert.equal(restoreDocument({ ...base, trackChanges: true }).trackChanges, true);
  assert.equal(restoreDocument(base).trackChanges, undefined);
  assert.throws(() => restoreDocument({ ...base, trackChanges: "yes" }), /字段无效/);
});
