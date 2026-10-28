import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  recordNativeText,
  nativeTextDrafts,
  acknowledgeNativeText,
  graphText,
} from "../src/contracts/native-text.ts";
import {
  seed,
  graphValue,
  importFlow,
  validateFlow,
} from "../src/contracts/flow.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";

test("uncommitted native text survives a real autosave receipt and recovery without changing the graph", async () => {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  try {
    const store = createAutosaveStore(db, validateFlow),
      documentId = randomUUID();
    const extra = recordNativeText(
      {
        raw: "{ unfinished",
        nativeTextEdits: { start: { id: "start", text: "" } },
      },
      { id: "review", text: "仍在输入\n下一行\n" },
    );
    const receipt = await store.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "原生编辑稿", data: seed, extra },
    });
    assert.equal(receipt.phase, "saved");
    const saved = store.get(documentId)!;
    assert.equal(saved.snapshot.data.graph, seed.graph);
    assert.equal(
      graphText(graphValue(receipt.project!.data.graph), "review"),
      "负责人初审",
    );
    const imported = importFlow({ snapshot: saved.snapshot });
    assert.deepEqual(imported.extra, extra);
    assert.deepEqual(nativeTextDrafts(imported.extra), [
      { id: "start", text: "" },
      { id: "review", text: "仍在输入\n下一行\n" },
    ]);
  } finally {
    db.close();
  }
});
test("native text acknowledgement requires the captured draft and actual matching model result", () => {
  const edit = { id: "review", text: "完成输入\r\n" },
    extra = recordNativeText({ raw: "unapplied" }, edit);
  assert.equal(acknowledgeNativeText(extra, edit, "旧标签"), extra);
  assert.equal(acknowledgeNativeText(extra, edit, undefined), extra);
  const newer = recordNativeText(extra, { id: "review", text: "后续输入" });
  assert.equal(acknowledgeNativeText(newer, edit, "完成输入"), newer);
  assert.deepEqual(acknowledgeNativeText(extra, edit, "完成输入"), {
    raw: "unapplied",
  });
  const blank = { id: "review", text: "" };
  assert.deepEqual(
    acknowledgeNativeText(recordNativeText({}, blank), blank, ""),
    {},
  );
  assert.equal(
    graphText({ ...graphValue(seed.graph), nodes: [] }, "review"),
    undefined,
  );
});
