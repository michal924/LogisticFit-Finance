import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  density: "compact" | "default" | "comfortable";
  setSidebarCollapsed: (v: boolean) => void;
  setDensity: (v: UiState["density"]) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: "default",
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setDensity: (v) => set({ density: v }),
    }),
    { name: "lf-ui" }
  )
);
