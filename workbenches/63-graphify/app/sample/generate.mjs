// ABOUTME: 把 sample/replenishment 下的示例资料集写入 src/contracts/sample/corpus.ts（node sample/generate.mjs）。
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "replenishment");
const walk = (dir) =>
  readdirSync(dir).sort().flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const files = walk(root).map((full) => ({ path: relative(root, full).split("\\").join("/"), text: readFileSync(full, "utf8") }));
const body = `// ABOUTME: 示例资料集「门店补货助手」（由 sample/generate.mjs 从 sample/replenishment 生成，请勿手改）。\n\nexport const SAMPLE_NAME = "门店补货助手";\nexport const sampleFiles: { path: string; text: string }[] = ${JSON.stringify(files, null, 1)};\n`;
writeFileSync(join(here, "../src/contracts/sample/corpus.ts"), body);
console.log(`${files.length} files`);
