import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import { App } from "./App";

document.documentElement.dataset.theme = "dark";
// Record UI errors in the diagnostics log (Settings → System → Diagnostics log).
window.addEventListener("error", (e) => window.deltaos?.log(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => window.deltaos?.log(`unhandled rejection: ${String(e.reason)}`));
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
