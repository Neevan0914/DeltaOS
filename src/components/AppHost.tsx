import type { ComponentType } from "react";
import type { AppId, WinState } from "../os/store";
import { Terminal } from "../apps/Terminal";
import { FileExplorer } from "../apps/FileExplorer";
import { Editor } from "../apps/Editor";
import { SettingsApp } from "../apps/Settings";
import { AboutApp } from "../apps/About";
import { CalculatorApp } from "../apps/Calculator";
import { Browser } from "../apps/Browser";
import { Folio } from "../apps/Folio";

export interface AppProps {
  win: WinState;
}

const COMPONENTS: Record<AppId, ComponentType<AppProps>> = {
  terminal: Terminal,
  files: FileExplorer,
  editor: Editor,
  folio: Folio,
  browser: Browser,
  settings: SettingsApp,
  about: AboutApp,
  calculator: CalculatorApp,
};

export function AppHost({ win }: AppProps) {
  const C = COMPONENTS[win.app];
  return <C win={win} />;
}
