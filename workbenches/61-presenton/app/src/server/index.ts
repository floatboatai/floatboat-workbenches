// ABOUTME: 组装服务入口：应用信息、图片媒体库、业务路由与自动保存（引用的图片需已入库才写入正式模型）。

import { createWorkbenchServer } from '../../sdk/runtime.mjs';
import { registerAppRoute } from './app-route';
import { registerRoutes } from './routes';
import { registerAutosaveRoutes } from './autosave';
import { createMediaStore, registerMediaRoutes } from './media';
import { mediaIds, validateDeck } from '../contracts/model';

const app = await createWorkbenchServer(import.meta.url);
const media = createMediaStore(app.database);
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
