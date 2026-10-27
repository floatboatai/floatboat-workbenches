import { registerAutosaveRoutes } from "./autosave";
// ABOUTME: 组装服务入口，业务路由在对应模块中维护。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateDeck } from "../contracts/domain";

const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validateDeck,
  '生成中文演示文稿大纲，返回 {"theme":"ember","slides":[{"id":"slide_1","title":"简短标题","kicker":"SECTION / 01","body":"要点一\\n要点二","notes":"演讲备注"}]}。theme仅ember/ink/paper。3至8页，各页id唯一且仅字母数字下划线，title最多80字，kicker最多60字，body最多7行，每行最多35汉字或70英文字符，notes最多4000字。内容务必简短，便于直接展示。',
);
registerAutosaveRoutes(app, validateDeck);
await app.listen();
