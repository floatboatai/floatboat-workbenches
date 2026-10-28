import { connectWorkbenchPage } from "../../sdk/browser.mjs";

let connection: ReturnType<typeof connectWorkbenchPage> | undefined;
export function getPageConnection() {
  return (connection ??= connectWorkbenchPage());
}
