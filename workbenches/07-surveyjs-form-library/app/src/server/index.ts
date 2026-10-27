import { createWorkbenchServer } from "../../sdk/runtime.mjs";
import { registerRoutes } from "./routes";
import { validateForm } from "../contracts/form";
import { responseStore } from "./responses";
import { StoreError } from "./store";
const app = await createWorkbenchServer(import.meta.url);
registerRoutes(
  app,
  validateForm,
  "设计简洁、清楚的中文问卷。返回{schema:{title:string,description:string,elements:[{name:string,type:text|comment|radiogroup|checkbox|dropdown|boolean|rating,title:string,isRequired:boolean,choices?:string[]}]}}。name以英文字母开头且唯一。选择题给2至8个选项，其他题不含choices。最多10道题，不包含HTML、外链、图片、文件上传、远程choices或跳转URL。",
);
const responses = responseStore(app.database);
const fail = (error: unknown) =>
  Response.json(
    {
      error: {
        message: error instanceof Error ? error.message : "答卷操作失败。",
      },
    },
    { status: error instanceof StoreError ? error.status : 400 },
  );
app.route("GET", "/api/projects/:id/responses", ({ params }) => {
  try {
    return responses.list(params.id);
  } catch (error) {
    return fail(error);
  }
});
app.route("POST", "/api/projects/:id/responses", ({ params, body }) => {
  try {
    return Response.json(responses.submit(params.id, body), { status: 201 });
  } catch (error) {
    return fail(error);
  }
});
await app.listen();
