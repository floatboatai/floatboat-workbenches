# Engineering

Template 3b55d46f7ae25e939ce3299073c37ed334d69c02, unchanged SDK/tooling/CSP. Official `@usebruno/lang` 0.41.0 (pure JS, server-only): `bruToJsonV2`, `jsonToBruV2`, `collectionBruToJson`, `bruToEnvJsonV2`, `envJsonToBruV2`. fflate 0.8.2 reads and writes native collection ZIPs. React 19.2.3 UI with the shared revisioned autosave + IndexedDB. No new dependencies in 0.9.0.

Contracts (shared by server, UI and tests):
- `contracts/bruno.ts`: collection/receipt/request-model types, structural restore vs. model validation, per-request history compaction (`compactResults`), live vs. snapshot receipts.
- `contracts/seed.ts`: sample collection 「订单服务 API」 and blank collection.
- `contracts/vars.ts`: `{{var}}` interpolation with ordered scopes, recursion limit and dynamic variables.
- `contracts/assert.ts`: Bruno assert operators; LHS parsed as a property path (no JavaScript evaluation).

Server:
- `server/bru.ts`: native parse into a structured `RequestModel`, compose by overwriting only modelled keys on the native object (scripts, tests, settings, examples and inactive body variants survive), environment compose with secret values blanked.
- `server/prepare.ts`: request + folder.bru chain + collection.bru + environment → concrete URL/headers/body/auth; missing variables and missing session secrets fail before dispatch.
- `server/http.ts`: SQLite operation ledger before outbound HTTP, replay by ID/fingerprint, cancellation tombstones, failure classification (`classify`: not-delivered codes vs. ambiguous outcomes by method safety), 2 MiB body reader, assertion evaluation, post-response capture, secret redaction (plain/URL-encoded/Base64) before anything is persisted.
- `server/echo.ts`: loopback echo service for first-run sends.
- Parse/compose endpoints answer invalid input with `{ok:false,message}` (HTTP 200) so typing invalid source never produces transport errors.

UI:
- `App.tsx` orchestrates; `useNativeSource.ts` (structured draft ⇄ source, parse cache), `useEnvironments.ts` (env tables, session secrets), `useSender.ts` (send, reconcile, history, unknown-receipt guard).
- `CollectionTree`, `RequestHead`, `RequestEditor`, `KeyValueTable`, `ResponseConsole`, `SettingsPane`, `CollectionMenu`, `EnvironmentDialog`, `Modal`, `transfer.ts`, `model.ts` (URL⇄params sync, tree, hashes).
- Autosave extras: `req-<fileId>` = `{model, hash}` (structured draft tied to the source it produced), `raw-<fileId>` (unadopted/invalid source text), `env-<fileId>` = `{vars, hash}` (secret values always blank), `__selected`. `data.activeEnvironment` is part of the model.

Persistence: storageKey `bruno-v06`, appId and migrations 0001–0005 unchanged; `http_operations` payload gained optional receipt fields (no schema change). 0.6 working copies restore (covered by a test).

`pnpm workbench:check`, `pnpm test`, `node tooling/cli.mjs preview --no-watch`, `pnpm run package`. Tests use real loopback HTTP (echo service and closed ports) and in-memory SQLite.

Primary sources: https://docs.usebruno.com/bru-lang/overview ; https://docs.usebruno.com/testing/tests/assertions ; https://github.com/usebruno/bruno/tree/main/packages/bruno-lang .
