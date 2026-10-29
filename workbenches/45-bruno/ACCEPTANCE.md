# Local acceptance · Bruno 0.9.0

Template `3b55d46f7ae25e939ce3299073c37ed334d69c02`; SDK, tooling and CSP unchanged; appId, storageKey `bruno-v06` and migrations 0001–0005 unchanged (no schema change). No new dependencies.

## Functional acceptance — local-verified

`node scripts/workbench.mjs check bruno`: manifest, dependencies, types and build passed; the only warning is the shared `autosave-client.ts` module size. `node scripts/workbench.mjs test bruno`: **23/23 passed** — official parse/compose round trips that preserve scripts/tests/docs/inactive bodies; environment compose never writes secret values; variable scopes and inherited auth; missing variables/secrets rejected before any ledger row; real loopback HTTP through the echo service for JSON, form-urlencoded, multipart and GraphQL with assertions and post-response capture; secret redaction in receipt and ledger; ECONNREFUSED (real closed port) and DNS classified as definite failures; ambiguous POST vs. GET outcomes; replay without resend; cancellation; 2 MiB truncation; restart reconciliation by method safety; Bruno assert operators without JS evaluation; history compaction; URL⇄params sync; 0.6 working copies still restore; 20×31,000-character SQLite draft budget.

Real Chrome (Chrome for Testing via playwright-core), fresh data directory, no Host and no other service — 63 scripted checks, 0 unexpected console/page errors:

- **First open**: sample 「订单服务 API」, `本机/健康检查` → 发送 → 200, 断言 2/2 against the in-process `{{$localEcho}}` service.
- **Edit and send**: editing the URL immediately sends the edited request (no apply step); query table mirrors the URL; Bru 源 shows the new `url`/`params:query`; editing the source flows back into the URL bar; deleting a param rewrites the URL.
- **Bodies/auth/vars**: 创建订单 (JSON, inherited collection Bearer, collection var `apiVersion`, folder header, `$randomUUID`) 4/4 assertions; form-urlencoded, multipart text and GraphQL each 1/1; actual request shows headers; `lastEchoId` captured.
- **Assertions**: an added failing assertion shows 2/3 and opens the 断言 tab.
- **Failures**: env `baseUrl` → closed port: POST is 「连接被拒绝 … 请求未送达，可直接重试」, the next send has no confirm; no environment → 「未定义变量 {{baseUrl}}」 before dispatch; reserved port 9 → explicit bad-port message.
- **Unknown receipt**: POST to `/delay/4000` cancelled after dispatch → 回执未知; the next send shows the inline guard (读取回执 / 核对过，仍然发送 / 取消); override sends.
- **Lost response**: `/api/http/run` response aborted after the server executed → UI reads the ledger and shows the 200 receipt; one dispatch.
- **Secrets**: marking `apiToken` secret moves the value to page memory; send succeeds; 实际请求 shows `•••（秘密变量）`; echo body redacted; autosaved copy, exported ZIP env file and project JSON contain no secret value; after reload the send fails with 「秘密变量 apiToken 尚未在本次会话输入」.
- **Autosave**: paused typing → server draft contains the edit → reload restores URL and source; typing during a 2.5 s delayed save keeps the newer text and it survives reload; a lost autosave response is retried without a duplicate project; an invalid Bru source survives reload as a draft with its parse error, and fixing it clears the error.
- **Import/export**: ZIP keeps Bruno layout (`bruno.json`, `collection.bru`, `environments/*.bru`, `本机/folder.bru`, requests) and carries the docs edit; project JSON includes history; both re-import as new collections, the imported ZIP selects its environment and sends immediately.
- **375 px**: no horizontal overflow; 请求列表 drawer closes after picking; send works; menu and environment dialogs fit; Escape closes the collection menu and returns focus; ⌘/Ctrl+Enter sends.
- Public example: JSONPlaceholder `GET /users/1` on explicit send → 200, 3/3.

Intentional injections produced two `net::ERR_FAILED` console entries (aborted autosave and run responses). Observation for integration: the shared autosave `leave()` can show its “本机缓存尚未修复” confirm when the user switches collection while a just-reconciled receipt is still saving (seen after a previous tab closed before its final autosave). Shared blueprint code was not changed.

Package `bruno-studio-0.9.0.fbworkbench`: 62 files, 120,675 bytes, SHA-256 `0508d288…9f51`, CRC passed, no business data. **Host import unverified.**

Web Interface Guidelines (fetched 2026-10-29) applied to changed UI: labelled controls and icon buttons, visible focus, skip link, ARIA tabs with arrow/Home/End keys, live status for save/response, native dialogs with Escape and focus return, placeholders with “…”, tabular numbers, `translate="no"` on URLs/bodies, overscroll containment, reduced motion, theme-color, 375 px containment. Remaining: tab state is not reflected in the URL (iframe-hosted app).

## Structural review — pending

Self-review: replaces the 0.6 header combo (project picker + eight file buttons) with Bruno's native three-pane layout — collection tree | request editor | response console — and a single 「集合」 menu for file lifecycle; environment selector and quiet autosave status in one top row; Send stays next to the URL. Formal comparison with neighbouring screenshots is left to the primary review.
