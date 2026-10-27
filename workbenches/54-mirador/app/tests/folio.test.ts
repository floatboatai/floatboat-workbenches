import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { seed, validateCollection, reviewCsv } from "../src/contracts/folio.ts";
import { createStore } from "../src/server/store.ts";
import {
  createImages,
  imageInfo,
  imageManifest,
} from "../src/server/images.ts";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=",
  "base64",
);
async function database(path: string) {
  const db = new DatabaseSync(path);
  for (const f of ["0002_projects.sql", "0003_images.sql"])
    db.exec(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    );
  return db;
}
test("folio enforces page references, unique records, viewport bounds and retained draft", () => {
  const data = structuredClone(seed);
  data.draft = { text: "尚未添加的复核意见", pageId: "demo-a" };
  assert.equal(validateCollection(data).draft.text, "尚未添加的复核意见");
  assert.throws(() => validateCollection({ ...data, left: "missing" }));
  assert.throws(() =>
    validateCollection({ ...data, pages: [...data.pages, data.pages[0]] }),
  );
  assert.throws(() =>
    validateCollection({
      ...data,
      reviews: [{ id: "r1", pageId: "absent", text: "test", status: "open" }],
    }),
  );
  assert.throws(() =>
    validateCollection({
      ...data,
      views: {
        left: { x: 0, y: 0, zoom: 0, rotation: 0, flip: false },
        right: null,
      },
    }),
  );
  assert.throws(() =>
    validateCollection({
      ...data,
      pages: [{ ...data.pages[0], assetId: "../../secrets" }],
    }),
  );
});
test("review CSV escapes formulas, commas, quotes and line breaks", () => {
  const data = structuredClone(seed);
  data.pages[0].label = '=HYPERLINK("x")';
  data.reviews = [
    {
      id: "r1",
      pageId: "demo-a",
      text: '行一, "引号"\n行二',
      status: "resolved",
    },
  ];
  const csv = reviewCsv(data);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"行一, ""引号""\n行二"'));
  assert.ok(csv.includes("已复核"));
});
test("PNG header dimensions, wrong format and oversized uploads are bounded", () => {
  assert.deepEqual(imageInfo(png), { mime: "image/png", width: 1, height: 1 });
  assert.throws(() => imageInfo(Buffer.from("<svg/>")));
  assert.throws(() => imageInfo(Buffer.alloc(1048577)));
  const huge = Buffer.from(png);
  huge.writeUInt32BE(10001, 16);
  assert.throws(() => imageInfo(huge));
});
test("original image bytes persist through resource storage, hash checks and process reopen", async () => {
  const directory = await mkdtemp(join(tmpdir(), "folio-assets-"));
  await mkdir(join(directory, "scans"));
  let db = await database(join(directory, "store.sqlite"));
  const resources = {
    configured: () => true,
    path: async (id: string, name?: string) => join(directory, id, name ?? ""),
  };
  try {
    let images = createImages(db, resources);
    const asset = await images.put({
      name: "扫描页.png",
      base64: png.toString("base64"),
    });
    assert.equal(asset.id, createHash("sha256").update(png).digest("hex"));
    assert.deepEqual((await images.read(asset.id)).bytes, png);
    assert.equal(
      (await images.put({ name: "重复.png", base64: png.toString("base64") }))
        .id,
      asset.id,
    );
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM images").get()?.count,
      1,
    );
    await assert.rejects(
      images.put({
        name: "坏校验.png",
        base64: png.toString("base64"),
        expectedId: "a".repeat(64),
      }),
    );
    await assert.rejects(images.put({ name: "坏编码.png", base64: "%%%" }));
    db.close();
    db = new DatabaseSync(join(directory, "store.sqlite"));
    images = createImages(db, resources);
    assert.deepEqual((await images.read(asset.id)).bytes, png);
    await rm(join(directory, "scans", asset.id + ".png"));
    await assert.rejects(images.read(asset.id), /原图文件不可用/);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("project reopens with review, draft and viewport; stale mutations do not overwrite it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "folio-project-"));
  let db = await database(join(directory, "store.sqlite"));
  try {
    let store = createStore(db, validateCollection);
    const data = structuredClone(seed);
    data.reviews = [
      { id: "note-1", pageId: "demo-b", text: "日期有差异", status: "open" },
    ];
    data.views.left = { x: 250, y: 300, zoom: 1.5, rotation: 90, flip: false };
    data.draft.text = "继续核查";
    const a = store.create("资料对照", data);
    store.update(a.id, "资料对照已核", data, 1);
    assert.throws(() => store.update(a.id, "旧窗口修改", seed, 1), /另一窗口/);
    assert.throws(() => store.remove(a.id, 1), /已更新/);
    db.close();
    db = new DatabaseSync(join(directory, "store.sqlite"));
    store = createStore(db, validateCollection);
    const reopened = store.get(a.id);
    assert.equal(reopened.revision, 2);
    assert.deepEqual(reopened.data, data);
    store.remove(a.id, 2);
    assert.throws(() => store.get(a.id), /不存在/);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("IIIF manifest uses current origin and immutable image reference, without external services", () => {
  const manifest = imageManifest(
    {
      id: "a".repeat(64),
      name: "原图",
      mime: "image/png",
      width: 800,
      height: 1200,
    },
    "http://127.0.0.1:54321",
  );
  assert.equal(manifest.type, "Manifest");
  assert.equal(manifest.items[0].width, 800);
  assert.equal(
    manifest.items[0].items[0].items[0].body.id,
    "http://127.0.0.1:54321/api/images/" + "a".repeat(64),
  );
  assert.equal("service" in manifest.items[0].items[0].items[0].body, false);
});

test("coerced array statuses and page references are rejected rather than silently changed", () => {
  assert.throws(() =>
    validateCollection({
      ...seed,
      reviews: [
        { id: "r", pageId: ["demo-a"], status: ["resolved"], text: "check" },
      ],
    }),
  );
});
