import "./zod-config.ts";
// Gabarito, every subset: the browser downloads Latin Extended only when a
// character needs it (visual-design.md, Typography).
import "@fontsource-variable/gabarito";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import { followSystemColorScheme } from "./shell/color-scheme.ts";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

// public/color-scheme.js applied the choice before the first paint; from
// here on the page follows the system setting while the choice is System.
followSystemColorScheme();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
