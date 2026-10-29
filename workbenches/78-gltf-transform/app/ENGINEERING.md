# Engineering

## Engine

`@gltf-transform/core` 4.5.1 NodeIO is the canonical engine, registered with `ALL_EXTENSIONS` from `@gltf-transform/extensions` and the codecs `meshopt.decoder/encoder` (meshoptimizer 1.2.0) and `draco3d.decoder` (draco3dgltf 1.5.7; the encoder is loaded only for Draco export). A fresh NodeIO with a collecting logger is created per operation (`server/model.ts`), so library warnings become user-facing notes instead of console noise.

- `server/importer.ts` accepts GLB, `.gltf` + external `.bin`/images, data URIs and ZIP (fflate, ≤ 4000 entries, ≤ 128 MB unpacked). External URIs resolve against the entry's folder, then by unique file name, so a flat multi-file pick works. Missing files are listed by name. Unsupported *required* extensions reject; unknown optional ones are reported. Sheared matrices reject (glTF Transform stores TRS). Draco/Meshopt extensions are disposed after decoding, buffers are unpartitioned, and the result is written as a canonical single-buffer GLB that is read back before it is stored.
- `budget()` bounds nodes, meshes, materials, textures, animations, texture sides/pixels, upload vertices and non-finite transforms.
- `server/pipeline.ts`: `applyEdits` (names, PBR, extras, TRS with Euler→quaternion, texture replacement incl. EXT_texture_webp) followed by a write/read fidelity check over editable fields and an accessor digest. `runPass` maps each pass to `@gltf-transform/functions` (`prune`, `dedup`, `weld`, `weld+simplify` with MeshoptSimplifier, `resample`, `quantize`, `flatten`, `join`, `instance`, `center`) or the app's texture resize (pngjs/jpeg-js decode, area-average downscale, re-encode; WebP/KTX2/AVIF kept). `runPipeline` computes stage keys (digest of source id + edits + passes[0..n)), reuses the longest valid cached prefix whose files still exist, and runs only the tail. Every stage output is read back and summarized.
- `summarize()` produces the persisted `StageReport` (bytes, nodes, meshes, primitives, draw calls, render/upload vertices, triangles incl. GPU instances, materials, textures, texture bytes, VRAM estimate via `ImageUtils.getVRAMByteLength` + vertex/index buffers, animations, keyframes, extensions). `inspectDocument()` adds node TRS/hierarchy, materials and their extensions, textures (size, format, VRAM, slots, materials), meshes and animations from `functions.inspect()`, bounds and warnings. Inspections are cached by content hash.
- `compressModel()` applies `meshopt()` or `dequantize()+draco()` at export and reads the result back; stored stages stay uncompressed so the browser can preview them without WASM (the page CSP has no `wasm-unsafe-eval`).

`@gltf-transform/functions` depends on `ndarray-pixels`, which statically imports the native `sharp`. Native modules are outside this runtime profile and the app never calls it, so both package.json files carry `pnpm.overrides["ndarray-pixels>sharp"] = "npm:lodash.noop@3.0.1"`; the import resolves to a pure-JS no-op and `--frozen-lockfile` stays reproducible.

## Transport and storage

The SDK caps every JSON request at 2,000,000 bytes and has no streaming upload. `server/uploads.ts` keeps in-memory sessions: the page declares files and sizes (`purpose: import` ≤ 64 MB total, `resource` ≤ 128 MB), then sends ordered base64 chunks of ≤ 1 MiB (≈ 1.4 MB per body), then calls `/import` or `/resource`. Sessions expire after 15 minutes; total preallocation is capped at 640 MB. Responses (model/texture bytes, exports) stream as `Response` objects without that cap.

Models and replacement images are content-addressed files in the manifest's writable `models/` resource (atomic temp + rename). `verifyDocument` checks every referenced source, stage and image (size + SHA-256, cached per process) before a formal save; missing resources keep the document as a recoverable draft. Routes: `/api/uploads*`, `/api/resources/missing`, `/api/models/:id` (+ `/textures/:index`), `/api/inspect/:id`, `/api/sample`, `/api/process`, `/api/export`, plus project and autosave routes. Schema, migrations, appId, registryName and storageKey are unchanged.

## Document

`AssetDocument` adds `passes`, `stages` (key, ref, report, ms, note), `passDrafts` (raw parameter text), `stage` (previewed index), `compression` and `edits.textures`; NodeEdit adds raw `translation/rotation/scale` text. `restoreAsset` accepts 0.8 documents and fills defaults; the 0.8 recipe key stays identical when there are no passes or texture edits. `validateAsset` enforces complete numbers/JSON; unfinished input autosaves as a draft.

## UI

`App` owns document/operation epochs and actions; `Pipeline` (pass rows, stage stack, comparison), `Inspector` + `panels` (materials, nodes/TRS, textures, clips, report, delivery), `overlays` (stage strip, node palette, material shelf, animation bar), `Viewport` (Three.js; patched `GLTFLoader.loadImageSource` decodes embedded images through data URIs because the CSP forbids `blob:` images; KTX2 previews as a grey placeholder; live TRS poses on the original; depth range follows model size) and `project-files` (complete-project ZIP v2, 0.8 JSON import, resource restore that uploads only what the service lacks). Undo is a stage-prefix operation and needs no server call when the shorter recipe is cached.

## Verification

Node tests (`tests/*.test.ts`, 22): demo determinism, each pass's metric change, instancing note/static instancing, prefix reuse/undo/removal, edits incl. TRS and texture replacement, extension preservation through passes and Meshopt/Draco export, pass validation, Khronos-extension GLB import, multi-file glTF and ZIP import, Draco/Meshopt decode, explicit rejections, chunked upload sessions, contract restore/validation, resource store, SQLite autosave. Browser flows use Playwright with real Chrome; see ACCEPTANCE.md. Host import is separately unverified.
