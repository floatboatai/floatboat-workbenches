import { readFile, mkdir, open, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);
if (!command || command === "--help") {
  console.log(
    "Usage: pnpm batch <check|test|package> [--from N --to N] [--dry-run]\nWithout a range, selects projects recorded as local-verified. Explicit ranges may include work in progress.",
  );
  process.exit(0);
}
if (!["check", "test", "package"].includes(command))
  throw new Error("Expected check, test or package.");
let from,
  to,
  dry = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--dry-run") dry = true;
  else if (args[i] === "--from") from = Number(args[++i]);
  else if (args[i] === "--to") to = Number(args[++i]);
  else throw new Error(`Unknown option: ${args[i]}`);
}
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const hasRange = from !== undefined || to !== undefined;
if (hasRange) {
  from ??= 1;
  to ??= catalog.length;
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to < from ||
    to > catalog.length
  )
    throw new Error("Range must be valid catalog identifiers.");
}
const items = catalog.filter((item) =>
  hasRange
    ? item.id >= from && item.id <= to
    : item.status === "local-verified",
);
if (!items.length) throw new Error("No projects selected.");
console.log(
  `Selected ${items.length}: ${items.map((item) => item.slug).join(", ")}`,
);
if (dry) process.exit(0);
const stamp = new Date().toISOString().replaceAll(":", "-");
const directory = join(root, ".cache/batch", `${stamp}-${command}`);
await mkdir(directory, { recursive: true });
const results = [];
for (const item of items) {
  console.log(`[${item.id}] ${command} ${item.slug}`);
  const logPath = join(directory, `${item.slug}.log`),
    log = await open(logPath, "w");
  const started = Date.now();
  const extra =
    command === "package"
      ? [
          "--",
          "--output",
          join(
            root,
            item.directory,
            "artifacts",
            `${item.slug}-${stamp}.fbworkbench`,
          ),
        ]
      : [];
  let code;
  try {
    code = await new Promise((accept, reject) => {
      const child = spawn(
        process.execPath,
        [join(root, "scripts/workbench.mjs"), command, item.slug, ...extra],
        { cwd: root, stdio: ["ignore", log.fd, log.fd] },
      );
      child.once("error", reject);
      child.once("exit", (exit, signal) => accept(exit ?? (signal ? 130 : 1)));
    });
  } catch (error) {
    code = 1;
    await log.write(String(error));
  } finally {
    await log.close();
  }
  results.push({
    id: item.id,
    slug: item.slug,
    command,
    passed: code === 0,
    exitCode: code,
    elapsedMs: Date.now() - started,
    logPath,
  });
  console.log(`  ${code === 0 ? "PASS" : "FAIL"} ${item.slug}`);
}
const report = {
  command,
  startedAt: stamp,
  passed: results.filter((result) => result.passed).length,
  total: results.length,
  results,
};
await writeFile(
  join(directory, "results.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(`${report.passed}/${report.total} passed. Logs: ${directory}`);
process.exitCode = report.passed === report.total ? 0 : 1;
