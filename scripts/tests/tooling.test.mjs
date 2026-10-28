import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runCommand } from "../process.mjs";
import { ensurePinnedTemplate } from "../template.mjs";
const exec = promisify(execFile),
  root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
test("autosave upgrades preserve product navigation and applied migrations", async () => {
  await mkdir(join(root, ".cache"), { recursive: true });
  const fixture = await mkdtemp(join(root, ".cache/autosave-upgrade-test-"));
  try {
    await cp(join(root, "scripts"), join(fixture, "scripts"), { recursive: true });
    await writeFile(join(fixture, "catalog.json"), JSON.stringify([
      { slug: "fixture", directory: "workbenches/fixture" },
    ]));
    const app = join(fixture, "workbenches/fixture/app");
    await mkdir(join(app, "src/ui"), { recursive: true });
    await mkdir(join(app, "migrations"), { recursive: true });
    const owned = {
      "workspace.tsx": "export const AssetLibrary = () => <nav>Assets and local drafts</nav>;\n",
      "App.tsx": "export const App = () => <main>Model inspection</main>;\n",
      "style.css": ".asset-stage { display: grid; }\n",
    };
    for (const [name, content] of Object.entries(owned))
      await writeFile(join(app, "src/ui", name), content);
    const migration = "CREATE TABLE asset_notes(id TEXT PRIMARY KEY);\n";
    await writeFile(join(app, "migrations/0004_asset_notes.sql"), migration);
    for (let attempt = 0; attempt < 2; attempt++) {
      await exec(process.execPath, [join(fixture, "scripts/sync-autosave.mjs"), "fixture"], { cwd: fixture });
      for (const [name, content] of Object.entries(owned))
        assert.equal(await readFile(join(app, "src/ui", name), "utf8"), content);
    }
    assert.match(await readFile(join(app, "src/ui/autosave-client.ts"), "utf8"), /useWorkbenchState/);
    assert.equal(await readFile(join(app, "migrations/0004_asset_notes.sql"), "utf8"), migration);
    assert.deepEqual((await readdir(join(app, "migrations"))).sort(), [
      "0004_asset_notes.sql", "0005_autosave.sql",
    ]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
test(
  "verification subprocess interruption is a failure with exit 130",
  { skip: process.platform === "win32" },
  async () => {
    await assert.rejects(
      runCommand(
        process.execPath,
        ["-e", 'process.kill(process.pid,"SIGINT")'],
        { stdio: "ignore" },
      ),
      (error) => error.exitCode === 130,
    );
  },
);
test(
  "an intentional development preview interruption may finish cleanly",
  { skip: process.platform === "win32" },
  async () => {
    await runCommand(
      process.execPath,
      ["-e", 'process.kill(process.pid,"SIGINT")'],
      { stdio: "ignore", allowInterrupt: true },
    );
  },
);
test("initialization fetches a missing pinned cache and preserves existing source", async () => {
  const source = await ensurePinnedTemplate(root),
    lock = JSON.parse(await readFile(join(root, "template.lock.json"), "utf8"));
  const fixture = await mkdtemp(join(root, ".cache/init-test-"));
  try {
    await cp(join(root, "scripts"), join(fixture, "scripts"), {
      recursive: true,
    });
    await writeFile(
      join(fixture, "catalog.json"),
      JSON.stringify([
        {
          id: 1,
          slug: "fixture",
          directory: "workbenches/fixture",
          name: "Fixture",
          category: "test",
          workbench: "test persistence",
        },
      ]),
    );
    await writeFile(
      join(fixture, "template.lock.json"),
      JSON.stringify({ ...lock, repository: source }),
    );
    await exec(
      process.execPath,
      [join(fixture, "scripts/init-workbench.mjs"), "fixture"],
      { cwd: fixture },
    );
    const app = join(fixture, "workbenches/fixture/app");
    const manifest = JSON.parse(
      await readFile(join(app, "manifest.json"), "utf8"),
    );
    assert.notEqual(manifest.appId, "workbench.starter");
    assert.equal(manifest.registryName, "fixture-studio");
    assert.match(await readFile(join(app,"src/ui/autosave-client.ts"),"utf8"), /useWorkbenchState/);
    assert.match(await readFile(join(app,"migrations/0003_autosave.sql"),"utf8"), /CREATE TABLE autosave_drafts/);

    await writeFile(join(app, "REQUIREMENTS.md"), "preserve this user edit");
    await exec(
      process.execPath,
      [join(fixture, "scripts/init-workbench.mjs"), "fixture"],
      { cwd: fixture },
    );
    assert.equal(
      await readFile(join(app, "REQUIREMENTS.md"), "utf8"),
      "preserve this user edit",
    );
    assert.equal(
      JSON.parse(await readFile(join(app, "manifest.json"), "utf8")).appId,
      manifest.appId,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
