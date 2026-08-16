import { create } from "zustand";
import { persist } from "zustand/middleware";

export const WORKSPACE_MODE = {
  GUIDED: "guided",
  PROFESSIONAL: "professional",
} as const;

export type WorkspaceMode =
  (typeof WORKSPACE_MODE)[keyof typeof WORKSPACE_MODE];

interface WorkspaceModeStore {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
}

export const useWorkspaceModeStore = create<WorkspaceModeStore>()(
  persist(
    (set) => ({
      mode: WORKSPACE_MODE.GUIDED,
      setMode: (mode) => set({ mode }),
    }),
    { name: "studio-workspace-mode", version: 1 },
  ),
);
