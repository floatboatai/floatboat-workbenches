let database: Promise<IDBDatabase> | undefined;
const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("floatboat-working-copies", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error ?? new Error("本机草稿存储不可用。"));
    };
  }));
}
export async function writeCache(key: string, value: unknown): Promise<void> {
  const store = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = store.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本机草稿未写入。"));
  });
}
export async function readCache(key: string): Promise<unknown> {
  const store = await db();
  return new Promise((resolve, reject) => {
    const r = store
      .transaction("drafts", "readonly")
      .objectStore("drafts")
      .get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function clearCache(key: string): Promise<void> {
  const store = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = store.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本机草稿未删除。"));
  });
}
// Store the copy and its persistent active pointer in the same transaction.
// Existing scope:UUID keys stay readable; UUID suffix checks isolate scopes containing colons.
export async function writeDraftCache(
  scope: string,
  id: string,
  value: unknown,
): Promise<void> {
  if (!validId(id)) throw new Error("本机草稿标识无效。");
  const store = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = store.transaction("drafts", "readwrite"),
      copies = tx.objectStore("drafts");
    copies.put(value, scope + ":" + id);
    copies.put(id, scope + ":active");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本机草稿未写入。"));
  });
}
export async function readActiveCache(scope: string): Promise<unknown> {
  const id = await readCache(scope + ":active");
  return validId(id) ? readCache(scope + ":" + id) : undefined;
}
export async function listDraftCache(
  scope: string,
): Promise<{ id: string; value: unknown }[]> {
  const store = await db(),
    prefix = scope + ":";
  return new Promise((resolve, reject) => {
    const entries: { id: string; value: unknown }[] = [],
      tx = store.transaction("drafts", "readonly");
    const cursor = tx
      .objectStore("drafts")
      .openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
    cursor.onsuccess = () => {
      const row = cursor.result;
      if (!row) return;
      const key = row.key;
      if (typeof key === "string") {
        const id = key.slice(prefix.length);
        if (validId(id)) entries.push({ id, value: row.value as unknown });
      }
      row.continue();
    };
    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("本机草稿列表不可用。"));
  });
}
