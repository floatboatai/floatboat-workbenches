# Implementation

- `contracts/article.ts`: bounded article model, unfinished working-copy decoder, portable v1 project JSON, filename and scope notices. Model Markdown ≤100,000 chars; draft decoder ≤200,000. With ≤100,000 import text, worst-case JSON escaping remains below 1.95 MB request cap. Model payload stays below 900 KB.
- `ui/ArticleEditor.tsx`: actual Vditor 4.0.1. One instance per autosave `documentKey`, event callback refs, exact native SV textarea values (upstream getValue normalizes trailing newlines), native mode toolbar clicks, no upstream cache, local assets, safe preview. No prop-driven setValue on ACK.
- `ui/html.ts`: inert template tree and closed HTML vocabulary. Removes scripts/styles/media/SVG/embedded content and all attributes except safe links and disabled task checkboxes. Shared by HTML import, preview, reading and HTML export. No execution of imported HTML.
- `ui/App.tsx`: article writing surface, outline, metadata, mode and typesetting selection, reading view, portable files, preserved import text. `replace` is awaited and creates a new document.
- `ui/autosave-*` and `server/autosave.ts`: supplied complete working-copy/IndexedDB/SQLite protocol. Stable mutation IDs, draft revisions, optimistic project revisions, truthful states and explicit resolution.
- `server/routes.ts`: only project list/detail/delete, autosave and seven enumerated static asset routes. Asset paths come from the declared `vditor-assets` resource; URL parameters do not select filesystem paths. No Host capability and no AI route.
- Migrations 0001–0003 and appId remain unchanged. No new schema required.

## Assets and CSP

Vditor loads Lute 1.7.6 and Chinese locale with same-origin external scripts. Its upstream icon loader uses XHR + inline script, incompatible with the SDK `script-src 'self'`. The UI entry preloads the unchanged icon script via external `src`, and its after-initialization hook disables the upstream inline icon loader. This preserves the runtime CSP without a dependency or SDK patch.

Vditor asks for code CSS during native rendering/theme work even with highlighting disabled, so the single GitHub CSS is bundled too. Only Lute, zh_CN, ant icons, light/dark/wechat content CSS and github code CSS are served. No optional JavaScript renderer or default CDN request is used. Rendering flags disable code/math/media previews; the preview transformer strips renderer-triggering classes. Lute HTML block previews are disabled and image lazy placeholders prevent image loading in native modes; imports containing those syntaxes initialize as SV, and cannot switch into rich modes until removed.

Physical files live at `assets/vditor/runtime`, while explicit URLs retain Vditor's expected `/api/vditor/dist/...` shape. Avoid physical nested `dist` directories: the template snapshot/package exclusion considers them generated output.

Licenses/notices: Vditor MIT; bundled Lute 1.7.6 Mulan PSL v2 (checked version embedded in asset); highlight theme BSD-3-Clause. Assets and upstream license files are source-controlled and declared for packaging. React 19.2.3 and Vditor 4.0.1 are exact pins in both package manifests/locks.

## Verification

Run `pnpm workbench:check`, `pnpm test`, `pnpm dev -- --no-watch` from this workbench; root commands support `pnpm workbench package vditor`.

Ten meaningful domain tests cover portable raw source, worst-case escaping at the limit, invalid imports, filenames, committed-response retry, invalid metadata plus import draft recovery, optimistic conflict and import-new identity, declared resource presence.

Chrome scripts/results/screenshots live in ignored `.cache/`: acceptance.mjs/json, recovery.mjs/json, final-ui.mjs/json. These exercise actual HTTP/SQLite, real native typing, download inspection, recovery/failure paths and responsive layout. Injected lost-response/offline requests are intentional failures; normal workflow has no console/page errors or remote asset requests. Source package success and local verification do not imply Floatboat desktop import verification. No Host/model call is claimed.

排版预算：正文超过 50,000 字符或单行超过 4,000 字符时，自动使用原生源码编辑并暂停即时预览、阅读排版与 HTML 导出，避免上游解析阻塞输入。Markdown 与完整项目的 100,000 字符保存/往返能力不变；缩短后可恢复三模式。切换富文本时遵循 Vditor 原生 Markdown 规范化。

Article media are additionally constrained by a local meta policy (`img-src data:; media-src none; frame-src none`); the SDK policy is unchanged. Rich HTML clipboard pastes pass through the same inert sanitizer. The copied autosave client fixes an acknowledged-state return edge: A→B→A before debounce now restores saved/draft/idle and replaces any cached intermediate B. Browser regression covers rapid typesetting undo and reload.

Native code copy menus also contain upstream inline event attributes. The supported `preview.parse` hook pre-sizes code elements before native post-processing; Vditor skips its optional copy menu for these elements. Code remains selectable and can be copied with the normal keyboard shortcut. This avoids even parsing inline handlers under the fixed script CSP.
