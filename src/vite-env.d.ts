/// <reference types="vite/client" />
import type { DeltaBridge } from "../shared/ipc";

declare global {
  interface Window {
    deltaos?: DeltaBridge;
  }
}
