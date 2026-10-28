# Third-party notices

- **Oasis Editor 0.0.195**, Celso Fontes, MIT. Published JavaScript/CSS/DOCX worker vendored from npm, upstream source commit `ad0bd38f7ec7258ee2fb7a9f23fa7815a3d04195`. License: `src/vendor/oasis-editor/LICENSE`; exact upstream and adapted hashes: `notices/native-source.json`. The published bundle contains the upstream SolidJS UI, JSZip DOCX processing and font codec code under their existing notices. Upstream copyright comments remain intact.
- **Workbench Sans SC**, derived from Google Fonts Noto Sans SC, SIL OFL 1.1. Static instances at weight400 and700, renamed family; complete glyph coverage retained. `fonts/OFL.txt` and `fonts/PROVENANCE.json` carry source, modifications and SHA-256. The files are independently copied into this app and referenced through the manifest.
- The upstream bundle embeds Arimo, Carlito, Tinos, Open Sans and Roboto font assets. Their OFL notices are retained in `notices/fonts/`. Workbench runtime font injection uses its own static CJK font bytes consistently for layout and PDF.
- `fflate@0.8.2` (MIT) provides bounded ZIP/gzip operations. React, React DOM and template dependencies retain their package licenses. The adapter is MIT (`notices/ADAPTER-LICENSE`).

This app does not claim to be the upstream hosted service, Microsoft Word, or an exact Office rendering implementation.
