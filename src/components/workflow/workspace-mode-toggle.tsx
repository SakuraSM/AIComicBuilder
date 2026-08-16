"use client";

import { Compass, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_MODE,
  useWorkspaceModeStore,
  type WorkspaceMode,
} from "@/stores/workspace-mode-store";

const MODE_ICON = {
  [WORKSPACE_MODE.GUIDED]: Compass,
  [WORKSPACE_MODE.PROFESSIONAL]: SlidersHorizontal,
};

export function WorkspaceModeToggle() {
  const t = useTranslations("studio");
  const mode = useWorkspaceModeStore((state) => state.mode);
  const setMode = useWorkspaceModeStore((state) => state.setMode);
  const modes = Object.values(WORKSPACE_MODE);

  function selectMode(nextMode: WorkspaceMode): void {
    setMode(nextMode);
  }

  return (
    <div
      role="group"
      aria-label={t("workspaceMode")}
      className="hidden items-center rounded-lg border border-[--border-subtle] bg-[--surface] p-0.5 sm:flex"
    >
      {modes.map((modeValue) => {
        const Icon = MODE_ICON[modeValue];
        const isSelected = mode === modeValue;
        return (
          <button
            key={modeValue}
            type="button"
            aria-pressed={isSelected}
            onClick={() => selectMode(modeValue)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "bg-white text-[--text-primary] shadow-sm"
                : "text-[--text-muted] hover:text-[--text-primary]",
            )}
          >
            <Icon className="h-3 w-3" />
            {t(modeValue)}
          </button>
        );
      })}
    </div>
  );
}
