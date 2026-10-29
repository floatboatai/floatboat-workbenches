// ABOUTME: 挂载工作台页面。

import { createRoot } from "react-dom/client";
import "@comfyorg/litegraph/style.css";
import { App } from "./App";
import { RenderBoundary } from "./workspace";
import "./style.css";

const container = document.getElementById("root");
if (!container) throw new Error("APP_ROOT_MISSING");
createRoot(container).render(
  <RenderBoundary>
    <App />
  </RenderBoundary>,
);
