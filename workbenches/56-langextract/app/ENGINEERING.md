# LangExtract evidence desk engineering

## Boundaries

React renders the original source and a review ledger. `contracts/evidence.ts` validates the canonical workbench document, LangExtract AnnotatedDocument JSONL, examples, fields and job responses. Evidence intervals use Python Unicode codepoints (`Array.from`), not JS UTF-16 offsets. Editing source invalidates old evidence until the exact original text is restored or new extraction is imported. Upstream records remain immutable; per-record review value/status/note is separate. JSONL export preserves original source and extraction fields; CSV exports review values and neutralizes formula-leading cells. Full project JSON preserves both layers.

`ui/workspace.tsx` and the copied autosave modules supply the repository's current SQLite + IndexedDB working-copy behavior. Invalid import/example JSON remains in `draft`, while valid applied examples remain in the model. Import creates a new project. Portable `langextract-working-copy` v1 exports include title/data/extra and restore oversized review drafts without weakening the formal model or raw JSONL validation. File imports decode directly rather than duplicating raw file text into extra. Old generic recovery imports use only the validated snapshot, not its mutation receipts/IDs. Loading prevents editing before server/local restoration. Source text has a 30k-character limit, at most8 documents/300 records per document, formal model800KB. `restoreProjectDraft` retains identical structural/field limits with a separate1.2MB recovery cap. `ui/evidence-state.ts` checks the entire proposed snapshot before each data/title/extra edit: extra600KB, total1.85MB, leaving room below the shared1.95MB request cap. Rejected edits retain the previous input. This text-only workflow does not handle PDFs or attachments.

`server/routes.ts` owns same-origin project, service and job routes. `server/jobs.ts` persists immutable job input before a request, rejects ID/content reuse, reconciles existing IDs after uncertain responses and prevents terminal-state rollback by late polls. Service results must match the submitted document IDs and original text. Completed results open as new projects, not overwrite ongoing manual edits. Errors never invent model output. Runs are listed separately from editable projects; deleting a project through the existing API does not currently delete task history.

## External service

The companion `../service/server.py` is an independent Python process; it is not bundled into the Node workbench runtime. It uses `langextract==1.7.1`, real `lx.extract`, its own SQLite job ledger and a single worker. Same-ID replay returns the existing state; queued/running jobs become interrupted on process restart and are not automatically replayed. Cancellation stops receiving results and suppresses completion writes; an already-issued provider request may continue and incur cost. Model credentials and endpoint are service-only environment variables. No Host domains are declared because this version does not call the Floatboat Host SDK.

Node's `LANGEXTRACT_SERVICE_URL` and `LANGEXTRACT_SERVICE_TOKEN` configure a single trusted service. HTTP is restricted to loopback; remote services require HTTPS. URL credentials/query/fragment and redirects are rejected. Calls have12s timeout and bounded responses. Service authenticates all routes with a constant-time Bearer comparison; provider exception details are never sent to clients. It listens on127.0.0.1 by default. Reverse-proxy/TLS access is an operator deployment task, not automatic workbench setup.

## API

- `GET /api/projects`, `GET /api/projects/:id`, `DELETE /api/projects/:id`: project management with revision checks.
- Existing `/api/autosave/*`: full working copies, conflict and retry receipts.
- `GET /api/service`: truthful connection/model configuration status, no credentials or endpoint disclosure.
- `POST /api/jobs`: `{id,projectId,input}` with immutable snapshot and client UUID.
- `GET /api/jobs`, `GET /api/jobs/:id`: history and reconciliation of an existing task.
- `POST /api/jobs/:id/cancel`: stop receiving a task's result.

Service routes: authenticated `GET /health`, `PUT /jobs/:id`, `GET /jobs/:id`, `POST /jobs/:id/cancel`. All job paths use UUIDs. No arbitrary URLs or executable user code are accepted.

## Verification

From this project directory: `pnpm workbench:check`, `pnpm test`, `pnpm dev`, `pnpm run package`. Python adapter: `python3 -m unittest discover -s service -v`. With locked environment: `python service/verify_upstream.py <temporary-output-directory>` exercises actual LangExtract grounding/serialization using an explicit deterministic model stub, not provider inference. See `ACCEPTANCE.md` for performed checks and remaining real-model/Host/client boundaries.
