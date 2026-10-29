// The TypeScript port must reproduce the pinned DeepTutor Python modules.
// Expected values come from reference/make_parity_fixtures.py (Python 3.12).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { preview, normalizeQuestion } from "../src/contracts/deeptutor/importing.ts";
import { checkAnswer } from "../src/contracts/deeptutor/answers.ts";
import { schedule, dayBounds } from "../src/contracts/deeptutor/scheduler.ts";
import { pyRound, floatRepr, dumpsSorted } from "../src/contracts/deeptutor/pycompat.ts";
import { example } from "../src/contracts/example.ts";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/python-parity.json", import.meta.url), "utf8"),
);
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

for (const bank of fixture.banks) {
  test(`bank import parity: ${bank.name}`, () => {
    if (bank.error) {
      assert.throws(() => preview(bank.text, bank.filename), {
        message: bank.error,
      });
      return;
    }
    assert.deepEqual(plain(preview(bank.text, bank.filename)), bank.result);
  });
}

test("answer check parity across choice, multi-choice, true/false and self-assessed kinds", () => {
  for (const c of fixture.checks)
    assert.equal(
      checkAnswer(c.entry, c.answer),
      c.result,
      `${c.entry.question_type} ${JSON.stringify(c.answer)}`,
    );
});

test("review schedule parity, including chained intervals and half-even rounding", () => {
  for (const s of fixture.schedules)
    assert.deepEqual(schedule(s.state, s.rating, s.now), s.result, `${s.rating} ${JSON.stringify(s.state)}`);
  assert.throws(() => schedule({}, "later", 1), { message: "Unknown review rating" });
});

test("day bounds parity across DST and fixed-offset zones", () => {
  for (const d of fixture.dayBounds)
    assert.deepEqual(dayBounds(d.timezone, d.now), d.result, d.timezone);
  assert.throws(() => dayBounds("Mars/Base", 1), { message: "Unknown timezone" });
});

test("questions normalized by the Python service keep their identity", () => {
  for (const q of example as Record<string, unknown>[])
    assert.equal(normalizeQuestion(q).question_id, q.question_id);
});

test("Python numeric helpers", () => {
  assert.equal(pyRound(1.0625, 3), 1.062);
  assert.equal(pyRound(1.0635, 3), 1.063);
  assert.equal(pyRound(0.125, 2), 0.12);
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(2.675, 2), 2.67);
  assert.equal(floatRepr(2), "2.0");
  assert.equal(floatRepr(1e20), "1e+20");
  assert.equal(floatRepr(1.5e-5), "1.5e-05");
  assert.equal(floatRepr(0.0001), "0.0001");
  assert.equal(floatRepr(123456.789), "123456.789");
  assert.equal(dumpsSorted({ b: ["中", "\n"], a: "\u0001" }), '{"a": "\\u0001", "b": ["中", "\\n"]}');
});
