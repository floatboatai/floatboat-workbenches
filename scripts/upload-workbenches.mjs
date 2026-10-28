import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { sha256 } from "./ci-workbenches.mjs";

const MAX_PACKAGE = 100 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_IMAGES = 20 * 1024 * 1024;
const mimeTypes = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const text = (value, min, max) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max;

async function checkedFile(directory, entry, extension, maxBytes) {
  if (
    !entry ||
    typeof entry.file !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(entry.file) ||
    !extension.test(entry.file) ||
    !/^[a-f0-9]{64}$/u.test(entry.sha256)
  )
    throw new Error("Invalid bundle file reference.");
  const path = join(directory, entry.file);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes)
    throw new Error("Invalid bundle file size or type.");
  const bytes = await readFile(path);
  if (sha256(bytes) !== entry.sha256)
    throw new Error("Bundle file digest mismatch.");
  return bytes;
}

export async function readUploadBundle(directory) {
  const metadataPath = join(directory, "presentation.json");
  const stat = await lstat(metadataPath);
  if (!stat.isFile() || stat.size > 64 * 1024)
    throw new Error("Invalid presentation metadata.");
  const presentation = JSON.parse(await readFile(metadataPath, "utf8"));
  if (
    presentation.schemaVersion !== 1 ||
    !/^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/u.test(
      presentation.registryName,
    ) ||
    !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.test(
      presentation.version,
    ) ||
    !text(presentation.name, 1, 120) ||
    !text(presentation.shortDescription, 1, 160) ||
    (presentation.fullDescription !== undefined &&
      !text(presentation.fullDescription, 0, 32000)) ||
    !Array.isArray(presentation.screenshots) ||
    !presentation.screenshots.length ||
    presentation.screenshots.length > 10
  )
    throw new Error("Invalid presentation metadata.");
  const file = await checkedFile(
    directory,
    presentation.package,
    /\.fbworkbench$/u,
    MAX_PACKAGE,
  );
  let imageBytes = 0;
  const names = new Set([presentation.package.file]);
  const screenshots = [];
  for (const screenshot of presentation.screenshots) {
    if (names.has(screenshot.file) || !text(screenshot.caption, 0, 300))
      throw new Error("Invalid screenshot metadata.");
    names.add(screenshot.file);
    const bytes = await checkedFile(
      directory,
      screenshot,
      /\.(?:png|jpe?g|webp)$/u,
      MAX_IMAGE,
    );
    imageBytes += bytes.length;
    if (imageBytes > MAX_IMAGES)
      throw new Error("Introduction images exceed 20 MiB.");
    screenshots.push({
      bytes,
      file: screenshot.file,
      type: mimeTypes[screenshot.file.split(".").at(-1)],
    });
  }
  return { presentation, file, screenshots };
}

export function uploadEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FLOATBOAT_UPLOAD_URL must be a full HTTPS endpoint.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "FLOATBOAT_UPLOAD_URL must be HTTPS without credentials, query or fragment.",
    );
  return url.href;
}

export async function uploadBundle(
  bundle,
  { url, apiKey, fetchImpl = fetch, sleep = delay } = {},
) {
  const endpoint = uploadEndpoint(url);
  if (!text(apiKey, 1, 1024) || /\s/u.test(apiKey))
    throw new Error("FLOATBOAT_UPLOAD_API_KEY is required.");
  let failure = "Upload failed.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const form = new FormData();
    form.set(
      "file",
      new Blob([bundle.file], { type: "application/octet-stream" }),
      bundle.presentation.package.file,
    );
    form.set("presentation", JSON.stringify(bundle.presentation));
    for (const screenshot of bundle.screenshots)
      form.append(
        "screenshots",
        new Blob([screenshot.bytes], { type: screenshot.type }),
        screenshot.file,
      );
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      // Never print fetch errors, request headers, signed URLs or remote bodies.
      failure = "Upload transport failed or timed out.";
    }
    if (response) {
      if (response.ok) {
        let result;
        try {
          result = await response.json();
        } catch {
          failure = "Upload response could not be read.";
          if (attempt < 2) await sleep(1000 * 2 ** attempt);
          continue;
        }
        if (
          result?.code !== 0 ||
          result.data?.contentHash !== bundle.presentation.package.sha256 ||
          result.data?.registryName !== bundle.presentation.registryName ||
          result.data?.version !== bundle.presentation.version
        )
          throw new Error(
            "Upload response did not confirm the package identity.",
          );
        return;
      }
      failure = `Upload failed with HTTP ${response.status}.`;
      await response.body?.cancel();
      if (![408, 429].includes(response.status) && response.status < 500)
        throw new Error(failure);
    }
    if (attempt < 2) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(failure);
}

async function main() {
  const directory = process.argv[2];
  if (!directory)
    throw new Error(
      "Usage: node scripts/upload-workbenches.mjs ARTIFACT_DIRECTORY",
    );
  const url = uploadEndpoint(process.env.FLOATBOAT_UPLOAD_URL);
  const apiKey = process.env.FLOATBOAT_UPLOAD_API_KEY;
  if (!apiKey) throw new Error("FLOATBOAT_UPLOAD_API_KEY is required.");
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("workbench-"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!entries.length) throw new Error("No workbench bundles found.");
  // Validate all bundles before making any authenticated network request.
  for (const entry of entries)
    await readUploadBundle(join(directory, entry.name));
  for (const entry of entries) {
    const bundle = await readUploadBundle(join(directory, entry.name));
    await uploadBundle(bundle, { url, apiKey });
    console.log(
      `Uploaded ${bundle.presentation.registryName} ${bundle.presentation.version}.`,
    );
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
