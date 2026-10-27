// Reproducible browser asset preparation; not a workbench build configuration.
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
await build({
  entryPoints: [new URL("./pdfme-entry.mjs", import.meta.url).pathname],
  outfile: new URL("../app/src/vendor/pdfme-browser.js", import.meta.url)
    .pathname,
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "PdfmeBrowser",
  target: ["chrome120"],
  minify: true,
  legalComments: "linked",
  alias: { buffer: require.resolve("buffer/") },
  metafile: true,
});
