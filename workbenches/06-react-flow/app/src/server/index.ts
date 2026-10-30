import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { registerAppRoute } from "./app-route";
import { repairGeneratedFlow, validateFlow } from "../contracts/flow";
import { OPS, type OpKind } from "../contracts/ops";
import { describeConfig } from "../contracts/repair";

// 流水线在浏览器 Worker 中执行（可超时终止）；服务端只负责保存与 AI 起草。
// 配置说明由字段结构生成，与校验同源：可选值、范围和默认值都写给模型。
const catalog = Object.entries(OPS)
  .map(([op, spec]) => {
    const inputs = spec.inputs.map((port) => `${port.id}:${port.accepts.join("|")}`).join(",") || "无";
    const outputs = spec.outputs.map((port) => port.id).join(",") || "无";
    return `- ${op}（${spec.title}）输入 ${inputs}；输出 ${outputs}；config {${describeConfig(op as OpKind)}}`;
  })
  .join("\n");

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(
  app,
  validateFlow,
  "你为本地数据流水线生成配置。返回 {version:2,nodes:[{id,type:'op',position:{x,y},data:{op,label,config}}],edges:[{id,source,sourceHandle,target,targetHandle}]}。" +
    "可用节点（config 只能使用列出的字段；带引号的取值必须原样使用其中之一）：\n" +
    catalog +
    "\n每个输入端口最多一条连线，连线端口类型必须匹配（text/table/json），不得成环。位置从左到右每层相隔 280。输入节点内放少量示例数据。不添加运行记录。",
  // 模型偶尔写错枚举或端口；修正后连同修正说明返回，由用户核对后采用。
  (value) => {
    const { flow, repairs } = repairGeneratedFlow(value);
    return { ...flow, repairs: repairs.slice(0, 30) };
  },
);
registerAutosaveRoutes(app, validateFlow);
await app.listen();
