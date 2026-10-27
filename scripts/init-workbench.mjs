import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
for (const slug of process.argv.slice(2)) {
  const item = catalog.find((item) => item.slug === slug);
  if (!item) throw new Error(`Unknown workbench: ${slug}`);
  const project = join(root, item.directory),
    template = join(root, ".cache/template");
  let exists = false;
  try {
    await access(join(project, "app/manifest.json"));
    exists = true;
  } catch {}
  if (exists) {
    console.log(`${slug}: existing source preserved`);
    continue;
  }
  await cp(join(template, "app"), join(project, "app"), { recursive: true });
  for (const file of ["package.json", "pnpm-lock.yaml", ".npmrc"])
    await cp(join(template, file), join(project, file));
  for (const file of ["sdk", "tooling", "compatibility.json"])
    await cp(join(template, file), join(project, file), { recursive: true });
  await cp(
    join(template, ".agents/skills/floatboat-workbench"),
    join(project, ".template-guidance"),
    { recursive: true },
  );
  await cp(join(template, "docs"), join(project, "template-docs"), {
    recursive: true,
  });
  const manifest = JSON.parse(
    await readFile(join(project, "app/manifest.json"), "utf8"),
  );
  Object.assign(manifest, {
    appId: `workbench.${randomUUID()}`,
    registryName: `${slug}-studio`,
    name: `${item.name} 工作台`,
    description: item.workbench,
    capabilities: ["llm"],
  });
  await writeFile(
    join(project, "app/manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const packageJson = JSON.parse(
    await readFile(join(project, "package.json"), "utf8"),
  );
  packageJson.name = `floatboat-${slug}`;
  await writeFile(
    join(project, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  const copies = {
    "contracts.ts": "src/contracts/project.ts",
    "store.ts": "src/server/store.ts",
    "routes.ts": "src/server/routes.ts",
    "workspace.tsx": "src/ui/workspace.tsx",
  };
  for (const [source, target] of Object.entries(copies))
    await cp(
      join(root, "scripts/blueprints", source),
      join(project, "app", target),
    );
  await writeFile(
    join(project, "app/migrations/0002_projects.sql"),
    "CREATE TABLE projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);\n",
  );
  await writeFile(
    join(project, "app/REQUIREMENTS.md"),
    `# ${item.name} 工作台\n\n目标：${item.workbench}\n\n必须提供真实核心操作、项目保存与恢复、合法格式导出、明确的失败状态。模型生成的结果需用户检查后采用。\n\n应用独立部署和打包，不依赖其他工作台目录。尚未验收。\n`,
  );
  await writeFile(
    join(project, "app/DESIGN.md"),
    `# ${item.name} 设计\n\n实现前记录独立的布局、色彩、信息密度、关键状态和窄屏设计。方向：${item.category}。不得只替换其他工作台的标题和颜色。\n`,
  );
  console.log(`Initialized ${slug}`);
}
