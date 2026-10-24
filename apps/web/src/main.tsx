import "./zod-config.ts";
// Gabarito, every subset: the browser downloads Latin Extended only when a
// character needs it (visual-design.md, Typography).
import "@fontsource-variable/gabarito";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
