# Local acceptance · Bruno 0.6.0

Template `3b55d46f7ae25e939ce3299073c37ed334d69c02`; SDK, tooling and CSP unchanged. `pnpm workbench:check` passed manifest/dependencies/types/build. Two nonblocking module-size warnings remain for shared autosave and the page orchestration component. `pnpm test`: **16/16 passed**.

Native engine evidence: official `@usebruno/lang@0.41.0` runs `bruToJsonV2`, `jsonToBruV2` and `collectionBruToJson` on real source. Tests cover method/URL/query/header/body edit and parse roundtrip, docs retention, script/test/collection inheritance blocking, unknown body/annotation protection, and native source byte preservation. Official package functions run in Node; no script evaluator is present.

Real Chrome acceptance (15 cases): HTTP form editing; actual POST to ephemeral loopback HTTP server with inspected status 201, response header, echoed query/body and duration; refresh/read-receipt no resend; native `.bru` plus ZIP exact-byte exports; invalid source editor refresh; actual downloaded snapshot recovery imported as a new project; lost HTTP receipt reconciled without repeated POST; real cancellation with unknown receipt and no retry; cancellation while the initiation save is delayed prevents dispatch; delayed autosave typing; committed autosave lost-response retry; two-window conflict; synchronous new-document lock; unsupported script byte-for-byte export and disabled send; 375px/keyboard/reduced-motion/no overflow. Only two intentional `net::ERR_FAILED` injections appeared; no unexpected console/page errors.

Final additional Chrome checks: downloaded ZIP extracted and imported through the actual file-folder chooser retains paths and bytes; source rename survives refresh; unfinished `http://` URL survives refresh; collection sidebar collapses; 375px contained. Offline autosave reports “草稿已暂存本机，连接恢复后重试。” and restores from IndexedDB after refresh; manual retry confirms saved status.

Persistent HTTP operation is inserted before fetch (verified by the real HTTP fixture observing its SQLite row). Same operation ID returns the previous receipt with no second dispatch; mismatched fingerprint is rejected. Timeout/cancel/network uncertainty never causes automatic retry. Interrupted ledger rows become unknown on server startup. Early cancellations persist in a separate SQLite table and block dispatch even after restart. Response reader retains up to 64 KiB and flags truncation; binary payloads use base64.

Final preview: http://127.0.0.1:59349/ . Screenshot: `docs/screenshots/bruno.png`. The temporary fixture listened only on `127.0.0.1` and was stopped after acceptance. Its screenshot shows demonstration data, not a production service or credentials.

Package `bruno-0.6.0-release.fbworkbench`: CRC passed, 41 files, 39 original source/resource files compared byte-for-byte; transfer SHA-256/size entries all checked. Manifest normalization and resource relocation were inspected. MIT notice scope is retained, Bruno and fflate notices plus SETUP are declared assets. Business data excluded.

Web Interface Guidelines fetched from Vercel on 2026-10-28: semantic labels/buttons, visible focus, skip link, error/live status, response whitespace containment, reduced motion and narrow screens verified. No blocking owned-UI finding remains.

Boundaries: HTTP subset only; scripts/tests/vars/auth inheritance/collection execution/advanced bodies are retained and blocked, never quietly executed or discarded. Environment secrets not read or bound; manual inputs and response snapshots are included in full engineering exports. Redirects not followed. Four snapshots and 20 source files per working copy. **Host import unverified**; local fixture does not establish production connectivity.

恢复容量回归：工作结构恢复上限调整为 2,000,000 字节，正式模型仍为 780,000 字节，共享完整请求仍为 1,950,000 字节。现有 SQLite 草稿测试覆盖 20 个各含 31,000 汉字的源文件（完整请求约 1.86 MB）：服务器实际确认 draft 后，从 SQLite 读取并 restoreCollection 完整恢复，wire JSON 一致，正式模型仍拒绝该体积；测试总数保持 16。
