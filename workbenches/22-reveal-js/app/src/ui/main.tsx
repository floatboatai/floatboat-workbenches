import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RenderBoundary } from "./workspace";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw new Error("APP_ROOT_MISSING");
createRoot(root).render(
  <RenderBoundary>
    <App />
  </RenderBoundary>,
);
