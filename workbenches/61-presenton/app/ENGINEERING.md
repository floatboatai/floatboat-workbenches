# Engineering

Node 22 / React 19, fixed official build profile and CSP. Existing identity and migrations 0001–0003 are preserved; 0004 adds a dedicated durable production ledger. No new runtime dependencies, browser model endpoint, external iframe, eval or WASM.

## Boundaries

- `src/contracts/deck.ts`: bounded working-copy decoding, stricter production validation, exact upstream request mapping, safe text extraction, portable/recovery imports and Markdown export.
- `src/contracts/operation.ts` and `src/ui/submission-guard.ts`: validated persisted submission intent, exact-ID recovery, retained local records and explicit duplicate-task confirmation even when history cannot be read.
- `src/server/presenton.ts`: server-only fixed-origin HTTP client; environment config, timeouts, stream bounds, response validation, strict artifact URLs, format signatures and no redirects.
- `src/server/jobs.ts`: persisted operation-before-POST, immutable input, duplicate-operation protection, interrupted submission reconciliation, terminal result protection, manual adoption, original-file cache and bounded download chunks.
- `src/server/routes.ts`: own same-origin routes and shared autosave/store registration. `app.host.llm` is never used; capability list is empty.
- `src/ui/App.tsx`: document/outline, production and import surfaces. Existing `useProjects` autosave implementation remains unchanged. Business state stays editable while saves and generation run. Results open as new documents; they never replace the input project silently.

## Stored data and recovery

The project contains source material, audience, objective, ordered slide IDs/titles/Markdown/notes/review flags, settings and optional imported-result metadata/raw JSON. Extra draft fields retain unfinished import text, a local operation pointer, structured pending-operation metadata and recovery/presentation IDs. Portable and recovery imports preserve those decoded fields, including unfinished JSON. Stable operation records are independent of project deletion and can be found with “所有文稿”. Recent ledger listing is bounded to 100 records.

Formal models have a 700 KB UTF-8 JSON limit. The draft decoder independently accepts the same structural/per-field bounds up to 9 MB, so crossing the model threshold cannot make a saved draft unreadable. Native portable/recovery imports allow 24 MB to cover JSON escaping and raw editor state; upstream response import is limited to 250,000 characters. Large native files are parsed directly instead of duplicating them into the raw-input editor. Unfinished editor text is bounded to 1,800,000 characters.

The shared autosave request envelope is limited to 1.95 MB. Working copies above it cannot be saved to the server; the existing IndexedDB recovery path reports offline/local preservation only after its transaction succeeds. Such copies remain exportable/importable. Reducing content below the envelope resumes server saves, and below 700 KB permits a formal model. No binary artifacts are embedded in project JSON or localStorage.

Artifact bytes live in declared `generated-files` (data directory) by SHA-256 + extension. Originals are bounded to 50 MiB, fetched only from the operation's configured service origin under `/app_data/exports/`, without query strings, credentials, traversal or redirects. Authorization is attached only to the fixed service origin. Responses are never forwarded verbatim as error logs. Browser downloads use 256 KiB JSON/base64 chunks to stay within SDK response sizes. Content headers alone are not trusted: PDF and ZIP/PPTX signatures are checked. A signature is not semantic validation of every slide.

## Operation semantics

`POST /api/jobs` receives a caller operation UUID, project ID, title and snapshot. It validates before insertion, inserts synchronously, then calls `/api/v1/ppt/presentation/generate/async`. Before this route is called, the browser saves structured operation intent and displays a local pending record. On reload it queries that exact ID independently of the history list. Failed/404 reads preserve the unknown guard; creating another operation then requires an explicit confirmation. Stopped tracking does not imply the upstream task ended. Repeating the same operation returns the stored record; reusing its ID with different input is rejected. The upstream does not document idempotency, so unknown submissions never automatically retry. Startup changes interrupted `submitting` to `unknown`. Known tasks use `/status/{id}`. Client polling does not overlap; completed/error records cannot regress to pending, and a late polling response cannot reverse “stop tracking”. Manual queries can resume a stopped task. The API has no documented generation-cancel contract, so no cancellation is claimed.

Export-existing operations also persist before their POST and retain their known presentation ID if the response is lost. Export can be retried intentionally from the existing presentation; it does not regenerate content. Adoption requires the user to verify that the task ID belongs to the saved input; upstream does not expose a submission-key query.

## Verification

From repository root: `pnpm workbench check presenton`, `pnpm workbench test presenton`, `pnpm workbench package presenton`. From workbench root: `pnpm dev`. Contract tests inject a fake HTTP responder and explicitly do not count as real Presenton/model acceptance. See `ACCEPTANCE.md` and `PRESENTON.md` for exact evidence and connection setup.
