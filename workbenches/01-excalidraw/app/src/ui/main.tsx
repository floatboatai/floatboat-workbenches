// ABOUTME: 挂载工作台页面，业务展示在组件中维护。

import "./assets";
import { createRoot } from "react-dom/client";
import { WorkspaceApp } from "./WorkspaceApp";
import "./studio.css";

const container = document.getElementById("root");
if (!container) throw new Error("APP_ROOT_MISSING");
createRoot(container).render(<WorkspaceApp />);
