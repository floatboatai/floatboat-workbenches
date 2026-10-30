import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./process.mjs";

export const repository = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const versionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const registryPattern = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/u;
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export async function verifiedProjects(root = repository) {
  const catalog = JSON.parse(
    await readFile(join(root, "catalog.json"), "utf8"),
  );
  const projects = catalog.filter((item) => item.status === "local-verified");
  if (!projects.length)
    throw new Error("No locally verified workbenches to package.");
  const seen = new Set();
  for (const project of projects) {
    if (
      !slugPattern.test(project.slug) ||
      seen.has(project.slug) ||
      !/^workbenches\/[0-9]+-[a-z0-9-]+$/u.test(project.directory)
    )
      throw new Error("Invalid or duplicate catalog project.");
    seen.add(project.slug);
    const manifest = JSON.parse(
      await readFile(
        join(root, project.directory, "app/manifest.json"),
        "utf8",
      ),
    );
    if (
      !registryPattern.test(manifest.registryName) ||
      !versionPattern.test(manifest.version) ||
      manifest.version !== project.version ||
      typeof manifest.name !== "string" ||
      !manifest.name.trim() ||
      typeof manifest.description !== "string" ||
      !manifest.description.trim() ||
      manifest.description.length > 160
    )
      throw new Error(`Invalid release metadata: ${project.slug}`);
  }
  return projects;
}

export async function packageBundle(
  root,
  slug,
  outputDirectory,
  packageWorkbench,
) {
  const project = (await verifiedProjects(root)).find(
    (item) => item.slug === slug,
  );
  if (!project) throw new Error("Choose a locally verified workbench.");
  if (!isAbsolute(outputDirectory))
    throw new Error("Bundle output directory must be absolute.");
  const manifest = JSON.parse(
    await readFile(join(root, project.directory, "app/manifest.json"), "utf8"),
  );
  const sources = project.presentation?.screenshots;
  if (!Array.isArray(sources) || !sources.length || sources.length > 10)
    throw new Error(`A real introduction screenshot is required: ${slug}`);
  const fullDescription = project.presentation?.fullDescription;
  if (
    fullDescription !== undefined &&
    (typeof fullDescription !== "string" || fullDescription.length > 32000)
  )
    throw new Error("Invalid full introduction description: " + slug);
  const screenshots = [];
  let totalImageBytes = 0;
  for (const [index, source] of sources.entries()) {
    if (
      !/^docs\/screenshots\/[a-z0-9-]+\.png$/u.test(source.path) ||
      typeof source.caption !== "string" ||
      !source.caption.trim() ||
      source.caption.length > 300
    )
      throw new Error(`Invalid introduction screenshot: ${slug}`);
    const bytes = await readFile(join(root, source.path));
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error("Introduction screenshot must be a PNG.");
    totalImageBytes += bytes.length;
    if (bytes.length > 10 * 1024 * 1024 || totalImageBytes > 20 * 1024 * 1024)
      throw new Error("Introduction screenshots exceed upload limits.");
    screenshots.push({
      bytes,
      file: index === 0 ? "screenshot.png" : `screenshot-${index + 1}.png`,
      caption: source.caption,
    });
  }
  // mkdir is exclusive: never mix stale artifacts with the current build.
  await mkdir(dirname(outputDirectory), { recursive: true });
  await mkdir(outputDirectory);
  const file = `${manifest.registryName}-${manifest.version}.fbworkbench`;
  const packagePath = join(outputDirectory, file);
  if (packageWorkbench) await packageWorkbench(packagePath);
  else
    await runCommand(
      process.execPath,
      [
        join(root, "scripts/workbench.mjs"),
        "package",
        slug,
        "--",
        "--output",
        packagePath,
      ],
      { cwd: root },
    );
  const bytes = await readFile(packagePath);
  if (!bytes.length || bytes.length > 100 * 1024 * 1024)
    throw new Error("Package output is empty or exceeds 100 MiB.");
  for (const screenshot of screenshots)
    await writeFile(join(outputDirectory, screenshot.file), screenshot.bytes);
  const presentation = {
    schemaVersion: 1,
    registryName: manifest.registryName,
    version: manifest.version,
    name: manifest.name,
    shortDescription: manifest.description,
    ...(fullDescription === undefined ? {} : { fullDescription }),
    package: { file, sha256: sha256(bytes) },
    screenshots: screenshots.map(({ file, caption, bytes }) => ({
      file,
      caption,
      sha256: sha256(bytes),
    })),
  };
  await writeFile(
    join(outputDirectory, "presentation.json"),
    JSON.stringify(presentation, null, 2) + "\n",
  );
  return presentation;
}

// Tooling that shapes every build or package; a change rebuilds all verified projects.
const sharedPaths = [
  /^scripts\/(?:workbench|template|process|ci-workbenches)\.mjs$/u,
  /^scripts\/blueprints\//u,
  /^\.github\/workflows\/workbenches\.yml$/u,
  /^package\.json$/u,
  // The pinned template supplies every project's SDK and build tooling.
  /^template\.lock\.json$/u,
];

/**
 * Chooses what to build and what to send to the store. Without a base catalog every
 * verified project is built and released. Otherwise a project is built when its
 * directory, introduction images, catalog entry or shared tooling changed, and
 * released only when its version is new: the store accepts each version once, so
 * an unchanged version never needs another upload.
 */
export function planWorkbenches(
  projects,
  { baseCatalog, changedFiles = [] } = {},
) {
  const full = !Array.isArray(baseCatalog);
  const shared = changedFiles.some((file) =>
    sharedPaths.some((path) => path.test(file)),
  );
  const before = new Map(
    (full ? [] : baseCatalog).map((item) => [item.slug, item]),
  );
  const include = [];
  const releases = [];
  for (const project of projects) {
    const base = before.get(project.slug);
    const release =
      full ||
      base?.status !== "local-verified" ||
      base.version !== project.version;
    const images = new Set(
      (project.presentation?.screenshots ?? []).map((item) => item.path),
    );
    if (
      release ||
      shared ||
      JSON.stringify(base) !== JSON.stringify(project) ||
      changedFiles.some(
        (file) => file.startsWith(`${project.directory}/`) || images.has(file),
      )
    )
      include.push({ slug: project.slug, directory: project.directory });
    if (release) releases.push(project.slug);
  }
  return { full, include, releases };
}

function git(root, args) {
  return new Promise((accept, reject) =>
    execFile(
      "git",
      args,
      { cwd: root, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : accept(stdout)),
    ),
  );
}

/** Plans against a base commit; an unreachable base falls back to a full build and release. */
export async function planSince(root, base) {
  const projects = await verifiedProjects(root);
  if (!base) return planWorkbenches(projects);
  if (!/^[a-f0-9]{40}$/u.test(base))
    throw new Error("Base must be a full commit SHA.");
  try {
    const changedFiles = (
      await git(root, ["diff", "--name-only", "--no-renames", base, "HEAD"])
    )
      .split("\n")
      .filter(Boolean);
    const baseCatalog = JSON.parse(
      await git(root, ["show", `${base}:catalog.json`]),
    );
    return planWorkbenches(projects, { baseCatalog, changedFiles });
  } catch {
    console.error("Base commit is unavailable; planning a full build.");
    return planWorkbenches(projects);
  }
}

async function main() {
  const [command, slug, output] = process.argv.slice(2);
  if (command === "plan") {
    const base = slug === "--base" ? output : undefined;
    console.log(JSON.stringify(await planSince(repository, base)));
  } else if (command === "matrix") {
    const projects = await verifiedProjects();
    console.log(
      JSON.stringify({
        include: projects.map(({ slug, directory }) => ({ slug, directory })),
      }),
    );
  } else if (command === "package") {
    await packageBundle(repository, slug, output);
  } else
    throw new Error(
      "Usage: node scripts/ci-workbenches.mjs <plan [--base SHA]|matrix|package SLUG ABSOLUTE_DIRECTORY>",
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
