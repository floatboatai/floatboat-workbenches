# Engineering

Official template pinned at 3b55d46f7ae25e939ce3299073c37ed334d69c02; unmodified SDK/tooling/CSP. React 19.2.3, @logicflow/core 2.2.5, @logicflow/extension 2.3.1 (peer ^2.2.5). Native LogicFlow renders SVG, mutates its model, emits history:change; app merges native updates with preserved unknown object metadata and dangling edges. Snapshot is the official PNG exporter. No LLM or Host domains are requested.

`contracts/flow.ts` owns graph validation, graph-review semantics, bounded path traversal, exact-wire working copy restoration and actual autosave-envelope import. `ui/App.tsx` owns native instance lifecycle, ResizeObserver cleanup, synchronous document transition lock and context editor. One native instance per documentKey; background autosave acknowledgement does not recreate it. `server/routes.ts` registers generic revisioned projects and shared autosave routes. Shared SQLite transactions persist drafts, receipts and mutation IDs; IndexedDB retains full fallback copies. No workflow executor exists.

Limits: 500 nodes, 1000 edges, 550K graph characters, 40K review characters; input files <=1.8MB and shared request budget 1.95MB. Restore validates envelope/length without normalizing raw JSON. Unsupported custom native element types require the original integration and are not silently converted. Import a recovery or portable project to a new document; no imported history executes.

Validation commands from project root: `pnpm workbench:check`, `pnpm test`, `pnpm dev -- --no-watch`, `pnpm run package`. Local browser acceptance uses actual Chrome and real SQLite. Host import is unverified. Upstream: https://github.com/didi/LogicFlow ; no production network effect.
