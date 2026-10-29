// ABOUTME: 组装服务入口：应用信息、媒体库、项目与大纲接口、自动保存（图片引用需已入库才写入正式模型）。
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAutosaveRoutes } from "./autosave";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { createMediaStore, registerMediaRoutes } from "./media";
import { mediaIds, validateDeck } from "../contracts/domain";

const app = await createWorkbenchServer(import.meta.url);
const media = createMediaStore(app.database);
media.seedDemo();
registerAppRoute(app);
registerMediaRoutes(app, media);
registerRoutes(app);
registerAutosaveRoutes(app, validateDeck, undefined, {
  verify: async (deck) => {
    const missing = mediaIds(deck).filter((id) => !media.has(id));
    if (missing.length) throw new Error(`有 ${missing.length} 张图片不在本文稿的媒体库中，请重新插入图片。`);
  },
});
await app.listen();
