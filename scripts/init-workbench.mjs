import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ensurePinnedTemplate } from "./template.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog.json"), "utf8"));
for (const slug of process.argv.slice(2)) {
  const item = catalog.find((item) => item.slug === slug);
  if (!item) throw new Error(`Unknown workbench: ${slug}`);
  const project = join(root, item.directory);
  let exists = false;
  try {
    await access(join(project, "app/manifest.json"));
    exists = true;
  } catch {}
  if (exists) {
    console.log(`${slug}: existing source preserved`);
    continue;
  }
  const template = await ensurePinnedTemplate(root);
  await mkdir(project, { recursive: true });
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
    "autosave-contracts.ts": "src/contracts/autosave.ts",
    "autosave-server.ts": "src/server/autosave.ts",
    "autosave-client.ts": "src/ui/autosave-client.ts",
    "autosave-cache.ts": "src/ui/autosave-cache.ts",
    "requests.ts": "src/ui/requests.ts",
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
  await cp(join(root, "scripts/blueprints/autosave-migration.sql"), join(project,"app/migrations/0003_autosave.sql"));
  await writeFile(
    join(project, "app/REQUIREMENTS.md"),
    `# ${item.name} 工作台\n\n目标：${item.workbench}\n\n必须提供真实核心操作、自动保存与完整工作草稿恢复、合法格式导出、明确的失败状态。模型生成的结果需用户检查后采用。\n\n应用独立部署和打包，不依赖其他工作台目录。尚未验收。\n`,
  );
  await writeFile(
    join(project, "app/DESIGN.md"),
    `# ${item.name} 设计\n\n方向：${item.category}。实现前按 docs/design-principles.md 的结构验收填写本设计。\n\n## 主任务与工作对象\n\n用户在首屏处理什么对象？最高频动作及成功状态是什么？\n\n## 首次使用与恢复工作\n\n画出打开、开始编辑、自动保存、再次打开与恢复草稿的路径。说明工作副本何时创建，以及文件管理入口为什么放在该位置。内部 projects 数据表不决定界面的主导航。\n\n## 空间与操作层级\n\n记录主操作区、上下文工具、按需信息与窄屏顺序。先描述空间和操作关系，再选择颜色与字体。\n\n## 结构对照\n\n与两项最近工作台比较主任务、文件生命周期和工具位置，附实际截图证据。同类产品可以保留必要的交互惯例。\n\n## 状态与验收\n\n列出空态、加载、可编辑、保存中、草稿、离线、冲突及错误恢复；验证桌面和375px的主任务、文件入口、键盘与焦点。功能通过与结构审查分别记录。\n`,
  );
  console.log(`Initialized ${slug}`);
}
