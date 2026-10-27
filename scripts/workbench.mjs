import { cp, mkdir, readFile, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const [command = "list", slug, ...extra] = process.argv.slice(2);
const run = (bin, args, cwd = root) =>
  new Promise((ok, fail) => {
    const child = spawn(bin, args, { cwd, stdio: "inherit" });
    const stop = () => child.kill("SIGINT");
    process.once("SIGINT", stop);
    child.once("error", fail);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", stop);
      code === 0 || signal === "SIGINT"
        ? ok()
        : fail(new Error(`${bin} exited ${code ?? signal}`));
    });
  });
if (command === "list") {
  for (const item of catalog)
    console.log(
      `${String(item.id).padStart(2, "0")}  ${item.slug.padEnd(24)} ${item.status}`,
    );
} else {
  const project = catalog.find(
    (item) => item.slug === slug || String(item.id) === slug,
  );
  if (!project) throw new Error("Choose a project from: pnpm workbench list");
  const directory = join(root, project.directory);
  try {
    await access(join(directory, "app/manifest.json"));
  } catch {
    throw new Error(
      `${project.name} is planned and does not have an implementation yet.`,
    );
  }
  if (command === "prepare") {
    const lock = JSON.parse(
      await readFile(join(root, "template.lock.json"), "utf8"),
    );
    const cache = join(root, ".cache/template");
    await mkdir(dirname(cache), { recursive: true });
    try {
      await access(join(cache, ".git"));
    } catch {
      await run("git", ["clone", lock.repository, cache]);
    }
    await run("git", ["checkout", "--detach", lock.commit], cache);
    for (const name of ["sdk", "tooling", "compatibility.json"])
      await cp(join(cache, name), join(directory, name), { recursive: true });
    await cp(join(cache, "docs"), join(directory, "template-docs"), {
      recursive: true,
    });
    await cp(
      join(cache, ".agents/skills/floatboat-workbench"),
      join(directory, ".template-guidance"),
      { recursive: true },
    );
    await run(
      "pnpm",
      ["install", "--frozen-lockfile", "--ignore-scripts"],
      directory,
    );
    console.log(`Prepared ${project.name}.`);
  } else {
    const scripts = {
      check: "workbench:check",
      test: "test",
      dev: "dev",
      package: "package",
    };
    if (!scripts[command])
      throw new Error(
        "Commands: list | prepare | check | test | dev | package",
      );
    await run("pnpm", ["run", scripts[command], ...extra], directory);
  }
}
