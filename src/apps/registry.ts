import type { ComponentType } from "react";
import { Calculator, FolderOpen, Info, Settings2, SquareTerminal, FileCode2, Feather } from "lucide-react";
import type { AppId } from "../os/store";
import { TesseractIcon } from "../components/TesseractIcon";

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number; className?: string }>;

export interface AppMeta {
  id: AppId;
  title: string;
  description: string;
  icon: IconComponent;
  gradient: string;
  size: { w: number; h: number };
  minSize: { w: number; h: number };
  singleton: boolean;
}

export const APPS: Record<AppId, AppMeta> = {
  files: {
    id: "files",
    title: "Files",
    description: "Browse and manage your files",
    icon: FolderOpen,
    gradient: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
    size: { w: 900, h: 580 },
    minSize: { w: 520, h: 340 },
    singleton: false,
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    description: "Command line shell",
    icon: SquareTerminal,
    gradient: "linear-gradient(135deg, #3f3f46 0%, #0a0a0f 100%)",
    size: { w: 780, h: 480 },
    minSize: { w: 420, h: 260 },
    singleton: false,
  },
  browser: {
    id: "browser",
    title: "Tesseract",
    description: "A browser built to run fast on anything",
    icon: TesseractIcon,
    gradient: "linear-gradient(135deg, #22d3ee 0%, #6366f1 55%, #7c3aed 100%)",
    size: { w: 1120, h: 720 },
    minSize: { w: 520, h: 360 },
    singleton: false,
  },
  folio: {
    id: "folio",
    title: "Folio",
    description: "Distraction-free writing",
    icon: Feather,
    gradient: "linear-gradient(135deg, #fda4af 0%, #e11d48 100%)",
    size: { w: 860, h: 640 },
    minSize: { w: 480, h: 340 },
    singleton: false,
  },
  editor: {
    id: "editor",
    title: "Code",
    description: "Text and code editor",
    icon: FileCode2,
    gradient: "linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)",
    size: { w: 860, h: 600 },
    minSize: { w: 460, h: 300 },
    singleton: false,
  },
  settings: {
    id: "settings",
    title: "Settings",
    description: "Personalize DeltaOS",
    icon: Settings2,
    gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
    size: { w: 920, h: 620 },
    minSize: { w: 640, h: 420 },
    singleton: true,
  },
  calculator: {
    id: "calculator",
    title: "Calculator",
    description: "Quick arithmetic",
    icon: Calculator,
    gradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
    size: { w: 320, h: 500 },
    minSize: { w: 280, h: 440 },
    singleton: true,
  },
  about: {
    id: "about",
    title: "About DeltaOS",
    description: "System information",
    icon: Info,
    gradient: "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
    size: { w: 520, h: 560 },
    minSize: { w: 420, h: 440 },
    singleton: true,
  },
};

export const PINNED: AppId[] = ["files", "browser", "terminal", "editor", "folio", "settings", "calculator"];
