import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { isRecord } from "../contracts/project";
import { validateFlow, executeFlow } from "../contracts/flow";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validateFlow,
  "生成一个单链文本处理流程，必须恰有一个input和一个output，可含uppercase和prefix。返回{nodes:[{id:string,type:step,position:{x:number,y:number},data:{label:string,operation:input|uppercase|prefix|output,value:string}}],edges:[{id:string,source:string,target:string}]}。id均唯一，所有步骤沿一条链连接，位置从左到右依次相隔240。仅使用所列操作，不添加运行记录。",
);
app.route("POST", "/api/run", ({ body }) => {
  try {
    if (!isRecord(body)) throw new Error("运行请求无效。");
    return executeFlow(body.data);
  } catch (error) {
    return Response.json(
      {
        error: {
          message: error instanceof Error ? error.message : "运行失败。",
        },
      },
      { status: 400 },
    );
  }
});
await app.listen();
