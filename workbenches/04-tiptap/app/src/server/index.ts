// ABOUTME: 组装服务入口：应用信息、文稿接口、写作助手和自动保存；文稿容量统一由 validateWriting 判定。

import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerAppRoute } from "./app-route";
import { registerRoutes } from "./routes";
import { registerAutosaveRoutes } from "./autosave";
import { createStore } from "./store";
import { validateWriting } from "../contracts/domain";
import { fromMarkdown } from "../contracts/markdown";

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(app, validateWriting, {
  instructions:
    "你是中文写作助手。按用户要求写出可直接使用的文稿正文，只输出 GitHub 风格 Markdown：可以使用二级/三级标题、段落、**加粗**、*斜体*、==高亮==、有序/无序列表、任务清单（- [ ] 事项）、引用、表格和代码块。不要输出文档总标题、图片、HTML、脚本或解释性前后缀，也不要用代码围栏包住整篇回答。",
  parse: (text) => fromMarkdown(text).data,
});
// 默认适配器的新建上限是 900 KB；写作台允许内嵌图片，改用与正式保存一致的 1.6 MB 校验上限。
const store = createStore(app.database, validateWriting);
registerAutosaveRoutes(app, validateWriting, {
  get: store.get,
  create: (title, data, id) => store.create(title, data, id),
  update: store.update,
});
await app.listen();
