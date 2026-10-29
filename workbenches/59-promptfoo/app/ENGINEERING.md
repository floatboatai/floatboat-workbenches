# Promptfoo 0.9.0 engineering

## Modules and runtime

The packaged app runs in the pinned Node 22 / SQLite / React template without an external evaluator. contracts/config.ts reads YAML/JSON, expands tests and validates providers; template.ts interprets a bounded template subset. results.ts builds stable test/column keys from Promptfoo summaries; compare.ts calculates regressions and release advice; reports.ts creates escaped HTML and formula-safe CSV.

server/evaluator.ts renders prompts, calls echo/replay/script/Host providers and scores assertions. assertions.ts aligns deterministic semantics with promptfoo 0.125.1 using pinned ajv 8.20.0, ajv-formats 3.0.1, fastest-levenshtein 1.0.16 and js-rouge 3.2.3. This is a compatible subset, not the full upstream package. Optional repository service/ runs the real pinned promptfoo for cross-checking. notices/ carries attribution and the upstream license.

sandbox.ts runs JavaScript assertions, transforms and script providers in a worker with a fresh VM context, JSON input/output, disabled string/Wasm compilation, timeouts and worker memory limits. No process/require/network API is supplied. This bounds locally chosen code; it is not an OS security boundary or a guarantee for arbitrary hostile JavaScript.

## Persistence and recovery

Applied migrations 0001–0004 are unchanged. Migration 0005 adds eval_runs, eval_uploads and eval_tasks. Raw results live outside project metadata. Chunk imports use a stable ID and return the same result on retry. The browser sends 400,000-character pieces; the route accepts up to 1,500,000 characters per piece and the SDK caps HTTP bodies at 2 MB.

runs.ts owns immutable results, digests, progress, cancellation and legacy 0.4 migration. Restart marks unfinished tasks interrupted without replay. Before submitting, the UI saves a frozen request (ID, config, sources, explicit Host approval). Lost responses, early polling 404s and refresh retain that ID; retries cannot create a new execution. Polling is document-scoped. Official terminal states cannot regress under late responses.

Shared autosave contracts/client/cache/server remain in place; app-owned workspace, FileMenu and App control navigation. extra.config keeps unfinished YAML without overwriting applied config. Mutation IDs deduplicate retries, revisions protect conflicts, and IndexedDB offers origin-local recovery. Document transitions await save/recovery permission. Imported recovery files create new documents and discard executable task handles.

Portable project export includes all raw results and fails visibly if one cannot be read. Import remaps result IDs, reviews and release decisions. Working-copy export carries local result references only; use full projects for another installation. Removing a run removes its reference, not the immutable result row. There is no automatic result garbage collection.

## External effects

Host columns use the declared llm.generateText capability after confirmation. The adapter carries model, system prompt, generation limits, request ID, timeout and cancellation, with concurrency limited to two. The default model hint is not model discovery; users can edit floatboat:<model>.

The optional official runner uses protocol 2, a configured loopback HTTP or HTTPS origin, optional bearer token, redirect rejection, body limits and persisted job digests. It only evaluates echo/replay columns and deterministic assertions. Model graders are rejected before upstream execution. Official JavaScript/transforms require PROMPTFOO_RUNNER_ALLOW_JS=1 and trusted input; this is not the local worker sandbox. The runner is not included in the workbench package.

Acceptance starts the built app with hostConnection:null, independent archive data, and an outbound-network guard. Chrome uses an isolated profile and only the preview origin. No real Host/LLM calls or Floatboat imports are performed.

## Bounds and compatibility

Files: 40 MiB and 20,000 result cells. Runs: 2,000 tests, 24 prompts, 24 providers, 6,000 cells. Projects: 60 run references, 600,000 config characters, 880,000 bytes of applied metadata. Restorable model drafts: 1,500,000 bytes; entire autosave requests: 1,950,000 bytes. UTF-8 byte limits can be reached before character limits. Large configs plus pending submission snapshots may exceed the save envelope; execution then fails before submission and asks for reduced content.

Supports v3 and v2 result-list shapes, not all historical variants. Template/asserter compatibility is a subset. Python, arbitrary file/provider modules, network references, red-team scans, organization management and model graders are outside scope. Replay matches exact rendered prompt/provider; changes produce missing-recording errors. Replay cost/latency are recorded values, not new measurements. YAML with recorded:/floatboat: providers needs this workbench or its adapter, not an unmodified official CLI.

## Verification and packaging

From workbenches/59-promptfoo with Node 22: pnpm workbench:check, pnpm test, pnpm --dir service test. Tests cover parsing, templates, scoring/parity, bounded JavaScript, mock Host, imports, compare/reports, migration, tasks, autosave and connector races. Service tests run the pinned real evaluator with fixtures, never a model provider.

Browser acceptance covers 1440×1000 and 375×812 primary flows, imports, five export formats, invalid drafts, save/task races, keyboard, errors and recovery. Executed evidence is listed in ACCEPTANCE.md; scripts/logs/downloads are outside Git under archive/2026-10-29-workbench-depth/promptfoo/codex/.

Finalize REQUIREMENTS, DESIGN, ENGINEERING and acceptance evidence before package. Move any same-version old artifact into the archive because pack refuses to overwrite. After pnpm package, compare exported application/ sources/resources byte-for-byte with app/, excluding generated SDK/build output, and check manifest resource normalization separately. Record the SHA-256 only after comparison. Packaging success does not verify Floatboat import or Host connectivity.
