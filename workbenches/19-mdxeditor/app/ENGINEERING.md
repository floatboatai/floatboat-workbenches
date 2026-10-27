# Engineering

## Entrypoints and responsibilities

- `src/server/index.ts` assembles persistent local HTTP/SQLite project routes and the shared autosave protocol; no Host capability is required.
- `src/contracts/review.ts` owns versioned ReviewDocument / ReviewExport, bounded decoding, non-rendering Markdown inspection and examples.
- `src/ui/App.tsx` coordinates document transitions, imports, full exports, fixed baseline and notes.
- `src/ui/ReviewEditor.tsx` mounts the real MDXEditor 4.3.3 and its formatting/table/code/source/diff plugins. A small public realmPlugin controls native viewMode. CodeMirror language auto-download is disabled.
- `src/ui/autosave-*` and `workspace.tsx` persist whole working copies. Storage namespace is `mdxeditor-review-v1`. SQLite migrations 0001–0003 are retained unchanged.

## Editor lifetime and source integrity

`markdown` is initial-value-like. The component stores it in a ref and is mounted under `documentKey`, which changes only on actual document transitions. Autosave acknowledgements never feed a changed value through setMarkdown or change the editor key. Native source input remains in the document data even if invalid; server validation saves that working copy as a draft without changing the last valid project model. `restoreDocument` enforces structure while allowing unsupported source.

After an invalid initial Markdown import, MDXEditor can retain initialMarkdownNormalize=true while editing source. Source changes therefore always update the working copy; only initial rich-text normalization is ignored. onError returns to source mode with a Chinese recovery message. The read-only native diff compares the saved baseline and current source. Baseline replacement is an explicit confirmed action.

## Boundaries

Source and baseline: 80,000 characters each. Notes: 80, each 3,000 characters; aggregate document: 650 KB UTF-8. Import files: 1.1 MB (covers the full 650 KB model plus bounded UTF-8 draft fields); pasted import: 100,000 characters. Projects retain the standard 900 KB model limit and 1,950 KB working-copy/request ceiling. There are no user binary originals. The declared project asset directory `licenses` carries the upstream MIT notices into the source package. HTML, JSX and Markdown images are unsupported render input; fenced examples remain literal code. `mdast-util-from-markdown` 2.1.0 inspects parsed nodes and normalized URL entities. MDXEditor suppressHtmlProcessing is enabled, with no image/JSX/sandpack/remote execution plugins. Safe web/mailto/anchor URLs can be authored, and navigation is suppressed in the editing surface.

Import uses awaited replace and creates a new project. Full portable JSON includes baseline, notes and unfinished note/import fields, including format selection. Generic recovery exports retain transport metadata separately. Offline caching is same-origin/browser only; project data is not embedded in the source package. Revision conflicts do not overwrite other windows, and server-version recovery remains explicit.

## Validation and sources

Run `pnpm workbench:check`, `pnpm test` and `pnpm dev -- --no-watch` from this project; package via repository `pnpm workbench package mdxeditor`.

The initial check passed with the existing shared autosave large-module advisory. Nine tests exercise Markdown/media/URL boundaries, structured import bounds, portable round trips, lost-ack replay, invalid source preservation, optimistic conflicts and import-as-new on temporary SQLite databases. Real Chrome evidence is maintained in ignored `.cache/`; README records the final acceptance outcome.

Official references: https://mdxeditor.dev/editor/docs/getting-started, https://mdxeditor.dev/editor/docs/diff-source, https://github.com/mdx-editor/editor . Inspected installed 4.3.3 core, source/diff plugin and TypeScript declarations as API authority. UI reviewed against https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md and repository React guidance.
