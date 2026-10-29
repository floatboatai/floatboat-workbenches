import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJobs } from "../src/server/jobs.ts";
import { createPresenton } from "../src/server/presenton.ts";
import { example } from "../src/contracts/deck.ts";
async function fixture(
  run: (f: { db: DatabaseSync; dir: string }) => Promise<void>,
) {
  const db = new DatabaseSync(":memory:");
  const dir = await mkdtemp(join(tmpdir(), "presenton-test-"));
  db.exec(
    readFileSync(
      new URL("../migrations/0004_production.sql", import.meta.url),
      "utf8",
    ),
  );
  try {
    await run({ db, dir });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}
const command = () => ({
  id: crypto.randomUUID(),
  projectId: "project-1",
  title: "A deck",
  kind: "generate",
  deck: structuredClone(example),
});
test("durable lifecycle contract: persist before POST, duplicate operation never repeats, snapshot immutable", async () =>
  fixture(async ({ db, dir }) => {
    let calls = 0;
    let id = "";
    const service = createPresenton(
      { origin: "https://presenton.example", key: "" },
      async (input) => {
        calls++;
        assert.ok(
          db.prepare("SELECT id FROM presenton_jobs WHERE id=?").get(id),
        );
        return Response.json({
          id: "task-1",
          status: String(input).includes("/status/") ? "completed" : "pending",
          data: {
            presentation_id: "deck-1",
            ...(String(input).includes("/status/")
              ? { path: "/app_data/exports/a.pptx" }
              : {}),
          },
        });
      },
    );
    const jobs = createJobs(
      db,
      () => service,
      (n) => Promise.resolve(join(dir, n)),
    );
    const cmd = command();
    id = cmd.id;
    const first = await jobs.submit(cmd);
    assert.equal(first.state, "pending");
    assert.equal(calls, 1);
    assert.deepEqual(await jobs.submit(cmd), first);
    assert.equal(calls, 1);
    cmd.deck.outline[0].title = "Changed";
    await assert.rejects(() => jobs.submit(cmd), /不同/);
    assert.match(JSON.stringify(jobs.snapshot(id)), /树荫/);
    const completed = await jobs.refresh(id);
    assert.equal(completed.state, "completed");
    assert.equal(completed.taskId, "task-1");
  }));
test("unknown submission contract: no automatic retry after lost response or restart, manual task reconciliation", async () =>
  fixture(async ({ db, dir }) => {
    let calls = 0;
    const service = createPresenton(
      { origin: "https://presenton.example", key: "" },
      async (input) => {
        calls++;
        if (String(input).endsWith("/async")) throw new Error("lost");
        return Response.json({
          id: "task-known",
          status: "pending",
          data: { presentation_id: "deck-1" },
        });
      },
    );
    let jobs = createJobs(
      db,
      () => service,
      (n) => Promise.resolve(join(dir, n)),
    );
    const cmd = command();
    assert.equal((await jobs.submit(cmd)).state, "unknown");
    assert.equal(calls, 1);
    jobs = createJobs(
      db,
      () => service,
      (n) => Promise.resolve(join(dir, n)),
    );
    assert.equal((await jobs.submit(cmd)).state, "unknown");
    assert.equal(calls, 1);
    assert.equal((await jobs.adopt(cmd.id, "task-known")).taskId, "task-known");
    assert.equal(calls, 2);
    assert.equal(jobs.stop(cmd.id).state, "stopped");
    assert.equal(jobs.get(cmd.id).taskId, "task-known");
  }));
test("interrupted process marks submitting unknown without external calls", async () =>
  fixture(async ({ db, dir }) => {
    db.prepare(
      "INSERT INTO presenton_jobs(id,project_id,title,kind,state,origin,input_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      "operation-1",
      "project-1",
      "deck",
      "generate",
      "submitting",
      "https://presenton.example",
      "{}",
      "2026-01-01",
      "2026-01-01",
    );
    const jobs = createJobs(
      db,
      () => null,
      (n) => Promise.resolve(join(dir, n)),
    );
    assert.equal(jobs.get("operation-1").state, "unknown");
  }));
test("artifact contract: durable cache, chunk bytes identical and no external download repeated", async () =>
  fixture(async ({ db, dir }) => {
    let downloads = 0;
    const bytes = new TextEncoder().encode("%PDF-1.7\nfixture only");
    const service = createPresenton(
      { origin: "https://presenton.example", key: "" },
      async (input) => {
        if (String(input).includes("/app_data/")) {
          downloads++;
          return new Response(bytes);
        }
        return Response.json({
          id: "task-1",
          status: "completed",
          data: { presentation_id: "deck-1", path: "/app_data/exports/a.pdf" },
        });
      },
    );
    const jobs = createJobs(
      db,
      () => service,
      (n) => Promise.resolve(join(dir, n)),
    );
    const cmd = command();
    await jobs.submit(cmd);
    const artifact = await jobs.cacheArtifact(cmd.id);
    assert.equal(artifact.bytes, bytes.length);
    assert.equal(artifact.format, "pdf");
    assert.deepEqual(
      Buffer.from((await jobs.chunk(cmd.id, 0)).base64, "base64"),
      Buffer.from(bytes),
    );
    assert.deepEqual(await jobs.cacheArtifact(cmd.id), artifact);
    assert.equal(downloads, 1);
    await assert.rejects(() => jobs.chunk(cmd.id, 1));
  }));
test("service changes cannot redirect original tasks or forward credentials to another source", async () =>
  fixture(async ({ db, dir }) => {
    let origin = "https://first.example";
    const jobs = createJobs(
      db,
      () =>
        createPresenton({ origin, key: "" }, async () =>
          Response.json({
            id: "task-1",
            status: "pending",
            data: { presentation_id: "deck-1" },
          }),
        ),
      (n) => Promise.resolve(join(dir, n)),
    );
    const cmd = command();
    await jobs.submit(cmd);
    origin = "https://second.example";
    await assert.rejects(() => jobs.refresh(cmd.id), /其他/);
  }));
test("disconnected generation does not create a fake result or operation", async () =>
  fixture(async ({ db, dir }) => {
    const jobs = createJobs(
      db,
      () => null,
      (n) => Promise.resolve(join(dir, n)),
    );
    await assert.rejects(() => jobs.submit(command()), /尚未连接/);
    assert.deepEqual(jobs.list(), []);
  }));

test('late polling contract: stop tracking survives an in-flight response and terminal state does not regress',async()=>fixture(async({db,dir})=>{let resolveStatus:(value:Response)=>void=()=>{};let pending=false;let completed=false;const service=createPresenton({origin:'https://presenton.example',key:''},async(input)=>{if(String(input).includes('/status/')&&pending)return new Promise<Response>(r=>{resolveStatus=r;});return Response.json({id:'task-one',status:completed?'completed':'pending',data:{presentation_id:'deck-1',...(completed?{path:'/app_data/exports/a.pdf'}:{})}});});const jobs=createJobs(db,()=>service,n=>Promise.resolve(join(dir,n)));const cmd=command();await jobs.submit(cmd);pending=true;const flight=jobs.refresh(cmd.id);jobs.stop(cmd.id);resolveStatus(Response.json({id:'task-one',status:'pending',data:{presentation_id:'deck-1'}}));assert.equal((await flight).state,'stopped');pending=false;completed=true;assert.equal((await jobs.refresh(cmd.id)).state,'completed');completed=false;assert.equal((await jobs.refresh(cmd.id)).state,'completed');}));
