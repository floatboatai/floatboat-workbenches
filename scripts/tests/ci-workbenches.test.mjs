import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packageBundle,
  planWorkbenches,
  repository,
  sha256,
  verifiedProjects,
} from "../ci-workbenches.mjs";
import {
  readUploadBundle,
  publishEndpoint,
  releaseFilter,
  submitForReview,
  uploadBundle,
  uploadEndpoint,
} from "../upload-workbenches.mjs";

const temporary = await mkdtemp(join(tmpdir(), "workbench-ci-"));
after(() => rm(temporary, { recursive: true, force: true }));
const png = Buffer.from("89504e470d0a1a0a0000", "hex");
let sequence = 0;
async function fixture() {
  const root = join(temporary, String(sequence++));
  await mkdir(join(root, "workbenches/01-example/app"), { recursive: true });
  await mkdir(join(root, "docs/screenshots"), { recursive: true });
  const manifest = {
    appId: "workbench.example",
    registryName: "example-studio",
    name: "示例工作台",
    version: "1.2.3",
    description: "普通演示资料",
  };
  await writeFile(
    join(root, "workbenches/01-example/app/manifest.json"),
    JSON.stringify(manifest),
  );
  const catalog = [
    {
      slug: "example",
      directory: "workbenches/01-example",
      version: "1.2.3",
      status: "local-verified",
      presentation: {
        screenshots: [
          { path: "docs/screenshots/example.png", caption: "真实工作台截图" },
        ],
      },
    },
    { slug: "planned", directory: "workbenches/02-planned", status: "planned" },
  ];
  await writeFile(join(root, "catalog.json"), JSON.stringify(catalog));
  await writeFile(join(root, "docs/screenshots/example.png"), png);
  return {
    root,
    manifest,
    catalog,
    output: join(root, "artifacts/workbench-example"),
  };
}
async function bundleFixture() {
  const f = await fixture();
  await packageBundle(f.root, "example", f.output, (output) =>
    writeFile(output, "package-bytes"),
  );
  return { ...f, bundle: await readUploadBundle(f.output) };
}

test("matrix selects only verified projects and checks manifest/catalog versions", async () => {
  const { root, catalog } = await fixture();
  assert.deepEqual(
    (await verifiedProjects(root)).map((project) => project.slug),
    ["example"],
  );
  catalog[0].version = "1.2.4";
  await writeFile(join(root, "catalog.json"), JSON.stringify(catalog));
  await assert.rejects(verifiedProjects(root), /release metadata/);
});
test("all current verified projects have actual introduction PNGs", async () => {
  for (const project of await verifiedProjects(repository)) {
    const screenshot = project.presentation.screenshots[0];
    const bytes = await readFile(join(repository, screenshot.path));
    assert.ok(bytes.length <= 10 * 1024 * 1024);
    assert.deepEqual(bytes.subarray(0, 8), png.subarray(0, 8));
    assert.ok(
      screenshot.caption.length > 0 && screenshot.caption.length <= 300,
    );
  }
});
test("artifact keeps verified source identity and includes image and content hashes", async () => {
  const { root, output, manifest, bundle } = await bundleFixture();
  assert.deepEqual(
    JSON.parse(
      await readFile(join(root, "workbenches/01-example/app/manifest.json")),
    ),
    manifest,
  );
  assert.deepEqual(bundle.presentation, {
    schemaVersion: 1,
    registryName: "example-studio",
    version: "1.2.3",
    name: "示例工作台",
    shortDescription: "普通演示资料",
    package: {
      file: "example-studio-1.2.3.fbworkbench",
      sha256: sha256("package-bytes"),
    },
    screenshots: [
      {
        file: "screenshot.png",
        caption: "真实工作台截图",
        sha256: sha256(png),
      },
    ],
  });
  assert.deepEqual(await readFile(join(output, "screenshot.png")), png);
  await assert.rejects(packageBundle(root, "example", output), /EEXIST/);
  await assert.rejects(
    packageBundle(root, "planned", join(root, "planned")),
    /locally verified/,
  );
});
test("missing introduction screenshot fails before the packager runs", async () => {
  const { root, output } = await fixture();
  await rm(join(root, "docs/screenshots/example.png"));
  let packaged = false;
  await assert.rejects(
    packageBundle(root, "example", output, async () => {
      packaged = true;
    }),
    /ENOENT/,
  );
  assert.equal(packaged, false);
});
test("license and scope notes survive packaging and multipart upload verbatim", async () => {
  const { root, output, catalog } = await fixture();
  const description =
    "GPL-2.0-or-later\n\nIncludes corresponding source and license notices.\nUpload is staging; it does not grant marketplace publication.";
  catalog[0].presentation.fullDescription = description;
  await writeFile(join(root, "catalog.json"), JSON.stringify(catalog));
  await packageBundle(root, "example", output, (path) =>
    writeFile(path, "package-bytes"),
  );
  const bundle = await readUploadBundle(output);
  assert.equal(bundle.presentation.fullDescription, description);
  await uploadBundle(bundle, {
    url: "https://upload.example.invalid/ingest",
    apiKey: "official-fixture-key",
    fetchImpl: async (_url, options) => {
      const presentation = JSON.parse(options.body.get("presentation"));
      assert.equal(presentation.fullDescription, description);
      assert.equal(
        presentation.package.sha256,
        bundle.presentation.package.sha256,
      );
      return Response.json({
        code: 0,
        data: {
          contentHash: bundle.presentation.package.sha256,
          registryName: "example-studio",
          version: "1.2.3",
          objectId: "test-object",
        },
      });
    },
  });
});
test("invalid introduction text fails before packaging or writing an output", async () => {
  for (const value of [42, null, "x".repeat(32001)]) {
    const { root, output, catalog } = await fixture();
    catalog[0].presentation.fullDescription = value;
    await writeFile(join(root, "catalog.json"), JSON.stringify(catalog));
    let packaged = false;
    await assert.rejects(
      packageBundle(root, "example", output, async () => {
        packaged = true;
      }),
      /Invalid full introduction/,
    );
    assert.equal(packaged, false);
    await assert.rejects(readFile(join(output, "presentation.json")), /ENOENT/);
  }
});
test("a bundle preserves every declared introduction image", async () => {
  const { root, output, catalog } = await fixture();
  catalog[0].presentation.screenshots.push({
    path: "docs/screenshots/second.png",
    caption: "另一张截图",
  });
  await writeFile(join(root, "catalog.json"), JSON.stringify(catalog));
  await writeFile(join(root, "docs/screenshots/second.png"), png);
  await packageBundle(root, "example", output, (path) =>
    writeFile(path, "package-bytes"),
  );
  const bundle = await readUploadBundle(output);
  assert.equal(bundle.screenshots.length, 2);
  assert.equal(bundle.screenshots[1].file, "screenshot-2.png");
  assert.equal(bundle.presentation.screenshots[1].caption, "另一张截图");
});
test("upload validation rejects changed artifact bytes", async () => {
  const { output } = await bundleFixture();
  await writeFile(join(output, "screenshot.png"), "altered");
  await assert.rejects(readUploadBundle(output), /digest mismatch/);
});
test("upload validation rejects traversal and symlinks", async () => {
  const { output, bundle } = await bundleFixture();
  bundle.presentation.package.file = "../outside.fbworkbench";
  await writeFile(
    join(output, "presentation.json"),
    JSON.stringify(bundle.presentation),
  );
  await assert.rejects(readUploadBundle(output), /file reference/);
  const next = await bundleFixture();
  await rm(join(next.output, "screenshot.png"));
  await symlink(
    join(next.root, "docs/screenshots/example.png"),
    join(next.output, "screenshot.png"),
  );
  await assert.rejects(readUploadBundle(next.output), /size or type/);
});
test("only HTTPS credential-free endpoints are accepted", () => {
  for (const url of [
    "",
    "http://example.com/upload",
    "https://user:pass@example.com/upload",
    "https://example.com/upload?token=secret",
    "https://example.com/upload#fragment",
  ])
    assert.throws(() => uploadEndpoint(url), /HTTPS/);
  assert.equal(
    uploadEndpoint("https://upload.example.invalid/ingest"),
    "https://upload.example.invalid/ingest",
  );
});
test("multipart upload uses official account credential and refuses redirects", async () => {
  const { bundle } = await bundleFixture();
  await uploadBundle(bundle, {
    url: "https://upload.example.invalid/ingest",
    apiKey: "official-fixture-key",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://upload.example.invalid/ingest");
      assert.equal(options.redirect, "error");
      assert.equal(
        options.headers.Authorization,
        "Bearer official-fixture-key",
      );
      assert.equal(options.headers["Content-Type"], undefined);
      assert.equal(
        options.body.get("file").name,
        bundle.presentation.package.file,
      );
      assert.equal(await options.body.get("file").text(), "package-bytes");
      assert.deepEqual(
        JSON.parse(options.body.get("presentation")),
        bundle.presentation,
      );
      assert.equal(options.body.getAll("screenshots").length, 1);
      assert.equal(options.body.get("screenshots").type, "image/png");
      return Response.json({
        code: 0,
        data: {
          contentHash: bundle.presentation.package.sha256,
          registryName: "example-studio",
          version: "1.2.3",
        },
      });
    },
  });
});
test("lost response retries the exact package, screenshot and metadata", async () => {
  const { bundle } = await bundleFixture();
  const requests = [];
  await uploadBundle(bundle, {
    url: "https://example.com/upload",
    apiKey: "official-fixture-key",
    sleep: async () => {},
    fetchImpl: async (_url, options) => {
      requests.push({
        package: await options.body.get("file").text(),
        metadata: options.body.get("presentation"),
        image: Buffer.from(await options.body.get("screenshots").arrayBuffer()),
      });
      if (requests.length === 1)
        throw new Error("lost response with sensitive details");
      return Response.json({
        code: 0,
        data: {
          contentHash: bundle.presentation.package.sha256,
          registryName: "example-studio",
          version: "1.2.3",
        },
      });
    },
  });
  assert.deepEqual(requests[0], requests[1]);
});
test("authorization errors are not retried or echoed", async () => {
  const { bundle } = await bundleFixture();
  let requests = 0;
  await assert.rejects(
    uploadBundle(bundle, {
      url: "https://example.com/upload",
      apiKey: "official-fixture-key",
      sleep: async () => {},
      fetchImpl: async () => {
        requests++;
        return new Response("private upstream diagnostics", { status: 403 });
      },
    }),
    { message: "Upload failed with HTTP 403." },
  );
  assert.equal(requests, 1);
});
test("HTTP success must confirm the submitted package identity", async () => {
  const { bundle } = await bundleFixture();
  await assert.rejects(
    uploadBundle(bundle, {
      url: "https://example.com/upload",
      apiKey: "official-fixture-key",
      fetchImpl: async () =>
        Response.json({
          code: 0,
          data: {
            contentHash: "bad",
            registryName: "example-studio",
            version: "1.2.3",
          },
        }),
    }),
    /package identity/,
  );
});
test("a response interrupted after headers can retry safely", async () => {
  const { bundle } = await bundleFixture();
  let requests = 0;
  await uploadBundle(bundle, {
    url: "https://example.com/upload",
    apiKey: "official-fixture-key",
    sleep: async () => {},
    fetchImpl: async () => {
      requests++;
      if (requests === 1) return new Response('{"code":0,');
      return Response.json({
        code: 0,
        data: {
          contentHash: bundle.presentation.package.sha256,
          registryName: "example-studio",
          version: "1.2.3",
        },
      });
    },
  });
  assert.equal(requests, 2);
});
test("temporary server failures stop after three attempts without echoing response bodies", async () => {
  const { bundle } = await bundleFixture();
  let requests = 0;
  await assert.rejects(
    uploadBundle(bundle, {
      url: "https://example.com/upload",
      apiKey: "official-fixture-key",
      sleep: async () => {},
      fetchImpl: async () => {
        requests++;
        return new Response("private upstream diagnostics", { status: 503 });
      },
    }),
    { message: "Upload failed with HTTP 503." },
  );
  assert.equal(requests, 3);
});

const receipt = {
  objectId: `wbpkg_${"a".repeat(64)}`,
  registryName: "example-studio",
  version: "1.2.3",
};
test("review endpoint is the upload endpoint's sibling", () => {
  assert.equal(
    publishEndpoint("https://example.com/api/workbenches/upload"),
    "https://example.com/api/workbenches/publish",
  );
  assert.throws(() => publishEndpoint("http://example.com/upload"), /HTTPS/);
});
test("review submission sends only the receipt identity and confirms it", async () => {
  const outcome = await submitForReview(receipt, {
    url: "https://example.com/api/workbenches/publish",
    apiKey: "official-fixture-key",
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://example.com/api/workbenches/publish");
      assert.equal(options.redirect, "error");
      assert.equal(
        options.headers.Authorization,
        "Bearer official-fixture-key",
      );
      assert.deepEqual(JSON.parse(options.body), {
        objectId: receipt.objectId,
      });
      return Response.json({
        code: 0,
        data: {
          registryName: "example-studio",
          version: "1.2.3",
          status: "submitted",
        },
      });
    },
  });
  assert.deepEqual(outcome, { status: "submitted" });
  await assert.rejects(
    submitForReview(receipt, {
      url: "https://example.com/p",
      apiKey: "k",
      fetchImpl: async () =>
        Response.json({
          code: 0,
          data: { registryName: "other", version: "1.2.3" },
        }),
    }),
    /identity/,
  );
});
test("non-MIT packages are skipped, other refusals fail without retry", async () => {
  const refuse =
    (errorCode, status = 400) =>
    async () =>
      Response.json(
        { code: -1, message: "secret detail", errorCode },
        { status },
      );
  assert.deepEqual(
    await submitForReview(receipt, {
      url: "https://example.com/p",
      apiKey: "k",
      fetchImpl: refuse("WORKBENCH_MIT_REQUIRED"),
    }),
    { skipped: "not MIT licensed" },
  );
  let calls = 0;
  await assert.rejects(
    submitForReview(receipt, {
      url: "https://example.com/p",
      apiKey: "k",
      fetchImpl: async (...args) => {
        calls++;
        return refuse("WORKBENCH_SUBMISSION_CONFLICT", 409)(...args);
      },
    }),
    (error) =>
      /HTTP 409 \(WORKBENCH_SUBMISSION_CONFLICT\)/.test(error.message) &&
      !error.message.includes("secret detail"),
  );
  assert.equal(calls, 1);
});
test("review submission retries transient failures", async () => {
  let calls = 0;
  const outcome = await submitForReview(receipt, {
    url: "https://example.com/p",
    apiKey: "k",
    sleep: async () => {},
    fetchImpl: async () => {
      calls++;
      if (calls === 1) throw new Error("socket reset");
      if (calls === 2) return new Response("busy", { status: 503 });
      return Response.json({
        code: 0,
        data: {
          registryName: "example-studio",
          version: "1.2.3",
          status: "submitted",
        },
      });
    },
  });
  assert.equal(calls, 3);
  assert.equal(outcome.status, "submitted");
});

const project = (slug, version, extra = {}) => ({
  slug,
  directory: `workbenches/0${slug.length}-${slug}`,
  status: "local-verified",
  version,
  presentation: { screenshots: [{ path: `docs/screenshots/${slug}.png` }] },
  ...extra,
});
const slugs = (plan) => plan.include.map((item) => item.slug);

test("plan without a base builds and releases every verified project", () => {
  const plan = planWorkbenches([project("a", "1.0.0"), project("b", "2.0.0")]);
  assert.equal(plan.full, true);
  assert.deepEqual(slugs(plan), ["a", "b"]);
  assert.deepEqual(plan.releases, ["a", "b"]);
});

test("plan releases only new versions and builds only changed projects", () => {
  const before = [
    project("a", "1.0.0"),
    project("b", "2.0.0"),
    project("c", "3.0.0"),
  ];
  const now = [
    project("a", "1.0.1"),
    project("b", "2.0.0"),
    project("c", "3.0.0"),
  ];
  const plan = planWorkbenches(now, {
    baseCatalog: before,
    changedFiles: [
      "workbenches/01-a/app/manifest.json",
      "docs/screenshots/b.png",
      "README.md",
    ],
  });
  assert.deepEqual(slugs(plan), ["a", "b"]);
  assert.deepEqual(plan.releases, ["a"]);
});

test("plan treats a newly verified project as a release", () => {
  const plan = planWorkbenches([project("a", "1.0.0"), project("n", "0.1.0")], {
    baseCatalog: [project("a", "1.0.0"), { slug: "n", status: "planned" }],
    changedFiles: [],
  });
  assert.deepEqual(slugs(plan), ["n"]);
  assert.deepEqual(plan.releases, ["n"]);
});

test("catalog entry edits rebuild without releasing an unchanged version", () => {
  const plan = planWorkbenches([project("a", "1.0.0", { notes: "new" })], {
    baseCatalog: [project("a", "1.0.0")],
    changedFiles: ["catalog.json"],
  });
  assert.deepEqual(slugs(plan), ["a"]);
  assert.deepEqual(plan.releases, []);
});

test("shared tooling rebuilds everything but releases nothing new", () => {
  const all = [project("a", "1.0.0"), project("b", "2.0.0")];
  for (const file of [
    "scripts/blueprints/autosave-client.ts",
    "scripts/workbench.mjs",
    ".github/workflows/workbenches.yml",
    // The pinned template supplies the SDK and build tooling of every project.
    "template.lock.json",
  ]) {
    const plan = planWorkbenches(all, {
      baseCatalog: all,
      changedFiles: [file],
    });
    assert.deepEqual(slugs(plan), ["a", "b"], file);
    assert.deepEqual(plan.releases, [], file);
  }
  const docs = planWorkbenches(all, {
    baseCatalog: all,
    changedFiles: ["docs/ci-packages.md", "scripts/upload-workbenches.mjs"],
  });
  assert.deepEqual(slugs(docs), []);
});

test("upload release filter selects artifact directories by slug", () => {
  assert.equal(releaseFilter(undefined), null);
  assert.deepEqual(
    [...releaseFilter('["comfyui","oasis-editor"]')],
    ["workbench-comfyui", "workbench-oasis-editor"],
  );
  assert.deepEqual([...releaseFilter("[]")], []);
  assert.throws(() => releaseFilter('["../x"]'), /JSON array of slugs/);
  assert.throws(() => releaseFilter("comfyui"), /JSON array of slugs/);
});
