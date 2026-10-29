// Syncs the repository-owned columns of the Feishu workbench ledger. Columns are
// located by header and rows by 标识, so testers may reorder or add columns freely.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repository } from "./ci-workbenches.mjs";

export const HEADERS = {
  number: "编号",
  name: "工作台",
  slug: "标识",
  status: "开发状态",
  version: "仓库版本",
  store: "商店状态",
  storeVersion: "商店版本",
  changelog: "最近变更",
  features: "主要能力",
  caveat: "已知限制",
  verdict: "测试结论",
  issue: "测试问题",
  next: "下一步",
};
// Written from catalog.json and manifests on every sync.
const REPO_KEYS = [
  "number",
  "name",
  "slug",
  "status",
  "version",
  "changelog",
  "features",
  "caveat",
];
// Written only when a store export is supplied; testers and operators own the rest.
const STORE_KEYS = ["store", "storeVersion"];
const ROW_STYLE = {
  cell_styles: {
    vertical_alignment: "top",
    word_wrap: "auto-wrap",
    number_format: "@",
  },
  border_styles: { all: { style: "solid", weight: "thin", color: "#DEE0E3" } },
};

const text = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

/** One ledger row per catalog entry, keyed like HEADERS. */
export async function ledgerRows(root = repository) {
  const catalog = JSON.parse(
    await readFile(join(root, "catalog.json"), "utf8"),
  );
  const rows = [];
  for (const item of catalog) {
    const built = item.status === "local-verified";
    const manifest = built
      ? JSON.parse(
          await readFile(
            join(root, item.directory, "app/manifest.json"),
            "utf8",
          ),
        )
      : {};
    // The store lists only packages whose application LICENSE is MIT.
    const license = built
      ? await readFile(join(root, item.directory, "app/LICENSE"), "utf8").catch(
          () => "",
        )
      : "";
    rows.push({
      registryName: manifest.registryName ?? "",
      mit: license.includes("MIT License"),
      number: item.directory.split("/")[1].split("-")[0],
      name: text(manifest.name ?? item.name),
      slug: item.slug,
      status: built ? "已开发 · 本地验收" : "规划中",
      version: built ? text(item.version) : "",
      changelog: built ? text(manifest.changelog) : "",
      features: text(item.core_features),
      caveat: text(item.caveat),
    });
  }
  return rows;
}

/** Maps a store export ([{ name, visibility, version }]) onto ledger store columns. */
export function storeColumns(row, states) {
  if (row.status !== "已开发 · 本地验收")
    return { store: "未开发", storeVersion: "" };
  const state = states.get(row.registryName);
  if (!state)
    return {
      store: row.mit ? "未上架" : "未上架（非 MIT 许可）",
      storeVersion: "",
    };
  const listed = state.visibility === "listed";
  return {
    store: listed ? "已上架" : "已下架",
    storeVersion: listed ? text(state.version) : "",
  };
}

export const columnName = (index) => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

/**
 * Plans cell writes against the current grid (array of rows of strings, header first).
 * Existing rows only get changed owned cells; unknown slugs are appended as styled rows.
 */
export function planLedger(grid, rows, { sheet, states } = {}) {
  const header = (grid[0] ?? []).map(text);
  const owned = states ? [...REPO_KEYS, ...STORE_KEYS] : REPO_KEYS;
  const column = {};
  for (const key of owned) {
    // A header may carry a note, e.g. "测试结论（Sheet1）"; match on its leading name.
    const index = header.findIndex(
      (cell) => cell === HEADERS[key] || cell.startsWith(`${HEADERS[key]}（`),
    );
    if (index < 0)
      throw new Error(`Ledger header is missing column “${HEADERS[key]}”.`);
    column[key] = index;
  }
  const width = header.reduce(
    (last, cell, index) => (cell ? index + 1 : last),
    0,
  );
  const existing = new Map();
  let lastRow = 1;
  grid.forEach((cells, index) => {
    if (index === 0) return;
    if (cells.some((cell) => text(cell))) lastRow = index + 1;
    const slug = text(cells[column.slug]);
    if (slug) existing.set(slug, index);
  });
  const writes = [];
  const changes = [];
  const appended = [];
  for (const row of rows) {
    const values = { ...row, ...(states ? storeColumns(row, states) : {}) };
    const index = existing.get(row.slug);
    if (index === undefined) {
      lastRow += 1;
      const cells = Array.from({ length: width }, () => ({ ...ROW_STYLE }));
      for (const key of owned)
        cells[column[key]] = { ...ROW_STYLE, value: values[key] };
      writes.push({
        sheet_name: sheet,
        range: `A${lastRow}:${columnName(width - 1)}${lastRow}`,
        cells: [cells],
      });
      appended.push(row.slug);
      continue;
    }
    for (const key of owned) {
      const before = text(grid[index][column[key]]);
      if (before === values[key]) continue;
      writes.push({
        sheet_name: sheet,
        range: `${columnName(column[key])}${index + 1}`,
        cells: [[{ value: values[key] }]],
      });
      changes.push({
        slug: row.slug,
        column: HEADERS[key],
        before,
        after: values[key],
      });
    }
  }
  return { writes, changes, appended };
}

function lark(args, input) {
  return new Promise((accept, reject) => {
    const child = execFile(
      "lark-cli",
      [...args, "--as", "user"],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        let result;
        try {
          result = JSON.parse(stdout);
        } catch {
          return reject(
            new Error(
              `lark-cli ${args[1]} failed${error ? `: ${error.message.split("\n")[0]}` : "."}`,
            ),
          );
        }
        if (result.ok !== true)
          return reject(
            new Error(
              `lark-cli ${args[1]} failed: ${JSON.stringify(result.error ?? result).slice(0, 300)}`,
            ),
          );
        accept(result.data);
      },
    );
    if (input !== undefined) child.stdin.end(input);
  });
}

async function ledgerUrl(root, flag) {
  if (flag) return flag;
  if (process.env.WORKBENCH_LEDGER_URL) return process.env.WORKBENCH_LEDGER_URL;
  try {
    return JSON.parse(
      await readFile(join(root, ".local/workbench-ledger.json"), "utf8"),
    ).url;
  } catch {
    throw new Error(
      'Set WORKBENCH_LEDGER_URL or .local/workbench-ledger.json {"url": …}.',
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
  };
  if (args[0] !== "sync")
    throw new Error(
      "Usage: node scripts/ledger.mjs sync [--apply] [--store STATES.json] [--url URL] [--sheet 工作台总览]",
    );
  const url = await ledgerUrl(repository, option("--url"));
  const sheet = option("--sheet") ?? "工作台总览";
  const storePath = option("--store");
  const states = storePath
    ? new Map(
        JSON.parse(await readFile(resolve(storePath), "utf8")).map((item) => [
          item.name,
          item,
        ]),
      )
    : undefined;
  const data = await lark([
    "sheets",
    "+cells-get",
    "--url",
    url,
    "--sheet-name",
    sheet,
    "--range",
    "A1:AZ1000",
    "--include",
    "value",
  ]);
  const grid = (data.ranges?.[0]?.cells ?? []).map((cells) =>
    cells.map((cell) => text(cell?.value)),
  );
  const plan = planLedger(grid, await ledgerRows(), { sheet, states });
  for (const change of plan.changes)
    console.log(
      `${change.slug} · ${change.column}: ${change.before || "（空）"} → ${change.after || "（空）"}`,
    );
  for (const slug of plan.appended) console.log(`${slug} · 新增行`);
  console.log(
    `${plan.changes.length} cell(s) changed, ${plan.appended.length} row(s) appended.`,
  );
  if (!args.includes("--apply")) {
    if (plan.writes.length)
      console.log("Dry run. Re-run with --apply to write.");
    return;
  }
  for (let start = 0; start < plan.writes.length; start += 100)
    await lark(
      ["sheets", "+cells-set", "--url", url, "--writes", "-"],
      JSON.stringify(plan.writes.slice(start, start + 100)),
    );
  console.log("Written. Read the sheet back to confirm.");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
