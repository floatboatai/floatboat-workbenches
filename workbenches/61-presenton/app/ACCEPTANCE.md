# Acceptance — 2026-10-27

## Verified locally

`pnpm workbench check presenton` passed manifest/dependency/TypeScript/build validation. The tool reports advisory large-module warnings for the reused autosave client and the three-surface React page; no SDK/tooling changes or suppression were introduced. `pnpm workbench test presenton` passed **23 tests**.

Tests cover incomplete data and formal-model capacity boundaries, portable and recovery import/export, exact Presenton request/response mapping, inert slide HTML handling, URL/auth/response-size restrictions, persist-before-POST, duplicate operation input, immutable snapshots, unknown/lost submissions, restart recovery, origin changes, disconnected status, durable original-file chunks and late polling after stop/terminal state. HTTP responder tests are contract tests, not real upstream/model inference.

Chrome headless browser acceptance used the real local HTTP/SQLite preview at 1440×1100 and 375×812, plus reduced-motion and dark mode:

| Flow | Result |
| --- | --- |
| Edit source/slide/notes; automatic save; reload | Passed |
| Reorder selected slide, then restore order | Passed |
| Unfinished raw JSON survives reload and stays unapplied | Passed |
| Empty slide title is saved as draft and restored | Passed |
| Edit while a server save receipt is delayed | Latest text remains, persists and reloads |
| Server commits, HTTP receipt is lost, retry | Same project; revision advances once (4 → 5 in final run) |
| Two-window optimistic conflict | Server keeps newer content; stale edit remains available and conflict survives reload |
| Portable import | Creates a distinct project; original revision unchanged |
| Markdown export with keyboard Enter | Downloaded and content verified |
| Disconnected production | Explicit unavailable state; generation disabled; planning/import stay usable |
| Large draft above 700 KB model limit | 35 slides × 8,000 Chinese characters saved as server draft, reopened, portable roundtrip identical |
| New offline draft, switch away, recover local item | Content recovered; online save succeeds afterward |
| 375px outline, production, import | No page horizontal overflow; all primary controls reachable |
| Dark mode / reduced motion | Reviewed screenshots; visible controls and no required animation |

No uncaught page errors. A single `net::ERR_FAILED` console message was intentionally induced by the lost-response test; ordinary loading and interaction produced no console/CSP errors. `docs/screenshots/presenton.png` is the actual edited-and-saved example after the primary browser flow. Other screenshots and private Playwright scripts/logs are kept outside Git in the session's `work/ai-batch/presenton/` directory.

Web Interface Guidelines and React rules were applied: native actions and controls, labelled editors, skip navigation, visible keyboard focus, live save/error status, destructive-action confirmation, safe content rendering, bounded lists, non-overlapping polling and reduced-motion. The task-specific layout is an editorial deck stage and production ledger; imported HTML is never rendered or executed.

## Upstream and Host boundaries

The connector was checked against actual official source at commit `93b9dcf947f70ae107b779b51dd3c491e736748a`, including async generation, task status, slides and export-existing contracts. No Presenton service, provider credentials or generated files were available in this environment. **Real model generation, actual upstream PPTX/PDF rendering/download and Host installation remain unverified.** No container image/model was downloaded. Preview explicitly reports `HOST_NOT_CONNECTED`; Host LLM is not used and the manifest declares no Host model capability.

The binary file tests verify constrained retrieval/cache/chunk mechanics with explicit fixture bytes. They do not claim those bytes came from a model or constitute a production-quality PDF/PPTX. Import/review and offline outline editing are complete independently of live generation. Server-only connection setup and known origin/path requirements are documented in `PRESENTON.md`.

## Delivery

Source package is produced with `pnpm workbench package presenton`. It excludes preview SQLite, downloaded artifacts, node_modules and credentials. Install through **Floatboat → My → Workbenches → Import workbench**. A successful source package is not proof of an imported Host connection or model run. Business-data migration should use portable project JSON and separate downloaded originals.
