import {
  AudioLines, BookOpen, Briefcase, Code2, Crown, GraduationCap, Grid3x3, Image, Languages, ListTodo, MessageCircle, MessageSquare,
  Minimize2, NotebookText, Palette, PenTool, Send, Shapes, Sigma, Sparkles, SquareKanban, SquarePlay, Tv, type LucideIcon,
} from "lucide-react";
import { WEB_APPS, webAppById, type WebAppDef } from "../../shared/webapps";
import { getState, notify, updateSettings } from "./store";
import { closeWindow, focusWindow, openApp } from "./windows";

export { WEB_APPS, webAppById, type WebAppDef };

/** Icons are generic glyphs on app-coloured tiles (not the services' own logos). */
export const WEB_APP_LOOK: Record<string, { icon: LucideIcon; gradient: string }> = {
  vscode: { icon: Code2, gradient: "linear-gradient(135deg, #3ba7f5, #0a66c2)" },
  office: { icon: Briefcase, gradient: "linear-gradient(135deg, #f97352, #c2410c)" },
  notion: { icon: NotebookText, gradient: "linear-gradient(135deg, #52525b, #18181b)" },
  trello: { icon: SquareKanban, gradient: "linear-gradient(135deg, #3b82f6, #1e40af)" },
  todoist: { icon: ListTodo, gradient: "linear-gradient(135deg, #f87171, #dc2626)" },
  photopea: { icon: Image, gradient: "linear-gradient(135deg, #2dd4bf, #0f766e)" },
  canva: { icon: Palette, gradient: "linear-gradient(135deg, #22d3ee, #7c3aed)" },
  excalidraw: { icon: PenTool, gradient: "linear-gradient(135deg, #a78bfa, #6d28d9)" },
  tldraw: { icon: Shapes, gradient: "linear-gradient(135deg, #94a3b8, #334155)" },
  discord: { icon: MessageSquare, gradient: "linear-gradient(135deg, #818cf8, #4f46e5)" },
  whatsapp: { icon: MessageCircle, gradient: "linear-gradient(135deg, #4ade80, #15803d)" },
  telegram: { icon: Send, gradient: "linear-gradient(135deg, #38bdf8, #0284c7)" },
  youtube: { icon: SquarePlay, gradient: "linear-gradient(135deg, #f87171, #b91c1c)" },
  soundcloud: { icon: AudioLines, gradient: "linear-gradient(135deg, #fdba74, #ea580c)" },
  twitch: { icon: Tv, gradient: "linear-gradient(135deg, #c084fc, #7e22ce)" },
  lichess: { icon: Crown, gradient: "linear-gradient(135deg, #a8a29e, #292524)" },
  wordle: { icon: Grid3x3, gradient: "linear-gradient(135deg, #86efac, #16a34a)" },
  duolingo: { icon: Languages, gradient: "linear-gradient(135deg, #a3e635, #4d7c0f)" },
  khan: { icon: GraduationCap, gradient: "linear-gradient(135deg, #5eead4, #0d9488)" },
  desmos: { icon: Sigma, gradient: "linear-gradient(135deg, #4ade80, #166534)" },
  wikipedia: { icon: BookOpen, gradient: "linear-gradient(135deg, #d4d4d8, #52525b)" },
  translate: { icon: Languages, gradient: "linear-gradient(135deg, #60a5fa, #1d4ed8)" },
  squoosh: { icon: Minimize2, gradient: "linear-gradient(135deg, #f472b6, #be185d)" },
  claude: { icon: Sparkles, gradient: "linear-gradient(135deg, #f0a27a, #b9583c)" },
};

export const isInstalled = (id: string) => getState().settings.installedApps.includes(id);
export const installedApps = (ids: string[]) => ids.map(webAppById).filter((a): a is WebAppDef => !!a);

export function installApp(id: string) {
  const def = webAppById(id);
  if (!def || isInstalled(id)) return;
  updateSettings({ installedApps: [...getState().settings.installedApps, id] });
  notify(`${def.name} installed`, "It's on your desktop and in Start.", "success");
}

export async function uninstallApp(id: string, clearData = true) {
  const def = webAppById(id);
  if (!def) return;
  getState()
    .windows.filter((w) => w.app === "webapp" && w.props.webapp === id)
    .forEach((w) => closeWindow(w.id));
  updateSettings({ installedApps: getState().settings.installedApps.filter((x) => x !== id) });
  if (clearData) await window.deltaos?.webapps.clearData(id);
  notify(`${def.name} uninstalled`, clearData ? "Its sign-in and data were removed." : "", "info");
}

/** Open an App Store app in its own window (one window per app). */
export function openWebApp(id: string) {
  const existing = getState().windows.find((w) => w.app === "webapp" && w.props.webapp === id && !w.closing);
  if (existing) return focusWindow(existing.id);
  return openApp("webapp", { webapp: id });
}
