import assert from "node:assert/strict";
import { test } from "node:test";
import {
  object,
  templates,
  validatePoster,
  parseProject,
} from "../src/contracts/poster.ts";

test("three usable templates round-trip through the portable schema with independent identities", () => {
  for (const template of templates) {
    const model = template.create();
    assert.deepEqual(parseProject(JSON.stringify(model)), model);
    assert.equal(
      new Set(model.objects.map((o) => o.id)).size,
      model.objects.length,
    );
  }
  assert.notEqual(object("text").id, object("text").id);
});
test("layer ordering, multiline Chinese text and all geometry survive export/import", () => {
  const model = templates[0].create();
  model.objects.reverse();
  Object.assign(model.objects[0], {
    x: -42.5,
    y: 600,
    angle: 45,
    scaleX: 1.2,
    scaleY: 0.7,
    text: "第一行\n第二行",
    opacity: 0.7,
  });
  const restored = parseProject(JSON.stringify(model));
  assert.deepEqual(restored, model);
  assert.equal(restored.objects[0].id, "place");
});
test("untrusted Fabric objects and network-bearing fields are rejected before any renderer receives them", () => {
  const model = templates[0].create();
  for (const extra of [
    { src: "https://example.com/image.png" },
    { clipPath: { type: "image" } },
    { styles: { 0: { 0: { fill: "url(http://example.com)" } } } },
    { type: "image" },
  ])
    assert.throws(() =>
      validatePoster({
        ...model,
        objects: [{ ...model.objects[0], ...extra }],
      }),
    );
  assert.throws(() =>
    validatePoster({ ...model, background: "url(http://example.com)" }),
  );
  assert.throws(() =>
    validatePoster({
      ...model,
      objects: [{ ...model.objects[0], fill: "red" }],
    }),
  );
});
test("canvas limits reject oversize, fractional and nonfinite dimensions", () => {
  const model = templates[2].create();
  for (const width of [0, 4097, 128.5, NaN, Infinity])
    assert.throws(() => validatePoster({ ...model, width }));
  assert.throws(() => validatePoster({ ...model, width: 4096, height: 4096 }));
});
test("duplicate identifiers and unsupported shape/transform values cannot be imported", () => {
  const model = templates[0].create(),
    first = model.objects[0];
  assert.throws(() => validatePoster({ ...model, objects: [first, first] }));
  for (const patch of [
    { angle: 361 },
    { scaleX: 0 },
    { fontFamily: "remote-font" },
    { width: 8192, scaleX: 3 },
    { opacity: 1.1 },
  ])
    assert.throws(() =>
      validatePoster({ ...model, objects: [{ ...first, ...patch }] }),
    );
});
test("object, text and aggregate budgets are enforced for Unicode content", () => {
  const model = templates[2].create();
  assert.throws(() =>
    validatePoster({
      ...model,
      objects: Array.from({ length: 161 }, () => object("rect")),
    }),
  );
  assert.throws(() =>
    validatePoster({
      ...model,
      objects: [object("text", { text: "x".repeat(8001) })],
    }),
  );
  assert.throws(() =>
    validatePoster({
      ...model,
      objects: Array.from({ length: 30 }, () =>
        object("text", { text: "字".repeat(8000), width: 8192, fontSize: 8 }),
      ),
    }),
  );
});
test("empty artboard and zero opacity/stroke are intentional supported values", () => {
  assert.equal(validatePoster(templates[2].create()).objects.length, 0);
  const model = templates[0].create();
  model.objects[0].opacity = 0;
  model.objects[0].strokeWidth = 0;
  assert.equal(validatePoster(model).objects[0].opacity, 0);
});
test("incomplete JSON remains a clear recoverable error", () => {
  assert.throws(() => parseProject('{"schemaVersion":'), /尚未完整/);
  assert.throws(() => parseProject(" ".repeat(550001)), /550 KB/);
});

test("pathological narrow text boxes are rejected before Fabric performs layout", () => {
  const model = templates[2].create();
  assert.throws(
    () =>
      validatePoster({
        ...model,
        objects: [
          object("text", { width: 1, fontSize: 240, text: "文字".repeat(200) }),
        ],
      }),
    /排版过高/,
  );
});
