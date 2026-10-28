# Local acceptance · 0.6.0

- Official template: `3b55d46f7ae25e939ce3299073c37ed334d69c02`, SDK/tooling/CSP unchanged.
- `pnpm workbench:check`: manifest, dependencies, types, build passed. Shared autosave and single-page App size advisories remain.
- `pnpm test`: 12/12 passed, including real in-memory SQLite commit/receipt/idempotency/draft/conflict, native preservation and graph rule tests.
- Real Chrome: native LogicFlow SVG mounted; addNode, label edits, native JSON download; refresh restoration; invalid unapplied JSON; actual recovery download re-import as new project; delayed receipt while continuing input; committed-but-lost response stable retry; two-window optimistic conflict; synchronous new-document lock; 375px, keyboard and reduced motion. Simulated network abort is recorded as expected and no unexpected console/page error remained.
- Official Snapshot PNG: 42,230-byte PNG decoded and visually inspected, 1010×580, includes nodes, texts and native edges. No CSP bypass. No blob-image violation.
- Final browser pass: incomplete coordinate `-` persists through refresh; explicit coordinate application; actual mouse drag of native node persists through reload; no page errors and no document overflow at 375px.
- Package CRC and source/resource bytes compared to source; business data excluded. Upstream Apache-2.0 notice registered as packaged asset.

Preview: http://127.0.0.1:49892/ . Screenshot: `docs/screenshots/logicflow.png`.

Web Interface Guidelines fetched from official Vercel source on 2026-10-28 and applied: native controls/labels, visible focus, skip link, live status, input error recovery, reduced motion and mobile containment. No remaining blocking finding in owned UI.

Scope: graph editing and review only; no approval execution. Core built-in node/edge types only; custom registrations require their original integration. Dangling edges remain in source and warnings, omitted from render. Path review is bounded to 30 paths. No Host API required; Host import remains **unverified**. Browser fixture demonstrates local behavior, not production service integration.

Primary integration review: title input and import respect the shared 120-character recovery envelope; oversized raw graph cannot replace a valid graph, while unapplied source remains in the working draft. UTF-8 formal budget 850KB is separate from 2MB working structure budget; full autosave requests retain the shared 1.95MB limit. Two added meaningful boundary tests and four real Chrome checks passed. Re-captured ordinary SOP screenshot removes test-only notes.

Native text acceptance (2026-10-28): two new contract/real-SQLite tests and six real Chrome checks passed at http://127.0.0.1:55313/ . Double-click native label → input → automatic saved receipt while contenteditable keeps focus and graph remains unchanged → reload exposes the text draft → actual recovery download/import creates a new copy → explicit apply updates the native graph. Native Alt+Enter clears only text that actually reached the model. Delayed autosave plus import, direct late invocation of the removed host-input callback, and fast project opening preserve the old draft and keep the new graph clean. Native actions target the new engine only after its initial graph is ready. No unexpected console/page errors.

Focus setup: the browser test waits two animation frames after the native double-click before filling. This lets upstream BaseNode's first-click requestAnimationFrame(node.focus) finish; no upstream focus behavior was changed. From actual input through automatic save the test asserts continuous contenteditable focus, without clicking a save control or leaving the editor. Each engine now tracks the complete last rendered/published graph wire to avoid unnecessary re-render from native history feedback. Normal screenshots remain unchanged; the recovery panel appears only when text drafts exist. Packaging is reverified by the primary integration after this source change.
