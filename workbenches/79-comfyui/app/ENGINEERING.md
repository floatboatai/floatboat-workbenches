# Engineering

Run commands from the repository root: `node scripts/workbench.mjs check|test|package comfyui`.

| Area | Files |
| --- | --- |
| Pure contracts (shared by UI, server and tests) | `src/contracts/`: `comfy.ts` (node definitions, widget layout, type compatibility), `workflow.ts` (UI workflow JSON types and builders), `convert.ts` (graph ↔ API prompt, link resolution through Reroute/bypass/mute/Primitive), `validate.ts`, `importer.ts`, `png.ts` (tEXt/zTXt/iTXt, CRC), `templates.ts`, `run.ts`, `connection.ts`, `document.ts` (autosave payload), `core-nodes*.ts` (generated snapshot) |
| Server | `src/server/index.ts` (assembly), `comfy-session.ts` (HTTP proxy to the configured ComfyUI, WebSocket tracking incl. early-message replay, polling reconciliation, history ingestion), `comfy-routes.ts` (`/api/comfy/*`), `runs.ts` (SQLite runs/outputs/settings with limits), `store.ts`/`autosave.ts` (shared blueprint, untouched) |
| UI | `src/ui/App.tsx` (shell), `graph/` (litegraph integration: `nodes.ts` classes from definitions, `editor.ts` undo/redo/selection/minimap data, `palette.ts`), `CanvasView.tsx`, `overlays.tsx`, `Library.tsx`, `Inspector.tsx`, `RunPanel.tsx`, `Gallery.tsx`, `WorkflowMenu.tsx`, `api.ts` |
| Migrations | `0001`–`0003` template and autosave; `0004_comfy_runs.sql` runs, outputs, settings |
| Tests | `tests/formats.test.ts`, `session.test.ts`, `snapshot.test.ts`; `tests/support/mock-comfy.ts` (ComfyUI protocol mock), `run-mock.ts` (CLI for manual/browser acceptance), `mini-info.ts` |
| Tools | `tools/make-snapshot.mjs` regenerates the bundled node definitions from a real `/object_info` dump |

Notes

- The litegraph canvas is the source of truth while editing; its serialisation is pushed to the autosave state (`setData`) after every change. The canvas is reloaded only when the document key changes. A 300 ms poll of the graph version catches changes that raise no pointer event.
- The page CSP allows `data:` but not `blob:` images, so outputs are read through `page.fetch` and turned into data URLs.
- The server proxies every call; the browser never talks to ComfyUI, so ComfyUI's Origin check does not apply and no `--enable-cors-header` is needed.
- Run mock manually: `node --experimental-strip-types app/tests/support/run-mock.ts --port 8199 [--custom] [--stale-models] [--fail VAEDecode] [--step-ms 100]`.
