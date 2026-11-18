// Claude integration. The API key lives only in the main process; the renderer
// drives the agent loop (it owns the OS state the tools act on) and asks the main
// process to run one streamed model turn at a time.
import Anthropic from "@anthropic-ai/sdk";
import { app, safeStorage, type WebContents } from "electron";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeStatus, ClaudeTurnRequest, ClaudeTurnResult } from "../shared/ipc";

export const MODEL = "claude-opus-5-5";

const keyFile = () => join(app.getPath("userData"), "claude-key.bin");
let cachedKey: string | null | undefined;
const controllers = new Map<string, AbortController>();

function readStoredKey(): string | null {
  if (cachedKey !== undefined) return cachedKey;
  cachedKey = null;
  try {
    if (existsSync(keyFile())) {
      const buf = readFileSync(keyFile());
      if (buf.subarray(0, 4).toString() === "RAW:") cachedKey = buf.subarray(4).toString("utf8");
      else if (safeStorage.isEncryptionAvailable()) cachedKey = safeStorage.decryptString(buf);
    }
  } catch {
    cachedKey = null;
  }
  return cachedKey;
}

function activeKey(): { key: string | null; source: ClaudeStatus["source"] } {
  const stored = readStoredKey();
  if (stored) return { key: stored, source: "settings" };
  const env = process.env.ANTHROPIC_API_KEY;
  if (env) return { key: env, source: "environment" };
  return { key: null, source: "none" };
}

export function status(): ClaudeStatus {
  const { key, source } = activeKey();
  return { configured: !!key, source, model: MODEL, encrypted: safeStorage.isEncryptionAvailable() };
}

export function setKey(key: string): ClaudeStatus {
  const trimmed = key.trim();
  if (!trimmed) return clearKey();
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(trimmed)
    : Buffer.concat([Buffer.from("RAW:"), Buffer.from(trimmed, "utf8")]);
  writeFileSync(keyFile(), data);
  cachedKey = trimmed;
  return status();
}

export function clearKey(): ClaudeStatus {
  try {
    if (existsSync(keyFile())) unlinkSync(keyFile());
  } catch {
    /* ignore */
  }
  cachedKey = null;
  return status();
}

export function abort(requestId: string) {
  controllers.get(requestId)?.abort();
}

export async function turn(req: ClaudeTurnRequest, sender: WebContents): Promise<ClaudeTurnResult> {
  const { key } = activeKey();
  if (!key) return { ok: false, kind: "no_key", error: "No Claude API key configured." };

  const client = new Anthropic({ apiKey: key });
  const controller = new AbortController();
  controllers.set(req.requestId, controller);
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        cache_control: { type: "ephemeral" },
        system: req.system,
        tools: req.tools,
        messages: req.messages,
      },
      { signal: controller.signal },
    );
    stream.on("text", (text) => {
      if (!sender.isDestroyed()) sender.send("claude:delta", { requestId: req.requestId, text });
    });
    const message = await stream.finalMessage();
    return { ok: true, message: JSON.parse(JSON.stringify(message)) };
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, kind: "aborted", error: "Request cancelled." };
    if (err instanceof Anthropic.AuthenticationError)
      return { ok: false, kind: "auth", error: "The API key was rejected. Check it in Settings → Claude AI." };
    if (err instanceof Anthropic.PermissionDeniedError)
      return { ok: false, kind: "auth", error: "This API key does not have access to the requested model." };
    if (err instanceof Anthropic.RateLimitError)
      return { ok: false, kind: "rate_limit", error: "Rate limited by the Claude API — try again in a moment." };
    if (err instanceof Anthropic.APIConnectionError)
      return { ok: false, kind: "network", error: "Couldn't reach the Claude API. Check your internet connection." };
    if (err instanceof Anthropic.APIError)
      return { ok: false, kind: "api", error: `Claude API error ${err.status ?? ""}: ${err.message}` };
    return { ok: false, kind: "api", error: err instanceof Error ? err.message : String(err) };
  } finally {
    controllers.delete(req.requestId);
  }
}
