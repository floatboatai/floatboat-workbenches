import { copyFile } from "node:fs/promises";
await copyFile(
  new URL("../node_modules/pptxgenjs/dist/pptxgen.bundle.js", import.meta.url),
  new URL("../app/src/vendor/pptxgen.bundle.js", import.meta.url),
);
await copyFile(
  new URL("../node_modules/pptxgenjs/LICENSE", import.meta.url),
  new URL("../app/src/vendor/PPTXGENJS-LICENSE", import.meta.url),
);
