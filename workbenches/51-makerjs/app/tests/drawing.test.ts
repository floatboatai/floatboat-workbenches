import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import DxfParser from "dxf-parser";
import {
  seed,
  validateDrawing,
  importProject,
} from "../src/contracts/drawing.ts";
import { makeDrawing } from "../src/server/geometry.ts";
import { createStore, StoreError } from "../src/server/store.ts";
test("面板导出独立毫米SVG与可解析DXF，并保留精确孔位", () => {
  const result = makeDrawing(seed);
  assert.match(result.svg, /width="160mm"/);
  assert.match(result.svg, /height="100mm"/);
  assert.match(result.svg, /viewBox=/);
  assert.doesNotMatch(result.svg, /<script|(?:href|src)=["\']https?:\/\//);
  const parsed = new DxfParser().parseSync(result.dxf);
  assert.ok(parsed);
  assert.equal(parsed.header.$INSUNITS, 4);
  const circles = parsed.entities.filter((entity) => entity.type === "CIRCLE");
  assert.equal(circles.length, 4);
  const points = circles
    .map((entity) => {
      assert.ok("center" in entity && "radius" in entity);
      const value = entity as unknown as {
        center: { x: number; y: number };
        radius: number;
      };
      assert.equal(value.radius, 3);
      return [value.center.x, value.center.y];
    })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(points, [
    [15, 15],
    [15, 85],
    [145, 15],
    [145, 85],
  ]);
  assert.ok(
    Math.abs(
      result.cutLength -
        (2 * (160 + 100) - 8 * 6 + 2 * Math.PI * 6 + 4 * Math.PI * 6),
    ) < 0.00001,
  );
});
test("孔阵列居中，框形刀模同时包含内外轮廓", () => {
  const grid = makeDrawing({ ...seed, template: "perforated" });
  const parsed = new DxfParser().parseSync(grid.dxf);
  assert.ok(parsed);
  assert.equal(
    parsed.entities.filter((entity) => entity.type === "CIRCLE").length,
    15,
  );
  assert.equal(grid.holes, 15);
  const frame = makeDrawing({ ...seed, template: "frame" });
  assert.equal(frame.holes, 0);
  assert.ok(
    Math.abs(
      frame.cutLength -
        (2 * (160 + 100) - 8 * 6 + 2 * Math.PI * 6 + 2 * (140 + 80)),
    ) < 0.00001,
  );
});
test("拒绝越界、孔相交、退化开口和无效JSON项目，保留小数尺寸", () => {
  assert.equal(validateDrawing({ ...seed, width: 160.5 }).width, 160.5);
  for (const bad of [
    { width: 0 },
    { radius: 50 },
    { inset: 2 },
    { inset: 48 },
    { template: "perforated", pitchX: 2 },
    { template: "perforated", columns: 12 },
    { template: "frame", wall: 49 },
    { columns: 2.5 },
    { height: Infinity },
  ])
    assert.throws(() => validateDrawing({ ...seed, ...bad }));
  assert.throws(() =>
    importProject({ schemaVersion: 2, title: "x", parameters: seed }),
  );
  assert.deepEqual(
    importProject({ schemaVersion: 1, title: "图纸", parameters: seed }).data,
    seed,
  );
});
test("磁盘保存重开可重建几何，拒绝过期版本", () => {
  const folder = mkdtempSync(join(tmpdir(), "drawing-"));
  let db = new DatabaseSync(join(folder, "data.sqlite"));
  try {
    db.exec(
      "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT,payload TEXT,revision INTEGER,updated_at TEXT)",
    );
    let store = createStore(db, validateDrawing);
    const project = store.create("测试面板", { ...seed, width: 180 });
    db.close();
    db = new DatabaseSync(join(folder, "data.sqlite"));
    store = createStore(db, validateDrawing);
    const restored = store.get(project.id);
    assert.equal(makeDrawing(restored.data).width, 180);
    store.update(project.id, "修订", restored.data, 1);
    assert.throws(
      () => store.update(project.id, "过期", seed, 1),
      (error) => error instanceof StoreError && error.status === 409,
    );
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
