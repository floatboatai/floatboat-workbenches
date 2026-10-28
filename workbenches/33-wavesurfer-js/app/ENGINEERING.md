# Engineering

React 19.2.3 / Node 22 / pinned template 3b55d46f7ae25e939ce3299073c37ed334d69c02. WaveSurfer 7.12.12 supplies real waveform decoding, Regions overlays and Timeline. UI is owned by App.tsx and Waveform.tsx; browser audio is loaded through page.fetch and Blob media URL (fixed template CSP unchanged). AudioContext verifies uploaded files before committing source references.

contracts/review.ts separates editable draft restoration from valid time ranges. ui/media.ts uploads chunks, SHA-256 metadata and byte-identical project export. server/files.ts validates chunk encoding, digest and media magic, stores through declared audio-originals data resource. Autosave verification requires the original file; missing resources persist the complete draft without claiming applied model save. Reattachment rejects different hashes. Source bytes are never truncated.

Shared autosave uses SQLite optimistic revisions and idempotent mutation receipts plus IndexedDB fallback. Business transitions acquire a synchronous ref lock before any await; a disabled fieldset freezes editors only for transitions/file operations. Save responses never replace edits. Async upload/export/decoding use document identity or unmount cancellation. Native playback controls remain local UI state.

Run pnpm workbench:check, pnpm test, pnpm dev -- --no-watch, pnpm package from this workbench. No SDK/toolchain/CSP modifications. Default package excludes audio and preview data. Native client import remains unverified. No external service or communication.

音频预算补充：原生metadata先限制10分钟；验证解码使用16kHz并检查128MiB PCM预算，原音频保持原始字节。输入上限与恢复契约一致；CSV公式前缀以文字转义。
