# Engineering

`@gltf-transform/core` 4.5.1 NodeIO is the canonical asset engine. A strict bounded GLB validator precedes parsing; unsupported extensions, compressed payloads, external resources, morph targets and cameras are rejected. The pure-JS path requires no WASM or new CSP permissions.

The original is immutable. Each recipe is applied to the original with native core setters, written with NodeIO, read again, and compared against the original semantic geometry/texture/skin/animation fingerprint. TRS floating-point normalization uses an absolute 1e-5 tolerance; accessor arrays and embedded image hashes stay exact. PBR fields are partial patches, preserving untouched color factors and textures.

Resources are stored separately under manifest-declared writable `models/` by SHA-256 with atomic rename. SQLite autosave holds only references, raw edit fields, selection/camera, animation position and notes. Resource existence/hash validation gates formal save, while incomplete or missing-resource documents remain recoverable working drafts. Formal payload limit850KB; restoration accepts2MB working data and1.95MB snapshot; outer full/recovery JSON limit12MiB. Uploaded files≤1.4MB accommodate SDK's fixed2MB HTTP body boundary after base64.

Operations bind to documentKey, operation epoch and recipe snapshot. Delayed processing cannot replace edits made while processing or contaminate another project. Export freezes the selected snapshot; changing input cancels obsolete result export. A resource-version counter reloads even the same content ID after reattachment. Viewport uses data-URI image decoding under existing CSP, on-demand render, explicit animation play, and disposal of WebGL/texture/geometry resources.

Verification uses Node native roundtrips plus real Chrome. HTTP/receipt conditions use explicit awaited Node polling, never async Playwright waitForFunction. Host import is separately unverified.

## 0.8.1 UI structure

`App` keeps the existing document/operation epochs and input snapshots. `AssetLibrary` owns a native modal, bounded search/list, Escape, Tab/Shift+Tab focus cycling and focus restoration; its actions call the existing project APIs without introducing a new persistence layer. `Inspector` owns only presentation of node/material/resource/note fields and adjacent revision/export actions. Opening the library, changing context or hiding the inspector never changes Viewport's documentKey or source hash. Camera fit accounts for viewport aspect ratio; GLB geometry and native processing are untouched.

The full canvas stays mounted behind the contextual UI. On narrow screens the inspector flows below the model; model selection lists can close directly. Library, inspector and draft error states remain visible. A model-free working note is available from the library, preserving offline drafts from 0.8.0. Schema, appId, registryName, storageKey, server routes and migrations are unchanged.
