import { cp, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./process.mjs";
import { ensurePinnedTemplate } from "./template.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
const [command = "list", slug, ...extra] = process.argv.slice(2);
const run = (bin, args, cwd = root) =>
  runCommand(bin, args, { cwd, allowInterrupt: command === "dev" });
async function main() {
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
      const cache = await ensurePinnedTemplate(root);
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
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
});
