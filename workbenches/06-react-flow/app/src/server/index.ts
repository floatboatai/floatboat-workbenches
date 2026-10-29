import { registerAutosaveRoutes } from "./autosave";
import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { registerAppRoute } from "./app-route";
import { validateFlow, validateGeneratedFlow } from "../contracts/flow";
import { OPS } from "../contracts/ops";

// 流水线在浏览器 Worker 中执行（可超时终止）；服务端只负责保存与 AI 起草。
const catalog = Object.entries(OPS)
  .map(([op, spec]) => {
    const inputs = spec.inputs.map((port) => `${port.id}:${port.accepts.join("|")}`).join(",") || "无";
    const outputs = spec.outputs.map((port) => port.id).join(",") || "无";
    const config = Object.keys(spec.config).join(",") || "无";
    return `${op}（${spec.title}；输入 ${inputs}；输出 ${outputs}；配置 ${config}）`;
  })
  .join("；");

const app = await createWorkbenchServer(import.meta.url);
registerAppRoute(app);
registerRoutes(
  app,
  validateFlow,
  "你为本地数据流水线生成配置。返回 {version:2,nodes:[{id,type:'op',position:{x,y},data:{op,label,config}}],edges:[{id,source,sourceHandle,target,targetHandle}]}。" +
    "可用节点：" +
    catalog +
    "。filter.conditions 为 [{column,op:eq|neq|gt|gte|lt|lte|contains|notContains|startsWith|endsWith|empty|notEmpty|matches,value}]；group.aggregations 为 [{op:count|sum|avg|min|max|distinct,column,as}]；mapFields.fields 为 [{from,to,cast:keep|number|text}]；sort.keys 为 [{column,direction:asc|desc}]。" +
    "每个输入端口最多一条连线，连线端口类型必须匹配（text/table/json），不得成环。位置从左到右每层相隔 280。输入节点内放少量示例数据。不添加运行记录。",
  validateGeneratedFlow,
);
registerAutosaveRoutes(app, validateFlow);
await app.listen();
