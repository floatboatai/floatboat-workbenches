import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseInput } from "../src/server/parser.ts";
import {
  analyze,
  seed,
  empty,
  observationValue,
  restoreObservation,
  canonicalPath,
  dayKey,
  aiReferrer,
  csv,
  candidateValue,
} from "../src/contracts/observation.ts";
import { classifyBot } from "../src/vendor/geoinflow/rules/bots.ts";
import { createStore } from "../src/server/store.ts";
import { createAutosaveStore } from "../src/server/autosave.ts";
test("pinned GEOInflow token classifier rejects lookalikes, URL-only mentions and mixed identities", () => {
  assert.equal(
    classifyBot("Mozilla/5.0 (compatible; GPTBot/1.3)").name,
    "GPTBot",
  );
  assert.equal(classifyBot("NotGPTBot/1.0").name, "其他");
  assert.equal(
    classifyBot("Mozilla/5.0 https://example.com/GPTBot").name,
    "其他",
  );
  assert.equal(
    classifyBot("GPTBot/1.0 ClaudeBot/1.0").recognition,
    "ambiguous",
  );
});
test("HTTP identity and robots-only purpose remain distinct, and children retain native precedence", () => {
  assert.equal(classifyBot("Google-Extended").name, "其他");
  assert.equal(
    classifyBot("Googlebot/2.1 Googlebot-Image/1.0").name,
    "Googlebot-Image",
  );
  assert.equal(classifyBot("Googlebot/2.1").aiEligible, false);
});
test("AI referral detection uses upstream approved domains and refuses deceptive suffixes", () => {
  assert.equal(aiReferrer("https://chatgpt.com/c/demo"), "ChatGPT");
  assert.equal(
    aiReferrer("https://www.perplexity.ai/search/test"),
    "Perplexity",
  );
  assert.equal(aiReferrer("https://chatgpt.com.attacker.example/"), "");
  assert.equal(aiReferrer("https://google.com/search"), "");
});
test("JSON logs retain accepted entries with explicit line errors and deterministic input identity", () => {
  const input = {
    kind: "logs",
    domain: "example.com",
    format: "json",
    text: JSON.stringify([
      {
        time: "2026-10-27T02:00:00Z",
        path: "/docs?ref=demo",
        status: 200,
        userAgent: "GPTBot/1.3",
        ip: "203.0.113.8",
      },
      { time: "2026-02-30", path: "/bad", status: 200 },
      { time: "2026-10-27", url: "https://other.example/a", status: 200 },
    ]),
  };
  const result = parseInput(input);
  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 2);
  assert.deepEqual(
    result.errors.map((e) => e.line),
    [2, 3],
  );
  assert.equal(result.records[0].path, "/docs");
  assert.deepEqual(candidateValue(result), result);
  assert.deepEqual(parseInput(input), result);
  assert.notEqual(
    parseInput({ ...input, text: input.text + " " }).inputHash,
    result.inputHash,
  );
});
test("combined logs use upstream strict timestamp parsing and preserve missing-byte zero", () => {
  const r = parseInput({
    kind: "logs",
    domain: "example.com",
    format: "combined",
    text: '203.0.113.8 - - [27/Oct/2026:10:20:30 +0800] "GET /docs HTTP/1.1" 200 - "https://chatgpt.com/" "GPTBot/1.3"',
  });
  assert.equal(r.accepted, 1);
  assert.equal(
    "time" in r.records[0] && r.records[0].time,
    "2026-10-27T02:20:30.000Z",
  );
  assert.equal("bytes" in r.records[0] && r.records[0].bytes, 0);
});
test("CSV and sitemap inventory preserve quoted titles and report duplicate paths", () => {
  const r = parseInput({
    kind: "pages",
    domain: "example.com",
    format: "csv",
    text: 'path,title,priority\r\n/docs,"Guide, setup",high\r\n/docs,Duplicate,normal',
  });
  assert.equal(r.accepted, 1);
  assert.equal(r.rejected, 1);
  assert.equal("title" in r.records[0] && r.records[0].title, "Guide, setup");
  assert.equal(
    parseInput({
      kind: "pages",
      domain: "example.com",
      format: "sitemap",
      text: "<urlset><url><loc>https://example.com/a?x=1&amp;y=2</loc></url></urlset>",
    }).records[0].path,
    "/a",
  );
  assert.throws(() =>
    parseInput({
      kind: "pages",
      domain: "example.com",
      format: "sitemap",
      text: "<!DOCTYPE test><urlset></urlset>",
    }),
  );
});
test("cross-site, protocol, malformed CSV and capacity violations fail explicitly", () => {
  for (const p of [
    "https://other.example/",
    "//other.example/",
    "javascript:alert(1)",
  ])
    assert.throws(() => canonicalPath(p, "example.com"));
  assert.throws(() =>
    parseInput({
      kind: "pages",
      domain: "example.com",
      format: "csv",
      text: 'path,title\n/a,"unfinished',
    }),
  );
  assert.throws(() =>
    parseInput({
      kind: "logs",
      domain: "example.com",
      format: "json",
      text: JSON.stringify(Array(201).fill({})),
    }),
  );
});
test("all metrics, coverage and referral views derive from the same selected records", () => {
  const r = analyze(seed);
  assert.equal(r.logs.length, 9);
  assert.equal(r.ai.length, 6);
  assert.equal(r.errors, 2);
  assert.equal(r.visited, 5);
  assert.equal(r.pages.length, 8);
  assert.equal(r.referrals.length, 2);
  const errors = analyze({
    ...seed,
    filters: { ...seed.filters, http: "errors" },
  });
  assert.equal(errors.logs.length, 2);
  assert.equal(errors.errors, 2);
  assert.equal(errors.ai.length, 2);
  assert.equal(errors.visited, 2);
  assert.equal(analyze(empty).pages.length, 0);
});
test("date scope respects the chosen timezone and unfinished dates remain recoverable drafts", () => {
  assert.equal(
    dayKey("2026-10-27T02:00:00Z", "America/New_York"),
    "2026-10-26",
  );
  assert.equal(dayKey("2026-10-27T02:00:00Z", "Asia/Shanghai"), "2026-10-27");
  const bad = { ...seed, filters: { ...seed.filters, from: "2026-0" } };
  assert.throws(() => observationValue(bad));
  assert.deepEqual(restoreObservation(bad), { ...bad, logs: bad.logs.map(r => ({ ...r, time: new Date(r.time).toISOString() })) });
  assert.throws(() => analyze(bad));
  assert.equal(
    analyze({ ...seed, filters: { ...seed.filters, from: "2026-10-27" } }).logs
      .length,
    8,
  );
});
test("formal UTF-8 capacity is bounded while the entire oversized working copy is preserved", () => {
  const logs = Array.from({ length: 200 }, (_, i) => ({
    ...seed.logs[0],
    id: "large-" + i,
    path: "/" + "文".repeat(498),
    userAgent: "文".repeat(500),
    referrer: "文".repeat(1000),
  }));
  const large = { ...empty, logs };
  assert.throws(() => observationValue(large));
  const restored = restoreObservation(large).logs;
  assert.equal(restored.length, logs.length);
  for (let i = 0; i < logs.length; i++) assert.deepEqual(restored[i], { ...logs[i], time: new Date(logs[i].time).toISOString() });
});
test("SQLite autosave preserves invalid filter and raw JSON without replacing the formal project", async () => {
  const db = new DatabaseSync(":memory:");
  for (const n of ["0002_projects.sql", "0003_autosave.sql"])
    db.exec(readFileSync("app/migrations/" + n, "utf8"));
  try {
    const draft = createAutosaveStore(db, observationValue),
      documentId = randomUUID();
    const first = await draft.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: 0,
      projectId: null,
      projectRevision: null,
      snapshot: { title: "Observation", data: seed, extra: {} },
    });
    assert.equal(first.phase, "saved");
    const bad = { ...seed, filters: { ...seed.filters, to: "2026-" } };
    const second = await draft.commit({
      documentId,
      mutationId: randomUUID(),
      draftRevision: 1,
      projectId: first.project!.id,
      projectRevision: first.project!.revision,
      snapshot: {
        title: "Observation",
        data: bad,
        extra: { inputJson: "{unfinished" },
      },
    });
    assert.equal(second.phase, "draft");
    assert.equal(
      draft.get(documentId)!.snapshot.extra.inputJson,
      "{unfinished",
    );
    assert.equal(
      (draft.get(documentId)!.snapshot.data as typeof seed).filters.to,
      "2026-",
    );
    assert.equal(
      createStore(db, observationValue).get(first.project!.id).data.filters.to,
      "",
    );
  } finally {
    db.close();
  }
});
test("CSV cells cannot become spreadsheet formulas and preserve quoted/newline content", () => {
  const value = csv(["title"], [["=SUM(1,2)"], ['A "quoted"\nline']]);
  assert.match(value, /'=SUM/);
  assert.match(value, /A ""quoted""\nline/);
});
test("vendored native source and declared strict-type adaptations match their provenance hashes", () => {
  const manifest = JSON.parse(readFileSync("UPSTREAM.json", "utf8"));
  for (const f of manifest.files) {
    const file = "app/src/vendor/geoinflow/" + f.path;
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    assert.equal(hash, manifest.adaptedFiles[f.path] ?? f.sha256, f.path);
  }
});
