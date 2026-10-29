import { test } from "node:test";
import assert from "node:assert/strict";
import { packNative, unpackNative } from "../src/contracts/source-package.ts";

const photo = Buffer.from(Array.from({ length: 6000 }, (_, i) => (i * 7919) % 251)).toString("base64");
function imported(withImage = true): any {
  return {
    id: "d",
    sections: [
      {
        id: "s",
        blocks: [
          {
            id: "p",
            type: "paragraph",
            runs: withImage
              ? [{ id: "i", kind: "image", text: "￼", image: { src: "data:image/png;base64," + photo, width: 10, height: 10 } }]
              : [{ id: "t", kind: "text", text: "无图" }],
          },
        ],
      },
    ],
    sourcePackage: {
      format: "docx",
      mainDocumentPart: "word/document.xml",
      contentTypes: { defaults: {}, overrides: {} },
      rootRelationships: [],
      parts: {
        "word/document.xml": { path: "word/document.xml", kind: "xml", data: "<w:document/>", encoding: "utf8", originalHash: "a" },
        "word/media/image1.png": { path: "word/media/image1.png", kind: "binary", data: photo, encoding: "base64", originalHash: "b" },
      },
    },
  };
}

test("导入图片在 OOXML 归档中只保存一份并可逐字节恢复", () => {
  const packed = packNative(imported());
  const plain = packNative({ ...imported(false), sourcePackage: imported().sourcePackage });
  assert.ok(packed.archive!.data.length < plain.archive!.data.length / 2, "media part replaced by a reference");
  const restored = unpackNative(packed.document, packed.archive)!;
  assert.equal(restored.sourcePackage!.parts["word/media/image1.png"].data, photo);
  assert.equal(restored.sourcePackage!.parts["word/document.xml"].data, "<w:document/>");
});

test("删除图片后原始媒体部件完整保留", () => {
  const doc = imported();
  doc.sections[0].blocks[0].runs = [{ id: "t", kind: "text", text: "图片已删除" }];
  const packed = packNative(doc);
  const restored = unpackNative(packed.document, packed.archive)!;
  assert.equal(restored.sourcePackage!.parts["word/media/image1.png"].data, photo);
});

test("引用的模型图片缺失时拒绝恢复而不是丢图", () => {
  const packed = packNative(imported());
  const broken = JSON.parse(JSON.stringify(packed.document));
  broken.sections[0].blocks[0].runs = [];
  assert.throws(() => unpackNative(broken, packed.archive), /缺少对应的文稿图片/);
});

test("导入段落的 OOXML 原文进入压缩归档，恢复时逐项还原", () => {
  const doc = imported(false);
  const xml = "<w:p>" + "<w:r><w:t>城南社区共享书房</w:t></w:r>".repeat(400) + "</w:p>";
  doc.sections[0].blocks[0].ooxmlSource = { xml, semanticSignature: "sig".repeat(2000), attributes: { "w:rsidR": "00AB" } };
  doc.sections[0].blocks.push({ id: "p2", type: "paragraph", runs: [{ id: "r", kind: "text", text: "二", ooxmlSource: { xml: "<w:r/>" } }] });
  const packed = packNative(doc);
  const model = JSON.stringify(packed.document);
  assert.ok(!model.includes("城南社区共享书房</w:t>"), "verbatim XML no longer in the model");
  assert.ok(model.length < 2000, `model ${model.length}`);
  const restored = unpackNative(packed.document, packed.archive)!;
  assert.deepEqual(restored.sections, doc.sections);
  assert.ok(!("workbenchBlockSources" in restored.sourcePackage!));
  assert.throws(() => unpackNative(packed.document, null), /段落原件缺失/);
});
