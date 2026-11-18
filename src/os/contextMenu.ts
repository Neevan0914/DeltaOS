import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label?: string;
  icon?: LucideIcon;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

let menu: MenuState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function showContextMenu(e: { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void }, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  menu = { x: e.clientX, y: e.clientY, items };
  emit();
}
export function hideContextMenu() {
  if (!menu) return;
  menu = null;
  emit();
}
export function useContextMenu() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => menu,
  );
}
