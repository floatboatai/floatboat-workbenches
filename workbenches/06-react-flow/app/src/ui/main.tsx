import { ReactFlowProvider } from "@xyflow/react";
import { createRoot } from "react-dom/client";
import { Studio } from "./Studio";
import "./lab.css";
const root = document.getElementById("root");
if (!root) throw new Error("APP_ROOT_MISSING");
createRoot(root).render(
  <ReactFlowProvider>
    <Studio />
  </ReactFlowProvider>,
);
