# Engineering

Template 3b55d46f7ae25e939ce3299073c37ed334d69c02, unchanged SDK/tooling/CSP. Official @usebruno/lang 0.41.0 (pure JS) is server-only; `bruToJsonV2`, `jsonToBruV2`, `collectionBruToJson` are the actual parser/converter. fflate 0.8.2 exports native ZIP collections. React 19.2.3 UI uses shared revisioned autosave + IndexedDB.

- `contracts/bruno.ts`: exact source/receipt preservation, file count/size/type and full recovery validation, portable snapshot import.
- `server/bru.ts`: official parsing/serialization, supported-field inspection and conservative execution blocking; no eval or script engine. Unknown/advanced execution blocks stay in source.
- `server/http.ts`: SQLite operation ledger before outbound HTTP, persistent early cancellation tombstones, replay by stable ID/fingerprint, bounded manual redirect fetch, timeout/cancel/unknown receipts and startup reconciliation. Network starts outside SQLite transactions. No ambient credentials, Cookie forwarding or environment interpolation.
- `ui/App.tsx`: source versus unapplied form state, guarded import/open/new transitions with synchronous ref locks, documentKey + generation isolation for parsing/composition/execution, explicit send/cancel/reconcile. Background autosave leaves editing available. HTTP results never replace unrelated document edits.

Limits: 20 source files ×40K characters, 780KB valid model, 2MB recoverable working structure; complete cache/request envelope remains bounded by shared 1.95MB transport. Large valid raw inputs are preserved as drafts rather than normalized; response snapshots are limited to four with explicit removal. 64KiB body limit is flagged, binary responses use base64. Original source is exported byte-for-byte unless user applies a supported structured edit or adopts edited raw source.

`pnpm workbench:check`, `pnpm test`, `pnpm dev -- --no-watch`, `pnpm run package`. Tests use real loopback HTTP on ephemeral ports and temporary SQLite; browser uses actual Chrome. Local verification does not prove production connectivity or Host import. Host domains/capabilities are empty. SETUP and license notices are explicit assets.

Primary sources: https://docs.usebruno.com/bru-lang/overview ; https://github.com/usebruno/bruno/tree/main/packages/bruno-lang . The supported package is pinned and its actual API inspected. New recommended upstream formats are outside this Bru-focused scope.
