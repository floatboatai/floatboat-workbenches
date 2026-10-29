import assert from "node:assert/strict";
import { test } from "node:test";
import { createLibrary, registerSampleApi } from "../src/server/sample-api.ts";
import { analyzeModel, seed } from "../src/contracts/model.ts";

type Handler = (context: {
  request: { headers: Record<string, string> };
  url: URL;
  params: Record<string, string>;
  body: unknown;
}) => unknown;

function harness() {
  const routes: { method: string; pattern: RegExp; names: string[]; handler: Handler }[] = [];
  const app = {
    route(method: string, path: string, handler: Handler) {
      const names: string[] = [];
      const pattern = new RegExp(
        "^" + path.replace(/:([A-Za-z]+)/g, (_match, name: string) => (names.push(name), "([^/]+)")) + "$",
      );
      routes.push({ method, pattern, names, handler });
    },
  };
  registerSampleApi(app as never, createLibrary(() => new Date("2026-10-29T08:00:00.000Z")));
  return async (method: string, path: string, options: { token?: boolean; body?: unknown } = {}) => {
    const url = new URL(path, "http://workbench.local");
    for (const route of routes) {
      const match = route.method === method ? route.pattern.exec(url.pathname) : null;
      if (!match) continue;
      const params = Object.fromEntries(route.names.map((name, index) => [name, match[index + 1]]));
      const result = await route.handler({
        request: { headers: options.token ? { authorization: "Bearer demo-librarian" } : {} },
        url,
        params,
        body: options.body ?? {},
      });
      const response = result instanceof Response ? result : Response.json(result);
      return { status: response.status, body: response.status === 204 ? null : await response.json() };
    }
    throw new Error("no route " + method + " " + path);
  };
}

test("示例规格中的每个端点都由内置服务实现", () => {
  const call = harness();
  const base = "/api/sample/library/v1";
  return Promise.all(
    analyzeModel(seed).operations.map(async (operation) => {
      const path = base + operation.path.replace("{bookId}", "bk_101").replace("{memberId}", "mb_1001").replace("{loanId}", "ln_5001");
      const result = await call(operation.method.toUpperCase(), path, { token: true });
      assert.notEqual(result.status, 404, operation.method + " " + operation.path);
    }),
  );
});

test("借阅流程：鉴权、新增、借出、冲突与归还", async () => {
  const call = harness();
  const base = "/api/sample/library/v1";
  const list = await call("GET", base + "/books?q=城市");
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);
  assert.equal((await call("POST", base + "/books", { body: { title: "A", author: "B" } })).status, 401);
  assert.equal((await call("POST", base + "/books", { token: true, body: { title: "" } })).status, 400);
  const created = await call("POST", base + "/books", {
    token: true,
    body: { title: "河流与城市", author: "林岚", isbn: "9787100000017", copies: 1 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id, "bk_105");
  const loan = await call("POST", base + "/loans", {
    token: true,
    body: { bookId: "bk_105", memberId: "mb_1001", days: 14 },
  });
  assert.equal(loan.status, 201);
  assert.equal(loan.body.dueAt, "2026-11-12T08:00:00.000Z");
  assert.equal((await call("POST", base + "/loans", { token: true, body: { bookId: "bk_105", memberId: "mb_1002" } })).status, 409);
  assert.equal((await call("DELETE", base + "/books/bk_105", { token: true })).status, 409);
  const returned = await call("POST", base + `/loans/${loan.body.id}/return`, { token: true });
  assert.equal(returned.body.status, "returned");
  assert.equal((await call("DELETE", base + "/books/bk_105", { token: true })).status, 204);
  assert.equal((await call("GET", base + "/books/bk_105")).status, 404);
});
