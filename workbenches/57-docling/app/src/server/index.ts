// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { assertMatches, validateReview, type Review } from "../contracts/review";
import { registerDocling } from "./docling";
import { registerSources } from "./sources";

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
const blobs = await registerSources(app);
// Saved corrections must point at items of the stored document they reference.
registerRoutes(app, validateReview, async (data: Review) => {
  if (data.document) assertMatches(data, await blobs.document(data.document.id));
});
registerDocling(app, blobs);
await app.listen();
