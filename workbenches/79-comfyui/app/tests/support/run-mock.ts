// ABOUTME: 命令行启动模拟 ComfyUI 服务，用于手动与浏览器验收：node --experimental-strip-types tests/support/run-mock.ts [--port 8199] [--step-ms 40] [--custom] [--empty-models] [--token Bearer-x]
import { CORE_OBJECT_INFO_JSON } from "../../src/contracts/core-nodes-data.ts";
import { startMock } from "./mock-comfy.ts";

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const token = value("--token");
const mock = await startMock({
  port: Number(value("--port") ?? 8199),
  objectInfo: JSON.parse(CORE_OBJECT_INFO_JSON),
  stepMs: Number(value("--step-ms") ?? 40),
  customNode: args.includes("--custom"),
  emptyModels: args.includes("--empty-models"),
  failClass: value("--fail"),
  staleModels: args.includes("--stale-models"),
  auth: token ? { header: "Authorization", value: token } : undefined,
});
console.log(`Mock ComfyUI listening on ${mock.url}`);
process.on("SIGINT", () => void mock.close().then(() => process.exit(0)));
process.on("SIGTERM", () => void mock.close().then(() => process.exit(0)));
