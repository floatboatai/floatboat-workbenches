import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw new Error("APP_ROOT_MISSING");
createRoot(root).render(<App />);
