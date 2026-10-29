// Drives the shared autosave client blueprint without a browser: the hook runs
// under a minimal React-compatible hook runtime, with in-memory IndexedDB and
// server stubs. Browser acceptance still covers the real Host and IndexedDB.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const blueprints = join(root, "scripts/blueprints");

const reactStub = `
let current = null;
const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
export function mount(hook) {
  const fiber = { slots: [], index: 0, value: null, queued: false, renders: 0 };
  fiber.schedule = () => {
    if (fiber.queued || fiber.unmounted) return;
    fiber.queued = true;
    setImmediate(fiber.render);
  };
  fiber.render = () => {
    fiber.queued = false;
    if (fiber.unmounted) return;
    current = fiber; fiber.index = 0; fiber.effects = [];
    try { fiber.value = hook(); } finally { current = null; }
    fiber.renders++;
    for (const slot of fiber.effects) { slot.cleanup?.(); slot.cleanup = slot.run() ?? undefined; }
  };
  fiber.unmount = () => {
    fiber.unmounted = true;
    for (const slot of fiber.slots) slot?.cleanup?.();
  };
  fiber.render();
  return fiber;
}
function slot(init) {
  const fiber = current, index = fiber.index++;
  return (fiber.slots[index] ??= init(fiber));
}
export function useState(initial) {
  const state = slot((fiber) => {
    const s = { value: typeof initial === "function" ? initial() : initial };
    s.set = (next) => {
      const value = typeof next === "function" ? next(s.value) : next;
      if (Object.is(value, s.value)) return;
      s.value = value;
      fiber.schedule();
    };
    return s;
  });
  return [state.value, state.set];
}
export function useRef(initial) { return slot(() => ({ current: initial })); }
export function useCallback(fn, deps) {
  const s = slot(() => ({ fn, deps }));
  if (changed(s.deps, deps)) { s.fn = fn; s.deps = deps; }
  return s.fn;
}
export function useEffect(run, deps) {
  const fiber = current, s = slot(() => ({ deps: undefined }));
  if (s.deps === undefined || changed(s.deps, deps)) { s.deps = deps; s.run = run; fiber.effects.push(s); }
}
`;

const cacheStub = `
export const store = new Map();
export const control = { failWrites: false, writes: 0 };
const fail = () => Promise.reject(new DOMException("stubbed write failure", "QuotaExceededError"));
export async function writeDraftCache(scope, id, value) {
  if (control.failWrites) return fail();
  control.writes++;
  store.set(scope + ":" + id, structuredClone(value));
  store.set(scope + ":active", id);
}
export async function readCache(key) { return structuredClone(store.get(key)); }
export async function readActiveCache(scope) {
  const id = store.get(scope + ":active");
  return id ? structuredClone(store.get(scope + ":" + id)) : undefined;
}
export async function listDraftCache(scope) {
  return [...store].filter(([key]) => key.startsWith(scope + ":") && key !== scope + ":active")
    .map(([key, value]) => ({ id: key.slice(scope.length + 1), value: structuredClone(value) }));
}
export async function clearCache(key) { store.delete(key); }
`;

const requestStub = `
export const server = { posts: [], conflict: false, delay: 5 };
const projects = new Map();
export function reset() { server.posts = []; server.conflict = false; server.delay = 5; projects.clear(); }
export async function request(url, init = {}) {
  await new Promise((r) => setTimeout(r, server.delay));
  if (url === "/api/projects" || url === "/api/autosave/list") return [];
  if (init.method === "POST" && url === "/api/autosave") {
    const command = JSON.parse(init.body);
    server.posts.push(command);
    if (server.conflict) throw Object.assign(new Error("版本冲突"), { status: 409 });
    const id = command.projectId ?? "p-" + command.documentId;
    const revision = (projects.get(id) ?? 0) + 1;
    projects.set(id, revision);
    const savedAt = new Date().toISOString();
    return {
      phase: "saved", message: "已自动保存", draftRevision: command.draftRevision + 1, savedAt,
      project: { id, title: command.snapshot.title, data: command.snapshot.data, revision, updatedAt: savedAt },
    };
  }
  return null;
}
export function download() {}
`;

async function loadClient() {
  await mkdir(join(root, ".cache"), { recursive: true });
  const dir = await mkdtemp(join(root, ".cache/autosave-client-test-"));
  const strip = async (file) =>
    stripTypeScriptTypes(await readFile(join(blueprints, file), "utf8"), { mode: "strip" });
  const client = (await strip("autosave-client.ts"))
    .replace(/from "react"/, 'from "./react.mjs"')
    .replace(/from "\.\.\/contracts\/project"/, 'from "./project.mjs"')
    .replace(/from "\.\.\/contracts\/autosave"/, 'from "./autosave-contracts.mjs"')
    .replace(/from "\.\/autosave-cache"/, 'from "./cache.mjs"')
    .replace(/from "\.\/requests"/, 'from "./requests.mjs"');
  await writeFile(join(dir, "client.mjs"), client);
  await writeFile(join(dir, "project.mjs"), await strip("contracts.ts"));
  await writeFile(
    join(dir, "autosave-contracts.mjs"),
    (await strip("autosave-contracts.ts")).replace(/^import .*$/m, ""),
  );
  await writeFile(join(dir, "react.mjs"), reactStub);
  await writeFile(join(dir, "cache.mjs"), cacheStub);
  await writeFile(join(dir, "requests.mjs"), requestStub);
  const load = (name) => import(pathToFileURL(join(dir, name)).href);
  return { dir, ...(await load("client.mjs")), ...(await load("react.mjs")), ...(await load("cache.mjs")), ...(await load("requests.mjs")) };
}

const dialogs = [];
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.sessionStorage ??= { getItem: () => null, setItem() {} };
globalThis.confirm = (message) => { dialogs.push(message); return true; };

const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function until(check, label) {
  for (let i = 0; i < 400; i++) { if (check()) return; await settle(5); }
  throw new Error("Timed out waiting for " + label);
}
const validate = (value) => {
  if (typeof value !== "object" || value === null || typeof value.text !== "string") throw new Error("invalid");
  return { text: value.text };
};
const repairMessage = /本机缓存尚未修复/;

let harness;
test.before(async () => { harness = await loadClient(); });
test.after(async () => { if (harness) await rm(harness.dir, { recursive: true, force: true }); });

async function start(storageKey) {
  harness.reset();
  harness.store.clear();
  harness.control.failWrites = false;
  dialogs.length = 0;
  const fiber = harness.mount(() =>
    harness.useWorkbenchState({ text: "" }, validate, "Untitled", { storageKey }),
  );
  await until(() => fiber.value.loading === false, "initial load");
  await settle();
  return fiber;
}

test("switching right after an edit saves it and leaves no cache-repair warning", async () => {
  const fiber = await start("switch-within-debounce");
  fiber.value.setData({ text: "edited" });
  await settle(5);
  // The switch lands before the 700 ms debounce, so leave() performs the save itself.
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(harness.server.posts.length, 1);
  assert.deepEqual(dialogs, []);
  fiber.unmount();
});

test("switching after the background save settles stays silent", async () => {
  const fiber = await start("switch-after-save");
  fiber.value.setData({ text: "edited" });
  await until(() => fiber.value.autoState.phase === "saved", "autosave");
  assert.equal(await fiber.value.fresh(), true);
  assert.deepEqual(dialogs, []);
  fiber.unmount();
});

test("a restored unacknowledged mutation replayed by an immediate switch leaves the client clean", async () => {
  const storageKey = "restored-pending";
  harness.reset();
  harness.store.clear();
  const documentId = crypto.randomUUID(), mutationId = crypto.randomUUID();
  const snapshot = { title: "Collection", data: { text: "last response" }, extra: {} };
  harness.store.set(storageKey + ":" + documentId, {
    documentId, revision: 0, snapshot, current: null,
    acknowledged: JSON.stringify({ title: "Collection", data: { text: "" }, extra: {} }),
    acknowledgedState: { phase: "idle", message: "编辑后自动保存", savedAt: "" },
    pending: { documentId, mutationId, draftRevision: 0, projectId: null, projectRevision: null, snapshot },
    savedAt: new Date().toISOString(), conflicted: false,
  });
  harness.store.set(storageKey + ":active", documentId);
  dialogs.length = 0;
  const fiber = harness.mount(() =>
    harness.useWorkbenchState({ text: "" }, validate, "Untitled", { storageKey }),
  );
  await until(() => fiber.value.loading === false, "initial load");
  assert.equal(fiber.value.data.text, "last response");
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(harness.server.posts.length, 1);
  assert.equal(harness.server.posts[0].mutationId, mutationId);
  assert.deepEqual(dialogs, []);
  fiber.unmount();
});

test("typing during a delayed save keeps the newer text pending and saves it", async () => {
  const fiber = await start("typing-during-save");
  harness.server.delay = 120;
  fiber.value.setData({ text: "first" });
  await until(() => fiber.value.autoState.phase === "saving", "save in flight");
  fiber.value.setData({ text: "first and more" });
  await until(() => harness.server.posts.length === 1 && fiber.value.autoState.phase === "pending", "first acknowledgement");
  assert.equal(fiber.value.data.text, "first and more");
  assert.equal(fiber.value.dirty, true);
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(harness.server.posts.length, 2);
  assert.equal(harness.server.posts[1].snapshot.data.text, "first and more");
  assert.deepEqual(dialogs, []);
  fiber.unmount();
});

test("an acknowledged save whose local cache write failed still warns before switching", async () => {
  const fiber = await start("cache-write-fails");
  harness.control.failWrites = true;
  fiber.value.setData({ text: "edited" });
  await settle(5);
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0], repairMessage);
  fiber.unmount();
});

test("cache repair stays pending after a later save until a cache write succeeds", async () => {
  const fiber = await start("cache-write-fails-then-saves");
  harness.control.failWrites = true;
  fiber.value.setData({ text: "edited" });
  await until(() => fiber.value.autoState.phase === "offline", "cache repair failure");
  assert.match(fiber.value.autoState.message, /本机缓存更新失败/);
  // Still failing: a further acknowledged edit must keep the warning.
  fiber.value.setData({ text: "edited again" });
  await settle(5);
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0], repairMessage);
  fiber.unmount();
});

test("an optimistic conflict still warns before switching", async () => {
  const fiber = await start("conflict");
  harness.server.conflict = true;
  fiber.value.setData({ text: "edited" });
  await settle(5);
  assert.equal(await fiber.value.fresh(), true);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0], /草稿尚未完全同步/);
  fiber.unmount();
});
