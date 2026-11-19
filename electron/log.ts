// Small diagnostic log at %APPDATA%/DeltaOS/logs/deltaos.log, so problems on a user's PC can be reported.
import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

export const logDir = () => join(app.getPath("userData"), "logs");
const logFile = () => join(logDir(), "deltaos.log");

export function log(...parts: unknown[]) {
  try {
    if (!existsSync(logDir())) mkdirSync(logDir(), { recursive: true });
    if (existsSync(logFile()) && statSync(logFile()).size > 1_000_000) renameSync(logFile(), logFile() + ".old");
    const line = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
    appendFileSync(logFile(), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* logging must never break the app */
  }
}
