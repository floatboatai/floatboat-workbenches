import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateScore } from "../contracts/domain";
import { createSourceStore, registerSourceRoutes } from "./sources";
import { upgradeLegacyRows } from "./legacy";

const app = await createWorkbenchServer(import.meta.url);
const sources = createSourceStore(app.database);
sources.ensureSamples();
const upgraded = await upgradeLegacyRows(app.database, sources);
if (upgraded.projects || upgraded.drafts) console.info(`已把 ${upgraded.projects} 个旧版审校项目、${upgraded.drafts} 份草稿迁入原件库。`);
const verify = async (value: unknown) => {
  const data = validateScore(value);
  sources.verify(data);
  return data;
};
registerSourceRoutes(app, sources);
registerRoutes(app, validateScore, verify);
registerAutosaveRoutes(app, validateScore, undefined, { verify: async (data) => void (await verify(data)) });
await app.listen();
