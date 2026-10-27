import {readRows,withRows,withoutRows,pendingCoordinates,rowsFor} from "../src/ui/coordinate-draft.ts";
import { restoreDraftData } from "../src/contracts/model.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Polygon from "ol/geom/Polygon.js";
import { getArea } from "ol/sphere.js";
import {
  area,
  areaCsv,
  geojson,
  importDocument,
  projectDocument,
  ring,
  seed,
  validate,
  RADIUS,
  type Position,
} from "../src/contracts/model.ts";
import { createStore, StoreError } from "../src/server/store.ts";
const rectangle: Position[] = [
  [120, 30],
  [120.001, 30],
  [120.001, 30.001],
  [120, 30.001],
  [120, 30],
];
test("经纬度面积与独立球面矩形公式及OpenLayers一致", () => {
  const expected =
    RADIUS ** 2 *
    ((0.001 * Math.PI) / 180) *
    (Math.sin((30.001 * Math.PI) / 180) - Math.sin((30 * Math.PI) / 180));
  assert.ok(Math.abs(area(rectangle) - expected) < 0.001);
  assert.ok(
    Math.abs(
      area(rectangle) -
        getArea(new Polygon([rectangle]), { projection: "EPSG:4326" }),
    ) < 0.001,
  );
  assert.ok(area(rectangle) > 10700 && area(rectangle) < 10720);
  assert.equal(area(rectangle), area([...rectangle].reverse()));
  assert.deepEqual(ring([...rectangle].reverse()), rectangle);
});
test("拒绝自交、缺闭合、重复顶点、越界、跨度及退化坐标", () => {
  for (const bad of [
    rectangle.slice(0, -1),
    [
      [0, 0],
      [0.001, 0.001],
      [0, 0.001],
      [0.001, 0],
      [0, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [1, 0],
      [0, 0],
    ],
    [
      [181, 0],
      [181.001, 0],
      [181, 1],
      [181, 0],
    ],
    [
      [0, 86],
      [0.001, 86],
      [0.001, 86.001],
      [0, 86],
    ],
    [
      [179.99, 0],
      [-179.99, 0],
      [-179.99, 0.01],
      [179.99, 0],
    ],
    [
      [0, 0],
      [0.001, 0],
      [0.002, 0],
      [0, 0],
    ],
    [
      ["120", 30],
      [120.001, 30],
      [120, 30.001],
      ["120", 30],
    ],
  ])
    assert.throws(() => ring(bad));
});
test("只接受受限Polygon和明确版本，非法导入不修改原模型", () => {
  const original = structuredClone(seed);
  for (const geometry of [
    { type: "MultiPolygon", coordinates: [[rectangle]] },
    { type: "Polygon", coordinates: [rectangle, rectangle] },
    { type: "Point", coordinates: [120, 30] },
  ])
    assert.throws(() =>
      importDocument({ type: "Feature", properties: { name: "x" }, geometry }),
    );
  assert.throws(() =>
    importDocument({
      type: "FeatureCollection",
      crs: { name: "EPSG:3857" },
      features: [],
    }),
  );
  assert.throws(() =>
    importDocument({ ...projectDocument("测试", seed), version: 999 }),
  );
  assert.throws(() =>
    validate({
      ...seed,
      plots: Array.from({ length: 31 }, (_, i) => ({
        ...seed.plots[0],
        id: "field-" + i,
      })),
    }),
  );
  assert.throws(() =>
    validate({ ...seed, plots: [seed.plots[0], seed.plots[0]] }),
  );
  assert.deepEqual(original, seed);
});
test("GeoJSON与项目JSON独立序列化后再导入保留边界名称备注", () => {
  const exportGeo = JSON.parse(JSON.stringify(geojson(seed)));
  assert.deepEqual(importDocument(exportGeo).data, seed);
  const exported = JSON.parse(
    JSON.stringify(projectDocument("验收地块", seed)),
  );
  assert.deepEqual(importDocument(exported), { title: "验收地块", data: seed });
  const empty = validate({ ...seed, plots: [] });
  assert.deepEqual(importDocument(geojson(empty)).data, empty);
});
test("面积CSV有独立单位、正确转义与公式保护", () => {
  const model = validate({
    ...seed,
    plots: [{ ...seed.plots[0], name: " =1+1", note: '现场,说明\n含"引号"' }],
  });
  const csv = areaCsv(model);
  assert.ok(csv.startsWith("\uFEFF分区编号,分区名称,面积_m2,面积_ha"));
  assert.ok(csv.includes('"\' =1+1"'));
  assert.ok(csv.includes('"现场,说明\n含""引号"""'));
  assert.ok(
    csv.includes((area(model.plots[0].coordinates) / 10000).toFixed(4)),
  );
});
test("SQLite重开恢复与revision更新删除冲突不覆盖记录", () => {
  const dir = mkdtempSync(join(tmpdir(), "field-atlas-"));
  let db = new DatabaseSync(join(dir, "test.sqlite"));
  try {
    db.exec(
      readFileSync(
        new URL("../migrations/0002_projects.sql", import.meta.url),
        "utf8",
      ),
    );
    let store = createStore(db, validate);
    const first = store.create("地块A", seed);
    const updated = store.update(first.id, "地块B", seed, first.revision);
    assert.equal(updated.revision, 2);
    assert.throws(
      () => store.update(first.id, "覆盖", seed, 1),
      (error) => error instanceof StoreError && error.status === 409,
    );
    assert.throws(
      () => store.remove(first.id, 1),
      (error) => error instanceof StoreError && error.status === 409,
    );
    db.close();
    db = new DatabaseSync(join(dir, "test.sqlite"));
    store = createStore(db, validate);
    assert.equal(store.get(first.id).title, "地块B");
    assert.deepEqual(store.get(first.id).data, seed);
    store.remove(first.id, 2);
    assert.equal(store.list().length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("未命名分区草稿可恢复但正式校验仍拒绝空名称", () => {
  const draft = { ...seed, plots: [{ ...seed.plots[0], name: "" }] };
  assert.equal(restoreDraftData(draft).plots[0].name, "");
  assert.throws(() => validate(draft));
  assert.throws(() =>
    restoreDraftData({ ...draft, plots: [{ ...draft.plots[0], name: 42 }] }),
  );
});

test("各分区未应用坐标独立保存并可序列化恢复",()=>{const first=rowsFor(seed.plots[0]);first[0][0]='120.15bad';const second=rowsFor(seed.plots[1]);second[1][1]='尚未填完';let extra=withRows({},seed.plots[0].id,first);extra=withRows(extra,seed.plots[1].id,second);extra=JSON.parse(JSON.stringify(extra));assert.deepEqual(readRows(extra,seed.plots[0]),first);assert.deepEqual(readRows(extra,seed.plots[1]),second);assert.deepEqual(pendingCoordinates(extra,seed),seed.plots.map(plot=>plot.id));const reset=withoutRows(extra,seed.plots[0].id);assert.deepEqual(readRows(reset,seed.plots[0]),rowsFor(seed.plots[0]));assert.deepEqual(readRows(reset,seed.plots[1]),second);});
