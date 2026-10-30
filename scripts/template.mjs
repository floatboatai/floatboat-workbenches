import { access, mkdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runCommand } from "./process.mjs";
const exec = promisify(execFile);
export async function ensurePinnedTemplate(root) {
  const lock = JSON.parse(
    await readFile(join(root, "template.lock.json"), "utf8"),
  );
  if (
    typeof lock.repository !== "string" ||
    !lock.repository ||
    lock.repository.startsWith("-") ||
    !/^[0-9a-f]{40}$/i.test(lock.commit)
  )
    throw new Error("Invalid pinned template reference.");
  const cache = join(root, ".cache/template");
  await mkdir(dirname(cache), { recursive: true });
  try {
    await access(join(cache, ".git"));
  } catch {
    await runCommand("git", ["clone", "--", lock.repository, cache], {
      cwd: root,
    });
  }
  const state = await exec(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: cache },
  );
  if (state.stdout.trim())
    throw new Error(
      "Template cache contains local changes. Preserve them before refreshing the pinned template.",
    );
  const head = await exec("git", ["rev-parse", "HEAD"], { cwd: cache });
  if (head.stdout.trim() !== lock.commit) {
    // A cache cloned before the lock moved does not have the new commit yet.
    const present = await exec(
      "git",
      ["cat-file", "-e", `${lock.commit}^{commit}`],
      { cwd: cache },
    ).then(
      () => true,
      () => false,
    );
    if (!present)
      await runCommand("git", ["fetch", "--", lock.repository, lock.commit], {
        cwd: cache,
      });
    await runCommand("git", ["checkout", "--detach", lock.commit], {
      cwd: cache,
    });
  }
  return cache;
}
