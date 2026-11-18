// High-level OS actions shared by the Terminal, the Assistant tools and the offline assistant.
import { ACCENTS, accentName, resolveAccent } from "./theme";
import { WALLPAPERS, wallpaperById } from "./wallpapers";
import { getState, notify, updateSettings, type AppId, type TerminalTheme } from "./store";

export const APP_IDS: AppId[] = ["terminal", "files", "editor", "settings", "calculator", "about"];

export function setTheme(mode: "dark" | "light") {
  updateSettings({ theme: mode });
  return `Theme set to ${mode} mode.`;
}

export function setAccent(input: string) {
  const hex = resolveAccent(input);
  if (!hex) throw new Error(`Unknown color "${input}". Try: ${ACCENTS.map((a) => a.id).join(", ")} or a hex value like #ff8800.`);
  updateSettings({ accent: hex });
  return `Accent color set to ${accentName(hex)}.`;
}

export function findWallpaper(input: string) {
  const v = input.trim().toLowerCase();
  return WALLPAPERS.find((w) => w.id === v || w.name.toLowerCase() === v || w.name.toLowerCase().includes(v) || v.includes(w.id));
}

export function setWallpaper(input: string) {
  const wp = findWallpaper(input);
  if (!wp) throw new Error(`Unknown wallpaper "${input}". Available: ${WALLPAPERS.map((w) => w.id).join(", ")}.`);
  updateSettings({ wallpaper: wp.id });
  return `Wallpaper changed to ${wp.name}.`;
}

export function setTerminalTheme(t: TerminalTheme) {
  updateSettings({ terminalTheme: t });
  return `Terminal theme set to ${t}.`;
}

export function systemSnapshot() {
  const s = getState();
  return {
    theme: s.settings.theme,
    accent: { name: accentName(s.settings.accent), hex: s.settings.accent },
    wallpaper: { id: s.settings.wallpaper, name: wallpaperById(s.settings.wallpaper).name },
    transparency: s.settings.transparency,
    animations: s.settings.animations,
    clock_24h: s.settings.clock24,
    terminal_theme: s.settings.terminalTheme,
    username: s.settings.username,
    open_windows: s.windows
      .filter((w) => !w.closing)
      .map((w) => ({ app: w.app, title: w.title, minimized: w.minimized, maximized: w.maximized })),
    available_wallpapers: WALLPAPERS.map((w) => ({ id: w.id, name: w.name })),
    available_accents: ACCENTS.map((a) => ({ id: a.id, hex: a.hex })),
    local_time: new Date().toString(),
  };
}

export { notify };
