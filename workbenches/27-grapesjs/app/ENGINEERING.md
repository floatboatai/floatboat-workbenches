# GrapesJS engineering

## Architecture

`src/contracts/page.ts` validates a versioned, portable subset of components and CSS rules. It rejects executable/remote HTML, unsafe CSS and unbounded structures before native import. `templates.ts` contains original demonstration content and six blocks. Canonical node content is escaped text; nested formatting stays in component nodes. HTML export is compiled from the validated model with inline CSS, charset and viewport metadata.

`PageEditor.tsx` owns one GrapesJS instance per `documentKey`. React data changes and save receipts do not reinitialize it. It uses the actual core canvas iframe, BlockManager, Layers, StyleManager, UndoManager and DeviceManager. Native component/style events serialize the model. Canvas `input` reads the live text DOM before blur; allowed inline node attributes/styles survive the snapshot. The last active native text view completes asynchronous `disableEditing()` before editor destruction to avoid teardown parsing against an already-destroyed parser.

Native manager inputs are labelled. Unfinished property inputs are bound to component ID, CSS property and within-property field identity in `extra`. Only matching controls restore, and invalid raw values survive native normalization on blur. Inspector drafts have a 100 KB serialized budget. The selected component ID is also autosaved; source JSON is independently stored there until discarded or imported. Selected inputs restore on document transition or when their owning component is selected again. Import validates first and awaits `replace`, which creates a new project. Block buttons are focusable and Enter/Space insert through the real core. Native pointer drag remains available.

`App.tsx` uses the shared autosave hook directly. The generated editor instance is keyed by `documentKey`, not project ID. The status message distinguishes ordinary saved data, a working copy with source/property inputs, offline recovery and conflict. Background saves never disable the canvas. File operations, conflict recovery and JSON source are application UI; no generation route or unused Host capability remains.

`server/routes.ts` registers validated project CRUD and the shared autosave routes. `server/autosave.ts`, `ui/autosave-client.ts` and `ui/autosave-cache.ts` retain the batch's revision, idempotent mutation, complete-working-copy and IndexedDB semantics. Applied migrations 0001–0003 are unchanged. Page limit 700 KB stays under the shared 900 KB model and 1.95 MB working-copy/request limit. JSON source drafts are limited to 800 KB after JSON string escaping and native property inputs to 300 characters; client request limit remains 1.95 MB.

## Security and runtime

GrapesJS 0.23.8 is pinned in both manifests/locks. No Studio SDK. Telemetry, `cssIcons` CDN, built-in persistence, canvas scripts/styles, asset upload and external canvas drop are disabled. Rich-text paste inserts escaped plain text. No image component is allowed, so projects have no binary/remote assets to retain. The unmodified SDK CSP and same-origin iframe are used. CSS URL/escape/import/expression and unapproved functions, event attributes and script properties are rejected. HTML export is produced from validated data and does not include an editor runtime.

`locale.ts` derives from GrapesJS's distributed Chinese locale, with local common-element translations. See `THIRD_PARTY_NOTICES.md`. The scene uses original text/CSS shapes, without external visual assets.

## Verification

Run from this workbench directory: `pnpm workbench:check`, `pnpm test`; from repository root: `pnpm workbench package grapesjs`. Six automated tests cover meaningful model/security/export/SQLite boundaries.

Browser evidence lives in ignored `.cache/acceptance.mjs`, `.cache/browser-results.json`, `.cache/offline.mjs`, `.cache/offline-results.json` and PNG captures. The acceptance run uses real Chrome, native components, actual HTTP/SQLite and independently inspects downloaded JSON, CSS and self-contained HTML. It includes an intentionally failed response after commit; that simulated network error is distinguished from runtime errors. Final screenshot is copied to `docs/screenshots/grapesjs.png` after inspection.

No Host API is used. The preview launcher may report Host connectivity, which is not Host feature verification. Floatboat Desktop import remains unverified. Native spatial editing is primarily pointer based; not all upstream canvas gestures have keyboard equivalents. Local cache recovery remains restricted to the same origin/browser.

### Recorded acceptance (2026-10-27)

- `pnpm workbench:check`: pass; only the shared autosave module-size advisory remains.
- `pnpm test`: 6/6 pass against temporary in-memory SQLite.
- Chrome: 15 primary workflow checks plus the remote-request/runtime-error audit passed. The single console network failure was deliberately injected after a committed save; no unexpected runtime errors or remote requests remained.
- Targeted inspector check: component/property/field isolation, invalid numeric blur and reload retention, and valid correction clearing the draft all passed. Selection snapshots stable generated component IDs before draft references are persisted.
- Offline check: a brand-new offline project can be switched away from, located as a local item, resumed, and automatically synchronized after reconnection.
- Native drag was independently exercised with actual pointer movement across the canvas iframe. The browser scripts preserve the expected network-failure evidence separately from runtime failures.
