import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  seed,
  restoreDocument,
  validateDocument,
  decodeRecovery,
} from "../src/contracts/document.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
const data = () => ({
  ...seed,
  document: {
    id: "test",
    schemaVersion: 1,
    sections: [
      {
        id: "s",
        blocks: [
          {
            id: "p",
            type: "paragraph",
            runs: [{ id: "r", kind: "text", text: "中文文稿" }],
          },
        ],
      },
    ],
  },
});
function db() {
  const d = new DatabaseSync(":memory:");
  for (const n of ["0002_projects.sql", "0003_autosave.sql"]) {
    try {
      d.exec(
        readFileSync(new URL("../migrations/" + n, import.meta.url), "utf8"),
      );
    } catch (e) {
      d.close();
      throw e;
    }
  }
  return d;
}
test("完整JSON保留原生OOXML、图像、笔记及未完成标题", () => {
  const d = {
    ...data(),
    notes: "未失焦校样笔记",
    document: {
      ...data().document,
      sourcePackage: {
        format: "docx",
        parts: {
          "custom/a.xml": {
            data: "<opaque>原文</opaque>",
            encoding: "utf8",
            originalHash: "abc",
          },
        },
      },
      assets: { a: { id: "a", url: "data:image/png;base64,AAAA" } },
    },
  };
  const r = decodeRecovery({
    snapshot: { title: "", data: d, extra: { pageSearch: "-" } },
    current: { data: d },
    pending: { snapshot: { data: d } },
  });
  assert.deepEqual(r.data, d);
  assert.equal(r.title, "");
  assert.equal(r.extra.pageSearch, "-");
});
test("850KB正式限制与1.90–1.94MB快照恢复边界分离，外层可包含重复回执", () => {
  const d = {
    ...data(),
    document: { ...data().document, opaque: "x".repeat(1910000) },
  };
  assert.throws(() => validateDocument(d), /850/);
  assert.deepEqual(restoreDocument(d), d);
  assert.equal(
    decodeRecovery({
      snapshot: { title: "", data: d, extra: {} },
      current: { data: d },
      pending: { snapshot: { data: d } },
    }).data.document?.id,
    "test",
  );
  assert.throws(
    () =>
      decodeRecovery({
        snapshot: {
          title: "",
          data: {
            ...d,
            document: { ...d.document, opaque: "x".repeat(1945000) },
          },
          extra: {},
        },
      }),
    /1.94/,
  );
});
test("临时与远程图像不得伪装成完整可恢复文档", () => {
  for (const url of ["blob:ephemeral", "https://remote/image.png"])
    assert.throws(
      () =>
        restoreDocument({
          ...data(),
          document: { ...data().document, assets: { a: { id: "a", url } } },
        }),
      /外部/,
    );
});
test("原件标识和非法文档结构被拒绝", () => {
  assert.throws(() =>
    restoreDocument({
      ...data(),
      source: { hash: "../private", name: "x", bytes: 4, warnings: [] },
    }),
  );
  assert.throws(() =>
    restoreDocument({ ...data(), document: { id: "test", sections: [{}] } }),
  );
});
test("自动保存回执幂等、版本冲突保留完整稿、无效标题不覆盖正式稿", async () => {
  const d = db();
  try {
    const s = createAutosaveStore(d, validateDocument);
    const request = {
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "原稿", data: data(), extra: {} },
    };
    const a = await s.commit(request);
    assert.equal(a.phase, "saved");
    assert.deepEqual(await s.commit(request), a);
    assert.throws(() => validateDocument({ ...seed, document: null }));
    const empty = {
      ...request,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: a.project!.id,
      projectRevision: 1,
      snapshot: {
        ...request.snapshot,
        title: "",
        extra: { typing: "尚未完成" },
      },
    };
    const b = await s.commit(empty);
    assert.equal(b.phase, "draft");
    assert.equal(s.get(request.documentId)?.snapshot.title, "");
    const external = {
      ...request,
      documentId: randomUUID(),
      mutationId: randomUUID(),
      projectId: a.project!.id,
      projectRevision: 1,
      snapshot: { ...request.snapshot, title: "另一窗口" },
    };
    assert.equal((await s.commit(external)).phase, "saved");
    const stale = {
      ...empty,
      mutationId: randomUUID(),
      draftRevision: 2,
      snapshot: { ...request.snapshot, title: "本机尚未合并" },
    };
    assert.equal((await s.commit(stale)).phase, "conflict");
    assert.equal(s.get(request.documentId)?.snapshot.title, "本机尚未合并");
  } finally {
    d.close();
  }
});
test("原件缺失时仅保留恢复稿，不标记正式保存", async () => {
  const d = db();
  try {
    const s = createAutosaveStore(d, validateDocument, undefined, {
      verify: async () => {
        throw Error("原件资源不可用");
      },
    });
    const r = await s.commit({
      documentId: randomUUID(),
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "原件核验", data: data(), extra: {} },
    });
    assert.equal(r.phase, "draft");
    assert.match(r.message, /原件/);
  } finally {
    d.close();
  }
});

test("DOCX字体边界移除CSS列表，eastAsia保留且二次往返不叠加", async () => {
  const { zipSync, unzipSync, strToU8, strFromU8 } = await import("fflate");
  const { normalizeDocxFonts } = await import("../src/contracts/docx-fonts.ts");
  const xml =
    '<w:rFonts w:ascii="&quot;Calibri, sans-serif&quot;, sans-serif" w:hAnsi="Calibri, sans-serif"/><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei"/>';
  const once = normalizeDocxFonts(
    zipSync({
      "word/document.xml": strToU8(xml),
      "customXml/preserve.xml": strToU8("untouched"),
    }),
  );
  const twice = normalizeDocxFonts(once);
  const a = unzipSync(once),
    b = unzipSync(twice);
  assert.equal(
    strFromU8(a["word/document.xml"]),
    strFromU8(b["word/document.xml"]),
  );
  assert.match(strFromU8(a["word/document.xml"]), /w:ascii="Calibri"/);
  assert.match(
    strFromU8(a["word/document.xml"]),
    /w:eastAsia="Workbench Sans SC"/,
  );
  assert.match(
    strFromU8(a["word/document.xml"]),
    /w:eastAsia="Microsoft YaHei"/,
  );
  assert.equal(strFromU8(a["customXml/preserve.xml"]), "untouched");
});
test("完整OOXML无损压缩可恢复，展开容量与CRC受限", async () => {
  const { packNative, unpackSource } = await import(
    "../src/contracts/source-package.ts"
  );
  const doc = {
    ...data().document,
    sourcePackage: {
      format: "docx",
      mainDocumentPart: "word/document.xml",
      parts: {
        "word/styles.xml": {
          data: "<style>中文</style>".repeat(80000),
          encoding: "utf8",
          originalHash: "original",
        },
      },
    },
  };
  const packed = packNative(doc as unknown as Parameters<typeof packNative>[0]);
  assert.ok(packed.archive);
  assert.deepEqual(unpackSource(packed.archive), doc.sourcePackage);
  assert.throws(
    () => unpackSource({ ...packed.archive, bytes: 8000001 }),
    /无效/,
  );
  assert.throws(() => unpackSource({ ...packed.archive, bytes: 10 }), /长度/);
  const corrupt = Uint8Array.from(atob(packed.archive.data), (c) =>
    c.charCodeAt(0),
  );
  corrupt[corrupt.length - 8] ^= 1;
  assert.throws(
    () =>
      unpackSource({
        ...packed.archive,
        data: btoa(String.fromCharCode(...corrupt)),
      }),
    /校验/,
  );
});
