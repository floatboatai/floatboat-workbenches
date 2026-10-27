import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
const project = path.resolve(process.argv[2] ?? "."),
  seen = new Set(),
  parts = [];
async function find(name, from) {
  let current = from;
  for (;;) {
    const candidate = path.join(current, "node_modules", name);
    try {
      await stat(path.join(candidate, "package.json"));
      return candidate;
    } catch {}
    const up = path.dirname(current);
    if (up === current) return;
    current = up;
  }
}
async function visit(name, from) {
  const dir = await find(name, from);
  if (!dir || seen.has(dir)) return;
  seen.add(dir);
  const pkg = JSON.parse(
    await readFile(path.join(dir, "package.json"), "utf8"),
  );
  const files = (await readdir(dir)).filter((f) =>
    /^(license|licence|copying|notice)(\.|$)/i.test(f),
  );
  let text = "";
  for (const file of files) {
    if ((await stat(path.join(dir, file))).isFile())
      text +=
        "\n" + file + "\n" + (await readFile(path.join(dir, file), "utf8"));
  }
  parts.push(
    "\n===== " +
      pkg.name +
      "@" +
      pkg.version +
      " | " +
      JSON.stringify(pkg.license ?? "see upstream") +
      " =====\n" +
      text,
  );
  for (const dep of Object.keys(pkg.dependencies ?? {})) await visit(dep, dir);
}
const pkg = JSON.parse(
  await readFile(path.join(project, "package.json"), "utf8"),
);
for (const dep of Object.keys(pkg.dependencies)) await visit(dep, project);
await writeFile(
  path.join(project, "app/src/vendor/THIRD_PARTY_LICENSES.txt"),
  parts.join("\n"),
);
console.log("licenses", project, seen.size);
