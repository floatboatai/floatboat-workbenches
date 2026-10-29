import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createMiroFishClient } from "../src/server/mirofish-client.ts";
import { nativeExample } from "../src/contracts/simulation.ts";
const seed = { actions: nativeExample };
async function fixture<T>(
  handler: (path: string) => unknown,
  run: (url: string) => Promise<T>,
) {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(handler(req.url ?? "")));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  try {
    return await run("http://127.0.0.1:" + address.port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
test("official health, list and detailed action response contract through real HTTP fixture", async () => {
  await fixture(
    (path) =>
      path === "/health"
        ? { status: "ok", service: "MiroFish Backend" }
        : path === "/api/simulation/list"
          ? {
              success: true,
              data: [{ simulation_id: "sim_example", status: "completed" }],
            }
          : {
              success: true,
              data: { simulation_id: "sim_example", all_actions: seed.actions },
            },
    async (url) => {
      const c = createMiroFishClient(url);
      assert.equal((await c.health()).available, true);
      assert.equal((await c.list())[0].id, "sim_example");
      assert.equal((await c.result("sim_example")).actions.length, 4);
    },
  );
});
test("wrong simulation identity and incomplete recent-only response cannot replace a review", async () => {
  await fixture(
    () => ({
      success: true,
      data: { simulation_id: "sim_other", all_actions: seed.actions },
    }),
    async (url) => {
      await assert.rejects(
        () => createMiroFishClient(url).result("sim_expected"),
        /不一致/,
      );
    },
  );
  await fixture(
    () => ({
      success: true,
      data: { simulation_id: "sim_example", recent_actions: seed.actions },
    }),
    async (url) => {
      await assert.rejects(
        () => createMiroFishClient(url).result("sim_example"),
        /近期动作/,
      );
    },
  );
});
test("unsafe remote protocol, path traversal and oversized upstream body are rejected", async () => {
  assert.throws(() => createMiroFishClient("http://example.com"));
  await fixture(
    () => ({ padding: "x".repeat(1600000) }),
    async (url) => {
      const c = createMiroFishClient(url);
      await assert.rejects(() => c.result("../secret"), /编号/);
      await assert.rejects(() => c.list(), /超过容量上限/);
    },
  );
});
