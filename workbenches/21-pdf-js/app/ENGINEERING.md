# PDF reader engineering

The pinned template remains the compiler/runtime authority. All business code is under app/. Identity and migrations 0001–0003 are preserved. No Host capability is declared or required.

## Components and data

- contracts/pdf.ts: bounded model, SHA-256 resource metadata, raw PDF signature/size guard, portable binary framing, literal page search.
- server/files.ts: managed resource chunk writes, SHA-256 verification, atomic finalized write, immutable original reuse and read/size verification.
- server/routes.ts: project listing/detail/delete, existing autosave routes with resource verification, original PDF chunk/finalize/read, constrained bundled assets and sample resource routes.
- ui/engine.ts: PDF.js browser worker and document loading. Bundled resource URLs use /api/pdfjs/:group/:file because this template does not assume Vite publicDir serving.
- ui/PdfPage.tsx: memoized canvas + actual PDF.js TextLayer; cancellable rendering, dedicated canvas per render, lazy thumbnail intersection observation; canvas backing store capped at 16 million pixels and DPR 2.
- ui/App.tsx: reader/navigation/review, sequential bounded text index, file validation and imports, portable export and exact original download.
- shared autosave modules: revisioned working copies, IndexedDB fallback, idempotent mutation replay, conflicts. Unique storage key pdf-js-reading-room-v1. PDF lifecycle keyed by documentKey + source hash, never current project ACK identity.

Model: {source:{id:sha256,name,bytes,pages}|null,page,zoom,notes:{page:text}}. Raw search and jump input live in draft.extra. Blank titles persist as incomplete drafts. Notes cannot exceed their per-page or aggregate UI budgets. There are no document URLs in imported model and no remote document requests.

## Storage and portability

`pdf-originals` is a declared read-write data directory. Upload chunks are 256 KiB (base64 only in individual ~350 KiB HTTP requests), limited to 48 chunks per 12 MiB file. Finalization checks exact part lengths and hash, writes a temporary sibling then atomically renames, and reuses matching finalized originals without rewriting. Project snapshots contain no binary data. Autosave retains its 900 KB model / 1.95 MB request limits; maximum Chinese notes fit those budgets.

`.pdfreview`: bytes 0–10 ASCII `PDFREVIEW1\n`; bytes 11–14 big-endian uint32 JSON header length; bounded UTF-8 JSON `{format:"pdf-review",version:1,title,data}`; remaining bytes exact original PDF. Header cap 600000 bytes; total cap 12 MiB + 600000 bytes. Import verifies framing/schema/size, SHA-256, actual PDF.js readability/page count, uploads original, then awaits replace(data,title). No decompression or executable HTML occurs. Recovery JSON is a distinct export for raw draft preservation.

The UI performs full PDF engine validation before import. Direct resource endpoints verify signature, size and hash, not semantic PDF validity; a malformed direct API upload will still fail safely when rendered. Finalized assets remain after project deletion; no garbage collection in this release.

## Upstream and licensing

pdfjs-dist 6.4.299 (Node >=22.13, compatible with pinned Node 22 runtime); Apache-2.0. Worker imported via Vite ?url, same-origin bundled CMaps/fonts/wasm. All upstream directory license files retained. No runtime CDN. Official API examples: https://mozilla.github.io/pdf.js/examples/ ; source https://github.com/mozilla/pdf.js ; packaged types inspected in node_modules/pdfjs-dist/types/. Vercel Web Interface Guidelines fetched from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md .

## Verification

Run `pnpm workbench:check`, `pnpm test`, `pnpm dev -- --no-watch` from this workbench root. Chrome scripts/results and exported fixtures live in ignored .cache. Tests cover portable bytes/framing/schema, bounded page notes, search semantics, durable resources/integrity, autosave idempotency/drafts/conflicts. Browser coverage recorded in README. Actual Floatboat Desktop package import remains unverified; no Host calls needed or claimed.
