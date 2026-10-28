import { writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export function createJobWriter(root) {
  const pending = new Map();
  return function save(job) {
    const payload = JSON.stringify(job),
      id = job.id;
    const prior = pending.get(id) ?? Promise.resolve();
    const next = prior
      .catch(() => {})
      .then(async () => {
        const temp = join(root, id + "." + randomUUID() + ".tmp");
        await writeFile(temp, payload);
        await rename(temp, join(root, id + ".json"));
      });
    pending.set(id, next);
    void next
      .finally(() => {
        if (pending.get(id) === next) pending.delete(id);
      })
      .catch(() => {});
    return next;
  };
}
